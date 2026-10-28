/*
 * The arena stage, for scripts/build-stages.cjs: the bowl of stands and wall, the
 * markings on its sand and the strip of each planet's country seen over its rim,
 * as SVG to be painted once. Ported from the arena stylesheet.
 *
 * Two geometries, one per field: 'wide' is the desktop window (16:9, horizon at
 * 37%), 'tall' a phone's square field, the bowl lower and flatter so the sky
 * still shows under the scorebar.
 */
function seeded(n) { let s = n; return () => ((s = (s * 9301 + 49297) % 233280) / 233280) }
const f1 = (n) => n.toFixed(1)
const DEG = Math.PI / 180
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)]

/*
 * The arena is an ellipse in perspective. The foot of its wall is an arc that
 * sits highest straight ahead and runs down past both edges of the window.
 * Every ring above it (the wall's top, each tier of the stands, the rim) is an
 * arc of the same width that rises by C straight ahead and by S at the sides,
 * so the nearer parts of the bowl stand taller: at angle phi a ring sits
 * S·(1 − sin phi) + C·sin phi above the foot.
 */
/*
 * Far and wide: the wall's foot sits just under the horizon, so it stands
 * about five times further off than the back row and its height reads as two
 * fighters' and more; the stands are five thin tiers, so the crowd is small.
 * The gates, banners, braziers and flags are placed by where they fall on the
 * screen (fractions of its width) and turned into angles round the bowl.
 * The floor ring spans both formations: [x, y, rx, ry] in the layout's units.
 */
const AG = {
  wide: { W: 1600, H: 900, cy: 1.12, rx: 1.2, ry: .74, wall: [.10, .40], tiers: Array(5).fill([.009, .036]), rim: [.005, .012], farH: 90, skyH: 38,
    gatesX: [.18, .82], bannersX: [.4, .6], braziersX: [.1, .28, .72, .9], flagsX: [.04, .17, .3, .43, .57, .7, .83, .96],
    ring: [800, .70, 700, .19], sigil: [800, .70, 230, .3], arch: 2.8, aisle: 9, box: .07 },
  tall: { W: 1000, H: 1000, cy: .91, rx: 1.15, ry: .55, wall: [.025, .2], tiers: Array(4).fill([.006, .03]), rim: [.004, .012], farH: 90, skyH: 36,
    gatesX: [.15, .85], bannersX: [.36, .64], braziersX: [.06, .27, .73, .94], flagsX: [.06, .24, .42, .58, .76, .94],
    ring: [500, .82, 470, .2], sigil: [500, .82, 200, .38], arch: 4.2, aisle: 13, box: .1 },
}
const degAtX = (g, fx) => Math.acos(Math.max(-1, Math.min(1, (fx * g.W - g.cx) / g.rx))) / DEG
function geo(form) {
  const a = AG[form], H = a.H
  const lv = (c, s) => ({ C: c * H, S: s * H })
  const g = { form, a, W: a.W, H, cx: a.W / 2, cy: a.cy * H, rx: a.rx * a.W, ry: a.ry * H, farH: a.farH, skyH: a.skyH }
  g.base = lv(0, 0); g.wall = lv(...a.wall)
  let tc = a.wall[0], ts = a.wall[1]
  g.tiers = a.tiers.map(([c, s]) => { tc += c; ts += s; return lv(tc, ts) })
  g.rim = lv(tc + a.rim[0], ts + a.rim[1])
  const pad = 90
  g.lo = Math.acos(Math.min(1, (g.W + pad - g.cx) / g.rx)); g.hi = Math.acos(Math.max(-1, (-pad - g.cx) / g.rx))
  g.d = { gates: a.gatesX.map((x) => degAtX(g, x)), banners: a.bannersX.map((x) => degAtX(g, x)), braziers: a.braziersX.map((x) => degAtX(g, x)), flags: a.flagsX.map((x) => degAtX(g, x)) }
  return g
}
const at = (g, phi, L) => { const sn = Math.sin(phi); return [g.cx + g.rx * Math.cos(phi), g.cy - g.ry * sn - L.S * (1 - sn) - L.C * sn] }
const mix = (A, B, t) => ({ C: A.C + (B.C - A.C) * t, S: A.S + (B.S - A.S) * t })
const down = (g, c, s) => ({ C: -c * g.H, S: -s * g.H })
function arc(g, L, rev = false, n = 96) {
  const pts = []
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(at(g, g.lo + (g.hi - g.lo) * (rev ? 1 - t : t), L)) }
  return pts
}
const pathOf = (pts, move = true) => pts.map(([x, y], i) => `${i === 0 && move ? 'M' : 'L'}${f1(x)} ${f1(y)}`).join(' ')
const band = (g, A, B) => `${pathOf(arc(g, B))} ${pathOf(arc(g, A, true), false)}Z`
const onScreen = (g, phi) => { const x = g.cx + g.rx * Math.cos(phi); return x > -60 && x < g.W + 60 }
const wallH = (g, phi) => at(g, phi, g.base)[1] - at(g, phi, g.wall)[1]
const spanDeg = (g, phi, px) => px / (g.rx * Math.max(.2, Math.sin(phi))) / DEG

/* ---- the wall round the sand: dressed stone, arches, two gates, two banners, braziers on top ---- */
function arch(g, phi, k, fill) {
  const [xb, yb] = at(g, phi, g.base), h = wallH(g, phi), w = h * .34 * k, ah = h * .78 * k
  const x0 = xb - w / 2, x1 = xb + w / 2, ys = yb - ah + w / 2, t = w * .09
  return `<path d="M${f1(x0 - t)} ${f1(yb)} V${f1(ys)} A${f1(w / 2 + t)} ${f1(w / 2 + t)} 0 0 1 ${f1(x1 + t)} ${f1(ys)} V${f1(yb)}Z" fill="#9a8ea6"/>
    <path d="M${f1(x0)} ${f1(yb)} V${f1(ys)} A${f1(w / 2)} ${f1(w / 2)} 0 0 1 ${f1(x1)} ${f1(ys)} V${f1(yb)}Z" fill="${fill}"/>`
}
function gate(g, phi, team) {
  const [xb, yb] = at(g, phi, g.base), h = wallH(g, phi), w = h * .7, ah = h * 1.12
  const x0 = xb - w / 2, x1 = xb + w / 2, ys = yb - ah + w / 2
  let bars = ''
  for (let i = 1; i < 6; i++) { const x = x0 + (w * i) / 6; bars += `M${f1(x)} ${f1(ys - (Math.sin((i / 6) * Math.PI) * w) / 2)} V${f1(yb)} ` }
  for (let i = 1; i < 4; i++) { const y = ys + ((yb - ys) * i) / 4; bars += `M${f1(x0)} ${f1(y)} H${f1(x1)} ` }
  const glow = team === 1 ? '#00baff' : '#ff5a6a'
  return `<path d="M${f1(x0 - w * .12)} ${f1(yb)} V${f1(ys)} A${f1(w * .62)} ${f1(w * .62)} 0 0 1 ${f1(x1 + w * .12)} ${f1(ys)} V${f1(yb)}Z" fill="#b3a7bd"/>
    <path d="M${f1(x0)} ${f1(yb)} V${f1(ys)} A${f1(w / 2)} ${f1(w / 2)} 0 0 1 ${f1(x1)} ${f1(ys)} V${f1(yb)}Z" fill="#120d1a"/>
    <ellipse cx="${f1(xb)}" cy="${f1(yb - h * .12)}" rx="${f1(w * .5)}" ry="${f1(h * .42)}" fill="${glow}" opacity=".32"/>
    <path d="${bars}" stroke="#8a7346" stroke-width="${f1(Math.max(1.2, w * .045))}" opacity=".9"/>
    <path d="M${f1(xb - w * .12)} ${f1(ys - w * .5)} h${f1(w * .24)} l${f1(-w * .04)} ${f1(w * .14)} h${f1(-w * .16)}Z" fill="#ffd979"/>`
}
function banner(g, phi) {
  const [xb, yb] = at(g, phi, g.base), [, yt] = at(g, phi, g.wall), h = yb - yt, w = h * .4, len = h * .86
  const x0 = xb - w / 2, x1 = xb + w / 2, y0 = yt + h * .02, y1 = y0 + len
  return `<path d="M${f1(x0)} ${f1(y0)} H${f1(x1)} V${f1(y1)} L${f1(xb)} ${f1(y1 - w * .32)} L${f1(x0)} ${f1(y1)}Z" fill="#3a2858"/>
    <path d="M${f1(x0)} ${f1(y0)} H${f1(x1)} V${f1(y1)} L${f1(xb)} ${f1(y1 - w * .32)} L${f1(x0)} ${f1(y1)}Z" fill="none" stroke="#e0b44e" stroke-width="${f1(Math.max(1, w * .05))}"/>
    <rect x="${f1(x0 - w * .08)}" y="${f1(y0 - w * .06)}" width="${f1(w * 1.16)}" height="${f1(w * .12)}" rx="${f1(w * .05)}" fill="#c9a24a"/>
    <circle cx="${f1(xb)}" cy="${f1(y0 + len * .4)}" r="${f1(w * .26)}" fill="none" stroke="#ffd979" stroke-width="${f1(Math.max(1, w * .05))}"/>
    <path d="M${f1(xb - w * .17)} ${f1(y0 + len * .4 + w * .1)} L${f1(xb + w * .17)} ${f1(y0 + len * .4 - w * .1)} M${f1(xb + w * .17)} ${f1(y0 + len * .4 + w * .1)} L${f1(xb - w * .17)} ${f1(y0 + len * .4 - w * .1)}" stroke="#ffd979" stroke-width="${f1(Math.max(1, w * .05))}" stroke-linecap="round"/>`
}
const brazierLevel = (g) => mix(g.base, g.wall, .74)
function brazierBowl(g, phi) {
  const [x, yb] = at(g, phi, down(g, .008, .016)), [, yt] = at(g, phi, brazierLevel(g)), h = wallH(g, phi), w = h * .26
  return `<path d="M${f1(x)} ${f1(yb)} V${f1(yt - w * .3)}" stroke="#2a2230" stroke-width="${f1(Math.max(1.4, w * .12))}"/><path d="M${f1(x - w * .34)} ${f1(yb)} L${f1(x)} ${f1(yb - h * .1)} L${f1(x + w * .34)} ${f1(yb)}" fill="none" stroke="#2a2230" stroke-width="${f1(Math.max(1.2, w * .08))}"/>
    <path d="M${f1(x - w * .32)} ${f1(yt)} L${f1(x - w * .12)} ${f1(yt - w * .55)} M${f1(x + w * .32)} ${f1(yt)} L${f1(x + w * .12)} ${f1(yt - w * .55)}" stroke="#2a2230" stroke-width="${f1(Math.max(1.2, w * .08))}"/>
    <path d="M${f1(x - w / 2)} ${f1(yt - w * .62)} Q${f1(x)} ${f1(yt - w * .1)} ${f1(x + w / 2)} ${f1(yt - w * .62)}Z" fill="#3a3040"/>
    <path d="M${f1(x - w / 2)} ${f1(yt - w * .62)} H${f1(x + w / 2)}" stroke="#c9a24a" stroke-width="${f1(Math.max(1, w * .07))}"/>`
}
function wallLayer(g, rnd) {
  const { base, wall, a } = g
  let s = `<path d="${band(g, base, wall)}" fill="url(#wallg-${g.form})"/>`
  for (const t of [.34, .67]) s += `<path d="${pathOf(arc(g, mix(base, wall, t)))}" fill="none" stroke="#2c2636" stroke-width="1.3" opacity=".55"/>`
  const step = (g.form === 'wide' ? 1.1 : 1.6) * DEG
  let j = ''
  for (let row = 0; row < 3; row++) {
    const A = mix(base, wall, row / 3 + .02), B = mix(base, wall, (row + 1) / 3 - .02)
    for (let phi = g.lo + ((row % 2) * step) / 2; phi < g.hi; phi += step) { const [x1, y1] = at(g, phi, A), [x2, y2] = at(g, phi, B); j += `M${f1(x1)} ${f1(y1)} L${f1(x2)} ${f1(y2)} ` }
  }
  s += `<path d="${j}" stroke="#2c2636" stroke-width="1" opacity=".38"/>`
  /* weathering: darker streaks running down from the coping */
  let streaks = ''
  for (let phi = g.lo; phi < g.hi; phi += (1.4 + rnd() * 2.6) * DEG) {
    const [x, yt] = at(g, phi, wall), h = wallH(g, phi), l = h * (.25 + rnd() * .5)
    streaks += `<path d="M${f1(x)} ${f1(yt + 2)} q${f1((rnd() - .5) * 4)} ${f1(l * .5)} ${f1((rnd() - .5) * 3)} ${f1(l)}" stroke="#2a2232" stroke-width="${f1(1.2 + rnd() * 2.4)}" opacity=".22"/>`
  }
  s += streaks
  /* arches all along, the gates and the banners in their places, no arch under either */
  const hc = wallH(g, 90 * DEG)
  const busy = [...g.d.gates.map((d) => [d, spanDeg(g, d * DEG, wallH(g, d * DEG) * .55)]), ...g.d.banners.map((d) => [d, spanDeg(g, d * DEG, wallH(g, d * DEG) * .32)]), [90, spanDeg(g, 90 * DEG, g.W * a.box * .5 + hc * .2)]]
  const archStep = a.arch
  for (let d = 90 + archStep / 2; d < 178; d += archStep) for (const dd of [d, 180 - d]) {
    if (busy.some(([b, r]) => Math.abs(b - dd) < r)) continue
    if (onScreen(g, dd * DEG)) s += arch(g, dd * DEG, 1, `url(#archg-${g.form})`)
  }
  g.d.gates.forEach((d, i) => { s += gate(g, d * DEG, i === 0 ? 1 : 2) })
  g.d.banners.forEach((d) => { s += banner(g, d * DEG) })
  s += `<path d="${pathOf(arc(g, wall))}" fill="none" stroke="#cbbfd2" stroke-width="${g.form === 'wide' ? 3.2 : 3}"/><path d="${pathOf(arc(g, mix(wall, base, .05)))}" fill="none" stroke="#2c2636" stroke-width="1.5" opacity=".7"/>`
  g.d.braziers.forEach((d) => { if (onScreen(g, d * DEG)) s += brazierBowl(g, d * DEG) })
  return s
}

/* ---- the stands: three tiers of stone seats, packed with a crowd that takes sides, aisles of steps ---- */
const CLOTH = ['#5a4a6a', '#6b5a4a', '#4a5a6a', '#7a5a5a', '#5a6a5a', '#8a7a6a', '#3e3a4a', '#6a4a5e', '#4e5e70']
const SKIN = ['#c9a27e', '#a77d5a', '#8a6a50', '#d8b896', '#7f9a8a', '#9a8ab0', '#b0b8c4', '#8fa86a']
function person(x, yb, bh, rnd, left) {
  const r = bh * .165, y = yb - bh * (.04 + rnd() * .08)
  let s = `<ellipse cx="${f1(x)}" cy="${f1(y - bh * .16)}" rx="${f1(r * 1.55)}" ry="${f1(r * 1.1)}" fill="${pick(rnd, CLOTH)}"/><circle cx="${f1(x)}" cy="${f1(y - bh * .5)}" r="${f1(r)}" fill="${pick(rnd, SKIN)}"/>`
  const v = rnd()
  if (v > .9) { const c = left ? '#00baff' : '#ff5a6a', px = x + r * 1.1; s += `<path d="M${f1(px)} ${f1(y - bh * .3)} V${f1(y - bh * 1.15)}" stroke="#2a2230" stroke-width="${f1(Math.max(.7, r * .22))}"/><path d="M${f1(px)} ${f1(y - bh * 1.15)} h${f1(r * 2.1)} l${f1(-r * .5)} ${f1(r * .6)} l${f1(r * .5)} ${f1(r * .6)} h${f1(-r * 2.1)}Z" fill="${c}"/>` }
  else if (v > .8) s += `<path d="M${f1(x - r * 1.2)} ${f1(y - bh * .26)} l${f1(-r * .5)} ${f1(-bh * .55)}" stroke="${pick(rnd, SKIN)}" stroke-width="${f1(Math.max(.8, r * .45))}" stroke-linecap="round"/>`
  else if (v > .66) s += `<path d="M${f1(x - r * 1.3)} ${f1(y - bh * .2)} h${f1(r * 2.6)}" stroke="${left ? '#00baff' : '#ff5a6a'}" stroke-width="${f1(Math.max(.8, r * .45))}" opacity=".85"/>`
  return s
}
function standsLayer(g, rnd) {
  const levels = [g.wall, ...g.tiers]
  let s = '', heads = '', stairs = ''
  const aisles = []
  for (let d = 90 + g.a.aisle * .55; d < 176; d += g.a.aisle) aisles.push(d * DEG, (180 - d) * DEG)
  levels.slice(1).forEach((T, k) => {
    const B = levels[k]
    s += `<path d="${band(g, B, T)}" fill="${k % 2 ? '#3a3246' : '#443b51'}"/>`
    s += `<path d="${pathOf(arc(g, B))}" fill="none" stroke="#a296ae" stroke-width="${g.form === 'wide' ? 1.6 : 1.5}" opacity=".7"/>`
    let phi = g.lo
    while (phi < g.hi) {
      const [xb, yb] = at(g, phi, B), [, yt] = at(g, phi, T), bh = yb - yt, step = Math.max(3, bh * .62)
      const dphi = step / Math.hypot(g.rx * Math.sin(phi), (g.ry + T.S - T.C) * Math.cos(phi))
      if (onScreen(g, phi) && !aisles.some((a) => Math.abs(a - phi) < dphi * 1.1) && rnd() > .08) heads += person(xb + (rnd() - .5) * step * .25, yb, bh, rnd, xb < g.cx)
      phi += dphi
    }
  })
  /* the aisles: stone steps from the wall's top to the rim */
  for (const a of aisles) {
    if (!onScreen(g, a)) continue
    const w = .45 * DEG * (g.form === 'wide' ? 1 : 1.3)
    const p = [at(g, a - w, g.wall), at(g, a + w, g.wall), at(g, a + w, g.rim), at(g, a - w, g.rim)]
    stairs += `<path d="M${p.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')}Z" fill="#625672"/>`
    for (let t = 0; t < 1; t += .125) { const L = mix(g.wall, g.rim, t), [x1, y1] = at(g, a - w, L), [x2, y2] = at(g, a + w, L); stairs += `<path d="M${f1(x1)} ${f1(y1)} L${f1(x2)} ${f1(y2)}" stroke="#4a4156" stroke-width="1"/>` }
  }
  /* the rim: a parapet round the top */
  const top = levels[levels.length - 1]
  s += stairs + `<g>${heads}</g><path d="${band(g, top, g.rim)}" fill="#55496a"/><path d="${pathOf(arc(g, g.rim))}" fill="none" stroke="#b4a6c0" stroke-width="2.6"/>`
  return s
}

/* ---- the royal box: straight ahead, gold-railed under a striped awning ---- */
function royalBox(g) {
  const n = g.tiers.length, [x, yw] = at(g, 90 * DEG, g.wall), [, y2] = at(g, 90 * DEG, g.tiers[Math.min(1, n - 1)]), [, y3] = at(g, 90 * DEG, g.tiers[Math.min(n - 2, 3)])
  const w = g.W * g.a.box, h = yw - y2, x0 = x - w / 2
  let s = `<rect x="${f1(x0)}" y="${f1(y3)}" width="${f1(w)}" height="${f1(yw - y3)}" fill="#221a2e"/>`
  for (let i = 0; i < 5; i++) { const px = x0 + w * (.18 + i * .16); s += `<circle cx="${f1(px)}" cy="${f1(y2 + h * .25)}" r="${f1(h * .2)}" fill="${['#d8b896', '#9a8ab0', '#c9a27e', '#7f9a8a', '#d8b896'][i]}"/><ellipse cx="${f1(px)}" cy="${f1(y2 + h * .62)}" rx="${f1(h * .3)}" ry="${f1(h * .24)}" fill="${['#6a3a8a', '#3a2858', '#c9a24a', '#3a2858', '#6a3a8a'][i]}"/>` }
  s += `<rect x="${f1(x0)}" y="${f1(y2 + h * .55)}" width="${f1(w)}" height="${f1(h * .45)}" fill="#3a2858"/><rect x="${f1(x0)}" y="${f1(y2 + h * .52)}" width="${f1(w)}" height="${f1(h * .1)}" fill="#e0b44e"/>`
  for (let i = 0; i <= 10; i++) s += `<rect x="${f1(x0 + (w * i) / 10 - h * .03)}" y="${f1(y2 + h * .6)}" width="${f1(h * .06)}" height="${f1(h * .36)}" fill="#c9a24a"/>`
  let stripes = ''
  for (let i = 0; i < 8; i++) stripes += `<path d="M${f1(x0 - w * .06 + (w * 1.12 * i) / 8)} ${f1(y3)} L${f1(x0 - w * .06 + (w * 1.12 * (i + 1)) / 8)} ${f1(y3)} L${f1(x0 + (w * (i + 1)) / 8)} ${f1(y3 - h * 1.1)} L${f1(x0 + (w * i) / 8)} ${f1(y3 - h * 1.1)}Z" fill="${i % 2 ? '#e0b44e' : '#4a2f6e'}"/>`
  s += stripes + `<path d="M${f1(x0 - w * .06)} ${f1(y3)} H${f1(x0 + w * 1.06)}" stroke="#ffd979" stroke-width="2"/>`
  return s
}

function arenaLayer(g) {
  const rnd = seeded(g.form === 'wide' ? 7 : 9)
  return `<svg viewBox="0 0 ${g.W} ${g.H}" preserveAspectRatio="none"><defs>
    <linearGradient id="wallg-${g.form}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#766a82"/><stop offset=".55" stop-color="#5a4f66"/><stop offset="1" stop-color="#3a3246"/></linearGradient>
    <linearGradient id="archg-${g.form}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0e0a14"/><stop offset="1" stop-color="#241a30"/></linearGradient></defs>
    ${standsLayer(g, rnd)}${royalBox(g)}${wallLayer(g, rnd)}</svg>`
}

/* ---- the sand: shade at the wall's foot, an inlaid paving ring, the arena's sigil, old scuffs, the gates' light ---- */
function sigil() {
  let ticks = '', leaves = ''
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; ticks += `M${f1(Math.cos(a) * 88)} ${f1(Math.sin(a) * 88)} L${f1(Math.cos(a) * 97)} ${f1(Math.sin(a) * 97)} ` }
  for (const sd of [-1, 1]) for (let i = 0; i < 7; i++) { const a = (110 + i * 13) * DEG, cx = sd * Math.cos(a) * -64, cy = Math.sin(a) * 64; leaves += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="9" ry="4" transform="rotate(${f1(sd * (i * 13 - 10))} ${f1(cx)} ${f1(cy)})"/>` }
  const sword = (r) => `<g transform="rotate(${r})"><path d="M-4 -70 L0 -82 L4 -70 L4 34 L-4 34Z"/><rect x="-20" y="32" width="40" height="7" rx="3"/><rect x="-3" y="39" width="6" height="22"/><circle cx="0" cy="66" r="6"/></g>`
  return `<circle r="100" fill="rgb(70 46 22 / 20%)" stroke="#5a4020" stroke-width="9" opacity=".55"/><circle r="100" fill="none" stroke="#d6ad52" stroke-width="5"/><circle r="84" fill="none" stroke="#b08a3a" stroke-width="2.4"/>
    <path d="${ticks}" stroke="#c9a24a" stroke-width="2.4"/><g fill="#c9a24a" stroke="#5a4020" stroke-width="1.2">${sword(45)}${sword(-45)}${leaves}</g>
    <ellipse cx="0" cy="-6" rx="30" ry="14" fill="none" stroke="#d6ad52" stroke-width="3.4"/><ellipse cx="0" cy="-6" rx="18" ry="8" fill="rgb(70 46 22 / 30%)"/>`
}
function floorLayer(g) {
  const rnd = seeded(g.form === 'wide' ? 13 : 15), a = g.a
  let s = ''
  g.d.gates.forEach((d, i) => { const [x, y] = at(g, d * DEG, g.base), h = wallH(g, d * DEG); s += `<ellipse cx="${f1(x)}" cy="${f1(y + h * .22)}" rx="${f1(h * 1.6)}" ry="${f1(h * .34)}" fill="url(#spill${i}-${g.form})"/>` })
  for (const [c, sd, o] of [[.03, .06, .16], [.018, .04, .2], [.009, .02, .26]]) s += `<path d="${band(g, down(g, c, sd), g.base)}" fill="#160f1e" opacity="${o}"/>`
  const P0 = down(g, .034, .07), P1 = down(g, .05, .1)
  s += `<path d="${band(g, P1, P0)}" fill="#9d9081"/>`
  let joints = ''
  for (let phi = g.lo; phi < g.hi; phi += (g.form === 'wide' ? 1.3 : 1.9) * DEG) { const [x1, y1] = at(g, phi, P0), [x2, y2] = at(g, phi, P1); joints += `M${f1(x1)} ${f1(y1)} L${f1(x2)} ${f1(y2)} ` }
  s += `<path d="${joints}" stroke="#5e5448" stroke-width="1.1" opacity=".6"/><path d="${pathOf(arc(g, P0))}" fill="none" stroke="#5e5448" stroke-width="1.4" opacity=".7"/>
    <path d="${pathOf(arc(g, P1))}" fill="none" stroke="#d6ad52" stroke-width="${g.form === 'wide' ? 2.2 : 2.6}" opacity=".85"/>`
  /* worn and damp patches on the sand */
  for (let i = 0; i < 9; i++) { const x = rnd() * g.W, y = g.H * (.52 + rnd() * .44), r = g.W * (.05 + rnd() * .08); s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r * .26)}" fill="url(#${rnd() > .5 ? 'pd' : 'pl'}-${g.form})"/>` }
  /* debris at the wall's foot: a dropped shield, broken spears, stones */
  for (let i = 0; i < 9; i++) {
    const phi = g.lo + (g.hi - g.lo) * (.06 + i * .11 + rnd() * .04)
    if (!onScreen(g, phi)) continue
    const [x, y0] = at(g, phi, down(g, .014, .03)), h = wallH(g, phi) * .7, k = rnd()
    if (k > .7) s += `<ellipse cx="${f1(x)}" cy="${f1(y0)}" rx="${f1(h * .2)}" ry="${f1(h * .07)}" fill="#5b4a36"/><ellipse cx="${f1(x)}" cy="${f1(y0 - h * .02)}" rx="${f1(h * .17)}" ry="${f1(h * .055)}" fill="#8a7046" stroke="#c9a24a" stroke-width="1"/>`
    else if (k > .35) s += `<path d="M${f1(x - h * .3)} ${f1(y0 + h * .02)} L${f1(x + h * .28)} ${f1(y0 - h * .06)}" stroke="#6a5038" stroke-width="${f1(Math.max(1.2, h * .03))}" stroke-linecap="round"/><path d="M${f1(x + h * .28)} ${f1(y0 - h * .06)} l${f1(h * .08)} ${f1(-h * .02)} l${f1(-h * .05)} ${f1(h * .05)}Z" fill="#a8a4a0"/>`
    else s += `<ellipse cx="${f1(x)}" cy="${f1(y0)}" rx="${f1(h * .09)}" ry="${f1(h * .05)}" fill="#7a6f66"/><ellipse cx="${f1(x - h * .02)}" cy="${f1(y0 - h * .015)}" rx="${f1(h * .04)}" ry="${f1(h * .02)}" fill="#bcb2a6"/>`
  }
  /* the great ring inlaid in the sand, round both formations: a paving band between two gold lines */
  const [rx0, ry0, rrx, rry] = a.ring, rcy = ry0 * g.H, rk = rry * g.H / rrx
  let rj = ''
  for (let i = 0; i < 120; i++) { const t = (i / 120) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t); rj += `M${f1(rx0 + c * rrx)} ${f1(rcy + sn * rrx * rk)} L${f1(rx0 + c * rrx * .955)} ${f1(rcy + sn * rrx * .955 * rk)} ` }
  s += `<ellipse cx="${rx0}" cy="${f1(rcy)}" rx="${rrx}" ry="${f1(rrx * rk)}" fill="none" stroke="#5a4020" stroke-width="${g.form === 'wide' ? 12 : 14}" opacity=".35"/>
    <path d="${rj}" stroke="#7a6a54" stroke-width="${g.form === 'wide' ? 1.4 : 1.8}" opacity=".5"/>
    <ellipse cx="${rx0}" cy="${f1(rcy)}" rx="${rrx}" ry="${f1(rrx * rk)}" fill="none" stroke="#d6ad52" stroke-width="${g.form === 'wide' ? 3.2 : 4}" opacity=".8"/>
    <ellipse cx="${rx0}" cy="${f1(rcy)}" rx="${f1(rrx * .955)}" ry="${f1(rrx * .955 * rk)}" fill="none" stroke="#b08a3a" stroke-width="${g.form === 'wide' ? 1.8 : 2.4}" opacity=".7"/>`
  const [sx, sy, sr, sq] = a.sigil
  s += `<g transform="translate(${sx} ${f1(sy * g.H)}) scale(${f1(sr / 100)} ${(sr / 100 * sq).toFixed(3)})" opacity=".9">${sigil()}</g>`
  return `<svg viewBox="0 0 ${g.W} ${g.H}" preserveAspectRatio="none"><defs>
    <radialGradient id="spill0-${g.form}"><stop offset="0" stop-color="#00baff" stop-opacity=".34"/><stop offset="1" stop-color="#00baff" stop-opacity="0"/></radialGradient>
    <radialGradient id="spill1-${g.form}"><stop offset="0" stop-color="#ff5a6a" stop-opacity=".32"/><stop offset="1" stop-color="#ff5a6a" stop-opacity="0"/></radialGradient>
    <radialGradient id="pd-${g.form}"><stop offset="0" stop-color="#6a4a2e" stop-opacity=".22"/><stop offset="1" stop-color="#6a4a2e" stop-opacity="0"/></radialGradient>
    <radialGradient id="pl-${g.form}"><stop offset="0" stop-color="#f6e2b8" stop-opacity=".28"/><stop offset="1" stop-color="#f6e2b8" stop-opacity="0"/></radialGradient></defs>${s}</svg>`
}

/* Flags round the rim, a team pennant over each gate, flames in the braziers: each on its own little layer. */
function flagsAndFires(g) {
  const pct = ([x, y]) => `left:${f1((x / g.W) * 100)}%;top:${f1((y / g.H) * 100)}%`
  let flags = ''
  g.d.flags.forEach((d, i) => { const phi = d * DEG; if (!onScreen(g, phi)) return; const h = wallH(g, phi) * .62; flags += `<i class="a-flag" style="${pct(at(g, phi, g.rim))};--fs:${f1((h / g.W) * 100)}cqw;--fd:-${f1(i * .37)}s">${FLAG}</i>` })
  g.d.gates.forEach((d, i) => { const phi = d * DEG, h = wallH(g, phi) * .5; flags += `<i class="a-flag a-flag--${i ? 'red' : 'cyan'}" style="${pct(at(g, phi, g.tiers[0]))};--fs:${f1((h / g.W) * 100)}cqw;--fd:-${f1(i * .9)}s">${FLAG}</i>` })
  let fires = ''
  g.d.braziers.forEach((d, i) => { const phi = d * DEG; if (!onScreen(g, phi)) return; const h = wallH(g, phi), [x, y] = at(g, phi, brazierLevel(g)); fires += `<i class="a-fire" style="${pct([x, y - h * .16])};--fz:${f1(((h * .3) / g.W) * 100)}cqw;--ff:-${f1(i * .23)}s"></i>` })
  return { flags, fires }
}
const FLAG = '<svg viewBox="0 0 40 60"><path d="M4 0 V60" stroke="#2a2230" stroke-width="2.6"/><circle cx="4" cy="1.5" r="2.4" fill="#ffd979"/><path class="cloth" d="M5.5 4 H36 L30 13 L36 22 H5.5Z"/></svg>'

/* ---------- the six skies ---------- */
/* What shows of each planet over the rim, drawn in its own strip: sea and islands, forest, mesas, peaks, crags, jungle. */
function farVeles(g) {
  const W = g.W, h = g.farH, sea = h * .6, rnd = seeded(5)
  let s = `<rect y="${f1(sea)}" width="${W}" height="${f1(h - sea)}" fill="url(#fv-${g.form})"/>`
  for (const [cx, w, hh, c] of [[W * .18, W * .3, h * .3, '#4f8c6f'], [W * .52, W * .1, h * .1, '#5f9a7d'], [W * .8, W * .26, h * .42, '#86b8b2']]) {
    s += `<ellipse cx="${f1(cx)}" cy="${f1(sea + 1)}" rx="${f1(w * .58)}" ry="2.6" fill="#8ee2cf"/><path d="M${f1(cx - w / 2)} ${f1(sea)} Q${f1(cx - w * .2)} ${f1(sea - hh)} ${f1(cx + w * .05)} ${f1(sea - hh * .94)} Q${f1(cx + w * .3)} ${f1(sea - hh * .7)} ${f1(cx + w / 2)} ${f1(sea)}Z" fill="${c}"/>`
    for (let i = 0; i < 9; i++) { const x = cx - w * .35 + rnd() * w * .7, y = sea - hh * (.3 + rnd() * .5); s += `<path d="M${f1(x)} ${f1(y - 7)} l3 7 h-6Z" fill="${c === '#86b8b2' ? '#6fa39d' : '#2f6a4c'}"/>` }
  }
  s += `<path d="M${f1(W * .79)} ${f1(sea - h * .41)} l-9 9 l4 -1 l3 3 l4 -4 l3 2Z" fill="#eef6f4"/>`
  for (let i = 0; i < 40; i++) s += `<rect x="${f1(rnd() * W)}" y="${f1(sea + 2 + rnd() * (h - sea - 4))}" width="${f1(4 + rnd() * 10)}" height="1" fill="#f4fffb" opacity=".6"/>`
  return s + `<defs><linearGradient id="fv-${g.form}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a8e2da"/><stop offset=".4" stop-color="#4fbac0"/><stop offset="1" stop-color="#2a98ac"/></linearGradient></defs>`
}
function pine(x, base, h, c) { let s = ''; for (let k = 0; k < 3; k++) { const t = k / 3, top = base - h + h * t * .7, half = h * (.14 + t * .12); s += `<path d="M${f1(x)} ${f1(top)} L${f1(x + half)} ${f1(top + h * .38)} L${f1(x - half)} ${f1(top + h * .38)}Z" fill="${c}"/>` } return s }
function farNeri(g) {
  const W = g.W, h = g.farH, rnd = seeded(8)
  let s = `<rect y="${f1(h * .55)}" width="${W}" height="${f1(h * .45)}" fill="url(#fn-${g.form})"/>`
  for (let x = -10; x < W + 10; x += 14) s += pine(x + rnd() * 6, h * .82, h * (.28 + rnd() * .14), '#5e6a4c')
  s += `<rect y="${f1(h * .62)}" width="${W}" height="${f1(h * .2)}" fill="#f2cf8e" opacity=".35"/>`
  for (let x = -10; x < W + 10; x += 20) s += pine(x + rnd() * 8, h * .98, h * (.4 + rnd() * .2), '#2f3d2a')
  for (let i = 0; i < 7; i++) { const x = W * (.3 + rnd() * .5), y = h * (.12 + rnd() * .25), w = 5 + rnd() * 5; s += `<path d="M${f1(x - w)} ${f1(y)} q${f1(w / 2)} ${f1(-w * .5)} ${f1(w)} 0 q${f1(w / 2)} ${f1(-w * .5)} ${f1(w)} 0" fill="none" stroke="#3a2a30" stroke-width="1.2"/>` }
  return s + `<defs><linearGradient id="fn-${g.form}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f6d79a" stop-opacity="0"/><stop offset="1" stop-color="#f6d79a" stop-opacity=".9"/></linearGradient></defs>`
}
function farMagor(g) {
  const W = g.W, h = g.farH, rnd = seeded(12)
  let s = `<ellipse cx="${f1(W * .14)}" cy="${f1(h * .6)}" rx="${f1(W * .2)}" ry="${f1(h * .55)}" fill="url(#fm-${g.form})"/><ellipse cx="${f1(W * .3)}" cy="${f1(h * .72)}" rx="${f1(W * .14)}" ry="${f1(h * .4)}" fill="url(#fm-${g.form})"/>`
  for (const [x, w, hh, c] of [[W * .52, W * .12, h * .34, '#8a4428'], [W * .66, W * .08, h * .5, '#7a3620'], [W * .78, W * .16, h * .28, '#8a4428'], [W * .92, W * .09, h * .42, '#6c2e1a'], [W * .4, W * .07, h * .22, '#9a5432']]) {
    const top = h * .9 - hh
    s += `<path d="M${f1(x - w / 2 - w * .2)} ${f1(h * .9)} L${f1(x - w / 2)} ${f1(top + hh * .15)} L${f1(x - w * .35)} ${f1(top)} H${f1(x + w * .38)} L${f1(x + w / 2)} ${f1(top + hh * .12)} L${f1(x + w / 2 + w * .25)} ${f1(h * .9)}Z" fill="${c}"/><path d="M${f1(x - w * .35)} ${f1(top)} H${f1(x + w * .38)}" stroke="#d98a52" stroke-width="1.4" opacity=".6"/>`
    for (let k = 0; k < 3; k++) { const y = top + hh * (.3 + k * .2); s += `<path d="M${f1(x - w * .45)} ${f1(y)} H${f1(x + w * .46)}" stroke="#4a1e10" stroke-width="1" opacity=".35"/>` }
  }
  s += `<rect y="${f1(h * .6)}" width="${W}" height="${f1(h * .4)}" fill="url(#fmh-${g.form})"/>`
  return s + `<defs><radialGradient id="fm-${g.form}"><stop offset="0" stop-color="#b8653a" stop-opacity=".85"/><stop offset=".6" stop-color="#a85a30" stop-opacity=".45"/><stop offset="1" stop-color="#a85a30" stop-opacity="0"/></radialGradient>
    <linearGradient id="fmh-${g.form}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e9a25a" stop-opacity="0"/><stop offset="1" stop-color="#e9a25a" stop-opacity=".75"/></linearGradient></defs>`
}
function range(W, h, base, amp, n, rnd, c, snow) {
  let d = `M-10 ${f1(base)}`, peaks = ''
  const step = (W + 20) / n
  for (let i = 0; i <= n; i++) {
    const x = -10 + i * step, y = base - amp * (.4 + rnd() * .6)
    d += ` L${f1(x - step * .5)} ${f1(base - amp * (.1 + rnd() * .3))} L${f1(x)} ${f1(y)}`
    if (snow) peaks += `<path d="M${f1(x)} ${f1(y)} L${f1(x + step * .16)} ${f1(y + amp * .22)} L${f1(x + step * .05)} ${f1(y + amp * .17)} L${f1(x - step * .03)} ${f1(y + amp * .25)} L${f1(x - step * .16)} ${f1(y + amp * .2)}Z" fill="#f4f8fa"/>`
  }
  return `<path d="${d} L${W + 10} ${f1(h)} L-10 ${f1(h)}Z" fill="${c}"/>${peaks}`
}
function farNaron(g) {
  const W = g.W, h = g.farH, rnd = seeded(21)
  return range(W, h, h * .8, h * .62, g.form === 'wide' ? 9 : 6, rnd, '#9fb3c8', true) + range(W, h, h * .92, h * .44, g.form === 'wide' ? 13 : 8, rnd, '#6f87a1', true)
    + `<rect y="${f1(h * .62)}" width="${W}" height="${f1(h * .38)}" fill="url(#fna-${g.form})"/><defs><linearGradient id="fna-${g.form}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f4f8fa" stop-opacity="0"/><stop offset="1" stop-color="#f4f8fa" stop-opacity=".85"/></linearGradient></defs>`
}
function farKavian(g) {
  const W = g.W, h = g.farH, rnd = seeded(31)
  let s = range(W, h, h * .86, h * .3, g.form === 'wide' ? 18 : 11, rnd, '#5c6352', false)
  for (let i = 0; i < (g.form === 'wide' ? 12 : 8); i++) { const x = rnd() * W, hh = h * (.35 + rnd() * .5), w = 6 + rnd() * 12; s += `<path d="M${f1(x - w)} ${f1(h * .9)} L${f1(x - w * .3)} ${f1(h * .9 - hh * .7)} L${f1(x)} ${f1(h * .9 - hh)} L${f1(x + w * .35)} ${f1(h * .9 - hh * .6)} L${f1(x + w)} ${f1(h * .9)}Z" fill="${rnd() > .5 ? '#474d40' : '#3c4236'}"/>` }
  return s + `<rect y="${f1(h * .6)}" width="${W}" height="${f1(h * .4)}" fill="url(#fk-${g.form})"/><defs><linearGradient id="fk-${g.form}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9a9a7c" stop-opacity="0"/><stop offset="1" stop-color="#9a9a7c" stop-opacity=".7"/></linearGradient></defs>`
}
function farEyeke(g) {
  const W = g.W, h = g.farH, rnd = seeded(41)
  let s = `<rect x="0" y="${f1(h * .62)}" width="${f1(W * .34)}" height="${f1(h * .38)}" fill="#2f8a86"/>`
  for (let i = 0; i < 26; i++) s += `<rect x="${f1(rnd() * W * .32)}" y="${f1(h * .65 + rnd() * h * .3)}" width="${f1(4 + rnd() * 8)}" height="1" fill="#e8fff4" opacity=".55"/>`
  for (let row = 0; row < 2; row++) for (let x = (row ? W * .26 : W * .3); x < W + 20; x += row ? 16 : 22) {
    const r = (row ? 12 : 9) + rnd() * 8, y = h * (row ? .86 : .72)
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${row ? pick(rnd, ['#1d5236', '#245c3c', '#2a6a44']) : pick(rnd, ['#3d7a5a', '#468462'])}"/>`
  }
  for (let i = 0; i < 5; i++) { const x = W * (.4 + rnd() * .55), b = h * .8, hh = h * (.45 + rnd() * .2); s += `<path d="M${f1(x)} ${f1(b)} q2 ${f1(-hh * .5)} 5 ${f1(-hh)}" stroke="#1d4a30" stroke-width="2" fill="none"/>`; for (const a of [-2.5, -1.8, -1, -.3, .4]) s += `<path d="M${f1(x + 5)} ${f1(b - hh)} q${f1(Math.cos(a) * 10)} ${f1(Math.sin(a) * 6 - 2)} ${f1(Math.cos(a) * 16)} ${f1(Math.sin(a) * 4 + 4)}" stroke="#1d4a30" stroke-width="2" fill="none"/>` }
  return s + `<rect y="${f1(h * .55)}" width="${W}" height="${f1(h * .45)}" fill="url(#fe-${g.form})"/><defs><linearGradient id="fe-${g.form}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#dceec0" stop-opacity="0"/><stop offset="1" stop-color="#dceec0" stop-opacity=".55"/></linearGradient></defs>`
}

/* ---- the sand: a seamless tile, raked by a thousand fights, grained, scuffed, a few pebbles ---- */
function sandTile() {
  const S = 512
  let seed = 17
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  const f = (n) => n.toFixed(1)

  /* Draw something at (x, y) and again across every edge it touches, so the tile repeats without a seam. */
  function wrap(x, y, r, draw) {
    let s = ''
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      const X = x + dx, Y = y + dy
      if (X < -r || X > S + r || Y < -r || Y > S + r) continue
      s += draw(X, Y)
    }
    return s
  }

  /* Scuffs: short curved drags, a darker groove with a lit lip, where feet and blades have turned the sand. */
  let scuffs = ''
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, y = rnd() * S, len = 14 + rnd() * 40, a = rnd() * Math.PI, bend = (rnd() - .5) * 18
    scuffs += wrap(x, y, 60, (X, Y) => {
      const ex = X + Math.cos(a) * len, ey = Y + Math.sin(a) * len * .5, mx = (X + ex) / 2 + bend, my = (Y + ey) / 2 - bend * .4
      return `<path d="M${f(X)} ${f(Y)} Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}" stroke="#8a6a44" stroke-width="${f(1.4 + rnd() * 1.6)}" opacity=".45"/>`
        + `<path d="M${f(X)} ${f(Y - 1.6)} Q${f(mx)} ${f(my - 1.6)} ${f(ex)} ${f(ey - 1.6)}" stroke="#f3dfb4" stroke-width="1" opacity=".45"/>`
    })
  }
  /* Pebbles: small grey-brown stones with a lit top. */
  let pebbles = ''
  for (let i = 0; i < 90; i++) {
    const x = rnd() * S, y = rnd() * S, r = 1.2 + rnd() * 2.8, c = pick(['#8d7d6a', '#7a6c5e', '#9c8a72', '#6e6258', '#a89880'])
    pebbles += wrap(x, y, 8, (X, Y) => `<ellipse cx="${f(X + .6)}" cy="${f(Y + .8)}" rx="${f(r * 1.2)}" ry="${f(r * .8)}" fill="#5a4630" opacity=".35"/><ellipse cx="${f(X)}" cy="${f(Y)}" rx="${f(r * 1.15)}" ry="${f(r * .8)}" fill="${c}"/><ellipse cx="${f(X - r * .3)}" cy="${f(Y - r * .3)}" rx="${f(r * .45)}" ry="${f(r * .28)}" fill="#e8dcc4" opacity=".7"/>`)
  }
  /* A few old stains, damp and dark, soaked into the sand. */
  let stains = ''
  for (let i = 0; i < 5; i++) {
    const x = rnd() * S, y = rnd() * S, r = 18 + rnd() * 30
    stains += wrap(x, y, r * 1.6, (X, Y) => `<ellipse cx="${f(X)}" cy="${f(Y)}" rx="${f(r)}" ry="${f(r * .62)}" fill="url(#stain)"/>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <filter id="mottle" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="5" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.52  0 0 0 0 0.38  0 0 0 0 0.22  1.4 0 0 0 -0.5"/>
      </filter>
      <filter id="light" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed="23" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.96  0 0 0 0 0.88  0 0 0 0 0.70  0 0 1.4 0 -0.7"/>
      </filter>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="9" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 1.1 -0.3"/>
      </filter>
      <filter id="sparkle" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="31" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.86  0 0 0 3 -2.2"/>
      </filter>
      <radialGradient id="stain"><stop offset="0" stop-color="#5a3a24" stop-opacity=".28"/><stop offset=".7" stop-color="#6a4a2e" stop-opacity=".12"/><stop offset="1" stop-color="#6a4a2e" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${S}" height="${S}" fill="#c6a576"/>
    <rect width="${S}" height="${S}" filter="url(#mottle)"/>
    <rect width="${S}" height="${S}" filter="url(#light)"/>
    <g>${stains}</g>
    <rect width="${S}" height="${S}" filter="url(#grain)" opacity=".7"/>
    <rect width="${S}" height="${S}" filter="url(#sparkle)" opacity=".5"/>
    <g fill="none" stroke-linecap="round">${scuffs}</g>
    <g>${pebbles}</g>
  </svg>`
}

const FAR = { veles: farVeles, neri: farNeri, magor: farMagor, naron: farNaron, kavian: farKavian, eyeke: farEyeke }

module.exports = { AG, geo, at, mix, onScreen, wallH, brazierLevel, arenaLayer, floorLayer, sandTile, FAR, DEG, f1 }
