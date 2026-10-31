import { useCallback, useState } from 'react'
import type { RosterFighter } from '@/dungeon/types'
import { HoverPopover, useHoverCard } from '@/components/HoverPopover'
import { FighterHoverCard } from '@/components/FighterPanel'
import { rosterPanel } from '@/fight/setup'
import { useConfig, useConfigStore } from '@/state/useConfig'
import { usePhone } from '@/components/usePhone'
import { levelUpOf } from '@/fighters/rules'
import { RosterCardFace, type Ribbon } from '@/fighters/RosterCard'

/**
 * A fighter that shows itself in full on a resting pointer: the overlay the
 * desktop pickers open, so a compact card can be read before it is chosen
 * while a click still chooses it. Nothing on a phone, which has no hover;
 * there a tap opens the fighter as it always has.
 */
export function FighterPeek({
  fighter,
  className,
  children,
}: {
  fighter: RosterFighter
  className?: string
  children: React.ReactNode
}) {
  const phone = usePhone()
  const { classes, levelMod, ageDecay } = useConfig()
  const make = useCallback(
    () => ({ panel: rosterPanel(fighter, levelMod, ageDecay), template: classes.get(fighter.classname) }),
    [fighter, levelMod, ageDecay, classes],
  )
  const { ref, shown, close, handlers } = useHoverCard(make, !phone)
  return (
    <div className={className ?? 'fpeek'} ref={ref} {...handlers} onClick={close}>
      {children}
      {shown && (
        <HoverPopover anchor={shown.rect}>
          <FighterHoverCard fighter={shown.value.panel} template={shown.value.template} />
        </HoverPopover>
      )}
    </div>
  )
}

/**
 * A fighter as a compact card on a screen that otherwise shows the holder:
 * the battle's gilded card, picked in gold, with the overlay on hover and
 * whatever the screen adds under it (the Market's price, Ascension's
 * sockets) on a small plate.
 */
export function CompactPick({
  f,
  picked,
  onClick,
  ribbon = null,
  below,
  dim = false,
  title,
  tick,
}: {
  f: RosterFighter
  picked: boolean
  onClick: () => void
  ribbon?: Ribbon | null
  below?: React.ReactNode
  /** Still a choice, but a second one: Ascension's fighter already in another socket. */
  dim?: boolean
  title?: string
  /** A tick over the portrait's corner: the Market's bulk listing. */
  tick?: React.ReactNode
}) {
  const levels = useConfigStore((c) => c.levels)
  const level = levelUpOf(f, levels)
  return (
    <FighterPeek fighter={f} className="cpick">
      <button
        type="button"
        className={['rocard', picked ? 'is-picked' : '', dim ? 'is-dim' : ''].filter(Boolean).join(' ')}
        onClick={onClick}
        aria-pressed={picked}
        aria-label={title ?? `${f.classname} · ${f.racename} · L${f.stats.level}`}
      >
        <RosterCardFace
          f={f}
          ribbon={ribbon}
          xp={level.xpPercent / 100}
          max={levels.length > 0 && level.atMax}
        />
        {tick}
      </button>
      {below && <div className="cpick__below">{below}</div>}
    </FighterPeek>
  )
}

/** A screen's choice between the holder and the compact card, remembered on the device per screen. */
export type Density = 'cards' | 'compact'

export function useDensity(screen: string): [Density, (d: Density) => void] {
  const phone = usePhone()
  const key = `ale.${screen}.density.${phone ? 'phone' : 'desk'}`
  const read = (): Density => {
    try {
      const v = localStorage.getItem(key)
      if (v === 'cards' || v === 'compact') return v
    } catch {
      /* Storage refused (a private window): the default. */
    }
    return 'cards'
  }
  const [density, setDensity] = useState<Density>(read)
  const choose = (d: Density) => {
    setDensity(d)
    try {
      localStorage.setItem(key, d)
    } catch {
      /* Not remembered; still applied. */
    }
  }
  return [density, choose]
}
