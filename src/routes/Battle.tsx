import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { landId } from '@/chain/landId'
import { fetchLiveArena } from '@/arena/queries'
import { NFT_FIGHTER_ID } from '@/dungeon/rules'
import { fetchFight, fetchRoster } from '@/dungeon/queries'
import { useConfig, useLazyConfig } from '@/state/useConfig'
import {
  recallFight,
  recallVenue,
  recallXpBefore,
  rememberFight,
  type Venue,
} from '@/dungeon/fightStore'
import {
  simulate,
  type FighterSnapshot,
  type Replay,
  type SimFighter,
  type TurnEvent,
} from '@/dungeon/sim'
import { combatLogCsv } from '@/dungeon/combatLog'
import { CombatLogEntries, CombatLogSheet } from '@/dungeon/CombatLogSheet'
import { usePhone } from '@/components/usePhone'
import {
  standingAt,
  stateAt,
  turnQueue,
  type QueuedTurn,
  type Standing,
} from '@/dungeon/standing'
import type { Battlestats, FightRow, RosterFighter } from '@/dungeon/types'
import {
  elementBackground,
  fighterArt,
  fighterArtFallback,
  fighterAvatar,
  fighterFace,
  fighterName,
  formatScaled,
  elementIcon,
} from '@/tavern/fighterStats'
import { DIRTIES, claimPoolRewards, levelUpFighters } from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { useChainQuery } from '@/chain/useChainQuery'
import { levelUpOf } from '@/fighters/rules'
import { Cost } from './Fighters'
import { ActionBanner } from '@/components/ActionBanner'
import { settle } from '@/wharf/settle'
import { readableError } from '@/wharf/errors'
import { refreshChore } from '@/chores/signal'
import { readMinedRewards } from '@/pools/MineCelebration'
import { MineToast, type MineToastState } from '@/pools/MineToast'
import { NUM_LOCALE } from '@/format'
import { rememberWinPower } from '@/briefing/winPower'
import { GameImg } from '@/components/GameImg'
import { Engram, Laurel, ResultCard } from '@/fight/ResultHonours'
import { fightLook, type FightLook } from '@/fight/fightLook'
import { fightStageFor, stageFor, type Stage } from '@/fight/stages'
import { GroundMark, LandStage } from '@/fight/LandStage'
import { ArenaStage } from '@/fight/ArenaStage'
import { onGround, roleLines, type Spot } from '@/fight/formation'
import { useLandType } from '@/fight/useLandType'
import { GildedCards } from '@/fight/GildedCards'
import { asset } from '@/assets'
import {
  fetchShardPools,
  fetchTlmPools,
  type ShardPool,
  type TlmPool,
} from '@/pools/queries'
import {
  MAX_MINE_POWER,
  liveShardPool,
  liveTlmPool,
  mineEstimate,
} from '@/pools/rules'

/**
 * The battle replay.
 *
 * Nothing here is fetched frame by frame. The chain records only the opening
 * line-ups, the winner and the number of blows; every intermediate state is
 * recomputed locally by `simulate`, which mirrors the contract's combat loop
 * exactly. That means the whole fight is in memory before the first frame
 * draws, so playback never waits on the network and can be scrubbed, sped up
 * or skipped freely.
 */

/**
 * Milliseconds per blow at 1×.
 *
 * One blow is told in three beats: the strike (the lunge, and the recoil
 * that ends about 1.1 s in), then the next attacker is called, then half a
 * second later they swing. Slower than the original's 1.5 s, so the pointer
 * never appears while the last blow is still landing.
 */
const BASE_TURN_MS = 1700

/**
 * When the swing connects, in milliseconds at 1×.
 *
 * Must stay equal to `--impact` in battle.css: the CSS drives the recoil,
 * the flash and the damage number, and this drives when health, death and
 * wind-up actually change. If the two drift apart, consequences appear
 * before or after the blow that caused them.
 */
const IMPACT_MS = 580

/** How long the next attacker is called before they swing. */
const AIM_LEAD_MS = 500

/**
 * How long the arena holds after the final blow lands.
 *
 * Long enough for the last knockout to play out. Without it the result
 * screen arrives on the same frame as the killing hit, and the fight appears
 * to be scored before it has visibly ended.
 */
const FINISH_HOLD_MS = 950

/**
 * How long the consumed attack takes to collapse out of the turn strip.
 *
 * Comfortably inside a beat, so the slide has finished well before the next
 * attack lands and the strip is never mid-move when it changes again.
 */
const QUEUE_SLIDE_MS = 420

/**
 * How long to keep asking the arena who is standing in it.
 *
 * The row is written by the same transaction whose result is on screen, so
 * the first read can beat it there.
 */
const DEFENDER_ATTEMPTS = 8
const DEFENDER_INTERVAL_MS = 900

const SPEEDS = [1, 2, 4] as const
type Speed = (typeof SPEEDS)[number]

export default function Battle() {
  const { historyId = '' } = useParams()
  const player = useGame((s) => s.player)!
  const navigate = useNavigate()

  const [row, setRow] = useState<FightRow | null>(() => recallFight(historyId) ?? null)
  /*
     Where this fight happened, if this browser watched it happen. A replay
     reached by a direct link has no venue to recall — the chain row does not
     record one — so the screen falls back to the dungeon, which is what every
     replay assumed before venues existed.
  */
  const venue: Venue = recallVenue(historyId) ?? 'dungeon'
  const known = recallVenue(historyId) !== undefined
  /*
     The two numbers the replay is simulated with, from the store.

     The taunt deduction stays nullable on purpose: the simulation cannot
     start without it, and null is what the memo below waits on. Falling back
     to zero would run the fight with taunt doing nothing, which is a
     different fight — and the old effect did exactly that on a failed read.
  */
  const { caps } = useConfig()
  const fightCost = useLazyConfig('fightCost')
  const tauntDeduction = fightCost ?? null
  const [error, setError] = useState<string | null>(null)

  /*
   * The row normally comes straight from the dungeon screen, which stored it
   * the moment it appeared. A direct visit or a reload falls back to the
   * chain, which only helps inside the sixty seconds before `deloldfights`
   * erases it — so a miss here is expected rather than exceptional.
   */
  useEffect(() => {
    if (row) return
    let live = true
    fetchFight(historyId)
      .then((found) => {
        if (!live) return
        if (found) {
          rememberFight(found)
          setRow(found)
        } else {
          setError(
            'This battle is no longer on chain. Fight records are kept for about ' +
              'a minute, so replays can only be watched shortly after the fight.',
          )
        }
      })
      .catch((err) => live && setError(readableError(err)))
    return () => {
      live = false
    }
  }, [historyId, row])

  const replay = useMemo<Replay | null>(() => {
    if (!row || tauntDeduction === null) return null
    /*
       The venue is not decoration here: abilities can be conditioned on the
       building hosting the fight, so replaying an arena as a dungeon quietly
       drops every bonus that only fires in an arena.
    */
    return simulate(row, { tauntDeduction, caps, building: venue })
  }, [row, tauntDeduction, caps, venue])

  if (error) {
    return (
      <div className="battle battle--message">
        <div className="alert alert--error">{error}</div>
        <Link className="btn btn--primary" to="/map">
          Back to the map
        </Link>
      </div>
    )
  }

  if (!replay) {
    return (
      <div className="battle battle--message">
        <span className="spinner" />
        <p className="faint">Reconstructing the fight…</p>
      </div>
    )
  }

  return (
    <Arena
      replay={replay}
      row={row!}
      playertag={player.playertag}
      onLeave={() => navigate('/map')}
      /*
         Losing sends you back to try again; winning sends you out to the map,
         because the thing you came for is done. Only offered when the venue
         is actually known — sending a player to /dungeon from a replay that
         was an arena fight would be worse than sending them to the map.
      */
      onRetry={known ? () => navigate(`/${venue}`) : undefined}
      venue={venue}
    />
  )
}

/* ---------- the arena ---------- */

/**
 * A fight, played: the clock, the beats, and everything on the field as of
 * the blow that has landed.
 *
 * The dungeon and the arena watch their fights through this, and so does the
 * tournament — so a fight looks and moves the same wherever a player sees
 * one. `ticking` keeps the running clock live, which only the broadcast
 * layouts show.
 */
export function useFightPlayback(replay: Replay, ticking: boolean) {
  const total = replay.turns.length

  /** How many blows have landed. 0 is the opening line-up, `total` the end. */
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  /*
     Fixed, now that the speed buttons are gone. The value still runs the
     turn timer, the impact delay and the bar's own beat, so it stays a
     named thing rather than a 1 sprinkled through four expressions.
  */
  const [speed, setSpeed] = useState<Speed>(1)
  /*
   * Playback is a chain of timeouts rather than an interval: the delay has to
   * change with the speed control mid-fight, and a timeout that reschedules
   * itself does that without accumulating drift or firing a burst of catch-up
   * ticks when the tab has been in the background.
   */
  useEffect(() => {
    if (!playing || step >= total) return
    const id = setTimeout(
      () => setStep((s) => Math.min(s + 1, total)),
      BASE_TURN_MS / speed,
    )
    return () => clearTimeout(id)
  }, [playing, step, total, speed])

  useEffect(() => {
    if (step >= total) setPlaying(false)
  }, [step, total])

  /** The blow just played, which drives every animation on screen. */
  const current: TurnEvent | null = step > 0 ? replay.turns[step - 1] : null

  /*
     Who swings next, called once the last blow has played out and held for
     AIM_LEAD_MS before they strike, as the tournament's broadcast does.
  */
  const [aimUid, setAimUid] = useState<string | null>(null)
  useEffect(() => {
    setAimUid(null)
    if (!playing || step >= total) return
    const at = window.setTimeout(
      () => setAimUid(replay.turns[step]?.attackerUid ?? null),
      (BASE_TURN_MS - AIM_LEAD_MS) / speed,
    )
    return () => window.clearTimeout(at)
  }, [step, playing, total, speed, replay])

  /*
     The fight as a running time, the way a video player shows it. Every
     blow takes BASE_TURN_MS at 1x, so the length is known up front and the
     time into the fight is the blows played plus how far into the next
     one the clock has run. Re-read four times a second while playing.
  */
  const turnStartedAt = useRef(0)
  useEffect(() => {
    turnStartedAt.current = performance.now()
  }, [step, playing, speed])
  const [, setTicks] = useState(0)
  useEffect(() => {
    if (!ticking || !playing || step >= total) return
    const id = window.setInterval(() => setTicks((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [ticking, playing, step, total])
  const into =
    playing && step < total
      ? Math.min(BASE_TURN_MS, (performance.now() - turnStartedAt.current) * speed)
      : 0
  const elapsedMs = Math.min(total * BASE_TURN_MS, step * BASE_TURN_MS + into)

  /**
   * Whether the current blow has landed yet.
   *
   * A turn's snapshot is the state *after* it resolved, so applying it the
   * moment the turn advances put every consequence on screen before its
   * cause: a fighter became a tombstone at the start of the blow that killed
   * it, and the damage number then flew off the corpse. Health, death and
   * wind-up all wait for the moment of impact instead, which is also when the
   * bar should visibly drain.
   *
   * A jump — skipping to the end — applies immediately; there is no
   * animation to stay in step with.
   */
  const [landed, setLanded] = useState(false)
  const prevStep = useRef(0)

  useEffect(() => {
    const jumped = Math.abs(step - prevStep.current) > 1
    prevStep.current = step
    if (step === 0 || jumped) {
      setLanded(true)
      return
    }
    setLanded(false)
    const id = setTimeout(() => setLanded(true), IMPACT_MS / speed)
    return () => clearTimeout(id)
  }, [step, speed])

  /** The last turn whose outcome is on screen. */
  const shownStep = landed ? step : step - 1

  /**
   * Every fighter as of `shownStep`.
   *
   * Read straight from the turn's snapshot rather than derived. Wind-up used
   * to be reconstructed by adding each attacker's attackspeed per swing,
   * which is only right while nothing changes those stats — and in-fight
   * effects change both `initiative` and `attackspeed`, so the moment an
   * ability landed the displayed clock drifted from the contract's.
   */
  const state = useMemo(
    () => new Map(stateAt(replay, shownStep).map((f) => [f.uid, f])),
    [replay, shownStep],
  )

  /**
   * Net ability change per fighter for the current blow, which the floating
   * pill shows. Summed the way the original does: several effects landing on
   * one fighter in a turn read as one number.
   */
  const abilityDelta = useMemo(() => {
    const map = new Map<string, number>()
    if (!current) return map
    for (const e of current.effects) {
      map.set(e.targetUid, (map.get(e.targetUid) ?? 0) + (e.after - e.before))
    }
    return map
  }, [current])

  /*
     Where every fighter stands against its own team on the two numbers that
     decide what happens next: taunt, which draws the blow, and initiative,
     which decides who throws it.
   */
  const standing = useMemo(() => standingAt(replay, shownStep), [replay, shownStep])

  const team1 = replay.fighters.filter((f) => f.team === 1)
  const team2 = replay.fighters.filter((f) => f.team === 2)
  /**
   * When the result screen may take over.
   *
   * Not `step >= total`, which was the bug: `step` advances when an attack
   * *begins*, so the result replaced the arena while the killing blow was
   * still in flight and the last fighter was still standing. It waits for
   * `shownStep` — the blow having landed — and then for the knockout to
   * finish playing, so the fight is seen to end before it is scored.
   */
  const [settled, setSettled] = useState(false)

  /**
   * Skipping, which is a different question and needs its own answer.
   *
   * The hold below is about letting a blow finish before the fight is scored.
   * A player who presses Skip has said they do not want to watch the blow at
   * all, so the hold has nothing to wait for — and worse, it used to undo the
   * skip: pressing it mid-swing left `shownStep` one behind `total` for a
   * frame, the effect read that as "not there yet" and cleared `settled`, and
   * the screen played out the last hit and then held for another beat before
   * the result appeared. Which is exactly what Skip is for avoiding.
   */
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    /* Already answered; nothing here may overrule it. */
    if (skipped) return
    if (shownStep < total) {
      setSettled(false)
      return
    }
    const id = setTimeout(() => setSettled(true), FINISH_HOLD_MS / speed)
    return () => clearTimeout(id)
  }, [shownStep, total, speed, skipped])

  const finished = settled || skipped

  /**
   * Who swings next.
   *
   * Lowest wind-up among the living, across both sides — the same rule the
   * contract uses to pick an attacker. Marking them turns the pause between
   * blows into anticipation rather than dead air.
   */
  const nextUp = useMemo(() => {
    if (finished) return null
    let best: string | null = null
    let lowest = Infinity
    for (const f of replay.fighters) {
      const hp = state.get(f.uid)?.health ?? f.start_health
      if (hp <= 0) continue
      const wind = state.get(f.uid)?.initiative ?? f.initiative
      if (wind < lowest) {
        lowest = wind
        best = f.uid
      }
    }
    return best
  }, [replay, state, finished])

  /* Asking to skip is asking for the result now, not after the last blow. */
  const skip = useCallback(() => {
    setPlaying(false)
    setStep(total)
    setSkipped(true)
  }, [total])

  const restart = useCallback(() => {
    setStep(0)
    setSettled(false)
    setSkipped(false)
    setPlaying(true)
  }, [])

  return {
    total,
    step,
    setStep,
    playing,
    setPlaying,
    speed,
    setSpeed,
    current,
    aimUid,
    elapsedMs,
    state,
    abilityDelta,
    standing,
    team1,
    team2,
    finished,
    nextUp,
    skip,
    restart,
  }
}

export type FightPlayback = ReturnType<typeof useFightPlayback>

/**
 * The fight on screen: both teams on the field, the turn order, the
 * transport bar and the live log — the battle the dungeon and the arena
 * show, for anywhere a fight is watched.
 */
export function FightStage({
  replay,
  pb,
  playertag,
  mineLabel = 'Your team',
  enemyLabel,
  enemyOwner = 'The dungeon',
  live,
  phone,
  broadcast,
  logHidden = false,
  overlay,
  look = 'classic',
  ground,
}: {
  replay: Replay
  pb: FightPlayback
  playertag: string
  /** What the left-hand team is called on the field. */
  mineLabel?: string
  enemyLabel: string
  /** Who the right-hand fighters belong to, in the turn order. */
  enemyOwner?: string
  /** The venue's name on the LIVE tag. */
  live: string
  phone: boolean
  /** The broadcast layout, with the transport bar under the picture. */
  broadcast: boolean
  /**
   * Start with the log shut, on a phone too, behind a Log button.
   *
   * The tournament's choice: a fight there is watched rather than studied,
   * and the field wants the room. Not remembered — every fight starts shut.
   */
  logHidden?: boolean
  /** Drawn over the picture and its control bar — a result, say — at their size. */
  overlay?: React.ReactNode
  /**
   * The fight on its ground, with the gilded cards under it (see fightLook).
   * Only the fight page passes one; the tournament keeps the classic field.
   */
  look?: FightLook
  /** Which ground, in the land look: the arena, or a dungeon's land. Veles' coast if none is given. */
  ground?: Stage
}) {
  const { step, total, speed, playing } = pb
  const land = look === 'land'
  const stage = useMemo(() => (land ? ground ?? stageFor() : undefined), [land, ground])
  /* Where each fighter stands on the ground, from the taunt they open with (see formation.ts). */
  const lineup = useMemo(() => {
    if (!land) return undefined
    const opening = standingAt(replay, 0)
    const out = new Map<string, Spot>()
    for (const team of [1, 2]) {
      const fighters = replay.fighters.filter((f) => f.team === team)
      const spots = roleLines(
        fighters.map((f) => ({
          uid: f.uid,
          classname: f.classname,
          taunt: opening.get(f.uid)?.taunt ?? f.taunt,
          health: f.start_health,
        })),
      )
      for (const [uid, spot] of spots) out.set(uid, spot)
    }
    return out
  }, [land, replay])
  const charge = useMemo(
    () => (land ? chargeOf(replay.fighters, pb.state) : undefined),
    [land, replay, pb.state],
  )
  /* The gilded cards: over the foot of the stage on a desktop, as the sheet laid them out. */
  const cards = charge && (
    <GildedCards
      team1={pb.team1}
      team2={pb.team2}
      state={pb.state}
      current={pb.current}
      nextUp={pb.nextUp}
      charge={charge}
      tall={false}
      beat={1 / speed}
    />
  )
  const logRef = useRef<HTMLDivElement>(null)
  /*
     On a phone the fight on the ground has the page to itself: the log waits
     behind the Log button and opens as a sheet over the player, shut at the
     start of every fight as the tournament's is.
  */
  const sheetLog = land && phone
  const shut = logHidden || sheetLog
  /* Open unless this player has closed it; their choice is remembered. */
  const [showLog, setShowLogState] = useState(() => (shut ? false : readShowLog(phone)))
  const setShowLog = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    setShowLogState((v) => {
      const value = typeof next === 'function' ? next(v) : next
      if (shut) return value
      try {
        localStorage.setItem(LOG_KEY, value ? '1' : '0')
      } catch {
        /* Private mode: the choice lasts until the page is left. */
      }
      return value
    })
  }, [shut])

  /*
     The log follows the fight, as the original's does. It also opens on the
     newest blow: a desktop starts with it shut, and opening it mid-fight left
     it at the first blow, since nothing had moved it since.
  */
  const logOpen = useRef(false)
  useEffect(() => {
    const el = logRef.current
    if (!el) {
      logOpen.current = false
      return
    }
    const opening = !logOpen.current
    logOpen.current = true
    /* A phone lists the newest blow first, so that is where it stays. */
    el.scrollTo({ top: phone ? 0 : el.scrollHeight, behavior: opening ? 'auto' : 'smooth' })
  }, [step, phone, showLog])

  /*
     The live log, in the combat log sheet's own layout, and there from the
     first frame so the field does not shift when the first blow lands.
  */
  const logPanel = (
    <section
      className={`panel clog clog--live${land ? ' clog--chron' : ''}${sheetLog ? ' clog--sheet' : ''}`}
      aria-label="Combat log"
    >
      <header className="clog__head">
        <div className="clog__heading">
          <span className="panel__title">Combat log</span>
          <p className="clog__sub">
            {step} of {total} blow{total === 1 ? '' : 's'}
          </p>
        </div>
        {sheetLog && (
          <button type="button" className="clog__close" onClick={() => setShowLog(false)} aria-label="Close the combat log">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </header>
      <div className="clog__body" ref={logRef}>
        {step === 0 ? (
          <p className="muted clog__waiting">The fight is about to begin.</p>
        ) : (
          <CombatLogEntries
            replay={replay}
            playertag={playertag}
            chronicle={land}
            newest={step - 1}
            turns={
              phone
                ? Array.from({ length: step }, (_, i) => step - 1 - i)
                : Array.from({ length: step }, (_, i) => i)
            }
          />
        )}
      </div>
    </section>
  )

  return (
    <div className={`bfwrap${broadcast ? ' bfwrap--bcast' : ''}${broadcast && showLog && !phone ? ' bfwrap--log' : ''}${land ? ' bfwrap--land' : ''}${sheetLog ? ' bfwrap--full' : ''}`}>
      <div className="bfmain">
        {/* The turn order is part of the picture, under the scorebar. */}
        <Battlefield
          wide={!phone}
          /* On the ground the cards' "next" and the rings at the feet say who
             swings next; the rail is the classic field's. */
          queue={
            land ? undefined : (
              <TurnQueue replay={replay} step={step} speed={speed} playertag={playertag} enemyOwner={enemyOwner} />
            )
          }
          team1={pb.team1}
          team2={pb.team2}
          state={pb.state}
          current={pb.current}
          turn={step}
          abilityDelta={pb.abilityDelta}
          standing={pb.standing}
          nextUp={pb.nextUp}
          playertag={playertag}
          mineLabel={mineLabel}
          enemyLabel={enemyLabel}
          broadcast={broadcast ? live : undefined}
          aimUid={pb.aimUid}
          stage={stage}
          lineup={lineup}
          charge={charge}
          deck={land && charge && !phone ? cards : undefined}
        />
        {land && charge && phone && (
          <GildedCards
            team1={pb.team1}
            team2={pb.team2}
            state={pb.state}
            current={pb.current}
            nextUp={pb.nextUp}
            charge={charge}
            tall={phone}
            beat={1 / speed}
          />
        )}
        {broadcast && (
          <div className="bcdeck">
            <button
              type="button"
              className="bcdeck__btn"
              onClick={() => (step >= total ? pb.restart() : pb.setPlaying((p) => !p))}
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 5v14l12-7z" />
                </svg>
              )}
            </button>
            <span className="bcdeck__count mono">
              {clock(pb.elapsedMs)} <small>/ {clock(total * BASE_TURN_MS)}</small>
            </span>
            {/* The fight's progress, and a way to any point of it. */}
            <div
              className="bcdeck__rail"
              role="slider"
              tabIndex={0}
              aria-label="Fight progress"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={step}
              aria-valuetext={`${clock(pb.elapsedMs)} of ${clock(total * BASE_TURN_MS)}, blow ${step} of ${total}`}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                pb.setStep(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * total))
              }}
              onKeyDown={(e) => {
                const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                if (!by) return
                e.preventDefault()
                pb.setStep((v) => Math.min(total, Math.max(0, v + by)))
              }}
            >
              <i style={{ width: `${total ? (pb.elapsedMs / (total * BASE_TURN_MS)) * 100 : 0}%` }} />
            </div>
            <button
              type="button"
              className="bcdeck__speed"
              onClick={() => pb.setSpeed((v) => SPEEDS[(SPEEDS.indexOf(v) + 1) % SPEEDS.length])}
              title="Playback speed"
            >
              {speed}×
            </button>
            {phone && shut && (
              <button
                type="button"
                className="bcdeck__skip"
                aria-pressed={showLog}
                onClick={() => setShowLog((v) => !v)}
              >
                Log
              </button>
            )}
            {phone ? (
              /* The title line is a wider screen's; a phone skips from here. */
              <button type="button" className="bcdeck__skip" onClick={pb.skip}>
                Skip
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4 5v14l8-7zM12 5v14l8-7z" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="bcdeck__log"
                aria-pressed={showLog}
                onClick={() => setShowLog((v) => !v)}
              >
                Combat log
              </button>
            )}
            {/* A window has no title line to carry Skip, so a desktop gets it here too. */}
            {!phone && logHidden && (
              <button type="button" className="bcdeck__skip" onClick={pb.skip}>
                Skip
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4 5v14l8-7zM12 5v14l8-7z" />
                </svg>
              </button>
            )}
          </div>
        )}
        {sheetLog && showLog && logPanel}
        {overlay}
      </div>

      {(!broadcast || (showLog && !sheetLog) || (phone && !shut)) && logPanel}
    </div>
  )
}

function Arena({
  replay,
  row,
  playertag,
  onLeave,
  onRetry,
  venue,
}: {
  replay: Replay
  row: FightRow
  playertag: string
  onLeave: () => void
  /** Back to the screen the fight was started from, where that is known. */
  onRetry?: () => void
  venue: Venue
}) {
  const phone = usePhone()
  /*
     The ground it is fought on: an arena fight in the arena, under the sky of
     the planet the player is on (the arena stands on their land); a dungeon
     on its land: that land's ground under the sky of the planet it is on.
  */
  const planet = useGame((s) => s.player?.planet)
  const land = useLandType()
  const ground = useMemo(() => {
    const g = fightStageFor(venue, planet, land.type)
    /* until the land is known the stage draws nothing: not the default first, and then the real one */
    return g.kind === 'land' && land.pending ? { ...g, waiting: true } : g
  }, [venue, planet, land.type, land.pending])
  /*
     On a desktop the battlefield plays as a broadcast on the glass, with the
     map behind it: a window with a scorebar and a transport bar under the
     picture. The log opens in a column beside it on request.
  */
  const wide = useWide()
  /* A phone gets the player too: a taller one, the log always under it. */
  const broadcast = wide || phone
  const pb = useFightPlayback(replay, broadcast)
  const { step, total, speed, finished, skip, restart } = pb

  /*
     A fight pays XP, and enough of it levels a fighter up.

     The nav dot for My Fighters means "a fighter is ready to level up",
     and it re-checks on its own every three minutes through the cache -
     so after a run that earned the last XP a fighter needed, the dot
     could be three minutes late and then still answer from a roster read
     before the fight. `refreshChore` forces the read, and the moment the
     result screen appears is when the chain has just been written to.
  */
  useEffect(() => {
    if (finished) refreshChore('fighters')
  }, [finished])

  /*
     Still here, and still offered - on the result screen, where a player
     who wants the numbers has finished watching and has a reason to want
     them. It was in the bar during the fight as well, which is the one
     moment nobody is going to open a spreadsheet.
  */
  const download = useCallback(() => {
    const csv = combatLogCsv(replay)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fight-history-${row.history_id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [replay, row.history_id])

  const skipButton = (
    <>
          {/* On the right, where a hand goes to move on. The size of Start Fight. */}
          <button type="button" className="btn btn--ghost battle__skip" onClick={skip}>
            Skip Fight
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4 5v14l8-7zM12 5v14l8-7z" />
            </svg>
          </button>
    </>
  )

  return (
    <div className="battle">

      {!finished && (
      <div
        className="battle__inner"
        style={{ ['--beat' as string]: String(1 / speed) }}
      >
        {broadcast ? (
          /* The page's own title line: the title and Skip, nothing else. The
             count and the progress are on the window's transport bar. */
          <header className="battle__titleline">
            <h1 className="page__title">Battle</h1>
            <span className="spacer" />
            {skipButton}
          </header>
        ) : (
        <header className="battle__bar">
          {/*
            The only control a fight needs.

            The bar carried Back, Play/Pause, three speeds, Skip Fight and
            Combat Log - seven controls over a fight that lasts under a
            minute and has no decisions in it. Every one of them answered
            the same question, "I do not want to watch the rest of this",
            and Skip answers it best: it goes straight to the result, which
            is what Back was being used for as well, except that Back threw
            the result away.
          */}
          {/*
            The scoreboard: the attack count large, and a segment per attack
            that lights as it lands. A long fight shares segments, so the
            row never runs to more than thirty.
          */}
          <div
            className="battle__score"
            role="progressbar"
            aria-label="Attacks played"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={step}
          >
            <div className="battle__scoretop">
              <span className="battle__scorelbl">Attack</span>
              <span className="battle__scorenum">
                {step}
                <small> / {total}</small>
              </span>
            </div>
            <div className="battle__segs" aria-hidden="true">
              {(() => {
                const n = Math.max(1, Math.min(total, 30))
                const lit = total ? Math.round((step / total) * n) : n
                return Array.from({ length: n }, (_, i) => (
                  <i key={i} className={i < lit ? 'is-on' : undefined} />
                ))
              })()}
            </div>
          </div>

          {skipButton}
        </header>
        )}

        {/*
          The battlefield: both teams in formation, every blow played where
          the fighters stand. The log takes the right-hand column where the
          screen is wide enough, and sits underneath where it is not.
        */}
        <FightStage
          replay={replay}
          pb={pb}
          playertag={playertag}
          enemyLabel={venue === 'arena' ? 'The defenders' : 'The dungeon'}
          live={venue === 'arena' ? 'Arena' : 'Dungeon'}
          phone={phone}
          broadcast={broadcast}
          look={fightLook()}
          ground={ground}
        />
      </div>
      )}

      {finished && (
        <Result
          replay={replay}
          row={row}
          onLeave={onLeave}
          onRetry={onRetry}
          venue={venue}
          onReplay={restart}
          onDownload={download}
        />
      )}
    </div>
  )
}



/**
 * Where each fighter stands, as [x, y] percentages of the field.
 *
 * x is measured from the fighter's own edge, so one table serves both sides
 * mirrored; y is the line the bottom of its plate sits on. Front rank on the
 * even slots, back rank on the odd, staggered half a row so nobody stands
 * directly behind anybody else.
 */
const FORMATION: [number, number][] = [
  [36, 47],
  [15, 35],
  [36, 73],
  [15, 61],
  [36, 98],
  [15, 87],
]

/**
 * The desktop formation: two rows standing on the arena floor, three abreast.
 *
 * [x, y, depth]. The front row is on the even slots, the back row on the odd,
 * and each back fighter stands in the gap between two front ones so no plate
 * is hidden. Depth shrinks the back row a little, which is what puts the
 * teams on the ground rather than stacked up the screen.
 */
const FORMATION_WIDE: [number, number, number][] = [
  [15, 95, 1],
  [8, 72, 0.86],
  [29, 95, 1],
  [22, 72, 0.86],
  [43, 95, 1],
  [36, 72, 0.86],
]

/** How far an attacker dashes toward its target, as a share of the gap. */
const LUNGE_SHARE = 0.55

/**
 * Every class swings its own way on the battlefield.
 *
 * The name is a CSS hook: `bunit--atk-<move>` drives how the attacker moves,
 * `bunit--took-<move>` how the target takes it, and `bfx--<move>` the
 * effect drawn for the blow. All of them connect at --impact, when the
 * damage lands, so the numbers and the health bars stay in step whatever the
 * class. Anything not listed, the NFT fighter included, keeps the plain
 * lunge.
 */
const SIGNATURE: Record<string, string> = {
  juggernaut: 'earth', // Earthsplitter
  astralknight: 'halo', // Halo Smite
  mindblade: 'cuts', // Thousand Cuts
  voidwarden: 'well', // Gravity Well
  lunatic: 'laugh', // Mad Laughter
  tactician: 'wall', // Shield Wall Break
  hunter: 'pierce', // Piercing Shot
  desperado: 'noon', // High Noon
  explosioneer: 'blast', // Mega Blast
  arcanist: 'missiles', // Arcane Missiles
  mystic: 'pillars', // Sacred Pillars
  voidcaller: 'tendrils', // Void Tendrils
}

/** How many pieces each move's effect is drawn with: one `<i>` each. */
const FX_PARTS: Record<string, number> = {
  earth: 6,
  halo: 3,
  cuts: 6,
  well: 6,
  laugh: 5,
  wall: 3,
  pierce: 4,
  noon: 4,
  blast: 4,
  missiles: 8,
  pillars: 4,
  tendrils: 5,
}

/**
 * How hard each move shakes the field when it lands, and whether it lands
 * as a flurry (three small shakes) rather than one. Small on purpose: the
 * names and the turn order have to stay readable through it.
 */
const SHAKE: Record<string, [number, boolean]> = {
  earth: [1.6, false],
  halo: [1.2, false],
  cuts: [0.8, true],
  well: [1, false],
  laugh: [1, false],
  wall: [1.2, false],
  pierce: [1.8, false],
  noon: [1.2, false],
  blast: [2.4, false],
  missiles: [0.8, true],
  pillars: [1, true],
  tendrils: [1, false],
}

/**
 * How close each fighter is to its next blow, 0 to 1, for the charge ring at
 * its feet and the strip on its card.
 *
 * The fighter with the lowest wind-up swings next (the contract's rule), so
 * it is full; everyone else is as far behind it as their wind-up is, in their
 * own attack speed — a fighter one whole swing behind reads empty. Read from
 * the shown snapshots, so it moves when a blow lands, with the bars.
 */
function chargeOf(fighters: SimFighter[], state: Map<string, FighterSnapshot>): Map<string, number> {
  let lowest = Infinity
  for (const f of fighters) {
    const snap = state.get(f.uid)
    if ((snap?.health ?? f.start_health) <= 0) continue
    lowest = Math.min(lowest, snap?.initiative ?? f.initiative)
  }
  const out = new Map<string, number>()
  for (const f of fighters) {
    const snap = state.get(f.uid)
    const wind = snap?.initiative ?? f.initiative
    const speed = snap?.attackspeed ?? f.attackspeed
    out.set(f.uid, speed > 0 ? Math.max(0, Math.min(1, 1 - (wind - lowest) / speed)) : 0)
  }
  return out
}

function signatureOf(f: SimFighter | undefined): string | undefined {
  if (!f || Number(f.fighter_id) === NFT_FIGHTER_ID) return undefined
  return SIGNATURE[(f.classname || '').toLowerCase().replace(/[^a-z]/g, '')]
}

function Battlefield({
  team1,
  team2,
  state,
  current,
  turn,
  abilityDelta,
  standing,
  nextUp,
  playertag,
  mineLabel = 'Your team',
  enemyLabel,
  wide,
  queue,
  broadcast,
  aimUid,
  stage,
  lineup,
  charge,
  deck,
}: {
  team1: SimFighter[]
  team2: SimFighter[]
  state: Map<string, FighterSnapshot>
  current: TurnEvent | null
  turn: number
  abilityDelta: Map<string, number>
  standing: Map<string, Standing>
  nextUp: string | null
  playertag: string
  /** What the left-hand team is called: "Your team", or a player's name. */
  mineLabel?: string
  enemyLabel: string
  /** The desktop layout: fighters on the arena floor, the order inside. */
  wide: boolean
  /** The turn order, drawn inside the field. */
  queue?: React.ReactNode
  /** The venue's name for the LIVE tag, when the field plays as a broadcast. */
  broadcast?: string
  /** The fighter about to swing, for the pointer over their head. */
  aimUid?: string | null
  /** The ground to fight on, in the land look; the fight artwork otherwise. */
  stage?: Stage
  /** Where each fighter stands on the ground, in the land look. */
  lineup?: Map<string, Spot>
  /** Each fighter's charge, for the ring at its feet in the land look. */
  charge?: Map<string, number>
  /** Drawn over the foot of the field: the gilded cards, in the land look on a desktop. */
  deck?: React.ReactNode
}) {
  /*
     A phone's ground is the square at the foot of the field, and the field
     may stand taller than that, with more sky over it (landstage.css). Its
     height over its width, so the spots on the ground land where it is drawn.
  */
  const fieldRef = useRef<HTMLDivElement>(null)
  const square = !!stage && !wide
  const [stretch, setStretch] = useState(1)
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!square || !el || typeof ResizeObserver === 'undefined') {
      setStretch(1)
      return
    }
    /* Below 1 on a short phone, where the field is less than square and the
       ground at its foot is trimmed from above; 0.6 is the field's floor. */
    const measure = () => setStretch(Math.max(0.6, el.offsetHeight / Math.max(1, el.offsetWidth)))
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [square])
  const where = new Map<string, [number, number]>()
  const depth = new Map<string, number>()
  for (const team of [team1, team2]) {
    team.forEach((f, i) => {
      const spot = lineup?.get(f.uid)
      /* The player is wide on a phone too: two rows of three, as on desktop. */
      const [x, y, d] = spot
        ? onGround(spot, wide, stretch)
        : wide || broadcast
          ? FORMATION_WIDE[i % FORMATION_WIDE.length]
          : [...FORMATION[i % FORMATION.length], 1]
      where.set(f.uid, [f.team === 1 ? x : 100 - x, y])
      depth.set(f.uid, d)
    })
  }

  const from = current ? where.get(current.attackerUid) : undefined
  const to = current ? where.get(current.defenderUid) : undefined
  const lunge =
    from && to
      ? { dx: (to[0] - from[0]) * LUNGE_SHARE, dy: (to[1] - from[1]) * LUNGE_SHARE }
      : null

  const attacker = current ? [...team1, ...team2].find((f) => f.uid === current.attackerUid) : undefined
  const signature = signatureOf(attacker)
  const shake = current && signature ? SHAKE[signature] : undefined

  const alive = (team: SimFighter[]) =>
    team.filter((f) => (state.get(f.uid)?.health ?? f.start_health) > 0).length

  /* What is left of a team's health, for the scorebar. */
  const health = (team: SimFighter[]) => {
    let now = 0
    let max = 0
    for (const f of team) {
      now += Math.max(0, state.get(f.uid)?.health ?? f.start_health)
      max += f.start_health
    }
    return max ? (now / max) * 100 : 0
  }

  return (
    <div
      className={
        `bfield${wide ? ' bfield--wide' : ''}${broadcast ? ' bfield--bcast' : ''}${stage ? ' bfield--land' : ''}` +
        /* The arena's shadows fall away from its planet's sun; Veles' coast has it on the left. */
        (stage?.kind === 'arena' ? ` bfield--arena bfield--sun-${stage.sky.side}` : '') +
        /* Alternating names, so a blow that follows another of its kind still shakes. */
        (shake ? ` bfield--shake${shake[1] ? ' bfield--flurry' : ''} bfield--t${turn % 2}` : '')
      }
      ref={fieldRef}
      style={
        {
          '--bf-bg': `url('${asset('/assets/background/bg-fight.webp')}')`,
          ...(shake ? { '--shake': shake[0] } : {}),
          ...(square ? { '--ratio': stretch } : {}),
        } as React.CSSProperties
      }
    >
      {stage?.kind === 'land' && <LandStage stage={stage} form={wide ? 'wide' : 'tall'} />}
      {stage?.kind === 'arena' && <ArenaStage stage={stage} form={wide ? 'wide' : 'tall'} />}

      <div className="bfield__labels">
        <span className="bfield__label bfield__label--mine">
          {mineLabel}{' '}
          <span className="mono">
            {alive(team1)}/{team1.length}
          </span>
          {broadcast && (
            <span className="bfield__teamhp" aria-hidden="true">
              {stage && <b style={{ scale: `${health(team1) / 100} 1` }} />}
              <i style={{ scale: `${health(team1) / 100} 1` }} />
            </span>
          )}
        </span>
        <span className="bfield__mid">
        {broadcast && <span className="bfield__live">Live · {broadcast}</span>}
        {current && (
          <span className="bfield__attack" key={`atk-${turn}`}>
            <span className="mono">Attack {turn}</span>
            {current.element && (
              <img
                src={elementIcon(current.element)}
                alt={current.element}
                width={16}
                height={16}
              />
            )}
            <span className="mono">{current.effectiveness}%</span>
          </span>
        )}
        </span>
        <span className="bfield__label bfield__label--enemy">
          {enemyLabel}{' '}
          <span className="mono">
            {alive(team2)}/{team2.length}
          </span>
          {broadcast && (
            <span className="bfield__teamhp" aria-hidden="true">
              {stage && <b style={{ scale: `${health(team2) / 100} 1` }} />}
              <i style={{ scale: `${health(team2) / 100} 1` }} />
            </span>
          )}
        </span>
      </div>

      {queue && <div className="bfield__queue">{queue}</div>}

      {/*
        The blow's effect - a crack racing to the target, a halo, a volley of
        bolts - drawn on the field between the two fighters, and gone with
        the turn. Each piece is placed and timed in battle.css.
      */}
      {current && signature && from && to && (
        <span
          key={`sig-${turn}`}
          className={`bfx bfx--${signature}`}
          aria-hidden="true"
          style={
            {
              '--ax': from[0],
              '--ay': from[1],
              '--tx': to[0],
              '--ty': to[1],
              '--da': depth.get(current.attackerUid) ?? 1,
              '--dt': depth.get(current.defenderUid) ?? 1,
              '--dir': attacker?.team === 1 ? 1 : -1,
            } as React.CSSProperties
          }
        >
          {Array.from({ length: FX_PARTS[signature] ?? 0 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      )}

      {/* What the blow does to the ground the target stands on. */}
      {stage && current && to && (
        <GroundMark
          key={`mark-${turn}`}
          at={to}
          depth={depth.get(current.defenderUid) ?? 1}
          fire={current.element === 'fire'}
          big={current.killed || (shake?.[0] ?? 0) >= 1.6}
          ground={stage.kind === 'arena' ? 'sand' : stage.spec.mark}
          blades={stage.kind === 'land' ? stage.blades : undefined}
        />
      )}

      {[...team1, ...team2].map((f) => {
        const role: 'attacker' | 'defender' | null = !current
          ? null
          : current.attackerUid === f.uid
            ? 'attacker'
            : current.defenderUid === f.uid
              ? 'defender'
              : null
        return (
          <FieldUnit
            key={f.uid}
            fighter={f}
            snap={state.get(f.uid)}
            pos={where.get(f.uid)!}
            depth={depth.get(f.uid) ?? 1}
            role={role}
            turn={turn}
            attack={current?.damage ?? 0}
            blocked={current?.blocked ?? 0}
            effectiveness={current?.effectiveness ?? 100}
            killed={!!current?.killed}
            abilityDelta={abilityDelta.get(f.uid) ?? 0}
            standing={standing.get(f.uid)}
            next={nextUp === f.uid}
            aiming={aimUid === f.uid}
            lunge={role === 'attacker' ? lunge : null}
            signature={role === 'attacker' ? signature : undefined}
            struck={role === 'defender' ? signature : undefined}
            owner={
              f.team === 1 ? f.gamertag || playertag || 'You' : f.gamertag || f.owner || 'AI'
            }
            charge={charge?.get(f.uid)}
            rig={!!stage}
          />
        )
      })}

      {deck}
    </div>
  )
}

/**
 * Whether the fight's combat log starts open: the player's own choice once
 * they have made one. Until then shut on a desktop, where the fight has the
 * window to itself, and open on a phone, where it sits under the picture.
 * Only the Combat log button writes the choice, so a stored "open" is one the
 * player asked for.
 */
const LOG_KEY = 'al.battle.log'

function readShowLog(phone: boolean): boolean {
  try {
    const own = localStorage.getItem(LOG_KEY)
    return own === null ? phone : own !== '0'
  } catch {
    return phone
  }
}

/** Milliseconds as a player's clock: 0:04, 1:12. */
function clock(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Whether the window is wider than a phone's, where the page sits on the
 * glass and the fight plays in the broadcast window. The same line as the
 * phone's, so a window between the two is not left with the old stage.
 */
function useWide(): boolean {
  const query = '(min-width: 720px)'
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

function FieldUnit({
  fighter,
  snap,
  pos,
  depth,
  role,
  turn,
  attack,
  blocked,
  effectiveness,
  killed,
  abilityDelta,
  standing,
  next,
  aiming,
  lunge,
  signature,
  struck,
  owner,
  charge,
  rig = false,
}: {
  fighter: SimFighter
  snap: FighterSnapshot | undefined
  pos: [number, number]
  /** Smaller further back, so the rows read as standing on one floor. */
  depth: number
  role: 'attacker' | 'defender' | null
  turn: number
  attack: number
  /** What the defender's resistance took off this blow. */
  blocked: number
  /** Share of the attacker's damage that landed, 0–100; past 100 is a blow its element favours. */
  effectiveness: number
  killed: boolean
  abilityDelta: number
  standing: Standing | undefined
  next: boolean
  /** Called to swing next: the tournament's pointer over the head. */
  aiming?: boolean
  lunge: { dx: number; dy: number } | null
  /** The attacker's class move, when it has one. See SIGNATURE. */
  signature?: string
  /** The class move this fighter is being hit with, when it has one. */
  struck?: string
  owner: string
  /** How close to its next blow, 0–1: a ring on the floor at its feet (the land look). */
  charge?: number
  /**
   * The land look: a puppet cut at the waist so the upper body breathes, and
   * the whole figure falling and lying there when the fighter is down.
   */
  rig?: boolean
}) {
  const health = snap?.health ?? fighter.start_health
  const maxHealth = snap?.max_health ?? fighter.max_health
  const dead = health <= 0

  /*
     The last blow this fighter took, kept until its number has finished
     falling. The number outlives the turn that dealt it - its rise, hang
     and fall run past the next blow - so it cannot simply follow `role`,
     which moves on the moment the turn does and cut it off mid-fall.
  */
  /* A list, not one: a fighter struck twice running has two numbers in the air. */
  const [hits, setHits] = useState<
    { turn: number; amount: number; blocked: number; effectiveness: number; killed: boolean }[]
  >([])
  useEffect(() => {
    if (role === 'defender' && attack > 0)
      setHits((h) =>
        h.some((x) => x.turn === turn) ? h : [...h, { turn, amount: attack, blocked, effectiveness, killed }],
      )
  }, [role, attack, blocked, effectiveness, killed, turn])
  const pct = maxHealth > 0 ? Math.max(0, (health / maxHealth) * 100) : 0
  const band = pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low'
  const side = fighter.team === 1 ? 'mine' : 'enemy'
  const nft = Number(fighter.fighter_id) === NFT_FIGHTER_ID
  const name = nft ? 'NFT Fighter' : fighter.classname || fighter.racename || 'Fighter'

  const unitClass =
    `bunit bunit--${side}` +
    (role ? ` bunit--${role}` : '') +
    (dead ? ' bunit--dead' : '') +
    (next && !dead ? ' bunit--next' : '') +
    (signature ? ` bunit--atk-${signature}` : '') +
    (struck ? ` bunit--took-${struck}` : '')
  const place = {
    left: `${pos[0]}%`,
    top: `${pos[1]}%`,
    '--depth': depth,
    ...(lunge ? { '--dx': lunge.dx, '--dy': lunge.dy } : {}),
  }
  const title = `${name} (${owner}) — ${formatScaled(health)}/${formatScaled(maxHealth)}`

  /*
     On the ground a fighter is two layers. The figure stands in the depth:
     nearer the camera is drawn over further back, always, through every
     blow, step and fall, so a fighter behind another stays behind it. What
     has to be read (the plate and health over the head, the brackets on a
     target, the numbers a blow throws up) rides a second layer over every
     figure, in the same place, so it is never hidden behind a neighbour.
  */
  if (rig) {
    return (
      <>
        <div
          className={unitClass}
          style={
            {
              ...place,
              zIndex: Math.round(pos[1]),
              '--idl': `${-(((Number(fighter.uid.split('-')[1]) || 0) * 0.47) % 2.4).toFixed(2)}s`,
            } as React.CSSProperties
          }
          title={title}
        >
          <div className="bunit__figure">
            <span className="bunit__platform" aria-hidden="true" />
            {charge !== undefined && !dead && (
              <svg className="bunit__charge" viewBox="0 0 100 30" aria-hidden="true">
                <ellipse className="bunit__chargetrack" cx="50" cy="15" rx="46" ry="12" pathLength={100} />
                <ellipse
                  className="bunit__chargefill"
                  cx="50"
                  cy="15"
                  rx="46"
                  ry="12"
                  pathLength={100}
                  strokeDasharray={`${Math.round(charge * 100)} 100`}
                />
              </svg>
            )}
            {/* The Mindblade's afterimages: the same figure, a beat behind it. */}
            {signature === 'cuts' &&
              !dead &&
              [1, 2, 3].map((n) => (
                <span className="bunit__body bunit__ghost" key={`ghost-${turn}-${n}`} aria-hidden="true">
                  <img
                    className="bunit__art"
                    src={fighterArt({ classname: fighter.classname, racename: fighter.racename })}
                    alt=""
                  />
                </span>
              ))}
            {/* Keyed by the blow, so a fighter that swings twice in a row swings
                twice on screen. */}
            <span className="bunit__body" key={rig && dead ? 'down' : role ? `${role}-${turn}` : 'idle'}>
              {rig && dead ? (
                /* The whole figure goes down, in one piece (see .bunit__fallen). */
                <>
                  <span className="bunit__fallen">
                    <GameImg
                      className="bunit__art"
                      src={
                        nft
                          ? fighterArtFallback()
                          : fighterArt({ classname: fighter.classname, racename: fighter.racename })
                      }
                      alt={`${name}, down`}
                      fallback={fighterArtFallback()}
                    />
                  </span>
                  <span className="bunit__dust" aria-hidden="true" />
                </>
              ) : rig ? (
                <span className="bunit__rig">
                  <GameImg
                    className="bunit__art bunit__legs"
                    src={
                      nft
                        ? fighterArtFallback()
                        : fighterArt({ classname: fighter.classname, racename: fighter.racename })
                    }
                    alt={name}
                    fallback={fighterArtFallback()}
                  />
                  <span className="bunit__torso">
                    <GameImg
                      className="bunit__art"
                      src={
                        nft
                          ? fighterArtFallback()
                          : fighterArt({ classname: fighter.classname, racename: fighter.racename })
                      }
                      alt=""
                      fallback={fighterArtFallback()}
                    />
                  </span>
                </span>
              ) : dead ? (
                <img
                  className="bunit__art bunit__art--dead"
                  src={asset('/assets/fighter/dead.png')}
                  alt="Defeated"
                />
              ) : (
                <GameImg
                  className="bunit__art"
                  /* The NFT fighter's full body is the game's unknown fighter —
                     the same hooded figure as its portrait, and the art the
                     classic stage has always shown for it mid-fight. */
                  src={
                    nft
                      ? fighterArtFallback()
                      : fighterArt({ classname: fighter.classname, racename: fighter.racename })
                  }
                  alt={name}
                  fallback={fighterArtFallback()}
                />
              )}
              {role === 'defender' && <span className="bunit__flash" />}
            </span>

          </div>
        </div>
        <div
          className={`${unitClass} bunit--over`}
          style={{ ...place, zIndex: 340 + Math.round(pos[1]) } as React.CSSProperties}
          aria-hidden="true"
        >
          <div className="bunit__figure">
            {role === 'defender' && (
              <span className="bunit__ret" key={`ret-${turn}`} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            )}
            {/*
               The blow as the tournament's broadcast throws it: up from the head,
               swelling with how hard it was (`--heft`, the share of half the
               fighter's health it took), held to be read, then dropped. A
               cleave's numbers drift apart by slot rather than stacking. What
               was blocked is in the caption and the log.
            */}
            {hits.map((hit) => {
                /* A blow its element favours, or one that takes a third of the fighter, lands big. */
                const big = hit.effectiveness >= 110 || (maxHealth > 0 && hit.amount >= maxHealth * 0.3)
                const resisted = hit.blocked > 0 && hit.blocked >= hit.amount * 0.3
                return (
                  <span
                    className={
                      'bunit__pop' +
                      (hit.killed ? ' bunit__pop--kill' : big ? ' bunit__pop--big' : resisted ? ' bunit__pop--res' : '')
                    }
                    key={`dmg-${hit.turn}`}
                    style={{ ['--drift' as string]: `${(Number(fighter.uid.split('-')[1]) % 3) - 1 || 0}` }}
                    onAnimationEnd={() => setHits((h) => h.filter((x) => x.turn !== hit.turn))}
                  >
                    {formatScaled(hit.amount)}
                    {hit.killed ? (
                      <small>Knocked out</small>
                    ) : (
                      hit.blocked > 0 && <small>{formatScaled(hit.blocked)} resisted</small>
                    )}
                  </span>
                )
              })}
            {abilityDelta !== 0 && (
              <span
                className={`effectpill effectpill--${abilityDelta > 0 ? 'heal' : 'damage'}`}
                key={`fx-${turn}`}
              >
                {abilityDelta > 0 ? '+' : ''}
                {formatScaled(abilityDelta)}
              </span>
            )}
          </div>

          <span className="hpbar bunit__hp" data-band={band}>
            <span className="hpbar__trail" style={{ scale: `${pct / 100} 1` }} />
            <span className="hpbar__fill" style={{ scale: `${pct / 100} 1` }} />
          </span>

          <div className="bunit__plate">
            {fighter.element && (
              <img
                className="bunit__element"
                src={elementIcon(fighter.element)}
                alt={fighter.element}
              />
            )}
            <span className="bunit__lv">{nft ? 'NFT' : `Lv.${fighter.level}`}</span>
            {!dead && <ThreatMark standing={standing} />}
          </div>
        </div>
      </>
    )
  }

  return (
    <div
      className={unitClass}
      style={
        {
          ...place,
          /* Nearer the bottom is nearer the viewer; the two fighters in the
             blow go over everyone so the dash and the numbers are never
             hidden behind a neighbour. */
          zIndex: role === 'attacker' ? 300 : role === 'defender' ? 250 : Math.round(pos[1]),
        } as React.CSSProperties
      }
      title={title}
    >
      <div className="bunit__figure">
        <span className="bunit__platform" aria-hidden="true" />
        {charge !== undefined && !dead && (
          <svg className="bunit__charge" viewBox="0 0 100 30" aria-hidden="true">
            <ellipse className="bunit__chargetrack" cx="50" cy="15" rx="46" ry="12" pathLength={100} />
            <ellipse
              className="bunit__chargefill"
              cx="50"
              cy="15"
              rx="46"
              ry="12"
              pathLength={100}
              strokeDasharray={`${Math.round(charge * 100)} 100`}
            />
          </svg>
        )}
        {/* On the ground the cards and the rings at the feet say who swings next. */}
        {aiming && !dead && !rig && (
          <span className="bcast__aim bunit__aim" aria-hidden="true">
            <svg viewBox="0 0 24 16">
              <path d="M12 16 1.5 1.5h21z" />
            </svg>
          </span>
        )}
        {/* The Mindblade's afterimages: the same figure, a beat behind it. */}
        {signature === 'cuts' &&
          !dead &&
          [1, 2, 3].map((n) => (
            <span className="bunit__body bunit__ghost" key={`ghost-${turn}-${n}`} aria-hidden="true">
              <img
                className="bunit__art"
                src={fighterArt({ classname: fighter.classname, racename: fighter.racename })}
                alt=""
              />
            </span>
          ))}
        {/* Keyed by the blow, so a fighter that swings twice in a row swings
            twice on screen. */}
        {abilityDelta !== 0 && (
          <span
            className={`effectpill effectpill--${abilityDelta > 0 ? 'heal' : 'damage'}`}
            key={`fx-${turn}`}
          >
            {abilityDelta > 0 ? '+' : ''}
            {formatScaled(abilityDelta)}
          </span>
        )}
        {/* On the ground the number says it. */}
        {killed && role === 'defender' && !rig && (
          <span className="duelist__ko" key={`ko-${turn}`}>
            K.O.
          </span>
        )}
      </div>

      <span className="hpbar bunit__hp" data-band={band}>
        <span className="hpbar__trail" style={{ scale: `${pct / 100} 1` }} />
        <span className="hpbar__fill" style={{ scale: `${pct / 100} 1` }} />
      </span>

      <div className="bunit__plate">
        {fighter.element && (
          <img
            className="bunit__element"
            src={elementIcon(fighter.element)}
            alt={fighter.element}
          />
        )}
        <span className="bunit__lv">{nft ? 'NFT' : `Lv.${fighter.level}`}</span>
        {!dead && <ThreatMark standing={standing} />}
      </div>
    </div>
  )
}



/* ---------- threat and turn order ---------- */

/**
 * The mark on whoever is taking the next blow.
 *
 * A reticle rather than another bar. Three stacked bars under a portrait —
 * health, taunt, wind-up — read as one confusing meter; a game marks its
 * threat target on the target instead, and leaves the number to the tooltip.
 */
function ThreatMark({ standing }: { standing: Standing | undefined }) {
  if (!standing?.drawsFire) return null
  return (
    <span
      className="threat"
      title={`Drawing fire — highest taunt on this team (${formatScaled(standing.taunt)})`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    </span>
  )
}

/**
 * The turn order, read straight from the log.
 *
 * The fight is simulated in full before it is played, so this is not a
 * prediction — it is the sequence, exactly.
 *
 * It reads as a conveyor rather than a list that redraws. The attack that has
 * just finished stays in the strip for a beat and collapses its own width to
 * nothing, which slides everything behind it leftward under a plain CSS
 * transition; new entries fade in at the tail. Nothing measures or positions
 * anything, and the strip never jumps between turns.
 */
function TurnQueue({
  replay,
  step,
  speed,
  playertag,
  enemyOwner = 'The dungeon',
}: {
  replay: Replay
  step: number
  speed: number
  playertag: string
  enemyOwner?: string
}) {
  /*
     The attack that has just been consumed, held for one collapse so the
     strip has something to slide out rather than an item vanishing.
   */
  const [leaving, setLeaving] = useState<QueuedTurn | null>(null)
  const prevStep = useRef(step)

  useEffect(() => {
    const went = prevStep.current
    prevStep.current = step
    /* Only a single forward step slides; a jump or a restart just redraws. */
    if (step !== went + 1 || step < 2) {
      setLeaving(null)
      return
    }
    const done = replay.turns[step - 2]
    if (!done) return
    setLeaving({ uid: done.attackerUid, turn: done.turn, current: false })
    const id = setTimeout(() => setLeaving(null), QUEUE_SLIDE_MS / speed)
    return () => clearTimeout(id)
  }, [step, replay, speed])

  const queue = turnQueue(replay, step)
  if (!queue.length && !leaving) return null

  const byUid = new Map(replay.fighters.map((f) => [f.uid, f]))
  const shown = leaving ? [leaving, ...queue] : queue

  return (
    <div className="turnq" style={{ ['--slide' as string]: `${QUEUE_SLIDE_MS / speed}ms` }}>
      <span className="turnq__label">Turn order</span>
      <ol className="turnq__list">
        {shown.map((q) => {
          const f = byUid.get(q.uid)
          if (!f) return null
          const mine = f.team === 1
          const owner = mine ? f.gamertag || playertag || 'You' : enemyOwner
          const isLeaving = leaving?.turn === q.turn
          return (
            <li
              className={
                `turnq__item turnq__item--${mine ? 'mine' : 'enemy'}` +
                (q.current ? ' turnq__item--now' : '') +
                (isLeaving ? ' turnq__item--out' : '')
              }
              /* Keyed by attack number: entries keep their identity as the
                 strip advances, so only genuinely new ones animate in. */
              key={q.turn}
              /* Same element backdrop as the roster tiles above it. */
              style={{ ['--turnq-bg' as string]: `url('${elementBackground(f.element)}')` }}
              title={`${q.current ? 'Attacking now' : `Attack ${q.turn}`} — ${fighterName(f)} (${owner})`}
            >
              <GameImg
                src={fighterFace(f)}
                alt={fighterName(f)}
                loading="lazy"
                fallback={fighterArtFallback()}
              />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ---------- result ---------- */

/** The five figures the game reports, in its order and with its icons. */
const RESULT_STATS: { title: string; key: string; icon: string }[] = [
  { title: 'Knockouts', key: 'knockouts', icon: 'target' },
  { title: 'Damage dealt', key: 'damage_dealt', icon: 'damage' },
  { title: 'Damage taken', key: 'damage_taken', icon: 'health' },
  { title: 'Damage blocked', key: 'damage_blocked', icon: 'block' },
  { title: 'Survival', key: 'survived', icon: 'survival' },
]

/**
 * The four figures `addhistory` divides by ten before storing. Everything
 * else on a `battlestats` row is a plain count and must not be scaled — the
 * bug this replaces ran knockouts through the display scale and turned every
 * "1" into a "0".
 */
const SCALED_STATS = new Set([
  'damage_dealt',
  'damage_taken',
  'damage_blocked',
  'damage_blocked_by_enemy',
])

/** A pool is claimable at 10,000 banked power, which the game shows as 100%. */
const FULL_POWER = 10_000

/** The power as a percentage, past 100 when more than one claim is banked. */
function poolPercent(power: number): number {
  return power / 100
}

/**
 * The most claims one Mine sends. Each `claimpreward` spends at most a full
 * 100% and keeps the rest, so a pool at 250% has two claims in it; they go
 * in one transaction, up to this many across both pools.
 */
const MAX_CLAIMS = 10

/**
 * What n claims in a row pay, against what one pays. Each takes one percent
 * of what is left in the pool, so they shrink: 1 + 0.99 + 0.99² ...
 */
function claimsFactor(n: number): number {
  return (1 - Math.pow(0.99, n)) / 0.01
}

/**
 * The end of a run — a screen, not a dialog.
 *
 * The mechanic it reports is not obvious and getting it wrong would
 * misinform: **a fight pays nothing directly**. It banks mining power into a
 * pool on the player row, and only once a pool reaches 100% can it be claimed
 * for Trilium or Shards. So the verdict leads, the team is credited
 * individually, and the pools show what this run just added to a total that
 * carries across runs.
 */
function Result({
  replay,
  row,
  onLeave,
  onRetry,
  venue,
  onReplay,
  onDownload,
}: {
  replay: Replay
  row: FightRow
  onLeave: () => void
  onRetry?: () => void
  venue: Venue
  onReplay: () => void
  onDownload: () => void
}) {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [showLog, setShowLog] = useState(false)
  /* The note under the estimate, which a phone keeps behind an i. */
  const [showWhy, setShowWhy] = useState(false)
  /*
     A phone shows the whole result on one screen, one fighter's record at a
     time; wider screens get the honours look with all six records.
  */
  const phone = usePhone()
  /* Which fighter's record a phone has open; the MVP's until one is tapped. */
  const [pickedAt, setPicked] = useState<number | null>(null)
  const [mining, setMining] = useState(false)
  const [mined, setMined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const won = replay.winner === 1
  const mine = replay.fighters.filter((f) => f.team === 1)

  /*
     What the five look like now, which is not what they looked like in the
     fight. The snapshot on the replay is the line-up as it went in; levelling
     is decided by the row on chain, and the fight has just changed it.

     The dungeon and the arena drop `fighters` on their way here, so this is a
     fresh read rather than the cache, and it re-reads itself if the player
     levels one up below.
  */
  const { levels } = useConfig()
  const rosterQuery = useChainQuery(
    `roster:${player.wallet}`,
    () => fetchRoster(player.wallet),
    { deps: ['fighters'] },
  )
  const byId = useMemo(
    () => new Map((rosterQuery.data ?? []).map((f) => [Number(f.fighter_id), f])),
    [rosterQuery.data],
  )

  /*
     What this fight paid, frozen at the first read.

     Held rather than recomputed because levelling a fighter here spends the
     experience the figure is derived from: the difference against the
     snapshot would read as nothing gained the moment the player pressed the
     button, on the screen whose job is to say what the fight was worth.
  */
  /*
     Only a fight that has just happened can be measured this way.

     The difference against the snapshot is this fight's award while the
     snapshot is this fight's opening line-up — and nothing else. A replay
     opened later, or a captured row replayed from the harness, differs from
     the live roster by every fight since, which would be reported as one
     run's XP. The chain drops fight rows after about a minute, so anything
     old enough to fail this is old enough to be a curiosity rather than a
     result.
  */
  const fresh = useMemo(() => {
    const at = Date.parse(`${row.timestamp}Z`)
    return Number.isFinite(at) && Date.now() - at < 10 * 60_000
  }, [row.timestamp])

  const [gained, setGained] = useState<Map<number, number>>(() => new Map())
  useEffect(() => {
    const roster = rosterQuery.data
    if (!roster || !fresh) return
    setGained((prev) => {
      if (prev.size > 0) return prev
      /*
         From what the picker recorded, not from the chain row.

         The row carries `experience` on every fighter and the contract writes
         zero into it, so subtracting it reported each fighter's whole
         lifetime total as one run's earnings — on a defeat, which pays
         nothing at all. Absent for a replay reached by a link, and then
         nothing is claimed.
      */
      const before = recallXpBefore(row.history_id)
      if (!before) return prev
      const next = new Map<number, number>()
      for (const [id, was] of Object.entries(before)) {
        const live = byId.get(Number(id))
        if (!live || !Number.isFinite(was)) continue
        next.set(Number(id), Math.max(0, live.stats.experience - Number(was)))
      }
      return next.size > 0 ? next : prev
    })
  }, [rosterQuery.data, byId, row, fresh])

  /*
     Levelling from here, which is where the player finds out they can. The
     dot and every other screen hear about it through `dirties`.
  */
  const { busy: levelBusy, error: levelError, run } = useAction()
  const doLevelUp = (f: RosterFighter) => {
    const id = Number(f.fighter_id)
    const was = f.stats.level
    return run(
      `level-${f.fighter_id}`,
      () => levelUpFighters(session!, [f.fighter_id], levelUpOf(f, levels).cost),
      `${f.classname} reached level ${was + 1}.`,
      {
        dirties: DIRTIES.levelUpFighters,
        /*
           The fighter's own row is what says this worked, so it is what the
           wait watches.

           Without a `settled`, the wait falls back to the player's figures
           and stops as soon as the credits leave — which they do on whichever
           node answered that read. The roster read that follows can go to
           another node in the pool that is a block behind, and its answer is
           cached for a minute on a screen that re-reads on nothing. The card
           then kept the old level, the old XP and the button, and pressing it
           again sent the same cost at a fighter whose experience the chain had
           already spent: "fighters::levelup - Your fighter does not have
           enough experience".

           Forced, so the read cannot be the cache the drop just emptied, and
           so the answer that ends the wait is the one left behind for the
           screen's own re-read.
        */
        after: () => fetchRoster(player.wallet, true),
        settled: (roster) =>
          (roster.find((r) => Number(r.fighter_id) === id)?.stats.level ?? 0) > was,
      },
    )
  }

  /**
   * Which of the five is staying behind to hold the arena.
   *
   * Winning an arena costs a fighter: `battle.cpp` picks one of the team at
   * random — `getrandomfrompi` over everyone but the NFT fighter — and hands
   * it to `inline_fighterchg`, which stands it in the arena as the new
   * defender. It cannot be fielded again until somebody beats it, and the
   * screen that announced the win said nothing about it at all.
   *
   * Read back from `livearena` rather than re-rolled here. The contract's
   * draw is deterministic but seeded on a fight position this screen does not
   * have, and guessing wrong would be worse than not saying: the arena row is
   * the fact, and the fighter standing in it is the answer.
   *
   * Polled, because the row is written by the same transaction whose result
   * is being displayed and the read can beat it.
   */
  const [defending, setDefending] = useState<number | null>(null)

  useEffect(() => {
    if (!won || venue !== 'arena') return
    let live = true

    const land = landId(player.x, player.y)

    /*
       Compared as numbers on both sides.

       The NFT fighter's id is 99999999999, which is over 2^32, and a node
       serialises those as strings while every real fighter id comes back as a
       number. So `f.fighter_id !== NFT_FIGHTER_ID` was a string against a
       number, which is always true: the one fighter this is meant to skip was
       the one it kept, and since the arena row lists it before the roster
       fighter, the NFT card was what got marked every time.
    */
    const mineIds = new Set(
      replay.fighters
        .filter((f) => f.team === 1 && Number(f.fighter_id) !== NFT_FIGHTER_ID)
        .map((f) => Number(f.fighter_id)),
    )

    void (async () => {
      for (let i = 0; i < DEFENDER_ATTEMPTS && live; i++) {
        await new Promise((r) => setTimeout(r, DEFENDER_INTERVAL_MS))
        const arena = await fetchLiveArena(player.planet, land, true).catch(() => undefined)
        const held = (arena?.fighters ?? [])
          .map((f) => Number(f.fighter_id))
          .find((id) => id !== NFT_FIGHTER_ID && mineIds.has(id))
        if (held !== undefined && live) {
          setDefending(held)
          return
        }
      }
    })()

    return () => {
      live = false
    }
  }, [won, venue, player.planet, player.x, player.y, replay])

  /*
     A win is what earns the Reward Power the pools are mined with.

     The Rewards dot means "you can mine a pool", and it decides that by
     comparing the reward power on the player row against each pool's
     threshold — no request of its own. So the row has to be re-read first:
     firing the check against the copy in state would ask the same question of
     the same numbers the fight has just changed, and get the same answer.

     With the row refreshed, the run that finally crossed the threshold lights
     the dot on the victory screen rather than up to a minute later.
  */
  useEffect(() => {
    if (!won) return
    let cancelled = false
    void (async () => {
      await refreshPlayer({ force: true }).catch(() => {})
      if (!cancelled) refreshChore('rewards')
    })()
    return () => {
      cancelled = true
    }
  }, [won, refreshPlayer])

  /*
     What this win banked, filed for the briefing's "about N more wins".
     Only a replay whose venue is known counts: a row pulled off the chain
     does not say whether it was a dungeon or an arena.
  */
  useEffect(() => {
    if (!won || !row.history_id || !recallVenue(String(row.history_id))) return
    rememberWinPower(String(row.history_id), venue, row.reward_power_added ?? [])
  }, [won, row, venue])

  /* What the chain would have written for the outcome this replay reached. */
  const expectedLog =
    replay.winner === 1
      ? 'Team 1 wins'
      : replay.winner === 2
        ? 'Team 2 wins'
        : 'Draw'

  /*
   * The chain's own tallies, keyed by fighter.
   *
   * `addhistory` merges each fighter's closing battlestats back onto the
   * stored opening record, so the numbers to report are already on the row —
   * with the four damage figures divided by ten and the counts left alone.
   * The replay reproduces them exactly, but the row is the source of truth
   * and costs nothing to read, so it is what gets shown.
   */
  const chainStats = useMemo(() => {
    const m = new Map<number, Battlestats>()
    for (const f of row.team1_fighters) m.set(f.fighter_id, f.battlestats)
    return m
  }, [row])

  const statOf = useCallback(
    (f: SimFighter, key: string): number => {
      const chain = chainStats.get(f.fighter_id)
      if (chain) {
        return Number((chain as unknown as Record<string, number>)[key] ?? 0)
      }
      const raw = Number((f.bs as unknown as Record<string, number>)[key] ?? 0)
      return SCALED_STATS.has(key) ? Math.round(raw / 10) : raw
    },
    [chainStats],
  )

  const survivedOf = useCallback(
    (f: SimFighter): boolean => {
      const chain = chainStats.get(f.fighter_id)
      return chain ? !!chain.survived : !!f.bs.survived
    },
    [chainStats],
  )

  const banked = player.reward_power ?? []
  const added = row.reward_power_added ?? []

  /*
     The pools themselves, so the estimate can be what the contract would
     pay rather than a restatement of the bar above it.

     Which pools those are comes off the fight row — `reward_power_added`
     names `tlmdung`/`shrddung` after a dungeon and `tlmarena`/`shrdarena`
     after an arena — so the venue is already settled and there is nothing to
     infer here.
  */
  const [tlmPools, setTlmPools] = useState<TlmPool[]>([])
  const [shardPools, setShardPools] = useState<ShardPool[]>([])

  useEffect(() => {
    let live = true
    Promise.all([fetchTlmPools(), fetchShardPools()])
      .then(([t, sh]) => {
        if (!live) return
        setTlmPools(t)
        setShardPools(sh)
      })
      /* No pools read means no estimate; the bars still work. */
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const pools = useMemo(
    () =>
      added.map((a) => {
        const power = banked.find((b) => b.pool === a.pool)?.power ?? 0

        /*
           What a claim from this pool pays: one percent of what is in it.

           `pools.cpp` pays `pool_current * min(reward_power, 10000) /
           1000000`, and a claim is only allowed at full power - so the
           figure is always the full-power one, and passing the banked
           power instead scaled it down by however far along the bar
           happened to be. That produced a smaller number every time,
           which read as the reward shrinking rather than as the wait
           being unfinished; the bar beside it is what says how far off
           the claim is.

           `mineEstimate` returns the pool's own raw units, so each
           currency is brought to the figure a player reads: TLM carries
           four decimal places on the wire, shards one.
        */
        const tlm = tlmPools.find((p) => p.pool === a.pool)
        const shard = shardPools.find((p) => p.pool === a.pool)
        const estimate =
          a.type === 'tlm'
            ? tlm
              ? mineEstimate(MAX_MINE_POWER, liveTlmPool(tlm)) / 10_000
              : null
            : shard
              ? mineEstimate(MAX_MINE_POWER, liveShardPool(shard)) / 10
              : null

        return {
          pool: a.pool,
          type: a.type,
          power,
          percent: poolPercent(power),
          addedPercent: a.power / 100,
          estimate,
          ready: power >= FULL_POWER,
        }
      }),
    [added, banked, tlmPools, shardPools],
  )

  const claimable = pools.filter((p) => p.ready)

  /*
     The claims one Mine sends: every full 100% in every pool, taking turns
     between the pools so a cap of ten never leaves one of them out.
  */
  const claims = useMemo(() => {
    const left = new Map(claimable.map((p) => [p.pool, Math.floor(p.power / FULL_POWER)]))
    const out: string[] = []
    while (out.length < MAX_CLAIMS && [...left.values()].some((n) => n > 0)) {
      for (const [pool, n] of left) {
        if (n > 0 && out.length < MAX_CLAIMS) {
          out.push(pool)
          left.set(pool, n - 1)
        }
      }
    }
    return out
  }, [claimable])
  const claimsIn = (pool: string) => claims.filter((c) => c === pool).length
  /* Every full 100% banked, of which one Mine sends at most MAX_CLAIMS. */
  const claimsBanked = claimable.reduce((n, p) => n + Math.floor(p.power / FULL_POWER), 0)
  const claimsLeft = claimsBanked - claims.length

  /*
   * The bars open at the level the pools were at *before* this run and fill
   * to where they are now, so the contribution is something the player
   * watches happen rather than a number they have to find. One frame at the
   * old value, then the transition carries it.
   */
  const [poolsFilled, setPoolsFilled] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setPoolsFilled(true), 220)
    return () => clearTimeout(id)
  }, [])

  /**
   * The best value in each column, so the fighter who earned it can be
   * marked. This is what turns a table of numbers into a read on who carried
   * the run.
   */
  const best = useMemo(() => {
    const out: Record<string, number> = {}
    for (const s of RESULT_STATS) {
      if (s.key === 'survived') continue
      out[s.key] = Math.max(...mine.map((f) => statOf(f, s.key)))
    }
    return out
  }, [mine, statOf])

  /* The receipt, once the ledger has it. */
  const [mineToast, setMineToast] = useState<MineToastState | null>(null)

  const doMine = async () => {
    if (!session || claims.length === 0) return
    setMining(true)
    setError(null)
    /* The toast from the tap on, so the wait for the chain is not silence. */
    setMineToast({
      label: claims.some((p) => /arena/i.test(p)) ? 'Arena Wins' : 'Dungeon Wins',
      times: claims.length,
      rewards: null,
    })
    try {
      await claimPoolRewards(session, claims, row.history_id)
      // The pools contract settles a beat after the transaction; poll the
      // player row so the bars show the drained pools rather than the old
      // full ones.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 800))
        await refreshPlayer({ force: true })
      }
      setMined(true)

      /*
         The Rewards dot means "you can mine a reward pool", and this claim
         has just spent the power that lit it. It re-checks itself off the
         player row every minute, so without this it can sit there for up to
         a minute pointing at a screen with nothing left to do — and the
         player is looking straight at the proof that it is wrong.
      */
      settle(DIRTIES.claimPoolRewards)

      /*
         What it actually paid, from the contract’s record of this very
         claim. The pool moves between the estimate and the transaction, so
         quoting the projection back as the result would be wrong exactly
         when the player cares most.
      */
      const rewards = await readMinedRewards(row.history_id)
      setMineToast((t) => (t ? { ...t, rewards } : t))
    } catch (err) {
      setMineToast(null)
      setError(readableError(err))
    } finally {
      setMining(false)
    }
  }

  /* A fighter's five stats, with the team's best in each column marked. */
  const statsOf = (f: SimFighter, survived: boolean) => (
    <dl className="rescard__stats">
      {RESULT_STATS.map((s) => {
        const isSurvival = s.key === 'survived'
        const raw = isSurvival ? 0 : statOf(f, s.key)
        const value = isSurvival
          ? survived
            ? 'Survived'
            : 'Defeated'
          : raw.toLocaleString(NUM_LOCALE)
        const highlight = isSurvival
          ? survived
          : raw > 0 && raw === best[s.key]
        return (
          <div
            className={
              'rescard__row' +
              (highlight ? ' rescard__row--best' : '') +
              (isSurvival && !survived ? ' rescard__row--down' : '')
            }
            key={s.key}
          >
            <dt>
              <img
                src={asset(`/assets/icons/stats/${s.icon}.svg`)}
                alt=""
              />
              {s.title}
            </dt>
            <dd>{value}</dd>
          </div>
        )
      })}
    </dl>
  )

  /*
     What the fight was worth to this fighter, and what to do about it.

     A dungeon run's whole progression is experience, and it was the one
     thing the result screen did not mention — the player had to go to My
     Fighters to find out whether the run had taken anyone to a level. The
     bar is the live row, the gain is measured against the line-up that went
     in, and the button is only here when there is a level to take.
  */
  const xpOf = (f: SimFighter) => {
    const live = byId.get(Number(f.fighter_id))
    /* An empty slot rather than nothing: the sixth fighter is
       not on the roster, and a card that skipped these rows
       would stand lower than the five beside it. */
    if (!live) return <div className="rescard__xp" />
    const plan = levelUpOf(live, levels)
    const gain = gained.get(Number(f.fighter_id)) ?? 0
    const need = live.stats.required_experience
    return (
      <div className="rescard__xp">
        {/* Full and unlabelled at the cap: a bar measuring
            progress towards a level that does not exist, and a
            gain of experience nothing can spend, would both be
            saying something untrue. */}
        <span className="xpbar" aria-hidden="true">
          <span
            className="xpbar__fill"
            style={{ width: `${plan.atMax ? 100 : plan.xpPercent}%` }}
          />
        </span>
        <span className="xpbar__line">
          {/* The level the bar is filling towards the end of,
              which the numbers beside it never said. */}
          <span className="xpbar__lv">L{live.stats.level}</span>
          <span className="xpbar__count mono">
            {plan.atMax
              ? 'Max level'
              : `${live.stats.experience.toLocaleString(NUM_LOCALE)} / ${need.toLocaleString(NUM_LOCALE)} XP`}
          </span>
          {!plan.atMax && gain > 0 && (
            <span className="xpbar__gain mono">
              +{gain.toLocaleString(NUM_LOCALE)}
            </span>
          )}
        </span>

        {plan.atMax ? (
          <button
            type="button"
            className="btn btn--sm btn--block"
            disabled
            title="This fighter is at the highest level there is."
          >
            Already at max
          </button>
        ) : (
          plan.ready && (
            <button
              type="button"
              className="btn btn--primary btn--sm btn--block"
              disabled={!session || levelBusy !== null}
              onClick={() => void doLevelUp(live)}
              title={`Costs ${plan.cost.credits.toLocaleString(NUM_LOCALE)} credits`}
            >
              {levelBusy === `level-${f.fighter_id}` && (
                <span className="spinner" />
              )}
              Level up
              {/* The price, on the button that charges it, in
                  the same component the roster and the ascension
                  screens price their buttons with — so it turns
                  red here too when the balance will not cover
                  it. Both are drawn; `Cost` renders nothing for
                  a charge of zero. */}
              <Cost
                value={plan.cost.credits}
                icon="credits"
                short={player.activestats.credits}
              />
              <Cost
                value={plan.cost.gems}
                icon="gems"
                short={player.activestats.gems}
              />
            </button>
          )
        )}
      </div>
    )
  }

  /*
     Who carried the run, for the crown: most knockouts, then most damage
     dealt. Nobody when nobody landed anything.
  */
  let mvpIndex = -1
  {
    let ko = 0
    let dealt = 0
    mine.forEach((f, i) => {
      const k = statOf(f, 'knockouts')
      const d = statOf(f, 'damage_dealt')
      if (k > ko || (k === ko && d > dealt)) {
        mvpIndex = i
        ko = k
        dealt = d
      }
    })
  }
  const standing = mine.filter(survivedOf).length
  const pickedIndex = pickedAt ?? Math.max(0, mvpIndex)
  const picked: SimFighter | undefined = mine[pickedIndex]
  const knockouts = mine.reduce((n, f) => n + statOf(f, 'knockouts'), 0)

  /* A pool as its engram; an empty slot keeps the other on its side. */
  const engramOf = (p: (typeof pools)[number] | undefined, short = false) =>
    p ? (
      <Engram type={p.type} percent={p.percent} added={p.addedPercent} filled={poolsFilled} short={short} />
    ) : (
      <span />
    )

  /*
     The parts of the reward dock, which the phone stacks in its pinned dock
     and a wider screen sets between the two engrams.
  */
  const hintEl = (
        claimable.length < pools.length && (
          <p className="minepower__hint">
            Reach at least 100% minepower to mine your reward. Keep fighting to
            increase it — nothing is lost in the meantime.
          </p>
        )
  )
  const estimateEl = (
    <>
          <div className="minepower__estimate">
            {/* What Mine would bring, not something already won. */}
            <span className="minepower__estlabel">You'd mine about</span>
            {pools.map((p) => (
              /* Only what Mine will claim, once anything can be claimed. */
              p.estimate === null || (claims.length > 0 && claimsIn(p.pool) === 0) ? null : (
              <span key={p.pool}>
                <img
                  src={
                    p.type === 'tlm'
                      ? asset('/assets/icons/tlm.svg')
                      : asset('/assets/icons/shards.svg')
                  }
                  alt=""
                  width={17}
                  height={17}
                />
                <span className="sr-only">{p.type === 'tlm' ? 'TLM' : 'Shard'}</span>
                <strong>
                  {(
                    p.estimate * (claimsIn(p.pool) > 1 ? claimsFactor(claimsIn(p.pool)) : 1)
                  ).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </strong>
                {/* How many of the claims are this currency's. */}
                {claimsIn(p.pool) > 1 && (
                  <span className="minepower__claims">×{claimsIn(p.pool)}</span>
                )}
              </span>
              )
            ))}
            <button
              type="button"
              className="minepower__why"
              aria-expanded={showWhy}
              aria-label="How the estimate is decided"
              onClick={() => setShowWhy((v) => !v)}
            >
              i
            </button>
          </div>
    </>
  )
  const mineEl = (
    <>
          <button
            type="button"
            className="btn btn--primary minepower__mine"
            onClick={() => void doMine()}
            disabled={mining || !session || claims.length === 0}
            title={
              claims.length === 0
                ? 'No pool has reached 100% yet'
                : claims.length > 1
                  ? `${claims.length} claims in one transaction, one for every full 100%`
                  : 'Claim the full pool'
            }
          >
            {mining && <span className="spinner" />}
            {mining
              ? 'Mining'
              : claims.length === 0 && mined
                ? 'Mined'
                : 'Mine'}
            {/* More than one claim: say how many the button sends. */}
            {!mining && claims.length > 1 && (
              <span className="minepower__times">×{claims.length}</span>
            )}
          </button>
    </>
  )
  const leftEl = (
        claimsLeft > 0 && (
          <p className="minepower__left">
            Up to {MAX_CLAIMS} claims per Mine · {claimsLeft} more after this one
          </p>
        )
  )
  const doneEl = (
    <>
          {/* Quietly, in the dock: the receipt says what it paid. */}
          {mined && !mining && <p className="minepower__done">Mined successfully</p>}
    </>
  )
  const footEl = (
    <>
          <p className={`minepower__foot${showWhy ? ' minepower__foot--open' : ''}`}>
            {/*
               It is the mining tools equipped on the account that decide
               this, not the cards in the line-up. The old line credited
               crew and weapon cards, which is not what the contract reads.
    
               Both halves link to where they are changed. This is the screen
               where a player finds out their run banked less than they hoped,
               and it named two things they could do about it without saying
               where either was done. Rewards opens on Mining, which is the
               tab the tools are equipped on; the shop link is the same one
               the account screen uses for Legend access.
            */}
            Your equipped <Link to="/rewards">mining tools</Link> and{' '}
            <Link to="/shop?c=account">account status</Link> decide how much
            Reward Power a run banks.
          </p>
    </>
  )

  return (
    <div className={`result${phone ? ' result--pick' : ''}`}>
      <header className="result__bar">
        {/*
          Reading the fight, not exporting it. The CSV is a compatibility
          surface for checking the client against the chain; it was the only
          way to find out why a fight went the way it did, which meant opening
          a spreadsheet. It is still there, inside.
        */}
        <button
          type="button"
          className="btn btn--ghost result__icobtn"
          onClick={() => setShowLog(true)}
          aria-label="Display Combat Log"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
          <span className="result__btnword">Display Combat Log</span>
        </button>
        <button
          type="button"
          className="btn btn--ghost result__icobtn"
          onClick={onReplay}
          aria-label="Watch again"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span className="result__btnword">Watch again</span>
        </button>
        {/*
          Where Back goes depends on how the fight went.

          A win is finished business — the rewards are on this screen and the
          pools have been banked — so it leads out to the map. A loss is not;
          the player almost certainly wants another go, and making them cross
          the map to get back to the same tile is the screen sending them the
          long way round for no reason.
        */}
        <button
          type="button"
          className="btn btn--primary"
          onClick={won || !onRetry ? onLeave : onRetry}
        >
          {won || !onRetry ? 'Back to map' : `Back to the ${venue}`}
        </button>
      </header>

      {phone ? (
      <>
      {/*
        A phone: the whole result on one screen. The six cards in a row,
        the record of whichever one is tapped under them (the MVP's first),
        and the pools as flasks either side of Mine at the foot. A green
        arrow on a card says that fighter has a level waiting.
      */}
      <div className={`phonours phonours--${won ? 'win' : 'loss'}`}>
        <div className="phonours__head">
          <Laurel />
          <div>
            <h2 className="phonours__verdict" aria-label={won ? 'Victory' : 'Defeat'}>
              {won ? 'VICTORY' : 'DEFEAT'}
            </h2>
            <p className="phonours__sub">
              {standing} of {mine.length} standing · {knockouts}{' '}
              {knockouts === 1 ? 'knockout' : 'knockouts'}
            </p>
          </div>
          <Laurel flip />
        </div>

        <div className="phonours__row" role="group" aria-label="Your team">
          {mine.map((f, i) => {
            const survived = survivedOf(f)
            const nft = Number(f.fighter_id) === NFT_FIGHTER_ID
            const live = byId.get(Number(f.fighter_id))
            const plan = live ? levelUpOf(live, levels) : null
            return (
              <ResultCard
                key={f.uid}
                src={
                  f.classname && f.racename
                    ? fighterAvatar({ classname: f.classname, racename: f.racename })
                    : asset('/assets/fighters/unknown_unknown_avatar.webp')
                }
                fallback={asset('/assets/fighters/unknown_unknown_avatar.webp')}
                xp={plan ? (plan.atMax ? 100 : plan.xpPercent) : 0}
                name={f.classname || 'NFT Fighter'}
                level={nft ? 'NFT' : String(live?.stats.level ?? f.level)}
                element={f.element}
                mvp={i === mvpIndex}
                down={!survived}
                ready={!!plan && !plan.atMax && plan.ready}
                selected={i === pickedIndex}
                onSelect={() => setPicked(i)}
              />
            )
          })}
        </div>

        {picked !== undefined && (() => {
          const f = picked
          const survived = survivedOf(f)
          const holds = defending !== null && Number(f.fighter_id) === defending
          return (
            <div className={`honours__record phonours__record${survived ? '' : ' is-down'}`}>
              <div className="honours__recordhead phonours__recordhead">
                <b>{f.classname || 'NFT Fighter'}</b>
                <small>{f.racename || 'unknown'}</small>
                {pickedIndex === mvpIndex && <span className="phonours__mvp">MVP</span>}
                {holds && (
                  <span
                    className="honours__holds"
                    title="This fighter now holds the arena for you, and cannot be fielded again until somebody beats it."
                  >
                    Stays to defend
                  </span>
                )}
                <span className="phonours__no">Service record #{String(pickedIndex + 1).padStart(2, '0')}</span>
              </div>
              {statsOf(f, survived)}
              {xpOf(f)}
            </div>
          )
        })()}

        <ActionBanner error={levelError} />

        {pools.length > 0 && (
          <section className="phonours__dock">
            {engramOf(pools.find((p) => p.type === 'tlm'), true)}
            <div className="phonours__claim">
              {estimateEl}
              {mineEl}
              {leftEl}
              {doneEl}
            </div>
            {engramOf(pools.find((p) => p.type !== 'tlm'), true)}
          </section>
        )}

        {/* One line until the i opens the whole note. */}
        {pools.length > 0 && (
          <div className="phonours__why">
            {showWhy ? (
              <>
                {hintEl}
                {footEl}
              </>
            ) : claimable.length < pools.length ? (
              <p className="minepower__hint">Reach 100% minepower to mine. Tap i for more.</p>
            ) : (
              footEl
            )}
          </div>
        )}
      </div>
      </>
      ) : (
      <>
      {/*
        Wider screens: the verdict between laurels, the team as medallions over
        their service records, and the pools as engrams either side of Mine.
        All three hang on the one centre line.
      */}
      <div className={`honours honours--${won ? 'win' : 'loss'}`}>
        <div className="honours__head">
          <Laurel />
          <div>
            <h2 className="honours__verdict" aria-label={won ? 'Victory' : 'Defeat'}>
              {won ? 'VICTORY' : 'DEFEAT'}
            </h2>
            <p className="honours__sub">
              {standing} of {mine.length} standing · {knockouts}{' '}
              {knockouts === 1 ? 'knockout' : 'knockouts'}
            </p>
          </div>
          <Laurel flip />
        </div>

        <div className="honours__team">
          {mine.map((f, i) => {
            const survived = survivedOf(f)
            const holds = defending !== null && Number(f.fighter_id) === defending
            const nft = Number(f.fighter_id) === NFT_FIGHTER_ID
            const live = byId.get(Number(f.fighter_id))
            const plan = live ? levelUpOf(live, levels) : null
            return (
              <article className="honours__fighter" key={f.uid}>
                <div className="honours__top">
                  <ResultCard
                    src={
                      f.classname && f.racename
                        ? fighterAvatar({ classname: f.classname, racename: f.racename })
                        : asset('/assets/fighters/unknown_unknown_avatar.webp')
                    }
                    fallback={asset('/assets/fighters/unknown_unknown_avatar.webp')}
                    xp={plan ? (plan.atMax ? 100 : plan.xpPercent) : 0}
                    name={f.classname || 'NFT Fighter'}
                    level={nft ? 'NFT' : String(live?.stats.level ?? f.level)}
                    element={f.element}
                    mvp={i === mvpIndex}
                    down={!survived}
                  />
                  {/* Winning an arena costs a fighter; this says which one. */}
                  {holds && (
                    <div
                      className="honours__holds"
                      title="This fighter now holds the arena for you, and cannot be fielded again until somebody beats it."
                    >
                      Stays to defend
                    </div>
                  )}
                </div>
                <div className={`honours__record${survived ? '' : ' is-down'}`}>
                  <div className="honours__recordhead">
                    <span>Service record</span>
                    <span>#{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  {statsOf(f, survived)}
                  {xpOf(f)}
                </div>
              </article>
            )
          })}
        </div>

        <ActionBanner error={levelError} />
      </div>

      {pools.length > 0 && (
        <section className="honours-dock">
          {/* TLM on the left and shards on the right, whichever the row lists first. */}
          {engramOf(pools.find((p) => p.type === 'tlm'))}
          <div className="honours-dock__claim">
            {estimateEl}
            {mineEl}
            {leftEl}
            {doneEl}
            {hintEl}
          </div>
          {engramOf(pools.find((p) => p.type !== 'tlm'))}
          {footEl}
        </section>
      )}
      </>
      )}

      {error && <div className="alert alert--error">{error}</div>}

      {/*
        The replay is recomputed rather than recorded, so it is worth saying
        plainly when it disagrees with what the chain wrote down — a silent
        divergence would be a lie told with animation.

        The two disagreements are not equally serious. A different winner means
        the simulation is wrong. A different number of blows, with the same
        winner, is what a fight fought before the last combat-rules update
        looks like when replayed under the current ones: the outcome stands,
        the path to it no longer matches. Those age out as the contract prunes
        old fights.
      */}
      {!replay.matchesChain && (
        <p className="hint hint--error">
          {replay.chainLog === expectedLog ? (
            <>
              The chain recorded this fight in {replay.chainTurns} blows and
              this replay takes {replay.turns.length}. It was fought before the
              last combat-rules update, so the result stands but the blow-by-blow
              no longer matches.
            </>
          ) : (
            <>
              This replay reached a different outcome than the chain recorded (
              {replay.chainLog}). The chain is authoritative.
            </>
          )}
        </p>
      )}

      {mineToast && (
        <MineToast
          state={mineToast}
          onClose={() => setMineToast(null)}
        />
      )}

      {showLog && (
        <CombatLogSheet
          replay={replay}
          playertag={player.playertag}
          chronicle={fightLook() === 'land'}
          onClose={() => setShowLog(false)}
          onDownload={onDownload}
        />
      )}
    </div>
  )
}
