import { useEffect, useState } from 'react'
import { fetchMineHistory } from '@/pools/queries'
import { CURRENCY_ICON, CURRENCY_LABEL, type Currency } from '@/account/rules'

/**
 * What a mine paid, celebrated.
 *
 * A claim spends a run's worth of Reward Power and the screen used to say
 * "Mined." — the one number the player was mining for went into a balance and
 * was never named.
 */

export interface MinedReward {
  currency: Currency
  /** Already in display units, written the way the token is written. */
  amount: string
}

/** How long to keep asking before giving up on the receipt. */
const ATTEMPTS = 8
const INTERVAL_MS = 900

/**
 * What this claim paid, from the contract's own record of it.
 *
 * `pools.ale` / `rwrdhistory` is keyed by the `history_id` the claim carries,
 * so the answer belongs to this transaction rather than to whatever else
 * happened around it — and it is exact, where a percentage of the pot
 * computed a moment earlier is only nearly right.
 *
 * It is also the record every player has. The reward ledger on `rwrdlog.ale`
 * keeps a per-wallet history up to a capacity bought with gems, so an account
 * that has never unlocked a row has nothing there to read back; this table
 * has a row for every claim regardless of that.
 *
 * The contract writes it a beat after the transaction returns, so this polls.
 * Finding nothing is not an error — the mine still happened and the balances
 * are the proof; it just means there is no receipt to show.
 */
export async function readMinedRewards(historyId: string): Promise<MinedReward[]> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS))

    const row = await fetchMineHistory(historyId).catch(() => undefined)
    if (!row) continue

    const out: MinedReward[] = []

    /* An eosio asset, already written the way the token is written. */
    const tlm = String(row.total_tlm ?? '').split(' ')[0]
    if (Number(tlm) > 0) out.push({ currency: 'tlm', amount: tlm })

    /* Shards are raw, in their own single decimal place: 1022 is 102.2. */
    const shards = Number(row.total_shards ?? 0)
    if (shards > 0) {
      out.push({ currency: 'shrds', amount: trimZero((shards / 10).toFixed(1)) })
    }

    if (out.length) return out
  }

  return []
}

/** "102.0" reads worse than "102"; "102.2" has to keep its place. */
function trimZero(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value
}

export function MineCelebration({
  rewards,
  onClose,
}: {
  rewards: MinedReward[]
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

        {/*
          The figure and its token, and nothing else. Which pool it came from
          is on the screen behind this one either way, and a player who has
          just mined wants to know how much.
        */}
        <div className="minecheer__rewards">
          {rewards.map((r) => (
            <div className="minecheer__reward" key={r.currency}>
              <img
                className="minecheer__icon"
                src={CURRENCY_ICON[r.currency]}
                alt=""
                width={28}
                height={28}
              />
              <span className="minecheer__amount mono">{r.amount}</span>
              <span className="minecheer__ticker">{CURRENCY_LABEL[r.currency]}</span>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
