import { useMemo, useState } from 'react'
import type { RosterFighter } from '@/dungeon/types'
import { BottomSheet } from '@/components/BottomSheet'
import { useConfig, useConfigStore } from '@/state/useConfig'
import { FighterCodex, PanelCodex, figuresOf } from '@/fighters/DeskRoster'
import type { PanelFighter } from '@/components/FighterPanel'
import type { ClassTemplate } from '@/tavern/fighterStats'

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

/**
 * A fighter in full on a phone: the codex page in a bottom sheet, at My
 * Fighters' phone size. Every screen that opens one of the player's own
 * fighters (or a listing) in full opens this, so a fighter reads the same
 * wherever it is looked at.
 */
export function CodexSheet({
  f,
  kick,
  upkeep = true,
  onClose,
}: {
  f: RosterFighter
  /** The line over the name; the fighter's state when not given. */
  kick?: string
  /** The age, payday and pay-now line; off for a listing, whose payday is not the viewer's. */
  upkeep?: boolean
  onClose: () => void
}) {
  const { classes, fighters, levelMod, ageDecay } = useConfig()
  const levels = useConfigStore((c) => c.levels)
  const [now] = useState(() => Date.now())
  const fig = useMemo(
    () => figuresOf(f, classes.get(f.classname), fighters, levelMod, ageDecay, now, false),
    [f, classes, fighters, levelMod, ageDecay, now],
  )
  return (
    <BottomSheet title={`${cap(f.racename)} ${cap(f.classname)}`} onClose={onClose}>
      {/* The phone codex's sizes come with My Fighters' phone class. */}
      <div className="drost--phone codexsheet">
        <FighterCodex f={f} fig={fig} config={fighters} levels={levels} now={now} kick={kick} upkeep={upkeep} />
      </div>
    </BottomSheet>
  )
}

/** Someone else's fighter (an opponent, the NFT fighter) as the same codex page, from its panel figures. */
export function PanelCodexSheet({
  panel,
  template,
  onClose,
}: {
  panel: PanelFighter
  template?: ClassTemplate
  onClose: () => void
}) {
  const name = panel.title ?? `${cap(panel.racename)} ${cap(panel.classname)}`
  return (
    <BottomSheet title={name} onClose={onClose}>
      <div className="drost--phone codexsheet">
        <PanelCodex panel={panel} template={template} />
      </div>
    </BottomSheet>
  )
}
