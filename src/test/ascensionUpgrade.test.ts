import { describe, expect, it } from 'vitest'
import { limitLabel, statValue, upgradeOutcome } from '@/ascension/rules'
import type { StatCaps } from '@/ascension/queries'
import type { RosterFighter } from '@/dungeon/types'

/**
 * What a rolled upgrade really does, branch for branch with `ascupgrade` in
 * `ascend.ale`. The live caps: health and damage 100–32000, taunt and wind-up
 * from 0, cooldown from 100, everything up to 32000, resistances to 800.
 */

const CAPS: StatCaps = {
  health_min: 100,
  health_max: 32000,
  damage_min: 100,
  damage_max: 32000,
  taunt_min: 0,
  taunt_max: 32000,
  initiative_min: 0,
  initiative_max: 32000,
  attackspeed_min: 100,
  attackspeed_max: 32000,
  res_gem: 800,
  res_metal: 800,
  res_air: 800,
  res_fire: 800,
  res_nature: 800,
  res_neutral: 800,
}

const fighter = (stats: Record<string, number>) => ({ stats }) as unknown as RosterFighter

describe('a resistance', () => {
  it('takes the whole roll below its ceiling', () => {
    const o = upgradeOutcome('res_gem', 48, true, fighter({ res_gem: 220 }), CAPS)
    expect(o).toMatchObject({ applied: 48, limit: null, before: 220, after: 268 })
  })

  it('stops at its ceiling and says so', () => {
    const o = upgradeOutcome('res_gem', 48, true, fighter({ res_gem: 776 }), CAPS)
    expect(o).toMatchObject({ applied: 24, limit: 'ceiling', at: 800, after: 800 })
    expect(limitLabel('res_gem', o)).toBe('Stops at 80%')
  })

  it('is not called capped when the roll lands exactly on the ceiling', () => {
    const o = upgradeOutcome('res_gem', 48, true, fighter({ res_gem: 752 }), CAPS)
    expect(o).toMatchObject({ applied: 48, limit: null, after: 800 })
  })

  it('has no ceiling while the caps are still loading', () => {
    const o = upgradeOutcome('res_gem', 48, true, fighter({ res_gem: 776 }), undefined)
    expect(o).toMatchObject({ applied: 48, limit: null })
  })
})

describe('health and damage', () => {
  it('take the whole roll on both ends below the ceiling', () => {
    const o = upgradeOutcome('health', 95, true, fighter({ health_min: 390, health_max: 693 }), CAPS)
    expect(o).toMatchObject({ applied: 95, limit: null, narrows: false })
    expect(o.range!.after).toEqual([485, 788])
  })

  it('narrow when only the top end reaches the ceiling', () => {
    const o = upgradeOutcome('health', 95, true, fighter({ health_min: 31800, health_max: 31950 }), CAPS)
    expect(o).toMatchObject({ applied: 95, limit: 'ceiling', narrows: true })
    expect(o.range!.after).toEqual([31895, 32000])
  })

  it('stop at the ceiling on both ends', () => {
    const o = upgradeOutcome('damage', 95, true, fighter({ damage_min: 31960, damage_max: 31990 }), CAPS)
    expect(o).toMatchObject({ applied: 40, limit: 'ceiling', narrows: false })
    expect(o.range!.after).toEqual([32000, 32000])
  })
})

describe('taunt, wind-up and cooldown', () => {
  it('go up by the whole roll, with no ceiling', () => {
    const o = upgradeOutcome('taunt', 30, true, fighter({ taunt_min: 321, taunt_max: 585 }), CAPS)
    expect(o).toMatchObject({ applied: 30, limit: null })
    expect(o.range!.after).toEqual([351, 615])
  })

  it('go down by the whole roll when it is no bigger than the stat — even under the floor', () => {
    const o = upgradeOutcome('attackspeed', 15, false, fighter({ attackspeed_min: 105, attackspeed_max: 120 }), CAPS)
    expect(o).toMatchObject({ applied: 15, limit: null, collapses: false })
    expect(o.range!.after).toEqual([90, 105])
  })

  it('drop to the floor, range and all, when the roll is bigger than the stat', () => {
    const o = upgradeOutcome('initiative', 37, false, fighter({ initiative_min: 32, initiative_max: 46 }), CAPS)
    expect(o).toMatchObject({ applied: 32, limit: 'floor', at: 0, after: 0, collapses: true })
    expect(o.range!.after).toEqual([0, 0])
    expect(limitLabel('initiative', o)).toBe('Stops at 0')
  })
})

describe('statValue', () => {
  it('prints each kind of stat the way the fighter panel does', () => {
    expect(statValue('res_air', 268)).toBe('26.8%')
    expect(statValue('initiative', 32)).toBe('3.2')
    expect(statValue('health', 500, 2)).toBe('100')
  })
})
