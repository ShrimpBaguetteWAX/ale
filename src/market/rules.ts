import type { Player } from '@/chain/types'
import type { RosterFighter } from '@/dungeon/types'
import type { Auction, InstantOffer, MarketConfig } from './queries'

/**
 * The market's arithmetic, from `market.cpp`.
 *
 * Every number here is integer maths on chain, so every division truncates.
 * Getting that wrong by one gem is the difference between a bid the contract
 * accepts and a transaction that reverts after the player has signed it.
 */

/* ---------- bidding ---------- */

/**
 * The smallest bid `bidauction` will accept.
 *
 *     min = current + gems_min_bid_increase
 *     if (min < current * (100 + pct) / 100) min = current * (100 + pct) / 100
 *
 * Worth knowing: this applies to the *first* bid too. A new auction stores its
 * start price in `current_bid` with `bids` still zero, so a fighter listed at
 * 10 gems cannot be entered at 10 — the opening bid has to clear the increase
 * as well. The screen quotes this number rather than the start price for
 * exactly that reason.
 */
export function minNextBid(currentBid: number, config: MarketConfig | undefined): number {
  const flat = currentBid + Number(config?.gems_min_bid_increase ?? 0)
  const pct = Math.trunc(
    (currentBid * (100 + Number(config?.gems_min_bid_increase_percent ?? 0))) / 100,
  )
  return Math.max(flat, pct)
}

/* ---------- what the seller actually receives ---------- */

/** `max(fee_min, price * fee_percent / 100)`, truncated. */
export function processingFee(price: number, config: MarketConfig | undefined): number {
  const min = Number(config?.gems_processing_fee_min ?? 0)
  const pct = Math.trunc((price * Number(config?.gems_processing_fee_percent ?? 0)) / 100)
  return Math.max(min, pct)
}

/**
 * What lands in the seller's balance.
 *
 * The contract only subtracts the fee when the price is strictly larger than
 * it — `if (gem_payout > processing_fee) gem_payout -= processing_fee` — so a
 * sale at or below the fee is paid out in full rather than netting nothing.
 * A quirk, but it is the behaviour, and quoting a different number would
 * misprice the cheapest listings.
 */
export function sellerPayout(price: number, config: MarketConfig | undefined): number {
  const fee = processingFee(price, config)
  return price > fee ? price - fee : price
}

/* ---------- the clock ---------- */

export function endsAt(listing: { auction_end: string } | { offer_end: string }): number {
  const raw = 'auction_end' in listing ? listing.auction_end : listing.offer_end
  return Date.parse(raw + 'Z')
}

export function msLeft(listing: Parameters<typeof endsAt>[0], now = Date.now()): number {
  const end = endsAt(listing)
  return Number.isFinite(end) ? Math.max(0, end - now) : 0
}

export function hasEnded(listing: Parameters<typeof endsAt>[0], now = Date.now()): boolean {
  return msLeft(listing, now) <= 0
}

/** "1d 4h", "3h 12m", "48s" — coarse on purpose, this is a 48-hour clock. */
export function timeLeftLabel(ms: number): string {
  if (ms <= 0) return 'Ended'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

/**
 * Whether a bid now would push the closing time out.
 *
 * `bidauction` resets the end to `now + reset_duration_below_minutes` whenever
 * less than that remains, which at the live config means any bid in the final
 * twelve hours buys the auction another twelve. Sniping does not work here,
 * and the screen says so while it still matters.
 */
export function extendsOnBid(
  auction: Auction,
  config: MarketConfig | undefined,
  now = Date.now(),
): boolean {
  const window = Number(config?.reset_duration_below_minutes ?? 0) * 60_000
  if (window <= 0) return false
  return msLeft(auction, now) < window
}

/* ---------- what the player may do ---------- */

export interface Gate {
  ok: boolean
  reason?: string
}

export function canBid(
  auction: Auction,
  player: Player,
  config: MarketConfig | undefined,
  bid: number,
  now = Date.now(),
): Gate {
  if (hasEnded(auction, now)) return { ok: false, reason: 'This auction has ended' }
  if (auction.owner === player.wallet) {
    return { ok: false, reason: 'You cannot bid on your own auction' }
  }
  if (auction.current_bidder === player.wallet) {
    return { ok: false, reason: 'You already have the highest bid' }
  }
  const min = minNextBid(auction.current_bid, config)
  if (bid < min) return { ok: false, reason: `Bid at least ${min} gems` }
  if (player.activestats.gems < bid) {
    return { ok: false, reason: `You have ${player.activestats.gems} gems` }
  }
  return { ok: true }
}

export function canBuy(offer: InstantOffer, player: Player, now = Date.now()): Gate {
  if (hasEnded(offer, now)) return { ok: false, reason: 'This offer has expired' }
  if (offer.owner === player.wallet) {
    return { ok: false, reason: 'You cannot buy your own offer' }
  }
  if (player.activestats.gems < offer.gems) {
    return { ok: false, reason: `You have ${player.activestats.gems} gems` }
  }
  return { ok: true }
}

/**
 * Whether an auction can still be withdrawn.
 *
 * One bid and it is binding — `cancelauct` refuses outright once `bids` is
 * non-zero, with no way to buy out of it.
 */
export function canCancelAuction(auction: Auction, player: Player): Gate {
  if (auction.owner !== player.wallet) {
    return { ok: false, reason: 'Not your auction' }
  }
  if (Number(auction.bids) > 0) {
    return { ok: false, reason: 'Cannot cancel once somebody has bid' }
  }
  return { ok: true }
}

/**
 * Whether a fighter can be put up for auction.
 *
 * Mirrors the five checks in `addauction`, in its order, so the reason shown
 * is the reason the contract would have given.
 */
export function canList(
  fighter: RosterFighter | null,
  startPrice: number,
  player: Player,
  config: MarketConfig | undefined,
  now = Date.now(),
): Gate {
  if (!fighter) return { ok: false, reason: 'Pick a fighter to sell' }
  if (fighter.owner !== player.wallet) return { ok: false, reason: 'Not your fighter' }
  if (fighter.in_use) {
    return {
      ok: false,
      reason: fighter.use_type
        ? `Busy: ${fighter.use_type}`
        : 'This fighter is in use elsewhere',
    }
  }
  if (!fighter.active) return { ok: false, reason: 'This fighter is not active' }

  const payday = Date.parse(fighter.next_payday + 'Z')
  if (Number.isFinite(payday) && payday <= now) {
    return { ok: false, reason: 'This fighter wants a payday before it can be sold' }
  }

  const min = Number(config?.gems_min_start_bid ?? 0)
  if (startPrice < min) return { ok: false, reason: `Start at ${min} gems or more` }

  const cost = Number(config?.gems_listing_price ?? 0)
  if (player.activestats.gems < cost) {
    return { ok: false, reason: `Listing costs ${cost} gems` }
  }
  return { ok: true }
}

/**
 * Why an instant offer has no cancel button.
 *
 * `canceloffer` checks `gems == 0`, but `newoffer` always stores
 * `gems_instant_buy_price`, which is never zero — so the check can never pass
 * and the action always reverts. Offers can only run to their end, which is
 * the fighter's next payday. Surfaced rather than hidden, because a seller
 * looking for the button deserves to know it does not work rather than to
 * conclude the screen is missing it.
 */
export const OFFER_CANCEL_IS_BROKEN =
  'An instant offer cannot be withdrawn: the contract only allows it when the ' +
  'price is zero, which never happens. It ends on its own at the payday below.'

/* ---------- ordering the board ---------- */

/**
 * How a shopper wants the board arranged.
 *
 * Not the roster's sorts, which order fighters by stat — useful when picking
 * a team from fighters you already own, meaningless when the question is what
 * to spend gems on. What is being compared here is the *deal*: how long is
 * left and what it costs.
 */
export const MARKET_SORTS: { value: MarketSort; label: string }[] = [
  { value: 'ending', label: 'Ending soonest' },
  { value: 'newest', label: 'Newly listed' },
  { value: 'price-asc', label: 'Cheapest first' },
  { value: 'price-desc', label: 'Dearest first' },
  { value: 'damage', label: 'Damage' },
  { value: 'health', label: 'Health' },
  { value: 'taunt', label: 'Taunt' },
  { value: 'attackspeed', label: 'Cooldown' },
  { value: 'initiative', label: 'Windup' },
  { value: 'level', label: 'Level' },
]

export type MarketSort =
  | 'ending'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'health'
  | 'damage'
  | 'taunt'
  | 'attackspeed'
  | 'initiative'
  | 'level'

/**
 * Stats where a smaller number is the better fighter.
 *
 * Cooldown and wind-up are both delays, so sorting them "best first" means
 * ascending. Ordering them the same way as health would quietly put the worst
 * fighters at the top of the board.
 */
const LOWER_IS_BETTER = new Set<MarketSort>(['attackspeed', 'initiative'])

/** The midpoint of a banded stat — the roll to expect, as the card prints it. */
function statOf(listing: Auction | InstantOffer, field: string): number {
  const raw = listing.fighter as unknown as Record<string, number>
  if (field === 'level') return Number(raw.level ?? 0)
  const lo = Number(raw[`${field}_min`] ?? 0)
  const hi = Number(raw[`${field}_max`] ?? 0)
  return (lo + hi) / 2
}

/** What a listing currently costs: the standing bid, or the fixed price. */
export function listingPrice(listing: Auction | InstantOffer): number {
  return 'gems' in listing ? Number(listing.gems) : Number(listing.current_bid)
}

function startedAt(listing: Auction | InstantOffer): number {
  const raw = 'offer_start' in listing ? listing.offer_start : listing.auction_start
  const t = Date.parse(raw + 'Z')
  return Number.isFinite(t) ? t : 0
}

export function sortListings<T extends Auction | InstantOffer>(
  list: T[],
  sort: MarketSort,
  now = Date.now(),
): T[] {
  const out = [...list]
  switch (sort) {
    case 'price-asc':
      return out.sort((a, b) => listingPrice(a) - listingPrice(b))
    case 'price-desc':
      return out.sort((a, b) => listingPrice(b) - listingPrice(a))
    case 'newest':
      return out.sort((a, b) => startedAt(b) - startedAt(a))
    case 'ending':
      return out.sort((a, b) => msLeft(a, now) - msLeft(b, now))
    default: {
      /* Best first, whichever direction "best" runs in for this stat. */
      const flip = LOWER_IS_BETTER.has(sort) ? 1 : -1
      return out.sort((a, b) => flip * (statOf(a, sort) - statOf(b, sort)))
    }
  }
}

/* ---------- adapting a listing into the shared fighter panel ---------- */

/**
 * A listing wearing a roster fighter's shape.
 *
 * The auction and offer rows carry the same `Fighterstats` the roster does,
 * plus the same dates, so the existing panel can show a listed fighter in
 * full — abilities, resistances, grade arrows — without a second renderer.
 */
export function listingAsFighter(
  listing: Auction | InstantOffer,
): RosterFighter {
  return {
    fighter_id: listing.fighter_id,
    owner: listing.owner,
    classname: listing.fighter.classname,
    racename: listing.fighter.racename,
    role: '',
    element: listing.fighter.element,
    stats: listing.fighter,
    creation_date: listing.creation_date,
    last_payday: listing.last_payday,
    next_payday: listing.next_payday,
    marker: '',
    in_use: 1,
    use_type: 'Market',
    use_details: '',
    active: 1,
    final_deletion_date: '',
    ascension_level: listing.ascension_level,
    ascension_in_progress: listing.ascension_in_progress,
    ascension_upgrades: listing.ascension_upgrades,
  } as RosterFighter
}
