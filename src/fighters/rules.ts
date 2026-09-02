import type { RosterFighter } from '@/dungeon/types'
import type { FighterLevel, FightersConfig } from './types'

/**
 * The economics of keeping a roster, taken from `fighters.ale` rather than
 * from the live UI.
 *
 * Two of the contract's rules are easy to get backwards, and the original
 * screen gets one of them wrong, so they are worth stating plainly:
 *
 * 1. **A payday costs credits, it does not pay them.** `den::payday` ends in
 *    `inline_spendcur`. It is upkeep — wages, not winnings — and skipping it
 *    first benches the fighter, then deletes them.
 * 2. **Levelling is charged for the level you are leaving, not the one you
 *    are entering.** The contract sums `levels[new_level - 1]`, i.e. the row
 *    matching the fighter's *current* level, and aborts on any mismatch with
 *    the number the client signed. Every level costs 999 credits today, which
 *    is why the live site's off-by-one has never bitten anyone.
 */

/** Seconds → milliseconds, for chain timestamps, which carry no zone. */
function ts(date: string): number {
  return Date.parse(date + 'Z')
}

/* ---------- payday ---------- */

export interface Payday {
  /** Credits `den::payday` will charge for this fighter right now. */
  cost: number
  /** How far through the paid interval the fighter is, 0–1. */
  progress: number
  /** `next_payday` has passed: the fighter is benched until paid. */
  overdue: boolean
  /** Milliseconds until `next_payday`; negative once overdue. */
  msLeft: number
}

/**
 * What a payday costs today.
 *
 * The contract prices it by elapsed time — pay after half the interval and
 * you are charged half — then adds one credit and truncates:
 *
 *     pay = (float)elapsed / (float)interval * standard_pay_payday + 1
 *
 * Paying resets the clock to a full interval regardless, so paying early
 * buys nothing; the trailing +1 makes frequent small paydays very slightly
 * worse than waiting. Nothing here is sent to the chain — `payday` takes no
 * cost argument and recomputes its own — so this is a forecast, not a
 * commitment.
 */
export function paydayOf(
  f: RosterFighter,
  config: FightersConfig | undefined,
  now = Date.now(),
): Payday {
  const next = ts(f.next_payday)
  const last = ts(f.last_payday)
  const full = next - last

  if (!Number.isFinite(next) || !Number.isFinite(last) || full <= 0) {
    return { cost: 0, progress: 0, overdue: false, msLeft: 0 }
  }

  const untilNext = Math.max(0, next - now)
  const elapsed = full - untilNext
  const rate = config?.standard_pay_payday ?? 0

  return {
    cost: Math.floor((elapsed / full) * rate + 1),
    progress: Math.min(1, Math.max(0, elapsed / full)),
    overdue: now >= next,
    msLeft: next - now,
  }
}

/**
 * Worth paying at all.
 *
 * A fighter paid moments ago is charged one credit for nothing, so the
 * blanket "Payday All" skips them — this is the original's own test, read
 * out of its reducer.
 */
export function paydayWorthwhile(p: Payday): boolean {
  return p.cost > 1
}

/** Benched: `next_payday` has passed and the contract will refuse a fight. */
export function wantsPayday(f: RosterFighter, now = Date.now()): boolean {
  const next = ts(f.next_payday)
  return Number.isFinite(next) && now >= next
}

/**
 * How long until the row itself is erased.
 *
 * `payday` sets `final_deletion_date` 90 days past the next payday, and
 * `deloldfigtrs` sweeps anything past it. An overdue fighter is therefore
 * not merely idle — they are on a countdown to being gone.
 */
export function msUntilDeletion(f: RosterFighter, now = Date.now()): number {
  const at = ts(f.final_deletion_date)
  return Number.isFinite(at) ? at - now : Number.POSITIVE_INFINITY
}

/* ---------- levelling ---------- */

export interface LevelUp {
  /** Absent once the fighter is at the ceiling. */
  next?: FighterLevel
  cost: { credits: number; gems: number }
  /** Enough XP banked, and a level left to spend it on. */
  ready: boolean
  /** 0–100, capped: XP can overshoot and the bar should not. */
  xpPercent: number
  atMax: boolean
}

export function levelUpOf(f: RosterFighter, levels: FighterLevel[]): LevelUp {
  const s = f.stats
  const next = levels.find((l) => l.level === s.level + 1)
  /* Charged for the level being left — see the note at the top of the file. */
  const priced = levels.find((l) => l.level === s.level)
  const hasXp = s.required_experience > 0 && s.experience >= s.required_experience

  return {
    next,
    cost: {
      credits: priced?.unlock_cost_credits ?? 0,
      gems: priced?.unlock_cost_gem ?? 0,
    },
    ready: !!next && hasXp,
    xpPercent:
      s.required_experience > 0
        ? Math.min(100, (s.experience / s.required_experience) * 100)
        : 0,
    atMax: !next,
  }
}

/**
 * The action's two cost fields are `uint16`, so one transaction cannot be
 * asked to spend more than this — and it checks the figure exactly, so
 * overflowing it does not overcharge, it aborts.
 */
const COST_FIELD_MAX = 65_535

/**
 * Every fighter that can level right now, with the exact bill for the batch.
 *
 * Capped at what the action can express: at 999 credits a level that is 65
 * fighters, and a hundred-strong roster of ready fighters would otherwise
 * build a transaction the contract refuses. `skipped` is what did not fit, so
 * the button can say to press it again.
 */
export function levelAllPlan(
  roster: RosterFighter[],
  levels: FighterLevel[],
): { ids: number[]; credits: number; gems: number; skipped: number } {
  let credits = 0
  let gems = 0
  let skipped = 0
  const ids: number[] = []

  for (const f of roster) {
    const l = levelUpOf(f, levels)
    if (!l.ready) continue
    if (
      credits + l.cost.credits > COST_FIELD_MAX ||
      gems + l.cost.gems > COST_FIELD_MAX
    ) {
      skipped += 1
      continue
    }
    ids.push(f.fighter_id)
    credits += l.cost.credits
    gems += l.cost.gems
  }

  return { ids, credits, gems, skipped }
}

/** Every fighter worth paying, with the running total. */
export function paydayAllPlan(
  roster: RosterFighter[],
  config: FightersConfig | undefined,
  now = Date.now(),
): { ids: number[]; credits: number } {
  let credits = 0
  const ids: number[] = []

  for (const f of roster) {
    const p = paydayOf(f, config, now)
    if (!paydayWorthwhile(p)) continue
    ids.push(f.fighter_id)
    credits += p.cost
  }

  return { ids, credits }
}

/* ---------- what the fighter actually brings ---------- */

/**
 * The health and damage multiplier a fighter carries into a fight.
 *
 * `apply_weather_and_age` scales both by `level_mod ^ level` and by
 * `age_decay ^ (days²)`, so the stored roll is neither what the player owns
 * nor what they field. The roster screen shows the fought-with number,
 * because that is the one that decides anything.
 *
 * This is deliberately not the live site's arithmetic. That build hardcodes a
 * 1.1 level factor against a chain that has run at 1.15 for some time, and
 * reads an `age_penaly_percent_day` key that `battle.ale/config` does not
 * have — so it falls back to a default that erodes a stat by 0.01% a day
 * instead of the real curve.
 */
export function battleFactor(
  f: RosterFighter,
  levelMod: number,
  ageDecay: number,
  now = Date.now(),
): { level: number; age: number; total: number } {
  const level = Math.pow(levelMod, f.stats.level)

  const created = ts(f.creation_date)
  const days = Number.isFinite(created)
    ? Math.max(0, Math.floor((now - created) / 86_400_000))
    : 0
  const age = ageDecay ? Math.pow(ageDecay, days * days) : 1

  return { level, age, total: level * age }
}

/** Days since the fighter was rolled — what the age curve is a function of. */
export function ageDays(f: RosterFighter, now = Date.now()): number {
  const created = ts(f.creation_date)
  if (!Number.isFinite(created)) return 0
  return Math.max(0, Math.floor((now - created) / 86_400_000))
}

/* ---------- state ---------- */

export type FighterState = 'ready' | 'busy' | 'overdue'

export function fighterState(f: RosterFighter, now = Date.now()): FighterState {
  if (f.in_use) return 'busy'
  if (wantsPayday(f, now)) return 'overdue'
  return 'ready'
}

/**
 * What the fighter is busy doing, in the original's words.
 *
 * `use_type` is a free string written by whichever contract locked the
 * fighter, so an unrecognised value falls back to the honest generic rather
 * than being dropped.
 */
export function useLabel(f: RosterFighter): string {
  switch ((f.use_type ?? '').toLowerCase()) {
    case 'market':
      return 'In Market'
    case 'arena':
      return 'Defending Arena'
    case 'dungeon':
      return 'In Dungeon'
    default:
      return 'In Use'
  }
}

/**
 * Selling is refused for a locked fighter — `check(!in_use)` — and there is
 * no reason to stop a player selling one that owes a payday, so this is the
 * only bar.
 */
export function sellable(f: RosterFighter): boolean {
  return !f.in_use
}

/* ---------- formatting ---------- */

export function formatDate(date: string): string {
  const t = ts(date)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(date: string): string {
  const t = ts(date)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "in 12 days" / "6 days ago", which is what a deadline actually means. */
export function formatRelativeDays(ms: number): string {
  const days = Math.round(ms / 86_400_000)
  if (days === 0) return 'today'
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`
  const past = -days
  return `${past} day${past === 1 ? '' : 's'} ago`
}

/**
 * The age bonus, as the live game states it.
 *
 * Recovered from the deployed client rather than invented, so the two agree:
 *
 *     d = 1 - age_decay ^ (days²)        // the share of the roll already lost
 *     bonus = 100 - 200 * d
 *
 * That is a linear remap of the surviving factor onto a −100…+100 scale, and
 * it is worth being clear about what it therefore means, because it does not
 * read the way a percentage usually does: a fighter that has lost nothing
 * shows **+100%**, not 0%, and one that has lost half its roll shows **0%**.
 * The number is a condition gauge, not a multiplier — a fighter at "+94%" is
 * fighting at 97% of its stats, not 194%.
 *
 * Stated here once so no screen has to re-derive it and land on a different
 * scale from its neighbour.
 */
export function ageBonus(
  f: RosterFighter,
  ageDecay: number,
  now = Date.now(),
): number {
  const days = ageDays(f, now)
  const lost = ageDecay ? 1 - Math.pow(ageDecay, days * days) : 0
  return 100 - 200 * lost
}

/**
 * How worried to look about an age bonus.
 *
 * The scale runs +100 down to -100, so its midpoint is a fighter that has
 * already lost half its roll — well past the point it is worth fielding.
 */
/**
 * What an age bonus means, said once so three screens cannot word it three
 * ways.
 *
 * The percentage and the multiplier are two rescalings of the same number and
 * they do not look like it: the contract multiplies health and damage by
 * `age_decay ^ (days²)`, which runs from 1.0 down to 0, while the badge the
 * live game shows is `200·factor - 100`, which runs +100% down to -100%. So
 * "+100%" is a fighter at its full stored roll, not one with double it, and
 * "0%" is one that has already lost half — the opposite of how a plus sign
 * usually reads.
 *
 * The multiplier is therefore always given alongside the badge, because it is
 * the number the fight actually uses.
 */
export function ageNote(bonus: number, days: number, ageFactor: number): string {
  const sign = bonus > 0 ? '+' : ''
  return (
    `Age ${sign}${bonus.toFixed(0)}% — ${days} day${days === 1 ? '' : 's'} old. ` +
    `Health and damage fight at ×${ageFactor.toFixed(2)} of the roll. ` +
    `+100% is untouched, 0% is half gone.`
  )
}

export function ageBand(bonus: number): 'fresh' | 'worn' | 'bad' {
  if (bonus >= 80) return 'fresh'
  if (bonus >= 40) return 'worn'
  return 'bad'
}
