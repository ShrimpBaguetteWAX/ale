import { describe, expect, it } from 'vitest'
import { confirmThen } from '@/chain/confirm'
import { playedDungeonsToday } from '@/map/planetStatus'
import { playedHere } from '@/dungeon/rules'
import type { Player } from '@/chain/types'

/**
 * The map's "played today", and the one read that used to decide it.
 *
 * Reported from the game: a dungeon run finished and the map still offered
 * the dungeon. It usually did not happen, which is the tell — the state comes
 * off `played_dungeons` on the player row, nothing else re-reads that row (a
 * table drop refreshes screens built on `useChainQuery`, and the player lives
 * in the store), and the one forced read was taken at the earliest possible
 * moment, when the node is most likely to still be serving the row from
 * before the transaction. Win the race and it worked; lose it and the run was
 * invisible until something else refreshed.
 */

const player = (over: Partial<Player> = {}): Player =>
  ({
    wallet: 'smoke.wam',
    played_dungeons: '',
    /* The contract clears the list on the first run of a new UTC day, so a
       reset from today is what makes the list count at all. */
    last_dungeon_reset: new Date().toISOString().replace('Z', '').slice(0, 19),
    ...over,
  }) as Player

describe('playedDungeonsToday', () => {
  it('reads the contract\'s own dot-separated keys', () => {
    /* Checked against a live row: `magor.ccxbg,magor.ccxbf,...`. */
    const p = player({ played_dungeons: 'magor.ccxbg,magor.ccxbf' })

    expect(playedDungeonsToday(p)).toEqual(new Set(['magor.ccxbg', 'magor.ccxbf']))
    expect(playedHere(p, 'magor', 'ccxbg')).toBe(true)
    expect(playedHere(p, 'magor', 'never')).toBe(false)
  })

  it('ignores a list left over from a previous day', () => {
    /* The contract overwrites rather than appends on the day's first run, so
       yesterday's list means nothing has been played today. */
    const p = player({
      played_dungeons: 'magor.ccxbg',
      last_dungeon_reset: '2020-01-01T00:00:00',
    })

    expect(playedDungeonsToday(p)).toEqual(new Set())
    expect(playedHere(p, 'magor', 'ccxbg')).toBe(false)
  })
})

describe('confirming the run landed', () => {
  it('keeps reading until the row shows the dungeon as played', async () => {
    /*
       The fix, as the race it is for: the node serves the row from before
       the transaction twice before catching up. One read would have stored
       the stale row and stopped.
    */
    let reads = 0
    const rows = [
      player(),
      player(),
      player({ played_dungeons: 'magor.ccxbg' }),
    ]

    const result = await confirmThen(
      async () => rows[Math.min(reads++, rows.length - 1)],
      (p) => playedHere(p, 'magor', 'ccxbg'),
      { intervalMs: 0 },
    )

    expect(reads).toBe(3)
    expect(result.confirmed).toBe(true)
    expect(playedHere(result.value!, 'magor', 'ccxbg')).toBe(true)
  })

  it('stops on the first read that already shows it', async () => {
    /* The common case, which must not cost five more requests. */
    let reads = 0
    const result = await confirmThen(
      async () => {
        reads++
        return player({ played_dungeons: 'magor.ccxbg' })
      },
      (p) => playedHere(p, 'magor', 'ccxbg'),
      { intervalMs: 0 },
    )

    expect(reads).toBe(1)
    expect(result.confirmed).toBe(true)
  })

  it('gives up rather than reading for ever when it never lands', async () => {
    let reads = 0
    const result = await confirmThen(
      async () => {
        reads++
        return player()
      },
      (p) => playedHere(p, 'magor', 'ccxbg'),
      { attempts: 4, intervalMs: 0 },
    )

    expect(reads).toBe(4)
    expect(result.confirmed).toBe(false)
  })
})
