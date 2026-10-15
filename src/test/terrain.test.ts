import { describe, expect, it } from 'vitest'
import { MIN_SHOWN_BOOST, boostShown, formatBoost, liveBoostPercent } from '@/map/terrain'

/**
 * The line under which the map stops drawing a building.
 *
 * The threshold is stated in the contract's unit and shown in the game's,
 * so the one thing worth pinning is that the two agree: the smallest boost
 * still drawn prints as 0.1x, and the first one hidden prints below it.
 */
describe('a building too decayed to show', () => {
  it('is hidden below 0.1x and drawn from 0.1x', () => {
    expect(formatBoost(MIN_SHOWN_BOOST)).toBe('0.1x')
    expect(boostShown(MIN_SHOWN_BOOST)).toBe(true)
    expect(boostShown(0.99)).toBe(false)
    expect(boostShown(0)).toBe(false)
    expect(boostShown(35)).toBe(true)
  })

  it('is judged on the boost as it is now, not as it was last written', () => {
    const now = Date.parse('2026-10-15T12:00:00Z')
    /* Written at 20,000 (0.2x) ten hours ago, decaying 1,500 an hour: 5,000 now. */
    const percent = liveBoostPercent(20_000, '2026-10-15T02:00:00', 1_500, now)
    expect(percent).toBe(0.5)
    expect(boostShown(percent)).toBe(false)
    /* Written an hour ago it is still 18,500: drawn. */
    expect(boostShown(liveBoostPercent(20_000, '2026-10-15T11:00:00', 1_500, now))).toBe(true)
  })
})
