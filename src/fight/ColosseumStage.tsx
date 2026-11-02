import { useId } from 'react'
import type { StageForm } from './stages'

/*
 * The Colosseum of Champions: where the Grand Tournament is fought.
 *
 * A stadium at night, drawn rather than painted, back to front: the roof's
 * truss and its lamps, a ring of skyboxes, three tiers of crowd (each side's
 * supporters in its team colour, flags waving, a wave rolling round, cameras
 * flashing), the six element banners, the panelled wall with its gold rail
 * and the running text, a polished floor ringed in gold like a dial with the
 * crest between the teams, and the spotlights from the lamps. Over it: dust in
 * the light and each side lit in its own colour. No confetti and no
 * fireworks: falling paper and bursts behind the fighters were too much
 * movement to follow a fight through; the cameras flashing in the crowd stay.
 *
 * Laid out on the arena's lines (the horizon at 37% of a wide field, 34% of a
 * phone's square; the teams between formation.ts's ground lines). A phone's
 * field stands taller than its square: the crowd carries on up into it
 * (landstage.css), and the lamps hang there, above the square.
 *
 * Only opacity and transform move. The many lights that blink do so in a few
 * groups rather than one animation each.
 */

type Geometry = {
  w: number
  h: number
  /** The horizon: where the wall meets the floor. */
  hz: number
  /** The roof's truss, [at the sides, in the middle]; a phone has none. */
  roof: [number, number] | null
  /** The skyboxes' row, as the roof. */
  skybox: [number, number] | null
  /** Where a phone's lamps hang, above its square, when there is no roof. */
  lampY: number
  /** The stands' top edge and the rail, [at the sides, in the middle]. */
  standsTop: [number, number]
  rail: [number, number]
  /** The running text's band: [y, height]. */
  ribbon: [number, number]
  /** Where the six banners hang, across. */
  banners: number[]
  /** The floor's ring round the fight, the crest at its middle: [cx, cy, rx, ry]. */
  ring: [number, number, number, number]
  lamps: number[]
  /** The spotlights: [lamp x, floor x, half width at the floor], and where they reach. */
  beams: [number, number, number][]
  beamFloor: number
  /** Light pooled on the floor under each side: [cx, cy, rx, ry]. */
  pools: [number, number, number, number][]
  /** Fireworks: [x %, y % of the field, delay s]. */
}

const GEOMETRY: Record<StageForm, Geometry> = {
  wide: {
    w: 1600,
    h: 900,
    hz: 333,
    roof: [30, -4],
    skybox: [100, 58],
    lampY: 0,
    standsTop: [128, 84],
    rail: [300, 290],
    ribbon: [304, 29],
    banners: [110, 280, 430, 1170, 1320, 1490],
    ring: [800, 585, 760, 215],
    lamps: [100, 300, 600, 1000, 1300, 1500],
    beams: [
      [300, 430, 200],
      [1300, 1170, 200],
      [600, 650, 130],
      [1000, 950, 130],
    ],
    beamFloor: 760,
    pools: [
      [430, 610, 300, 92],
      [1170, 610, 300, 92],
    ],
  },
  tall: {
    w: 1000,
    h: 1000,
    hz: 340,
    roof: null,
    skybox: null,
    /* The crowd over the square reaches about y -550 at a phone's height; the lamps hang under the field's top band. */
    lampY: -330,
    /* The crowd to the square's top, and on up above it. */
    standsTop: [-20, -20],
    rail: [304, 292],
    ribbon: [310, 30],
    banners: [64, 186, 814, 936],
    ring: [500, 815, 620, 178],
    lamps: [150, 380, 620, 850],
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
const MINE = '#19d3c5'
const THEIRS = '#ff4d5e'

/* Each element's emblem on its banner, drawn round 0,0: gem, metal, air, fire, nature, neutral. */
const GLYPHS: { d: string; line?: boolean }[] = [
  { d: 'M0 -11 L9 0 L0 11 L-9 0 Z' },
  { d: 'M-8 -5 L0 -10 L8 -5 L8 5 L0 10 L-8 5 Z M0 -4 A4 4 0 1 0 0.01 -4' },
  { d: 'M-9 -5 Q-3 -9 3 -5 T 9 -5 M-9 1 Q-3 -3 3 1 T 9 1 M-6 7 Q0 3 6 7', line: true },
  { d: 'M0 -11 C6 -4 8 2 4 8 C2 4 0 3 -1 1 C-2 5 -4 7 -5 9 C-9 3 -6 -4 0 -11 Z' },
  { d: 'M-8 8 C-8 -4 0 -10 9 -10 C9 0 4 8 -8 8 Z M-8 8 L4 -4' },
  { d: 'M0 -10 A10 10 0 1 0 0.01 -10 M0 -5 A5 5 0 1 0 0.01 -5', line: true },
]

/* Seeded, so the crowd, the cameras and the confetti are the same every fight. */
function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

/* The height of a curve through the sides at `side` and the middle at `mid`, at x. */
const curve = (x: number, w: number, side: number, mid: number) => {
  const t = (x - w / 2) / (w / 2)
  return mid + (side - mid) * t * t
}
/* The same curve as a path, across the whole width. */
const arc = (w: number, side: number, mid: number) => `M-20 ${side} Q${w / 2} ${2 * mid - side} ${w + 20} ${side}`
const f1 = (n: number) => +n.toFixed(1)

/* Everything placed once per form: the crowd's flags and cameras, the seams, the ticks, the laurel. */
function layout(form: StageForm) {
  const g = GEOMETRY[form]
  const rnd = seeded(form === 'wide' ? 11 : 13)
  const railAt = (x: number) => curve(x, g.w, g.rail[0], g.rail[1])
  const topAt = (x: number) => curve(x, g.w, g.standsTop[0], g.standsTop[1])
  const roofAt = (x: number) => (g.roof ? curve(x, g.w, g.roof[0], g.roof[1]) : g.lampY)
  const inStands = () => {
    const x = rnd() * g.w
    return [f1(x), f1(topAt(x) + 10 + rnd() * (railAt(x) - topAt(x) - 20))] as const
  }
  const [cx, cy, rx, ry] = g.ring

  /* the roof's lattice, and the skyboxes' windows */
  let lattice = ''
  if (g.roof)
    for (let x = -20; x < g.w + 20; x += 40)
      lattice += `M${x} ${f1(roofAt(x))} L${x + 20} ${f1(roofAt(x + 20) + 26)} L${x + 40} ${f1(roofAt(x + 40))} `
  const windows: [number, number, number][] = []
  if (g.skybox)
    for (let x = 10; x < g.w; x += 34)
      windows.push([x, f1(curve(x, g.w, g.skybox[0], g.skybox[1]) - 6), +(0.15 + rnd() * 0.65).toFixed(2)])

  /* seat rows, aisles, and the two tier walls */
  const rows: string[] = []
  for (let k = 1; k < 16; k++) {
    const t = k / 16
    rows.push(arc(g.w, g.standsTop[0] + (g.rail[0] - g.standsTop[0]) * t, g.standsTop[1] + (g.rail[1] - g.standsTop[1]) * t))
  }
  let aisles = ''
  let steps = ''
  for (let i = -5; i <= 5; i++) {
    const xr = g.w / 2 + i * g.w * 0.12
    const xt = g.w / 2 + i * g.w * 0.095
    aisles += `M${f1(xt)} ${f1(topAt(xt) - 10)} L${f1(xr)} ${f1(railAt(xr))} `
    steps += `M${f1(xt + 4)} ${f1(topAt(xt) - 10)} L${f1(xr + 5)} ${f1(railAt(xr))} `
  }
  const tiers = [0.36, 0.68].map((k) => {
    const side = g.standsTop[0] + (g.rail[0] - g.standsTop[0]) * k
    const mid = g.standsTop[1] + (g.rail[1] - g.standsTop[1]) * k
    return [arc(g.w, side, mid), arc(g.w, side + 3, mid + 3)]
  })

  /* flags in the crowd, in the colour of the side they are on */
  const flags = Array.from({ length: form === 'wide' ? 14 : 8 }, () => {
    const x = 30 + rnd() * (g.w - 60)
    const y = topAt(x) + 30 + rnd() * (railAt(x) - topAt(x) - 50)
    return { x: f1(x), y: f1(y), c: x < g.w * 0.38 ? MINE : x > g.w * 0.62 ? THEIRS : '#f2c35a', d: +(rnd() * 1.6).toFixed(2) }
  })
  /* cameras, in eight groups that flash in turn; a few star glints of their own */
  const flashes: [number, number, number][][] = Array.from({ length: 8 }, () => [])
  for (let i = 0; i < (form === 'wide' ? 64 : 40); i++) {
    const [x, y] = inStands()
    flashes[i % 8].push([x, y, +(1.8 + rnd() * 2.4).toFixed(1)])
  }
  const glints = Array.from({ length: form === 'wide' ? 10 : 6 }, () => {
    const [x, y] = inStands()
    return { x, y, d: +(rnd() * 4.6).toFixed(2) }
  })

  /* the wall's seams and the rail's posts; the lights along the ribbon's edges */
  const posts: number[] = []
  for (let x = 80; x < g.w; x += 160) posts.push(x)
  const seams: number[] = []
  for (let x = 40; x < g.w; x += 80) seams.push(x)
  const chase: number[] = []
  for (let x = 6; x < g.w; x += 26) chase.push(x)

  /* the floor's seams in perspective */
  let floorSeams = ''
  const vpY = g.hz - (g.h - g.hz) * 0.9
  for (let i = -18; i <= 18; i++) {
    const xb = g.w / 2 + i * g.w * 0.09
    const xt = g.w / 2 + (xb - g.w / 2) * ((g.hz - vpY) / (g.h - vpY))
    floorSeams += `M${f1(xt)} ${g.hz} L${f1(xb)} ${g.h} `
  }
  for (let k = 1; k < 10; k++) {
    const y = f1(g.hz + (g.h - g.hz) * Math.pow(k / 10, 1.7))
    floorSeams += `M0 ${y} L${g.w} ${y} `
  }

  /* the ring's ticks, a dial of them */
  let ticks = ''
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    const r2 = k % 10 === 0 ? 0.995 : 0.985
    ticks += `M${f1(cx + rx * 0.958 * c)} ${f1(cy + ry * 0.958 * s)} L${f1(cx + rx * r2 * c)} ${f1(cy + ry * r2 * s)} `
  }
  /* the crest's laurel: nine leaves a side */
  const laurel: { x: number; y: number; a: number }[] = []
  for (const side of [-1, 1])
    for (let k = 0; k < 9; k++) {
      const a = (side < 0 ? 200 : -20) - side * k * 15
      const rad = (a * Math.PI) / 180
      laurel.push({ x: f1(Math.cos(rad) * 118), y: f1(Math.sin(rad) * 118), a: Math.round(a + 90 * side) })
    }

  return { railAt, roofAt, lattice, windows, rows, aisles, steps, tiers, flags, flashes, glints, posts, seams, chase, floorSeams, ticks, laurel }
}

const LAYOUT: Record<StageForm, ReturnType<typeof layout>> = { wide: layout('wide'), tall: layout('tall') }

/* [x %, top %, drift cqw, s, delay s] */
const MOTES = (() => {
  const rnd = seeded(31)
  return Array.from({ length: 22 }, () => [f1(12 + rnd() * 76), f1(44 + rnd() * 40), f1((rnd() - 0.5) * 4), f1(7 + rnd() * 6), f1(rnd() * 13)])
})()

const RUNNING = Array.from({ length: 28 }, () => '★ ALIEN LEGENDS').join(' ') + ' ★'

export function ColosseumStage({ form }: { form: StageForm }) {
  const g = GEOMETRY[form]
  const L = LAYOUT[form]
  const id = useId().replace(/:/g, '')
  const u = (name: string) => `${name}-${id}`
  const url = (name: string) => `url(#${u(name)})`
  const [cx, cy, rx, ry] = g.ring
  const [ry0, rh] = g.ribbon
  const standsPath = `M-20 ${g.rail[0] + 10} L-20 ${g.standsTop[0]} Q${g.w / 2} ${2 * g.standsTop[1] - g.standsTop[0]} ${g.w + 20} ${g.standsTop[0]} L${g.w + 20} ${g.rail[0] + 10} Z`
  const standsH = g.rail[0] + 40
  const lampAt = (x: number) => (g.roof ? L.roofAt(x) + 26 : g.lampY)
  const banner = (x: number, top: number) =>
    `M${x - 24} ${top} L${x + 24} ${top} L${x + 24} ${top + 84} L${x} ${top + 70} L${x - 24} ${top + 84} Z`

  return (
    <div className={`lstage lstage--${form} cstage`} aria-hidden="true" style={{ '--zenith': '#140f2c' } as React.CSSProperties}>
      <div className="lstage__scene">
        <svg className="lstage__layer" viewBox={`0 0 ${g.w} ${g.h}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={u('sky')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#03030e" />
              <stop offset={g.hz / g.h} stopColor="#1a1236" />
              <stop offset={g.hz / g.h} stopColor="#211a2e" />
              <stop offset="1" stopColor="#0a0711" />
            </linearGradient>
            <linearGradient id={u('tier')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a1336" />
              <stop offset="1" stopColor="#100b24" />
            </linearGradient>
            {/* The crowd: heads in two staggered weaves, and each side's supporters. */}
            <pattern id={u('cA')} width="22" height="17" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="6" r="3.2" fill="#3a2c66" />
              <circle cx="16" cy="12" r="3" fill="#2c2350" />
              <circle cx="11" cy="2" r="2.4" fill="#55408a" />
            </pattern>
            <pattern id={u('cB')} width="31" height="23" patternUnits="userSpaceOnUse">
              <circle cx="9" cy="14" r="3.4" fill="#46377a" />
              <circle cx="24" cy="5" r="2.8" fill="#241c44" />
            </pattern>
            <pattern id={u('cT')} width="19" height="15" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="3" fill="#1a8f8a" />
              <circle cx="14" cy="11" r="2.6" fill={MINE} opacity="0.7" />
            </pattern>
            <pattern id={u('cR')} width="19" height="15" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="3" fill="#8f2232" />
              <circle cx="14" cy="11" r="2.6" fill={THEIRS} opacity="0.7" />
            </pattern>
            {/* LED pixels, for the ribbon. */}
            <pattern id={u('px')} width="5" height="5" patternUnits="userSpaceOnUse">
              <rect width="5" height="5" fill="none" stroke="#000" strokeWidth="1.2" opacity="0.35" />
            </pattern>
            <linearGradient id={u('wave')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#d9ccff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={u('floor')} cx="0.5" cy="0.42" r="0.62">
              <stop offset="0" stopColor="#3b2e4c" />
              <stop offset="0.55" stopColor="#1e1729" />
              <stop offset="1" stopColor="#0a0711" />
            </radialGradient>
            <linearGradient id={u('gold')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff4c8" />
              <stop offset="0.45" stopColor="#eab84c" />
              <stop offset="1" stopColor="#7c5418" />
            </linearGradient>
            <linearGradient id={u('goldH')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8a5f1c" />
              <stop offset="0.5" stopColor="#ffe9a6" />
              <stop offset="1" stopColor="#8a5f1c" />
            </linearGradient>
            <linearGradient id={u('cloth')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity="0.35" />
              <stop offset="0.35" stopColor="#fff" stopOpacity="0.18" />
              <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id={u('ribbonBg')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d0920" />
              <stop offset="0.5" stopColor="#05030d" />
              <stop offset="1" stopColor="#0d0920" />
            </linearGradient>
            <linearGradient id={u('barrier')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={MINE} />
              <stop offset="0.42" stopColor="#7ce0d0" />
              <stop offset="0.5" stopColor="#f2c35a" />
              <stop offset="0.58" stopColor="#ff8a7a" />
              <stop offset="1" stopColor={THEIRS} />
            </linearGradient>
            <linearGradient id={u('haze')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#b9a6ff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#b9a6ff" stopOpacity="0.13" />
              <stop offset="1" stopColor="#b9a6ff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={u('reflFade')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#211a2e" stopOpacity="0" />
              <stop offset="1" stopColor="#211a2e" stopOpacity="1" />
            </linearGradient>
            <radialGradient id={u('teamT')}>
              <stop offset="0" stopColor={MINE} stopOpacity="0.2" />
              <stop offset="1" stopColor={MINE} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={u('teamR')}>
              <stop offset="0" stopColor={THEIRS} stopOpacity="0.2" />
              <stop offset="1" stopColor={THEIRS} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={u('pool')}>
              <stop offset="0" stopColor="#fff3c8" stopOpacity="0.32" />
              <stop offset="1" stopColor="#fff3c8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={u('lamp')}>
              <stop offset="0" stopColor="#fffaf0" stopOpacity="0.9" />
              <stop offset="0.25" stopColor="#ffe9b0" stopOpacity="0.45" />
              <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={u('crest')}>
              <stop offset="0" stopColor="#ffd77a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
            </radialGradient>
            {/* The spotlights: bright down the middle, soft at the edges, fading toward the floor. */}
            <linearGradient id={u('beamH')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff6d8" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff6d8" stopOpacity="0.55" />
              <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={u('beamV')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.7" stopColor="#777" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
            <mask id={u('beamM')} maskContentUnits="objectBoundingBox">
              <rect width="1" height="1" fill={url('beamV')} />
            </mask>
            <filter id={u('glow')} x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id={u('stands')}>
              <path d={standsPath} />
            </clipPath>
            <clipPath id={u('ribbonC')}>
              <rect x="0" y={ry0} width={g.w} height={rh} />
            </clipPath>
            <clipPath id={u('floorC')}>
              <rect x="0" y={g.hz} width={g.w} height={g.h - g.hz} />
            </clipPath>
          </defs>

          <rect width={g.w} height={g.h} fill={url('sky')} />

          {/* The roof's truss, and the skyboxes under it. */}
          {g.roof && g.skybox && (
            <>
              <path
                d={`${arc(g.w, g.roof[0], g.roof[1])} L${g.w + 20} ${g.roof[0] + 26} Q${g.w / 2} ${2 * g.roof[1] - g.roof[0] + 26} -20 ${g.roof[0] + 26} Z`}
                fill="#0b0918"
              />
              <path d={L.lattice} stroke="#2a2342" strokeWidth="2" fill="none" />
              <path d={arc(g.w, g.roof[0] + 26, g.roof[1] + 26)} stroke="#3a3058" strokeWidth="2" fill="none" />
              <path
                d={`${arc(g.w, g.skybox[0] - 12, g.skybox[1] - 12)} L${g.w + 20} ${g.skybox[0] + 14} Q${g.w / 2} ${2 * g.skybox[1] - g.skybox[0] + 14} -20 ${g.skybox[0] + 14} Z`}
                fill="#0e0a1e"
              />
              {L.windows.map(([x, y, o]) => (
                <rect key={x} x={x} y={y} width="24" height="11" rx="1.5" fill="#ffcf7a" opacity={o} />
              ))}
              <path d={arc(g.w, g.skybox[0] + 14, g.skybox[1] + 14)} stroke="#e7b44a" strokeWidth="1.5" opacity="0.5" fill="none" />
            </>
          )}

          {/* The stands: the crowd, each side's supporters, rows, aisles, flags, the wave and the cameras. */}
          <g clipPath={url('stands')}>
            <rect y={Math.min(0, g.standsTop[1])} width={g.w} height={g.rail[0] + 20} fill={url('tier')} />
            <rect y="-20" width={g.w} height={standsH} fill={url('cA')} />
            <rect y="-20" width={g.w} height={standsH} fill={url('cB')} opacity="0.8" />
            <rect y="-20" width={g.w * 0.36} height={standsH} fill={url('cT')} opacity="0.62" />
            <rect x={g.w * 0.64} y="-20" width={g.w * 0.36} height={standsH} fill={url('cR')} opacity="0.62" />
            {L.rows.map((d, i) => (
              <path key={i} d={d} stroke="#05030c" strokeWidth="2" opacity="0.22" fill="none" />
            ))}
            <path d={L.aisles} stroke="#08051a" strokeWidth={form === 'wide' ? 8 : 7} opacity="0.6" />
            <path d={L.steps} stroke="#4a3c78" strokeWidth="1" opacity="0.35" strokeDasharray="3 6" />
            {L.tiers.map(([wall, lip], i) => (
              <g key={i}>
                <path d={wall} stroke="#2c2350" strokeWidth="7" fill="none" />
                <path d={lip} stroke="#9a8ae0" strokeWidth="1" opacity="0.3" fill="none" />
              </g>
            ))}
            <rect
              className="cstage__wave"
              x="-460"
              y="-20"
              width="420"
              height={standsH}
              fill={url('wave')}
              style={{ '--wx': `${g.w + 900}px` } as React.CSSProperties}
            />
            {L.flags.map((f, i) => (
              <g key={i}>
                <path d={`M${f.x} ${f.y} L${f.x} ${f.y - 22}`} stroke="#c8c0e0" strokeWidth="1.6" />
                <path
                  className="cstage__flag"
                  d={`M${f.x} ${f.y - 22} L${f.x + 20} ${f.y - 17} L${f.x} ${f.y - 12} Z`}
                  fill={f.c}
                  style={{ animationDelay: `-${f.d}s` }}
                />
              </g>
            ))}
            {L.flashes.map((group, i) => (
              <g key={i} className="cstage__flash" style={{ animationDelay: `-${(i * 0.4).toFixed(1)}s` }}>
                {group.map(([x, y, r], k) => (
                  <circle key={k} cx={x} cy={y} r={r} fill="#fff" />
                ))}
              </g>
            ))}
            {L.glints.map((s, i) => (
              <path
                key={i}
                className="cstage__glint"
                d={`M${s.x} ${s.y - 11} L${s.x + 2} ${s.y - 2} L${s.x + 11} ${s.y} L${s.x + 2} ${s.y + 2} L${s.x} ${s.y + 11} L${s.x - 2} ${s.y + 2} L${s.x - 11} ${s.y} L${s.x - 2} ${s.y - 2} Z`}
                fill="#fff"
                style={{ animationDelay: `-${s.d}s` }}
              />
            ))}
          </g>

          {/* The lamps: on the truss, or a phone's hanging over its square. */}
          {g.lamps.map((x) => {
            const y = lampAt(x)
            return (
              <g key={x}>
                <rect x={x - 26} y={y - 2} width="52" height="14" rx="3" fill="#1a1630" stroke="#3a3058" />
                <circle className="cstage__lamp" cx={x} cy={y + 10} r="70" fill={url('lamp')} />
                <circle cx={x - 14} cy={y + 5} r="4.5" fill="#fffbe8" />
                <circle cx={x} cy={y + 5} r="4.5" fill="#fffbe8" />
                <circle cx={x + 14} cy={y + 5} r="4.5" fill="#fffbe8" />
                <ellipse cx={x} cy={y + 6} rx="110" ry="1.6" fill="#fff" opacity="0.35" />
              </g>
            )
          })}

          {/* The six element banners: gold rods, a trim, each element's emblem, tassels. */}
          {g.banners.map((x, i) => {
            const top = L.railAt(x) - 104
            const glyph = GLYPHS[i % 6]
            return (
              <g key={x}>
                <rect x={x - 32} y={top - 6} width="64" height="6" rx="3" fill={url('goldH')} />
                <circle cx={x - 33} cy={top - 3} r="5" fill={url('gold')} />
                <circle cx={x + 33} cy={top - 3} r="5" fill={url('gold')} />
                <g className="cstage__banner" style={{ animationDelay: `-${(i * 0.9).toFixed(1)}s` }}>
                  <path d={banner(x, top)} fill={ELEMENTS[i % 6]} />
                  <path d={banner(x, top)} fill={url('cloth')} />
                  <path
                    d={`M${x - 19} ${top + 4} L${x + 19} ${top + 4} L${x + 19} ${top + 76} L${x} ${top + 64} L${x - 19} ${top + 76} Z`}
                    fill="none"
                    stroke="#ffe9a6"
                    strokeWidth="1.6"
                    opacity="0.75"
                  />
                  <circle cx={x} cy={top + 32} r="15" fill="rgb(0 0 0 / 22%)" stroke="#ffe9a6" strokeWidth="1.6" opacity="0.9" />
                  <path
                    transform={`translate(${x} ${top + 32}) scale(0.95)`}
                    d={glyph.d}
                    fill={glyph.line ? 'none' : '#fff'}
                    stroke="#fff"
                    strokeWidth={glyph.line ? 2.2 : 0.6}
                  />
                  <path d={`M${x - 24} ${top + 84} l0 9 M${x + 24} ${top + 84} l0 9`} stroke="#ffe9a6" strokeWidth="2" />
                  <circle cx={x - 24} cy={top + 95} r="3" fill="#ffe9a6" />
                  <circle cx={x + 24} cy={top + 95} r="3" fill="#ffe9a6" />
                </g>
              </g>
            )
          })}

          {/* The wall: panelled, a padded top, the gold rail on its posts, the running text on an LED band. */}
          <path d={`${arc(g.w, g.rail[0], g.rail[1])} L${g.w + 20} ${g.hz + 12} L-20 ${g.hz + 12} Z`} fill="#120d24" />
          <path d={L.seams.map((x) => `M${x} ${f1(L.railAt(x) + 10)} L${x} ${g.hz}`).join(' ')} stroke="#1e1638" strokeWidth="2" />
          <path d={arc(g.w, g.rail[0] + 5, g.rail[1] + 5)} stroke="#2c2048" strokeWidth="10" fill="none" />
          {L.posts.map((x) => (
            <g key={x}>
              <rect x={x - 3} y={f1(L.railAt(x) - 13)} width="6" height="13" fill={url('gold')} />
              <circle cx={x} cy={f1(L.railAt(x) - 14)} r="4" fill={url('gold')} />
            </g>
          ))}
          <path d={arc(g.w, g.rail[0], g.rail[1])} stroke={url('gold')} strokeWidth="5" fill="none" />
          <path d={arc(g.w, g.rail[0] - 1.5, g.rail[1] - 1.5)} stroke="#fff" strokeWidth="1" opacity="0.45" fill="none" />
          <g clipPath={url('ribbonC')}>
            <rect x="0" y={ry0} width={g.w} height={rh} fill={url('ribbonBg')} />
            <text className="cstage__ribbon" x="0" y={ry0 + rh * 0.74} filter={url('glow')}>
              {RUNNING}
            </text>
            <rect x="0" y={ry0} width={g.w} height={rh} fill={url('px')} />
          </g>
          {[0, 1].map((half) => (
            <g key={half} className="cstage__chase" style={{ animationDelay: `-${half * 0.7}s` }}>
              {L.chase.map((x, i) =>
                i % 2 === half ? (
                  <circle key={x} cx={x} cy={ry0 + 1.5} r="1.6" fill="#ffe9a6" />
                ) : (
                  <circle key={x} cx={x + 13} cy={ry0 + rh - 1.5} r="1.6" fill="#ffe9a6" />
                ),
              )}
            </g>
          ))}

          {/* The floor: polished, its seams in perspective, the banners reflected in it. */}
          <rect x="0" y={g.hz} width={g.w} height={g.h - g.hz} fill={url('floor')} />
          <g clipPath={url('floorC')}>
            <path d={L.floorSeams} stroke="#fff" strokeWidth="1" opacity="0.045" />
            {g.banners.map((x, i) => (
              <rect key={x} x={x - 20} y={g.hz + 6} width="40" height={(g.h - g.hz) * 0.14} fill={ELEMENTS[i % 6]} opacity="0.16" />
            ))}
            <rect x="0" y={g.hz} width={g.w} height={(g.h - g.hz) * 0.22} fill={url('reflFade')} />
            <rect className="cstage__haze" x="0" y={g.hz - (g.h - g.hz) * 0.08} width={g.w} height={(g.h - g.hz) * 0.28} fill={url('haze')} />
            <ellipse cx={g.pools[0][0]} cy={g.pools[0][1]} rx={g.pools[0][2] * 1.3} ry={g.pools[0][3] * 1.6} fill={url('teamT')} />
            <ellipse cx={g.pools[1][0]} cy={g.pools[1][1]} rx={g.pools[1][2] * 1.3} ry={g.pools[1][3] * 1.6} fill={url('teamR')} />
            {/* The ring: a dial of gold, its halves glowing in the team colours. */}
            <path className="cstage__half" d={`M${cx} ${cy - ry} A${rx} ${ry} 0 0 0 ${cx} ${cy + ry}`} stroke={MINE} strokeWidth="10" fill="none" opacity="0.28" />
            <path
              className="cstage__half"
              d={`M${cx} ${cy - ry} A${rx} ${ry} 0 0 1 ${cx} ${cy + ry}`}
              stroke={THEIRS}
              strokeWidth="10"
              fill="none"
              opacity="0.28"
              style={{ animationDelay: '-2s' }}
            />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={url('goldH')} strokeWidth="4" />
            <ellipse cx={cx} cy={cy} rx={rx * 0.955} ry={ry * 0.945} fill="none" stroke="#e7b44a" strokeWidth="1.2" opacity="0.55" />
            <path d={L.ticks} stroke="#e7b44a" strokeWidth="1.6" opacity="0.55" />
            <ellipse cx={cx} cy={cy} rx={rx * 0.3} ry={ry * 0.3} fill="none" stroke="#e7b44a" strokeWidth="2" strokeDasharray="12 8" opacity="0.6" />
            <ellipse cx={cx} cy={cy} rx={rx * 0.25} ry={ry * 0.25} fill="none" stroke="#e7b44a" strokeWidth="1" opacity="0.4" />
            {/* The crest: a crown over crossed blades in a laurel, lying on the floor. */}
            <g transform={`translate(${cx} ${cy}) scale(1 0.32)`}>
              <circle className="cstage__crest" r="240" fill={url('crest')} />
              {L.laurel.map((l, i) => (
                <ellipse key={i} cx={l.x} cy={l.y} rx="17" ry="7" transform={`rotate(${l.a} ${l.x} ${l.y})`} fill={url('gold')} />
              ))}
              <path d="M-110 70 L110 -70 M-110 -70 L110 70" stroke="#5a3d12" strokeWidth="16" strokeLinecap="round" />
              <path d="M-110 70 L110 -70 M-110 -70 L110 70" stroke={url('goldH')} strokeWidth="9" strokeLinecap="round" />
              <path d="M-66 -12 L-44 -78 L-17 -34 L0 -96 L17 -34 L44 -78 L66 -12 Z" fill={url('gold')} stroke="#7c5418" strokeWidth="3" />
              <circle cx="0" cy="-58" r="9" fill="#ff5fc8" />
              <circle cx="-36" cy="-36" r="6" fill="#3fd8ff" />
              <circle cx="36" cy="-36" r="6" fill="#4ee07a" />
            </g>
            {g.pools.map(([px, py, prx, pry], i) => (
              <ellipse key={i} className="cstage__pool" cx={px} cy={py} rx={prx} ry={pry} fill={url('pool')} style={{ animationDelay: `-${i * 1.7}s` }} />
            ))}
          </g>
          {/* The barrier at the floor's edge, from your side's teal to theirs' red. */}
          <rect className="cstage__barrier" x="0" y={g.hz - 8} width={g.w} height="16" fill={url('barrier')} opacity="0.22" />
          <rect x="0" y={g.hz - 1.5} width={g.w} height="3" fill={url('barrier')} />

          {/* The spotlights, from the lamps, swaying over the floor. */}
          {g.beams.map(([top, foot, half], i) => {
            const y0 = f1(lampAt(top) + 10)
            return (
              <polygon
                key={i}
                className="cstage__beam"
                points={`${top - 16},${y0} ${top + 16},${y0} ${foot + half},${g.beamFloor} ${foot - half},${g.beamFloor}`}
                fill={url('beamH')}
                mask={url('beamM')}
                style={{ animationDelay: `-${i * 2}s`, opacity: i < 2 ? 1 : 0.7 }}
              />
            )
          })}
        </svg>

        <div className="cstage__motes">
          {MOTES.map(([x, y, drift, s, d], i) => (
            <i
              key={i}
              style={{ left: `${x}%`, top: `${y}%`, animationDuration: `${s}s`, animationDelay: `-${d}s`, '--mx': `${drift}cqw` } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      <div className="cstage__grade" />
    </div>
  )
}
