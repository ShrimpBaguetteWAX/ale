import { useEffect, useRef, useState } from 'react'
import type { Player } from '@/chain/types'
import { NUM_LOCALE } from '@/format'

function compact(n: number): string {
  if (n < 10_000) return n.toLocaleString(NUM_LOCALE)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0)}K`
  return `${(n / 1_000_000).toFixed(2)}M`
}

/** Briefly flag a value that just changed, so spends and rewards register. */
function useBump(value: number): boolean {
  const [bumped, setBumped] = useState(false)
  const prev = useRef(value)

  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setBumped(true)
    const id = setTimeout(() => setBumped(false), 450)
    return () => clearTimeout(id)
  }, [value])

  return bumped
}

/**
 * One currency, as a HUD chip.
 *
 * `tone` is the whole point of the markup: each currency owns a colour, and
 * the socket rim, the underline and the change flare all take it. Three
 * identical grey pills made the bar read as a dashboard — a glance had to
 * decode the icons to know which number was which.
 *
 * The chip leans by the same angle the combat cards do and the contents lean
 * back, so the numbers stay upright. That is the game's existing angled
 * vocabulary rather than a second one invented for the frame.
 */
function Res({
  icon,
  label,
  value,
  tone,
}: {
  icon: string
  label: string
  value: number
  tone: 'energy' | 'gems' | 'credits'
}) {
  const bumped = useBump(value)
  return (
    <span
      className={`res res--${tone}${bumped ? ' res--bumped' : ''}`}
      title={`${label}: ${value.toLocaleString(NUM_LOCALE)}`}
    >
      <span className="res__inner">
        <span className="res__socket">
          <img className="res__icon" src={icon} alt="" width={22} height={22} />
        </span>
        <span className="res__value">{compact(value)}</span>
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** Energy, gems and credits — the three currencies `spendcur` moves. */
export function ResourceStrip({ player }: { player: Player }) {
  const s = player.activestats
  return (
    <div className="resources">
      <Res
        icon="/assets/icons/energy.png"
        label="Action points"
        value={s.action_points}
        tone="energy"
      />
      <Res icon="/assets/icons/gems.png" label="Gems" value={s.gems} tone="gems" />
      <Res
        icon="/assets/icons/credits.png"
        label="Credits"
        value={s.credits}
        tone="credits"
      />
    </div>
  )
}
