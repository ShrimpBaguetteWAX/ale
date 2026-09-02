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
  weatherEffectText,
  weatherHits,
  weatherIsCalm,
  weatherLean,
  weatherTargets,
  type Weather,
} from '../src/fight/weather'

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

  console.log('\n' + (fail === 0 ? `all ${pass} cases passed` : `${fail} FAILED`))
  if (fail) process.exitCode = 1
}

void live()
