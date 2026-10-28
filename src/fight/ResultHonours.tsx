import { GameImg } from '@/components/GameImg'
import { asset } from '@/assets'

/**
 * The pieces of the result screen's honours look on a desktop: the laurels
 * either side of the verdict, a fighter as a medallion, and a reward pool as
 * an engram. The phone keeps its own result screen; these are only drawn
 * where there is room for all six fighters side by side.
 */

/* Leaf positions along the stem, with the stem's angle at each. */
const LEAVES: [number, number, number][] = [
  [42, 100, -20],
  [31, 90, -35],
  [23, 78, -50],
  [17, 64, -65],
  [14, 50, -80],
  [14, 36, -95],
  [17, 22, -110],
]

/** One branch of the laurel; `flip` mirrors it for the right-hand side. */
export function Laurel({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className={`honours__laurel${flip ? ' honours__laurel--flip' : ''}`}
      viewBox="0 0 60 110"
      aria-hidden="true"
    >
      <path d="M50 106 C 20 92, 8 62, 18 10" fill="none" stroke="currentColor" strokeWidth="2.4" />
      {LEAVES.map(([x, y, a]) => (
        <g key={y}>
          <ellipse cx={x - 7} cy={y} rx="9" ry="3.6" fill="currentColor" transform={`rotate(${a + 50} ${x - 7} ${y})`} />
          <ellipse cx={x + 6} cy={y - 4} rx="9" ry="3.6" fill="currentColor" transform={`rotate(${a - 25} ${x + 6} ${y - 4})`} />
        </g>
      ))}
    </svg>
  )
}

/**
 * A fighter as a medallion: the face in a ring that is its experience
 * towards the next level, and a tab under it with the level — or DOWN for
 * the fallen and NFT for the NFT fighter, which has no level.
 *
 * A phone taps one to open its record (`onSelect`), and marks the ones with
 * a level waiting (`ready`) with a green arrow in a ring.
 */
export function Medal({
  src,
  fallback,
  xp,
  tab,
  mvp,
  down,
  ready = false,
  selected = false,
  label,
  onSelect,
}: {
  src: string
  fallback: string
  /** Progress to the next level, 0–100; full at the cap. */
  xp: number
  tab: string
  mvp: boolean
  down: boolean
  ready?: boolean
  selected?: boolean
  /** The fighter's name, for the button a tappable medallion becomes. */
  label?: string
  onSelect?: () => void
}) {
  const fill = Math.max(0, Math.min(100, xp))
  const className =
    `honours__medal${down ? ' is-down' : ''}${mvp ? ' is-mvp' : ''}${ready ? ' is-ready' : ''}${selected ? ' is-selected' : ''}`
  const body = (
    <>
      <div className="honours__mvp">
        {mvp && (
          <>
            <svg viewBox="0 0 24 16" aria-hidden="true">
              <path d="M2 14 L3.5 4 L8.5 9 L12 1.5 L15.5 9 L20.5 4 L22 14 Z" fill="currentColor" />
            </svg>
            <span>MVP</span>
          </>
        )}
      </div>
      <div className="honours__ring">
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <circle className="honours__track" cx="70" cy="70" r="66" pathLength={100} />
          {/* No arc at all for nothing, or the round cap would leave a dot. */}
          {fill > 0 && (
            <circle
              className="honours__xp"
              cx="70"
              cy="70"
              r="66"
              pathLength={100}
              strokeDasharray={`${fill} 100`}
            />
          )}
        </svg>
        <GameImg className="honours__face" src={src} alt="" fallback={fallback} />
        <span className="honours__tab">{tab}</span>
        {ready && (
          <span className="honours__up" title="Ready to level up">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 10.5 V2 M2.5 5.5 L6 2 L9.5 5.5" />
            </svg>
          </span>
        )}
      </div>
    </>
  )
  return onSelect ? (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      aria-label={`${label ?? 'Fighter'}${down ? ', down' : ''}${ready ? ', ready to level up' : ''}`}
      onClick={onSelect}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
}

/* One wave, twice as wide as the flask so sliding it half its width loops. */
const WAVE = 'M0 8 Q25 0 50 8 T100 8 T150 8 T200 8 V20 H0Z'

/**
 * A reward pool as an engram, drawn as a measured flask: a diamond of glass
 * with tick marks at every quarter, filled from the bottom to the power
 * banked. The surface ripples under a bright meniscus, and what this run
 * added is the striped band just under it, growing in on the first frames.
 * A full pool can be mined, and says so: the glass glows and a flash sweeps
 * across it, like a flask being drunk.
 */
export function Engram({
  type,
  percent,
  added,
  filled,
  short = false,
}: {
  type: string
  /** Banked power now, as a percentage; past 100 when more than one claim waits. */
  percent: number
  /** What this run added, in the same units. */
  added: number
  /** False for the first frame, so the run's share grows in rather than appearing. */
  filled: boolean
  /** "TLM" rather than "TLM minepower", where the room is a phone's. */
  short?: boolean
}) {
  const now = Math.min(100, percent)
  const before = Math.max(0, Math.min(now, percent - added))
  const level = filled ? now : before
  /* The run's share as a part of the liquid, so it rides under the surface. */
  const run = filled && now > 0 ? ((now - before) / now) * 100 : 0
  const full = percent >= 100
  const tlm = type === 'tlm'
  return (
    <div className={`honours-eng honours-eng--${tlm ? 'tlm' : 'shards'}${full ? ' is-full' : ''}`}>
      <div className="honours-eng__gem">
        <div className="honours-eng__fill">
          <div
            className={`honours-eng__liquid${run > 0 ? ' has-run' : ''}`}
            style={{ height: `${level}%` }}
          >
            <i className="honours-eng__run" style={{ height: `${run}%` }} />
            {level > 0 && !full && (
              <div className="honours-eng__surface" aria-hidden="true">
                <svg viewBox="0 0 200 20" preserveAspectRatio="none">
                  <path d={WAVE} />
                </svg>
              </div>
            )}
          </div>
          <span className="honours-eng__ticks" />
          {full && <span className="honours-eng__flash" />}
        </div>
        <img src={asset(tlm ? '/assets/icons/tlm.svg' : '/assets/icons/shards.svg')} alt="" />
      </div>
      <b>{percent.toLocaleString('en-US', { maximumFractionDigits: 2 })}%</b>
      <span>{tlm ? 'TLM' : 'Shard'}{short ? '' : ' minepower'}</span>
      <em>+{added.toLocaleString('en-US', { maximumFractionDigits: 2 })}%</em>
    </div>
  )
}
