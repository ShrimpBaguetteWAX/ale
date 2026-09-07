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

  it('stops the moment the player figures move', async () => {
    /*
       What the waiting used to cost, and what it costs now.

       Six rounds regardless, whether the chain answered on the first or
       never — a payday that landed immediately still left every button on
       the screen dead for five more seconds. Here the balance moves on the
       first re-read, and the wait ends there.
    */
    let credits = 100
    useGame.setState({
      player: { activestats: { credits } } as never,
      refreshPlayer: async () => {
        credits += 25
        useGame.setState({ player: { activestats: { credits } } as never })
      },
    } as never)

    let reads = 0
    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run('pay', async () => {}, 'Paid.', {
        after: async () => {
          reads++
        },
        intervalMs: 0,
      })
    })

    expect(reads, 'one round, not six').toBe(1)
  })

  it('waits out the budget when nothing it can watch moves', async () => {
    /*
       Setting a marker spends nothing and gains nothing, so there is no
       figure to watch and no honest way to stop early. It costs what it
       always cost — the floor, not the common case.
    */
    useGame.setState({
      player: { activestats: { credits: 100 } } as never,
      refreshPlayer: async () => {},
    } as never)

    let reads = 0
    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run('mark', async () => {}, 'Marked.', {
        after: async () => {
          reads++
        },
        attempts: 4,
        intervalMs: 0,
      })
    })

    expect(reads).toBe(4)
  })

  it('does not blame the player for a read that failed after a good signature', async () => {
    /*
       The signature was accepted. A node that then fails to answer is not
       the player's problem and must not be reported as one — before this,
       a single failed re-read turned a successful action into an error
       banner and no notice at all.
    */
    useGame.setState({
      player: { activestats: { credits: 100 } } as never,
      refreshPlayer: async () => {},
    } as never)

    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run('claim', async () => {}, 'Claimed.', {
        after: async () => {
          throw new Error('HTTP 503')
        },
        attempts: 2,
        intervalMs: 0,
      })
    })

    expect(result.current.error).toBeNull()
    expect(result.current.notice).toBe('Claimed.')
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
