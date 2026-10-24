import { describe, expect, it } from 'vitest'
import { boostState, hoursToSmallerLook, needsBoost } from '@/lands/rules'
import type { LandsConfig } from '@/chain/types'

/**
 * When a building asks for another boost, and when its look on the map
 * drops a rank. Scores are in hundredths of a percent: 100_000 is the 1.0x
 * on screen.
 */
const config = { disable_building_boost_score: 0 } as unknown as LandsConfig
const x = (n: number) => n * 100_000

describe('needsBoost', () => {
  it('flags 2.0x and below, by the multiplier the player is shown', () => {
    expect(needsBoost(x(2.0) / 10_000)).toBe(true)
    /* 2.04x shows as 2.0x */
    expect(needsBoost(204_000 / 10_000)).toBe(true)
    /* 2.05x shows as 2.1x */
    expect(needsBoost(205_000 / 10_000)).toBe(false)
    expect(needsBoost(x(2.5) / 10_000)).toBe(false)
  })
})

describe('boostState', () => {
  it('runs from fine to closed', () => {
    expect(boostState(x(2.5), config)).toBe('ok')
    expect(boostState(x(1.5), config)).toBe('low')
    expect(boostState(x(0.04), config)).toBe('hidden')
    expect(boostState(0, config)).toBe('closed')
  })

  it('closes at the contract floor, not only at zero', () => {
    const floor = { disable_building_boost_score: 20_000 } as unknown as LandsConfig
    expect(boostState(20_000, floor)).toBe('closed')
    expect(boostState(20_001, floor)).toBe('low')
  })
})

describe('hoursToSmallerLook', () => {
  it('is null on the lowest look', () => {
    expect(hoursToSmallerLook(x(1.5), 115)).toBeNull()
    expect(hoursToSmallerLook(x(2.0), 115)).toBeNull()
  })

  it('counts down to the rounded edge of the rank below', () => {
    /* 2.24x drops to the first look once it shows 2.0x: under 205,000 */
    expect(hoursToSmallerLook(223_600, 115)).toBeCloseTo(18_600 / 115)
    expect(hoursToSmallerLook(x(4.1), 115)).toBeCloseTo(5_000 / 115)
  })

  it('never counts down without decay', () => {
    expect(hoursToSmallerLook(x(3), 0)).toBeNull()
  })
})
