import {
  RESISTANCE_FIELDS,
  STAT_SCALE,
  classBand,
  gradeInBand,
  statDisplay,
  type ClassTemplate,
  type StatGrade,
} from '@/tavern/fighterStats'

/**
 * The two figures a fighter is actually chosen on.
 *
 * Damage and cooldown are only meaningful together, and so are health and the
 * resistances: a fighter that hits for 90 every 8 seconds is worse than one
 * hitting for 60 every 4, and the stat rows say the opposite at a glance.
 * These combine each pair into the number the pair was standing in for.
 *
 * Both are graded against the class the same way every rolled stat is. A
 * derived figure has a band too — it is built from the bands of the stats it
 * is made of, taking the best case of one against the worst of the other.
 */

/** Resistances as a fraction of full: a stored 800 is 80%, so 0.8. */
export function meanResistance(stats: Record<string, number>): number {
  const values = RESISTANCE_FIELDS.map((f) => Number(stats[f] ?? 0))
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return mean / (STAT_SCALE * 100)
}

/**
 * Damage per unit of cooldown.
 *
 * Both are stored ten times their displayed size, so the scale cancels and
 * this is the same number whether it is fed raw or displayed values. Feed it
 * displayed ones on screen, since the damage a player sees is grown by level
 * and age and the figure has to agree with the row above it.
 */
export function damagePerSecond(damage: number, cooldown: number): number {
  return cooldown > 0 ? damage / cooldown : 0
}

/** Health weighted by how much of a hit the fighter turns away. */
export function survival(health: number, meanRes: number): number {
  return health * meanRes
}

/** The two together: what the fighter deals weighted by what it takes. */
export function combatScore(surv: number, dps: number): number {
  return surv * dps
}

/**
 * The three figures the Combat tab prints, at the sizes it prints them.
 *
 * One function because the card and the sort have to agree exactly. Sorting
 * on the unrounded values looks equivalent and is not: the score multiplies
 * two figures that are each rounded first, and a product of roundings is not
 * monotonic in the product — 8.6 × 4.1 is the smaller pair and prints the
 * larger score. Ranking on what is not printed put a 36 above a 35.
 */
export function combatFigures(
  stats: Record<string, number>,
  factor: number,
): { dps: number; survival: number; score: number } {
  const shown = (field: string, grow = false) =>
    statDisplay(
      stats[`${field}_min`] * (grow ? factor : 1),
      stats[`${field}_max`] * (grow ? factor : 1),
    ).value

  const dps = damagePerSecond(shown('damage', true), shown('attackspeed'))
  const surv = survival(shown('health', true), meanResistance(stats))

  return {
    dps,
    survival: surv,
    /* As printed: survival whole, DPS to two places. */
    score: combatScore(Math.round(surv), Math.round(dps * 100) / 100),
  }
}

interface Band {
  floor: number
  ceiling: number
}

/**
 * Best case is the hardest hit on the shortest cooldown, worst case the
 * softest on the longest — the two stats pull in opposite directions, so the
 * band's ends pair a ceiling with a floor rather than like with like.
 */
function dpsBand(template: ClassTemplate): Band | null {
  const dmg = classBand('damage', template)
  const cd = classBand('attackspeed', template)
  if (cd.floor <= 0 || cd.ceiling <= 0) return null
  return { floor: dmg.floor / cd.ceiling, ceiling: dmg.ceiling / cd.floor }
}

function survivalBand(template: ClassTemplate): Band {
  const hp = classBand('health', template)
  const res = RESISTANCE_FIELDS.map((f) => classBand(f, template))
  const mean = (pick: (b: Band) => number) =>
    res.reduce((a, b) => a + pick(b), 0) / res.length / (STAT_SCALE * 100)
  return { floor: hp.floor * mean((b) => b.floor), ceiling: hp.ceiling * mean((b) => b.ceiling) }
}

export function gradeDamagePerSecond(
  damage: number,
  cooldown: number,
  template: ClassTemplate | undefined,
): StatGrade | null {
  if (!template) return 'middle'
  const band = dpsBand(template)
  if (!band) return 'middle'
  return gradeInBand(damagePerSecond(damage, cooldown), band.floor, band.ceiling)
}

export function gradeSurvival(
  health: number,
  meanRes: number,
  template: ClassTemplate | undefined,
): StatGrade | null {
  if (!template) return 'middle'
  const band = survivalBand(template)
  return gradeInBand(survival(health, meanRes), band.floor, band.ceiling)
}

/** Where a value sits in its band, 0 at the floor and 1 at the ceiling. */
function position(value: number, band: Band): number {
  const span = band.ceiling - band.floor
  if (span <= 0) return 0.5
  return Math.max(0, (value - band.floor) / span)
}

/**
 * The score graded on how far up both bands the fighter is, not on where the
 * product lands between the two products.
 *
 * The straight reading is the one that misleads. A product's range is the two
 * ceilings multiplied, so a fighter sitting halfway up both bands lands a
 * quarter of the way up that one — and against the live roster it marked 110
 * of 128 fighters below average, which is not a grade, it is a constant.
 *
 * So the two halves are placed in their own bands first and combined after,
 * as a geometric mean: halfway up both reads as halfway, top of both as the
 * top, and a fighter strong on one count and hopeless on the other is still
 * dragged down the way multiplying them should. Same sixths, same bands, one
 * scale that answers what the arrow is being asked.
 */
export function gradeCombatScore(
  health: number,
  meanRes: number,
  damage: number,
  cooldown: number,
  template: ClassTemplate | undefined,
): StatGrade | null {
  if (!template) return 'middle'
  const dps = dpsBand(template)
  if (!dps) return 'middle'

  const s = position(survival(health, meanRes), survivalBand(template))
  const d = position(damagePerSecond(damage, cooldown), dps)
  return gradeInBand(Math.sqrt(s * d), 0, 1)
}
