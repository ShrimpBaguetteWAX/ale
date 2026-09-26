import { describe, expect, it } from 'vitest'
import { boostCost, stepCosts } from '@/lands/rules'
import type { LandsConfig } from '@/chain/types'

/**
 * What a boost costs, and why one number cannot answer it.
 *
 * These are the live `lands.ale` config values: each 0.1x costs three
 * percent more than the one below it, so the rate depends on where the
 * building already is *and* how far the slider has been dragged.
 */
const config = {
  boost_cost_mod: 1.03,
  boost_base_cost: 999,
  boost_cost_first_percent: 999,
} as unknown as LandsConfig

/* Scores are in hundredths of a percent: 120_000 is the 1.2x on screen. */
const x = (n: number) => n * 100_000

describe('boost steps', () => {
  it('charges more for a step the higher the building already is', () => {
    const low = stepCosts(x(1.2), x(1.3), config)
    const high = stepCosts(x(2.4), x(2.5), config)
    expect(high.first).toBeGreaterThan(low.first)
    /* Roughly 1,470 against 2,090 at the live rates. */
    expect(low.first).toBeGreaterThan(1_400)
    expect(high.first).toBeGreaterThan(2_000)
  })

  it('moves with the slider rather than reporting the first step forever', () => {
    const short = stepCosts(x(1.2), x(1.3), config)
    const long = stepCosts(x(1.2), x(2.5), config)
    expect(long.steps).toBe(13)
    expect(long.average).toBeGreaterThan(short.average)
    expect(long.last).toBeGreaterThan(long.first)
  })

  it('averages to the total the panel shows beside it', () => {
    const total = boostCost(x(1.2), x(2.5), config) - Number(config.boost_base_cost)
    const s = stepCosts(x(1.2), x(2.5), config)
    /* The average is whole credits, so the two reconcile to within the
       rounding of one credit per step and no further. */
    expect(Math.abs(s.average * s.steps - total)).toBeLessThanOrEqual(s.steps)
  })

  it('has nothing to say about a target at or below where it stands', () => {
    expect(stepCosts(x(2), x(2), config)).toEqual({ first: 0, last: 0, average: 0, steps: 0 })
    expect(stepCosts(x(2), x(1), config).steps).toBe(0)
  })
})
