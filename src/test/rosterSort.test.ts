import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER, applyFilter } from '@/dungeon/filters'
import { statDisplay } from '@/tavern/fighterStats'
import { battleFactor } from '@/fighters/rules'
import type { RosterFighter } from '@/dungeon/types'

/**
 * Sorting by Damage or Health, against the numbers those cards print.
 *
 * Nothing fights at its roll: `apply_weather_and_age` grows health and damage
 * by `level_mod ^ level` and cuts them by `age_decay ^ (days²)`, and the card
 * prints the result. These two sorts ranked on the roll with only the age term
 * applied, so the level was missing from the order and present on the cards.
 *
 * At the live `level_mod` of 1.15 that is about a fourfold gap by level 10.
 * Measured against a real 200-fighter roster it put 54 of 199 damage rows and
 * 46 of 199 health rows above a card printing a smaller number than theirs —
 * sorting by Health led with a card reading 389 and left the 415 in sixth.
 *
 * The derived three (Combat score, DPS, Survival) already went through
 * `battleFactor` and were right; the fix is these two joining them.
 */

const LEVEL_MOD = 1.15
/* Off, so these tests are about the level term and nothing else. Age is
   covered by the fighters it is a fact about, not by a sort. */
const NO_AGE_DECAY = 0

const fighter = (
  id: number,
  level: number,
  damage: number,
  health: number,
): RosterFighter =>
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
    creation_date: '2026-09-01T00:00:00',
    /* Comfortably ahead, so every fighter is available and the availability
       tier cannot decide the order instead of the sort. */
    next_payday: '2099-01-01T00:00:00',
    last_payday: '2026-09-01T00:00:00',
    stats: {
      /* A settled roll: min and max equal, as a revealed fighter's are. */
      damage_min: damage, damage_max: damage,
      health_min: health, health_max: health,
      attackspeed_min: 40, attackspeed_max: 40,
      initiative_min: 50, initiative_max: 50,
      taunt_min: 60, taunt_max: 60,
      res_gem: 100, res_metal: 100, res_air: 100,
      res_fire: 100, res_nature: 100, res_neutral: 100,
      level,
      experience: 0,
      required_experience: 0,
      abilities: [],
    },
  }) as unknown as RosterFighter

/** What the card prints for that stat, in the same view. */
const printed = (f: RosterFighter, field: 'damage' | 'health', atLevelOne: boolean) => {
  const k = battleFactor(f, LEVEL_MOD, NO_AGE_DECAY, Date.now(), atLevelOne ? 1 : undefined).total
  const s = f.stats as unknown as Record<string, number>
  return statDisplay(s[`${field}_min`] * k, s[`${field}_max`] * k).value
}

const sorted = (
  roster: RosterFighter[],
  sort: string,
  atLevelOne = false,
): RosterFighter[] =>
  applyFilter(
    roster,
    { ...EMPTY_FILTER, sort },
    NO_AGE_DECAY,
    Date.now(),
    undefined,
    undefined,
    LEVEL_MOD,
    atLevelOne,
  )

/*
   A low-level fighter with the better roll against a high-level one with the
   worse. 900 raw beats 500 raw, but 500 × 1.15^10 is about 2,023 — so the
   order these two come out in is the whole question.
*/
const ROLLED_WELL = fighter(1, 1, 900, 900)
const LEVELLED = fighter(2, 10, 500, 500)

describe('sorting by Damage and Health', () => {
  it('ranks on what the card prints, not on the roll', () => {
    for (const [sort, field] of [
      ['damage_max', 'damage'],
      ['health_max', 'health'],
    ] as const) {
      /* The premise: levelling really does overturn the roll here. */
      expect(printed(LEVELLED, field, false)).toBeGreaterThan(
        printed(ROLLED_WELL, field, false),
      )

      const order = sorted([ROLLED_WELL, LEVELLED], sort)
      expect(order.map((f) => f.fighter_id)).toEqual([2, 1])
    }
  })

  it('never puts a card above one printing a bigger number', () => {
    /*
       The symptom as a player meets it: a column of figures that does not
       descend. This is the assertion that failed 54 times in 199 rows.
    */
    const roster = [
      fighter(1, 1, 900, 900),
      fighter(2, 10, 500, 500),
      fighter(3, 5, 700, 700),
      fighter(4, 1, 950, 400),
      fighter(5, 7, 400, 880),
      fighter(6, 3, 600, 600),
    ]

    for (const [sort, field] of [
      ['damage_max', 'damage'],
      ['health_max', 'health'],
    ] as const) {
      const figures = sorted(roster, sort).map((f) => printed(f, field, false))
      const descending = figures.every((v, i) => i === 0 || v <= figures[i - 1])
      expect(descending, `${sort} produced ${figures.join(', ')}`).toBe(true)
    }
  })

  it('ranks rolls instead once the level-one toggle is on', () => {
    /*
       The toggle exists to compare rolls across levels, so there the order
       must ignore how far a fighter has been taken — and still agree with
       the figures that view prints.
    */
    for (const [sort, field] of [
      ['damage_max', 'damage'],
      ['health_max', 'health'],
    ] as const) {
      const order = sorted([ROLLED_WELL, LEVELLED], sort, true)
      expect(order.map((f) => f.fighter_id)).toEqual([1, 2])

      const figures = order.map((f) => printed(f, field, true))
      expect(figures.every((v, i) => i === 0 || v <= figures[i - 1])).toBe(true)
    }
  })
})

describe('the sorts that do not grow with level', () => {
  it('are unaffected, because nothing scales them', () => {
    /*
       Taunt, wind-up and cooldown are fought with as rolled — no level term,
       no age term — so they were already right and must stay that way. Wind-up
       and cooldown are delays, so the best is the smallest.
    */
    const roster = [fighter(1, 1, 100, 100), fighter(2, 10, 100, 100)]
    const bigTaunt = { ...roster[0] }
    ;(bigTaunt.stats as unknown as Record<string, number>).taunt_min = 900
    ;(bigTaunt.stats as unknown as Record<string, number>).taunt_max = 900

    const order = sorted([roster[1], bigTaunt], 'taunt_max')
    expect(order[0].fighter_id).toBe(1)

    /* A level 10 fighter does not out-rank on a stat levelling never touches. */
    const cooldowns = sorted(roster, 'attackspeed_max')
    expect(cooldowns).toHaveLength(2)
  })
})
