import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'
import tables from './fixtures/tables.json'

/**
 * The chain, answered from disk.
 *
 * `fetch` is stubbed rather than `chain/client`, so the real client still
 * runs — its failover order, its in-flight deduplication and its TTL cache
 * are part of what a route does and are worth exercising rather than
 * replacing.
 *
 * Config tables answer with what was recorded from mainnet; everything else
 * answers empty. That split is deliberate. A screen needs the config to draw
 * a fighter at all, so an empty answer there would leave every route sitting
 * on its loading gate and the test asserting nothing. Player-scoped reads are
 * the opposite case: a wallet that owns nothing is a real wallet, and a
 * screen that throws on one has a bug worth catching here.
 */

const EMPTY = { rows: [], more: false, next_key: '' }

interface TableQuery {
  code?: string
  table?: string
}

const recorded = tables as Record<string, unknown>

function answer(path: string, body: string): unknown {
  if (path.includes('get_table_rows')) {
    const q = JSON.parse(body) as TableQuery
    return recorded[`${q.code}/${q.table}`] ?? EMPTY
  }
  /* The node probe, which decides the failover order. Anything shaped like a
     chain info response will do — nothing asserts on it. */
  if (path.includes('get_info')) {
    return { chain_id: 'test', head_block_num: 1, head_block_time: '2026-01-01T00:00:00.000' }
  }
  /* AtomicAssets, for wallets and card art. Empty is a wallet with no NFTs. */
  return { data: [], success: true, rows: [], more: false }
}

/*
 * jsdom has no `matchMedia`, and the map asks it whether it is on a phone
 * before it draws a single tile. Answering "no" puts every screen in its
 * desktop layout, which is the one with more on it — the narrower one hides
 * work rather than adding it.
 */
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))

  /* Also absent from jsdom. The map watches its own container so the tiles
     re-scale when the window moves; nothing here ever resizes, so a stub
     that never fires is the honest answer rather than a poor imitation. */
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )

  /*
     jsdom loads no images, so it implements no `decode`. Both the map and
     the dungeon's loading gate await it — resolving immediately is the right
     stand-in: in a test there is nothing to wait for, and rejecting would
     exercise the error path on every single image rather than the normal one.
  */
  if (!HTMLImageElement.prototype.decode) {
    HTMLImageElement.prototype.decode = () => Promise.resolve()
  }

  /*
     Silenced rather than implemented. jsdom prints a paragraph to stderr
     every time something asks a canvas for a context, and a test run whose
     output is mostly noise is a test run nobody reads — the one line that
     matters has to be the one that stands out.
  */
  HTMLCanvasElement.prototype.getContext = () => null

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = String(init?.body ?? '{}')
      return {
        ok: true,
        status: 200,
        json: async () => answer(path, body),
        clone() {
          return this
        },
      } as unknown as Response
    }),
  )
})
