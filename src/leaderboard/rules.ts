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

/**
 * What a place on an arena board takes of the pot.
 *
 * The contract pays nothing per place until a season settles, so the board
 * had a column of dashes for the fortnight a season runs. The split is not a
 * secret, though — it is the same every time, and reading the last two
 * settled seasons off the chain gives it exactly:
 *
 *   * Each place's weight is `1 / rank` **cut** to three decimals, so rank
 *     six weighs 0.166 rather than 0.1667 and rank seven 0.142.
 *   * Rank one takes the pot divided by the sum of those weights, cut down to
 *     a tenth of a TLM. Every other place is that figure times its weight.
 *
 * Reproduced to the last decimal of all twenty places of both the Domination
 * and the Weekend boards, with the few TLM the cutting leaves over staying
 * behind. The pot is fixed when the season starts, so this is what the place
 * pays, not a guess at it — what nobody knows yet is who will hold the place.
 */
export function arenaWeight(rank: number): number {
  if (rank < 1) return 0
  return Math.floor((1 / rank) * 1000) / 1000
}

export function arenaReward(rank: number, season: ArenaSeason | undefined): number {
  if (!season || rank < 1) return 0
  const winners = Number(season.winners ?? 0)
  if (rank > winners) return 0

  let weights = 0
  for (let r = 1; r <= winners; r++) weights += arenaWeight(r)
  if (weights <= 0) return 0

  /* The tenth of a TLM the contract works in, kept in whole units to stay off floating point. */
  const first = Math.floor((seasonPot(season) / weights) * 10) / 10
  return first * arenaWeight(rank)
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
