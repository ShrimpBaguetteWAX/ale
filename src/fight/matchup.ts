import type { BattleAbility, BattleFighter, RosterFighter } from '@/dungeon/types'
import { ageFactor, levelFactor } from './scaling'

/**
 * How one fighter fares against one specific enemy line-up.
 *
 * The game has an elemental system that the setup screen never showed. A
 * fighter's damage is cut by the defender's resistance to *that fighter's
 * element*, and the same fighter's survival depends on its resistances to the
 * elements coming back at it — so the same roster entry is excellent against
 * one dungeon and close to useless against the next, with nothing on its card
 * to say which. Abilities compound it: a good many are gated on the enemy's
 * class, race or element and simply do not fire against the wrong team.
 *
 * All three are computable before a single blow, from numbers already on the
 * screen. This is that computation, and it is the single source the badges,
 * the filters, the sorts and auto-pick all read — so what the player filters
 * on is exactly what auto-pick optimised for and exactly what the card shows.
 *
 * Every formula here mirrors `sim.ts`, which in turn mirrors the contract.
 * Where it approximates, it says so.
 */

/** Which resistance field an attacking element is read against. */
const RES_FIELD: Record<string, keyof Resistances> = {
  gem: 'res_gem',
  air: 'res_air',
  fire: 'res_fire',
  neutral: 'res_neutral',
  metal: 'res_metal',
  nature: 'res_nature',
}

export interface Resistances {
  res_gem: number
  res_metal: number
  res_air: number
  res_fire: number
  res_nature: number
  res_neutral: number
}

/** Numeric fields a condition may read — `SELECTABLE` in the simulator. */
const SELECTABLE = new Set<string>([
  'taunt',
  'damage',
  'health',
  'initiative',
  'attackspeed',
  'res_gem',
  'res_metal',
  'res_air',
  'res_fire',
  'res_nature',
  'res_neutral',
])

export function resistanceTo(f: Resistances, element: string): number {
  const field = RES_FIELD[element]
  return field ? Number(f[field] ?? 0) : 0
}

/**
 * The share of a blow that gets through, 0 to 1.
 *
 * `resistPct = trunc(resistance / 10)`, then `damagePct = 100 - resistPct` —
 * the contract's integer steps, not a float ratio, so a resistance of 649 and
 * one of 640 both block 64%.
 */
export function damageShare(resistance: number): number {
  const resistPct = Math.trunc(Math.max(0, resistance) / 10)
  return Math.max(0, 100 - resistPct) / 100
}

/** How much of the attacker's resistance-piercing applies. */
export function ignoreResOf(abilities: BattleAbility[] | undefined): number {
  let total = 0
  for (const a of abilities ?? []) {
    if (a.on_attack && !a.locked) total += Number(a.ignore_res_percent ?? 0)
  }
  return Math.min(100, total)
}

/* ---------- ability conditions that this enemy line satisfies ---------- */

function matchesStat(e: Combatant, a: BattleAbility): boolean {
  const isMin = a.condition_minmax === 'min'
  const isMax = a.condition_minmax === 'max'
  if (!isMin && !isMax) return false
  const name = String(a.condition_name ?? '')
  if (!SELECTABLE.has(name)) return false
  const stat = Number((e as unknown as Record<string, number>)[name] ?? 0)
  const value = Number(a.condition_value ?? 0)
  return (isMin && stat >= value) || (isMax && stat <= value)
}

function matchesCondition(e: Combatant, a: BattleAbility): boolean {
  switch (a.condition_group) {
    case 'class':
      return a.condition_name === e.classname
    case 'race':
      return a.condition_name === e.racename
    case 'element':
      return a.condition_name === e.element
    case 'stats':
      return matchesStat(e, a)
    default:
      return false
  }
}

/** `std::max_element` semantics: a tie keeps the earlier fighter. */
function firstBy(team: Combatant[], key: string, max: boolean): Combatant | null {
  if (!team.length) return null
  let best = team[0]
  for (const f of team) {
    const a = Number((f as unknown as Record<string, number>)[key] ?? 0)
    const b = Number((best as unknown as Record<string, number>)[key] ?? 0)
    if (max ? a > b : a < b) best = f
  }
  return best
}

function resolveSingle(team: Combatant[], target: string): Combatant | null {
  const m = /^enemy_(.+)_(min|max)$/.exec(target)
  if (!m || !SELECTABLE.has(m[1])) return null
  return firstBy(team, m[1], m[2] === 'max')
}

/**
 * How many times this ability fires because of who is on the other side.
 *
 * Deliberately narrower than the simulator's `checkCondition`: only
 * enemy-facing conditions are counted. `self` and `ally_*` conditions depend
 * on the team still being assembled, so counting them here would make a
 * fighter's badge change as its team-mates were picked — a number that moves
 * while you are not looking at it is worse than one that is merely partial.
 *
 * An unconditional ability scores zero too. It fires against every dungeon
 * equally, so it says nothing about *this* one, which is the only question
 * being asked.
 */
export function enemyTriggers(a: BattleAbility, enemies: BattleFighter[]): number {
  return triggersOn(a, enemies.map(fromBattle))
}

function triggersOn(a: BattleAbility, foes: Combatant[]): number {
  if (a.locked) return 0
  if (!a.check_condition || !a.condition_group) return 0
  if (a.condition_group === 'building') return 0

  const target = String(a.condition_target ?? '')
  if (target === 'enemy_group') {
    const n = foes.filter((e) => matchesCondition(e, a)).length
    return a.effect_on_condition_count ? n : n > 0 ? 1 : 0
  }
  if (target.startsWith('enemy_')) {
    const picked = resolveSingle(foes, target)
    return picked && matchesCondition(picked, a) ? 1 : 0
  }
  return 0
}

/* ---------- the matchup ---------- */

export interface Matchup {
  /** Share of this fighter's damage that survives enemy resistance, 0 to 1. */
  offense: number
  /** Share of incoming damage this fighter's resistances turn away, 0 to 1. */
  defense: number
  /** Ability firings this particular line-up hands the fighter. */
  bonuses: number
  /** Which abilities those are, for the tooltip. */
  bonusNames: string[]
  /**
   * The other direction: enemy abilities this fighter switches on by being
   * picked at all.
   *
   * The gating is symmetric — a dungeon fighter can carry "against fire" just
   * as readily as yours can — so a pick that looks strong on its own numbers
   * can be the reason the other side gets three extra firings. Without this
   * the screen only ever showed the half of the trade that flattered you.
   */
  exposure: number
  /** Which of their abilities, for the tooltip. */
  exposureNames: string[]
  /** Ranking figure. Comparable within one enemy line-up, meaningless across. */
  score: number
}

export const NO_MATCHUP: Matchup = {
  offense: 1,
  defense: 0,
  bonuses: 0,
  bonusNames: [],
  exposure: 0,
  exposureNames: [],
  score: 0,
}

const mid = (a: number, b: number) => (a + b) / 2

/**
 * How much a triggered ability is worth, as a multiplier on the score.
 *
 * A guess, and there is no honest way for it not to be: abilities range from
 * a few points of taunt to doubling damage, and pricing each one properly
 * would mean simulating the fight. It is set low enough that it breaks ties
 * and tips close calls rather than overturning a real stat advantage, which
 * is the behaviour a player can predict.
 */
const BONUS_WEIGHT = 0.15

/**
 * A fighter reduced to what the matchup actually reads.
 *
 * Roster entries carry min/max ranges and a creation date; the crew and
 * weapon cards carry flat values and neither. Both end up here so the two
 * halves of a team are ranked by the same measure.
 */
export interface FlatFighter extends Resistances {
  element: string
  damage: number
  health: number
  attackspeed: number
  abilities?: BattleAbility[]
  /* Only read by ability conditions, so both are optional. */
  classname?: string
  racename?: string
  taunt?: number
  initiative?: number
}

/**
 * A fighter from either side, in one shape.
 *
 * The enemy line arrives as `BattleFighter` (abilities under
 * `specialAbility`) and the player's as roster entries or card values. The
 * maths is the same for both — an enemy's resistance to my element is read
 * exactly as my resistance to theirs — so both are converted here rather than
 * having two copies of every formula that could drift apart.
 */
type Combatant = Required<Pick<FlatFighter, 'element' | 'damage' | 'health' | 'attackspeed' | 'classname' | 'racename' | 'taunt' | 'initiative'>> &
  Resistances & { abilities: BattleAbility[] }

function fromBattle(b: BattleFighter): Combatant {
  return {
    element: b.element, classname: b.classname, racename: b.racename,
    damage: b.damage, health: b.health, attackspeed: b.attackspeed,
    taunt: b.taunt, initiative: b.initiative,
    res_gem: b.res_gem, res_metal: b.res_metal, res_air: b.res_air,
    res_fire: b.res_fire, res_nature: b.res_nature, res_neutral: b.res_neutral,
    abilities: b.specialAbility ?? [],
  }
}

function fromFlat(f: FlatFighter): Combatant {
  return {
    element: f.element, classname: f.classname ?? '', racename: f.racename ?? '',
    damage: f.damage, health: f.health, attackspeed: f.attackspeed,
    taunt: f.taunt ?? 0, initiative: f.initiative ?? 0,
    res_gem: f.res_gem, res_metal: f.res_metal, res_air: f.res_air,
    res_fire: f.res_fire, res_nature: f.res_nature, res_neutral: f.res_neutral,
    abilities: f.abilities ?? [],
  }
}

function offenceAgainst(
  element: string,
  abilities: BattleAbility[] | undefined,
  foes: Combatant[],
): number {
  const pierce = (100 - ignoreResOf(abilities)) / 100
  return (
    foes.reduce(
      (sum, e) => sum + damageShare(Math.floor(resistanceTo(e, element) * pierce)),
      0,
    ) / foes.length
  )
}

/*
   Defence is read from the enemy's side of the same sum: each of them pierces
   with its own abilities, so a line full of resistance-ignoring attackers
   leaves a wall of a fighter no better off than a paper one.
*/
function defenceAgainst(mine: Resistances, foes: Combatant[]): number {
  return (
    foes.reduce((sum, e) => {
      const pierce = (100 - ignoreResOf(e.abilities)) / 100
      return sum + (1 - damageShare(Math.floor(resistanceTo(mine, e.element) * pierce)))
    }, 0) / foes.length
  )
}

function bonusesAgainst(
  abilities: BattleAbility[] | undefined,
  foes: Combatant[],
): { bonuses: number; bonusNames: string[] } {
  let bonuses = 0
  const bonusNames: string[] = []
  for (const a of abilities ?? []) {
    const n = triggersOn(a, foes)
    if (n > 0) {
      bonuses += n
      bonusNames.push(a.displayname || a.ability)
    }
  }
  return { bonuses, bonusNames }
}

/**
 * What the far side's abilities get out of this one fighter.
 *
 * Read the same way round as everything else, which is why it reuses
 * `triggersOn` unchanged: an ability's `enemy_*` condition means "the team
 * opposite whoever owns it", so pointing their abilities at a line-up of one
 * asks exactly the right question — would this fighter, on its own, give that
 * ability something to fire at.
 *
 * Judging it alone rather than against the assembled team is deliberate, for
 * the same reason the bonuses are: a number that changed as team-mates were
 * picked would move while the player was not looking at it.
 */
function exposureTo(
  target: Combatant,
  sources: Combatant[],
): { exposure: number; exposureNames: string[] } {
  let exposure = 0
  const names = new Set<string>()
  const solo = [target]
  for (const s of sources) {
    for (const a of s.abilities) {
      const n = triggersOn(a, solo)
      if (n > 0) {
        exposure += n
        names.add(a.displayname || a.ability)
      }
    }
  }
  return { exposure, exposureNames: [...names] }
}

/**
 * Damage per tick that actually lands, times how long the fighter lasts.
 *
 * One line, and it is the whole ranking. Both halves matter and they trade
 * against each other, which is why neither is offered on its own as "the"
 * score.
 */
function rank(
  damage: number,
  health: number,
  cooldown: number,
  offense: number,
  defense: number,
  bonuses: number,
): number {
  const dps = (damage * offense) / Math.max(1, cooldown)
  /* Resistance is capped at 800 on chain, so this cannot divide by zero. */
  const ehp = health / Math.max(0.05, 1 - defense)
  return dps * ehp * (1 + BONUS_WEIGHT * bonuses)
}

/**
 * The same measure, for anything that is already a flat set of stats.
 *
 * Used for the crew and weapon cards, whose combined fighter takes its element
 * from the weapon alone - so which weapon is best genuinely depends on who is
 * being fought, and picking one by raw damage can hand the enemy a free 60%
 * resistance.
 */
export function flatMatchup(f: FlatFighter, enemies: BattleFighter[]): Matchup {
  return matchupBetween(f, enemies.map(battleAsFlat))
}

/** A `BattleFighter` in the shape both sides of the maths share. */
export function battleAsFlat(b: BattleFighter): FlatFighter {
  return { ...fromBattle(b) }
}

/**
 * One fighter against one line-up, both sides in the same shape.
 *
 * The general form. `matchupOf` is this for a roster entry and
 * `flatMatchup` is this for an enemy line; it is exported so the screen can
 * also turn the question round and ask how each *enemy* fares against the
 * team being assembled, which is the same computation with the arguments
 * swapped.
 */
export function matchupBetween(f: FlatFighter, foeList: FlatFighter[]): Matchup {
  if (!foeList.length) return NO_MATCHUP
  const foes = foeList.map(fromFlat)
  const offense = offenceAgainst(f.element, f.abilities, foes)
  const defense = defenceAgainst(f, foes)
  const { bonuses, bonusNames } = bonusesAgainst(f.abilities, foes)
  const { exposure, exposureNames } = exposureTo(fromFlat(f), foes)
  return {
    offense,
    defense,
    bonuses,
    bonusNames,
    exposure,
    exposureNames,
    score: rank(f.damage, f.health, f.attackspeed, offense, defense, bonuses),
  }
}

/**
 * A fighter's standing against one enemy line-up.
 *
 * `offense` and `defense` average over the whole line rather than following
 * the target selector, because over a fight a team meets all of it — and the
 * selector's answer changes every time somebody dies, so a number built on it
 * would be right for one blow and wrong for the rest.
 */
export function matchupOf(
  f: RosterFighter,
  enemies: BattleFighter[],
  levelMod: number,
  ageDecay: number,
  now = Date.now(),
): Matchup {
  if (!enemies.length) return NO_MATCHUP
  const s = f.stats

  /*
     Level and age are applied before anything is compared, because a level 10
     fighter enters at four times its stored numbers and an old one at a
     fraction of them — comparing stored stats would order the roster wrongly
     before any of the elemental maths got a look in.
  */
  const factor =
    levelFactor(s.level, levelMod) * ageFactor(f.creation_date, ageDecay, now)

  return matchupBetween(
    {
      element: f.element,
      classname: f.classname,
      racename: f.racename,
      damage: mid(s.damage_min, s.damage_max) * factor,
      health: mid(s.health_min, s.health_max) * factor,
      attackspeed: mid(s.attackspeed_min, s.attackspeed_max),
      taunt: mid(s.taunt_min, s.taunt_max),
      initiative: mid(s.initiative_min, s.initiative_max),
      res_gem: s.res_gem, res_metal: s.res_metal, res_air: s.res_air,
      res_fire: s.res_fire, res_nature: s.res_nature, res_neutral: s.res_neutral,
      abilities: s.abilities ?? [],
    },
    enemies.map(battleAsFlat),
  )
}

/** Every roster fighter's standing, keyed by id. */
export function matchupsFor(
  roster: RosterFighter[],
  enemies: BattleFighter[],
  levelMod: number,
  ageDecay: number,
  now = Date.now(),
): Map<number, Matchup> {
  const out = new Map<number, Matchup>()
  for (const f of roster) {
    out.set(f.fighter_id, matchupOf(f, enemies, levelMod, ageDecay, now))
  }
  return out
}

/**
 * One side of the matchup, as the balance bar needs it.
 *
 * `health` and `damage` are the totals as fielded — level and age already
 * applied, so they are the numbers that enter the ring rather than the ones
 * stored on the row. The two shares are what the elements do to them.
 */
export interface SideOutlook {
  health: number
  damage: number
  /** Damage after the far side's resistance to each fighter's element. */
  effectiveDamage: number
  /** Health stretched by how much of the incoming damage is turned away. */
  effectiveHealth: number
  /** Share of this side's damage that lands, 0 to 1. */
  landShare: number
  /** Share of the damage aimed at this side that it turns away, 0 to 1. */
  blockShare: number
  /** Ability firings the far side's composition hands this one. */
  bonuses: number
  /** Effective damage times effective health, abilities folded in. */
  power: number
}

function sideOutlook(side: Combatant[], foes: Combatant[]): SideOutlook {
  let health = 0
  let damage = 0
  let effectiveHealth = 0
  let effectiveDamage = 0
  let bonuses = 0

  for (const f of side) {
    health += f.health
    damage += f.damage
    if (foes.length) {
      effectiveDamage += f.damage * offenceAgainst(f.element, f.abilities, foes)
      /* Resistance is capped at 800 on chain, so this cannot divide by zero. */
      effectiveHealth += f.health / Math.max(0.05, 1 - defenceAgainst(f, foes))
      for (const a of f.abilities) bonuses += triggersOn(a, foes)
    } else {
      effectiveDamage += f.damage
      effectiveHealth += f.health
    }
  }

  return {
    health,
    damage,
    effectiveDamage,
    effectiveHealth,
    landShare: damage > 0 ? effectiveDamage / damage : 1,
    blockShare: effectiveHealth > 0 ? 1 - health / effectiveHealth : 0,
    bonuses,
    /*
       Abilities are folded into power but deliberately not into
       `effectiveDamage`: that figure is the elemental answer, and it is shown
       to the player as a percentage they can check against a card. Mixing a
       weighted guess into a number that reads as exact would be dishonest.
    */
    power: effectiveDamage * effectiveHealth * (1 + BONUS_WEIGHT * bonuses),
  }
}

export interface TeamOutlook {
  mine: SideOutlook
  theirs: SideOutlook
  /** The player's share of the matchup, 0 to 1. */
  share: number
}

/**
 * Both sides of the balance bar.
 *
 * The bar used to be `total health x total damage` per side, which ignored
 * the whole elemental system: a team whose damage was 70% resisted read as
 * strong as one that was landing everything, and abilities that only fire
 * against this dungeon counted for nothing. It also compared the player's
 * *stored* stats against the enemy's *scaled* ones, so a levelled team was
 * being undersold several times over.
 *
 * This measures both sides the same way and with the elements applied: damage
 * that gets past the far side's resistances, over health stretched by what
 * this side turns away, with the abilities each line-up hands the other folded
 * in. It still knows nothing about targeting or turn order — the label beside
 * the bar says so — but every input it does have is now the one the fight will
 * use.
 */
export function teamOutlook(mine: FlatFighter[], theirs: BattleFighter[]): TeamOutlook {
  const ours = mine.map(fromFlat)
  const foes = theirs.map(fromBattle)
  const a = sideOutlook(ours, foes)
  const b = sideOutlook(foes, ours)
  const total = a.power + b.power
  return { mine: a, theirs: b, share: total > 0 ? a.power / total : 0.5 }
}

/**
 * What the enemy line is made of, for the "why" beside the filters.
 *
 * A player who is told a fighter is weak here should be able to see the
 * reason without opening five enemy cards.
 */
export function enemyProfile(enemies: BattleFighter[]): {
  elements: { name: string; count: number }[]
  classes: { name: string; count: number }[]
} {
  const tally = (pick: (e: BattleFighter) => string) => {
    const m = new Map<string, number>()
    for (const e of enemies) {
      const key = pick(e)
      if (key) m.set(key, (m.get(key) ?? 0) + 1)
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }
  return { elements: tally((e) => e.element), classes: tally((e) => e.classname) }
}
