import { usePhone } from '@/components/usePhone'

/**
 * Which look the desktop matchup wears, in Dungeons and the Arena.
 *
 *   'hud'   — each fighter a round medallion, the chance to win a gauge with
 *             the head-to-head under it (since 28 October 2026)
 *   'cards' — the leaning cards with the chance between them, as before
 *
 * To go back, set DEFAULT_STYLE to 'cards': nothing else needs to change,
 * both looks live side by side. To compare without a build, set
 * localStorage 'matchup-style' to 'cards' or 'hud' and reload. A phone keeps
 * the cards either way.
 */
export type MatchupStyle = 'hud' | 'cards'

const DEFAULT_STYLE: MatchupStyle = 'hud'

export function matchupStyle(): MatchupStyle {
  try {
    const own = localStorage.getItem('matchup-style')
    if (own === 'hud' || own === 'cards') return own
  } catch {
    /* storage blocked: the default stands */
  }
  return DEFAULT_STYLE
}

/** True where the medallions are drawn: a desktop, with the HUD look on. */
export function useMatchupHud(): boolean {
  const phone = usePhone()
  return !phone && matchupStyle() === 'hud'
}
