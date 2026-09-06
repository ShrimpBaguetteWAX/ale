import {
  RESISTANCE_FIELDS,
  STAT_SCALE,
  classBand,
  gradeInBand,
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

export function gradeDamagePerSecond(
  damage: number,
  cooldown: number,
  template: ClassTemplate | undefined,
): StatGrade | null {
  if (!template) return 'middle'
  const dmg = classBand('damage', template)
  const cd = classBand('attackspeed', template)
  if (cd.floor <= 0 || cd.ceiling <= 0) return 'middle'

  /*
     Best case is the hardest hit on the shortest cooldown, worst case the
     softest on the longest — the two stats pull in opposite directions, so
     the band's ends pair a ceiling with a floor rather than like with like.
   */
  return gradeInBand(
    damagePerSecond(damage, cooldown),
    dmg.floor / cd.ceiling,
    dmg.ceiling / cd.floor,
  )
}

export function gradeSurvival(
  health: number,
  meanRes: number,
  template: ClassTemplate | undefined,
): StatGrade | null {
  if (!template) return 'middle'
  const hp = classBand('health', template)

  const bands = RESISTANCE_FIELDS.map((f) => classBand(f, template))
  const resFloor =
    bands.reduce((a, b) => a + b.floor, 0) / bands.length / (STAT_SCALE * 100)
  const resCeiling =
    bands.reduce((a, b) => a + b.ceiling, 0) / bands.length / (STAT_SCALE * 100)

  return gradeInBand(
    survival(health, meanRes),
    hp.floor * resFloor,
    hp.ceiling * resCeiling,
  )
}
