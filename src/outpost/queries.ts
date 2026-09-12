import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { fetchTemplateData } from '@/chain/atomic'
import { TTL } from '@/chain/cache'
import type { OfferTemplate, OutpostOffer, PointOffer, UserPoints } from './types'

/**
 * Every offer the Outpost has ever run.
 *
 * The table has no index on the dates, so there is no way to ask the chain
 * for "the open ones" — it is read whole and split by `outpostBoard`. Around
 * two hundred rows at the time of writing, of which fifty-odd matter, and the
 * team adds a handful a week: cached for ten minutes because an offer's start
 * is a date rather than a moment, and nobody is racing the clock on one.
 */
export function fetchPointOffers(refresh = false): Promise<PointOffer[]> {
  return getAllRows<PointOffer>(
    { code: CONTRACTS.outpost, scope: CONTRACTS.outpost, table: 'pointoffers' },
    { ttl: TTL.medium, refresh },
  )
}

/**
 * The wallet's shard row, or undefined when it has none.
 *
 * Undefined is the ordinary state for a player who has never mined in Alien
 * Worlds — not a failure. `redeempntnft` reads this same row, so its absence
 * is also what says a purchase would be refused.
 */
export function fetchUserPoints(
  wallet: string,
  refresh = false,
): Promise<UserPoints | undefined> {
  return getRow<UserPoints>(
    {
      code: CONTRACTS.outpost,
      scope: CONTRACTS.outpost,
      table: 'userpoints',
      key: wallet,
    },
    { ttl: TTL.live, refresh },
  )
}

/**
 * The offers, each with whatever AtomicAssets knows about its NFT.
 *
 * Only the templates named by offers that are still open or still coming are
 * looked up: the expired hundred and fifty would treble the request for
 * artwork nobody can see. An offer whose template does not resolve still
 * appears — the price and the dates are on chain and are the substance; the
 * name and the picture are decoration this cannot insist on.
 */
export async function fetchOutpostOffers(
  live: PointOffer[],
): Promise<OutpostOffer[]> {
  if (live.length === 0) return []

  let templates = new Map<number, OfferTemplate>()
  try {
    const raw = await fetchTemplateData(live.map((o) => o.template_id))
    for (const [id, row] of raw) {
      const d = row.data
      templates.set(id, {
        template_id: id,
        name: row.name || String(d.name ?? ''),
        rarity: String(d.rarity ?? ''),
        shine: String(d.shine ?? ''),
        kind: String(d.type ?? ''),
        img: String(d.img ?? ''),
      })
    }
  } catch {
    /* AtomicAssets is a separate service from the chain the prices live on.
       Losing it costs the artwork and the names, not the shop. */
    templates = new Map()
  }

  return live.map((offer) => ({ offer, template: templates.get(offer.template_id) }))
}
