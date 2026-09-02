import type { Planet } from './config'
import type { Objective } from '@/tavern/types'

/** `players.ale` / `config` — one row, index 0. */
export interface GameConfig {
  index: number
  start_action_points: number
  max_taverns: number
  travel_base_cost: number
  travel_distance_cost: number
  travel_portal_cost: number
  start_x: number
  start_y: number
  start_planet: Planet
  allowlist_active: number | boolean
  trial_rewpow_mod: string
  spend_cred_to_farm_percent: number
  /** e.g. "15.00000000 WAX" */
  signup_fee: string
  signup_fee_wallet: string
}

export interface ActiveStats {
  credits: number
  gems: number
  action_points: number
  unclaimed_gems: number
  unclaimed_credits: number
  unclaimed_shards: number
  unclaimed_tlm: number | string
  unclaimed_wax: number | string
  action_point_update: string
}

/** Contract maps serialise as [{first, second}] over the RPC API. */
export interface KeyValue<K = string, V = number | string> {
  first: K
  second: V
}

export interface Tavern {
  planet: Planet | ''
  x: number
  y: number
  land_id: string
  selection_score: number
  boost_score: number
  displayname: string
  required_maintenance: string
  objectives: Objective[]
}

/** A fighter ability on the recruit currently offered by a tavern. */
export interface FighterAbility {
  ability: string
  displayname: string
  description: string
  locked?: number | boolean
}

/**
 * `last_tavern_fighter` — the recruit on offer.
 *
 * Stats are min/max ranges: the tavern shows what the fighter *could* roll,
 * and the real values are fixed when `hire` runs. An unrevealed slot is all
 * zeroes, which is why `level > 0` is the test for "someone is waiting".
 */
export interface TavernFighter {
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
  abilities: FighterAbility[]
  experience: number
  required_experience: number
  level: number
  credits: number
}

/** `players.ale` / `players`, scope `players.ale`, pk = wallet. */
export interface Player {
  wallet: string
  playertag: string
  permstats: KeyValue[]
  activestats: ActiveStats
  x: number
  y: number
  planet: Planet
  signup_date: string
  recruited_by: string
  battle_nfts: KeyValue<string, string | number>[]
  recent_fighter_ids: number[]
  mine_nfts: (string | number)[]
  mine_templates: number[]
  last_action: string
  /**
   * The tavern the player is currently standing in, set by `users::travel`
   * when they land on one. `users::hire` refuses unless this land still
   * matches their position, so it is what gates the tavern screen.
   */
  last_tavern: Tavern
  /** The recruit that tavern is offering. All zeroes until revealed. */
  last_tavern_fighter: TavernFighter
  active_taverns: Tavern[]
  land_shard_beneficiary: string
  played_dungeons: string
  last_dungeon_reset: string
  unlocked_avatars: number[]
  active_avatar: number | string
  landowner_tlm_share: number
  legend_access_expiry: string
  /**
   * Mining power banked per pool, which is how dungeon and arena rewards
   * actually pay out. A run adds power rather than paying anything; the
   * player claims once a pool reaches 10,000 (shown as 100%).
   */
  reward_power: RewardPowerRow[]
}

/** One pool's banked mining power on the player row. */
export interface RewardPowerRow {
  pool: string
  power: number
  type: string
}

/** `players.ale` / `signupstat` — present once the WAX fee has landed. */
export interface SignupStat {
  wallet: string
  unlocked: boolean | number
}

/** `players.ale` / `whitelist` — gates signup while allowlist_active is set. */
export interface WhitelistEntry {
  wallet: string
}

export interface Building {
  building?: string
  name?: string
  level?: number
  [k: string]: unknown
}

/** `lands.ale` / `lands`, scope = planet name. */
export interface Land {
  land_id: string
  planet: Planet
  asset_id: string | number
  land_type: string
  rarity: string
  special_effect: string
  x: number
  y: number
  tavern_score: string | number
  buildings: Building[]
}

/** `players.ale` / `avatars`. */
export interface Avatar {
  avatar_id: number
  avatar_prereq_id: number
  avatar_category: string
  avatar_name: string
  avatar_description: string
  permstats_requirement: string
  permstats_requirement_min_value: number
}

/** `players.ale` / `pause`. */
export interface PauseState {
  config_id: number
  game_paused: boolean | number
}

/** Turn the RPC's [{first, second}] map encoding into a plain object. */
export function kvToRecord<V = number | string>(
  kv: KeyValue<string, V>[] | undefined,
): Record<string, V> {
  const out: Record<string, V> = {}
  for (const { first, second } of kv ?? []) out[first] = second
  return out
}

/** `lands.ale` / `config` — boost economy parameters. */
export interface LandsConfig {
  index: number
  standard_tavern_score: string | number
  boost_decay_per_hour: number
  start_boost_score: number
  standard_tavern_increase: number
  disable_building_boost_score: number
  boost_base_cost: number
  boost_cost_mod: string
  boost_cost_first_percent: number
  delete_building_gems_cost: number
}
