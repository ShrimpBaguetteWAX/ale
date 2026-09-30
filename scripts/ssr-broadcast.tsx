/**
 * The fight broadcast, mid-fight, at three points in one.
 *
 *   npm run build
 *   npx vite build --ssr scripts/ssr-broadcast.tsx --outDir .ssr
 *   node .ssr/ssr-broadcast.js [out.html]
 *
 * The live half of the broadcast only exists once a fight has been run, and
 * running one on the real screen means a tournament in its battle stage and
 * a click. `simulateBout` needs no chain at all — two lists of roster
 * fighters and a seed — so the fight below is a real one, fought here, and
 * what is drawn is what a player sees on the turn shown.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { Feed } from '../src/tournament/BoutBroadcast'
import { simulateBout } from '../src/tournament/bout'
import { DEFAULT_CAPS } from '../src/dungeon/sim'
import type { RosterFighter } from '../src/dungeon/types'
import type { Weather } from '../src/fight/weather'

const ORIGIN = 'https://new.alienlegends.io'

const css = (() => {
  const dir = 'docs/assets'
  const file = readdirSync(dir).find((f) => /^index-.*\.css$/.test(f))
  if (!file) throw new Error('No built stylesheet — run `npm run build` first.')
  return readFileSync(`${dir}/${file}`, 'utf8')
})()

const RES = {
  res_gem: 0,
  res_metal: 0,
  res_air: 0,
  res_fire: 0,
  res_nature: 0,
  res_neutral: 0,
}

/* Real class/race pairs, so the figures resolve to shipped art. */
const A_CAST = [
  ['hunter', 'elgem', 'nature'],
  ['juggernaut', 'khaured', 'metal'],
  ['arcanist', 'human', 'gem'],
  ['explosioneer', 'robotron', 'fire'],
  ['mindblade', 'altan', 'air'],
  ['mystic', 'elgem', 'gem'],
]

const B_CAST = [
  ['lunatic', 'khaured', 'nature'],
  ['astralknight', 'onoros', 'fire'],
  ['desperado', 'human', 'metal'],
  ['voidwarden', 'onoros', 'air'],
  ['hunter', 'altan', 'nature'],
  ['arcanist', 'robotron', 'metal'],
]

/*
   A cleave, so the multi-target case is actually on the page.

   `on_attack` with an `enemy_group` target: every enemy still standing
   takes a share when this fighter swings, which the simulator records as
   one health effect per target on the same turn.
*/
const CLEAVE = [
  {
    name: "Cleave",
    on_attack: 1,
    /* In-fight triggers read `if_effects`; `bf_effects` is the before-fight
       channel and never fires on a swing. */
    bf_target: "enemy_group",
    if_effects: [{ percentflat: "flat", stat_name: "health", value: -260 }],
  },
] as never

let id = 0
const roster = ([classname, racename, element]: string[], health: number, damage: number) =>
  ({
    fighter_id: ++id,
    owner: 'someone',
    creation_date: '2026-06-01T00:00:00',
    marker: '',
    stats: {
      health_min: health,
      health_max: health + 1800,
      damage_min: damage,
      damage_max: damage + 400,
      taunt_min: 100,
      taunt_max: 260,
      initiative_min: 400,
      initiative_max: 900,
      attackspeed_min: 400,
      attackspeed_max: 900,
      ...RES,
      classname,
      racename,
      element,
      target: '',
      abilities: [],
      level: 7,
    },
  }) as unknown as RosterFighter

const one = {
  fighters: A_CAST.map((c, i) => {
    const f = roster(c, 6400, 1900)
    /* One cleaver a side, so both lines show the case. */
    if (i === 2) (f.stats as { abilities: unknown }).abilities = CLEAVE
    return f
  }),
  nft: null,
}
const two = { fighters: B_CAST.map((c) => roster(c, 6100, 2000)), nft: null }

/* Three rolls, as a tournament makes them — all of them apply. */
const WEATHER: Weather[] = [
  {
    weather_id: 'solarflare',
    displayname: '-25% mystic health',
    title: 'Solar Flare',
    affected_class: ['mystic'],
    affected_element: [],
    affected_race: [],
    weather_effects: [{ statname: 'health', percent_change: -25, flat_change: 0 }],
  },
  {
    weather_id: 'ashfall',
    displayname: '+15 gem resistance',
    title: 'Ashfall',
    affected_class: [],
    affected_element: [],
    affected_race: [],
    weather_effects: [{ statname: 'res_gem', percent_change: 0, flat_change: 150 }],
  },
] as unknown as Weather[]

const replay = simulateBout(
  4821,
  one,
  two,
  { weather: WEATHER, caps: DEFAULT_CAPS, levelMod: 1.15, ageDecay: 0.999_97 },
  10,
  Date.parse('2026-09-28T12:00:00Z'),
)

if (!replay) throw new Error('the fight produced nothing')

const at = (step: number, aiming = false) =>
  renderToStaticMarkup(
    <Feed
      replay={replay}
      step={step}
      round={0}
      bout={3}
      weather={WEATHER}
      a="Tessellate"
      b="Ember"
      avatarA={1002}
      avatarB={1004}
      mine={1}
      aiming={aiming}
      paused={false}
      onPause={() => {}}
      onSeek={() => {}}
    />,
  )

/*
   Three moments: the bell, the middle, and the last blow. The middle one is
   where the formation has to hold — some down, some still up, and the pair
   in the exchange lit.
*/
/*
   The first swing that hit more than one fighter.

   Picked rather than guessed at: a cleave is the case the numbers had to
   be rewritten for, and a turn sampled from the middle of the fight is
   almost never one.
*/
const cleaveAt = Math.max(
  1,
  replay.turns.findIndex(
    (t) =>
      t.effects.filter((e) => (e.stat === 'health' || e.stat === 'health_atk') && e.after < e.before)
        .length > 0,
  ) + 1,
)

const STEPS = [
  { note: 'Called up — a beat before the blow', step: cleaveAt - 1, aiming: true },
  { note: 'Still reading — the numbers outlive the blow', step: cleaveAt, aiming: true },
  { note: 'A cleave — every fighter it reached wears its own number', step: cleaveAt },
  { note: 'The last blow', step: replay.turns.length },
]

const out = process.argv[2] ?? '.ssr/broadcast.html'
writeFileSync(
  out,
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The fight broadcast — mid-fight</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 22px; background: #070d18; }
  .bcat { max-width: 1060px; margin: 0 auto; display: grid; gap: 26px; }
  .bcat h1 { color: #ffdb7d; font-size: 1.5rem; margin: 0; font-family: 'Orbitron', system-ui, sans-serif; }
  .bcat__note {
    margin: 0 0 8px;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #7b8ba5;
  }
  /* The live classes the component's own state would be setting. */
  .bcast { background: #04070e; }

  /*
     Held a third of the way in.

     The damage numbers end on a forwards fill at zero opacity, so a still of a
     finished animation shows nothing at all. Freezing them part-way is the
     only way a static page can show what a player sees.
  */
  .bcast__hit { animation-delay: -0.42s; animation-play-state: paused; }
  .bcast__aim { animation-delay: -0.22s; animation-play-state: paused; }
</style>
</head>
<body>
<div class="bcat">
  <h1>The fight broadcast — mid-fight</h1>
  ${STEPS.map(
    (s) => `<section>
      <p class="bcat__note">${s.note} · turn ${s.step} of ${replay.turns.length}</p>
      <div class="bcast bcast--live">
        <div class="bcast__bg"></div>
        <div class="bcast__vig"></div>
        ${at(s.step, (s as { aiming?: boolean }).aiming ?? false)}
      </div>
    </section>`,
  ).join('\n')}
</div>
<script>
  /*
     Held part-way in.

     The damage numbers and the pointer end on a forwards fill, the numbers at
     zero opacity — so a still of a finished animation shows nothing at
     all. Winding each one to a chosen moment and pausing it is the only
     way a static page can show what a player actually sees.
  */
  for (const a of document.getAnimations()) {
    a.currentTime = a.animationName === "bcastrise" ? 420 : 250
    a.pause()
  }
</script>
</body>
</html>`
    .replaceAll('src="./assets/', `src="${ORIGIN}/assets/`)
    .replaceAll('src="/assets/', `src="${ORIGIN}/assets/`)
    .replaceAll("url('/assets/", `url('${ORIGIN}/assets/`),
)

console.log(`${STEPS.length} moments, ${replay.turns.length} turns -> ${out}`)
