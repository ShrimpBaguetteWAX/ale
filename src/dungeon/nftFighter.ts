import type { PanelFighter } from '@/components/FighterPanel'
import type { BattleAbility } from './types'
import { asset } from '@/assets'

/**
 * `fighters.ale` / `nftvalues` — what an Alien Worlds card is worth in a
 * fight.
 *
 * This is the table the crew and weapon slots actually resolve against, and a
 * card with no row here makes `playdungeon` revert outright ("No matching
 * template in nftvalue table"). So it decides which cards may be offered at
 * all, not just what they are worth.
 */
export interface NftValue {
  template_id: number
  /** The schema: `crew.worlds` or `arms.worlds`. */
  type: string
  rarity: string
  shine: string
  classname: string
  racename: string
  element: string
  stats: NftStats
  ability: BattleAbility[]
}

export interface NftStats {
  health: number
  max_health: number
  damage: number
  taunt: number
  initiative: number
  attackspeed: number
  res_gem: number
  res_metal: number
  res_air: number
  res_fire: number
  res_nature: number
  res_neutral: number
  target: string
}

/** Where the NFT fighter's own art lives — it has no class art to use. */
export const NFT_FIGHTER_ART = asset('/assets/fighters/bonus_fighter_avatar.webp')

const RES_KEYS = [
  'res_gem',
  'res_metal',
  'res_air',
  'res_fire',
  'res_nature',
  'res_neutral',
] as const

/**
 * The sixth fighter a crew and a weapon combine into.
 *
 * Mirrors `battle::getFighterFromNFT` exactly, and the split is worth knowing
 * because it is not symmetric:
 *
 * - every stat is the plain **sum** of the two cards
 * - the **element** comes from the weapon alone, which decides what the
 *   fighter's damage is resisted by
 * - class, race and target come from the crew — though in practice no crew
 *   row on chain carries a class or race, so the fighter is always nameless
 *   and only sixteen crew cards set a target at all
 * - abilities are the crew's followed by the weapon's, both kept
 *
 * Passing only one card previews what that card contributes on its own, which
 * is what the picker shows while the other slot is still empty.
 */
export function combineNftFighter(
  crew: NftValue | null,
  weapon: NftValue | null,
): PanelFighter | null {
  if (!crew && !weapon) return null

  const sum = (pick: (s: NftStats) => number) =>
    (crew ? pick(crew.stats) : 0) + (weapon ? pick(weapon.stats) : 0)

  const resistances = Object.fromEntries(
    RES_KEYS.map((k) => [k, sum((s) => s[k])]),
  ) as Record<(typeof RES_KEYS)[number], number>

  return {
    classname: crew?.classname || '',
    racename: crew?.racename || '',
    // The weapon decides the element; with no weapon yet there is nothing to
    // decide it, and `neutral` is what the backdrop falls back to anyway.
    element: weapon?.element || 'neutral',
    target: crew?.stats.target || '',
    level: 1,
    health: { min: sum((s) => s.health) },
    damage: { min: sum((s) => s.damage) },
    taunt: { min: sum((s) => s.taunt) },
    attackspeed: { min: sum((s) => s.attackspeed) },
    initiative: { min: sum((s) => s.initiative) },
    ...resistances,
    abilities: [...(crew?.ability ?? []), ...(weapon?.ability ?? [])],
    art: NFT_FIGHTER_ART,
    title: 'NFT Fighter',
    subtitle:
      crew && weapon
        ? `crew + weapon · ${weapon.element}`
        : crew
          ? 'crew only — pick a weapon'
          : 'weapon only — pick a crew',
  }
}

/** One card on its own, as a panel — for the detail view of a single card. */
export function nftAsPanel(value: NftValue, name: string): PanelFighter {
  const resistances = Object.fromEntries(
    RES_KEYS.map((k) => [k, value.stats[k]]),
  ) as Record<(typeof RES_KEYS)[number], number>

  return {
    classname: value.classname,
    racename: value.racename,
    element: value.element || 'neutral',
    target: value.stats.target,
    health: { min: value.stats.health },
    damage: { min: value.stats.damage },
    taunt: { min: value.stats.taunt },
    attackspeed: { min: value.stats.attackspeed },
    initiative: { min: value.stats.initiative },
    ...resistances,
    abilities: value.ability ?? [],
    art: asset(`/assets/cards/${value.template_id}.webp`),
    title: name,
    subtitle: `${value.type === 'crew.worlds' ? 'Crew' : 'Weapon'} · ${value.rarity}${
      value.shine && value.shine !== 'stone' ? ` · ${value.shine}` : ''
    }`,
  }
}

/** Card rarities, weakest first — the order the game itself uses. */
export const RARITY_ORDER = [
  'abundant',
  'common',
  'rare',
  'epic',
  'legendary',
  'mythical',
] as const

export function rarityRank(rarity: string): number {
  const i = RARITY_ORDER.indexOf(rarity.toLowerCase() as (typeof RARITY_ORDER)[number])
  return i < 0 ? RARITY_ORDER.length : i
}

/** A card's finish, plainest first — the second half of how cards rank. */
const SHINE_ORDER = ['stone', 'gold', 'xdimension', 'stardust', 'antimatter'] as const

export function shineRank(shine: string): number {
  const i = SHINE_ORDER.indexOf(shine.toLowerCase() as (typeof SHINE_ORDER)[number])
  /* An unknown finish is not a better one, so it sorts below stone. */
  return i < 0 ? -1 : i
}

/**
 * Best card first: rarity, then finish.
 *
 * The order players read cards in — a mythical is above a legendary whatever
 * its shine, and within one rarity an antimatter is the prize.
 */
export function byQuality(
  a: { rarity: string; shine?: string },
  b: { rarity: string; shine?: string },
): number {
  const rarity = rarityRank(b.rarity) - rarityRank(a.rarity)
  if (rarity !== 0) return rarity
  return shineRank(b.shine ?? '') - shineRank(a.shine ?? '')
}
