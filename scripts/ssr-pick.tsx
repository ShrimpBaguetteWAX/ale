/**
 * The compact picker tile, in every state it can be in.
 *
 *   npx vite build --ssr scripts/ssr-pick.tsx --outDir .ssr
 *   node .ssr/ssr-pick.js [out.html]
 *
 * One card is shared by the dungeon, the arena, the tournament and
 * ascension, and its states are spread across four screens that each need a
 * live roster to reach — a fighter busy in a dungeon, a team already full,
 * the three being spent on a fourth. Rendered together here against the real
 * stylesheet, so a tile that reads badly on this page reads badly in the
 * game.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { PickCard } from '../src/fight/setup'
import type { RosterFighter } from '../src/dungeon/types'

const css = ['tokens.css', 'global.css', 'app.css', 'tavern.css', 'dungeon.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

/*
   The art comes off the deployed build.

   `asset()` hands back a path relative to the app's own base, which is
   nothing this page can serve — and the element backdrop arrives as a
   `url()` inside an inline style rather than as a `src`, so both spellings
   have to be rewritten or the tiles render as bare alt text on black.
*/
const ORIGIN = 'https://new.alienlegends.io'
const live = (html: string) =>
  html
    .replaceAll('src="./assets/', `src="${ORIGIN}/assets/`)
    .replaceAll('src="/assets/', `src="${ORIGIN}/assets/`)
    /* React escapes the quotes inside an inline style attribute, so the
       backdrop arrives as url(&#x27;./assets/…&#x27;), not url('./assets/…'). */
    .replaceAll('url(&#x27;./assets/', `url(&#x27;${ORIGIN}/assets/`)
    .replaceAll('url(&#x27;/assets/', `url(&#x27;${ORIGIN}/assets/`)

const NOW = Date.now()
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString().slice(0, 19)

let id = 0
const fighter = (
  classname: string,
  racename: string,
  element: string,
  level: number,
  days: number,
  marker = '',
): RosterFighter =>
  ({
    fighter_id: ++id,
    classname,
    racename,
    element,
    marker,
    in_use: 0,
    use_type: '',
    creation_date: daysAgo(days),
    next_payday: '2999-01-01T00:00:00',
    ascension_level: 0,
    stats: {
      level,
      health_min: 380 + level * 4,
      health_max: 620 + level * 4,
      damage_min: 88 + level * 3,
      damage_max: 142 + level * 3,
      attackspeed_min: 500,
      attackspeed_max: 700,
      initiative_min: 400,
      initiative_max: 800,
    },
  }) as unknown as RosterFighter

/* A roster wide enough to judge the chips on: bright art and dark, tall
   figures and squat, a marker on some and not others. */
const ROSTER: RosterFighter[] = [
  fighter('arcanist', 'human', 'gem', 16, 40, 'blue'),
  fighter('astralknight', 'onoros', 'fire', 12, 90),
  fighter('desperado', 'human', 'metal', 9, 300),
  fighter('lunatic', 'khaured', 'nature', 21, 20, 'red'),
  fighter('juggernaut', 'khaured', 'metal', 7, 150),
  fighter('mindblade', 'altan', 'air', 14, 70),
  fighter('mystic', 'elgem', 'gem', 18, 600, 'yellow'),
  fighter('explosioneer', 'robotron', 'fire', 11, 30),
  fighter('hunter', 'elgem', 'nature', 5, 60),
  fighter('voidwarden', 'onoros', 'air', 13, 260),
  fighter('arcanist', 'robotron', 'metal', 24, 25, 'green-up'),
  fighter('desperado', 'khaured', 'fire', 8, 380),
]

const ASCENSION: RosterFighter[] = [
  fighter('juggernaut', 'onoros', 'metal', 19, 45),
  fighter('hunter', 'human', 'nature', 6, 80),
  fighter('lunatic', 'lopati', 'air', 5, 340),
]

const AGE_DECAY = 0.999_97

const tile = (
  f: RosterFighter,
  over: Partial<Parameters<typeof PickCard>[0]> = {},
): string =>
  renderToStaticMarkup(
    <PickCard
      fighter={f}
      ageDecay={AGE_DECAY}
      levelMod={1.04}
      picked={false}
      density="compact"
      hoverStats={false}
      onClick={() => {}}
      onInspect={() => {}}
      {...over}
    />,
  )

const grid = (body: string) =>
  `<div class="fightergrid fightergrid--compact">${body}</div>`

const SECTIONS: { id: string; note: string; body: string }[] = [
  {
    id: 'roster',
    note: 'A roster as it is picked from — two in the team, one busy elsewhere',
    body: grid(
      ROSTER.map((f, i) =>
        tile(f, {
          picked: i === 0 || i === 10,
          tick: i === 0 || i === 10 ? 'In team' : undefined,
          blocked: i === 5 || i === 9,
          hint: i === 5 ? 'Busy in a dungeon' : undefined,
        }),
      ).join(''),
    ),
  },
  {
    id: 'full',
    note: 'The team is full — everything not already in it is blocked',
    body: grid(
      ROSTER.slice(0, 6)
        .map((f, i) =>
          tile(f, {
            picked: i < 2,
            tick: i < 2 ? 'In team' : undefined,
            blocked: i >= 2,
            hint: i >= 2 ? 'Your team is full' : undefined,
          }),
        )
        .join(''),
    ),
  },
  {
    id: 'ascension',
    note: 'Ascension: the longest words the tile has to carry',
    body: grid(
      [
        tile(ASCENSION[0], { picked: true, tick: 'Ascending' }),
        ...ASCENSION.slice(1).map((f) => tile(f, { picked: true, tick: 'Sacrifice' })),
        tile(ROSTER[6], { blocked: true, blockedNote: 'Covering another' }),
        tile(ROSTER[3], {}),
      ].join(''),
    ),
  },
]

const PHONE = grid(
  ROSTER.slice(0, 10)
    .map((f, i) =>
      tile(f, {
        picked: i === 0,
        tick: i === 0 ? 'In team' : undefined,
        blocked: i === 5,
        hint: i === 5 ? 'Busy in a dungeon' : undefined,
      }),
    )
    .join(''),
)

const out = process.argv[2] ?? '.ssr/pick.html'
const phoneOut = out.replace(/\.html$/, '-phone.html')

writeFileSync(
  phoneOut,
  live(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The picker tile — on a phone</title>
<style>${css}</style>
<style>body { margin: 0; padding: 10px; background: #070d18; }</style>
</head>
<body>${PHONE}</body>
</html>`),
)

writeFileSync(
  out,
  live(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>The picker tile — every state</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 24px; background: #070d18; }
  .pickcat { max-width: 1060px; margin: 0 auto; }
  .pickcat h1 { color: #ffdb7d; font-size: 1.6rem; margin: 0 0 20px; }
  .pickcat__note {
    margin: 28px 0 10px;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #7b8ba5;
  }
  /* Its own document, so the tile's phone rules actually fire. */
  .pickcat__frame {
    width: 375px;
    height: 430px;
    border: 1px solid rgb(148 163 184 / 20%);
    border-radius: 10px;
    background: #070d18;
  }
</style>
</head>
<body>
<div class="pickcat">
  <h1>The picker tile — every state</h1>
  ${SECTIONS.map((s) => `<p class="pickcat__note" id="${s.id}">${s.note}</p>${s.body}`).join('\n')}
  <p class="pickcat__note" id="phone">A phone: five across, and the corners gather onto one strip</p>
  <iframe class="pickcat__frame" src="${phoneOut.split(/[\\/]/).pop()}" title="The picker tile at phone width"></iframe>
</div>
</body>
</html>`),
)
console.log(`${SECTIONS.length + 1} sections -> ${out}`)
