/**
 * Which look a Dungeon or Arena fight plays in.
 *
 *   'land'    — the fight on the ground it is fought on: the planet behind the
 *               horizon, the land underfoot in perspective, a shadow under
 *               every fighter and a charge ring at its feet, and the gilded
 *               cards for all twelve under the picture (since 29 October 2026)
 *   'classic' — the fight artwork behind both teams, as before
 *
 * To go back, set DEFAULT_LOOK to 'classic': nothing else needs to change,
 * both looks live side by side. To compare without a build, set
 * localStorage 'fight-look' to 'classic' or 'land' and reload.
 *
 * The tournament's player never asks: it keeps its own look whatever this
 * says, because only the fight page passes a look on.
 */
export type FightLook = 'land' | 'classic'

const DEFAULT_LOOK: FightLook = 'land'

export function fightLook(): FightLook {
  try {
    const own = localStorage.getItem('fight-look')
    if (own === 'land' || own === 'classic') return own
  } catch {
    /* storage blocked: the default stands */
  }
  return DEFAULT_LOOK
}
