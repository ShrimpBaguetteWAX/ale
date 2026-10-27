import { useEffect, useState } from 'react'
import { asset } from '@/assets'
import { formatCompact } from '@/format'
import { fetchWeeklyPrizes, type WeeklyPrizes } from './weekly'

/** Last week's prizes, once read; undefined until then or if the read fails. */
export function useWeeklyPrizes(): WeeklyPrizes | undefined {
  const [prizes, setPrizes] = useState<WeeklyPrizes>()
  useEffect(() => {
    let live = true
    fetchWeeklyPrizes()
      .then((p) => live && setPrizes(p))
      .catch(() => {
        /* No history server answered: the prizes simply stay hidden. */
      })
    return () => {
      live = false
    }
  }, [])
  return prizes
}

const TOKENS = [
  { key: 'tlm', label: 'TLM', icon: '/assets/icons/tlm.svg' },
  { key: 'shards', label: 'Shards', icon: '/assets/icons/shards.svg' },
  { key: 'wax', label: 'WAX', icon: '/assets/icons/wax-coin.webp' },
] as const

/**
 * The landing page's prize strip, under Play: the three tokens big enough
 * to be recognised at a glance by anyone who knows Alien Worlds or WAX,
 * before they know anything about this game.
 */
export function PrizeStrip() {
  const p = useWeeklyPrizes()
  if (!p) return null
  return (
    <div className="prizestrip">
      <div className="prizestrip__head">
        <b>Weekly prizes</b>
        <span>Paid into the reward pools last week</span>
      </div>
      <div className="prizestrip__row">
        {TOKENS.map((t) => (
          <div className={`prizestrip__tok is-${t.key}`} key={t.key}>
            <img src={asset(t.icon)} alt="" />
            <span>
              <b>{formatCompact(Math.round(p[t.key]))}</b>
              <small>{t.label}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The game's prize card: at the foot of the desktop menu, and at the head
 * of the phone's More page: last week's three prizes, for reading only.
 */
export function PrizeCard({ className = '' }: { className?: string }) {
  const p = useWeeklyPrizes()
  if (!p) return null
  return (
    <div className={`prizecard ${className}`.trim()} title="Paid into the reward pools last week, Monday to Sunday UTC">
      <span className="prizecard__head">
        <b>Weekly prizes</b>
      </span>
      {TOKENS.map((t) => (
        <span className={`prizecard__row is-${t.key}`} key={t.key}>
          <img src={asset(t.icon)} alt="" />
          <span>{t.label}</span>
          <b>{formatCompact(Math.round(p[t.key]))}</b>
        </span>
      ))}
    </div>
  )
}
