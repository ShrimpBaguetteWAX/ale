import { CONTRACTS, type Planet } from './config'
import { getAllRows, getRow, getRows } from './client'
import { TTL } from './cache'
import type {
  Avatar,
  GameConfig,
  Land,
  LandsConfig,
  PauseState,
  Player,
  SignupStat,
  WhitelistEntry,
} from './types'

/**
 * Game config. Effectively static, so it's cached hard and shared by every
 * screen that needs travel costs or the signup fee.
 */
export function fetchConfig(refresh = false): Promise<GameConfig | undefined> {
  return getRow<GameConfig>(
    { code: CONTRACTS.players, scope: CONTRACTS.players, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true, refresh },
  )
}

export function fetchPauseState(): Promise<PauseState | undefined> {
  return getRow<PauseState>(
    { code: CONTRACTS.players, scope: CONTRACTS.players, table: 'pause', key: 0 },
    { ttl: TTL.short },
  )
}

/** The signed-in player's row, or undefined if they haven't signed up. */
export function fetchPlayer(
  wallet: string,
  refresh = false,
): Promise<Player | undefined> {
  return getRow<Player>(
    {
      code: CONTRACTS.players,
      scope: CONTRACTS.players,
      table: 'players',
      key: wallet,
    },
    { ttl: TTL.live, refresh },
  )
}

/**
 * Whether the signup fee has already been paid but `signup` not yet called.
 * The contract creates this row from the `eosio.token::transfer` handler and
 * erases it inside `signup`, so it is exactly the "fee paid, name pending"
 * state the UI needs to resume into.
 */
export function fetchSignupStat(
  wallet: string,
  refresh = false,
): Promise<SignupStat | undefined> {
  return getRow<SignupStat>(
    {
      code: CONTRACTS.players,
      scope: CONTRACTS.players,
      table: 'signupstat',
      key: wallet,
    },
    { ttl: 0, refresh },
  )
}

/** Whether a wallet is on the allowlist (only enforced while it's active). */
export async function fetchIsWhitelisted(wallet: string): Promise<boolean> {
  const row = await getRow<WhitelistEntry>(
    {
      code: CONTRACTS.players,
      scope: CONTRACTS.players,
      table: 'whitelist',
      key: wallet,
    },
    { ttl: TTL.short },
  )
  return !!row
}

export function fetchAvatars(): Promise<Avatar[]> {
  return getAllRows<Avatar>(
    { code: CONTRACTS.players, scope: CONTRACTS.players, table: 'avatars' },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * Every land on a planet in one request.
 *
 * The grid is 41x21 = 861 tiles, which fits in a single `limit: 1000` page,
 * so a planet costs exactly one round trip. Results persist to localStorage
 * so returning players render the map with zero network calls.
 */
export function fetchPlanetLands(
  planet: Planet,
  refresh = false,
): Promise<Land[]> {
  return getAllRows<Land>(
    { code: CONTRACTS.lands, scope: planet, table: 'lands' },
    { ttl: TTL.medium, persist: true, refresh },
  )
}

/** Leaderboard-style page of players, ordered by primary key. */
export function fetchPlayersPage(lowerBound?: string, limit = 50) {
  return getRows<Player>(
    {
      code: CONTRACTS.players,
      scope: CONTRACTS.players,
      table: 'players',
      lower_bound: lowerBound,
      limit,
    },
    { ttl: TTL.short },
  )
}

/**
 * `lands.ale` config. Needed to age a building's stored boost forward — see
 * `liveBoostPercent`.
 */
export function fetchLandsConfig(): Promise<LandsConfig | undefined> {
  return getRow<LandsConfig>(
    { code: CONTRACTS.lands, scope: CONTRACTS.lands, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * Live arena occupancy for one planet.
 *
 * Rows are large (each fighter carries its full ability list), but there are
 * only a handful of arenas in the whole game, so this is only ever called for
 * planets that actually have one — see `MapView`.
 */
export function fetchLiveArenas(planet: Planet) {
  return getAllRows<{ planet: string; land_id: string; fighters: { owner: string }[] }>(
    { code: CONTRACTS.arena, scope: planet, table: 'livearena' },
    { ttl: TTL.short },
  )
}

/**
 * wallet -> playertag, for showing whose building a player is looking at.
 *
 * Bounded on purpose. The players table is small today, so one page covers
 * everyone and costs a single cached request. If it ever outgrows a page this
 * returns what it has and `more: true`, and callers fall back to resolving the
 * handful of wallets they actually need with `fetchPlayerTag`.
 */
export async function fetchPlayerTags(): Promise<{
  tags: Record<string, string>
  /**
   * The face each player picked, `active_avatar`, alongside the name.
   *
   * Free: the same rows already carry it, so anywhere that names a player can
   * show them as they chose to be seen without a second read.
   */
  avatars: Record<string, number>
  complete: boolean
}> {
  const res = await getRows<Pick<Player, 'wallet' | 'playertag'> & { active_avatar?: number }>(
    { code: CONTRACTS.players, scope: CONTRACTS.players, table: 'players', limit: 200 },
    { ttl: TTL.long, persist: true },
  )
  const tags: Record<string, string> = {}
  const avatars: Record<string, number> = {}
  for (const row of res.rows) {
    if (row.playertag) tags[row.wallet] = row.playertag
    const avatar = Number(row.active_avatar ?? 0)
    if (avatar > 0) avatars[row.wallet] = avatar
  }
  return { tags, avatars, complete: !res.more }
}

/** One wallet's playertag, for owners the bounded scan above didn't cover. */
export async function fetchPlayerTag(wallet: string): Promise<string | undefined> {
  const row = await getRow<Pick<Player, 'wallet' | 'playertag'>>(
    { code: CONTRACTS.players, scope: CONTRACTS.players, table: 'players', key: wallet },
    { ttl: TTL.long, persist: true },
  )
  return row?.playertag || undefined
}
