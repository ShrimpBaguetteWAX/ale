import type { Avatar, KeyValue, Player } from '@/chain/types'
import type {
  CpuConfig,
  CpuUsage,
  RewardLogCapacity,
  RewardLogConfig,
} from './queries'
import { asset } from '@/assets'

/**
 * The account screen's rules, from `users` and `cpu.ale`.
 *
 * Avatars are the interesting part. Each one names a `permstats` key and a
 * threshold, and `unlockavatar` checks the player's lifetime counter against
 * it — but **silently skips** any avatar that does not qualify rather than
 * failing. So a client that sends everything gets no error and no avatar, and
 * the player learns nothing. This screen only offers what will actually work,
 * and shows the rest with the number still to reach.
 */

export const TAG_MIN = 4
export const TAG_MAX = 12

/** `settag` asserts `length > 3 && length <= 12`. */
export function validateTag(tag: string): string | null {
  const t = tag.trim()
  if (t.length < TAG_MIN) return `At least ${TAG_MIN} characters.`
  if (t.length > TAG_MAX) return `At most ${TAG_MAX} characters.`
  return null
}

/* ---------- avatars ---------- */

export type AvatarState = 'active' | 'unlocked' | 'ready' | 'locked'

export interface AvatarEntry {
  avatar: Avatar
  state: AvatarState
  /** The player's current standing on the requirement. */
  have: number
  need: number
}

function permstat(player: Player, key: string): number {
  const hit = (player.permstats as KeyValue[] | undefined)?.find((p) => p.first === key)
  return Number(hit?.second ?? 0)
}

/**
 * Every avatar, sorted so the ones a player can act on come first.
 *
 * `ready` — earned but not yet claimed — leads, because it is the only state
 * with something to do and the contract will not tell anyone it exists.
 */
export function avatarBoard(avatars: Avatar[], player: Player): AvatarEntry[] {
  const unlocked = new Set((player.unlocked_avatars ?? []).map(Number))
  const active = Number(player.active_avatar ?? 0)

  const rank: Record<AvatarState, number> = {
    ready: 0,
    active: 1,
    unlocked: 2,
    locked: 3,
  }

  return avatars
    .map((avatar): AvatarEntry => {
      const have = permstat(player, avatar.permstats_requirement)
      const need = Number(avatar.permstats_requirement_min_value ?? 0)
      const isUnlocked = unlocked.has(Number(avatar.avatar_id))

      const state: AvatarState = isUnlocked
        ? Number(avatar.avatar_id) === active
          ? 'active'
          : 'unlocked'
        : have >= need
          ? 'ready'
          : 'locked'

      return { avatar, state, have, need }
    })
    .sort(
      (a, b) =>
        rank[a.state] - rank[b.state] ||
        a.avatar.avatar_category.localeCompare(b.avatar.avatar_category) ||
        Number(a.avatar.avatar_id) - Number(b.avatar.avatar_id),
    )
}

/** Avatars the contract would actually grant if asked right now. */
export function claimableAvatars(board: AvatarEntry[]): number[] {
  return board.filter((e) => e.state === 'ready').map((e) => Number(e.avatar.avatar_id))
}

export function avatarArt(id: number | string): string {
  return asset(`/assets/avatar/${id}.webp`)
}

/* ---------- cpu ---------- */

export interface CpuStatus {
  used: number
  allowance: number
  left: number
  /** When the count resets; absent until the wallet has spent anything. */
  resetsAt?: number
  /** WAX the game spends on each of those actions. */
  waxPerClaim: number
}

/**
 * How much of the game's CPU allowance is left.
 *
 * The game pays the network cost of a player's transactions out of `cpu.ale`,
 * capped at `claims_per_week` per wallet. Running out does not break anything
 * visible — it just means the wallet starts paying its own resources — but it
 * is invisible everywhere else, so it belongs here.
 */
export function cpuStatus(
  config: CpuConfig | undefined,
  usage: CpuUsage | undefined,
): CpuStatus {
  const allowance = Number(config?.claims_per_week ?? 0)
  const used = Number(usage?.uses ?? 0)
  const expiry = usage ? Date.parse(usage.expiry_time + 'Z') : NaN

  return {
    used,
    allowance,
    left: Math.max(0, allowance - used),
    resetsAt: Number.isFinite(expiry) ? expiry : undefined,
    waxPerClaim: Number(String(config?.wax_per_claim ?? '0').split(' ')[0]) || 0,
  }
}

/* ---------- currencies ---------- */

/** The three tokens the account screen keeps a ledger for. */
export const CURRENCIES = ['tlm', 'wax', 'shrds'] as const
export type Currency = (typeof CURRENCIES)[number]

export const CURRENCY_LABEL: Record<Currency, string> = {
  tlm: 'TLM',
  wax: 'Wax',
  shrds: 'Shards',
}

export const CURRENCY_ICON: Record<Currency, string> = {
  tlm: asset('/assets/icons/tlm.svg'),
  wax: asset('/assets/icons/wax-coin.png'),
  shrds: asset('/assets/icons/shards.svg'),
}

/** What `activestats` calls each one — the key differs from the log's type. */
export const CURRENCY_UNCLAIMED: Record<Currency, 'unclaimed_tlm' | 'unclaimed_wax' | 'unclaimed_shards'> = {
  tlm: 'unclaimed_tlm',
  wax: 'unclaimed_wax',
  shrds: 'unclaimed_shards',
}

/** On-chain precision, so a stored integer can be read back as tokens. */
export const CURRENCY_PRECISION: Record<Currency, number> = {
  tlm: 4,
  wax: 8,
  shrds: 1,
}

/**
 * Whether `claimcur` actually pays this currency out.
 *
 * It transfers unclaimed TLM and folds gems and credits into the live
 * balances — but zeroes `unclaimed_shards` and `unclaimed_wax` while sending
 * nothing, the same way the land claim drops shards. Both are normally paid
 * straight out and sit at zero, so this rarely costs anybody anything; it
 * still should not be presented as a claim.
 */
export function claimPays(currency: Currency): boolean {
  return currency === 'tlm'
}

/** An eosio asset string as a number. */
export function assetValue(asset: string): number {
  const n = Number(String(asset).split(' ')[0])
  return Number.isFinite(n) ? n : 0
}

/* ---------- mining tools ---------- */

/**
 * What a mining tool is actually chosen on.
 *
 * The game does not read a tool's delay, ease, luck or difficulty when a mine
 * resolves. It looks the template up in `pools.ale` / `templatemp` and adds
 * two precomputed figures across the whole equipped bag
 * (`pools.cpp:1379`):
 *
 *     total_mine_power_tlm   += tlm_mp
 *     total_mine_power_shard += shrd_mp
 *
 * So those two are the only numbers that decide a payout, and the raw stats
 * are just what they were derived from. Showing the raw stats — as this
 * screen used to — put four irrelevant figures in front of the player and
 * hid the two that matter.
 */
export const MINING_POWER: {
  key: 'tlm_mp' | 'shrd_mp'
  label: string
  icon: string
  hint: string
}[] = [
  {
    key: 'tlm_mp',
    label: 'TLM MP',
    icon: asset('/assets/icons/tlm.svg'),
    hint: 'Trilium mining power — summed across the bag, then drawn from the TLM pools',
  },
  {
    key: 'shrd_mp',
    label: 'Shard MP',
    icon: asset('/assets/icons/shards.svg'),
    hint: 'Shard mining power — summed across the bag, then drawn from the shard pools',
  },
]

export interface MiningPower {
  tlm_mp: number
  shrd_mp: number
}

/**
 * The bag's combined mining power.
 *
 * Alien Worlds mines with every equipped tool at once and sums these, so the
 * totals are what a player is really choosing: a tool that looks poor alone
 * can still be the right third pick.
 */
export function bagPower(tools: Partial<MiningPower>[]): MiningPower {
  return tools.reduce<MiningPower>(
    (acc, t) => ({
      tlm_mp: acc.tlm_mp + Number(t.tlm_mp ?? 0),
      shrd_mp: acc.shrd_mp + Number(t.shrd_mp ?? 0),
    }),
    { tlm_mp: 0, shrd_mp: 0 },
  )
}

/**
 * How a tool leans.
 *
 * `tlm_mp` is derived from the tool's ease and `shrd_mp` from its luck, so
 * every tool sits somewhere on a line between the two currencies. Returns the
 * Trilium share, 0–1.
 */
export function powerBias(t: Partial<MiningPower>): number {
  const tlm = Number(t.tlm_mp ?? 0)
  const total = tlm + Number(t.shrd_mp ?? 0)
  return total > 0 ? tlm / total : 0.5
}

/* ---------- reward history capacity ---------- */

/**
 * What a currency's ledger can hold, and what more of it costs.
 *
 * The history is not a free record of what happened — it is storage the
 * player rents with gems, per currency. `addhistory` writes nothing at all
 * for a currency with no rows unlocked, and once the rows are full it deletes
 * the oldest entry to fit the newest. So "empty" and "full" both need saying
 * out loud, and neither means the payments did not happen.
 */
export interface LogCapacity {
  unlocked: number
  used: number
  /** Gems for the smallest order the contract will accept. */
  price: number
  /** Rows in that smallest order. */
  step: number
  max: number
  atMax: boolean
}

export function logCapacity(
  currency: Currency,
  capacity: RewardLogCapacity | undefined,
  config: RewardLogConfig | undefined,
): LogCapacity {
  const find = (list: KeyValue[] | undefined) =>
    Number(list?.find((e) => e.first === currency)?.second ?? 0)

  const unlocked = find(capacity?.unlocked_datarows)
  const step = Number(config?.order_increments ?? 10)
  const max = Number(config?.max_datarows ?? 1000)

  return {
    unlocked,
    used: Math.min(find(capacity?.used_datarows), unlocked),
    /* `unlockrows` charges `gems_per_datarow * rows / 10`. */
    price: Math.floor((Number(config?.gems_per_datarow ?? 0) * step) / 10),
    step,
    max,
    atMax: unlocked >= max,
  }
}

/**
 * How a list of tools can be ordered.
 *
 * All three are the contract's own figures: `tlm_mp` and `shrd_mp` are summed
 * separately across the bag, so a player building for Trilium and one
 * building for shards are ranking the same tools differently — and the sum is
 * what matters when neither is the priority.
 */
export const POWER_SORTS: { key: PowerSort; label: string }[] = [
  { key: 'combined', label: 'Combined' },
  { key: 'tlm_mp', label: 'TLM MP' },
  { key: 'shrd_mp', label: 'Shard MP' },
]

export type PowerSort = 'combined' | 'tlm_mp' | 'shrd_mp'

/** The figure a given sort ranks on. Absent power sorts last. */
export function powerScore(sort: PowerSort, p: Partial<MiningPower> | undefined): number {
  if (!p) return -1
  const tlm = Number(p.tlm_mp ?? 0)
  const shrd = Number(p.shrd_mp ?? 0)
  return sort === 'combined' ? tlm + shrd : sort === 'tlm_mp' ? tlm : shrd
}

/* ---------- cpu ---------- */

/**
 * When the weekly allowance rolls over.
 *
 * `get_end_of_week` lands on the midnight that ends Sunday — Monday 00:00
 * UTC — whatever day it is called on. A player with no `cpuusage` row yet has
 * nothing stored, so the next boundary is computed the same way the contract
 * would rather than left blank.
 */
export function nextCpuReset(storedExpiry: number | undefined, now = Date.now()): number {
  if (storedExpiry && storedExpiry > now) return storedExpiry

  const day = 86_400_000
  const days = Math.floor(now / day)
  /* The contract's own arithmetic: 1970-01-01 was a Thursday. */
  const dow = (days + 4) % 7
  const untilSunday = (7 - dow) % 7
  return days * day + untilSunday * day + day
}

/**
 * "2d 14h", "3h 12m", "8m" — how long until something.
 *
 * A bare date makes a reader do the subtraction; the useful question is
 * whether to spend the rest of the allowance now or wait.
 */
export function untilLabel(ms: number): string {
  if (ms <= 0) return 'now'
  const mins = Math.floor(ms / 60_000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

/** Microseconds of CPU as the wallet reads them: "12.4 ms", "1.2 s". */
export function formatCpuTime(micros: number): string {
  if (micros >= 1_000_000) return `${(micros / 1_000_000).toFixed(2)} s`
  if (micros >= 1000) return `${(micros / 1000).toFixed(1)} ms`
  return `${Math.round(micros)} µs`
}

/** Whether Legend access is still live — `maxpowerup` refuses without it. */
export function hasLegendAccess(expiry: string | undefined, now = Date.now()): boolean {
  if (!expiry) return false
  return Date.parse(expiry + 'Z') > now
}
