import { useCallback, useEffect, useRef, useState } from 'react'
import { onTableDrop, type TableKey } from './tables'
import { readableError } from '@/wharf/errors'

/**
 * Reading the chain from a component.
 *
 * Every screen had written the same twenty lines: a piece of state for the
 * data, one for the loading flag, one for the error, a ref to check the
 * component is still mounted, a `load` in a `useCallback`, and an effect to
 * call it. A hundred `useEffect`s across the routes, most of them this.
 *
 * What this deliberately does **not** do is as important as what it does.
 * There is no refetch on mount, none on window focus, none on an interval.
 * `chain/client` already has a TTL cache, in-flight deduplication and
 * failover across WAX nodes, and a hook that re-asks on its own schedule
 * would fight all three — the nodes answer an overloaded read with an empty
 * result rather than an error, so extra polling is not merely wasteful here,
 * it manufactures the one failure the rest of this work is built to avoid.
 *
 * A read happens when the query's identity changes, or when something the
 * query depends on is dropped. That is the whole trigger list.
 *
 * `deps` names tables in the same vocabulary an action uses to say what it
 * changed, so the two halves of invalidation are written in one language:
 * `payFighters` dirties `fighters`, and the roster depends on `fighters`.
 */

export interface ChainQuery<T> {
  data: T | undefined
  /** True until the first answer, and again whenever it is re-asked. */
  loading: boolean
  error: string | null
  /** Ask again now, past the cache. For a pull-to-refresh or a retry. */
  reload: () => Promise<void>
}

export interface QueryOptions {
  /**
   * Skip the read entirely — no wallet yet, or a screen that needs something
   * else first. `data` stays undefined and `loading` stays false, which is
   * "nothing to show and nothing on its way" rather than a spinner forever.
   */
  enabled?: boolean
  /** Tables that, when dropped, mean this answer is stale. */
  deps?: readonly TableKey[]
}

export function useChainQuery<T>(
  /**
   * What identifies this query. Changing it is what re-reads — so it must
   * include everything the read varies on, and nothing that changes every
   * render.
   */
  key: string | null,
  read: () => Promise<T>,
  { enabled = true, deps }: QueryOptions = {},
): ChainQuery<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /*
     The read, held in a ref rather than a dependency.

     A caller writes it inline — `() => fetchRoster(account)` — so it is a
     new function every render. As a dependency it would re-read on every
     render forever; the key is what says the query changed.
  */
  const latest = useRef(read)
  latest.current = read

  /*
     One read. There is no "forced" variant on purpose: a re-read after a
     drop is a cache miss already, and whether a manual reload should bypass
     the cache is the caller's `read` to decide — `fetchRoster(account, true)`
     says it plainly where a boolean threaded through here would not.
  */
  const run = useCallback(async () => {
    if (!key || !enabled) return
    setLoading(true)
    setError(null)
    try {
      const value = await latest.current()
      if (!alive.current) return
      setData(value)
    } catch (err) {
      if (alive.current) setError(readableError(err))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [key, enabled])

  useEffect(() => {
    void run()
  }, [run])

  /*
     Re-read when something this query is built on is dropped.

     Only while mounted, and only for the tables named — a claim on the
     rewards screen does not make the map's land rows stale, and a hook that
     woke every query on every action would be an interval by another name.
  */
  useEffect(() => {
    if (!deps?.length || !key || !enabled) return
    const watching = new Set(deps)
    return onTableDrop((dropped) => {
      if (watching.has(dropped)) void run()
    })
    /* `deps` is a literal at every call site, so its identity changes each
       render; its contents are what matter. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, key, enabled, deps?.join('|')])

  const reload = run

  return { data, loading, error, reload }
}
