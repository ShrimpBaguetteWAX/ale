import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow, getRows } from '@/chain/client'
import { TTL } from '@/chain/cache'
import type {
  ArenaRank,
  ArenaSeason,
  ClaimCooldown,
  DungeonConfigLb,
  DungeonRank,
  TlmPool,
} from './types'

/**
 * The top of the dungeon-defence leaderboard.
 *
 * Read over the `rating` secondary index in reverse, so the chain returns the
 * ranking already sorted and only the rows that will be shown. The live site
 * pages the whole table and sorts in the browser — and each row embeds a
 * six-fighter defending team with every ability spelled out, so that is
 * megabytes to render twenty names.
 */
export function fetchDungeonRanks(limit = 25, refresh = false): Promise<DungeonRank[]> {
  return getRows<DungeonRank>(
    {
      code: CONTRACTS.dungeons,
      scope: CONTRACTS.dungeons,
      table: 'leaderboard',
      index_position: 2,
      key_type: 'i64',
      reverse: true,
      limit,
    },
    { ttl: TTL.short, refresh },
  ).then((r) => r.rows)
}

/** The reward curve and claim cooldown. */
export function fetchDungeonLbConfig(): Promise<DungeonConfigLb | undefined> {
  return getRow<DungeonConfigLb>(
    { code: CONTRACTS.dungeons, scope: CONTRACTS.dungeons, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * Whether this player's daily claim is still on cooldown.
 *
 * `cdclaim` holds a row per outstanding cooldown rather than per player, and
 * it is keyed by an opaque index — so this reads the handful of live rows and
 * picks out the wallet's own. There are single digits of them at a time.
 */
export async function fetchClaimCooldown(
  wallet: string,
  refresh = false,
): Promise<ClaimCooldown | undefined> {
  const rows = await getAllRows<ClaimCooldown>(
    { code: CONTRACTS.dungeons, scope: CONTRACTS.dungeons, table: 'cdclaim' },
    { ttl: TTL.live, refresh },
  )
  return rows.find((r) => r.wallet === wallet && r.item === 'lbclaim')
}

/** The arena's running seasons, each with its own scope and prize pot. */
export function fetchArenaSeasons(refresh = false): Promise<ArenaSeason[]> {
  return getAllRows<ArenaSeason>(
    { code: CONTRACTS.arena, scope: CONTRACTS.arena, table: 'lbscopes' },
    { ttl: TTL.short, refresh },
  )
}

/**
 * One arena season's standings.
 *
 * Scoped by the season's own name, and small — a few dozen rows — so this
 * sorts client-side rather than needing the rating index.
 */
export async function fetchArenaRanks(
  scope: string,
  refresh = false,
): Promise<ArenaRank[]> {
  const rows = await getAllRows<ArenaRank>(
    { code: CONTRACTS.arena, scope, table: 'leaderboard' },
    { ttl: TTL.short, refresh },
  )
  return [...rows].sort((a, b) => b.rating - a.rating)
}

/** The pot a leaderboard pays out of. */
export async function fetchTlmPool(pool: string, refresh = false) {
  const rows = await getAllRows<TlmPool>(
    { code: CONTRACTS.pools, scope: CONTRACTS.pools, table: 'tlmpools' },
    { ttl: TTL.short, refresh },
  )
  return rows.find((p) => p.pool === pool)
}
