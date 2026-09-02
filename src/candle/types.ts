/**
 * `recovery.ale` / `offers` — one campaign at the candle.
 *
 * A single offer runs at a time, for a day. Everyone who qualifies throws
 * gems at it, and when it closes the fixed `reward_amount` is split between
 * them in proportion to what each put in.
 */
export interface CandleOffer {
  offer_id: string
  offer_start: string
  offer_end: string
  /** Human wording of the requirement, e.g. "Energy saved in Taverns". */
  requirements: string
  /** The `permstats` key the requirement is measured against. */
  requirement_type: string
  /** The player's lifetime counter must be at least this to take part. */
  requirement_amount: number
  /** Gems everyone has thrown in so far — the denominator of every share. */
  total_gems: number
  reward_type: string
  /** In the reward token's own precision: TLM has 4 places, WAX has 8. */
  reward_amount: number
}

/** `recovery.ale` / `contribution`, scoped by offer id. */
export interface Contribution {
  offer_id: string
  wallet: string
  amount: number
}

/**
 * `recovery.ale` / `claims` — what a player has won and not yet taken.
 *
 * `gems` and `total_gems` are running lifetime tallies rather than anything
 * live: `calcclaim` adds the player's contribution and the offer's whole pot
 * to them each time a campaign settles. `payout` erases the row outright, so
 * claiming resets both.
 */
export interface CandleClaim {
  wallet: string
  gems: number
  total_gems: number
  tlm: number
  wax: number
  expiry_date: string
}

/** `recovery.ale` / `config`. */
export interface CandleConfig {
  index: number
  expiry_days: number
  task_creation_cooldown_minutes: number
  tlmpool: string
  shardpool: string
  waxpool: string
}

/** `recovery.ale` / `tracking` — when the next campaign is due. */
export interface CandleTracking {
  index: number
  next_offer_creation: string
  requirement_amount: number
}
