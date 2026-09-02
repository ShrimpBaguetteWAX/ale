import { CONTRACTS } from '@/chain/config'
import { getAllRows, getBalance } from '@/chain/client'
import { TTL } from '@/chain/cache'
import type { ShopCooldown, ShopItem } from './types'

/**
 * Everything on sale. Sixteen rows that change only when the team reprices
 * something, so this is cached hard and kept across reloads.
 */
export function fetchShopItems(refresh = false): Promise<ShopItem[]> {
  return getAllRows<ShopItem>(
    { code: CONTRACTS.shop, scope: CONTRACTS.shop, table: 'shopitems' },
    { ttl: TTL.long, persist: true, refresh },
  )
}

/**
 * Cooldowns on the free claims.
 *
 * The table is global rather than scoped per player and has no primary-key
 * ordering by wallet, so this reads it and filters. It is small — one row per
 * player per claimed item — and only the daily flasks ever create rows.
 */
export async function fetchShopCooldowns(
  wallet: string,
  refresh = false,
): Promise<ShopCooldown[]> {
  const rows = await getAllRows<ShopCooldown>(
    { code: CONTRACTS.shop, scope: CONTRACTS.shop, table: 'cdclaimshp' },
    { ttl: TTL.short, refresh },
  )
  return rows.filter((r) => r.wallet === wallet)
}

/** The player's spendable WAX, for the gem packs. */
export function fetchWaxBalance(wallet: string): Promise<string | undefined> {
  return getBalance(wallet, CONTRACTS.token, 'WAX')
}
