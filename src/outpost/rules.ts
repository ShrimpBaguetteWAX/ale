import { NUM_LOCALE } from '@/format'
import type {
  OfferTemplate,
  OutpostOffer,
  PointOffer,
  UserPoints,
} from './types'

/**
 * Shards are stored ten times their displayed size.
 *
 * A `required` of 1,000,000 on chain is 100,000 shards to a player. Every
 * comparison below is made on the raw values and only the printing is scaled,
 * so no rounding can decide whether a purchase is offered.
 */
export const SHARD_SCALE = 10

/**
 * Shards, as the Outpost writes them: whole numbers.
 *
 * The tenth is dropped rather than rounded. Every offer price on chain is a
 * multiple of ten and so prints exactly; a balance need not be, and flooring
 * can never tell a player they hold more than they do.
 */
export function formatShards(raw: number): string {
  return Math.floor(raw / SHARD_SCALE).toLocaleString(NUM_LOCALE)
}

/** WAX timestamps arrive without a zone and are UTC. */
const at = (stamp: string): number => Date.parse(stamp + 'Z')

export function hasStarted(offer: PointOffer, now = Date.now()): boolean {
  const t = at(offer.start)
  return !Number.isFinite(t) || t <= now
}

export function hasEnded(offer: PointOffer, now = Date.now()): boolean {
  const t = at(offer.end)
  return Number.isFinite(t) && t < now
}

export function isActive(offer: PointOffer, now = Date.now()): boolean {
  return hasStarted(offer, now) && !hasEnded(offer, now)
}

export interface OutpostBoard {
  /** Open now, soonest to close first — those are the ones running out. */
  active: OutpostOffer[]
  /** Not open yet, soonest to open first. */
  upcoming: OutpostOffer[]
}

/**
 * Split the offer list into what can be bought and what is coming.
 *
 * Ended offers are dropped entirely. The table keeps every offer ever made —
 * a hundred and fifty of them at the time of writing — and an expired one is
 * not a thing a player can act on or wait for.
 */
export function outpostBoard(
  offers: OutpostOffer[],
  now = Date.now(),
): OutpostBoard {
  const active: OutpostOffer[] = []
  const upcoming: OutpostOffer[] = []

  for (const entry of offers) {
    if (hasEnded(entry.offer, now)) continue
    if (hasStarted(entry.offer, now)) active.push(entry)
    else upcoming.push(entry)
  }

  active.sort((a, b) => at(a.offer.end) - at(b.offer.end) || a.offer.id - b.offer.id)
  upcoming.sort((a, b) => at(a.offer.start) - at(b.offer.start) || a.offer.id - b.offer.id)

  return { active, upcoming }
}

/** Spendable shards, raw. A wallet with no row has none. */
export function shardBalance(points: UserPoints | undefined): number {
  return points?.redeemable_points ?? 0
}

export interface Affordable {
  ok: boolean
  /** Short enough for the button. */
  reason?: string
  /** Raw shards still needed, when that is the blocker. */
  short?: number
}

/**
 * Whether this offer can be redeemed right now.
 *
 * Compared raw, in the units the contract holds, so the answer cannot
 * disagree with the chain over a tenth of a shard.
 */
export function canRedeem(
  entry: OutpostOffer,
  balance: number,
  registered: boolean,
  now = Date.now(),
): Affordable {
  if (!isActive(entry.offer, now)) return { ok: false, reason: 'Not open' }
  /*
     `uspts.worlds` keeps a row per wallet and `redeempntnft` reads it, so a
     wallet that has never mined in Alien Worlds has nothing to spend and no
     row to spend it from. Saying so beats letting the wallet pop up and fail.
  */
  if (!registered) return { ok: false, reason: 'No Outpost account' }
  if (balance < entry.offer.required) {
    return { ok: false, reason: 'Not enough shards', short: entry.offer.required - balance }
  }
  return { ok: true }
}

/** "in 3 days", "today" — how long until an upcoming offer opens. */
export function opensIn(offer: PointOffer, now = Date.now()): string {
  const days = Math.ceil((at(offer.start) - now) / 86_400_000)
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'today'
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

/** "3 days left", "last day" — how long an active offer has. */
export function closesIn(offer: PointOffer, now = Date.now()): string {
  const days = Math.ceil((at(offer.end) - now) / 86_400_000)
  if (!Number.isFinite(days)) return ''
  if (days <= 1) return 'last day'
  return `${days} days left`
}

/**
 * The artwork, from Alien Worlds' own IPFS gateway.
 *
 * These templates ship no local art — they are somebody else's NFTs — and
 * the immutable data carries only an IPFS hash, with no thumbnail field: just
 * `img` at full size and `backimg` for the card back.
 *
 * So these are the real thing, around 800KB of PNG each. Every card is
 * `loading="lazy"` for that reason: with fifty-odd offers on the tab, fetching
 * them all would be tens of megabytes, and only what is actually on screen
 * should cost anything.
 */
export function offerArt(template: OfferTemplate | undefined): string {
  if (!template?.img) return ''
  return 'https://ipfs.alienworlds.io/ipfs/' + encodeURIComponent(template.img)
}
