import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { fetchBattleConfig, fetchFight, fetchFightConfig } from '@/dungeon/queries'
import { recallFight, recallVenue, rememberFight, type Venue } from '@/dungeon/fightStore'
import {
  DEFAULT_CAPS,
  simulate,
  type EffectEvent,
  type FighterSnapshot,
  type Replay,
  type SimFighter,
  type TurnEvent,
} from '@/dungeon/sim'
import { combatLogCsv } from '@/dungeon/combatLog'
import {
  standingAt,
  stateAt,
  turnQueue,
  type QueuedTurn,
  type Standing,
} from '@/dungeon/standing'
import type { Battlestats, FightRow } from '@/dungeon/types'
import { fighterArt, fighterArtFallback, formatScaled } from '@/tavern/fighterStats'
import { claimPoolRewards } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import { NUM_LOCALE } from '@/format'
import { asset } from '@/assets'
import {
  fetchShardPools,
  fetchTlmPools,
  type ShardPool,
  type TlmPool,
} from '@/pools/queries'
import { liveShardPool, liveTlmPool, mineEstimate } from '@/pools/rules'

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

/** Milliseconds per blow at 1×, matching the original's pacing. */
const BASE_TURN_MS = 1500

/**
 * When the swing connects, in milliseconds at 1×.
 *
 * Must stay equal to `--impact` in battle.css: the CSS drives the recoil,
 * the flash and the damage number, and this drives when health, death and
 * wind-up actually change. If the two drift apart, consequences appear
 * before or after the blow that caused them.
 */
const IMPACT_MS = 580

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
 * The embers that drift off a fighter while they are on the clock.
 *
 * Fixed rather than random: a stable set repeats identically every turn,
 * which reads as a steady fire rather than as noise, and costs no work per
 * render. Nine is enough to feel alive and few enough that a phone does not
 * notice — each one is a single compositor-only transform.
 */
const EMBERS = [
  { x: 18, size: 3, drift: 10, rise: 96, delay: 0, life: 2100 },
  { x: 31, size: 2, drift: -8, rise: 78, delay: 420, life: 1850 },
  { x: 44, size: 4, drift: 6, rise: 112, delay: 180, life: 2400 },
  { x: 52, size: 2, drift: -12, rise: 88, delay: 900, life: 1950 },
  { x: 61, size: 3, drift: 9, rise: 104, delay: 620, life: 2250 },
  { x: 72, size: 2, drift: -6, rise: 82, delay: 1180, life: 1800 },
  { x: 26, size: 2, drift: 13, rise: 92, delay: 1450, life: 2050 },
  { x: 83, size: 3, drift: -10, rise: 100, delay: 300, life: 2300 },
  { x: 38, size: 2, drift: 4, rise: 74, delay: 1650, life: 1700 },
] as const

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
  const [tauntDeduction, setTauntDeduction] = useState<number | null>(null)
  const [caps, setCaps] = useState(DEFAULT_CAPS)
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

  useEffect(() => {
    let live = true
    Promise.all([fetchFightConfig(), fetchBattleConfig()])
      .then(([taunt, config]) => {
        if (!live) return
        setTauntDeduction(taunt)
        if (config?.battle_stat_caps) setCaps(config.battle_stat_caps)
      })
      .catch(() => live && setTauntDeduction(0))
    return () => {
      live = false
    }
  }, [])

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
  const total = replay.turns.length

  /** How many blows have landed. 0 is the opening line-up, `total` the end. */
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<Speed>(1)
  const logRef = useRef<HTMLDivElement>(null)

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

  /** The log follows the fight, as the original's does. */
  useEffect(() => {
    const el = logRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [step])

  /** The blow just played, which drives every animation on screen. */
  const current: TurnEvent | null = step > 0 ? replay.turns[step - 1] : null

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

  /**
   * The pair on stage.
   *
   * Before the first blow the opening matchup stands ready, so the stage is
   * never empty and the fight starts on a picture rather than a blank.
   */
  const shown = current ?? replay.turns[0]
  const duel = useMemo(() => {
    if (!shown) return null
    const attacker = replay.fighters.find((f) => f.uid === shown.attackerUid)
    const defender = replay.fighters.find((f) => f.uid === shown.defenderUid)
    if (!attacker || !defender) return null
    // Exactly one comes from each side, so the stage can keep fixed places:
    // the dungeon on the left and the player on the right, matching both the
    // roster strips above and the selection screen before it.
    return {
      theirs: attacker.team === 2 ? attacker : defender,
      mine: attacker.team === 1 ? attacker : defender,
      attackerUid: shown.attackerUid,
      defenderUid: shown.defenderUid,
    }
  }, [replay, shown])

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

  const nameOf = (uid: string) =>
    replay.fighters.find((f) => f.uid === uid)?.classname || 'Unknown'
  const ownerOf = (uid: string) => {
    const f = replay.fighters.find((x) => x.uid === uid)
    if (!f) return 'Unknown'
    return f.team === 1 ? f.gamertag || playertag || 'You' : f.gamertag || 'AI'
  }

  return (
    <div className="battle">
      <img className="battle__art" src={asset("/assets/background/bg-fight.png")} alt="" />
      <div className="battle__scrim" />

      {!finished && (
      <div
        className="battle__inner"
        style={{ ['--beat' as string]: String(1 / speed) }}
      >
        <header className="battle__bar">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onLeave}>
            Back
          </button>

          <div className="battle__progress">
            <span className="battle__turn mono">
              Attack {step}/{total}
            </span>
            <span className="battle__track" aria-hidden="true">
              <span
                className="battle__fill"
                style={{ transform: `scaleX(${total ? step / total : 1})` }}
              />
            </span>
          </div>

          <div className="battle__controls">
            {!finished && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
            )}
            {SPEEDS.map((s) => (
              <button
                type="button"
                key={s}
                className="btn btn--ghost btn--sm"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
            {!finished && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={skip}>
                Skip Fight
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={download}
              disabled={step === 0}
            >
              Combat Log
            </button>
          </div>
        </header>

        {/*
          Rosters above, the clash below.

          Twelve fighters spread across the full width meant the action landed
          somewhere different every turn and the eye never settled. The two
          fighters actually trading blows now step onto a fixed stage in the
          middle of the screen, and the rosters shrink to strips that report
          who is left and how they are holding up. Nothing moves position
          between turns, so there is nothing to hunt for.
        */}
        <div className="stage">
          <div className="rosters">
            <RosterStrip
              label="The dungeon"
              side="enemy"
              fighters={team2}
              state={state}
              activeUids={[duel?.attackerUid, duel?.defenderUid]}
              nextUp={nextUp}
              effects={abilityDelta}
              turn={step}
              standing={standing}
            />
            <RosterStrip
              label="Your team"
              side="mine"
              fighters={team1}
              state={state}
              activeUids={[duel?.attackerUid, duel?.defenderUid]}
              nextUp={nextUp}
              effects={abilityDelta}
              turn={step}
              standing={standing}
            />
          </div>

          <TurnQueue replay={replay} step={step} speed={speed} playertag={playertag} />

          {duel && (
            <div className="duel">
              <Duelist
                key={duel.theirs.uid}
                fighter={duel.theirs}
                state={state.get(duel.theirs.uid)}
                standing={standing.get(duel.theirs.uid)}
                role={
                  !current
                    ? null
                    : duel.attackerUid === duel.theirs.uid
                      ? 'attacker'
                      : 'defender'
                }
                side="enemy"
                turn={step}
                attack={current?.damage ?? 0}
                blocked={current?.blocked ?? 0}
                killed={!!current?.killed}
                abilityDelta={abilityDelta.get(duel.theirs.uid) ?? 0}
                owner={duel.theirs.gamertag || duel.theirs.owner || 'AI'}
              />

              <div className="duel__centre">
                <span className="duel__turn mono">
                  {current ? `Attack ${step}` : 'Ready'}
                </span>
                {current && (
                  <span
                    className={`duel__element duel__element--${current.element}`}
                    key={`el-${step}`}
                  >
                    <img
                      src={asset(`/assets/icons/elements/${current.element}.png`)}
                      alt=""
                      width={22}
                      height={22}
                    />
                    {current.effectiveness}%
                  </span>
                )}
              </div>

              <Duelist
                key={duel.mine.uid}
                fighter={duel.mine}
                state={state.get(duel.mine.uid)}
                standing={standing.get(duel.mine.uid)}
                role={
                  !current
                    ? null
                    : duel.attackerUid === duel.mine.uid
                      ? 'attacker'
                      : 'defender'
                }
                side="mine"
                turn={step}
                attack={current?.damage ?? 0}
                blocked={current?.blocked ?? 0}
                killed={!!current?.killed}
                abilityDelta={abilityDelta.get(duel.mine.uid) ?? 0}
                owner={duel.mine.gamertag || playertag || 'You'}
              />
            </div>
          )}
        </div>

        {/*
          The running log, in the original's wording: one line per blow with
          the abilities that fired underneath. Cumulative and self-scrolling,
          so a player who looks away can catch up.
        */}
        {step > 0 && (
          <div className="combatlog" ref={logRef}>
            {/*
              Abilities that fired before the first blow. The chain snapshots
              the line-ups *before* `prepare_buff` runs, so these are changes
              a player cannot otherwise see anywhere.
            */}
            {replay.openingEffects.length > 0 && (
              <div className="combatlog__entry">
                <p className="combatlog__line">
                  <strong>Before the fight</strong>
                </p>
                {replay.openingEffects.map((e, j) => (
                  <EffectLine key={j} effect={e} nameOf={nameOf} />
                ))}
              </div>
            )}
            {replay.turns.slice(0, step).map((t, i) => (
              <div className="combatlog__entry" key={i}>
                <p className="combatlog__line">
                  <strong>{i + 1}. </strong>
                  <strong>
                    {nameOf(t.attackerUid)} ({ownerOf(t.attackerUid)})
                  </strong>{' '}
                  attacked{' '}
                  <strong>
                    {nameOf(t.defenderUid)} ({ownerOf(t.defenderUid)})
                  </strong>{' '}
                  for <strong>{formatScaled(t.damage)}</strong> damage.
                  {t.killed && <em className="combatlog__ko"> Knocked out.</em>}
                </p>
                {t.effects.map((e, j) => (
                  <EffectLine key={j} effect={e} nameOf={nameOf} />
                ))}
              </div>
            ))}
          </div>
        )}
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

/* ---------- the roster strips ---------- */

const avatarArt = (classname: string, racename: string) =>
  asset(`/assets/fighters/${classname}_${racename}_avatar.webp`)

/**
 * A team, at a glance.
 *
 * Not where the fight is watched — that is the stage below — but where the
 * shape of it is read: who is still standing, who is nearly gone, and who is
 * about to swing. Small enough that both teams fit above the action without
 * competing with it.
 */
function RosterStrip({
  label,
  side,
  fighters,
  state,
  activeUids,
  nextUp,
  effects,
  turn,
  standing,
}: {
  label: string
  side: 'mine' | 'enemy'
  fighters: SimFighter[]
  state: Map<string, FighterSnapshot>
  standing: Map<string, Standing>
  activeUids: (string | undefined)[]
  nextUp: string | null
  /** Net ability change this turn, per fighter. */
  effects: Map<string, number>
  turn: number
}) {
  const alive = fighters.filter(
    (f) => (state.get(f.uid)?.health ?? f.start_health) > 0,
  ).length

  return (
    <section className={`roster roster--${side}`}>
      <header className="roster__head">
        <span className="roster__name">{label}</span>
        <span className="roster__alive mono">
          {alive}/{fighters.length}
        </span>
      </header>

      <div className="roster__row">
        {fighters.map((f) => {
          const hp = state.get(f.uid) ?? {
            health: f.start_health,
            max_health: f.max_health,
          }
          const dead = hp.health <= 0
          const pct = hp.max_health > 0 ? Math.max(0, (hp.health / hp.max_health) * 100) : 0
          const band = pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low'

          return (
            <div
              className={
                'rtile' +
                (dead ? ' rtile--dead' : '') +
                (activeUids.includes(f.uid) ? ' rtile--active' : '') +
                (nextUp === f.uid ? ' rtile--next' : '')
              }
              key={f.uid}
              title={`${f.classname} ${f.racename} — ${formatScaled(hp.health)}/${formatScaled(hp.max_health)}`}
            >
              <img
                className="rtile__art"
                src={avatarArt(f.classname, f.racename)}
                alt={f.classname}
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget
                  if (img.dataset.fallback) return
                  img.dataset.fallback = '1'
                  img.src = fighterArtFallback()
                }}
              />
              <span className="rtile__bar" data-band={band}>
                <span className="rtile__fill" style={{ width: `${pct}%` }} />
              </span>
              {!dead && <ThreatMark standing={standing.get(f.uid)} />}
              {dead && <span className="rtile__out" aria-label="Down" />}
              {/*
                An ability that landed on this fighter.
                Group effects mostly hit fighters who are not on the stage, so
                without this the only sign of them was a line in the log after
                the fact — the thing that made in-fight effects look like they
                were not happening at all.
              */}
              {!dead && (effects.get(f.uid) ?? 0) !== 0 && (
                <span
                  className={
                    'rtile__fx rtile__fx--' +
                    ((effects.get(f.uid) ?? 0) > 0 ? 'heal' : 'harm')
                  }
                  key={`fx-${turn}`}
                >
                  {(effects.get(f.uid) ?? 0) > 0 ? '+' : ''}
                  {formatScaled(effects.get(f.uid) ?? 0)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- the stage ---------- */

/**
 * One of the two fighters on stage.
 *
 * Always in the same place — the dungeon's on the left, the player's on the
 * right — so every blow plays out where the last one did. The role decides
 * what happens to it, not its position.
 */
function Duelist({
  fighter,
  state,
  standing,
  role,
  side,
  turn,
  attack,
  blocked,
  killed,
  abilityDelta,
  owner,
}: {
  fighter: SimFighter
  state: FighterSnapshot | undefined
  standing: Standing | undefined
  role: 'attacker' | 'defender' | null
  side: 'mine' | 'enemy'
  turn: number
  attack: number
  blocked: number
  killed: boolean
  abilityDelta: number
  owner: string
}) {
  const health = state?.health ?? fighter.start_health
  const maxHealth = state?.max_health ?? fighter.max_health
  const dead = health <= 0
  const pct = maxHealth > 0 ? Math.max(0, (health / maxHealth) * 100) : 0
  const band = pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low'

  return (
    <div
      className={
        `duelist duelist--${side}` +
        (role ? ` duelist--${role}` : '') +
        (dead ? ' duelist--dead' : '')
      }
    >
      <div className="duelist__frame">
        {role && (
          <span className={`rolltag rolltag--${role === 'attacker' ? 'atk' : 'def'}`} key={`role-${turn}`}>
            <img
              src={role === 'attacker' ? asset('/assets/icons/swords.svg') : asset('/assets/icons/shield.svg')}
              alt=""
            />
            {role === 'attacker' ? 'Attacks' : 'Hit'}
          </span>
        )}

        <span className="duelist__body">
          {/*
            Order matters: the pool of light, then the contact shadow on top
            of it, then the fighter above both. As a sibling *after* the body
            the shadow painted over the feet instead of under them.
          */}
          <span className="duelist__glow" aria-hidden="true">
            <span className="duelist__pool" />
            {EMBERS.map((e, i) => (
              <span
                className="ember"
                key={i}
                style={
                  {
                    '--x': `${e.x}%`,
                    '--s': `${e.size}px`,
                    '--drift': `${e.drift}px`,
                    '--rise': `${e.rise}px`,
                    '--delay': `${e.delay}ms`,
                    '--life': `${e.life}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
          <span className="duelist__floor" />
          {dead ? (
            <img
              className="duelist__art duelist__art--dead"
              src={asset("/assets/fighter/dead.png")}
              alt="Defeated"
            />
          ) : (
            <img
              className="duelist__art"
              src={fighterArt({
                classname: fighter.classname,
                racename: fighter.racename,
              })}
              alt={`${fighter.classname} ${fighter.racename}`}
              onError={(e) => {
                const img = e.currentTarget
                if (img.dataset.fallback) return
                img.dataset.fallback = '1'
                img.src = fighterArtFallback()
              }}
            />
          )}
          {role === 'defender' && <span className="duelist__flash" key={`fl-${turn}`} />}
        </span>

        {role === 'defender' && attack > 0 && (
          <span
            className={`dmgnum dmgnum--${killed ? 'ko' : band === 'low' ? 'strong' : 'hit'}`}
            key={`dmg-${turn}`}
          >
            {formatScaled(attack)}
          </span>
        )}

        {role === 'defender' && blocked > 0 && (
          <span className="blocknum" key={`blk-${turn}`}>
            −{formatScaled(blocked)} blocked
          </span>
        )}

        {abilityDelta !== 0 && (
          <span
            className={`effectpill effectpill--${abilityDelta > 0 ? 'heal' : 'damage'}`}
            key={`fx-${turn}`}
          >
            {abilityDelta > 0 ? '+' : ''}
            {formatScaled(abilityDelta)}
          </span>
        )}

        {killed && role === 'defender' && (
          <span className="duelist__ko" key={`ko-${turn}`}>
            K.O.
          </span>
        )}
      </div>

      <div className="duelist__plate">
        <div className="duelist__id">
          <span className="duelist__name">{fighter.classname}</span>
          <span className="duelist__owner">{owner}</span>
        </div>

        <span className="hpbar hpbar--big" data-band={band}>
          <span className="hpbar__trail" style={{ width: `${pct}%` }} />
          <span className="hpbar__fill" style={{ width: `${pct}%` }} />
        </span>

        <div className="duelist__nums">
          <span className="duelist__hp mono">
            {formatScaled(health)}
            <em>/{formatScaled(maxHealth)}</em>
          </span>
          {!dead && <ThreatMark standing={standing} />}
        </div>
      </div>
    </div>
  )
}

/* ---------- combat log ---------- */

/** Readable names for the stats an effect can change. */
const STAT_LABEL: Record<string, string> = {
  health: 'health',
  damage: 'damage',
  taunt: 'taunt',
  initiative: 'wind-up',
  attackspeed: 'attack speed',
  res_gem: 'gem resistance',
  res_metal: 'metal resistance',
  res_air: 'air resistance',
  res_fire: 'fire resistance',
  res_nature: 'nature resistance',
  res_neutral: 'neutral resistance',
}

const TRIGGER_LABEL: Record<string, string> = {
  on_attack: 'on attack',
  on_defense: 'on defence',
  on_fight_start: 'at the start',
}

/**
 * One ability effect in the log.
 *
 * Says who cast it as well as who it landed on: group effects mostly hit
 * fighters who are not the two on stage, so without the caster the line reads
 * as having come from nowhere. The direction is coloured rather than left to
 * a minus sign, because a heal and a debuff are the same shape otherwise.
 */
function EffectLine({
  effect,
  nameOf,
}: {
  effect: EffectEvent
  nameOf: (uid: string) => string
}) {
  const delta = effect.after - effect.before
  const stat = STAT_LABEL[effect.stat] ?? effect.stat
  const trigger = TRIGGER_LABEL[effect.trigger] ?? effect.trigger
  const self = effect.sourceUid === effect.targetUid

  return (
    <p className={`combatlog__effect combatlog__effect--${delta > 0 ? 'up' : 'down'}`}>
      <strong>↳ </strong>
      <strong>{nameOf(effect.sourceUid)}</strong>'s{' '}
      <strong>{effect.ability}</strong> ({trigger}){' '}
      {delta > 0 ? 'raised' : 'lowered'}{' '}
      {self ? 'its own' : <><strong>{nameOf(effect.targetUid)}</strong>'s</>} {stat} by{' '}
      <strong>{formatScaled(Math.abs(delta))}</strong>{' '}
      <em>
        ({formatScaled(effect.before)} → {formatScaled(effect.after)})
      </em>
    </p>
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
}: {
  replay: Replay
  step: number
  speed: number
  playertag: string
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
          const owner = mine ? f.gamertag || playertag || 'You' : 'The dungeon'
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
              title={`${q.current ? 'Attacking now' : `Attack ${q.turn}`} — ${f.classname} (${owner})`}
            >
              <img
                src={avatarArt(f.classname, f.racename)}
                alt={f.classname}
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget
                  if (img.dataset.fallback) return
                  img.dataset.fallback = '1'
                  img.src = fighterArtFallback()
                }}
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

function poolPercent(power: number): number {
  return power >= FULL_POWER ? 100 : power / 100
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

  const [mining, setMining] = useState(false)
  const [mined, setMined] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const won = replay.winner === 1
  const mine = replay.fighters.filter((f) => f.team === 1)

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
           `mineEstimate` returns the pool's own raw units, so each currency
           is brought to the figure a player reads: TLM carries four decimal
           places on the wire, shards one.
        */
        const tlm = tlmPools.find((p) => p.pool === a.pool)
        const shard = shardPools.find((p) => p.pool === a.pool)
        const estimate =
          a.type === 'tlm'
            ? tlm
              ? mineEstimate(power, liveTlmPool(tlm)) / 10_000
              : null
            : shard
              ? mineEstimate(power, liveShardPool(shard)) / 10
              : null

        return {
          pool: a.pool,
          type: a.type,
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

  const doMine = async () => {
    if (!session || claimable.length === 0) return
    setMining(true)
    setError(null)
    try {
      await claimPoolRewards(
        session,
        claimable.map((p) => p.pool),
        row.history_id,
      )
      // The pools contract settles a beat after the transaction; poll the
      // player row so the bars show the drained pools rather than the old
      // full ones.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 800))
        await refreshPlayer({ force: true })
      }
      setMined(true)
      setNotice('Mined. The pools have been paid out and reset.')
    } catch (err) {
      setError(readableError(err))
    } finally {
      setMining(false)
    }
  }

  return (
    <div className="result">
      <header className="result__bar">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onDownload}>
          Download Combat Log
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onReplay}>
          Watch again
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
          className="btn btn--primary btn--sm"
          onClick={won || !onRetry ? onLeave : onRetry}
        >
          {won || !onRetry ? 'Back to map' : `Back to the ${venue}`}
        </button>
      </header>

      {/*
        The verdict sits behind the team rather than above it, so the fighters
        break the letters and the two read as one image instead of a banner
        with a list underneath.
      */}
      <div className="result__stage">
        <h2
          className={`result__verdict${won ? ' result__verdict--win' : ''}`}
          aria-label={won ? 'Victory' : 'Defeat'}
        >
          {won ? 'VICTORY' : 'DEFEAT'}
        </h2>

        <div className="resultgrid">
          {/*
            The art floats free and only the plate is slanted.

            Counter-skewing a card this tall displaced its bottom rows
            sideways by roughly a twelfth of its width, which pushed the
            right-aligned figures past the clip edge and lost them entirely.
            The plate on its own is short enough for the same construction to
            be safe, and art standing on nothing is also what lets the verdict
            run between the fighters.
          */}
          {mine.map((f) => {
            const survived = survivedOf(f)
            return (
              <article className="rescard" key={f.uid}>
                <div className="rescard__art">
                  <img
                    src={
                      survived
                        ? fighterArt({
                            classname: f.classname,
                            racename: f.racename,
                          })
                        : asset('/assets/fighter/dead.png')
                    }
                    alt=""
                    onError={(e) => {
                      const img = e.currentTarget
                      if (img.dataset.fallback) return
                      img.dataset.fallback = '1'
                      img.src = fighterArtFallback()
                    }}
                  />
                </div>

                <div className="rescard__plate">
                  <div className="rescard__plateInner">
                    <div className="rescard__race">{f.racename || 'unknown'}</div>
                    <div className="rescard__class">
                      {f.classname || 'NFT Fighter'}
                    </div>

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
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {/*
        What the run actually paid. Nothing lands in the wallet here: each
        pool fills toward 100% across many runs, and only a full one can be
        mined — so both the standing total and this run's contribution have to
        be on screen or the reward reads as nothing happening.
      */}
      {pools.length > 0 && (
        <section className="minepower">
          {pools.map((p) => (
            <div className="minebar" key={p.pool}>
              <span className="minebar__track">
                <span
                  className={`minebar__fill minebar__fill--${p.type}`}
                  style={{
                    width: `${poolsFilled ? p.percent : Math.max(0, p.percent - p.addedPercent)}%`,
                  }}
                />
              </span>
              <span className="minebar__label">
                {p.percent.toLocaleString('en-US', { maximumFractionDigits: 2 })}%{' '}
                {p.type === 'tlm' ? 'TLM' : 'Shard'} minepower
              </span>
              <span className="minebar__gain">
                +{p.addedPercent.toLocaleString('en-US', { maximumFractionDigits: 2 })}%
              </span>
            </div>
          ))}

          {claimable.length < pools.length && (
            <p className="minepower__hint">
              Reach at least 100% minepower to mine your reward. Keep fighting to
              increase it — nothing is lost in the meantime.
            </p>
          )}

          <div className="minepower__estimate">
            {pools.map((p) => (
              p.estimate === null ? null : (
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
                Estimated {p.type === 'tlm' ? 'TLM' : 'Shard'} reward:{' '}
                <strong>
                  {p.estimate.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </strong>
              </span>
              )
            ))}
          </div>

          <button
            type="button"
            className="btn btn--primary minepower__mine"
            onClick={() => void doMine()}
            disabled={mining || mined || !session || claimable.length === 0}
            title={
              claimable.length === 0
                ? 'No pool has reached 100% yet'
                : 'Claim the full pools'
            }
          >
            {mining && <span className="spinner" />}
            {mined ? 'Mined' : mining ? 'Mining' : 'Mine'}
          </button>

          <p className="minepower__foot">
            Better crew and weapon cards raise the minepower a run banks.
          </p>
        </section>
      )}

      {notice && <div className="alert alert--ok">{notice}</div>}
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
    </div>
  )
}
