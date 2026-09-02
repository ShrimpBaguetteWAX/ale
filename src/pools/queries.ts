import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { TTL } from '@/chain/cache'

/**
 * `pools.ale` / `tlmpools` — where mined Trilium comes from.
 *
 * A pool holds two balances. `tlm_reserve` is the vault; `tlm_current` is
 * what mining can actually draw on, and the fillrate trickles the first into
 * the second. Only `tlm_current` decides a payout.
 */
export interface TlmPool {
  pool: string
  subpools: string[]
  has_fillrate: boolean
  /** Per minute, as an asset string. */
  fillrate: string
  tlm_reserve: string
  tlm_current: string
  last_reserve_update: string
  last_current_update: string
  fillrate_expiry: string
  claim_per_hour_percent: number
  /** Hundred-thousandths: 350000 is 35% of the reserve a day. */
  fillrate_1d_percent: number
}

/** `pools.ale` / `shardpools` — the same idea with one flat balance. */
export interface ShardPool {
  pool: string
  /** Shards at one decimal, so 196371 is 19,637.1. */
  shard_current: number
  fillrate_per_hour: number
  last_current_update: string
}

export function fetchTlmPools(refresh = false): Promise<TlmPool[]> {
  return getAllRows<TlmPool>(
    { code: CONTRACTS.pools, scope: CONTRACTS.pools, table: 'tlmpools' },
    { ttl: TTL.short, refresh },
  )
}

export function fetchShardPools(refresh = false): Promise<ShardPool[]> {
  return getAllRows<ShardPool>(
    { code: CONTRACTS.pools, scope: CONTRACTS.pools, table: 'shardpools' },
    { ttl: TTL.short, refresh },
  )
}

/**
 * `rwrdlog.ale` / `pooldesc` — the game's own name for each pool.
 *
 * The pool ids are contractions (`tlmarenadom`, `shrddung`), and this table
 * is where the game itself spells them out: "Arena Domination Reward",
 * "Reward for beating a dungeon". Worth reading rather than inventing a
 * second set of names that would drift from the ones in the ledger.
 */
export interface PoolDescription {
  pool_name: string
  pool_description: string
}

export function fetchPoolDescriptions(): Promise<PoolDescription[]> {
  return getAllRows<PoolDescription>(
    { code: CONTRACTS.rewardLog, scope: CONTRACTS.rewardLog, table: 'pooldesc' },
    { ttl: TTL.long, persist: true },
  )
}

/** `players.ale` / `config` — carries the trial penalty on reward power. */
export interface UsersConfig {
  index: number
  /** A float string: 0.1 means a trial player banks a tenth of the power. */
  trial_rewpow_mod: number | string
}

export function fetchUsersConfig(): Promise<UsersConfig | undefined> {
  return getRow<UsersConfig>(
    { code: CONTRACTS.players, scope: CONTRACTS.players, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * `pools.ale` / `templatemp` — the mining power of every tool template.
 *
 * The game precomputes this per template rather than reading the NFT's own
 * stats at mine time, and `mineland` sums `tlm_mp` and `shrd_mp` across the
 * whole equipped bag into `total_mine_power_tlm` / `total_mine_power_shard`.
 * So these two numbers, and nothing else on the tool, are what a player is
 * actually choosing between.
 *
 * They are derived from the tool's luck and ease against the rarity's mine
 * power (`pools.cpp:419`):
 *
 *     shrd_mp = luck + minepower * luck / (luck + ease)
 *     tlm_mp  = ease + minepower * ease / (ease + luck)
 *
 * which is why ease pulls a tool towards Trilium and luck towards Shards.
 */
export interface ToolTemplate {
  template_id: number
  toolname: string
  /** Rarity and shine combined, e.g. `comsto` — the key the game groups by. */
  mpkey: string
  rarity: string
  shine: string
  shrd_mp: number
  tlm_mp: number
  luck: number
  ease: number
}

export function fetchToolTemplates(): Promise<ToolTemplate[]> {
  return getAllRows<ToolTemplate>(
    { code: CONTRACTS.pools, scope: CONTRACTS.pools, table: 'templatemp' },
    { ttl: TTL.long, persist: true },
  )
}
