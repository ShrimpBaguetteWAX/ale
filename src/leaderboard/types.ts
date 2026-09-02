import type { BattleFighter } from '@/dungeon/types'

/**
 * `dungeons.ale` / `leaderboard` — one player's standing in dungeon defence.
 *
 * Rating is earned by the team the player leaves defending their dungeon, so
 * each row carries that team with it. `recent_fighters` is the full fighter
 * record including every ability, which makes these rows enormous — reading
 * the whole table costs megabytes, and reading the top twenty over the rating
 * index costs one request.
 */
export interface DungeonRank {
  wallet: string
  rating: number
  last_change: string
  recent_fighter_ids: number[]
  recent_fighters: BattleFighter[]
  /** The crew and weapon cards the defending team fuses its sixth fighter from. */
  used_template_ids: number[]
  avatar: number
  gamertag: string
}

/** `arena.ale` / `leaderboard`, scoped by season. */
export interface ArenaRank {
  wallet: string
  rating: number
  last_change: string
  avatar: number
  gamertag: string
  earned_shards: number
  earned_tlm: number
  earned_wax: number
  /** Filled in only once a season has been settled. */
  rank: number
}

/**
 * `arena.ale` / `lbscopes` — one arena season.
 *
 * Two run at once today: a fortnightly "Domination" and a two-day "Weekend
 * Challenge". Each has its own prize pot and its own leaderboard scope.
 */
export interface ArenaSeason {
  scope: string
  displayname: string
  duration_seconds: number
  leaderboard_start: string
  leaderboard_end: string
  start_to_start_seconds: number
  winner_scope: string
  winners: number
  available_shards: number
  /** In TLM's own precision of four places. */
  available_tlm: number
  available_wax: number
  mine_power: number
  mine_pool: string
}

/** `dungeons.ale` / `config` — the leaderboard reward curve lives here. */
export interface DungeonConfigLb {
  index: number
  lb_reward_count: number
  lb_cooldown_minutes: number
  lb_base_minepower: number
  /** Exponent of the payout curve; arrives as a string because it is a float. */
  lb_curve_mod: string
  lb_tlmpools: { first: string; second: number }[]
}

/** `dungeons.ale` / `cdclaim` — an outstanding claim cooldown. */
export interface ClaimCooldown {
  index: number
  wallet: string
  item: string
  cooldown_expired: string
}

/** `pools.ale` / `tlmpools` — the pot a leaderboard pays out of. */
export interface TlmPool {
  pool: string
  /** An eosio asset string, e.g. "1269.4546 TLM". */
  tlm_current: string
  tlm_reserve: string
}
