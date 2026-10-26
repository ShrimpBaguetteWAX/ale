import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER, applyFilter } from '@/dungeon/filters'
import { ageBonus } from '@/fighters/rules'
import { gradeAged, gradeOfStat, type ClassTemplate } from '@/tavern/fighterStats'
import type { RosterFighter } from '@/dungeon/types'

/**
 * The three sorts only My Fighters offers — payday, age bonus and sell value —
 * the direction switch, and health and damage graded after age.
 *
 * The direction is optional on the filter so the fight pickers, which never
 * set it, keep "biggest first"; and age goes into the grade but level does
 * not, so an old fighter grades worse than a fresh one with the same roll.
 */

const NOW = Date.parse('2026-10-26T12:00:00Z')
const AGE_DECAY = 0.9995

const fighter = (id: number, over: { created?: string; payday?: string; credits?: number } = {}): RosterFighter =>
  ({
    fighter_id: id,
    owner: 'smoke.wam',
    classname: 'arcanist',
    racename: 'human',
    element: 'fire',
    marker: '',
    in_use: 0,
    use_type: '',
    active: 1,
    creation_date: over.created ?? '2026-10-20T00:00:00',
    next_payday: over.payday ?? '2026-11-25T00:00:00',
    last_payday: '2026-10-25T00:00:00',
    stats: {
      damage_min: 100, damage_max: 100,
      health_min: 300, health_max: 300,
      attackspeed_min: 40, attackspeed_max: 40,
      initiative_min: 50, initiative_max: 50,
      taunt_min: 60, taunt_max: 60,
      res_gem: 100, res_metal: 100, res_air: 100,
      res_fire: 100, res_nature: 100, res_neutral: 100,
      level: 10,
      credits: over.credits ?? 500,
      abilities: [],
    },
  }) as unknown as RosterFighter

const order = (roster: RosterFighter[], sort: string, sortAsc = false) =>
  applyFilter(roster, { ...EMPTY_FILTER, sort, sortAsc }, AGE_DECAY, NOW).map((f) => f.fighter_id)

describe("My Fighters' own sorts", () => {
  const roster = [
    fighter(1, { payday: '2026-11-25T00:00:00', created: '2026-10-01T00:00:00', credits: 400 }),
    fighter(2, { payday: '2026-11-18T00:00:00', created: '2026-06-01T00:00:00', credits: 900 }),
    fighter(3, { payday: '2026-11-21T00:00:00', created: '2026-10-25T00:00:00', credits: 650 }),
  ]

  it('puts the soonest payday first', () => {
    expect(order(roster, 'payday')).toEqual([2, 3, 1])
  })

  it('ranks the age bonus best first, and worst first when flipped', () => {
    const best = order(roster, 'age')
    expect(best).toEqual([3, 1, 2])
    expect(ageBonus(roster[2], AGE_DECAY, NOW)).toBeGreaterThan(ageBonus(roster[1], AGE_DECAY, NOW))
    expect(order(roster, 'age', true)).toEqual([2, 1, 3])
  })

  it('ranks sell value', () => {
    expect(order(roster, 'credits')).toEqual([2, 3, 1])
    expect(order(roster, 'credits', true)).toEqual([1, 3, 2])
  })

  it('leaves the old order alone when no direction is set', () => {
    const { sortAsc: _ignored, ...withoutDirection } = { ...EMPTY_FILTER, sort: 'credits', sortAsc: undefined }
    void _ignored
    expect(applyFilter(roster, withoutDirection, AGE_DECAY, NOW).map((f) => f.fighter_id)).toEqual([2, 3, 1])
  })
})

describe('health and damage graded after age', () => {
  /* Bands the 300 health and 40 cooldown roll sit high inside: health runs
     100–320 and cooldown 20–80, in the four-number form the class table uses. */
  const template = {
    tempname: 'arcanist',
    classname: 'arcanist',
    target: '',
    total_min_max_stats: {
      health_min_min: 100,
      health_max_min: 100,
      health_min_max: 320,
      health_max_max: 320,
      attackspeed_min_min: 20,
      attackspeed_max_min: 20,
      attackspeed_min_max: 80,
      attackspeed_max_max: 80,
    },
  } as ClassTemplate
  const raw = fighter(9).stats as unknown as Record<string, number>

  it('matches the plain grade on a fresh fighter', () => {
    expect(gradeAged(raw, 'health', template, 1)).toBe(gradeOfStat(raw, 'health', template))
  })

  it('grades an old fighter lower than the same roll fresh', () => {
    const rank = ['red-duble-down', 'red-down', 'middle', 'green-up', 'green-duble-up', 'gold-up']
    const fresh = rank.indexOf(gradeAged(raw, 'health', template, 1) ?? '')
    const old = rank.indexOf(gradeAged(raw, 'health', template, 0.5) ?? '')
    expect(old).toBeLessThan(fresh)
  })

  it('leaves the stats age does not touch as rolled', () => {
    expect(gradeAged(raw, 'attackspeed', template, 0.5)).toBe(gradeOfStat(raw, 'attackspeed', template))
  })
})
