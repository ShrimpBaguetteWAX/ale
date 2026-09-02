import { CONTRACTS } from '@/chain/config'
import { getAllRows } from '@/chain/client'
import { TTL } from '@/chain/cache'
import type { BuildingCost, RarityDiscount } from './types'

/** The three buildings the game offers today, in the original's order. */
export const BUILDINGS = ['tavern', 'dungeon', 'arena'] as const
export type BuildingName = (typeof BUILDINGS)[number]

/**
 * Every building's price ladder.
 *
 * `buildingcost` is scoped by building name and keyed by level, so this is
 * one read per building — three in total, cached hard because prices move
 * about as often as the contract is redeployed.
 */
export async function fetchBuildingCosts(): Promise<Map<string, BuildingCost[]>> {
  const out = new Map<string, BuildingCost[]>()

  await Promise.all(
    BUILDINGS.map(async (name) => {
      const rows = await getAllRows<BuildingCost>(
        { code: CONTRACTS.lands, scope: name, table: 'buildingcost' },
        { ttl: TTL.long, persist: true },
      )
      out.set(
        name,
        [...rows].sort((a, b) => a.level - b.level),
      )
    }),
  )

  return out
}

/**
 * Credits knocked off a build by the land's rarity.
 *
 * `maps::build` asserts `cost_credits + discount == buildingcost.cost_credits`
 * exactly, so this is not decoration — signing without it aborts the
 * transaction with "Price mismatch".
 */
export async function fetchRarityDiscounts(): Promise<Map<string, number>> {
  const rows = await getAllRows<RarityDiscount>(
    { code: CONTRACTS.lands, scope: CONTRACTS.lands, table: 'raritydisc' },
    { ttl: TTL.long, persist: true },
  )
  return new Map(rows.map((r) => [r.rarity, r.credits_building_discount]))
}
