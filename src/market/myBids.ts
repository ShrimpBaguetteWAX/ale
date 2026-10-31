import { CONTRACTS } from '@/chain/config'
import { historyActions } from '@/chain/history'

/**
 * The auctions a player has bid on, so My listings can show the ones they
 * were outbid on while those are still running.
 *
 * The auction row keeps only the standing bid and its bidder, so a bid that
 * has been topped leaves no trace on the table. Two sources make up for it:
 *
 *   * The chain's history: every `bidauction` the wallet signed in the last
 *     fortnight (an auction runs two days, and bids late in it push the end
 *     out, so a fortnight covers any still running). Filtered by the signer,
 *     the one filter the indexers apply to this contract's actions.
 *   * This browser's own note of the bids it placed, so a bid shows the
 *     moment it lands rather than when an indexer catches up, and the list
 *     still works when no indexer answers.
 */

const DAY = 86_400_000
const WINDOW = 14 * DAY
const key = (wallet: string) => `ale.market.bids.${wallet}`

/** The auctions this browser bid on for `wallet`, with when; older than the window dropped. */
function noted(wallet: string): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(key(wallet)) ?? '{}') as Record<string, number>
    const since = Date.now() - WINDOW
    return Object.fromEntries(Object.entries(raw).filter(([, at]) => typeof at === 'number' && at > since))
  } catch {
    return {}
  }
}

/** Notes a bid placed from here. */
export function rememberBid(wallet: string, auctionId: number): void {
  try {
    localStorage.setItem(key(wallet), JSON.stringify({ ...noted(wallet), [auctionId]: Date.now() }))
  } catch {
    /* Storage refused: the history still has it, a little later. */
  }
}

/** The ids of every auction `wallet` bid on in the last fortnight. */
export async function fetchBidAuctionIds(wallet: string): Promise<number[]> {
  const ids = new Set(Object.keys(noted(wallet)).map(Number))
  const now = Date.now()
  try {
    const rows = await historyActions<{ auction_id?: number | string }>(
      {
        account: CONTRACTS.market,
        filter: `${CONTRACTS.market}:bidauction`,
        'act.authorization.actor': wallet,
      },
      now - WINDOW,
      now + 60_000,
    )
    for (const r of rows) {
      const id = Number(r.act.data.auction_id)
      if (Number.isFinite(id)) ids.add(id)
    }
  } catch {
    /* No indexer answered: the bids noted here are all there is to show. */
  }
  return [...ids]
}
