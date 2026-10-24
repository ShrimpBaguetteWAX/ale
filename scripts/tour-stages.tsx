/**
 * The current tournament, at any moment you pick — see tour-stages.html.
 *
 * Reads the tournament on `curstage` as it really is — its schedule, its
 * players, every fight drawn so far — and then pretends: pick a moment and
 * the chain is wound back to it. Fights after it have no winner, rounds
 * not yet due are not drawn, points are what the fights so far would have
 * given, and the phone screen is drawn from that.
 *
 * A fight the chain has not fought yet can still be "played" here: pick
 * who takes it, and every moment after it follows on.
 */
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useGame } from '../src/state/useGame'
import { useConfig, useConfigStore } from '../src/state/useConfig'
import type { CardTemplate } from '../src/chain/atomic'
import { fetchCrewCards, fetchRoster } from '../src/dungeon/queries'
import { TEAM_SIZE, type RosterFighter } from '../src/dungeon/types'
import type { Tab } from '../src/fight/setup'
import { PickerSheet } from '../src/fight/PickerSheet'
import { fetchPlayersPage } from '../src/chain/queries'
import { fetchWeatherRow, type Weather } from '../src/fight/weather'
import {
  fetchFightersByIds,
  fetchLiveTournaments,
  fetchTournamentMatchups,
  fetchTournamentPlan,
  fetchTournamentSignups,
} from '../src/tournament/queries'
import { bracketOf, chainTime, seedOrder, startedAt, teamScore, timelineOf, winnerSide, type TournamentPhase } from '../src/tournament/rules'
import { fightName, fightSlots, passesFrom, payoutOrder, replay, roundName, roundSizes } from '../src/tournament/standings'
import { PhoneTournament } from '../src/tournament/PhoneTournament'
import type {
  TournamentHof,
  TournamentMatchup,
  TournamentPayout,
  TournamentPlanStep,
  TournamentSignup,
  TournamentStage,
} from '../src/tournament/types'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/landing.css'
import '../src/styles/map.css'
import '../src/styles/tavern.css'
import '../src/styles/shop.css'
import '../src/styles/market.css'
import '../src/styles/fighters.css'
import '../src/styles/quests.css'
import '../src/styles/tournament.css'
import '../src/styles/lands.css'
import '../src/styles/farming.css'
import '../src/styles/leaderboard.css'
import '../src/styles/candle.css'
import '../src/styles/account.css'
import '../src/styles/dungeon.css'
import '../src/styles/battle.css'
import '../src/styles/maintenance.css'
import '../src/styles/briefing.css'

const MIN = 60_000
const HOUR = 60 * MIN
const VISITOR = 'visitor.wam'

interface Loaded {
  stage: TournamentStage
  plan: TournamentPlanStep[]
  rounds: TournamentMatchup[][]
  signups: TournamentSignup[]
  weather: { planet: string; weather?: Weather }[]
  /** Every entrant, best seed first, as a signup row. */
  field: TournamentSignup[]
}

async function load(): Promise<Loaded> {
  const live = await fetchLiveTournaments(true)
  if (!live.length) throw new Error('No tournament on curstage right now.')
  const stage = [...live].sort(
    (a, b) => (startedAt(b.tournament_name) ?? 0) - (startedAt(a.tournament_name) ?? 0),
  )[0]
  const name = stage.tournament_name
  const [plan, signups, weather] = await Promise.all([
    fetchTournamentPlan(name, true),
    fetchTournamentSignups(name, true),
    Promise.all(
      (stage.weather_effects ?? []).map(async (w) => ({
        planet: w.planet,
        weather: await fetchWeatherRow(w.planet, w.weather_id),
      })),
    ),
  ])
  const rounds = await Promise.all(
    Array.from({ length: Number(stage.rounds ?? 0) }, (_, r) => fetchTournamentMatchups(name, r, true)),
  )

  /*
     The whole field, rebuilt.

     Everyone who has gone out has had their signup row erased, so the field
     is put back together from the fights: the seed order falls out of how
     the rounds were paired (best against worst), the score is the real one
     where the row survives, and the five fighters are read back by id so
     the team squares have faces.
  */
  const order = (round: TournamentMatchup[]) => {
    const sorted = [...round].sort((a, b) => a.index - b.index)
    const one = sorted.map((m) => m.wallet_player1)
    const two = sorted.map((m) => m.wallet_player2).reverse()
    return [...one, ...two].filter(Boolean)
  }
  const passes = passesFrom(rounds, []).map((e) => e.wallet)
  const ko = rounds[1]?.length ? order(rounds[1]) : []
  const seeds = [...ko.filter((w) => passes.includes(w)), ...order(rounds[0] ?? [])]
  const fights = rounds.flat()
  const sideOf = (w: string) => {
    const m = fights.find((x) => x.wallet_player1 === w || x.wallet_player2 === w)!
    const one = m.wallet_player1 === w
    return {
      tag: one ? m.gamertag_player1 : m.gamertag_player2,
      avatar: one ? m.avatar_player1 : m.avatar_player2,
      ids: one ? m.fighter_ids_player1 : m.fighter_ids_player2,
    }
  }
  const signupStart = chainTime(plan.find((s) => s.step_name === 'signup')?.time_start)
  const field = await Promise.all(
    seeds.map(async (wallet, i) => {
      const row = signups.find((s) => s.wallet === wallet)
      if (row) return row
      const side = sideOf(wallet)
      const fighters = await fetchFightersByIds(side.ids ?? [])
      return {
        wallet,
        playertag: side.tag,
        avatar: side.avatar,
        fighter_ids: side.ids ?? [],
        fighter_class_race_element: fighters.map((f) => `${f.classname}:${f.racename}:${f.element}`),
        crew_asset_id: 0,
        arms_asset_id: 0,
        /* Not on chain any more: a stand-in that keeps the seed order. */
        score: 100 - i,
        battles_won: 0,
        reward_points: 0,
        signup_timestamp: new Date(signupStart + (i + 1) * 3 * HOUR).toISOString().slice(0, 19),
        first_round_free_pass: false,
      } as TournamentSignup
    }),
  )
  return { stage, plan, rounds, signups, weather, field }
}

/* ---------- a made-up tournament of any size ---------- */

const NAMES = ['Vex', 'Nightjar', 'Orrery', 'Kestrel', 'Basalt', 'Quill', 'Mire', 'Harrow', 'Cinder', 'Lupine', 'Marrow', 'Sable', 'Tessellate', 'Onyx', 'Wren', 'Grit', 'Pallas', 'Rook', 'Vantablack', 'Ember', 'Tally', 'Shrike', 'Juniper', 'Corvid', 'Halcyon', 'Thistle', 'Ferrous', 'Lumen', 'Quasar', 'Sorrel', 'Brine', 'Talon']
const AVATARS = [201, 202, 203, 204, 205, 301, 302, 303, 304, 305, 401, 402, 403, 404, 405, 501, 502, 503, 504, 505, 601, 602, 603, 604, 605, 701, 702, 703, 704, 705]
const CREWS = ['hunter:elgem:nature', 'juggernaut:khaured:metal', 'arcanist:human:gem', 'explosioneer:robotron:fire', 'mindblade:altan:air', 'mystic:elgem:gem', 'desperado:human:metal', 'lunatic:lopati:nature', 'astralknight:onoros:fire']
export const FAKE_SIZES = [8, 16, 23, 32, 64, 130]

/** The same numbers every time for the same size: a seeded coin. */
function coin(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A whole tournament of `n` players, made up and played out.
 *
 * Shaped exactly as the contract shapes one — the same schedule, the same
 * seeding, best against worst, the top seeds through the opening round on a
 * free pass — with the favourite taking about two fights in three. Its
 * fighting started a few hours ago, so the explorer opens mid-tournament.
 */
function fake(n: number, weather: Loaded['weather']): Loaded {
  const rand = coin(n * 7919)
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
  const battleAt = Math.floor((Date.now() - 4 * HOUR) / MIN) * MIN
  let t = battleAt - (172800 + 288000 + 600 + 6600) * 1000
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19)
  const plan: TournamentPlanStep[] = steps.map(([step_name, dur], index) => {
    const s = { index, time_start: iso(t), duration_sec: dur, step_name, task_current: 0, task_total: 0, completed: false }
    t += dur * 1000
    return s
  })

  const field: TournamentSignup[] = Array.from({ length: n }, (_, i) => ({
    wallet: `fake${i + 1}.wam`,
    playertag: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ''),
    avatar: AVATARS[(i * 7) % AVATARS.length],
    fighter_ids: [1, 2, 3, 4, 5],
    fighter_class_race_element: Array.from({ length: 5 }, (_, k) => CREWS[(i * 4 + k * 2) % CREWS.length]),
    crew_asset_id: 0,
    arms_asset_id: 0,
    score: 400 - i * 3 - Math.floor(rand() * 3),
    battles_won: 0,
    reward_points: 0,
    signup_timestamp: iso(chainTime(plan[2].time_start) + (i + 1) * 20 * MIN),
    first_round_free_pass: false,
  }))
  const seeded = seedOrder(field)
  const b = bracketOf(n)
  const sizes = roundSizes(n)
  const slots = fightSlots(n, battleAt, 43200)
  const seedOf = new Map(seeded.map((s, i) => [s.wallet, i]))
  const rounds: TournamentMatchup[][] = []
  let through = seeded.slice(0, b.freePasses)
  let pool = seeded.slice(b.freePasses)
  for (let r = 0; r < sizes.length; r++) {
    if (r > 0) {
      pool = [...through].sort((x, y) => seedOf.get(x.wallet)! - seedOf.get(y.wallet)!)
      through = []
    }
    const round: TournamentMatchup[] = []
    for (let i = 0; i < sizes[r]; i++) {
      const a = pool[i]
      const c = pool[pool.length - 1 - i]
      const upset = rand() < 0.33
      round.push({
        index: i,
        matchup_seed: 1000 + r * 100 + i,
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
        play_time: iso(slots[r][i]),
        winner: upset ? 'player2' : 'player1',
      })
      through.push(upset ? c : a)
    }
    rounds.push(round)
  }
  const stage = {
    tournament_name: `fake${n}`,
    stage_index: 5,
    stage_name: 'battle',
    weather_effects: [],
    tournament_screen: '',
    allow_player_signup: false,
    allow_player_cancellation: false,
    tlm_rewards: '18400.0000 TLM',
    wax_rewards: '2195.07044119 WAX',
    player_count: n,
    rounds: b.rounds,
    free_passes: b.freePasses,
    score_id_lookup_min: '0',
    score_id_lookup_max: '0',
    battles_preliminary_round: b.preliminaryBattles,
    players_first_ko_round: b.targetPlayers,
    current_round: 0,
    matchups_created: 0,
    battles_in_round: 0,
    current_battle: 0,
    round_complete: false,
  } as TournamentStage
  return { stage, plan, rounds, signups: seeded, weather, field: seeded }
}

/* ---------- moments ---------- */

interface Moment {
  key: string
  group: string
  label: string
  at: number
}

function moments(d: Loaded): Moment[] {
  const step = (n: string) => d.plan.find((s) => s.step_name === n)
  const start = (n: string) => chainTime(step(n)?.time_start)
  const end = (n: string) => start(n) + Number(step(n)?.duration_sec ?? 0) * 1000
  const opening = Number(d.stage.free_passes) > 0
  const names = d.rounds.map((_, r) => roundName(r, d.rounds.length, opening))
  const out: Moment[] = [
    { key: 'none', group: 'Before signup', label: 'No tournament running — the countdown', at: start('set_weather') - 6 * HOUR },
    { key: 'prep', group: 'Before signup', label: 'Preparing — the pot is collected', at: start('get_rewards') + HOUR },
    { key: 'open', group: 'Signup', label: 'Signup open', at: start('signup') + 30 * HOUR },
    { key: 'open-empty', group: 'Signup', label: 'Signup open — not signed up, no team yet', at: start('signup') + 30 * HOUR },
    { key: 'open-team', group: 'Signup', label: 'Signup open — not signed up, team picked', at: start('signup') + 30 * HOUR },
    { key: 'closing', group: 'Signup', label: 'Last half hour of signup', at: end('signup') - 30 * MIN },
    { key: 'drawing', group: 'The draw', label: 'The draw is being made', at: start('close_signup') + 5 * MIN },
    { key: 'drawn', group: 'The draw', label: 'Drawn — waiting for the first fight', at: start('create_matchups') + 40 * MIN },
  ]
  /*
     How far apart the fights are: the window over one slot a fight. A big
     field packs them minutes apart, so "before" and "on now" are cut to fit
     inside a slot rather than running into the fight before.
  */
  const gap = (Number(step('battle')?.duration_sec ?? 0) * 1000) / Math.max(1, d.field.length - 1)
  const before = Math.min(30 * MIN, gap * 0.4)
  const into = Math.min(5 * MIN, gap * 0.3)
  const ago = (ms: number) => (ms >= HOUR ? `${Math.round(ms / HOUR)} h` : `${Math.max(1, Math.round(ms / MIN))} min`)
  d.rounds.forEach((round, r) => {
    const sorted = [...round].sort((a, b) => a.index - b.index)
    /* Every fight of a small round; a big one by its first, middle and last. */
    const shown =
      sorted.length <= 4
        ? sorted.map((m, i) => ({ m, i }))
        : [0, Math.floor(sorted.length / 2), sorted.length - 1].map((i) => ({ m: sorted[i], i }))
    shown.forEach(({ m, i }, j) => {
      const at = chainTime(m.play_time)
      const fight = `${fightName(r, d.rounds.length, opening)}${sorted.length > 1 ? ` ${i + 1}` : ''}: ${m.gamertag_player1} v ${m.gamertag_player2}`
      if (sorted.length <= 4 || j === 0) {
        out.push({ key: `r${r}f${i}-pre`, group: names[r], label: `${fight} — ${ago(before)} before`, at: at - before })
      }
      out.push({ key: `r${r}f${i}-live`, group: names[r], label: `${fight} — on now`, at: at + into })
    })
    if (r < d.rounds.length - 1) {
      const last = chainTime(sorted[sorted.length - 1]?.play_time)
      out.push({ key: `r${r}-after`, group: names[r], label: `${names[r]} over, ${names[r + 1].toLowerCase()} being drawn`, at: last + 1 * MIN })
    }
  })
  const battleEnd = end('battle')
  out.push({ key: 'results', group: 'After', label: 'Results', at: battleEnd + MIN })
  out.push({ key: 'hof', group: 'After', label: 'Hall of Fame', at: battleEnd + 2 * MIN })
  return out
}

/* ---------- the chain, wound back to a moment ---------- */

function at(d: Loaded, now: number, picks: Record<string, 1 | 2>, key: string) {
  const step = (n: string) => d.plan.find((s) => s.step_name === n)
  const start = (n: string) => chainTime(step(n)?.time_start)
  const players = d.field.length
  const sizes = roundSizes(players)

  /* Which step the chain would be on. */
  const sorted = [...d.plan].sort((a, b) => a.index - b.index)
  let current = sorted[0]
  for (const s of sorted) if (chainTime(s.time_start) <= now) current = s
  /* The wrap-up steps run the moment the fighting ends; show the results. */
  if (['hall_of_fame', 'reward_payout', 'cleanup'].includes(current.step_name)) {
    current = sorted.find((s) => s.step_name === 'battle') ?? current
  }

  /* The fights, as far as this moment. */
  const drawnAt = (r: number) =>
    r === 0
      ? start('create_matchups') + 20 * MIN
      : chainTime([...d.rounds[r - 1]].sort((a, b) => b.index - a.index)[0]?.play_time) + MIN
  const history: TournamentMatchup[][] = []
  for (let r = 0; r < d.rounds.length; r++) {
    if (now < drawnAt(r)) break
    history.push(
      d.rounds[r].map((m) => {
        const fought = chainTime(m.play_time) <= now
        const pick = picks[`${r}:${m.index}`]
        const winner = !fought ? '' : m.winner || (pick === 2 ? 'player2' : 'player1')
        return { ...m, winner }
      }),
    )
  }
  const fullyFought = history.filter((round, r) => round.length === sizes[r] && round.every((m) => m.winner)).length
  const inRound = history[fullyFought] ?? []

  const phase: TournamentPhase =
    current.step_name === 'signup'
      ? 'signup'
      : ['set_weather', 'get_rewards'].includes(current.step_name)
        ? 'preparing'
        : ['close_signup', 'create_matchups'].includes(current.step_name)
          ? 'creation'
          : fullyFought >= d.rounds.length
            ? 'finish'
            : 'battle'

  const drawn = phase !== 'preparing' && phase !== 'signup'
  const passWallets = drawn ? passesFrom(history, d.field.slice(0, Number(d.stage.free_passes))
    .map((s) => ({ wallet: s.wallet, tag: s.playertag, avatar: s.avatar }))) : []
  const runs = replay(history, passWallets, sizes)
  const lost = new Set([...runs.values()].filter((r) => r.outIn !== null).map((r) => r.wallet))

  const stage: TournamentStage = {
    ...d.stage,
    stage_index: current.index,
    stage_name: current.step_name,
    allow_player_signup: phase === 'signup',
    allow_player_cancellation: phase === 'signup',
    rounds: drawn ? d.stage.rounds : 0,
    free_passes: drawn ? d.stage.free_passes : 0,
    current_round: Math.min(fullyFought, d.rounds.length),
    battles_in_round: sizes[fullyFought] ?? 0,
    current_battle: inRound.filter((m) => m.winner).length,
    matchups_created: history[0]?.length ?? 0,
  }

  const field = d.field
    .filter((s) => !lost.has(s.wallet))
    .map((s) => ({ ...s, reward_points: drawn ? (runs.get(s.wallet)?.points ?? 0) : 0 }))
  const payouts: TournamentPayout[] = [...runs.values()]
    .filter((r) => r.outIn !== null || phase === 'finish')
    .map((r) => ({ wallet: r.wallet, reward_points: r.points, gamertag: r.tag, avatar: r.avatar }))

  /* What `hall_of_fame` writes: the top four of the payout table, 1, 2, 3, 3. */
  const hof: TournamentHof[] =
    key === 'hof'
      ? payoutOrder([...runs.values()])
          .slice(0, 4)
          .map((r, i) => ({
            index: i,
            tournament_date: d.plan[0]?.time_start ?? '',
            tournament_name: d.stage.tournament_name,
            rank: Math.min(3, i + 1),
            wallet: r.wallet,
            gamertag: r.tag,
            avatar: r.avatar,
          }))
      : []

  return {
    /* Before its first step the tournament does not exist yet: the wait. */
    phase: key === 'hof' || key === 'none' ? ('none' as TournamentPhase) : phase,
    stage,
    timeline: timelineOf(d.plan, now, current.index),
    history,
    field,
    payouts,
    hof,
    openHof: key === 'hof',
  }
}

/* ---------- the page ---------- */

type Source = 'real' | number

/** What the panel tells the phone: which tournament, which moment, as whom. */
interface Shown {
  source: Source
  key: string
  viewer: string
  picks: Record<string, 1 | 2>
  /** Bumped to open the fighter picker from the panel. */
  picker: number
  /** A phone's screen, or a desktop's. */
  view: 'phone' | 'desktop'
}

/* A wallet with fighters and cards, for picking a team as someone with none. */
const ROSTER_WALLET = '5thba.wam'
const IS_FRAME = new URLSearchParams(location.search).has('frame')
const DESK_W = 1280
const DESK_H = 820

/** Both halves read the same tournament: the real one, or one made up. */
function useTournament(source: Source) {
  const [real, setReal] = useState<Loaded | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    load().then(setReal, (e) => setErr(String(e?.message ?? e)))
  }, [])
  /* The made-up ones borrow the real tournament's weather where there is one. */
  const d = useMemo(
    () => (source === 'real' ? real : fake(source, real?.weather ?? [])),
    [source, real],
  )
  return { d, real, err }
}

/**
 * The control panel, with the phone as an iframe beside it.
 *
 * The phone is a page of its own, 390 pixels wide, so the screen's phone
 * rules — the picker sheet among them — apply exactly as they do on a phone.
 */
function Panel() {
  const [source, setSource] = useState<Source>('real')
  /* Up here, so changing tournament does not drop it back to the phone. */
  const [view, setView] = useState<'phone' | 'desktop'>('phone')
  const { d, real, err } = useTournament(source)
  useEffect(() => {
    if (err && source === 'real') setSource(FAKE_SIZES[2])
  }, [err, source])
  if (!d) return <p className="ts__msg">{err ? `Could not read the tournament: ${err}` : 'Reading the tournament from the chain…'}</p>
  return <Controls key={String(source)} d={d} source={source} onSource={setSource} realReady={!!real} realSize={real?.field.length ?? 0} view={view} setView={setView} />
}

function Controls({
  d,
  source,
  onSource,
  realReady,
  realSize,
  view,
  setView,
}: {
  d: Loaded
  source: Source
  onSource: (s: Source) => void
  realReady: boolean
  realSize: number
  view: 'phone' | 'desktop'
  setView: (v: 'phone' | 'desktop') => void
}) {
  const list = useMemo(() => moments(d), [d])
  const [i, setI] = useState(() => {
    const now = Date.now()
    let k = 0
    list.forEach((m, j) => {
      if (m.at <= now) k = j
    })
    return k
  })
  /* A made-up field opens on seed 5: below the free passes in most sizes,
     so there is an opening fight to follow. */
  const [viewer, setViewer] = useState((source === 'real' ? d.field[0] : (d.field[4] ?? d.field[0]))?.wallet ?? VISITOR)
  const [picks, setPicks] = useState<Record<string, 1 | 2>>({})
  const [picker, setPicker] = useState(0)
  const moment = list[i]
  /* The desktop window is 1280 wide, scaled to whatever room the page has. */
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / DESK_W)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setI((x) => Math.min(list.length - 1, x + 1))
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [list.length])

  /* Tell the phone, now and whenever it says it is listening. */
  const frame = useRef<HTMLIFrameElement>(null)
  const shown: Shown = { source, key: moment.key, viewer, picks, picker, view }
  const post = () => frame.current?.contentWindow?.postMessage({ tsShown: shown }, '*')
  useEffect(post)
  useEffect(() => {
    const ready = (e: MessageEvent) => {
      if (e.data === 'ts-ready') post()
    }
    window.addEventListener('message', ready)
    return () => window.removeEventListener('message', ready)
  })

  const open = d.rounds.flatMap((round, r) =>
    round.filter((m) => !winnerSide(m) && m.wallet_player2).map((m) => ({ r, m })),
  )
  const groups = [...new Set(list.map((m) => m.group))]
  const names = d.rounds.map((_, r) => roundName(r, d.rounds.length, Number(d.stage.free_passes) > 0))
  const signing = moment.key === 'open-empty' || moment.key === 'open-team'

  return (
    <div className={`ts${view === 'desktop' ? ' ts--desk' : ''}`}>
      <aside className="ts__panel">
        <h1>Tournament stages</h1>
        <p className="ts__sub">
          {source === 'real' ? (
            <>
              The real tournament <code>{d.stage.tournament_name}</code>
            </>
          ) : (
            'A made-up tournament'
          )}{' '}
          — {d.field.length} players — wound back to the moment you pick. Arrow keys step through.
        </p>

        <div className="ts__block">
          <b>View</b>
          <div className="ts__chips">
            <button className={view === 'phone' ? 'on' : ''} onClick={() => setView('phone')}>
              Phone
            </button>
            <button className={view === 'desktop' ? 'on' : ''} onClick={() => setView('desktop')}>
              Desktop
            </button>
          </div>
        </div>

        <div className="ts__block">
          <b>Tournament</b>
          <div className="ts__chips">
            <button className={source === 'real' ? 'on' : ''} disabled={!realReady} onClick={() => onSource('real')}>
              Real{realSize ? ` · ${realSize} players` : ''}
            </button>
            {FAKE_SIZES.map((n) => (
              <button key={n} className={source === n ? 'on' : ''} onClick={() => onSource(n)}>
                Fake · {n}
              </button>
            ))}
          </div>
        </div>

        <div className="ts__block">
          <b>Viewing as</b>
          {d.field.length <= 8 ? (
            <div className="ts__chips">
              {d.field.map((s) => (
                <button key={s.wallet} className={viewer === s.wallet ? 'on' : ''} onClick={() => setViewer(s.wallet)}>
                  {s.playertag || s.wallet}
                </button>
              ))}
              <button className={viewer === VISITOR ? 'on' : ''} onClick={() => setViewer(VISITOR)}>
                Not entered
              </button>
            </div>
          ) : (
            <select className="ts__select" value={viewer} onChange={(e) => setViewer(e.target.value)}>
              {d.field.map((s, k) => (
                <option key={s.wallet} value={s.wallet}>
                  Seed {k + 1} · {s.playertag}
                </option>
              ))}
              <option value={VISITOR}>Not entered</option>
            </select>
          )}
        </div>

        {signing && (
          <div className="ts__block">
            <b>The fighter picker</b>
            <p className="ts__sub">
              Tap any empty slot on the phone, or open it from here. It is the dungeon's own sheet, filled
              with {ROSTER_WALLET}'s real fighters and cards.
            </p>
            <div className="ts__chips">
              <button onClick={() => setPicker((n) => n + 1)}>Open the fighter picker</button>
            </div>
          </div>
        )}

        {open.length > 0 && (
          <div className="ts__block">
            <b>Not fought on chain yet — who wins?</b>
            {open.map(({ r, m }) => {
              const k = `${r}:${m.index}`
              const pick = picks[k] ?? 1
              return (
                <div key={k} className="ts__chips">
                  <span className="ts__lbl">{names[r]}</span>
                  {([1, 2] as const).map((side) => (
                    <button key={side} className={pick === side ? 'on' : ''} onClick={() => setPicks({ ...picks, [k]: side })}>
                      {side === 1 ? m.gamertag_player1 : m.gamertag_player2}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        <div className="ts__block">
          <div className="ts__nav">
            <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
              ‹ Back
            </button>
            <span>
              {i + 1} / {list.length}
            </span>
            <button onClick={() => setI(Math.min(list.length - 1, i + 1))} disabled={i === list.length - 1}>
              Next ›
            </button>
          </div>
          <p className="ts__time">
            Pretending it is{' '}
            <b>
              {new Date(moment.at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </b>
          </p>
          {groups.map((g) => (
            <div key={g} className="ts__group">
              <small>{g}</small>
              {list.map((m, j) =>
                m.group === g ? (
                  <button key={m.key} className={j === i ? 'on' : ''} onClick={() => setI(j)}>
                    {m.label}
                  </button>
                ) : null,
              )}
            </div>
          ))}
        </div>
      </aside>

      <div className="ts__stage" ref={box}>
        {/* One iframe in both views — the same tree, so switching resizes it rather than reloading. */}
        <div
          className={view === 'phone' ? 'ts__phone' : 'ts__deskbox'}
          style={view === 'desktop' ? { height: DESK_H * scale } : undefined}
        >
          <div className="ts__scaler" style={view === 'desktop' ? { transform: `scale(${scale})` } : undefined}>
            <iframe ref={frame} className="ts__iframe" src="tour-stages.html?frame=1" title="The screen" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The phone itself: the tournament screen at the moment the panel says.
 *
 * Signing up is live here — the slots open the dungeon's picker sheet over
 * a real roster — so the screen before entering can be tried, not just seen.
 */
function Phone() {
  const [shown, setShown] = useState<Shown | null>(null)
  const [at0, setAt0] = useState(Date.now())
  useEffect(() => {
    const take = (e: MessageEvent) => {
      const next = (e.data as { tsShown?: Shown })?.tsShown
      if (!next) return
      setShown((prev) => {
        if (!prev || prev.key !== next.key || prev.source !== next.source) setAt0(Date.now())
        return next
      })
    }
    window.addEventListener('message', take)
    window.parent.postMessage('ts-ready', '*')
    return () => window.removeEventListener('message', take)
  }, [])
  const { d } = useTournament(shown?.source ?? 'real')
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (!shown || !d) return <p className="ts__msg">Loading…</p>
  const moment = moments(d).find((m) => m.key === shown.key)
  if (!moment) return <p className="ts__msg">Loading…</p>
  return <PhoneAt key={`${shown.source}:${shown.key}:${shown.viewer}`} d={d} moment={moment} shown={shown} now={moment.at + (Date.now() - at0)} />
}

function PhoneAt({ d, moment, shown, now }: { d: Loaded; moment: Moment; shown: Shown; now: number }) {
  const { nftValues, levelMod, ageDecay } = useConfig()
  const viewer = shown.viewer
  const state = at(d, now, shown.picks, moment.key)
  /* The two "not signed up" moments take whoever is looking out of the field. */
  const notIn = moment.key === 'open-empty' || moment.key === 'open-team'
  const field = notIn ? state.field.filter((s) => s.wallet !== viewer) : state.field
  const mine = notIn ? undefined : field.find((s) => s.wallet === viewer)

  /* A real roster to pick from: the viewer's own, if they are a real player. */
  const [roster, setRoster] = useState<RosterFighter[] | null>(null)
  const [cards, setCards] = useState<{ crew: CardTemplate[]; weapons: CardTemplate[] }>({ crew: [], weapons: [] })
  const owner = d.field.some((s) => s.wallet === viewer) && !viewer.startsWith('fake') ? viewer : ROSTER_WALLET
  useEffect(() => {
    if (!notIn && state.phase !== 'signup') return
    let live = true
    Promise.all([fetchRoster(owner), fetchCrewCards(owner)]).then(([r, c]) => {
      if (!live) return
      setRoster(r.filter((f) => !f.in_use))
      setCards(c)
    })
    return () => {
      live = false
    }
  }, [owner, notIn, state.phase])
  const usableCrew = useMemo(() => cards.crew.filter((c) => nftValues.has(c.template_id)), [cards, nftValues])
  const usableWeapons = useMemo(() => cards.weapons.filter((c) => nftValues.has(c.template_id)), [cards, nftValues])

  const [teamIds, setTeamIds] = useState<number[]>([])
  const [crew, setCrew] = useState<CardTemplate | null>(null)
  const [weapon, setWeapon] = useState<CardTemplate | null>(null)
  const [tab, setTab] = useState<Tab>('fighters')
  const [sheet, setSheet] = useState(false)
  /* "Team picked": the strongest five and the first usable pair, ready to go. */
  useEffect(() => {
    if (moment.key !== 'open-team' || !roster) return
    setTeamIds(
      [...roster]
        .sort((a, b) => (b.stats?.level ?? 0) - (a.stats?.level ?? 0))
        .slice(0, TEAM_SIZE)
        .map((f) => f.fighter_id),
    )
    setCrew(usableCrew[0] ?? null)
    setWeapon(usableWeapons[0] ?? null)
  }, [moment.key, roster, usableCrew, usableWeapons])
  /* The panel's button. */
  const first = useRef(shown.picker)
  useEffect(() => {
    if (shown.picker !== first.current) {
      setTab('fighters')
      setSheet(true)
    }
  }, [shown.picker])

  const picked = (roster ?? [])
    .filter((f) => teamIds.includes(f.fighter_id))
    .sort((a, b) => teamIds.indexOf(a.fighter_id) - teamIds.indexOf(b.fighter_id))
  const team: (RosterFighter | null)[] = Array.from({ length: TEAM_SIZE }, (_, k) => picked[k] ?? null)
  const toggle = (f: RosterFighter) =>
    setTeamIds((ids) =>
      ids.includes(f.fighter_id) ? ids.filter((x) => x !== f.fighter_id) : ids.length >= TEAM_SIZE ? ids : [...ids, f.fighter_id],
    )
  const missing = TEAM_SIZE - picked.length
  const block = missing > 0
    ? { ready: false, reason: `Pick ${missing} more fighter${missing === 1 ? '' : 's'}` }
    : !crew
      ? { ready: false, reason: 'Pick a crew card' }
      : !weapon
        ? { ready: false, reason: 'Pick a weapon card' }
        : { ready: true }

  const desk = shown.view === 'desktop'
  return (
    <div className={`tsf${desk ? ' tsf--desk' : ''}`}>
      {desk && (
        <aside className="tsf__rail">
          <b>ALIEN LEGENDS</b>
          {['World Map', 'My Fighters', 'Quests', 'Shop', 'Tournament', 'Leaderboards', 'Rewards'].map((n) => (
            <span key={n} className={n === 'Tournament' ? 'on' : ''}>
              {n}
            </span>
          ))}
        </aside>
      )}
      <div className="tsf__bar">
        <b>{desk ? '' : 'ALIEN LEGENDS'}</b>
        <span>{moment.label}</span>
      </div>
      <main className="tsf__main">
        <PhoneTournament
          layout={desk ? 'desktop' : 'phone'}
          phase={state.phase}
          stage={state.phase === 'none' ? undefined : state.stage}
          now={now}
          timeline={state.timeline}
          signupAt={chainTime(d.plan.find((s) => s.step_name === 'signup')?.time_start)}
          field={field}
          mine={mine}
          wallet={viewer}
          history={state.history}
          payouts={state.payouts}
          hof={state.hof}
          weather={d.weather}
          rolls={d.weather.map((w) => w.weather).filter((w): w is Weather => !!w)}
          legend={new Map()}
          past={null}
          ringFighters={[
            { fighter_id: 1, classname: 'juggernaut', racename: 'khaured' },
            { fighter_id: 2, classname: 'arcanist', racename: 'altan' },
            { fighter_id: 3, classname: 'astralknight', racename: 'lopati' },
            { fighter_id: 4, classname: 'desperado', racename: 'human' },
            { fighter_id: 5, classname: 'mindblade', racename: 'altan' },
          ]}
          team={team}
          crew={crew}
          weapon={weapon}
          score={teamScore(picked)}
          energyCost={100}
          block={block}
          busy={false}
          canSign={block.ready}
          onEnter={() => {}}
          onPick={(t) => {
            setTab(t)
            setSheet(true)
          }}
          picker={
            <PickerSheet
              open={sheet}
              onClose={() => setSheet(false)}
              tab={tab}
              onTab={setTab}
              roster={roster}
              teamIds={teamIds}
              onToggle={toggle}
              onInspect={() => {}}
              levelMod={levelMod}
              ageDecay={ageDecay}
              crewCards={usableCrew}
              weaponCards={usableWeapons}
              values={nftValues}
              crew={crew}
              weapon={weapon}
              onCrew={setCrew}
              onWeapon={setWeapon}
              onInspectCard={() => {}}
              inline={desk}
            />
          }
          viewingPast={false}
        />
        {state.openHof && <OpenHof />}
      </main>
      {!desk && <nav className="tsf__tabs">
        <span>World Map</span>
        <span>My Fighters</span>
        <span>Quests</span>
        <span>Shop</span>
        <span className="on">More</span>
      </nav>}
    </div>
  )
}

/* The Hall of Fame is a button on the screen; this presses it. */
function OpenHof() {
  useEffect(() => {
    const b = [...document.querySelectorAll('.tsf__main button')].find((x) =>
      x.textContent?.includes('Hall of Fame'),
    ) as HTMLButtonElement | undefined
    b?.click()
  }, [])
  return null
}

const Page = IS_FRAME ? Phone : Panel


async function boot() {
  /* Replays need the game config, and the config wants a player. */
  const page = await fetchPlayersPage(undefined, 1)
  const player = (page as unknown as { rows: unknown[] }).rows?.[0]
  if (player) useGame.setState({ player: player as never, playerLoaded: true })
  await useConfigStore.getState().load()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Page />
    </StrictMode>,
  )
}

void boot()

