import type { Planet } from '@/chain/config'
import type { FighterAbility } from '@/chain/types'

/**
 * A fighter as the battle contract sees it: flat, rolled stats rather than
 * the min/max ranges carried by a roster entry or a tavern recruit.
 *
 * `fights` rows store these twice — once for each team — holding the values
 * combat *started* from, after buffs, weather and difficulty scaling have
 * been folded in. That makes them the exact input the replay needs.
 */
export interface BattleFighter {
  fighter_id: number
  owner: string
  gamertag: string
  avatar: string
  /** Needed for the age decay `apply_weather_and_age` applies before a fight. */
  creation_date?: string
  health: number
  max_health: number
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
  classname: string
  racename: string
  element: string
  target: string
  specialAbility: BattleAbility[]
  level: number
  battlestats: Battlestats
}

/**
 * An ability as the battle contract stores it: trigger flags, a target
 * selector, three sets of effects, and an optional condition that decides
 * whether — and how many times — it fires.
 */
export interface BattleAbility extends FighterAbility {
  on_creation?: number
  on_fight_start?: number
  on_attack?: number
  on_defense?: number
  on_battle_end?: number
  target_change?: string
  bf_target?: string
  bf_effects?: AbilityEffectRow[]
  if_effects?: AbilityEffectRow[]
  eof_effects?: AbilityEffectRow[]
  /** Non-zero when the ability is gated on `condition_*` below. */
  check_condition?: number
  /** `self`, `ally_group`, `enemy_group`, or an `ally_*`/`enemy_*` selector. */
  condition_target?: string
  /** `class`, `race`, `element`, `stats`, or `building`. */
  condition_group?: string
  condition_name?: string
  /** `min` or `max`, for a `stats` condition. */
  condition_minmax?: string
  condition_value?: number
  /**
   * When set, the ability fires once per match rather than once in total —
   * a group condition that matches three allies applies three times.
   */
  effect_on_condition_count?: number
  ignore_res_percent?: number
}

export interface AbilityEffectRow {
  percentflat: string
  stat_name: string
  value: number
  value_min?: number
  value_max?: number
}

/**
 * Per-fighter tallies the contract keeps during combat.
 *
 * On a stored `fights` row the four damage figures have already been divided
 * by ten for display, matching `STAT_SCALE`; the counts have not.
 */
export interface Battlestats {
  attacks_made: number
  attacks_received: number
  damage_dealt: number
  damage_blocked_by_enemy: number
  damage_taken: number
  damage_blocked: number
  knockouts: number
  survived: number | boolean
}

/** `dungeons.ale` / `dungeons`, scope = planet, pk = land_id. */
export interface DungeonRow {
  planet: Planet
  land_id: string
  fighters: BattleFighter[]
  last_change: string
  template_ids: number[]
}

/** `dungeons.ale` / `config`. */
export interface DungeonConfig {
  index: number
  energy_cost: number
  gem_cost: number
  credits_cost: number
}

/**
 * `battle.ale` / `difmod` — how hard the dungeon team hits at each
 * difficulty, as a percentage of its stored power. Difficulties with no row
 * run at full strength.
 */
export interface DifMod {
  dungeon_difficulty: number
  percentage_power: number
}

/** `battle.ale` / `fgtconfig` — one global knob, applied on every hit. */
export interface FightConfig {
  config_id: number
  taunt_deduction: number
}

/** `battle.ale` / `config` — the parts the dungeon screen needs. */
export interface BattleConfig {
  config_id: number
  xp_per_dungeon_difficulty: number
  /** Flat, unlike the dungeon's — an arena has no difficulty to scale by. */
  xp_per_arena_win: number
  dungeon_nft_fighter_min_difficulty: number
  /**
   * Per-day decay base, applied as `age_decay ^ (days²)` to health and
   * damage. Arrives as a string because it is a `float` on chain.
   */
  age_decay: string
  /** Per-level growth, `level_mod ^ level`. Also a `float`. */
  level_mod: string
}

/**
 * `battle.ale` / `fights` — the record of one battle.
 *
 * Short-lived: `deloldfights` erases any row older than sixty seconds, so
 * this has to be read promptly after the transaction and kept locally.
 * `team1_end_fighters` and `team2_end_fighters` are declared on the table but
 * never written, so they always arrive empty — the closing state has to be
 * recomputed.
 */
export interface FightRow {
  history_id: string
  wallet: string
  team1_fighters: BattleFighter[]
  team2_fighters: BattleFighter[]
  log: string
  turns: number
  reward_power_added: RewardPower[]
  reward_power_total: RewardPower[]
  timestamp: string
}

export interface RewardPower {
  pool: string
  power: number
  type: string
}

/** `fighters.ale` / `fighters` — a roster entry, with min/max stat ranges. */
export interface RosterFighter {
  fighter_id: number
  owner: string
  classname: string
  racename: string
  role: string
  element: string
  stats: RosterStats
  creation_date: string
  last_payday: string
  next_payday: string
  marker: string
  in_use: number | boolean
  use_type: string
  use_details: string
  active: number | boolean
  /**
   * When the row is erased for good. `payday` pushes it out to 120 days
   * ahead; letting it pass means `deloldfigtrs` deletes the fighter, so this
   * is the deadline the roster screen counts down to.
   */
  final_deletion_date: string
  ascension_level: number
  ascension_in_progress: number | boolean
  ascension_upgrades: AscUpgrade[]
}

/** One stat change an ascension applies. */
export interface AscUpgrade {
  stat_name: string
  value: number
  positive: boolean
}

export interface RosterStats {
  health_min: number
  health_max: number
  damage_min: number
  damage_max: number
  taunt_min: number
  taunt_max: number
  initiative_min: number
  initiative_max: number
  attackspeed_min: number
  attackspeed_max: number
  res_gem: number
  res_metal: number
  res_air: number
  res_fire: number
  res_nature: number
  res_neutral: number
  classname: string
  racename: string
  element: string
  target: string
  abilities: BattleAbility[]
  experience: number
  required_experience: number
  level: number
  credits: number
}

export const TEAM_SIZE = 5
