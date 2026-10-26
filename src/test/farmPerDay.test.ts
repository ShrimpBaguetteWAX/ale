import { describe, expect, it } from 'vitest'
import { capPerDay, formatPerDay, formatToCap, withWeight } from '@/farming/rules'
import { stakedStacks } from '@/farming/stacks'
import type { FarmConfig, FarmUser, StakedCard } from '@/farming/types'

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

describe('withWeight', () => {
  /* onabs.wam's Weapons pool: 180 weight, last claimed 13 minutes ago. */
  const NOW = Date.parse('2026-10-26T18:00:13Z')
  const user = {
    last_claim: '2026-10-26T17:47:13',
    pool_weights: [
      { first: 'arms.worlds', second: 180 },
      { first: 'tool.worlds', second: 68_649 },
    ],
  } as unknown as FarmUser

  it('fills the cap sooner with the picked cards staked', () => {
    const after = withWeight('arms.worlds', 400, user, [], config, NOW)
    expect(after.weight).toBe(580)
    expect(capPerDay(after.weight, config)).toBeCloseTo(0.58)
    /* 100,000 / 580 days, less the 13 minutes already banked. */
    expect(formatToCap(after.msToCap)).toBe('in 172 days')
  })

  it('fills it later with them unstaked, and never below nothing', () => {
    expect(withWeight('tool.worlds', -675, user, [], config, NOW).weight).toBe(67_974)
    expect(withWeight('arms.worlds', -1_000, user, [], config, NOW).weight).toBe(0)
  })

  it('starts a pool the player has never staked in', () => {
    expect(withWeight('crew.worlds', 250, user, [], config, NOW).weight).toBe(250)
  })
})
