/**
 * Every state the Tournament screen can be in, on one page.
 *
 *   npm run build
 *   npx vite build --ssr scripts/ssr-tournament.tsx --outDir .ssr
 *   node .ssr/ssr-tournament.js [out.html]
 *
 * The screen follows the contract: `curstage.tournament_screen` names one of
 * five panels, and a sixth state — no tournament at all — is what a player
 * sees for most of the day. They are mutually exclusive by definition, so
 * none of them can be looked at from the live game without waiting out a
 * whole tournament, and the one that matters most (entry open) lasts ten
 * minutes.
 *
 * So each is rendered here from the screen's own exported panels against the
 * last build's stylesheet, on the real stage template read off `tournmnt.ale`
 * on 2026-09-27. A panel that reads badly here reads badly in the game.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import {
  Battle,
  DayStrip,
  EntryActions,
  EntryPanel,
  Field,
  Finish,
  MyEntry,
  NoTournament,
  Preparing,
  PrizeBar,
  NftSlot,
  TeamRow,
  TournamentHead,
} from '../src/routes/Tournament'
import { bracketOf, seedOrder, timelineOf } from '../src/tournament/rules'
import type {
  TournamentMatchup,
  TournamentPlanStep,
  TournamentSignup,
  TournamentStage,
  TournamentStageTemplate,
} from '../src/tournament/types'

const ORIGIN = 'https://new.alienlegends.io'
const NOW = Date.parse('2026-09-27T13:00:50Z')
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19)

/* The stage template exactly as `tournmnt.ale` holds it. */
const TEMPLATE: TournamentStageTemplate[] = [
  ['set_weather', 0, 0, 'preparing', false],
  ['get_rewards', 0, 0, 'preparing', false],
  ['signup', 0, 600, 'signup', true],
  ['close_signup', 0, 600, 'creation', false],
  ['create_matchups', 0, 600, 'creation', false],
  ['battle', 0, 2400, 'battle', false],
  ['cleanup', 600, 0, 'finish', false],
].map(([step_name, delay_sec, duration_sec, tournament_screen, allow_player_signup], i) => ({
  index: (i + 1) * 1000,
  delay_sec: delay_sec as number,
  duration_sec: duration_sec as number,
  step_name: step_name as string,
  task_current: 0,
  task_total: 0,
  tournament_screen: tournament_screen as string,
  allow_player_signup: allow_player_signup as boolean,
  allow_player_cancellation: allow_player_signup as boolean,
}))

/**
 * The schedule those durations become once a tournament starts.
 *
 * Built for a given moment rather than once, because `completed` is the
 * chain marking its own work done — a step whose window has passed but which
 * the chain has not ticked off is still the current one, and a fixture that
 * baked the flags at one time would show two steps running at another.
 */
const planAt = (moment: number): TournamentPlanStep[] => {
  let at = Date.parse('2026-09-27T12:54:04Z')
  return TEMPLATE.map((s) => {
    at += s.delay_sec * 1000
    const step: TournamentPlanStep = {
      index: s.index,
      time_start: stamp(at),
      duration_sec: s.duration_sec,
      step_name: s.step_name,
      task_current: 0,
      task_total: 0,
      completed: at + s.duration_sec * 1000 <= moment,
    }
    at += s.duration_sec * 1000
    return step
  })
}

const stage = (over: Partial<TournamentStage> = {}): TournamentStage =>
  ({
    /* `name(1790000044)` — the second the tournament started. */
    tournament_name: '.....2fbjyq',
    stage_index: 3000,
    stage_name: 'signup',
    weather_effects: [
      { planet: 'kavian', weather_id: 'solarflare' },
      { planet: 'neri', weather_id: 'ashfall' },
      { planet: 'veles', weather_id: 'stillair' },
    ],
    tournament_screen: 'signup',
    allow_player_signup: true,
    allow_player_cancellation: true,
    tlm_rewards: '18400.0000 TLM',
    wax_rewards: '0.00000000 WAX',
    player_count: 23,
    rounds: 0,
    free_passes: 0,
    score_id_lookup_min: '0',
    score_id_lookup_max: '0',
    battles_preliminary_round: 0,
    players_first_ko_round: 0,
    current_round: 0,
    matchups_created: 0,
    battles_in_round: 0,
    current_battle: 0,
    round_complete: false,
    ...over,
  }) as TournamentStage

const TAGS = [
  'Shade', 'Vex', 'Nightjar', 'Orrery', 'Kestrel', 'Basalt', 'Quill', 'Mire',
  'Harrow', 'Cinder', 'Lupine', 'Sable', 'Tessellate', 'Onyx', 'Wren', 'Grit',
  'Pallas', 'Rook', 'Vantablack', 'Ember', 'Tally', 'Shrike', 'Marrow',
]

/* Twenty-three entrants: a ragged field, which is the interesting one — a
   power of two would hand out no free passes at all. */
/*
   The five an entrant brought, exactly as `signup` writes them down.

   The field row draws its strip of faces straight off this string, so a
   fixture without it shows the one thing the row cannot be in the game: an
   entrant who brought nobody. Stepping by two through an odd-length pool
   gives each entrant five different fighters and each entrant a different
   five.
*/
const CREW_POOL = [
  'hunter:elgem:nature',
  'juggernaut:khaured:metal',
  'arcanist:human:gem',
  'explosioneer:robotron:fire',
  'mindblade:altan:air',
  'mystic:elgem:gem',
  'desperado:human:metal',
  'lunatic:lopati:nature',
  'astralknight:onoros:fire',
]
const crewOf = (i: number) =>
  Array.from({ length: 5 }, (_, n) => CREW_POOL[(i * 4 + n * 2) % CREW_POOL.length])

const FIELD: TournamentSignup[] = TAGS.map((playertag, i) => ({
  wallet: i === 0 ? 'me.wam' : `player${i}.wam`,
  playertag,
  /* Real avatar ids start at 1000; 1..12 render as broken images. */
  avatar: 1000 + (i % 12),
  fighter_ids: [1, 2, 3, 4, 5],
  fighter_class_race_element: crewOf(i),
  crew_asset_id: 0,
  arms_asset_id: 0,
  score: 96 - i * 3 - (i % 4),
  battles_won: 0,
  reward_points: 0,
  signup_timestamp: stamp(Date.parse('2026-09-27T12:55:00Z') + i * 9000),
  first_round_free_pass: false,
}))

const mine = FIELD[0]
const played = (won: number, points: number): TournamentSignup => ({
  ...mine,
  battles_won: won,
  reward_points: points,
})

const PAIRINGS: TournamentMatchup[] = [
  {
    index: 1,
    matchup_seed: 88,
    wallet_player1: 'me.wam',
    wallet_player2: 'player7.wam',
    gamertag_player1: 'Shade',
    gamertag_player2: 'Quill',
    avatar_player1: 1000,
    avatar_player2: 1008,
    fighter_ids_player1: [1, 2, 3, 4, 5],
    fighter_ids_player2: [6, 7, 8, 9, 10],
    crew_asset_id_player1: 0,
    crew_asset_id_player2: 0,
    arms_asset_id_player1: 0,
    arms_asset_id_player2: 0,
    winner: 'me.wam',
  },
  {
    index: 2,
    matchup_seed: 91,
    wallet_player1: 'player3.wam',
    wallet_player2: 'me.wam',
    gamertag_player1: 'Orrery',
    gamertag_player2: 'Shade',
    avatar_player1: 1004,
    avatar_player2: 1000,
    fighter_ids_player1: [11, 12, 13, 14, 15],
    fighter_ids_player2: [1, 2, 3, 4, 5],
    crew_asset_id_player1: 0,
    crew_asset_id_player2: 0,
    arms_asset_id_player1: 0,
    arms_asset_id_player2: 0,
    winner: '',
  },
]

/*
   Real class/race pairs, so the portraits resolve to shipped art.

   Order is not decoration: `gateCrowd` keeps the roster's 2nd–4th and
   hands the two ends to the first unused classes after the fifth, so it is
   entries six and seven that stand on the outside of the picture.
*/
const RING = [
  ['arcanist', 'altan'],
  ['arcanist', 'robotron'],
  ['astralknight', 'lopati'],
  ['desperado', 'human'],
  ['explosioneer', 'elgem'],
  ['explosioneer', 'robotron'],
  ['voidwarden', 'onoros'],
  ['hunter', 'human'],
  ['juggernaut', 'khaured'],
  ['lunatic', 'khaured'],
  ['mindblade', 'altan'],
  ['mindblade', 'lopati'],
  ['mystic', 'elgem'],
].map(([classname, racename], i) => ({ fighter_id: i + 1, classname, racename }))

/*
   A line-up part way through being picked.

   The row was drawn empty here, which is the one shape the signup screen
   almost never has — a player who has picked nothing cannot enter — and it
   is the shape with nothing to show: the pair a picked place offers,
   details over remove, needs a fighter under it. Four picked and one still
   open puts both halves of the row on the page at once.
*/
const PICKED = [
  ['hunter', 'elgem', 'nature', 14],
  ['juggernaut', 'khaured', 'metal', 11],
  ['arcanist', 'human', 'gem', 16],
  ['explosioneer', 'robotron', 'fire', 9],
].map(([classname, racename, element, level], i) => ({
  fighter_id: 900 + i,
  classname,
  racename,
  element,
  marker: '',
  creation_date: '2025-04-02T00:00:00',
  stats: {
    level,
    health_min: 380,
    health_max: 620,
    damage_min: 88,
    damage_max: 142,
  },
}))

/* Three rolls, as `battle.ale` hands them back. */
const WEATHER = [
  {
    planet: 'kavian',
    weather: {
      weather_id: 'solarflare',
      displayname: '-25% mystic health',
      title: 'Solar Flare',
      affected_class: ['mystic'],
      affected_element: [],
      affected_race: [],
      weather_effects: [{ statname: 'health', percent_change: -25, flat_change: 0 }],
    },
  },
  {
    planet: 'neri',
    weather: {
      weather_id: 'ashfall',
      displayname: '+15 gem resistance',
      title: 'Ashfall',
      affected_class: [],
      affected_element: [],
      affected_race: [],
      weather_effects: [{ statname: 'res_gem', percent_change: 0, flat_change: 150 }],
    },
  },
  {
    planet: 'veles',
    weather: {
      weather_id: 'stillair',
      displayname: 'calm',
      title: 'Still Air',
      affected_class: [],
      affected_element: [],
      affected_race: [],
      weather_effects: [],
    },
  },
]

const css = (() => {
  const dir = 'docs/assets'
  const file = readdirSync(dir).find((f) => /^index-.*\.css$/.test(f))
  if (!file) throw new Error('No built stylesheet — run `npm run build` first.')
  return readFileSync(`${dir}/${file}`, 'utf8')
})()

const draw = (node: ReactElement) =>
  renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

const closed = stage({
  tournament_screen: 'creation',
  stage_index: 4000,
  allow_player_signup: false,
  allow_player_cancellation: false,
  free_passes: bracketOf(23).freePasses,
  rounds: bracketOf(23).rounds,
})

const fighting = stage({
  tournament_screen: 'battle',
  stage_index: 6000,
  allow_player_signup: false,
  allow_player_cancellation: false,
  free_passes: bracketOf(23).freePasses,
  rounds: bracketOf(23).rounds,
  current_round: 1,
  battles_in_round: 8,
  current_battle: 3,
})

const seeded = seedOrder(FIELD)

/**
 * Each state, with a note saying what put the screen there.
 *
 * The note is the harness talking, not the game — a player never sees a
 * label like this, which is exactly why it is worth having here: six panels
 * on one page are otherwise hard to tell apart at a glance.
 */
const STATES: { id: string; note: string; body: string }[] = [
  {
    id: 'none',
    note: 'No row in <code>curstage</code> — the usual state, most of the day',
    /* No title over the gates: see the screen's own `waiting` branch. */
    body: draw(
        <NoTournament
          nextStart={Date.parse('2026-09-28T12:54:04Z')}
          now={NOW}
          everySec={86_400}
          fighters={RING}
        />,
      ),
  },
  {
    id: 'preparing',
    note: '<code>set_weather</code> / <code>get_rewards</code> — screen <code>preparing</code>',
    body:
      /* Nothing but the doors: see the screen's own `preparing` branch. */
      draw(<Preparing fighters={RING} />),
  },
  {
    id: 'signup',
    note: '<code>signup</code> — the only ten minutes a player can do anything',
    body:
      draw(<TournamentHead />) +
      draw(<PrizeBar stage={stage()} weather={WEATHER} />) +
      '<div class="tour__band">' +
      draw(<DayStrip timeline={timelineOf(planAt(NOW), NOW)} now={NOW} />) +
      draw(
        <EntryActions
          score={247}
          energyCost={10}
          block={{ ready: false, reason: 'Pick 5 more fighters' }}
          busy={false}
          canSign
          onEnter={() => {}}
        />,
      ) +
      '</div>' +
      draw(
        <EntryPanel
          team={
            <TeamRow
              team={[...PICKED, null] as never}
              levelMod={1}
              ageDecay={1}
              onInspect={() => {}}
              onRemove={() => {}}
              onEmpty={() => {}}
              sixth={
                <NftSlot
                  crew={{ template_id: 260678, name: 'Crimson Vanguard', img: '' } as never}
                  weapon={{ template_id: 260676, name: 'Void Lance', img: '' } as never}
                  values={new Map()}
                  onOpenCard={() => {}}
                  onClearCrew={() => {}}
                  onClearWeapon={() => {}}
                  onPick={() => {}}
                  onOpen={() => {}}
                />
              }
            />
          }
        />,
      ) +
      draw(
        <Field
          field={seeded}
          mineWallet={null}
          entryOpen
          freePasses={0}
          degenerate={false}
        />,
      ),
  },
  {
    id: 'creation',
    note: '<code>close_signup</code> / <code>create_matchups</code> — screen <code>creation</code>, 23 entered',
    body:
      `<div class="tour__top">` + draw(<TournamentHead />) + draw(<PrizeBar stage={closed} weather={WEATHER} />) + `</div>` +
      '<div class="tour__band">' + draw(<DayStrip timeline={timelineOf(planAt(Date.parse('2026-09-27T13:12:00Z')), Date.parse('2026-09-27T13:12:00Z'))} now={Date.parse('2026-09-27T13:12:00Z')} />) + '</div>' +
      draw(<MyEntry mine={mine} seeding={{ rank: 1, total: 23, freePass: true }} bracket={bracketOf(23)} />) +
      draw(
        <Field
          field={seeded}
          mineWallet="me.wam"
          entryOpen={false}
          freePasses={bracketOf(23).freePasses}
          degenerate={false}
        />,
      ),
  },
  {
    id: 'battle',
    note: '<code>battle</code> — one pairing won, one still being fought',
    body:
      `<div class="tour__top">` + draw(<TournamentHead />) + draw(<PrizeBar stage={fighting} weather={WEATHER} />) + `</div>` +
      '<div class="tour__band">' + draw(<DayStrip timeline={timelineOf(planAt(Date.parse('2026-09-27T13:30:00Z')), Date.parse('2026-09-27T13:30:00Z'))} now={Date.parse('2026-09-27T13:30:00Z')} />) + '</div>' +
      draw(
        <Battle
          stage={fighting}
          bracket={bracketOf(23)}
          pairings={PAIRINGS}
          mineWallet="me.wam"
          entered
        />,
      ) +
      draw(
        <MyEntry
          mine={played(2, 20)}
          seeding={{ rank: 1, total: 23, freePass: true }}
          bracket={bracketOf(23)}
        />,
      ),
  },
  {
    id: 'finish',
    note: '<code>cleanup</code> — screen <code>finish</code>',
    body:
      draw(<TournamentHead />) +
      draw(
        <Finish
          mine={played(4, 40)}
          payout={{ wallet: 'me.wam', reward_points: 40 }}
          nextStart={Date.parse('2026-09-28T12:54:04Z')}
          now={Date.parse('2026-09-27T14:20:00Z')}
        />,
      ) +
      draw(
        <Field
          field={seeded.map((s, i) => ({ ...s, battles_won: Math.max(0, 5 - i) }))}
          mineWallet="me.wam"
          entryOpen={false}
          freePasses={bracketOf(23).freePasses}
          degenerate={false}
        />,
      ),
  },
  {
    id: 'empty',
    note: 'Nobody entered — the contract underflows its own free-pass count here',
    body:
      draw(<TournamentHead />) +
      '<p class="faint">(the bracket panel was removed)</p>',
  },
]

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tournament — every state</title>
<style>${css}</style>
<style>
  body { background: var(--bg); }
  .tourcat { max-width: 1428px; margin: 0 auto; padding: 24px 16px 64px; }
  .tourcat__lead { color: var(--text-dim); max-width: 70ch; }
  .tourcat__state { margin-top: 36px; border-top: 1px solid rgba(148,163,184,0.2); }
  /* The gates are fixed to the viewport in the game; here each state needs
     to keep its own, so the section becomes the containing block. */
  .tourcat__state { transform: translateZ(0); position: relative; min-height: 120px; overflow: hidden; }
  .tourcat__state .gates { position: absolute; inset: 0; }
  /* Room to read like the screen it fills in the game. */
  .tourcat__state:has(.gates) { min-height: 68vh; }
  .tourcat__meta {
    margin: 10px 0 0;
    font-size: 11px;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .tourcat__meta code { color: var(--cyan); font-family: ui-monospace, monospace; text-transform: none; }
</style>
<div class="tourcat">
      <h1>Tournament — every state</h1>
      <p class="tourcat__lead">
        The six panels the contract can ask for, rendered by the screen's own
        components against the last build's stylesheet. A player sees exactly one
        of them at a time, and which one is decided by
        <code>curstage.tournament_screen</code>.
      </p>
      ${STATES.map(
        (s) => `<section class="tourcat__state" id="${s.id}">
        <p class="tourcat__meta">${s.id} — ${s.note}</p>
        ${s.body}
      </section>`,
      ).join('\n')}
</div>
`

const out = process.argv[2] ?? 'docs/__preview-tournament.html'
writeFileSync(
  out,
  html
    .replaceAll('src="./assets/', `src="${ORIGIN}/assets/`)
    .replaceAll('src="/assets/', `src="${ORIGIN}/assets/`),
)
console.log(`${STATES.length} states -> ${out}`)
