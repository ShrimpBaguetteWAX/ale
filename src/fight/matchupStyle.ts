import { createContext, useContext } from 'react'

/**
 * Which look the matchup wears, in Dungeons and the Arena, on a desktop and
 * a phone alike.
 *
 *   'hud'   — each fighter a round medallion, the chance to win a gauge with
 *             the head-to-head beside it, the page's header on the page and
 *             every tool on the board's foot (since 28 October 2026)
 *   'cards' — the leaning cards with the chance between them, as before
 *
 * To go back, set DEFAULT_STYLE to 'cards': nothing else needs to change,
 * both looks live side by side. To compare without a build, set
 * localStorage 'matchup-style' to 'cards' or 'hud' and reload.
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

/** True where the screen should draw the HUD look. */
export function useMatchupHud(): boolean {
  return matchupStyle() === 'hud'
}

/**
 * Whether the fighter cards under it are drawn as medallions. Set by the
 * Dungeon and Arena boards only: the cards are shared with the Tournament,
 * which keeps its own look whatever the switch says.
 */
export const MatchupHud = createContext(false)

export function useMedallions(): boolean {
  return useContext(MatchupHud)
}
