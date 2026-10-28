import { useEffect, useRef, useState } from 'react'
import type { FighterSnapshot, SimFighter, TurnEvent } from '@/dungeon/sim'
import { NFT_FIGHTER_ID } from '@/dungeon/rules'
import { GameImg } from '@/components/GameImg'
import { elementIcon, fighterArtFallback, fighterFace, fighterName, formatScaled } from '@/tavern/fighterStats'

/* Each element's own colour, for the rim inside a card's frame. */
const ELEMENT_RIM: Record<string, string> = {
  metal: '#d9e4ff',
  air: '#9fe6ff',
  nature: '#7dffb0',
  gem: '#c8b4ff',
  fire: '#ffb070',
  neutral: '#dfe3ee',
}

/** A fighter is low once a quarter of its health or less is left. */
const LOW_SHARE = 0.25

/**
 * How long, at 1×, the health bar takes to finish falling after a blow: the
 * trail's delay and its run (`.gcard__trail` in landstage.css, 380 + 700 ms).
 * A card is only stamped knocked out once its bar has reached nothing.
 */
const KO_AFTER_MS = 1080

/**
 * Every fighter in the fight as a gilded card, under the picture: yours on
 * the left, theirs on the right.
 *
 * A card says what the field shows, so the eye does not have to find it in
 * the crowd: who is swinging (gold, lifted, a light running over it), who is
 * being hit (a TARGET ribbon and brackets), who is low, who is down (the card
 * itself falls: tipped over, dropped below the row, its frame greyed, a DOWN
 * plate where the health was), and who swings next. Health drops at the blow's
 * impact like the bars over the heads, its trail flashing white and then
 * following. The charge strip is how close the fighter is to its next blow.
 */
export function GildedCards({
  team1,
  team2,
  state,
  current,
  nextUp,
  charge,
  tall,
  beat,
}: {
  team1: SimFighter[]
  team2: SimFighter[]
  state: Map<string, FighterSnapshot>
  current: TurnEvent | null
  nextUp: string | null
  /** 0–1 per fighter: see `chargeOf` in Battle.tsx. */
  charge: Map<string, number>
  /** A phone: two rows of six rather than one of twelve. */
  tall: boolean
  /** One over the playback speed, the field's --beat: the bar's timings scale with it. */
  beat: number
}) {
  const card = (f: SimFighter) => (
    <GildedCard
      key={f.uid}
      fighter={f}
      snap={state.get(f.uid)}
      acting={current?.attackerUid === f.uid}
      targeted={current?.defenderUid === f.uid}
      next={nextUp === f.uid}
      charge={charge.get(f.uid) ?? 0}
      felled={current?.defenderUid === f.uid && !!current?.killed}
      beat={beat}
    />
  )
  return (
    <div className={`gcards${tall ? ' gcards--tall' : ''}`}>
      <ol className="gcards__team gcards__team--mine" aria-label="Your team">
        {team1.map(card)}
      </ol>
      <ol className="gcards__team gcards__team--enemy" aria-label="The other side">
        {team2.map(card)}
      </ol>
    </div>
  )
}

function GildedCard({
  fighter,
  snap,
  acting,
  targeted,
  next,
  charge,
  felled,
  beat,
}: {
  fighter: SimFighter
  snap: FighterSnapshot | undefined
  acting: boolean
  targeted: boolean
  next: boolean
  charge: number
  /** This blow is the one that knocks the fighter out. */
  felled: boolean
  beat: number
}) {
  const health = snap?.health ?? fighter.start_health
  const maxHealth = snap?.max_health ?? fighter.max_health
  const share = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0
  const down = health <= 0
  const nft = Number(fighter.fighter_id) === NFT_FIGHTER_ID

  /*
     Knocked out only once the bar has emptied: the killing blow drains it
     first, and the card turns to iron after. A fighter already down when
     the card appears (a seek, a skip), or a screen that has motion turned
     down, is stamped at once.
  */
  const [stamped, setStamped] = useState(down)
  /* Stamped without the fall: a skip, a seek, or motion turned down. */
  const [settled, setSettled] = useState(down)
  useEffect(() => {
    if (!down) {
      setStamped(false)
      setSettled(false)
      return
    }
    const still =
      document.documentElement.dataset.fx === 'low' ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    if (!felled || still) {
      setStamped(true)
      setSettled(true)
      return
    }
    const id = setTimeout(() => setStamped(true), KO_AFTER_MS * beat)
    return () => clearTimeout(id)
  }, [down, felled, beat])
  const ko = down && stamped

  /* A flash on the trail each time the health falls, keyed so it replays. */
  const [hurt, setHurt] = useState(0)
  const was = useRef(share)
  useEffect(() => {
    if (share < was.current) setHurt((n) => n + 1)
    was.current = share
  }, [share])

  const state = ko
    ? ' gcard--ko'
    : acting
      ? ' gcard--act'
      : targeted
        ? ' gcard--tgt'
        : next
          ? ' gcard--next'
          : ''

  return (
    <li
      className={
        `gcard gcard--${fighter.team === 1 ? 'mine' : 'enemy'}${state}` +
        (!down && share <= LOW_SHARE ? ' gcard--low' : '') +
        (ko && settled ? ' gcard--settled' : '')
      }
      style={
        {
          '--ec': ELEMENT_RIM[fighter.element] ?? ELEMENT_RIM.neutral,
          '--h': share,
          '--c': down ? 0 : charge,
        } as React.CSSProperties
      }
      title={`${fighterName(fighter)} — ${formatScaled(Math.max(0, health))}/${formatScaled(maxHealth)}`}
    >
      <div className="gcard__frame">
        <div className="gcard__pic">
          <GameImg src={fighterFace(fighter)} alt="" loading="lazy" fallback={fighterArtFallback()} />
        </div>
        <span className="gcard__fx" />
        <span className="gcard__crack">
          <svg viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true">
            <path d="M58 0 L50 34 L62 52 L44 80 L54 130 M50 34 L26 46 L14 70 M62 52 L86 60 M44 80 L22 96" />
          </svg>
        </span>
        <span className="gcard__ret" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="gcard__lv">
          <b>{nft ? 'NFT' : fighter.level}</b>
        </span>
        <img className="gcard__el" src={elementIcon(fighter.element)} alt={fighter.element} />
        <span className="gcard__tag" />
      </div>
      <span className="gcard__name">{nft ? 'NFT Fighter' : fighter.classname || fighter.racename}</span>
      <span className="gcard__hp">
        <i className="gcard__trail" />
        <i className="gcard__fill" />
        {hurt > 0 && <b className="gcard__flash" key={hurt} />}
      </span>
      <span className="gcard__chg">
        <i />
      </span>
      <span className="gcard__down" aria-hidden={!ko}>
        DOWN
      </span>
    </li>
  )
}

/** An element's own colour: the rim inside a card's frame, and a blow's burst in the log. */
export function elementRim(element: string): string {
  return ELEMENT_RIM[element] ?? ELEMENT_RIM.neutral
}

/**
 * A fighter's gilded card at the size of a line of the combat log: the same
 * frame, rim, level and health bar as the row under the fight, and the same
 * fall when the blow it sits in knocked it out. Nothing on it moves; it says
 * what the fighter looked like at that blow.
 */
export function MiniCard({
  fighter,
  health,
  down,
}: {
  fighter: SimFighter
  /** Its health at the blow: the attacker's as it swung, the target's after. */
  health: number
  down: boolean
}) {
  const share = fighter.max_health > 0 ? Math.max(0, Math.min(1, health / fighter.max_health)) : 0
  const nft = Number(fighter.fighter_id) === NFT_FIGHTER_ID
  return (
    <div
      className={
        `gcard gcard--mini gcard--${fighter.team === 1 ? 'mine' : 'enemy'}` +
        (down ? ' gcard--ko gcard--settled' : share <= LOW_SHARE ? ' gcard--low' : '')
      }
      style={{ '--ec': elementRim(fighter.element), '--h': share } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="gcard__frame">
        <div className="gcard__pic">
          <GameImg src={fighterFace(fighter)} alt="" loading="lazy" fallback={fighterArtFallback()} />
        </div>
        <span className="gcard__lv">
          <b>{nft ? 'NFT' : fighter.level}</b>
        </span>
      </div>
      <span className="gcard__hp">
        <i className="gcard__fill" />
      </span>
      <span className="gcard__down">DOWN</span>
    </div>
  )
}
