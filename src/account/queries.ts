import { CONTRACTS } from '@/chain/config'
import { getRow, getRows, post } from '@/chain/client'
import { cacheGet, cacheSet, TTL } from '@/chain/cache'
import { nameToUint64 } from '@/dungeon/queries'
import type { KeyValue } from '@/chain/types'

/** `cpu.ale` / `config` — the game's CPU allowance. */
export interface CpuConfig {
  index: number
  claims_per_week: number
  /** An asset string, e.g. "0.33000000 WAX". */
  wax_per_claim: string
}

/**
 * `cpu.ale` / `cpuusage` — one wallet's spend this period.
 *
 * Absent until the wallet has used the allowance at least once, which is the
 * same thing as "nothing used yet".
 */
export interface CpuUsage {
  wallet: string
  expiry_time: string
  uses: number
}

export function fetchCpuConfig(): Promise<CpuConfig | undefined> {
  return getRow<CpuConfig>(
    { code: CONTRACTS.cpu, scope: CONTRACTS.cpu, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

export function fetchCpuUsage(
  wallet: string,
  refresh = false,
): Promise<CpuUsage | undefined> {
  return getRow<CpuUsage>(
    { code: CONTRACTS.cpu, scope: CONTRACTS.cpu, table: 'cpuusage', key: wallet },
    { ttl: TTL.live, refresh },
  )
}

/**
 * `rwrdlog.ale` / `rewards`, scoped by wallet — the payouts the game has made
 * to this player.
 *
 * The rows carry a human `pool_description` ("Reward for beating a dungeon",
 * "Landowner Rewards"), which is the only place in the game that says where a
 * given payment came from.
 */
export interface RewardLogEntry {
  index: number
  /** `tlm`, `shrds`, `wax` or `credits`. */
  type: string
  timestamp: string
  /** An eosio asset string, e.g. "13.6764 TLM". */
  reward: string
  pool: string
  pool_description: string
}

/**
 * One currency's history, newest first.
 *
 * `rewards` carries a `bytypetime` index of `(type << 64) | timestamp`, so a
 * single currency reads as a bounded range instead of pulling a mixed page
 * and discarding most of it — which would also under-report a quiet currency
 * whose rows all sit behind a noisy one.
 */
export function fetchRewardLog(
  wallet: string,
  currency: string,
  limit = 100,
  refresh = false,
): Promise<RewardLogEntry[]> {
  const type = nameToUint64(currency)
  return getRows<RewardLogEntry>(
    {
      code: CONTRACTS.rewardLog,
      scope: wallet,
      table: 'rewards',
      index_position: 2,
      key_type: 'i128',
      lower_bound: (type << 64n).toString(),
      upper_bound: (((type + 1n) << 64n) - 1n).toString(),
      reverse: true,
      limit,
    },
    { ttl: TTL.short, refresh },
  ).then((r) => r.rows)
}

/**
 * `rwrdlog.ale` / `config` — what a history row costs.
 *
 * `unlockrows` charges `gems_per_datarow * rows / 10`, so one row costs a
 * tenth of `gems_per_datarow`, and an order has to be a whole multiple of
 * `order_increments`.
 */
export interface RewardLogConfig {
  index: number
  gems_per_datarow: number
  max_datarows: number
  accepted_types: string[]
  order_increments: number
}

export function fetchRewardLogConfig(): Promise<RewardLogConfig | undefined> {
  return getRow<RewardLogConfig>(
    { code: CONTRACTS.rewardLog, scope: CONTRACTS.rewardLog, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * `rwrdlog.ale` / `rwrdusers` — how much history this wallet has bought.
 *
 * This matters more than it looks. `addhistory` returns without writing
 * anything when a currency has no unlocked rows, so an empty tab means "never
 * bought the log for this token", not "never earned any". Once the rows are
 * full, the oldest is dropped to make room for the newest.
 */
export interface RewardLogCapacity {
  wallet: string
  unlocked_datarows: KeyValue[]
  used_datarows: KeyValue[]
  last_interaction: string
}

export function fetchRewardLogCapacity(
  wallet: string,
  refresh = false,
): Promise<RewardLogCapacity | undefined> {
  return getRow<RewardLogCapacity>(
    {
      code: CONTRACTS.rewardLog,
      scope: CONTRACTS.rewardLog,
      table: 'rwrdusers',
      key: wallet,
    },
    { ttl: TTL.live, refresh },
  )
}

/**
 * `get_account` — the wallet's own CPU, as the network sees it.
 *
 * Distinct from the game's weekly allowance: that counts how many *powerups*
 * the game will buy you, this is the resource those powerups top up. A player
 * out of CPU and a player out of claims have different problems, and until
 * both are on screen there is no way to tell which one you have.
 *
 * Figures are microseconds of execution time. `current_used` is the decayed
 * figure the chain bills against; `used` is the raw last-recorded value.
 */
export interface AccountCpu {
  used: number
  available: number
  max: number
  /** After decay since the last transaction — the one that matters. */
  current_used: number
}

export function fetchAccountCpu(
  wallet: string,
  refresh = false,
): Promise<AccountCpu | undefined> {
  const key = `accountcpu:${wallet}`
  if (!refresh) {
    const hit = cacheGet<AccountCpu>(key)
    if (hit) return Promise.resolve(hit)
  }

  return post<{ cpu_limit?: Partial<AccountCpu> }>('/v1/chain/get_account', {
    account_name: wallet,
  })
    .then((json) => {
      const raw = json.cpu_limit
      if (!raw) return undefined
      const cpu: AccountCpu = {
        used: Number(raw.used ?? 0),
        available: Number(raw.available ?? 0),
        max: Number(raw.max ?? 0),
        current_used: Number(raw.current_used ?? raw.used ?? 0),
      }
      /* Short-lived: it moves with every transaction the player makes. */
      cacheSet(key, cpu, TTL.live)
      return cpu
    })
    .catch(() => undefined)
}
