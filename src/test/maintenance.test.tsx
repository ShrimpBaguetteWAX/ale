import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MaintenanceGate } from '@/App'
import { Maintenance } from '@/routes/Maintenance'
import { useMaintenance } from '@/state/useMaintenance'

/**
 * The screen that stands in for the game while it is paused.
 *
 * `admin.ale/pausegame` stops every contract at once and posts a notice;
 * `newmessage` appends more as the work goes on. Nothing in the app read that
 * row — `fetchPauseState` pointed at `players.ale/pause`, which carries the
 * flag and none of the messages, and had no callers.
 *
 * Two halves are worth pinning. The screen: that a feed of notices reads
 * newest-first and that a lone notice is not decorated as if it were the
 * latest of several. And the watcher: above all that it does not mistake a
 * node failure for a pause, which would put a working game behind this.
 */

const row = vi.hoisted(() => ({
  value: undefined as unknown,
  fail: false,
  reads: 0,
}))

/*
   Only this one read is replaced. Importing the gate from `App` drags in
   `useConfig`, which names a dozen other fetchers from this module — a whole
   module mock leaves those undefined and the import fails before a single
   test runs.
*/
vi.mock('@/chain/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/chain/queries')>()),
  fetchMaintenance: async () => {
    row.reads++
    if (row.fail) throw new Error('node unreachable')
    return row.value
  },
}))

/* The canvas the logo animates on does not exist in jsdom. */
vi.mock('@/components/GameLogo', () => ({ GameLogo: () => <div /> }))
vi.mock('@/components/NetworkStatus', () => ({ NetworkStatus: () => <div /> }))

beforeEach(() => {
  row.value = undefined
  row.fail = false
  row.reads = 0
})

describe('the maintenance screen', () => {
  it('puts the newest notice first', () => {
    /* The contract appends, so the row arrives oldest-first — and the thing a
       player who has been waiting needs is the last thing posted. */
    render(<Maintenance updates={['we are starting', 'halfway', 'almost done']} />)

    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items[0]).toContain('almost done')
    expect(items[2]).toContain('we are starting')
  })

  it('marks the newest, but only when there is more than one', () => {
    const many = render(<Maintenance updates={['first', 'second']} />)
    expect(screen.getByText('Latest')).toBeTruthy()
    many.unmount()

    /*
       The usual outage is a single sentence posted by `pausegame` and never
       added to. Labelling the only thing on the screen "Latest" says nothing.
    */
    render(<Maintenance updates={['the one and only notice']} />)
    expect(screen.queryByText('Latest')).toBeNull()
  })

  it('shows no feed at all when nothing has been posted', () => {
    /* `pausegame` takes a message, but the row can be paused with an empty
       list — the heading and the lead have to carry it alone. */
    render(<Maintenance updates={[]} />)

    expect(screen.queryByText('Updates')).toBeNull()
    expect(screen.getByText(/The game is paused/)).toBeTruthy()
  })
})

describe('useMaintenance', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** Mount the hook and report what it says. */
  function watch() {
    const seen: { paused: boolean | undefined; updates: string[] }[] = []
    function Probe() {
      seen.push(useMaintenance())
      return null
    }
    const view = render(<Probe />)
    return { seen, view, last: () => seen[seen.length - 1] }
  }

  it('is undefined before the first read, not false', () => {
    /*
       The gate renders the game while this is undefined. "Not yet known" and
       "not paused" have to be distinguishable, or the screen would flash on
       every boot.
    */
    row.value = { index: 0, game_paused: 1, maintenance_updates: ['down'] }
    const { seen } = watch()

    expect(seen[0].paused).toBeUndefined()
  })

  it('reports a pause, with its notices', async () => {
    row.value = { index: 0, game_paused: 1, maintenance_updates: ['down for work'] }
    const { last } = watch()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(last().paused).toBe(true)
    expect(last().updates).toEqual(['down for work'])
  })

  it('does not call a node failure a pause', async () => {
    /*
       The one that matters. Every read goes through the same endpoint pool
       the rest of the app uses, and it does fail — so a throw here must leave
       the last known state standing rather than blacking out a working game.
    */
    row.value = { index: 0, game_paused: 0, maintenance_updates: [] }
    const { last } = watch()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(last().paused).toBe(false)

    row.fail = true
    await act(async () => {
      /* Past the running cadence, so the next read is attempted and throws. */
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 10)
    })

    expect(row.reads).toBeGreaterThan(1)
    expect(last().paused).toBe(false)
  })

  it('treats a missing row as running', async () => {
    /* No row at all is the state before an admin has ever paused. */
    row.value = undefined
    const { last } = watch()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(last().paused).toBe(false)
  })

  it('polls faster while paused than while running', async () => {
    /*
       The rates are the whole cost argument: a flag that is false all year is
       not worth a request a minute, and a player stuck on the screen watching
       for the next notice is.
    */
    row.value = { index: 0, game_paused: 1, maintenance_updates: [] }
    watch()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    const afterFirst = row.reads

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    /* A minute at the paused cadence is three reads; at the running one, none. */
    expect(row.reads - afterFirst).toBeGreaterThanOrEqual(2)
  })

  it('swaps the whole app out, and only once it knows', async () => {
    /*
       The wiring, not just the pieces. The gate sits above the wallet gate —
       a paused game must not first insist you connect a wallet before it will
       admit it is down — and it renders the app untouched until the answer is
       in, so a slow node never blacks out a game that is running.
    */
    row.value = { index: 0, game_paused: 1, maintenance_updates: ['down for work'] }
    render(
      <MaintenanceGate>
        <p>the game</p>
      </MaintenanceGate>,
    )

    /* Before the read lands: the game, not a spinner and not the screen. */
    expect(screen.getByText('the game')).toBeTruthy()
    expect(screen.queryByText(/The game is paused/)).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.queryByText('the game')).toBeNull()
    expect(screen.getByText(/The game is paused/)).toBeTruthy()
    expect(screen.getByText('down for work')).toBeTruthy()
  })

  it('leaves a running game alone', async () => {
    row.value = { index: 0, game_paused: 0, maintenance_updates: ['an old notice'] }
    render(
      <MaintenanceGate>
        <p>the game</p>
      </MaintenanceGate>,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    /* Notices outlive the pause that posted them — `unpause` does not clear
       the list — so the flag alone decides, never the presence of messages. */
    expect(screen.getByText('the game')).toBeTruthy()
    expect(screen.queryByText(/The game is paused/)).toBeNull()
  })

  it('stops reading once unmounted', async () => {
    row.value = { index: 0, game_paused: 1, maintenance_updates: [] }
    const { view } = watch()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    view.unmount()
    const atUnmount = row.reads
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000)
    })

    expect(row.reads).toBe(atUnmount)
  })
})
