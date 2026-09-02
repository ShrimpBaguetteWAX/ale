import type { Planet } from '@/chain/config'
import { asset } from '@/assets'

/**
 * The wormhole, for a portal jump between planets.
 *
 * Stepping through a portal is the only thing on the map that changes where
 * you are in a way the map cannot show you — the grid under your feet is
 * replaced wholesale. Without a transition, the biggest move in the game
 * reads as a glitch.
 *
 * One animation, on one clock.
 *
 * It used to run in three phases, the middle one looping for however long the
 * chain took, which meant swapping a class part-way through. Every seam it
 * ever had came from that swap: animations restarting from fixed values,
 * fade curves that did not complement each other, motion beginning where a
 * moment earlier there had been none. Waiting for the chain *before* anything
 * is drawn costs a beat of spinner and buys a transition with no hand-off in
 * it at all — everything below is scheduled by delay from the instant this
 * mounts, and nothing is ever re-triggered.
 */

/** The whole thing, start to finish. `WARP_MS` in MapView must match. */
export const WARP_TOTAL_MS = 4400

/** Rings receding down the throat: the structure of the tunnel. */
const RINGS = 8

/**
 * Stars streaking past.
 *
 * Scattered rather than spoked. A regular fan reads as a graphic; what makes
 * it read as motion through space is that no two are at the same angle, the
 * same distance or the same moment. The scatter is deterministic — the same
 * jump always looks the same — because a hash is cheaper than randomness and
 * nothing here benefits from varying between renders.
 */
const STARS = 64

/** A small integer hash, for the scatter. Deterministic across renders. */
function spread(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function PortalWarp({
  to,
  lowFx,
}: {
  /** Where the portal leads: named at the end, and its surface is the globe. */
  to: Planet
  /**
   * The app's low-power setting — four cores or fewer, or the user asked for
   * it. It thins the star field and drops the costly filters; the journey
   * still happens. It is not the same thing as `prefers-reduced-motion`,
   * which does ask for stillness and is handled on its own in the stylesheet.
   */
  lowFx?: boolean
}) {
  return (
    <div
      className={`warpgate${lowFx ? ' warpgate--calm' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Travelling to ${to}`}
    >
      <div className="warpgate__throat" aria-hidden="true">
        {Array.from({ length: STARS }, (_, i) => (
          <span
            className="warpgate__star"
            key={`t${i}`}
            style={
              {
                '--a': `${spread(i, 1) * 360}deg`,
                '--delay': `${-spread(i, 2) * 900}ms`,
                '--len': `${6 + spread(i, 3) * 22}vmin`,
                '--dur': `${620 + spread(i, 4) * 380}ms`,
              } as React.CSSProperties
            }
          />
        ))}

        {Array.from({ length: RINGS }, (_, i) => (
          <span className="warpgate__depth" key={`r${i}`} style={{ ['--i' as string]: i }} />
        ))}

        <span className="warpgate__core" />
      </div>

      {/*
        The gate rim: the near edge you are passing through, held at the centre
        while the tunnel rushes past it, then let go at the end.
      */}
      <div className="warpgate__ring" aria-hidden="true">
        <span className="warpgate__spin">
          {Array.from({ length: 9 }, (_, i) => (
            <span className="warpgate__chevron" key={i} style={{ ['--i' as string]: i }} />
          ))}
        </span>
        <span className="warpgate__surge" />
      </div>

      {/*
        The destination, resolving out of the far end of the tunnel.

        Its surface is the planet's own map texture — the same image the grid
        is drawn on — so what you fly toward is recognisably the place you are
        about to be standing on, rather than a generic sphere.
      */}
      <div className="warpgate__arrival" aria-hidden="true">
        <span
          className="warpgate__globe"
          style={{ backgroundImage: `url('${asset(`/assets/maps/${to}.jpg`)}')` }}
        />
        <span className="warpgate__limb" />
      </div>

      <p className="warpgate__label">
        <span className="warpgate__verb">Arrived at</span>
        <span className="warpgate__planet">{to}</span>
      </p>
    </div>
  )
}
