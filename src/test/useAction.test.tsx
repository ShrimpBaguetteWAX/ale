import { describe, expect, it, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGame } from '@/state/useGame'
import { useAction } from '@/wharf/useAction'
import { DIRTIES } from '@/wharf/actions'
import { cacheDropTable, onTableDrop } from '@/chain/tables'
import { onChoreRefresh } from '@/chores/signal'

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

  it('re-reads past the cache on every round, not just the first', async () => {
    /*
       The regression this test exists for, found in the game rather than
       here: a claimed quest stayed on the board under a message saying it
       had been claimed.

       The screen's re-read goes through the cache, and these rows are held
       for a minute. The first round is almost always "not yet" — so that
       answer became the answer every later round got, the wait could never
       end, and the board never changed. The loops this replaced all passed
       `refresh: true`; the hook has to do the equivalent itself.

       Here the read is served from a store that only changes when its cache
       entry has been dropped, which is exactly what the real client does.
    */
    useGame.setState({
      player: { activestats: { credits: 100 } } as never,
      refreshPlayer: async () => {},
    } as never)

    /*
       Through the real cache, not a stand-in for one. The drop is silent
       while the wait is going — that is the fix for the other half of this
       bug — so nothing outside the hook can observe it, and a fake cache
       here would only be testing the fake.
    */
    const { fetchActiveQuests } = await import('@/quests/queries')
    cacheDropTable('quests')

    let chainReads = 0
    const stub = globalThis.fetch as unknown as { mock: { calls: unknown[] } }
    globalThis.fetch = (async (url: string) => {
      if (!String(url).includes('get_table_rows')) {
        return { ok: true, status: 200, json: async () => ({}) }
      }
      chainReads++
      /* The chain catches up on the third read, and not before. */
      return {
        ok: true,
        status: 200,
        json: async () => ({
          rows: chainReads >= 3 ? [{ wallet: 'smoke.wam', quests: [] }] : [],
          more: false,
        }),
      }
    }) as never

    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run('claim', async () => {}, 'Claimed.', {
        after: () => fetchActiveQuests('smoke.wam'),
        settled: (board) => !!board,
        dirties: ['quests'],
        attempts: 6,
        intervalMs: 0,
      })
    })

    globalThis.fetch = stub as never

    /* Three reads means each round went to the chain. One would mean the
       first "not yet" had been served back for the rest of the wait. */
    expect(chainReads, 'every round should have gone past the cache').toBe(3)
  })

  it('tells the screens only once the chain has caught up', async () => {
    /*
       The other half of the same bug. Announced before the wait, a screen
       watching the table re-reads at once, gets the pre-transaction answer,
       and writes it back into the cache the confirmation is about to read.
    */
    useGame.setState({
      player: { activestats: { credits: 100 } } as never,
      refreshPlayer: async () => {},
    } as never)

    const heard: string[] = []
    const stop = onTableDrop((key) => heard.push(key))

    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run('claim', async () => {}, 'Claimed.', {
        after: async () => {
          /* Nothing has been announced yet, while the wait is still going. */
          expect(heard).toEqual([])
          return undefined
        },
        dirties: ['quests'],
        attempts: 1,
        intervalMs: 0,
      })
    })

    stop()
    expect(heard).toEqual(['quests'])
  })

  it('lights the dot the action belongs to, and no other', async () => {
    /*
       The dot used to be named beside the action that had already said what
       it dirtied — the same fact twice, and the pair drifted: Profile
       refreshed the CPU dot after a mine and left the Rewards dot, the one
       it had actually changed, to notice on its own timer.
    */
    useGame.setState({
      player: { activestats: { credits: 100 } } as never,
      refreshPlayer: async () => {},
    } as never)

    const lit: string[] = []
    const stop = onChoreRefresh((key) => lit.push(key))

    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run('mine', async () => {}, 'Mined.', {
        dirties: DIRTIES.mineRewardPool,
        attempts: 0,
      })
    })
    stop()

    /* `player` is dirtied by almost everything and lights nothing — a table
       with no dot is absent from the map rather than mapped to one. */
    expect(lit).toEqual(['rewards'])
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
