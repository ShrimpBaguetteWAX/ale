import { describe, expect, it } from 'vitest'
import { simulateBout } from '@/tournament/bout'
import { DEFAULT_CAPS } from '@/dungeon/sim'
import type { RosterFighter } from '@/dungeon/types'

/**
 * A tournament pairing, fought from the row that describes it.
 *
 * The contract records who drew whom, the ids they brought and a seed, and
 * nothing about what happened — so the bout is a function of its inputs and
 * the seed is what makes everybody who presses play watch the same fight.
 * That is the property worth pinning: not who wins, which is the
 * simulator's business, but that the same row always produces the same
 * answer and a different seed does not.
 */

const RES = {
  res_gem: 0,
  res_metal: 0,
  res_air: 0,
  res_fire: 0,
  res_nature: 0,
  res_neutral: 0,
}

const fielding = { weather: null, caps: DEFAULT_CAPS, levelMod: 1, ageDecay: 1 }

const roster = (id: number, health: [number, number], damage: number): RosterFighter =>
  ({
    fighter_id: id,
    owner: 'someone',
    creation_date: '2026-09-01T00:00:00',
    stats: {
      health_min: health[0],
      health_max: health[1],
      damage_min: damage,
      damage_max: damage,
      taunt_min: 100,
      taunt_max: 100,
      initiative_min: 500,
      initiative_max: 500,
      attackspeed_min: 500,
      attackspeed_max: 500,
      ...RES,
      classname: 'tactician',
      racename: 'human',
      element: 'neutral',
      target: '',
      abilities: [],
      level: 0,
    },
  }) as unknown as RosterFighter

const five = (from: number, health: [number, number], damage: number) =>
  Array.from({ length: 5 }, (_, i) => roster(from + i, health, damage))

const strong = { fighters: five(1, [900, 1100], 260), nft: null }
const weak = { fighters: five(11, [300, 420], 70), nft: null }

describe('a tournament bout', () => {
  it('comes out the same way every time it is run', () => {
    const a = simulateBout(4821, strong, weak, fielding, 10, Date.parse('2026-09-28T12:00:00Z'))
    const b = simulateBout(4821, strong, weak, fielding, 10, Date.parse('2026-09-28T12:00:00Z'))

    expect(a).not.toBeNull()
    expect(a!.winner).toBe(b!.winner)
    expect(a!.turns.length).toBe(b!.turns.length)
    expect(a!.turns.map((t) => t.damage)).toEqual(b!.turns.map((t) => t.damage))
  })

  it('fights a different fight on a different seed', () => {
    const now = Date.parse('2026-09-28T12:00:00Z')
    const even = { fighters: five(21, [600, 900], 150), nft: null }
    const other = { fighters: five(31, [600, 900], 150), nft: null }

    const runs = [11, 22, 33, 44].map(
      (seed) => simulateBout(seed, even, other, fielding, 10, now)!.turns.map((t) => t.damage).join(','),
    )
    /* The rolls are drawn off the seed, so four seeds should not all land on
       the same exchange — if they do, the seed is not reaching the roll. */
    expect(new Set(runs).size).toBeGreaterThan(1)
  })

  it('fields the fighters it is given, and none it is not', () => {
    const now = Date.parse('2026-09-28T12:00:00Z')
    const replay = simulateBout(7, strong, weak, fielding, 10, now)!
    /* Ten on the floor: five a side, and no sixth where no crew and weapon
       were entered. */
    expect(replay.fighters.length).toBe(10)
    expect(replay.fighters.filter((f) => f.team === 1).length).toBe(5)
  })

  it('says nothing when a side brought nobody', () => {
    expect(simulateBout(7, strong, { fighters: [], nft: null }, fielding, 10)).toBeNull()
  })

  /*
     The heavier side should take it. Not a claim about the simulator —
     that is its own tests' business — but a check that this module hands it
     the two sides the right way round rather than swapping them.
  */
  it('hands the sides over in the order it was given them', () => {
    const now = Date.parse('2026-09-28T12:00:00Z')
    expect(simulateBout(3, strong, weak, fielding, 10, now)!.winner).toBe(1)
    expect(simulateBout(3, weak, strong, fielding, 10, now)!.winner).toBe(2)
  })
})

/**
 * Three rolls, not one.
 *
 * A dungeon stands on one land and is fought under its one weather; a
 * tournament rolls per planet and every one applies. They compound — each
 * asks for itself whether it reaches a given fighter and then lands on what
 * the one before it left — so a bout under three rolls is a different fight
 * from the same bout under the first of them.
 */
describe('the weather a bout is fought under', () => {
  const now = Date.parse('2026-09-28T12:00:00Z')

  const roll = (percent: number) =>
    ({
      weather_id: `w${percent}`,
      displayname: `${percent}% health`,
      title: 'Roll',
      affected_class: [],
      affected_element: [],
      affected_race: [],
      weather_effects: [{ statname: 'health', percent_change: percent, flat_change: 0 }],
    }) as never

  const openingHealth = (weather: unknown) =>
    simulateBout(
      99,
      strong,
      weak,
      { ...fielding, weather: weather as never },
      10,
      now,
    )!.opening[0].health

  it('compounds every roll rather than taking the first', () => {
    const one = openingHealth([roll(-20)])
    const three = openingHealth([roll(-20), roll(-20), roll(-20)])

    expect(one).toBeLessThan(openingHealth([]))
    /* Three twenties off is not one twenty off. */
    expect(three).toBeLessThan(one)
  })

  it('still takes a single roll, the way a dungeon passes one', () => {
    expect(openingHealth(roll(-20))).toBe(openingHealth([roll(-20)]))
  })
})
