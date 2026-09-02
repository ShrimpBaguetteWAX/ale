import { ATOMIC_ENDPOINTS } from './config'
import { cacheGet, cacheSet, TTL } from './cache'

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

async function get<T>(path: string): Promise<T> {
  const errors: string[] = []

  for (const base of endpointsInOrder().slice(0, 3)) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(base + path, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as T
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
      penalties.set(base, Date.now() + PENALTY_MS)
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error(`AtomicAssets request failed: ${errors.join('; ')}`)
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

  const res = await get<{ data?: { templates?: { template_id: string; assets: string }[] } }>(
    `/atomicassets/v1/accounts/${encodeURIComponent(owner)}/${collection}`,
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
 */
export async function resolveAssetIds(
  owner: string,
  templateIds: number[],
  collection = 'alien.worlds',
): Promise<Map<number, string>> {
  if (templateIds.length === 0) return new Map()

  const res = await get<{
    data?: { asset_id: string; template?: { template_id: string } }[]
  }>(
    `/atomicassets/v1/assets?owner=${encodeURIComponent(owner)}` +
      `&collection_name=${collection}` +
      `&template_whitelist=${templateIds.join(',')}` +
      // Enough rows that every requested template appears even when the
      // player holds many copies of one of them.
      `&limit=${Math.min(1000, templateIds.length * 25)}` +
      `&order=asc&sort=asset_id`,
  )

  const found = new Map<number, string>()
  for (const row of res.data ?? []) {
    const id = Number(row.template?.template_id)
    if (id && !found.has(id)) found.set(id, String(row.asset_id))
  }
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
  const key = `templates:${collection}:${schema}`
  const hit = cacheGet<[number, CardTemplate][]>(key, true)
  if (hit) return new Map(hit)

  const res = await get<{
    data?: {
      template_id: string
      name?: string
      schema?: { schema_name?: string }
      immutable_data?: Record<string, unknown>
    }[]
  }>(
    `/atomicassets/v1/templates?collection_name=${collection}` +
      `&schema_name=${encodeURIComponent(schema)}&limit=1000`,
  )

  const out = new Map<number, CardTemplate>()
  for (const row of res.data ?? []) {
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
 * Every Alien Worlds card in one schema that a wallet holds.
 *
 * Unlike `fetchOwnedCards`, this returns individual assets rather than
 * aggregated designs, because staking signs a transfer of specific asset ids.
 * A big wallet holds thousands, so it pages — and stops at the contract's own
 * `max_nfts` ceiling, past which nothing more can be staked anyway.
 */
export async function fetchFarmInventory(
  owner: string,
  schema: string,
  limit = 1000,
): Promise<
  {
    asset_id: string
    name: string
    template_id: number
    schema: string
    rarity: string
    shine: string
  }[]
> {
  const key = `farminv:${owner}:${schema}`
  const hit = cacheGet<
    {
      asset_id: string
      name: string
      template_id: number
      schema: string
      rarity: string
      shine: string
    }[]
  >(key)
  if (hit) return hit

  const out: {
    asset_id: string
    name: string
    template_id: number
    schema: string
    rarity: string
    shine: string
  }[] = []

  const PAGE = 200
  for (let page = 1; out.length < limit; page++) {
    const res = await get<{
      data?: {
        asset_id: string
        name?: string
        template?: { template_id?: string } | null
        schema?: { schema_name?: string }
        data?: Record<string, unknown>
      }[]
    }>(
      `/atomicassets/v1/assets?collection_name=alien.worlds` +
        `&schema_name=${encodeURIComponent(schema)}` +
        `&owner=${encodeURIComponent(owner)}` +
        `&page=${page}&limit=${PAGE}&order=desc&sort=asset_id`,
    )

    const rows = res.data ?? []
    for (const row of rows) {
      const d = row.data ?? {}
      out.push({
        asset_id: String(row.asset_id),
        name: String(row.name ?? d.name ?? ''),
        template_id: Number(row.template?.template_id ?? 0),
        schema: String(row.schema?.schema_name ?? schema),
        rarity: String(d.rarity ?? ''),
        shine: String(d.shine ?? 'Stone'),
      })
    }

    if (rows.length < PAGE) break
  }

  cacheSet(key, out, TTL.short)
  return out
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
 * Same call as `fetchFarmInventory` but keeping the attributes staking has no
 * use for and mining turns on — a bag is chosen on delay, ease and luck
 * together, so a picker that shows only rarity is asking the player to guess.
 */
export async function fetchMiningTools(owner: string): Promise<MiningTool[]> {
  const key = `miningtools:${owner}`
  const hit = cacheGet<MiningTool[]>(key)
  if (hit) return hit

  const out: MiningTool[] = []
  const PAGE = 200

  for (let page = 1; page < 10; page++) {
    const res = await get<{
      data?: {
        asset_id: string
        name?: string
        template?: { template_id?: string } | null
        data?: Record<string, unknown>
      }[]
    }>(
      `/atomicassets/v1/assets?collection_name=alien.worlds` +
        `&schema_name=tool.worlds&owner=${encodeURIComponent(owner)}` +
        `&page=${page}&limit=${PAGE}&order=desc&sort=asset_id`,
    )

    const rows = res.data ?? []
    for (const row of rows) {
      const d = row.data ?? {}
      out.push({
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
      })
    }

    if (rows.length < PAGE) break
  }

  cacheSet(key, out, TTL.short)
  return out
}
