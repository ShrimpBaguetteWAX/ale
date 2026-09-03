import { useEffect, useState } from 'react'
import {
  fetchRewardLog,
  type RewardLogEntry,
} from '@/account/queries'
import { CURRENCIES, CURRENCY_ICON, CURRENCY_LABEL, type Currency } from '@/account/rules'

/**
 * What a mine actually paid, read back from the chain and celebrated.
 *
 * The player spends a run's Reward Power on a claim and the screen said
 * "Mined." — the one number they were mining for went straight into a balance
 * in the top bar and was never named. The estimate beside the bar is a
 * projection; this is the receipt.
 *
 * It reads the reward ledger rather than computing the payout, because the
 * pool moves between the estimate and the transaction: another player mining
 * the same pool a block earlier changes what is left, and quoting the
 * projection back as though it were the result would be wrong exactly when a
 * player is most interested.
 */

/** How long to keep asking the ledger before giving up on the receipt. */
const ATTEMPTS = 8
const INTERVAL_MS = 900

/**
 * Rows written since `since`, for the currencies a claim could have paid.
 *
 * The contract settles a beat after the transaction returns, so this polls;
 * an empty answer at the end is not an error — the mine still happened, and
 * the balances in the bar are the proof. It just means no receipt to show.
 */
export async function readMinedRewards(
  wallet: string,
  currencies: readonly Currency[],
  since: number,
): Promise<RewardLogEntry[]> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS))
    const pages = await Promise.all(
      currencies.map((c) =>
        fetchRewardLog(wallet, c, 12, true).catch(() => [] as RewardLogEntry[]),
      ),
    )
    const fresh = pages
      .flat()
      /* Timestamps are UTC without the marker, as everywhere else on chain. */
      .filter((r) => Date.parse(r.timestamp + 'Z') >= since)
    if (fresh.length) {
      return fresh.sort(
        (a, b) => Date.parse(b.timestamp + 'Z') - Date.parse(a.timestamp + 'Z'),
      )
    }
  }
  return []
}

/** The currency a ledger row belongs to, when it is one this app knows. */
function currencyOf(row: RewardLogEntry): Currency | null {
  return (CURRENCIES as readonly string[]).includes(row.type)
    ? (row.type as Currency)
    : null
}

export function MineCelebration({
  rewards,
  onClose,
}: {
  rewards: RewardLogEntry[]
  onClose: () => void
}) {
  /*
     Held back a frame so the panel animates in rather than appearing already
     placed, which is the difference between a reward and a dialog.
  */
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setShown(true), 20)
    return () => clearTimeout(id)
  }, [])

  /* Escape closes it: it is a celebration, not a decision. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="minecheer" role="dialog" aria-label="Mining rewards" onClick={onClose}>
      <div
        className={`minecheer__panel${shown ? ' minecheer__panel--in' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="minecheer__burst" aria-hidden="true" />

        <h2 className="minecheer__title">Mined</h2>
        <p className="minecheer__sub">Paid out to your balance</p>

        <div className="minecheer__rewards">
          {rewards.map((r) => {
            const currency = currencyOf(r)
            /* `reward` is an eosio asset — "13.6764 TLM" — so the figure and
               its ticker are already formatted the way the chain states them. */
            const [amount, ticker] = r.reward.split(' ')
            return (
              <div className="minecheer__reward" key={r.index}>
                {currency && (
                  <img
                    className="minecheer__icon"
                    src={CURRENCY_ICON[currency]}
                    alt={CURRENCY_LABEL[currency]}
                    width={28}
                    height={28}
                  />
                )}
                <span className="minecheer__amount mono">{amount}</span>
                <span className="minecheer__ticker">{ticker}</span>
                <span className="minecheer__pool">{r.pool_description || r.pool}</span>
              </div>
            )
          })}
        </div>

        <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
          Collect
        </button>
      </div>
    </div>
  )
}
