import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChores } from '@/chores/useChores'
import { CHORE_CHECKS } from '@/chores/checks'
import { refreshChore } from '@/chores/signal'
import type { Player } from '@/chain/types'

/**
 * How long a dot takes to catch up with something the player just did.
 *
 * The scheduler runs one check per four-second tick, most overdue first. That
 * is the right ceiling for an idle hour against public nodes and the wrong
 * one for the seconds after a signature: an action wakes every dot built on
 * the player row — all eight — and ties were broken by declaration order, so
 * `quests` was third in line. Claiming a quest left its dot lit for eight to
 * twelve seconds with the player looking straight at it.
 *
 * These measure it rather than reason about it: each check records the moment
 * it ran, against a fake clock.
 */

const player = { wallet: 'smoke.wam', activestats: { credits: 1 } } as unknown as Player

/** When each check ran, in ms since the action. */
let ranAt: { key: string; at: number }[]
let t0 = 0

beforeEach(() => {
  vi.useFakeTimers()
  ranAt = []
  /* Every check answers instantly and reports nothing lit — this is about
     when they are given their turn, not what they decide. */
  for (const check of CHORE_CHECKS) {
    vi.spyOn(check, 'run').mockImplementation(async () => {
      ranAt.push({ key: check.key, at: Date.now() - t0 })
      return false
    })
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Mount the scheduler and let its opening pass drain, so the queue is idle. */
async function settled() {
  const hook = renderHook(() => useChores(player, '/map'))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000)
  })
  ranAt = []
  t0 = Date.now()
  return hook
}

const whenRan = (key: string) => ranAt.find((r) => r.key === key)?.at

describe('the chore scheduler', () => {
  it('runs the dot the action changed before any other', async () => {
    /*
       Claiming a quest forces `quests` and wakes the other seven off the
       player row. The forced one is the section the player acted in, so it
       goes first whatever declaration order says.
    */
    await settled()

    await act(async () => {
      refreshChore('quests', true)
      for (const c of CHORE_CHECKS) if (c.key !== 'quests') refreshChore(c.key, false)
      await vi.advanceTimersByTimeAsync(50)
    })

    expect(ranAt[0]?.key).toBe('quests')
  })

  it('answers within a moment, not within three ticks', async () => {
    /* The complaint, as a number. Under the old scheduler this was one full
       tick at best and three at worst. */
    await settled()

    await act(async () => {
      refreshChore('quests', true)
      await vi.advanceTimersByTimeAsync(50)
    })

    expect(whenRan('quests')).toBeLessThan(100)
  })

  it('drains the rest of the batch quickly rather than one per four seconds', async () => {
    /*
       A travel completes a quest: nothing is forced, and all eight are woken
       off the player row. `quests` is third in declaration order, so this is
       the case that used to cost eight to twelve seconds.
    */
    await settled()

    await act(async () => {
      for (const c of CHORE_CHECKS) refreshChore(c.key, false)
      await vi.advanceTimersByTimeAsync(3_000)
    })

    /* Third in line, and there within two seconds rather than twelve. */
    expect(whenRan('quests')).toBeLessThan(2_000)

    /* The whole batch of eight lands inside the time two of them used to
       take. */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(ranAt).toHaveLength(CHORE_CHECKS.length)
    expect(Math.max(...ranAt.map((r) => r.at))).toBeLessThan(8 * 700)
  })

  it('never runs two checks at the same instant', async () => {
    /* The ceiling that protects the nodes: faster, still strictly one at a
       time, and never two in the same millisecond. */
    await settled()

    await act(async () => {
      for (const c of CHORE_CHECKS) refreshChore(c.key, false)
      await vi.advanceTimersByTimeAsync(10_000)
    })

    const times = ranAt.map((r) => r.at)
    expect(new Set(times).size).toBe(times.length)
  })

  it('goes back to the idle pace once the batch is done', async () => {
    /*
       The faster pace belongs to the queue an action caused, and to nothing
       else. Once it is empty the scheduler must not keep running checks at
       `SIGNAL_TICK` — an idle player would be paying seven times the request
       rate the budget was set for.
    */
    await settled()

    await act(async () => {
      for (const c of CHORE_CHECKS) refreshChore(c.key, false)
      await vi.advanceTimersByTimeAsync(10_000)
    })
    const afterBatch = ranAt.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    /* Nothing is due again for minutes, so a quiet ten seconds should add
       nothing at all. */
    expect(ranAt.length).toBe(afterBatch)
  })
})
