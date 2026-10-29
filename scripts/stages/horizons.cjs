/*
 * The strip of a planet's country standing on the horizon, as layered
 * silhouettes: each range hazed toward the colour of its sky, so the far ones
 * melt into it. Writes backdrops/a/horizon/<planet>-<wide|tall>.webp.
 * Run from the scratchpad:  node horizons.cjs
 */
const fs = require('fs')
const path = require('path')
const sharp = require(path.resolve('node_modules/sharp'))

let OUT

/* ---- small tools ---- */
let SEEDADD = 0
let FLIP = false
function seeded(n) {
  let s = n + SEEDADD * 7919
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}
const f1 = (n) => n.toFixed(1)
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')
/* Smooth noise in about [-1, 1]: a few sines with random frequency and phase. */
function fbm(seed, oct = 4) {
  const r = seeded(seed)
  const w = []
  for (let k = 0; k < oct; k++) w.push([Math.pow(2, k) * (2 + r() * 2), r() * 6.28, Math.pow(0.5, k)])
  return (u) => w.reduce((s, [f, p, a]) => s + a * Math.sin(u * f * 6.28 + p), 0) / 1.5
}
/* A peak's profile: 1 at its middle, 0 at its flanks' feet; `sharp` > 1 hollows the sides, < 1 domes it. */
const peak = (u, pu, w, sharp) => {
  const t = Math.abs(u - pu) / w
  return t >= 1 ? 0 : Math.pow(1 - t, sharp)
}
let uid = 0
const nid = (p) => `${p}${uid++}`

/*
 * One range. `h(u)` is its height in px at u in 0..1. Filled top to base with
 * the colour fading toward the haze; the base always melts into the haze.
 */
function range(g, { h, color, haze, fog = 0.35, step = 4, extra = '' }) {
  const id = nid('r')
  const pts = []
  for (let x = 0; x <= g.W + step; x += step) pts.push([x, g.H - Math.max(0, h(Math.min(1, x / g.W)))])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join(' ') + ` L${g.W + step} ${g.H} L0 ${g.H}Z`
  const top = Math.min(...pts.map((p) => p[1]))
  return {
    pts,
    svg: `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(top)}" y2="${g.H}"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${mix(color, haze, fog)}"/></linearGradient><clipPath id="${id}c"><path d="${d}"/></clipPath></defs><path d="${d}" fill="url(#${id})"/><g clip-path="url(#${id}c)">${extra}</g>`,
    clip: `${id}c`,
  }
}
/* The side of a peak away from the sun, shaded: a wedge from the summit down. */
function facets(g, peaks, side, shade, a = 0.3) {
  return peaks
    .map(([pu, ph, w]) => {
      const x = pu * g.W
      const y = g.H - ph
      const lit = FLIP ? (side === 'l' ? 'r' : 'l') : side
      const far = lit === 'l' ? w * g.W * 1.1 : -w * g.W * 1.1
      return `<path d="M${f1(x)} ${f1(y)} L${f1(x + far)} ${g.H} L${f1(x)} ${g.H}Z" fill="${shade}" opacity="${a}"/>`
    })
    .join('')
}
/* Snow above a noisy line, clipped to the range it lies on. */
function snow(g, peaks, color, depth, seed) {
  const n = fbm(seed, 3)
  return peaks
    .map(([pu, ph, w]) => {
      const x = pu * g.W
      const y = g.H - ph
      const line = ph * depth
      const half = w * g.W * 0.5
      let d = `M${f1(x - half)} ${f1(y + line * 1.4)}`
      for (let i = 0; i <= 8; i++) {
        const t = i / 8
        d += ` L${f1(x - half + t * half * 2)} ${f1(y + line * (0.9 + 0.5 * n(pu + t) ) + (Math.abs(t - 0.5) * line * 1.4))}`
      }
      d += ` L${f1(x + half)} ${f1(y - 4)} L${f1(x - half)} ${f1(y - 4)}Z`
      return `<path d="${d}" fill="${color}" opacity=".92"/>`
    })
    .join('')
}
const withExtra = (g, o, fn) => {
  const r = range(g, o)
  return r
}

function conifer(x, base, h, c) {
  return `<path d="M${f1(x)} ${f1(base - h)} L${f1(x + h * 0.26)} ${f1(base)} L${f1(x - h * 0.26)} ${f1(base)}Z" fill="${c}"/>`
}
function crown(x, base, h, c) {
  const e = (dx, dy, rx, ry) => `<ellipse cx="${f1(x + dx * h)}" cy="${f1(base - h * (0.5 + dy))}" rx="${f1(h * rx)}" ry="${f1(h * ry)}" fill="${c}"/>`
  return e(0, 0, 0.55, 0.42) + e(-0.42, -0.1, 0.36, 0.3) + e(0.4, -0.06, 0.4, 0.32) + e(0.05, 0.22, 0.34, 0.26)
}
function palm(x, base, h, c) {
  const top = base - h
  const lean = h * 0.18
  let s = `<path d="M${f1(x)} ${f1(base)} Q${f1(x + lean * 0.3)} ${f1(base - h * 0.5)} ${f1(x + lean)} ${f1(top)}" stroke="${c}" stroke-width="${f1(Math.max(1.2, h * 0.07))}" fill="none"/>`
  for (const a of [-2.7, -2.1, -1.3, -0.5, 0.25])
    s += `<path d="M${f1(x + lean)} ${f1(top)} q${f1(Math.cos(a) * h * 0.3)} ${f1(Math.sin(a) * h * 0.18 - h * 0.04)} ${f1(Math.cos(a) * h * 0.5)} ${f1(Math.sin(a) * h * 0.1 + h * 0.12)}" stroke="${c}" stroke-width="${f1(Math.max(1.2, h * 0.06))}" fill="none" stroke-linecap="round"/>`
  return s
}
/* Things standing along a range's ridge. */
function along(range, g, every, make, seed, skip = 0) {
  const r = seeded(seed)
  let s = ''
  for (let i = 2; i < range.pts.length - 2; i += every) {
    if (r() < skip) continue
    const [x, y] = range.pts[i]
    s += make(x + (r() - 0.5) * every * 2, y, r)
  }
  return s
}

/* ---- the planets ---- */
const wrap = (g, inner, haze, extraTop = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}"><defs><linearGradient id="hz" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${haze}" stop-opacity="0"/><stop offset="1" stop-color="${haze}" stop-opacity=".75"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="2.2"/></filter><filter id="soft2"><feGaussianBlur stdDeviation="5"/></filter></defs>${inner}<rect x="0" y="${f1(g.H * 0.74)}" width="${g.W}" height="${f1(g.H * 0.26)}" fill="url(#hz)"/>${extraTop}</svg>`

/* Naron: snowy ranges, the lit faces to the sun on the left. */
function naron(g) {
  const haze = '#e2ecf3'
  const H = g.H
  const farP = [[0.08, 0.5], [0.24, 0.66], [0.43, 0.48], [0.6, 0.74], [0.78, 0.55], [0.94, 0.6]]
  const midP = [[0.04, 0.62], [0.19, 0.88], [0.36, 0.7], [0.53, 1], [0.7, 0.78], [0.86, 0.94], [1, 0.6]]
  const nz = fbm(11, 4)
  const far = range(g, {
    color: mix('#8da4c0', haze, 0.45), haze, fog: 0.5,
    h: (u) => H * Math.max(...farP.map(([pu, ph]) => ph * peak(u, pu, 0.13, 1.05))) * (0.94 + 0.05 * nz(u * 3)),
  })
  const mp = midP.map(([pu, ph]) => [pu, ph * H * 0.86, 0.1])
  const mid = range(g, {
    color: mix('#566f93', haze, 0.12), haze, fog: 0.4,
    h: (u) => H * 0.86 * Math.max(...midP.map(([pu, ph]) => ph * peak(u, pu, 0.1, 1.0))) * (0.93 + 0.07 * nz(u * 9)),
  })
  const midDecor = `<g clip-path="url(#${mid.clip})">${facets(g, mp, 'l', '#1f2e4c', 0.38)}${snow(g, mp, '#f2f7fb', 0.34, 4)}</g>`
  const near = range(g, {
    color: '#2e3f5a', haze, fog: 0.55,
    h: (u) => H * (0.2 + 0.07 * nz(u * 5 + 3) + 0.05 * nz(u * 17)),
  })
  return wrap(g, far.svg + mid.svg + midDecor + near.svg, haze)
}

/* Kavian: grey crags, needle spires and hoodoos rising out of fog. */
function kavian(g) {
  const haze = '#b9b597'
  const H = g.H
  const nz = fbm(31, 5)
  /* Spires: [centre, height, half-width], jagged, some broken off flat. */
  const mk = (n, hMin, hMax, wMin, wMax, seed) => {
    const q = seeded(seed)
    return Array.from({ length: n }, (_, i) => [(i + 0.3 + q() * 0.4) / n, hMin + q() * (hMax - hMin), wMin + q() * (wMax - wMin)])
  }
  const farS = mk(11, 0.4, 0.86, 0.035, 0.07, 3)
  const midS = mk(15, 0.45, 1.0, 0.02, 0.045, 8)
  const spire = (u, [pu, ph, w]) => ph * peak(u, pu, w, 1.18)
  const far = range(g, {
    color: mix('#59634f', haze, 0.4), haze, fog: 0.55, step: 2,
    h: (u) => H * Math.max(0.12, ...farS.map((s) => spire(u, s))) * (0.97 + 0.03 * nz(u * 60)),
  })
  const midPk = midS.map(([pu, ph, w]) => [pu, ph * H * 0.9, w * 1.2])
  const mid = range(g, {
    color: mix('#2f3829', haze, 0.06), haze, fog: 0.5, step: 2,
    h: (u) => H * 0.9 * Math.max(0.18, ...midS.map((s) => spire(u, s))) * (0.96 + 0.05 * nz(u * 80)),
    extra: facets(g, midPk, 'l', '#0a0e08', 0.42),
  })
  /* Hoodoos: a pillar with a heavier cap, banded, hazed rather than black. */
  const hoodoo = (u, w, h, c) => {
    const x = u * g.W
    const hw = w * g.W * 0.5
    const top = H - h * H
    const capH = h * H * 0.14
    let bands = ''
    for (let i = 1; i < 5; i++) bands += `<path d="M${f1(x - hw * 0.9)} ${f1(top + capH + ((h * H - capH) * i) / 5)} h${f1(hw * 1.8)}" stroke="#0c1008" stroke-opacity=".22" stroke-width="1.3"/>`
    return `<path d="M${f1(x - hw * 0.75)} ${H} L${f1(x - hw * 0.5)} ${f1(top + capH)} L${f1(x - hw * 1.2)} ${f1(top + capH * 0.8)} L${f1(x - hw * 0.9)} ${f1(top)} L${f1(x + hw)} ${f1(top + 3)} L${f1(x + hw * 1.25)} ${f1(top + capH * 0.9)} L${f1(x + hw * 0.55)} ${f1(top + capH)} L${f1(x + hw * 0.8)} ${H}Z" fill="${c}"/>${bands}`
  }
  const hz = (c) => mix(c, haze, 0.28)
  const hoodoos = g.second ? '' : hoodoo(0.12, 0.028, 0.66, hz('#3a4333')) + hoodoo(0.31, 0.022, 0.5, hz('#3a4333')) + hoodoo(0.58, 0.03, 0.74, hz('#343d2e')) + hoodoo(0.64, 0.02, 0.5, hz('#3a4333')) + hoodoo(0.88, 0.026, 0.6, hz('#343d2e'))
  const near = range(g, {
    color: '#1d231a', haze, fog: 0.6, step: 3,
    h: (u) => H * (0.17 + 0.1 * Math.abs(nz(u * 7)) + 0.04 * nz(u * 31)),
  })
  const fog = `<g filter="url(#soft2)" opacity=".75"><rect x="-20" y="${f1(H * 0.62)}" width="${g.W + 40}" height="${f1(H * 0.3)}" fill="${mix(haze, '#ffffff', 0.18)}"/></g>`
  return wrap(g, far.svg + mid.svg + hoodoos + fog + near.svg, haze)
}

/* Eyeke: jungle canopy over a teal sea, palms, and karst towers. */
function eyeke(g) {
  const haze = '#dceec0'
  const H = g.H
  const nz = fbm(41, 5)
  const bump = (u, f, a) => a * Math.abs(Math.sin(u * f * Math.PI * 2 + 1))
  const far = range(g, {
    color: mix('#4d9a74', haze, 0.5), haze, fog: 0.5,
    h: (u) => H * (0.34 + 0.2 * peak(u, 0.3, 0.3, 0.8) + 0.26 * peak(u, 0.8, 0.26, 0.8) + 0.05 * bump(u, 38, 1) + 0.04 * nz(u * 6)),
  })
  const mid = range(g, {
    color: mix('#2f7a52', haze, 0.14), haze, fog: 0.4,
    h: (u) => H * (0.26 + 0.3 * peak(u, 0.42, 0.34, 0.7) + 0.18 * peak(u, 0.9, 0.2, 0.9) + 0.05 * bump(u, 52, 1) + 0.03 * nz(u * 9)),
  })
  /* Karst towers: steep green-topped limestone. */
  const tower = (u, w, h, c) => {
    const x = u * g.W
    const hw = w * g.W * 0.5
    const top = H - h * H
    return `<path d="M${f1(x - hw)} ${H} Q${f1(x - hw * 1.05)} ${f1(top + h * H * 0.4)} ${f1(x - hw * 0.55)} ${f1(top + 6)} Q${f1(x)} ${f1(top - 5)} ${f1(x + hw * 0.6)} ${f1(top + 5)} Q${f1(x + hw * 1.05)} ${f1(top + h * H * 0.45)} ${f1(x + hw)} ${H}Z" fill="${c}"/><path d="M${f1(x - hw * 0.62)} ${f1(top + 7)} Q${f1(x)} ${f1(top - 9)} ${f1(x + hw * 0.66)} ${f1(top + 6)} Q${f1(x)} ${f1(top + 18)} ${f1(x - hw * 0.62)} ${f1(top + 7)}Z" fill="#3f9a62"/>`
  }
  const towers = g.second ? '' : tower(0.63, 0.034, 0.9, mix('#4f6a5c', haze, 0.12)) + tower(0.678, 0.025, 0.66, mix('#476256', haze, 0.1)) + tower(0.18, 0.03, 0.74, mix('#4f6a5c', haze, 0.18)) + tower(0.86, 0.022, 0.55, mix('#4f6a5c', haze, 0.2))
  const near = range(g, {
    color: '#1b5a40', haze, fog: 0.3,
    h: (u) => H * (0.2 + 0.1 * peak(u, 0.16, 0.22, 0.9) + 0.08 * peak(u, 0.72, 0.18, 0.9) + 0.045 * bump(u, 70, 1) + 0.02 * nz(u * 22)),
  })
  const palms = along(near, g, 11, (x, y, r) => palm(x, y + 4, 26 + r() * 30, '#103c2c'), 5, 0.55)
  const crowns = along(near, g, 9, (x, y, r) => crown(x, y + 4, 14 + r() * 16, r() < 0.5 ? '#164c37' : '#1b5a40'), 9, 0.3)
  return wrap(g, far.svg + mid.svg + towers + near.svg + crowns + palms, haze)
}

/* Neri: forested ridges in a golden evening, the light on the sun's side (right). */
function neri(g) {
  const haze = '#f3c47e'
  const H = g.H
  const nz = fbm(51, 5)
  const far = range(g, {
    color: mix('#7a6a8c', haze, 0.4), haze, fog: 0.5,
    h: (u) => H * (0.36 + 0.24 * peak(u, 0.22, 0.34, 0.8) + 0.3 * peak(u, 0.7, 0.3, 0.8) + 0.04 * nz(u * 8)),
  })
  const mid = range(g, {
    color: mix('#4f4360', haze, 0.18), haze, fog: 0.4,
    h: (u) => H * (0.28 + 0.26 * peak(u, 0.5, 0.4, 0.8) + 0.2 * peak(u, 0.06, 0.22, 0.9) + 0.04 * nz(u * 11)),
  })
  const midTrees = along(mid, g, 3, (x, y, r) => conifer(x, y + 4, 9 + r() * 15, mix('#4f4360', haze, 0.18)), 3, 0.15)
  const near = range(g, {
    color: '#2b2535', haze, fog: 0.45,
    h: (u) => H * (0.2 + 0.13 * peak(u, 0.84, 0.3, 0.9) + 0.1 * peak(u, 0.3, 0.3, 0.9) + 0.03 * nz(u * 15)),
  })
  const nearTrees = along(near, g, 2, (x, y, r) => conifer(x, y + 5, 14 + r() * 26, '#241f2d'), 7, 0.05)
  /* Gilded light on the sun's side. */
  const rimId = nid('rim')
  const rim = `<defs><linearGradient id="${rimId}" x1="0" x2="1"><stop offset=".45" stop-color="#ffd890" stop-opacity="${FLIP ? 0.34 : 0}"/><stop offset="1" stop-color="#ffd890" stop-opacity=".34"/></linearGradient></defs><rect width="${g.W}" height="${g.H}" fill="url(#${rimId})" style="mix-blend-mode:screen"/>`
  return wrap(g, far.svg + mid.svg + midTrees + near.svg + nearTrees, haze, rim)
}

/* Magor: red mesas, and three active volcanoes with glowing craters, lava and ash. */
function magor(g) {
  const haze = '#ecb070'
  const H = g.H
  const nz = fbm(61, 5)
  /* Mesas: flat tops, sheer sides, a step. */
  const mesas = g.second ? [[0.2, 0.2, 0.3], [0.6, 0.14, 0.24]] : [[0.05, 0.2, 0.36], [0.33, 0.15, 0.27], [0.57, 0.2, 0.4], [0.88, 0.16, 0.32], [0.99, 0.1, 0.26]]
  const farR = range(g, {
    color: mix('#8a4a2c', haze, 0.3), haze, fog: 0.55,
    h: (u) => H * Math.max(0.08, ...mesas.map(([mu, mw, mh]) => (Math.abs(u - mu) < mw / 2 ? mh : Math.abs(u - mu) < mw / 2 + 0.02 ? mh * (1 - (Math.abs(u - mu) - mw / 2) / 0.02) : 0))) * (0.97 + 0.02 * nz(u * 30)),
  })
  /* A volcano: a cone with hollow flanks and a ragged crater lip. */
  const V = g.second
    ? [{ u: 0.88, h: 0.42, w: 0.15, lava: 2, glow: 0.7, plume: [0.3, 7] }]
    : [
    { u: 0.74, h: 0.66, w: 0.23, lava: 4, glow: 1, plume: [0.62, 12] },
    { u: 0.2, h: 0.52, w: 0.19, lava: 3, glow: 0.85, plume: [-0.35, 9] },
    { u: 0.46, h: 0.3, w: 0.12, lava: 2, glow: 0.6, plume: [0.2, 5] },
  ]
  const crater = 0.012
  const cone = (u, v) => {
    const t = Math.abs(u - v.u) / v.w
    if (t >= 1) return 0
    const body = Math.pow(1 - t, 1.55)
    return body * v.h * H
  }
  const mid = range(g, {
    color: mix('#4a2218', haze, 0.12), haze, fog: 0.45, step: 3,
    h: (u) => Math.max(H * 0.12 + 0.03 * H * nz(u * 12), ...V.map((v) => Math.min(cone(u, v), v.h * H * (1 - 0.05 * 0)))) - (V.some((v) => Math.abs(u - v.u) < crater) ? 0 : 0),
    extra: V.map((v) => facets(g, [[v.u, v.h * H, v.w]], 'r', '#0c0504', 0.42)).join(''),
  })
  /* Craters: a dark notch and a bright lip. Glow, lava and ash on top. */
  const fx = V.map((v, i) => {
    const x = v.u * g.W
    const y = H - v.h * H
    const rid = nid('g')
    const lavaPaths = Array.from({ length: v.lava }, (_, k) => {
      const q = seeded(70 + i * 9 + k)
      const dir = k % 2 ? 1 : -1
      let d = `M${f1(x + dir * 1.5)} ${f1(y + 2)}`
      let px = x
      let py = y + 2
      for (let s = 1; s <= 6; s++) {
        px += dir * (3 + q() * 7) * (k + 1) * 0.6 * (g.W / 1600 + 0.5)
        py += (v.h * H * 0.62) / 6 * (0.8 + q() * 0.4)
        d += ` L${f1(px)} ${f1(py)}`
      }
      return `<path d="${d}" stroke="#ff7a22" stroke-width="${f1(1.2 + (v.lava - k) * 0.5)}" fill="none" stroke-linecap="round" opacity=".9"/><path d="${d}" stroke="#ffd070" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".8"/>`
    }).join('')
    const glow = `<defs><radialGradient id="${rid}"><stop offset="0" stop-color="#ffe2a0" stop-opacity="${0.95 * v.glow}"/><stop offset=".35" stop-color="#ff8a2a" stop-opacity="${0.6 * v.glow}"/><stop offset="1" stop-color="#ff5a14" stop-opacity="0"/></radialGradient></defs><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.min(v.h * H * 0.55, y - 3))}" fill="url(#${rid})" style="mix-blend-mode:screen"/>`
    const lip = `<ellipse cx="${f1(x)}" cy="${f1(y + 1)}" rx="${f1(g.W * crater * 1.3)}" ry="2.6" fill="#ffc060"/><ellipse cx="${f1(x)}" cy="${f1(y + 1.4)}" rx="${f1(g.W * crater * 0.8)}" ry="1.7" fill="#fff0c0"/>`
    /* Ash: puffs that climb, lean on the wind, and thin into the dust. */
    const [lean, size] = v.plume
    let ash = ''
    /* The widest puff, and the blur round it, must end inside the strip. */
    const rEnd = size * 2 * (g.W / 1600 + 0.35)
    const rise = Math.max(10, y - 8 - rEnd * 1.35)
    const q = seeded(90 + i)
    const puffs = Math.min(48, Math.max(14, Math.ceil(rise / (size * 0.55))))
    for (let k = 0; k < puffs; k++) {
      const t = k / (puffs - 1)
      const cx = x + lean * t * t * H * 0.55 + (q() - 0.5) * size * 0.6
      const cy = y - 4 - t * rise
      const r = size * (0.5 + t * 1.5) * (g.W / 1600 + 0.35)
      ash += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${mix('#3a2824', '#b87a54', t * 0.9)}" opacity="${f1(0.88 * Math.pow(1 - t, 0.9))}"/>`
    }
    return `<g clip-path="url(#${mid.clip})">${lavaPaths}</g>${glow}${lip}<g filter="url(#soft)">${ash}</g>`
  }).join('')
  const near = range(g, {
    color: '#1f0f0b', haze, fog: 0.5,
    h: (u) => H * (0.14 + 0.07 * Math.abs(nz(u * 6 + 2)) + 0.03 * nz(u * 26)), step: 3,
  })
  /* Embers glowing in cracks on the near ground. */
  const q = seeded(5)
  const cracks = Array.from({ length: 9 }, () => {
    const x = q() * g.W
    const y = H - H * (0.03 + q() * 0.08)
    return `<path d="M${f1(x)} ${f1(y)} l${f1(5 + q() * 9)} ${f1((q() - 0.5) * 3)} l${f1(4 + q() * 6)} ${f1((q() - 0.4) * 3)}" stroke="#ff8a30" stroke-width="1.2" fill="none" opacity=".85"/>`
  }).join('')
  return wrap(g, farR.svg + mid.svg + fx + near.svg + cracks, haze)
}

const DESIGN = { naron, kavian, eyeke, neri, magor }
const ZOOM = 0.78
const GEO = {
  /* How tall each design is drawn before the zoom; Magor's is taller, for its plumes. */
  wide: { W: 1600, H: { default: 140, magor: 290 } },
  tall: { W: 1000, H: { default: 150, magor: 260 } },
}
const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
module.exports = async function renderHorizons(outDir) {
  OUT = outDir
  fs.mkdirSync(OUT, { recursive: true })
  const only = undefined
  const sizes = {}
  for (const [planet, draw] of Object.entries(DESIGN)) {
    if (only && only !== planet) continue
    for (const form of ['wide', 'tall']) {
      const W = GEO[form].W
      const Hd = GEO[form].H[planet] || GEO[form].H.default
      SEEDADD = 0
      FLIP = false
      const a = inner(draw({ W, H: Hd }))
      SEEDADD = 1
      FLIP = true
      const b = inner(draw({ W, H: Hd, second: true }))
      SEEDADD = 0
      FLIP = false
      const H = Math.round(Hd * ZOOM)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><clipPath id="ja"><rect width="${Math.round(W * ZOOM)}" height="${H}"/></clipPath><clipPath id="jb"><rect x="${Math.round(W * ZOOM)}" width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#ja)"><g transform="scale(${ZOOM})">${a}</g></g><g clip-path="url(#jb)"><g transform="translate(${2 * Math.round(W * ZOOM)} 0) scale(${-ZOOM} ${ZOOM})">${b}</g></g></svg>`
      await sharp(Buffer.from(svg), { density: 72 }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(OUT, `${planet}-${form}.webp`))
      sizes[`${planet}-${form}`] = H
    }
  }
  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify({ ...JSON.parse(fs.existsSync(path.join(OUT, 'sizes.json')) ? fs.readFileSync(path.join(OUT, 'sizes.json'), 'utf8') : '{}'), ...sizes }))
  console.log('ok', sizes)
}
