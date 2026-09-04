import type { RosterFighter } from '@/dungeon/types'
import { statIcon } from '@/tavern/fighterStats'
import { NUM_LOCALE } from '@/format'
import { asset } from '@/assets'
import type { AscensionConfig, StatCaps } from './queries'

/**
 * Ascension, from `ascend.ale`.
 *
 * A fighter that has hit the level cap can be pushed past it by spending
 * three others. The three are not interchangeable: the contract demands that
 * between them they cover three separate requirements, and that no one
 * fighter covers two of them.
 *
 * What it costs is credits, what it gives is a choice of three rolled stat
 * upgrades — pick one, and the other two are gone.
 */

/** The ability a sacrifice must carry to satisfy the third requirement. */
export const SACRIFICE_ABILITY = 'sacrifice'

export const SACRIFICE_COUNT = 3

export type Requirement = 'element' | 'race' | 'ability'

export const REQUIREMENTS: { key: Requirement; label: string; hint: string }[] = [
  {
    key: 'element',
    label: 'Same element',
    hint: 'One sacrifice must share the element of the fighter being ascended',
  },
  {
    key: 'race',
    label: 'Same race',
    hint: 'One sacrifice must share its race',
  },
  {
    key: 'ability',
    label: 'Sacrifice ability',
    hint: 'One sacrifice must carry the Sacrifice ability',
  },
]

/** Whether a fighter can be ascended at all. */
export function canAscend(
  fighter: RosterFighter,
  config: AscensionConfig | undefined,
): { ok: boolean; reason?: string } {
  const need = Number(config?.min_ascension_level ?? 0)
  const level = Number(fighter.stats?.level ?? 0)

  /*
     `check(level == min_ascension_level)` — equality, not "at least". A
     fighter cannot be over it in practice, but saying "must be level 10"
     rather than "level 10 or higher" is what the contract actually enforces.
   */
  if (need > 0 && level !== need) {
    return { ok: false, reason: `Must be level ${need}. This one is ${level}.` }
  }
  if (fighter.ascension_in_progress) {
    return { ok: false, reason: 'Already has an ascension waiting to be claimed.' }
  }
  return { ok: true }
}

/** Does this fighter carry the Sacrifice ability? */
export function hasSacrificeAbility(f: RosterFighter): boolean {
  return (f.stats?.abilities ?? []).some(
    (a) => String(a.ability) === SACRIFICE_ABILITY,
  )
}

/** Which of the three requirements a single fighter could satisfy. */
export function requirementsMet(
  candidate: RosterFighter,
  target: RosterFighter,
): Set<Requirement> {
  const met = new Set<Requirement>()
  if (candidate.element === target.element) met.add('element')
  if (candidate.racename === target.racename) met.add('race')
  if (hasSacrificeAbility(candidate)) met.add('ability')
  return met
}

/** A sacrifice must at minimum share the class; the contract checks it first. */
export function eligibleSacrifice(
  candidate: RosterFighter,
  target: RosterFighter,
): boolean {
  return (
    candidate.fighter_id !== target.fighter_id &&
    candidate.classname === target.classname &&
    !candidate.ascension_in_progress
  )
}

export interface SacrificeCheck {
  ok: boolean
  /** Requirements no assignment could cover, for the message. */
  unmet: Requirement[]
  /** Which fighter is covering which requirement, when it works out. */
  assignment: Map<Requirement, number>
}

/**
 * Whether three chosen fighters satisfy the contract.
 *
 * The contract's own test is three nested loops over the element, race and
 * ability matches, skipping any fighter already used — in other words, it
 * asks whether the three requirements can be covered by three *different*
 * fighters. One fighter that happens to match all three is not enough on its
 * own; it can only ever fill one of the slots.
 *
 * With exactly three sacrifices that is a small enough problem to answer by
 * trying every assignment, which is both simpler than a matching algorithm
 * and impossible to get subtly wrong.
 */
export function checkSacrifices(
  chosen: RosterFighter[],
  target: RosterFighter,
): SacrificeCheck {
  const keys: Requirement[] = ['element', 'race', 'ability']
  const met = chosen.map((f) => requirementsMet(f, target))

  if (chosen.length !== SACRIFICE_COUNT) {
    return { ok: false, unmet: [], assignment: new Map() }
  }

  /* Every permutation of the three fighters against the three slots. */
  const orders = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]

  for (const order of orders) {
    if (keys.every((key, slot) => met[order[slot]].has(key))) {
      const assignment = new Map<Requirement, number>()
      keys.forEach((key, slot) => assignment.set(key, chosen[order[slot]].fighter_id))
      return { ok: true, unmet: [], assignment }
    }
  }

  /*
     No assignment works. Report the requirements nothing can cover, which is
     more useful than "one or more sacrifices do not match" — a requirement no
     chosen fighter satisfies at all is the one to go and fix.
   */
  const unmet = keys.filter((key) => !met.some((m) => m.has(key)))
  return { ok: false, unmet, assignment: new Map() }
}

/* ---------- upgrades ---------- */

/**
 * How a rolled upgrade reads.
 *
 * `positive` says whether the value is added or subtracted, not whether it
 * helps. Attackspeed is a cooldown and initiative a wind-up, so subtracting
 * from either makes a fighter faster — the two negative main-stat rolls are
 * among the better ones to be offered, and colouring them as penalties would
 * be actively misleading.
 */
const LOWER_IS_BETTER = new Set(['attackspeed', 'initiative'])

export const STAT_LABEL: Record<string, string> = {
  health: 'Health',
  damage: 'Damage',
  taunt: 'Taunt',
  initiative: 'Wind-up',
  attackspeed: 'Cooldown',
  res_gem: 'Gem resistance',
  res_metal: 'Metal resistance',
  res_air: 'Air resistance',
  res_fire: 'Fire resistance',
  res_nature: 'Nature resistance',
  res_neutral: 'Neutral resistance',
}

export function statLabel(stat: string): string {
  return STAT_LABEL[stat] ?? stat
}

/** True when a change helps the fighter, whichever way the number moves. */
export function isBenefit(stat: string, positive: boolean): boolean {
  return LOWER_IS_BETTER.has(stat) ? !positive : positive
}

/**
 * Taunt is the one genuinely two-sided stat.
 *
 * More taunt draws attacks — good on a fighter built to hold the line, bad on
 * one that should not be hit. Both directions are offered as separate rolls,
 * so neither can be called an improvement without knowing the squad.
 */
export function isAmbiguous(stat: string): boolean {
  return stat === 'taunt'
}

/**
 * The two stats the contract grows with the fighter.
 *
 * `apply_weather_and_age` multiplies health and damage by
 * `level_mod ^ level * age_decay` before the first blow and leaves cooldown,
 * wind-up, taunt and the resistances alone. So a rolled +9 damage is worth
 * four times its face value on a level 10 fighter and a rolled −14 cooldown
 * is worth exactly its face value, and quoting both at face value would
 * understate one of them by a factor of four.
 */
const SCALED_BY_LEVEL = new Set(['health', 'damage'])

/** Percent-valued stats, which the game prints with a sign rather than a unit. */
function isResistance(stat: string): boolean {
  return stat.startsWith('res_')
}

/**
 * The three the contract clamps, and only when subtracting.
 *
 * `ascupgrade` adds health, damage and every resistance with no ceiling check
 * at all — the `_max` caps are not consulted. What it does check is the floor
 * on a *downward* roll of taunt, wind-up or cooldown: if the subtraction
 * would take the stat under its floor it sets the stat to the floor instead,
 * so the player gets less than the offer says.
 */
const FLOORED = new Set(['taunt', 'initiative', 'attackspeed'])

/**
 * How much of a rolled upgrade the contract would actually apply.
 *
 * In raw units, like the offer itself. Equal to the offer except where a
 * subtraction runs into a floor, in which case the stat lands on the floor
 * and the difference is lost.
 */
export function appliedValue(
  stat: string,
  value: number,
  positive: boolean,
  fighter: RosterFighter | undefined,
  caps: StatCaps | undefined,
): number {
  if (positive || !FLOORED.has(stat) || !fighter || !caps) return value

  const current = Number(
    (fighter.stats as unknown as Record<string, number>)[`${stat}_min`] ?? 0,
  )
  const floor = Number((caps as unknown as Record<string, number>)[`${stat}_min`] ?? 0)

  return current - value >= floor ? value : Math.max(0, current - floor)
}

/**
 * What a rolled upgrade is actually worth to this fighter.
 *
 * Values arrive at ten times their displayed size, like every other stat the
 * contract stores — the screen was printing them raw, so a −1.4 cooldown read
 * as −14.
 */
export function upgradeGain(stat: string, value: number, factor = 1): number {
  const base = value / 10
  return SCALED_BY_LEVEL.has(stat) ? base * factor : base
}

/** "1.4", "3.63", "12" — as many decimals as the number needs, up to two. */
function trimmed(n: number): string {
  return Number(n.toFixed(2)).toLocaleString(NUM_LOCALE, {
    maximumFractionDigits: 2,
  })
}

/** "+12 Health", "−1.4 Cooldown", "+3% Gem resistance". */
export function upgradeLabel(
  stat: string,
  value: number,
  positive: boolean,
  factor = 1,
): string {
  const n = upgradeGain(stat, value, factor)
  return `${positive ? '+' : '−'}${trimmed(n)}${isResistance(stat) ? '%' : ''} ${statLabel(stat)}`
}

/** "+0.5 to +1.5", scaled the same way a single offer is. */
export function upgradeRange(
  stat: string,
  min: number,
  max: number,
  positive: boolean,
  factor = 1,
): string {
  const sign = positive ? '+' : '−'
  const unit = isResistance(stat) ? '%' : ''
  const lo = trimmed(upgradeGain(stat, min, factor))
  const hi = trimmed(upgradeGain(stat, max, factor))
  return `${sign}${lo}${unit} to ${sign}${hi}${unit}`
}

/**
 * The icon the rest of the game uses for this stat.
 *
 * `statIcon` only has files for the five main stats; a resistance is named
 * for its element and takes the element's mark, which is what the tavern and
 * the fighter panel already show beside one.
 */
export function upgradeIcon(stat: string): string {
  return isResistance(stat)
    ? asset(`/assets/icons/elements/${stat.slice(4)}.png`)
    : statIcon(stat)
}
