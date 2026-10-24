import { useMemo, useState, type ReactNode } from 'react'
import type { CardTemplate } from '@/chain/atomic'
import type { RosterFighter } from '@/dungeon/types'
import { BottomSheet } from '@/components/BottomSheet'
import { GameImg } from '@/components/GameImg'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { WeatherPanel } from '@/fight/setup'
import { weatherTargets, type Weather } from '@/fight/weather'
import {
  fighterArtFallback,
  fighterAvatar,
  fighterSilhouette,
  fighterSilhouetteFallback,
} from '@/tavern/fighterStats'
import { BoutBroadcast } from '@/tournament/BoutBroadcast'
import {
  bracketOf,
  chainTime,
  crewFaces,
  freePassCount,
  startedAt,
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
  /** The roster sheet, slid over the screen when a team slot is tapped. */
  picker: ReactNode
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
    body = <HallOfFame rows={p.hof} wallet={p.wallet} onBack={() => setHof(false)} />
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

  return (
    <div className={`prew ptour${p.phase === 'signup' && !p.mine && !hof ? ' ptour--dock' : ''}`}>
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
        <BottomSheet title={fightName(sheet.round, board.rounds || sheet.round + 1, board.opening)} onClose={() => setSheet(null)}>
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
        </BottomSheet>
      )}
      {/* The roster sheet, as the dungeon has it; mounted always, slid in and out. */}
      {p.phase === 'signup' && !p.mine && p.picker}
    </div>
  )
}

/* ---------- pieces ---------- */

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
      sub: when(board.slots[r]?.[0] ?? NaN, now),
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
    <BottomSheet title="Prizes" onClose={onClose}>
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
    </BottomSheet>
  )
}

function WithdrawSheet({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet title="Withdraw?" onClose={onClose}>
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
    </BottomSheet>
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

/* ---------- before signup ---------- */

function BeforeSignup(
  p: PhoneTournamentProps & { onHof: () => void; onWatch: (m: TournamentMatchup, round: number) => void },
) {
  const crowd = p.ringFighters.slice(0, 5)
  const past = p.past
  const pastRounds = past?.history.filter((r) => r.length) ?? []
  const pastBoard = useMemo(() => {
    if (!past) return null
    const players = Number(past.stage.player_count ?? 0)
    const rounds = Number(past.stage.rounds ?? 0)
    const sizes = roundSizes(players)
    const passes = passesFrom(past.history, [])
    const runs = replay(past.history, passes, sizes)
    const order = payoutOrder([...runs.values()])
    return { rounds, opening: Number(past.stage.free_passes ?? 0) > 0, runs, order, prizes: prizesOf(past.stage) }
  }, [past])

  /* The last four from the Hall of Fame, when there is no fight history. */
  const lastHof = useMemo(() => {
    const byName = new Map<string, TournamentHof[]>()
    for (const r of p.hof) byName.set(r.tournament_name, [...(byName.get(r.tournament_name) ?? []), r])
    const latest = [...byName.values()].sort(
      (a, b) => chainTime(b[0].tournament_date) - chainTime(a[0].tournament_date),
    )[0]
    return latest ? [...latest].sort((a, b) => a.rank - b.rank || a.index - b.index) : null
  }, [p.hof])

  const lastDay =
    (past ? startedAt(past.stage.tournament_name) : null) ??
    (lastHof ? chainTime(lastHof[0].tournament_date) : null)
  const final = pastRounds[pastRounds.length - 1]?.[0]
  const champion = final && winnerSide(final) ? sideOf(final, winnerSide(final) as 1 | 2) : null
  const runnerUp = final && winnerSide(final) ? sideOf(final, winnerSide(final) === 1 ? 2 : 1) : null
  const myRun = pastBoard?.runs.get(p.wallet)
  const myRank = myRun ? pastBoard!.order.findIndex((r) => r.wallet === p.wallet) + 1 : 0

  /* Worth watching again: the final, the semi-finals, and your own. */
  const replays: { m: TournamentMatchup; round: number }[] = []
  if (past) {
    const n = past.history.length
    for (let r = n - 1; r >= 0 && replays.length < 3; r--) {
      for (const m of [...past.history[r]].reverse()) {
        if (replays.length < 3 && winnerSide(m) && (r >= n - 2 || isIn(m, p.wallet))) replays.push({ m, round: r })
      }
    }
  }

  const opens = p.signupAt
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
            <GameImg
              key={f.fighter_id}
              src={fighterSilhouette(f)}
              fallback={fighterSilhouetteFallback()}
              alt=""
            />
          ))}
        </div>
      </div>

      {p.phase === 'preparing' && p.stage && <PotCard stage={p.stage} field={null} />}

      {(champion || lastHof) && (
        <section className="ptour__card">
          <div className="ptour__cardhead">
            <span className="ptour__kick">
              Last tournament
              {lastDay ? ` · ${dayLabel(lastDay)}` : ''}
            </span>
            {p.onOpenPast && (
              <button type="button" className="ptour__link" onClick={p.onOpenPast}>
                Results ›
              </button>
            )}
          </div>
          {(() => {
            const champ = champion ?? (lastHof ? { wallet: lastHof[0].wallet, tag: lastHof[0].gamertag, avatar: lastHof[0].avatar } : null)
            if (!champ) return null
            /* One source for the whole card: the fights while they are on chain,
               the Hall of Fame once they are gone — never a mix of the two. */
            const semiLosers = (pastRounds[pastRounds.length - 2] ?? [])
              .filter((m) => winnerSide(m))
              .map((m) => sideOf(m, winnerSide(m) === 1 ? 2 : 1))
            const rest: { key: string; tag: string; avatar: number; place: string }[] = champion
              ? [
                  ...(runnerUp ? [{ key: runnerUp.wallet, tag: runnerUp.tag || runnerUp.wallet, avatar: runnerUp.avatar, place: '2nd' }] : []),
                  ...semiLosers.map((e) => ({ key: e.wallet, tag: e.tag || e.wallet, avatar: e.avatar, place: '3rd' })),
                ]
              : (lastHof ?? []).slice(1).map((r) => ({
                  key: String(r.index),
                  tag: r.gamertag || r.wallet,
                  avatar: r.avatar,
                  place: r.rank === 2 ? '2nd' : '3rd',
                }))
            return (
              <>
                <div className="ptour__status">
                  <PlayerAvatar id={champ.avatar} name={champ.tag} className="ptour__statusav ptour__statusav--gold" size={56} />
                  <div>
                    <span className="ptour__kick ptour__kick--gold">Champion</span>
                    <div className="ptour__big">{champ.tag || champ.wallet}</div>
                    {runnerUp && (
                      <p className="ptour__sub">
                        Beat <b>{runnerUp.tag || runnerUp.wallet}</b> in the final
                        {past ? ` · ${formatNumber(Number(past.stage.player_count ?? 0))} players` : ''}
                      </p>
                    )}
                  </div>
                </div>
                {rest.length > 0 && (
                  <div className="ptour__faces">
                    {rest.map((r) => (
                      <PlayerAvatar key={r.key} id={r.avatar} name={r.tag} className="ptour__face" size={26} />
                    ))}
                    <span>{rest.map((r) => `${r.tag} ${r.place}`).join(' · ')}</span>
                  </div>
                )}
              </>
            )
          })()}
        </section>
      )}

      {replays.length > 0 && pastBoard && (
        <>
          <div className="ptour__rhead">
            <b>Watch again</b>
            <small>every fight is kept until cleanup</small>
          </div>
          <div className="ptour__list">
            {replays.map(({ m, round }) => (
              <FightRow
                key={`${round}-${m.index}`}
                m={m}
                slot={NaN}
                wallet={p.wallet}
                now={p.now}
                live={false}
                onWatch={() => p.onWatch(m, round)}
              />
            ))}
          </div>
        </>
      )}

      {myRun && pastBoard && (
        <section className="ptour__card">
          <div className="ptour__cardhead">
            <span className="ptour__kick">Your last tournament</span>
          </div>
          <p className="ptour__sub">
            {myRun.outIn === null ? (
              <b>Champion</b>
            ) : (
              <>
                Out in the <b>{roundName(myRun.outIn, pastBoard.rounds, pastBoard.opening).toLowerCase()}</b>
              </>
            )}{' '}
            · {place(myRank)} · <b>{myRun.points}</b> points
          </p>
        </section>
      )}
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

  return (
    <>
      <Head sub={Number.isFinite(closes) ? `Signup closes ${when(closes, p.now)}` : 'Signup open'} chip={<HofChip onClick={p.onHof} />} />
      <Strip items={items} focus={0} />

      {p.mine && (
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
      )}

      <PotCard stage={p.stage} field={p.field} />
      <Conditions weather={p.weather} />

      {!p.mine && (
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
      )}
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

      {drawing && (
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
      )}

      {p.mine && (myFight || myPass) && (
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
      )}
      {p.mine && !myFight && !myPass && drawing && (
        <section className="ptour__card ptour__card--teal">
          <span className="ptour__kick ptour__kick--teal">Your draw</span>
          <p className="ptour__sub">Not drawn yet — your opponent and your slot appear here.</p>
        </section>
      )}

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
      </section>

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
          <div>
            <small>WAX now</small>
            <b className="mono is-gold">{wax(waxFor(board.prizes, rank))}</b>
          </div>
        </div>
        <p className="ptour__fine">
          Plus {tlm(points * board.prizes.perPoint)} TLM. Your points are final; your place can only drop
          if others pass you. Paid after the final.
        </p>
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

  return (
    <>
      <Head sub={`${board.name(board.current)} · ${formatNumber(board.players)} players`} chip={<PrizesChip onClick={p.onPrizes} />} />
      <Strip items={items} focus={focus} selected={round} onSelect={(r) => { setPicked(r); setMineOnly(false) }} />

      {entered && (
        <StatusCard
          board={board}
          mine={p.mine}
          wallet={p.wallet}
          history={p.history}
          now={p.now}
          onSeeFights={() => setMineOnly(true)}
        />
      )}

      {current && !mineOnly && (
        <LiveCard board={board} round={board.current} rows={p.history[board.current] ?? []} now={p.now} onWatch={(m) => p.onWatch(m, board.current)} />
      )}

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

      {champion && (
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
      )}

      {(runnerUp || semis.length > 0) && (
        <div className="ptour__podium">
          {semis[0] ? <Pod e={semis[0]} step={3} label="Semis" /> : <span />}
          {runnerUp ? <Pod e={runnerUp} step={2} label="Final" /> : <span />}
          {semis[1] ? <Pod e={semis[1]} step={3} label="Semis" /> : <span />}
        </div>
      )}

      {me && mePaid && (
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
      )}

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
    </>
  )
}

/* ---------- hall of fame ---------- */

function HallOfFame({ rows, wallet, onBack }: { rows: TournamentHof[]; wallet: string; onBack: () => void }) {
  const cups = useMemo(() => {
    const byName = new Map<string, TournamentHof[]>()
    for (const r of rows) byName.set(r.tournament_name, [...(byName.get(r.tournament_name) ?? []), r])
    return [...byName.values()]
      .map((four) => [...four].sort((a, b) => a.rank - b.rank || a.index - b.index))
      .sort((a, b) => chainTime(b[0].tournament_date) - chainTime(a[0].tournament_date))
  }, [rows])
  const best = useMemo(() => {
    const tally = new Map<string, { tag: string; avatar: number; titles: number; podiums: number }>()
    for (const r of rows) {
      const t = tally.get(r.wallet) ?? { tag: r.gamertag, avatar: r.avatar, titles: 0, podiums: 0 }
      t.podiums++
      if (r.rank === 1) t.titles++
      tally.set(r.wallet, t)
    }
    return [...tally.entries()]
      .sort((a, b) => b[1].titles - a[1].titles || b[1].podiums - a[1].podiums)
      .slice(0, 3)
  }, [rows])
  const mine = rows.filter((r) => r.wallet === wallet).sort((a, b) => a.rank - b.rank)[0]

  return (
    <>
      <div className="ptour__head">
        <button type="button" className="ptour__pill" onClick={onBack}>
          ‹ Back
        </button>
        <h1 className="ptour__title ptour__title--right">
          Hall of Fame
          <small>Every tournament's top four</small>
        </h1>
      </div>

      {cups.length === 0 ? (
        <section className="ptour__card">
          <span className="ptour__kick ptour__kick--gold">Nobody yet</span>
          <p className="ptour__sub">
            The first tournament's top four are written here as soon as its final is fought.
          </p>
        </section>
      ) : (
        <>
          <section className="ptour__card ptour__card--gold">
            <span className="ptour__kick ptour__kick--gold">Most titles</span>
            <div className="ptour__best">
              {best.map(([w, t]) => (
                <div key={w}>
                  <PlayerAvatar id={t.avatar} name={t.tag} className="ptour__sideav" size={44} />
                  <b>{t.tag || w}</b>
                  {t.titles > 0 && (
                    <em>
                      {t.titles} title{t.titles === 1 ? '' : 's'}
                    </em>
                  )}
                  <small>
                    {t.podiums} podium{t.podiums === 1 ? '' : 's'}
                  </small>
                </div>
              ))}
            </div>
          </section>
          {mine && (
            <section className="ptour__card ptour__card--teal">
              <span className="ptour__kick ptour__kick--teal">Your best</span>
              <p className="ptour__sub">
                <b>{mine.rank === 1 ? 'Champion' : mine.rank === 2 ? '2nd' : '3rd'}</b> on{' '}
                {dayLabel(chainTime(mine.tournament_date))}
              </p>
            </section>
          )}
          {cups.map((four) => (
            <section key={four[0].tournament_name} className="ptour__card">
              <div className="ptour__cardhead">
                <b className="ptour__cupname">{dayLabel(chainTime(four[0].tournament_date))}</b>
              </div>
              <div className="ptour__four">
                {four.map((r) => (
                  <div key={r.index} className={`${r.rank === 1 ? 'is-top' : ''}${r.wallet === wallet ? ' is-me' : ''}`}>
                    <PlayerAvatar id={r.avatar} name={r.gamertag} className="ptour__sideav" size={r.rank === 1 ? 44 : 36} />
                    <b>{r.gamertag || r.wallet}</b>
                    <small>{r.rank === 1 ? '1st' : r.rank === 2 ? '2nd' : '3rd'}</small>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </>
  )
}
