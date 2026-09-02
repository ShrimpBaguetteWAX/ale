import { fighterAvailable } from '@/dungeon/rules'
import type { RosterFighter, BattleFighter } from '@/dungeon/types'
import type { NftValue } from '@/dungeon/nftFighter'
import { flatMatchup, type Matchup } from './matchup'

/**
 * Picking the five fighters and two cards that suit *this* opponent.
 *
 * The screens used to take the five highest raw damage figures, which ignores
 * every part of the game that decides a fight: a fire fighter topping the
 * roster is worth nothing against a team that resists fire, an old fighter's
 * printed damage is not the damage it brings, and a slow one lands it half as
 * often. This ranks on the same measure the badges show — damage that
 * actually gets through, per tick, times how long the fighter survives the
 * elements coming back — so a player can audit every choice by reading the
 * numbers on the cards it picked.
 *
 * Shared by the dungeon and the arena. The two screens face different
 * opponents but field the identical thing against them: five roster fighters
 * plus one fused crew-and-weapon card. Two copies of this would drift, and
 * the copy that drifted would be the arena's.
 */

export interface AutoPicked<TCard> {
  fighterIds: number[]
  crew: TCard | null
  weapon: TCard | null
}

/**
 * Every pair is worth scoring, but not every pair is worth the loop: a big
 * collection would be thousands of combinations for a choice that is decided
 * by the top handful either way. Both sides are trimmed to their strongest
 * few on raw stats first, and the pairing runs on those.
 */
const SHORTLIST = 24

export function autoPickTeam<TCard extends { template_id: number }>(options: {
  roster: RosterFighter[]
  /** How each roster fighter stands against this line-up, by fighter id. */
  matchups: Map<number, Matchup>
  enemies: BattleFighter[]
  teamSize: number
  crewCards: TCard[]
  weaponCards: TCard[]
  values: Map<number, NftValue>
}): AutoPicked<TCard> {
  const { roster, matchups, enemies, teamSize, crewCards, weaponCards, values } = options

  const available = roster.filter((f) => fighterAvailable(f).available)
  const ranked = [...available].sort(
    (a, b) =>
      (matchups.get(b.fighter_id)?.score ?? 0) - (matchups.get(a.fighter_id)?.score ?? 0) ||
      a.fighter_id - b.fighter_id,
  )
  const fighterIds = ranked.slice(0, teamSize).map((f) => f.fighter_id)

  const bulk = (c: TCard) => {
    const v = values.get(c.template_id)
    return (v?.stats.damage ?? 0) + (v?.stats.health ?? 0)
  }
  const shortlist = (cards: TCard[]) =>
    [...cards].sort((a, b) => bulk(b) - bulk(a)).slice(0, SHORTLIST)

  const crewList = shortlist(crewCards)
  const weaponList = shortlist(weaponCards)

  let bestCrew: TCard | null = null
  let bestWeapon: TCard | null = null
  let bestScore = -1

  /*
     The cards are chosen as a pair rather than one at a time, because the
     weapon alone sets the combined fighter's element while both contribute
     its damage. Picking the strongest weapon in isolation is exactly how you
     hand a resistant opponent a free 60% off your sixth fighter.
  */
  for (const c of crewList) {
    const cv = values.get(c.template_id)
    if (!cv) continue
    for (const w of weaponList) {
      const wv = values.get(w.template_id)
      if (!wv) continue
      /* `getFighterFromNFT`: stats add, the element comes from the weapon. */
      const combined = flatMatchup(
        {
          element: wv.element,
          damage: cv.stats.damage + wv.stats.damage,
          health: cv.stats.health + wv.stats.health,
          attackspeed: cv.stats.attackspeed + wv.stats.attackspeed,
          res_gem: cv.stats.res_gem + wv.stats.res_gem,
          res_metal: cv.stats.res_metal + wv.stats.res_metal,
          res_air: cv.stats.res_air + wv.stats.res_air,
          res_fire: cv.stats.res_fire + wv.stats.res_fire,
          res_nature: cv.stats.res_nature + wv.stats.res_nature,
          res_neutral: cv.stats.res_neutral + wv.stats.res_neutral,
          abilities: [...(cv.ability ?? []), ...(wv.ability ?? [])],
        },
        enemies,
      )
      if (combined.score > bestScore) {
        bestScore = combined.score
        bestCrew = c
        bestWeapon = w
      }
    }
  }

  /*
     With no enemy line loaded there is nothing to rank against, so fall back
     to the heaviest card in each slot rather than picking nothing.
  */
  return {
    fighterIds,
    crew: bestCrew ?? crewList[0] ?? null,
    weapon: bestWeapon ?? weaponList[0] ?? null,
  }
}
