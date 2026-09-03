import { NUM_LOCALE } from '@/format'
import type { RewardPowerRow } from '@/chain/types'
import type { PoolDescription, ShardPool, TlmPool } from './queries'

/**
 * Reward Power, from `pools.cpp::claimpreward`.
 *
 * Playing the game banks power per pool rather than paying out directly.
 * Mining a pool spends that power and takes a slice of whatever the pool is
 * holding:
 *
 *     reward = pool_current * power_spent / 1,000,000
 *
 * One mine spends at most `MINE_POWER` (10,000), so a full mine is worth one
 * percent of the pool and no more — the pool is a shared balance draining
 * towards zero, and every other player is drawing on the same figure. That
 * makes the pool's size, not the power, the number that decides when to
 * mine: 10,000 power against a full pool pays many times what the same
 * 10,000 pays against a drained one.
 *
 * The contract also refuses to mine below a full 10,000 — except in the
 * leaderboard pools, which take whatever you have. The condition reads
 * `pool.find("lb") != npos == false`, which (both operators being equal
 * precedence, left to right) means "the name does not contain lb".
 */
export const MINE_POWER = 10_000

/** `reward = current * power / 1e6`. */
const POWER_DIVISOR = 1_000_000

/** Leaderboard pools have no minimum and spend whatever is banked. */
export function poolHasMinimum(pool: string): boolean {
  return !pool.includes('lb')
}

/* ---------- what a pool holds right now ---------- */

function assetAmount(asset: string, places: number): number {
  return Math.round(Number((asset ?? '0').split(' ')[0] ?? 0) * Math.pow(10, places))
}

function secondsSince(stamp: string, now: number): number {
  return Math.floor((now - Date.parse(stamp + 'Z')) / 1000)
}

/**
 * A shard pool's balance, projected forward.
 *
 * `updshardpool` runs before every payout, so the stored row is stale by
 * however long it has been since anyone last mined. Showing the stored figure
 * would quote a payout the chain will not honour.
 */
export function liveShardPool(pool: ShardPool, now = Date.now()): number {
  const secs = secondsSince(pool.last_current_update, now)
  if (secs <= 0) return Number(pool.shard_current ?? 0)
  return (
    Number(pool.shard_current ?? 0) +
    Math.floor((Number(pool.fillrate_per_hour ?? 0) * secs) / 3600)
  )
}

/**
 * A TLM pool's spendable balance, projected forward.
 *
 * `updtlmpool` moves reserve into current at `fillrate` per minute until
 * `fillrate_expiry`, then recomputes the rate day by day from what is left —
 * `reserve * fillrate_1d_percent / 1e6 / 1440` per minute for the next day —
 * until it catches up with now. Several live pools are days past expiry, so
 * skipping that loop would under-report them badly.
 *
 * The parent-pool claim is deliberately left out: it tops up `tlm_reserve`,
 * not `tlm_current`, so it cannot change this mine's payout.
 */
export function liveTlmPool(pool: TlmPool, now = Date.now()): number {
  let current = assetAmount(pool.tlm_current, 4)
  if (!pool.has_fillrate) return current

  let reserve = assetAmount(pool.tlm_reserve, 4)
  let rate = assetAmount(pool.fillrate, 4)
  let expiry = Date.parse(pool.fillrate_expiry + 'Z')
  let last = Date.parse(pool.last_current_update + 'Z')

  if (expiry > now) {
    const secs = Math.floor((now - last) / 1000)
    if (secs <= 0) return current
    const fill = Math.min(Math.floor((rate * secs) / 60), reserve)
    /* The contract ignores dust: anything at or under 100 (0.01 TLM) is not moved. */
    return fill > 100 ? current + fill : current
  }

  /* Expired: replay the day-by-day catch-up the contract would run. */
  let moved = 0
  let guard = 0
  while (expiry < now && reserve > 0 && guard++ < 400) {
    const secs = Math.floor((expiry - last) / 1000)
    if (secs <= 0) break

    const fill = Math.min(Math.floor((rate * secs) / 60), reserve)
    moved += fill
    reserve -= fill
    rate = Math.floor((reserve * Number(pool.fillrate_1d_percent ?? 0)) / 1e6 / 1440)

    last = expiry
    expiry += 86_400_000
  }

  current += moved
  return current
}

/* ---------- the board ---------- */

export interface PoolEntry {
  pool: string
  /** The game's own wording, from `pooldesc`. */
  label: string
  /** How Reward Power is earned here, for the standing pools. */
  how?: string
  /** `tlm` or `shards`. */
  type: string
  power: number
  /** Power one mine would spend. */
  spend: number
  /** 0–1 towards a full mine. */
  progress: number
  /** Full mines banked, which can exceed one. */
  mines: number
  ready: boolean
  /** The pool's live balance, in the token's smallest unit. */
  balance: number
  /** What mining now would pay, same units. */
  payout: number
  /** True when the pool has no minimum. */
  anyAmount: boolean
}

export function poolPayout(balance: number, power: number): number {
  return Math.min(Math.floor((balance * power) / POWER_DIVISOR), balance)
}

/**
 * The pools a player can mine directly, and how power is earned in each.
 *
 * There is no on-chain list of these: `claimpreward` will mine any pool the
 * player holds a `reward_power` row for, and those rows are written by the
 * game as it awards power. So the set is fixed here to match the game's own
 * screen — but it is a floor, not a filter. Any other pool the player turns
 * out to have power in is added to the board below, so nothing is hidden if
 * the game starts awarding power somewhere new.
 *
 * The wording is about *earning* the power, which is the question a player
 * has looking at an empty bar. `pooldesc` answers the other one — what a
 * payment was for — and is used in the ledger instead.
 */
export const MINEABLE_POOLS: { tlm: string; shards: string; label: string; how: string }[] = [
  {
    tlm: 'tlmdung',
    shards: 'shrddung',
    label: 'Dungeon Wins',
    how: 'Earn Reward Power by playing and winning in dungeons. How much you contribute depends on your equipped mining tools and your account status.',
  },
  {
    tlm: 'tlmarena',
    shards: 'shrdarena',
    label: 'Arena Wins',
    how: 'Earn Reward Power by playing and winning in the arena. How much you contribute depends on your equipped mining tools and your account status.',
  },
  {
    tlm: 'tlmarenadom',
    shards: 'shrdarenadom',
    label: 'Arena Domination',
    how: 'Earn Rewards by winning Arenas. Hold more Arenas to claim exponentially more often.',
  },
]

/**
 * The pools one currency tab should list.
 *
 * Shows the mineable pools whether or not the player has banked anything in
 * them yet — an empty bar is the answer to "where does this come from", and
 * driving the list purely from `reward_power` meant a new player saw nothing
 * at all.
 */
export function poolBoard(
  currency: string,
  player: { reward_power?: RewardPowerRow[] },
  tlmPools: TlmPool[],
  shardPools: ShardPool[],
  descriptions: PoolDescription[],
  now = Date.now(),
): PoolEntry[] {
  /*
     Only TLM and shards are mined. Reward power carries no `wax` type and
     the only WAX pool is the candle's, so the WAX tab has no board at all —
     the currency check used to be `=== 'shards' ? shards : tlm`, which
     handed the WAX tab the Trilium pools.
   */
  if (currency !== 'tlm' && currency !== 'shrds') return []
  const wanted = currency === 'shrds' ? 'shards' : 'tlm'
  const describe = (pool: string) =>
    MINEABLE_POOLS.find((m) => m.tlm === pool || m.shards === pool)
  const named = new Map(descriptions.map((d) => [d.pool_name, d.pool_description]))
  const tlm = new Map(tlmPools.map((p) => [p.pool, p]))
  const shards = new Map(shardPools.map((p) => [p.pool, p]))

  /* The player's banked power, by pool. */
  const banked = new Map<string, number>()
  for (const row of player.reward_power ?? []) {
    if (row.type === wanted) banked.set(row.pool, Math.max(0, Number(row.power ?? 0)))
  }

  /* The standing set first, then anything else the player has power in. */
  const order: string[] = []
  const seen = new Set<string>()
  for (const m of MINEABLE_POOLS) {
    const key = wanted === 'shards' ? m.shards : m.tlm
    order.push(key)
    seen.add(key)
  }
  for (const pool of banked.keys()) if (!seen.has(pool)) order.push(pool)

  const board: PoolEntry[] = []

  for (const pool of order) {
    const row = { pool, power: banked.get(pool) ?? 0 }

    const anyAmount = !poolHasMinimum(row.pool)
    const power = row.power

    const source = wanted === 'shards' ? shards.get(row.pool) : tlm.get(row.pool)
    if (!source) continue

    const balance =
      wanted === 'shards'
        ? liveShardPool(source as ShardPool, now)
        : liveTlmPool(source as TlmPool, now)

    const spend = Math.min(power, MINE_POWER)
    const ready = anyAmount ? power > 0 : power >= MINE_POWER

    board.push({
      pool: row.pool,
      label: describe(row.pool)?.label ?? named.get(row.pool) ?? row.pool,
      how: describe(row.pool)?.how,
      type: wanted,
      power,
      spend,
      /*
         A leaderboard pool has no threshold to fill towards, so measuring it
         against 10,000 would invent a wait that does not exist. It is either
         mineable or empty.
       */
      progress: anyAmount ? (power > 0 ? 1 : 0) : Math.min(1, power / MINE_POWER),
      mines: Math.floor(power / MINE_POWER),
      ready,
      balance,
      payout: poolPayout(balance, spend),
      anyAmount,
    })
  }

  /*
     Ready pools first so a claimable one is never buried, but otherwise the
     standing order is kept — these are three fixed places in the game, and
     reshuffling them as bars fill would make the panel hard to reread.
   */
  return board.sort((a, b) => (a.ready === b.ready ? 0 : a.ready ? -1 : 1))
}

/**
 * The share of reward power a trial player actually banks.
 *
 * `users::updrewardpwr` multiplies every addition by `trial_rewpow_mod` once
 * `legend_access_expiry` has passed. At the live value of 0.1 that is a tenth
 * of the power, which is worth saying on the screen where the bars fill.
 */
export function trialPenalty(
  legendExpiry: string | undefined,
  mod: number | string | undefined,
  now = Date.now(),
): number | null {
  if (!legendExpiry) return null
  if (Date.parse(legendExpiry + 'Z') > now) return null

  const value = Number(mod ?? 1)
  return value > 0 && value < 1 ? value : null
}

/**
 * A pool figure, in whole units.
 *
 * Pools are held in the token's smallest unit — TLM to four places, shards to
 * one, WAX to eight — and a raw conversion prints things like "1,418.0649",
 * where every digit after the point is noise against a number that size.
 * Anything under a whole unit is not worth a figure at all, so it says so
 * instead of showing a fraction of a Trilium.
 */
export function poolAmount(raw: number, places: number): string {
  const whole = Math.floor(raw / Math.pow(10, places))
  return whole < 1 ? '<1' : whole.toLocaleString(NUM_LOCALE)
}

/** `max_mine_power` in `pools.cpp`: one mine takes at most this much power. */
export const MAX_MINE_POWER = 10_000

/**
 * What mining a pool would actually pay, in the pool's own raw units.
 *
 * The contract is explicit about it and it has nothing to do with the
 * percentage on the bar:
 *
 *     mine_power_used = min(reward_power, max_mine_power)
 *     reward          = pool_current * mine_power_used / 1000000
 *
 * So a pool mined at full power pays one percent of whatever is standing in
 * it. Quoting the banked percentage instead — which is what the victory
 * screen did — answers a different question entirely, and the two only ever
 * agree by accident.
 *
 * `current` is the projected balance from `liveTlmPool` / `liveShardPool`,
 * because the contract runs `updtlmpool` / `updshardpool` before it pays and
 * a pool days past its fill expiry is badly under-reported without it.
 */
export function mineEstimate(power: number, current: number): number {
  const used = Math.min(Math.max(0, power), MAX_MINE_POWER)
  return Math.floor((current * used) / 1_000_000)
}
