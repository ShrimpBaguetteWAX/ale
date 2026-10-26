import { Fragment, useState } from 'react'
import { assetValue } from '@/account/rules'
import { chainTime } from '@/tournament/rules'
import { ago } from '@/farming/PhoneFarming'
import { formatDecimals, formatNumber, NUM_LOCALE } from '@/format'
import type { PaymentSource } from './rules'

/** How many of one source's payments open at first; the rest are a click away. */
const FIRST = 10

/**
 * The payments, one row per source, each opening into its payments.
 *
 * The history is here for the player who thinks a mine paid them nothing.
 * The sums say where the money came from; the open row answers them — every
 * payment with its time and the exact amount, to the last place, so it can
 * be matched against the wallet.
 */
export function SourceRows({
  sources,
  places,
  symbol,
  short,
}: {
  sources: PaymentSource[]
  places: number
  symbol: string
  short: (value: number) => string
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const now = Date.now()

  return (
    <>
      {sources.map((s) => {
        const isOpen = open === s.key
        const last = chainTime(s.payments[0]?.timestamp)
        const shown = all ? s.payments : s.payments.slice(0, FIRST)
        return (
          <Fragment key={s.key}>
            <button
              type="button"
              className={`prew__row prew__src${isOpen ? ' is-open' : ''}`}
              aria-expanded={isOpen}
              onClick={() => {
                setOpen(isOpen ? null : s.key)
                setAll(false)
              }}
            >
              <img src={s.icon} alt="" />
              <span className="prew__rowtext">
                <strong>{s.label}</strong>
                <small>
                  {formatNumber(s.count)} payment{s.count === 1 ? '' : 's'}
                  {Number.isFinite(last) && ` · last ${ago(now - last)}`}
                </small>
              </span>
              <span className="prew__amount mono">{short(s.total)}</span>
              <span className="prew__chev" aria-hidden="true" />
            </button>
            {isOpen && (
              <ol className="prew__paid">
                {shown.map((p) => {
                  const at = chainTime(p.timestamp)
                  return (
                    <li key={p.index}>
                      <span className="prew__paidwhen">
                        <b>{when(at)}</b>
                        <small>{ago(now - at)}</small>
                      </span>
                      <span className="prew__paidamt mono">
                        {formatDecimals(assetValue(p.reward), places)} {symbol}
                      </span>
                    </li>
                  )
                })}
                {!all && s.payments.length > FIRST && (
                  <li className="prew__paidmore">
                    <button type="button" className="btn btn--sm" onClick={() => setAll(true)}>
                      Show {formatNumber(s.payments.length - FIRST)} more
                    </button>
                  </li>
                )}
              </ol>
            )}
          </Fragment>
        )
      })}
    </>
  )
}

/** The player's own clock: "Sun, Oct 26, 2:32 PM". */
function when(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleString(NUM_LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
