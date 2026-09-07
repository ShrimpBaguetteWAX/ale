import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { EndpointPool } from '@/chain/endpoints'

/**
 * What a reload waits for before the first screen can draw.
 *
 * Every candidate is probed at once and the run waits for all of them, so the
 * slowest node sets the cost of boot. At a four-second deadline one dead node
 * held the whole thing for four seconds; a second is a fairer bar for
 * choosing between twelve nodes.
 *
 * The bar cannot also be the test for whether the chain exists, though. On a
 * poor connection every node can miss a second, and an empty pool is not a
 * slow game — it is the offline screen. So a sweep that finds nothing gets a
 * patient second pass, and these pin both halves.
 */

const FAST = 'https://fast.test'
const SLOW = 'https://slow.test'
const DEAD = 'https://dead.test'

/** How long each host takes to answer; `Infinity` never does. */
let delays: Record<string, number>

beforeEach(() => {
  vi.useFakeTimers()
  delays = { [FAST]: 50, [SLOW]: 2_000, [DEAD]: Infinity }

  globalThis.fetch = ((url: string, init: RequestInit) =>
    new Promise((resolve, reject) => {
      const host = new URL(String(url)).origin
      const ms = delays[host] ?? 50
      const timer =
        ms === Infinity
          ? undefined
          : setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  /* Head block at "now", so the node reads as caught up. */
                  json: async () => ({
                    head_block_time: new Date().toISOString().replace('Z', ''),
                  }),
                } as Response),
              ms,
            )
      init.signal?.addEventListener('abort', () => {
        if (timer) clearTimeout(timer)
        reject(new Error('aborted'))
      })
    })) as never
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the boot probe', () => {
  it('settles within the second, rather than waiting out the dead node', async () => {
    /*
       The reason for the change. `Promise.all` waits for every candidate, so
       one host that never answers used to cost the full four seconds on
       every reload.
    */
    const pool = new EndpointPool([FAST, DEAD])
    const run = pool.probe()

    await vi.advanceTimersByTimeAsync(1_000)
    const status = await run

    expect(status.state).toBe('ready')
    expect(status.healthy.map((h) => h.url)).toEqual([FAST])
  })

  it('drops a node that answers too late to be worth reading from', async () => {
    const pool = new EndpointPool([FAST, SLOW])
    const run = pool.probe()

    await vi.advanceTimersByTimeAsync(1_000)
    const status = await run

    expect(status.healthy.map((h) => h.url)).toEqual([FAST])
    expect(status.all.find((h) => h.url === SLOW)?.ok).toBe(false)
  })

  it('gives everything a patient second pass when the quick one found nothing', async () => {
    /*
       The safety net. Every node is slower than a second but well inside the
       old deadline — which is what a phone on a bad connection looks like.
       Before this it would have been the offline screen.
    */
    const pool = new EndpointPool([SLOW])
    const run = pool.probe()

    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 10)
    const status = await run

    expect(status.state).toBe('ready')
    expect(status.healthy.map((h) => h.url)).toEqual([SLOW])
  })

  it('still calls it offline when nothing answers at all', async () => {
    const pool = new EndpointPool([DEAD])
    const run = pool.probe()

    await vi.advanceTimersByTimeAsync(1_000 + 4_000 + 10)
    const status = await run

    expect(status.state).toBe('offline')
    expect(status.healthy).toEqual([])
  })

  it('does not spend the patient pass when even one node answered', async () => {
    /*
       The quick pass is the one a healthy boot pays. If a single node comes
       back in time the run is over, whatever the others are doing.
    */
    const pool = new EndpointPool([FAST, SLOW, DEAD])
    const run = pool.probe()

    await vi.advanceTimersByTimeAsync(1_000)
    const status = await run

    expect(status.state).toBe('ready')
    expect(status.healthy.map((h) => h.url)).toEqual([FAST])
  })

  it('ranks the survivors fastest first', async () => {
    const QUICK = 'https://quick.test'
    delays[QUICK] = 10
    const pool = new EndpointPool([FAST, QUICK])
    const run = pool.probe()

    await vi.advanceTimersByTimeAsync(1_000)
    const status = await run

    expect(status.healthy.map((h) => h.url)).toEqual([QUICK, FAST])
  })
})
