import { ATOMIC_ENDPOINTS } from './config'
import { cacheDrop, cacheGet, cacheSet, TTL } from './cache'

/**
 * AtomicAssets client.
 *
 * Land is an `alien.worlds` NFT, so the landowner — and therefore the owner of
 * anything built on that land — lives in AtomicAssets rather than in the game
 * contracts. This is a smaller sibling of `chain/client.ts`: the same rotation
 * and failover idea, but plain GETs, so there is no preflight to avoid and no
 * body to build.
 */

const REQUEST_TIMEOUT_MS = 8_000
/** How long a node stays benched after failing a request. */
const PENALTY_MS = 60_000

const penalties = new Map<string, number>()
let cursor = 0

function endpointsInOrder(): string[] {
  const now = Date.now()
  const healthy = ATOMIC_ENDPOINTS.filter((u) => (penalties.get(u) ?? 0) < now)
  const pool = healthy.length ? healthy : [...ATOMIC_ENDPOINTS]
  const start = cursor++ % pool.length
  return [...pool.slice(start), ...pool.slice(0, start)]
}

async function getFrom<T>(base: string, path: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(base + path, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    penalties.set(base, Date.now() + PENALTY_MS)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function get<T>(path: string): Promise<T> {
  const errors: string[] = []

  for (const base of endpointsInOrder().slice(0, 3)) {
    try {
      return await getFrom<T>(base, path)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  throw new Error(`AtomicAssets request failed: ${errors.join('; ')}`)
}

/**
 * Every page of a listing endpoint, from one node.
 *
 * Asks until a page comes back short, so the answer is the whole list rather
 * than however much the first request happened to carry. Bounded, because a
 * node that keeps answering "full page" forever must not hang the picker.
 */
async function pagesFrom<T>(base: string, path: string, limit = 1000): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= 20; page++) {
    const res = await getFrom<{ data?: T[] }>(base, `${path}&page=${page}&limit=${limit}`)
    const rows = res.data ?? []
    out.push(...rows)
    if (rows.length < limit) break
  }
  return out
}

/** Rows per page of an asset listing: the API's own maximum. */
const ASSET_PAGE = 1000
/** The pause between pages, so a large wallet's crawl never bursts the API. */
const PAGE_PAUSE_MS = 350
/** Designs asked for in one request at most, to keep the URL a sane length. */
const MAX_SHARED = 100
/** A wallet with more pages than this is not a wallet, it is a runaway loop. */
const MAX_PAGES = 200

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Every page of an asset listing, fast but never in a burst.
 *
 * There is no cap on what a wallet holds: one player had 16,000 tools, and a
 * fixed page count showed them the newest 1,800 and nothing to say the rest
 * existed. So this asks until a page comes back short.
 *
 * A rate limit is per endpoint, and there are three of them. So one worker
 * runs per healthy endpoint, each taking the next unclaimed page and pausing
 * between its own requests: no endpoint ever sees more than one request at a
 * time, and the crawl goes three times as fast as asking one node in turn.
 * Pages are put back in order afterwards and de-duplicated by asset id, in
 * case two nodes disagree about where a page boundary falls.
 *
 * A page that fails is asked again once after a longer wait, of whichever
 * node is next — a rate limit clears in a second or two, and giving up half
 * way would show a partial list as if it were the whole one.
 */
async function pacedPages<T extends { asset_id: string }>(
  path: string,
  { stopAt, onPage }: { stopAt?: number; onPage?: (sofar: number) => void } = {},
): Promise<T[]> {
  const pages = new Map<number, T[]>()
  let next = 1
  /* The first page known to be short, which is the last page there is. */
  let last = Infinity
  let total = 0

  const worker = async (base: string) => {
    let first = true
    for (;;) {
      if (next > last || next > MAX_PAGES) return
      if (stopAt !== undefined && total >= stopAt) return
      const page = next++
      if (!first) await pause(PAGE_PAUSE_MS)
      first = false

      const url = `${path}&page=${page}&limit=${ASSET_PAGE}`
      let res: { data?: T[] }
      try {
        res = await getFrom<{ data?: T[] }>(base, url)
      } catch {
        await pause(2_000)
        res = await get<{ data?: T[] }>(url)
      }

      const rows = res.data ?? []
      pages.set(page, rows)
      total += rows.length
      onPage?.(total)
      if (rows.length < ASSET_PAGE) last = Math.min(last, page)
    }
  }

  await Promise.all(endpointsInOrder().map(worker))

  const out: T[] = []
  const seen = new Set<string>()
  for (const page of [...pages.keys()].sort((a, b) => a - b)) {
    if (page > last) continue
    for (const row of pages.get(page)!) {
      if (seen.has(row.asset_id)) continue
      seen.add(row.asset_id)
      out.push(row)
    }
  }
  return out
}

/**
 * The first node that finds something, asked one at a time.
 *
 * For lookups where an empty answer is a verdict rather than a fact — "you do
 * not own this card" — and a node that has fallen behind gives exactly that
 * answer for something the player does own. Stops at the first hit, so the
 * common case is still one request and only a miss pays to be sure.
 */
async function firstMatch<T, V>(
  path: string,
  pick: (res: T) => V | undefined,
): Promise<V | undefined> {
  for (const base of endpointsInOrder()) {
    try {
      const found = pick(await getFrom<T>(base, path))
      if (found !== undefined) return found
    } catch {
      /* A node that cannot answer is not a node saying no. */
    }
  }
  return undefined
}

/**
 * The same read against every healthy node, keeping the fullest answer.
 *
 * A node that has fallen behind does not fail — it answers, from an older
 * world, and the rotation makes that intermittent: one WAX index was six card
 * designs and twenty-one inventory rows short, so a weapon the player owns
 * vanished from the picker on whichever loads happened to land there.
 *
 * Being behind can only ever under-report, never invent, so the longest of
 * several answers is the current one. Each answer is one node's complete view,
 * never a merge of two, so a card here is a card that node really sees.
 *
 * Only the reads that decide which cards a player may field pay for the extra
 * requests, and both of those are cached.
 */
async function fullest<T>(
  read: (base: string) => Promise<T>,
  size: (value: T) => number,
): Promise<T> {
  const answers = await Promise.allSettled(endpointsInOrder().map(read))

  let best: T | undefined
  const errors: string[] = []
  for (const answer of answers) {
    if (answer.status === 'rejected') {
      errors.push(String(answer.reason?.message ?? answer.reason))
      continue
    }
    if (!best || size(answer.value) > size(best)) best = answer.value
  }

  if (best === undefined) {
    throw new Error(`AtomicAssets request failed on every node: ${errors.join('; ')}`)
  }
  return best
}

interface AssetRow {
  asset_id: string
  owner: string
  name?: string
}

/** Identical concurrent lookups share one request. */
const inflight = new Map<string, Promise<Map<string, string>>>()

/**
 * Owner wallet for each of the given asset ids.
 *
 * Batched deliberately: the map needs owners for a whole planet's built land
 * at once, and that is ≤7 ids today, so it costs a single request per planet
 * instead of one per tile. Results are cached — land changes hands rarely.
 */
export async function fetchAssetOwners(
  assetIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(assetIds.filter((id) => id && id !== '0'))].sort()
  if (ids.length === 0) return new Map()

  const key = `owners:${ids.join(',')}`
  const hit = cacheGet<[string, string][]>(key, true)
  if (hit) return new Map(hit)

  const existing = inflight.get(key)
  if (existing) return existing

  const request = get<{ data: AssetRow[] }>(
    `/atomicassets/v1/assets?ids=${ids.join(',')}&limit=${ids.length}`,
  )
    .then((res) => {
      const owners = new Map<string, string>()
      for (const row of res.data ?? []) owners.set(String(row.asset_id), row.owner)
      cacheSet(key, [...owners.entries()], TTL.long, true)
      return owners
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, request)
  return request
}

/**
 * Every template the player owns in a collection, with counts.
 *
 * One request, ~160 rows for a large wallet — as opposed to paging thousands
 * of individual assets. The tavern only cares *which* templates you hold,
 * because any copy of a template satisfies an objective equally.
 */
export async function fetchOwnedTemplates(
  owner: string,
  collection = 'alien.worlds',
): Promise<Map<number, number>> {
  const key = `owned:${collection}:${owner}`
  const hit = cacheGet<[number, number][]>(key)
  if (hit) return new Map(hit)

  type Inventory = { data?: { templates?: { template_id: string; assets: string }[] } }
  const res = await fullest<Inventory>(
    (base) =>
      getFrom<Inventory>(
        base,
        `/atomicassets/v1/accounts/${encodeURIComponent(owner)}/${collection}`,
      ),
    (r) => r.data?.templates?.length ?? 0,
  )

  const owned = new Map<number, number>()
  for (const row of res.data?.templates ?? []) {
    owned.set(Number(row.template_id), Number(row.assets))
  }
  cacheSet(key, [...owned.entries()], TTL.short)
  return owned
}

/**
 * One asset id per requested template.
 *
 * `users::hire` takes asset ids, but the player picks templates — any copy
 * does. Resolving only at hire time keeps the browse step to zero per-asset
 * requests.
 *
 * One request per template, rather than one whitelisted request for all of
 * them. The combined form looked cheaper and was wrong: a page of assets
 * sorted by id is not distributed evenly across the templates in the
 * whitelist, so the copies of a card the player holds hundreds of fill the
 * page and a card they hold one of never appears in it. The caller then reads
 * that as "you no longer own this" and refuses to start.
 *
 * Which is exactly the shape of a rare card paired with a common one — an
 * antimatter weapon beside a stone crew card. Measured on a real wallet:
 * template 19627 (405 copies) and 741859 (1 copy) at the old limit of 50
 * returned fifty rows, every one of them 19627. Asked separately, both
 * resolve.
 *
 * The requests are small, parallel, and there are two of them on the path
 * that matters — the price of being right about a card somebody spent real
 * money on.
 */
export async function resolveAssetIds(
  owner: string,
  templateIds: number[],
  collection = 'alien.worlds',
): Promise<Map<number, string>> {
  if (templateIds.length === 0) return new Map()

  /* One lookup each, however many times a template appears in the list. */
  const wanted = [...new Set(templateIds)]

  const results = await Promise.all(
    wanted.map(async (templateId) => {
      const path =
        `/atomicassets/v1/assets?owner=${encodeURIComponent(owner)}` +
        `&collection_name=${collection}` +
        `&template_id=${templateId}` +
        `&limit=1&order=asc&sort=asset_id`

      /*
        Every node gets asked before this gives up on a card.

        An empty answer here becomes "you no longer own this" and refuses the
        hire or the run, so it has to mean the player really sold it — not
        that the node answering happened to be behind. A node that has not
        caught up yet returns no rows rather than an error, which is
        indistinguishable from the real thing on one request and obvious
        across several.
      */
      const assetId = await firstMatch<{ data?: { asset_id: string }[] }, string>(
        path,
        (res) => res.data?.[0]?.asset_id,
      )
      return assetId ? ([templateId, String(assetId)] as const) : null
    }),
  )

  const found = new Map<number, string>()
  for (const row of results) if (row) found.set(row[0], row[1])
  return found
}

/**
 * One Alien Worlds card design, as the dungeon's crew and weapon slots need
 * it. A template, not an asset: a wallet can hold four hundred copies of the
 * same card and they are interchangeable to the contract.
 */
export interface CardTemplate {
  template_id: number
  schema: string
  name: string
  rarity: string
  shine: string
  /** `element` on crew cards, `class` on weapons — the same idea, both used. */
  element: string
  attack: number
  defense: number
  /** How many copies the player holds, once paired with their inventory. */
  owned: number
  /** The IPFS hash of the card's own artwork, for templates we ship no file for. */
  img?: string
}

/**
 * Every card design in one schema of a collection.
 *
 * Deliberately the whole catalogue rather than the player's own: it is 114
 * crew and 170 weapon templates for `alien.worlds`, it is identical for every
 * player, and it changes about never — so it caches hard and is then
 * intersected with whatever the player happens to hold.
 */
export async function fetchSchemaTemplates(
  schema: string,
  collection = 'alien.worlds',
): Promise<Map<number, CardTemplate>> {
  /* Bumped: caches written from a lagging node hold a short catalogue. */
  /* v3: the rows now carry the IPFS image hash as well. */
  const key = `templates:v3:${collection}:${schema}`
  const hit = cacheGet<[number, CardTemplate][]>(key, true)
  if (hit) return new Map(hit)

  interface TemplateRow {
    template_id: string
    name?: string
    schema?: { schema_name?: string }
    immutable_data?: Record<string, unknown>
  }

  const rows = await fullest<TemplateRow[]>(
    (base) =>
      pagesFrom<TemplateRow>(
        base,
        `/atomicassets/v1/templates?collection_name=${collection}` +
          `&schema_name=${encodeURIComponent(schema)}`,
      ),
    (r) => r.length,
  )

  const out = new Map<number, CardTemplate>()
  for (const row of rows) {
    const d = row.immutable_data ?? {}
    const id = Number(row.template_id)
    if (!id) continue
    out.set(id, {
      template_id: id,
      schema: String(row.schema?.schema_name ?? schema),
      name: String(row.name ?? d.name ?? ''),
      rarity: String(d.rarity ?? ''),
      shine: String(d.shine ?? ''),
      element: String(d.element ?? d.class ?? ''),
      attack: Number(d.attack ?? 0),
      defense: Number(d.defense ?? 0),
      owned: 0,
      img: d.img ? String(d.img) : undefined,
    })
  }

  cacheSet(key, [...out.entries()], TTL.long, true)
  return out
}

/**
 * The distinct card designs a player holds in one schema.
 *
 * Three cached requests rather than paging the wallet's assets: the two
 * schema catalogues plus one inventory call. That matters because a real
 * wallet holds thousands of these — one player has over a thousand crew
 * assets across just thirty designs — so listing assets would be both far
 * slower and mostly duplicates.
 *
 * An asset id is only needed to sign, and `resolveAssetIds` fetches one at
 * that point.
 */
export async function fetchOwnedCards(
  owner: string,
  schema: string,
  collection = 'alien.worlds',
): Promise<CardTemplate[]> {
  const [catalogue, owned] = await Promise.all([
    fetchSchemaTemplates(schema, collection),
    fetchOwnedTemplates(owner, collection),
  ])

  const out: CardTemplate[] = []
  for (const [templateId, count] of owned) {
    const card = catalogue.get(templateId)
    if (card) out.push({ ...card, owned: count })
  }
  return out
}

/** One land NFT, reduced to what the game needs from it. */
export interface LandAsset {
  asset_id: string
  name: string
  planet: string
  x: number
  y: number
  rarity: string
}

/**
 * The land NFTs a wallet holds.
 *
 * Land ownership is not in the game contracts at all — `maps.cpp` checks the
 * AtomicAssets table directly before allowing a build, boost, claim or
 * destroy — so this is the authoritative list, and `lands.ale` only says what
 * has been done to each one.
 *
 * The planet is parsed out of the NFT's name ("Rocky Desert on Kavian")
 * rather than from its `planet` field, which holds a hashed id the game
 * contracts never use.
 */
export async function fetchOwnedLands(owner: string): Promise<LandAsset[]> {
  const key = `lands:${owner}`
  const hit = cacheGet<LandAsset[]>(key)
  if (hit) return hit

  const res = await get<{
    data?: {
      asset_id: string
      name?: string
      data?: Record<string, unknown>
    }[]
  }>(
    `/atomicassets/v1/assets?collection_name=alien.worlds` +
      `&schema_name=land.worlds&owner=${encodeURIComponent(owner)}` +
      `&limit=1000&order=asc&sort=asset_id`,
  )

  const out: LandAsset[] = []
  for (const row of res.data ?? []) {
    const d = row.data ?? {}
    const name = String(row.name ?? d.name ?? '')
    const planet = name.split(' on ')[1]?.toLowerCase() ?? ''
    const x = Number(d.x ?? 0)
    const y = Number(d.y ?? 0)
    if (!planet || !x || !y) continue
    out.push({
      asset_id: String(row.asset_id),
      name,
      planet,
      x,
      y,
      rarity: String(d.rarity ?? '').toLowerCase(),
    })
  }

  out.sort((a, b) => a.planet.localeCompare(b.planet) || a.x - b.x || a.y - b.y)
  cacheSet(key, out, TTL.short)
  return out
}

/**
 * Asset ids for a number of copies of each template, looked up on demand.
 *
 * Farming counts cards from the account summary rather than listing every
 * asset — a wallet of 15,000 tools is one request that way instead of
 * fifteen — so the ids the transfer needs are found here, only for the
 * designs being staked and only as many as were asked for.
 *
 * Because the counts are known, so is every request that has to be made.
 * Designs the wallet holds few of share one: the API takes a list of
 * template ids, and when everything held of a group adds up to a page, one
 * request returns every copy of each. A design held more than a page's
 * worth is read on its own, in exactly the pages its amount needs. All of
 * it goes into one queue that a worker per endpoint drains, paced as
 * `pacedPages` is. Asked design by design and page by speculative page
 * instead, staking 55 cards of 27 designs took 81 requests and 25 seconds
 * before the wallet even opened; this is one.
 *
 * Throws rather than returning short: a node that has fallen behind can
 * list fewer copies than the summary counted, and staking three when the
 * button said five is worse than a clear error.
 */
export async function fetchAssetIdsForTemplates(
  owner: string,
  /** `held` is how many the wallet owns; without it a design pages alone. */
  wants: { template_id: number; count: number; held?: number; name?: string }[],
  collection = 'alien.worlds',
): Promise<string[]> {
  const asked = wants.filter((w) => w.count > 0)

  /*
     Every request the lookup needs, known before the first one is made.

     Small designs are packed into shared requests until what is held of
     them fills a page; a design held more than a page's worth, or whose
     holding is not known, is read on its own.
  */
  type Task =
    | { kind: 'shared'; members: number[]; size: number }
    | { kind: 'alone'; index: number; page: number; size: number }
  const tasks: Task[] = []

  let group: number[] = []
  let groupHeld = 0
  const flush = () => {
    if (group.length) tasks.push({ kind: 'shared', members: group, size: groupHeld })
    group = []
    groupHeld = 0
  }
  asked.forEach((want, index) => {
    const held = want.held
    if (held === undefined || held > ASSET_PAGE) {
      const size = Math.min(want.count, ASSET_PAGE)
      const pages = Math.ceil(want.count / size)
      for (let page = 1; page <= pages; page++) tasks.push({ kind: 'alone', index, page, size })
      return
    }
    if (groupHeld + held > ASSET_PAGE || group.length >= MAX_SHARED) flush()
    group.push(index)
    groupHeld += held
  })
  flush()

  const found = asked.map(() => new Map<number, string[]>())
  let cursor = 0

  const worker = async (base: string) => {
    let first = true
    while (cursor < tasks.length) {
      const task = tasks[cursor++]
      if (!first) await pause(PAGE_PAUSE_MS)
      first = false

      const templates =
        task.kind === 'shared'
          ? task.members.map((i) => asked[i].template_id).join(',')
          : String(asked[task.index].template_id)
      const page = task.kind === 'shared' ? 1 : task.page
      const url =
        `/atomicassets/v1/assets?collection_name=${collection}` +
        `&owner=${encodeURIComponent(owner)}&template_id=${templates}` +
        `&order=asc&sort=asset_id&page=${page}&limit=${task.size}`
      let res: { data?: { asset_id: string; template?: { template_id?: string } | null }[] }
      try {
        res = await getFrom<typeof res>(base, url)
      } catch {
        await pause(2_000)
        res = await get<typeof res>(url)
      }
      const rows = res.data ?? []

      if (task.kind === 'alone') {
        found[task.index].set(task.page, rows.map((r) => String(r.asset_id)))
      } else {
        /* One answer for the whole group, handed back to each design. */
        for (const i of task.members) {
          const id = String(asked[i].template_id)
          found[i].set(
            1,
            rows.filter((r) => String(r.template?.template_id) === id).map((r) => String(r.asset_id)),
          )
        }
      }
    }
  }

  await Promise.all(endpointsInOrder().map(worker))

  const ids: string[] = []
  asked.forEach((want, index) => {
    const seen = new Set<string>()
    const pages = [...found[index].keys()].sort((a, b) => a - b)
    for (const page of pages) {
      for (const id of found[index].get(page)!) seen.add(id)
    }
    if (seen.size < want.count) {
      throw new Error(
        `Could only find ${seen.size} of the ${want.count} ${want.name || `#${want.template_id}`} ` +
          'in your wallet. Refresh and try again.',
      )
    }
    ids.push(...[...seen].slice(0, want.count))
  })
  return ids
}

/**
 * Forget a wallet's per-template counts, after something moved its cards.
 *
 * The counts are cached for a few minutes, which is right for browsing and
 * wrong the moment a stake or unstake has just changed them.
 */
export function forgetOwnedTemplates(owner: string, collection = 'alien.worlds'): void {
  cacheDrop(`owned:${collection}:${owner}`)
}

/** An Alien Worlds mining tool, with the attributes that decide a mine. */
export interface MiningTool {
  asset_id: string
  name: string
  template_id: number
  rarity: string
  shine: string
  /** "Extractor", "Manipulator" — flavour rather than mechanics. */
  type: string
  /** Cuts the difficulty of a mine. Higher is better. */
  ease: number
  /** Chance of a bonus on top of the base yield. Higher is better. */
  luck: number
  /** Seconds added to the cooldown between mines. Lower is better. */
  delay: number
  /** Added to the mine's difficulty. Lower is better. */
  difficulty: number
}

/**
 * The mining tools a wallet holds.
 *
 * Every tool in the wallet, with the attributes mining turns on — a bag is chosen on delay, ease and luck
 * together, so a picker that shows only rarity is asking the player to guess.
 */
export async function fetchMiningTools(
  owner: string,
  onProgress?: (loaded: number) => void,
): Promise<MiningTool[]> {
  /* v2: the list used to stop at 1,800 tools, and a cached short list must
     not outlive the fix. */
  const key = `miningtools:v2:${owner}`
  const hit = cacheGet<MiningTool[]>(key)
  if (hit) return hit

  const rows = await pacedPages<{
    asset_id: string
    name?: string
    template?: { template_id?: string } | null
    data?: Record<string, unknown>
  }>(
    `/atomicassets/v1/assets?collection_name=alien.worlds` +
      `&schema_name=tool.worlds&owner=${encodeURIComponent(owner)}` +
      `&order=desc&sort=asset_id`,
    { onPage: onProgress },
  )

  const out: MiningTool[] = rows.map((row) => {
    const d = row.data ?? {}
    return {
      asset_id: String(row.asset_id),
      name: String(row.name ?? d.name ?? ''),
      template_id: Number(row.template?.template_id ?? 0),
      rarity: String(d.rarity ?? ''),
      shine: String(d.shine ?? 'Stone'),
      type: String(d.type ?? ''),
      ease: Number(d.ease ?? 0),
      luck: Number(d.luck ?? 0),
      delay: Number(d.delay ?? 0),
      difficulty: Number(d.difficulty ?? 0),
    }
  })

  cacheSet(key, out, TTL.short)
  return out
}

/**
 * Immutable data for a named list of templates.
 *
 * The catalogue readers above fetch a whole schema, which is right when the
 * caller wants "every crew card". The Outpost wants the forty-odd templates
 * its open offers happen to name, drawn from more than one collection — so
 * this asks for exactly those ids instead, in one request.
 *
 * Returned raw rather than shaped: what the fields mean belongs to whoever
 * asked, and `alien.worlds` mining tools carry a different set from a card.
 */
export async function fetchTemplateData(
  ids: number[],
): Promise<Map<number, { name: string; data: Record<string, unknown> }>> {
  const wanted = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))]
  if (wanted.length === 0) return new Map()

  /* Sorted so the same set of offers hits the same cache entry whatever
     order they arrived in. */
  const key = `tpldata:${wanted.slice().sort((a, b) => a - b).join(',')}`
  const hit = cacheGet<[number, { name: string; data: Record<string, unknown> }][]>(key, true)
  if (hit) return new Map(hit)

  interface Row {
    template_id: string
    name?: string
    immutable_data?: Record<string, unknown>
  }

  const rows = await fullest<Row[]>(
    async (base) => {
      const res = await getFrom<{ data?: Row[] }>(
        base,
        /* `ids` takes a comma list and the endpoint caps a page at 1000, well
           past the number of offers the Outpost ever has open. */
        `/atomicassets/v1/templates?ids=${wanted.join(',')}&limit=1000`,
      )
      return res.data ?? []
    },
    (r) => r.length,
  )

  const out = new Map<number, { name: string; data: Record<string, unknown> }>()
  for (const row of rows) {
    const id = Number(row.template_id)
    if (!id) continue
    const data = row.immutable_data ?? {}
    out.set(id, { name: String(row.name ?? data.name ?? ''), data })
  }

  /* Templates are immutable, so this is safe to keep across reloads. */
  cacheSet(key, [...out.entries()], TTL.long, true)
  return out
}
