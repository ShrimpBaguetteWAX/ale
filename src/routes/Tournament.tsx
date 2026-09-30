import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { BoutBroadcast } from '@/tournament/BoutBroadcast'
import { usePhone } from '@/components/usePhone'
import { WeatherPanel } from '@/fight/setup'
import { fetchWeatherRow, type Weather } from '@/fight/weather'
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
  stripWindow,
  teamScore,
  timelineOf,
  type Bracket,
  type EntryBlock,
  type TimelineStep,
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
import { formatNumber, NUM_LOCALE } from '@/format'
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

/** The contract's step names, said the way a player would say them. */
const STEP_LABEL: Record<string, string> = {
  set_weather: 'Weather rolled',
  get_rewards: 'Prize collected',
  signup: 'Signup open',
  close_signup: 'Preparation',
  create_matchups: 'Bracket drawn',
  battle: 'Fighting',
  hall_of_fame: 'Hall of fame',
  reward_payout: 'Rewards paid',
  cleanup: 'Wrapped up',
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
export function PrizeBar({
  stage,
  weather,
}: {
  stage: TournamentStage
  weather: { planet: string; weather?: Weather }[]
}) {
  const tlm = assetAmount(stage.tlm_rewards)
  const wax = assetAmount(stage.wax_rewards)
  const rolled = weather.filter((w) => w.weather)
  /* Which roll is being read, on a screen too narrow for all three. */
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="pot">
      <span className="pot__label">Prize pool</span>

      {tlm > 0 || wax > 0 ? (
        <div className="pot__figures">
          {tlm > 0 && (
            <span className="pot__figure mono">
              <img src={asset('/assets/icons/tlm.svg')} alt="" width={30} height={30} />
              {formatNumber(tlm)}
              <small>TLM</small>
            </span>
          )}
          {wax > 0 && (
            <span className="pot__figure pot__figure--wax mono">
              {formatNumber(wax)}
              <small>WAX</small>
            </span>
          )}
        </div>
      ) : (
        <p className="pot__empty">Being collected</p>
      )}

      {rolled.length > 0 && (
        <div className="pot__weather">
          {/*
             No planet name: the roll applies to the whole tournament, so
             where it was drawn from is bookkeeping rather than something a
             player acts on.

             Tapping one opens it. Three rolls at full length do not fit
             across a phone and a tooltip is no use there, so they share the
             line in equal thirds and the one you press takes the room it
             needs while the other two fall back to their stat icons. All
             three stay on screen; only the reading order changes.
          */}
          {rolled.map((w, i) => (
            <button
              type="button"
              key={`${w.planet}-${w.weather?.weather_id}`}
              className={`pot__roll${open === i ? ' pot__roll--open' : open === null ? '' : ' pot__roll--mini'}`}
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <WeatherPanel weather={w.weather} tooltip={false} />
            </button>
          ))}
        </div>
      )}
    </section>
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

  const shown = stripWindow(timeline, fits)

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
                ? clock(step.startMs)
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
 * Two doors that are not open yet.
 *
 * The contract's `hall_of_fame` and `reward_payout` steps are empty and
 * finished tournaments are cleared rather than kept, so neither of these can
 * show anything today. They are here because the waiting screen is where a
 * player will look for them, and a door you can see is not built yet is
 * better than one nobody knows to expect.
 */
export function WaitLinks() {
  return (
    <div className="gates__links">
      <button type="button" className="btn btn--ghost" disabled title="Coming soon">
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
}: {
  nextStart: number
  now: number
  everySec: number
  fighters: GateFighter[]
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
        label="Signup opens in"
        centre={boardText(nextStart - now)}
      />
      <WaitLinks />
    </section>
  )
}

export function Preparing({ fighters }: { fighters: GateFighter[] }) {
  return (
    <section className="tour__panel tour__panel--wait">
      {/*
         The doors at their widest: the setup steps take minutes and nobody
         can act during them, so the picture says "about to open" rather
         than counting something down.
      */}
      <TournamentGates fighters={fighters} progress={1} label="Signup opens in" centre="any moment" />
      <WaitLinks />
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
}) {
  const round = Number(stage.current_round ?? 0)
  const fought = Number(stage.current_battle ?? 0)
  const inRound = Number(stage.battles_in_round ?? 0)
  /* One open at a time: two line-ups is ten combat cards, and the point of
     opening one is to read it against the name across from it. */
  const [open, setOpen] = useState<number | null>(null)

  /*
     The bout the contract is on, or the last one once the round is fought
     out — so the broadcast always has something to offer rather than going
     blank the moment the fighting stops.
  */
  const live = pairings.length
    ? pairings[Math.min(fought, pairings.length - 1)]
    : null

  return (
    <section className="tour__panel">
      {live && !!live.wallet_player2 && (
        <BoutBroadcast
          m={live}
          round={round}
          bout={Math.min(fought, pairings.length - 1)}
          weather={weather}
          mineWallet={mineWallet}
        />
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
            const took = (wallet: string, tag: string) =>
              !!m.winner && (m.winner === wallet || m.winner === tag)
            const won1 = took(m.wallet_player1, m.gamertag_player1)
            const won2 = took(m.wallet_player2, m.gamertag_player2)
            const drawn = !!m.wallet_player2
            const isOpen = open === m.index
            /* The contract fights them in order, one call at a time. */
            const state = !drawn
              ? 'Being drawn'
              : m.winner
                ? 'Fought'
                : i < fought
                  ? 'Fought'
                  : i === fought
                    ? 'Fighting now'
                    : 'To come'

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
                <button
                  type="button"
                  className="tour__boutrow"
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
                    <span
                      className={`tour__boutstate${
                        state === 'Fighting now' ? ' tour__boutstate--live' : ''
                      }`}
                    >
                      {state}
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
                {isOpen && <BoutLineup m={m} />}
              </li>
            )
          })}
        </ol>
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
          onOpen={() => {}}
          preview={() => ({
            panel: rosterPanel(fighter, levelMod, ageDecay),
            template: classes.get(fighter.classname),
          })}
        />
      ))}

      <LineupCard label="Crew" template={crew || undefined} />
      <LineupCard label="Weapon" template={arms || undefined} />

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

export function Finish({
  mine,
  payout,
  nextStart,
  now,
}: {
  mine: TournamentSignup | undefined
  payout: TournamentPayout | undefined
  nextStart: number
  now: number
}) {
  return (
    <section className="tour__panel">
      <h2 className="tour__h2">Results</h2>
      {mine ? (
        <p className="tour__big mono">
          {formatNumber(mine.battles_won)} win{mine.battles_won === 1 ? '' : 's'}
          <span className="tour__bigsub">
            {formatNumber(mine.reward_points)} reward points
            {payout ? ` · ${formatNumber(payout.reward_points)} banked` : ''}
          </span>
        </p>
      ) : (
        <p className="muted">You did not enter this one.</p>
      )}
      <p className="faint">
        Reward points decide the share of the pool. The next tournament opens
        {Number.isFinite(nextStart) ? ` in ${untilText(nextStart - now)}` : ' soon'}.
      </p>
    </section>
  )
}

export function MyEntry({
  mine,
  seeding,
  bracket,
}: {
  mine: TournamentSignup
  seeding: { rank: number; total: number; freePass: boolean | null } | null
  bracket: Bracket
}) {
  return (
    <section className="tour__mine">
      <header className="tour__minehead">
        <PlayerAvatar id={mine.avatar} name={mine.playertag} className="tour__avatar" size={40} />
        <div>
          <h2 className="tour__h2">You are in</h2>
          <p className="faint">
            Entered {clock(chainTime(mine.signup_timestamp))} with {mine.fighter_ids.length}{' '}
            fighter{mine.fighter_ids.length === 1 ? '' : 's'}
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
      </header>
      {seeding?.freePass === true && (
        <p className="tour__pass">Your seed earned a free pass through the opening round.</p>
      )}
      {seeding?.freePass === false && bracket.preliminaryBattles > 0 && (
        <p className="faint">
          Your seed did not reach a free pass — you fight the opening round.
        </p>
      )}
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
export function EntryLineup({
  entry,
}: {
  /* Narrowed from `TournamentSignup` so a pairing can hand over one of its
     two corners, which carries the same four fields under longer names. */
  entry: Pick<
    TournamentSignup,
    'wallet' | 'fighter_ids' | 'crew_asset_id' | 'arms_asset_id'
  >
}) {
  const ids = entry.fighter_ids.join(',')
  const crew = String(entry.crew_asset_id ?? 0)
  const arms = String(entry.arms_asset_id ?? 0)

  const detail = useChainQuery(`tournament-entry:${entry.wallet}:${ids}`, async () => {
    const [fighters, templates] = await Promise.all([
      fetchFightersByIds(entry.fighter_ids),
      fetchAssetTemplates([crew, arms]),
    ])
    return { fighters, templates }
  })

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
          onOpen={() => {}}
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
    <section className="tour__field">
      <header className="tour__fieldhead">
        <h2 className="tour__h2">The field</h2>
        <span className="faint">
          {formatNumber(field.length)} entered{entryOpen ? ' so far' : ''} · seeded by score
        </span>
      </header>
      <ol className="tour__list">
        {field.slice(0, 50).map((s, i) => {
          const isMe = !!mineWallet && s.wallet === mineWallet
          const pass = !entryOpen && !degenerate && i < freePasses
          const key = `${s.wallet}-${s.signup_timestamp}`
          const isOpen = open === key
          /* Their crew, for the strip at the end of the row. It rides in
             on the signup row itself — see `crewFaces`. */
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
                <PlayerAvatar id={s.avatar} name={s.playertag} className="tour__avatar" size={60} />
                {/*
                   The name and what it has earned, in one group.

                   The tag used to take the whole middle of the row, which
                   pushed the badges over beside the score — so a ticket
                   that belongs to a player read as another column of the
                   table. Grouped, they travel with the name.
                */}
                <span className="tour__who">
                  <span className="tour__tag">{s.playertag || 'Unnamed'}</span>
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
                {/*
                   Who they brought, at a size you can tell apart.

                   The point of a field list is the comparison, and a name
                   with a number beside it gives nothing to compare. Five
                   faces do.
                */}
                <span className="tour__crew" aria-hidden="true">
                  {crew.slice(0, 5).map((f, at) => (
                    <GameImg
                      key={s.fighter_ids[at] ?? at}
                      src={fighterAvatar(f)}
                      fallback={fighterArtFallback()}
                      alt=""
                      loading="lazy"
                    />
                  ))}
                </span>
                {/*
                   No win count on the row.

                   `battles_won` is not wins. The contract bumps it once per
                   free pass while it is handing the top seeds through the
                   opening round — so "1W" appeared on a seed that had not
                   fought anything, next to eleven others who had not either.
                   The pass already has its own ticket beside the name.
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
      {field.length > 50 && <p className="faint">…and {formatNumber(field.length - 50)} more.</p>}
    </section>
  )
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

  const board = useChainQuery(
    `tournament:${player.wallet}`,
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

      const stage = pickTournament(live, entered)
      const at = stage ? live.indexOf(stage) : -1

      const [plan, matchups, payouts, weather] = await Promise.all([
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
      ])

      return {
        config,
        tracking,
        template,
        live,
        stage,
        plan,
        matchups,
        payouts,
        weather,
        signups: at >= 0 ? fields[at] : [],
      }
    },
    { deps: ['tournament', 'tournamentSignups', 'fighters'] },
  )

  const stage = board.data?.stage
  const phase = phaseOf(stage)
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
      (roster ?? [])
        .filter((f) => teamIds.includes(f.fighter_id))
        .sort((a, b) => teamIds.indexOf(a.fighter_id) - teamIds.indexOf(b.fighter_id)),
    [roster, teamIds],
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

  const { busy, error, notice, run } = useAction()

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

  if (board.loading && !board.data) {
    return (
      <div className="tour">
        <div className="tour__loading">
          <span className="spinner" /> Reading the tournament…
        </div>
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
      {(!waiting || stage) && (
        <div className="tour__top">
          {!waiting && <TournamentHead />}
          {!waiting && stage && <PrizeBar stage={stage} weather={board.data?.weather ?? []} />}
        </div>
      )}

      {board.error && <div className="alert alert--error">{board.error}</div>}
      {fault && <div className="alert alert--error">{fault}</div>}
      {error && <div className="alert alert--error">{error}</div>}
      {notice && (
        <div className="alert alert--note" role="status">
          {notice}
        </div>
      )}

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
        />
      )}

      {phase === 'preparing' && <Preparing fighters={ringFighters} />}

      {phase === 'signup' && stage && !mine && (
        <EntryPanel
          team={
            <TeamRow
              team={team}
              levelMod={levelMod}
              ageDecay={ageDecay}
              onInspect={showFighter}
              onRemove={toggleFighter}
              onEmpty={() => setTab('fighters')}
              sixth={
                <NftSlot
                  crew={crew}
                  weapon={weapon}
                  values={nftValues}
                  onOpenCard={showCard}
                  onClearCrew={() => setCrew(null)}
                  onClearWeapon={() => setWeapon(null)}
                  onPick={setTab}
                  onOpen={() => {
                    const fused = combineNftFighter(
                      crew ? (nftValues.get(crew.template_id) ?? null) : null,
                      weapon ? (nftValues.get(weapon.template_id) ?? null) : null,
                    )
                    if (fused) setDetail({ kind: 'panel', panel: fused })
                    else setTab('crew')
                  }}
                />
              }
            />
          }
        >
          <section className="tour__picker">
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
                  roster={roster ?? []}
                  atLevelOne={atLevelOne}
                  onAtLevelOne={setAtLevelOne}
                  count={shownCount}
                />
                <FighterGrid
                  roster={roster}
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
        />
      )}

      {phase === 'finish' && (
        <Finish mine={mine} payout={payout} nextStart={nextStart} now={now} />
      )}

      {mine && <MyEntry mine={mine} seeding={seeding} bracket={bracket} />}

      {/*
        Not once the fighting starts.

        The field is the list of who entered, seeded — the question the
        screen answers while entry is open and the draw is being made. Once
        there are pairings it is the same names in a worse arrangement,
        below a board that already says who is left and who they drew.
      */}
      {phase !== 'battle' && (
        <Field
          field={field}
          mineWallet={mine?.wallet ?? null}
          entryOpen={entryOpen}
          freePasses={freePassCount(stage, entered)}
          degenerate={bracket.degenerate}
        />
      )}

      {detail && (
        <DetailSheet panel={detail.panel} template={detail.template} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
