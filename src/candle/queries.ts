import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { TTL } from '@/chain/cache'
import type {
  CandleClaim,
  CandleConfig,
  CandleOffer,
  CandleTracking,
  Contribution,
} from './types'

/**
 * Every campaign the contract is holding.
 *
 * There is one at a time and it lasts a day, so this is a single tiny read —
 * but it is written as a list because the table genuinely is one, and a
 * closed campaign lingers in it until `calcclaim` has paid everybody out.
 */
export function fetchCandleOffers(refresh = false): Promise<CandleOffer[]> {
  return getAllRows<CandleOffer>(
    { code: CONTRACTS.candle, scope: CONTRACTS.candle, table: 'offers' },
    { ttl: TTL.short, refresh },
  )
}

export function fetchCandleConfig(): Promise<CandleConfig | undefined> {
  return getRow<CandleConfig>(
    { code: CONTRACTS.candle, scope: CONTRACTS.candle, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/** When the next campaign is scheduled, for the gap between them. */
export function fetchCandleTracking(refresh = false): Promise<CandleTracking | undefined> {
  return getRow<CandleTracking>(
    { code: CONTRACTS.candle, scope: CONTRACTS.candle, table: 'tracking', key: 0 },
    { ttl: TTL.short, refresh },
  )
}

/** What this player has won and not yet taken. Absent until they win something. */
export function fetchCandleClaim(
  wallet: string,
  refresh = false,
): Promise<CandleClaim | undefined> {
  return getRow<CandleClaim>(
    { code: CONTRACTS.candle, scope: CONTRACTS.candle, table: 'claims', key: wallet },
    { ttl: TTL.short, refresh },
  )
}

/**
 * Everyone's stake in one campaign.
 *
 * Scoped by the offer id and keyed by wallet, so the whole board of
 * contributors comes back in a single read — which is what makes it possible
 * to show a player their share of the pot rather than only their own number.
 */
export function fetchContributions(
  offerId: string,
  refresh = false,
): Promise<Contribution[]> {
  return getAllRows<Contribution>(
    { code: CONTRACTS.candle, scope: offerId, table: 'contribution' },
    { ttl: TTL.short, refresh },
  )
}
