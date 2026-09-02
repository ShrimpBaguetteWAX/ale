import type {
  AbilityEffectRow,
  BattleAbility,
  BattleFighter,
  Battlestats,
  FightRow,
} from './types'

/**
 * Client-side replay of a battle.
 *
 * The contract's combat loop contains no randomness at all — every roll
 * happens before the first blow, when stats are drawn from each fighter's
 * min/max ranges. Those rolled values are exactly what a `fights` row stores
 * in `team1_fighters` / `team2_fighters`, so replaying a recorded battle is a
 * matter of running the same deterministic loop over the same start state.
 *
 * That is what makes an animated fight possible: the chain records only who
 * won and how many blows it took, and every intermediate frame is recovered
 * here rather than fetched.
 *
 * Verified against mainnet: replaying a live `fights` row reproduced the
 * recorded turn count, the recorded winner, and every fighter's closing
 * `battlestats` exactly, including the contract's divide-by-ten on the four
 * damage tallies.
 */

/** Stats the contract stores as `uint16_t`, where arithmetic wraps. */
const U16 = 0xffff
const toU16 = (n: number) => n & U16

/** The contract's `battle_stat_caps`, read from `battle.ale`/`config`. */
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
  res_gem: number
  res_metal: number
  res_air: number
  res_fire: number
  res_nature: number
  res_neutral: number
}

export const DEFAULT_CAPS: StatCaps = {
  health_min: 100,
  health_max: 32000,
  damage_min: 100,
  damage_max: 32000,
  taunt_min: 0,
  taunt_max: 32000,
  initiative_min: 0,
  initiative_max: 32000,
  attackspeed_min: 100,
  attackspeed_max: 32000,
  res_gem: 800,
  res_metal: 800,
  res_air: 800,
  res_fire: 800,
  res_nature: 800,
  res_neutral: 800,
}

const RESIST_FIELDS = [
  'res_gem',
  'res_metal',
  'res_air',
  'res_fire',
  'res_nature',
  'res_neutral',
] as const

/** Numeric fields a target selector or a condition may read. */
const SELECTABLE = new Set<string>([
  'taunt',
  'damage',
  'health',
  'initiative',
  'attackspeed',
  ...RESIST_FIELDS,
])

/** A fighter mid-battle: mutable stats plus the tallies being accumulated. */
export interface SimFighter {
  /** Stable across the whole replay, so the UI can key on it. */
  uid: string
  team: 1 | 2
  slot: number
  fighter_id: number
  classname: string
  racename: string
  element: string
  target: string
  gamertag: string
  owner: string
  level: number
  abilities: BattleAbility[]
  health: number
  max_health: number
  /** Health as combat opened, for the bar's full width. */
  start_health: number
  damage: number
  taunt: number
  initiative: number
  attackspeed: number
  res_gem: number
  res_metal: number
  res_air: number
  res_fire: number
  res_nature: number
  res_neutral: number
  bs: Battlestats
}

/** A stat one ability changed, so the animation can call it out. */
export interface EffectEvent {
  ability: string
  sourceUid: string
  targetUid: string
  /** Which side of the blow fired it, for the combat log. */
  trigger: 'on_attack' | 'on_defense' | 'on_fight_start'
  stat: string
  before: number
  after: number
}

/** One blow, with everything the animation needs to draw it. */
export interface TurnEvent {
  turn: number
  attackerUid: string
  defenderUid: string
  /** Health actually removed, after resistance and after clamping. */
  damage: number
  /** Before clamping to the defender's remaining health. */
  raw: number
  /** Absorbed by the defender's resistance to the attacker's element. */
  blocked: number
  /** Share of the attacker's damage that landed, 0–100. */
  effectiveness: number
  element: string
  killed: boolean
  defenderHealthBefore: number
  defenderHealthAfter: number
  defenderMaxHealth: number
  attackerHealth: number
  effects: EffectEvent[]
  /**
   * The attacker's wind-up at the moment it swung, before its own
   * attackspeed was added back on.
   *
   * This is the fight's clock: the contract always picks the living fighter
   * with the lowest `initiative`, so that value *is* the time the blow lands.
   * Recording it lets the screen place every fighter's cooldown exactly
   * rather than guessing at a pace.
   */
  clock: number
  /**
   * Every fighter after the blow, ability changes included.
   *
   * `initiative` and `attackspeed` are here rather than re-derived because
   * in-fight effects can change both, so counting swings would drift from the
   * contract the moment an ability lands.
   */
  snapshot: FighterSnapshot[]
}

export interface FighterSnapshot {
  uid: string
  health: number
  max_health: number
  initiative: number
  attackspeed: number
  damage: number
  taunt: number
}

export interface Replay {
  turns: TurnEvent[]
  /**
   * The live fighters, mutated in place by the loop.
   *
   * By the time a caller sees a `Replay` these hold the *closing* state, not
   * the opening one — every stat on them has been through the whole fight.
   * Read `opening` for where the fight started.
   */
  fighters: SimFighter[]
  /** Every fighter before the first blow, opening buffs already applied. */
  opening: FighterSnapshot[]
  /** What those opening buffs changed, for the log. */
  openingEffects: EffectEvent[]
  /** 1, 2, or null for a draw. */
  winner: 1 | 2 | null
  /** What the chain recorded, when replaying a stored row. */
  chainLog?: string
  chainTurns?: number
  /** Whether the replay agreed with the chain on winner and length. */
  matchesChain: boolean
}

/** The contract's cap check: truncate to uint16, then clamp. */
function capped(stat: string, value: number, caps: StatCaps): number {
  const v = toU16(value)
  const clamp = (lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
  switch (stat) {
    case 'damage':
      return clamp(caps.damage_min, caps.damage_max)
    case 'initiative':
      return clamp(caps.initiative_min, caps.initiative_max)
    case 'attackspeed':
      return clamp(caps.attackspeed_min, caps.attackspeed_max)
    case 'health':
      return clamp(caps.health_min, caps.health_max)
    case 'taunt':
      return clamp(caps.taunt_min, caps.taunt_max)
    case 'res_fire':
      return clamp(0, caps.res_fire)
    case 'res_air':
      return clamp(0, caps.res_air)
    case 'res_metal':
      return clamp(0, caps.res_metal)
    case 'res_gem':
      return clamp(0, caps.res_gem)
    case 'res_nature':
      return clamp(0, caps.res_nature)
    case 'res_neutral':
      return clamp(0, caps.res_neutral)
    default:
      return v
  }
}

/** `add_values`: floor at zero, then cap. */
function addValue(
  base: number,
  addition: number,
  stat: string,
  caps: StatCaps,
): number {
  return capped(stat, Math.max(0, base + addition), caps)
}

/**
 * First of equal values wins, matching `std::min_element` /
 * `std::max_element` — both move only on a strict improvement, so a tie keeps
 * the earlier fighter. Team order therefore decides ties, and it has to stay
 * exactly as the chain stored it.
 */
function firstBy(
  team: SimFighter[],
  key: keyof SimFighter,
  max: boolean,
): SimFighter {
  let best = team[0]
  for (const f of team) {
    const a = f[key] as number
    const b = best[key] as number
    if (max ? a > b : a < b) best = f
  }
  return best
}

/**
 * Who this attacker hits.
 *
 * Only `enemy_<stat>_<min|max>` names a stat. Everything else — ally targets,
 * `enemy_group`, an empty string, anything unrecognised — falls through to
 * highest taunt, which is the contract's own default.
 */
export function pickDefender(team: SimFighter[], target: string): SimFighter {
  const t = String(target || '')
  if (t.startsWith('enemy_')) {
    const m = /^enemy_(.+)_(min|max)$/.exec(t)
    if (m && SELECTABLE.has(m[1])) {
      return firstBy(team, m[1] as keyof SimFighter, m[2] === 'max')
    }
  }
  return firstBy(team, 'taunt', true)
}

function resistanceTo(defender: SimFighter, element: string): number {
  switch (element) {
    case 'gem':
      return defender.res_gem
    case 'air':
      return defender.res_air
    case 'fire':
      return defender.res_fire
    case 'neutral':
      return defender.res_neutral
    case 'metal':
      return defender.res_metal
    case 'nature':
      return defender.res_nature
    default:
      return 0
  }
}

/* ---------- conditions ---------- */

function matchesStat(f: SimFighter, a: BattleAbility): boolean {
  const isMin = a.condition_minmax === 'min'
  const isMax = a.condition_minmax === 'max'
  if (!isMin && !isMax) return false
  const value = Number(a.condition_value ?? 0)
  const name = String(a.condition_name ?? '')
  if (!SELECTABLE.has(name)) return false
  const stat = f[name as keyof SimFighter] as number
  return (isMin && stat >= value) || (isMax && stat <= value)
}

function matchesCondition(f: SimFighter, a: BattleAbility): boolean {
  switch (a.condition_group) {
    case 'class':
      return a.condition_name === f.classname
    case 'race':
      return a.condition_name === f.racename
    case 'element':
      return a.condition_name === f.element
    case 'stats':
      return matchesStat(f, a)
    default:
      return false
  }
}

/** Resolve an `ally_*` / `enemy_*` selector within one team. */
function resolveSingle(team: SimFighter[], target: string): SimFighter | null {
  if (!team.length) return null
  const m = /^(?:ally|enemy)_(.+)_(min|max)$/.exec(target)
  if (!m || !SELECTABLE.has(m[1])) return null
  return firstBy(team, m[1] as keyof SimFighter, m[2] === 'max')
}

/**
 * How many times an ability fires. `check_condition` returns 1 when the
 * ability carries no condition at all, so an unconditional ability always
 * applies once.
 */
function checkCondition(
  source: SimFighter,
  a: BattleAbility,
  own: SimFighter[],
  foes: SimFighter[],
  building: string,
): number {
  if (!a.check_condition || !a.condition_group) return 1

  const target = String(a.condition_target ?? '')
  if (a.condition_group === 'building') {
    return a.condition_name === building ? 1 : 0
  }
  if (target === 'self') return matchesCondition(source, a) ? 1 : 0
  if (target === 'ally_group') {
    return own.filter((f) => matchesCondition(f, a)).length
  }
  if (target === 'enemy_group') {
    return foes.filter((f) => matchesCondition(f, a)).length
  }

  let picked: SimFighter | null = null
  if (target.startsWith('ally_')) picked = resolveSingle(own, target)
  else if (target.startsWith('enemy_')) picked = resolveSingle(foes, target)
  return picked && matchesCondition(picked, a) ? 1 : 0
}

/**
 * `buff_condition`: the per-member filter for group targets.
 *
 * Two of the three cases pass everyone. `check_condition` means the gate was
 * already evaluated once by `checkCondition`, which returns 0 and skips the
 * loop when it fails; and an ability with no `condition_group` carries no
 * condition for a member to fail. Only a bare `condition_group` filters.
 */
function buffCondition(f: SimFighter, a: BattleAbility): boolean {
  if (a.check_condition || !a.condition_group) return true
  return matchesCondition(f, a)
}

/* ---------- in-fight effects ---------- */

const IF_STATS = new Set<string>([
  'damage',
  'attackspeed',
  'health',
  'health_atk',
  'initiative',
  'taunt',
  ...RESIST_FIELDS,
])

/**
 * Apply one ability's in-fight effects to a fighter.
 *
 * `health` and `health_atk` are the two that bypass the battle caps — see the
 * comment on the branch below for why.
 */
function performIfBuff(
  target: SimFighter,
  /** Whose ability this is, for the log. */
  owner: SimFighter,
  effects: AbilityEffectRow[],
  /**
   * What the blow this pass follows actually took off the defender.
   *
   * `health_atk` is a share of it — "X% of damage dealt" read from the
   * attacker's abilities, "X% of damage taken" read from the defender's,
   * which is the same number seen from either side.
   */
  damageDealt: number,
  caps: StatCaps,
  ability: string,
  trigger: 'on_attack' | 'on_defense',
  out: EffectEvent[],
): void {
  for (const effect of effects) {
    const stat = String(effect.stat_name ?? '')
    if (!IF_STATS.has(stat)) continue

    const field = stat === 'health_atk' ? 'health' : stat
    const before = target[field as keyof SimFighter] as number
    let next: number

    if (stat === 'health' || stat === 'health_atk') {
      /*
        Health is the one stat the battle caps do not decide.

        A heal stops at the fighter's own max_health, which the caps would not
        do — they would let it run to the global health_max, and the contract
        then pinned max_health to the new value, so a healed fighter read as
        full for the rest of the fight. Damage runs all the way down to 0 so a
        cleave can kill, where the caps would floor it at health_min.
      */
      const raw =
        stat === 'health_atk'
          ? /*
               A share of the damage that actually landed. Resistance was
               already charged when the blow was struck — and the attacker's
               resistance ignore with it — so it must not be charged again.
             */
            before +
            (effect.percentflat === 'percent'
              ? Math.trunc((damageDealt * effect.value) / 100)
              : effect.value)
          : effect.percentflat === 'percent'
            ? Math.trunc((before * (100 + effect.value)) / 100)
            : before + effect.value

      next = Math.min(Math.max(raw, 0), target.max_health)
    } else if (effect.percentflat === 'percent') {
      next = capped(stat, Math.trunc((before * (100 + effect.value)) / 100), caps)
    } else {
      next = addValue(before, effect.value, stat, caps)
    }

    const record = target as unknown as Record<string, number>
    record[field] = next

    if (next !== before) {
      out.push({
        ability,
        sourceUid: owner.uid,
        targetUid: target.uid,
        trigger,
        stat: field,
        before,
        after: next,
      })
    }
  }
}

const isAllyTarget = (t: string) =>
  t === 'ally_group' || t === 'self' || t.startsWith('ally_')
const isEnemyTarget = (t: string) => t === 'enemy_group' || t.startsWith('enemy_')

/**
 * The per-attack ability pass.
 *
 * Mirrors the `ifeffect` lambda in `fight()`, including the one quirk kept
 * from the version it replaced: conditions read the attacker as it stood when
 * the pass began rather than as earlier abilities in the same pass left it.
 */
function applyIfEffects(
  attacker: SimFighter,
  defender: SimFighter,
  attackerTeam: SimFighter[],
  defenderTeam: SimFighter[],
  building: string,
  caps: StatCaps,
  /** What the blow this pass follows actually took off the defender. */
  damageDealt: number,
  out: EffectEvent[],
): void {
  const snapshot = { ...attacker }

  const run = (
    owner: SimFighter,
    abilities: BattleAbility[],
    onAttack: boolean,
    allies: SimFighter[],
    foes: SimFighter[],
  ) => {
    for (const ability of abilities) {
      const target = String(ability.bf_target ?? '')
      /*
        `on_fight_start` now *excludes* an ability from the in-fight pass
        rather than being required for it — the two are treated as different
        kinds of ability, one that fires as the fight opens and one that fires
        on a blow. Until recently this read `!ability.on_fight_start`, which
        meant no ability in the game could ever reach here.
      */
      if (!target || ability.locked || ability.on_fight_start) continue
      if (onAttack ? !ability.on_attack : !ability.on_defense) continue

      const effects = ability.if_effects ?? []
      if (!effects.length) continue

      const ally = isAllyTarget(target)
      if (!ally && !isEnemyTarget(target)) continue
      const team = ally ? allies : foes

      let count = checkCondition(snapshot, ability, allies, foes, building)
      if (!ability.effect_on_condition_count && count > 0) count = 1

      const name = ability.displayname || ability.ability || 'Special Ability'
      const trigger = onAttack ? 'on_attack' : 'on_defense'
      for (let n = 0; n < count; n++) {
        if (target === 'ally_group' || target === 'enemy_group') {
          for (const f of team) {
            if (buffCondition(f, ability)) {
              performIfBuff(f, owner, effects, damageDealt, caps, name, trigger, out)
            }
          }
        } else if (target === 'self') {
          /* The ability's own owner. */
          performIfBuff(owner, owner, effects, damageDealt, caps, name, trigger, out)
        } else if (target === 'enemy_attacker') {
          /* Whoever threw the blow, in either pass. */
          performIfBuff(attacker, owner, effects, damageDealt, caps, name, trigger, out)
        } else {
          const picked = resolveSingle(team, target)
          if (picked) {
            performIfBuff(picked, owner, effects, damageDealt, caps, name, trigger, out)
          }
        }
      }
    }
  }

  run(attacker, attacker.abilities, true, attackerTeam, defenderTeam)
  run(defender, defender.abilities, false, defenderTeam, attackerTeam)
}

/* ---------- battle-start effects ---------- */

/**
 * The stats a `bf_effect` may name.
 *
 * `health_atk` is deliberately absent: it exists only for in-fight effects,
 * where there is an attacker whose blow it can measure. `perform_buff` has no
 * such fighter and no branch for it.
 */
const BF_STATS = new Set<string>([
  'damage',
  'attackspeed',
  'health',
  'initiative',
  'taunt',
  ...RESIST_FIELDS,
])

/** `perform_buff`: one ability's opening effects on one fighter. */
function performBuff(
  target: SimFighter,
  effects: AbilityEffectRow[],
  caps: StatCaps,
  ability: string,
  out: EffectEvent[],
  sourceUid: string,
): void {
  for (const effect of effects) {
    const stat = String(effect.stat_name ?? '')
    if (!BF_STATS.has(stat)) continue

    const before = target[stat as keyof SimFighter] as number
    const next =
      effect.percentflat === 'percent'
        ? capped(stat, Math.trunc((before * (100 + effect.value)) / 100), caps)
        : addValue(before, effect.value, stat, caps)

    const record = target as unknown as Record<string, number>
    record[stat] = next
    /* The contract pins the ceiling to the new value, as it does in-fight. */
    if (stat === 'health') target.max_health = next

    if (next !== before) {
      out.push({
        ability,
        sourceUid,
        targetUid: target.uid,
        trigger: 'on_fight_start',
        stat,
        before,
        after: next,
      })
    }
  }
}

/**
 * `prepare_buff`: the pass that runs once, before the first blow.
 *
 * The contract calls this four times — buffs for each side, then debuffs for
 * each — so every ally buff lands before any enemy debuff does, and the order
 * changes the result whenever a percentage is involved.
 *
 * Worth knowing when reading a stored fight: the line-ups the chain saves are
 * snapshotted *before* this runs, so the numbers on a `fights` row are the
 * unbuffed ones and this has to be replayed to reach the state the combat
 * loop actually started from.
 */
function applyStartBuffs(
  buffingTeam: SimFighter[],
  opposingTeam: SimFighter[],
  phase: 'buff' | 'debuff',
  building: string,
  caps: StatCaps,
  out: EffectEvent[],
): void {
  for (const source of buffingTeam) {
    for (const ability of source.abilities) {
      const target = String(ability.bf_target ?? '')
      if (!target || ability.locked || !ability.on_fight_start) continue

      const effects = ability.bf_effects ?? []
      if (!effects.length) continue

      const ally = isAllyTarget(target)
      const enemy = isEnemyTarget(target)
      if (phase === 'buff' ? !ally : !enemy) continue

      const team = phase === 'buff' ? buffingTeam : opposingTeam
      const name = ability.displayname || ability.ability || 'Special Ability'

      let count = checkCondition(source, ability, buffingTeam, opposingTeam, building)
      if (!ability.effect_on_condition_count && count > 0) count = 1

      for (let n = 0; n < count; n++) {
        if (target === 'ally_group' || target === 'enemy_group') {
          for (const f of team) {
            if (buffCondition(f, ability)) {
              performBuff(f, effects, caps, name, out, source.uid)
            }
          }
        } else if (target === 'self') {
          performBuff(source, effects, caps, name, out, source.uid)
        } else {
          const picked = resolveSingle(team, target)
          if (picked) performBuff(picked, effects, caps, name, out, source.uid)
        }
      }
    }
  }
}

/**
 * `remove_used_abilities`: strip every ability that carried opening effects.
 *
 * Note what this drops — the *whole ability*, not just its `bf_effects`. An
 * ability with both opening and in-fight effects fires the first once and
 * then loses the second for the rest of the fight.
 */
function removeUsedAbilities(fighters: SimFighter[]): void {
  for (const f of fighters) {
    f.abilities = f.abilities.filter((a) => !(a.bf_effects ?? []).length)
  }
}

/**
 * Drop everyone at 0 health, in place.
 *
 * Mirrors `sweep_dead` in the contract. Checking only the fighter that was
 * struck is not enough: an `enemy_group` cleave can kill outright, and it can
 * finish someone who never defended this turn.
 */
function sweepDead(team: SimFighter[]): void {
  for (let i = team.length - 1; i >= 0; i--) {
    if (team[i].health === 0) team.splice(i, 1)
  }
}

/* ---------- the loop ---------- */

function blankStats(): Battlestats {
  return {
    attacks_made: 0,
    attacks_received: 0,
    damage_dealt: 0,
    damage_blocked_by_enemy: 0,
    damage_taken: 0,
    damage_blocked: 0,
    knockouts: 0,
    survived: true,
  }
}

function toSim(f: BattleFighter, team: 1 | 2, slot: number): SimFighter {
  return {
    uid: `${team}-${slot}-${f.fighter_id}`,
    team,
    slot,
    fighter_id: f.fighter_id,
    classname: String(f.classname ?? ''),
    racename: String(f.racename ?? ''),
    element: String(f.element ?? ''),
    target: String(f.target ?? ''),
    gamertag: f.gamertag ?? '',
    owner: f.owner ?? '',
    level: f.level ?? 0,
    abilities: f.specialAbility ?? [],
    health: f.health,
    max_health: f.max_health,
    start_health: f.health,
    damage: f.damage,
    taunt: f.taunt,
    initiative: f.initiative,
    attackspeed: f.attackspeed,
    res_gem: f.res_gem,
    res_metal: f.res_metal,
    res_air: f.res_air,
    res_fire: f.res_fire,
    res_nature: f.res_nature,
    res_neutral: f.res_neutral,
    bs: blankStats(),
  }
}

/** The contract gives up after a thousand blows and calls it a draw. */
/*
 * A safety stop, not a rule.
 *
 * Only the tournament path in `fight()` caps the loop at 1000 attacks; the
 * dungeon and arena loop runs until one side is wiped out and has no cap at
 * all. Stopping at 1000 here would report a draw where the chain recorded a
 * winner, so the ceiling is set high enough to be unreachable in practice
 * while still refusing to hang the tab on a pathological fight.
 */
const MAX_TURNS = 20_000

export interface SimOptions {
  tauntDeduction: number
  caps?: StatCaps
  /** Which building hosts the fight, for `building` ability conditions. */
  building?: string
}

/**
 * Replay a recorded battle blow by blow.
 *
 * Returns every turn plus the fighters in their closing state, so the caller
 * can animate forward or jump straight to the result.
 */
export function simulate(row: FightRow, options: SimOptions): Replay {
  const caps = options.caps ?? DEFAULT_CAPS
  const building = options.building ?? 'dungeon'

  const team1 = row.team1_fighters.map((f, i) => toSim(f, 1, i))
  const team2 = row.team2_fighters.map((f, i) => toSim(f, 2, i))
  const all = [...team1, ...team2]

  /*
     The opening buffs, in the contract's order: allies for both sides first,
     then enemies for both. The stored line-ups are snapshotted *before* this
     runs, so replaying it is what puts the fighters into the state the combat
     loop actually began from.
   */
  const opened: EffectEvent[] = []
  applyStartBuffs(team1, team2, 'buff', building, caps, opened)
  applyStartBuffs(team2, team1, 'buff', building, caps, opened)
  applyStartBuffs(team1, team2, 'debuff', building, caps, opened)
  applyStartBuffs(team2, team1, 'debuff', building, caps, opened)
  removeUsedAbilities(team1)
  removeUsedAbilities(team2)

  const living1 = [...team1]
  const living2 = [...team2]
  const turns: TurnEvent[] = []

  const snapshotOf = (f: SimFighter): FighterSnapshot => ({
    uid: f.uid,
    health: f.health,
    max_health: f.max_health,
    initiative: f.initiative,
    attackspeed: f.attackspeed,
    damage: f.damage,
    taunt: f.taunt,
  })

  /* Taken before the loop, which mutates `all` in place from here on. */
  const opening = all.map(snapshotOf)

  let count = 0
  while (living1.length && living2.length && count < MAX_TURNS) {
    count++

    const first1 = firstBy(living1, 'initiative', false)
    const first2 = firstBy(living2, 'initiative', false)
    // Ties go to team 1: they move first, and the contract's `<=` says so.
    const attackerIsTeam1 = first1.initiative <= first2.initiative
    const attacker = attackerIsTeam1 ? first1 : first2
    const ownTeam = attackerIsTeam1 ? living1 : living2
    const foeTeam = attackerIsTeam1 ? living2 : living1
    const defender = pickDefender(foeTeam, attacker.target)

    const element = attacker.element
    /*
       "Striking ignores X% of target resistance" - Irresistable, Mind Damage
       and Void Damage. Summed across the attacker's on_attack abilities and
       capped at 100, so stacking two can never drive resistance negative.
    */
    let ignoreRes = 0
    for (const a of attacker.abilities) {
      if (a.on_attack && !a.locked) ignoreRes += Number(a.ignore_res_percent ?? 0)
    }
    if (ignoreRes > 100) ignoreRes = 100
    const resistance = Math.floor(
      (resistanceTo(defender, element) * (100 - ignoreRes)) / 100,
    )
    const resistPct = Math.trunc(resistance / 10)
    const damagePct = Math.max(0, 100 - resistPct)
    const raw = Math.trunc((attacker.damage * damagePct) / 100)
    const damage = Math.min(raw, defender.health)
    const blocked = Math.trunc((raw * resistPct) / 100)

    const defenderHealthBefore = defender.health
    const killed = damage >= defender.health
    /* The fight's clock: the lowest wind-up among the living is *now*. */
    const clock = attacker.initiative

    if (killed) {
      attacker.bs.knockouts++
      defender.bs.survived = false
    }
    attacker.bs.damage_dealt += damage
    attacker.bs.damage_blocked_by_enemy += blocked
    defender.bs.damage_taken += damage
    defender.bs.damage_blocked += blocked
    attacker.bs.attacks_made++
    defender.bs.attacks_received++

    if (defender.health > damage) {
      // Taunt only decays on a survivor; a fighter that drops keeps its value.
      defender.taunt =
        defender.taunt > options.tauntDeduction
          ? defender.taunt - options.tauntDeduction
          : 0
      defender.health -= damage
    } else {
      defender.health = 0
    }

    attacker.initiative += attacker.attackspeed

    const effects: EffectEvent[] = []
    applyIfEffects(
      attacker,
      defender,
      ownTeam,
      foeTeam,
      building,
      caps,
      damage,
      effects,
    )

    /*
       Death is settled by the blow, not by what the effects do after it. An
       on_defense self heal fires while the corpse is still in the team, so
       re-reading health here would let a fighter already at 0 stand back up.
    */
    if (killed) defender.health = 0

    sweepDead(living1)
    sweepDead(living2)

    turns.push({
      turn: count,
      attackerUid: attacker.uid,
      defenderUid: defender.uid,
      damage,
      raw,
      blocked,
      effectiveness: damagePct,
      element,
      killed,
      defenderHealthBefore,
      defenderHealthAfter: defender.health,
      defenderMaxHealth: defender.max_health,
      attackerHealth: attacker.health,
      clock,
      effects,
      snapshot: all.map(snapshotOf),
    })
  }

  // A stalemate is only possible in a tournament, where the contract stops at
  // 1000; elsewhere the loop runs until a side is wiped, so reaching the stop
  // above means the simulation diverged rather than that the fight drew.
  const winner: 1 | 2 | null =
    living2.length === 0 ? 1 : living1.length === 0 ? 2 : null

  const expected =
    winner === 1 ? 'Team 1 wins' : winner === 2 ? 'Team 2 wins' : 'Draw'
  const chainLog = row.log
  const matchesChain =
    !chainLog || (chainLog === expected && (!row.turns || row.turns === count))

  return {
    turns,
    fighters: all,
    opening,
    openingEffects: opened,
    winner,
    chainLog,
    chainTurns: row.turns,
    matchesChain,
  }
}
