/**
 * Reading the chain's action history from the public Hyperion indexers:
 * the weekly prizes (prizes/weekly.ts) and the Market's record of a
 * player's bids (market/myBids.ts).
 */

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

/** One action as the indexers return it; `D` is the action's data. */
export interface HistoryRow<D = Record<string, unknown>> {
  timestamp: string
  global_sequence: number
  act: { account: string; name?: string; data: D }
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
export async function historyActions<D = Record<string, unknown>>(
  params: Record<string, string>,
  start: number,
  end: number,
): Promise<HistoryRow<D>[]> {
  let lastError: unknown
  for (const { base, page } of HISTORY) {
    try {
      const seen = new Set<number>()
      const out: HistoryRow<D>[] = []
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
        const rows = ((await res.json()) as { actions?: HistoryRow<D>[] }).actions ?? []
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
