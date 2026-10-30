import type { RosterFighter } from '@/dungeon/types'
import { markerIcon } from '@/dungeon/filters'
import { elementRim } from '@/fight/GildedCards'
import { GameImg } from '@/components/GameImg'
import { portraitCut } from '@/fighters/portraitFrame'
import { elementBackground, elementIcon, fighterArt, fighterArtFallback } from '@/tavern/fighterStats'

/** What the ribbon over the crown says, and the colour it says it in (`.rocard--<key>`). */
export interface Ribbon {
  key: string
  label: string
}

/* Where a busy fighter is, in a word, keyed by the contract's use_type or a note's first word. */
const PLACES: [RegExp, string, string][] = [
  [/market/i, 'market', 'Market'],
  [/arena/i, 'arena', 'Arena'],
  [/dungeon/i, 'dungeon', 'Dungeon'],
  [/tournament/i, 'tournament', 'Tourney'],
]

/** The ribbon for a busy fighter: where it is, else just that it is in use. */
export function placeRibbon(where: string): Ribbon {
  const hit = PLACES.find(([re]) => re.test(where))
  return hit ? { key: hit[1], label: hit[2] } : { key: 'busy', label: 'In use' }
}

/**
 * A fighter as the battle draws it: the gilded card of the fight's line-up
 * (GildedCards, landstage.css) - the steel frame, the diamond at its crown,
 * the element's rim round the portrait, the level in its diamond, the name
 * plate - with what the roster needs where the battle puts the fight's.
 *
 * One face for every compact card - My Fighters, and the pickers that choose
 * a team - so a fighter looks the same everywhere it is chosen. The screen
 * around it decides what it is: the button, the tick, the hover read.
 *
 * The ribbon over the crown says one thing at a time, and the crown diamond
 * takes its colour. The strip at the foot, the battle's charge, is the
 * experience toward the next level. There is no health bar: outside a fight
 * it is always full.
 *
 * The portrait is cut from the full art (portraitFrame), not the `_avatar`
 * crop the battle uses, which is stretched for some fighters.
 */
export function RosterCardFace({
  f,
  ribbon,
  xp,
  busy = false,
  due = false,
  up = false,
  max = false,
}: {
  f: RosterFighter
  ribbon: Ribbon | null
  /** 0 to 1 toward the next level. */
  xp: number
  /** Locked somewhere: the frame goes a little iron. */
  busy?: boolean
  /** A payday owed: the red rim, pulsing. */
  due?: boolean
  /** A level waiting: the frame shines green. */
  up?: boolean
  /** At the top of the ladder: the strip full and green, for good. */
  max?: boolean
}) {
  return (
    <span
      className={[
        'gcard',
        ribbon ? `rocard--${ribbon.key}` : '',
        busy ? 'is-busy' : '',
        due ? 'is-due' : '',
        up ? 'is-up' : '',
        max ? 'is-max' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--ec': elementRim(f.element),
          '--c': up || max ? 1 : Math.max(0, Math.min(1, xp)),
        } as React.CSSProperties
      }
    >
      <span className="gcard__frame">
        <span className="gcard__pic" style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}>
          <GameImg
            className="rocard__art"
            style={portraitCut(f.classname, f.racename)}
            src={fighterArt(f)}
            alt=""
            loading="lazy"
            fallback={fighterArtFallback()}
          />
        </span>
        <span className="gcard__fx" />
        <span className="gcard__lv">
          <b>{f.stats.level}</b>
        </span>
        {f.ascension_level > 0 && <span className="rocard__asc">✦{f.ascension_level}</span>}
        <img className="gcard__el" src={elementIcon(f.element)} alt={f.element} />
        {!!f.marker && (
          <span className="rocard__mk">
            <img src={markerIcon(f.marker)} alt={f.marker} />
          </span>
        )}
        {ribbon && <span className="gcard__tag">{ribbon.label}</span>}
      </span>
      <span className="gcard__name">{f.classname}</span>
      <span className="gcard__chg">
        <i />
      </span>
      {up &&
        MOTES.map(([left, delay]) => (
          <span key={left} className="rocard__mote" style={{ left: `${left}%`, animationDelay: `${delay}s` }} />
        ))}
    </span>
  )
}

/* The motes of light rising off a card with a level waiting: across the foot, a beat apart. */
const MOTES: [number, number][] = [
  [12, 0],
  [30, 0.42],
  [52, 0.84],
  [70, 1.26],
  [86, 1.68],
]
