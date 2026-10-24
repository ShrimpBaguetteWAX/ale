import { useEffect, useRef, useState } from 'react'
import { CURRENCY_ICON, CURRENCY_LABEL } from '@/account/rules'
import { useSwipeToClose } from '@/components/useSwipeToClose'
import type { MinedReward } from './MineCelebration'

/** One mine, from the tap to the receipt. */
export interface MineToastState {
  /** What was mined: a pool's name, or what the claim was for. */
  label: string
  /** Mines spent in this one signature. */
  times: number
  /** Null while the chain answers; empty when no receipt could be read. */
  rewards: MinedReward[] | null
}

/* Long enough to read one row; a second longer for each further row. */
const SHOW_MS = 5000
const PER_ROW_MS = 1000

/**
 * What a mine paid, as a toast rather than a dialog.
 *
 * It appears the moment Mine is tapped, saying what is being mined, so the
 * seconds the chain takes to answer are not seconds of nothing. When the
 * receipt arrives it becomes the result: one row per currency the mine paid,
 * the amount in gold. Then it goes by itself — later for more rows, never
 * while a finger or the pointer is on it — or with ×, or a swipe down.
 *
 * The receipt only knows a total per currency, so Mine ×3 is one row per
 * currency for all three, not a row per mine. TLM and Shards are never added
 * together: they are different things.
 */
export function MineToast({
  state,
  onClose,
}: {
  state: MineToastState
  onClose: () => void
}) {
  const { label, times, rewards } = state
  const panel = useRef<HTMLDivElement>(null)
  const { grip } = useSwipeToClose(onClose, panel)
  const [held, setHeld] = useState(false)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  const rows = rewards?.length ?? 0
  const life = SHOW_MS + PER_ROW_MS * Math.max(0, rows - 1)

  /*
     The countdown runs once the result is in, and starts over from full
     whenever it is let go of — a player who stopped to read should get the
     whole time again, not whatever was left.
  */
  useEffect(() => {
    if (rewards === null || held) return
    const id = window.setTimeout(() => close.current(), life)
    return () => window.clearTimeout(id)
  }, [rewards, held, life])

  return (
    <div
      className={`minetoast${rewards ? ' minetoast--done' : ''}`}
      ref={panel}
      role="status"
      aria-live="polite"
      {...grip}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onPointerDown={(e) => {
        setHeld(true)
        grip.onPointerDown(e)
      }}
      onPointerUp={() => {
        setHeld(false)
        grip.onPointerUp()
      }}
      onPointerCancel={() => {
        setHeld(false)
        grip.onPointerCancel()
      }}
    >
      <div className="minetoast__head">
        <strong>{rewards ? (times > 1 ? `Mined ×${times}` : 'Mined') : 'Mining…'}</strong>
        <button
          type="button"
          className="minetoast__x"
          aria-label="Close"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {rewards === null ? (
        <div className="minetoast__row">
          <span className="spinner" />
          <span className="minetoast__what">{label}</span>
        </div>
      ) : rewards.length === 0 ? (
        /* The mine went through; only the receipt could not be read back. */
        <div className="minetoast__row">
          <span className="minetoast__what">{label} · paid to your balance</span>
        </div>
      ) : (
        rewards.map((r) => (
          <div className="minetoast__row" key={r.currency}>
            <img src={CURRENCY_ICON[r.currency]} alt="" width={18} height={18} />
            <span className="minetoast__what">{label}</span>
            <b className="minetoast__amount mono">
              +{r.amount} {CURRENCY_LABEL[r.currency]}
            </b>
          </div>
        ))
      )}

      {rewards !== null && !held && (
        <i className="minetoast__time" style={{ animationDuration: `${life}ms` }} aria-hidden="true" />
      )}
    </div>
  )
}
