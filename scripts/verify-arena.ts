/**
 * Pins the arena rules against the contract they mirror.
 *
 *   npx vite build --ssr scripts/verify-arena.ts --outDir .ssr
 *   node .ssr/verify-arena.js
 *
 * Two halves. The first derives expectations from `arena.cpp` and the
 * `is_arena` branch of `battle.cpp` and checks the pure functions against
 * them. The second pulls a real arena off the chain and walks it through the
 * same pipeline the contract uses, so the numbers on the screen are checked
 * against live data rather than against fixtures I chose.
 */
import {
  ARENA_POWER_FLOOR,
  ARENA_POWER_FULL,
  ARENA_POWER_PER_LOSS,
  alreadyDefending,
  applyArenaPower,
  arenaMaintained,
  arenaPowerPercent,
  canChallenge,
  myDefenders,
} from '../src/arena/rules'
import { ageFactor, daysOld, fieldedStats, levelFactor } from '../src/fight/scaling'
import type { LiveArenaRow } from '../src/arena/queries'
import type { BattleFighter, RosterFighter } from '../src/dungeon/types'
import type { Land, Player } from '../src/chain/types'

let pass = 0
let fail = 0
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log((ok ? '  ok   ' : '  FAIL ') + name)
  if (!ok) {
    console.log('         got  ' + JSON.stringify(got))
    console.log('         want ' + JSON.stringify(want))
  }
  ok ? pass++ : fail++
}

const fighter = (over: Partial<BattleFighter> = {}) =>
  ({
    fighter_id: 1, owner: 'someone', gamertag: '', avatar: '',
    health: 1000, max_health: 1000, damage: 500, taunt: 100,
    initiative: 100, attackspeed: 100,
    res_gem: 0, res_metal: 0, res_air: 0, res_fire: 0, res_nature: 0, res_neutral: 0,
    classname: 'mystic', racename: 'human', element: 'fire', target: '',
    specialAbility: [], level: 0, battlestats: {},
    ...over,
  }) as unknown as BattleFighter

const arenaOf = (fighters: BattleFighter[]) =>
  ({ planet: 'magor', land_id: 'bbxbd', fighters, last_fight: '', template_ids: [] }) as unknown as LiveArenaRow

const landOf = (name: string, boost: number) =>
  ({ land_id: 'bbxbd', buildings: [{ building_name: name, boost_score: boost }] }) as unknown as Land

const roster = (over: Partial<RosterFighter> = {}) =>
  ({
    fighter_id: 7, owner: 'me', classname: 'mystic', racename: 'human', element: 'fire',
    stats: { level: 0, health_min: 100, health_max: 100, damage_min: 100, damage_max: 100 },
    creation_date: '2026-09-01T00:00:00',
    in_use: 0, use_type: '', next_payday: '2099-01-01T00:00:00',
    ...over,
  }) as unknown as RosterFighter

const playerOf = (energy: number) =>
  ({ wallet: 'me', activestats: { action_points: energy } }) as unknown as Player

async function main() {
  console.log('arena rules\n')

  /* --- apply_arenapow --- */
  {
    // health = health * arena_power / 10000, truncated, per stat.
    const [f] = applyArenaPower([fighter({ health: 1000, max_health: 1000, damage: 500 })], 5_000)
    check('half power halves health, max health and damage',
      [f.health, f.max_health, f.damage], [500, 500, 250])

    const [g] = applyArenaPower([fighter({ health: 999, max_health: 999, damage: 333 })], 3_333)
    check('each stat truncates on its own',
      [g.health, g.max_health, g.damage],
      [Math.trunc(999 * 3333 / 10000), Math.trunc(999 * 3333 / 10000), Math.trunc(333 * 3333 / 10000)])

    const [h] = applyArenaPower([fighter({ taunt: 777, initiative: 55, attackspeed: 66 })], 5_000)
    check('taunt, wind-up and cooldown are left alone',
      [h.taunt, h.initiative, h.attackspeed], [777, 55, 66])

    const [i] = applyArenaPower([fighter()], ARENA_POWER_FULL)
    check('full power changes nothing', [i.health, i.damage], [1000, 500])
  }

  /* --- the level trap --- */
  {
    // battle_level = (dungeon_difficulty == 0) ? fighter.level : difficulty,
    // and an arena always passes 0 — so 0 means "use the fighter's level".
    check('level 0 scales by one', levelFactor(0, 1.15), 1)
    check('level 10 at 1.15 is roughly fourfold', Number(levelFactor(10, 1.15).toFixed(4)), 4.0456)

    const f = fieldedStats(fighter({ health: 631, max_health: 631, damage: 142 }),
      10, undefined, 1.15, 1)
    check('a level 10 defender is fielded four times as strong',
      [f.health, f.max_health, f.damage], [2552, 2552, 574])

    const flat = fieldedStats(fighter({ health: 631, damage: 142 }), 0, undefined, 1.15, 1)
    check('a level 0 defender is fielded as stored', [flat.health, flat.damage], [631, 142])
  }

  /* --- age decay --- */
  {
    const now = Date.parse('2026-09-11T00:00:00Z')
    check('whole days only, as the contract integer-divides',
      daysOld('2026-09-01T12:00:00', now), 9)
    check('a fighter made today decays by nothing',
      ageFactor('2026-09-11T00:00:00', 0.99997997283935547, now), 1)
    // age_decay ^ (days * days) — 9 days is 81 applications, still gentle
    const nineDays = ageFactor('2026-09-01T12:00:00', 0.99997997283935547, now)
    check('nine days is still within a percent', nineDays > 0.998 && nineDays < 1, true)
  }

  /* --- who may challenge --- */
  {
    check('an arena holding one of my fighters is closed to me',
      alreadyDefending(arenaOf([fighter({ owner: 'me' }), fighter({ owner: 'other' })]), 'me'), true)
    check('an arena of strangers is open',
      alreadyDefending(arenaOf([fighter({ owner: 'other' })]), 'me'), false)
    check('my defenders are listed back to me',
      myDefenders(arenaOf([fighter({ owner: 'me', fighter_id: 3 }), fighter({ owner: 'x' })]), 'me')
        .map((f) => f.fighter_id), [3])
  }

  /* --- the landowner's building --- */
  {
    check('an arena with boost left can be used', arenaMaintained(landOf('arena', 1)), true)
    check('a decayed arena cannot', arenaMaintained(landOf('arena', 0)), false)
    check('a dungeon in slot zero is not an arena', arenaMaintained(landOf('dungeon', 9000)), false)
    check('no land, no arena', arenaMaintained(undefined), false)
  }

  /* --- the button gate --- */
  {
    const five = [roster({ fighter_id: 1 }), roster({ fighter_id: 2 }), roster({ fighter_id: 3 }),
      roster({ fighter_id: 4 }), roster({ fighter_id: 5 })]
    const open = arenaOf([fighter({ owner: 'other' })])
    const good = landOf('arena', 9000)

    check('a full team on a live arena is ready',
      canChallenge(five, true, true, playerOf(100), 50, open, good).ready, true)
    check('a decayed arena blocks first',
      canChallenge(five, true, true, playerOf(100), 50, open, landOf('arena', 0)).reason,
      'This arena is no longer maintained')
    check('an arena I hold blocks before the team is checked',
      canChallenge([], false, false, playerOf(100), 50,
        arenaOf([fighter({ owner: 'me' })]), good).reason,
      'You already have a fighter in this arena')
    check('an empty arena cannot be challenged',
      canChallenge(five, true, true, playerOf(100), 50, arenaOf([]), good).reason,
      'Nobody is holding this arena')
    check('a short team is counted',
      canChallenge([...five.slice(0, 3), null, null], true, true, playerOf(100), 50, open, good).reason,
      'Pick 2 more fighters')
    check('a busy fighter blocks',
      canChallenge([...five.slice(0, 4), roster({ fighter_id: 9, in_use: 1, use_type: 'Arena' })],
        true, true, playerOf(100), 50, open, good).reason,
      'Fighter 9 is not available')
    check('energy is checked last',
      canChallenge(five, true, true, playerOf(10), 50, open, good).reason, 'Needs 50 energy')
  }

  /* --- the numbers on the panel --- */
  {
    check('full power reads as 100%', arenaPowerPercent(ARENA_POWER_FULL), 100)
    check('the floor reads as 10%', arenaPowerPercent(ARENA_POWER_FLOOR), 10)
    check('a loss costs one percent', arenaPowerPercent(ARENA_POWER_PER_LOSS), 1)
  }

  /* --- against a live arena --- */
  console.log('\nlive chain\n')
  const post = async (b: Record<string, unknown>) =>
    (await fetch('https://wax.greymass.com/v1/chain/get_table_rows', {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ json: true, ...b }),
    })).json() as Promise<{ rows: Record<string, never>[] }>

  const cfg = (await post({ code: 'battle.ale', scope: 'battle.ale', table: 'config', limit: 1 })).rows[0] as Record<string, string>
  const levelMod = Number(cfg.level_mod)
  const ageDecay = Number(cfg.age_decay)
  const checks = (await post({ code: 'arena.ale', scope: 'arena.ale', table: 'arenacheck', limit: 100 })).rows as unknown as
    { planet: string; land_id: string; arena_power: number }[]

  let examined = 0
  let anomalies = 0
  for (const c of checks.slice(0, 6)) {
    const rows = (await post({ code: 'arena.ale', scope: c.planet, table: 'livearena', limit: 100 })).rows as unknown as LiveArenaRow[]
    const live = rows.find((r) => String(r.land_id) === String(c.land_id))
    if (!live || !live.fighters.length) continue
    examined++

    const fielded = applyArenaPower(
      live.fighters.map((f) => fieldedStats(f, f.level, f.creation_date, levelMod, ageDecay)),
      Number(c.arena_power),
    )
    const stored = live.fighters.reduce((n, f) => n + f.health, 0)
    const real = fielded.reduce((n, f) => n + f.health, 0)

    // Every defender is at some level >= 0, so the fielded team can only be
    // stronger than its stored numbers once power is near full.
    const powerOk = Number(c.arena_power) >= ARENA_POWER_FLOOR && Number(c.arena_power) <= ARENA_POWER_FULL
    const sane = fielded.every((f) => f.health >= 0 && f.damage >= 0 && Number.isFinite(f.health))
    if (!powerOk || !sane) anomalies++

    console.log(
      `  ${c.planet}/${c.land_id}  power ${(Number(c.arena_power) / 100).toFixed(0)}%  ` +
      `${live.fighters.length} defenders  stored ${stored} HP -> fielded ${real} HP  ` +
      `(x${(real / Math.max(1, stored)).toFixed(2)})`,
    )
  }
  check('every live arena scaled without anomaly', anomalies, 0)
  check('at least one live arena was examined', examined > 0, true)

  console.log('\n' + (fail === 0 ? `all ${pass} cases passed` : `${fail} FAILED`))
  if (fail) process.exitCode = 1
}

main()
