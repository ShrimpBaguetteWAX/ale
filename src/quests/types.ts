/**
 * One quest as it sits on a player's `activequests` row.
 *
 * The reward is *not* computed when the quest is completed — it is fixed and
 * escrowed the moment the quest is issued. `getquests` rolls `mine_power`,
 * then inline-calls `pools.ale::qpremine`, which turns that into a concrete
 * amount (`pool_current * mine_power / 1_000_000`), moves the TLM into the
 * `quests.ale` account, deducts it from the pool, and writes the quest back
 * with `mine_completed: true`. So the number on the card is money already set
 * aside, and rerolling gives it back to the pool.
 */
export interface Quest {
  quest_name: string
  quest_scope: string
  quest_title: string
  /** Carries a literal `[amount]` placeholder for the goal. */
  quest_description: string
  /** A `players.ale` permstats key — the counter this quest watches. */
  task_type: string
  /** The counter's value when the quest was issued. */
  task_start_value: number
  /** The counter must reach this. The goal is the difference between them. */
  task_end_value: number
  expiry_date: string
  reward_type: string
  /** In the reward token's own precision: TLM has 4 places, SHARDS has 1. */
  reward_amount: number
  mine_power: number
  mine_completed: boolean | number
}

/** `quests.ale` / `activequests` — every quest a player currently holds. */
export interface ActiveQuests {
  player: string
  deletion_date: string
  quests: Quest[]
}

/**
 * `quests.ale` / `qscopes` — one cadence of quests.
 *
 * Three exist: `day`, `week` and `month`, each offering `max_quests` at a
 * time. `quest_end` is the expiry stamped onto every quest issued in the
 * scope, so it is the countdown the whole tab runs on.
 */
export interface QuestScope {
  scopename: string
  max_quests: number
  /** How many rows the scope's catalogue holds, used by the contract's roll. */
  quest_amount: number
  quest_start: string
  /** When the scope next rolls over to a fresh window. */
  quest_new_times: string
  quest_end: string
  quest_duration_seconds: number
  round_to_first_of_month: boolean | number
}

/** `quests.ale` / `config`. */
export interface QuestConfig {
  index: number
  tlmpools: string[]
  shardpools: string[]
  /** Credits one reroll costs. */
  reroll_cost: number
}
