import { CONTRACTS } from '@/chain/config'
import { getRow } from '@/chain/client'
import type { AwSchema, MarketCard } from '@/chain/atomic'

/**
 * The Shop's NFT Market: Alien Worlds cards on AtomicMarket, bought through
 * `shop.ale`. Only buying, only the `alien.worlds` collection, only the three
 * schemas that do something in this game.
 */

export const MARKET_SCHEMAS: { key: AwSchema; label: string; icon: string }[] = [
  { key: 'tool.worlds', label: 'Tools', icon: '/assets/icons/menu/rewards.png' },
  { key: 'crew.worlds', label: 'Crew', icon: '/assets/icons/menu/sword.png' },
  { key: 'arms.worlds', label: 'Weapons', icon: '/assets/icons/stats/damage.svg' },
]

/** Alien Worlds' own order, commonest first. */
export const RARITIES = ['Abundant', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical']

export function rarityRank(rarity: string): number {
  const i = RARITIES.findIndex((r) => r.toLowerCase() === rarity.toLowerCase())
  return i < 0 ? RARITIES.length : i
}

export type MarketSort = 'cheapest' | 'dearest' | 'power'

/** The labels for each sort, worded for the schema shown. */
export function sortLabel(sort: MarketSort, schema: AwSchema): string {
  if (sort === 'cheapest') return 'Cheapest first'
  if (sort === 'dearest') return 'Most expensive first'
  return schema === 'tool.worlds' ? 'Most mining power' : 'Most damage'
}

/**
 * Shown cards, in the order asked for. `power` is whatever the card is for:
 * a tool's TLM power, a crew or weapon's damage in a fight.
 */
export function sortCards(
  cards: MarketCard[],
  sort: MarketSort,
  power: (c: MarketCard) => number,
): MarketCard[] {
  const out = [...cards]
  if (sort === 'cheapest') out.sort((a, b) => a.wax - b.wax)
  else if (sort === 'dearest') out.sort((a, b) => b.wax - a.wax)
  else out.sort((a, b) => power(b) - power(a) || a.wax - b.wax)
  return out
}

/** `atomicmarket` / `sales` — the chain's own record of one sale. */
export interface SaleRecord {
  sale_id: string | number
  seller: string
  asset_ids: (string | number)[]
  listing_price: string
  settlement_symbol: string
}

/** The sale as the chain holds it now, or nothing if it has gone. */
export function fetchSaleRecord(saleId: string): Promise<SaleRecord | undefined> {
  return getRow<SaleRecord>(
    {
      code: CONTRACTS.atomicmarket,
      scope: CONTRACTS.atomicmarket,
      table: 'sales',
      key: saleId,
    },
    { refresh: true, ttl: 0 },
  )
}

/**
 * Whether the sale is still exactly what the card says.
 *
 * Checked when the confirmation opens, so a player sees "the price moved"
 * before signing rather than a refusal after. The purchase asserts the same
 * three things on chain regardless — this is the courtesy, that is the guard.
 */
export function saleStatus(
  card: Pick<MarketCard, 'assetId' | 'price'>,
  record: SaleRecord | undefined,
): 'ok' | 'gone' | 'changed' {
  if (!record) return 'gone'
  const same =
    record.listing_price === card.price &&
    record.settlement_symbol === '8,WAX' &&
    record.asset_ids.length === 1 &&
    String(record.asset_ids[0]) === card.assetId
  return same ? 'ok' : 'changed'
}
