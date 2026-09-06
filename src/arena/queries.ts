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

/**
 * `arena.ale` / `arenacap` — the arenas this player currently holds.
 *
 * Winning an arena writes a row here, and it stays until somebody takes the
 * arena back or the player pulls their fighter out (`rmvfighters` settles the
 * row and erases it). While it stands, `settlereward` adds
 * `arena_rating / 10000` mining power per hour, multiplied by the square root
 * of how many arenas the player holds at once — so a second arena is worth
 * more than half a first one, and the count is worth showing.
 *
 * This is not the same question as "do I have a fighter in there".
 * `livearena` keeps up to six fighters per arena, most of them belonging to
 * players who have already lost the place; being in that list blocks a
 * challenge but earns nothing. Holding is what this table records.
 *
 * One global table, read through the `wallet` secondary index, so it is one
 * bounded request for every planet at once rather than a scan.
 */
export interface CapturedArena {
  index: number
  wallet: string
  captured_at: string
  settled_until: string
  arena_rating: number
  planet: Planet
  land_id: string
  stored_mining_power: number
}

export async function fetchCapturedArenas(
  wallet: string,
  refresh = false,
): Promise<CapturedArena[]> {
  const key = nameToUint64(wallet).toString()
  const res = await getRows<CapturedArena>(
    {
      code: CONTRACTS.arena,
      scope: CONTRACTS.arena,
      table: 'arenacap',
      index_position: 2,
      key_type: 'i64',
      lower_bound: key,
      upper_bound: key,
      limit: 100,
    },
    { ttl: TTL.short, refresh },
  )
  return res.rows
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
