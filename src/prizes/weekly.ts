import { CONTRACTS } from '@/chain/config'
import { fetchShardPools } from '@/pools/queries'

/**
 * The weekly prizes: what went into the reward pools in the last full week,
 * Monday 00:00 to Sunday 24:00 UTC.
 *
 *   * TLM — every `alien.worlds` transfer from `rewards.ale` to `pools.ale`.
 *     TLM that quests, arenas and the tournament also send there is not
 *     counted: it is the game moving its own money, not the week's prize.
 *   * WAX — every `eosio.token` WAX transfer that arrived at `pools.ale`.
 *   * Shards — not a token in the pools but a counter each pool fills at a
 *     fixed rate per hour (`fillrate_per_hour`, one decimal), so the week's
 *     new shards are those rates × 168 hours. Shards that come back from
 *     rerolled or expired quests are recycled escrow and are left out.
 *
 * A closed week never changes, so the figures are worked out once per
 * browser and kept, keyed by the week's Monday.
 */

export interface WeeklyPrizes {
  /** Monday 00:00 UTC of the week, in ms. */
  start: number
  /** The following Monday 00:00 UTC, in ms. */
  end: number
  tlm: number
  wax: number
  shards: number
}

const DAY = 86_400_000
const WEEK = 7 * DAY

/** The last full Monday-to-Sunday week (UTC) before `now`. */
export function lastWeek(now = Date.now()): { start: number; end: number } {
  const d = new Date(now)
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  /* getUTCDay: 0 is Sunday; days since this week's Monday. */
  const sinceMonday = (d.getUTCDay() + 6) % 7
  const end = today - sinceMonday * DAY
  return { start: end - WEEK, end }
}

/** "19–25 Oct", for the week starting at `start`. */
export function weekLabel(start: number): string {
  const a = new Date(start)
  const b = new Date(start + WEEK - DAY)
  const month = (d: Date) => d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${month(b)}`
    : `${a.getUTCDate()} ${month(a)} – ${b.getUTCDate()} ${month(b)}`
}

/*
 * History indexers that answered these queries reliably when this was
 * written. Each is tried in turn; one that fails is skipped for the rest of
 * the read. alcor hands out at most 100 rows a page.
 */
const HISTORY: { base: string; page: number }[] = [
  { base: 'https://wax.eosusa.io', page: 1000 },
  { base: 'https://api.waxsweden.org', page: 1000 },
  { base: 'https://wax-hyperion.alcor.exchange', page: 100 },
]

interface ActionRow {
  timestamp: string
  global_sequence: number
  act: { account: string; data: { from?: string; to?: string; amount?: number; quantity?: string; symbol?: string } }
  receipts?: { receiver: string }[]
}

/* History timestamps arrive without their zone. */
const timeOf = (s: string) => Date.parse(s.endsWith('Z') ? s : s + 'Z')

/**
 * Every matching action in [start, end), oldest first, paged by time.
 *
 * Paging restarts at the last row's timestamp rather than an offset, which
 * re-reads that block; `global_sequence` removes the repeats.
 */
async function actions(params: Record<string, string>, start: number, end: number): Promise<ActionRow[]> {
  let lastError: unknown
  for (const { base, page } of HISTORY) {
    try {
      const seen = new Set<number>()
      const out: ActionRow[] = []
      let cursor = start
      for (let n = 0; n < 60; n++) {
        const q = new URLSearchParams({
          ...params,
          after: new Date(cursor).toISOString(),
          before: new Date(end - 1).toISOString(),
          sort: 'asc',
          limit: String(page),
        })
        const res = await fetch(`${base}/v2/history/get_actions?${q}`, { signal: AbortSignal.timeout(10_000) })
        if (!res.ok) throw new Error(`${base} answered ${res.status}`)
        const rows = ((await res.json()) as { actions?: ActionRow[] }).actions ?? []
        let fresh = 0
        for (const r of rows) {
          if (seen.has(r.global_sequence)) continue
          seen.add(r.global_sequence)
          out.push(r)
          fresh++
        }
        if (rows.length < page || fresh === 0) break
        cursor = timeOf(rows[rows.length - 1].timestamp)
      }
      return out
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No history server answered')
}

/*
 * A transfer's amount, counted once per time it ran. The indexers fold
 * identical actions in one transaction into a single row; its receipts at
 * the token contract say how many there were.
 */
function amountOf(r: ActionRow, symbol: string): number {
  const d = r.act.data
  const [qty, sym] = (d.quantity ?? '').split(' ')
  if ((d.symbol ?? sym) !== symbol) return 0
  const each = typeof d.amount === 'number' ? d.amount : Number(qty) || 0
  const runs = r.receipts?.filter((x) => x.receiver === r.act.account).length || 1
  return each * runs
}

async function readWeek(start: number, end: number): Promise<WeeklyPrizes> {
  const [tlmRows, waxRows, shardPools] = await Promise.all([
    actions(
      {
        account: CONTRACTS.pools,
        filter: 'alien.worlds:transfer',
        'transfer.from': 'rewards.ale',
        'transfer.to': CONTRACTS.pools,
      },
      start,
      end,
    ),
    actions({ account: CONTRACTS.pools, filter: 'eosio.token:transfer', 'transfer.to': CONTRACTS.pools }, start, end),
    fetchShardPools(),
  ])
  const tlm = tlmRows
    .filter((r) => r.act.data.from === 'rewards.ale' && r.act.data.to === CONTRACTS.pools)
    .reduce((s, r) => s + amountOf(r, 'TLM'), 0)
  const wax = waxRows
    .filter((r) => r.act.data.to === CONTRACTS.pools && r.act.data.from !== CONTRACTS.pools)
    .reduce((s, r) => s + amountOf(r, 'WAX'), 0)
  const perHour = shardPools.reduce((s, p) => s + Number(p.fillrate_per_hour ?? 0), 0)
  return { start, end, tlm, wax, shards: (perHour * 168) / 10 }
}

const KEY = 'al:prizes:'
let pending: Promise<WeeklyPrizes> | null = null

/** Last week's prizes, from this browser's copy when it has one. */
export function fetchWeeklyPrizes(now = Date.now()): Promise<WeeklyPrizes> {
  const { start, end } = lastWeek(now)
  try {
    const kept = localStorage.getItem(KEY + start)
    if (kept) return Promise.resolve(JSON.parse(kept) as WeeklyPrizes)
  } catch {
    /* Storage off or full: read it fresh. */
  }
  if (pending) return pending
  pending = readWeek(start, end)
    .then((w) => {
      try {
        localStorage.setItem(KEY + start, JSON.stringify(w))
      } catch {
        /* Not kept; read again next visit. */
      }
      return w
    })
    .finally(() => {
      pending = null
    })
  return pending
}
