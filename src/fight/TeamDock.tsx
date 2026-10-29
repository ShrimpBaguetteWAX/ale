import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { RosterFighter } from '@/dungeon/types'
import { GameImg } from '@/components/GameImg'
import { elementBackground, fighterArtFallback, fighterAvatar } from '@/tavern/fighterStats'
import { matchupStyle } from '@/fight/matchupStyle'
import { verdictOf } from '@/fight/OddsCentre'
import { useCountUp } from '@/fight/useCountUp'

/**
 * The team and its chance to win, docked at the foot of the screen while the
 * matchup itself is scrolled away — so a trainer trying fighters in the list
 * below sees what each pick does. The five slots fill as they pick, a bar
 * pulls their side against the other (the white line is even), and each
 * change shows for a moment as +n% or −n%. `action` is the screen's own
 * button: Start Fight, Challenge, or a phone sheet's Done.
 */
export function TeamDock({
  slots,
  share,
  winRate,
  against,
  action,
  shown = true,
  sheet = false,
}: {
  slots: (RosterFighter | null)[]
  /** Their side of the bar, 0 to 1: the odds, or the strength split before they are known. */
  share: number
  /** The chance to win, when the odds are known. */
  winRate: number | null
  /** What the other side is called: the dungeon, the defenders. */
  against: string
  action: ReactNode
  /** Out of the way while the matchup is on screen. */
  shown?: boolean
  /** In a phone's picker sheet, at its foot, rather than across the page. */
  sheet?: boolean
}) {
  /* The dock follows the matchup's look on a phone as well as a desktop. */
  const hud = matchupStyle() === 'hud'
  const pct = winRate === null ? null : Math.round(winRate * 100)
  /* The figure counts to a new chance as the arc fills to it. */
  const counted = useCountUp(pct)
  const band = pct === null ? 'none' : pct >= 55 ? 'good' : pct >= 35 ? 'even' : 'poor'
  const filled = slots.filter(Boolean).length

  /* What the last pick did, shown for a moment: keyed so each change replays it. */
  const last = useRef(pct)
  const [delta, setDelta] = useState<{ d: number; key: number } | null>(null)
  useEffect(() => {
    const before = last.current
    last.current = pct
    if (pct === null || before === null || pct === before) return
    setDelta((cur) => ({ d: pct - before, key: (cur?.key ?? 0) + 1 }))
  }, [pct])

  const faces = (
    <span className="teamdock__faces">
      {slots.map((f, i) =>
        f ? (
          <span
            className="teamdock__face"
            key={f.fighter_id}
            style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}
            title={`${f.racename} ${f.classname}`}
          >
            <GameImg src={fighterAvatar(f)} alt="" fallback={fighterArtFallback()} />
          </span>
        ) : (
          <span className="teamdock__face is-empty" key={`empty-${i}`} />
        ),
      )}
    </span>
  )
  const deltaChip = delta && (
    <span key={delta.key} className={`teamdock__delta ${delta.d > 0 ? 'is-up' : 'is-down'}`}>
      {delta.d > 0 ? '+' : '−'}
      {Math.abs(delta.d)}%
    </span>
  )

  /*
     The HUD look (see matchupStyle): the board's round faces, and the
     chance as the board's gauge, small, with its verdict beside it — next
     to the button rather than on it. In a phone's sheet the chance sits
     over the faces and Done, and the count is the sheet's own to show.
  */
  if (hud) {
    const arc = Math.PI * 34
    return (
      <div
        className={`teamdock teamdock--hud${sheet ? ' teamdock--sheet' : ''}${shown ? ' is-shown' : ''}`}
        aria-hidden={shown ? undefined : true}
      >
        {faces}
        {!sheet && (
          <span className="teamdock__count">
            Your team · {filled}/{slots.length}
          </span>
        )}
        <span className={`teamdock__chance is-${band}`} title={pct === null ? undefined : `${pct}% chance to win against ${against.toLowerCase()}`}>
          <span className="teamdock__gauge" aria-hidden="true">
            <svg viewBox="0 0 80 46">
              <path className="teamdock__track" d="M6 40 A34 34 0 0 1 74 40" />
              {pct !== null && (
                <path
                  className="teamdock__fill"
                  d="M6 40 A34 34 0 0 1 74 40"
                  strokeDasharray={`${arc} ${arc}`}
                  strokeDashoffset={(arc * (100 - pct)) / 100}
                />
              )}
            </svg>
            <b className="teamdock__pct">
              {pct === null ? '—' : (counted ?? pct)}
              {pct !== null && <i>%</i>}
            </b>
          </span>
          <span className="teamdock__word">
            <span className="teamdock__cap">Chance to win</span>
            <b>
              {pct === null ? 'Pick your team' : verdictOf(pct)}
              {deltaChip}
            </b>
          </span>
        </span>
        <span className="teamdock__act">{action}</span>
      </div>
    )
  }

  return (
    <div
      className={`teamdock${sheet ? ' teamdock--sheet' : ''}${shown ? ' is-shown' : ''}`}
      aria-hidden={shown ? undefined : true}
    >
      <span className="teamdock__faces">
        {slots.map((f, i) =>
          f ? (
            <span
              className="teamdock__face"
              key={f.fighter_id}
              style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}
              title={`${f.racename} ${f.classname}`}
            >
              <GameImg src={fighterAvatar(f)} alt="" fallback={fighterArtFallback()} />
            </span>
          ) : (
            <span className="teamdock__face is-empty" key={`empty-${i}`} />
          ),
        )}
      </span>
      <span className={`teamdock__tug is-${band}`}>
        <span className="teamdock__top">
          <span className="teamdock__cap">
            Chance to win
            {delta && (
              <span key={delta.key} className={`teamdock__delta ${delta.d > 0 ? 'is-up' : 'is-down'}`}>
                {delta.d > 0 ? '+' : '−'}
                {Math.abs(delta.d)}%
              </span>
            )}
          </span>
          <b className="teamdock__pct">
            {pct === null ? '—' : pct}
            {pct !== null && <i>%</i>}
          </b>
        </span>
        <span className="teamdock__bar">
          <i style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
        {!sheet && (
          <span className="teamdock__sides">
            <span>
              Your team · {filled}/{slots.length}
            </span>
            <span>{against}</span>
          </span>
        )}
      </span>
      <span className="teamdock__act">{action}</span>
    </div>
  )
}

/**
 * Whether an element is scrolled out of view — the chance to win, for the dock.
 * Takes the element itself (a callback ref's), not a ref object: the screen
 * shows its loading state first, so the element arrives after the first
 * render and the watch has to start then. False until it is known, so
 * nothing slides in on the first frame.
 */
export function useScrolledAway(el: Element | null): boolean {
  const [away, setAway] = useState(false)
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [el])
  return away
}
