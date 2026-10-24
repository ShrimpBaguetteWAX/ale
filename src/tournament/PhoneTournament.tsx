import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CardTemplate } from '@/chain/atomic'
import type { RosterFighter } from '@/dungeon/types'
import { BottomSheet } from '@/components/BottomSheet'
import { GameImg } from '@/components/GameImg'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { WeatherPanel } from '@/fight/setup'
import { weatherTargets, type Weather } from '@/fight/weather'
import {
  fighterArt,
  fighterArtFallback,
  fighterAvatar,
  fighterSilhouette,
  fighterSilhouetteFallback,
} from '@/tavern/fighterStats'
import { BoutBroadcast } from '@/tournament/BoutBroadcast'
import { fetchFightersByIds } from '@/tournament/queries'
import {
  bracketOf,
  chainTime,
  crewFaces,
  freePassCount,
  type EntryBlock,
  type TimelineStep,
  type TournamentPhase,
  winnerSide,
} from '@/tournament/rules'
import {
  fightName,
  fightSlots,
  liveFight,
  passesFrom,
  payoutOrder,
  prizesOf,
  replay,
  roundName,
  roundSizes,
  stripCells,
  waxBands,
  waxFor,
  winsAhead,
  type Entrant,
  type Prizes,
  type Run,
} from '@/tournament/standings'
import type {
  TournamentHof,
  TournamentMatchup,
  TournamentPayout,
  TournamentSignup,
  TournamentStage,
} from '@/tournament/types'
import { formatDecimals, formatNumber } from '@/format'
import { asset, ipfsImage } from '@/assets'

const TLM_ICON = asset('/assets/icons/tlm.svg')
const WAX_ICON = asset('/assets/icons/wax-coin.png')
const TROPHY = asset('/assets/icons/trophy-gold.svg')
const ENERGY = asset('/assets/icons/energy.png')

/** A tournament no longer on the board, kept for its results and replays. */
export interface PastTournament {
  stage: TournamentStage
  history: TournamentMatchup[][]
  rolls: Weather[]
}

export interface PhoneTournamentProps {
  phase: TournamentPhase
  stage: TournamentStage | undefined
  now: number
  timeline: TimelineStep[]
  /** When signup opens, for the screen before it. */
  signupAt: number
  /** Entrants, best seed first. */
  field: TournamentSignup[]
  mine: TournamentSignup | undefined
  wallet: string
  /** Every round the chain holds, opening round first. */
  history: TournamentMatchup[][]
  payouts: TournamentPayout[]
  hof: TournamentHof[]
  /** The rolls, with the planet each came from. */
  weather: { planet: string; weather?: Weather }[]
  rolls: Weather[]
  /** Legend Access by wallet, where it has been read; for the results. */
  legend: Map<string, boolean>
  /** The tournament before this one, while its fights are still on chain. */
  past: PastTournament | null
  ringFighters: { fighter_id: number; classname: string; racename: string }[]
  /* Entering. */
  team: (RosterFighter | null)[]
  crew: CardTemplate | null
  weapon: CardTemplate | null
  score: number
  energyCost: number
  block: EntryBlock
  busy: boolean
  canSign: boolean
  onEnter: () => void
  onPick: (tab: 'fighters' | 'crew' | 'weapon') => void
  /** Takes one picked fighter off the team, and clears it all — for the desktop's line-up. */
  onRemove?: (f: RosterFighter) => void
  onClearTeam?: () => void
  /** Who is looking, for their row among the entrants before they enter. */
  me?: { tag: string; avatar: number }
  /** The roster sheet, slid over the screen when a team slot is tapped. */
  picker: ReactNode
  /** The next tournament's steps, for the schedule between tournaments. */
  schedule?: NextStep[]
  /** How long after a tournament's start its final is over — to date the Hall of Fame by its final. */
  finalAfterMs?: number
  /** A phone's single column, or the desktop's two. */
  layout?: 'phone' | 'desktop'
  /* Moving between tournaments. */
  viewingPast: boolean
  onOpenPast?: () => void
  onBack?: () => void
  onChooseAnother?: () => void
}

/* ---------- small helpers ---------- */

/** "14:00" today, "Sat 14:00" any other day. */
function when(ms: number, now: number): string {
  if (!Number.isFinite(ms)) return '—'
  const d = new Date(ms)
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const same = new Date(now).toDateString() === d.toDateString()
  return same ? time : `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
}

/** The time of day alone: "19:00", or "07:00 PM" where the locale says so. */
function timeOf(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** A slot's time for a narrow column: the clock large, any AM/PM small under it. */
function Clock({ ms }: { ms: number }) {
  if (!Number.isFinite(ms)) return <b className="mono">—</b>
  const parts = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).formatToParts(
    new Date(ms),
  )
  const period = parts.find((x) => x.type === 'dayPeriod')?.value
  const clock = parts
    .filter((x) => x.type !== 'dayPeriod')
    .map((x) => x.value)
    .join('')
    .trim()
  return (
    <b className="mono">
      {clock}
      {period && <sup>{period}</sup>}
    </b>
  )
}

/** "2d 14h", "3h 12m", "48m", "20s". */
function inText(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'now'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

/** The board's clock: "1d 04:12:33". */
function boardClock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'Any moment'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86_400)
  const pad = (n: number) => String(n).padStart(2, '0')
  const hms = `${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  return d > 0 ? `${d}d ${hms}` : hms
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
export function place(n: number): string {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  const suffix: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' }
  return `${n}${suffix[n % 10] ?? 'th'}`
}

/** "Wed 4 Nov · 01:00", for a day that is not today. */
function dayTime(ms: number): string {
  if (!Number.isFinite(ms)) return ''
  const time = new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${dayLabel(ms)} · ${time}`
}

const wax = (v: number) => formatDecimals(v, 2)
const tlm = (v: number) => (v >= 100 ? formatNumber(Math.floor(v)) : formatDecimals(v, 2))

function dayLabel(ms: number): string {
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

const sideOf = (m: TournamentMatchup, side: 1 | 2): Entrant =>
  side === 1
    ? { wallet: m.wallet_player1, tag: m.gamertag_player1, avatar: m.avatar_player1 }
    : { wallet: m.wallet_player2, tag: m.gamertag_player2, avatar: m.avatar_player2 }

const isIn = (m: TournamentMatchup, wallet: string) =>
  !!wallet && (m.wallet_player1 === wallet || m.wallet_player2 === wallet)

/* ---------- the tournament, worked out once ---------- */

interface Board {
  rounds: number
  players: number
  opening: boolean
  sizes: number[]
  slots: number[][]
  /** The round the chain is on; `rounds` once the final is in. */
  current: number
  prizes: Prizes
  runs: Map<string, Run>
  /** Everyone with points, in the payout table's order. */
  order: Run[]
  rankOf: (wallet: string) => number
  passes: Entrant[]
  /** A round with fewer rows than fights is still being drawn. */
  drawing: (round: number) => boolean
  name: (round: number, short?: boolean) => string
}

function useBoard(
  stage: TournamentStage | undefined,
  timeline: TimelineStep[],
  field: TournamentSignup[],
  history: TournamentMatchup[][],
  payouts: TournamentPayout[],
): Board {
  return useMemo(() => {
    const players = Number(stage?.player_count ?? field.length)
    const bracket = bracketOf(players)
    const rounds = Number(stage?.rounds ?? 0) || bracket.rounds
    const sizes = roundSizes(players)
    const passCount = freePassCount(stage, players)
    const opening = passCount > 0
    const battle = timeline.find((s) => s.name === 'battle')
    const slots = fightSlots(players, battle?.startMs ?? NaN, battle ? (battle.endMs - battle.startMs) / 1000 : 0)
    const seeded: Entrant[] = field
      .slice(0, passCount)
      .map((s) => ({ wallet: s.wallet, tag: s.playertag, avatar: s.avatar }))
    const passes = opening ? passesFrom(history, seeded) : []
    const runs = replay(history, passes, sizes)

    /*
       The chain's own points over the replay wherever it still has them —
       the signup row of everyone still in, the payout row of everyone out.
       The replay is what is left once the payout step has erased both.
    */
    for (const s of field) {
      const r = runs.get(s.wallet)
      if (r) r.points = Number(s.reward_points ?? r.points)
      else
        runs.set(s.wallet, {
          wallet: s.wallet,
          tag: s.playertag,
          avatar: s.avatar,
          points: Number(s.reward_points ?? 0),
          pass: false,
          outIn: null,
          lostTo: null,
          beat: [],
        })
    }
    for (const p of payouts) {
      const r = runs.get(p.wallet)
      if (r) r.points = Number(p.reward_points)
    }

    const order = payoutOrder([...runs.values()])
    const ranks = new Map(order.map((r, i) => [r.wallet, i + 1]))
    const current = Math.min(Number(stage?.current_round ?? 0), rounds)
    return {
      rounds,
      players,
      opening,
      sizes,
      slots,
      current,
      prizes: prizesOf(stage),
      runs,
      order,
      rankOf: (w: string) => ranks.get(w) ?? 0,
      passes,
      drawing: (r: number) => (history[r]?.length ?? 0) < (sizes[r] ?? 0),
      name: (r: number, short = false) => roundName(r, rounds, opening, short),
    }
  }, [stage, timeline, field, history, payouts])
}

/* ---------- the screen ---------- */

type Sheet =
  | { kind: 'prizes' }
  | { kind: 'withdraw' }
  | { kind: 'watch'; m: TournamentMatchup; round: number; rolls: Weather[] }
  | null

export function PhoneTournament(p: PhoneTournamentProps) {
  const [hof, setHof] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)
  const board = useBoard(p.stage, p.timeline, p.field, p.history, p.payouts)
  const watch = (m: TournamentMatchup, round: number, rolls = p.rolls) =>
    setSheet({ kind: 'watch', m, round, rolls })

  const drawn = p.phase === 'creation' || p.phase === 'battle' || p.phase === 'finish'

  let body: ReactNode
  if (hof) {
    body = (
      <HallOfFame
        rows={p.hof}
        wallet={p.wallet}
        nextFinal={p.schedule?.find((x) => x.key === 'fights')?.endMs}
        finalAfterMs={p.finalAfterMs}
        onBack={() => setHof(false)}
      />
    )
  } else if (p.phase === 'none' || p.phase === 'preparing') {
    body = (
      <BeforeSignup
        {...p}
        onHof={() => setHof(true)}
        onWatch={(m, r) => p.past && watch(m, r, p.past.rolls)}
      />
    )
  } else if (p.phase === 'signup') {
    body = <Signup {...p} board={board} onHof={() => setHof(true)} onWithdraw={() => setSheet({ kind: 'withdraw' })} />
  } else if (p.phase === 'creation') {
    body = <Draw {...p} board={board} onPrizes={() => setSheet({ kind: 'prizes' })} />
  } else if (p.phase === 'battle') {
    body = <Fighting {...p} board={board} onPrizes={() => setSheet({ kind: 'prizes' })} onWatch={watch} />
  } else {
    body = (
      <Results
        {...p}
        board={board}
        onPrizes={() => setSheet({ kind: 'prizes' })}
        onHof={() => setHof(true)}
        onWatch={watch}
      />
    )
  }

  const desk = p.layout === 'desktop'
  return (
    <Desk.Provider value={desk}>
    <div className={`prew ptour${desk ? ' ptour--desk' : p.phase === 'signup' && !p.mine && !hof ? ' ptour--dock' : ''}`}>
      {(p.viewingPast || p.onChooseAnother) && !hof && (
        <div className="ptour__switch">
          {p.viewingPast && p.onBack && (
            <button type="button" className="ptour__pill" onClick={p.onBack}>
              ‹ Back to the current tournament
            </button>
          )}
          {!p.viewingPast && p.onChooseAnother && (
            <button type="button" className="ptour__pill" onClick={p.onChooseAnother}>
              Choose another tournament
            </button>
          )}
        </div>
      )}

      {body}

      {sheet?.kind === 'prizes' && drawn && (
        <PrizeSheet board={board} wallet={p.wallet} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'withdraw' && <WithdrawSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === 'watch' && (
        <Sheet title={fightName(sheet.round, board.rounds || sheet.round + 1, board.opening)} onClose={() => setSheet(null)}>
          <div className="ptour__watch">
            <BoutBroadcast
              key={`${sheet.round}:${sheet.m.index}`}
              m={sheet.m}
              round={sheet.round}
              bout={sheet.m.index}
              weather={sheet.rolls}
              mineWallet={p.wallet}
              autoPlay
              lockedUntil={sheet.m.winner ? NaN : chainTime(sheet.m.play_time)}
              now={p.now}
            />
          </div>
        </Sheet>
      )}
      {/* The roster sheet, as the dungeon has it; mounted always, slid in and out. */}
      {!desk && p.phase === 'signup' && !p.mine && p.picker}
    </div>
    </Desk.Provider>
  )
}

/* ---------- pieces ---------- */

/** Whether the screen is laid out for a desktop. */
const Desk = createContext(false)

/**
 * A screen's cards, in the order a phone stacks them, each marked for the
 * column it takes on a desktop: the main one for what is happening, the
 * side one for what it is worth and what it is fought under.
 */
function Cols({ items }: { items: [ReactNode, 'main' | 'side'][] }) {
  const desk = useContext(Desk)
  const all = (col?: 'main' | 'side') =>
    items
      .filter(([el, c]) => !!el && (!col || c === col))
      .map(([el], i) => <Fragment key={i}>{el}</Fragment>)
  if (!desk) return <>{all()}</>
  /* Nothing for the side: the main column takes the width. */
  if (!items.some(([el, c]) => !!el && c === 'side')) return <div className="ptour__col">{all('main')}</div>
  return (
    <div className="ptour__cols">
      <div className="ptour__col">{all('main')}</div>
      <div className="ptour__col ptour__col--side">{all('side')}</div>
    </div>
  )
}

/** A bottom sheet on a phone; a window in the middle of the screen on a desktop. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const desk = useContext(Desk)
  if (!desk) {
    return (
      <BottomSheet title={title} onClose={onClose}>
        {children}
      </BottomSheet>
    )
  }
  return (
    <div className="ptour__modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="ptour__modalpanel" onClick={(e) => e.stopPropagation()}>
        <header className="ptour__modalhead">
          <b>{title}</b>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="ptour__modalbody">{children}</div>
      </div>
    </div>
  )
}

/** The prizes, always in view beside the fights on a desktop. */
function SidePrizes({ board, wallet, onPrizes }: { board: Board; wallet: string; onPrizes: () => void }) {
  const run = board.runs.get(wallet)
  return (
    <section className="ptour__card ptour__card--gold">
      <div className="ptour__cardhead">
        <span className="ptour__kick ptour__kick--gold">Prizes</span>
        <button type="button" className="ptour__link" onClick={onPrizes}>
          All details ›
        </button>
      </div>
      <PrizeLadder board={board} mark={run ? board.rankOf(wallet) : 0} />
    </section>
  )
}

/** Who has entered so far, best seed first — the desktop's side column at signup. */
function Entrants({ field, wallet, you }: {
  field: TournamentSignup[]
  wallet: string
  /** The player, not entered yet: where their team would seed, or 0 with no team. */
  you?: { wallet: string; playertag: string; avatar: number; score: number; seed: number }
}) {
  if (!field.length && !you) return null
  const rows: (TournamentSignup | (NonNullable<typeof you> & { you: true }))[] = [...field]
  if (you) rows.splice(you.seed ? you.seed - 1 : rows.length, 0, { ...you, you: true })
  return (
    <section className="ptour__card">
      <div className="ptour__cardhead">
        <span className="ptour__kick">Entered so far</span>
        <small className="ptour__fine">{formatNumber(field.length)}</small>
      </div>
      <div className="ptour__entrants">
        {rows.slice(0, 12).map((s, i) => {
          const isYou = 'you' in s
          const unseeded = isYou && !(s as { seed: number }).seed
          return (
            <div key={isYou ? '~you' : s.wallet} className={`ptour__entrant${s.wallet === wallet ? ' is-me' : ''}${isYou ? ' is-you' : ''}`}>
              <b className="mono">{unseeded ? '?' : i + 1}</b>
              <PlayerAvatar id={s.avatar} name={s.playertag} className="ptour__sideav" size={28} />
              <span>{unseeded ? 'You — not entered' : s.playertag || s.wallet}</span>
              <small className="mono">{unseeded ? '—' : formatNumber(s.score)}</small>
            </div>
          )
        })}
        {rows.length > 12 && <p className="ptour__fine">and {formatNumber(rows.length - 12)} more</p>}
      </div>
    </section>
  )
}

function Head({ sub, chip }: { sub: string; chip?: ReactNode }) {
  return (
    <div className="ptour__head">
      <h1 className="ptour__title">
        Tournament
        <small>{sub}</small>
      </h1>
      {chip}
    </div>
  )
}

const HofChip = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="ptour__pill" onClick={onClick}>
    <img src={TROPHY} alt="" />
    Hall of Fame
  </button>
)

const PrizesChip = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="ptour__pill ptour__pill--gold" onClick={onClick}>
    <img src={TROPHY} alt="" />
    Prizes
  </button>
)

interface StripItem {
  key: string
  label: string
  sub: string
  state: 'done' | 'now' | 'next'
  /** A round: its fights, and how many are fought. */
  /** A round: one state a fight, in order — fought, on now, being drawn, or to come. */
  fights?: ('done' | 'live' | 'draw' | 'next')[]
  round?: number
}

/**
 * The tournament, end to end, in one row.
 *
 * Signup and the draw, then a cell a round — each with a pip a fight, teal
 * once fought, a pulsing gold one for the fight on now. A round of more than
 * eight fights gets a count instead of pips, and a tournament with more
 * rounds than fit folds the far ones into a "+n" cell either side.
 */
function Strip({
  items,
  focus,
  selected,
  onSelect,
}: {
  items: StripItem[]
  focus: number
  selected?: number
  onSelect?: (round: number) => void
}) {
  const cells = stripCells(items, focus)
  const shown = cells.map((c) => (c.item ? items.indexOf(c.item) : c.at))
  const nowAt = items.findIndex((i) => i.state === 'now')
  const doneUpTo = nowAt < 0 ? (items.every((i) => i.state === 'done') ? items.length - 1 : 0) : nowAt
  const lastShown = shown.filter((i) => i <= doneUpTo).length - 1
  const fill = cells.length > 1 ? Math.max(0, lastShown) / (cells.length - 1) : 0

  return (
    <div className="ptour__strip" style={{ ['--cols' as string]: String(cells.length) }}>
      <i className="ptour__stripfill" style={{ ['--fill' as string]: String(fill) }} />
      {cells.map((c) => {
        if (c.more) {
          const state = c.more.side === 'before' ? 'done' : 'next'
          return (
            <button
              type="button"
              key={`more-${c.more.side}`}
              className={`ptour__step ptour__step--${state} ptour__step--more`}
              onClick={() => {
                const target = items[c.more!.first]
                if (target?.round !== undefined) onSelect?.(target.round)
              }}
            >
              <span className="ptour__dot">+{c.more.count}</span>
              <b>{c.more.side === 'before' ? 'Earlier' : 'Later'}</b>
              <small>{c.more.count} more</small>
            </button>
          )
        }
        const it = c.item!
        const sel = it.round !== undefined && it.round === selected
        const f = it.fights
        return (
          <button
            type="button"
            key={it.key}
            className={`ptour__step ptour__step--${it.state}${sel ? ' is-sel' : ''}`}
            disabled={it.round === undefined || !onSelect}
            onClick={() => it.round !== undefined && onSelect?.(it.round)}
          >
            <span className="ptour__dot" />
            <b>{it.label}</b>
            <small>{it.sub}</small>
            {f &&
              (f.length <= 8 ? (
                <span
                  className={`ptour__pips${f.length > 5 ? ' is-dense' : ''}`}
                  aria-label={`${f.filter((x) => x === 'done').length} of ${f.length} fought`}
                >
                  {f.map((x, j) => (
                    <i key={j} className={x === 'next' ? '' : `is-${x}`} />
                  ))}
                </span>
              ) : (
                <span className="ptour__count mono">
                  {f.filter((x) => x === 'done').length}/{f.length}
                </span>
              ))}
          </button>
        )
      })}
    </div>
  )
}

/** The strip's cells for a drawn tournament: signup, draw, every round. */
function drawnItems(board: Board, history: TournamentMatchup[][], phase: TournamentPhase, now: number): StripItem[] {
  const finished = phase === 'finish'
  const drawingNow = phase === 'creation'
  const items: StripItem[] = [
    { key: 'signup', label: 'Signup', sub: 'closed', state: 'done' },
    {
      key: 'draw',
      label: 'Draw',
      sub: drawingNow ? (board.drawing(0) ? 'drawing' : 'done') : 'done',
      state: drawingNow ? 'now' : 'done',
    },
  ]
  for (let r = 0; r < board.rounds; r++) {
    const rows = history[r] ?? []
    const n = board.sizes[r] ?? rows.length
    const state: StripItem['state'] =
      finished || r < board.current ? 'done' : !drawingNow && r === board.current ? 'now' : 'next'
    const live = state === 'now' ? liveFight(rows, now) : null
    const byIndex = new Map(rows.map((m) => [m.index, m]))
    const fights = Array.from({ length: n }, (_, i): 'done' | 'live' | 'draw' | 'next' => {
      if (state === 'done') return 'done'
      const m = byIndex.get(i)
      if (live && live.index === i) return 'live'
      if (!m) return state === 'now' || (drawingNow && r === 0) ? 'draw' : 'next'
      return winnerSide(m) ? 'done' : 'next'
    })
    items.push({
      key: `r${r}`,
      label: board.name(r, true),
      /* The slot; for a tournament with no schedule left, its first fight's own time. */
      sub: when(
        Number.isFinite(board.slots[r]?.[0]) ? board.slots[r][0] : chainTime(rows[0]?.play_time),
        now,
      ),
      state,
      round: r,
      fights,
    })
  }
  return items
}

/**
 * The pot. `field` is who has entered, or null before signup opens — when
 * nobody can have, so no count is shown at all.
 */
function PotCard({ stage, field }: { stage: TournamentStage | undefined; field: TournamentSignup[] | null }) {
  const prizes = prizesOf(stage)
  return (
    <section className="ptour__card ptour__card--gold">
      <div className="ptour__cardhead">
        <span className="ptour__kick ptour__kick--gold">Prize pool</span>
        {field && (
          <span className="ptour__faces">
            {field.slice(0, 5).map((s) => (
              <PlayerAvatar key={s.wallet} id={s.avatar} name={s.playertag} className="ptour__face" size={26} />
            ))}
            <span>{formatNumber(field.length)} entered</span>
          </span>
        )}
      </div>
      {prizes.wax > 0 || prizes.tlm > 0 ? (
        <div className="ptour__pot">
          <div className="ptour__potfig">
            <b className="mono">
              <img src={WAX_ICON} alt="" />
              {wax(prizes.wax)}
            </b>
            <small>WAX (Top 16)</small>
          </div>
          <div className="ptour__potfig">
            <b className="mono">
              <img src={TLM_ICON} alt="" />
              {tlm(prizes.tlm)}
            </b>
            <small>TLM</small>
          </div>
        </div>
      ) : (
        <p className="ptour__fine">The pool is still being collected.</p>
      )}
    </section>
  )
}

function Conditions({ weather }: { weather: { planet: string; weather?: Weather }[] }) {
  const rolled = weather.filter((w): w is { planet: string; weather: Weather } => !!w.weather)
  if (!rolled.length) return null
  return (
    <section className="ptour__card">
      <span className="ptour__kick">Conditions</span>
      <div className="ptour__cond">
        {rolled.map((w) => {
          const on = weatherTargets(w.weather)
          return (
            <div className="ptour__condrow" key={`${w.planet}-${w.weather.weather_id}`}>
              <WeatherPanel weather={w.weather} tooltip={false} />
              <small>{on.length ? on.join(', ') : 'Every fighter'}</small>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Five fighters as squares, and the card pair under them.
 *
 * The crew card and the weapon each get their own tile at the card's own
 * shape — split into one square they were two slivers nobody could read.
 */
function TeamSquares({
  faces,
  crew,
  weapon,
  onSlot,
}: {
  faces: ({ classname: string; racename: string; level?: number } | null)[]
  crew?: CardTemplate | null
  weapon?: CardTemplate | null
  onSlot?: (tab: 'fighters' | 'crew' | 'weapon') => void
}) {
  const Tag = onSlot ? 'button' : 'div'
  /* Read-only with nothing to show: an entry whose cards the row does not carry. */
  const showCards = !!onSlot || !!crew || !!weapon
  return (
    <div className="ptour__teamwrap">
      <div className="ptour__team">
        {faces.map((f, i) => (
          <Tag
            key={i}
            type={onSlot ? 'button' : undefined}
            className={`ptour__slot${f ? '' : ' is-empty'}`}
            onClick={onSlot ? () => onSlot('fighters') : undefined}
          >
            {f ? (
              <>
                <GameImg src={fighterAvatar(f)} fallback={fighterArtFallback()} alt="" />
                {f.level !== undefined && <small className="mono">{f.level}</small>}
              </>
            ) : (
              '+'
            )}
          </Tag>
        ))}
      </div>
      {showCards && (
        <div className="ptour__cards">
          {(
            [
              ['crew', 'Crew', crew],
              ['weapon', 'Weapon', weapon],
            ] as const
          ).map(([kind, label, card]) => (
            <Tag
              key={kind}
              type={onSlot ? 'button' : undefined}
              className={`ptour__cardslot${card ? '' : ' is-empty'}`}
              onClick={onSlot ? () => onSlot(kind) : undefined}
            >
              <span className="ptour__cardart">
                {card ? (
                  <GameImg
                    src={asset(`/assets/cards/${card.template_id}.webp`)}
                    /* Art the build does not ship: the card's own image, then the card back. */
                    fallback={[ipfsImage(card.img), asset('/assets/default-card.png')].filter(
                      (x): x is string => !!x,
                    )}
                    alt=""
                  />
                ) : (
                  '+'
                )}
              </span>
              <span className="ptour__cardtext">
                <small>{label}</small>
                <b>{card ? card.name : `Pick a ${label.toLowerCase()} card`}</b>
              </span>
            </Tag>
          ))}
        </div>
      )}
    </div>
  )
}

/** One fight as a row: when, both sides, and what can be done with it. */
function FightRow({
  m,
  slot,
  wallet,
  now,
  live,
  locked = false,
  onWatch,
}: {
  m: TournamentMatchup
  slot: number
  wallet: string
  now: number
  live: boolean
  /** Before the fighting starts: nothing on, nothing to watch. */
  locked?: boolean
  onWatch: () => void
}) {
  /* The fight on now keeps its result to itself until its slot is over:
     the chain knows it the moment the slot opens, the watcher should not. */
  const w = live ? 0 : winnerSide(m)
  const at = Number.isFinite(chainTime(m.play_time)) ? chainTime(m.play_time) : slot
  const mine = isIn(m, wallet)
  const due = !locked && Number.isFinite(at) && at <= now
  const watchable = !!m.wallet_player2 && (w > 0 || due)
  const side = (s: 1 | 2) => {
    const e = sideOf(m, s)
    const cls = w === 0 ? '' : w === s ? ' is-won' : ' is-lost'
    return (
      <span className={`ptour__side${cls}${e.wallet === wallet ? ' is-me' : ''}`}>
        <PlayerAvatar id={e.avatar} name={e.tag} className="ptour__sideav" size={28} />
        <span className="ptour__sidename">{e.tag || e.wallet || 'Being drawn'}</span>
        {w === s && <em>Win</em>}
      </span>
    )
  }
  return (
    <div className={`ptour__fight${live ? ' is-live' : mine ? ' is-mine' : ''}`}>
      <span className="ptour__when">
        <Clock ms={at} />
        <small>{live ? 'on now' : w ? 'fought' : due ? 'due' : at > now ? `in ${inText(at - now)}` : 'to come'}</small>
      </span>
      <span className="ptour__sides">
        {side(1)}
        {m.wallet_player2 ? side(2) : <span className="ptour__side is-tbd">Opponent being drawn</span>}
      </span>
      {live && !w ? (
        <button type="button" className="ptour__tag ptour__tag--live" onClick={onWatch}>
          Live
        </button>
      ) : watchable ? (
        <button type="button" className="ptour__play" onClick={onWatch} aria-label="Watch" />
      ) : mine ? (
        <span className="ptour__tag ptour__tag--next">Yours</span>
      ) : (
        <span className="ptour__play is-off" aria-hidden="true" />
      )}
    </div>
  )
}

/** A slot nobody has been drawn into yet. */
function SlotRow({ at, now, label }: { at: number; now: number; label: string }) {
  return (
    <div className="ptour__fight">
      <span className="ptour__when">
        <Clock ms={at} />
        <small>{at > now ? `in ${inText(at - now)}` : 'to come'}</small>
      </span>
      <span className="ptour__sides">
        <span className="ptour__side is-tbd">{label}</span>
      </span>
      <span className="ptour__tag ptour__tag--slot">Slot</span>
    </div>
  )
}

/**
 * One round: its fights, or its slots while it is waiting to be drawn.
 *
 * A round is drawn only once the one before it is over, and even then the
 * contract writes its pairings in batches — so a round can be the current
 * one with half its rows, or none. Whatever is drawn is shown; the rest
 * stay slots, labelled as being drawn.
 */
function RoundList({
  board,
  round,
  rows,
  wallet,
  now,
  mineOnly,
  current,
  locked = false,
  onWatch,
}: {
  board: Board
  round: number
  rows: TournamentMatchup[]
  wallet: string
  now: number
  mineOnly: boolean
  current: boolean
  locked?: boolean
  onWatch: (m: TournamentMatchup) => void
}) {
  const live = current && !locked ? liveFight(rows, now) : null
  const size = board.sizes[round] ?? rows.length
  const sorted = [...rows].sort((a, b) => a.index - b.index)
  const drawn = new Set(sorted.map((m) => m.index))
  const waiting = Array.from({ length: size }, (_, i) => i).filter((i) => !drawn.has(i))
  const shown = mineOnly ? sorted.filter((m) => isIn(m, wallet)) : sorted
  const before = round > 0 ? board.name(round - 1).toLowerCase() : 'signup'
  const being = current || (round === board.current && board.drawing(round))
  return (
    <div className="ptour__list">
      {shown.map((m) => (
        <FightRow
          key={m.index}
          m={m}
          slot={board.slots[round]?.[m.index] ?? NaN}
          wallet={wallet}
          now={now}
          live={!!live && live.index === m.index}
          locked={locked}
          onWatch={() => onWatch(m)}
        />
      ))}
      {!mineOnly &&
        waiting.map((i) => (
          <SlotRow
            key={`slot-${i}`}
            at={board.slots[round]?.[i] ?? NaN}
            now={now}
            label={being ? 'Being drawn…' : `Drawn after the ${before}`}
          />
        ))}
      {mineOnly && shown.length === 0 && <p className="ptour__note">You are not in this round.</p>}
    </div>
  )
}

/** The rounds after the one in view, a line each — for a long schedule. */
function LaterRounds({ board, from, now, onSelect }: { board: Board; from: number; now: number; onSelect: (r: number) => void }) {
  const later = Array.from({ length: Math.max(0, board.rounds - from) }, (_, i) => from + i)
  if (!later.length) return null
  return (
    <div className="ptour__list">
      {later.map((r) => {
        const s = board.slots[r] ?? []
        return (
          <button type="button" key={r} className="ptour__later" onClick={() => onSelect(r)}>
            <b>{board.name(r)}</b>
            <span className="mono">
              {s.length} fight{s.length === 1 ? '' : 's'} · {when(s[0] ?? NaN, now)}
              {s.length > 1 ? ` – ${timeOf(s[s.length - 1])}` : ''}
            </span>
            <i aria-hidden="true">›</i>
          </button>
        )
      })}
    </div>
  )
}

/** The WAX places, all sixteen, whatever the size of the field. */
function PrizeLadder({ board, mark }: { board: Board; mark?: number }) {
  return (
    <div className="ptour__ladder">
      {waxBands(16).map((b, i) => {
        const here = !!mark && mark >= b.from && mark <= b.to
        const label = b.from === b.to ? place(b.from) : `${place(b.from)}–${place(b.to)}`
        return (
          <div key={b.from} className={`ptour__rung${i === 0 ? ' is-top' : ''}${here ? ' is-me' : ''}`}>
            <b>
              {label}
              {here && <i className="ptour__you">You</i>}
            </b>
            <em className="mono">
              {wax(waxFor(board.prizes, b.from))}
              <img src={WAX_ICON} alt="" />
            </em>
          </div>
        )
      })}
    </div>
  )
}

/**
 * What a run is worth in TLM, round by round: the total a player holds
 * once they have won that far.
 *
 * Two ways in when seeds skip the opening round — through it, or past it
 * on a free pass — and they are worth very different amounts, so a player
 * in the tournament sees their own and anyone else sees both side by side.
 */
function TlmTable({ board, wallet }: { board: Board; wallet: string }) {
  const run = board.runs.get(wallet)
  const per = board.prizes.perPoint
  const fromOpening = new Map(winsAhead(0, 0, board.rounds, board.sizes).map((s) => [s.round, s.points]))
  const withPass = new Map(
    board.opening ? winsAhead(10, 1, board.rounds, board.sizes).map((s) => [s.round, s.points]) : [],
  )
  const both = board.opening && !run
  const mine = run?.pass ? withPass : fromOpening
  const cell = (p: number | undefined) =>
    p === undefined ? (
      <span className="ptour__tlmval is-none">—</span>
    ) : (
      <span className="ptour__tlmval">
        <b className="mono">{tlm(p * per)} TLM</b>
        <small className="mono">Trial {tlm((p * per) / 10)}</small>
      </span>
    )
  const rows: { key: string; label: string; a: number | undefined; b?: number | undefined }[] = []
  if (board.opening && both) {
    /* The first step either way: through the opening round, or past it on seed. */
    rows.push({ key: 'first', label: `Win ${board.name(0)} or free pass`, a: fromOpening.get(0), b: 10 })
  } else if (board.opening && run?.pass) {
    rows.push({ key: 'pass', label: 'Free pass', a: 10 })
  }
  for (let r = both ? 1 : 0; r < board.rounds; r++) {
    rows.push({
      key: String(r),
      label: `Win ${board.name(r) === 'Final' ? 'the Final' : board.name(r)}`,
      a: both ? fromOpening.get(r) : mine.get(r),
      b: withPass.get(r),
    })
  }
  return (
    <div className="ptour__tlmtable">
      {both && (
        <div className="ptour__tlmrow ptour__tlmrow--head">
          <span />
          <small>From the {board.name(0).toLowerCase()}</small>
          <small>With a free pass</small>
        </div>
      )}
      {rows
        .filter((r) => both || r.a !== undefined)
        .map((r) => (
          <div key={r.key} className={`ptour__tlmrow${both ? ' is-two' : ''}`}>
            <span className="ptour__tlmlabel">{r.label}</span>
            {cell(r.a)}
            {both && cell(r.b)}
          </div>
        ))}
    </div>
  )
}

function PrizeSheet({ board, wallet, onClose }: { board: Board; wallet: string; onClose: () => void }) {
  const mine = board.runs.get(wallet)
  const rank = mine ? board.rankOf(wallet) : 0
  return (
    <Sheet title="Prizes" onClose={onClose}>
      <div className="ptour__sheet">
        <div className="ptour__pot">
          <div className="ptour__potfig">
            <b className="mono">
              <img src={WAX_ICON} alt="" />
              {wax(board.prizes.wax)}
            </b>
            <small>WAX (Top 16)</small>
          </div>
          <div className="ptour__potfig">
            <b className="mono">
              <img src={TLM_ICON} alt="" />
              {tlm(board.prizes.tlm)}
            </b>
            <small>TLM</small>
          </div>
        </div>
        <span className="ptour__kick ptour__kick--gold">WAX (Top 16)</span>
        <PrizeLadder board={board} mark={rank} />
        <span className="ptour__kick ptour__kick--gold">TLM</span>
        <TlmTable board={board} wallet={wallet} />
        <p className="ptour__fine">
          Trial accounts receive 10% of every prize. Rewards are paid out after the tournament ends.
        </p>
      </div>
    </Sheet>
  )
}

function WithdrawSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Withdraw?" onClose={onClose}>
      <div className="ptour__sheet">
        <p className="ptour__sub">
          Withdrawing would take your team back out before signup closes, and you could enter again
          until then.
        </p>
        <div className="ptour__next">
          <span>The tournament contract has no withdraw action yet</span>
          <em>Not possible yet</em>
        </div>
        <div className="ptour__two">
          <button type="button" className="btn" onClick={onClose}>
            Stay in
          </button>
          <button type="button" className="btn ptour__btnred" disabled>
            Withdraw
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function VsCard({ a, b, aSub, bSub }: { a: Entrant; b: Entrant | null; aSub?: string; bSub?: string }) {
  return (
    <div className="ptour__vs">
      <span className="ptour__corner">
        <PlayerAvatar id={a.avatar} name={a.tag} className="ptour__cornerav" size={56} />
        <b>{a.tag || a.wallet}</b>
        {aSub && <small>{aSub}</small>}
      </span>
      <span className="ptour__vsmark">VS</span>
      <span className="ptour__corner">
        {b ? (
          <>
            <PlayerAvatar id={b.avatar} name={b.tag} className="ptour__cornerav" size={56} />
            <b>{b.tag || b.wallet}</b>
            {bSub && <small>{bSub}</small>}
          </>
        ) : (
          <>
            <span className="ptour__cornerav ptour__cornerav--tbd">?</span>
            <b>Being drawn</b>
          </>
        )}
      </span>
    </div>
  )
}

/* ---------- before signup: the champion's spotlight ---------- */

/** One step of the next tournament, for the spotlight's schedule. */
export interface NextStep {
  key: 'preparing' | 'signup' | 'draw' | 'fights'
  startMs: number
  endMs: number
}

const NEXT_STEP_TEXT: Record<NextStep['key'], [string, string]> = {
  preparing: ['Preparing', 'weather rolled, pot collected'],
  signup: ['Signup opens', 'pick five fighters, a crew card and a weapon'],
  draw: ['Signup closes · the draw', 'seeds set, free passes handed out'],
  fights: ['The fights', 'every round live, every fight to watch'],
}

/**
 * The next tournament's four steps, from its schedule — the template's steps
 * laid out from its start, or a plan's own times.
 */
export function nextSteps(steps: { name: string; startMs: number; endMs: number }[]): NextStep[] {
  const at = (n: string) => steps.find((s) => s.name === n)
  const out: NextStep[] = []
  const prep = at('set_weather') ?? at('get_rewards')
  if (prep) out.push({ key: 'preparing', startMs: prep.startMs, endMs: at('get_rewards')?.endMs ?? prep.endMs })
  const signup = at('signup')
  if (signup) out.push({ key: 'signup', startMs: signup.startMs, endMs: signup.endMs })
  const draw = at('close_signup')
  if (draw) out.push({ key: 'draw', startMs: draw.startMs, endMs: at('create_matchups')?.endMs ?? draw.endMs })
  const fights = at('battle')
  if (fights) out.push({ key: 'fights', startMs: fights.startMs, endMs: fights.endMs })
  return out
}

/** A step's time, as the schedule shows it: "Tue 23:00", or a range for the fights. */
function stepTime(s: NextStep, now: number): string {
  if (s.key === 'fights') return `${when(s.startMs, now)} – ${timeOf(s.endMs)}`
  if (s.key === 'preparing') return `from ${when(s.startMs, now)}`
  return when(s.startMs, now)
}

/** The last tournament's champion, from its fights or, once they are gone, the Hall of Fame. */
interface Champion {
  who: Entrant
  /** Who they beat in the final, where the fights still say. */
  beat: Entrant | null
  day: number | null
  players: number
  /** What they were paid, where the tournament is still on chain to work it out. */
  wax: number | null
  tlm: number | null
  /** The five they brought, for the spotlight. */
  fighterIds: number[]
  final: { m: TournamentMatchup; round: number } | null
}

function useChampion(past: PastTournament | null, hof: TournamentHof[], finalAfterMs = 0): Champion | null {
  return useMemo(() => {
    if (past) {
      const rounds = Number(past.stage.rounds ?? 0)
      const last = past.history[rounds - 1] ?? past.history[past.history.length - 1] ?? []
      const final = last[0]
      const w = final ? winnerSide(final) : 0
      if (final && w) {
        const players = Number(past.stage.player_count ?? 0)
        const runs = replay(past.history, passesFrom(past.history, []), roundSizes(players))
        const who = sideOf(final, w as 1 | 2)
        const prizes = prizesOf(past.stage)
        const points = runs.get(who.wallet)?.points ?? 0
        return {
          who,
          beat: sideOf(final, w === 1 ? 2 : 1),
          day: chainTime(final.play_time),
          players,
          wax: waxFor(prizes, 1),
          tlm: points * prizes.perPoint,
          fighterIds: w === 1 ? final.fighter_ids_player1 : final.fighter_ids_player2,
          final: { m: final, round: past.history.indexOf(last) },
        }
      }
    }
    const byName = new Map<string, TournamentHof[]>()
    for (const r of hof) byName.set(r.tournament_name, [...(byName.get(r.tournament_name) ?? []), r])
    const latest = [...byName.values()].sort(
      (a, b) => chainTime(b[0].tournament_date) - chainTime(a[0].tournament_date),
    )[0]
    const top = latest?.find((r) => r.rank === 1)
    if (!top) return null
    const second = latest.find((r) => r.rank === 2)
    return {
      who: { wallet: top.wallet, tag: top.gamertag, avatar: top.avatar },
      beat: second ? { wallet: second.wallet, tag: second.gamertag, avatar: second.avatar } : null,
      day: chainTime(top.tournament_date) + finalAfterMs,
      players: 0,
      wax: null,
      tlm: null,
      fighterIds: [],
      final: null,
    }
  }, [past, hof, finalAfterMs])
}

/** The champion's five, read back by id once — they are the spotlight's picture. */
function useChampionTeam(ids: number[]) {
  const [team, setTeam] = useState<{ classname: string; racename: string }[]>([])
  const key = ids.join(',')
  useEffect(() => {
    if (!ids.length) {
      setTeam([])
      return
    }
    let live = true
    fetchFightersByIds(ids)
      .then((rows) => live && setTeam(rows.map((f) => ({ classname: f.classname, racename: f.racename }))))
      .catch(() => live && setTeam([]))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return team
}

/**
 * Between tournaments: the champion's spotlight.
 *
 * The screen belongs to whoever won the last tournament — their own five in
 * a gold spotlight, their name and what they took home — beside the
 * countdown, the next tournament's schedule, the Hall of Fame, the final to
 * watch again and the full results. With no champion to show, the gate hall.
 */
function BeforeSignup(
  p: PhoneTournamentProps & { onHof: () => void; onWatch: (m: TournamentMatchup, round: number) => void },
) {
  const desk = useContext(Desk)
  const champ = useChampion(p.past, p.hof, p.finalAfterMs)
  const team = useChampionTeam(champ?.fighterIds ?? [])
  const opens = p.signupAt
  const steps = p.schedule ?? []
  const nowKey: NextStep['key'] = p.phase === 'preparing' ? 'preparing' : 'signup'

  const countdown = (
    <div className="ptour__spotclock">
      <div className="ptour__board">
        <small>{Number.isFinite(opens) ? 'Signup opens in' : 'Next tournament'}</small>
        <b className="mono">{Number.isFinite(opens) ? boardClock(opens - p.now) : 'Not scheduled'}</b>
        {Number.isFinite(opens) && <span>{dayTime(opens)}</span>}
      </div>
    </div>
  )

  if (!champ) {
    /* No tournament has finished yet: the gate hall, as before. */
    const crowd = p.ringFighters.slice(0, 5)
    return (
      <>
        <Head sub={Number.isFinite(opens) ? `Next one opens ${dayLabel(opens)}` : 'Between tournaments'} chip={<HofChip onClick={p.onHof} />} />
        <div className="ptour__hero">
          <div className="ptour__board">
            <small>{Number.isFinite(opens) ? 'Signup opens in' : 'Next tournament'}</small>
            <b className="mono">{Number.isFinite(opens) ? boardClock(opens - p.now) : 'Not scheduled'}</b>
            {Number.isFinite(opens) && <span>{dayTime(opens)}</span>}
          </div>
          <div className="ptour__crowd" aria-hidden="true">
            {crowd.map((f) => (
              <GameImg key={f.fighter_id} src={fighterSilhouette(f)} fallback={fighterSilhouetteFallback()} alt="" />
            ))}
          </div>
        </div>
        {p.phase === 'preparing' && p.stage && <PotCard stage={p.stage} field={null} />}
      </>
    )
  }

  const shown = team.length ? team : p.ringFighters.slice(0, 5)
  const silhouettes = !team.length
  const figures = desk ? shown : shown.slice(0, 3)
  const watchFinal = champ.final ? () => p.onWatch(champ.final!.m, champ.final!.round) : undefined

  const nameBlock = (
    <div className="ptour__spotname">
      <PlayerAvatar id={champ.who.avatar} name={champ.who.tag} className="ptour__spotav" size={desk ? 96 : 52} />
      <span className="ptour__kick ptour__kick--gold">
        Reigning champion{champ.day && desk ? ` · ${dayLabel(champ.day)}` : ''}
      </span>
      <h1 className="ptour__spottag">{champ.who.tag || champ.who.wallet}</h1>
      {champ.beat && (
        <p className="ptour__sub">
          Beat <b>{champ.beat.tag || champ.beat.wallet}</b> in the final
          {champ.players ? ` · ${formatNumber(champ.players)} players` : ''}
        </p>
      )}
      {champ.wax !== null && (
        <span className="ptour__spotpaid mono">
          <span>
            <img src={WAX_ICON} alt="" />
            {wax(champ.wax)}
          </span>
          <span>
            <img src={TLM_ICON} alt="" />
            {tlm(champ.tlm ?? 0)}
          </span>
        </span>
      )}
    </div>
  )

  const stage = (
    <div className="ptour__spotstage" aria-hidden="true">
      <span className="ptour__spotlight" />
      <div className={`ptour__spotteam${silhouettes ? ' is-sil' : ''}`}>
        {figures.map((f, i) => (
          <GameImg
            key={i}
            src={silhouettes ? fighterSilhouette(f) : fighterArt(f)}
            fallback={silhouettes ? fighterSilhouetteFallback() : fighterArtFallback()}
            alt=""
          />
        ))}
      </div>
    </div>
  )

  const buttons = (
    <div className="ptour__two">
      <button type="button" className="btn btn--gold" disabled={!watchFinal} onClick={watchFinal}>
        <span className="ptour__playicon" />
        {desk ? 'Watch the final' : 'The final'}
      </button>
      <button type="button" className="btn" disabled={!p.onOpenPast} onClick={p.onOpenPast}>
        {desk ? 'Full results' : 'Results'}
      </button>
    </div>
  )

  if (!desk) {
    return (
      <>
        {/* The whole screen: the champion at the top, the countdown and the
            buttons docked at the foot, all over the one arena. */}
        <section className="ptour__spot ptour__spot--phone">
          <div className="ptour__spottop">
            <span className="ptour__kick ptour__kick--gold">Reigning champion</span>
            <button type="button" className="ptour__pill ptour__pill--hof" onClick={p.onHof}>
              <img src={TROPHY} alt="" />
              Hall of Fame
            </button>
          </div>
          {nameBlock}
          {stage}
          <div className="ptour__spotdock">
            <section className="ptour__spotcard ptour__spotglass">{countdown}</section>
            {p.phase === 'preparing' && p.stage && <PotCard stage={p.stage} field={null} />}
            {buttons}
          </div>
        </section>
      </>
    )
  }

  return (
    <section className="ptour__spot">
      <div className="ptour__spotleft">
        {nameBlock}
        {stage}
      </div>
      <div className="ptour__spotright">
        <section className="ptour__card ptour__spotcard">{countdown}</section>
        {steps.length > 0 && (
          <section className="ptour__card ptour__spotcard">
            <span className="ptour__kick">The next tournament</span>
            <div className="ptour__sched">
              {steps.map((s) => (
                <div key={s.key} className={`ptour__schedstep${s.key === nowKey ? ' is-now' : ''}`}>
                  <i />
                  <span>
                    <b>{NEXT_STEP_TEXT[s.key][0]}</b>
                    <small>{NEXT_STEP_TEXT[s.key][1]}</small>
                  </span>
                  <em className="mono">{stepTime(s, p.now)}</em>
                </div>
              ))}
            </div>
          </section>
        )}
        {p.phase === 'preparing' && p.stage && <PotCard stage={p.stage} field={null} />}
        <span className="ptour__spotgap" />
        <button type="button" className="ptour__card ptour__spothof" onClick={p.onHof}>
          <img src={TROPHY} alt="" className="ptour__spotcup" />
          <span>
            <span className="ptour__kick ptour__kick--gold">Hall of Fame</span>
            <b>Every tournament's top four</b>
            <span className="ptour__faces">
              {hofFaces(p.hof).map((r) => (
                <PlayerAvatar key={r.index} id={r.avatar} name={r.gamertag} className="ptour__face" size={26} />
              ))}
              <span>{hofCount(p.hof)}</span>
            </span>
          </span>
          <span className="btn btn--sm">Open ›</span>
        </button>
        {buttons}
      </div>
    </section>
  )
}

/** "3 tournaments so far", or what happens when there are none yet. */
function hofCount(rows: TournamentHof[]): string {
  const n = new Set(rows.map((r) => r.tournament_name)).size
  return n ? `${formatNumber(n)} tournament${n === 1 ? '' : 's'} so far` : 'The first top four is written after a final'
}

/** The newest tournament's four, for the Hall of Fame card. */
function hofFaces(rows: TournamentHof[]): TournamentHof[] {
  const newest = [...rows].sort((a, b) => chainTime(b.tournament_date) - chainTime(a.tournament_date))[0]
  if (!newest) return []
  return rows
    .filter((r) => r.tournament_name === newest.tournament_name)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
}

/* ---------- signup on a desktop, not entered: the line-up stage ---------- */

/** The same spread every render, so particles do not jump about when the screen redraws. */
function spread(n: number, seed: number): number[] {
  const out: number[] = []
  let x = seed
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280
    out.push(x / 233280)
  }
  return out
}

/**
 * A fighter's element, as a little weather around it on its pedestal.
 *
 * Embers for fire, motes on the wind for air, fireflies for nature, facets
 * for gem, a sheen across the armour for metal and floating dust for
 * neutral. CSS only — a handful of small shapes moved by transform and
 * opacity — and still for anyone who asks for less motion.
 */
function ElementFx({ element, art, seed }: { element: string; art: string; seed: number }) {
  const r = spread(40, seed + 7)
  const at = (i: number, a: number, b: number) => (a + r[i % r.length] * (b - a)).toFixed(2)
  const style = (v: Record<string, string>) => v as React.CSSProperties
  if (element === 'metal') {
    return <img className="ptour__fx ptour__fx--sheen" src={art} alt="" aria-hidden="true" style={style({ '--del': `-${at(0, 0, 2.8)}s` })} />
  }
  const kinds: Record<string, { cls: string; n: number; vars: (i: number) => Record<string, string> }> = {
    fire: { cls: 'ember', n: 11, vars: (i) => ({ '--x': `${at(i, 15, 85)}%`, '--dx': `${at(i + 9, -25, 25)}px`, '--dur': `${at(i + 3, 2.2, 3.6)}s`, '--del': `-${at(i + 5, 0, 3.6)}s` }) },
    air: { cls: 'mote', n: 10, vars: (i) => ({ '--x': `${at(i, 0, 60)}%`, '--y': `${at(i + 4, 10, 90)}%`, '--dur': `${at(i + 2, 3, 5)}s`, '--del': `-${at(i + 6, 0, 5)}s` }) },
    nature: { cls: 'fly', n: 6, vars: (i) => ({ '--x': `${at(i, 8, 85)}%`, '--y': `${at(i + 3, 15, 75)}%`, '--dx': `${at(i + 5, -25, 25)}px`, '--dy': `${at(i + 7, -25, 25)}px`, '--dur': `${at(i + 1, 3, 5)}s`, '--del': `-${at(i + 8, 0, 2)}s` }) },
    gem: { cls: 'facet', n: 8, vars: (i) => ({ '--x': `${at(i, 18, 82)}%`, '--dx': `${at(i + 9, -22, 22)}px`, '--dur': `${at(i + 3, 2.6, 3.8)}s`, '--del': `-${at(i + 5, 0, 3.8)}s` }) },
    neutral: { cls: 'dust', n: 9, vars: (i) => ({ '--x': `${at(i, 8, 88)}%`, '--y': `${at(i + 3, 12, 85)}%`, '--dx': `${at(i + 5, -18, 18)}px`, '--dy': `${at(i + 7, -18, 18)}px`, '--dur': `${at(i + 1, 4, 6)}s`, '--del': `-${at(i + 8, 0, 3)}s` }) },
  }
  const k = kinds[element]
  if (!k) return null
  return (
    <span className="ptour__fx" aria-hidden="true">
      {Array.from({ length: k.n }, (_, i) => (
        <i key={i} className={`ptour__fx-${k.cls}`} style={style(k.vars(i))} />
      ))}
    </span>
  )
}


/**
 * The team about to be fielded, on a stage.
 *
 * Five pedestals across the arena, each pick standing on the next one at full
 * height with its level and a way off, and the card pair at the end of the
 * line. An empty pedestal or card opens that tab of the roster below it.
 */
function LineupStage({ team, crew, weapon, onSlot, onRemove, onClear }: {
  team: (RosterFighter | null)[]
  crew: CardTemplate | null
  weapon: CardTemplate | null
  onSlot: (tab: 'fighters' | 'crew' | 'weapon') => void
  onRemove?: (f: RosterFighter) => void
  onClear?: () => void
}) {
  const picked = team.filter(Boolean).length
  const nextAt = team.findIndex((f) => !f)
  const card = (kind: 'crew' | 'weapon', label: string, c: CardTemplate | null) =>
    c ? (
      <button type="button" className="ptour__lucard" onClick={() => onSlot(kind)}>
        <GameImg
          src={asset(`/assets/cards/${c.template_id}.webp`)}
          fallback={[ipfsImage(c.img), asset('/assets/default-card.png')].filter((x): x is string => !!x)}
          alt=""
        />
        <span>
          <small>{label}</small>
          <b>{c.name}</b>
        </span>
      </button>
    ) : (
      <button type="button" className="ptour__luslot ptour__luslot--card" onClick={() => onSlot(kind)}>
        <i>+</i>
        <small>{label}</small>
      </button>
    )
  return (
    <section className="ptour__lineup">
      <div className="ptour__lutop">
        <span className="ptour__kick ptour__kick--gold">Your team · {picked} of 5</span>
        {picked > 0 && onClear && (
          <button type="button" className="ptour__pill" onClick={onClear}>
            Clear team
          </button>
        )}
      </div>
      <div className="ptour__lurow">
        {team.map((f, i) => (
          <div
            key={i}
            className={`ptour__ped${f ? ' is-full' : i === nextAt ? ' is-next' : ''}`}
            data-el={f?.element || undefined}
          >
            {f ? (
              <div className="ptour__pedfig">
                <span className="ptour__pedlv mono">L{f.stats?.level ?? 1}</span>
                {onRemove && (
                  <button type="button" className="ptour__pedx" aria-label="Take off the team" onClick={() => onRemove(f)}>
                    ×
                  </button>
                )}
                <GameImg src={fighterArt(f)} fallback={fighterArtFallback()} alt={f.classname} />
                <ElementFx element={f.element} art={fighterArt(f)} seed={f.fighter_id} />
              </div>
            ) : (
              <button type="button" className="ptour__luslot" onClick={() => onSlot('fighters')}>
                <i>+</i>
                <small>Fighter {i + 1}</small>
              </button>
            )}
            <span className="ptour__pedglow" />
            <b className="ptour__pedname">
              {f?.element && (
                <img className="ptour__pedel" src={asset(`/assets/icons/elements/${f.element}.png`)} alt={f.element} title={f.element} />
              )}
              {f ? f.classname : ' '}
            </b>
          </div>
        ))}
        <div className="ptour__lucards">
          {card('crew', 'Crew card', crew)}
          {card('weapon', 'Weapon', weapon)}
        </div>
      </div>
    </section>
  )
}

function DeskLineup(
  p: PhoneTournamentProps & { board: Board; onHof: () => void; closes: number; passesNow: number },
) {
  const pickerAt = useRef<HTMLDivElement>(null)
  const open = (tab: 'fighters' | 'crew' | 'weapon') => {
    p.onPick(tab)
    pickerAt.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const picked = p.team.filter(Boolean).length
  /* Where this team would seed, among those already in. */
  const seed = p.field.filter((s) => s.score >= p.score).length + 1
  const you = {
    wallet: p.wallet,
    playertag: p.me?.tag || 'You',
    avatar: p.me?.avatar ?? 0,
    score: p.score,
  }
  return (
    <>
      <Head
        sub={`Build your team · signup closes ${Number.isFinite(p.closes) ? when(p.closes, p.now) : 'soon'}`}
        chip={<HofChip onClick={p.onHof} />}
      />
      {/* The whole tournament ahead, as on every other screen of it. */}
      <Strip items={preDrawItems(p.timeline, p.now)} focus={0} />
      <Cols
        items={[
          [
            <LineupStage
              team={p.team}
              crew={p.crew}
              weapon={p.weapon}
              onSlot={open}
              onRemove={p.onRemove}
              onClear={p.onClearTeam}
            />,
            'main',
          ],
          [<div ref={pickerAt} className="ptour__lupicker">{p.picker}</div>, 'main'],
          [
            <section className="ptour__card ptour__spotcard">
              <div className="ptour__spotclock">
                <div className="ptour__board">
                  <small>Signup closes in</small>
                  <b className="mono">{Number.isFinite(p.closes) ? boardClock(p.closes - p.now) : '—'}</b>
                  {Number.isFinite(p.closes) && <span>{dayTime(p.closes)}</span>}
                </div>
              </div>
            </section>,
            'side',
          ],
          [<PotCard stage={p.stage} field={null} />, 'side'],
          [<Conditions weather={p.weather} />, 'side'],
          [<Entrants field={p.field} wallet={p.wallet} you={picked > 0 ? { ...you, seed } : { ...you, seed: 0 }} />, 'side'],
          [
            <div className="ptour__dock ptour__dock--side">
              <button
                type="button"
                className="btn btn--gold"
                disabled={!p.block.ready || p.busy || !p.canSign}
                onClick={p.onEnter}
              >
                {p.busy ? <span className="spinner" /> : <img src={ENERGY} alt="" />}
                Enter · {formatNumber(p.energyCost)} energy
              </button>
              <small className={p.block.ready ? 'is-ok' : 'is-short'}>
                {p.block.ready
                  ? `Team score ${formatNumber(p.score)} · you would seed ${seed} of ${p.field.length + 1}`
                  : p.block.reason}
              </small>
            </div>,
            'side',
          ],
        ]}
      />
    </>
  )
}

/* ---------- signup ---------- */

function Signup(
  p: PhoneTournamentProps & { board: Board; onHof: () => void; onWithdraw: () => void },
) {
  const signupStep = p.timeline.find((s) => s.name === 'signup')
  const closes = signupStep?.endMs ?? NaN
  const items = preDrawItems(p.timeline, p.now)
  const count = p.field.length
  /* Seeds that would skip the opening round if signup closed now. */
  const passesNow = bracketOf(Math.max(2, count + (p.mine ? 0 : 1))).freePasses
  const seedIfEntered = p.mine
    ? p.field.findIndex((s) => s.wallet === p.mine!.wallet) + 1
    : p.field.filter((s) => s.score >= p.score).length + 1
  const desk = useContext(Desk)
  if (desk && !p.mine) return <DeskLineup {...p} closes={closes} passesNow={passesNow} />

  return (
    <>
      <Head sub={Number.isFinite(closes) ? `Signup closes ${when(closes, p.now)}` : 'Signup open'} chip={<HofChip onClick={p.onHof} />} />
      <Strip items={items} focus={0} />

      <Cols
        items={[
          [
      p.mine && (
        <section className="ptour__card ptour__card--teal">
          <div className="ptour__status">
            <PlayerAvatar id={p.mine.avatar} name={p.mine.playertag} className="ptour__statusav ptour__statusav--me" size={56} />
            <div>
              <h2 className="ptour__state is-in">You're in</h2>
              <p className="ptour__sub">
                Entered {when(chainTime(p.mine.signup_timestamp), p.now)} · fights start{' '}
                {when(p.timeline.find((s) => s.name === 'battle')?.startMs ?? NaN, p.now)}
              </p>
            </div>
          </div>
          <TeamSquares faces={crewFaces(p.mine)} />
          <div className="ptour__stats">
            <div>
              <small>Score</small>
              <b className="mono">{formatNumber(p.mine.score)}</b>
            </div>
            <div>
              <small>Seed now</small>
              <b className="mono">
                {seedIfEntered} / {count}
              </b>
            </div>
            <div>
              <small>Free pass</small>
              <b className={seedIfEntered <= passesNow ? 'is-gold' : ''}>
                {passesNow > 0 ? (seedIfEntered <= passesNow ? 'For now' : 'Not now') : 'None'}
              </b>
            </div>
          </div>
          <p className="ptour__fine">
            {passesNow > 0
              ? `Right now the top ${passesNow} skip the opening round with 10 points. Seeds are fixed when signup closes.`
              : 'Right now the field is a power of two, so nobody skips the opening round.'}
          </p>
          <button type="button" className="btn btn--sm ptour__btnred ptour__withdraw" onClick={p.onWithdraw}>
            Withdraw
          </button>
        </section>
      ),
            'main',
          ],
          [<PotCard stage={p.stage} field={p.field} />, 'side'],
          [<Conditions weather={p.weather} />, 'side'],
          [
      !p.mine && (
        <>
          <section className="ptour__card">
            <div className="ptour__cardhead">
              <span className="ptour__kick">Your team</span>
              <button type="button" className="ptour__link" onClick={() => p.onPick('fighters')}>
                Change
              </button>
            </div>
            <TeamSquares
              faces={p.team.map((f) => (f ? { classname: f.classname, racename: f.racename, level: f.stats?.level } : null))}
              crew={p.crew}
              weapon={p.weapon}
              onSlot={p.onPick}
            />
            <div className="ptour__stats">
              <div>
                <small>Score</small>
                <b className="mono">{formatNumber(p.score)}</b>
              </div>
              <div>
                <small>Seed now</small>
                <b className="mono">
                  {seedIfEntered} / {count + 1}
                </b>
              </div>
              <div>
                <small>Free pass</small>
                <b className="is-gold">{passesNow > 0 ? `Top ${passesNow}` : 'None'}</b>
              </div>
            </div>
            <p className="ptour__fine">
              Seeding is by score: a point a fighter level, ten an ascension. Entering holds your five
              fighters until the tournament is done.
            </p>
          </section>

          <div className="ptour__dock">
            <button
              type="button"
              className="btn btn--gold"
              disabled={!p.block.ready || p.busy || !p.canSign}
              onClick={p.onEnter}
            >
              {p.busy ? <span className="spinner" /> : <img src={ENERGY} alt="" />}
              Enter · {formatNumber(p.energyCost)} energy
            </button>
            <small className={p.block.ready ? '' : 'is-short'}>
              {p.block.ready ? `Team score ${formatNumber(p.score)}` : p.block.reason}
            </small>
          </div>

        </>
      ),
            'main',
          ],
          [desk && <Entrants field={p.field} wallet={p.wallet} />, 'side'],
        ]}
      />
    </>
  )
}

/** Before the draw: signup, the draw, the fights, the results. */
function preDrawItems(timeline: TimelineStep[], now: number): StripItem[] {
  const find = (n: string) => timeline.find((s) => s.name === n)
  const signup = find('signup')
  const draw = find('close_signup')
  const battle = find('battle')
  const result = find('hall_of_fame') ?? find('reward_payout')
  const open = signup?.state === 'running'
  return [
    {
      key: 'signup',
      label: 'Signup',
      sub: open
        ? (signup?.endMs ?? NaN) > now
          ? `${inText((signup?.endMs ?? NaN) - now)} left`
          : 'closing'
        : when(signup?.startMs ?? NaN, now),
      state: open ? 'now' : signup?.state === 'done' ? 'done' : 'next',
    },
    { key: 'draw', label: 'Draw', sub: when(draw?.startMs ?? NaN, now), state: 'next' },
    { key: 'fights', label: 'Fights', sub: when(battle?.startMs ?? NaN, now), state: 'next' },
    { key: 'results', label: 'Results', sub: when(result?.startMs ?? battle?.endMs ?? NaN, now), state: 'next' },
  ]
}

/* ---------- the draw ---------- */

function Draw(p: PhoneTournamentProps & { board: Board; onPrizes: () => void }) {
  const { board } = p
  const items = drawnItems(board, p.history, p.phase, p.now)
  const opening = p.history[0] ?? []
  const drawing = board.drawing(0)
  const myFight = opening.find((m) => isIn(m, p.wallet))
  const myPass = board.passes.some((e) => e.wallet === p.wallet)
  const sizes = board.sizes
  const drawnCount = opening.length

  return (
    <>
      <Head
        sub={`${formatNumber(board.players)} players · ${board.rounds} rounds`}
        chip={<PrizesChip onClick={p.onPrizes} />}
      />
      <Strip items={items} focus={1} />

      <Cols
        items={[
          [
      drawing && (
        <section className="ptour__card">
          <div className="ptour__cardhead">
            <span className="ptour__kick ptour__kick--cyan">The draw is being made</span>
            <span className="ptour__tag ptour__tag--slot mono">
              {drawnCount} / {sizes[0] ?? 0}
            </span>
          </div>
          <p className="ptour__sub">
            Signup is closed and the seeds are set. The {board.name(0).toLowerCase()}'s matches are
            being drawn.
          </p>
        </section>
      ),
            'main',
          ],
          [
      p.mine && (myFight || myPass) && (
        <section className="ptour__card ptour__card--teal">
          <div className="ptour__cardhead">
            <span className="ptour__kick ptour__kick--teal">Your draw</span>
            {myFight && (
              <span className="ptour__tag ptour__tag--next">
                {fightName(0, board.rounds, board.opening)} {myFight.index + 1} ·{' '}
                {when(chainTime(myFight.play_time), p.now)}
              </span>
            )}
          </div>
          {myFight ? (
            <>
              <VsCard
                a={sideOf(myFight, myFight.wallet_player1 === p.wallet ? 1 : 2)}
                b={myFight.wallet_player2 ? sideOf(myFight, myFight.wallet_player1 === p.wallet ? 2 : 1) : null}
              />
              <p className="ptour__fine ptour__center">
                Win and you go through to the {board.name(1).toLowerCase()}.
              </p>
            </>
          ) : (
            <p className="ptour__sub">
              <b>Free pass.</b> Your seed puts you straight into the {board.name(1).toLowerCase()} with
              10 points.
            </p>
          )}
        </section>
      ),
            'main',
          ],
          [
      p.mine && !myFight && !myPass && drawing && (
        <section className="ptour__card ptour__card--teal">
          <span className="ptour__kick ptour__kick--teal">Your draw</span>
          <p className="ptour__sub">Not drawn yet — your opponent and your slot appear here.</p>
        </section>
      ),
            'main',
          ],
          [
      <section className="ptour__card ptour__card--gold">
        <div className="ptour__cardhead">
          <span className="ptour__kick ptour__kick--gold">Prizes</span>
          <button type="button" className="ptour__link" onClick={p.onPrizes}>
            All details ›
          </button>
        </div>
        <span className="ptour__kick">WAX (Top 16)</span>
        <PrizeLadder board={board} />
        <span className="ptour__kick">TLM</span>
        <TlmTable board={board} wallet={p.wallet} />
        <p className="ptour__fine">Trial accounts receive 10% of every prize.</p>
      </section>,
            'side',
          ],
          [
      <>
      <div className="ptour__rhead">
        <b>{board.name(0)}</b>
        <small>
          {sizes[0] ?? 0} fight{(sizes[0] ?? 0) === 1 ? '' : 's'}
          {board.opening ? ` · the top ${board.passes.length || freePassCount(p.stage, board.players)} skip it` : ''}
        </small>
      </div>
      <RoundList
        board={board}
        round={0}
        rows={opening}
        wallet={p.wallet}
        now={p.now}
        mineOnly={false}
        current
        locked
        onWatch={() => {}}
      />
      {board.passes.length > 0 && (
        <div className="ptour__byes">
          <span className="ptour__faces">
            {board.passes.slice(0, 6).map((e) => (
              <PlayerAvatar key={e.wallet} id={e.avatar} name={e.tag} className="ptour__face" size={26} />
            ))}
          </span>
          <span>
            Through on seed · <b>+10 points</b> each
          </span>
        </div>
      )}
      <div className="ptour__rhead">
        <b>After that</b>
        <small>each round is drawn when the one before ends</small>
      </div>
      <LaterRounds board={board} from={1} now={p.now} onSelect={() => {}} />
      </>,
            'main',
          ],
        ]}
      />
    </>
  )
}

/* ---------- fighting ---------- */

function StatusCard({ board, mine, wallet, history, now, onSeeFights }: {
  board: Board
  mine: TournamentSignup | undefined
  wallet: string
  history: TournamentMatchup[][]
  now: number
  onSeeFights?: () => void
}) {
  const run = board.runs.get(wallet)
  if (!run && !mine) return null
  const points = run?.points ?? Number(mine?.reward_points ?? 0)
  const rank = board.rankOf(wallet)
  const out = run?.outIn ?? null
  const round = board.current
  const rows = history[round] ?? []
  const next = rows.find((m) => isIn(m, wallet) && !winnerSide(m))
  const wonThis = rows.some((m) => isIn(m, wallet) && winnerSide(m) && sideOf(m, winnerSide(m) as 1 | 2).wallet === wallet)
  const avatar = mine?.avatar ?? run?.avatar ?? 0
  const tag = mine?.playertag ?? run?.tag ?? ''

  if (out !== null) {
    return (
      <section className="ptour__card ptour__card--out">
        <div className="ptour__status">
          <PlayerAvatar id={avatar} name={tag} className="ptour__statusav" size={56} />
          <div>
            <h2 className="ptour__state is-out">You're out</h2>
            <p className="ptour__sub">
              Beaten by <b>{run?.lostTo?.tag || run?.lostTo?.wallet}</b> in the {board.name(out).toLowerCase()}
            </p>
          </div>
        </div>
        <div className="ptour__stats">
          <div>
            <small>Points</small>
            <b className="mono">{points}</b>
          </div>
          <div>
            <small>Place now</small>
            <b className="mono">{rank ? place(rank) : '—'}</b>
          </div>
          {/* What this place pays: the WAX when it pays any, and the TLM either way. */}
          <div className="ptour__rewards">
            <small>Rewards</small>
            {waxFor(board.prizes, rank) > 0 && (
              <b className="mono">
                <img src={WAX_ICON} alt="" />
                {wax(waxFor(board.prizes, rank))}
              </b>
            )}
            <b className="mono">
              <img src={TLM_ICON} alt="" />
              {tlm(points * board.prizes.perPoint)}
            </b>
          </div>
        </div>
      </section>
    )
  }

  const nextAt = next ? chainTime(next.play_time) : NaN
  const foe = next ? sideOf(next, next.wallet_player1 === wallet ? 2 : 1) : null
  return (
    <section className="ptour__card ptour__card--teal">
      <div className="ptour__status">
        <PlayerAvatar id={avatar} name={tag} className="ptour__statusav ptour__statusav--me" size={56} />
        <div>
          <h2 className="ptour__state is-in">You're still in</h2>
          <p className="ptour__sub">
            <b>{points}</b> point{points === 1 ? '' : 's'} · {rank ? `${place(rank)} right now` : 'unranked'}
            {' · '}
            {wax(waxFor(board.prizes, rank))} WAX
          </p>
        </div>
      </div>
      {next ? (
        <button type="button" className="ptour__next" onClick={onSeeFights}>
          <span>
            {fightName(round, board.rounds, board.opening)} vs <b>{foe?.tag || 'being drawn'}</b> · {when(nextAt, now)}
          </span>
          <em className="mono">{nextAt > now ? `in ${inText(nextAt - now)}` : 'due now'}</em>
        </button>
      ) : (
        <div className="ptour__next">
          <span>
            {wonThis || board.drawing(round)
              ? round + (wonThis ? 1 : 0) < board.rounds
                ? `Through to the ${board.name(round + (wonThis ? 1 : 0)).toLowerCase()} — drawn when this round ends`
                : 'Through'
              : `In the ${board.name(round).toLowerCase()} — being drawn`}
          </span>
        </div>
      )}
    </section>
  )
}

function LiveCard({ board, round, rows, now, onWatch }: {
  board: Board
  round: number
  rows: TournamentMatchup[]
  now: number
  onWatch: (m: TournamentMatchup) => void
}) {
  const live = liveFight(rows, now)
  const upcoming = [...rows]
    .sort((a, b) => a.index - b.index)
    .find((m) => !winnerSide(m) && m.wallet_player2 && chainTime(m.play_time) > now)
  const m = live ?? upcoming
  if (!m) {
    if (!board.drawing(round)) return null
    return (
      <section className="ptour__card">
        <span className="ptour__kick ptour__kick--cyan">{board.name(round)} · being drawn</span>
        <p className="ptour__sub">
          This round is drawn from whoever is left once the last one ends. The pairings appear here
          as the chain writes them; the first fight is at{' '}
          <b>{when(board.slots[round]?.[0] ?? NaN, now)}</b>.
        </p>
      </section>
    )
  }
  const at = chainTime(m.play_time)
  return (
    <section className="ptour__live">
      <span className="ptour__kick ptour__kick--gold">
        {live ? <i className="ptour__livedot" /> : null}
        {live ? 'On now' : `Next · in ${inText(at - now)}`} · {fightName(round, board.rounds, board.opening)}{' '}
        {board.sizes[round] > 1 ? m.index + 1 : ''}
      </span>
      <VsCard a={sideOf(m, 1)} b={sideOf(m, 2)} />
      <button type="button" className="btn btn--gold" onClick={() => onWatch(m)}>
        <span className="ptour__playicon" />
        {live ? 'Watch' : `Starts ${when(at, now)}`}
      </button>
    </section>
  )
}

/** Your run, top to bottom: the pass, each fight, and what is still to come. */
function MyRun({ board, wallet, history, now, onWatch }: {
  board: Board
  wallet: string
  history: TournamentMatchup[][]
  now: number
  onWatch: (m: TournamentMatchup, round: number) => void
}) {
  const run = board.runs.get(wallet)
  if (!run) return <p className="ptour__note">You are not in this tournament.</p>
  const legs: ReactNode[] = []
  if (run.pass) {
    legs.push(
      <Leg key="pass" kind="pass" mark="★" head={`${board.name(0)}`} verdict="Free pass">
        <span>
          Through on seed<small>+10 points</small>
        </span>
      </Leg>,
    )
  }
  let points = run.pass ? 10 : 0
  let stillIn = true
  for (let r = 0; r < board.rounds; r++) {
    const m = (history[r] ?? []).find((x) => isIn(x, wallet))
    if (!m) continue
    const w = winnerSide(m)
    const meSide = m.wallet_player1 === wallet ? 1 : 2
    const foe = m.wallet_player2 ? sideOf(m, meSide === 1 ? 2 : 1) : null
    const at = chainTime(m.play_time)
    if (w) {
      const won = w === meSide
      if (won) points = 2 * points + r + (m.index === (board.sizes[r] ?? 0) - 1 ? 1 : 0)
      legs.push(
        <Leg
          key={r}
          kind={won ? 'won' : 'lost'}
          mark={won ? '✓' : '✕'}
          head={`${fightName(r, board.rounds, board.opening)} · ${when(at, now)}`}
          verdict={won ? 'Knocked out' : 'Beaten by'}
        >
          {foe && <PlayerAvatar id={foe.avatar} name={foe.tag} className="ptour__sideav" size={28} />}
          <span>
            <b>{foe?.tag || foe?.wallet}</b>
            <small>{won ? `${points} point${points === 1 ? '' : 's'} after it` : 'Your tournament ended here'}</small>
          </span>
          <button type="button" className="ptour__play" onClick={() => onWatch(m, r)} aria-label="Watch" />
        </Leg>,
      )
      if (!won) {
        stillIn = false
        break
      }
    } else {
      const ahead = winsAhead(points, r, board.rounds, board.sizes)[0]
      legs.push(
        <Leg key={r} kind="next" mark={String(r + 1)} head={`${fightName(r, board.rounds, board.opening)} · ${when(at, now)}`} verdict={at > now ? `in ${inText(at - now)}` : 'due now'}>
          {foe && <PlayerAvatar id={foe.avatar} name={foe.tag} className="ptour__sideav" size={28} />}
          <span>
            <b>{foe?.tag || 'Being drawn'}</b>
            <small>A win makes {ahead?.points ?? points} points</small>
          </span>
          {Number.isFinite(at) && at <= now ? (
            <button type="button" className="ptour__play" onClick={() => onWatch(m, r)} aria-label="Watch" />
          ) : (
            <span className="ptour__play is-off" aria-hidden="true" />
          )}
        </Leg>,
      )
      stillIn = false
      /* What would follow it. */
      winsAhead(ahead?.points ?? points, r + 1, board.rounds, board.sizes).forEach((s) =>
        legs.push(
          <Leg key={`if-${s.round}`} kind="if" mark={String(s.round + 1)} head={`${fightName(s.round, board.rounds, board.opening)} · ${when(board.slots[s.round]?.[0] ?? NaN, now)}`} verdict="if you win">
            <span>
              {s.round === board.rounds - 1 ? "The champion's fight" : 'Drawn after the round before'}
              <small>A win makes {s.points} points</small>
            </span>
          </Leg>,
        ),
      )
      break
    }
  }
  if (stillIn && run.outIn === null && board.current < board.rounds) {
    winsAhead(points, board.current, board.rounds, board.sizes).forEach((s) =>
      legs.push(
        <Leg key={`if-${s.round}`} kind="if" mark={String(s.round + 1)} head={`${fightName(s.round, board.rounds, board.opening)} · ${when(board.slots[s.round]?.[0] ?? NaN, now)}`} verdict={s.round === board.current ? 'being drawn' : 'if you win'}>
          <span>
            {s.round === board.current ? 'Your opponent is being drawn' : 'Drawn after the round before'}
            <small>A win makes {s.points} points</small>
          </span>
        </Leg>,
      ),
    )
  }
  return <div className="ptour__list ptour__run">{legs}</div>
}

function Leg({ kind, mark, head, verdict, children }: {
  kind: 'pass' | 'won' | 'lost' | 'next' | 'if'
  mark: string
  head: string
  verdict: string
  children: ReactNode
}) {
  return (
    <div className={`ptour__leg is-${kind}`}>
      <span className="ptour__node">{mark}</span>
      <div className="ptour__legbody">
        <div className="ptour__leghead">
          <b>{head}</b>
          <span className={`ptour__verdict is-${kind}`}>{verdict}</span>
        </div>
        <div className="ptour__legline">{children}</div>
      </div>
    </div>
  )
}

function Fighting(p: PhoneTournamentProps & {
  board: Board
  onPrizes: () => void
  onWatch: (m: TournamentMatchup, round: number) => void
}) {
  const { board } = p
  const [picked, setPicked] = useState<number | null>(null)
  const [mineOnly, setMineOnly] = useState(false)
  const round = Math.min(picked ?? board.current, Math.max(0, board.rounds - 1))
  const items = drawnItems(board, p.history, p.phase, p.now)
  const focus = items.findIndex((i) => i.round === round)
  const entered = !!p.mine || board.runs.has(p.wallet)
  const myCount = p.history.flat().filter((m) => isIn(m, p.wallet)).length + (board.runs.get(p.wallet)?.pass ? 1 : 0)
  const current = round === board.current
  const desk = useContext(Desk)

  return (
    <>
      <Head sub={`${board.name(board.current)} · ${formatNumber(board.players)} players`} chip={<PrizesChip onClick={p.onPrizes} />} />
      <Strip items={items} focus={focus} selected={round} onSelect={(r) => { setPicked(r); setMineOnly(false) }} />

      <Cols
        items={[
          [
      entered && (
        <StatusCard
          board={board}
          mine={p.mine}
          wallet={p.wallet}
          history={p.history}
          now={p.now}
          onSeeFights={() => setMineOnly(true)}
        />
      ),
            'side',
          ],
          [
      current && !mineOnly && (
        <LiveCard board={board} round={board.current} rows={p.history[board.current] ?? []} now={p.now} onWatch={(m) => p.onWatch(m, board.current)} />
      ),
            'main',
          ],
          [desk && <SidePrizes board={board} wallet={p.wallet} onPrizes={p.onPrizes} />, 'side'],
          [desk && <Conditions weather={p.weather} />, 'side'],
          [
      <>
      {entered && (
        <div className="prew__tabs ptour__seg" role="tablist">
          <button type="button" role="tab" className="prew__tab" aria-selected={!mineOnly} onClick={() => setMineOnly(false)}>
            All fights
          </button>
          <button type="button" role="tab" className="prew__tab" aria-selected={mineOnly} onClick={() => setMineOnly(true)}>
            My fights <i className="ptour__segcount">{myCount}</i>
          </button>
        </div>
      )}

      {mineOnly ? (
        <MyRun board={board} wallet={p.wallet} history={p.history} now={p.now} onWatch={p.onWatch} />
      ) : (
        <>
          <div className="ptour__rhead">
            <b>{board.name(round)}</b>
            <small>
              {round < board.current
                ? `${board.sizes[round]} fought`
                : round === board.current
                  ? board.drawing(round)
                    ? 'being drawn'
                    : `${(p.history[round] ?? []).filter((m) => winnerSide(m)).length} of ${board.sizes[round]} fought`
                  : `drawn after the ${board.name(round - 1).toLowerCase()}`}
            </small>
          </div>
          <RoundList
            board={board}
            round={round}
            rows={round <= board.current ? (p.history[round] ?? []) : []}
            wallet={p.wallet}
            now={p.now}
            mineOnly={false}
            current={current}
            onWatch={(m) => p.onWatch(m, round)}
          />
          {round === 0 && board.passes.length > 0 && (
            <div className="ptour__byes">
              <span className="ptour__faces">
                {board.passes.slice(0, 6).map((e) => (
                  <PlayerAvatar key={e.wallet} id={e.avatar} name={e.tag} className="ptour__face" size={26} />
                ))}
              </span>
              <span>
                Through on seed · <b>+10 points</b> each
              </span>
            </div>
          )}
          {round >= board.current && round + 1 < board.rounds && (
            <>
              <div className="ptour__rhead">
                <b>Still to come</b>
                <small>times are fixed; pairings are drawn round by round</small>
              </div>
              <LaterRounds board={board} from={round + 1} now={p.now} onSelect={(r) => setPicked(r)} />
            </>
          )}
        </>
      )}
      </>,
            'main',
          ],
        ]}
      />
    </>
  )
}

/* ---------- results ---------- */

function Results(p: PhoneTournamentProps & {
  board: Board
  onPrizes: () => void
  onHof: () => void
  onWatch: (m: TournamentMatchup, round: number) => void
}) {
  const { board } = p
  const [picked, setPicked] = useState<number | null>(null)
  const last = board.rounds - 1
  const final = (p.history[last] ?? [])[0]
  const fw = final ? winnerSide(final) : 0
  const champion = fw ? sideOf(final!, fw as 1 | 2) : null
  const runnerUp = fw ? sideOf(final!, fw === 1 ? 2 : 1) : null
  const semis = last >= 1
    ? (p.history[last - 1] ?? [])
        .map((m) => (winnerSide(m) ? sideOf(m, winnerSide(m) === 1 ? 2 : 1) : null))
        .filter((e): e is Entrant => !!e)
    : []
  const paid = (w: string) => {
    const r = board.runs.get(w)
    const rank = board.rankOf(w)
    const cut = p.legend.get(w) === false ? 10 : 1
    return {
      rank,
      points: r?.points ?? 0,
      wax: waxFor(board.prizes, rank) / cut,
      tlm: ((r?.points ?? 0) * board.prizes.perPoint) / cut,
      tenth: cut === 10,
    }
  }
  const items = drawnItems(board, p.history, 'finish', p.now)
  const round = picked ?? last
  const reached = (w: string) => {
    const r = board.runs.get(w)
    if (!r) return ''
    if (r.outIn === null) return 'Champion'
    if (r.outIn === last) return 'Runner-up'
    return board.name(r.outIn)
  }
  const me = board.runs.get(p.wallet)
  const mePaid = me ? paid(p.wallet) : null
  const started = Number(p.stage?.player_count ?? 0)

  const Pod = ({ e, step, label }: { e: Entrant; step: 2 | 3; label: string }) => {
    const x = paid(e.wallet)
    return (
      <div className="ptour__pod">
        <PlayerAvatar id={e.avatar} name={e.tag} className="ptour__podav" size={52} />
        <b>{e.tag || e.wallet}</b>
        <span className="mono">
          {wax(x.wax)} WAX
          <br />
          {tlm(x.tlm)} TLM
        </span>
        <div className={`ptour__podstep is-${step}`}>
          {step}
          <small>{label}</small>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head sub={`Finished · ${formatNumber(started)} players`} chip={<PrizesChip onClick={p.onPrizes} />} />
      <Strip items={items} focus={items.findIndex((i) => i.round === round)} selected={round} onSelect={setPicked} />

      <Cols
        items={[
          [
      champion && (
        <section className="ptour__champ">
          <img className="ptour__crown" src={TROPHY} alt="" />
          <PlayerAvatar id={champion.avatar} name={champion.tag} className="ptour__champav" size={84} />
          <b>{champion.tag || champion.wallet}</b>
          <small>Champion{champion.wallet === p.wallet ? ' · you' : ''}</small>
          <span className="ptour__paid mono">
            <span>
              <img src={WAX_ICON} alt="" />
              {wax(paid(champion.wallet).wax)}
            </span>
            <span>
              <img src={TLM_ICON} alt="" />
              {tlm(paid(champion.wallet).tlm)}
            </span>
          </span>
          {final && (
            <button type="button" className="btn btn--sm" onClick={() => p.onWatch(final, last)}>
              <span className="ptour__playicon" />
              Watch the final
            </button>
          )}
        </section>
      ),
            'main',
          ],
          [
      (runnerUp || semis.length > 0) && (
        <div className="ptour__podium">
          {semis[0] ? <Pod e={semis[0]} step={3} label="Semis" /> : <span />}
          {runnerUp ? <Pod e={runnerUp} step={2} label="Final" /> : <span />}
          {semis[1] ? <Pod e={semis[1]} step={3} label="Semis" /> : <span />}
        </div>
      ),
            'main',
          ],
          [
      me && mePaid && (
        <section className="ptour__card ptour__card--teal ptour__mine">
          <span className="ptour__place mono">
            {place(mePaid.rank)}
            <small>place</small>
          </span>
          <div>
            <span className="ptour__kick ptour__kick--teal">Your result</span>
            <p className="ptour__sub">
              {reached(p.wallet)} · <b>{mePaid.points}</b> point{mePaid.points === 1 ? '' : 's'}
              <br />
              Paid <b>{wax(mePaid.wax)} WAX</b> + <b>{tlm(mePaid.tlm)} TLM</b>
              {mePaid.tenth ? ' (a tenth, without Legend Access)' : ''}
            </p>
          </div>
        </section>
      ),
            'side',
          ],
          [
      <>
      <div className="ptour__rhead">
        <b>Everyone</b>
        <small>by points · as paid</small>
      </div>
      <div className="ptour__table">
        {board.order.map((r) => {
          const x = paid(r.wallet)
          return (
            <div key={r.wallet} className={`ptour__tr${r.wallet === p.wallet ? ' is-me' : ''}`}>
              <b className="mono">{x.rank}</b>
              <PlayerAvatar id={r.avatar} name={r.tag} className="ptour__sideav" size={30} />
              <span className="ptour__who">
                <span>{r.tag || r.wallet}</span>
                <small className={x.tenth ? 'is-tenth' : ''}>
                  {reached(r.wallet)} · {r.points} pt{r.points === 1 ? '' : 's'}
                  {x.tenth ? ' · no Legend, ÷10' : ''}
                </small>
              </span>
              <span className="ptour__amt mono">
                {wax(x.wax)} WAX
                <small>{tlm(x.tlm)} TLM</small>
              </span>
            </div>
          )
        })}
      </div>
      </>,
            'main',
          ],
          [
      <>
      <div className="ptour__rhead">
        <b>{board.name(round)}</b>
        <small>
          {(p.history[round] ?? []).length} fight{(p.history[round] ?? []).length === 1 ? '' : 's'} · tap the strip for another round
        </small>
      </div>
      <RoundList
        board={board}
        round={round}
        rows={p.history[round] ?? []}
        wallet={p.wallet}
        now={p.now}
        mineOnly={false}
        current={false}
        onWatch={(m) => p.onWatch(m, round)}
      />

      <button type="button" className="ptour__pill ptour__center" onClick={p.onHof}>
        <img src={TROPHY} alt="" />
        Hall of Fame
      </button>
      </>,
            'side',
          ],
        ]}
      />
    </>
  )
}

/* ---------- hall of fame ---------- */

function HallOfFame({ rows, wallet, nextFinal, finalAfterMs = 0, onBack }: {
  rows: TournamentHof[]
  wallet: string
  finalAfterMs?: number
  /** When the next champion is decided, for the empty slot at the top. */
  nextFinal?: number
  onBack: () => void
}) {
  const desk = useContext(Desk)
  const cups = useMemo(() => {
    const byName = new Map<string, TournamentHof[]>()
    for (const r of rows) byName.set(r.tournament_name, [...(byName.get(r.tournament_name) ?? []), r])
    return [...byName.values()]
      .map((four) => [...four].sort((a, b) => a.rank - b.rank || a.index - b.index))
      .sort((a, b) => chainTime(b[0].tournament_date) - chainTime(a[0].tournament_date))
  }, [rows])
  /* Titles first, then podiums: the order a hall of fame is read in. */
  const ranking = useMemo(() => {
    const tally = new Map<string, { tag: string; avatar: number; titles: number; podiums: number }>()
    for (const r of rows) {
      const t = tally.get(r.wallet) ?? { tag: r.gamertag, avatar: r.avatar, titles: 0, podiums: 0 }
      t.podiums++
      if (r.rank === 1) t.titles++
      tally.set(r.wallet, t)
    }
    return [...tally.entries()].sort((a, b) => b[1].titles - a[1].titles || b[1].podiums - a[1].podiums)
  }, [rows])
  const king = ranking[0]
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  const placeOf = (rank: number) => (rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd')

  const head = (
    <div className="ptour__head">
      <h1 className="ptour__title">
        Hall of Fame
        <small>Every tournament's top four</small>
      </h1>
      <button type="button" className="ptour__pill" onClick={onBack}>
        ‹ Back
      </button>
    </div>
  )

  if (!cups.length) {
    return (
      <>
        {head}
        <section className="ptour__card ptour__hofempty">
          <img src={TROPHY} alt="" />
          <span className="ptour__kick ptour__kick--gold">Nobody yet</span>
          <p className="ptour__sub">The first tournament's top four are written here as soon as its final is fought.</p>
        </section>
      </>
    )
  }

  const best = (
    <section className="ptour__card ptour__hofbest">
      <span className="ptour__kick ptour__kick--gold">Most titles</span>
      <div className="ptour__hofking">
        <PlayerAvatar id={king[1].avatar} name={king[1].tag} className="ptour__hofkingav" size={desk ? 120 : 72} />
        <b>{king[1].tag || king[0]}</b>
        <small>
          {plural(king[1].titles, 'title').toUpperCase()} · {plural(king[1].podiums, 'podium').toUpperCase()}
        </small>
      </div>
      {desk && (
        <div className="ptour__hofrank">
          {ranking.slice(0, 10).map(([w, t], i) => (
            <div key={w} className={w === wallet ? 'is-me' : ''}>
              <b className="mono">{i + 1}</b>
              <PlayerAvatar id={t.avatar} name={t.tag} className="ptour__sideav" size={40} />
              <span>{t.tag || w}</span>
              <em>{t.titles ? plural(t.titles, 'title') : ''}</em>
              <small>{plural(t.podiums, 'podium')}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  const weeks = (
    <div className="ptour__hofweeks">
      {Number.isFinite(nextFinal) && (
        <div className="ptour__hofnext">
          <b>{dayLabel(nextFinal!)}</b>
          <span>The next champion is written here after the final.</span>
        </div>
      )}
      {cups.map((four) => (
        <section key={four[0].tournament_name} className="ptour__card ptour__hofweek">
          <b className="ptour__cupname">{dayLabel(chainTime(four[0].tournament_date) + finalAfterMs)}</b>
          <div className="ptour__four">
            {four.map((r) => (
              <div key={r.index} className={`${r.rank === 1 ? 'is-top' : ''}${r.wallet === wallet ? ' is-me' : ''}`}>
                <PlayerAvatar id={r.avatar} name={r.gamertag} className="ptour__sideav" size={r.rank === 1 ? 44 : 36} />
                <span>
                  <b>{r.gamertag || r.wallet}</b>
                  <small>{placeOf(r.rank)}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )

  return (
    <div className="ptour__hof">
      {head}
      {desk ? (
        <div className="ptour__hofcols">
          {best}
          {weeks}
        </div>
      ) : (
        <>
          {best}
          {weeks}
        </>
      )}
    </div>
  )
}
