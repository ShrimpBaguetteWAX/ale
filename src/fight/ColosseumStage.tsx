import { useId } from 'react'
import type { StageForm } from './stages'

/*
 * The Colosseum of Champions: where the Grand Tournament is fought.
 *
 * A stadium at night, drawn rather than painted: three tiers of crowd with
 * cameras flashing, the board hung over the floor, the gold rail with the
 * running text under it, the six element banners, and a dark floor ringed in
 * gold with the crest between the two teams. Spotlights sway over the floor
 * and gold confetti falls. Laid out on the same lines as the arena (the
 * horizon at 37% of a wide field, 34% of a phone's square; the fighters
 * between formation.ts's ground lines), so the teams stand inside the rings.
 */

type Geometry = {
  w: number
  h: number
  /** The horizon: where the wall meets the floor. */
  hz: number
  /** The stands' top edge at the sides and in the middle. */
  standsTop: [number, number]
  /** The rail's height at the sides and in the middle. */
  rail: [number, number]
  /** The board: [x, y, width, height]. */
  board: [number, number, number, number]
  /** The running text's band: [y, height]. */
  ribbon: [number, number]
  /** Where the six banners hang, across. */
  banners: number[]
  /** The floor's rings round the fight, and the crest at their middle: [cx, cy, rx, ry]. */
  ring: [number, number, number, number]
  /** The spotlights: [top x, floor x, half width at the floor], and where they reach. */
  beams: [number, number, number][]
  beamFloor: number
  /** Light pooled on the floor under each side: [cx, cy, rx, ry]. */
  pools: [number, number, number, number][]
}

const GEOMETRY: Record<StageForm, Geometry> = {
  wide: {
    w: 1600,
    h: 900,
    hz: 333,
    standsTop: [96, 26],
    rail: [300, 290],
    /* Under the field's top band (the names, the LIVE tag, the turn) and over the back row's heads. */
    board: [560, 172, 480, 108],
    ribbon: [304, 29],
    banners: [110, 280, 430, 1170, 1320, 1490],
    ring: [800, 585, 760, 215],
    beams: [
      [270, 420, 190],
      [1330, 1180, 190],
      [580, 640, 120],
      [1020, 960, 120],
    ],
    beamFloor: 720,
    pools: [
      [420, 600, 300, 92],
      [1180, 600, 300, 92],
    ],
  },
  tall: {
    w: 1000,
    h: 1000,
    hz: 340,
    /* The crowd to the square's top: above it a phone's taller field carries on in the same crowd (landstage.css). */
    standsTop: [-20, -20],
    rail: [304, 292],
    /* Clear of the fade where the square meets the field's sky, and of the team names over it. */
    board: [250, 150, 500, 112],
    ribbon: [310, 30],
    banners: [64, 186, 814, 936],
    ring: [500, 815, 620, 178],
    beams: [
      [150, 250, 150],
      [850, 750, 150],
      [380, 400, 100],
      [620, 600, 100],
    ],
    beamFloor: 960,
    pools: [
      [250, 820, 220, 76],
      [750, 820, 220, 76],
    ],
  },
}

const ELEMENTS = ['#ff5fc8', '#f2c35a', '#3fd8ff', '#ff7a2e', '#4ee07a', '#8f7bff']

/* Seeded, so the cameras flash in the same seats every fight. */
function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

/* The height of a curve through the sides at `side` and the middle at `mid`, at x. */
const curve = (x: number, w: number, side: number, mid: number) => {
  const t = (x - w / 2) / (w / 2)
  return mid + (side - mid) * t * t
}

const FLASHES: Record<StageForm, [number, number, number, number][]> = (() => {
  const make = (form: StageForm, n: number) => {
    const g = GEOMETRY[form]
    const rnd = seeded(form === 'wide' ? 41 : 43)
    return Array.from({ length: n }, () => {
      const x = rnd() * g.w
      const top = curve(x, g.w, g.standsTop[0], g.standsTop[1]) + 14
      const bottom = curve(x, g.w, g.rail[0], g.rail[1]) - 12
      return [Math.round(x), Math.round(top + rnd() * (bottom - top)), +(2 + rnd() * 2.4).toFixed(1), +(rnd() * 3.2).toFixed(2)] as [number, number, number, number]
    })
  }
  return { wide: make('wide', 44), tall: make('tall', 30) }
})()

/* [x %, fall s, delay s, drift %, colour] */
const CONFETTI: [number, number, number, number, string][] = (() => {
  const rnd = seeded(77)
  const colours = ['#f2c35a', '#fff3c4', '#19d3c5', '#ff4d5e', '#ffffff']
  return Array.from({ length: 22 }, (_, i) => [
    +(rnd() * 100).toFixed(1),
    +(6 + rnd() * 5).toFixed(1),
    +(rnd() * 11).toFixed(1),
    +((rnd() - 0.5) * 6).toFixed(1),
    colours[i % colours.length],
  ])
})()

const RUNNING = Array.from({ length: 14 }, () => '★ ALIEN LEGENDS').join(' ') + ' ★'

export function ColosseumStage({ form }: { form: StageForm }) {
  const g = GEOMETRY[form]
  const id = useId().replace(/:/g, '')
  const u = (name: string) => `${name}-${id}`
  const [bx, by, bw, bh] = g.board
  const [cx, cy, rx, ry] = g.ring
  const railAt = (x: number) => curve(x, g.w, g.rail[0], g.rail[1])
  const stands = `M-20 ${g.rail[0] + 10} L-20 ${g.standsTop[0]} Q${g.w / 2} ${2 * g.standsTop[1] - g.standsTop[0]} ${g.w + 20} ${g.standsTop[0]} L${g.w + 20} ${g.rail[0] + 10} Z`
  const railPath = `M-20 ${g.rail[0]} Q${g.w / 2} ${2 * g.rail[1] - g.rail[0]} ${g.w + 20} ${g.rail[0]}`
  const tier = (k: number) => {
    const side = g.standsTop[0] + (g.rail[0] - g.standsTop[0]) * k
    const mid = g.standsTop[1] + (g.rail[1] - g.standsTop[1]) * k
    return `M-20 ${side} Q${g.w / 2} ${2 * mid - side} ${g.w + 20} ${side}`
  }
  return (
    <div
      className={`lstage lstage--${form} cstage`}
      aria-hidden="true"
      style={{ '--zenith': '#140f2c' } as React.CSSProperties}
    >
      <div className="lstage__scene">
        <svg className="lstage__layer" viewBox={`0 0 ${g.w} ${g.h}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={u('sky')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#05061a" />
              <stop offset={g.hz / g.h} stopColor="#1d1440" />
              <stop offset={g.hz / g.h} stopColor="#231b30" />
              <stop offset="1" stopColor="#0b0812" />
            </linearGradient>
            <linearGradient id={u('tier')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1c1438" />
              <stop offset="1" stopColor="#0e0a20" />
            </linearGradient>
            {/* The crowd: heads in two staggered weaves, so no row repeats. */}
            <pattern id={u('crowdA')} width="22" height="17" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="3.2" fill="#3a2c66" />
              <circle cx="16" cy="11" r="3" fill="#2c2350" />
              <circle cx="11" cy="2" r="2.4" fill="#55408a" />
            </pattern>
            <pattern id={u('crowdB')} width="31" height="23" patternUnits="userSpaceOnUse">
              <circle cx="9" cy="14" r="3.4" fill="#46377a" />
              <circle cx="24" cy="5" r="2.8" fill="#241c44" />
            </pattern>
            <radialGradient id={u('floor')} cx="0.5" cy="0.4" r="0.6">
              <stop offset="0" stopColor="#3a2d4a" />
              <stop offset="0.6" stopColor="#1d1628" />
              <stop offset="1" stopColor="#0b0812" />
            </radialGradient>
            <linearGradient id={u('gold')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff2c0" />
              <stop offset="0.5" stopColor="#e7b44a" />
              <stop offset="1" stopColor="#7c5418" />
            </linearGradient>
            <linearGradient id={u('beam')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff6d8" stopOpacity="0.5" />
              <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={u('pool')}>
              <stop offset="0" stopColor="#fff3c8" stopOpacity="0.3" />
              <stop offset="1" stopColor="#fff3c8" stopOpacity="0" />
            </radialGradient>
            <clipPath id={u('stands')}>
              <path d={stands} />
            </clipPath>
            <clipPath id={u('ribbon')}>
              <rect x="0" y={g.ribbon[0]} width={g.w} height={g.ribbon[1]} />
            </clipPath>
          </defs>

          <rect width={g.w} height={g.h} fill={`url(#${u('sky')})`} />

          {/* The stands, the crowd in them, and the cameras going off. */}
          <g clipPath={`url(#${u('stands')})`}>
            <rect width={g.w} height={g.rail[0] + 20} fill={`url(#${u('tier')})`} />
            <rect width={g.w} height={g.rail[0] + 20} fill={`url(#${u('crowdA')})`} />
            <rect width={g.w} height={g.rail[0] + 20} fill={`url(#${u('crowdB')})`} opacity="0.8" />
            <path d={tier(0.36)} stroke="#2c2350" strokeWidth="5" fill="none" />
            <path d={tier(0.68)} stroke="#2c2350" strokeWidth="5" fill="none" />
            {FLASHES[form].map(([x, y, r, d], i) => (
              <circle key={i} className="cstage__flash" cx={x} cy={y} r={r} style={{ animationDelay: `-${d}s` }} />
            ))}
          </g>

          {/* The board over the floor, on its four cables. */}
          <path
            d={`M${bx + bw * 0.18} 0 L${bx + bw * 0.22} ${by} M${bx + bw * 0.82} 0 L${bx + bw * 0.78} ${by}`}
            stroke="#5a4b7a"
            strokeWidth="2"
          />
          <path
            d={`M${bx} ${by} L${bx + bw} ${by} L${bx + bw + 18} ${by + 16} L${bx + bw + 18} ${by + bh - 16} L${bx + bw} ${by + bh} L${bx} ${by + bh} L${bx - 18} ${by + bh - 16} L${bx - 18} ${by + 16} Z`}
            fill="#0a0716"
            stroke={`url(#${u('gold')})`}
            strokeWidth="4"
          />
          <rect className="cstage__screen" x={bx + 8} y={by + 8} width={bw - 16} height={bh - 16} rx="6" fill="#141f45" />
          <text
            className="cstage__title"
            x={bx + bw / 2}
            y={by + bh * 0.47}
            textAnchor="middle"
            textLength={bw - 70}
            lengthAdjust="spacingAndGlyphs"
          >
            GRAND TOURNAMENT
          </text>
          <text className="cstage__sub" x={bx + bw / 2} y={by + bh * 0.74} textAnchor="middle">
            ALIEN LEGENDS
          </text>
          <rect x={bx + bw * 0.25} y={by + bh * 0.84} width={bw * 0.5} height="4" fill="#00baff" opacity="0.7" />

          {/* The six element banners, over the front of the crowd. */}
          {g.banners.map((x, i) => {
            const top = railAt(x) - 100
            return (
              <g key={x}>
                <rect x={x - 26} y={top - 4} width="52" height="6" fill="#e7b44a" />
                <path d={`M${x - 22} ${top} L${x + 22} ${top} L${x + 22} ${top + 84} L${x} ${top + 70} L${x - 22} ${top + 84} Z`} fill={ELEMENTS[i % 6]} opacity="0.85" />
                <circle cx={x} cy={top + 32} r="10" fill="none" stroke="#fff" strokeWidth="3" opacity="0.8" />
              </g>
            )
          })}

          {/* The wall round the floor, its gold rail and the running text. */}
          <path d={`${railPath} L${g.w + 20} ${g.hz + 12} L-20 ${g.hz + 12} Z`} fill="#120d24" />
          <path d={railPath} stroke={`url(#${u('gold')})`} strokeWidth="4" fill="none" />
          <g clipPath={`url(#${u('ribbon')})`}>
            <rect x="0" y={g.ribbon[0]} width={g.w} height={g.ribbon[1]} fill="#06040e" />
            <text className="cstage__ribbon" x="0" y={g.ribbon[0] + g.ribbon[1] * 0.74}>
              {RUNNING}
            </text>
          </g>

          {/* The floor: dark and polished, ringed in gold, the crest between the teams. */}
          <rect x="0" y={g.hz} width={g.w} height={g.h - g.hz} fill={`url(#${u('floor')})`} />
          <rect x="0" y={g.hz} width={g.w} height="3" fill="#e7b44a" opacity="0.5" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#e7b44a" strokeWidth="3" opacity="0.75" />
          <ellipse cx={cx} cy={cy} rx={rx * 0.92} ry={ry * 0.9} fill="none" stroke="#e7b44a" strokeWidth="1" opacity="0.4" />
          <ellipse cx={cx} cy={cy} rx={rx * 0.27} ry={ry * 0.27} fill="none" stroke="#e7b44a" strokeWidth="2" strokeDasharray="10 8" opacity="0.6" />
          <g transform={`translate(${cx} ${cy}) scale(1 0.3)`} opacity="0.85">
            <path d="M-90 40 L90 -40 M-90 -40 L90 40" stroke="#e7b44a" strokeWidth="10" />
            <path d="M-60 -10 L-40 -70 L-15 -30 L0 -85 L15 -30 L40 -70 L60 -10 Z" fill={`url(#${u('gold')})`} />
          </g>
          {g.pools.map(([px, py, prx, pry], i) => (
            <ellipse key={i} className="cstage__pool" cx={px} cy={py} rx={prx} ry={pry} fill={`url(#${u('pool')})`} style={{ animationDelay: `-${i * 1.7}s` }} />
          ))}

          {/* Spotlights from the roof, swaying over the floor. */}
          {g.beams.map(([top, foot, half], i) => (
            <polygon
              key={i}
              className="cstage__beam"
              points={`${top - 18},0 ${top + 18},0 ${foot + half},${g.beamFloor} ${foot - half},${g.beamFloor}`}
              fill={`url(#${u('beam')})`}
              style={{ animationDelay: `-${i * 1.75}s`, opacity: i < 2 ? 1 : 0.6 }}
            />
          ))}
        </svg>
        <div className="cstage__confetti">
          {CONFETTI.map(([x, fall, delay, drift, colour], i) => (
            <span
              key={i}
              style={
                {
                  left: `${x}%`,
                  animationDuration: `${fall}s`,
                  animationDelay: `-${delay}s`,
                  '--cx': `${drift}%`,
                } as React.CSSProperties
              }
            >
              <i style={{ background: colour, animationDuration: `${1 + (i % 3) * 0.4}s` }} />
            </span>
          ))}
        </div>
        <div className="cstage__vig" />
      </div>
    </div>
  )
}
