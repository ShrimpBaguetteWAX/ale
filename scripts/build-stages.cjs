/*
 * Paints the fight stages' still layers to public/assets/stages/<planet>/.
 *
 * A stage is two halves: the planet behind the horizon (sky, sea, the far
 * islands) and the land the fighters stand on (the coast, the turf, its
 * tufts). Everything that never moves is drawn here once, as an image, so
 * the fight page only animates what does: clouds, glints, the surf, the
 * swaying clumps and the marks a blow leaves.
 *
 * Two geometries, one per field: the desktop window is 16:9 with the horizon
 * at 37%; a phone's field is square, with the horizon lower so the islands
 * clear the scorebar.
 *
 * Run from the web root:  node scripts/build-stages.cjs
 */
const path = require('path')
const fs = require('fs')
const sharp = require(path.resolve('node_modules/sharp'))

const OUT = path.resolve('public/assets/stages/veles')
fs.mkdirSync(OUT, { recursive: true })

const GEO = {
  wide: { W: 1600, H: 900, hz: 333, fs: 0.14, farH: 140 },
  tall: { W: 1000, H: 1000, hz: 340, fs: 0.085, farH: 150 },
}

function seeded(n) {
  let s = n
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}
const f1 = (n) => n.toFixed(1)
const wideOf = (g) => g.W === 1600

/* Where the sea meets the sand, by x: a gentle wobble, a little nearer on the left. */
function shoreY(g, x) {
  const D = g.H - g.hz
  const u = x / g.W
  return g.hz + D * (g.fs + 0.016 * Math.sin(u * 9.4 + 1) + 0.008 * Math.sin(u * 23 + 2) - 0.022 * (u - 0.5))
}
function shorePath(g, dy = 0, step = 20) {
  let d = ''
  for (let x = 0; x <= g.W; x += step) d += `${x ? 'L' : 'M'}${x} ${f1(shoreY(g, x) + dy)} `
  return d
}

/* ---- the far side: Veles' archipelago standing on the horizon ---- */
function conifer(x, base, h, c) {
  return `<path d="M${f1(x)} ${f1(base - h)} L${f1(x + h * 0.28)} ${f1(base)} L${f1(x - h * 0.28)} ${f1(base)}Z" fill="${c}"/>`
}
function palm(x, base, h, c) {
  const top = base - h
  const lean = h * 0.18
  let s = `<path d="M${f1(x)} ${f1(base)} Q${f1(x + lean * 0.3)} ${f1(base - h * 0.5)} ${f1(x + lean)} ${f1(top)}" stroke="${c}" stroke-width="${f1(Math.max(1, h * 0.07))}" fill="none"/>`
  for (const a of [-2.6, -2, -1.2, -0.4, 0.3])
    s += `<path d="M${f1(x + lean)} ${f1(top)} q${f1(Math.cos(a) * h * 0.3)} ${f1(Math.sin(a) * h * 0.18 - h * 0.04)} ${f1(Math.cos(a) * h * 0.5)} ${f1(Math.sin(a) * h * 0.1 + h * 0.12)}" stroke="${c}" stroke-width="${f1(Math.max(1, h * 0.06))}" fill="none" stroke-linecap="round"/>`
  return s
}
function island(g, o) {
  const rnd = seeded(o.seed)
  const base = g.farH
  const x0 = o.cx - o.w / 2
  let ridge = `M${f1(x0)} ${base}`
  const pts = []
  for (let i = 0; i <= 24; i++) {
    const u = i / 24
    const x = x0 + u * o.w
    const shape =
      Math.pow(Math.sin(Math.PI * u), 0.8) *
      (o.peak ? 1 - 0.55 * Math.abs(u - o.peak) * 2 + (Math.abs(u - o.peak) < 0.12 ? 0.25 : 0) : 1)
    const y = base - o.h * Math.max(0, shape) * (0.86 + rnd() * 0.2)
    pts.push([x, y])
    ridge += ` L${f1(x)} ${f1(y)}`
  }
  ridge += ` L${f1(x0 + o.w)} ${base}Z`
  let s = `<ellipse cx="${o.cx}" cy="${base}" rx="${f1(o.w * 0.62)}" ry="${f1(Math.max(3, o.h * 0.07))}" fill="#8ee2cf" opacity=".9"/>`
  s += `<ellipse cx="${o.cx}" cy="${base - 0.5}" rx="${f1(o.w * 0.52)}" ry="${f1(Math.max(1.6, o.h * 0.035))}" fill="#efe2b4" opacity=".9"/>`
  s += `<path d="${ridge}" fill="${o.c}"/>`
  s += `<path d="${ridge}" fill="url(#flank)" opacity=".55"/>`
  if (o.snow) {
    const [px, py] = pts.reduce((a, b) => (b[1] < a[1] ? b : a))
    s += `<path d="M${f1(px)} ${f1(py)} l${f1(-o.h * 0.2)} ${f1(o.h * 0.22)} l${f1(o.h * 0.1)} ${f1(-o.h * 0.04)} l${f1(o.h * 0.1)} ${f1(o.h * 0.06)} l${f1(o.h * 0.12)} ${f1(-o.h * 0.07)} l${f1(o.h * 0.08)} ${f1(o.h * 0.05)}Z" fill="#eef6f4" opacity=".85"/>`
  }
  if (o.trees)
    for (let i = 2; i < pts.length - 2; i += 1) {
      if (rnd() > o.trees) continue
      const [x, y] = pts[i]
      s += conifer(x + (rnd() - 0.5) * 8, y + 3, 6 + rnd() * o.h * 0.14, o.tc)
    }
  if (o.palms)
    for (let i = 0; i < o.palms; i++)
      s += palm(o.cx + (i - (o.palms - 1) / 2) * o.w * 0.32, base - o.h * 0.45, o.h * 1.5 + i * 2, o.tc)
  return s
}
function islands(g) {
  const list = wideOf(g)
    ? [
        { cx: 1260, w: 460, h: 128, c: '#86b8b2', tc: '#6fa39d', peak: 0.42, snow: true, trees: 0.25, seed: 5 },
        { cx: 1545, w: 110, h: 16, c: '#7fb3a9', tc: '#6a9d94', seed: 9, palms: 1 },
        { cx: 240, w: 600, h: 104, c: '#4f8c6f', tc: '#356c52', peak: 0.36, trees: 0.75, seed: 3 },
        { cx: 780, w: 140, h: 22, c: '#5f9a7d', tc: '#3f7a5e', seed: 7, palms: 2 },
        { cx: 1000, w: 56, h: 9, c: '#6aa58a', tc: '#4f8a70', seed: 2 },
      ]
    : [
        { cx: 840, w: 300, h: 96, c: '#86b8b2', tc: '#6fa39d', peak: 0.45, snow: true, trees: 0.25, seed: 5 },
        { cx: 170, w: 380, h: 82, c: '#4f8c6f', tc: '#356c52', peak: 0.4, trees: 0.75, seed: 3 },
        { cx: 560, w: 96, h: 18, c: '#5f9a7d', tc: '#3f7a5e', seed: 7, palms: 2 },
      ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.W}" height="${g.farH}" viewBox="0 0 ${g.W} ${g.farH}"><defs><linearGradient id="flank" x1="0" x2="1"><stop offset="0" stop-color="#16382c"/><stop offset=".55" stop-color="#16382c" stop-opacity="0"/><stop offset="1" stop-color="#e8f4ee" stop-opacity=".25"/></linearGradient></defs>${list.map((o) => island(g, o)).join('')}</svg>`
}

/* ---- the sea: from the horizon down to the waterline, deep teal shading to turquoise ---- */
function sea(g) {
  const D = g.H - g.hz
  const y1 = g.hz + D * 0.19
  let p = `M0 ${g.hz - 2} L${g.W} ${g.hz - 2}`
  for (let x = g.W; x >= 0; x -= 20) p += ` L${x} ${f1(shoreY(g, x) + 4)}`
  return `<defs>
    <linearGradient id="seag" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${g.hz}" y2="${f1(y1)}"><stop offset="0" stop-color="#a8e2da"/><stop offset=".1" stop-color="#6fc9c8"/><stop offset=".42" stop-color="#2e9fb0"/><stop offset=".75" stop-color="#1f92a6"/><stop offset="1" stop-color="#35b4b6"/></linearGradient>
    <radialGradient id="deep" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0a4658" stop-opacity=".32"/><stop offset="1" stop-color="#0a4658" stop-opacity="0"/></radialGradient></defs>
    <path d="${p}Z" fill="url(#seag)"/>
    <ellipse cx="${g.W * 0.32}" cy="${f1(g.hz + D * 0.08)}" rx="${g.W * 0.2}" ry="${f1(D * 0.035)}" fill="url(#deep)"/>
    <ellipse cx="${g.W * 0.7}" cy="${f1(g.hz + D * 0.06)}" rx="${g.W * 0.16}" ry="${f1(D * 0.03)}" fill="url(#deep)"/>`
}

/* ---- the sea's light: short glints, finer toward the horizon, never past the waterline ---- */
function glints(g) {
  const rnd = seeded(13)
  let s = ''
  for (let i = 0; i < (wideOf(g) ? 160 : 100); i++) {
    const x = rnd() * g.W
    const t = Math.pow(rnd(), 1.6)
    const y1 = shoreY(g, x) - 6
    const y = g.hz + 2 + t * (y1 - g.hz - 4)
    const w = 4 + t * 26
    s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(0.6 + t * 1.4)}" rx="1" fill="#f4fffb" opacity="${(0.25 + rnd() * 0.5).toFixed(2)}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}">${s}</svg>`
}

/* ---- the coast: shallows, wet and dry sand, rocks, and the tufts on the turf ---- */
function rock(x, y, w, rnd) {
  const h = w * (0.45 + rnd() * 0.2)
  const p = `M${f1(x - w / 2)} ${f1(y)} Q${f1(x - w * 0.45)} ${f1(y - h * 0.9)} ${f1(x - w * 0.05)} ${f1(y - h)} Q${f1(x + w * 0.4)} ${f1(y - h * 0.95)} ${f1(x + w / 2)} ${f1(y)}Z`
  return `<ellipse cx="${f1(x + w * 0.12)}" cy="${f1(y + 1)}" rx="${f1(w * 0.62)}" ry="${f1(h * 0.18)}" fill="#1b2e2a" opacity=".45"/><path d="${p}" fill="url(#rockg)"/><path d="M${f1(x - w * 0.3)} ${f1(y - h * 0.62)} Q${f1(x - w * 0.12)} ${f1(y - h * 0.96)} ${f1(x + w * 0.14)} ${f1(y - h * 0.9)}" stroke="#d8d3c4" stroke-width="${f1(Math.max(1, w * 0.05))}" fill="none" opacity=".6"/>`
}
function tuft(x, y, h, rnd, cols) {
  let s = `<ellipse cx="${f1(x + h * 0.1)}" cy="${f1(y)}" rx="${f1(h * 0.42)}" ry="${f1(h * 0.09)}" fill="#163a1c" opacity=".35"/>`
  const n = 5 + Math.floor(rnd() * 4)
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - 0.5) * 1.3 + (rnd() - 0.5) * 0.3
    const len = h * (0.6 + rnd() * 0.5)
    const tx = x + Math.sin(a) * len
    const ty = y - Math.cos(a) * len
    s += `<path d="M${f1(x + (rnd() - 0.5) * h * 0.2)} ${f1(y)} Q${f1(x + Math.sin(a) * len * 0.3)} ${f1(y - len * 0.55)} ${f1(tx)} ${f1(ty)}" stroke="${cols[i % cols.length]}" stroke-width="${f1(Math.max(1, h * 0.07))}" fill="none" stroke-linecap="round"/>`
  }
  return s
}
function flowers(x, y, h, rnd) {
  let s = ''
  const c = ['#ffffff', '#fff1a0', '#ffb3c1', '#cfe9ff'][Math.floor(rnd() * 4)]
  for (let i = 0; i < 4; i++) {
    const fx = x + (rnd() - 0.5) * h * 0.9
    const fy = y - rnd() * h * 0.25
    s += `<circle cx="${f1(fx)}" cy="${f1(fy)}" r="${f1(Math.max(1, h * 0.07))}" fill="${c}"/><circle cx="${f1(fx)}" cy="${f1(fy)}" r="${f1(Math.max(0.5, h * 0.025))}" fill="#d9952f"/>`
  }
  return s
}
function coast(g) {
  const D = g.H - g.hz
  const rnd = seeded(21)
  const wide = wideOf(g)
  const sandEnd = (x) =>
    shoreY(g, x) + D * (0.034 + 0.012 * Math.sin((x / g.W) * 13 + 0.5) + 0.006 * Math.sin((x / g.W) * 41))
  let wet = shorePath(g, 0) + ` L${g.W} ${f1(shoreY(g, g.W) + D * 0.014)}`
  for (let x = g.W; x >= 0; x -= 20) wet += ` L${x} ${f1(shoreY(g, x) + D * 0.014)}`
  let dry = shorePath(g, D * 0.01) + ` L${g.W} ${f1(sandEnd(g.W))}`
  for (let x = g.W; x >= 0; x -= 20) dry += ` L${x} ${f1(sandEnd(x))}`
  let shallow = shorePath(g, -D * 0.03) + ` L${g.W} ${f1(shoreY(g, g.W) + 2)}`
  for (let x = g.W; x >= 0; x -= 20) shallow += ` L${x} ${f1(shoreY(g, x) + 2)}`
  let fringe = ''
  for (let x = 0; x < g.W; x += wide ? 6 : 7) {
    const y = sandEnd(x) + 1
    const len = 3 + rnd() * (wide ? 7 : 9)
    fringe += `<path d="M${f1(x)} ${f1(y + 2)} l${f1((rnd() - 0.5) * 4)} ${f1(-len)}" stroke="${['#3f8636', '#57a043', '#6fb850', '#2f6e2c'][Math.floor(rnd() * 4)]}" stroke-width="1.6" stroke-linecap="round"/>`
  }
  const R = wide
    ? [[170, 0, 46], [235, 6, 24], [610, 3, 18], [1360, 4, 30], [1410, 8, 18], [920, -D * 0.07, 16]]
    : [[80, 4, 34], [135, 9, 18], [840, 6, 22], [400, -D * 0.05, 14]]
  const rocks = R.map(([x, dy, w]) => rock(x, shoreY(g, x) + dy, w, rnd)).join('')
  let turf = ''
  const N = wide ? 54 : 46
  for (let i = 0; i < N; i++) {
    const x = rnd() * g.W
    const yMin = sandEnd(x) + D * 0.04
    const y = yMin + Math.pow(rnd(), 0.85) * (g.H - yMin)
    const t = (y - g.hz) / D
    const h = (wide ? 7 : 9) + t * (wide ? 40 : 54)
    turf += tuft(x, y, h, rnd, ['#2f6e2c', '#3f8636', '#57a043', '#7cc25a', '#a8d878'])
    if (rnd() > 0.62) turf += flowers(x + h * 0.5, y - h * 0.1, h * 0.8, rnd)
  }
  return `<defs>
    <linearGradient id="sandg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e9dbb0"/><stop offset="1" stop-color="#d8c493"/></linearGradient>
    <linearGradient id="shallowg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5fd0c8" stop-opacity="0"/><stop offset=".55" stop-color="#7fe2d6" stop-opacity=".85"/><stop offset="1" stop-color="#b8f2e6"/></linearGradient>
    <radialGradient id="rockg" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#a9a597"/><stop offset=".55" stop-color="#6c6a62"/><stop offset="1" stop-color="#3a3c3a"/></radialGradient>
    <filter id="sandn" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="8"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .26  0 0 0 0 .14  0 0 0 .55 -.18"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  </defs>
    <path d="${shallow}" fill="url(#shallowg)"/>
    <path d="${dry}" fill="url(#sandg)"/><path d="${dry}" fill="#000" filter="url(#sandn)"/>
    <path d="${wet}" fill="#b49f74"/><path d="${wet}" fill="#000" filter="url(#sandn)" opacity=".6"/>
    <g>${fringe}</g>${rocks}<g>${turf}</g>`
}
/* The sea and the coast in one image: they never move against each other. */
const shore = (g) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}">${sea(g)}${coast(g)}</svg>`

/* ---- the surf: a foam line along the waterline; two of them lap in turn ---- */
function foam(g, phase) {
  const D = g.H - g.hz
  const off = phase ? -D * 0.012 : 0
  let line = ''
  for (let x = 0; x <= g.W; x += 10)
    line += `${x ? 'L' : 'M'}${x} ${f1(shoreY(g, x) - 1 + off + Math.sin(x * 0.09 + phase * 2) * 1.2)} `
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}" fill="none" stroke="#ffffff" stroke-linecap="round"><path d="${line}" stroke-width="${phase ? 1.6 : 2.6}" opacity="${phase ? 0.55 : 0.9}"/></svg>`
}

/* A clump of tall grass with a fern frond and two flowers; the page sways it. */
const CLUMP = (() => {
  const rnd = seeded(31)
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="240" viewBox="0 0 100 80" fill="none" stroke-linecap="round">'
  s += '<ellipse cx="52" cy="78" rx="34" ry="4" fill="#123018" opacity=".45" stroke="none"/>'
  for (let i = 0; i < 16; i++) {
    const a = (i / 15 - 0.5) * 1.5
    const len = 40 + rnd() * 34
    const x = 50 + (rnd() - 0.5) * 16
    s += `<path d="M${f1(x)} 78 Q${f1(x + Math.sin(a) * len * 0.35)} ${f1(78 - len * 0.6)} ${f1(x + Math.sin(a) * len)} ${f1(78 - Math.cos(a) * len)}" stroke="${['#2c6a2a', '#3f8636', '#5aa845', '#86c860'][i % 4]}" stroke-width="2.6"/>`
  }
  s += '<path d="M28 78 Q20 52 8 40" stroke="#3b7d3a" stroke-width="2"/>'
  for (let k = 0; k < 8; k++) {
    const t = k / 8
    const x = 28 - 20 * t
    const y = 78 - 38 * t
    s += `<path d="M${f1(x)} ${f1(y)} q-6 -2 -9 -6 M${f1(x)} ${f1(y)} q3 -6 2 -10" stroke="#4f9a44" stroke-width="1.6"/>`
  }
  s += '<circle cx="66" cy="34" r="3.6" fill="#ffffff" stroke="none"/><circle cx="66" cy="34" r="1.4" fill="#e0a030" stroke="none"/><circle cx="74" cy="44" r="3" fill="#ffb3c1" stroke="none"/><circle cx="74" cy="44" r="1.2" fill="#e0a030" stroke="none"/></svg>'
  return s
})()

/* What a blow tears out of the turf: a scatter of loose blades. */
const BLADES = (() => {
  const rnd = seeded(41)
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 100 60" fill="none" stroke-linecap="round">'
  for (let i = 0; i < 9; i++) {
    const x = 20 + rnd() * 60
    const y = 20 + rnd() * 30
    const a = rnd() * 6.28
    s += `<path d="M${f1(x)} ${f1(y)} l${f1(Math.cos(a) * 7)} ${f1(Math.sin(a) * 7)}" stroke="${['#3f8636', '#6fb850', '#2f6e2c'][i % 3]}" stroke-width="2.2"/>`
  }
  return s + '</svg>'
})()

/* ---- the turf: a seamless tile of coastal grass, laid on the floor plane ---- */
function grassTile() {
  const S = 512
  let seed = 11
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  /* Drawn again across every edge it touches, so the tile repeats without a seam. */
  const wrap = (x, y, r, draw) => {
    let s = ''
    for (const dx of [-S, 0, S])
      for (const dy of [-S, 0, S]) {
        const X = x + dx
        const Y = y + dy
        if (X < -r || X > S + r || Y < -r || Y > S + r) continue
        s += draw(X, Y)
      }
    return s
  }
  const BL = ['#2c6a2a', '#357a30', '#3f8a37', '#4f9a3f', '#5fae47', '#78c257', '#94d26a']
  let blades = ''
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const len = 7 + rnd() * 12
    const ang = (rnd() - 0.5) * 0.7
    const w = 1.3 + rnd() * 1.3
    const c = pick(BL)
    const bend = (rnd() - 0.5) * 6
    blades += wrap(x, y, 24, (X, Y) => {
      const tx = X + Math.sin(ang) * len
      const ty = Y - Math.cos(ang) * len
      return `<path d="M${X.toFixed(1)} ${Y.toFixed(1)} Q${(X + bend).toFixed(1)} ${(Y - len * 0.6).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}" stroke="${c}" stroke-width="${w.toFixed(2)}"/>`
    })
  }
  let tips = ''
  for (let i = 0; i < 380; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const len = 4 + rnd() * 6
    tips += wrap(x, y, 12, (X, Y) => `<path d="M${X.toFixed(1)} ${Y.toFixed(1)} l${((rnd() - 0.5) * 3).toFixed(1)} ${(-len).toFixed(1)}" stroke="${pick(['#a8dc78', '#c2e88a', '#b6e07e'])}" stroke-width="1.1"/>`)
  }
  let clover = ''
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S
    const y = rnd() * S
    clover += wrap(x, y, 20, (X, Y) => {
      let c = ''
      for (let k = 0; k < 7; k++) {
        const a = rnd() * 6.28
        const r = 3 + rnd() * 7
        c += `<circle cx="${(X + Math.cos(a) * r).toFixed(1)}" cy="${(Y + Math.sin(a) * r).toFixed(1)}" r="${(2.2 + rnd() * 1.6).toFixed(1)}" fill="${pick(['#2a5e2a', '#336d30', '#3b7a35'])}"/>`
      }
      return c
    })
  }
  let flw = ''
  for (let i = 0; i < 42; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const c = pick(['#ffffff', '#fff3a8', '#ffb3c1', '#ffe08a', '#cfe9ff'])
    const r = 1.7 + rnd() * 1.4
    flw += wrap(x, y, 6, (X, Y) => `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}"/><circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${(r * 0.38).toFixed(1)}" fill="#e2a63a"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="3" seed="7" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.30  0 0 0 0 0.10  1.6 0 0 0 -0.55"/></filter>
    <filter id="light" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="21" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.82  0 0 0 0 0.36  0 0 1.5 0 -0.72"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="4" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.12  0 0 0 0 0.04  0 0 0 0.9 -0.25"/></filter>
  </defs>
  <rect width="${S}" height="${S}" fill="#3f8636"/>
  <rect width="${S}" height="${S}" filter="url(#mottle)"/>
  <rect width="${S}" height="${S}" filter="url(#light)"/>
  <rect width="${S}" height="${S}" filter="url(#grain)" opacity=".6"/>
  <g>${clover}</g>
  <g fill="none" stroke-linecap="round">${blades}</g>
  <g fill="none" stroke-linecap="round" opacity=".85">${tips}</g>
  <g>${flw}</g>
</svg>`
}

async function paint(name, svg, opts = {}) {
  const file = path.join(OUT, `${name}.webp`)
  let img = sharp(Buffer.from(svg))
  if (opts.width) img = img.resize({ width: opts.width })
  await img.webp({ quality: opts.quality ?? 80, alphaQuality: 90, effort: 6 }).toFile(file)
  console.log(name.padEnd(16), Math.round(fs.statSync(file).size / 1024), 'KB')
}

;(async () => {
  for (const [form, g] of Object.entries(GEO)) {
    await paint(`far-${form}`, islands(g), { quality: 82 })
    await paint(`shore-${form}`, shore(g), { quality: 78 })
    await paint(`glints-${form}`, glints(g), { quality: 70 })
    await paint(`foam-${form}-a`, foam(g, 0), { quality: 70 })
    await paint(`foam-${form}-b`, foam(g, 1), { quality: 70 })
  }
  await paint('clump', CLUMP, { quality: 82 })
  await paint('blades', BLADES, { quality: 82 })
  await paint('grass', grassTile(), { quality: 80 })
})()
