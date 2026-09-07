import { describe, expect, it, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGame } from '@/state/useGame'
import { useAction } from '@/wharf/useAction'
import { DIRTIES } from '@/wharf/actions'
import { cacheDropTable } from '@/chain/tables'

/**
 * That signing something actually clears what it changed.
 *
 * The screen that acts was always re-reading past the cache, so its own view
 * was never the problem. Every *other* screen was: ascend a fighter and the
 * market went on serving the roster it read before, for as long as its TTL
 * had left. `cacheDrop` had been in the codebase from the start and was
 * called from nowhere.
 *
 * Nothing here signs anything — `act` is an ordinary promise. What is under
 * test is the bookkeeping around it.
 */

const fetchCalls = () =>
  (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length

beforeEach(() => {
  /* A truthy session, because `run` refuses without one. It is never used:
     the action under test is a local function, not a transaction. */
  useGame.setState({
    account: 'smoke.wam',
    session: {} as never,
    refreshPlayer: async () => {},
  } as never)
  cacheDropTable('player')
  cacheDropTable('fighters')
})

describe('useAction', () => {
  it('drops the tables the action declared', async () => {
    const { fetchPlayer } = await import('@/chain/queries')

    await fetchPlayer('smoke.wam')
    const seeded = fetchCalls()
    await fetchPlayer('smoke.wam')
    expect(fetchCalls(), 'the read should have been cached').toBe(seeded)

    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run('pay', async () => {}, 'Paid.', {
        /* Attempts zero: the waiting loop is not what this is testing, and
           six real timers would make the file slow for nothing. */
        attempts: 0,
        dirties: DIRTIES.payFighters,
      })
    })

    await fetchPlayer('smoke.wam')
    expect(fetchCalls(), 'the read after the action should have gone to the chain')
      .toBeGreaterThan(seeded)
  })

  it('leaves tables the action did not declare', async () => {
    const { fetchPlayer } = await import('@/chain/queries')

    await fetchPlayer('smoke.wam')
    const seeded = fetchCalls()

    const { result } = renderHook(() => useAction())
    await act(async () => {
      /* Marking a fighter touches the fighter row and nothing else — the
         player's balances are untouched, so the player row stays cached. */
      await result.current.run('mark', async () => {}, 'Marked.', {
        attempts: 0,
        dirties: DIRTIES.setFighterMarker,
      })
    })

    await fetchPlayer('smoke.wam')
    expect(fetchCalls(), 'the player row was not dirtied and should still be cached')
      .toBe(seeded)
  })

  it('drops nothing when the action declares nothing', async () => {
    const { fetchPlayer } = await import('@/chain/queries')

    await fetchPlayer('smoke.wam')
    const seeded = fetchCalls()

    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run('x', async () => {}, 'Done.', { attempts: 0 })
    })

    await fetchPlayer('smoke.wam')
    expect(fetchCalls()).toBe(seeded)
  })

  it('does not drop when the action failed', async () => {
    const { fetchPlayer } = await import('@/chain/queries')

    await fetchPlayer('smoke.wam')
    const seeded = fetchCalls()

    const { result } = renderHook(() => useAction())
    await act(async () => {
      /*
         A refused signature changed nothing on chain, so nothing it might
         have changed is stale. Dropping anyway would turn every cancelled
         wallet dialog into a round of re-reads.
      */
      await result.current.run(
        'fails',
        async () => {
          throw new Error('user cancelled')
        },
        'Never shown.',
        { attempts: 0, dirties: DIRTIES.payFighters },
      )
    })

    expect(result.current.error).toBeTruthy()
    await fetchPlayer('smoke.wam')
    expect(fetchCalls(), 'a failed action should leave the cache alone').toBe(seeded)
  })

  it('reports the failure and puts the button back', async () => {
    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run(
        'fails',
        async () => {
          throw new Error('nope')
        },
        'Never shown.',
        { attempts: 0 },
      )
    })

    expect(result.current.busy).toBeNull()
    expect(result.current.notice).toBeNull()
    expect(result.current.error).toBeTruthy()
  })
})
