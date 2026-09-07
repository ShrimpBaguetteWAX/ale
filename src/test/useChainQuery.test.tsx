import { describe, expect, it, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useChainQuery } from '@/chain/useChainQuery'
import { cacheDropTable } from '@/chain/tables'

/**
 * Reading from a component, and — mostly — not reading.
 *
 * Half these tests assert that nothing happened. That is the point: the
 * hook's value is in how narrow its trigger list is, and a wrapper that
 * quietly re-asked on mount or on focus would undo the cache, the
 * deduplication and the failover underneath it in one line.
 */

let reads: number
beforeEach(() => {
  reads = 0
})

const counted = async () => `answer ${++reads}`

describe('useChainQuery', () => {
  it('reads once and hands back the answer', async () => {
    const { result } = renderHook(() => useChainQuery('k', counted))

    await waitFor(() => expect(result.current.data).toBe('answer 1'))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(reads).toBe(1)
  })

  it('does not read again when the component re-renders', async () => {
    /*
       The commonest way to write this hook wrong. The read is written inline
       at the call site, so it is a new function every render — as a
       dependency it would re-read forever.
    */
    const { result, rerender } = renderHook(() => useChainQuery('k', counted))
    await waitFor(() => expect(result.current.data).toBeDefined())

    rerender()
    rerender()
    rerender()

    expect(reads).toBe(1)
  })

  it('reads again when the query identity changes', async () => {
    const { result, rerender } = renderHook(({ k }) => useChainQuery(k, counted), {
      initialProps: { k: 'wallet-a' },
    })
    await waitFor(() => expect(result.current.data).toBe('answer 1'))

    rerender({ k: 'wallet-b' })
    await waitFor(() => expect(result.current.data).toBe('answer 2'))
    expect(reads).toBe(2)
  })

  it('does not read at all while disabled', async () => {
    /* No wallet yet is not a spinner — it is nothing to show and nothing on
       its way. */
    const { result } = renderHook(() =>
      useChainQuery('k', counted, { enabled: false }),
    )

    await new Promise((r) => setTimeout(r, 20))
    expect(reads).toBe(0)
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('does not read when the key is null', async () => {
    const { result } = renderHook(() => useChainQuery(null, counted))

    await new Promise((r) => setTimeout(r, 20))
    expect(reads).toBe(0)
    expect(result.current.data).toBeUndefined()
  })

  it('reads again when a table it depends on is dropped', async () => {
    const { result } = renderHook(() =>
      useChainQuery('roster', counted, { deps: ['fighters'] }),
    )
    await waitFor(() => expect(result.current.data).toBe('answer 1'))

    await act(async () => {
      cacheDropTable('fighters')
    })

    await waitFor(() => expect(result.current.data).toBe('answer 2'))
  })

  it('ignores a drop of a table it does not depend on', async () => {
    /*
       A claim on the rewards screen does not make the map's land rows
       stale. A hook that woke every query on every action would be an
       interval wearing a different name.
    */
    const { result } = renderHook(() =>
      useChainQuery('roster', counted, { deps: ['fighters'] }),
    )
    await waitFor(() => expect(result.current.data).toBe('answer 1'))

    await act(async () => {
      cacheDropTable('lands')
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(reads).toBe(1)
  })

  it('stops listening for drops once unmounted', async () => {
    const { result, unmount } = renderHook(() =>
      useChainQuery('roster', counted, { deps: ['fighters'] }),
    )
    await waitFor(() => expect(result.current.data).toBeDefined())

    unmount()
    await act(async () => {
      cacheDropTable('fighters')
    })

    expect(reads, 'a screen nobody is looking at should not be reading').toBe(1)
  })

  it('reports a failed read without losing the last good answer', async () => {
    let fail = false
    const { result } = renderHook(() =>
      useChainQuery('k', async () => {
        if (fail) throw new Error('HTTP 503')
        return 'good'
      }, { deps: ['fighters'] }),
    )
    await waitFor(() => expect(result.current.data).toBe('good'))

    fail = true
    await act(async () => {
      cacheDropTable('fighters')
    })

    await waitFor(() => expect(result.current.error).toBeTruthy())
    /* Still on screen. A failed refresh is a reason to say so, not a reason
       to blank the page the player was reading. */
    expect(result.current.data).toBe('good')
  })

  it('re-reads on demand', async () => {
    const { result } = renderHook(() => useChainQuery('k', counted))
    await waitFor(() => expect(result.current.data).toBe('answer 1'))

    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.data).toBe('answer 2')
  })
})
