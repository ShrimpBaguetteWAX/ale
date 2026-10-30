import { useEffect, useState } from 'react'
import { useGame } from '@/state/useGame'
import { useChainQuery } from '@/chain/useChainQuery'
import { useAction } from '@/wharf/useAction'
import { DIRTIES, swapTlmForWax } from '@/wharf/actions'
import { asset } from '@/assets'
import { NUM_LOCALE } from '@/format'
import { fetchSwapBalances, fetchSwapQuote, type SwapQuote } from './swap'

/** How often an untouched quote is asked for again. */
const REQUOTE_MS = 15_000

const num = (n: number, digits: number) =>
  n.toLocaleString(NUM_LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })

/**
 * The Swap tab: TLM in, WAX out, through Alcor.
 *
 * Just the swap — what you pay, what you get, the rate and the least it will
 * pay, and one button. The quote follows the amount as it is typed and is
 * asked for again while the tab sits open, so the button never signs a price
 * older than a few seconds.
 */
export function SwapTab() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)
  const { busy, error, run } = useAction()

  const balances = useChainQuery(player.wallet && `swap:${player.wallet}`, () =>
    fetchSwapBalances(player.wallet),
  )
  const tlmBalance = balances.data?.tlm ?? 0
  const waxBalance = balances.data?.wax ?? 0

  const [text, setText] = useState('')
  /* TLM has four decimals; anything past them is not a TLM amount. */
  const tlm = Math.floor((parseFloat(text) || 0) * 10_000) / 10_000

  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setRound((r) => r + 1), REQUOTE_MS)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    setQuoteError(null)
    if (!(tlm > 0)) {
      setQuote(null)
      return
    }
    const ctl = new AbortController()
    /* Typing is not asking: wait for a pause before going to the router. */
    const wait = setTimeout(() => {
      fetchSwapQuote(tlm, player.wallet, ctl.signal).then(setQuote, (err: Error) => {
        if (ctl.signal.aborted) return
        setQuote(null)
        setQuoteError(err.message)
      })
    }, 350)
    return () => {
      clearTimeout(wait)
      ctl.abort()
    }
  }, [tlm, player.wallet, round])

  /* A quote for another amount is on its way out, not a price for this one. */
  const live = quote && quote.tlm === tlm ? quote : null
  const over = tlm > tlmBalance

  const label = !(tlm > 0)
    ? 'Enter an amount'
    : over
      ? 'Not enough TLM'
      : quoteError
        ? quoteError
        : !live
          ? 'Getting a price…'
          : 'Swap'

  const swap = () => {
    if (!live) return
    void run(
      'swap',
      () => swapTlmForWax(session!, { tlm: live.tlm, memo: live.memo }),
      `Swapped ${num(live.tlm, 2)} TLM for ${num(live.wax, 2)} WAX.`,
      {
        after: balances.reload,
        settled: (fresh) => !!fresh && fresh.tlm < tlmBalance - live.tlm / 2,
        dirties: DIRTIES.swapTlmForWax,
        onSettled: () => setText(''),
      },
    )
  }

  return (
    <div className="swap">
      {error && <div className="alert alert--error">{error}</div>}

      <div className="swap__field">
        <div className="swap__top">
          <span>You pay</span>
          <button type="button" className="swap__max" onClick={() => setText(String(tlmBalance))}>
            Balance <span className="mono">{num(tlmBalance, 2)}</span>
            <b>Max</b>
          </button>
        </div>
        <div className="swap__row">
          <input
            className="swap__amount mono"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="0"
            value={text}
            aria-label="TLM to swap"
            onChange={(e) => setText(e.target.value)}
          />
          <span className="swap__coin">
            <img src={asset('/assets/icons/tlm.svg')} alt="" width={20} height={20} />
            TLM
          </span>
        </div>
      </div>

      <div className="swap__arrow" aria-hidden="true">
        <i>↓</i>
      </div>

      <div className="swap__field">
        <div className="swap__top">
          <span>You get</span>
          <span className="swap__bal">
            Balance <span className="mono">{num(waxBalance, 2)}</span>
          </span>
        </div>
        <div className="swap__row">
          <output className={`swap__amount mono${live ? '' : ' swap__amount--wait'}`}>
            {live ? num(live.wax, 2) : quote && tlm > 0 ? num(quote.wax, 2) : '0'}
          </output>
          <span className="swap__coin">
            <img src={asset('/assets/icons/wax-coin.webp')} alt="" width={20} height={20} />
            WAX
          </span>
        </div>
      </div>

      <dl className="swap__info">
        <div>
          <dt>Rate</dt>
          <dd>{live ? `1 TLM = ${num(live.wax / live.tlm, 4)} WAX` : '—'}</dd>
        </div>
        <div>
          <dt>You get at least</dt>
          <dd>{live ? `${num(live.minWax, 4)} WAX` : '—'}</dd>
        </div>
      </dl>

      <button
        type="button"
        className="btn btn--gold btn--block swap__go"
        onClick={swap}
        disabled={!live || over || busy === 'swap' || !session}
      >
        {busy === 'swap' && <span className="spinner" />}
        {label}
      </button>
    </div>
  )
}
