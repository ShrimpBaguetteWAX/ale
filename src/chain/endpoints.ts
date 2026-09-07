import { CORS_SAFE_CONTENT_TYPE, RPC_ENDPOINTS } from './config'

export interface EndpointHealth {
  url: string
  /** Round-trip time of the probe, in ms. */
  latency: number
  /** How far the node's head block lagged behind real time, in seconds. */
  lag: number
  ok: boolean
  error?: string
}

export interface PoolStatus {
  state: 'idle' | 'probing' | 'ready' | 'offline'
  healthy: EndpointHealth[]
  all: EndpointHealth[]
  probedAt: number
}

/**
 * How long a node gets to answer the boot probe.
 *
 * Every candidate is probed at once and the run waits for all of them, so
 * this is what a reload costs before the first screen can draw — one dead
 * node used to hold the whole boot for four seconds. A node that cannot
 * answer `get_info` in a second is not one worth reading the game from
 * anyway: the pool has twelve, and reads rotate across the fastest four.
 */
const PROBE_TIMEOUT_MS = 1_000

/**
 * The second, patient pass, used only when the first found nothing.
 *
 * A second is a fair bar for choosing between nodes and a bad one for
 * deciding the chain is unreachable. On a phone on a poor connection twelve
 * cold TLS handshakes can all miss it, and an empty pool is not a slow game —
 * it is "No WAX node responded" and no game at all. So when the quick pass
 * comes back with nothing, the old deadline is given a turn before that is
 * believed. It costs time only in the case that used to be a dead end.
 */
const SLOW_PROBE_TIMEOUT_MS = 4_000
/** A node more than this far behind head is serving stale reads — skip it. */
const MAX_LAG_SECONDS = 120
/** Re-probe this often so a node that died mid-session gets dropped. */
const REPROBE_INTERVAL_MS = 10 * 60 * 1000
/** Requests rotate across the fastest N nodes rather than hammering one. */
const ROTATION_SIZE = 4
/** How long a node stays benched after it fails a real request. */
const PENALTY_MS = 60_000

type Listener = (status: PoolStatus) => void

/**
 * Keeps a live, ranked set of WAX nodes.
 *
 * The pool is probed once when the app boots, so every node we hand out has
 * been confirmed to answer within this session — never a hardcoded guess.
 * Reads then round-robin across the fastest few, which spreads load and means
 * one slow node can't stall the whole UI.
 */
export class EndpointPool {
  private candidates: string[]
  private health = new Map<string, EndpointHealth>()
  private ranked: string[] = []
  private cursor = 0
  private penalties = new Map<string, number>()
  private inflight: Promise<PoolStatus> | null = null
  private probedAt = 0
  private state: PoolStatus['state'] = 'idle'
  private listeners = new Set<Listener>()

  constructor(candidates: readonly string[] = RPC_ENDPOINTS) {
    this.candidates = [...candidates]
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.status())
    return () => this.listeners.delete(fn)
  }

  status(): PoolStatus {
    const all = this.candidates.map(
      (url) =>
        this.health.get(url) ?? { url, latency: Infinity, lag: Infinity, ok: false },
    )
    return {
      state: this.state,
      healthy: this.ranked.map((url) => this.health.get(url)!),
      all,
      probedAt: this.probedAt,
    }
  }

  private emit() {
    const s = this.status()
    for (const fn of this.listeners) fn(s)
  }

  /**
   * Probe every candidate in parallel and rank the survivors by latency.
   * Concurrent callers share one probe run.
   */
  probe(force = false): Promise<PoolStatus> {
    if (this.inflight) return this.inflight
    if (!force && this.probedAt && Date.now() - this.probedAt < REPROBE_INTERVAL_MS) {
      return Promise.resolve(this.status())
    }

    this.state = 'probing'
    this.emit()

    const usable = (results: EndpointHealth[]) =>
      results
        .filter((r) => r.ok && r.lag <= MAX_LAG_SECONDS)
        .sort((a, b) => a.latency - b.latency)
        .map((r) => r.url)

    this.inflight = this.sweep(PROBE_TIMEOUT_MS)
      .then(async (quick) => {
        /*
           Nothing at a second does not mean nothing. Only a sweep that found
           no usable node earns the patient deadline, so the common boot pays
           the fast one and nobody pays both unless the alternative was an
           offline screen.
        */
        if (usable(quick).length > 0) return quick
        return this.sweep(SLOW_PROBE_TIMEOUT_MS)
      })
      .then((results) => {
        for (const r of results) this.health.set(r.url, r)

        this.ranked = usable(results)

        this.cursor = 0
        this.penalties.clear()
        this.probedAt = Date.now()
        this.state = this.ranked.length > 0 ? 'ready' : 'offline'
        this.emit()
        return this.status()
      })
      .finally(() => {
        this.inflight = null
      })

    return this.inflight
  }

  /** One pass over every candidate, with a deadline they all share. */
  private sweep(timeoutMs: number): Promise<EndpointHealth[]> {
    return Promise.all(this.candidates.map((url) => this.probeOne(url, timeoutMs)))
  }

  private async probeOne(url: string, timeoutMs: number): Promise<EndpointHealth> {
    const started = performance.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${url}/v1/chain/get_info`, {
        method: 'POST',
        headers: { 'Content-Type': CORS_SAFE_CONTENT_TYPE },
        body: '{}',
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const info = await res.json()
      const latency = performance.now() - started

      // `head_block_time` has no timezone suffix but is always UTC.
      const head = Date.parse(`${info.head_block_time}Z`)
      const lag = Number.isFinite(head) ? (Date.now() - head) / 1000 : Infinity

      return { url, latency, lag, ok: true }
    } catch (err) {
      return {
        url,
        latency: Infinity,
        lag: Infinity,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      clearTimeout(timer)
    }
  }

  /** True once at least one node has answered this session. */
  get isReady(): boolean {
    return this.ranked.length > 0
  }

  /**
   * Next node to use, round-robining across the fastest few and skipping any
   * that recently failed a real request.
   */
  next(): string {
    if (this.ranked.length === 0) {
      // Probe hasn't finished (or everything is down) — fall back to the
      // static list so a read can still be attempted.
      return this.candidates[this.cursor++ % this.candidates.length]
    }

    const window = this.ranked.slice(0, Math.min(ROTATION_SIZE, this.ranked.length))
    const now = Date.now()

    for (let i = 0; i < window.length; i++) {
      const url = window[(this.cursor + i) % window.length]
      const until = this.penalties.get(url)
      if (until === undefined || until < now) {
        this.cursor = (this.cursor + i + 1) % window.length
        return url
      }
    }

    // Everything in the fast window is benched; reach past it.
    const spare = this.ranked.find((u) => (this.penalties.get(u) ?? 0) < now)
    return spare ?? window[0]
  }

  /**
   * Ordered failover list for a single request: the preferred node first,
   * then the rest by rank.
   */
  failoverOrder(limit = 3): string[] {
    const first = this.next()
    const rest = (this.ranked.length ? this.ranked : this.candidates).filter(
      (u) => u !== first,
    )
    return [first, ...rest].slice(0, limit)
  }

  /** Bench a node that just failed a real request. */
  penalize(url: string) {
    this.penalties.set(url, Date.now() + PENALTY_MS)
    const alive = this.ranked.some((u) => (this.penalties.get(u) ?? 0) < Date.now())
    if (!alive) void this.probe(true)
  }
}

export const endpointPool = new EndpointPool()
