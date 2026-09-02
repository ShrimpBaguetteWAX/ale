import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { TTL } from '@/chain/cache'
import type { AscUpgrade, RosterStats } from '@/dungeon/types'

/**
 * `market.ale` — player-to-player fighter sales, priced in gems.
 *
 * Two kinds of listing, and only one of them can be created directly. A
 * player lists an *auction*; an *instant offer* only ever comes into being
 * when an auction ends with no bids and the seller ticked "keep after
 * auction", at which point `compauct` converts it to a fixed-price listing at
 * the config's `gems_instant_buy_price`.
 *
 * Both tables live in a single scope on the contract account rather than
 * being scoped by class, so each is one read.
 */

/** The fields both listing kinds carry about the fighter being sold. */
interface ListedFighter {
  /** The same shape as a roster fighter's `stats`. */
  fighter: RosterStats
  fighter_id: number
  classname: string
  owner: string
  owner_gamertag: string
  creation_date: string
  last_payday: string
  next_payday: string
  ascension_level: number
  ascension_in_progress: number | boolean
  ascension_upgrades: AscUpgrade[]
}

export interface Auction extends ListedFighter {
  auction_id: number
  auction_start: string
  auction_end: string
  bids: number
  /**
   * The start price until somebody bids, the standing bid after that.
   *
   * `bids` is what separates the two — the field alone cannot tell you
   * whether anyone has actually offered this much.
   */
  current_bid: number
  current_bidder: string
  current_bidder_gamertag: string
  /**
   * Whether an unsold fighter is relisted at the fixed price rather than
   * returned. The only route to an instant offer existing at all.
   */
  keep_after_auction: number | boolean
}

export interface InstantOffer extends ListedFighter {
  offer_id: number
  offer_start: string
  /** Always the fighter's `next_payday` — an offer dies when the wages fall due. */
  offer_end: string
  gems: number
}

export function fetchAuctions(refresh = false): Promise<Auction[]> {
  return getAllRows<Auction>(
    { code: CONTRACTS.market, scope: CONTRACTS.market, table: 'auctions' },
    { ttl: TTL.short, refresh },
  )
}

export function fetchOffers(refresh = false): Promise<InstantOffer[]> {
  return getAllRows<InstantOffer>(
    { code: CONTRACTS.market, scope: CONTRACTS.market, table: 'instantoffer' },
    { ttl: TTL.short, refresh },
  )
}

/**
 * `market.ale` / `config` — every price and interval the market runs on.
 *
 * Read rather than assumed because all of it is adjustable, and three of
 * these decide whether a button should be enabled at all.
 */
export interface MarketConfig {
  index: number
  /** Gems charged to list, spent whether or not the fighter sells. */
  gems_listing_price: number
  /** How long a new auction runs, in minutes. */
  standard_duration_minutes: number
  /** A bid inside this many minutes of the end pushes the end out to it again. */
  reset_duration_below_minutes: number
  gems_min_start_bid: number
  gems_processing_fee_min: number
  gems_processing_fee_percent: number
  /** What an unsold, kept fighter is relisted at. */
  gems_instant_buy_price: number
  gems_min_bid_increase: number
  gems_min_bid_increase_percent: number
}

export function fetchMarketConfig(): Promise<MarketConfig | undefined> {
  return getRow<MarketConfig>(
    { code: CONTRACTS.market, scope: CONTRACTS.market, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/** `market.ale` / `scopes` — per-class listing counts, current and all time. */
export interface MarketScope {
  scope: string
  current_auctions: number
  all_time_auctions: number
  current_instant_offers: number
  all_time_instant_offers: number
}

export function fetchMarketScopes(): Promise<MarketScope[]> {
  return getAllRows<MarketScope>(
    { code: CONTRACTS.market, scope: CONTRACTS.market, table: 'scopes' },
    { ttl: TTL.medium },
  )
}
