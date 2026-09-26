import { describe, expect, it } from 'vitest'
import { ODDS_RUNS, oddsTitle, teamOdds, type OddsInput } from '@/fight/odds'
import { DEFAULT_CAPS, simulate } from '@/dungeon/sim'
import type { BattleFighter, RosterFighter } from '@/dungeon/types'

/**
 * The bar, read off simulated fights.
 *
 * The fighters below are shaped like the chain's, with plain numbers so a
 * reader can see which side should win without running anything.
 */
const fielding = { weather: null, caps: DEFAULT_CAPS, levelMod: 1, ageDecay: 1 }

const RES = {
  res_gem: 0,
  res_metal: 0,
  res_air: 0,
  res_fire: 0,
  res_nature: 0,
  res_neutral: 0,
}

/** A roster entry: stats are a band, and the roll picks inside it. */
function roster(id: number, health: [number, number], damage: number): RosterFighter {
  return {
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
  } as unknown as RosterFighter
}

/** An enemy: already rolled and settled, as the chain stores it. */
function enemy(id: number, health: number, damage: number): BattleFighter {
  return {
    fighter_id: id,
    health,
    max_health: health,
    damage,
    taunt: 100,
    initiative: 500,
    attackspeed: 500,
    ...RES,
    classname: 'juggernaut',
    racename: 'onoros',
    element: 'neutral',
    target: '',
    specialAbility: [],
    level: 0,
  } as unknown as BattleFighter
}

const input = (picked: RosterFighter[], enemies: BattleFighter[]): OddsInput => ({
  picked,
  enemies,
  tauntDeduction: 10,
  scaling: { venue: 'dungeon', difficulty: 0, percentPower: 100 },
  fielding,
  now: Date.parse('2026-09-26T00:00:00Z'),
})

describe('team odds', () => {
  it('is certain when one side cannot lose', () => {
    const mine = [roster(1, [10_000, 10_000], 5000)]
    const theirs = [enemy(2, 100, 1)]
    expect(teamOdds(input(mine, theirs))?.winRate).toBe(1)
    expect(teamOdds(input([roster(1, [100, 100], 1)], [enemy(2, 10_000, 5000)]))?.winRate).toBe(0)
  })

  it('lands between the two when the roll decides the fight', () => {
    /*
       A band wide enough that the low rolls lose and the high rolls win,
       which is the case the old formula could only answer with one number.
    */
    const mine = [roster(1, [200, 2000], 300)]
    const theirs = [enemy(2, 1000, 300)]
    const odds = teamOdds(input(mine, theirs))!
    expect(odds.winRate).toBeGreaterThan(0)
    expect(odds.winRate).toBeLessThan(1)
    expect(odds.runs).toBe(ODDS_RUNS)
  })

  it('gives the same answer every time it is asked', () => {
    const mine = [roster(1, [200, 2000], 300)]
    const theirs = [enemy(2, 1000, 300)]
    const a = teamOdds(input(mine, theirs))!
    const b = teamOdds(input(mine, theirs))!
    /* A bar that flickered on re-render would be worse than no bar. */
    expect(a.winRate).toBe(b.winRate)
  })

  it('improves when a fighter is added to the same line-up', () => {
    const theirs = [enemy(2, 1200, 300), enemy(3, 1200, 300)]
    const alone = teamOdds(input([roster(1, [800, 1600], 400)], theirs))!
    const pair = teamOdds(
      input([roster(1, [800, 1600], 400), roster(4, [800, 1600], 400)], theirs),
    )!
    expect(pair.winRate).toBeGreaterThan(alone.winRate)
  })

  it('counts the crew-and-weapon fighter as a sixth body', () => {
    const theirs = [enemy(2, 3000, 400)]
    const five = [roster(1, [600, 900], 200)]
    const without = teamOdds(input(five, theirs))!
    const with6 = teamOdds({
      ...input(five, theirs),
      nft: {
        element: 'neutral',
        damage: 900,
        health: 2000,
        attackspeed: 400,
        taunt: 100,
        initiative: 400,
        ...RES,
        abilities: [],
      },
    })!
    expect(with6.winRate).toBeGreaterThan(without.winRate)
  })

  it('has nothing to say without a team or without an opponent', () => {
    expect(teamOdds(input([], [enemy(2, 100, 10)]))).toBeNull()
    expect(teamOdds(input([roster(1, [100, 100], 10)], []))).toBeNull()
  })

  it('says what it is when hovered, from both sides', () => {
    const odds = { winRate: 0.6, runs: 50 }
    expect(oddsTitle(odds, 'mine')).toBe('Your team has a 60% chance to win this fight')
    expect(oddsTitle(odds, 'theirs')).toBe('They have a 40% chance to win this fight')
    expect(oddsTitle(null, 'mine')).toBeUndefined()
  })

  it('costs little enough to redo on every change to the team', () => {
    const mine = [1, 2, 3, 4, 5].map((i) => roster(i, [600, 1400], 300))
    const theirs = [6, 7, 8, 9, 10, 11].map((i) => enemy(i, 1000, 260))
    const started = performance.now()
    teamOdds(input(mine, theirs))
    /* Roughly 10ms on this machine; the ceiling is for a slow phone. */
    expect(performance.now() - started).toBeLessThan(400)
  })
})

/**
 * The order the contract runs things in, which is the part that was wrong.
 *
 * `prepare_buff` lands on the rolled stats and the level curve multiplies
 * what it leaves behind — the contract's own comment reads "APPLY BUFFS
 * BEFORE WEATHER". A flat +100 health on a level 10 fighter is therefore
 * worth about 405, not 100, and a defending line whose buffs were applied
 * the other way round walks in hundreds of health light.
 */
describe('the contract order', () => {
  it('multiplies a flat buff by the level curve, as the chain does', () => {
    /*
       Read straight off the opening snapshot rather than off a win or a
       loss, because only the snapshot can tell the two orders apart.
       A fighter on 1,000 health with a flat +1,000 buff, scaled ×2:
       buffed first it opens on 4,000, scaled first it would open on 3,000.
    */
    const selfBuff = {
      on_fight_start: 1,
      bf_target: 'self',
      bf_effects: [{ stat_name: 'health', percentflat: 'flat', value: 1000 }],
    }
    const mine = {
      ...(enemy(1, 1000, 100) as unknown as Record<string, unknown>),
      specialAbility: [selfBuff],
    } as unknown as BattleFighter

    const replay = simulate(
      {
        history_id: '', wallet: '', log: '', turns: 0, timestamp: '',
        reward_power_added: [], reward_power_total: [],
        team1_fighters: [mine],
        team2_fighters: [enemy(2, 50_000, 1)],
      },
      {
        tauntDeduction: 10,
        caps: DEFAULT_CAPS,
        building: 'dungeon',
        prepare: (team1) => {
          for (const f of team1) {
            f.health *= 2
            f.max_health *= 2
            f.start_health = f.health
          }
        },
      },
    )
    expect(replay.opening[0].health).toBe(4000)
  })

  it('takes the difficulty percentage off the far side last', () => {
    const mine = [roster(1, [1500, 1500], 200)]
    const theirs = [enemy(2, 2000, 200)]
    const full = teamOdds({
      picked: mine, enemies: theirs, tauntDeduction: 10, fielding, runs: 1,
      scaling: { venue: 'dungeon', difficulty: 0, percentPower: 100 },
    })!
    const halved = teamOdds({
      picked: mine, enemies: theirs, tauntDeduction: 10, fielding, runs: 1,
      scaling: { venue: 'dungeon', difficulty: 0, percentPower: 50 },
    })!
    expect(halved.winRate).toBeGreaterThan(full.winRate)
  })

  it('scales an arena by its power the same way', () => {
    const mine = [roster(1, [1500, 1500], 200)]
    const theirs = [enemy(2, 2000, 200)]
    const strong = teamOdds({
      picked: mine, enemies: theirs, tauntDeduction: 10, fielding, runs: 1,
      scaling: { venue: 'arena', power: 10_000, fullPower: 10_000 },
    })!
    const weak = teamOdds({
      picked: mine, enemies: theirs, tauntDeduction: 10, fielding, runs: 1,
      scaling: { venue: 'arena', power: 4_000, fullPower: 10_000 },
    })!
    expect(weak.winRate).toBeGreaterThan(strong.winRate)
  })
})
