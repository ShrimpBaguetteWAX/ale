/**
 * Pins the matchup maths against the simulator it claims to mirror.
 *
 *   npx vite build --ssr scripts/verify-matchup.ts --outDir .ssr
 *   node .ssr/verify-matchup.js
 *
 * Three halves, and the middle one is the point.
 *
 * The first checks the element and condition arithmetic against the rules
 * read off `battle.cpp`. The second runs the *actual simulator* on staged
 * one-blow fights and checks that `damageShare` predicts the damage it deals
 * — so if `sim.ts` and this ever drift apart, the badges stop agreeing with
 * the fight and this says so. The third covers restoring a remembered team,
 * which has no maths but does have five ways to hand a player a line-up they
 * cannot field.
 */
import {
  damageShare,
  enemyTriggers,
  flatMatchup,
  ignoreResOf,
  matchupOf,
  matchupsFor,
  teamOutlook,
  matchupBetween,
  battleAsFlat,
  enemyProfile,
  resistanceTo,
} from '../src/fight/matchup'
import { restoreTeam, type RememberedTeam } from '../src/fight/lastTeam'
import { ageBand, ageBonus, ageNote } from '../src/fighters/rules'
import { ageFactor } from '../src/fight/scaling'
import { EMPTY_FILTER, applyFilter, isFilterActive } from '../src/dungeon/filters'
import { simulate } from '../src/dungeon/sim'
import type { BattleAbility, BattleFighter, FightRow, RosterFighter } from '../src/dungeon/types'

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

const NOW = Date.parse('2026-09-02T00:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString().slice(0, 19)

/* ---------- fixtures ---------- */

const enemy = (over: Partial<BattleFighter>): BattleFighter =>
  ({
    fighter_id: 1, owner: 'dungeon', gamertag: '', avatar: '',
    health: 1000, max_health: 1000, damage: 200, taunt: 100,
    initiative: 300, attackspeed: 300,
    res_gem: 0, res_metal: 0, res_air: 0, res_fire: 0, res_nature: 0, res_neutral: 0,
    classname: 'brawler', racename: 'khaured', element: 'fire',
    target: 'enemy_taunt_max', specialAbility: [], level: 1,
    battlestats: {
      attacks_made: 0, attacks_received: 0, damage_dealt: 0,
      damage_blocked_by_enemy: 0, damage_taken: 0, damage_blocked: 0,
      knockouts: 0, survived: true,
    },
    ...over,
  }) as BattleFighter

const mine = (over: Record<string, unknown> = {}, stats: Record<string, unknown> = {}): RosterFighter =>
  ({
    fighter_id: 10, owner: 'me.wam', classname: 'desperado', racename: 'khaured',
    role: '', element: 'fire', marker: '',
    creation_date: daysAgo(0), last_payday: daysAgo(1),
    next_payday: new Date(NOW + 86_400_000).toISOString().slice(0, 19),
    final_deletion_date: new Date(NOW + 100 * 86_400_000).toISOString().slice(0, 19),
    in_use: 0, use_type: '', use_details: '', active: 1,
    ascension_level: 0, ascension_in_progress: 0, ascension_upgrades: [],
    stats: {
      health_min: 1000, health_max: 1000, damage_min: 500, damage_max: 500,
      taunt_min: 100, taunt_max: 100, initiative_min: 300, initiative_max: 300,
      attackspeed_min: 300, attackspeed_max: 300,
      res_gem: 0, res_metal: 0, res_air: 0, res_fire: 0, res_nature: 0, res_neutral: 0,
      classname: 'desperado', racename: 'khaured', element: 'fire',
      target: 'enemy_taunt_max', abilities: [],
      experience: 0, required_experience: 100, level: 0, credits: 0,
      ...stats,
    },
    ...over,
  }) as unknown as RosterFighter

/* ---------- 1. the element maths ---------- */

console.log('\nelement arithmetic')
{
  /*
     `resistPct = trunc(resistance / 10)`, `damagePct = 100 - resistPct`.
     Integer steps, not a ratio — which is why 640 and 649 block the same.
  */
  check('no resistance lets everything through', damageShare(0), 1)
  check('640 blocks 64%', damageShare(640), 0.36)
  check('649 blocks the same 64%, not 64.9%', damageShare(649), 0.36)
  check('the on-chain cap of 800 blocks 80%', damageShare(800), 0.2)
  check('1000 would block everything', damageShare(1000), 0)
  check('a negative resistance is not a bonus', damageShare(-50), 1)

  check('fire reads res_fire', resistanceTo({ res_gem: 1, res_metal: 2, res_air: 3, res_fire: 4, res_nature: 5, res_neutral: 6 }, 'fire'), 4)
  check('nature reads res_nature', resistanceTo({ res_gem: 1, res_metal: 2, res_air: 3, res_fire: 4, res_nature: 5, res_neutral: 6 }, 'nature'), 5)
  check('an element nobody has reads zero', resistanceTo({ res_gem: 1, res_metal: 2, res_air: 3, res_fire: 4, res_nature: 5, res_neutral: 6 }, 'plasma'), 0)

  const pierce = (n: number): BattleAbility =>
    ({ ability: 'p', displayname: 'Pierce', on_attack: 1, ignore_res_percent: n }) as BattleAbility
  check('piercing sums across abilities', ignoreResOf([pierce(30), pierce(25)]), 55)
  check('and caps at 100', ignoreResOf([pierce(80), pierce(60)]), 100)
  check('a locked ability pierces nothing', ignoreResOf([{ ...pierce(50), locked: 1 } as BattleAbility]), 0)
  check('an on_defense ability pierces nothing', ignoreResOf([{ ability: 'd', displayname: 'D', on_defense: 1, ignore_res_percent: 50 } as BattleAbility]), 0)
}

console.log('\noffence and defence against a line-up')
{
  const line = [enemy({ res_fire: 640 }), enemy({ res_fire: 200 })]
  const m = matchupOf(mine(), line, 1, 0, NOW)
  /* mean(0.36, 0.80) */
  check('offence averages over the whole enemy line', Math.round(m.offense * 1000) / 1000, 0.58)

  const piercing = mine({}, {
    abilities: [{ ability: 'p', displayname: 'Pierce', on_attack: 1, ignore_res_percent: 50 }],
  })
  /* floor(640*0.5)=320 -> 0.68 ; floor(200*0.5)=100 -> 0.90 */
  check('piercing is applied before the resistance is read',
    Math.round(matchupOf(piercing, line, 1, 0, NOW).offense * 1000) / 1000, 0.79)

  const both = [enemy({ element: 'fire' }), enemy({ element: 'air' })]
  const walled = mine({}, { res_fire: 500, res_air: 0 })
  /* blocks 50% of the fire attacker, 0% of the air one */
  check('defence averages over the elements coming back',
    Math.round(matchupOf(walled, both, 1, 0, NOW).defense * 1000) / 1000, 0.25)

  const piercers = [
    enemy({ element: 'fire', specialAbility: [{ ability: 'p', displayname: 'P', on_attack: 1, ignore_res_percent: 100 } as BattleAbility] }),
  ]
  check('an enemy that pierces makes a wall worth nothing',
    matchupOf(walled, piercers, 1, 0, NOW).defense, 0)

  check('no enemy line means no matchup to report', matchupOf(mine(), [], 1, 0, NOW).offense, 1)
}

/* ---------- 2. against the simulator itself ---------- */

console.log('\nagainst sim.ts, one blow at a time')
{
  /*
     A fight staged so exactly one blow can land: the attacker swings first
     and kills nobody, and we read the damage the simulator recorded. If
     `damageShare` is right, `damage == trunc(attackerDamage * share)`.
  */
  const row = (attackerElement: string, defenderRes: Partial<BattleFighter>): FightRow =>
    ({
      history_id: '1', wallet: 'me.wam', log: '', turns: 0,
      reward_power_added: [], reward_power_total: [],
      timestamp: new Date(NOW).toISOString().slice(0, 19),
      team1_fighters: [enemy({ fighter_id: 1, element: attackerElement, damage: 1000, health: 100000, max_health: 100000, initiative: 100 })],
      team2_fighters: [enemy({ fighter_id: 2, damage: 1, health: 100000, max_health: 100000, initiative: 9000, ...defenderRes })],
    }) as unknown as FightRow

  const firstBlow = (attackerElement: string, defenderRes: Partial<BattleFighter>) =>
    simulate(row(attackerElement, defenderRes), { tauntDeduction: 0 }).turns[0]

  for (const [element, field, res] of [
    ['fire', 'res_fire', 640],
    ['air', 'res_air', 250],
    ['gem', 'res_gem', 0],
    ['nature', 'res_nature', 800],
    ['metal', 'res_metal', 335],
    ['neutral', 'res_neutral', 995],
  ] as [string, string, number][]) {
    const blow = firstBlow(element, { [field]: res } as Partial<BattleFighter>)
    check(
      `${element} into ${res} resistance: the simulator agrees with damageShare`,
      blow.damage,
      Math.trunc(1000 * damageShare(res)),
    )
    check(
      `  and the simulator's own effectiveness matches`,
      blow.effectiveness / 100,
      damageShare(res),
    )
  }

  /* And with piercing, which the simulator applies the same way. */
  const pierced = simulate(
    {
      history_id: '1', wallet: 'me.wam', log: '', turns: 0,
      reward_power_added: [], reward_power_total: [],
      timestamp: new Date(NOW).toISOString().slice(0, 19),
      team1_fighters: [enemy({
        fighter_id: 1, element: 'fire', damage: 1000, health: 100000, max_health: 100000, initiative: 100,
        specialAbility: [{ ability: 'p', displayname: 'P', on_attack: 1, ignore_res_percent: 50 } as BattleAbility],
      })],
      team2_fighters: [enemy({ fighter_id: 2, damage: 1, health: 100000, max_health: 100000, initiative: 9000, res_fire: 640 })],
    } as unknown as FightRow,
    { tauntDeduction: 0 },
  ).turns[0]
  check('piercing: the simulator agrees too',
    pierced.damage, Math.trunc(1000 * damageShare(Math.floor(640 * 0.5))))
}

/* ---------- 3. ability bonuses this line-up hands you ---------- */

console.log('\nability bonuses')
{
  const vsElement = (over: Partial<BattleAbility> = {}): BattleAbility =>
    ({
      ability: 'burn', displayname: 'Firebane',
      check_condition: 1, condition_target: 'enemy_group',
      condition_group: 'element', condition_name: 'fire',
      ...over,
    }) as BattleAbility

  const threeFire = [enemy({ element: 'fire' }), enemy({ element: 'fire' }), enemy({ element: 'air' })]

  check('without effect_on_condition_count it fires once however many match',
    enemyTriggers(vsElement(), threeFire), 1)
  check('with it, once per matching enemy',
    enemyTriggers(vsElement({ effect_on_condition_count: 1 }), threeFire), 2)
  check('and not at all when nobody matches',
    enemyTriggers(vsElement({ condition_name: 'gem' }), threeFire), 0)
  check('a locked ability never counts',
    enemyTriggers(vsElement({ locked: 1 }), threeFire), 0)
  check('an unconditional ability says nothing about this team',
    enemyTriggers({ ability: 'x', displayname: 'X' } as BattleAbility, threeFire), 0)
  check('a self condition is not an enemy bonus',
    enemyTriggers(vsElement({ condition_target: 'self' }), threeFire), 0)
  check('nor is an ally one',
    enemyTriggers(vsElement({ condition_target: 'ally_group' }), threeFire), 0)
  check('nor a building one',
    enemyTriggers(vsElement({ condition_group: 'building', condition_name: 'dungeon' }), threeFire), 0)

  check('class conditions work the same way',
    enemyTriggers(vsElement({ condition_group: 'class', condition_name: 'brawler', effect_on_condition_count: 1 }), threeFire), 3)
  check('so do race conditions',
    enemyTriggers(vsElement({ condition_group: 'race', condition_name: 'khaured' }), threeFire), 1)

  /* A single-target selector picks one enemy, then tests the condition on it. */
  const tall = [enemy({ health: 100, element: 'air' }), enemy({ health: 9000, element: 'fire' })]
  check('enemy_health_max resolves to the biggest, and matches',
    enemyTriggers(vsElement({ condition_target: 'enemy_health_max' }), tall), 1)
  check('enemy_health_min resolves to the smallest, and does not',
    enemyTriggers(vsElement({ condition_target: 'enemy_health_min' }), tall), 0)

  /* Stat conditions read the enemy's fielded numbers. */
  const statCond = vsElement({
    condition_group: 'stats', condition_name: 'health',
    condition_minmax: 'min', condition_value: 5000,
    condition_target: 'enemy_group', effect_on_condition_count: 1,
  })
  check('a stats condition counts the enemies over the threshold',
    enemyTriggers(statCond, tall), 1)

  const withBonus = mine({}, { abilities: [vsElement({ effect_on_condition_count: 1 })] })
  const m = matchupOf(withBonus, threeFire, 1, 0, NOW)
  check('the matchup tallies them', m.bonuses, 2)
  check('and names them for the tooltip', m.bonusNames, ['Firebane'])
}

/* ---------- 4. the ranking ---------- */

console.log('\nwhat a pick hands the other side')
{
  /*
     Ability gating is symmetric: a dungeon fighter can carry "against fire"
     exactly as readily as one of yours. So a pick can be the reason the enemy
     gets extra firings, and the screen has to be able to say so.
  */
  const theirBane = {
    ability: 'bane', displayname: 'Fire Hunter',
    check_condition: 1, condition_target: 'enemy_group',
    condition_group: 'element', condition_name: 'fire',
    effect_on_condition_count: 1,
  } as BattleAbility

  const line = [enemy({ specialAbility: [theirBane] }), enemy({ specialAbility: [theirBane] })]

  const fireGuy = matchupOf(mine({ element: 'fire' }, { element: 'fire' }), line, 1, 0, NOW)
  check('a fire pick switches on both of their fire hunters', fireGuy.exposure, 2)
  check('and names them once each', fireGuy.exposureNames, ['Fire Hunter'])

  const airGuy = matchupOf(mine({ element: 'air' }, { element: 'air' }), line, 1, 0, NOW)
  check('an air pick switches on neither', airGuy.exposure, 0)
  check('with nothing to name', airGuy.exposureNames, [])

  /* Their own ally-facing conditions are not caused by my pick. */
  const allyBuff = { ...theirBane, condition_target: 'ally_group' } as BattleAbility
  check('an ability aimed at their own team is not my doing',
    matchupOf(mine({ element: 'fire' }, { element: 'fire' }),
      [enemy({ specialAbility: [allyBuff] })], 1, 0, NOW).exposure, 0)

  /* Judged alone, so the number does not move as team-mates are picked. */
  const soloOnce = { ...theirBane, effect_on_condition_count: 0 } as BattleAbility
  check('without the per-match flag it is one firing, not one per enemy',
    matchupOf(mine({ element: 'fire' }, { element: 'fire' }),
      [enemy({ specialAbility: [soloOnce] })], 1, 0, NOW).exposure, 1)

  /* A stats condition reads the fielded number, so level has to be applied. */
  const bigOnly = {
    ability: 'giant', displayname: 'Giantslayer',
    check_condition: 1, condition_target: 'enemy_group',
    condition_group: 'stats', condition_name: 'health',
    condition_minmax: 'min', condition_value: 3000,
  } as BattleAbility
  const stalwart = [enemy({ specialAbility: [bigOnly] })]
  /* health 1000 stored; at level 10 and level_mod 1.15 that is ~4000. */
  check('a small fighter does not trip their stats condition',
    matchupOf(mine({}, { level: 0 }), stalwart, 1.15, 0, NOW).exposure, 0)
  check('a levelled one does, because the condition reads fielded health',
    matchupOf(mine({}, { level: 10 }), stalwart, 1.15, 0, NOW).exposure, 1)
}

console.log('\nthe bar reconciles with the cards')
{
  /*
     The complaint that prompted this: the bar counted seven firings while the
     cards accounted for four. The three missing ones belonged to the sixth
     fighter, which the crew and weapon fuse into and which no card was
     reporting. These pin the two together so they cannot drift again.
  */
  const bane = {
    ability: 'burn', displayname: 'Firebane',
    check_condition: 1, condition_target: 'enemy_group',
    condition_group: 'element', condition_name: 'fire',
    effect_on_condition_count: 1,
  } as BattleAbility

  const flat = (over: Record<string, unknown> = {}) => ({
    element: 'air', classname: 'desperado', racename: 'khaured',
    damage: 900, health: 900, attackspeed: 300, taunt: 100, initiative: 300,
    res_gem: 0, res_metal: 0, res_air: 0, res_fire: 0, res_nature: 0, res_neutral: 0,
    abilities: [] as BattleAbility[],
    ...over,
  })

  const line = [enemy({ element: 'fire' }), enemy({ element: 'fire' })]

  /* Two fighters carrying it, plus the sixth: 2 + 2 + 2 = 6. */
  const team = [
    flat({ abilities: [bane] }),
    flat({ abilities: [bane] }),
    flat(),
    flat(),
    flat(),
    /* the crew + weapon fighter */
    flat({ abilities: [bane] }),
  ]

  const bar = teamOutlook(team, line)
  const cards = team.map((f) => matchupBetween(f, line.map(battleAsFlat)))
  const summed = cards.reduce((n, m) => n + m.bonuses, 0)

  check('the bar tallies six firings', bar.mine.bonuses, 6)
  check('and the cards add up to exactly the same', summed, bar.mine.bonuses)
  check('the five fighters alone would have been four',
    cards.slice(0, 5).reduce((n, m) => n + m.bonuses, 0), 4)
  check('so the sixth is worth two of them', cards[5].bonuses, 2)

  /* And the same holds for the count going the other way. */
  const theirs = line.map((e) => matchupBetween(battleAsFlat(e), team))
  check('their side reconciles too',
    theirs.reduce((n, m) => n + m.bonuses, 0), bar.theirs.bonuses)
}

console.log('\nthe age badge against the age the contract applies')
{
  /*
     Two rescalings of one number, and they do not look like it.

     `apply_weather_and_age` multiplies health and damage by
     `age_decay ^ (days²)`, which runs 1.0 down to 0. The badge the live
     game shows is `200·factor - 100`, which runs +100% down to -100%. So
     "+100%" is a fighter at its full stored roll rather than one with
     double it, and "0%" is one that has already lost half — the opposite of
     how a plus sign usually reads, and the reason the multiplier is printed
     beside it.

     These pin the mapping between the two. Change either alone and the
     badge stops describing the fight.
  */
  const DECAY = 0.99997997283935547

  /** Whole days at which the decay factor is closest to `want`. */
  const daysFor = (want: number) => {
    if (want >= 1) return 0
    let lo = 0
    let hi = 5000
    for (let i = 0; i < 200; i++) {
      const d = (lo + hi) / 2
      if (Math.pow(DECAY, d * d) > want) lo = d
      else hi = d
    }
    return Math.round(lo)
  }

  for (const [factor, badge] of [
    [1, 100],
    [0.75, 50],
    [0.5, 0],
    [0.25, -50],
  ] as [number, number][]) {
    const f = mine({ creation_date: daysAgo(daysFor(factor)) })
    const real = ageFactor(f.creation_date, DECAY, NOW)
    const shown = ageBonus(f, DECAY, NOW)

    check('a fighter fighting at x' + factor, Math.abs(real - factor) < 0.01, true)
    check('  shows a badge of ' + badge + '%', Math.abs(shown - badge) < 1.5, true)
    check('  which is exactly 200*factor - 100', Math.round(shown), Math.round(200 * real - 100))
  }

  /* The ends of the scale, exactly. */
  check('a fighter made today is untouched', ageBonus(mine(), DECAY, NOW), 100)
  check('and fights at the full roll', ageFactor(mine().creation_date, DECAY, NOW), 1)
  check('with no decay configured nothing ages',
    ageBonus(mine({ creation_date: daysAgo(9999) }), 0, NOW), 100)

  /*
     The bands read off the badge, not the multiplier: 0% on the badge is a
     fighter that has already lost half its stats, so it must not look
     neutral.
  */
  check('+100% is fresh', ageBand(100), 'fresh')
  check('+80% is still fresh', ageBand(80), 'fresh')
  check('+40% is worn, not fresh', ageBand(40), 'worn')
  check('0% is bad - half the roll is gone', ageBand(0), 'bad')
  check('-100% is bad', ageBand(-100), 'bad')

  /* The label says both numbers, because one of them misleads alone. */
  const note = ageNote(70, 190, 0.85)
  check('the label carries the badge', note.includes('+70%'), true)
  check('and the multiplier the fight uses', note.includes('\u00d70.85'), true)
  check('and defuses the plus sign', note.includes('+100% is untouched'), true)
  check('a negative badge is not given a plus',
    ageNote(-48, 260, 0.26).startsWith('Age -48%'), true)
  check('one day is not "1 days"', ageNote(100, 1, 1).includes('1 day old'), true)
}

console.log('\nranking')
{
  const line = [enemy({ res_fire: 900, res_air: 0, element: 'neutral' })]

  /* Same stats, different element: the one they cannot resist must win. */
  const fireGuy = mine({ fighter_id: 1, element: 'fire' }, { element: 'fire' })
  const airGuy = mine({ fighter_id: 2, element: 'air' }, { element: 'air' })
  const ms = matchupsFor([fireGuy, airGuy], line, 1, 0, NOW)
  check('an element they resist scores below one they do not',
    (ms.get(1)!.score < ms.get(2)!.score), true)
  check('and the badge says why', Math.round(ms.get(1)!.offense * 100), 10)

  /* Same everything, different level: level_mod compounds, so 10 beats 0. */
  const lvl0 = mine({ fighter_id: 3 }, { level: 0 })
  const lvl10 = mine({ fighter_id: 4 }, { level: 10 })
  const lvls = matchupsFor([lvl0, lvl10], line, 1.15, 0, NOW)
  check('level is applied before ranking',
    (lvls.get(4)!.score > lvls.get(3)!.score), true)

  /* Same everything, different age: the decay curve has to bite. */
  const fresh = mine({ fighter_id: 5, creation_date: daysAgo(1) })
  const old = mine({ fighter_id: 6, creation_date: daysAgo(300) })
  const aged = matchupsFor([fresh, old], line, 1, 0.99997997283935547, NOW)
  check('and so is age', (aged.get(5)!.score > aged.get(6)!.score), true)

  /* Cooldown is a delay: the faster fighter lands more of the same damage. */
  const quick = mine({ fighter_id: 7 }, { attackspeed_min: 100, attackspeed_max: 100 })
  const slow = mine({ fighter_id: 8 }, { attackspeed_min: 900, attackspeed_max: 900 })
  const speeds = matchupsFor([quick, slow], line, 1, 0, NOW)
  check('a shorter cooldown ranks higher', (speeds.get(7)!.score > speeds.get(8)!.score), true)

  /* A crew+weapon pair is ranked by the same measure, on the weapon's element. */
  const flat = (element: string) =>
    flatMatchup({
      element, damage: 400, health: 400, attackspeed: 300,
      res_gem: 0, res_metal: 0, res_air: 0, res_fire: 0, res_nature: 0, res_neutral: 0,
    }, line)
  check('a weapon whose element they resist scores below one they do not',
    flat('fire').score < flat('air').score, true)
}

console.log('\nreading the enemy line')
{
  const line = [
    enemy({ element: 'fire', classname: 'brawler' }),
    enemy({ element: 'fire', classname: 'brawler' }),
    enemy({ element: 'air', classname: 'desperado' }),
  ]
  const p = enemyProfile(line)
  check('elements are tallied, commonest first', p.elements, [
    { name: 'fire', count: 2 },
    { name: 'air', count: 1 },
  ])
  check('and so are classes', p.classes, [
    { name: 'brawler', count: 2 },
    { name: 'desperado', count: 1 },
  ])
}

console.log('\nfiltering and sorting on the matchup')
{
  const line = [enemy({ res_fire: 700, res_air: 150, element: 'fire' })]

  const burner: BattleAbility = {
    ability: 'burn', displayname: 'Firebane',
    check_condition: 1, condition_target: 'enemy_group',
    condition_group: 'element', condition_name: 'fire',
  } as BattleAbility

  /* 30% lands, 0% blocked, no bonus. */
  const weak = mine({ fighter_id: 1, element: 'fire' }, { element: 'fire' })
  /* 85% lands, 0% blocked, no bonus. */
  const strong = mine({ fighter_id: 2, element: 'air' }, { element: 'air' })
  /* 30% lands, 70% blocked, one bonus. */
  const wall = mine({ fighter_id: 3, element: 'fire' }, {
    element: 'fire', res_fire: 700, abilities: [burner],
  })

  const roster = [weak, strong, wall]
  const ms = matchupsFor(roster, line, 1, 0, NOW)
  const ids = (f: typeof EMPTY_FILTER) =>
    applyFilter(roster, f, 0, NOW, undefined, ms).map((r) => r.fighter_id)

  check('the three read as expected first',
    roster.map((r) => Math.round(ms.get(r.fighter_id)!.offense * 100)), [30, 85, 30])

  check('an offence floor keeps only who can hurt them',
    ids({ ...EMPTY_FILTER, versus: { bonuses: 0, offense: 65, defense: 0 } }), [2])
  check('a defence floor keeps only who can take it',
    ids({ ...EMPTY_FILTER, versus: { bonuses: 0, offense: 0, defense: 50 } }), [3])
  check('a bonus floor keeps only whose abilities fire',
    ids({ ...EMPTY_FILTER, versus: { bonuses: 1, offense: 0, defense: 0 } }), [3])
  check('the floors stack as AND, and can empty the board',
    ids({ ...EMPTY_FILTER, versus: { bonuses: 1, offense: 65, defense: 0 } }), [])
  check('all three at zero filters nothing',
    ids({ ...EMPTY_FILTER }).length, 3)

  /*
     With no matchup table the screen has no opponent loaded yet. Hiding the
     whole roster behind a table that is still arriving is the worse of the
     two wrong answers, so the rule passes everyone.
  */
  check('a matchup floor with no table loaded hides nobody',
    applyFilter(roster,
      { ...EMPTY_FILTER, versus: { bonuses: 3, offense: 99, defense: 99 } },
      0, NOW).length,
    3)

  check('a matchup floor counts as an active filter',
    isFilterActive({ ...EMPTY_FILTER, versus: { bonuses: 1, offense: 0, defense: 0 } }), true)
  check('and an empty one does not',
    isFilterActive({ ...EMPTY_FILTER }), false)

  const sorted = (sort: string) =>
    applyFilter(roster, { ...EMPTY_FILTER, sort }, 0, NOW, undefined, ms)
      .map((r) => r.fighter_id)
  check('sorting by damage landed puts the right element first',
    sorted('versus_offense')[0], 2)
  check('sorting by damage blocked puts the wall first',
    sorted('versus_defense')[0], 3)
  check('sorting by bonuses puts the one whose ability fires first',
    sorted('versus_bonuses')[0], 3)
  check('the overall sort ranks the useless one last',
    sorted('versus_score')[2], 1)
}

console.log('\nthe balance bar')
{
  /* A flat fighter, so both sides can be built from the same helper. */
  const flat = (over: Record<string, unknown> = {}) => ({
    element: 'fire', classname: 'brawler', racename: 'khaured',
    damage: 1000, health: 1000, attackspeed: 300, taunt: 100, initiative: 300,
    res_gem: 0, res_metal: 0, res_air: 0, res_fire: 0, res_nature: 0, res_neutral: 0,
    abilities: [],
    ...over,
  })

  const asEnemy = (over: Record<string, unknown> = {}) => enemy({
    element: 'fire', classname: 'brawler', racename: 'khaured',
    damage: 1000, health: 1000, attackspeed: 300, taunt: 100, initiative: 300,
    ...over,
  } as Partial<BattleFighter>)

  const even = teamOutlook([flat(), flat()], [asEnemy(), asEnemy()])
  check('two mirror teams sit at even', even.share, 0.5)
  check('and nothing is being resisted', even.mine.landShare, 1)
  check('nor blocked', even.mine.blockShare, 0)

  /*
     The case the old formula could not see: identical totals on both sides,
     but one of them is attacking into a wall. Health x damage called this
     even; it is not close to even.
  */
  const walled = teamOutlook([flat(), flat()], [asEnemy({ res_fire: 800 }), asEnemy({ res_fire: 800 })])
  check('a team attacking into resistance lands a fifth of it', walled.mine.landShare, 0.2)
  check('while the same totals used to read as even', walled.share < 0.2, true)

  /*
     Symmetry: what one side blocks is exactly what the other fails to land.
     If these two ever disagree the bar is double-counting.
  */
  const lop = teamOutlook(
    [flat({ res_fire: 500, element: 'air' })],
    [asEnemy({ res_air: 300, element: 'fire' })],
  )
  check('what they block is what we fail to land',
    Math.round(lop.theirs.blockShare * 1000), Math.round((1 - lop.mine.landShare) * 1000))
  check('and the other way round',
    Math.round(lop.mine.blockShare * 1000), Math.round((1 - lop.theirs.landShare) * 1000))
  check('we land 70% into 300 air resistance', Math.round(lop.mine.landShare * 100), 70)
  check('and turn away 50% of their fire', Math.round(lop.mine.blockShare * 100), 50)

  /* The land share is weighted by damage, not a plain mean of the fighters. */
  const weighted = teamOutlook(
    [flat({ element: 'fire', damage: 900 }), flat({ element: 'air', damage: 100 })],
    [asEnemy({ res_fire: 800, res_air: 0 })],
  )
  /* (900*0.2 + 100*1.0) / 1000 */
  check('the land share is weighted by who carries the damage',
    Math.round(weighted.mine.landShare * 1000) / 1000, 0.28)

  /* Totals are reported untouched, so they still match the cards. */
  check('the raw totals are left alone', [weighted.mine.damage, weighted.mine.health], [1000, 2000])

  /* Abilities that only fire here move the bar, but do not fake the figures. */
  const burner = {
    ability: 'burn', displayname: 'Firebane',
    check_condition: 1, condition_target: 'enemy_group',
    condition_group: 'element', condition_name: 'fire',
    effect_on_condition_count: 1,
  } as BattleAbility
  const plain = teamOutlook([flat()], [asEnemy(), asEnemy()])
  const buffed = teamOutlook([flat({ abilities: [burner] })], [asEnemy(), asEnemy()])
  check('an ability that fires against this team counts', buffed.mine.bonuses, 2)
  check('and tips the bar', buffed.share > plain.share, true)
  check('without inflating the damage that lands',
    buffed.mine.effectiveDamage, plain.mine.effectiveDamage)

  /* Degenerate sides, so the bar never divides by zero or reads NaN. */
  check('an empty team is a certain loss', teamOutlook([], [asEnemy()]).share, 0)
  check('and no enemy is a certain win', teamOutlook([flat()], []).share, 1)
  check('two empty sides sit at even', teamOutlook([], []).share, 0.5)
  check('every figure stays finite',
    Object.values(teamOutlook([flat({ res_fire: 800 })], [asEnemy()]).mine)
      .every((n) => Number.isFinite(n)), true)
}

/* ---------- 5. bringing the last team back ---------- */

console.log('\nrestoring a remembered team')
{
  const card = (id: number) => ({ template_id: id, name: `Card ${id}` })
  const remembered: RememberedTeam = { fighterIds: [1, 2, 3, 4, 5], crew: 100, weapon: 200 }

  const all = (over: Record<number, { available: boolean; reason?: string }> = {}) =>
    new Map(
      [1, 2, 3, 4, 5].map((id) => [id, over[id] ?? { available: true }] as const),
    )

  const base = {
    teamSize: 5,
    crewCards: [card(100), card(101)],
    weaponCards: [card(200)],
  }

  const clean = restoreTeam(remembered, { ...base, usable: all() })
  check('a team that is still whole comes back whole', clean.fighterIds, [1, 2, 3, 4, 5])
  check('in the order it was saved', clean.fighterIds[0], 1)
  check('with its crew card', clean.crew?.template_id, 100)
  check('and its weapon', clean.weapon?.template_id, 200)
  check('and nothing to explain', clean.dropped, [])

  const busy = restoreTeam(remembered, {
    ...base,
    usable: all({ 2: { available: false, reason: 'Busy: arena' } }),
  })
  check('a fighter in the arena is left out', busy.fighterIds, [1, 3, 4, 5])
  check('and the reason is kept', busy.dropped, [{ id: 2, reason: 'busy: arena' }])

  const owed = restoreTeam(remembered, {
    ...base,
    usable: all({ 4: { available: false, reason: 'Wants a payday' } }),
  })
  check('so is one owed a payday', owed.fighterIds, [1, 2, 3, 5])
  check('with its own reason', owed.dropped, [{ id: 4, reason: 'wants a payday' }])

  const sold = restoreTeam(remembered, {
    ...base,
    usable: new Map([1, 2, 4, 5].map((id) => [id, { available: true }] as const)),
  })
  check('a fighter no longer in the wallet is left out', sold.fighterIds, [1, 2, 4, 5])
  check('and says so', sold.dropped, [{ id: 3, reason: 'no longer in this wallet' }])

  const noCards = restoreTeam(remembered, {
    ...base,
    crewCards: [card(101)],
    weaponCards: [],
    usable: all(),
  })
  check('a card the player no longer has is not restored', noCards.crew, null)
  check('nor one with no nftvalues row', noCards.weapon, null)
  check('but the fighters still are', noCards.fighterIds.length, 5)

  check('nothing remembered restores nothing',
    restoreTeam(null, { ...base, usable: all() }).fighterIds, [])

  const overfull = restoreTeam(
    { fighterIds: [1, 2, 3, 4, 5, 1, 2], crew: null, weapon: null },
    { ...base, usable: all() },
  )
  check('a stored team never exceeds the team size', overfull.fighterIds.length, 5)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exitCode = 1
