import { describe, expect, it } from 'vitest'
import { capPerDay, formatPerDay, formatToCap } from '@/farming/rules'
import { stakedStacks } from '@/farming/stacks'
import type { FarmConfig, StakedCard } from '@/farming/types'

/* The live farm config: power stops at 100,000. */
const config = { max_power: 100_000 } as unknown as FarmConfig

describe('capPerDay', () => {
  it('is the share of the cap one day of this weight fills', () => {
    expect(capPerDay(24_488, config)).toBeCloseTo(24.488)
    expect(capPerDay(90, config)).toBeCloseTo(0.09)
    expect(capPerDay(100, undefined)).toBe(0)
  })

  it('reads with enough places that a light pool is not zero', () => {
    expect(formatPerDay(24.488)).toBe('24.5% a day')
    expect(formatPerDay(0.09)).toBe('0.09% a day')
  })
})

describe('formatToCap', () => {
  it('says years rather than a thousand days', () => {
    expect(formatToCap(4 * 86_400_000)).toBe('in 4 days')
    expect(formatToCap(1111 * 86_400_000)).toBe('in 3 years')
  })
})

describe('stakedStacks', () => {
  const staked = [
    { asset_id: '1', template_id: 19630, rarity: 'Legendary', shine: 'Stone', weight: 675 },
    { asset_id: '2', template_id: 19635, rarity: 'Common', shine: 'Stone', weight: 12 },
  ] as StakedCard[]

  it('names staked cards from the catalogue, and numbers the ones it lacks', () => {
    const names = new Map([[19630, 'Storm Giant']])
    expect(stakedStacks(staked, names).map((s) => s.name)).toEqual(['Storm Giant', '#19635'])
  })
})
