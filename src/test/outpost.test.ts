import { describe, expect, it } from 'vitest'
import {
  SHARD_SCALE,
  canRedeem,
  closesIn,
  formatShards,
  isActive,
  offerArt,
  opensIn,
  outpostBoard,
  shardBalance,
} from '@/outpost/rules'
import type { OutpostOffer, PointOffer, UserPoints } from '@/outpost/types'

/**
 * The Alien Worlds Outpost tab.
 *
 * Two things here can be wrong in ways nobody notices until a player is out
 * of pocket. The scale: shards are stored ten times their displayed size, so
 * a price of 5,368,000 on chain is 536,800 shards to a player — print the raw
 * figure and every price on the tab is ten times too big. And the window:
 * `pointoffers` keeps every offer ever run, a hundred and fifty of them
 * expired, so "what can I buy" is entirely a question of start and end dates.
 *
 * Affordability is compared in raw chain units on purpose. Comparing the
 * printed figures would let a rounded tenth decide whether the chain accepts
 * a redemption the screen offered.
 */

const NOW = Date.parse('2026-09-12T12:00:00Z')

/** A WAX timestamp: UTC, no zone suffix. */
const stamp = (iso: string) => iso.replace('Z', '')

const offer = (over: Partial<PointOffer> = {}): PointOffer => ({
  id: 1,
  start: stamp('2026-09-01T00:00:00Z'),
  end: stamp('2026-09-30T23:59:59Z'),
  template_id: 19553,
  required: 84_000,
  ...over,
})

const entry = (over: Partial<PointOffer> = {}): OutpostOffer => ({ offer: offer(over) })

const points = (redeemable: number): UserPoints =>
  ({ user: 'smoke.wam', redeemable_points: redeemable }) as UserPoints

describe('the shard scale', () => {
  it('prints a tenth of the stored figure', () => {
    /* Verbatim from mainnet: offer 3205 costs 5,368,000 on chain. */
    expect(SHARD_SCALE).toBe(10)
    expect(formatShards(5_368_000)).toBe('536,800')
    expect(formatShards(84_000)).toBe('8,400')
    expect(formatShards(0)).toBe('0')
  })

  it('drops the tenth rather than rounding it up', () => {
    /*
       Every offer price on chain is a multiple of ten and prints exactly; a
       balance need not be. Flooring can never tell a player they hold more
       than they do — 19,526 points is 1,952 shards, not 1,953.
    */
    expect(formatShards(19_526)).toBe('1,952')
    expect(formatShards(9)).toBe('0')
  })
})

describe('which offers a player can see', () => {
  it('splits open from upcoming and drops the expired', () => {
    const board = outpostBoard(
      [
        entry({ id: 1, start: stamp('2026-08-01T00:00:00Z'), end: stamp('2026-08-31T23:59:59Z') }),
        entry({ id: 2, start: stamp('2026-09-10T00:00:00Z'), end: stamp('2026-09-20T23:59:59Z') }),
        entry({ id: 3, start: stamp('2026-09-19T00:00:00Z'), end: stamp('2026-09-24T23:59:59Z') }),
      ],
      NOW,
    )

    expect(board.active.map((e) => e.offer.id)).toEqual([2])
    expect(board.upcoming.map((e) => e.offer.id)).toEqual([3])
  })

  it('leads with what closes soonest, then what opens soonest', () => {
    /* An offer with a day left is the one a player needs to see first; among
       the upcoming, the nearest is the one worth saving for. */
    const board = outpostBoard(
      [
        entry({ id: 1, start: stamp('2026-09-01T00:00:00Z'), end: stamp('2026-09-20T23:59:59Z') }),
        entry({ id: 2, start: stamp('2026-09-01T00:00:00Z'), end: stamp('2026-09-13T23:59:59Z') }),
        entry({ id: 3, start: stamp('2026-09-25T00:00:00Z'), end: stamp('2026-09-30T23:59:59Z') }),
        entry({ id: 4, start: stamp('2026-09-14T00:00:00Z'), end: stamp('2026-09-18T23:59:59Z') }),
      ],
      NOW,
    )

    expect(board.active.map((e) => e.offer.id)).toEqual([2, 1])
    expect(board.upcoming.map((e) => e.offer.id)).toEqual([4, 3])
  })

  it('counts an offer open on its closing day', () => {
    /* The contract's `end` is 23:59:59, so the last day is still a buying
       day — treating it as past would shut the shop a day early. */
    const last = offer({ start: stamp('2026-09-01T00:00:00Z'), end: stamp('2026-09-12T23:59:59Z') })

    expect(isActive(last, NOW)).toBe(true)
    expect(closesIn(last, NOW)).toBe('last day')
  })
})

describe('whether a redemption is offered', () => {
  it('needs an Outpost account at all', () => {
    /*
       `uspts.worlds` keeps a row per wallet and will not create one, so a
       player who has never mined in Alien Worlds cannot redeem. Saying so
       beats letting the wallet open and the transaction fail.
    */
    const gate = canRedeem(entry(), 0, false, NOW)

    expect(gate.ok).toBe(false)
    expect(gate.reason).toBe('No Outpost account')
  })

  it('compares raw units, not the printed figure', () => {
    /*
       The one that matters, and it needs a price that is not a multiple of
       ten to show it. Every price on chain today is — so a rounded comparison
       agrees with a raw one on all of them, and the bug would sit there
       invisible until the team priced something at 84,005.

       Then: raw says 84,000 is 5 short and blocks. Rounded says 8,400 against
       8,400 and offers a redemption `redeempntnft` will refuse. `required` is
       a plain uint32 with nothing holding it to tens.
    */
    const odd = entry({ required: 84_005 })

    const short = canRedeem(odd, 84_000, true, NOW)
    expect(short.ok).toBe(false)
    expect(short.short).toBe(5)

    /* And the exact figure is enough, not a tenth more. */
    expect(canRedeem(odd, 84_005, true, NOW).ok).toBe(true)
  })

  it('refuses an offer that is not open, however rich the player', () => {
    const soon = entry({ start: stamp('2026-09-20T00:00:00Z'), end: stamp('2026-09-25T00:00:00Z') })

    expect(canRedeem(soon, 999_999_999, true, NOW).reason).toBe('Not open')
  })

  it('reads a missing row as no shards rather than as an error', () => {
    expect(shardBalance(undefined)).toBe(0)
    expect(shardBalance(points(19_526))).toBe(19_526)
  })
})

describe('the incidental copy', () => {
  it('says when an upcoming offer opens', () => {
    expect(opensIn(offer({ start: stamp('2026-09-13T00:00:00Z') }), NOW)).toBe('tomorrow')
    expect(opensIn(offer({ start: stamp('2026-09-15T00:00:00Z') }), NOW)).toBe('in 3 days')
  })

  it('builds an Alien Worlds IPFS url, and nothing at all without a hash', () => {
    const art = offerArt({
      template_id: 1,
      name: 'Standard Drill',
      rarity: 'Abundant',
      shine: 'Stone',
      kind: 'Extractor',
      img: 'QmVUZHpUkc3PuLkJ7BDvJ3S3AgDySjsqWQib1sVKziHCbS',
    })
    expect(art).toBe(
      'https://ipfs.alienworlds.io/ipfs/QmVUZHpUkc3PuLkJ7BDvJ3S3AgDySjsqWQib1sVKziHCbS',
    )

    /* AtomicAssets is a separate service from the chain the prices live on.
       Losing it costs the picture, and the card has to render without one. */
    expect(offerArt(undefined)).toBe('')
  })
})
