import type { KeyValue, Player } from '@/chain/types'
import type { CandleOffer } from './types'
import { asset } from '@/assets'

/**
 * How the candle works, from `recovery.ale`.
 *
 * A campaign puts up a **fixed** reward and splits it between contributors in
 * proportion to the gems they threw in:
 *
 *     yourShare = reward_amount / total_gems * yourGems
 *
 * That single line is the whole game, and it is the opposite of how these
 * screens usually read. Adding gems raises your share of the pot but lowers
 * what every gem in it is worth — including your own. So the number that
 * decides whether to contribute is not the reward, it is the reward *per
 * gem*, and it falls with every contribution anybody makes. The screen leads
 * with that rate and shows what a contribution would do to it.
 *
 * Taking part is gated rather than scored: `contribute` checks that the
 * player's lifetime `permstats[requirement_type]` is at least
 * `requirement_amount` and refuses outright otherwise. There is no partial
 * credit, so the screen says qualified or not.
 */

/** Token precisions, from the assets the contract builds. */
const PRECISION: Record<string, number> = { tlm: 4, wax: 8, shards: 1 }

export function precisionOf(type: string): number {
  return PRECISION[(type ?? '').toLowerCase()] ?? 0
}

/**
 * Decimal places to show for a given amount.
 *
 * Whole numbers, because that is what these figures are read as: a prize of
 * 12,450 TLM and a share of 609 are decisions, and ".0000" on the end of each
 * is four characters of noise on every one.
 *
 * The exception is the only case where rounding would destroy the number
 * rather than tidy it. Sub-one values — the worth of a single gem, a small
 * WAX payout — would round to "0" and report nothing at all, so those keep
 * enough places to say what they are.
 */
export function placesFor(value: number, type: string): number {
  if (!Number.isFinite(value) || Math.abs(value) >= 1) return 0
  return Math.min(precisionOf(type), 4)
}

/** The token's own precision, for anywhere the raw scale is wanted. */
export function displayPlaces(type: string): number {
  return precisionOf(type)
}

/** A stored reward amount as a real number of tokens. */
export function tokenAmount(raw: number, type: string): number {
  return Number(raw ?? 0) / Math.pow(10, precisionOf(type))
}

export function tokenSymbol(type: string): string {
  const t = (type ?? '').toLowerCase()
  if (t === 'tlm') return 'TLM'
  if (t === 'wax') return 'WAX'
  if (t === 'shards') return 'Shards'
  return t.toUpperCase()
}

export function tokenIcon(type: string): string {
  const t = (type ?? '').toLowerCase()
  if (t === 'wax') return asset('/assets/icons/wax-coin.png')
  if (t === 'shards') return asset('/assets/icons/shards.svg')
  return asset('/assets/icons/tlm.svg')
}

/* ---------- the offer ---------- */

export type OfferPhase = 'upcoming' | 'open' | 'closed'

export interface OfferState {
  phase: OfferPhase
  startsAt: number
  endsAt: number
  /** Milliseconds to the next boundary. */
  msLeft: number
}

export function offerState(offer: CandleOffer, now = Date.now()): OfferState {
  const startsAt = Date.parse(offer.offer_start + 'Z')
  const endsAt = Date.parse(offer.offer_end + 'Z')

  if (now <= startsAt) return { phase: 'upcoming', startsAt, endsAt, msLeft: startsAt - now }
  if (now > endsAt) return { phase: 'closed', startsAt, endsAt, msLeft: 0 }
  return { phase: 'open', startsAt, endsAt, msLeft: endsAt - now }
}

/** The campaign a player can act on: the open one, else the most recent. */
export function activeOffer(
  offers: CandleOffer[],
  now = Date.now(),
): CandleOffer | undefined {
  const open = offers.find((o) => offerState(o, now).phase === 'open')
  if (open) return open
  return [...offers].sort(
    (a, b) => Date.parse(b.offer_end + 'Z') - Date.parse(a.offer_end + 'Z'),
  )[0]
}

/**
 * Missions that have not opened yet, soonest first.
 *
 * The contract hands over every offer it holds in one read, so the ones still
 * to come are already in memory — showing them costs nothing, and knowing a
 * WAX mission opens in six hours is exactly the sort of thing that decides
 * whether to spend gems on the one running now.
 */
export function upcomingOffers(
  offers: CandleOffer[],
  now = Date.now(),
): CandleOffer[] {
  return offers
    .filter((o) => offerState(o, now).phase === 'upcoming')
    .sort((a, b) => Date.parse(a.offer_start + 'Z') - Date.parse(b.offer_start + 'Z'))
}

/* ---------- eligibility ---------- */

export function permstat(player: Player, key: string): number {
  const hit = (player.permstats as KeyValue[] | undefined)?.find((p) => p.first === key)
  return Number(hit?.second ?? 0)
}

export interface Eligibility {
  qualified: boolean
  have: number
  need: number
  /** How far off, when short. */
  short: number
}

export function eligibility(offer: CandleOffer, player: Player): Eligibility {
  const have = permstat(player, offer.requirement_type)
  const need = Number(offer.requirement_amount ?? 0)
  return { qualified: have >= need, have, need, short: Math.max(0, need - have) }
}

/* ---------- the split ---------- */

export interface Share {
  /** Gems this player has already put in. */
  mine: number
  /** Gems everyone has put in. */
  total: number
  /** Fraction of the pot currently owed to this player, 0–1. */
  fraction: number
  /** Tokens this player would receive if the campaign closed now. */
  payout: number
  /** Tokens each gem in the pot is currently worth. */
  perGem: number
}

export function shareOf(offer: CandleOffer, mine: number): Share {
  const total = Number(offer.total_gems ?? 0)
  const reward = tokenAmount(offer.reward_amount, offer.reward_type)
  const fraction = total > 0 ? mine / total : 0

  return {
    mine,
    total,
    fraction,
    payout: reward * fraction,
    perGem: total > 0 ? reward / total : 0,
  }
}

/**
 * What contributing `gems` more would leave you with.
 *
 * Both sides of the sum move: your own stake goes up and so does the pot, so
 * the honest projection has to add the gems to the denominator too. Quoting
 * the current rate times the new gems would overstate every contribution ever
 * made.
 */
export function projectShare(offer: CandleOffer, mine: number, gems: number): Share {
  const total = Number(offer.total_gems ?? 0) + gems
  const reward = tokenAmount(offer.reward_amount, offer.reward_type)
  const fraction = total > 0 ? (mine + gems) / total : 0

  return {
    mine: mine + gems,
    total,
    fraction,
    payout: reward * fraction,
    perGem: total > 0 ? reward / total : 0,
  }
}

/* ---------- time ---------- */

/** "6h 12m", "12m 30s", "2d 04h" — the countdown a day-long campaign needs. */
export function countdown(ms: number): string {
  if (ms <= 0) return 'now'

  const secs = Math.floor(ms / 1000)
  const d = Math.floor(secs / 86_400)
  const h = Math.floor((secs % 86_400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  if (d > 0) return `${d}d ${pad(h)}h`
  if (h > 0) return `${h}h ${pad(m)}m`
  return `${m}m ${pad(s)}s`
}
