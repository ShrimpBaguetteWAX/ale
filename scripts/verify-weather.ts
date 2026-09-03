/**
 * Pins the weather rules against `apply_weather_and_age` and the live tables.
 *
 *   npx vite build --ssr scripts/verify-weather.ts --outDir .ssr
 *   node .ssr/verify-weather.js
 *
 * The screen makes two claims a player will act on: who the weather catches,
 * and whether it helps or hurts them. The first is the contract's own
 * targeting rule and is checked against it clause by clause; the second is a
 * reading of the effects, and the trap there is wind-up — `attackspeed` and
 * `initiative` are delays, so a bigger number is a worse fighter and a "+25%"
 * on them is bad news dressed as good.
 *
 * Then the whole thing runs over a planet's real 1,001 rolls and every land
 * that has weather, because a rule that only holds on the examples I chose is
 * not a rule.
 */
import {
  applyWeather,
  weatherEffectText,
  weatherHits,
  weatherIsCalm,
  weatherLean,
  weatherTargets,
  type Weather,
  type WeatherableStats,
} from '../src/fight/weather'
import { DEFAULT_CAPS, type StatCaps } from '../src/dungeon/sim'
import { teamOutlook, type FlatFighter } from '../src/fight/matchup'
import { applyArenaPower } from '../src/arena/rules'
import { fieldedStats } from '../src/fight/scaling'
import type { LiveArenaRow } from '../src/arena/queries'
import type { BattleFighter } from '../src/dungeon/types'

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

const post = async <T,>(b: Record<string, unknown>) =>
  (
    await fetch('https://wax.greymass.com/v1/chain/get_table_rows', {
      method: 'POST',
      /* text/plain dodges the CORS preflight the node does not answer. */
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ json: true, limit: 1000, ...b }),
    })
  ).json() as Promise<{ rows: T[]; more: boolean; next_key: string }>

const weather = (over: Partial<Weather> = {}): Weather => ({
  weather_id: 'test',
  affected_class: [],
  affected_race: [],
  affected_element: [],
  weather_effects: [],
  displayname: 'Test',
  title: 'Test',
  ...over,
})

const fighter = (classname: string, racename: string, element: string) => ({
  classname,
  racename,
  element,
})

console.log('\nwho the weather catches')
{
  /*
     `apply_weather_and_age` tries class, then race, then element, and stops
     at the first match. Any one of the three is enough.
  */
  const byClass = weather({ affected_class: ['arcanist'] })
  check('a named class is caught', weatherHits(byClass, fighter('arcanist', 'altan', 'fire')), true)
  check('another class is not', weatherHits(byClass, fighter('juggernaut', 'altan', 'fire')), false)

  const byRace = weather({ affected_race: ['robotron'] })
  check('a named race is caught', weatherHits(byRace, fighter('hunter', 'robotron', 'gem')), true)
  check('another race is not', weatherHits(byRace, fighter('hunter', 'altan', 'gem')), false)

  const byElement = weather({ affected_element: ['gem'] })
  check('a named element is caught', weatherHits(byElement, fighter('hunter', 'altan', 'gem')), true)
  check('another element is not', weatherHits(byElement, fighter('hunter', 'altan', 'fire')), false)

  const several = weather({ affected_class: ['arcanist'], affected_element: ['gem'] })
  check(
    'matching any one of the lists is enough',
    weatherHits(several, fighter('hunter', 'altan', 'gem')),
    true,
  )

  /*
     The clause that is easy to miss: when all three lists are empty the
     contract sets `apply_weather = true` for everybody. Reading an empty list
     as "matches nothing" would silently disable the 139 global rolls.
  */
  check('naming nothing catches everybody', weatherHits(weather(), fighter('x', 'y', 'z')), true)

  /* The chain writes names lower-case; a fighter row need not agree. */
  check(
    'case does not decide it',
    weatherHits(weather({ affected_race: ['robotron'] }), fighter('hunter', 'Robotron', 'gem')),
    true,
  )
  check(
    'and a missing field is simply not a match',
    weatherHits(weather({ affected_class: ['arcanist'] }), { element: 'fire' }),
    false,
  )
}

console.log('\nwhether it helps or hurts')
{
  const of = (statname: string, percent = 0, flat = 0) =>
    weather({ weather_effects: [{ statname, percent_change: percent, flat_change: flat }] })

  check('more damage is good', weatherLean(of('damage', 25)), 'good')
  check('less damage is bad', weatherLean(of('damage', -25)), 'bad')
  check('more resistance is good', weatherLean(of('res_fire', 0, 400)), 'good')
  /*
     Wind-up is a delay, so the sign flips. A screen that painted "+25%
     cooldown" green would be telling the player the opposite of the truth.
  */
  check('more cooldown is bad', weatherLean(of('attackspeed', 25)), 'bad')
  check('less cooldown is good', weatherLean(of('attackspeed', -25)), 'good')
  check('more windup is bad', weatherLean(of('initiative', 0, 150)), 'bad')
  check('less windup is good', weatherLean(of('initiative', 0, -150)), 'good')

  check(
    'giving and taking is mixed',
    weatherLean(
      weather({
        weather_effects: [
          { statname: 'res_air', percent_change: 0, flat_change: -400 },
          { statname: 'res_nature', percent_change: 0, flat_change: 200 },
        ],
      }),
    ),
    'mixed',
  )
  /*
     Taunt decides who gets hit, not how well anyone fights. The fighter
     cards already refuse to grade it; the panel must not either.
  */
  check('taunt is neither', weatherLean(of('taunt', 25)), 'none')
  check('and it does not drag a real effect either way',
    weatherLean(weather({ weather_effects: [
      { statname: 'taunt', percent_change: -20, flat_change: 0 },
      { statname: 'damage', percent_change: 15, flat_change: 0 },
    ] })), 'good')

  check('no effects lean nowhere', weatherLean(weather()), 'none')
  check('and that roll is calm', weatherIsCalm(weather()), true)
}

console.log('\nhow an effect reads')
{
  /* Flat changes travel in tenths, like every other stat on the wire. */
  check('a flat change is a tenth of the stored figure', weatherEffectText({ statname: 'damage', percent_change: 0, flat_change: -200 }), '-20')
  check('a percentage keeps its sign', weatherEffectText({ statname: 'damage', percent_change: 35, flat_change: 0 }), '+35%')
  check('both are said', weatherEffectText({ statname: 'damage', percent_change: -15, flat_change: 300 }), '-15% and +30')
  check('neither is said plainly', weatherEffectText({ statname: 'damage', percent_change: 0, flat_change: 0 }), 'no change')
}

console.log('\nwhat the targets read as')
{
  check(
    'class, race and element together',
    weatherTargets(weather({ affected_class: ['arcanist'], affected_race: ['altan'], affected_element: ['gem'] })),
    ['arcanist', 'altan', 'gem'],
  )
  check('and nothing when it catches everybody', weatherTargets(weather()), [])
}

console.log('\nwhat it does to a fighter')
{
  const caps: StatCaps = { ...DEFAULT_CAPS }
  const base = (over: Partial<WeatherableStats> = {}): WeatherableStats => ({
    classname: 'arcanist',
    racename: 'altan',
    element: 'gem',
    health: 1000,
    max_health: 1000,
    damage: 1000,
    taunt: 500,
    initiative: 500,
    attackspeed: 500,
    res_gem: 200, res_metal: 200, res_air: 200,
    res_fire: 200, res_nature: 200, res_neutral: 200,
    ...over,
  })
  const roll = (effects: Weather['weather_effects'], over: Partial<Weather> = {}) =>
    weather({ weather_effects: effects, ...over })

  /* stat = check_battle_caps(stat, stat * (100 + percent) / 100) */
  check(
    'a percentage scales the stat',
    applyWeather(base(), roll([{ statname: 'damage', percent_change: -35, flat_change: 0 }]), caps).damage,
    650,
  )
  /* stat = add_values(stat, flat, stat_name, true), and flats are tenths */
  check(
    'a flat change is added in the contract\'s own units',
    applyWeather(base(), roll([{ statname: 'damage', percent_change: 0, flat_change: -200 }]), caps).damage,
    800,
  )
  check(
    'and both run, percentage first',
    applyWeather(base(), roll([{ statname: 'damage', percent_change: -50, flat_change: 100 }]), caps).damage,
    600,
  )

  /* The integer division the contract does, not a float. */
  check(
    'the percentage step truncates',
    applyWeather(base({ damage: 333 }), roll([{ statname: 'damage', percent_change: 15, flat_change: 0 }]), caps).damage,
    382,
  )

  check(
    'health drags max_health with it',
    (() => {
      const out = applyWeather(base(), roll([{ statname: 'health', percent_change: 50, flat_change: 0 }]), caps)
      return [out.health, out.max_health]
    })(),
    [1500, 1500],
  )

  /* check_battle_caps clamps resistances to [0, cap]. */
  check(
    'a resistance cannot pass its cap',
    applyWeather(base({ res_air: 700 }), roll([{ statname: 'res_air', percent_change: 0, flat_change: 400 }]), caps).res_air,
    caps.res_air,
  )
  check(
    'nor fall below zero',
    applyWeather(base({ res_air: 100 }), roll([{ statname: 'res_air', percent_change: 0, flat_change: -400 }]), caps).res_air,
    0,
  )
  check(
    'and damage is held to its floor',
    applyWeather(base({ damage: 120 }), roll([{ statname: 'damage', percent_change: -90, flat_change: 0 }]), caps).damage,
    caps.damage_min,
  )

  /* Only the fighters the roll names. */
  const aimed = roll([{ statname: 'damage', percent_change: -35, flat_change: 0 }], {
    affected_class: ['arcanist'],
  })
  check('a fighter it names is changed', applyWeather(base(), aimed, caps).damage, 650)
  check(
    'one it does not is returned untouched',
    applyWeather(base({ classname: 'juggernaut' }), aimed, caps).damage,
    1000,
  )
  check('and no weather at all changes nothing', applyWeather(base(), null, caps).damage, 1000)

  /*
     Several effects compound in the order the contract lists them, and a
     stat nobody mentioned is left where it was.
  */
  const many = applyWeather(
    base(),
    roll([
      { statname: 'damage', percent_change: -20, flat_change: 0 },
      { statname: 'res_fire', percent_change: 0, flat_change: 300 },
    ]),
    caps,
  )
  check('every effect lands', [many.damage, many.res_fire], [800, 500])
  check('and an untouched stat stays put', many.taunt, 500)
}

/* ---------- against the live tables ---------- */

async function live(): Promise<void> {
  const PLANET = 'magor'

  let all: Weather[] = []
  let next = ''
  for (let i = 0; i < 4; i++) {
    const page = await post<Weather>({
      code: 'battle.ale',
      scope: PLANET,
      table: 'weather',
      ...(next ? { lower_bound: next } : {}),
    })
    all.push(...page.rows)
    if (!page.more) break
    next = page.next_key
  }
  all = [...new Map(all.map((w) => [w.weather_id, w])).values()]

  console.log(`\nagainst ${PLANET}'s weather table`)
  check('the table came back whole', all.length > 900, true)

  const targeted = all.filter(
    (w) => w.affected_class.length || w.affected_race.length || w.affected_element.length,
  )
  console.log(
    `  (${all.length} rolls: ${targeted.length} aimed at somebody, ${all.length - targeted.length} at everybody)`,
  )
  /*
     The reason the panel bothers counting per side. If the rolls were mostly
     global the counts would be noise; they are mostly aimed, so the usual
     case is a modifier that lands unevenly.
   */
  check('most rolls are aimed at somebody', targeted.length > all.length / 2, true)

  /* Every effect must be one the panel knows how to name and draw. */
  const KNOWN = new Set([
    'damage', 'health', 'taunt', 'initiative', 'attackspeed',
    'res_gem', 'res_fire', 'res_air', 'res_metal', 'res_neutral', 'res_nature',
  ])
  const unknown = new Set<string>()
  for (const w of all) {
    for (const e of w.weather_effects) if (!KNOWN.has(e.statname)) unknown.add(e.statname)
  }
  check('every effect names a stat the panel can draw', [...unknown], [])

  const named = all.every((w) => !!w.displayname)
  check('and every roll has a name to show', named, true)

  const leans = { good: 0, bad: 0, mixed: 0, none: 0 }
  for (const w of all) leans[weatherLean(w)]++
  console.log(`  (leans: ${leans.good} good, ${leans.bad} bad, ${leans.mixed} mixed, ${leans.none} none)`)
  check('the whole table classifies without exception', leans.good + leans.bad + leans.mixed + leans.none, all.length)

  /* Every land under weather must point at a roll that exists. */
  const tracking = (
    await post<{ land_id: string; weather_id: string; last_change: string }>({
      code: 'battle.ale', scope: PLANET, table: 'landtracking',
    })
  ).rows
  const ids = new Set(all.map((w) => String(w.weather_id)))
  const dangling = tracking.filter((t) => t.weather_id && !ids.has(String(t.weather_id)))
  console.log(`  (${tracking.length} lands tracked on ${PLANET})`)
  check('every tracked land points at a roll that exists', dangling.length, 0)

  /*
     And the one the arena screen would actually draw. `rndweather` re-rolls
     on travel, so a player standing on the land has already settled this.
  */
  const checks = (
    await post<{ planet: string; land_id: string }>({
      code: 'arena.ale', scope: 'arena.ale', table: 'arenacheck', limit: 100,
    })
  ).rows
  const onPlanet = checks.filter((c) => c.planet === PLANET)
  let drawn = 0
  for (const c of onPlanet.slice(0, 5)) {
    const t = tracking.find((r) => String(r.land_id) === String(c.land_id))
    const w = t && all.find((x) => String(x.weather_id) === String(t.weather_id))
    if (!w) continue
    drawn++
    console.log(`  ${PLANET}/${c.land_id}: ${weatherLean(w).padEnd(5)} ${w.displayname}`)
  }
  check('live arenas resolve to weather the panel can draw', drawn > 0, true)

  /*
     What all of that is for: the balance bar. Run a real arena's defenders
     and a real roster through the pipeline twice — once with the land's
     weather and once without — and see whether the answer moves.
  */
  console.log('\nwhat it does to the balance bar')
  const bcfg = (
    await post<Record<string, never>>({
      code: 'battle.ale', scope: 'battle.ale', table: 'config', limit: 1,
    })
  ).rows[0] as Record<string, unknown>
  const levelMod = Number(bcfg.level_mod) || 1
  const ageDecay = Number(bcfg.age_decay) || 0
  const caps = (bcfg.battle_stat_caps as StatCaps) ?? DEFAULT_CAPS

  const owner = (() => {
    const CHARMAP = '.12345abcdefghijklmnopqrstuvwxyz'
    const name = '5thba.wam'
    let value = 0n
    for (let i = 0; i <= 12; i++) {
      let c = 0n
      if (i < name.length && i <= 12) c = BigInt(CHARMAP.indexOf(name[i]))
      if (i < 12) {
        c &= 0x1fn
        c <<= BigInt(64 - 5 * (i + 1))
      } else {
        c &= 0x0fn
      }
      value |= c
    }
    return value
  })()

  const roster = (
    await post<Record<string, never>>({
      code: 'fighters.ale', scope: 'fighters.ale', table: 'fighters',
      index_position: 2, key_type: 'i128',
      lower_bound: (owner << 64n).toString(),
      upper_bound: ((owner << 64n) | 0xffffffffffffffffn).toString(),
    })
  ).rows as unknown as {
    element: string; classname: string; racename: string; creation_date: string
    stats: Record<string, number> & { abilities?: never[] }
  }[]

  const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
  const myTeam = (w: Weather | null): FlatFighter[] =>
    roster.slice(0, 5).map((f) => {
      const st = f.stats
      const b = applyWeather(
        {
          element: f.element, classname: f.classname, racename: f.racename,
          health: mid(st.health_min, st.health_max),
          damage: mid(st.damage_min, st.damage_max),
          attackspeed: mid(st.attackspeed_min, st.attackspeed_max),
          taunt: mid(st.taunt_min, st.taunt_max),
          initiative: mid(st.initiative_min, st.initiative_max),
          res_gem: st.res_gem, res_metal: st.res_metal, res_air: st.res_air,
          res_fire: st.res_fire, res_nature: st.res_nature, res_neutral: st.res_neutral,
        },
        w, caps,
      )
      const factor =
        Math.pow(levelMod, Math.max(0, st.level)) *
        Math.pow(ageDecay, Math.pow(Math.max(0, Math.floor((Date.now() - Date.parse(f.creation_date + 'Z')) / 86400000)), 2))
      return {
        ...b,
        health: Math.trunc(b.health * factor),
        damage: Math.trunc(b.damage * factor),
        abilities: st.abilities ?? [],
      }
    })

  /* Read once; the loop below and the check after it both want them. */
  const arenaRows = (
    await post<LiveArenaRow>({ code: 'arena.ale', scope: PLANET, table: 'livearena', limit: 100 })
  ).rows
  const powers = (
    await post<{ land_id: string; arena_power: number }>({
      code: 'arena.ale', scope: 'arena.ale', table: 'arenacheck', limit: 100,
    })
  ).rows

  let moved = 0
  let looked = 0
  for (const c of onPlanet.slice(0, 8)) {
    const t = tracking.find((r) => String(r.land_id) === String(c.land_id))
    const w = t && all.find((x) => String(x.weather_id) === String(t.weather_id))
    if (!w) continue
    const arenaRow = arenaRows.find((r) => String(r.land_id) === String(c.land_id))
    if (!arenaRow?.fighters.length) continue
    const power = powers.find((r) => String(r.land_id) === String(c.land_id))?.arena_power

    const defenders = (weatherOn: Weather | null): BattleFighter[] =>
      applyArenaPower(
        arenaRow.fighters.map((f) =>
          fieldedStats(applyWeather(f, weatherOn, caps), f.level, f.creation_date, levelMod, ageDecay),
        ),
        Number(power ?? 10000),
      )

    const without = teamOutlook(myTeam(null), defenders(null)).share
    const withIt = teamOutlook(myTeam(w), defenders(w)).share
    looked++
    if (Math.abs(withIt - without) > 0.0005) moved++
    console.log(
      `  ${PLANET}/${String(c.land_id).padEnd(6)} ${(without * 100).toFixed(1)}% -> ${(withIt * 100).toFixed(1)}%` +
        `  ${w.displayname}`,
    )
  }
  check('the bar was measured against live arenas', looked > 0, true)

  /*
     Today's sky is mostly resistances for elements nobody on either side
     attacks with, plus taunt and cooldown — and this bar is a
     health/damage/element model, so none of those move it. That is the right
     answer, and it is also a thin demonstration that the pipe is connected.

     So: take a roll from the same table that the bar certainly does read —
     a global cut to damage — and put it through the same live pipeline. If
     that does not move the share, weather is not reaching the bar at all.
  */
  const loud = all.find(
    (w) =>
      !w.affected_class.length && !w.affected_race.length && !w.affected_element.length &&
      w.weather_effects.some((e) => e.statname === 'damage' && (e.percent_change < 0 || e.flat_change < 0)),
  )
  check('the table has a global damage roll to test with', !!loud, true)
  if (loud) {
    const c = onPlanet.find((x) => arenaRows.some((r) => String(r.land_id) === String(x.land_id) && r.fighters.length))
    const arenaRow = arenaRows.find((r) => String(r.land_id) === String(c?.land_id))
    const power = powers.find((p) => String(p.land_id) === String(c?.land_id))?.arena_power
    if (arenaRow) {
      const defenders = (w: Weather | null): BattleFighter[] =>
        applyArenaPower(
          arenaRow.fighters.map((f) =>
            fieldedStats(applyWeather(f, w, caps), f.level, f.creation_date, levelMod, ageDecay),
          ),
          Number(power ?? 10000),
        )
      const before = teamOutlook(myTeam(null), defenders(null))
      const after = teamOutlook(myTeam(loud), defenders(loud))
      console.log(
        `  ${loud.displayname}: your damage ${before.mine.damage} -> ${after.mine.damage}, ` +
          `theirs ${before.theirs.damage} -> ${after.theirs.damage}`,
      )
      check('a global damage roll reaches both sides', [
        after.mine.damage < before.mine.damage,
        after.theirs.damage < before.theirs.damage,
      ], [true, true])
    }
  }
  /*
     Not every roll shifts the balance — one that catches both sides evenly
     leaves the share where it was, which is the right answer rather than a
     failure. What matters is that the pipeline is live at all.
  */
  console.log(`  (${moved} of ${looked} rolls moved the bar)`)

  console.log('\n' + (fail === 0 ? `all ${pass} cases passed` : `${fail} FAILED`))
  if (fail) process.exitCode = 1
}

void live()
