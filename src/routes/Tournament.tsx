import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useGame } from '@/state/useGame'
import { useConfig } from '@/state/useConfig'
import { useChainQuery } from '@/chain/useChainQuery'
import { resolveAssetIds, type CardTemplate } from '@/chain/atomic'
import { fetchCrewCards, fetchRoster } from '@/dungeon/queries'
import { fetchAssetTemplates } from '@/chain/atomic'
import { EMPTY_FILTER, type RosterFilter } from '@/dungeon/filters'
import { TEAM_SIZE, type RosterFighter } from '@/dungeon/types'
import { combineNftFighter, nftAsPanel, type NftValue } from '@/dungeon/nftFighter'
import { ageFactor, levelFactor } from '@/fight/scaling'
import {
  CardGrid,
  CombatCard,
  DetailSheet,
  FighterGrid,
  RosterFilters,
  mid,
  rosterPanel,
  type Detail,
  type Tab,
} from '@/fight/setup'
import {
  fighterArtFallback,
  fighterAvatar,
  fighterSilhouette,
  fighterSilhouetteFallback,
} from '@/tavern/fighterStats'
import { GameImg } from '@/components/GameImg'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { FighterHoverCard } from '@/components/FighterPanel'
import { HoverPopover, useHoverCard } from '@/components/HoverPopover'
import { BoutBroadcast } from '@/tournament/BoutBroadcast'
import { usePhone } from '@/components/usePhone'
import { WeatherPanel } from '@/fight/setup'
import { fetchWeatherRow, fetchWeatherRows, weatherIsCalm, type Weather } from '@/fight/weather'
import {
  fetchLiveTournaments,
  fetchTournamentConfig,
  fetchTournamentMatchups,
  fetchTournamentPayouts,
  fetchTournamentPlan,
  fetchTournamentSignups,
  fetchTournamentStages,
  fetchTournamentTracking,
  fetchFightersByIds,
} from '@/tournament/queries'
import {
  bracketOf,
  freePassCount,
  canEnter,
  chainTime,
  currentStepEnd,
  mySignup,
  phaseOf,
  pickTournament,
  crewFaces,
  pretendTournamentWins,
  seedOrder,
  seedingOf,
  startedAt,
  stripSteps,
  stripWindow,
  teamScore,
  timelineOf,
  type Bracket,
  type EntryBlock,
  type TimelineStep,
  type TournamentPhase,
  type CrewFace,
  winnerSide,
  fightingDone,
  isFinished,
} from '@/tournament/rules'
import type {
  TournamentMatchup,
  TournamentPayout,
  TournamentSignup,
  TournamentStage,
} from '@/tournament/types'
import { assetAmount } from '@/leaderboard/rules'
import { DIRTIES, tournamentSignup } from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { readableError } from '@/wharf/errors'
import { formatCompact, formatNumber, NUM_LOCALE } from '@/format'
import { asset, ipfsImage } from '@/assets'

/**
 * The Tournament.
 *
 * A tournament is a day on a timer that nobody drives: `advance` walks it
 * from one step to the next, and a player's whole part in it is one
 * signature during the entry window. That shape is what this screen is built
 * around — it reports, and the single thing it asks for is a team.
 *
 * The contract names the screen it wants shown. `curstage.tournament_screen`
 * is one of preparing, signup, creation, battle or finish, and the panel in
 * the middle of this page follows it rather than keeping a state machine of
 * its own: one rename on chain and the two would disagree, and the client
 * would be the one lying.
 *
 * Three things about the contract as deployed shape what can honestly be
 * drawn here, and all three are said on screen rather than hidden:
 *
 *   • Entering hands over the five fighters. `signup` sets `in_use` and
 *     nothing sets it back, so the warning sits above the button.
 *   • `allow_player_cancellation` is carried on every row, but no action
 *     exists to cancel with — so nothing offers it.
 *   • The battle, hall-of-fame and payout steps are not written yet. Where
 *     the chain has nothing to say, the screen says the round is being
 *     fought rather than drawing a bracket nobody has committed to.
 *
 * Every panel below is exported and takes what it draws, so the SSR preview
 * harness can render all six states — five phases and the long gap between
 * tournaments — without a wallet.
 */

const EMPTY_CARDS: CardTemplate[] = []

/** A countdown, as the rest of the game writes them. */
export function untilText(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'any moment'
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  return `${seconds}s`
}

/**
 * The same wait, for the board.
 *
 * `untilText` is written for a line of body copy, where a ticking seconds
 * digit is noise. A scoreboard is the opposite: the seconds are the thing
 * that makes it look switched on, so this keeps them at every range the
 * board can reach. The screen's clock already ticks once a second.
 */
export function boardText(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'any moment'
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`
  return `${seconds}s`
}

const clock = (ms: number) =>
  Number.isFinite(ms)
    ? new Date(ms).toLocaleTimeString(NUM_LOCALE, { hour: '2-digit', minute: '2-digit' })
    : '—'

/**
 * A time with its day: "Today 10:00 AM", "Tomorrow 08:00 AM", "Thursday
 * 10:02 PM", "14 Oct 10:00 AM".
 *
 * The strip's steps are days apart — signup alone runs three — so a bare
 * time said nothing about *which* 10:00 AM the fighting starts at. The day
 * is named relative to the player's own clock while that is unambiguous:
 * today and tomorrow by name, the rest of the week by weekday, and
 * anything further out by date, since "Tuesday" nine days away reads as
 * the one coming.
 */
export function dayClock(ms: number, now: number): string {
  const { day, time } = dayParts(ms, now)
  return day ? `${day} ${time}` : time
}

/** The two halves of `dayClock`, so a narrow strip can break between them. */
export function dayParts(ms: number, now: number): { day: string; time: string } {
  if (!Number.isFinite(ms)) return { day: '', time: '—' }
  const day = (t: number) => {
    const d = new Date(t)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const apart = Math.round((day(ms) - day(now)) / 86_400_000)
  const when =
    apart === 0
      ? 'Today'
      : apart === 1
        ? 'Tomorrow'
        : apart === -1
          ? 'Yesterday'
          : apart > 1 && apart < 7
            ? new Date(ms).toLocaleDateString(NUM_LOCALE, { weekday: 'long' })
            : new Date(ms).toLocaleDateString(NUM_LOCALE, { day: 'numeric', month: 'short' })
  return { day: when, time: clock(ms) }
}

/** The contract's step names, said the way a player would say them. */
const STEP_LABEL: Record<string, string> = {
  set_weather: 'Weather rolled',
  get_rewards: 'Prize collected',
  signup: 'Signup open',
  close_signup: 'Signup closed',
  create_matchups: 'Bracket drawn',
  battle: 'Fights start',
  hall_of_fame: 'Hall of fame',
  reward_payout: 'Rewards paid',
  cleanup: 'Wrapped up',
  /* The one the strip merges several steps into. */
  preparation: 'Signup closed',
}

const stepLabel = (name: string) => STEP_LABEL[name] ?? name.replace(/_/g, ' ')

/* ————————————————— the pieces ————————————————— */

/**
 * The title, and nothing else.
 *
 * It carried a phase chip and the tournament's start stamp, and both were
 * answering questions the page below answers better: the strip says which
 * step is running and the panel under it is that step. A label reading
 * "Preparing" above a picture of a shut gate is the same sentence twice.
 */
export function TournamentHead() {
  return (
    <header className="tour__head">
      <h1 className="tour__title">Tournament</h1>
    </header>
  )
}

/**
 * What is on the table, and the weather it will be fought in.
 *
 * The pot is the reason to turn up, so it is said at the size of a reason
 * rather than tucked into a strip of metadata. It arrives during the setup
 * step — `get_rewards` pulls it from the pool contract — so an empty one is
 * a tournament that has not been paid for yet rather than one worth nothing,
 * and it says so instead of showing a zero.
 *
 * The weather sits under it in the same component the dungeon and the arena
 * use, one roll per planet, because it is the same thing: the first thing
 * that happens to a fighter, before level, age or anything else.
 */
/*
   Four rolls per tournament.

   The contract rolls one per planet it picks, three today, and is going to
   roll four. The strip is already drawn for four: until the chain rolls
   them, it is topped up with stand-ins from the first rolled planet's own
   weather table, so what a player sees is the layout they will get.

   Display only. The fights read `rolls`, which is only ever what the chain
   rolled, so a stand-in never touches an outcome. Nothing is added before
   the first real roll lands — preparation still shows an empty strip.
*/
const ROLLS_SHOWN = 4

async function withStandIns(
  rolled: { planet: string; weather?: Weather }[],
): Promise<{ planet: string; weather?: Weather }[]> {
  const real = rolled.filter((w) => w.weather)
  if (real.length === 0 || real.length >= ROLLS_SHOWN) return rolled
  const planet = real[0].planet
  const taken = new Set(real.map((w) => w.weather!.weather_id))
  const table = await fetchWeatherRows(planet).catch(() => [] as Weather[])
  const extra = table
    .filter((w) => !taken.has(w.weather_id) && !weatherIsCalm(w))
    .slice(0, ROLLS_SHOWN - real.length)
  return [...rolled, ...extra.map((weather) => ({ planet, weather }))]
}

/** The least gap a single-row strip is allowed between its two halves. */
const POT_MIN_BRIDGE = 60

/**
 * How much wider the frame must get before a stacked strip tries one row
 * again.
 *
 * Switching layouts changes the page's height, and on a page near the
 * edge of needing a scrollbar that adds or removes one — which changes the
 * frame's width by a scrollbar, 15 to 17 pixels, up to two of them. With
 * no slack that was a loop: stack, scrollbar goes, frame grows, unstack,
 * strip overflows, scrollbar returns, frame shrinks, stack — until React
 * gave up with "maximum update depth exceeded". The band is wider than
 * two scrollbars, so the only thing that can unstack the strip is the
 * window actually getting bigger.
 */
const POT_UNSTACK_SLACK = 48

export function PrizeBar({
  stage,
  weather,
  stacked: forced,
}: {
  stage: TournamentStage
  weather: { planet: string; weather?: Weather }[]
  /** Force the two-row layout — for a render with no window to measure. */
  stacked?: boolean
}) {
  /*
     Stacked when it has to be, measured rather than guessed.

     No breakpoint can say when one row stops fitting: the rolls' text is
     different every tournament, and a band that is allowed to shrink folds
     its figures onto two lines long before the strip overflows. So the
     bands are pinned to their content and the strip watches its own frame:
     if the parts plus a real gap are wider than the frame, it stacks.

     Measured only in the single-row layout, where every part is its own
     width. Once stacked, the strip tries a single row again only when the
     frame has grown past the width it stacked at by more than a scrollbar
     or two (POT_UNSTACK_SLACK) — the layout effect then re-measures before
     anything is painted, and stacks again if it still does not fit. The
     slack is what stops it looping at the boundary; see the constant.
  */
  const frame = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(false)
  const stackedAt = useRef(0)
  const stack = forced ?? measured

  useLayoutEffect(() => {
    const el = frame.current
    if (!el || forced !== undefined) return

    const measure = () => {
      const room = el.clientWidth
      if (measured) {
        if (room > stackedAt.current + POT_UNSTACK_SLACK) setMeasured(false)
        return
      }
      const pot = el.firstElementChild
      if (!pot) return
      let need = POT_MIN_BRIDGE
      for (const part of pot.children) {
        if (!part.classList.contains('pot__bridge')) need += part.getBoundingClientRect().width
      }
      if (need > room) {
        stackedAt.current = room
        setMeasured(true)
      }
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measured, forced])

  /*
     Whole numbers.

     `formatNumber` leaves three decimals to the locale, which on a pot of
     3.6355 TLM reads as "3.636" — four digits of precision nobody can act
     on, in the largest type on the screen. The pot is a headline figure;
     what it is worth to a hundredth of a Trilium is not the point.
  */
  const tlm = Math.round(assetAmount(stage.tlm_rewards))
  const wax = Math.round(assetAmount(stage.wax_rewards))
  const rolled = weather.filter((w) => w.weather)
  /*
     On a phone the two figures share one short band beside a tab, and
     "18,400 TLM" next to "413 WAX" will not. They are written the way the
     header writes balances — 18.4K — which is the convention a player
     already reads at the top of every screen.
  */
  const phone = usePhone()
  const figure = phone ? formatCompact : formatNumber
  /* Whether the pot is explaining itself. */
  const [split, setSplit] = useState(false)
  /* Which roll a phone shows in words; the others are icons. */
  const [open, setOpen] = useState(0)

  return (
    /*
       The frame is a container the strip's own breakpoints read. A media
       query measures the window, and the window is not what the strip
       gets — a 1090-wide screen hands it 850 once the sidebar has taken
       its column. The strip stacks when *it* is short of room, whatever
       the screen is doing.
    */
    <div className="pot__frame" ref={frame}>
    <section className={'pot' + (stack ? ' pot--stacked' : '')}>
      {/*
         The label doubles as the way in to how the pot is split.

         Opens on hover for a mouse and on press for a thumb — the rolls
         beside it already work that way, so the panel is not teaching a new
         gesture. What it says is deliberately in places and shares rather
         than in figures: the exact split is a contract detail, and a player
         standing in front of the entry button wants to know whether going
         out in the first round is worth anything.
      */}
      {/*
         Built like a broadcast lower third: a gold REWARDS tab leading the
         figures on the left, the rolls trailing into a cyan CONDITIONS tab
         on the right, and a dashed bridge across the gap between them. It
         is the same visual language the fight broadcast uses, so the header
         and the fight read as one production. The bridge is what keeps two
         strips with a gap between them reading as one graphic with a break
         in it, rather than two that happen to share a row.
      */}
      <span className="pot__howwrap">
        <button
          type="button"
          className="pot__tab pot__tab--rewards pot__label--ask"
          aria-expanded={split}
          onClick={() => setSplit(!split)}
        >
          Rewards
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.1a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2zM9.1 12H6.9V7.3h2.2z" />
          </svg>
        </button>

        <span className={'pot__how' + (split ? ' pot__how--open' : '')} role="note">
          <b>Trilium</b> goes to everyone who wins at least a fight, shared out
          by how far they got. Each round you win is worth a great deal more
          than the one before, so lasting is what pays. A free pass in the
          opening round counts as a win.
          <br />
          <b>WAX</b> goes to the top sixteen only. The champion takes about a
          third of it, the runner-up a sixth, and the rest tapers away down to
          sixteenth place.
        </span>
      </span>

      <div className="pot__body pot__body--rewards">
      {tlm > 0 || wax > 0 ? (
        <div className="pot__figures">
          {tlm > 0 && (
            <span className="pot__figure mono">
              <img src={asset('/assets/icons/tlm.svg')} alt="" width={30} height={30} />
              {figure(tlm)}
              <small>TLM</small>
            </span>
          )}
          {wax > 0 && (
            <span className="pot__figure pot__figure--wax mono">
              {/* The same coin the wallet, the candle and the profile use —
                  a currency a player has seen elsewhere should not need
                  reading twice. */}
              <img src={asset('/assets/icons/wax-coin.png')} alt="" width={30} height={30} />
              {figure(wax)}
              <small>WAX</small>
            </span>
          )}
        </div>
      ) : (
        <p className="pot__empty">Being collected</p>
      )}
      </div>

      {rolled.length > 0 && <span className="pot__bridge" aria-hidden="true" />}
      {rolled.length > 0 && (
        <div className="pot__weather pot__body pot__body--cond">
          {/*
             No planet name: the roll applies to the whole tournament, so
             where it was drawn from is bookkeeping rather than something a
             player acts on.

             Four rolls: four columns where the band has the room, two by
             two on a small desktop. A phone has room beside its tab for the
             four as icons and one in words, so the icons are a switcher and
             the open roll is read out on the line under them; tapping an
             icon reads that one instead. The tab stays on their row.
          */}
          {rolled.map((w, i) => (
            <button
              type="button"
              key={`${w.planet}-${w.weather?.weather_id}`}
              className={`pot__roll${i === Math.min(open, rolled.length - 1) ? ' pot__roll--open' : ''}`}
              aria-pressed={i === Math.min(open, rolled.length - 1)}
              onClick={() => setOpen(i)}
            >
              <WeatherPanel weather={w.weather} tooltip={false} />
            </button>
          ))}
          {phone && (
            <div className="pot__rollread" aria-live="polite">
              <WeatherPanel weather={rolled[Math.min(open, rolled.length - 1)].weather} tooltip={false} />
            </div>
          )}
        </div>
      )}
      {rolled.length > 0 && <span className="pot__tab pot__tab--cond">Conditions</span>}
    </section>
    </div>
  )
}

/**
 * The day's steps, in the order the chain will walk them.
 *
 * Three states, and each one says what it is without being read. A finished
 * step is ticked, because "done" is the one thing a glance should be able to
 * pick out of a row of seven. The step that is running fills along the
 * bottom as its own window runs out — the same countdown as the number
 * beside it, in the shape people already read progress in. Everything else
 * is waiting, and says only when its turn comes.
 */
/** The narrowest a step tile is allowed to be, and the gap — from the CSS. */
const STEP_MIN = 84
const STEP_GAP = 5

export function DayStrip({ timeline, now }: { timeline: TimelineStep[]; now: number }) {
  /*
     How many steps fit, measured rather than guessed.

     A breakpoint cannot answer this: the same width holds seven steps with
     nothing beside them and four with the entry button there. So the strip
     watches its own box and drops to the steps either side of the running
     one when the rest would have to scroll — which it must never do, since
     the step that scrolls off is the one being asked about.

     Measuring the container and not the content is what keeps it stable:
     the columns are `1fr`, so showing fewer never changes the width that
     decided how many to show.
  */
  const strip = useRef<HTMLOListElement>(null)
  const [fits, setFits] = useState(timeline.length)

  useEffect(() => {
    const el = strip.current
    if (!el) return
    const measure = () =>
      setFits(Math.max(1, Math.floor((el.clientWidth + STEP_GAP) / (STEP_MIN + STEP_GAP))))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const shown = stripWindow(stripSteps(timeline), fits)

  return (
    <ol className="tour__strip" ref={strip}>
      {shown.map((step) => {
        const span = step.endMs - step.startMs
        /*
           A step with no duration — the weather roll, the prize collection —
           has nothing to fill, so it shows full rather than dividing by zero
           and drawing an empty bar under a step that is already working.
        */
        const pct =
          step.state === 'running' && span > 0
            ? Math.min(100, Math.max(0, ((now - step.startMs) / span) * 100))
            : 100

        return (
          <li key={step.index} className={`tour__step tour__step--${step.state}`}>
            <span className="tour__stepname">
              {step.state === 'done' && (
                <svg className="tour__tick" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2.5 8.5 L6 12 L13.5 4" />
                </svg>
              )}
              {stepLabel(step.name)}
            </span>
            <span className="tour__steptime mono">
              {step.state !== 'running'
                ? (() => {
                    const { day, time } = dayParts(step.startMs, now)
                    return (
                      <>
                        <span className="tour__stepday">{day}</span>{' '}
                        <span className="tour__stepat">{time}</span>
                      </>
                    )
                  })()
                : Number.isFinite(step.endMs) && step.endMs > now
                  ? untilText(step.endMs - now)
                  : /*
                       Its window is up and `advance` has not moved on yet.
                       "Any moment" belongs to a countdown a player is
                       waiting out; this one has run out, and the step is
                       waiting on the chain rather than on the clock.
                    */
                    'timer completed'}
            </span>
            {step.total > 0 && step.state === 'running' && (
              <span className="tour__steptask mono">
                {step.current}/{step.total}
              </span>
            )}
            {step.state === 'running' && (
              <span className="tour__stepbar" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The gates, shut, with the tournament behind them.
 *
 * This is the state a player finds the screen in nearly every time they open
 * it, and it used to be a countdown over five bullet points explaining the
 * rules. Nobody reads the rules of a fight twice.
 *
 * So the wait is a closed door instead. Two slabs meeting on a seam of
 * light, the roster waiting in front of them in silhouette, and the clock on
 * the doors. Nothing has to be explained: a shut gate with a crowd at it
 * says what is about to happen and makes being early feel like standing in
 * the right place.
 *
 * The one moving part is the gap. The doors are pressed together a day out
 * and stand a hand's width apart in the last minutes — the countdown made
 * physical, and the reason the seam gets brighter as the light behind it
 * finds more room to come through.
 */
/*
   What looks like something at the size of a thumbnail, best first.

   Most of the roster is a person-sized person, and a person-sized person
   in silhouette is a smudge. An elgem is all coat and horns and an onoros
   is all ears — but the elgem coat hangs better on some classes than on
   others, so the first two entries name a class as well.
*/
const SHAPELY = ['hunter/elgem', 'mystic/elgem', 'elgem', 'onoros']

/** Matches a class and race pair, or a race on its own. */
const looksLike = (f: { classname: string; racename?: string }, want: string) =>
  want.includes('/') ? `${f.classname}/${f.racename}` === want : f.racename === want

/**
 * Which five of the roster stand at the door.
 *
 * The middle three are simply the roster's own order. The two on the ends
 * are not: they have nothing overlapping them, so they are the only figures
 * read as individuals rather than as a line, and they get fighters from
 * further down the roster instead of the first and fifth.
 *
 * What they get is picked on the silhouette twice over. First the class,
 * because a silhouette *is* the class — the pose and the weapon come from
 * it, while the race mostly changes a head that is one dark shape either
 * way, so no class already standing in the middle is used again. Then the
 * race, because a handful of them do change the outline, and those go to
 * the ends where the outline is all there is.
 *
 * Only the right-hand end goes looking for a striking race, though. The
 * left simply takes the next fighter in reserve — both ends chasing the
 * same shortlist swapped out a left-hand figure that was already the best
 * one there. A roster too short to have anyone in reserve keeps the five
 * it has.
 */
export function gateCrowd<T extends { classname: string; racename?: string }>(
  fighters: T[],
  size = 5,
): T[] {
  const line = fighters.slice(0, size)
  if (line.length < size) return line

  const spare = fighters.slice(size)
  const taken = new Set(line.slice(1, size - 1).map((f) => f.classname))
  const fill = (slot: number, striking = false) => {
    const open = spare.filter((f) => !taken.has(f.classname))
    const shapely = striking
      ? SHAPELY.map((want) => open.find((f) => looksLike(f, want))).find(Boolean)
      : undefined
    const pick = shapely ?? open[0]
    if (pick) {
      spare.splice(spare.indexOf(pick), 1)
      line[slot] = pick
    }
    taken.add(line[slot].classname)
  }
  fill(0)
  fill(size - 1, true)
  return line
}

export function TournamentGates({
  fighters,
  progress,
  label,
  centre,
}: {
  fighters: { fighter_id: number; classname: string; racename: string }[]
  /** 0 at the last start, 1 when the doors open. */
  progress: number
  label: string
  centre: string
}) {
  const p = Math.min(1, Math.max(0, progress))
  /* Five. More than that and they stop being figures at a door and start
     being a crowd, which is a different picture. */
  const crowd = gateCrowd(fighters)

  return (
    <>
      {/*
         The gates are the page, not a panel on it.

         Fixed behind the content — the same trick `.shell__bg` uses for the
         game's own backdrop — so the doors run to every edge of the screen
         and the countdown stands in front of them rather than inside a box
         of its own. Waiting for a tournament is the whole screen; it may as
         well be the whole screen.
      */}
      <div className="gates" style={{ ['--p' as string]: String(p) }} aria-hidden="true">
        <span className="gates__door gates__door--l" />
        <span className="gates__door gates__door--r" />
        <span className="gates__seam" />
        <span className="gates__spill" />
        {/* The ground the light stops at and the fighters stand on. */}
        <span className="gates__floor" />

        <div className="gates__crowd">
          {crowd.map((fighter) => (
            <GameImg
              key={fighter.fighter_id}
              className="gates__figure"
              src={fighterSilhouette(fighter)}
              fallback={fighterSilhouetteFallback()}
              alt=""
              loading="eager"
              fetchPriority="high"
            />
          ))}
        </div>
      </div>

      {/*
         Hung, not floated: two cables and a board, the way an arena tells
         a crowd how long it has. See `.gates__rig`.
      */}
      <div className="gates__rig">
        <span className="gates__cables" aria-hidden="true">
          <i />
          <i />
        </span>
        <div className="gates__board">
          <span className="gates__label">{label}</span>
          <span className="gates__clock mono">{centre}</span>
        </div>
      </div>
    </>
  )
}

/**
 * Two doors on the waiting screen.
 *
 * The first opens while the last tournament is still on `curstage`
 * waiting for its cleanup, which is days: its results are there to look
 * at. Without one it is shut, as the hall of fame still is — the
 * contract's `hall_of_fame` step is not in the schedule yet, so that door
 * has nothing behind it. A door you can see is not built yet is better
 * than one nobody knows to expect.
 */
export function WaitLinks({ onPrevious }: { onPrevious?: () => void }) {
  return (
    <div className="gates__links">
      <button
        type="button"
        className="btn btn--ghost"
        disabled={!onPrevious}
        title={onPrevious ? 'The results of the last tournament' : 'No finished tournament to show'}
        onClick={onPrevious}
      >
        Previous Tournament
      </button>
      <button type="button" className="btn btn--ghost" disabled title="Coming soon">
        Hall of Fame
      </button>
    </div>
  )
}

export interface GateFighter {
  fighter_id: number
  classname: string
  racename: string
}

export function NoTournament({
  nextStart,
  now,
  everySec,
  fighters,
  onPrevious,
}: {
  nextStart: number
  now: number
  everySec: number
  fighters: GateFighter[]
  onPrevious?: () => void
}) {
  if (!Number.isFinite(nextStart)) {
    return (
      <section className="tour__panel tour__panel--wait">
        <h2 className="tour__h2">No tournament is running</h2>
        <p className="muted">The next start has not been scheduled yet.</p>
      </section>
    )
  }

  /*
     Filled from the last start to the next one, so the dial is a picture of
     the day rather than of the minute it happens to be opened in.
  */
  const window = Math.max(1, everySec * 1000)
  const progress = Math.min(1, Math.max(0, 1 - (nextStart - now) / window))

  return (
    <section className="tour__panel tour__panel--wait">
      <TournamentGates
        fighters={fighters}
        progress={progress}
        label="Tournament preparation starting in"
        centre={boardText(nextStart - now)}
      />
      <WaitLinks onPrevious={onPrevious} />
    </section>
  )
}

export function Preparing({
  fighters,
  stage,
  weather,
  signupAt,
  now,
  onPrevious,
}: {
  fighters: GateFighter[]
  /**
   * The tournament being prepared, where there is one.
   *
   * The pot and the rolls are on this row the moment the chain writes them:
   * `set_weather` fills `weather_effects` and `get_rewards` fills the two
   * reward assets. Both land during preparation, so both can be read before
   * the doors open rather than after.
   */
  stage?: TournamentStage
  weather: { planet: string; weather?: Weather }[]
  /** When the `signup` step starts, off the tournament's own schedule. */
  signupAt: number
  now: number
  onPrevious?: () => void
}) {
  return (
    <section className="tour__panel tour__panel--wait">
      {/*
         Shown from the first moment of preparation, not once it is full.

         PrizeBar says "Being collected" while the pot is still zero and
         draws nothing where no roll has landed, so it tells the truth at
         every point of the setup and fills in as the steps run.
      */}
      {stage && <PrizeBar stage={stage} weather={weather} />}

      {/*
         The doors at their widest — nobody can act during setup — but the
         clock is real: the schedule says when signup starts, and
         `boardText` falls back to "any moment" once that moment is here.
      */}
      <TournamentGates
        fighters={fighters}
        progress={1}
        label="Signup opens in"
        centre={boardText(signupAt - now)}
      />
      <WaitLinks onPrevious={onPrevious} />
    </section>
  )
}

/** The five, as they would be fielded. */
export function TeamRow({
  team,
  levelMod,
  ageDecay,
  onInspect,
  onRemove,
  onEmpty,
  sixth,
}: {
  team: (RosterFighter | null)[]
  levelMod: number
  ageDecay: number
  onInspect: (f: RosterFighter) => void
  /** Take this fighter back out of the line-up. */
  onRemove: (f: RosterFighter) => void
  onEmpty: () => void
  /**
   * The crew and weapon, standing in the line-up.
   *
   * They are not decoration down the page: `getFighterFromNFT` builds a
   * sixth fighter out of the pair and fields it beside the other five, so
   * the row is where they belong — and an empty pair reads as a gap in the
   * team rather than as a panel nobody opened.
   */
  sixth?: ReactNode
}) {
  /*
     Which card has its pair of buttons showing, on a phone.

     A pointer opens them by resting on the card and shuts them by leaving,
     which is CSS and needs nothing here. A finger has neither, so on a
     phone the first tap is the reach: it opens this one and, because only
     one can be open, shuts whichever was.
  */
  const phone = usePhone()
  const [reached, setReached] = useState<number | null>(null)

  return (
    <div className="tour__row">
      {team.map((f, i) =>
        f ? (
          <div
            key={f.fighter_id}
            className={`tour__slot${phone && reached === f.fighter_id ? ' tour__slot--open' : ''}`}
          >
            <CombatCard
              element={f.element}
              classname={f.classname}
              racename={f.racename}
              level={f.stats.level}
              health={
                mid(f.stats.health_min, f.stats.health_max) *
                levelFactor(f.stats.level, levelMod) *
                ageFactor(f.creation_date, ageDecay)
              }
              damage={
                mid(f.stats.damage_min, f.stats.damage_max) *
                levelFactor(f.stats.level, levelMod) *
                ageFactor(f.creation_date, ageDecay)
              }
              side="mine"
              onOpen={() => onInspect(f)}
              marker={f.marker}
            />
            {/*
              On a phone, the tap that stands in for the rest of a pointer.
              It exists only while the pair is shut, so it can never be the
              thing a player hits when they are aiming at one of them.
            */}
            {phone && reached !== f.fighter_id && (
              <button
                type="button"
                className="tour__slottap"
                aria-label={`${f.classname} — details or remove`}
                onClick={() => setReached(f.fighter_id)}
              />
            )}
            <div className="tour__slotacts">
              <button
                type="button"
                className="tour__slotsee"
                onClick={() => {
                  setReached(null)
                  onInspect(f)
                }}
              >
                Details
              </button>
              <button
                type="button"
                className="tour__slotout"
                onClick={() => {
                  setReached(null)
                  onRemove(f)
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button key={`empty-${i}`} type="button" className="tour__empty" onClick={onEmpty}>
            Pick a fighter
          </button>
        ),
      )}
      {sixth}
    </div>
  )
}

/**
 * The sixth fighter: the crew and the weapon, as the thing they become.
 *
 * `getFighterFromNFT` fuses the pair into a fighter and fields it beside
 * the other five, so the line-up shows it as a fighter — the unknown
 * portrait the game uses for it everywhere else — rather than as two card
 * slots pretending to be equipment. The cards themselves sit in the corner
 * of its own card, which is both where they came from and where they can be
 * taken back off.
 */
export function NftSlot({
  crew,
  weapon,
  values,
  onOpenCard,
  onClearCrew,
  onClearWeapon,
  onPick,
  onOpen,
}: {
  crew: CardTemplate | null
  weapon: CardTemplate | null
  values: Map<number, NftValue>
  onOpenCard: (c: CardTemplate) => void
  onClearCrew: () => void
  onClearWeapon: () => void
  onPick: (tab: Tab) => void
  onOpen: () => void
}) {
  const fused = combineNftFighter(
    crew ? (values.get(crew.template_id) ?? null) : null,
    weapon ? (values.get(weapon.template_id) ?? null) : null,
  )

  const slot = (card: CardTemplate | null, tab: Tab, clear: () => void) =>
    card ? (
      <span className="tour__nftcard" key={tab}>
        <button type="button" className="tour__nftcardart" onClick={() => onOpenCard(card)} title={card.name}>
          <img
            src={asset(`/assets/cards/${card.template_id}.webp`)}
            alt={card.name}
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget
              const next = img.dataset.tried ? undefined : ipfsImage(card.img)
              img.dataset.tried = '1'
              img.src = next ?? asset('/assets/default-card.png')
            }}
          />
        </button>
        <button type="button" className="tour__nftdrop" onClick={clear} title={`Remove ${card.name}`}>
          ×
        </button>
      </span>
    ) : (
      <button
        type="button"
        key={tab}
        className="tour__nftcard tour__nftcard--empty"
        onClick={() => onPick(tab)}
      >
        {tab === 'crew' ? 'Crew' : 'Weapon'}
      </button>
    )

  /*
     The portrait waits for both halves.

     A crew card alone is not a fighter — the weapon decides its element and
     half its numbers — so showing the art with one slot filled promises a
     sixth fighter that does not exist yet. Until both are in, the place it
     will stand is an empty slot like the other five.
  */
  const ready = !!crew && !!weapon

  return (
    <div className={`tour__nft${ready ? ' tour__nft--ready' : ''}`}>
      {ready ? (
        <CombatCard
          element={fused?.element ?? 'neutral'}
          classname="NFT Fighter"
          racename="Crew + weapon"
          health={fused?.health.min ?? 0}
          damage={fused?.damage.min ?? 0}
          side="mine"
          art={fighterArtFallback()}
          onOpen={onOpen}
        />
      ) : (
        <div className="tour__nftempty">
          <span className="tour__nftlabel">Sixth fighter</span>
        </div>
      )}
      <div className="tour__nftcards">
        {slot(crew, 'crew', onClearCrew)}
        {slot(weapon, 'weapon', onClearWeapon)}
      </div>
    </div>
  )
}

/**
 * The one decision on the screen, beside the day that frames it.
 *
 * It lived at the bottom of the entry panel, under a picker a hundred and
 * fifty fighters long — a page and a half below the team it acts on. Up
 * here it shares a line with the step strip: what is happening, and the one
 * thing you can do about it. The reason it is disabled is on the button
 * itself, which is where a player looks when a button will not press.
 */
export function EntryActions({
  score,
  energyCost,
  block,
  busy,
  canSign,
  onEnter,
}: {
  score: number
  energyCost: number
  block: EntryBlock
  busy: boolean
  canSign: boolean
  onEnter: () => void
}) {
  return (
    <div className="tour__actions">
      {/* Before the button, on its line: it is what the button is about to
          spend, not a footnote under it. */}
      <span
        className="tour__score"
        title="A point a level, ten an ascension. It decides your seeding, not your fighting."
      >
        Seeding score <b className="mono">{score}</b>
      </span>
      <button
        type="button"
        className="btn btn--primary"
        disabled={!canSign || !block.ready || busy}
        onClick={onEnter}
        title={block.reason}
      >
        {busy && <span className="spinner" />}
        {busy ? 'Entering…' : 'Enter the tournament'}
        {!busy && (
          /* The price, not a deduction: the button is a purchase. */
          <span className="tour__cost">
            {energyCost}
            <img src={asset('/assets/icons/energy.png')} alt="energy" width={16} height={16} />
          </span>
        )}
      </button>
    </div>
  )
}

/**
 * The one decision on the screen.
 *
 * The picker is passed in rather than built here, so this panel is drawable
 * without a roster — the entry warning and what it costs are the part worth
 * looking at before a tournament is ever running.
 */
export function EntryPanel({ team, children }: { team: ReactNode; children?: ReactNode }) {
  return (
    <section className="tour__panel">
      {/*
         No heading here.

         The strip above already says entry is open and counts it down, and
         the field below already says how many have entered — this said both
         again at the width of the page. The one thing it had that nothing
         else does is the score, which moves as fighters are picked, so that
         goes beside the button it decides.
      */}
      {team}

      {children}
    </section>
  )
}

export function Battle({
  stage,
  bracket,
  pairings,
  byes,
  weather,
  mineWallet,
  entered,
  now,
}: {
  stage: TournamentStage
  bracket: Bracket
  pairings: TournamentMatchup[]
  /**
   * Entrants whose seed spared them the round.
   *
   * Only the opening one has any: the contract hands the top seeds a win
   * apiece and draws the pairings out of everyone below them, so from round
   * one onwards the field is a power of two and everybody fights.
   */
  byes: TournamentSignup[]
  /** Every roll of the round — the bout is fought under all of them. */
  weather: Weather[]
  mineWallet: string | null
  entered: boolean
  now: number
}) {
  const round = Number(stage.current_round ?? 0)
  const fought = Number(stage.current_battle ?? 0)
  const inRound = Number(stage.battles_in_round ?? 0)

  /*
     A fight the player went back to watch.

     Null is "follow the chain", which is what the screen does on its own.
     Once they pick one it stays put — a round moving on underneath them
     must not yank the broadcast away mid-fight.
  */
  const [watching, setWatching] = useState<number | null>(null)

  /*
     The bout the contract is on, or the last one once the round is fought
     out — so the broadcast always has something to offer rather than going
     blank the moment the fighting stops.
  */
  const liveAt = pairings.length ? Math.min(fought, pairings.length - 1) : -1

  const watchedAt = watching === null ? -1 : pairings.findIndex((p) => p.index === watching)
  const shownAt = watchedAt >= 0 ? watchedAt : liveAt
  const shown = shownAt >= 0 ? pairings[shownAt] : null

  /* A pick that is no longer among this round's pairings — the round moved
     on — drops back to following the chain. */
  useEffect(() => {
    if (watching !== null && watchedAt < 0) setWatching(null)
  }, [watching, watchedAt])

  return (
    <section className="tour__panel">
      {shown && !!shown.wallet_player2 && (
        /*
           Keyed on the pairing so switching to an older fight starts it at
           the poster, rather than dropping the viewer into the middle of a
           replay the previous fight had already wound forward.
        */
        <BoutBroadcast
          key={`${round}:${shown.index}`}
          m={shown}
          round={round}
          bout={shownAt}
          weather={weather}
          mineWallet={mineWallet}
          autoPlay={watchedAt >= 0}
          /* The next fight is on screen as soon as the last is reported,
             but it cannot be run before its slot: see BoutRows. */
          lockedUntil={shownAt === liveAt && !shown.winner ? chainTime(shown.play_time) : NaN}
          now={now}
        />
      )}

      {watchedAt >= 0 && (
        <button type="button" className="tour__backlive" onClick={() => setWatching(null)}>
          Back to the live fight
        </button>
      )}

      <header className="tour__fieldhead">
        <h2 className="tour__h2">
          Round {round + 1}
          {bracket.rounds > 0 ? ` of ${bracket.rounds}` : ''}
        </h2>
        <span className="faint">
          {inRound > 0
            ? `${formatNumber(Math.min(fought, inRound))} of ${formatNumber(inRound)} fought`
            : 'Drawing the pairings'}
        </span>
      </header>

      {pairings.length > 0 ? (
        <BoutRows
          pairings={pairings}
          fought={fought}
          mineWallet={mineWallet}
          watching={watching}
          onWatch={setWatching}
          now={now}
        />
      ) : (
        <p className="faint">
          {entered
            ? 'The pairings for this round have not been drawn yet.'
            : 'The pairings for this round are being drawn.'}
        </p>
      )}

      {/*
        The byes, named.

        A bracket that shows eleven fighting and says nothing about the five
        sitting out is a bracket a player cannot count. These are the seeds
        the field earned a pass for, and on the opening round they are half
        the story of who is still in.
      */}
      {round === 0 && byes.length > 0 && (
        <div className="tour__byes">
          <h3 className="tour__byeshead">
            Through on seed
            <span className="faint"> · no opponent this round</span>
          </h3>
          <ul className="tour__byelist">
            {byes.map((s) => (
              <li
                key={s.wallet}
                className={`tour__bye${s.wallet === mineWallet ? ' tour__bye--mine' : ''}`}
              >
                <PlayerAvatar
                  id={s.avatar}
                  name={s.playertag}
                  className="tour__byeface"
                  size={28}
                />
                <span>{s.playertag || 'Unnamed'}</span>
                <span className="tour__byescore mono">{formatNumber(s.score)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/**
 * The fights of one round, as rows.
 *
 * Shared by the live board and the results: a row names both sides, marks
 * who took it, says when its slot was, opens to both line-ups, and plays.
 * `fought` is how far the contract has got through the round — every row
 * once the round is over — and decides which rows can be watched.
 */
export function BoutRows({
  pairings,
  fought,
  mineWallet,
  watching,
  onWatch,
  now,
}: {
  pairings: TournamentMatchup[]
  fought: number
  mineWallet: string | null
  /** The screen's clock: a fight is not live before its own slot. */
  now: number
  /** The index of the fight being watched, if one was picked from here. */
  watching: number | null
  onWatch: (index: number) => void
}) {
  /* One open at a time: two line-ups is ten combat cards, and the point of
     opening one is to read it against the name across from it. */
  const [open, setOpen] = useState<number | null>(null)

  return (
  <ol className="tour__bouts">
    {pairings.map((m, i) => {
      const mine =
        !!mineWallet && (m.wallet_player1 === mineWallet || m.wallet_player2 === mineWallet)
      /*
         A pairing is decided when the chain says who took it, and
         `winner` is a string — the contract has written a tag in it
         and a wallet in it at different times — so both are checked
         rather than guessing which this row holds.
      */
      const won1 = winnerSide(m) === 1
      const won2 = winnerSide(m) === 2
      const drawn = !!m.wallet_player2
      const isOpen = open === m.index
      /*
         The contract fights them in order, one call at a time — but not
         before each one's slot. Its counter points at the next fight the
         moment the last one is reported, which can be hours before that
         fight's time; until then it is still to come, and running it
         early would show a result the chain has not produced.
      */
      const slotAt = chainTime(m.play_time)
      const due = !Number.isFinite(slotAt) || slotAt <= now
      const state = !drawn
        ? 'Being drawn'
        : m.winner
          ? 'Fought'
          : i < fought
            ? 'Fought'
            : i === fought && due
              ? 'Fighting now'
              : 'To come'
      const unlocks = m.play_time ? clock(slotAt) : ''
      /*
         Every fight the chain has reached can be watched: the seed is
         on the row and the fight is generated from it, so one already
         fought runs again exactly as it happened, and the one under
         way runs as it is happening. Only a fight whose slot has not
         come round yet has nothing to show.
      */
      const watchable = drawn && state !== 'To come'

      return (
        <li
          key={m.index}
          className={
            'tour__bout' +
            (mine ? ' tour__bout--mine' : '') +
            (state === 'Fighting now' ? ' tour__bout--live' : '') +
            (isOpen ? ' tour__bout--open' : '')
          }
        >
          <div className="tour__boutrow">
            <button
              type="button"
              className="tour__boutmain"
              aria-expanded={isOpen}
              disabled={!drawn}
              onClick={() => setOpen(isOpen ? null : m.index)}
              title={drawn ? 'See both line-ups' : 'This pairing is still being drawn'}
            >
            <span className="tour__boutno mono">{i + 1}</span>
            <BoutSide
              wallet={m.wallet_player1}
              tag={m.gamertag_player1}
              avatar={m.avatar_player1}
              won={won1}
              beaten={won2}
              mineWallet={mineWallet}
            />
            <span className="tour__boutvs" aria-hidden="true">
              VS
            </span>
            <BoutSide
              wallet={m.wallet_player2}
              tag={m.gamertag_player2}
              avatar={m.avatar_player2}
              won={won2}
              beaten={won1}
              mineWallet={mineWallet}
              right
            />
            <span className="tour__boutend">
              <span className="tour__boutwhen">
                <span
                  className={`tour__boutstate${
                    state === 'Fighting now' ? ' tour__boutstate--live' : ''
                  }`}
                >
                  {state}
                </span>
                {/* Every pairing carries a slot, and the contract will
                    not run one before its time — so this is the answer
                    to "when is mine on". */}
                {unlocks && (
                  <span className="tour__bouttime mono">
                    {state === 'To come' ? `from ${unlocks}` : unlocks}
                  </span>
                )}
              </span>
              {drawn && (
                <svg
                  className={`tour__chev${isOpen ? ' tour__chev--open' : ''}`}
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              )}
            </span>
            </button>

            {/* Shown on every row so the column lines up, and dimmed
                rather than dropped where there is nothing to play —
                an absent control reads as a layout fault. */}
            <button
              type="button"
              className={'tour__watch' + (m.index === watching ? ' tour__watch--on' : '')}
              disabled={!watchable}
              onClick={() => onWatch(m.index)}
              title={
                watchable
                  ? `Watch fight ${i + 1}`
                  : unlocks
                    ? `This fight starts at ${unlocks}`
                    : 'This fight has not started yet'
              }
              aria-label={`Watch fight ${i + 1}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
          {isOpen && <BoutLineup m={m} />}
        </li>
      )
    })}
  </ol>
  )
}

/**
 * Both line-ups in a pairing, read when somebody opens it.
 *
 * Ten fighters and four cards, which is two of the reads the field list
 * already makes — so it is done on a click rather than for every bout on
 * the board. Side by side because that is the comparison being asked for:
 * what beats what is the whole of why a player opens a matchup they are not
 * in.
 */
export function BoutLineup({ m }: { m: TournamentMatchup }) {
  return (
    <div className="tour__boutdetail">
      <div className="tour__corner">
        <h4 className="tour__cornername">{m.gamertag_player1 || 'Unnamed'}</h4>
        <BoutCorner
          who={m.wallet_player1}
          fighterIds={m.fighter_ids_player1}
          crew={m.crew_template_id_player1}
          arms={m.arms_template_id_player1}
        />
      </div>
      <div className="tour__corner">
        <h4 className="tour__cornername">{m.gamertag_player2 || 'Unnamed'}</h4>
        <BoutCorner
          who={m.wallet_player2}
          fighterIds={m.fighter_ids_player2}
          crew={m.crew_template_id_player2}
          arms={m.arms_template_id_player2}
        />
      </div>
    </div>
  )
}

/**
 * One side of a pairing: five fighters read on demand, and its two cards.
 *
 * Five keyed reads and nothing else — the templates are on the row.
 */
function BoutCorner({
  who,
  fighterIds,
  crew,
  arms,
}: {
  who: string
  fighterIds: number[]
  crew: number
  arms: number
}) {
  const ids = fighterIds.join(',')
  const crews = useChainQuery(`tournament-bout:${who}:${ids}`, () => fetchFightersByIds(fighterIds), {
    deps: ['fighters'],
    enabled: fighterIds.length > 0,
  })

  const { classes, levelMod, ageDecay } = useConfig()
  /* The fighter a tap opened, as the sheet the rest of the game uses. */
  const [shown, setDetail] = useState<Detail>(null)

  if (crews.loading && !crews.data) {
    return (
      <div className="tour__lineup tour__lineup--wait">
        <span className="spinner" /> Reading the line-up…
      </div>
    )
  }

  const fighters = crews.data ?? []

  return (
    <div className="tour__lineup">
      {fighters.map((fighter) => (
        <CombatCard
          key={fighter.fighter_id}
          element={fighter.element}
          classname={fighter.classname}
          racename={fighter.racename}
          level={fighter.stats.level}
          health={
            mid(fighter.stats.health_min, fighter.stats.health_max) *
            levelFactor(fighter.stats.level, levelMod) *
            ageFactor(fighter.creation_date, ageDecay)
          }
          damage={
            mid(fighter.stats.damage_min, fighter.stats.damage_max) *
            levelFactor(fighter.stats.level, levelMod) *
            ageFactor(fighter.creation_date, ageDecay)
          }
          side="mine"
          marker={fighter.marker}
          /* A tap opens what the hover shows: on a phone there is no hover. */
          onOpen={() =>
            setDetail({
              kind: 'panel',
              panel: rosterPanel(fighter, levelMod, ageDecay),
              template: classes.get(fighter.classname),
            })
          }
          preview={() => ({
            panel: rosterPanel(fighter, levelMod, ageDecay),
            template: classes.get(fighter.classname),
          })}
        />
      ))}

      <LineupCard label="Crew" template={crew || undefined} />
      <LineupCard label="Weapon" template={arms || undefined} />
      {shown && (
        <DetailSheet panel={shown.panel} template={shown.template} onClose={() => setDetail(null)} />
      )}

      {crews.error && <span className="hint">{crews.error}</span>}
      {!crews.loading && fighters.length === 0 && (
        <span className="faint">These fighters are no longer on chain.</span>
      )}
    </div>
  )
}

/** One corner of a pairing. Empty until the second half of the draw runs. */
function BoutSide({
  wallet,
  tag,
  avatar,
  won,
  beaten,
  mineWallet,
  right = false,
}: {
  wallet: string
  tag: string
  avatar: number
  won: boolean
  beaten: boolean
  mineWallet: string | null
  right?: boolean
}) {
  if (!wallet) {
    return <span className="tour__boutside tour__boutside--empty">Waiting</span>
  }
  return (
    <span
      className={
        'tour__boutside' +
        (right ? ' tour__boutside--right' : '') +
        (won ? ' tour__boutside--won' : '') +
        (beaten ? ' tour__boutside--out' : '') +
        (wallet === mineWallet ? ' tour__boutside--me' : '')
      }
    >
      <PlayerAvatar id={avatar} name={tag} className="tour__boutface" size={44} />
      <span className="tour__boutname">{tag || 'Unnamed'}</span>
    </span>
  )
}

/**
 * The results: every fight of the tournament, who took it, and play.
 *
 * By the time the stage reaches its results the signups are gone — cleanup
 * erases them before it erases itself — so the matchups are all that is
 * left of what happened, and they carry everything the board needs: both
 * names and faces, the line-ups, the slot and the winner. The player's own
 * record is counted off them rather than read off a row that no longer
 * exists. The final is offered first, at its poster; play on any row runs
 * that fight.
 */
export function Results({
  history,
  weather,
  wallet,
  mine,
  payout,
  nextStart,
  now,
}: {
  /** Every round's matchups, round 0 first; a round the chain has no rows for is empty. */
  history: TournamentMatchup[][]
  weather: Weather[]
  /** The player looking, whether or not they entered. */
  wallet: string
  mine: TournamentSignup | undefined
  payout: TournamentPayout | undefined
  nextStart: number
  now: number
}) {
  const rounds = history
    .map((pairings, round) => ({ round, pairings }))
    .filter((r) => r.pairings.length > 0)
  const last = rounds[rounds.length - 1]
  const final = last?.pairings[0]

  const [watching, setWatching] = useState<{ round: number; index: number } | null>(null)
  const picked = watching
    ? history[watching.round]?.find((m) => m.index === watching.index)
    : undefined
  const shown = picked ?? final
  const shownRound = picked ? watching!.round : (last?.round ?? 0)
  const shownAt = shown ? Math.max(0, history[shownRound]?.indexOf(shown) ?? 0) : 0

  const champion = !final
    ? null
    : winnerSide(final) === 1
      ? { wallet: final.wallet_player1, tag: final.gamertag_player1 }
      : winnerSide(final) === 2
        ? { wallet: final.wallet_player2, tag: final.gamertag_player2 }
        : null

  const fights = history.flat()
  const side = (m: TournamentMatchup) =>
    m.wallet_player1 === wallet ? 1 : m.wallet_player2 === wallet ? 2 : 0
  const played = fights.some((m) => side(m) > 0)
  const wins = fights.filter((m) => side(m) > 0 && winnerSide(m) === side(m)).length
  const losses = fights.filter(
    (m) => side(m) > 0 && winnerSide(m) > 0 && winnerSide(m) !== side(m),
  ).length
  const points = mine?.reward_points ?? payout?.reward_points
  /* Fights are the truth where there are any; `battles_won` also counts a
     free pass, so it is only the fallback. */
  const record = fights.length > 0 ? wins : (mine?.battles_won ?? 0)

  return (
    <section className="tour__panel tour__results">
      {shown && !!shown.wallet_player2 && (
        <BoutBroadcast
          key={`${shownRound}:${shown.index}`}
          m={shown}
          round={shownRound}
          bout={shownAt}
          weather={weather}
          mineWallet={wallet}
          autoPlay={!!picked}
        />
      )}

      <header className="tour__fieldhead">
        <h2 className="tour__h2">Results</h2>
        {champion && (
          <span className="tour__champion">
            Champion <b>{champion.tag || champion.wallet}</b>
            {champion.wallet === wallet && <span className="tour__championyou"> · you</span>}
          </span>
        )}
      </header>

      {played || mine ? (
        <p className="tour__big mono">
          {formatNumber(record)} win{record === 1 ? '' : 's'}
          <span className="tour__bigsub">
            {losses > 0
              ? `${losses} loss${losses === 1 ? '' : 'es'}`
              : champion?.wallet === wallet
                ? 'unbeaten'
                : ''}
            {points !== undefined ? ` · ${formatNumber(points)} reward points` : ''}
            {payout && mine ? ` · ${formatNumber(payout.reward_points)} banked` : ''}
          </span>
        </p>
      ) : (
        <p className="muted">You did not enter this one.</p>
      )}

      {rounds.length === 0 && (
        <p className="faint">The fights of this tournament are no longer on chain.</p>
      )}

      {rounds.map(({ round, pairings }) => (
        <section key={round} className="tour__round">
          <h3 className="tour__roundhead">
            {round === last?.round ? 'Final' : `Round ${round + 1}`}
            <span className="faint">
              {' '}· {pairings.length} fight{pairings.length === 1 ? '' : 's'}
            </span>
          </h3>
          <BoutRows
            pairings={pairings}
            fought={pairings.length}
            mineWallet={wallet}
            watching={watching?.round === round ? watching.index : null}
            onWatch={(index) => setWatching({ round, index })}
            now={now}
          />
        </section>
      ))}

      <p className="faint">
        Reward points decide the share of the pool. The next tournament opens
        {Number.isFinite(nextStart) ? ` in ${untilText(nextStart - now)}` : ' soon'}.
      </p>
    </section>
  )
}

/**
 * The top of the fight card: the event, and when the fighting starts.
 *
 * "The Grand Tournament", presented by the game — winning one is what
 * makes a player a legend. Not "Fight Night": the battle stage opens at
 * the same instant for everyone, which is the morning for half of them.
 * The line underneath says when in the player's own clock, and goes away
 * once the fighting has begun: by then the board below it is the news.
 */
export function PosterHead({ fightAt, now }: { fightAt: number; now: number }) {
  return (
    <header className="tour__posterhead">
      <span className="tour__presents">Alien Legends presents</span>
      <h2 className="tour__event">The Grand Tournament</h2>
      {Number.isFinite(fightAt) && fightAt > now && (
        <p className="tour__when">
          Fighting starts <b>{dayClock(fightAt, now)}</b>
        </p>
      )}
    </header>
  )
}

/**
 * Your entry: the headliner line on the card.
 *
 * Gold-framed and above the field rather than a panel of its own: it is
 * the one line of the bill that is about you. The four figures sit as a
 * record on the right, and the free-pass verdict rides on the entry line
 * rather than taking a paragraph.
 */
export function MyEntry({
  mine,
  seeding,
  bracket,
}: {
  mine: TournamentSignup
  seeding: { rank: number; total: number; freePass: boolean | null } | null
  bracket: Bracket
}) {
  const pass =
    seeding?.freePass === true
      ? 'your seed earned a free pass through the opening round'
      : seeding?.freePass === false && bracket.preliminaryBattles > 0
        ? 'your seed did not reach a free pass, so you fight the opening round'
        : null

  return (
    <section className="tour__mine">
      <PlayerAvatar id={mine.avatar} name={mine.playertag} className="tour__headav" size={52} />
      <div className="tour__minetext">
        <h2 className="tour__h2 tour__minetitle">You are in</h2>
        <p className="faint tour__minesub">
          Entered {clock(chainTime(mine.signup_timestamp))} with {mine.fighter_ids.length}{' '}
          fighter{mine.fighter_ids.length === 1 ? '' : 's'}
          {pass && <span className="tour__pass"> · {pass}</span>}
        </p>
      </div>
      <dl className="tour__minestats">
        <div>
          <dt>Score</dt>
          <dd className="mono">{formatNumber(mine.score)}</dd>
        </div>
        {seeding && (
          <div>
            <dt>Seed</dt>
            <dd className="mono">
              {seeding.rank}/{seeding.total}
            </dd>
          </div>
        )}
        <div>
          <dt>Wins</dt>
          <dd className="mono">{formatNumber(mine.battles_won)}</dd>
        </div>
        <div>
          <dt>Points</dt>
          <dd className="mono">{formatNumber(mine.reward_points)}</dd>
        </div>
      </dl>
    </section>
  )
}

/**
 * Everyone who entered, in seeding order.
 *
 * A list rather than a bracket: the contract draws one round of pairings at a
 * time, so a bracket here would be a picture of matches nobody has committed
 * to. The free-pass line is drawn only once entry has closed and the count on
 * the stage row is final.
 */
/**
 * One of the two cards a line-up was entered with.
 *
 * Drawn from the template rather than the asset: a template is what the
 * card *is*, it has the artwork and the rarity hanging off it, and two
 * players holding the same crew card hold the same template. Where the
 * caller only has an asset id it resolves that first — see `EntryLineup`.
 */
function LineupCard({ label, template }: { label: string; template: number | undefined }) {
  const { nftValues } = useConfig()
  const value = template ? nftValues.get(template) : undefined

  return (
    <span className="tour__lcard">
      {template ? (
        <GameImg
          className="tour__lcardart"
          src={asset(`/assets/cards/${template}.webp`)}
          fallback={asset('/assets/default-card.png')}
          alt={label}
          loading="lazy"
        />
      ) : (
        <span className="tour__lcardart tour__lcardart--none" />
      )}
      <span className="tour__lname">{label}</span>
      <span className="tour__lmeta mono">{value ? value.rarity : 'none'}</span>
    </span>
  )
}

/**
 * One entrant's line-up, fetched when their row is opened.
 *
 * Nothing is read until somebody asks: a field of fifty is fifty line-ups,
 * and an entry is five keyed fighter reads plus one for the pair of cards.
 * Opened once, it stays in the cache — an entry cannot change after it is
 * made.
 */
/* Narrowed from `TournamentSignup` so a pairing can hand over one of its
   two corners, which carries the same four fields under longer names. */
type EntryRef = Pick<TournamentSignup, 'wallet' | 'fighter_ids' | 'crew_asset_id' | 'arms_asset_id'>

/**
 * An entry's fighters and its two cards, read once and kept.
 *
 * Shared between the opened line-up and the hover on the row's faces, under
 * one key, so whichever a player reaches for first pays for the read and
 * the other finds it waiting. `enabled` lets the hover ask for it only once
 * a pointer has actually come to rest on a row.
 */
function useEntryDetail(entry: EntryRef, enabled = true) {
  const ids = entry.fighter_ids.join(',')
  const crew = String(entry.crew_asset_id ?? 0)
  const arms = String(entry.arms_asset_id ?? 0)

  return useChainQuery(enabled ? `tournament-entry:${entry.wallet}:${ids}` : null, async () => {
    const [fighters, templates] = await Promise.all([
      fetchFightersByIds(entry.fighter_ids),
      fetchAssetTemplates([crew, arms]),
    ])
    return { fighters, templates }
  })
}

export function EntryLineup({ entry }: { entry: EntryRef }) {
  const crew = String(entry.crew_asset_id ?? 0)
  const arms = String(entry.arms_asset_id ?? 0)
  const detail = useEntryDetail(entry)
  /* The fighter a tap opened, as the sheet the rest of the game uses. */
  const [shown, setDetail] = useState<Detail>(null)

  const { classes, levelMod, ageDecay } = useConfig()
  const cards = [
    { label: 'Crew', assetId: crew },
    { label: 'Weapon', assetId: arms },
  ]

  if (detail.loading && !detail.data) {
    return (
      <div className="tour__lineup tour__lineup--wait">
        <span className="spinner" /> Reading the line-up…
      </div>
    )
  }

  const fighters = detail.data?.fighters ?? []
  const templates = detail.data?.templates ?? new Map<string, number>()

  return (
    <div className="tour__lineup">
      {/*
         The same card the dungeon, the arena and the result screen field —
         hover included, so the stats are read the way they are read
         everywhere else rather than in a shape invented for this list.
      */}
      {fighters.map((fighter) => (
        <CombatCard
          key={fighter.fighter_id}
          element={fighter.element}
          classname={fighter.classname}
          racename={fighter.racename}
          level={fighter.stats.level}
          health={
            mid(fighter.stats.health_min, fighter.stats.health_max) *
            levelFactor(fighter.stats.level, levelMod) *
            ageFactor(fighter.creation_date, ageDecay)
          }
          damage={
            mid(fighter.stats.damage_min, fighter.stats.damage_max) *
            levelFactor(fighter.stats.level, levelMod) *
            ageFactor(fighter.creation_date, ageDecay)
          }
          side="mine"
          marker={fighter.marker}
          /* A tap opens what the hover shows: on a phone there is no hover. */
          onOpen={() =>
            setDetail({
              kind: 'panel',
              panel: rosterPanel(fighter, levelMod, ageDecay),
              template: classes.get(fighter.classname),
            })
          }
          preview={() => ({
            panel: rosterPanel(fighter, levelMod, ageDecay),
            template: classes.get(fighter.classname),
          })}
        />
      ))}

      {cards.map(({ label, assetId }) => (
        <LineupCard key={label} label={label} template={templates.get(assetId)} />
      ))}

      {detail.error && <span className="hint">{detail.error}</span>}
      {!detail.loading && fighters.length === 0 && (
        <span className="faint">These fighters are no longer on chain.</span>
      )}
      {shown && (
        <DetailSheet panel={shown.panel} template={shown.template} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

/**
 * A star a tournament won, beside the name.
 *
 * Ten of them is a lot of pixels for a list row, so past five it says the
 * number instead — the shape a player scans for is "more than most", and a
 * row of ten identical glyphs answers that no better than a numeral does.
 */
export function Crowns({ wins }: { wins: number }) {
  if (wins <= 0) return null
  const star = (
    <svg className="tour__star" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z" />
    </svg>
  )
  const label = `${wins} tournament${wins === 1 ? '' : 's'} won`

  return (
    <span
      className={`tour__crowns${wins > 5 ? ' tour__crowns--many' : ''}`}
      title={label}
      aria-label={label}
    >
      {wins <= 5 ? (
        Array.from({ length: wins }, (_, i) => <span key={i}>{star}</span>)
      ) : (
        <>
          {star}
          <b className="mono">{wins}</b>
        </>
      )}
    </span>
  )
}

export function Field({
  field,
  mineWallet,
  entryOpen,
  freePasses,
  degenerate,
}: {
  field: TournamentSignup[]
  mineWallet: string | null
  entryOpen: boolean
  freePasses: number
  degenerate: boolean
}) {
  /*
     Which entry is open, by its own key.

     One at a time: the point of opening a row is to compare it with the
     score beside it, and a list of fifty expanded line-ups is a different
     screen.
  */
  const [open, setOpen] = useState<string | null>(null)

  if (field.length === 0) return null
  return (
    <section className="tour__field" aria-label="The field">
      <ol className="tour__list">
        {field.slice(0, 50).map((s, i) => {
          const isMe = !!mineWallet && s.wallet === mineWallet
          const pass = !entryOpen && !degenerate && i < freePasses
          const key = `${s.wallet}-${s.signup_timestamp}`
          const isOpen = open === key
          /* Their crew, for the faces on the line. It rides in on the
             signup row itself — see `crewFaces`. */
          const crew = crewFaces(s)
          return (
            <li key={key} className={`tour__entry${isMe ? ' tour__entry--me' : ''}`}>
              <button
                type="button"
                className="tour__entryrow"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : key)}
              >
                <span className="tour__seed mono">{i + 1}</span>
                <PlayerAvatar id={s.avatar} name={s.playertag} className="tour__avatar" size={40} />
                <span className="tour__who">
                  <span className="tour__tag">{s.playertag || 'Unnamed'}</span>
                  {isMe && <span className="tour__youmark">You</span>}
                  {pass && (
                    <svg
                      className="tour__ticket"
                      viewBox="0 0 24 16"
                      role="img"
                      aria-label="Free pass through the opening round"
                    >
                      <title>Free pass through the opening round</title>
                      <path d="M2 3h20v3a2 2 0 0 0 0 4v3H2v-3a2 2 0 0 0 0-4V3z" />
                      <path className="tour__ticketrip" d="M15 4v8" />
                    </svg>
                  )}
                  {/* One star a title. Stand-in counts for now — see
                      `pretendTournamentWins`. */}
                  <Crowns wins={pretendTournamentWins(s.wallet)} />
                </span>
                <EntryFaces entry={s} faces={crew} />
                {/*
                   No win count on the line.

                   `battles_won` is not wins. The contract bumps it once per
                   free pass while it is handing the top seeds through the
                   opening round — so "1W" appeared on a seed that had not
                   fought anything. The pass already has its own ticket.
                */}
                <span className="tour__escore mono">{formatNumber(s.score)}</span>
                <svg
                  className={`tour__chev${isOpen ? ' tour__chev--open' : ''}`}
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>
              {isOpen && <EntryLineup entry={s} />}
            </li>
          )
        })}
      </ol>
      <p className="tour__cardfoot">
        {formatNumber(field.length)} entered{entryOpen ? ' so far' : ''} · seeded by score
        {field.length > 50 && ` · and ${formatNumber(field.length - 50)} more`}
      </p>
    </section>
  )
}

/**
 * The five faces on an entrant's line, each with the fighter's read on hover.
 *
 * The faces come free with the signup row; the stats behind them do not,
 * so the read is asked for once a pointer rests on the line — the same read
 * the opened line-up uses, under the same key — and a face hovered before
 * it has arrived opens the moment it does.
 */
function EntryFaces({ entry, faces }: { entry: TournamentSignup; faces: CrewFace[] }) {
  const [peek, setPeek] = useState(false)
  const detail = useEntryDetail(entry, peek)
  const fighters = detail.data?.fighters ?? []

  return (
    <span className="tour__crew" aria-hidden="true" onMouseEnter={() => setPeek(true)}>
      {faces.slice(0, 5).map((face, at) => {
        const id = entry.fighter_ids[at]
        return (
          <Face
            key={id ?? at}
            face={face}
            fighter={fighters.find((f) => String(f.fighter_id) === String(id))}
          />
        )
      })}
    </span>
  )
}

function Face({ face, fighter }: { face: CrewFace; fighter?: RosterFighter }) {
  const phone = usePhone()
  const { classes, levelMod, ageDecay } = useConfig()
  const preview = useMemo(
    () =>
      fighter
        ? () => ({
            panel: rosterPanel(fighter, levelMod, ageDecay),
            template: classes.get(fighter.classname),
          })
        : undefined,
    [fighter, classes, levelMod, ageDecay],
  )
  const { ref, shown, handlers } = useHoverCard(preview, !!preview && !phone)

  /*
     Hovered before the stats arrived.

     The hover hook only opens if it has something to show at the moment
     the pointer enters. A face hovered a beat before the read lands would
     otherwise stay silent until the pointer left and came back, so this
     opens it once the read is in — only the read changing can trigger it.
  */
  const [resting, setResting] = useState(false)
  useEffect(() => {
    if (resting && preview) handlers.onMouseEnter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview])

  return (
    <span
      className="tour__face"
      ref={ref}
      onMouseEnter={() => {
        setResting(true)
        handlers.onMouseEnter()
      }}
      onMouseLeave={() => {
        setResting(false)
        handlers.onMouseLeave()
      }}
    >
      {shown && (
        <HoverPopover anchor={shown.rect}>
          <FighterHoverCard fighter={shown.value.panel} template={shown.value.template} />
        </HoverPopover>
      )}
      <GameImg src={fighterAvatar(face)} fallback={fighterArtFallback()} alt="" loading="lazy" />
    </span>
  )
}

/**
 * Which tournament, when more than one is running.
 *
 * `advance` starts a tournament on the clock whether or not the last has
 * finished, so two or three overlap for most of a cycle. Showing whichever
 * the fallbacks happened to prefer meant a player's screen could change
 * under them — a tournament they were watching finishes, and the board is
 * suddenly a different one at a different phase. So when there is a choice
 * to make, they make it.
 *
 * One tournament and this never appears: there is nothing to choose.
 */
function TournamentPicker({
  live,
  entered,
  onPick,
}: {
  live: TournamentStage[]
  entered: string[]
  onPick: (name: string) => void
}) {
  /* Newest first — the one still taking entrants is almost always the one a
     player came here for, and it is the youngest. */
  const order = useMemo(
    () =>
      [...live].sort(
        (a, b) => (startedAt(b.tournament_name) ?? 0) - (startedAt(a.tournament_name) ?? 0),
      ),
    [live],
  )

  return (
    <section className="tourpick">
      <h2 className="tourpick__title">Choose a tournament</h2>
      <p className="tourpick__sub faint">
        {order.length} are running. Pick the one you want to follow — you can
        switch at any time.
      </p>

      <ul className="tourpick__list">
        {order.map((s) => {
          const phase = phaseOf(s)
          const mine = entered.includes(s.tournament_name)
          const started = startedAt(s.tournament_name)
          const tlm = assetAmount(s.tlm_rewards)
          const wax = assetAmount(s.wax_rewards)

          return (
            <li key={s.tournament_name}>
              <button
                type="button"
                className={'tourpick__card' + (mine ? ' tourpick__card--mine' : '')}
                onClick={() => onPick(s.tournament_name)}
              >
                <span className="tourpick__when">
                  {started
                    ? new Date(started).toLocaleString(NUM_LOCALE, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : s.tournament_name}
                </span>

                <span className="tourpick__tags">
                  <span className={`tourpick__phase tourpick__phase--${phase}`}>
                    {PHASE_LABEL[phase]}
                  </span>
                  {mine && <span className="tourpick__badge">You are in</span>}
                  {s.allow_player_signup && !mine && (
                    <span className="tourpick__badge tourpick__badge--open">Entry open</span>
                  )}
                </span>

                <span className="tourpick__facts">
                  <span className="mono">{formatNumber(Number(s.player_count ?? 0))}</span> entered
                  {tlm > 0 && (
                    <>
                      {' · '}
                      <span className="mono">{formatNumber(tlm)}</span> TLM
                    </>
                  )}
                  {wax > 0 && (
                    <>
                      {' · '}
                      <span className="mono">{formatNumber(wax)}</span> WAX
                    </>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* What each phase is called on the chooser's cards. */
const PHASE_LABEL: Record<TournamentPhase, string> = {
  none: 'Not started',
  preparing: 'Preparing',
  signup: 'Signups open',
  creation: 'Seeding',
  battle: 'Fighting',
  finish: 'Finished',
}

/* ————————————————— the screen ————————————————— */

export default function Tournament() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)

  const { classes, nftValues, levelMod, ageDecay } = useConfig()

  /*
     One read for the whole board.

     The tournament to show cannot be chosen before the fields are known —
     the player's own entry outranks everything else on the page — so the
     entrant lists are fetched for every running tournament and the choice is
     made from them. There are rarely more than two.
  */
  /*
     Raised by the overdue poll below, lowered as soon as it is read.

     `reload` deliberately takes no arguments — whether a re-read should
     bypass the cache is this function's business — and the poll is the one
     caller that has to: the rows it is watching for are cached for fifteen
     and sixty seconds, which is exactly the window it would be polling
     through.
  */
  const forceNext = useRef(false)

  /*
     The tournament this player is looking at, once they have said.

     In the query key rather than beside it: the board below is read per
     tournament — plan, matchups, entrants — so changing the pick is a
     different read, and `useChainQuery` re-asks exactly when its key moves.
  */
  const [chosen, setChosen] = useState<string | null>(null)

  const board = useChainQuery(
    `tournament:${player.wallet}:${chosen ?? ''}`,
    async () => {
      const fresh = forceNext.current
      forceNext.current = false

      const [config, tracking, template, live] = await Promise.all([
        /* Config and the stage template change when the team edits them. */
        fetchTournamentConfig(),
        fetchTournamentTracking(fresh),
        fetchTournamentStages(),
        fetchLiveTournaments(fresh),
      ])

      const fields = await Promise.all(
        live.map((s) => fetchTournamentSignups(s.tournament_name, fresh)),
      )
      const entered = live
        .filter((_, i) => !!mySignup(fields[i], player.wallet))
        .map((s) => s.tournament_name)

      const stage = pickTournament(live, entered, chosen)
      const at = stage ? live.indexOf(stage) : -1

      const [plan, matchups, payouts, weather, history] = await Promise.all([
        stage ? fetchTournamentPlan(stage.tournament_name, fresh) : Promise.resolve([]),
        /* Per round, so this is the round the tournament is on. Earlier
           rounds live in their own scopes and are not read here. */
        stage
          ? fetchTournamentMatchups(
              stage.tournament_name,
              Number(stage.current_round ?? 0),
              fresh,
            )
          : Promise.resolve([]),
        fetchTournamentPayouts(),
        /*
           The rolls, resolved.

           `curstage` keeps only `(planet, weather_id)` — the tournament
           rolls one per planet at the start and never points at a land — so
           the row that says what the roll actually does has to be fetched
           the same way the dungeon and the arena fetch theirs. Three reads
           at most, and a weather row is cached for half a day.
        */
        Promise.all(
          (stage?.weather_effects ?? []).map(async (w) => ({
            planet: w.planet,
            weather: await fetchWeatherRow(w.planet, w.weather_id),
          })),
        ),
        /*
           Every round, for the results.

           Once the fighting is over the signups are already gone — cleanup
           erases them before it erases the stage — so the matchups are all
           that is left of what happened, and they are what a player comes
           back to watch. Read only then: while the fighting is on, the
           current round is the board.
        */
        stage && (phaseOf(stage) === 'finish' || fightingDone(stage))
          ? Promise.all(
              Array.from({ length: Number(stage.rounds ?? 0) }, (_, r) =>
                fetchTournamentMatchups(stage.tournament_name, r, fresh),
              ),
            )
          : Promise.resolve([] as TournamentMatchup[][]),
      ])

      return {
        config,
        tracking,
        template,
        live,
        entered,
        stage,
        plan,
        matchups,
        history,
        payouts,
        weather,
        /* What the Conditions strip draws: the rolls, topped up to four. */
        shownWeather: await withStandIns(weather),
        signups: at >= 0 ? fields[at] : [],
      }
    },
    { deps: ['tournament', 'tournamentSignups', 'fighters'] },
  )

  const stage = board.data?.stage
  /* The results, as soon as the last fight is in — not when cleanup comes. */
  const phase = phaseOf(stage) === 'battle' && fightingDone(stage) ? 'finish' : phaseOf(stage)
  /* The two phases the gates are the screen. */
  const waiting = phase === 'none' || phase === 'preparing'
  const signups = useMemo(() => board.data?.signups ?? [], [board.data])
  const entryOpen = !!stage?.allow_player_signup

  const mine = useMemo(
    () => mySignup(signups, player.wallet),
    [signups, player.wallet],
  )

  const energyCost = Number(board.data?.config?.energy_cost_signup ?? 0)
  const everySec = Number(board.data?.config?.tournament_every_sec ?? 0)
  const energy = player.activestats.action_points

  /*
     The roster and the card lists, read only while there is something to do
     with them. Between tournaments this screen is a countdown and a
     description, and neither needs a hundred and fifty fighters.
  */
  const setup = useChainQuery(
    `tournament-setup:${player.wallet}`,
    async () => {
      const [roster, cards] = await Promise.all([
        fetchRoster(player.wallet),
        fetchCrewCards(player.wallet),
      ])
      return { roster, crewCards: cards.crew, weaponCards: cards.weapons }
    },
    /* Also while waiting: the ring between tournaments is the player's own
       fighters, and this read is shared with every other screen. */
    {
      deps: ['fighters'],
      enabled:
        board.loading || (entryOpen && !mine) || phase === 'none' || phase === 'preparing',
    },
  )
  const roster = setup.data?.roster ?? null
  /*
     Who can be entered. A fighter that is `in_use` — holding an arena,
     listed on the market, already in a tournament — is refused by `signup`
     and aborts the whole entry, so it is not offered at all.
  */
  const free = useMemo(() => roster?.filter((f) => !f.in_use) ?? null, [roster])
  const crewCards = setup.data?.crewCards ?? EMPTY_CARDS
  const weaponCards = setup.data?.weaponCards ?? EMPTY_CARDS

  const usableCrew = useMemo(
    () => crewCards.filter((c) => nftValues.has(c.template_id)),
    [crewCards, nftValues],
  )
  const usableWeapons = useMemo(
    () => weaponCards.filter((c) => nftValues.has(c.template_id)),
    [weaponCards, nftValues],
  )

  /*
     Who stands in the ring while the clock runs down.

     The strongest first rather than the roster's own order: this is the
     picture a player is left looking at, and the ones it shows should be
     the ones they would be proud to field. The whole roster is handed over
     rather than a slice of it — `gateCrowd` draws five and uses the rest to
     choose the two on the ends, and a silhouette does not show a level, so
     there is no reason to keep a striking fighter out of the line for being
     under-trained.
  */
  const ringFighters = useMemo(
    () =>
      [...(roster ?? [])]
        .sort((a, b) => (b.stats?.level ?? 0) - (a.stats?.level ?? 0))
        .map((f) => ({
          fighter_id: f.fighter_id,
          classname: f.classname,
          racename: f.racename,
        })),
    [roster],
  )

  /* The picker's own state, the same shape the arena and the dungeon use. */
  const [teamIds, setTeamIds] = useState<number[]>([])
  const [crew, setCrew] = useState<CardTemplate | null>(null)
  const [weapon, setWeapon] = useState<CardTemplate | null>(null)
  const [tab, setTab] = useState<Tab>('fighters')
  /*
     An empty card is a long way above the roster it is filled from. Tapping
     it opens the right tab and brings the picker up to the top of the
     screen, so the gesture lands on the fighters rather than on a panel
     that appears to have done nothing — the arena and the dungeon do the
     same.
  */
  const picker = useRef<HTMLElement>(null)
  const goPick = (t: Tab) => {
    setTab(t)
    picker.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const [filter, setFilter] = useState<RosterFilter>(EMPTY_FILTER)
  const [atLevelOne, setAtLevelOne] = useState(false)
  const [cardQuery, setCardQuery] = useState('')
  const [detail, setDetail] = useState<Detail>(null)
  const [shownCount, setShownCount] = useState<{ shown: number; total: number } | null>(null)
  const [fault, setFault] = useState<string | null>(null)

  const countFighters = useCallback(
    (shown: number, total: number) =>
      setShownCount((c) => (c && c.shown === shown && c.total === total ? c : { shown, total })),
    [],
  )

  const picked = useMemo(
    () =>
      (free ?? [])
        .filter((f) => teamIds.includes(f.fighter_id))
        .sort((a, b) => teamIds.indexOf(a.fighter_id) - teamIds.indexOf(b.fighter_id)),
    [free, teamIds],
  )
  const team = useMemo(() => {
    const slots: (RosterFighter | null)[] = Array(TEAM_SIZE).fill(null)
    picked.forEach((f, i) => {
      if (i < TEAM_SIZE) slots[i] = f
    })
    return slots
  }, [picked])

  const toggleFighter = useCallback((f: RosterFighter) => {
    setTeamIds((ids) => {
      if (ids.includes(f.fighter_id)) return ids.filter((id) => id !== f.fighter_id)
      if (ids.length >= TEAM_SIZE) return ids
      return [...ids, f.fighter_id]
    })
  }, [])

  const showFighter = useCallback(
    (f: RosterFighter) =>
      setDetail({
        kind: 'panel',
        panel: rosterPanel(f, levelMod, ageDecay),
        template: classes.get(f.classname),
      }),
    [classes, levelMod, ageDecay],
  )
  const showCard = useCallback(
    (c: CardTemplate) => {
      const value = nftValues.get(c.template_id)
      if (!value) return
      setDetail({ kind: 'panel', panel: nftAsPanel(value, c.name) })
    },
    [nftValues],
  )

  /* A second hand, so every deadline on the page counts rather than sits. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { busy, error, run } = useAction()

  const enter = async () => {
    if (!session || !stage || !crew || !weapon) return
    setFault(null)
    let crewAssetId: string | undefined
    let weaponAssetId: string | undefined
    try {
      const assets = await resolveAssetIds(player.wallet, [crew.template_id, weapon.template_id])
      crewAssetId = assets.get(crew.template_id)
      weaponAssetId = assets.get(weapon.template_id)
    } catch (err) {
      setFault(readableError(err))
      return
    }
    if (!crewAssetId || !weaponAssetId) {
      setFault('Those cards are no longer in this wallet')
      return
    }

    await run(
      'enter',
      () =>
        tournamentSignup(session, {
          tournamentName: stage.tournament_name,
          fighterIds: picked.map((f) => f.fighter_id),
          crewAssetId,
          weaponAssetId,
        }),
      'You are in. Your fighters are held until the tournament is done.',
      {
        dirties: DIRTIES.tournamentSignup,
        /* The field is what says this landed. Energy leaving the player row
           only says something was signed, and the entry is the whole point. */
        after: () => fetchTournamentSignups(stage.tournament_name, true),
        settled: (field: TournamentSignup[]) => !!mySignup(field, player.wallet),
        onSettled: () => {
          void board.reload()
        },
      },
    )
  }

  const block = canEnter(team, !!crew, !!weapon, energy, energyCost, stage, !!mine, TEAM_SIZE)
  const score = teamScore(picked)

  const timeline = useMemo(
    () => timelineOf(board.data?.plan ?? [], now, stage ? Number(stage.stage_index) : undefined),
    [board.data, now, stage],
  )
  const stepEnds = currentStepEnd(board.data?.plan ?? [], stage)
  const signupAt = useMemo(
    () => timeline.find((s) => s.name === 'signup')?.startMs ?? NaN,
    [timeline],
  )
  const fightAt = useMemo(
    () => timeline.find((s) => s.name === 'battle')?.startMs ?? NaN,
    [timeline],
  )
  const field = useMemo(() => seedOrder(signups), [signups])
  const entered = stage ? Number(stage.player_count ?? signups.length) : signups.length
  const bracket = bracketOf(entered)
  const seeding = stage ? seedingOf(signups, stage, mine?.wallet ?? player.wallet) : null
  /*
     Every pairing in the round, not only the player's own.

     A tournament screen that showed you your one bout and nothing else was
     a fixture list with one fixture on it — who else is still in is the
     thing a bracket is for.
  */
  const pairings = board.data?.matchups ?? []
  const history = board.data?.history ?? []
  /* The rolls that landed, in the order the stage lists them. */
  const rolls = useMemo(
    () =>
      (board.data?.weather ?? [])
        .map((w) => w.weather)
        .filter((w): w is Weather => !!w),
    [board.data],
  )

  /* The seeds the draw spared, which is only ever the opening round. */
  const passes = freePassCount(stage, entered)
  const byes = useMemo(
    () => (Number(stage?.current_round ?? 0) === 0 ? field.slice(0, passes) : []),
    [stage, field, passes],
  )
  const payout = board.data?.payouts?.find((p) => p.wallet === player.wallet)
  const nextStart = chainTime(board.data?.tracking?.next_tournament_start)

  /*
     Waiting for a clock nobody on this screen is winding.

     Every other screen in the game goes stale only after the player does
     something, which is why `useChainQuery` polls nothing: a WAX node
     answers an overloaded read with an empty result rather than an error, so
     routine polling manufactures the one failure the caching is built to
     avoid. This screen is the exception. It counts down to a change made by
     the task manager with no action of the player's in it, and without this
     it would sit on a spent countdown until they navigated away and back.

     So: nothing at all until the deadline passes, then every fifteen seconds
     until the chain catches up — which stops on its own, because the moment
     it does the next deadline is in the future again.
  */
  const deadline = phase === 'none' ? nextStart : (stepEnds ?? NaN)
  const overdue = Number.isFinite(deadline) && now >= deadline
  const reload = board.reload

  useEffect(() => {
    if (!overdue) return
    const ask = () => {
      forceNext.current = true
      void reload()
    }
    /* Once on the way past zero, then on the quarter minute. */
    ask()
    const id = setInterval(ask, 15_000)
    return () => clearInterval(id)
  }, [overdue, reload])

  const live = useMemo(() => board.data?.live ?? [], [board.data])
  const enteredNames = useMemo(() => board.data?.entered ?? [], [board.data])
  /*
     What is running and what is only waiting to be cleaned up.

     A finished tournament stays on `curstage` beside the one that replaced
     it until its cleanup step comes round, which is days. It is not a
     choice — there is nothing to do in it — but its results are worth a
     look, so it sits behind one button rather than in the chooser.
  */
  const running = useMemo(() => live.filter((s) => !isFinished(s)), [live])
  const previous = useMemo(
    () =>
      [...live]
        .filter(isFinished)
        .sort((a, b) => (startedAt(b.tournament_name) ?? 0) - (startedAt(a.tournament_name) ?? 0))[0],
    [live],
  )
  const viewingPrevious = !!previous && !!stage && stage.tournament_name === previous.tournament_name

  /*
     A picked tournament finishes and is cleaned off `curstage`.

     `pickTournament` already ignores a name that is no longer running, but
     leaving it in state would keep it in the query key and keep the chooser
     hidden, so the pick is dropped and the choice comes back.
  */
  useEffect(() => {
    if (!chosen || live.length === 0) return
    if (!live.some((s) => s.tournament_name === chosen)) setChosen(null)
  }, [chosen, live])

  if (board.loading && !board.data) {
    return (
      <div className="tour">
        <div className="tour__loading">
          <span className="spinner" /> Reading the tournament…
        </div>
      </div>
    )
  }

  /* More than one running and nothing picked: the choice is the screen. */
  if (running.length > 1 && !chosen) {
    return (
      <div className="tour">
        {board.error && <div className="alert alert--error">{board.error}</div>}
        <TournamentPicker live={running} entered={enteredNames} onPick={setChosen} />
      </div>
    )
  }

  return (
    <div className="tour">
      {/*
         The title and the pot, grouped so a phone can put them on one line.
         `display: contents` on wider screens leaves both exactly where they
         were — this wrapper only exists for the layout underneath it.
      */}
      {/*
         No title over the gates.

         A heading reading "Tournament" above a shut gate with a clock on it
         is the same sentence twice, and it was the one thing standing
         between the top of the screen and the picture. Everywhere else it
         stays, because everywhere else the screen is a list of figures.
      */}
      {(running.length > 1 || (previous && running.length > 0)) && (
        <div className="tourpick__switches">
          {running.length > 1 && !viewingPrevious && (
            <button type="button" className="tourpick__switch" onClick={() => setChosen(null)}>
              Choose another tournament
            </button>
          )}
          {/* The last finished tournament, behind one button: its results
              are worth a look, but it is not a choice beside the live one. */}
          {previous && running.length > 0 && (
            <button
              type="button"
              className="tourpick__switch"
              onClick={() => setChosen(viewingPrevious ? null : previous.tournament_name)}
            >
              {viewingPrevious ? 'Back to the current tournament' : 'Previous tournament'}
            </button>
          )}
        </div>
      )}

      {(!waiting || stage) && (
        <div className="tour__top">
          {!waiting && <TournamentHead />}
          {!waiting && stage && <PrizeBar stage={stage} weather={board.data?.shownWeather ?? []} />}
        </div>
      )}


      {board.error && <div className="alert alert--error">{board.error}</div>}
      {fault && <div className="alert alert--error">{fault}</div>}
      {error && <div className="alert alert--error">{error}</div>}

      {!waiting && stage && (
        <div className="tour__band">
          <DayStrip timeline={timeline} now={now} />
          {phase === 'signup' && !mine && (
            <EntryActions
              score={score}
              energyCost={energyCost}
              block={block}
              busy={busy === 'enter'}
              canSign={!!session}
              onEnter={() => void enter()}
            />
          )}
        </div>
      )}

      {phase === 'none' && (
        <NoTournament
          nextStart={nextStart}
          now={now}
          everySec={everySec}
          fighters={ringFighters}
          onPrevious={previous ? () => setChosen(previous.tournament_name) : undefined}
        />
      )}

      {phase === 'preparing' && (
        <Preparing
          fighters={ringFighters}
          stage={stage}
          weather={board.data?.shownWeather ?? []}
          signupAt={signupAt}
          now={now}
          onPrevious={previous ? () => setChosen(previous.tournament_name) : undefined}
        />
      )}

      {phase === 'signup' && stage && !mine && (
        <EntryPanel
          team={
            <TeamRow
              team={team}
              levelMod={levelMod}
              ageDecay={ageDecay}
              onInspect={showFighter}
              onRemove={toggleFighter}
              onEmpty={() => goPick('fighters')}
              sixth={
                <NftSlot
                  crew={crew}
                  weapon={weapon}
                  values={nftValues}
                  onOpenCard={showCard}
                  onClearCrew={() => setCrew(null)}
                  onClearWeapon={() => setWeapon(null)}
                  onPick={goPick}
                  onOpen={() => {
                    const fused = combineNftFighter(
                      crew ? (nftValues.get(crew.template_id) ?? null) : null,
                      weapon ? (nftValues.get(weapon.template_id) ?? null) : null,
                    )
                    if (fused) setDetail({ kind: 'panel', panel: fused })
                    else goPick('crew')
                  }}
                />
              }
            />
          }
        >
          <section className="tour__picker" ref={picker}>
            <div className="tabs">
              {(['fighters', 'crew', 'weapon'] as Tab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`tabs__tab${tab === key ? ' tabs__tab--on' : ''}`}
                  onClick={() => setTab(key)}
                >
                  {key === 'fighters' ? 'Fighters' : key === 'crew' ? 'Crew' : 'Weapon'}
                  {key === 'fighters' && (
                    <span className="tabs__count">
                      {picked.length}/{TEAM_SIZE}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {tab === 'fighters' ? (
              <>
                <RosterFilters
                  filter={filter}
                  onChange={setFilter}
                  roster={free ?? []}
                  atLevelOne={atLevelOne}
                  onAtLevelOne={setAtLevelOne}
                  count={shownCount}
                />
                <FighterGrid
                  roster={free}
                  filter={filter}
                  ageDecay={ageDecay}
                  levelMod={levelMod}
                  atLevelOne={atLevelOne}
                  teamIds={teamIds}
                  full={picked.length >= TEAM_SIZE}
                  onToggle={toggleFighter}
                  onCount={countFighters}
                  onInspect={showFighter}
                />
              </>
            ) : (
              <CardGrid
                cards={tab === 'crew' ? usableCrew : usableWeapons}
                values={nftValues}
                query={cardQuery}
                onQuery={setCardQuery}
                selected={tab === 'crew' ? crew : weapon}
                onPick={(c) => {
                  if (tab !== 'crew') {
                    setWeapon(c)
                    return
                  }
                  setCrew(c)
                  setTab('weapon')
                  setCardQuery('')
                }}
                onInspect={showCard}
                kind={tab}
              />
            )}
          </section>
        </EntryPanel>
      )}

      {phase === 'battle' && stage && (
        <Battle
          stage={stage}
          bracket={bracket}
          pairings={pairings}
          byes={byes}
          /*
             All of them.

             `curstage` rolls one per planet and every one applies, so the
             bout is fought under the lot — they compound in turn, each
             asking for itself whether it reaches a given fighter.
          */
          weather={rolls}
          mineWallet={mine?.wallet ?? null}
          entered={!!mine}
          now={now}
        />
      )}

      {phase === 'finish' && (
        <Results
          history={history}
          weather={rolls}
          wallet={player.wallet}
          mine={mine}
          payout={payout}
          nextStart={nextStart}
          now={now}
        />
      )}

      {/*
        The fight card: the event, your line on it, and the field.

        Not once the fighting starts. The field is the list of who entered,
        seeded — the question the screen answers while entry is open and the
        draw is being made. Once there are pairings it is the same names in
        a worse arrangement, below a board that already says who is left and
        who they drew — so only your own line survives into the battle.
      */}
      {phase !== 'battle' && phase !== 'finish' ? (
        <section className="tour__poster">
          <PosterHead fightAt={fightAt} now={now} />
          {mine && <MyEntry mine={mine} seeding={seeding} bracket={bracket} />}
          <Field
            field={field}
            mineWallet={mine?.wallet ?? null}
            entryOpen={entryOpen}
            freePasses={freePassCount(stage, entered)}
            degenerate={bracket.degenerate}
          />
        </section>
      ) : (
        mine && <MyEntry mine={mine} seeding={seeding} bracket={bracket} />
      )}

      {detail && (
        <DetailSheet panel={detail.panel} template={detail.template} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
