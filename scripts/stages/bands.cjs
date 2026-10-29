/* Bands: what lies between the horizon and the turf. Sea, lava, a lake, a river, dunes, foothills, pools. */
const { seeded, f1, mix, sh, lerp, nid, P } = require('./engine.cjs')

const svgWrap = (g, inner, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}"><defs><filter id="blur"><feGaussianBlur stdDeviation="${f1(3 * (g.W / 1600))}"/></filter>${defs}</defs>${inner}</svg>`

/* Where the water meets the bank, by x. `wrap` pulls it down at both sides, so the water comes round an island. */
function shoreY(g, b, x) {
  const D = g.H - g.hz
  const u = x / g.W
  return g.hz + D * (b.fs + 0.016 * Math.sin(u * 9.4 + 1) + 0.008 * Math.sin(u * 23 + 2) - 0.022 * (u - 0.5) + (b.wrap || 0) * Math.pow(Math.abs(2 * u - 1), b.pow || 2.6))
}
const pathAlong = (g, b, dy = 0, step = 16) => {
  let d = ''
  for (let x = 0; x <= g.W; x += step) d += `${x ? 'L' : 'M'}${x} ${f1(shoreY(g, b, x) + dy)} `
  return d
}
const closeBelow = (g, b, dy = 0, step = 16) => {
  let d = ''
  for (let x = g.W; x >= 0; x -= step) d += ` L${x} ${f1(shoreY(g, b, x) + dy)}`
  return d
}

function shoreBand(g, b, form, seed) {
  const D = g.H - g.hz
  const rnd = seeded(seed)
  const y1 = g.hz + D * (b.fs + 0.1 + (b.wrap || 0) * 0.5)
  const stops = b.fill.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')
  let s = `<defs><linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${g.hz}" y2="${f1(y1)}">${stops}</linearGradient><radialGradient id="deep" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${b.deep || '#000'}" stop-opacity=".3"/><stop offset="1" stop-color="${b.deep || '#000'}" stop-opacity="0"/></radialGradient></defs>`
  let p = `M0 ${g.hz - 2} L${g.W} ${g.hz - 2}`
  for (let x = g.W; x >= 0; x -= 16) p += ` L${x} ${f1(shoreY(g, b, x) + 4)}`
  s += `<path d="${p}Z" fill="url(#bg)"/>`
  s += `<ellipse cx="${g.W * 0.32}" cy="${f1(g.hz + D * (b.fs * 0.8))}" rx="${g.W * 0.2}" ry="${f1(D * 0.035)}" fill="url(#deep)"/><ellipse cx="${g.W * 0.7}" cy="${f1(g.hz + D * (b.fs * 0.6))}" rx="${g.W * 0.16}" ry="${f1(D * 0.03)}" fill="url(#deep)"/>`
  /* the bank: strips below the waterline, nearest first */
  for (const r of b.rim || []) {
    /* never above the horizon: the planet's country stands there */
    let top = ''
    for (let x = 0; x <= g.W; x += 16) top += (x ? 'L' : 'M') + x + ' ' + f1(Math.max(g.hz, shoreY(g, b, x) + r.from * D)) + ' '
    s += `<path d="${top}${closeBelow(g, b, r.to * D)}Z" fill="${r.color}" ${r.a ? `opacity="${r.a}"` : ''}/>`
  }
  /* things growing on the bank's edge */
  if (b.fringe) {
    const f = b.fringe
    for (let x = 0; x < g.W; x += form === 'wide' ? 6 : 7) {
      const y = shoreY(g, b, x) + (f.at || 0.04) * D + 1
      const len = 3 + rnd() * (form === 'wide' ? 7 : 9)
      s += `<path d="M${f1(x)} ${f1(y + 2)} l${f1((rnd() - 0.5) * 4)} ${f1(-len)}" stroke="${f.colors[Math.floor(rnd() * f.colors.length)]}" stroke-width="1.6" stroke-linecap="round"/>`
    }
  }
  /* stones along the water's edge */
  for (const rk of b.rocks || []) {
    const n = Math.round(rk.n * (form === 'wide' ? 1 : 0.7))
    for (let i = 0; i < n; i++) {
      const x = rnd() * g.W
      const y = shoreY(g, b, x) + rk.dy * D * rnd()
      const t = (y - g.hz) / D
      s += P.rock(x, y, lerp(rk.size[0], rk.size[1], t) * (g.W / 1600) * (0.7 + rnd() * 0.6), rnd, rk.pal)
    }
  }
  return svgWrap(g, s)
}

/* Glints: short light streaks on the water, finer toward the horizon, never past the waterline. */
function glintsSVG(g, b, form, seed) {
  const rnd = seeded(seed)
  let s = ''
  for (let i = 0; i < (form === 'wide' ? 150 : 95); i++) {
    const x = rnd() * g.W
    const t = Math.pow(rnd(), 1.6)
    const y1 = shoreY(g, b, x) - 6
    const y = g.hz + 2 + t * (y1 - g.hz - 4)
    s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(4 + t * 26)}" height="${f1(0.6 + t * 1.4)}" rx="1" fill="${b.glint}" opacity="${(0.25 + rnd() * 0.5).toFixed(2)}"/>`
  }
  return svgWrap(g, s)
}
/* The surf, or the crust of a lava edge: a line along the waterline; two of them lap in turn. */
function foamSVG(g, b, phase) {
  const D = g.H - g.hz
  let line = ''
  for (let x = 0; x <= g.W; x += 10) line += `${x ? 'L' : 'M'}${x} ${f1(shoreY(g, b, x) - 1 - (phase ? D * 0.012 : 0) + Math.sin(x * 0.09 + phase * 2) * 1.2)} `
  return svgWrap(g, `<path d="${line}" fill="none" stroke="${b.foam}" stroke-linecap="round" stroke-width="${phase ? 1.6 : 2.6}" opacity="${phase ? 0.55 : 0.9}"/>`)
}

/* A river across the back: between two meanders, its banks drawn on both sides. */
function riverBand(g, b, form, seed) {
  const D = g.H - g.hz
  const rnd = seeded(seed)
  const top = (x) => g.hz + D * (b.at + 0.03 * Math.sin((x / g.W) * 7 + 1) + 0.014 * Math.sin((x / g.W) * 19)) - D * 0.03 * ((x / g.W) - 0.5)
  const bot = (x) => top(x) + D * (b.width + 0.012 * Math.sin((x / g.W) * 11 + 2))
  const line = (fn, dy = 0) => {
    let d = ''
    for (let x = 0; x <= g.W; x += 14) d += `${x ? 'L' : 'M'}${x} ${f1(fn(x) + dy)} `
    return d
  }
  const back = (fn, dy = 0) => {
    let d = ''
    for (let x = g.W; x >= 0; x -= 14) d += ` L${x} ${f1(fn(x) + dy)}`
    return d
  }
  const stops = b.fill.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')
  let s = `<defs><linearGradient id="rv" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(g.hz + D * b.at)}" y2="${f1(g.hz + D * (b.at + b.width + 0.05))}">${stops}</linearGradient></defs>`
  for (const r of b.banks || []) s += `<path d="${line(top, -r.out * D)}${back(bot, r.out * D)}Z" fill="${r.color}"/>`
  s += `<path d="${line(top)}${back(bot)}Z" fill="url(#rv)"/>`
  s += `<path d="${line(top, 1)}" fill="none" stroke="${b.edge}" stroke-width="1.6" opacity=".7"/><path d="${line(bot, -1)}" fill="none" stroke="${b.edge}" stroke-width="2.2" opacity=".9"/>`
  b._river = { top, bot }
  return svgWrap(g, s)
}
function riverGlints(g, b, form, seed) {
  const rnd = seeded(seed)
  const { top, bot } = b._river
  let s = ''
  for (let i = 0; i < 90; i++) {
    const x = rnd() * g.W
    const y = lerp(top(x) + 3, bot(x) - 3, rnd())
    s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(6 + rnd() * 22)}" height="1.4" rx="1" fill="${b.glint}" opacity="${(0.3 + rnd() * 0.5).toFixed(2)}"/>`
  }
  return svgWrap(g, s)
}

/* Foothills: a silhouette over the horizon's foot, fading into the ground. */
function ridgeBand(g, b, form, seed) {
  const D = g.H - g.hz
  const rnd = seeded(seed)
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6]
  const topAt = (x) => {
    const u = x / g.W
    const base = b.amp * g.H * (0.5 + 0.5 * Math.sin(u * 5 + ph[0])) + b.amp * g.H * 0.45 * Math.abs(Math.sin(u * 13 + ph[1])) + b.amp * g.H * 0.2 * Math.sin(u * 37 + ph[2])
    return g.hz + D * b.low - base * (b.jag ? 1 + 0.25 * Math.sin(u * 90) : 1)
  }
  let d = ''
  for (let x = 0; x <= g.W + 8; x += b.jag ? 6 : 12) d += `${x ? 'L' : 'M'}${x} ${f1(topAt(x))} `
  const id = nid('rg')
  const bottom = g.hz + D * (b.low + b.fade)
  let s = `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(g.hz - b.amp * g.H * 1.3)}" y2="${f1(bottom)}"><stop offset="0" stop-color="${b.top}"/><stop offset=".55" stop-color="${b.mid}"/><stop offset="1" stop-color="${b.mid}" stop-opacity="0"/></linearGradient></defs>`
  s += `<path d="${d}L${g.W + 8} ${f1(bottom)} L0 ${f1(bottom)}Z" fill="url(#${id})"/>`
  if (b.snow) {
    let sn = ''
    for (let x = 0; x <= g.W + 8; x += 12) sn += `${x ? 'L' : 'M'}${x} ${f1(topAt(x))} `
    let under = ''
    for (let x = g.W + 8; x >= 0; x -= 12) under += ` L${x} ${f1(topAt(x) + g.H * 0.012 * (1 + Math.sin(x * 0.05) * 0.6) + 3)}`
    s += `<path d="${sn}${under}Z" fill="${b.snow}" opacity=".9"/>`
  }
  if (b.glowLine) s += `<path d="${d}" fill="none" stroke="${b.glowLine}" stroke-width="2" opacity=".6"/>`
  return svgWrap(g, s)
}

/* Dunes: crests laid one behind another, each lit on one side. */
function dunesBand(g, b, form, seed) {
  const D = g.H - g.hz
  const rnd = seeded(seed)
  let s = ''
  const layers = b.layers
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1 || 1)
    const y0 = g.hz + D * (b.from + (b.to - b.from) * t)
    const amp = D * (0.035 + t * 0.03) * (b.amp || 1)
    const ph = rnd() * 6
    const id = nid('dn')
    let d = ''
    for (let x = 0; x <= g.W + 10; x += 10) {
      const u = x / g.W
      d += `${x ? 'L' : 'M'}${x} ${f1(y0 - amp * (0.5 + 0.5 * Math.sin(u * (3 + t * 3) + ph)) - amp * 0.35 * Math.sin(u * 8 + ph * 2))} `
    }
    const bottom = y0 + D * (b.fade || 0.1)
    s += `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(y0 - amp * 1.6)}" y2="${f1(bottom)}"><stop offset="0" stop-color="${mix(b.far, b.near, t)}"/><stop offset=".7" stop-color="${mix(b.far, b.near, t)}" stop-opacity=".9"/><stop offset="1" stop-color="${mix(b.far, b.near, t)}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${g.W + 10} ${f1(bottom)} L0 ${f1(bottom)}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${b.crest}" stroke-width="${f1(1.2 + t * 1.6)}" opacity="${f1(0.35 + t * 0.2)}"/>`
  }
  return svgWrap(g, s)
}

/* Pools laid flat on the ground: foreshortened ovals with a lip. */
function poolsBand(g, b, form, seed) {
  const D = g.H - g.hz
  const rnd = seeded(seed)
  let s = ''
  const list = (form === 'wide' ? b.wide : b.tall).slice().sort((a, c) => a[1] - c[1])
  for (const [ux, uy, uw] of list) {
    const x = ux * g.W
    const y = g.hz + D * uy
    const t = uy
    const w = uw * g.W * (0.45 + t * 0.9)
    const h = w * 0.22
    const T = b.terrace || [b.lip, b.lip]
    const rings = b.rings || [[1, b.edge], [0.7, b.water], [0.4, b.centre]]
    /* a soft shadow, the pale terrace, the stained rim, then the water in rings from shallow to deep */
    s += `<ellipse cx="${f1(x)}" cy="${f1(y + h * 0.3)}" rx="${f1(w * 1.26)}" ry="${f1(h * 1.2)}" fill="#3a2a10" opacity=".16" filter="url(#blur)"/>`
    s += `<ellipse cx="${f1(x)}" cy="${f1(y + h * 0.14)}" rx="${f1(w * 1.2)}" ry="${f1(h * 1.26)}" fill="${T[0]}"/>`
    s += `<ellipse cx="${f1(x)}" cy="${f1(y + h * 0.06)}" rx="${f1(w * 1.1)}" ry="${f1(h * 1.13)}" fill="${T[1]}"/>`
    s += `<ellipse cx="${f1(x)}" cy="${f1(y + h * 0.02)}" rx="${f1(w * 1.03)}" ry="${f1(h * 1.05)}" fill="${T[0]}" opacity=".85"/>`
    rings.forEach(([k, c], n) => {
      s += `<ellipse cx="${f1(x - w * 0.012 * n)}" cy="${f1(y - h * 0.045 * n)}" rx="${f1(w * k)}" ry="${f1(h * k)}" fill="${c}"/>`
    })
    s += `<ellipse cx="${f1(x - w * 0.28)}" cy="${f1(y - h * 0.34)}" rx="${f1(w * 0.26)}" ry="${f1(h * 0.16)}" fill="#fff" opacity=".3"/>`
    /* steam lifting off the water */
    for (let k = 0; k < 4; k++) {
      s += `<circle cx="${f1(x + (rnd() - 0.5) * w * 0.8)}" cy="${f1(y - h * (0.8 + k * 0.9))}" r="${f1(h * (0.9 + k * 0.5))}" fill="#fff" opacity="${f1(0.17 - k * 0.03)}" filter="url(#blur)"/>`
    }
  }
  return svgWrap(g, s)
}

/* A wash of lighter and darker patches laid on the ground in perspective, so the tile never reads as a tile. */
function washSVG(g, form, light, dark, seed, decals) {
  const D = g.H - g.hz
  const rnd = seeded(seed)
  const k = g.W / 1600
  let s = ''
  const n = form === 'wide' ? 30 : 24
  for (let i = 0; i < n; i++) {
    const t = Math.pow(rnd(), 1.2)
    const y = g.hz + D * (0.03 + 0.97 * t)
    const w = g.W * (0.1 + 0.36 * t) * (0.6 + rnd() * 0.8)
    const h = w * (0.07 + 0.1 * t)
    s += `<ellipse cx="${f1(rnd() * g.W)}" cy="${f1(y)}" rx="${f1(w / 2)}" ry="${f1(h / 2)}" fill="${i % 2 ? light : dark}" opacity="${(0.2 + rnd() * 0.2).toFixed(2)}"/>`
  }
  let ripples = ''
  if (decals && decals.type === 'ripples') {
    const q = seeded(seed + 77)
    for (let i = 0; i < decals.n; i++) {
      const t = Math.pow(q(), 1.15)
      const y = g.hz + D * (0.04 + 0.96 * t)
      const len = g.W * (0.04 + 0.15 * t) * (0.6 + q() * 0.8)
      const x = q() * g.W
      const amp = (0.8 + 4.2 * t) * (decals.amp || 1)
      const wd = 0.7 + 2.3 * t
      const path = (dy) => `M${f1(x)} ${f1(y + dy)} q${f1(len / 4)} ${f1(-amp)} ${f1(len / 2)} 0 t${f1(len / 2)} 0`
      ripples += `<path d="${path(wd * 1.1)}" fill="none" stroke="${decals.dark}" stroke-width="${f1(wd)}" opacity="${(0.28 + q() * 0.25).toFixed(2)}" stroke-linecap="round"/><path d="${path(0)}" fill="none" stroke="${decals.light}" stroke-width="${f1(wd * 0.8)}" opacity="${(0.4 + q() * 0.3).toFixed(2)}" stroke-linecap="round"/>`
    }
  }
  let comb = ''
  if (decals && decals.beachcomb) {
    const q = seeded(seed + 99)
    for (let i = 0; i < decals.beachcomb; i++) {
      const t = Math.pow(q(), 1.1)
      const y = g.hz + D * (0.1 + 0.88 * t)
      const x = q() * g.W
      const sz = (4 + 24 * t) * (g.W / 1600)
      const kind = decals.shellsOnly ? 0.5 : q()
      const sq = 0.5
      if (kind < 0.32) {
        let d = ''
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * 6.283 - 1.57
          const r = k % 2 ? sz * 0.42 : sz
          d += (k ? 'L' : 'M') + f1(x + Math.cos(a) * r) + ' ' + f1(y + Math.sin(a) * r * sq)
        }
        comb += `<ellipse cx="${f1(x + sz * 0.1)}" cy="${f1(y + sz * 0.1)}" rx="${f1(sz)}" ry="${f1(sz * sq)}" fill="#000" opacity=".12"/><path d="${d}Z" fill="${q() < 0.5 ? '#f0885a' : '#e8603f'}" stroke="#b8402a" stroke-width=".6" stroke-linejoin="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(sz * 0.14)}" fill="#ffd0a8" opacity=".8"/>`
      } else if (kind < 0.78) {
        comb += `<ellipse cx="${f1(x + sz * 0.1)}" cy="${f1(y + sz * 0.12)}" rx="${f1(sz * 0.62)}" ry="${f1(sz * 0.32)}" fill="#000" opacity=".14"/><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(sz * 0.6)}" ry="${f1(sz * 0.34)}" fill="${q() < 0.5 ? '#fffaf2' : '#f8d8d0'}" stroke="#d8b8aa" stroke-width=".7"/><path d="M${f1(x - sz * 0.5)} ${f1(y)} L${f1(x + sz * 0.5)} ${f1(y)} M${f1(x - sz * 0.3)} ${f1(y - sz * 0.2)} L${f1(x + sz * 0.3)} ${f1(y + sz * 0.2)} M${f1(x - sz * 0.3)} ${f1(y + sz * 0.2)} L${f1(x + sz * 0.3)} ${f1(y - sz * 0.2)}" stroke="#d8b8aa" stroke-width=".6" fill="none" opacity=".8"/>`
      } else {
        let d = `M${f1(x)} ${f1(y)}`
        for (let k = 1; k <= 4; k++) d += ` q${f1(sz * 0.4)} ${f1(-sz * 0.3 * (k % 2 ? 1 : -1))} ${f1(sz * 0.6)} ${f1((q() - 0.5) * sz * 0.3)}`
        comb += `<path d="${d}" fill="none" stroke="#3f5a2c" stroke-width="${f1(Math.max(0.8, sz * 0.12))}" stroke-linecap="round" opacity=".85"/><path d="${d}" fill="none" stroke="#6a8a3c" stroke-width="${f1(Math.max(0.5, sz * 0.05))}" stroke-linecap="round" opacity=".7" transform="translate(0 -1)"/>`
      }
    }
  }
  return svgWrap(g, `<g filter="url(#wb)">${s}</g>${ripples}${comb}`, `<filter id="wb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(13 * k)}"/></filter>`)
}

function hillsBand(g, b, form, seed) {
  const D = g.H - g.hz
  let s = ''
  for (const L of b.layers) {
    const id = nid('hl')
    const rise = (x) => {
      const u = x / g.W
      return g.H * (L.base + L.bumps.reduce((a, [cu, w, h]) => a + h * Math.exp(-Math.pow((u - cu) / w, 2)), 0))
    }
    let d = ''
    for (let x = 0; x <= g.W + 8; x += 8) d += `${x ? 'L' : 'M'}${x} ${f1(g.hz - rise(x))} `
    const bottom = g.hz + D * L.fade
    s += `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(g.hz - g.H * 0.08)}" y2="${f1(bottom)}"><stop offset="0" stop-color="${L.top}"/><stop offset=".5" stop-color="${L.mid}"/><stop offset="1" stop-color="${L.mid}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${g.W + 8} ${f1(bottom)} L0 ${f1(bottom)}Z" fill="url(#${id})"/>`
    /* the sunlit rim of the swell */
    s += `<path d="${d}" fill="none" stroke="${L.rim}" stroke-width="${f1(2.2 * (g.W / 1600))}" opacity=".55"/>`
  }
  return svgWrap(g, s)
}

/* Mountains: real peaks, each with a lit face, a shaded face, ridge lines, and snow near the top. */
function peaksBand(g, b, form, seed) {
  const D = g.H - g.hz
  const rnd = seeded(seed)
  let out = ''
  b.layers.forEach((L, li) => {
    const n = Math.round(L.n * (form === 'tall' ? 0.7 : 1))
    /* main summits, each leaning a little to one side, with a shoulder or two beside it */
    const mains = Array.from({ length: n }, (_, i) => {
      const tall = i % 3 === 1 ? 1.18 : 1
      return { u: (i + 0.5 + (rnd() - 0.5) * 0.7) / n, h: L.h * (0.5 + 0.5 * rnd()) * tall, w: ((L.w || 1.0) / n) * (0.8 + rnd() * 0.5), a: 0.78 + rnd() * 0.5 }
    })
    const pk = [...mains]
    for (const p of mains) {
      const dir = rnd() < 0.5 ? -1 : 1
      pk.push({ u: p.u + dir * p.w * (0.5 + rnd() * 0.15), h: p.h * (0.42 + rnd() * 0.2), w: p.w * (0.5 + rnd() * 0.15), a: 0.8 + rnd() * 0.4, shoulder: true })
      if (rnd() < 0.3) pk.push({ u: p.u - dir * p.w * (0.62 + rnd() * 0.2), h: p.h * (0.28 + rnd() * 0.18), w: p.w * 0.45, a: 0.8 + rnd() * 0.4, shoulder: true })
    }
    const heightAt = (u) => {
      let m = 0
      for (const p of pk) {
        const dx = u - p.u
        const t = Math.abs(dx) / (dx < 0 ? p.w * p.a : p.w / p.a)
        if (t < 1) m = Math.max(m, L.cap ? p.h * Math.min(L.cap, Math.pow(1 - t, 1.0) * (L.steep || 2)) : p.h * Math.pow(1 - t, 1.04))
      }
      return m + Math.sin(u * 230 + li * 2) * 0.0035 + Math.sin(u * 520 + li * 5) * 0.002
    }
    const yBase = g.hz + D * L.foot
    const top = (x) => g.hz - g.H * Math.max(0, heightAt(x / g.W))
    let d = ''
    for (let x = 0; x <= g.W + 3; x += 3) d += `${x ? 'L' : 'M'}${x} ${f1(Math.min(top(x), yBase))} `
    const sil = `${d}L${g.W + 3} ${f1(yBase)} L0 ${f1(yBase)}Z`
    const gid = nid('pg')
    const cid = nid('pc')
    const bottom = g.hz + D * L.fade
    out += `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(g.hz - g.H * L.h * 1.2)}" y2="${f1(bottom)}"><stop offset="0" stop-color="${L.top}"/><stop offset=".55" stop-color="${L.mid}"/><stop offset="1" stop-color="${L.mid}" stop-opacity="0"/></linearGradient><clipPath id="${cid}"><path d="${sil}"/></clipPath></defs><path d="${sil}" fill="url(#${gid})"/>`
    let det = ''
    for (const p of pk) {
      const xs = p.u * g.W
      const ys = g.hz - g.H * p.h
      const yb = yBase
      const ww = p.w * g.W
      /* the dark face: the silhouette from the summit down to the valley on its right, closed by a ridge that leans a little */
      if (!p.shoulder && L.shadeA) {
        let xe = xs
        let poly = `M${f1(xs)} ${f1(ys)}`
        const reach = xs + (ww / p.a) * 1.15
        for (let x = xs + 3; x <= Math.min(g.W + 3, reach); x += 3) {
          const y = Math.min(top(x), yb)
          const yn = Math.min(top(x + 3), yb)
          poly += ` L${f1(x)} ${f1(y)}`
          xe = x
          if (yn < y - 0.4 && x > xs + 9) break
        }
        poly += ` L${f1(xe)} ${f1(yb)} L${f1(xs + ww * 0.22)} ${f1(yb)}Z`
        det += `<path d="${poly}" fill="${L.shade}" opacity="${L.shadeA}"/>`
        /* a thin lit edge down the leaning ridge */
        det += `<path d="M${f1(xs)} ${f1(ys)} L${f1(xs + ww * 0.22)} ${f1(yb)}" stroke="${L.light}" stroke-width="${f1(Math.max(0.8, 1.2 * (g.W / 1600)))}" opacity="${L.lightA || 0.2}" fill="none"/>`
      }
      if (L.snow && !p.shoulder && p.h > L.h * (L.snowFrom || 0.6)) {
        const cap = (yb - ys) * (L.snowDepth || 0.32) * (0.7 + (p.h / L.h) * 0.4)
        const half = ww * 0.52
        let sn = `M${f1(xs)} ${f1(ys - 1)}`
        sn += ` L${f1(xs + half * 0.6)} ${f1(ys + cap * 0.55)} L${f1(xs + half * 0.34)} ${f1(ys + cap * 0.46)} L${f1(xs + half * 0.3)} ${f1(ys + cap * 0.8)} L${f1(xs)} ${f1(ys + cap * 0.58)}`
        sn += ` L${f1(xs - half * 0.26)} ${f1(ys + cap * 0.92)} L${f1(xs - half * 0.38)} ${f1(ys + cap * 0.5)} L${f1(xs - half * 0.7)} ${f1(ys + cap * 0.66)}Z`
        det += `<path d="${sn}" fill="${L.snow}" opacity=".95"/><path d="M${f1(xs)} ${f1(ys)} L${f1(xs + half * 0.6)} ${f1(ys + cap * 0.55)} L${f1(xs + half * 0.3)} ${f1(ys + cap * 0.8)} L${f1(xs)} ${f1(ys + cap * 0.58)}Z" fill="${L.shade}" opacity=".16"/>`
      }
    }
    /* strata: bands of colour across the rock, clipped to the butte */
    if (L.strata) {
      const y0 = g.hz - g.H * L.h
      let k = 0
      for (let y = y0; y < yBase; y += g.H * (L.strata.step || 0.011)) {
        det += `<rect x="0" y="${f1(y)}" width="${g.W}" height="${f1(g.H * (L.strata.step || 0.011) * (0.35 + 0.35 * ((k * 7) % 3) / 2))}" fill="${k % 2 ? L.strata.a : L.strata.b}" opacity="${L.strata.o || 0.3}"/>`
        k++
      }
    }
    /* air between the ranges: each one hazes toward its foot, so the next stands clear of it */
    if (L.haze) {
      const hid = nid('ph')
      det += `<defs><linearGradient id="${hid}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(g.hz - g.H * L.h * 0.7)}" y2="${f1(yBase)}"><stop offset="0" stop-color="${L.haze}" stop-opacity="0"/><stop offset="1" stop-color="${L.haze}" stop-opacity="${L.hazeA || 0.5}"/></linearGradient></defs><rect x="0" y="${f1(g.hz - g.H * L.h * 0.7)}" width="${g.W}" height="${f1(yBase - (g.hz - g.H * L.h * 0.7))}" fill="url(#${hid})"/>`
    }
    out += `<g clip-path="url(#${cid})">${det}</g>`
  })
  return svgWrap(g, out)
}

/* A volcano on the horizon: concave flanks, a crater lip, old lava streaks, moss on the lower slopes, a thread of steam. */
function volcanoBand(g, b, form, seed) {
  const D = g.H - g.hz
  const rnd = seeded(seed)
  let out = ''
  const yb = g.hz + D * 0.07
  for (const C of b.cones) {
    const xs = C.u * g.W
    const ys = g.hz - g.H * C.h
    const half = C.w * g.W
    const lip = half * (C.lip || 0.11)
    const L = []
    const R = []
    for (let k = 0; k <= 24; k++) {
      const t = k / 24
      const dx = lip + (half - lip) * t
      const y = ys + (yb - ys) * Math.pow(t, 0.62)
      L.push([xs - dx, y])
      R.push([xs + dx, y])
    }
    const sil = `M${f1(L[0][0])} ${f1(L[0][1])} ` + L.map(([x, y]) => `L${f1(x)} ${f1(y)}`).join(' ') + ` L${f1(xs - half)} ${f1(yb)} L${f1(xs + half)} ${f1(yb)} ` + R.reverse().map(([x, y]) => `L${f1(x)} ${f1(y)}`).join(' ') + 'Z'
    const gid = nid('vg')
    const cid = nid('vc')
    out += `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(ys)}" y2="${f1(yb)}"><stop offset="0" stop-color="${C.top}"/><stop offset="1" stop-color="${C.mid}"/></linearGradient><linearGradient id="${gid}m" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(ys + (yb - ys) * 0.5)}" y2="${f1(yb)}"><stop offset="0" stop-color="${C.moss}" stop-opacity="0"/><stop offset="1" stop-color="${C.moss}" stop-opacity=".6"/></linearGradient><clipPath id="${cid}"><path d="${sil}"/></clipPath></defs><path d="${sil}" fill="url(#${gid})"/>`
    let det = `<path d="M${f1(xs)} ${f1(ys)} L${f1(xs + half * 1.1)} ${f1(yb)} L${f1(xs - half * 0.1)} ${f1(yb)}Z" fill="${C.shade}" opacity=".38"/>`
    /* old lava flows, running down the flanks and thinning out */
    for (let k = 0; k < 7; k++) {
      const side = k % 2 ? 1 : -1
      let px = xs + side * lip * (0.2 + rnd() * 0.8)
      let py = ys + (yb - ys) * 0.03
      let d = `M${f1(px)} ${f1(py)}`
      for (let s = 1; s <= 6; s++) {
        px += side * (half * (0.07 + rnd() * 0.05))
        py += (yb - ys) * (0.15 + rnd() * 0.05)
        d += ` L${f1(px + (rnd() - 0.5) * half * 0.04)} ${f1(py)}`
      }
      det += `<path d="${d}" stroke="${C.flow}" stroke-width="${f1(Math.max(1.2, half * 0.014))}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>`
    }
    det += `<rect x="${f1(xs - half)}" y="${f1(ys)}" width="${f1(half * 2)}" height="${f1(yb - ys)}" fill="url(#${gid}m)"/>`
    out += `<g clip-path="url(#${cid})">${det}</g>`
    /* the crater lip, and what drifts out of it */
    out += `<ellipse cx="${f1(xs)}" cy="${f1(ys + 1)}" rx="${f1(lip * 1.04)}" ry="${f1(lip * 0.24)}" fill="${C.shade}"/><ellipse cx="${f1(xs)}" cy="${f1(ys + 2)}" rx="${f1(lip * 0.8)}" ry="${f1(lip * 0.16)}" fill="#14100e" opacity=".8"/>`
    for (let k = 0; k < 4; k++) out += `<circle cx="${f1(xs + k * lip * 0.25 + (rnd() - 0.5) * 4)}" cy="${f1(ys - lip * (0.3 + k * 0.5))}" r="${f1(lip * (0.28 + k * 0.14))}" fill="#fff" opacity="${f1(0.2 - k * 0.04)}" filter="url(#blur)"/>`
  }
  /* a haze over the foot, so it stands in the air */
  const hid = nid('vh')
  out += `<defs><linearGradient id="${hid}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f1(g.hz - g.H * 0.05)}" y2="${f1(yb)}"><stop offset="0" stop-color="${b.haze}" stop-opacity="0"/><stop offset="1" stop-color="${b.haze}" stop-opacity=".5"/></linearGradient></defs><rect x="0" y="${f1(g.hz - g.H * 0.05)}" width="${g.W}" height="${f1(yb - (g.hz - g.H * 0.05))}" fill="url(#${hid})"/>`
  /* broken rock in front of its foot */
  const low = peaksBand(g, { layers: b.foothills }, form, seed + 3)
  return svgWrap(g, out + low.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''))
}

const BAND = { hills: hillsBand, peaks: peaksBand, volcano: volcanoBand, shore: shoreBand, river: riverBand, ridge: ridgeBand, dunes: dunesBand, pools: poolsBand }
module.exports = { washSVG, BAND, glintsSVG, foamSVG, riverGlints, shoreY, svgWrap }
