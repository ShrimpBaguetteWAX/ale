import { CORS_SAFE_CONTENT_TYPE } from './config'
import { endpointPool } from './endpoints'
import { cacheGet, cacheSet, TTL } from './cache'

export interface TableQuery {
  code: string
  scope: string
  table: string
  lower_bound?: string | number
  upper_bound?: string | number
  limit?: number
  index_position?: number
  key_type?: string
  reverse?: boolean
}

export interface ReadOptions {
  /** Cache lifetime in ms. Pass 0 to always hit the chain. */
  ttl?: number
  /** Also keep the result in localStorage across reloads. */
  persist?: boolean
  /** Skip the cache for this call but still write the fresh result. */
  refresh?: boolean
  /**
   * Milliseconds to wait between pages of a `getAllRows` crawl.
   *
   * A table that fits in one page never notices this. One that does not would
   * otherwise fire its requests back to back as fast as the node answers,
   * which is the shape of traffic that gets a client rate limited. Reads
   * behind a loading state can afford to be polite.
   */
  pageDelayMs?: number
  signal?: AbortSignal
}

export interface TableResponse<T> {
  rows: T[]
  more: boolean
  next_key: string
}

/** Identical concurrent reads share one network request. */
const inflight = new Map<string, Promise<unknown>>()

function keyOf(q: TableQuery): string {
  return [
    q.code,
    q.scope,
    q.table,
    q.lower_bound ?? '',
    q.upper_bound ?? '',
    q.limit ?? '',
    q.index_position ?? '',
    q.key_type ?? '',
    q.reverse ? 'r' : '',
  ].join('|')
}

export class ChainError extends Error {
  constructor(
    message: string,
    readonly attempts: { url: string; error: string }[] = [],
  ) {
    super(message)
    this.name = 'ChainError'
  }
}

const REQUEST_TIMEOUT_MS = 8_000

/**
 * POST to a chain endpoint, walking the pool's failover list until one
 * answers. A node that errors or times out is benched so later requests in
 * this session skip it.
 */
export async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const urls = endpointPool.failoverOrder(3)
  const attempts: { url: string; error: string }[] = []

  for (const url of urls) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort)

    try {
      const res = await fetch(url + path, {
        method: 'POST',
        headers: { 'Content-Type': CORS_SAFE_CONTENT_TYPE },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as T
    } catch (err) {
      if (signal?.aborted) throw err
      const message = err instanceof Error ? err.message : String(err)
      attempts.push({ url, error: message })
      endpointPool.penalize(url)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  throw new ChainError(
    `All ${urls.length} endpoints failed for ${path}`,
    attempts,
  )
}

/** One page of a table. */
export async function getRows<T>(
  query: TableQuery,
  opts: ReadOptions = {},
): Promise<TableResponse<T>> {
  const { ttl = TTL.short, persist = false, refresh = false, signal } = opts
  const key = `rows:${keyOf(query)}`

  if (!refresh && ttl > 0) {
    const hit = cacheGet<TableResponse<T>>(key, persist)
    if (hit) return hit
  }

  /*
   * Refreshing reads coalesce only with each other. Sharing the key with
   * ordinary reads would let a forced refresh piggyback on a request that was
   * already in flight before the change it is trying to observe — which is
   * exactly when the caller most needs a genuinely new read.
   */
  const flightKey = refresh ? key + '!fresh' : key
  const existing = inflight.get(flightKey)
  if (existing) return existing as Promise<TableResponse<T>>

  const request = post<TableResponse<T>>(
    '/v1/chain/get_table_rows',
    { json: true, limit: 100, ...query },
    signal,
  )
    .then((res) => {
      if (ttl > 0) cacheSet(key, res, ttl, persist)
      return res
    })
    .finally(() => {
      inflight.delete(flightKey)
    })

  inflight.set(flightKey, request)
  return request
}

/**
 * Every row of a table, following `next_key` until the chain says it's done.
 *
 * Used for the land grid — 861 rows per planet come back in a single page at
 * `limit: 1000`, so a whole planet costs one request.
 */
export async function getAllRows<T>(
  query: TableQuery,
  opts: ReadOptions = {},
): Promise<T[]> {
  const { ttl = TTL.short, persist = false, refresh = false, pageDelayMs = 0, signal } = opts
  const key = `all:${keyOf({ ...query, lower_bound: undefined, limit: undefined })}`

  if (!refresh && ttl > 0) {
    const hit = cacheGet<T[]>(key, persist)
    if (hit) return hit
  }

  const flightKey = refresh ? key + '!fresh' : key
  const existing = inflight.get(flightKey)
  if (existing) return existing as Promise<T[]>

  const request = (async () => {
    const out: T[] = []
    let lower = query.lower_bound
    // Guard against a malformed `next_key` looping forever.
    for (let page = 0; page < 25; page++) {
      const res = await post<TableResponse<T>>(
        '/v1/chain/get_table_rows',
        { json: true, limit: 1000, ...query, lower_bound: lower },
        signal,
      )
      out.push(...res.rows)
      if (!res.more || !res.next_key) break
      lower = res.next_key
      if (pageDelayMs > 0) {
        await new Promise((r) => setTimeout(r, pageDelayMs))
      }
    }
    if (ttl > 0) cacheSet(key, out, ttl, persist)
    return out
  })().finally(() => {
    inflight.delete(flightKey)
  })

  inflight.set(flightKey, request)
  return request
}

/** A single row by primary key, or undefined. */
export async function getRow<T>(
  query: Omit<TableQuery, 'lower_bound' | 'upper_bound' | 'limit'> & {
    key: string | number
  },
  opts: ReadOptions = {},
): Promise<T | undefined> {
  const { key, ...rest } = query
  const res = await getRows<T>(
    { ...rest, lower_bound: key, upper_bound: key, limit: 1 },
    opts,
  )
  return res.rows[0]
}

/** Token balance, e.g. `getBalance('players.ale', 'eosio.token', 'WAX')`. */
export async function getBalance(
  account: string,
  code: string,
  symbol: string,
  opts: ReadOptions = {},
): Promise<string | undefined> {
  const res = await post<string[]>('/v1/chain/get_currency_balance', {
    code,
    account,
    symbol,
  }, opts.signal)
  return res[0]
}
