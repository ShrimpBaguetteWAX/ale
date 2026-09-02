import type { Building, Land } from '@/chain/types'
import type { Planet } from '@/chain/config'

/**
 * `lands.ale` / `buildingcost`, scoped by building name and keyed by level.
 *
 * Only level 1 exists for each of the three buildings today, so nothing can
 * be upgraded yet — the screen reads that from the table rather than assuming
 * it, so upgrades appear on their own the day a level 2 row is written.
 */
export interface BuildingCost {
  level: number
  building_name: string
  cost_gem: number
  cost_credits: number
  displayname: string
}

/** `lands.ale` / `raritydisc` — credits knocked off a build by land rarity. */
export interface RarityDiscount {
  rarity: string
  credits_building_discount: number
}

/**
 * A land the player owns.
 *
 * Ownership lives in AtomicAssets, not in the game contracts: `maps.cpp`
 * checks `assets_t("atomicassets", wallet).require_find(land.asset_id)` before
 * it will let anyone build, boost, claim or destroy. So the list of lands
 * comes from the NFT collection and the state of each one comes from
 * `lands.ale` — and a land can legitimately have an NFT but no chain row,
 * which is what an untouched land looks like.
 */
export interface OwnedLand {
  asset_id: string
  /** From the NFT's `name`, e.g. "Small Plot on Magor". */
  name: string
  planet: Planet
  x: number
  y: number
  rarity: string
  /** The `lands.ale` row, absent until something is built here. */
  land?: Land
  buildings: Building[]
}

/** What one land is holding for its owner, summed across its buildings. */
export interface LandIncome {
  tlm: number
  credits: number
  gems: number
  shards: number
}
