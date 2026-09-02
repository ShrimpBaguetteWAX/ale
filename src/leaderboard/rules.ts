import type { ArenaSeason, DungeonConfigLb, TlmPool } from './types'

/**
 * How the leaderboards pay.
 *
 * The dungeon board's payout is a decaying curve over rank, and the original
 * client writes it as
 *
 *     base * (1 / rank) ^ curve / base * pot / 100
 *
 * where `base` is `lb_base_minepower`. The base cancels out — it multiplies
 * and divides in the same expression — so the whole thing is
 *
 *     (1 / rank) ^ curve * pot / 100
 *
 * Rank one takes a hundredth of the pot, and each rank below takes a little
 * less. Only the top `lb_reward_count` places are paid at all, which is why
 * the board draws a line there rather than letting a player assume any
 * position earns something.
 */

/** An eosio asset string — "1269.4546 TLM" — as a number. */
export function assetAmount(asset: string | undefined): number {
  if (!asset) return 0
  const n = Number(String(asset).split(' ')[0])
  return Number.isFinite(n) ? n : 0
}

/** What a given rank would earn from the dungeon board right now. */
export function dungeonReward(
  rank: number,
  config: DungeonConfigLb | undefined,
  pool: TlmPool | undefined,
): number {
  if (!config || rank < 1) return 0
  const curve = Number(config.lb_curve_mod)
  if (!Number.isFinite(curve)) return 0
  return Math.pow(1 / rank, curve) * (assetAmount(pool?.tlm_current) / 100)
}

/** Places that earn anything at all. */
export function rewardCount(config: DungeonConfigLb | undefined): number {
  return Number(config?.lb_reward_count ?? 0)
}

/* ---------- arena seasons ---------- */

export type SeasonPhase = 'upcoming' | 'running' | 'ended'

export interface SeasonTiming {
  phase: SeasonPhase
  startsAt: number
  endsAt: number
  /** Milliseconds until the next boundary — the start, or the end. */
  msLeft: number
}

export function seasonTiming(season: ArenaSeason, now = Date.now()): SeasonTiming {
  const startsAt = Date.parse(season.leaderboard_start + 'Z')
  const endsAt = Date.parse(season.leaderboard_end + 'Z')

  if (now < startsAt) {
    return { phase: 'upcoming', startsAt, endsAt, msLeft: startsAt - now }
  }
  if (now >= endsAt) {
    return { phase: 'ended', startsAt, endsAt, msLeft: 0 }
  }
  return { phase: 'running', startsAt, endsAt, msLeft: endsAt - now }
}

/**
 * Which season to open on.
 *
 * The shortest season that is currently running, and the longest one when
 * none is. With today's two that means the Weekend Challenge while it is on
 * and Domination the rest of the time — which is the right instinct rather
 * than a coincidence: a two-day board is the one with something at stake now,
 * and a fortnightly board is the sensible resting place when nothing is.
 *
 * Chosen by duration rather than by name so it keeps working when the team
 * renames a scope — today's is `weekend2`, not `weekend`.
 */
export function defaultSeason(
  seasons: ArenaSeason[],
  now = Date.now(),
): ArenaSeason | undefined {
  if (seasons.length === 0) return undefined

  const running = seasons.filter((s) => seasonTiming(s, now).phase === 'running')
  if (running.length > 0) {
    return [...running].sort((a, b) => a.duration_seconds - b.duration_seconds)[0]
  }

  return [...seasons].sort((a, b) => b.duration_seconds - a.duration_seconds)[0]
}

/**
 * A season's whole prize pot, in TLM.
 *
 * `available_tlm` is stored in TLM's own precision of four places, so the
 * stored 477,910,736 is 47,791.07 TLM — a factor of ten thousand between the
 * row and anything worth showing a player.
 */
export function seasonPot(season: ArenaSeason): number {
  return Number(season.available_tlm ?? 0) / 10_000
}

/* ---------- shared ---------- */

/** "6d 04h", "04h 12m", "12m 30s" — a countdown at the right resolution. */
export function countdown(ms: number): string {
  if (ms <= 0) return 'now'

  const secs = Math.floor(ms / 1000)
  const d = Math.floor(secs / 86_400)
  const h = Math.floor((secs % 86_400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  if (d > 0) return `${d}d ${pad(h)}h`
  if (h > 0) return `${pad(h)}h ${pad(m)}m`
  return `${pad(m)}m ${pad(s)}s`
}

/** A wallet's display name, falling back to the wallet when unset. */
export function displayName(row: { gamertag?: string; wallet: string }): string {
  return row.gamertag?.trim() || row.wallet
}

/** Medal colour for the top three, as the game does elsewhere. */
export function rankClass(rank: number): string {
  if (rank === 1) return 'rank--gold'
  if (rank === 2) return 'rank--silver'
  if (rank === 3) return 'rank--bronze'
  return ''
}
