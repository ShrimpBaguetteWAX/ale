import type {
  FarmCard,
  FarmConfig,
  FarmPool,
  FarmUser,
  StakeWeight,
  StakedCard,
} from './types'

/**
 * How farming pays, taken from `farm.ale`.
 *
 * Three things about it decide everything the screen needs to say:
 *
 * 1. **It pays credits, not Trilium.** `claim` ends in `gaincur(wallet, 0,
 *    total_claim, …)` — the third argument — and books the result under the
 *    `alf_credits_claimed` stat. Calling it mining invites the wrong
 *    expectation.
 *
 * 2. **A claim takes a share of a shared pot.** Each schema has one
 *    `current_size` that every farmer draws from, so what a card earns
 *    depends on how full that pot is as much as on the card. Claiming
 *    *reduces* it for everyone.
 *
 * 3. **Power accumulates but is capped.** Power is `weight × days since your
 *    last claim`, capped at `max_power`. Past the cap, waiting earns nothing
 *    — the position is simply idle. That is the one thing a farmer needs the
 *    screen to warn them about, and it is invisible on the row.
 */

/** Rarity order, best last — the axis the weights are built on. */
export const RARITIES = ['Abundant', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical']

/**
 * The weight of one card.
 *
 * `stakeweight` is a list of (rarity, shine) pairs, and the transfer handler
 * rejects any card whose combination is missing — "Rarity & Shine combination
 * not supported". Returning zero for those is what lets the screen grey them
 * out instead of letting a player sign a transfer that aborts.
 */
export function weightOf(
  card: { rarity: string; shine: string },
  weights: StakeWeight[],
): number {
  const hit = weights.find(
    (w) =>
      w.rarity.toLowerCase() === (card.rarity ?? '').toLowerCase() &&
      w.shine.toLowerCase() === (card.shine ?? 'Stone').toLowerCase(),
  )
  return hit?.weight ?? 0
}

export function stakeable(card: FarmCard, weights: StakeWeight[]): boolean {
  return weightOf(card, weights) > 0
}

/* ---------- what a claim is worth ---------- */

export interface PoolStatus {
  schema: string
  /** The player's total weight in this pool. */
  weight: number
  cards: number
  /** Power banked since the last claim, already capped. */
  power: number
  /** How full the cap is, 0–100. */
  percent: number
  /** Credits a claim would pay from this pool right now. */
  estimate: number
  /** The shared pot this is a fraction of. */
  pool?: FarmPool
  /** Power is at the ceiling — waiting longer adds nothing. */
  maxed: boolean
  /** Milliseconds until the cap is reached; Infinity with no weight staked. */
  msToCap: number
}

/**
 * What one pool would pay if claimed now.
 *
 * The contract's own arithmetic, in the same order:
 *
 *     power = min(weight × daysSinceLastClaim, max_power)
 *     claim = pool.current_size × power / power_divider
 *
 * The pool's own hourly trickle is left out. It adds `value_per_hour` a day
 * against pots in the millions, so including it would add noise rather than
 * accuracy — and the contract computes its own figure regardless.
 */
export function poolStatus(
  schema: string,
  user: FarmUser | undefined,
  pools: FarmPool[],
  config: FarmConfig | undefined,
  staked: StakedCard[] = [],
  now = Date.now(),
): PoolStatus {
  /*
   * Weight comes from the user row, because that is literally what `claim`
   * multiplies by — but the card *count* is taken from the staked rows, which
   * are the cards themselves.
   *
   * The two disagree on chain. One wallet's row claims 110 cards across its
   * pools, 101 in total, while holding 90: `unstake` decrements the per-pool
   * counters and the total independently, so they drift. Trusting the counter
   * would put "54 staked" on a tab whose grid lists fewer.
   */
  const weight = Number(
    user?.pool_weights?.find((p) => p.first === schema)?.second ?? 0,
  )
  const cards = staked.filter((c) => c.schema === schema).length
  const pool = pools.find((p) => p.schema === schema)

  const maxPower = Number(config?.max_power ?? 0)
  const divider = Number(config?.power_divider ?? 1) || 1

  const lastClaim = Date.parse((user?.last_claim ?? '') + 'Z')
  const days = Number.isFinite(lastClaim) ? (now - lastClaim) / 86_400_000 : 0

  const raw = weight * Math.max(0, days)
  const power = Math.min(raw, maxPower)

  return {
    schema,
    weight,
    cards,
    power,
    percent: maxPower > 0 ? Math.min(100, (power / maxPower) * 100) : 0,
    estimate: Math.floor((pool?.current_size ?? 0) * (power / divider)),
    pool,
    maxed: maxPower > 0 && raw >= maxPower,
    msToCap:
      weight > 0 && maxPower > 0
        ? Math.max(0, (maxPower / weight) * 86_400_000 - (now - lastClaim))
        : Number.POSITIVE_INFINITY,
  }
}

/** Every pool's status, plus the total a claim would pay. */
export function farmBoard(
  schemas: readonly string[],
  user: FarmUser | undefined,
  pools: FarmPool[],
  config: FarmConfig | undefined,
  staked: StakedCard[] = [],
  now = Date.now(),
): { pools: PoolStatus[]; total: number; anyMaxed: boolean } {
  const list = schemas.map((s) => poolStatus(s, user, pools, config, staked, now))
  return {
    pools: list,
    total: list.reduce((sum, p) => sum + p.estimate, 0),
    anyMaxed: list.some((p) => p.maxed && p.weight > 0),
  }
}

/**
 * What the whole position is worth per day at full tilt.
 *
 * Not a projection of earnings — the cap makes that meaningless past a point
 * — but the rate at which power accrues, which is what a player compares when
 * deciding what to stake next.
 */
export function weightPerDay(user: FarmUser | undefined): number {
  return (user?.pool_weights ?? []).reduce((sum, p) => sum + Number(p.second ?? 0), 0)
}

/** "in 3 days", "in 5 hours", "reached" — how long the cap is away. */
export function formatToCap(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  if (ms <= 0) return 'reached'

  const hours = ms / 3_600_000
  if (hours < 48) return `in ${Math.max(1, Math.round(hours))} hours`
  return `in ${Math.round(hours / 24)} days`
}

/* ---------- sorting ---------- */

/** Heaviest first: the cards worth staking are the ones worth seeing first. */
export function byWeight(weights: StakeWeight[]) {
  return (a: FarmCard, b: FarmCard) =>
    weightOf(b, weights) - weightOf(a, weights) ||
    a.name.localeCompare(b.name) ||
    a.asset_id.localeCompare(b.asset_id)
}

export function stakedByWeight(a: StakedCard, b: StakedCard): number {
  return b.weight - a.weight || a.asset_id.localeCompare(b.asset_id)
}
