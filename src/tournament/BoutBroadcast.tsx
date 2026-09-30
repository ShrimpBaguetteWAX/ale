import { useEffect, useMemo, useState } from 'react'
import { useChainQuery } from '@/chain/useChainQuery'
import { useConfig, useLazyConfig } from '@/state/useConfig'
import { fetchFightersByIds } from '@/tournament/queries'
import { simulateBout, type BoutSide } from '@/tournament/bout'
import { combineNftFlat } from '@/dungeon/nftFighter'
import { stateAt } from '@/dungeon/standing'
import { fighterArt, fighterArtFallback } from '@/tavern/fighterStats'
import { GameImg } from '@/components/GameImg'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { asset } from '@/assets'
import { formatScaled } from '@/tavern/fighterStats'
import type { Replay, SimFighter, TurnEvent } from '@/dungeon/sim'
import type { Weather } from '@/fight/weather'
import type { TournamentMatchup } from '@/tournament/types'

/**
 * A turn, in two parts.
 *
 * A fight of forty blows played at one beat each is a flicker — you cannot
 * see who swung, only that the bars moved. So every turn is announced
 * before it lands: the fighter about to strike is marked and held for
 * `AIM`, the blow itself lands and is held for `STRIKE`, and then the next
 * fighter is picked out. One and a half seconds a turn, and the watching
 * happens in the second before anything moves.
 */
const AIM = 1000
const STRIKE = 500
/** What the progress bar crosses in one turn. */
const BEAT = AIM + STRIKE
/** The pause after the last blow, so it lands before the floor clears. */
const CURTAIN = 620

/**
 * A pairing, watched.
 *
 * The contract records who drew whom, the ids they brought and a seed, and
 * nothing at all about what happened — so there is no footage to stream and
 * nothing to download. `simulateBout` runs the fight instead, and the seed
 * makes everyone who presses play watch the same one. What this screen adds
 * is the watching: a poster while it is still ahead of you, twelve fighters
 * on the floor while it runs, and the winning side stood up at the end.
 *
 * It is a model of the bout rather than a replay — see `simulateBout`, and
 * mind the LIVE badge, which is a costume until the chain can fight one.
 *
 * Nothing is read until play is pressed. A board of sixteen bouts would
 * otherwise be a hundred and sixty keyed reads for fights nobody asked to
 * see.
 */
export function BoutBroadcast({
  m,
  round,
  bout,
  weather,
  mineWallet,
}: {
  m: TournamentMatchup
  round: number
  bout: number
  /**
   * Every roll of the round.
   *
   * A tournament rolls one per planet and all of them apply, to both sides
   * alike — so this is the list, not a pick from it.
   */
  weather: Weather[]
  mineWallet: string | null
}) {
  const [asked, setAsked] = useState(false)
  const [phase, setPhase] = useState<'poster' | 'wipe' | 'live' | 'done'>('poster')
  const [step, setStep] = useState(0)
  /* True while the next striker is marked and nothing has landed yet. */
  const [aiming, setAiming] = useState(true)
  const [paused, setPaused] = useState(false)

  const { caps, levelMod, ageDecay, nftValues } = useConfig()
  const fightCost = useLazyConfig('fightCost')

  const ids = `${m.fighter_ids_player1.join(',')}|${m.fighter_ids_player2.join(',')}`
  const crews = useChainQuery(
    `tournament-bout:${m.matchup_seed}:${ids}`,
    async () => {
      const [one, two] = await Promise.all([
        fetchFightersByIds(m.fighter_ids_player1),
        fetchFightersByIds(m.fighter_ids_player2),
      ])
      return { one, two }
    },
    { deps: ['fighters'], enabled: asked },
  )

  /*
     The sixth, from the templates on the row.

     `combineNftFlat` wants the two card values; the matchup carries the
     templates they are keyed by, so no lookup on chain is needed and a card
     sold since the draw cannot take the fighter with it.
  */
  const sixth = (crew: number, arms: number) =>
    combineNftFlat(nftValues.get(crew) ?? null, nftValues.get(arms) ?? null)

  const replay = useMemo<Replay | null>(() => {
    if (!crews.data || fightCost === undefined) return null
    const a: BoutSide = {
      fighters: crews.data.one,
      nft: sixth(m.crew_template_id_player1, m.arms_template_id_player1),
    }
    const b: BoutSide = {
      fighters: crews.data.two,
      nft: sixth(m.crew_template_id_player2, m.arms_template_id_player2),
    }
    return simulateBout(
      Number(m.matchup_seed ?? 0),
      a,
      b,
      { weather, caps, levelMod, ageDecay },
      fightCost,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crews.data, fightCost, weather, caps, levelMod, ageDecay, m])

  /* Once the fight exists, the wipe gives way to the floor. */
  useEffect(() => {
    if (phase !== 'wipe' || !replay) return
    const at = window.setTimeout(() => setPhase('live'), 600)
    return () => window.clearTimeout(at)
  }, [phase, replay])

  /*
     The beat, in its two halves.

     Aiming holds on the fighter about to swing; the timeout that ends it
     is the blow landing. Striking holds on what it did, and the timeout
     that ends it picks out the next one. Stops itself at the last blow and
     hands over to the curtain.
  */
  useEffect(() => {
    if (phase !== 'live' || paused || !replay) return

    if (step >= replay.turns.length) {
      const at = window.setTimeout(() => setPhase('done'), CURTAIN)
      return () => window.clearTimeout(at)
    }

    if (aiming) {
      const at = window.setTimeout(() => {
        setStep((s) => s + 1)
        setAiming(false)
      }, AIM)
      return () => window.clearTimeout(at)
    }

    const at = window.setTimeout(() => setAiming(true), STRIKE)
    return () => window.clearTimeout(at)
  }, [phase, paused, step, aiming, replay])

  const play = () => {
    setAsked(true)
    setStep(0)
    setAiming(true)
    setPaused(false)
    setPhase('wipe')
  }

  const again = () => {
    setStep(0)
    setAiming(true)
    setPaused(false)
    setPhase('live')
  }

  /* Scrubbing lands between turns: the blows up to here have happened, and
     the next one is being wound up. */
  const seek = (to: number) => {
    setStep(to)
    setAiming(true)
  }

  const tagA = m.gamertag_player1 || 'Unnamed'
  const tagB = m.gamertag_player2 || 'Unnamed'

  return (
    <section
      className={
        'bcast' +
        (phase === 'wipe' ? ' bcast--wiping' : '') +
        (phase === 'live' || phase === 'done' ? ' bcast--live' : '') +
        (phase === 'done' ? ' bcast--done' : '')
      }
    >
      <div className="bcast__bg" />
      <div className="bcast__vig" />

      <Poster
        round={round}
        bout={bout}
        a={tagA}
        b={tagB}
        waiting={asked && !replay && !crews.error}
        error={crews.error}
        onPlay={play}
      />

      {replay && (
        <Feed
          replay={replay}
          step={step}
          round={round}
          bout={bout}
          a={tagA}
          b={tagB}
          avatarA={m.avatar_player1}
          avatarB={m.avatar_player2}
          mine={
            mineWallet === m.wallet_player1 ? 1 : mineWallet === m.wallet_player2 ? 2 : null
          }
          aiming={aiming}
          paused={paused}
          onPause={() => setPaused((p) => !p)}
          onSeek={seek}
        />
      )}

      {replay && phase === 'done' && (
        <Result replay={replay} a={tagA} b={tagB} onAgain={again} />
      )}

      <span className="bcast__wipe" />
    </section>
  )
}

/** The bout as it is sold, before anybody has pressed anything. */
function Poster({
  round,
  bout,
  a,
  b,
  waiting,
  error,
  onPlay,
}: {
  round: number
  bout: number
  a: string
  b: string
  waiting: boolean
  error: string | null
  onPlay: () => void
}) {
  return (
    <div className="bcast__poster">
      <span className="bcast__kick">
        ROUND {round + 1} · FIGHT {bout + 1}
      </span>
      <span className="bcast__name">{a.toUpperCase()}</span>
      <span className="bcast__vs">VERSUS</span>
      <span className="bcast__name">{b.toUpperCase()}</span>

      {error ? (
        <p className="hint hint--error">{error}</p>
      ) : (
        <button
          type="button"
          className="bcast__play"
          onClick={onPlay}
          disabled={waiting}
          aria-label="Watch this bout"
        >
          {waiting ? (
            <span className="spinner" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}

/** The floor: twelve fighters, and none of them leave it. */
export function Feed({
  replay,
  step,
  round,
  bout,
  a,
  b,
  avatarA,
  avatarB,
  mine,
  aiming,
  paused,
  onPause,
  onSeek,
}: {
  replay: Replay
  step: number
  round: number
  bout: number
  a: string
  b: string
  avatarA: number
  avatarB: number
  mine: 1 | 2 | null
  /** Marking the next striker, with nothing landed yet. */
  aiming: boolean
  paused: boolean
  onPause: () => void
  onSeek: (step: number) => void
}) {
  const health = useMemo(() => {
    const map = new Map<string, { health: number; max: number }>()
    for (const s of stateAt(replay, step)) {
      map.set(s.uid, { health: s.health, max: s.max_health })
    }
    return map
  }, [replay, step])

  const one = replay.fighters.filter((f) => f.team === 1)
  const two = replay.fighters.filter((f) => f.team === 2)
  /*
     Two turns matter at once: the one that just landed, and the one being
     wound up. Only ever one of them is showing — while a fighter is being
     marked, the last blow's numbers are already gone.
  */
  const last = step > 0 ? replay.turns[Math.min(step, replay.turns.length) - 1] : null
  /* Only while the blow is actually landing: the lunge, the flinch, the
     element on the medallion. */
  const struck = aiming ? null : last
  const winding = aiming ? (replay.turns[step] ?? null) : null
  const turn = struck

  /*
     Everything the turn took off, by fighter.

     A blow lands on one fighter, but a cleave lands on several — the
     simulator records those as health effects on the same turn, one per
     target. Drawing only `defenderUid` showed a single number for a swing
     that had just hit four people, and the three bars that dropped had
     nothing over them to say why.
  */
  const hits = useMemo(() => {
    const map = new Map<string, number>()
    if (!last) return map
    if (last.damage > 0) map.set(last.defenderUid, last.damage)
    for (const e of last.effects) {
      if (e.stat !== 'health' && e.stat !== 'health_atk') continue
      const lost = e.before - e.after
      if (lost > 0) map.set(e.targetUid, (map.get(e.targetUid) ?? 0) + lost)
    }
    return map
  }, [last])

  const share = (side: SimFighter[]) => {
    const total = side.reduce((sum, f) => sum + (health.get(f.uid)?.max ?? 0), 0)
    const left = side.reduce((sum, f) => sum + (health.get(f.uid)?.health ?? 0), 0)
    return total > 0 ? (left / total) * 100 : 0
  }

  return (
    <div className="bcast__feed">
      <div className="bcast__score">
        <span className={`bcast__side${mine === 1 ? ' bcast__side--me' : ''}`}>
          <PlayerAvatar id={avatarA} name={a} className="bcast__face" size={30} />
          <span className="bcast__who">
            <span className="bcast__tag">{a}</span>
            <span className="hp">
              <i style={{ width: `${share(one)}%` }} />
            </span>
          </span>
        </span>

        <span className="bcast__mid">
          <span className="bcast__livetag">LIVE</span>
          <span className="bcast__bout">
            ROUND {round + 1} · FIGHT {bout + 1}
          </span>

        </span>

        <span className={`bcast__side bcast__side--b${mine === 2 ? ' bcast__side--me' : ''}`}>
          <PlayerAvatar id={avatarB} name={b} className="bcast__face" size={30} />
          <span className="bcast__who">
            <span className="bcast__tag">{b}</span>
            <span className="hp hp--b">
              <i style={{ width: `${share(two)}%` }} />
            </span>
          </span>
        </span>
      </div>

      <div className="bcast__arena">
        <Line
          side="a"
          fighters={one}
          health={health}
          turn={turn}
          hits={hits}
          beat={last?.turn ?? 0}
          winding={winding}
          live={!aiming}
        />
        <span className="bcast__clash">
          <span className="bcast__medal">VS</span>
          {turn && (
            <img
              className="bcast__el"
              src={asset(`/assets/icons/elements/${turn.element}.png`)}
              alt={turn.element}
            />
          )}
        </span>
        <Line
          side="b"
          fighters={two}
          health={health}
          turn={turn}
          hits={hits}
          beat={last?.turn ?? 0}
          winding={winding}
          live={!aiming}
        />
      </div>

      <div className="bcast__deck">
        <button type="button" className="bcast__deckbtn" onClick={onPause} aria-label={paused ? 'Play' : 'Pause'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {paused ? <path d="M8 5v14l11-7z" /> : <path d="M6 5h4v14H6zM14 5h4v14h-4z" />}
          </svg>
        </button>
        {/*
          One bar, and nothing else on it.

          It carried the turn count and the blow-by-blow, which made a
          transport into a scoreboard — and both were already being said
          better by the fight itself: the numbers rise off the fighters and
          the bars drop under them. What is left is the one thing a player
          reaches for, and it glides rather than ticking: the fill is a
          plain element with a linear transition as long as a turn, so it
          crosses the gap between blows instead of jumping at each one.
        */}
        <span className="bcast__bar">
          <i
            className="bcast__fill"
            /* The glide lasts exactly one turn, so the bar and the fight
               cannot drift apart when the pacing is tuned. */
            style={{
              width: `${(Math.min(step, replay.turns.length) / (replay.turns.length || 1)) * 100}%`,
              transitionDuration: `${BEAT}ms`,
            }}
          />
          <input
            className="bcast__seek"
            type="range"
            min={0}
            max={replay.turns.length}
            value={Math.min(step, replay.turns.length)}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Turn"
          />
        </span>
      </div>
    </div>
  )
}

/** One team, standing in a wedge that recedes away from the clash. */
function Line({
  side,
  fighters,
  health,
  turn,
  hits,
  beat,
  winding,
  live,
}: {
  side: 'a' | 'b'
  fighters: SimFighter[]
  health: Map<string, { health: number; max: number }>
  turn: TurnEvent | null
  /** What this turn took off each fighter — the blow and any cleave. */
  hits: Map<string, number>
  /** Which turn those numbers belong to, for the animation's identity. */
  beat: number
  /** The turn being wound up, while nothing has landed. */
  winding: TurnEvent | null
  /** True only in the moment of the blow, when bodies move. */
  live: boolean
}) {
  return (
    <div className={`bcast__line bcast__line--${side}`}>
      {fighters.map((f, i) => {
        const hp = health.get(f.uid)
        const pct = hp && hp.max > 0 ? Math.max(0, (hp.health / hp.max) * 100) : 0
        const down = !hp || hp.health <= 0
        const took = hits.get(f.uid) ?? 0
        /*
           How hard the blow was, 0 to 1.

           Measured against the fighter it landed on rather than against
           the other numbers on screen: 400 off a heavy is a scratch and
           400 off a glass cannon is most of them, and it is the second one
           that should land like a truck. Half a fighter's health is the
           top of the scale — a single blow rarely reaches it, which is
           what makes the ones that do worth looking at.
        */
        const heft = hp && hp.max > 0 ? Math.min(1, took / (hp.max * 0.5)) : 0
        /* Nearest the middle is nearest the camera. */
        const depth = side === 'a' ? fighters.length - 1 - i : i

        return (
          <span
            key={f.uid}
            className={
              'bcast__stand' +
              (down ? ' bcast__stand--down' : '') +
              (turn?.attackerUid === f.uid ? ' bcast__stand--atk' : '') +
              (winding?.attackerUid === f.uid ? ' bcast__stand--aim' : '') +
              (live && took > 0 ? ' bcast__stand--def' : '')
            }
            style={{ ['--d' as string]: depth }}
            title={`${f.classname} ${f.racename}`}
          >
            <span className="bcast__body">
              <span className="bcast__pool" />
              {/* Called up, a beat before the blow. */}
              {winding?.attackerUid === f.uid && (
                <span className="bcast__aim" aria-hidden="true">
                  <svg viewBox="0 0 24 16">
                    <path d="M12 16 1.5 1.5h21z" />
                  </svg>
                </span>
              )}
              <GameImg
                className="bcast__art"
                src={fighterArt({ classname: f.classname, racename: f.racename })}
                fallback={fighterArtFallback()}
                alt=""
                loading="lazy"
              />
              {took > 0 && (
                /*
                  Keyed on the turn the number belongs to, not on the turn
                  being struck — those stop being the same thing the moment
                  the blow is over, and keying on the wrong one remounted
                  the span half a second in and played the whole rise a
                  second time.

                  The drift alternates by slot so a cleave's six numbers
                  climb in a loose scatter rather than a column.
                */
                <span
                  className="bcast__hit"
                  key={beat}
                  style={{
                    ['--drift' as string]: `${(i % 3) - 1}`,
                    ['--heft' as string]: heft.toFixed(2),
                  }}
                >
                  −{formatScaled(took)}
                </span>
              )}
            </span>
            <span className="bcast__plate">
              <span className="bcast__standname">{f.classname}</span>
              <span className={`hp${side === 'b' ? ' hp--b' : ''}`}>
                <i style={{ width: `${pct}%` }} />
              </span>
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** The winning side, whole, on a floor the fight has been cleared off. */
function Result({
  replay,
  a,
  b,
  onAgain,
}: {
  replay: Replay
  a: string
  b: string
  onAgain: () => void
}) {
  const won = replay.winner
  const team = replay.fighters.filter((f) => f.team === (won === 2 ? 2 : 1))
  const closing = stateAt(replay, replay.turns.length)
  const standing = team.filter(
    (f) => (closing.find((s) => s.uid === f.uid)?.health ?? 0) > 0,
  ).length

  const mid = (team.length - 1) / 2

  return (
    <div className="bcast__result">
      <span className="bcast__podium" aria-hidden="true">
        <span className="bcast__shaft" />
        {team.map((f, i) => {
          const d = Math.abs(i - mid)
          return (
            <GameImg
              key={f.uid}
              className="bcast__pod"
              style={{
                animationDelay: `${Math.round((mid - d) * 110)}ms`,
                height: `${86 - d * 6}%`,
                zIndex: 10 - Math.round(d * 2),
              }}
              src={fighterArt({ classname: f.classname, racename: f.racename })}
              fallback={fighterArtFallback()}
              alt=""
            />
          )
        })}
        <span className="bcast__podfloor" />
      </span>

      <div className="bcast__panel">
        <span className="bcast__kick">{won === null ? 'DRAW' : 'WINNER'}</span>
        <span className="bcast__win">{won === null ? 'Nobody' : won === 1 ? a : b}</span>
        <span className="bcast__margin">
          {won === null
            ? 'Neither side could finish it'
            : `with ${standing} of ${team.length} still standing`}
        </span>
      </div>

      <button type="button" className="bcast__again" onClick={onAgain}>
        Watch again
      </button>
    </div>
  )
}

