/*
 * The painter for land stages: floors, bands (sea, river, lava, dunes, foothills,
 * pools), the objects standing on them, and the tufts at the edges.
 * A land is a recipe (lands-recipes.cjs); this turns one into pictures.
 */
const fs = require('fs')
const path = require('path')
const sharp = require(path.resolve('node_modules/sharp'))

const GEO = {
  wide: { W: 1600, H: 900, hz: 333 },
  tall: { W: 1000, H: 1000, hz: 340 },
}
const FORMS = ['wide', 'tall']

/* ---- small tools ---- */
function seeded(n) {
  let s = n
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}
const f1 = (n) => n.toFixed(1)
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')
const sh = (c, t) => (t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#000000', -t))
const lerp = (a, b, t) => a + (b - a) * t
const slugOf = (name) => name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
let uid = 0
const nid = (p) => `${p}${uid++}`
const hashOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 99991, 7)

/* ================= floors: a seamless 512 tile ================= */
const S = 512
function floorSVG(r, seed0) {
  let seed = seed0
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  const wrap = (x, y, rad, draw) => {
    let s = ''
    for (const dx of [-S, 0, S])
      for (const dy of [-S, 0, S]) {
        const X = x + dx
        const Y = y + dy
        if (X < -rad || X > S + rad || Y < -rad || Y > S + rad) continue
        s += draw(X, Y)
      }
    return s
  }
  const M = {
    blades: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S, len = lerp(m.len[0], m.len[1], rnd()), ang = (rnd() - 0.5) * 0.7, w = lerp(m.w[0], m.w[1], rnd()), c = pick(m.colors), bend = (rnd() - 0.5) * 6
        s += wrap(x, y, 24, (X, Y) => `<path d="M${f1(X)} ${f1(Y)} Q${f1(X + bend)} ${f1(Y - len * 0.6)} ${f1(X + Math.sin(ang) * len)} ${f1(Y - Math.cos(ang) * len)}" stroke="${c}" stroke-width="${w.toFixed(2)}" fill="none" stroke-linecap="round"/>`)
      }
      return s
    },
    flowers: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S, c = pick(m.colors), rr = 1.7 + rnd() * 1.4
        s += wrap(x, y, 6, (X, Y) => `<circle cx="${f1(X)}" cy="${f1(Y)}" r="${rr.toFixed(1)}" fill="${c}"/><circle cx="${f1(X)}" cy="${f1(Y)}" r="${(rr * 0.38).toFixed(1)}" fill="${m.eye || '#e2a63a'}"/>`)
      }
      return s
    },
    pebbles: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S, rr = lerp(m.r[0], m.r[1], rnd()), c = pick(m.colors)
        s += wrap(x, y, 8, (X, Y) => `<ellipse cx="${f1(X + 0.6)}" cy="${f1(Y + 0.8)}" rx="${f1(rr * 1.2)}" ry="${f1(rr * 0.8)}" fill="#000" opacity=".28"/><ellipse cx="${f1(X)}" cy="${f1(Y)}" rx="${f1(rr * 1.15)}" ry="${f1(rr * 0.8)}" fill="${c}"/><ellipse cx="${f1(X - rr * 0.3)}" cy="${f1(Y - rr * 0.3)}" rx="${f1(rr * 0.45)}" ry="${f1(rr * 0.28)}" fill="${sh(c, 0.5)}" opacity=".7"/>`)
      }
      return s
    },
    shingle: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S, w = lerp(m.r[0], m.r[1], rnd()), c = pick(m.colors)
        const a = rnd() * 3.14
        const pts = [[-1, 0.2], [-0.5, -0.7], [0.5, -0.6], [1, 0.1], [0.4, 0.7], [-0.6, 0.6]].map(([px, py]) => [px * w * (0.85 + rnd() * 0.3), py * w * 0.6 * (0.85 + rnd() * 0.3)])
        s += wrap(x, y, w * 2, (X, Y) => {
          const P = pts.map(([px, py]) => [X + px * Math.cos(a) - py * Math.sin(a), Y + px * Math.sin(a) + py * Math.cos(a)])
          const d = P.map(([px, py], k) => (k ? 'L' : 'M') + f1(px) + ' ' + f1(py)).join(' ') + 'Z'
          const top = [P[1], P[2], [X + 0.1 * w, Y - 0.1 * w]].map(([px, py], k) => (k ? 'L' : 'M') + f1(px) + ' ' + f1(py)).join(' ') + 'Z'
          return '<path d="' + d + '" fill="#000" opacity=".3" transform="translate(.9 1.2)"/><path d="' + d + '" fill="' + c + '"/><path d="' + top + '" fill="' + sh(c, 0.28) + '" opacity=".7"/>'
        })
      }
      return s
    },
    cracks: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S
        let a = rnd() * 6.28, d = `M0 0`, px = 0, py = 0
        const segs = 4 + Math.floor(rnd() * 5)
        for (let k = 0; k < segs; k++) {
          a += (rnd() - 0.5) * 1.2
          const l = 8 + rnd() * 18
          px += Math.cos(a) * l
          py += Math.sin(a) * l * 0.8
          d += ` L${f1(px)} ${f1(py)}`
        }
        s += wrap(x, y, 90, (X, Y) => {
          const g = m.glow ? `<path d="${d}" transform="translate(${f1(X)} ${f1(Y)})" stroke="${m.glow}" stroke-width="${m.w * 3.4}" opacity=".35" fill="none" stroke-linecap="round" filter="url(#blur)"/>` : ''
          return g + `<path d="${d}" transform="translate(${f1(X)} ${f1(Y)})" stroke="${m.color}" stroke-width="${m.w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        })
      }
      return s
    },
    ripples: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S, len = 30 + rnd() * 80
        s += wrap(x, y, len + 10, (X, Y) => `<path d="M${f1(X)} ${f1(Y)} q${f1(len * 0.25)} ${f1(-5 - rnd() * 3)} ${f1(len * 0.5)} 0 t${f1(len * 0.5)} 0" stroke="${m.color}" stroke-width="${m.w || 1.5}" opacity="${m.a || 0.5}" fill="none" stroke-linecap="round"/><path d="M${f1(X)} ${f1(Y - 2)} q${f1(len * 0.25)} -6 ${f1(len * 0.5)} 0 t${f1(len * 0.5)} 0" stroke="${m.hi}" stroke-width="1" opacity="${(m.a || 0.5) * 0.9}" fill="none" stroke-linecap="round"/>`)
      }
      return s
    },
    flecks: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S, rr = 0.6 + rnd() * 1.4
        s += wrap(x, y, 4, (X, Y) => `<circle cx="${f1(X)}" cy="${f1(Y)}" r="${rr.toFixed(1)}" fill="${pick(m.colors)}" opacity="${(0.4 + rnd() * 0.6).toFixed(2)}"/>`)
      }
      return s
    },
    blots: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S, rr = lerp(m.r[0], m.r[1], rnd()), c = pick(m.colors)
        s += wrap(x, y, rr * 1.7, (X, Y) => `<ellipse cx="${f1(X)}" cy="${f1(Y)}" rx="${f1(rr)}" ry="${f1(rr * (m.flat || 0.62))}" fill="${c}" opacity="${m.a || 0.5}" filter="url(#blur)"/>`)
      }
      return s
    },
    tufts: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S, h = lerp(m.h[0], m.h[1], rnd()), c = pick(m.colors)
        s += wrap(x, y, 30, (X, Y) => {
          let t = ''
          for (let k = 0; k < 5; k++) {
            const a = (k / 4 - 0.5) * 1.2
            t += `<path d="M${f1(X)} ${f1(Y)} Q${f1(X + Math.sin(a) * h * 0.4)} ${f1(Y - h * 0.6)} ${f1(X + Math.sin(a) * h)} ${f1(Y - Math.cos(a) * h)}" stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
          }
          return t
        })
      }
      return s
    },
    spores: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const x = rnd() * S, y = rnd() * S, rr = 1 + rnd() * 2
        s += wrap(x, y, 12, (X, Y) => `<circle cx="${f1(X)}" cy="${f1(Y)}" r="${f1(rr * 3)}" fill="${m.color}" opacity=".18" filter="url(#blur)"/><circle cx="${f1(X)}" cy="${f1(Y)}" r="${f1(rr)}" fill="${m.hi}" opacity=".9"/>`)
      }
      return s
    },
    strata: (m) => {
      let s = ''
      for (let i = 0; i < m.n; i++) {
        const y = rnd() * S, x = rnd() * S, len = 60 + rnd() * 140
        s += wrap(x, y, len, (X, Y) => `<path d="M${f1(X)} ${f1(Y)} q${f1(len / 4)} ${f1((rnd() - 0.5) * 6)} ${f1(len / 2)} 0 t${f1(len / 2)} ${f1((rnd() - 0.5) * 4)}" stroke="${pick(m.colors)}" stroke-width="${(1 + rnd() * 2).toFixed(1)}" opacity=".45" fill="none"/>`)
      }
      return s
    },
  }
  const marks = r.marks.map((m) => M[m.type](m)).join('')
  const k = r.mottleK || [1.6, -0.55]
  const [mr, mg, mb] = r.mottle
  const [lr, lg, lb] = r.light
  const [gr, gg, gb] = r.grain
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<defs>
<filter id="blur"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${r.freq?.[0] || 0.009}" numOctaves="3" seed="${seed0 % 40}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 ${mr}  0 0 0 0 ${mg}  0 0 0 0 ${mb}  ${k[0]} 0 0 0 ${k[1]}"/></filter>
<filter id="light" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${r.freq?.[1] || 0.016}" numOctaves="2" seed="${(seed0 + 14) % 40}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 ${lr}  0 0 0 0 ${lg}  0 0 0 0 ${lb}  0 0 1.5 0 -0.72"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${r.freq?.[2] || 0.55}" numOctaves="2" seed="${(seed0 + 3) % 40}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 ${gr}  0 0 0 0 ${gg}  0 0 0 0 ${gb}  0 0 0 0.9 -0.25"/></filter>
</defs>
<rect width="${S}" height="${S}" fill="${r.base}"/>
<rect width="${S}" height="${S}" filter="url(#mottle)"/>
<rect width="${S}" height="${S}" filter="url(#light)"/>
<rect width="${S}" height="${S}" filter="url(#grain)" opacity="${r.grainA ?? 0.6}"/>
${marks}
</svg>`
}

/* ================= props: the things that stand on the ground ================= */
const shadow = (x, y, w) => `<ellipse cx="${f1(x + w * 0.08)}" cy="${f1(y + 1)}" rx="${f1(w * 0.55)}" ry="${f1(Math.max(1.2, w * 0.12))}" fill="#000" opacity=".28"/>`
const P = {
  treeBroad(x, y, h, r, p) {
    const tw = Math.max(1.6, h * 0.1)
    const c = (dx, dy, rr, col) => `<circle cx="${f1(x + dx * h)}" cy="${f1(y - dy * h)}" r="${f1(rr * h)}" fill="${col}"/>`
    return (
      shadow(x, y, h * 0.55) +
      `<path d="M${f1(x - tw)} ${f1(y)} L${f1(x - tw * 0.5)} ${f1(y - h * 0.5)} L${f1(x + tw * 0.5)} ${f1(y - h * 0.5)} L${f1(x + tw)} ${f1(y)}Z" fill="${p.d}"/>` +
      c(0, 0.72, 0.3, p.b) + c(-0.2, 0.55, 0.22, p.b) + c(0.2, 0.56, 0.23, p.b) +
      c(-0.02, 0.76, 0.26, p.a) + c(-0.18, 0.6, 0.18, p.a) + c(0.18, 0.62, 0.19, p.a) +
      c(-0.08, 0.82, 0.12, p.c) + c(-0.2, 0.66, 0.08, p.c)
    )
  },
  pine(x, y, h, r, p) {
    const tw = Math.max(1.4, h * 0.06)
    let s = shadow(x, y, h * 0.4) + `<rect x="${f1(x - tw / 2)}" y="${f1(y - h * 0.2)}" width="${f1(tw)}" height="${f1(h * 0.2)}" fill="${p.d}"/>`
    for (let i = 0; i < 4; i++) {
      const t = i / 4
      const by = y - h * (0.14 + t * 0.2)
      const w = h * (0.34 - t * 0.07)
      const ty = by - h * 0.34
      s += `<path d="M${f1(x)} ${f1(ty)} L${f1(x + w)} ${f1(by)} L${f1(x - w)} ${f1(by)}Z" fill="${i % 2 ? p.b : p.a}"/><path d="M${f1(x)} ${f1(ty)} L${f1(x - w)} ${f1(by)} L${f1(x - w * 0.2)} ${f1(by)}Z" fill="${p.c}" opacity=".35"/>`
      if (p.snow) s += `<path d="M${f1(x)} ${f1(ty)} L${f1(x + w * 0.62)} ${f1(ty + (by - ty) * 0.62)} L${f1(x + w * 0.2)} ${f1(ty + (by - ty) * 0.5)} L${f1(x - w * 0.2)} ${f1(ty + (by - ty) * 0.66)} L${f1(x - w * 0.62)} ${f1(ty + (by - ty) * 0.62)}Z" fill="${p.snow}" opacity=".92"/>`
    }
    return s
  },
  deadTree(x, y, h, r, p) {
    const tw = Math.max(1.6, h * 0.07)
    let s = shadow(x, y, h * 0.4) + `<path d="M${f1(x)} ${f1(y)} Q${f1(x + h * 0.06)} ${f1(y - h * 0.5)} ${f1(x - h * 0.04)} ${f1(y - h)}" stroke="${p.d}" stroke-width="${f1(tw)}" fill="none" stroke-linecap="round"/>`
    for (let i = 0; i < 5; i++) {
      const t = 0.35 + i * 0.13
      const dir = i % 2 ? 1 : -1
      const bx = x + (t - 0.5) * h * 0.1
      const by = y - h * t
      s += `<path d="M${f1(bx)} ${f1(by)} q${f1(dir * h * 0.14)} ${f1(-h * 0.06)} ${f1(dir * h * (0.2 + r() * 0.1))} ${f1(-h * (0.16 + r() * 0.08))}" stroke="${p.d}" stroke-width="${f1(tw * 0.62)}" fill="none" stroke-linecap="round"/>`
    }
    return s
  },
  mush(x, y, h, r, p) {
    const cw = h * 0.55
    return (
      shadow(x, y, h * 0.5) +
      (p.glow ? `<ellipse cx="${f1(x)}" cy="${f1(y - h * 0.5)}" rx="${f1(cw * 1.5)}" ry="${f1(h * 0.55)}" fill="${p.glow}" opacity=".22" filter="url(#blur)"/>` : '') +
      `<path d="M${f1(x - h * 0.07)} ${f1(y)} Q${f1(x - h * 0.05)} ${f1(y - h * 0.4)} ${f1(x - h * 0.04)} ${f1(y - h * 0.6)} L${f1(x + h * 0.04)} ${f1(y - h * 0.6)} Q${f1(x + h * 0.06)} ${f1(y - h * 0.4)} ${f1(x + h * 0.08)} ${f1(y)}Z" fill="${p.d}"/>` +
      `<path d="M${f1(x - cw)} ${f1(y - h * 0.56)} Q${f1(x - cw * 0.9)} ${f1(y - h * 1.02)} ${f1(x)} ${f1(y - h * 1.04)} Q${f1(x + cw * 0.9)} ${f1(y - h * 1.02)} ${f1(x + cw)} ${f1(y - h * 0.56)} Q${f1(x)} ${f1(y - h * 0.5)} ${f1(x - cw)} ${f1(y - h * 0.56)}Z" fill="${p.a}"/>` +
      `<path d="M${f1(x - cw)} ${f1(y - h * 0.56)} Q${f1(x)} ${f1(y - h * 0.5)} ${f1(x + cw)} ${f1(y - h * 0.56)} Q${f1(x)} ${f1(y - h * 0.62)} ${f1(x - cw)} ${f1(y - h * 0.56)}Z" fill="${p.b}"/>` +
      [[-0.45, 0.78, 0.09], [0.1, 0.88, 0.11], [0.5, 0.74, 0.08], [-0.1, 0.7, 0.06]].map(([dx, dy, rr]) => `<circle cx="${f1(x + dx * cw)}" cy="${f1(y - dy * h)}" r="${f1(rr * h)}" fill="${p.c}" opacity=".9"/>`).join('')
    )
  },
  mushCluster(x, y, h, r, p) {
    return P.mush(x - h * 0.4, y + 1, h * 0.62, r, p) + P.mush(x + h * 0.42, y + 1, h * 0.5, r, p) + P.mush(x, y, h, r, p)
  },
  rock(x, y, h, r, p) {
    const w = h * (1.2 + r() * 0.5)
    const hh = h
    const d = `M${f1(x - w / 2)} ${f1(y)} Q${f1(x - w * 0.5)} ${f1(y - hh * 0.7)} ${f1(x - w * 0.12)} ${f1(y - hh)} Q${f1(x + w * 0.3)} ${f1(y - hh * 1.02)} ${f1(x + w * 0.5)} ${f1(y - hh * 0.3)} L${f1(x + w / 2)} ${f1(y)}Z`
    const id = nid('rk')
    return (
      shadow(x, y, w) +
      `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${p.c}"/><stop offset=".5" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient></defs><path d="${d}" fill="url(#${id})"/>` +
      `<path d="M${f1(x - w * 0.3)} ${f1(y - hh * 0.6)} Q${f1(x - w * 0.12)} ${f1(y - hh * 0.98)} ${f1(x + w * 0.1)} ${f1(y - hh * 0.92)}" stroke="${sh(p.c, 0.3)}" stroke-width="${f1(Math.max(1, w * 0.04))}" fill="none" opacity=".6"/>`
    )
  },
  boulders(x, y, h, r, p) {
    return P.rock(x - h * 0.7, y + 1, h * 0.6, r, p) + P.rock(x + h * 0.6, y + 1, h * 0.5, r, p) + P.rock(x, y, h, r, p)
  },
  cactus(x, y, h, r, p) {
    const w = Math.max(2.4, h * 0.15)
    const arm = (dir, ay, len) => `<path d="M${f1(x)} ${f1(y - h * ay)} q${f1(dir * h * 0.2)} 0 ${f1(dir * h * 0.22)} ${f1(-len)}" stroke="${p.a}" stroke-width="${f1(w * 0.78)}" fill="none" stroke-linecap="round"/>`
    return (
      shadow(x, y, h * 0.5) +
      arm(-1, 0.4, h * 0.3) + arm(1, 0.55, h * 0.26) +
      `<path d="M${f1(x)} ${f1(y)} L${f1(x)} ${f1(y - h)}" stroke="${p.a}" stroke-width="${f1(w)}" stroke-linecap="round"/><path d="M${f1(x - w * 0.18)} ${f1(y)} L${f1(x - w * 0.18)} ${f1(y - h * 0.96)}" stroke="${p.c}" stroke-width="${f1(w * 0.28)}" stroke-linecap="round" opacity=".7"/><path d="M${f1(x + w * 0.3)} ${f1(y)} L${f1(x + w * 0.3)} ${f1(y - h * 0.96)}" stroke="${p.b}" stroke-width="${f1(w * 0.3)}" stroke-linecap="round" opacity=".7"/>`
    )
  },
  mesa(x, y, h, r, p) {
    const w = h * (1.3 + r() * 0.8)
    const id = nid('ms')
    let strata = ''
    for (let i = 1; i < 5; i++) strata += `<path d="M${f1(x - w * 0.5)} ${f1(y - (h * i) / 5)} h${f1(w)}" stroke="${p.b}" stroke-width="${f1(Math.max(1, h * 0.03))}" opacity=".4"/>`
    return (
      shadow(x, y, w * 0.9) +
      `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${p.c}"/><stop offset=".55" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient></defs>` +
      `<path d="M${f1(x - w * 0.5)} ${f1(y)} L${f1(x - w * 0.42)} ${f1(y - h * 0.82)} L${f1(x - w * 0.34)} ${f1(y - h)} L${f1(x + w * 0.3)} ${f1(y - h)} L${f1(x + w * 0.4)} ${f1(y - h * 0.8)} L${f1(x + w * 0.5)} ${f1(y)}Z" fill="url(#${id})"/>` +
      strata
    )
  },
  spire(x, y, h, r, p) {
    const w = h * 0.22
    return (
      shadow(x, y, w * 2) +
      `<path d="M${f1(x - w)} ${f1(y)} L${f1(x - w * 0.5)} ${f1(y - h * 0.7)} L${f1(x)} ${f1(y - h)} L${f1(x + w * 0.4)} ${f1(y - h * 0.62)} L${f1(x + w)} ${f1(y)}Z" fill="${p.a}"/>` +
      `<path d="M${f1(x)} ${f1(y - h)} L${f1(x + w * 0.4)} ${f1(y - h * 0.62)} L${f1(x + w)} ${f1(y)} L${f1(x + w * 0.2)} ${f1(y)}Z" fill="${p.b}" opacity=".7"/>` +
      `<path d="M${f1(x - w * 0.5)} ${f1(y - h * 0.7)} L${f1(x)} ${f1(y - h)} L${f1(x - w * 0.05)} ${f1(y - h * 0.5)}Z" fill="${p.c}" opacity=".75"/>` +
      (p.snow ? `<path d="M${f1(x)} ${f1(y - h)} L${f1(x + w * 0.26)} ${f1(y - h * 0.78)} L${f1(x + w * 0.05)} ${f1(y - h * 0.84)} L${f1(x - w * 0.18)} ${f1(y - h * 0.76)}Z" fill="${p.snow}"/>` : '')
    )
  },
  crystal(x, y, h, r, p) {
    let s = shadow(x, y, h * 0.7) + (p.glow ? `<ellipse cx="${f1(x)}" cy="${f1(y - h * 0.4)}" rx="${f1(h * 0.6)}" ry="${f1(h * 0.55)}" fill="${p.glow}" opacity=".25" filter="url(#blur)"/>` : '')
    const shard = (dx, hh, ww, rot) => `<g transform="rotate(${rot} ${f1(x + dx * h)} ${f1(y)})"><path d="M${f1(x + dx * h - ww * h)} ${f1(y)} L${f1(x + dx * h - ww * h * 0.7)} ${f1(y - hh * h * 0.8)} L${f1(x + dx * h)} ${f1(y - hh * h)} L${f1(x + dx * h + ww * h * 0.7)} ${f1(y - hh * h * 0.8)} L${f1(x + dx * h + ww * h)} ${f1(y)}Z" fill="${p.a}"/><path d="M${f1(x + dx * h)} ${f1(y - hh * h)} L${f1(x + dx * h + ww * h * 0.7)} ${f1(y - hh * h * 0.8)} L${f1(x + dx * h + ww * h)} ${f1(y)} L${f1(x + dx * h)} ${f1(y)}Z" fill="${p.b}" opacity=".6"/><path d="M${f1(x + dx * h - ww * h * 0.7)} ${f1(y - hh * h * 0.8)} L${f1(x + dx * h)} ${f1(y - hh * h)} L${f1(x + dx * h - ww * h * 0.15)} ${f1(y - hh * h * 0.4)}Z" fill="${p.c}" opacity=".8"/></g>`
    return s + shard(-0.22, 0.6, 0.1, -14) + shard(0.24, 0.5, 0.09, 12) + shard(0, 1, 0.14, 0)
  },
  bush(x, y, h, r, p) {
    const c = (dx, dy, rr, col) => `<circle cx="${f1(x + dx * h)}" cy="${f1(y - dy * h)}" r="${f1(rr * h)}" fill="${col}"/>`
    return shadow(x, y, h * 1.1) + c(-0.35, 0.28, 0.3, p.b) + c(0.35, 0.28, 0.3, p.b) + c(0, 0.4, 0.4, p.a) + c(-0.1, 0.55, 0.2, p.c) + (p.d ? c(0.2, 0.5, 0.05, p.d) + c(-0.3, 0.35, 0.05, p.d) : '')
  },
  reeds(x, y, h, r, p) {
    let s = shadow(x, y, h * 0.8)
    for (let i = 0; i < 9; i++) {
      const dx = (i / 8 - 0.5) * h * 0.7
      const hh = h * (0.7 + r() * 0.5)
      const lean = (r() - 0.5) * h * 0.3
      s += `<path d="M${f1(x + dx)} ${f1(y)} Q${f1(x + dx + lean * 0.4)} ${f1(y - hh * 0.6)} ${f1(x + dx + lean)} ${f1(y - hh)}" stroke="${i % 2 ? p.a : p.b}" stroke-width="${f1(Math.max(1, h * 0.05))}" fill="none" stroke-linecap="round"/>`
      if (p.d && i % 3 === 0) s += `<ellipse cx="${f1(x + dx + lean)}" cy="${f1(y - hh)}" rx="${f1(Math.max(1, h * 0.04))}" ry="${f1(h * 0.1)}" fill="${p.d}"/>`
    }
    return s
  },
  geyser(x, y, h, r, p) {
    let s = shadow(x, y, h * 0.7) + `<path d="M${f1(x - h * 0.34)} ${f1(y)} Q${f1(x - h * 0.2)} ${f1(y - h * 0.22)} ${f1(x - h * 0.08)} ${f1(y - h * 0.26)} L${f1(x + h * 0.08)} ${f1(y - h * 0.26)} Q${f1(x + h * 0.22)} ${f1(y - h * 0.22)} ${f1(x + h * 0.34)} ${f1(y)}Z" fill="${p.d}"/><ellipse cx="${f1(x)}" cy="${f1(y - h * 0.26)}" rx="${f1(h * 0.09)}" ry="${f1(h * 0.03)}" fill="${p.b}"/>`
    for (let i = 0; i < 7; i++) {
      const t = i / 6
      s += `<circle cx="${f1(x + (r() - 0.5) * h * 0.1 + t * h * 0.12)}" cy="${f1(y - h * 0.28 - t * h * 0.7)}" r="${f1(h * (0.06 + t * 0.14))}" fill="${p.a}" opacity="${f1(0.7 * (1 - t * 0.7))}" filter="url(#blur)"/>`
    }
    return s
  },
  vent(x, y, h, r, p) {
    const id = nid('vt')
    let embers = ''
    for (let k = 0; k < 6; k++) embers += `<circle cx="${f1(x + (r() - 0.5) * h * 0.7)}" cy="${f1(y - h * (0.7 + r() * 0.9))}" r="${f1(Math.max(1, h * (0.02 + r() * 0.03)))}" fill="#ffc060" opacity="${f1(0.9 - k * 0.1)}"/>`
    return (
      shadow(x, y, h * 1.1) +
      `<ellipse cx="${f1(x)}" cy="${f1(y - h * 0.4)}" rx="${f1(h * 0.95)}" ry="${f1(h * 0.7)}" fill="${p.c}" opacity=".3" filter="url(#blur)"/>` +
      `<defs><radialGradient id="${id}" cx=".4" cy=".25" r=".9"><stop offset="0" stop-color="#5a4038"/><stop offset=".6" stop-color="${p.d}"/><stop offset="1" stop-color="#0c0605"/></radialGradient></defs>` +
      `<path d="M${f1(x - h * 0.6)} ${f1(y)} Q${f1(x - h * 0.56)} ${f1(y - h * 0.5)} ${f1(x - h * 0.2)} ${f1(y - h * 0.62)} L${f1(x + h * 0.2)} ${f1(y - h * 0.62)} Q${f1(x + h * 0.56)} ${f1(y - h * 0.5)} ${f1(x + h * 0.6)} ${f1(y)}Z" fill="url(#${id})"/>` +
      `<ellipse cx="${f1(x)}" cy="${f1(y - h * 0.62)}" rx="${f1(h * 0.22)}" ry="${f1(h * 0.07)}" fill="${p.c}"/><ellipse cx="${f1(x)}" cy="${f1(y - h * 0.62)}" rx="${f1(h * 0.12)}" ry="${f1(h * 0.04)}" fill="#fff0c0"/>` +
      `<path d="M${f1(x - h * 0.1)} ${f1(y - h * 0.58)} q${f1(-h * 0.1)} ${f1(h * 0.2)} ${f1(-h * 0.2)} ${f1(h * 0.5)} M${f1(x + h * 0.08)} ${f1(y - h * 0.58)} q${f1(h * 0.06)} ${f1(h * 0.2)} ${f1(h * 0.16)} ${f1(h * 0.5)}" stroke="${p.c}" stroke-width="${f1(Math.max(1, h * 0.04))}" fill="none" stroke-linecap="round" opacity=".9"/>` +
      embers
    )
  },
  iceblock(x, y, h, r, p) {
    const w = h * (1 + r() * 0.5)
    return (
      shadow(x, y, w) +
      `<path d="M${f1(x - w * 0.5)} ${f1(y)} L${f1(x - w * 0.44)} ${f1(y - h * 0.7)} L${f1(x - w * 0.1)} ${f1(y - h)} L${f1(x + w * 0.34)} ${f1(y - h * 0.84)} L${f1(x + w * 0.5)} ${f1(y)}Z" fill="${p.a}" opacity=".95"/>` +
      `<path d="M${f1(x - w * 0.1)} ${f1(y - h)} L${f1(x + w * 0.34)} ${f1(y - h * 0.84)} L${f1(x + w * 0.5)} ${f1(y)} L${f1(x + w * 0.05)} ${f1(y)}Z" fill="${p.b}" opacity=".55"/>` +
      `<path d="M${f1(x - w * 0.44)} ${f1(y - h * 0.7)} L${f1(x - w * 0.1)} ${f1(y - h)} L${f1(x - w * 0.16)} ${f1(y - h * 0.4)}Z" fill="${p.c}" opacity=".85"/>`
    )
  },
  dune(x, y, h, r, p) {
    const w = h * 4
    return `<path d="M${f1(x - w / 2)} ${f1(y)} Q${f1(x - w * 0.12)} ${f1(y - h * 1.3)} ${f1(x + w * 0.05)} ${f1(y - h)} Q${f1(x + w * 0.3)} ${f1(y - h * 0.5)} ${f1(x + w / 2)} ${f1(y)}Z" fill="${p.a}"/><path d="M${f1(x + w * 0.05)} ${f1(y - h)} Q${f1(x + w * 0.3)} ${f1(y - h * 0.5)} ${f1(x + w / 2)} ${f1(y)} L${f1(x + w * 0.02)} ${f1(y)}Z" fill="${p.b}" opacity=".55"/>`
  },
  log(x, y, h, r, p) {
    const w = h * 2.6
    return shadow(x, y, w) + `<rect x="${f1(x - w / 2)}" y="${f1(y - h * 0.45)}" width="${f1(w)}" height="${f1(h * 0.45)}" rx="${f1(h * 0.2)}" fill="${p.a}"/><rect x="${f1(x - w / 2)}" y="${f1(y - h * 0.45)}" width="${f1(w)}" height="${f1(h * 0.14)}" rx="${f1(h * 0.07)}" fill="${p.c}" opacity=".6"/><ellipse cx="${f1(x + w / 2)}" cy="${f1(y - h * 0.22)}" rx="${f1(h * 0.1)}" ry="${f1(h * 0.22)}" fill="${p.b}"/>`
  },
  tuft(x, y, h, r, p) {
    let s = `<ellipse cx="${f1(x + h * 0.1)}" cy="${f1(y)}" rx="${f1(h * 0.42)}" ry="${f1(h * 0.09)}" fill="#000" opacity=".25"/>`
    const n = 5 + Math.floor(r() * 4)
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 1.3 + (r() - 0.5) * 0.3
      const len = h * (0.6 + r() * 0.5)
      s += `<path d="M${f1(x + (r() - 0.5) * h * 0.2)} ${f1(y)} Q${f1(x + Math.sin(a) * len * 0.3)} ${f1(y - len * 0.55)} ${f1(x + Math.sin(a) * len)} ${f1(y - Math.cos(a) * len)}" stroke="${p.cols[i % p.cols.length]}" stroke-width="${f1(Math.max(1, h * 0.07))}" fill="none" stroke-linecap="round"/>`
    }
    if (p.flower) for (let i = 0; i < 3; i++) s += `<circle cx="${f1(x + (r() - 0.5) * h * 0.8)}" cy="${f1(y - r() * h * 0.3)}" r="${f1(Math.max(1, h * 0.07))}" fill="${p.flower[i % p.flower.length]}"/>`
    return s
  },
  palm(x, y, h, r, p) {
    const lean = h * (0.12 + r() * 0.12) * (r() < 0.5 ? -1 : 1)
    const tx = x + lean
    const ty = y - h
    let s = shadow(x, y, h * 0.5) + `<path d="M${f1(x)} ${f1(y)} Q${f1(x + lean * 0.2)} ${f1(y - h * 0.55)} ${f1(tx)} ${f1(ty)}" stroke="${p.d}" stroke-width="${f1(Math.max(2, h * 0.07))}" fill="none" stroke-linecap="round"/>`
    for (const a of [-2.9, -2.3, -1.6, -0.9, -0.2, 0.3]) {
      const l = h * 0.42
      s += `<path d="M${f1(tx)} ${f1(ty)} q${f1(Math.cos(a) * l * 0.6)} ${f1(Math.sin(a) * l * 0.5 - l * 0.35)} ${f1(Math.cos(a) * l)} ${f1(Math.sin(a) * l * 0.3 + l * 0.32)}" stroke="${p.a}" stroke-width="${f1(Math.max(2, h * 0.055))}" fill="none" stroke-linecap="round"/><path d="M${f1(tx)} ${f1(ty)} q${f1(Math.cos(a) * l * 0.6)} ${f1(Math.sin(a) * l * 0.5 - l * 0.35 + 2)} ${f1(Math.cos(a) * l)} ${f1(Math.sin(a) * l * 0.3 + l * 0.32 + 2)}" stroke="${p.b}" stroke-width="${f1(Math.max(1, h * 0.03))}" fill="none" opacity=".6"/>`
    }
    return s
  },
  fern(x, y, h, r, p) {
    let s = shadow(x, y, h * 0.8)
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.2
      const len = h * (0.8 + r() * 0.3)
      const ex = x + Math.sin(a) * len
      const ey = y - Math.cos(a) * len * 0.8
      s += `<path d="M${f1(x)} ${f1(y)} Q${f1(x + Math.sin(a) * len * 0.5)} ${f1(y - len * 0.9)} ${f1(ex)} ${f1(ey)}" stroke="${i % 2 ? p.a : p.b}" stroke-width="${f1(Math.max(1.2, h * 0.07))}" fill="none" stroke-linecap="round"/>`
    }
    return s
  },
}

/* ---- where props go ---- */
function zonesFor(g, form) {
  const D = g.H - g.hz
  return {
    far: { x: [0, g.W], y: [g.hz + 2, g.hz + D * (form === 'wide' ? 0.19 : 0.36)] },
    edgeL: { x: [0, g.W * 0.075], y: [g.hz + D * 0.14, g.H * (form === 'wide' ? 0.86 : 0.97)] },
    edgeR: { x: [g.W * 0.925, g.W], y: [g.hz + D * 0.14, g.H * (form === 'wide' ? 0.86 : 0.97)] },
    fore: { x: [0, g.W], y: [g.H * 0.9, g.H] },
  }
}
/* How wide a prop is for its height, to test it against the fighters. */
const KW = { treeBroad: 0.95, pine: 0.7, deadTree: 0.6, mush: 1.1, mushCluster: 1.5, rock: 1.6, boulders: 2.6, cactus: 0.5, mesa: 1.9, spire: 0.5, crystal: 0.8, bush: 1.2, reeds: 0.8, geyser: 0.8, vent: 1.2, iceblock: 1.4, dune: 4, log: 2.6, tuft: 0.9, fern: 1.1, palm: 1.0 }
/* Where a team stands, as fractions of the field (formation.ts's lines and spots, with a fighter's size): nothing may stand in front of it. */
const KEEP = { wide: { x: [0.085, 0.915], y: [0.3, 0.73], back: 0.53 }, tall: { x: [0.05, 0.95], y: [0.5, 0.975], back: 0.68 } }
function blocked(g, form, kind, x, y, h) {
  const k = KEEP[form]
  if (y < g.H * k.back - 4) return false
  const w = h * (KW[kind] || 1)
  return x + w / 2 > g.W * k.x[0] && x - w / 2 < g.W * k.x[1] && y > g.H * k.y[0] && y - h < g.H * k.y[1]
}
function propsSVG(g, form, recipe, seed) {
  const rnd = seeded(seed)
  const Z = zonesFor(g, form)
  const D = g.H - g.hz
  const k = (g.W / 1600) * (form === 'tall' ? 1.1 : 1)
  const items = []
  for (const spec of recipe.props || []) {
    const zones = spec.zone === 'edge' ? ['edgeL', 'edgeR'] : [spec.zone]
    const n = Math.round(spec.n * (form === 'tall' ? spec.tall ?? 0.7 : 1))
    for (let i = 0; i < n; i++) {
      const z = Z[zones[i % zones.length]]
      let x, y, h
      let ok = false
      for (let attempt = 0; attempt < 12 && !ok; attempt++) {
        x = lerp(z.x[0], z.x[1], rnd())
        const yr = spec.y ? [g.hz + D * spec.y[0], g.hz + D * spec.y[1]] : z.y
        y = lerp(yr[0], yr[1], Math.pow(rnd(), spec.bias || 1))
        const t = Math.max(0, Math.min(1, (y - g.hz) / D))
        h = lerp(spec.size[0], spec.size[1], Math.pow(t, 1.1)) * k * (0.8 + rnd() * 0.4)
        ok = !blocked(g, form, spec.kind, x, y, h)
      }
      if (!ok) continue
      items.push({ y, svg: P[spec.kind](x, y, h, rnd, spec.pal || {}) })
    }
  }
  items.sort((a, b) => a.y - b.y)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}"><defs><filter id="blur"><feGaussianBlur stdDeviation="${f1(3 * k)}"/></filter></defs>${items.map((i) => i.svg).join('')}</svg>`
}

module.exports = { GEO, FORMS, seeded, f1, mix, sh, lerp, slugOf, nid, hashOf, floorSVG, propsSVG, P, shadow, sharp, fs, path }
