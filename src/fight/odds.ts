import { simulate, type SimFighter, type StatCaps } from '@/dungeon/sim'
import type { BattleAbility, BattleFighter, FightRow, RosterFighter } from '@/dungeon/types'
import type { FlatFighter } from './matchup'
import { applyWeather, type Weather } from './weather'
import { ageFactor, levelFactor } from './scaling'

/**
 * How often this team wins the fight it is about to start.
 *
 * The balance bar used to be a formula: effective damage times effective
 * health, abilities weighted in. It ranked line-ups sensibly but the number
 * itself meant nothing — a 60% share was not a 60% anything. The game ships
 * its own battle simulator (`sim.ts`, which reproduces recorded fights blow
 * for blow), so the bar can be the thing it was estimating instead.
 *
 * The fight itself carries no randomness. What varies is the roll: at the
 * start the contract draws each of a fighter's five stats uniformly between
 * its min and max (`battle::getrandomfrompi`, one draw per stat), and from
 * there every blow follows. So one mid roll is not an average fight — it is
 * one fight, and it answers win or lose with nothing in between. Running the
 * roll many times is what turns that into a proportion, and the proportion is
 * what the bar shows.
 *
 * ## The order everything happens in
 *
 * This is the part that is easy to get wrong, and getting it wrong flatters
 * the player. `battle::fight` runs, in this order:
 *
 * 1. build both teams, rolling each stat between its min and max
 * 2. `prepare_buff` ×4 — **on the rolled stats, before any scaling**, the
 *    contract's own comment reading "APPLY BUFFS BEFORE WEATHER"
 * 3. `remove_used_abilities` on both sides
 * 4. `apply_weather_and_age` on both sides: health, max health and damage
 *    take the level curve and the age decay, *then* the weather lands
 * 5. `apply_dungdif` (dungeon) or `apply_arenapow` (arena) on the far side
 * 6. the combat loop
 *
 * Two of those matter more than they look. A flat buff — and they are
 * common, +400 health and +150 damage on the crew fighter alone — is applied
 * before the level curve, so on a difficulty 8 line it arrives tripled.
 * Doing it the other way round leaves the defending team hundreds of health
 * short of what actually walks in. And the level step comes *before* the
 * weather rather than after, so a flat weather effect is not multiplied.
 *
 * Resistances are not rolled and not scaled; only weather touches them.
 */

/**
 * Fights per reading.
 *
 * A fight is 12 to 20 blows and runs in about 0.15ms, so a hundred of them
 * cost around 20ms and are recomputed only when the line-up changes.
 *
 * The figure is steady rather than merely stable: the sampler is seeded from
 * the fighters on both sides, so the same team against the same line reads
 * the same today, after a loss, and on the next visit to the screen. What
 * moves it is the matchup moving — a fighter swapped, the difficulty
 * changed, the dungeon refreshed, or a day of age decay.
 */
export const ODDS_RUNS = 100

/** A deterministic stream, so the same team always reads the same. */
function stream(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    /* xorshift32 — small, fast, and good enough to sample a band. */
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 0x1_0000_0000
  }
}

/** Every fighter on the two sides, mixed into one number. */
function seedOf(mine: RosterFighter[], theirs: BattleFighter[]): number {
  let h = 2166136261
  const mix = (n: number) => {
    h ^= n >>> 0
    h = Math.imul(h, 16777619)
  }
  for (const f of mine) mix(f.fighter_id)
  for (const f of theirs) {
    mix(Number(f.fighter_id))
    mix(f.health)
    mix(f.damage)
  }
  return h >>> 0
}

const between = (min: number, max: number, t: number) =>
  Math.trunc(Number(min) + (Number(max) - Number(min)) * t)

/** The level the contract fights a side at. Zero means "its own". */
const battleLevel = (own: number, difficulty: number) => (difficulty === 0 ? own : difficulty)

export interface Fielding {
  weather: Weather | null | undefined
  caps: StatCaps
  levelMod: number
  ageDecay: number
}

/**
 * What the far side is scaled by once the buffs have landed.
 *
 * A dungeon fights at the chosen difficulty and then loses a percentage to
 * `difmod`; an arena fights at its defenders' own levels and is scaled by
 * the tile's arena power instead.
 */
export type EnemyScaling =
  | { venue: 'dungeon'; difficulty: number; percentPower: number }
  | { venue: 'arena'; power: number; fullPower: number }

/** One roster fighter as the roll leaves it — no scaling, no weather yet. */
function rollFighter(f: RosterFighter, roll: () => number): BattleFighter {
  const s = f.stats
  return asCombatant({
    fighter_id: f.fighter_id,
    creation_date: f.creation_date,
    element: s.element,
    classname: s.classname,
    racename: s.racename,
    health: between(s.health_min, s.health_max, roll()),
    damage: between(s.damage_min, s.damage_max, roll()),
    taunt: between(s.taunt_min, s.taunt_max, roll()),
    initiative: between(s.initiative_min, s.initiative_max, roll()),
    attackspeed: between(s.attackspeed_min, s.attackspeed_max, roll()),
    res_gem: s.res_gem,
    res_metal: s.res_metal,
    res_air: s.res_air,
    res_fire: s.res_fire,
    res_nature: s.res_nature,
    res_neutral: s.res_neutral,
    abilities: s.abilities ?? [],
    level: s.level,
    target: s.target,
  })
}

/**
 * The crew-and-weapon fighter, as the screen assembled it.
 *
 * `getFighterFromNFT` gives it level 1 and the current time as its creation
 * date, so it takes one step of the level curve and no age decay at all.
 */
function nftAsFighter(nft: FlatFighter, now: number): BattleFighter {
  return asCombatant({
    ...nft,
    fighter_id: 99999999999,
    creation_date: new Date(now).toISOString().slice(0, 19),
    taunt: nft.taunt ?? 0,
    initiative: nft.initiative ?? 0,
    abilities: nft.abilities ?? [],
    level: 1,
    target: '',
  })
}

/** The fields `sim.ts` reads, and nothing else — it ignores the rest. */
function asCombatant(f: {
  fighter_id: number
  creation_date?: string
  element: string
  classname?: string
  racename?: string
  health: number
  damage: number
  taunt: number
  initiative: number
  attackspeed: number
  res_gem: number
  res_metal: number
  res_air: number
  res_fire: number
  res_nature: number
  res_neutral: number
  abilities: BattleAbility[]
  level: number
  target: string
}): BattleFighter {
  return {
    stake_id: '',
    fighter_id: f.fighter_id,
    staketime: '',
    owner: '',
    avatar: '',
    gamertag: '',
    creation_date: f.creation_date ?? '',
    health: f.health,
    max_health: f.health,
    damage: f.damage,
    taunt: f.taunt,
    initiative: f.initiative,
    attackspeed: f.attackspeed,
    res_gem: f.res_gem,
    res_metal: f.res_metal,
    res_air: f.res_air,
    res_fire: f.res_fire,
    res_nature: f.res_nature,
    res_neutral: f.res_neutral,
    classname: f.classname ?? '',
    racename: f.racename ?? '',
    element: f.element,
    target: f.target,
    specialAbility: f.abilities,
    level: f.level,
  } as unknown as BattleFighter
}

/**
 * `apply_weather_and_age` for one fighter, in place.
 *
 * Level and age first — they multiply health, max health and damage — and
 * the weather after, which is where flat effects land and why the two cannot
 * be swapped.
 */
function fieldInRing(
  f: SimFighter,
  creationDate: string | undefined,
  difficulty: number,
  { weather, caps, levelMod, ageDecay }: Fielding,
  now: number,
): void {
  const factor =
    levelFactor(battleLevel(f.level, difficulty), levelMod) *
    ageFactor(creationDate, ageDecay, now)
  f.health = Math.trunc(f.health * factor)
  f.max_health = Math.trunc(f.max_health * factor)
  f.damage = Math.trunc(f.damage * factor)
  if (difficulty !== 0) f.level = difficulty
  Object.assign(f, applyWeather(f, weather, caps))
  /* The bars read this, and it is the health the fight opens on. */
  f.start_health = f.health
}

export interface OddsInput {
  /** The fighters picked, with their stat bands still on them. */
  picked: RosterFighter[]
  /** The sixth fighter, if a crew card and a weapon are chosen — unscaled. */
  nft?: FlatFighter | null
  /**
   * The far side **as the chain stores it**: not levelled, not weathered,
   * not scaled for difficulty. All of that happens here, after the buffs,
   * because that is where the contract does it.
   */
  enemies: BattleFighter[]
  scaling: EnemyScaling
  /** Taunt lost per blow taken — `battle.ale`/`fgtconfig`. */
  tauntDeduction: number
  fielding: Fielding
  runs?: number
  /** Overridable so a test can pin the age decay. */
  now?: number
}

export interface Odds {
  /** Fights won out of `runs`, 0 to 1. */
  winRate: number
  runs: number
}

/**
 * Fight it `runs` times and count the wins.
 *
 * Returns null when there is nothing to say — no team picked, or no
 * opponent — rather than a shrugging 50%.
 */
export function teamOdds(input: OddsInput): Odds | null {
  const { picked, enemies, nft, tauntDeduction, fielding, scaling } = input
  if (!picked.length || !enemies.length) return null

  const runs = input.runs ?? ODDS_RUNS
  const now = input.now ?? Date.now()
  const roll = stream(seedOf(picked, enemies))
  const sixth = nft ? nftAsFighter(nft, now) : null
  const theirDifficulty = scaling.venue === 'dungeon' ? scaling.difficulty : 0

  /* Same order as the rows below, so a fighter's age is one lookup away. */
  const myAges = [...picked.map((f) => f.creation_date), ...(sixth ? [sixth.creation_date] : [])]
  const theirAges = enemies.map((f) => f.creation_date)

  const prepare = (team1: SimFighter[], team2: SimFighter[]) => {
    team1.forEach((f, i) => fieldInRing(f, myAges[i], 0, fielding, now))
    team2.forEach((f, i) => fieldInRing(f, theirAges[i], theirDifficulty, fielding, now))

    /* `apply_dungdif` / `apply_arenapow`: the far side only, and last. */
    const cut =
      scaling.venue === 'dungeon'
        ? scaling.percentPower / 100
        : scaling.fullPower > 0
          ? scaling.power / scaling.fullPower
          : 1
    if (cut === 1) return
    for (const f of team2) {
      f.health = Math.trunc(f.health * cut)
      f.max_health = Math.trunc(f.max_health * cut)
      f.start_health = f.health
      f.damage = Math.trunc(f.damage * cut)
    }
  }

  let wins = 0
  for (let i = 0; i < runs; i++) {
    const team = picked.map((f) => rollFighter(f, roll))
    if (sixth) team.push(sixth)

    const row: FightRow = {
      history_id: '',
      wallet: '',
      team1_fighters: team,
      team2_fighters: enemies,
      log: '',
      turns: 0,
      reward_power_added: [],
      reward_power_total: [],
      timestamp: '',
    }
    const replay = simulate(row, {
      tauntDeduction,
      caps: fielding.caps,
      building: scaling.venue,
      prepare,
    })
    /*
       A draw is the simulator giving up rather than the fight ending even —
       it cannot happen outside a tournament — so it is counted as neither
       side's win rather than half of one.
    */
    if (replay.winner === 1) wins++
  }

  return { winRate: wins / runs, runs }
}

/**
 * What the bar is, for anyone who hovers it.
 *
 * The bar has never carried a number and still does not — it is read as a
 * length against the one opposite. But the length now means something exact,
 * and a player who wants the figure should not have to guess it off a strip
 * of colour.
 */
export function oddsTitle(odds: Odds | null, side: 'mine' | 'theirs'): string | undefined {
  if (!odds) return undefined
  const rate = side === 'mine' ? odds.winRate : 1 - odds.winRate
  const who = side === 'mine' ? 'Your team has' : 'They have'
  return `${who} a ${Math.round(rate * 100)}% chance to win this fight`
}
