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

/**
 * The five fighters, ranked on the matchup.
 *
 * Separate from the cards because they are separate decisions. A player who
 * has chosen their own five and wants a suggestion for the pair should not
 * have their line-up replaced to get it, and the reverse holds just as much.
 */
export function autoPickFighters(
  roster: RosterFighter[],
  matchups: Map<number, Matchup>,
  teamSize: number,
): number[] {
  const available = roster.filter((f) => fighterAvailable(f).available)
  const ranked = [...available].sort(
    (x, y) =>
      (matchups.get(y.fighter_id)?.score ?? 0) - (matchups.get(x.fighter_id)?.score ?? 0) ||
      x.fighter_id - y.fighter_id,
  )
  return ranked.slice(0, teamSize).map((f) => f.fighter_id)
}

/** The crew and weapon pair, chosen together for the reason below. */
export function autoPickCards<TCard extends { template_id: number }>(options: {
  enemies: BattleFighter[]
  crewCards: TCard[]
  weaponCards: TCard[]
  values: Map<number, NftValue>
}): { crew: TCard | null; weapon: TCard | null } {
  const { enemies, crewCards, weaponCards, values } = options

  const bulk = (c: TCard) => {
    const v = values.get(c.template_id)
    return (v?.stats.damage ?? 0) + (v?.stats.health ?? 0)
  }
  const shortlist = (cards: TCard[]) =>
    [...cards].sort((x, y) => bulk(y) - bulk(x)).slice(0, SHORTLIST)

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
  return { crew: bestCrew ?? crewList[0] ?? null, weapon: bestWeapon ?? weaponList[0] ?? null }
}

/** Both at once, for anything that still wants the whole line-up. */
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
  return {
    fighterIds: autoPickFighters(roster, matchups, teamSize),
    ...autoPickCards({ enemies, crewCards, weaponCards, values }),
  }
}

/**
 * The pair that wins the most fights, rather than the one that scores best
 * on paper.
 *
 * `autoPickCards` ranks the fused fighter on its own against the enemy line —
 * damage that lands, damage turned away, abilities the matchup switches on.
 * That is a good description of a fighter and a poor description of a fight:
 * it cannot see that a slower pair lets your taunt hold a blow longer, or
 * that a smaller one dies to the same strike either way, and it never asks
 * what the other five are doing. Measured against a real line-up it left ten
 * points of win rate on the table — 76% where the best pair gave 86%.
 *
 * So the cards are chosen the way the bar is now computed: by fighting it.
 *
 * Two passes, because the full grid is too much to simulate properly. Every
 * shortlisted pair is fought once at its middle roll, which is enough to
 * order them; the leaders are then fought `runs` times each, which is what
 * separates two pairs that are genuinely close. A collection of any size
 * costs the same, because the shortlist is what is fought, not the
 * collection.
 */
export function autoPickCardsByOdds<TCard extends { template_id: number }>(options: {
  enemies: BattleFighter[]
  crewCards: TCard[]
  weaponCards: TCard[]
  values: Map<number, NftValue>
  /** Win rate for one pair. The screen supplies this, bound to its team. */
  rate: (crew: NftValue | null, weapon: NftValue | null, runs: number) => number
  /** Cards per side carried into the simulated pass. */
  shortlist?: number
  /** Pairs fought properly at the end. */
  finalists?: number
  /** Fights per finalist. */
  runs?: number
}): { crew: TCard | null; weapon: TCard | null } {
  const { enemies, crewCards, weaponCards, values, rate } = options
  const shortlist = options.shortlist ?? 16
  const finalists = options.finalists ?? 10
  const runs = options.runs ?? 49

  if (!crewCards.length && !weaponCards.length) return { crew: null, weapon: null }

  /*
     The old ranking still earns its place here: it is a cheap way to throw
     away the cards nobody would field, and being wrong at the margin costs
     nothing when the survivors are fought anyway.
  */
  const best = (cards: TCard[], asWeapon: boolean) =>
    [...cards]
      .map((c) => {
        const v = values.get(c.template_id)
        if (!v) return { c, score: -1 }
        const solo = flatMatchup(
          {
            element: asWeapon ? v.element : v.element || 'neutral',
            damage: v.stats.damage,
            health: v.stats.health,
            attackspeed: v.stats.attackspeed,
            res_gem: v.stats.res_gem,
            res_metal: v.stats.res_metal,
            res_air: v.stats.res_air,
            res_fire: v.stats.res_fire,
            res_nature: v.stats.res_nature,
            res_neutral: v.stats.res_neutral,
            abilities: v.ability ?? [],
          },
          enemies,
        )
        return { c, score: solo.score }
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, shortlist)
      .map((x) => x.c)

  const crewList = best(crewCards, false)
  const weaponList = best(weaponCards, true)

  /* One fight each, to order them. */
  const rough: { crew: TCard | null; weapon: TCard | null; rate: number }[] = []
  const pairs: [TCard | null, TCard | null][] = []
  if (crewList.length && weaponList.length) {
    for (const c of crewList) for (const w of weaponList) pairs.push([c, w])
  } else {
    for (const c of crewList) pairs.push([c, null])
    for (const w of weaponList) pairs.push([null, w])
  }
  for (const [c, w] of pairs) {
    const cv = c ? (values.get(c.template_id) ?? null) : null
    const wv = w ? (values.get(w.template_id) ?? null) : null
    rough.push({ crew: c, weapon: w, rate: rate(cv, wv, 1) })
  }

  /* Then the leaders properly, where a single roll cannot separate them. */
  rough.sort((a, b) => b.rate - a.rate)
  const short = rough.slice(0, finalists).map((p) => ({
    ...p,
    rate: rate(
      p.crew ? (values.get(p.crew.template_id) ?? null) : null,
      p.weapon ? (values.get(p.weapon.template_id) ?? null) : null,
      runs,
    ),
  }))
  short.sort((a, b) => b.rate - a.rate)

  const winner = short[0] ?? rough[0]
  return { crew: winner?.crew ?? null, weapon: winner?.weapon ?? null }
}
