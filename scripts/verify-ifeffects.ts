/**
 * Exercises every in-fight effect path against hand-derived contract results.
 *
 *   npx vite build --ssr scripts/verify-ifeffects.ts --outDir .ssr
 *   node .ssr/verify-ifeffects.js
 *
 * Why this exists rather than a check against stored fights: no ability
 * currently in the game reaches the end of the in-fight pass, so replaying
 * live data proves almost nothing about this code.
 *
 * `newbattle3/src/battle.cpp` gates it three ways:
 *
 *   1. `ifeffect` skips an ability that *has* `on_fight_start` (lines 929,
 *      973) — start buffs and in-fight effects are different kinds of thing.
 *   2. For a *group* target every member is gated on `buff_condition`, which
 *      filters only when the ability carries a bare `condition_group`.
 *   3. `self` and `enemy_attacker` resolve to the ability's owner and to
 *      whoever threw the blow. Both were no-ops until recently, carried over
 *      from a version where the fighters were copies.
 *
 * Each expectation below is derived by reading the contract, not by recording
 * what this implementation happens to produce.
 */
import { simulate, DEFAULT_CAPS } from '../src/dungeon/sim'
import type {
  AbilityEffectRow,
  BattleAbility,
  BattleFighter,
  FightRow,
} from '../src/dungeon/types'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ok   ${name}`)
  } else {
    failures++
    console.log(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`)
  }
}

/* ---------- builders ---------- */

function effect(
  stat: string,
  value: number,
  percentflat: 'flat' | 'percent' = 'flat',
): AbilityEffectRow {
  return {
    execute_target: '',
    percentflat,
    stat_name: stat,
    value,
    value_min: 0,
    value_max: 0,
  }
}

function ability(over: Partial<BattleAbility> = {}): BattleAbility {
  return {
    ability: 'test',
    displayname: 'Test Ability',
    description: '',
    on_creation: 0,
    /* The in-fight pass now skips anything flagged as a start buff. */
    on_fight_start: 0,
    on_attack: 0,
    on_defense: 0,
    on_battle_end: 0,
    target_change: '',
    bf_target: '',
    bf_effects: [],
    if_effects: [],
    eof_effects: [],
    check_condition: 0,
    condition_target: '',
    condition_group: '',
    condition_name: '',
    condition_minmax: '',
    condition_value: 0,
    effect_on_condition_count: 0,
    ignore_res_percent: 0,
    locked: 0,
    ...over,
  } as BattleAbility
}

function fighter(over: Partial<BattleFighter> = {}): BattleFighter {
  return {
    fighter_id: 0,
    owner: 'w',
    gamertag: '',
    avatar: '',
    health: 1000,
    max_health: 1000,
    damage: 100,
    taunt: 100,
    initiative: 100,
    attackspeed: 100,
    res_gem: 0,
    res_metal: 0,
    res_air: 0,
    res_fire: 0,
    res_nature: 0,
    res_neutral: 0,
    classname: 'mystic',
    racename: 'human',
    element: 'fire',
    target: 'enemy_taunt_max',
    specialAbility: [],
    level: 1,
    battlestats: {
      attacks_made: 0,
      attacks_received: 0,
      damage_dealt: 0,
      damage_blocked_by_enemy: 0,
      damage_taken: 0,
      damage_blocked: 0,
      knockouts: 0,
      survived: true,
    },
    ...over,
  } as BattleFighter
}

let uid = 0
function row(team1: BattleFighter[], team2: BattleFighter[]): FightRow {
  return {
    history_id: `t${uid++}`,
    wallet: 'w',
    team1_fighters: team1,
    team2_fighters: team2,
    team1_end_fighters: [],
    team2_end_fighters: [],
    log: '',
    turns: 0,
    reward_power_added: [],
    reward_power_total: [],
    timestamp: '',
  } as unknown as FightRow
}

const run = (r: FightRow) => simulate(r, { tauntDeduction: 0, caps: DEFAULT_CAPS })

/** The effects recorded on the first turn. */
const firstEffects = (r: FightRow) =>
  run(r).turns[0].effects.map((e) => ({
    target: e.targetUid,
    source: e.sourceUid,
    stat: e.stat,
    trigger: e.trigger,
    delta: e.after - e.before,
  }))

/* ---------- the cases ---------- */

function main() {
  console.log('in-fight effects\n')

  /*
   * 1. A group ability with no condition group reaches everyone.
   *
   *    An ability with no condition is unconditional, so the group is the
   *    whole team. `buff_condition` used to return false here, which made an
   *    unconditional group ability apply to nobody — the reason "Group Heal"
   *    never healed anything.
   */
  {
    /* Both start below max_health: a heal now stops at the ceiling. */
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      health: 900,
      specialAbility: [
        ability({ on_attack: 1, bf_target: 'ally_group', if_effects: [effect('health', 80)] }),
      ],
    })
    const mate = fighter({ fighter_id: 2, initiative: 999, health: 900 })
    check(
      'ally_group with no condition group heals the whole team',
      firstEffects(row([a, mate], [fighter({ fighter_id: 3, initiative: 500 })])),
      [
        { target: '1-0-1', source: '1-0-1', stat: 'health', trigger: 'on_attack', delta: 80 },
        { target: '1-1-2', source: '1-0-1', stat: 'health', trigger: 'on_attack', delta: 80 },
      ],
    )
  }

  /*
   * 2. The same ability with a condition group set fires, per matching
   *    member. `check_condition` must stay 0: it and the group filter are
   *    mutually exclusive in `buff_condition`.
   */
  {
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      racename: 'human',
      health: 900,
      specialAbility: [
        ability({
          on_attack: 1,
          bf_target: 'ally_group',
          if_effects: [effect('health', 80)],
          condition_group: 'race',
          condition_name: 'human',
        }),
      ],
    })
    const human = fighter({ fighter_id: 2, initiative: 999, racename: 'human', health: 900 })
    const alien = fighter({ fighter_id: 4, initiative: 998, racename: 'alien' })
    check(
      'ally_group with a condition group heals only matching allies',
      firstEffects(row([a, human, alien], [fighter({ fighter_id: 3, initiative: 500 })])),
      [
        { target: '1-0-1', source: '1-0-1', stat: 'health', trigger: 'on_attack', delta: 80 },
        { target: '1-1-2', source: '1-0-1', stat: 'health', trigger: 'on_attack', delta: 80 },
      ],
    )
  }

  /*
   * 3. `check_condition` is a gate, not a per-member filter. When it passes,
   *    the whole group is buffed; when it fails, `checkCondition` returns 0
   *    and the loop never runs. The two must not both filter, or a checked
   *    group ability would reach nobody however well its check passed.
   */
  {
    const gated = (race: string) =>
      fighter({
        fighter_id: 1,
        initiative: 1,
        racename: race,
        health: 900,
        specialAbility: [
          ability({
            on_attack: 1,
            bf_target: 'ally_group',
            if_effects: [effect('health', 80)],
            check_condition: 1,
            condition_target: 'self',
            condition_group: 'race',
            condition_name: 'human',
          }),
        ],
      })
    const mate = fighter({ fighter_id: 2, initiative: 999, racename: 'alien', health: 900 })
    const foe = () => fighter({ fighter_id: 3, initiative: 500 })

    check(
      'a passing check_condition buffs the whole group, filter or not',
      firstEffects(row([gated('human'), mate], [foe()])).map((e) => e.target),
      ['1-0-1', '1-1-2'],
    )
    check(
      'a failing check_condition buffs nobody',
      firstEffects(row([gated('alien'), mate], [foe()])),
      [],
    )
  }

  /*
   * 4. The `on_fight_start` gate, in its current direction: an ability
   *    flagged as a start buff does not also fire in-fight.
   */
  {
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      specialAbility: [
        ability({
          on_fight_start: 1,
          on_attack: 1,
          bf_target: 'enemy_health_min',
          if_effects: [effect('taunt', -25)],
        }),
      ],
    })
    check(
      'on_fight_start = 1 excludes an ability from the in-fight pass',
      firstEffects(row([a], [fighter({ fighter_id: 3, initiative: 500 })])),
      [],
    )
  }

  /* 4b. …and with the flag clear it fires, which is the live configuration. */
  {
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      specialAbility: [
        ability({
          on_fight_start: 0,
          on_attack: 1,
          bf_target: 'enemy_health_min',
          if_effects: [effect('taunt', -25)],
        }),
      ],
    })
    check(
      'on_fight_start = 0 lets the in-fight pass run',
      firstEffects(row([a], [fighter({ fighter_id: 3, initiative: 500 })])).map((e) => e.delta),
      [-25],
    )
  }

  /*
   * 5. `self` heals its own owner, measured against the attacker's blow.
   *    "Self Heal when Hit": +32% of a 100-damage blow against no resistance
   *    is +32 health, on top of the 100 the blow just took off.
   */
  {
    const atk = fighter({ fighter_id: 1, initiative: 1, damage: 100, element: 'fire' })
    const def = fighter({
      fighter_id: 3,
      initiative: 500,
      health: 1000,
      specialAbility: [
        ability({
          on_defense: 1,
          bf_target: 'self',
          if_effects: [effect('health_atk', 32, 'percent')],
        }),
      ],
    })
    const e = run(row([atk], [def])).turns[0].effects
    check(
      'self heals its owner by a share of the blow',
      e.map((x) => ({ target: x.targetUid, stat: x.stat, delta: x.after - x.before })),
      [{ target: '2-0-3', stat: 'health', delta: 32 }],
    )
  }

  /*
   * 6. `enemy_attacker` strikes back at whoever threw the blow.
   *    "Reflect Damage": −20% of the attacker's own 100 damage is −20 health.
   */
  {
    const atk = fighter({ fighter_id: 1, initiative: 1, damage: 100, element: 'fire' })
    const def = fighter({
      fighter_id: 3,
      initiative: 500,
      specialAbility: [
        ability({
          on_defense: 1,
          bf_target: 'enemy_attacker',
          if_effects: [effect('health_atk', -20, 'percent')],
        }),
      ],
    })
    const e = run(row([atk], [def])).turns[0].effects
    check(
      'enemy_attacker damages the fighter that struck',
      e.map((x) => ({ target: x.targetUid, stat: x.stat, delta: x.after - x.before })),
      [{ target: '1-0-1', stat: 'health', delta: -20 }],
    )
  }

  /*
   * 6b. The sign is a share of the blow, not `100 + value`. A −20 that took
   *     80% away was the old arithmetic, and it made both live abilities do
   *     roughly the opposite of their descriptions.
   */
  {
    const atk = fighter({ fighter_id: 1, initiative: 1, damage: 500, element: 'fire' })
    const def = fighter({
      fighter_id: 3,
      initiative: 500,
      health: 4000,
      max_health: 4000,
      specialAbility: [
        ability({
          on_defense: 1,
          bf_target: 'self',
          if_effects: [effect('health_atk', -20, 'percent')],
        }),
      ],
    })
    const e = run(row([atk], [def])).turns[0].effects
    check(
      'health_atk −20 takes a fifth of the blow, not four fifths',
      e.map((x) => x.after - x.before),
      [-100],
    )
  }

  /* 6. A single enemy selector needs no condition, and picks exactly one. */
  {
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      specialAbility: [
        ability({
          on_attack: 1,
          bf_target: 'enemy_health_min',
          if_effects: [effect('taunt', -25)],
        }),
      ],
    })
    const strong = fighter({ fighter_id: 3, initiative: 500, health: 900 })
    const weak = fighter({ fighter_id: 4, initiative: 600, health: 200 })
    check(
      'enemy_health_min selects the lowest-health enemy only',
      firstEffects(row([a], [strong, weak])),
      [{ target: '2-1-4', source: '1-0-1', stat: 'taunt', trigger: 'on_attack', delta: -25 }],
    )
  }

  /* 7. Percentages scale the stat: 400 damage at −50% becomes 200. */
  {
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      specialAbility: [
        ability({
          on_attack: 1,
          bf_target: 'enemy_damage_max',
          if_effects: [effect('damage', -50, 'percent')],
        }),
      ],
    })
    check(
      'a percent effect scales the stat',
      firstEffects(row([a], [fighter({ fighter_id: 3, initiative: 500, damage: 400 })])).map(
        (e) => e.delta,
      ),
      [-200],
    )
  }

  /*
   * 7b. …but `check_battle_caps` clamps the result to the configured band,
   *     and a stat already at the floor cannot be debuffed at all. With
   *     `damage_min` at 100, −50% on a 100-damage fighter changes nothing.
   *     Worth pinning: it makes a debuff silently useless against weak
   *     fighters, which looks like a bug in the display when it is not.
   */
  {
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      specialAbility: [
        ability({
          on_attack: 1,
          bf_target: 'enemy_damage_max',
          if_effects: [effect('damage', -50, 'percent')],
        }),
      ],
    })
    check(
      'a stat already at its floor cannot be debuffed further',
      firstEffects(row([a], [fighter({ fighter_id: 3, initiative: 500, damage: 100 })])),
      [],
    )
  }

  /*
   * 8. The defence pass, and whose stats the maths reads.
   *    `perform_ifbuff` takes `attacker` as its buffer in *both* passes, and
   *    `health_atk` recomputes the attacker's blow against the target's
   *    resistance. A 100-damage attacker, no resistance, value 0: −100.
   */
  {
    const atk = fighter({ fighter_id: 1, initiative: 1, damage: 100, element: 'fire' })
    const def = fighter({
      fighter_id: 3,
      initiative: 500,
      health: 1000,
      specialAbility: [
        ability({
          on_defense: 1,
          bf_target: 'ally_health_max',
          if_effects: [effect('health_atk', -100, 'percent')],
        }),
      ],
    })
    const e = run(row([atk], [def])).turns[0].effects
    check(
      'on_defense fires, and health_atk reads the attacker damage',
      e.map((x) => ({ stat: x.stat, trigger: x.trigger, delta: x.after - x.before })),
      [{ stat: 'health', trigger: 'on_defense', delta: -100 }],
    )
    check(
      'the ability owner is credited, not the attacker whose stats it read',
      e.map((x) => x.sourceUid),
      ['2-0-3'],
    )
  }

  /* 9. A failing check_condition stops a single-target ability. */
  {
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      racename: 'human',
      specialAbility: [
        ability({
          on_attack: 1,
          bf_target: 'enemy_health_min',
          if_effects: [effect('taunt', -25)],
          check_condition: 1,
          condition_target: 'self',
          condition_group: 'race',
          condition_name: 'alien',
        }),
      ],
    })
    check(
      'a failing condition stops the ability',
      firstEffects(row([a], [fighter({ fighter_id: 3, initiative: 500 })])),
      [],
    )
  }

  /*
   * 10. effect_on_condition_count repeats a single-target effect once per
   *     match; without it the contract clamps the count to 1.
   */
  for (const [flag, times] of [
    [1, 2],
    [0, 1],
  ] as const) {
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      racename: 'human',
      specialAbility: [
        ability({
          on_attack: 1,
          bf_target: 'enemy_health_min',
          if_effects: [effect('taunt', -10)],
          check_condition: 1,
          condition_target: 'ally_group',
          condition_group: 'race',
          condition_name: 'human',
          effect_on_condition_count: flag,
        }),
      ],
    })
    const mate = fighter({ fighter_id: 2, initiative: 999, racename: 'human' })
    check(
      `effect_on_condition_count = ${flag} applies the effect ${times}x`,
      firstEffects(row([a, mate], [fighter({ fighter_id: 3, initiative: 500 })])).length,
      times,
    )
  }

  /* 11. A stat `perform_ifbuff` has no branch for is ignored. */
  {
    const a = fighter({
      fighter_id: 1,
      initiative: 1,
      specialAbility: [
        ability({
          on_attack: 1,
          bf_target: 'enemy_health_min',
          if_effects: [effect('max_health', 500)],
        }),
      ],
    })
    check(
      'an unhandled stat name is ignored',
      firstEffects(row([a], [fighter({ fighter_id: 3, initiative: 500 })])),
      [],
    )
  }

  /*
   * 12. A heal stops at max_health, and does not move it.
   *
   *     `perform_ifbuff` used to pin `max_health = health` after a health
   *     effect, so a heal raised its own ceiling and the fighter read as full
   *     for the rest of the fight. The ceiling is now the fighter's own
   *     max_health, and the only floor is 0 rather than the caps' health_min.
   *     The attacker deals no damage here, so the heal is the only change.
   */
  {
    const heal = (over = {}) =>
      fighter({
        fighter_id: 1,
        initiative: 1,
        damage: 0,
        specialAbility: [
          ability({
            on_attack: 1,
            bf_target: 'enemy_health_max',
            if_effects: [effect('health', 200)],
          }),
        ],
        ...over,
      })
    const snapOf = (r: FightRow) =>
      run(r).turns[0].snapshot.find((s) => s.uid === '2-0-3')!

    const full = snapOf(row([heal()], [fighter({ fighter_id: 3, initiative: 500, health: 500, max_health: 500 })]))
    check(
      'a heal cannot pass max_health, and max_health does not move',
      [full.health, full.max_health],
      [500, 500],
    )

    const hurt = snapOf(row([heal()], [fighter({ fighter_id: 3, initiative: 500, health: 250, max_health: 500 })]))
    check(
      'a heal with headroom lands in full',
      [hurt.health, hurt.max_health],
      [450, 500],
    )

    const partial = snapOf(row([heal()], [fighter({ fighter_id: 3, initiative: 500, health: 400, max_health: 500 })]))
    check(
      'a heal larger than the headroom is trimmed to it',
      [partial.health, partial.max_health],
      [500, 500],
    )
  }

  /*
   * 13. `ignore_res_percent` — "striking ignores X% of target resistance".
   *
   *     The field sat unread in the contract until now, so the eighteen
   *     Irresistable / Mind Damage / Void Damage abilities did nothing at all.
   *     It is summed across the attacker's on_attack abilities and capped at
   *     100, so stacking two can never drive resistance below zero.
   */
  {
    const pierce = (pct: number, over = {}) =>
      ability({ on_attack: 1, bf_target: '', ignore_res_percent: pct, ...over })
    const hit = (abilities: BattleAbility[]) =>
      run(
        row(
          [fighter({ fighter_id: 1, initiative: 1, damage: 500, element: 'fire', specialAbility: abilities })],
          [fighter({ fighter_id: 3, initiative: 500, res_fire: 600 })],
        ),
      ).turns[0].damage

    check('no ignore: 600 resistance blocks 60%', hit([]), 200)
    check('88% ignored: 600 resistance falls to 72', hit([pierce(88)]), 465)
    check('stacked and capped at 100: resistance fully ignored', hit([pierce(88), pierce(68)]), 500)
    check('a locked ability grants no ignore', hit([pierce(88, { locked: 1 })]), 200)
  }

  /*
   * 14. A negative health effect runs down to 0, so a cleave can kill.
   *
   *     It used to be routed through the battle caps, which floored it at
   *     health_min — 100 — so Tactical Nuke and Secondary Explosions could
   *     never land a killing blow however large they were.
   */
  {
    const nuke = fighter({
      fighter_id: 1,
      initiative: 1,
      damage: 0,
      specialAbility: [
        ability({ on_attack: 1, bf_target: 'enemy_group', if_effects: [effect('health', -1000)] }),
      ],
    })
    const r = run(row([nuke], [fighter({ fighter_id: 3, initiative: 500, health: 1000 })]))
    check(
      'a flat cleave takes the last 1000 health and kills',
      [r.turns[0].snapshot.find((s) => s.uid === '2-0-3')!.health, r.winner],
      [0, 1],
    )
  }

  /*
   * 15. Both teams are swept, not only the fighter that was struck.
   *
   *     The loop used to erase the defender alone, so anyone else the cleave
   *     killed would have stayed in the team at 0 health and kept fighting.
   *     Here the defender is the one with the higher taunt; the other foe is
   *     never struck, and the fight can only end on turn one if it too was
   *     removed.
   */
  {
    const nuke = fighter({
      fighter_id: 1,
      initiative: 1,
      damage: 0,
      specialAbility: [
        ability({ on_attack: 1, bf_target: 'enemy_group', if_effects: [effect('health', -300)] }),
      ],
    })
    const bystander = fighter({ fighter_id: 3, initiative: 500, health: 200, taunt: 100 })
    const struck = fighter({ fighter_id: 4, initiative: 501, health: 200, taunt: 200 })
    const r = run(row([nuke], [bystander, struck]))
    check(
      'the cleave kills the bystander too, and the fight ends on turn one',
      [
        r.turns[0].defenderUid,
        r.turns[0].snapshot.find((s) => s.uid === '2-0-3')!.health,
        r.winner,
        r.turns.length,
      ],
      ['2-1-4', 0, 1, 1],
    )
  }

  console.log(`\n${failures === 0 ? 'all cases passed' : `${failures} FAILED`}`)
}

main()
