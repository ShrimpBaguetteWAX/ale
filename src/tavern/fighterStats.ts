import type { TavernFighter } from '@/chain/types'
import { NUM_LOCALE, formatDecimals } from '@/format'
import { asset } from '@/assets'

/**
 * `creation.ale` / `classtemps` — the per-class stat bands every roll falls
 * inside. Used to say whether a given recruit is good or bad for its class.
 */
export interface ClassTemplate {
  tempname: string
  classname: string
  target: string
  total_min_max_stats: Record<string, number>
  description?: string
}

/**
 * Stats are stored at ten times their displayed value.
 *
 * The original's own indicator confirms it — it multiplies the displayed
 * number by 10 before comparing it against the raw class bands. So a stored
 * `damage_min` of 178 is 17.8, and a resistance of 800 is 80%.
 */
export const STAT_SCALE = 10

export function scaled(raw: number): number {
  return raw / STAT_SCALE
}

/**
 * A raw stat as a whole number, ready to print.
 *
 * `scaled` divides by ten and keeps the remainder, which is right for
 * arithmetic and wrong on screen: a damage number reading "84.3" implies a
 * precision the game never shows. Everything player-facing rounds.
 */
export function formatScaled(raw: number): string {
  return Math.round(scaled(raw)).toLocaleString(NUM_LOCALE)
}

/**
 * A raw stat at its full stored precision, as "1.8".
 *
 * Rounding is right on a stat row, where a tenth of a 47-point damage stat is
 * noise. It is wrong on the small numbers an ability grants: a stored 18
 * damage is 1.8, and calling that "2" both overstates it and flattens the gap
 * between the rarity tiers, several of which land inside the same whole
 * number. Stats divide by exactly ten, so one decimal is the whole of the
 * stored precision and never invents any.
 */
export function formatScaledExact(raw: number): string {
  return formatDecimals(scaled(raw), 1)
}

/**
 * A stat as the game shows it: the midpoint, then how far the roll can swing.
 *
 * This is the original's presentation — floor of the mean, then floor of half
 * the width, rendered as "29 (+-12)". A recruit has not rolled yet, so a bare
 * range would be honest but harder to compare between recruits; one number
 * plus a spread is what players are used to reading.
 */
export function statDisplay(min: number, max: number): { value: number; spread: number } {
  return {
    value: Math.floor((min + max) / 2 / STAT_SCALE),
    spread: Math.floor(Math.abs(max - min) / 2 / STAT_SCALE),
  }
}

export function formatStat(min: number, max: number): string {
  const { value, spread } = statDisplay(min, max)
  return spread > 0 ? value + ' (+-' + spread + ')' : String(value)
}

export function formatResistance(raw: number): string {
  return Math.round(scaled(raw)) + '%'
}

/**
 * Display names.
 *
 * Two of these are not cosmetic: the contract's `attackspeed` and
 * `initiative` are a cooldown and a wind-up, so *lower is better*. Calling
 * them "attack speed" and "initiative" in the UI tells the player the
 * opposite of the truth.
 */
export const STAT_LABEL: Record<string, string> = {
  health: 'Health',
  damage: 'Damage',
  taunt: 'Taunt',
  attackspeed: 'Cooldown',
  initiative: 'Windup',
}

/** Fields where a smaller number is the better roll. */
const LOWER_IS_BETTER = new Set(['attackspeed', 'initiative'])

/**
 * Fields that get no indicator at all.
 *
 * Taunt is a role choice rather than a quality — a high-taunt fighter is a
 * tank, not a better fighter — and the original leaves it unmarked for that
 * reason.
 */
const NO_INDICATOR = new Set(['taunt', 'target', 'targetting'])

export type StatGrade =
  | 'gold-up'
  | 'green-duble-up'
  | 'green-up'
  | 'middle'
  | 'red-down'
  | 'red-duble-down'

export const GRADE_ICON: Record<StatGrade, string> = {
  'gold-up': asset('/assets/icons/arrows/gold-up.png'),
  'green-duble-up': asset('/assets/icons/arrows/green-duble-up.png'),
  'green-up': asset('/assets/icons/arrows/green-up.png'),
  middle: asset('/assets/icons/arrows/middle.png'),
  'red-down': asset('/assets/icons/arrows/red-down.png'),
  'red-duble-down': asset('/assets/icons/arrows/red-duble-down.png'),
}

export const GRADE_LABEL: Record<StatGrade, string> = {
  'gold-up': 'Exceptional for this class',
  'green-duble-up': 'Very good for this class',
  'green-up': 'Good for this class',
  middle: 'Average for this class',
  'red-down': 'Below average for this class',
  'red-duble-down': 'Poor for this class',
}

/**
 * Grade one rolled stat against its class band.
 *
 * This is the original's formula. The band is described by four numbers — the
 * low and high ends of both the minimum and the maximum roll — from which it
 * takes a floor (mean of the two minimums) and a span (mean of the two
 * maximums, less that floor), then buckets the value into sixths.
 *
 * A tavern recruit has a *range* rather than a settled stat, so the midpoint
 * is graded: that is the roll the player should expect if they hire.
 */
export function gradeStat(
  field: string,
  rawValue: number,
  template: ClassTemplate | undefined,
): StatGrade | null {
  if (NO_INDICATOR.has(field)) return null
  if (!template) return 'middle'

  const b = template.total_min_max_stats ?? {}

  /*
   * Resistances use the original's own scale: fractions of the class ceiling
   * rather than a floor-to-ceiling band. Its general formula reads the
   * four-number keys, which resistances do not have, so it would mark every
   * one of them exceptional.
   */
  if (field.startsWith('res_')) {
    const ceiling = b[`${field}_max`] ?? 0
    if (ceiling <= 0) return 'middle'
    if (rawValue <= ceiling * 0.2) return 'red-duble-down'
    if (rawValue <= ceiling * 0.4) return 'red-down'
    if (rawValue <= ceiling * 0.6) return 'middle'
    if (rawValue <= ceiling * 0.8) return 'green-up'
    if (rawValue <= ceiling * 0.95) return 'green-duble-up'
    return 'gold-up'
  }

  const floor = ((b[`${field}_min_min`] ?? 0) + (b[`${field}_max_min`] ?? 0)) / 2
  const span = ((b[`${field}_min_max`] ?? 0) + (b[`${field}_max_max`] ?? 0)) / 2 - floor
  if (span <= 0) return 'middle'

  if (LOWER_IS_BETTER.has(field)) {
    if (rawValue < floor + span * 0.1) return 'gold-up'
    if (rawValue < floor + span * 0.3) return 'green-duble-up'
    if (rawValue < floor + span * 0.5) return 'green-up'
    if (rawValue < floor + span * 0.7) return 'middle'
    if (rawValue < floor + span * 0.9) return 'red-down'
    return 'red-duble-down'
  }

  const over = rawValue - floor
  if (over <= span * 0.1) return 'red-duble-down'
  if (over <= span * 0.3) return 'red-down'
  if (over <= span * 0.5) return 'middle'
  if (over <= span * 0.7) return 'green-up'
  if (over <= span * 0.9) return 'green-duble-up'
  return 'gold-up'
}

/** Midpoint of a recruit's min/max range — the expected roll. */
export function midpoint(min: number, max: number): number {
  return (min + max) / 2
}

/* ---------- Ability rarity ---------- */

/** Colours lifted from the original's `statName` variants. */
export const ABILITY_RARITY_COLOR: Record<string, string> = {
  abundant: '#FFFFFF',
  common: '#939393',
  rare: '#00BAFF',
  epic: '#966AFD',
  legendary: '#FFB800',
  mythical: '#D30E46',
}

/**
 * Abilities carry their rarity in the display name, e.g.
 * "Self Heal when Hit [epic]". Some — "Sacrifice" — carry none.
 */
export function abilityRarity(displayname: string): string | null {
  const m = /\[([a-z]+)\]\s*$/i.exec(displayname ?? '')
  const key = m?.[1]?.toLowerCase()
  return key && key in ABILITY_RARITY_COLOR ? key : null
}

export function abilityColor(displayname: string): string {
  const rarity = abilityRarity(displayname)
  return rarity ? ABILITY_RARITY_COLOR[rarity] : 'var(--text-dim)'
}

/** The name without its trailing rarity tag. */
export function abilityName(displayname: string): string {
  return (displayname ?? '').replace(/\s*\[[a-z]+\]\s*$/i, '')
}

/* ---------- Artwork ---------- */

/**
 * Class artwork, rasterised from the original SVGs by scripts/make-thumbs.mjs
 * — the sources average 867KB and one is 5MB.
 */
export function fighterArt(fighter: Pick<TavernFighter, 'classname' | 'racename'>): string {
  return asset(`/assets/fighters/${fighter.classname}_${fighter.racename}.webp`)
}

/**
 * The head-and-shoulders crop, for anywhere a fighter appears small.
 *
 * Every class/race pair ships one alongside the full body. Shrinking the
 * full-body art into a card-sized box wastes most of the box on empty ground
 * and leaves the face a dozen pixels tall; the avatar is the same character
 * framed for exactly this.
 */
export function fighterAvatar(fighter: {
  classname: string
  racename: string
}): string {
  return asset(`/assets/fighters/${fighter.classname}_${fighter.racename}_avatar.webp`)
}

export function fighterArtFallback(): string {
  return asset('/assets/fighters/unknown_unknown.webp')
}

/** Elemental backdrop behind the portrait. */
export function elementBackground(element: string): string {
  const known = ['air', 'fire', 'gem', 'metal', 'nature', 'neutral']
  const key = known.includes(element) ? element : 'neutral'
  return asset(`/assets/fighter/classes/backgrounds/full/full_background_${key}.jpeg`)
}

/** Icon beside a stat name, from the original set. */
export function statIcon(field: string): string {
  return asset('/assets/icons/stats/') + field + '.svg'
}

/* ---------- Ability descriptions ---------- */

/** One entry of an ability's `bf_effects` / `if_effects` / `eof_effects`. */
export interface AbilityEffect {
  value?: number
  value_min?: number
  value_max?: number
  stat_name?: string
  percentflat?: string
  effect_type?: string
  execute_target?: string
}

export interface AbilityWithEffects {
  displayname: string
  description: string
  bf_effects?: AbilityEffect[]
  if_effects?: AbilityEffect[]
  eof_effects?: AbilityEffect[]
  /** Read by the `[resignore:value]` placeholder. */
  ignore_res_percent?: number
}

/**
 * Ability descriptions carry placeholders for their own numbers, in the form
 * `[<group>:<index>:<field>]`:
 *
 *   "Healed for [if:0:value]% of health lost upon getting hit"
 *
 * `if` is the ability's `if_effects` array, `0` the entry in it, and `value`
 * the field to read — so that reads 32 for a fighter whose
 * `if_effects[0].value` is 32. `bf` and `eof` point at `bf_effects` and
 * `eof_effects` the same way.
 *
 * The live site never substitutes these; it prints the raw token at the
 * player.
 *
 * Values are shown unsigned. The contract stores a debuff as a negative — the
 * ability "reduces attacker health by [if:0:value]" holds -44 — and the word
 * "reduces" already carries the direction, so a minus sign there would read as
 * a double negative.
 *
 * A value that names a fighter stat is divided by `STAT_SCALE`, because that
 * is the scale the rest of the screen is already in: an ability granting a
 * stored 86 damage is +9 beside a damage stat that reads 47, not +86. Two
 * kinds of value are deliberately left alone —
 *
 *   * a `percent` effect is already a percentage of something, and its
 *     description carries the "%" itself: "[bf:0:value]% increased damage";
 *   * an `eof` effect is TLM, shards, XP or age rather than a fighter stat,
 *     so it never was on that scale. Those carry `effect_type` instead of
 *     `stat_name`, which is what separates them here.
 *
 * `[resignore:value]` is the one placeholder with a different shape. It reads
 * the ability's own `ignore_res_percent` rather than an effect, and is a
 * literal percentage, so it is not scaled either.
 */
export function resolveAbilityDescription(ability: AbilityWithEffects): string {
  const groups: Record<string, AbilityEffect[] | undefined> = {
    bf: ability.bf_effects,
    if: ability.if_effects,
    eof: ability.eof_effects,
  }

  return (ability.description ?? '')
    .replace(/\[resignore:value\]/g, () =>
      typeof ability.ignore_res_percent === 'number'
        ? String(Math.abs(ability.ignore_res_percent))
        : '?',
    )
    .replace(
      /\[(bf|if|eof):(\d+):(\w+)\]/g,
      (_token, group: string, index: string, field: string) => {
        const effect = groups[group]?.[Number(index)]
        const raw = effect?.[field as keyof AbilityEffect]
        if (typeof raw === 'number') {
          const isFighterStat = effect?.percentflat === 'flat' && !!effect.stat_name
          return isFighterStat ? formatScaledExact(Math.abs(raw)) : String(Math.abs(raw))
        }
        if (typeof raw === 'string' && raw !== '') return raw
        // Unresolvable: better an honest blank than a stray token or a wrong
        // number.
        return '?'
      },
    )
}

/* ---------- Targeting ---------- */

/**
 * Who a fighter goes for, in words.
 *
 * The contract stores targeting as `enemy_<stat>_<min|max>`; this is the
 * original's own mapping of those to labels. Note it says Windup and Cooldown
 * for `initiative` and `attackspeed`, matching the renaming applied to the
 * stat rows — the same reasoning, since both are delays.
 */
export const TARGET_LABEL: Record<string, string> = {
  enemy_taunt_min: 'Lowest Taunt',
  enemy_taunt_max: 'Highest Taunt',
  enemy_health_min: 'Lowest Health',
  enemy_health_max: 'Highest Health',
  enemy_damage_min: 'Lowest Damage',
  enemy_damage_max: 'Highest Damage',
  enemy_initiative_min: 'Lowest Windup',
  enemy_initiative_max: 'Highest Windup',
  enemy_attackspeed_min: 'Lowest Cooldown',
  enemy_attackspeed_max: 'Highest Cooldown',
  enemy_res_fire_min: 'Lowest Fire Res',
  enemy_res_fire_max: 'Highest Fire Res',
  enemy_res_air_min: 'Lowest Air Res',
  enemy_res_air_max: 'Highest Air Res',
  enemy_res_metal_min: 'Lowest Metal Res',
  enemy_res_metal_max: 'Highest Metal Res',
  enemy_res_neutral_min: 'Lowest Neutral Res',
  enemy_res_neutral_max: 'Highest Neutral Res',
  enemy_res_nature_min: 'Lowest Nature Res',
  enemy_res_nature_max: 'Highest Nature Res',
  enemy_res_gem_min: 'Lowest Gem Res',
  enemy_res_gem_max: 'Highest Gem Res',
}

/** Falls back to the raw value, as the original does, rather than inventing one. */
export function formatTarget(target: string): string {
  return TARGET_LABEL[target] ?? target
}

/* ---------- grades, as something to compare and filter on ---------- */

/**
 * The grades in order, worst to best.
 *
 * An arrow is enough when you are looking at one fighter. Comparing a market
 * full of them needs the grades to be *ordered*, so "at least this good" is a
 * question that can be asked.
 */
export const GRADE_ORDER: StatGrade[] = [
  'red-duble-down',
  'red-down',
  'middle',
  'green-up',
  'green-duble-up',
  'gold-up',
]

export function gradeRank(grade: StatGrade | null): number {
  return grade ? GRADE_ORDER.indexOf(grade) : -1
}

/**
 * The stats a filter can ask about, and how each one answers.
 *
 * `graded: false` marks the two that answer with a number rather than an
 * arrow, for opposite reasons.
 *
 * `gradeStat` refuses **taunt** because it is a role rather than a quality —
 * high taunt is exactly what a tank wants and exactly what a glass cannon
 * does not, so there is no direction in which more of it is better.
 *
 * **Age bonus** is not a rolled stat at all: it is condition, computed from
 * the fighter's age against the decay curve, and it moves on its own after
 * purchase. There is no class band to grade it against — every class ages
 * identically — so it too takes a figure.
 *
 * The flag is what lets one control ask both kinds of question.
 */
export const FILTER_STATS: { field: string; label: string; graded: boolean }[] = [
  { field: 'health', label: 'Health', graded: true },
  { field: 'damage', label: 'Damage', graded: true },
  { field: 'taunt', label: 'Taunt', graded: false },
  { field: 'age', label: 'Age bonus', graded: false },
  { field: 'attackspeed', label: 'Cooldown', graded: true },
  { field: 'initiative', label: 'Windup', graded: true },
  { field: 'res_fire', label: 'Fire resistance', graded: true },
  { field: 'res_air', label: 'Air resistance', graded: true },
  { field: 'res_metal', label: 'Metal resistance', graded: true },
  { field: 'res_gem', label: 'Gem resistance', graded: true },
  { field: 'res_nature', label: 'Nature resistance', graded: true },
  { field: 'res_neutral', label: 'Neutral resistance', graded: true },
]

/** Whether a stat answers with a grade or with a number. */
export function isGradedStat(field: string): boolean {
  return FILTER_STATS.find((s) => s.field === field)?.graded ?? false
}

/**
 * The grade of one stat on one fighter.
 *
 * The two kinds of stat are graded from different numbers and getting them
 * the wrong way round is silent: the banded ones (health, damage, wind-up,
 * cooldown) are a `_min`/`_max` roll and grade on their midpoint — the roll
 * to expect — while resistances are a single stored figure. This is the one
 * place that distinction lives, so a card and a filter cannot disagree about
 * what a fighter is worth.
 */
export function gradeOfStat(
  stats: Record<string, number> | undefined,
  field: string,
  template: ClassTemplate | undefined,
): StatGrade | null {
  if (!stats || !template) return null
  if (field.startsWith('res_')) {
    return gradeStat(field, Number(stats[field] ?? 0), template)
  }
  const lo = Number(stats[`${field}_min`] ?? 0)
  const hi = Number(stats[`${field}_max`] ?? 0)
  return gradeStat(field, (lo + hi) / 2, template)
}
