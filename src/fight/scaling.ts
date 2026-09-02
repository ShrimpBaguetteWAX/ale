/**
 * What `apply_weather_and_age` does to a fighter before the first blow.
 *
 * Easy to miss, and it dominates everything else on the screen:
 *
 *     const uint64_t battle_level =
 *         (dungeon_difficulty == 0) ? fighter.level : dungeon_difficulty;
 *     const double level_factor = pow(level_mod, battle_level);
 *     fighter.health = health * level_factor * age_decay_percent;
 *
 * `dungeon_difficulty` is 0 for *both* teams in an arena and for the player's
 * team in a dungeon, and 0 does not mean "no scaling" — it means "use the
 * fighter's own level". At the live `level_mod` of 1.15 a level 10 fighter
 * therefore enters the ring at four times its stored health and damage.
 *
 * Age pulls the other way: `age_decay ^ (days²)` is imperceptible for a week
 * and then falls off a cliff, which is what makes an old fighter worthless
 * rather than merely worse.
 *
 * Weather is deliberately not applied here. It depends on the land's current
 * roll, is shared by both sides, and is better shown beside the matchup than
 * folded silently into it.
 */

/** Per-level growth, `battle.ale`/`config.level_mod`. Arrives as a float string. */
export function levelFactor(level: number, levelMod: number): number {
  if (!Number.isFinite(levelMod) || levelMod <= 0) return 1
  return Math.pow(levelMod, Math.max(0, level))
}

/** Whole days since a fighter was created, the contract's integer division. */
export function daysOld(creationDate: string | undefined, now = Date.now()): number {
  if (!creationDate) return 0
  const made = Date.parse(creationDate + 'Z')
  if (!Number.isFinite(made)) return 0
  return Math.max(0, Math.floor((now - made) / 86_400_000))
}

/** `age_decay ^ (days²)`, from `battle.ale`/`config.age_decay`. */
export function ageFactor(
  creationDate: string | undefined,
  ageDecay: number,
  now = Date.now(),
): number {
  if (!Number.isFinite(ageDecay) || ageDecay <= 0 || ageDecay >= 1) return 1
  const days = daysOld(creationDate, now)
  return Math.pow(ageDecay, days * days)
}

export interface Scalable {
  health: number
  max_health: number
  damage: number
}

/**
 * A fighter as it will be fielded, level and age applied.
 *
 * The contract multiplies the two doubles together and truncates once, at the
 * assignment — not after each factor — so this does the same.
 */
export function fieldedStats<T extends Scalable>(
  fighter: T,
  level: number,
  creationDate: string | undefined,
  levelMod: number,
  ageDecay: number,
  now = Date.now(),
): T {
  const factor = levelFactor(level, levelMod) * ageFactor(creationDate, ageDecay, now)
  return {
    ...fighter,
    health: Math.trunc(fighter.health * factor),
    max_health: Math.trunc(fighter.max_health * factor),
    damage: Math.trunc(fighter.damage * factor),
  }
}
