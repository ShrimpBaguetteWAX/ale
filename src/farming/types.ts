import type { KeyValue } from '@/chain/types'

/** `farm.ale` / `config`. */
export interface FarmConfig {
  index: number
  paused: boolean | number
  /**
   * The ceiling on a single claim's power. Reaching it means further waiting
   * earns nothing, so it is the number the screen counts down to.
   */
  max_power: number
  /** Power is divided by this to become a fraction of the pool. */
  power_divider: number
  /** Gems charged per card staked. */
  gem_fee: number
  credit_fee: number
  max_nfts: number
}

/**
 * `farm.ale` / `pools` — one schema's shared pot.
 *
 * `current_size` is the pot itself, in credits. A claim takes a fraction of
 * it, so what a card is worth depends on how full the pot is as much as on
 * the card.
 */
export interface FarmPool {
  schema: string
  current_size: number
  last_claim: string
  total_nfts: number
  total_weight: number
}

/** `farm.ale` / `poolconfig` — what trickles into a pool over time. */
export interface FarmPoolConfig {
  schema: string
  /** Named per hour; the contract divides by 86,400, so it is per day. */
  value_per_hour: number
  last_update: string
}

/** `farm.ale` / `stakeweight` — what a card is worth, by rarity and shine. */
export interface StakeWeight {
  index: number
  rarity: string
  shine: string
  weight: number
}

/** `farm.ale` / `user` — one player's staking position. */
export interface FarmUser {
  wallet: string
  last_claim: string
  last_reward: number
  total_reward: number
  pool_weights: KeyValue<string, number>[]
  pool_nfts: KeyValue<string, number>[]
  total_nfts: number
}

/** `farm.ale` / `nfts` — one staked card. */
export interface StakedCard {
  asset_id: string
  schema: string
  owner: string
  template_id: number
  rarity: string
  shine: string
  weight: number
  code: string
  stake_date: string
}

/** An unstaked card in the player's wallet, from AtomicAssets. */
export interface FarmCard {
  asset_id: string
  name: string
  template_id: number
  schema: string
  rarity: string
  shine: string
}
