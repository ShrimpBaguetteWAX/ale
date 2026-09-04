import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { TTL } from '@/chain/cache'

/**
 * `ascend.ale` / `config`.
 *
 * `ascension_fee_level_mod` is dead: the code that raised the fee per
 * ascension level is commented out in `ascend`, along with the price check it
 * fed. The flat `ascension_credit_fee` is what is actually spent, so that is
 * what the screen quotes.
 */
/**
 * The floors and ceilings a fighter's stats are held between.
 *
 * Only the floors matter to an ascension: `ascupgrade` adds health, damage
 * and resistances with no ceiling check at all, and clamps only when it is
 * *subtracting* from taunt, wind-up or cooldown — a roll that would take one
 * of those under its floor drops it to the floor instead, so the player gets
 * less than the number on the offer.
 */
export interface StatCaps {
  health_min: number
  health_max: number
  damage_min: number
  damage_max: number
  taunt_min: number
  taunt_max: number
  initiative_min: number
  initiative_max: number
  attackspeed_min: number
  attackspeed_max: number
}

export interface AscensionConfig {
  config_id: number
  ascension_credit_fee: number
  ascension_reroll_credit_cost: number
  /** A fighter must be exactly this level — not merely at or above it. */
  min_ascension_level: number
  ascension_fee_level_mod: number | string
  battle_stat_caps: StatCaps
}

export function fetchAscensionConfig(): Promise<AscensionConfig | undefined> {
  return getRow<AscensionConfig>(
    {
      code: CONTRACTS.ascension,
      scope: CONTRACTS.ascension,
      table: 'config',
      key: 0,
    },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * `ascend.ale` / `asccats` — the categories an offer is drawn from.
 *
 * `ascend` picks a category by weight against `asctracking.total_weight`,
 * then an upgrade inside it by weight against the category's own
 * `upgrade_totalweight`. So the chance of any single upgrade is the product
 * of the two, which is what makes the odds worth showing: at the live
 * weights a resistance roll is four times rarer than a main-stat one.
 */
export interface AscensionCategory {
  category: string
  weight: number
  upgrade_amount: number
  upgrade_totalweight: number
}

export function fetchAscensionCategories(): Promise<AscensionCategory[]> {
  return getAllRows<AscensionCategory>(
    { code: CONTRACTS.ascension, scope: CONTRACTS.ascension, table: 'asccats' },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * `ascend.ale` / `ascupgrades`, scoped by category — every possible roll.
 *
 * `positive_min_max` says whether the value is added or subtracted, *not*
 * whether it is good: subtracting attackspeed or initiative makes a fighter
 * faster, and the two negative main-stat rolls are among the better ones.
 */
export interface AscensionUpgrade {
  upgrade_name: string
  stat_name: string
  weight: number
  min: number
  max: number
  rounding: number
  positive_min_max: number | boolean
}

export function fetchAscensionUpgrades(
  category: string,
): Promise<AscensionUpgrade[]> {
  return getAllRows<AscensionUpgrade>(
    { code: CONTRACTS.ascension, scope: category, table: 'ascupgrades' },
    { ttl: TTL.long, persist: true },
  )
}

/** `ascend.ale` / `asctracking` — the summed category weight. */
export interface AscensionTracking {
  index: number
  total_weight: number
}

export function fetchAscensionTracking(): Promise<AscensionTracking | undefined> {
  return getRow<AscensionTracking>(
    {
      code: CONTRACTS.ascension,
      scope: CONTRACTS.ascension,
      table: 'asctracking',
      key: 0,
    },
    { ttl: TTL.long, persist: true },
  )
}

/** Every upgrade in the game, with the category it came from. */
export interface UpgradeOdds extends AscensionUpgrade {
  category: string
  /** 0–1 chance of this exact upgrade on any one of the three rolls. */
  chance: number
}

export async function fetchAllUpgrades(): Promise<UpgradeOdds[]> {
  const [cats, tracking] = await Promise.all([
    fetchAscensionCategories(),
    fetchAscensionTracking(),
  ])

  const totalWeight =
    Number(tracking?.total_weight ?? 0) ||
    cats.reduce((n, c) => n + Number(c.weight), 0)

  const lists = await Promise.all(
    cats.map((c) => fetchAscensionUpgrades(c.category)),
  )

  const out: UpgradeOdds[] = []
  cats.forEach((cat, i) => {
    const catChance = totalWeight > 0 ? Number(cat.weight) / totalWeight : 0
    const inner = Number(cat.upgrade_totalweight) || 0
    for (const up of lists[i]) {
      out.push({
        ...up,
        category: cat.category,
        chance: inner > 0 ? catChance * (Number(up.weight) / inner) : 0,
      })
    }
  })
  return out
}
