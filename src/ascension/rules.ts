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
  /*
     `check(itr_fighter->in_use == false, …)` — a fighter defending an arena
     or listed on the market cannot be ascended. Offering it let a player
     fill all three sacrifice slots and confirm, only for the transaction to
     be refused.
   */
  if (fighter.in_use) {
    return { ok: false, reason: 'Busy elsewhere — in an arena or on the market.' }
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
    !candidate.ascension_in_progress &&
    /* `check(itr_sacrifice->in_use == false, …)` — a fighter busy in an arena
       or on the market cannot be spent, so it is not offered as a sacrifice. */
    !candidate.in_use
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

/** The three with a range that a roll can take up or down. */
const TWO_WAY = new Set(['taunt', 'initiative', 'attackspeed'])

/**
 * What taking a rolled upgrade would really do to this fighter.
 *
 * In raw units, like the offer and the stats. Each branch is `ascupgrade` in
 * `ascend.ale`, case for case:
 *
 * - Health and damage: each end of the range gains the roll, unless it would
 *   reach the `_max` ceiling, in which case that end is set to the ceiling.
 *   Near the top the range narrows, or both ends stop at the ceiling.
 * - A resistance: gains the roll unless it would reach its own ceiling, and
 *   then stops at it.
 * - Taunt, wind-up, cooldown going up: both ends gain the roll; no ceiling.
 * - Taunt, wind-up, cooldown going down: both ends lose the roll *if the roll
 *   is no bigger than the stat* — even when that lands under the `_min` floor.
 *   A roll bigger than the stat sets both ends to the floor instead, so the
 *   ± range is lost with it. (The contract's check is `value <= stat ||
 *   stat - value >= floor`; with unsigned stats promoted to int, the second
 *   half can only be true when the first already is.)
 *
 * The contract ignores `positive` for health, damage and resistances — they
 * are only ever added — and so does this.
 */
export interface UpgradeOutcome {
  /** How far the stat (its low end, for a range) really moves: the roll, or less. */
  applied: number
  /** Where it stops short: at the highest value, at the lowest, or not at all. */
  limit: 'ceiling' | 'floor' | null
  /** The value it stops at, raw. */
  at: number
  /** The stat before and after, raw: the range's middle where it has one. */
  before: number
  after: number
  /** The range before and after, for health, damage and the two-way three. */
  range?: { before: [number, number]; after: [number, number] }
  /** Only the top of the range stops at the ceiling; the low end gets the whole roll. */
  narrows: boolean
  /** Both ends set to the floor: the ± range is gone. */
  collapses: boolean
}

export function upgradeOutcome(
  stat: string,
  value: number,
  positive: boolean,
  fighter: RosterFighter,
  caps: StatCaps | undefined,
): UpgradeOutcome {
  const s = fighter.stats as unknown as Record<string, number>
  const c = caps as unknown as Record<string, number | undefined> | undefined
  const mid = (lo: number, hi: number) => (lo + hi) / 2

  if (isResistance(stat)) {
    const cur = Number(s[stat] ?? 0)
    const cap = c?.[stat]
    const next = cap === undefined || cur + value < cap ? cur + value : cap
    return {
      applied: next - cur,
      limit: next !== cur + value ? 'ceiling' : null,
      at: cap ?? 0,
      before: cur,
      after: next,
      narrows: false,
      collapses: false,
    }
  }

  const lo = Number(s[`${stat}_min`] ?? 0)
  const hi = Number(s[`${stat}_max`] ?? lo)

  if (!TWO_WAY.has(stat)) {
    /* Health and damage: each end against the ceiling on its own. */
    const cap = c?.[`${stat}_max`]
    const up = (v: number) => (cap === undefined || v + value < cap ? v + value : cap)
    const nlo = up(lo)
    const nhi = up(hi)
    const loShort = nlo !== lo + value
    const hiShort = nhi !== hi + value
    return {
      applied: nlo - lo,
      limit: loShort || hiShort ? 'ceiling' : null,
      at: cap ?? 0,
      before: mid(lo, hi),
      after: mid(nlo, nhi),
      range: { before: [lo, hi], after: [nlo, nhi] },
      narrows: hiShort && !loShort,
      collapses: false,
    }
  }

  if (positive || value <= lo) {
    const d = positive ? value : -value
    return {
      applied: value,
      limit: null,
      at: 0,
      before: mid(lo, hi),
      after: mid(lo + d, hi + d),
      range: { before: [lo, hi], after: [lo + d, hi + d] },
      narrows: false,
      collapses: false,
    }
  }

  const floor = Number(c?.[`${stat}_min`] ?? 0)
  return {
    applied: lo - floor,
    limit: 'floor',
    at: floor,
    before: mid(lo, hi),
    after: floor,
    range: { before: [lo, hi], after: [floor, floor] },
    narrows: false,
    collapses: true,
  }
}

/**
 * A stat's value as the fighter panel prints it: health and damage as fought
 * with (the level and age factor applied), resistances as a percentage.
 */
export function statValue(stat: string, raw: number, factor = 1): string {
  if (isResistance(stat)) return `${trimmed(raw / 10)}%`
  if (SCALED_BY_LEVEL.has(stat)) return Math.round((raw * factor) / 10).toLocaleString(NUM_LOCALE)
  return trimmed(raw / 10)
}

/** "Stops at 80%", "Stops at 0". */
export function limitLabel(stat: string, outcome: UpgradeOutcome, factor = 1): string {
  return `Stops at ${statValue(stat, outcome.at, factor)}`
}

/**
 * Everything an offer says, the same on the phone's cards and the desktop's
 * rows: what applies, what kind of change it is, where the stat goes, and —
 * when it stops short — what is lost, in the words the confirmation uses.
 */
export function upgradeText(
  stat: string,
  value: number,
  positive: boolean,
  outcome: UpgradeOutcome,
  factor = 1,
): {
  /** The offer as rolled: "+4.8% Gem resistance". */
  rolled: string
  /** What applies: the same, or less where it stops short. */
  applied: string
  /** "Improvement", "Draws fewer attacks", "Penalty". */
  kind: string
  /** "Gem resistance 22% → 26.8%", or what stopping short costs. */
  note: string
  /** "Stops at 80%", when it does. */
  tag: string | null
  /** The one-more-time question a limited roll asks before it is taken. */
  confirm: string | null
} {
  const name = statLabel(stat)
  const rolled = upgradeLabel(stat, value, positive, factor)
  const applied = outcome.narrows ? rolled : upgradeLabel(stat, outcome.applied, positive, factor)
  const kind = isAmbiguous(stat)
    ? positive
      ? 'Draws more attacks'
      : 'Draws fewer attacks'
    : isBenefit(stat, positive)
      ? 'Improvement'
      : 'Penalty'
  const from = statValue(stat, outcome.before, factor)
  const to = statValue(stat, outcome.after, factor)
  const at = statValue(stat, outcome.at, factor)

  if (!outcome.limit) {
    return { rolled, applied, kind, note: `${name} ${from} → ${to}`, tag: null, confirm: null }
  }
  if (outcome.narrows) {
    return {
      rolled,
      applied,
      kind,
      note: `The top of its range stops at ${at}; the range narrows`,
      tag: limitLabel(stat, outcome, factor),
      confirm: `${name} takes the whole roll at the low end, but the top of its range stops at ${at}, so the range narrows. The other two upgrades are gone either way.`,
    }
  }
  /* A floored stat loses its range too: both ends land on the floor. */
  const range = outcome.collapses ? `, and the top of its range drops to ${at} with it` : ''
  return {
    rolled,
    applied,
    kind,
    note: outcome.collapses
      ? `${name} drops to ${at} · the top of its range too`
      : `${name} ${from} → ${at} · the rest is lost`,
    tag: limitLabel(stat, outcome, factor),
    confirm: `The roll is ${rolled}, but ${name} stops at ${at}: only ${applied} applies${range}. The other two upgrades are gone either way.`,
  }
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
