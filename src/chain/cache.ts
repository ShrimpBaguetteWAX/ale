/**
 * Two-tier read cache: an in-memory map for the session, plus an optional
 * localStorage tier for data that is expensive to fetch and rarely changes
 * (the land grid, game config, avatar definitions).
 *
 * The point is to keep chain reads off the wire. A cold load of the map is
 * ~1 request per planet; every later visit is served from memory.
 */

const STORE_PREFIX = 'al:cache:'
/** Bump to invalidate every persisted entry after a shape change. */
const SCHEMA_VERSION = 1

interface Entry<T> {
  v: number
  /** Epoch ms when this was written. */
  t: number
  /** Time-to-live in ms. */
  ttl: number
  d: T
}

const memory = new Map<string, Entry<unknown>>()

function storageAvailable(): boolean {
  try {
    const k = `${STORE_PREFIX}__probe`
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

const canPersist = typeof window !== 'undefined' && storageAvailable()

function fresh<T>(e: Entry<T> | undefined): e is Entry<T> {
  return !!e && e.v === SCHEMA_VERSION && Date.now() - e.t < e.ttl
}

export function cacheGet<T>(key: string, persist = false): T | undefined {
  const hit = memory.get(key) as Entry<T> | undefined
  if (fresh(hit)) return hit.d

  if (persist && canPersist) {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + key)
      if (raw) {
        const e = JSON.parse(raw) as Entry<T>
        if (fresh(e)) {
          memory.set(key, e)
          return e.d
        }
        localStorage.removeItem(STORE_PREFIX + key)
      }
    } catch {
      // Corrupt or unreadable entry — treat as a miss.
    }
  }
  return undefined
}

export function cacheSet<T>(key: string, data: T, ttl: number, persist = false): void {
  const entry: Entry<T> = { v: SCHEMA_VERSION, t: Date.now(), ttl, d: data }
  memory.set(key, entry)

  if (persist && canPersist) {
    try {
      localStorage.setItem(STORE_PREFIX + key, JSON.stringify(entry))
    } catch {
      // Quota exceeded: drop the oldest persisted entries and give up quietly.
      evictPersisted()
    }
  }
}

export function cacheDrop(prefix: string): void {
  for (const k of [...memory.keys()]) {
    if (k.startsWith(prefix)) memory.delete(k)
  }
  if (!canPersist) return
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k?.startsWith(STORE_PREFIX + prefix)) localStorage.removeItem(k)
  }
}

function evictPersisted(): void {
  if (!canPersist) return
  const keys: { k: string; t: number }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(STORE_PREFIX)) continue
    try {
      keys.push({ k, t: (JSON.parse(localStorage.getItem(k)!) as Entry<unknown>).t })
    } catch {
      localStorage.removeItem(k)
    }
  }
  keys.sort((a, b) => a.t - b.t)
  for (const { k } of keys.slice(0, Math.ceil(keys.length / 2))) {
    localStorage.removeItem(k)
  }
}

/** Common TTLs, in ms. */
export const TTL = {
  /** Player-owned state that changes on every action. */
  live: 15_000,
  /** Balances, pools — a little staleness is fine. */
  short: 60_000,
  /** Land grid: buildings change, but slowly. */
  medium: 10 * 60_000,
  /** Game config, avatars, building costs — effectively static. */
  long: 12 * 60 * 60_000,
} as const
