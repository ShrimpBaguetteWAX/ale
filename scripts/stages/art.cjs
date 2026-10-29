/*
 * Better rocks and trees. Replaces the first pass's domes and flat circles:
 * rocks are faceted stones with a lit plane, a shaded plane and cracks; trees
 * are clumps of foliage, each shaded like a small ball, over a shaded trunk.
 */
const E = require('./engine.cjs')
const { P, f1, sh, nid, shadow } = E

/* A soft pool of shade under a thing, wider than it is tall. */
const pool = (x, y, w, a = 0.34) => {
  const id = nid('sp')
  return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="#000" stop-opacity="${a}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="${f1(x + w * 0.06)}" cy="${f1(y + 1)}" rx="${f1(w * 0.62)}" ry="${f1(Math.max(1.6, w * 0.15))}" fill="url(#${id})"/>`
}
const poly = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join(' ') + 'Z'

function rock(x, y, h, r, p) {
  const w = h * (p.narrow ? 0.55 : 1.15 + r() * 0.7)
  const j = () => (r() - 0.5) * 0.1
  /* around the stone: base left, up the left side, over the top, down the right side, base right */
  const P0 = [
    [-0.5, 0], [-0.5 + j(), -0.3], [-0.4 + j(), -0.62], [-0.2 + j(), -0.88], [0.02 + j() * 0.5, -1], [0.24 + j(), -0.86], [0.42 + j(), -0.55], [0.5, -0.2], [0.5, 0],
  ].map(([a, b]) => [x + a * w, y + b * h])
  const ridge = [x + w * (0.02 + j()), y - h]
  const foot = [x + w * (0.08 + j()), y]
  const left = [...P0.slice(0, 5), foot]
  const right = [ridge, ...P0.slice(5), foot]
  const id = nid('rk')
  const crack = (x0, y0, x1, y1) => `<path d="M${f1(x0)} ${f1(y0)} L${f1((x0 + x1) / 2 + (r() - 0.5) * w * 0.08)} ${f1((y0 + y1) / 2)} L${f1(x1)} ${f1(y1)}" stroke="${sh(p.b, -0.2)}" stroke-width="${f1(Math.max(0.8, w * 0.012))}" fill="none" opacity=".7" stroke-linecap="round"/>`
  let s = pool(x, y, w * 1.05)
  s += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.c}"/><stop offset=".5" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient></defs>`
  s += `<path d="${poly(P0)}" fill="url(#${id})" stroke="${p.b}" stroke-width="${f1(Math.max(0.8, w * 0.01))}" stroke-linejoin="round"/>`
  s += `<path d="${poly(left)}" fill="${sh(p.c, 0.18)}" opacity=".5"/>`
  s += `<path d="${poly(right)}" fill="${sh(p.b, -0.25)}" opacity=".55"/>`
  /* the top plane catches the light */
  s += `<path d="${poly([P0[3], P0[4], P0[5], [ridge[0] + w * 0.04, ridge[1] + h * 0.22], [P0[3][0] + w * 0.08, P0[3][1] + h * 0.2]])}" fill="${sh(p.c, 0.35)}" opacity=".55"/>`
  s += crack(P0[2][0] + w * 0.1, P0[2][1] + h * 0.05, P0[1][0] + w * 0.25, P0[1][1] + h * 0.35)
  s += crack(ridge[0] + w * 0.04, ridge[1] + h * 0.25, ridge[0] + w * 0.12, ridge[1] + h * 0.7)
  /* wet, dark at the foot */
  if (p.wet) s += `<path d="M${f1(P0[0][0])} ${f1(y)} L${f1(P0[1][0])} ${f1(y - h * 0.18)} L${f1(P0[7][0])} ${f1(y - h * 0.16)} L${f1(P0[8][0])} ${f1(y)}Z" fill="#06141c" opacity=".38"/>`
  /* a few loose stones at the foot */
  for (let i = 0; i < (w > 14 ? 3 : 0); i++) {
    const sx = x + (r() - 0.5) * w * 1.3
    const sw = w * (0.07 + r() * 0.07)
    s += `<path d="${poly([[sx - sw, y], [sx - sw * 0.7, y - sw * 0.7], [sx + sw * 0.4, y - sw * 0.8], [sx + sw, y]])}" fill="${p.a}" stroke="${p.b}" stroke-width=".6"/>`
  }
  return s
}

/* foliage clumps, each a ball lit from the upper left */
function foliage(cx, cy, h, spec, p, r) {
  const id = nid('fg')
  let s = `<defs><radialGradient id="${id}" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="${p.c}"/><stop offset=".5" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></radialGradient></defs>`
  for (const [dx, dy, rr] of spec) s += `<circle cx="${f1(cx + dx * h)}" cy="${f1(cy - dy * h)}" r="${f1(rr * h)}" fill="url(#${id})"/>`
  /* leaf flecks: light on the lit side, dark on the other */
  for (const [dx, dy, rr] of spec) {
    for (let k = 0; k < 5; k++) {
      const a = r() * 6.28
      const d = rr * h * (0.35 + r() * 0.5)
      const lx = cx + dx * h + Math.cos(a) * d
      const ly = cy - dy * h + Math.sin(a) * d
      const lit = Math.cos(a) + Math.sin(a) < 0
      s += `<ellipse cx="${f1(lx)}" cy="${f1(ly)}" rx="${f1(rr * h * 0.11)}" ry="${f1(rr * h * 0.06)}" fill="${lit ? sh(p.c, 0.25) : sh(p.b, -0.3)}" opacity="${lit ? 0.55 : 0.5}" transform="rotate(${f1(a * 57)} ${f1(lx)} ${f1(ly)})"/>`
    }
  }
  return s
}

function treeBroad(x, y, h, r, p) {
  const tw = Math.max(2, h * 0.075)
  const id = nid('tk')
  const trunk = `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${sh(p.d, 0.18)}"/><stop offset=".6" stop-color="${p.d}"/><stop offset="1" stop-color="${sh(p.d, -0.4)}"/></linearGradient></defs>` +
    `<path d="M${f1(x - tw * 1.5)} ${f1(y)} Q${f1(x - tw * 0.6)} ${f1(y - h * 0.08)} ${f1(x - tw * 0.55)} ${f1(y - h * 0.34)} L${f1(x - tw * 0.4)} ${f1(y - h * 0.62)} L${f1(x + tw * 0.4)} ${f1(y - h * 0.62)} L${f1(x + tw * 0.55)} ${f1(y - h * 0.34)} Q${f1(x + tw * 0.7)} ${f1(y - h * 0.08)} ${f1(x + tw * 1.6)} ${f1(y)}Z" fill="url(#${id})"/>` +
    `<path d="M${f1(x)} ${f1(y - h * 0.42)} L${f1(x - h * 0.16)} ${f1(y - h * 0.62)} M${f1(x)} ${f1(y - h * 0.46)} L${f1(x + h * 0.15)} ${f1(y - h * 0.64)}" stroke="${p.d}" stroke-width="${f1(tw * 0.45)}" stroke-linecap="round" fill="none"/>`
  /* dome of foliage, the biggest and lowest first */
  const spec = [
    [0, 0.62, 0.3], [-0.24, 0.56, 0.2], [0.24, 0.56, 0.21], [-0.12, 0.8, 0.2], [0.14, 0.8, 0.19],
    [-0.3, 0.68, 0.14], [0.3, 0.7, 0.14], [0, 0.9, 0.15], [-0.17, 0.46, 0.12], [0.18, 0.46, 0.12],
  ]
  return pool(x, y, h * 0.7, 0.4) + trunk + foliage(x, y, h, spec, p, r)
}

function bush(x, y, h, r, p) {
  const spec = [[-0.4, 0.26, 0.26], [0.4, 0.26, 0.26], [0, 0.34, 0.34], [-0.2, 0.52, 0.2], [0.2, 0.5, 0.2], [0, 0.62, 0.16]]
  let s = pool(x, y, h * 1.3, 0.34) + foliage(x, y, h, spec, p, r)
  if (p.d) for (let i = 0; i < 5; i++) s += `<circle cx="${f1(x + (r() - 0.5) * h * 0.9)}" cy="${f1(y - h * (0.25 + r() * 0.35))}" r="${f1(Math.max(1.2, h * 0.05))}" fill="${p.d}"/>`
  return s
}

function pine(x, y, h, r, p) {
  const tw = Math.max(1.6, h * 0.05)
  const id = nid('pn')
  let s = pool(x, y, h * 0.5, 0.36) + `<rect x="${f1(x - tw / 2)}" y="${f1(y - h * 0.22)}" width="${f1(tw)}" height="${f1(h * 0.22)}" fill="${p.d}"/>`
  s += `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${p.c}"/><stop offset=".45" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient></defs>`
  const tiers = 5
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers
    const by = y - h * (0.12 + t * 0.17)
    const w = h * (0.33 - t * 0.055)
    const ty = by - h * 0.3
    /* ragged edge: the boughs hang in steps down each side */
    let d = `M${f1(x)} ${f1(ty)}`
    const steps = 3
    for (let k = 1; k <= steps; k++) {
      const u = k / steps
      d += ` L${f1(x + w * u * 0.8 + (k === steps ? w * 0.2 : 0))} ${f1(ty + (by - ty) * u - (k < steps ? (by - ty) * 0.06 : 0))}`
      if (k < steps) d += ` L${f1(x + w * u * 0.62)} ${f1(ty + (by - ty) * u + (by - ty) * 0.02)}`
    }
    for (let k = steps; k >= 1; k--) {
      const u = k / steps
      if (k < steps) d += ` L${f1(x - w * u * 0.62)} ${f1(ty + (by - ty) * u + (by - ty) * 0.02)}`
      d += ` L${f1(x - w * u * 0.8 - (k === steps ? w * 0.2 : 0))} ${f1(ty + (by - ty) * u - (k < steps ? (by - ty) * 0.06 : 0))}`
    }
    d += 'Z'
    s += `<path d="${d}" fill="url(#${id})"/>`
    if (p.snow) s += `<path d="M${f1(x)} ${f1(ty)} L${f1(x + w * 0.55)} ${f1(ty + (by - ty) * 0.55)} L${f1(x + w * 0.2)} ${f1(ty + (by - ty) * 0.46)} L${f1(x - w * 0.12)} ${f1(ty + (by - ty) * 0.6)} L${f1(x - w * 0.5)} ${f1(ty + (by - ty) * 0.52)}Z" fill="${p.snow}" opacity=".92"/>`
  }
  return s
}

/* A sinter cone in terraces, a jet of water on it, steam going up. */
function geyser(x, y, h, r, p) {
  const id = nid('gy')
  const jid = nid('gj')
  const top = y - h * 0.24
  let s = pool(x, y, h * 0.9, 0.3)
  s += `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${sh(p.d, 0.2)}"/><stop offset=".6" stop-color="${p.d}"/><stop offset="1" stop-color="${sh(p.d, -0.3)}"/></linearGradient><linearGradient id="${jid}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient></defs>`
  s += `<path d="M${f1(x - h * 0.44)} ${f1(y)} Q${f1(x - h * 0.34)} ${f1(y - h * 0.1)} ${f1(x - h * 0.12)} ${f1(top)} L${f1(x + h * 0.12)} ${f1(top)} Q${f1(x + h * 0.34)} ${f1(y - h * 0.1)} ${f1(x + h * 0.44)} ${f1(y)}Z" fill="url(#${id})"/>`
  /* the terraces: stained steps round the cone */
  for (const [k, c] of [[0.3, p.t || '#e0904a'], [0.62, p.d]]) {
    s += `<path d="M${f1(x - h * (0.4 - k * 0.2))} ${f1(y - h * 0.24 * k)} Q${f1(x)} ${f1(y - h * 0.24 * k + h * 0.07)} ${f1(x + h * (0.4 - k * 0.2))} ${f1(y - h * 0.24 * k)}" stroke="${c}" stroke-width="${f1(Math.max(1, h * 0.03))}" fill="none" stroke-linecap="round" opacity=".85"/>`
  }
  s += `<ellipse cx="${f1(x)}" cy="${f1(top)}" rx="${f1(h * 0.12)}" ry="${f1(h * 0.04)}" fill="${p.w || '#2fb8b8'}"/>`
  if (p.jet) {
    s += `<path d="M${f1(x - h * 0.05)} ${f1(top)} L${f1(x - h * 0.03)} ${f1(top - h * 0.7)} L${f1(x + h * 0.03)} ${f1(top - h * 0.7)} L${f1(x + h * 0.05)} ${f1(top)}Z" fill="url(#${jid})"/>`
    for (let k = 0; k < 6; k++) s += `<circle cx="${f1(x + (r() - 0.5) * h * 0.2)}" cy="${f1(top - h * (0.5 + r() * 0.35))}" r="${f1(Math.max(0.8, h * 0.015))}" fill="#fff" opacity=".8"/>`
  }
  for (let k = 0; k < 6; k++) {
    const t = k / 5
    s += `<circle cx="${f1(x + (r() - 0.5) * h * 0.08 + t * h * 0.16)}" cy="${f1(top - h * (0.18 + t * 0.95))}" r="${f1(h * (0.07 + t * 0.15))}" fill="${p.a}" opacity="${f1(0.55 * (1 - t * 0.75))}" filter="url(#blur)"/>`
  }
  return s
}
function steam(x, y, h, r, p) {
  let s = ''
  for (let k = 0; k < 6; k++) {
    const t = k / 5
    s += `<circle cx="${f1(x + t * h * 0.18 + (r() - 0.5) * h * 0.08)}" cy="${f1(y - t * h)}" r="${f1(h * (0.08 + t * 0.17))}" fill="${p.a || '#fff'}" opacity="${f1(0.34 * (1 - t * 0.8))}" filter="url(#blur)"/>`
  }
  return s
}

/* Dead scrub: a tangle of thin grey twigs, forking, with a few snapped short. */
function twigs(x, y, h, r, p) {
  const col = p.d || '#4a3e32'
  const lite = sh(col, 0.22)
  let s = pool(x, y, h * 0.9, 0.3)
  const arm = (x0, y0, ang, len, depth, w) => {
    const x1 = x0 + Math.sin(ang) * len
    const y1 = y0 - Math.cos(ang) * len
    const mx = (x0 + x1) / 2 + (r() - 0.5) * len * 0.25
    const my = (y0 + y1) / 2
    let o = `<path d="M${f1(x0)} ${f1(y0)} Q${f1(mx)} ${f1(my)} ${f1(x1)} ${f1(y1)}" stroke="${depth % 2 ? lite : col}" stroke-width="${f1(Math.max(0.8, w))}" fill="none" stroke-linecap="round"/>`
    if (depth < 3 && len > h * 0.07) {
      const n = 2 + (r() < 0.4 ? 1 : 0)
      for (let k = 0; k < n; k++) o += arm(x1 - (x1 - x0) * (0.1 + k * 0.18), y1 - (y1 - y0) * (0.1 + k * 0.18), ang + (r() - 0.5) * 1.5, len * (0.5 + r() * 0.25), depth + 1, w * 0.62)
    }
    return o
  }
  const n = 6 + Math.floor(r() * 4)
  for (let i = 0; i < n; i++) s += arm(x + (r() - 0.5) * h * 0.18, y, (i / (n - 1) - 0.5) * 1.5 + (r() - 0.5) * 0.3, h * (0.55 + r() * 0.45), 0, Math.max(1, h * 0.03))
  return s
}

Object.assign(P, { rock, treeBroad, bush, pine, geyser, steam, twigs })
module.exports = {}
