import { describe, expect, it } from 'vitest'
import { activeOffers, upcomingOffers, offerState } from '@/candle/rules'
import type { CandleOffer } from '@/candle/types'

/**
 * That every running campaign is shown, not just the first one back.
 *
 * Reported from the game: two missions were open and the screen showed one.
 * `activeOffer` answered with `find`, on the assumption that the contract
 * runs one campaign at a time — it does not. The second was not "active", and
 * because it had already started it was not "upcoming" either, so nothing on
 * the screen looked at it and a mission the player could have entered was
 * invisible.
 */

const HOUR = 3_600_000

/** The contract stores naive UTC timestamps; `offerState` appends the Z. */
const at = (ms: number) => new Date(ms).toISOString().replace('Z', '')

function offer(id: string, startsIn: number, endsIn: number): CandleOffer {
  const now = Date.now()
  return {
    offer_id: id,
    offer_start: at(now + startsIn),
    offer_end: at(now + endsIn),
    reward_type: 'tlm',
    reward_amount: '100.0000 TLM',
    requirements: 'Portals used',
    requirement_amount: 10,
  } as unknown as CandleOffer
}

describe('activeOffers', () => {
  it('returns every campaign that is open, not just the first', () => {
    /* The regression. Both are running; both have to be on screen. */
    const a = offer('a', -2 * HOUR, 6 * HOUR)
    const b = offer('b', -1 * HOUR, 3 * HOUR)

    expect(activeOffers([a, b]).map((o) => o.offer_id)).toEqual(['b', 'a'])
  })

  it('puts the one that closes soonest first', () => {
    /* The decision that cannot wait leads. Given in the other order, to be
       sure this is a sort rather than the order they arrived in. */
    const soon = offer('soon', -HOUR, HOUR)
    const later = offer('later', -HOUR, 10 * HOUR)

    expect(activeOffers([later, soon]).map((o) => o.offer_id)).toEqual([
      'soon',
      'later',
    ])
  })

  it('leaves out the ones that have not started', () => {
    const open = offer('open', -HOUR, HOUR)
    const soon = offer('soon', HOUR, 5 * HOUR)

    expect(activeOffers([open, soon]).map((o) => o.offer_id)).toEqual(['open'])
  })

  it('falls back to the most recently ended when nothing is open', () => {
    /*
       A campaign settles after it closes — `calcclaim` pays out and the row
       lingers — so the player who contributed to it still has something to
       look at. Only one, and the latest.
    */
    const old = offer('old', -50 * HOUR, -40 * HOUR)
    const recent = offer('recent', -10 * HOUR, -2 * HOUR)

    expect(activeOffers([old, recent]).map((o) => o.offer_id)).toEqual(['recent'])
  })

  it('has nothing to show when the contract holds nothing', () => {
    expect(activeOffers([])).toEqual([])
  })

  it('never shows the same campaign as both running and coming up', () => {
    /*
       The two lists are what the screen renders, and between them they must
       cover the open one exactly once. A campaign that fell out of `active`
       used to fall into neither.
    */
    const running = offer('running', -HOUR, HOUR)
    const alsoRunning = offer('also', -HOUR, 2 * HOUR)
    const later = offer('later', 4 * HOUR, 8 * HOUR)
    const all = [running, alsoRunning, later]

    const active = activeOffers(all).map((o) => o.offer_id)
    const next = upcomingOffers(all).map((o) => o.offer_id)

    expect(active).toContain('running')
    expect(active).toContain('also')
    expect(next).toEqual(['later'])
    expect(active.filter((id) => next.includes(id))).toEqual([])
  })

  it('agrees with offerState about what open means', () => {
    /* One definition of "running", so a card cannot be listed as active and
       then render itself as closed. */
    const all = [
      offer('a', -HOUR, HOUR),
      offer('b', -3 * HOUR, -HOUR),
      offer('c', HOUR, 2 * HOUR),
    ]

    for (const o of activeOffers(all)) {
      expect(offerState(o).phase).toBe('open')
    }
  })
})
