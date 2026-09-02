import { CONTRACTS, type Planet } from '@/chain/config'
import { getRow, getRows } from '@/chain/client'
import { TTL } from '@/chain/cache'
import { nameToUint64 } from '@/dungeon/queries'
import type { BattleFighter } from '@/dungeon/types'

/**
 * `arena.ale` / `livearena` — the team currently holding one arena.
 *
 * Scoped by planet, keyed by land id. Unlike a dungeon's standing team this
 * changes every time somebody wins here: the victor's fighter is pushed in
 * and the oldest defender evicted, so it is read fresh rather than cached
 * for minutes.
 *
 * Up to six fighters: four or five belonging to other players, plus the
 * winner's NFT fighter, which carries `stake_id: "nft"`.
 */
export interface LiveArenaRow {
  planet: Planet
  land_id: string
  fighters: BattleFighter[]
  last_fight: string
  template_ids: number[]
}

export function fetchLiveArena(
  planet: Planet,
  landId: string,
  refresh = false,
): Promise<LiveArenaRow | undefined> {
  return getRow<LiveArenaRow>(
    {
      code: CONTRACTS.arena,
      scope: planet,
      table: 'livearena',
      key: landId,
    },
    { ttl: TTL.short, refresh },
  )
}

/**
 * `arena.ale` / `arenacheck` — how hard the defenders currently hit.
 *
 * `arena_power` is measured in hundredths of a percent against 10,000, and
 * `battle.cpp` multiplies every defender's health and damage by
 * `arena_power / 10000` before the first blow. It falls as an arena goes
 * unbeaten and resets to full the moment somebody wins there, so it is the
 * single number that says whether an arena is worth challenging.
 *
 * Read through the `arenaid` secondary index, a `uint128` of
 * `planet << 64 | land_id`, so one land costs one bounded request rather
 * than a scan of every arena in the game.
 */
export interface ArenaCheckRow {
  index: number
  planet: Planet
  land_id: string
  arena_power: number
  last_power_decay: string
  last_check: string
  arena_cleared: number | boolean
}

export async function fetchArenaPower(
  planet: Planet,
  landId: string,
  refresh = false,
): Promise<ArenaCheckRow | undefined> {
  const key = ((nameToUint64(planet) << 64n) | nameToUint64(landId)).toString()
  const res = await getRows<ArenaCheckRow>(
    {
      code: CONTRACTS.arena,
      scope: CONTRACTS.arena,
      table: 'arenacheck',
      index_position: 2,
      key_type: 'i128',
      lower_bound: key,
      upper_bound: key,
      limit: 1,
    },
    { ttl: TTL.short, refresh },
  )
  return res.rows[0]
}

/** `arena.ale` / `config` — what a challenge costs in energy. */
export interface ArenaConfig {
  index: number
  energy_cost: number
  tlmpools_domination: string[]
  shardpools_domination: string[]
}

export function fetchArenaConfig(): Promise<ArenaConfig | undefined> {
  return getRow<ArenaConfig>(
    { code: CONTRACTS.arena, scope: CONTRACTS.arena, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}
