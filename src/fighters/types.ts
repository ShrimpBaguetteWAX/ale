/** `fighters.ale` / `levels` — one rung of the progression ladder. */
export interface FighterLevel {
  level: number
  /** XP needed to leave *this* level. */
  required_experience: number
  unlock_cost_gem: number
  unlock_cost_credits: number
}

/** `fighters.ale` / `config`. */
export interface FightersConfig {
  config_id: number
  /** Days one payday buys. */
  standard_days_payday: number
  /** Credits a full interval's payday costs. */
  standard_pay_payday: number
  mine_tavern_tlm_pools: string[]
  mine_tavern_shard_pools: string[]
  max_level: number
  /** Multiplier applied to a fighter's sell value each level. */
  level_credits_mod: number | string
  /** Ascension level at which the last ability unlocks. */
  asc_ability_unlock_lvl: number
}
