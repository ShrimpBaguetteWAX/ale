import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { TTL } from '@/chain/cache'
import { nameToUint64 } from '@/dungeon/queries'
import type {
  FarmConfig,
  FarmPool,
  FarmPoolConfig,
  FarmUser,
  StakeWeight,
  StakedCard,
} from './types'

/**
 * The three schemas the contract has a pool for.
 *
 * `poolconfig` also holds three singular-named leftovers — `tool.world`,
 * `crew.world`, `arms.world` — with no matching `pools` row, so they can
 * never pay anything. The pools table is the authority; this order matches
 * the original's tabs.
 */
export const FARM_SCHEMAS = ['tool.worlds', 'crew.worlds', 'arms.worlds'] as const
export type FarmSchema = (typeof FARM_SCHEMAS)[number]

export const SCHEMA_LABEL: Record<string, string> = {
  'tool.worlds': 'Tools',
  'crew.worlds': 'Crew',
  'arms.worlds': 'Weapons',
}

export function fetchFarmConfig(): Promise<FarmConfig | undefined> {
  return getRow<FarmConfig>(
    { code: CONTRACTS.farm, scope: CONTRACTS.farm, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * The pools themselves. Short TTL because `current_size` is the pot every
 * estimate on the screen is a fraction of, and every claim in the game moves
 * it.
 */
export function fetchFarmPools(refresh = false): Promise<FarmPool[]> {
  return getAllRows<FarmPool>(
    { code: CONTRACTS.farm, scope: CONTRACTS.farm, table: 'pools' },
    { ttl: TTL.short, refresh },
  )
}

export function fetchFarmPoolConfigs(): Promise<FarmPoolConfig[]> {
  return getAllRows<FarmPoolConfig>(
    { code: CONTRACTS.farm, scope: CONTRACTS.farm, table: 'poolconfig' },
    { ttl: TTL.long, persist: true },
  )
}

/** Rarity × shine → weight. Twenty-odd rows that never move. */
export function fetchStakeWeights(): Promise<StakeWeight[]> {
  return getAllRows<StakeWeight>(
    { code: CONTRACTS.farm, scope: CONTRACTS.farm, table: 'stakeweight' },
    { ttl: TTL.long, persist: true },
  )
}

/** The player's staking position. Absent until they stake their first card. */
export function fetchFarmUser(
  wallet: string,
  refresh = false,
): Promise<FarmUser | undefined> {
  return getRow<FarmUser>(
    { code: CONTRACTS.farm, scope: CONTRACTS.farm, table: 'user', key: wallet },
    { ttl: TTL.short, refresh },
  )
}

/**
 * Every card this wallet has staked.
 *
 * `nfts` carries a `uint128` secondary index of `owner << 64 | asset_id`, so
 * one bounded read returns the player's whole position and nothing else —
 * ninety rows for an active farmer, against a table holding every staked card
 * in the game.
 */
export function fetchStakedCards(
  wallet: string,
  refresh = false,
): Promise<StakedCard[]> {
  const owner = nameToUint64(wallet)
  const lower = owner << 64n
  const upper = lower | 0xffffffffffffffffn
  return getAllRows<StakedCard>(
    {
      code: CONTRACTS.farm,
      scope: CONTRACTS.farm,
      table: 'nfts',
      index_position: 2,
      key_type: 'i128',
      lower_bound: lower.toString(),
      upper_bound: upper.toString(),
    },
    { ttl: TTL.short, refresh },
  )
}
