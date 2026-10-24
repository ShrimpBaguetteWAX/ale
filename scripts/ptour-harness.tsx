/**
 * The phone Tournament, in every state, from fixtures — see
 * ptour-harness.html.
 *
 * The chain only ever shows one state at a time, and most of them last
 * minutes a week. This mounts `PhoneTournament` with a made-up tournament at
 * each step — signup, the draw being written, a round half fought, a round
 * not drawn yet, the results — so each can be looked at whenever.
 *
 *   ?state=before | signup | entered | drawing | draw | live | between |
 *          out | results | hof | big
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PhoneTournament } from '../src/tournament/PhoneTournament'
import { roundSizes, fightSlots, passesFrom, replay } from '../src/tournament/standings'
import { bracketOf, seedOrder, timelineOf, type TournamentPhase } from '../src/tournament/rules'
import type {
  TournamentHof,
  TournamentMatchup,
  TournamentPlanStep,
  TournamentSignup,
  TournamentStage,
} from '../src/tournament/types'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/tournament.css'
import '../src/styles/account.css'
import '../src/styles/dungeon.css'
import '../src/styles/battle.css'

const state = new URLSearchParams(location.search).get('state') ?? 'live'
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19)
const HOUR = 3_600_000

const TAGS = ['Shade', 'Vex', 'Nightjar', 'Orrery', 'Kestrel', 'Basalt', 'Quill', 'Mire', 'Harrow', 'Cinder', 'Lupine', 'Marrow']
const AVATARS = [303, 201, 602, 505, 404, 703, 205, 301, 402, 503, 604, 705]
const CREW = ['hunter:elgem:nature', 'juggernaut:khaured:metal', 'arcanist:human:gem', 'explosioneer:robotron:fire', 'mindblade:altan:air']
const ME = 'kestrel.wam'

function fieldOf(n: number): TournamentSignup[] {
  return Array.from({ length: n }, (_, i) => ({
    wallet: i === 4 ? ME : `p${i}.wam`,
    playertag: TAGS[i % TAGS.length] + (i >= TAGS.length ? ` ${Math.floor(i / TAGS.length) + 1}` : ''),
    avatar: AVATARS[i % AVATARS.length],
    fighter_ids: [1, 2, 3, 4, 5],
    fighter_class_race_element: CREW,
    crew_asset_id: 0,
    arms_asset_id: 0,
    score: 320 - i * 7,
    battles_won: 0,
    reward_points: 0,
    signup_timestamp: stamp(Date.parse('2026-10-21T12:00:00Z') + i * 60_000),
    first_round_free_pass: false,
  }))
}

/* Now is fixed per state, so the countdowns read the same every time. */
const BATTLE_AT =
  Date.now() +
  ({ signup: 26, entered: 26, drawing: 1.5, draw: 1.2, results: -13, before: -40, hof: -40 }[state] ?? -6.5) * HOUR
const PLAN_START = BATTLE_AT - (172800 + 288000 + 600 + 6600) * 1000

function plan(): TournamentPlanStep[] {
  const steps: [string, number][] = [
    ['set_weather', 0],
    ['get_rewards', 172800],
    ['signup', 288000],
    ['close_signup', 600],
    ['create_matchups', 6600],
    ['battle', 43200],
    ['hall_of_fame', 0],
    ['reward_payout', 0],
    ['cleanup', 0],
  ]
  let at = PLAN_START
  return steps.map(([step_name, dur], index) => {
    const s = { index, time_start: stamp(at), duration_sec: dur, step_name, task_current: 0, task_total: 0, completed: false }
    at += dur * 1000
    return s
  })
}

function stage(over: Partial<TournamentStage>): TournamentStage {
  return {
    tournament_name: '......3eup.q',
    stage_index: 5,
    stage_name: 'battle',
    weather_effects: [],
    tournament_screen: '',
    allow_player_signup: false,
    allow_player_cancellation: false,
    tlm_rewards: '1840.0000 TLM',
    wax_rewards: '2195.07044119 WAX',
    player_count: 12,
    rounds: 4,
    free_passes: 4,
    score_id_lookup_min: '0',
    score_id_lookup_max: '0',
    battles_preliminary_round: 4,
    players_first_ko_round: 8,
    current_round: 0,
    matchups_created: 0,
    battles_in_round: 4,
    current_battle: 0,
    round_complete: false,
    ...over,
  } as TournamentStage
}

/**
 * Plays the bracket out, seed against seed, the favourite winning except
 * where `upset` says otherwise, up to `fought` fights in all.
 */
function playOut(field: TournamentSignup[], fought: number, upset: (r: number, i: number) => boolean) {
  const seeded = seedOrder(field)
  const b = bracketOf(field.length)
  const sizes = roundSizes(field.length)
  const slots = fightSlots(field.length, BATTLE_AT, 43200)
  const rounds: TournamentMatchup[][] = []
  let alive = seeded.slice(b.freePasses)
  let through = seeded.slice(0, b.freePasses)
  let k = 0
  for (let r = 0; r < sizes.length; r++) {
    const pool = r === 0 ? alive : seedOrder([...through])
    if (r > 0) through = []
    if (k >= fought && r > 0) break
    const round: TournamentMatchup[] = []
    for (let i = 0; i < sizes[r]; i++) {
      const a = pool[i]
      const c = pool[pool.length - 1 - i]
      const done = k < fought
      const second = upset(r, i)
      round.push({
        index: i,
        matchup_seed: 1000 + k,
        wallet_player1: a.wallet,
        wallet_player2: c.wallet,
        gamertag_player1: a.playertag,
        gamertag_player2: c.playertag,
        avatar_player1: a.avatar,
        avatar_player2: c.avatar,
        fighter_ids_player1: a.fighter_ids,
        fighter_ids_player2: c.fighter_ids,
        crew_template_id_player1: 0,
        crew_template_id_player2: 0,
        arms_template_id_player1: 0,
        arms_template_id_player2: 0,
        play_time: stamp(slots[r][i]),
        winner: done ? (second ? 'player2' : 'player1') : '',
      })
      if (done) through.push(second ? c : a)
      k++
    }
    rounds.push(round)
    alive = []
  }
  return rounds
}

const WEATHER = [
  { planet: 'kavian', weather: { weather_id: 'solarflare', displayname: '-25% mystic health', title: 'Solar Flare', affected_class: ['mystic'], affected_element: [], affected_race: [], weather_effects: [{ statname: 'health', percent_change: -25, flat_change: 0 }] } },
  { planet: 'neri', weather: { weather_id: 'ashfall', displayname: '+15 gem resistance', title: 'Ashfall', affected_class: [], affected_element: [], affected_race: [], weather_effects: [{ statname: 'res_gem', percent_change: 0, flat_change: 150 }] } },
] as never as { planet: string; weather?: never }[]

const HOF: TournamentHof[] = [
  ['2026-10-31T22:00:00', 'Nightjar', 'Shade', 'Vex', 'Orrery'],
  ['2026-10-24T22:00:00', 'Shade', 'Kestrel', 'Vex', 'Quill'],
  ['2026-10-17T22:00:00', 'Vex', 'Shade', 'Nightjar', 'Harrow'],
].flatMap(([date, ...four], t) =>
  four.map((tag, i) => ({
    index: t * 4 + i,
    tournament_date: date,
    tournament_name: `t${t}`,
    rank: Math.min(3, i + 1),
    wallet: tag === 'Kestrel' ? ME : `${tag.toLowerCase()}.wam`,
    gamertag: tag,
    avatar: AVATARS[TAGS.indexOf(tag)],
  })),
)

function Harness() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const big = state === 'big'
  const field = fieldOf(big ? 70 : 12)
  const seeded = seedOrder(field)
  const sizes = roundSizes(field.length)
  const total = sizes.reduce((a, b) => a + b, 0)
  /* Cinder beats Quill in the opening round, Nightjar beats Vex in the semis; Kestrel, seed 5, goes out to Orrery in the quarter-finals. */
  const upset = (r: number, i: number) => (r === 0 && i === 2) || (r === 2 && i === 1)
  let phase: TournamentPhase = 'battle'
  let history: TournamentMatchup[][] = []
  let st = stage({})
  let mine: TournamentSignup | undefined = field[4]
  let alive = field
  const cut = (n: number) => (history = playOut(field, n, upset))

  switch (state) {
    case 'before':
    case 'hof':
      phase = 'none'
      break
    case 'signup':
      phase = 'signup'
      mine = undefined
      st = stage({ stage_index: 2, stage_name: 'signup', allow_player_signup: true, rounds: 0, free_passes: 0, player_count: 11 })
      alive = field.filter((s) => s.wallet !== ME)
      break
    case 'entered':
      phase = 'signup'
      st = stage({ stage_index: 2, stage_name: 'signup', allow_player_signup: true, rounds: 0, free_passes: 0 })
      break
    case 'drawing':
      phase = 'creation'
      st = stage({ stage_index: 4, stage_name: 'create_matchups', matchups_created: 2 })
      history = [playOut(field, 0, upset)[0].slice(0, 2)]
      break
    case 'draw':
      phase = 'creation'
      st = stage({ stage_index: 4, stage_name: 'create_matchups', matchups_created: 4 })
      history = [playOut(field, 0, upset)[0]]
      break
    case 'live':
      cut(sizes[0] + 2)
      st = stage({ current_round: 1, current_battle: 2 })
      break
    case 'between':
      /* The quarter-finals are over and the semi-finals are not drawn yet. */
      cut(sizes[0] + sizes[1])
      history = [...history.slice(0, 2), []]
      st = stage({ current_round: 2, current_battle: 0, battles_in_round: 2 })
      break
    case 'out':
      cut(sizes[0] + sizes[1] + 1)
      st = stage({ current_round: 2, current_battle: 1, battles_in_round: 2 })
      break
    case 'results':
      cut(total)
      phase = 'finish'
      st = stage({ current_round: 4 })
      break
    case 'big':
      cut(sizes[0] + sizes[1] + sizes[2] + 5)
      st = stage({ player_count: 70, rounds: sizes.length, free_passes: bracketOf(70).freePasses, current_round: 3, current_battle: 5, battles_in_round: sizes[3] })
      break
  }

  /* Signup rows of everyone still in, with the chain's points on them. */
  if (history.length && phase !== 'creation') {
    const lost = new Set(
      history.flat().filter((m) => m.winner).map((m) => (m.winner === 'player1' ? m.wallet_player2 : m.wallet_player1)),
    )
    /* With the points the chain would have written on them. */
    const passes = seeded
      .slice(0, bracketOf(field.length).freePasses)
      .map((s) => ({ wallet: s.wallet, tag: s.playertag, avatar: s.avatar }))
    const runs = replay(history, passesFrom(history, passes), sizes)
    alive = field
      .filter((s) => !lost.has(s.wallet))
      .map((s) => ({ ...s, reward_points: runs.get(s.wallet)?.points ?? 0 }))
    if (lost.has(ME)) mine = undefined
    else if (mine) mine = alive.find((s) => s.wallet === ME)
  }

  const p = plan()
  const timeline = timelineOf(p, now, phase === 'none' ? undefined : Number(st.stage_index))
  const past =
    phase === 'none' && state === 'before'
      ? { stage: stage({ current_round: 4 }), history: playOut(field, total, upset), rolls: WEATHER.map((w) => w.weather!) }
      : null

  return (
    <div className="main__inner" style={{ padding: '12px 12px 90px' }}>
      <PhoneTournament
        phase={phase}
        stage={phase === 'none' ? undefined : st}
        now={now}
        timeline={phase === 'none' ? [] : timeline}
        signupAt={now + 28 * HOUR + 12 * 60_000}
        field={seedOrder(alive)}
        mine={mine}
        wallet={ME}
        history={history}
        payouts={[]}
        hof={state === 'hof' || state === 'before' ? HOF : []}
        weather={WEATHER}
        rolls={WEATHER.map((w) => w.weather!)}
        legend={new Map([['p10.wam', false], ['p11.wam', false]])}
        past={past}
        ringFighters={[
          { fighter_id: 1, classname: 'juggernaut', racename: 'khaured' },
          { fighter_id: 2, classname: 'arcanist', racename: 'altan' },
          { fighter_id: 3, classname: 'astralknight', racename: 'lopati' },
          { fighter_id: 4, classname: 'desperado', racename: 'human' },
          { fighter_id: 5, classname: 'mindblade', racename: 'altan' },
        ]}
        team={[null, null, null, null, null]}
        crew={null}
        weapon={null}
        score={0}
        energyCost={100}
        block={{ ready: false, reason: 'Pick 5 more fighters' }}
        busy={false}
        canSign={false}
        onEnter={() => {}}
        onPick={() => {}}
        picker={null}
        pickerOpen={false}
        onClosePicker={() => {}}
        viewingPast={false}
        onOpenPast={past ? () => {} : undefined}
      />
      {state === 'hof' && <HofOpener />}
      <span hidden>{seeded.length}</span>
    </div>
  )
}

/* Opens the Hall of Fame on load, the way the header button does. */
function HofOpener() {
  useEffect(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Hall of Fame'))
    b?.click()
  }, [])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
