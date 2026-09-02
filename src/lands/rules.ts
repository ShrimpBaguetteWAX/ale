import type { Building, LandsConfig } from '@/chain/types'
import { liveBoostScore, BOOST_MAX } from '@/map/terrain'
import type { BuildingCost, LandIncome, OwnedLand } from './types'
import type { BuildingName } from './queries'

/**
 * The economics of owning land, read out of `maps.cpp`.
 *
 * Three of its rules are not visible anywhere on the row and decide
 * everything the screen can offer:
 *
 * 1. **Boost is a percentage on a 0–1,000,000 scale, and it decays.** The
 *    contract loses `boost_decay_per_hour` for every whole hour since
 *    `boost_score_update` and refuses to run a building once that reaches
 *    `disable_building_boost_score`. So a landowner's real job is topping the
 *    boost back up, and the number on the row is always stale.
 *
 * 2. **Boosting is priced as a geometric series**, so the next percentage
 *    point always costs more than the last. Buying from 35% to 100% is not
 *    twice the price of 35% to 67% — it is far more, and the screen has to
 *    show the real curve rather than a per-point average.
 *
 * 3. **One primary building per land, and nothing else without one.** Tavern,
 *    dungeon and arena are the primaries; the contract refuses a second, and
 *    refuses any non-primary before the first. Since those three are also the
 *    only buildings that exist today, a land is effectively a one-building
 *    plot.
 */

/** Buildings the contract treats as primary — one per land, and required first. */
export const PRIMARY_BUILDINGS = ['tavern', 'dungeon', 'arena'] as const

export function isPrimary(name: string): boolean {
  return (PRIMARY_BUILDINGS as readonly string[]).includes(name?.toLowerCase())
}

/* ---------- income ---------- */

/**
 * What a land is holding for its owner.
 *
 * Note `shards` is reported separately from the rest and never as claimable:
 * `claimlndrwrd` sums gems, credits and TLM, but zeroes `shards` while
 * passing 0 into the `unclaimed_shards` argument of `gaincur` — so claiming
 * *destroys* accrued shards rather than paying them. `delbuilding` does the
 * same. Showing them beside the TLM as though they were coming would be a lie
 * worth real money: one land on chain is sitting on 829 of them.
 */
export function incomeOf(buildings: Building[]): LandIncome {
  const out: LandIncome = { tlm: 0, credits: 0, gems: 0, shards: 0 }
  for (const b of buildings) {
    out.tlm += Number(b.tlm ?? 0)
    out.credits += Number(b.credits ?? 0)
    out.gems += Number(b.gems ?? 0)
    out.shards += Number(b.shards ?? 0)
  }
  return out
}

/** Anything `claimlndrwrd` will actually pay out. */
export function hasClaimable(income: LandIncome): boolean {
  return income.tlm > 0 || income.credits > 0 || income.gems > 0
}

export function totalIncome(lands: OwnedLand[]): LandIncome {
  const out: LandIncome = { tlm: 0, credits: 0, gems: 0, shards: 0 }
  for (const l of lands) {
    const i = incomeOf(l.buildings)
    out.tlm += i.tlm
    out.credits += i.credits
    out.gems += i.gems
    out.shards += i.shards
  }
  return out
}

/* ---------- boost ---------- */

/**
 * What the contract will charge to raise a building's boost to `target`.
 *
 * Straight from `maps::boost`, in the same float arithmetic and the same
 * order:
 *
 *     term(v) = (1 - mod^(v / 10000 + 1)) / (1 - mod)
 *     cost    = base + firstPercent * (term(target) - term(current))
 *
 * The contract charges the figure it computes itself and only sanity-checks
 * that the client's estimate is not more than a percent above it, so this
 * exists to be *shown*, not to be sent. Getting it wrong understates a spend
 * that can run to hundreds of thousands of credits.
 */
export function boostCost(
  current: number,
  target: number,
  config: LandsConfig | undefined,
): number {
  if (!config || target <= current) return 0

  const mod = Number(config.boost_cost_mod)
  const base = Number(config.boost_base_cost)
  const first = Number(config.boost_cost_first_percent)
  if (!Number.isFinite(mod) || mod === 1) return 0

  const term = (v: number) => (1 - Math.pow(mod, v / 10_000 + 1)) / (1 - mod)

  return Math.floor(base + first * (term(target) - term(current)))
}

/** What the next whole percentage point costs from here — the marginal rate. */
export function costPerPercent(current: number, config: LandsConfig | undefined): number {
  const next = Math.min(BOOST_MAX, current + 10_000)
  if (next <= current) return 0
  // Subtracting the flat base twice would double-count it.
  return boostCost(current, next, config) - Number(config?.boost_base_cost ?? 0)
}

/**
 * How long until a boost decays to the point the building stops working.
 *
 * The threshold is `disable_building_boost_score`, which is zero today — so
 * this is usually "when it runs out" rather than "when it trips a floor", but
 * reading it from config means the screen stays right if that changes.
 */
export function msUntilDisabled(
  building: Building,
  config: LandsConfig | undefined,
  now = Date.now(),
): number {
  const perHour = Number(config?.boost_decay_per_hour ?? 0)
  if (perHour <= 0) return Number.POSITIVE_INFINITY

  const live = liveBoostScore(
    Number(building.boost_score ?? 0),
    String(building.boost_score_update ?? ''),
    perHour,
    now,
  )
  const floor = Number(config?.disable_building_boost_score ?? 0)
  if (live <= floor) return 0

  return ((live - floor) / perHour) * 3_600_000
}

/** "4 months", "12 days", "6 hours" — the scale a landowner plans on. */
export function formatSpan(ms: number): string {
  if (!Number.isFinite(ms)) return 'never'
  if (ms <= 0) return 'now'

  const hours = ms / 3_600_000
  if (hours < 48) return `${Math.round(hours)} hours`

  const days = hours / 24
  if (days < 60) return `${Math.round(days)} days`

  return `${Math.round(days / 30)} months`
}

/* ---------- building ---------- */

export interface BuildOption {
  building: BuildingName
  /** Absent once the ladder runs out — nothing left to build or upgrade. */
  cost?: BuildingCost
  /** The level this would take the building to. */
  level: number
  /** After the land's rarity discount — the figure the contract checks. */
  credits: number
  gems: number
  /** Already standing here, so this would be an upgrade rather than a build. */
  existing?: Building
  /** Why it cannot be built right now, if it cannot. */
  blocked?: string
}

/**
 * What can be built or upgraded on one land, and at what price.
 *
 * The rarity discount is applied here because the contract asserts on it:
 * `cost_credits + discount == buildingcost.cost_credits`, so a legendary
 * land's 9,999 is not a courtesy — it is the only number that will sign.
 */
export function buildOptions(
  land: OwnedLand,
  costs: Map<string, BuildingCost[]>,
  discounts: Map<string, number>,
  buildings: readonly BuildingName[],
): BuildOption[] {
  const discount = discounts.get(land.rarity) ?? 0
  const hasPrimary = land.buildings.some((b) => isPrimary(String(b.building_name ?? '')))

  return buildings.map((name) => {
    const existing = land.buildings.find(
      (b) => String(b.building_name ?? '').toLowerCase() === name,
    )
    const level = existing ? Number(existing.level ?? 0) + 1 : 1
    const cost = costs.get(name)?.find((c) => c.level === level)

    let blocked: string | undefined
    if (!cost) {
      blocked = existing
        ? `Level ${level} is not available yet`
        : 'No price is configured for this building'
    } else if (!existing && hasPrimary) {
      blocked = 'This land already has a primary building'
    }

    return {
      building: name,
      cost,
      level,
      credits: Math.max(0, (cost?.cost_credits ?? 0) - discount),
      gems: cost?.cost_gem ?? 0,
      existing,
      blocked,
    }
  })
}

/** Nicely-cased building name for display, from the cost row when we have one. */
export function buildingLabel(name: string, costs?: Map<string, BuildingCost[]>): string {
  const listed = costs?.get(name)?.[0]?.displayname
  if (listed) return listed
  return name ? name[0].toUpperCase() + name.slice(1) : name
}
