/*
  The map's buildings: the arena, dungeon and tavern as little painted
  buildings standing on their tile, drawn as plain SVG.

  Writes public/assets/markers/buildings/<kind>.svg and <kind>-muted.svg (the
  greyed copy for a spent dungeon or an arena you are defending). Run with
  `node scripts/buildings.mjs` after changing a drawing.

  Units: 100 across a building, the ground under its middle at 0,0. The
  viewBox is 116 square, 58 either side and from 96 above the ground to 20
  below; MapCanvas places it by the same numbers (`BUILDING_VIEW` in
  src/map/terrain.ts).
*/
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const f = (n) => Number(n.toFixed(2))
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')
const BASE = {
  arena:{ lit:'#ffd04a', mid:'#f6a800', dark:'#b57200', top:'#ffdc80', inner:'#6e4300', tierA:'#c98a12', tierB:'#9f6a08', sand:'#ead08c', win:'#4e2f00', gate:'#2e1b00', ink:'#362700', flag:'#f6a800', flagLit:'#ffd36a', pole:'#4a3000', bright:'#fff0a8' },
  dungeon:{ crown:'#ffcf3a', stoneLit:'#8d96a6', stone:'#626b7b', stoneDark:'#3b4250', cave:'#070d18', glow:'#00baff', lit:'#45b8ee', mid:'#0087c0', dark:'#005a84', ink:'#002738', eye:'#ffd36a' },
  tavern:{ wall:'#f2e0b4', wallMid:'#dcc28c', wallDark:'#a7884e', woodLit:'#b07a40', wood:'#8b5a2b', woodDark:'#5c3b1c', roofLit:'#2bd86b', roof:'#00b347', roofDark:'#007f31', roofEdge:'#005a23', win:'#ffd36a', door:'#4a2a10', ink:'#2b1a08', sign:'#00c04a', signInk:'#002b10', mug:'#f4f0de', foam:'#ffffff' },
}
/* ---------- geometry helpers, in building units: 100 across, ground at y=0 ---------- */
const P = (pts) => pts.map((p) => p.map(f).join(',')).join(' ')
const archPath = (x, yb, yt, w) => { const r = w / 2; return `M${f(x - r)},${f(yb)} L${f(x - r)},${f(yt + r)} A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(yt + r)} L${f(x + r)},${f(yb)} Z` }
const cubic = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]] }

/*
  A style: how faces are filled and edged.
  O.outline  dark edge around shapes, like today's icons
  O.soft     soft gradients instead of hard three-tone faces
  O.hatch    ink hatching on the shaded faces (the map's own drawing)
*/
function shade(id, x0, x1, c, O) {
  const stops = O.soft
    ? `<stop offset="0" stop-color="${c[0]}"/><stop offset=".5" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/>`
    : `<stop offset="0" stop-color="${c[0]}"/><stop offset=".34" stop-color="${c[0]}"/><stop offset=".34" stop-color="${c[1]}"/><stop offset=".68" stop-color="${c[1]}"/><stop offset=".68" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[2]}"/>`
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${x1}" y2="0">${stops}</linearGradient>`
}
const edge = (O, ink, w = 2.2) => O.outline ? ` stroke="${ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"` : ''
const hatchOver = (O, sid, clipId, x0, x1, y0, y1) => O.hatch ? `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="url(#${sid}-hatch)" clip-path="url(#${clipId})"/>` : ''

/*
  The arena by boost rank, the same bands as the rings: from a ruin to a
  castle, every rank adding something you can see from across the map.
    1  a ruin: a low ring with a fallen stretch of wall, rubble, no flags
    2  rebuilt, whole, flying its three pennants
    3  a storey taller, battlements, a gatehouse over the gate
    4  four towers round it
    5  the keep with its gold spire, a pennant on every tower

  What a rank can add:
    storeys    1 or 2 rows of arches (the wall stands taller)
    flags      pennants on the rim, by angle round it (180 at the back)
    ruin       a fallen stretch of wall and rubble at its foot
    rim        2: battlements along the top of the wall
    towers     by angle, or [angle, height, roof] where roof is 'flag'
    gatehouse  a square gatehouse with its portcullis over the gate
    keep       'spire': a tall tower at the back with a gold spire
*/
const T4 = [-60, 60, [-150, 26], [150, 26]]
const T4F = [[-60, 18, 'flag'], [60, 18, 'flag'], [-150, 28, 'flag'], [150, 28, 'flag']]
const F3 = [180, -110, 110]
const ARENA_RANKS = {
  1: { storeys: 1, flags: [], ruin: true },
  2: { storeys: 1, flags: F3 },
  3: { storeys: 2, flags: F3, rim: 2, gatehouse: true },
  4: { storeys: 2, flags: [180], rim: 2, towers: T4, gatehouse: true },
  5: { storeys: 2, flags: [], rim: 2, towers: T4F, gatehouse: true, keep: 'spire', keepTall: 20 },
}

/* ---------- the arena: a colosseum that grows into a castle ---------- */
function arena(sid, pal, O, uid, o = ARENA_RANKS[2]) {
  const R = 40, r = 14, H = { 0:12, 1:24, 2:34, 3:44 }[o.storeys ?? 2]
  const rimAt = (deg, lift = 0) => { const t = deg * Math.PI / 180; return [R * Math.sin(t), -H - lift + r * Math.cos(t), Math.cos(t)] }
  const onWall = (deg, h) => { const t = deg * Math.PI / 180; return [R * Math.sin(t), h + r * Math.cos(t), Math.cos(t)] }
  const wall = `M${-R},${-H} L${-R},0 A${R},${r} 0 0 0 ${R},0 L${R},${-H} A${R},${r} 0 0 1 ${-R},${-H} Z`
  const ink = (w = 2.2) => ` stroke="${pal.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`
  const behind = (d) => Math.cos(d * Math.PI / 180) <= 0
  let s = `<defs><linearGradient id="${uid}-w" gradientUnits="userSpaceOnUse" x1="${-R}" y1="0" x2="${R}" y2="0"><stop offset="0" stop-color="${pal.lit}"/><stop offset=".5" stop-color="${pal.mid}"/><stop offset="1" stop-color="${pal.dark}"/></linearGradient><linearGradient id="${uid}-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${pal.bright}"/><stop offset=".5" stop-color="${pal.lit}"/><stop offset="1" stop-color="${pal.dark}"/></linearGradient><clipPath id="${uid}-ic"><ellipse cx="0" cy="${-H + .6}" rx="${R - 6}" ry="${r - 2.2}"/></clipPath></defs>`

  const flag = (deg) => {
    const [x, y] = rimAt(deg)
    const lit = Math.sin(deg * Math.PI / 180) < 0
    return `<line x1="${f(x)}" y1="${f(y + 1)}" x2="${f(x)}" y2="${f(y - 25)}" stroke="${pal.pole}" stroke-width="2.2" stroke-linecap="round"/><polygon points="${P([[x, y - 25], [x + 16, y - 23], [x + 10.5, y - 19.5], [x + 16, y - 15], [x, y - 14]])}" fill="${lit ? pal.flagLit : pal.flag}"${ink(1.6)}/>`
  }
  /* a round tower on the wall, its foot on the ground; roof: 'cone' (a gold spire), 'flag' (a pennant on its battlements) */
  const tower = (deg, tall, roof, wide = 7.5) => {
    const t = deg * Math.PI / 180, x = R * Math.sin(t) * 1.02, base = r * Math.cos(t), top = -H - tall + r * Math.cos(t)
    const w = wide
    let g = `<path d="M${f(x - w)},${f(top)} V${f(base)} A${w},2.8 0 0 0 ${f(x + w)},${f(base)} V${f(top)} Z" fill="url(#${uid}-v)"${ink(1.8)}/>`
    g += `<ellipse cx="${f(x)}" cy="${f(top)}" rx="${w}" ry="2.8" fill="${pal.top}"${ink(1.4)}/>`
    if (roof === 'cone') {
      g += `<path d="M${f(x - w - 1.4)},${f(top)} A${w + 1.4},3.2 0 0 0 ${f(x + w + 1.4)},${f(top)} L${f(x)},${f(top - w * 2.6)} Z" fill="url(#${uid}-v)"${ink(1.5)}/><circle cx="${f(x)}" cy="${f(top - w * 2.6 - 1.6)}" r="1.8" fill="${pal.bright}"${ink(.8)}/>`
    } else {
      for (let i = -1; i <= 1; i++) g += `<rect x="${f(x + i * (w * .58) - 1.6)}" y="${f(top - 3.6)}" width="3.2" height="3.6" fill="${pal.lit}"${ink(1)}/>`
      if (roof === 'flag') g += `<line x1="${f(x)}" y1="${f(top - 2)}" x2="${f(x)}" y2="${f(top - 17)}" stroke="${pal.pole}" stroke-width="1.8" stroke-linecap="round"/><polygon points="${P([[x, top - 17], [x + 12, top - 15.5], [x + 8, top - 13], [x + 12, top - 10.4], [x, top - 9.6]])}" fill="${pal.flagLit}"${ink(1.3)}/>`
    }
    if (tall > 10) g += `<path d="${archPath(x, top + 9, top + 3, Math.min(3.6, w * .45))}" fill="${pal.win}"/>`
    if (tall > 24) g += `<path d="${archPath(x, top + 19, top + 13, Math.min(3.6, w * .45))}" fill="${pal.win}"/>`
    return g
  }
  const towerOf = (spec) => (Array.isArray(spec) ? spec : [spec, o.towerTall || 16, o.towerRoof])
  /* a square gatehouse over the gate, with its portcullis */
  const gatehouse = () => {
    const top = -H - 10 + r
    let g = `<path d="M-12,${r + 1} V${top} H12 V${r + 1} Z" fill="url(#${uid}-v)"${ink(1.8)}/>`
    for (let i = -2; i <= 2; i++) g += `<rect x="${f(i * 5 - 1.7)}" y="${f(top - 3.8)}" width="3.4" height="3.8" fill="${pal.lit}"${ink(1)}/>`
    g += `<path d="${archPath(0, r + 1, top + 12, 13)}" fill="${pal.gate}"/>`
    g += `<path d="M-4,${f(top + 16)} V${r + 1} M0,${f(top + 13)} V${r + 1} M4,${f(top + 16)} V${r + 1} M-6.5,${f(top + 19)} H6.5 M-6.5,${f(top + 24)} H6.5" stroke="${pal.dark}" stroke-width="1"/>`
    g += `<path d="${archPath(0, top + 8, top + 3, 3.4)}" fill="${pal.win}"/>`
    return g
  }
  /* the rim's shape, back half or front half */
  const rimShape = (front) => {
    if (!o.rim) return ''
    let g = ''
    const step = o.rim >= 3 ? 20 : 15
    for (let d = -180 + step / 2; d < 180; d += step) {
      const [x, y, c] = rimAt(d)
      if ((c > 0) !== front) continue
      const w = 2.6 + 1.4 * Math.abs(c)
      if (o.rim <= 2) { const h = o.rim === 1 ? 3.4 : 5.4; g += `<rect x="${f(x - w / 2)}" y="${f(y - h)}" width="${f(w)}" height="${h}" fill="${pal.top}"${ink(1)}/>` }
      else {
        const h = o.rim === 3 ? 7 : 11
        g += `<path d="M${f(x - w * .7)},${f(y + .5)} L${f(x)},${f(y - h)} L${f(x + w * .7)},${f(y + .5)} Z" fill="${pal.lit}"${ink(1)}/>`
        if (o.rim === 4) g += `<circle cx="${f(x)}" cy="${f(y - h - 1.4)}" r="1.6" fill="${pal.bright}"${ink(.8)}/>`
      }
    }
    return g
  }

  ;(o.towers || []).map(towerOf).filter(([d]) => behind(d)).forEach(([d, tall, roof]) => { s += tower(d, tall, roof) })
  if (o.keep) {
    s += tower(180, o.keepTall || 30, o.keep === 'spire' ? 'cone' : o.keep === 'banner' ? 'flag' : undefined, 9)
  }
  ;(o.flags || []).filter(behind).forEach((d) => { s += flag(d) })
  s += rimShape(false)

  /* the wall, with its rows of arches */
  s += `<path d="${wall}" fill="url(#${uid}-w)"${ink()}/>`
  if (o.ruin) {
    /* a fallen stretch of wall: you see into the bowl through it */
    const pt = (d, h) => onWall(d, h).slice(0, 2)
    s += `<polygon points="${P([pt(-62, -H), pt(-58, -H + 8), pt(-48, -H + 12), pt(-40, -H + 7), pt(-34, -H + 10), pt(-26, -H)])}" fill="${pal.inner}"${ink(1.4)}/>`
    s += `<path d="M14,${f(-H + 16)} l4,6 l-2,5 l4,6 M28,${f(-H + 13)} l-3,7 l3,4" fill="none" stroke="${pal.dark}" stroke-width="1.2"/>`
    ;[[-36, 12, 4], [-28, 14, 3], [-20, 15, 2.6], [-42, 9, 2.4]].forEach(([x, y, k]) => { s += `<polygon points="${P([[x - k, y], [x - k * .4, y - k], [x + k, y - k * .5], [x + k * .8, y + k * .3]])}" fill="${pal.tierA}"${ink(1)}/>` })
  }
  const rows = { 0:[], 1:[[-14, 11]], 2:[[-27, 8], [-14, 11]], 3:[[-37, 7], [-26, 8], [-14, 11]] }[o.storeys ?? 2]
  rows.forEach(([h, tall], i) => {
    if (i < rows.length - 1) s += `<path d="M${-R},${h + tall + 2} A${R},${r} 0 0 0 ${R},${h + tall + 2}" fill="none" stroke="${pal.dark}" stroke-width="1.6" opacity=".8"/>`
    const step = i === rows.length - 1 ? 24 : 22
    for (let d = -72; d <= 72; d += step) { if (i === rows.length - 1 && d === 0) continue; const [x, y, c] = onWall(d, h); if (c > .3) s += `<path d="${archPath(x, y + tall, y, (tall > 9 ? 7.4 : 6.4) * c)}" fill="${pal.win}" opacity=".85"/>` }
  })
  s += `<path d="${archPath(0, r, Math.max(-4, -H + r + 3), (o.storeys ?? 2) === 0 ? 9 : 13)}" fill="${pal.gate}"/>`

  /* the bowl */
  s += `<ellipse cx="0" cy="${-H}" rx="${R}" ry="${r}" fill="${pal.top}"${ink()}/>`
  s += `<g clip-path="url(#${uid}-ic)"><ellipse cx="0" cy="${-H + .6}" rx="${R - 6}" ry="${r - 2.2}" fill="${pal.inner}"/>`
  ;[[pal.tierA, 2.2, 4.4, 1.5], [pal.tierB, 4.6, 8.8, 3], [pal.tierA, 7, 13, 4.4], [pal.sand, 9.6, 17, 5.8]].forEach(([c, dy, dr, dry]) => { s += `<ellipse cx="0" cy="${f(-H + .6 + dy)}" rx="${f(R - 6 - dr)}" ry="${f(r - 2.2 - dry)}" fill="${c}"/>` })
  s += `</g>`
  s += rimShape(true)
  ;(o.towers || []).map(towerOf).filter(([d]) => !behind(d)).forEach(([d, tall, roof]) => { s += tower(d, tall, roof) })
  if (o.gatehouse) s += gatehouse()
  ;(o.flags || []).filter((d) => !behind(d)).forEach((d) => { s += flag(d) })
  s += `<path d="M${-R + 4},${-H + 4} L${-R + 4},-6" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>`
  return s
}

/*
  The dungeon's heads by boost rank, the same bands as the rings: the
  stronger the hydra, the more heads it has. One, on a shorter neck, at
  rank 1; two; three; four; five with a gold crown on the middle one.
*/
const NECKS = {
  short: { p: [[1, 2], [3, -16], [-4, -30], [1, -44]], dir: 1, rot: -26 },
  farL: { p: [[-8, 4], [-18, -10], [-40, -8], [-36, -30]], dir: -1, rot: -6 },
  L: { p: [[-6, 2], [-12, -20], [-32, -28], [-28, -52]], dir: -1, rot: -22 },
  C: { p: [[1, 2], [4, -28], [-6, -48], [2, -70]], dir: 1, rot: -30 },
  R: { p: [[7, 2], [16, -20], [32, -26], [28, -46]], dir: 1, rot: -12 },
  farR: { p: [[9, 4], [20, -8], [40, -6], [35, -27]], dir: 1, rot: -2 },
}
const DUNGEON_HEADS = {
  1: { necks: ['short'] },
  2: { necks: ['L', 'R'] },
  3: { necks: ['L', 'C', 'R'] },
  4: { necks: ['farL', 'L', 'R', 'farR'] },
  5: { necks: ['farL', 'L', 'C', 'R', 'farR'], crown: 'C' },
}

/* ---------- the dungeon: the hydra rising out of its lair ---------- */
function dungeon(sid, pal, O, uid, heads = DUNGEON_HEADS[3]) {
  const mound = `M-46,6 C-45,-6 -38,-16 -27,-20 C-21,-31 -8,-36 3,-32 C13,-38 27,-31 31,-21 C41,-16 46,-5 46,6 A46,10 0 0 1 -46,6 Z`
  let s = `<defs>${shade(`${uid}-dm`, -46, 46, [pal.stoneLit, pal.stone, pal.stoneDark], O)}<clipPath id="${uid}-dmc"><path d="${mound}"/></clipPath><radialGradient id="${uid}-dg"><stop offset="0" stop-color="${pal.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${pal.glow}" stop-opacity="0"/></radialGradient></defs>`
  s += `<path d="${mound}" fill="url(#${uid}-dm)"${edge(O, pal.ink)}/>`
  s += hatchOver(O, sid, `${uid}-dmc`, 14, 48, -40, 18)
  /* cracks and ledges in the rock */
  s += `<path d="M-34,-6 L-26,-10 L-20,-6 M22,-12 L30,-8 L36,-11 M-12,-26 L-6,-22" fill="none" stroke="${pal.stoneDark}" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>`
  /* the cave mouth, with the hydra's blue glow inside */
  const mouth = `M-17,13 C-18,-2 -10,-14 0,-16 C10,-14 18,-2 17,13 A17,4 0 0 1 -17,13 Z`
  s += `<path d="${mouth}" fill="${pal.cave}"${edge(O, pal.ink, 1.6)}/><ellipse cx="0" cy="4" rx="13" ry="9" fill="url(#${uid}-dg)"/>`
  /* three necks: thick tubes, a shadow side and a lit side */
  const necks = heads.necks.map((key) => ({ ...NECKS[key], key }))
  s += `<ellipse cx="0" cy="0" rx="13" ry="8" fill="${pal.dark}"${edge(O, pal.ink, 1.6)}/><ellipse cx="-2" cy="-1.5" rx="9" ry="5" fill="${pal.mid}"/>`
  necks.forEach((n) => {
    const d = `M${n.p[0]} C${n.p[1]} ${n.p[2]} ${n.p[3]}`
    if (O.outline) s += `<path d="${d}" fill="none" stroke="${pal.ink}" stroke-width="15.5" stroke-linecap="round"/>`
    s += `<path d="${d}" fill="none" stroke="${pal.dark}" stroke-width="12" stroke-linecap="round"/>`
    s += `<path d="${d}" fill="none" stroke="${pal.mid}" stroke-width="8.8" stroke-linecap="round" transform="translate(-1.4 0)"/>`
    s += `<path d="${d}" fill="none" stroke="${pal.lit}" stroke-width="3" stroke-linecap="round" transform="translate(-3.6 0)" opacity="${O.hatch ? .7 : 1}"/>`
    /* spines down the back of the neck */
    ;[.3, .5, .7].forEach((t) => {
      const a = cubic(...n.p, t), b = cubic(...n.p, t + .02)
      const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty), nx = (ty / l) * n.dir, ny = (-tx / l) * n.dir
      const bx = a[0] + nx * 5.6, by = a[1] + ny * 5.6
      s += `<polygon points="${P([[bx - tx / l * 2.6, by - ty / l * 2.6], [bx + nx * 5, by + ny * 5], [bx + tx / l * 2.6, by + ty / l * 2.6]])}" fill="${pal.dark}"${edge(O, pal.ink, 1)}/>`
    })
    /* the head, turned along the neck's last stretch */
    const e = n.p[3]
    const head = `M-6,-5 L-12,-12 L-2,-7.5 L5,-8.5 L13,-5 L17,-1 L11,0 L17,2.5 L9,5.5 L-4,6 L-7,1 Z`
    s += `<g transform="translate(${e[0]} ${e[1] - 3})${n.dir < 0 ? ' scale(-1 1)' : ''} rotate(${n.rot}) scale(1.5)"><path d="${head}" fill="${pal.mid}"${edge(O, pal.ink, 1.6)}/><path d="M-4,-4.5 L5,-7 L12,-4.2" fill="none" stroke="${pal.lit}" stroke-width="1.8" stroke-linecap="round"/><circle cx="5.5" cy="-3" r="1.7" fill="${pal.eye}"/>${heads.crown === n.key ? `<path d="M-7,-8 L-8,-14 L-4.5,-11 L-2,-16 L1,-11 L4.5,-14.5 L4,-8.5 Z" fill="${pal.crown}"${edge(O, pal.ink, 1)}/>` : ''}</g>`
  })
  /* the rock lip in front of the mouth, over the necks' roots */
  s += `<path d="M-19,12 C-12,8 -4,10 0,9 C6,8 13,9 19,12 A19,4 0 0 1 -19,12 Z" fill="${pal.stone}"${edge(O, pal.ink, 1.4)}/>`
  return s
}

/* ---------- the tavern: a two-tier rotunda with a gallery ---------- */
/*
  Built the way the arena is: a round hall with a row of lit arches under a
  green skirt roof, and a smaller round storey rising out of it under its
  own green cone, a pennant on top. A wooden gallery runs round the foot of
  the upper storey and two lanterns hang from the eaves; the sign with the
  mug hangs from a bracket on the left.
*/
function tavern(sid, pal, O, uid) {
  const ink = (w = 2.2, c = pal.ink) => edge(O, c, w)
  const wallPath = (R, r, H) => `M${-R},${-H} L${-R},0 A${R},${r} 0 0 0 ${R},0 L${R},${-H} A${R},${r} 0 0 1 ${-R},${-H} Z`
  const onWall = (R, r, deg, h) => { const t = deg * Math.PI / 180; return [R * Math.sin(t), h + r * Math.cos(t), Math.cos(t)] }
  const wall = (id, R, r, H) => `<defs>${shade(id, -R, R, [pal.wall, pal.wallMid, pal.wallDark], O)}</defs><path d="${wallPath(R, r, H)}" fill="url(#${id})"${ink()}/>`
  const arches = (R, r, h, tall, step, w, skipGate) => {
    let g = ''
    for (let d = -72; d <= 72; d += step) { if (skipGate && d === 0) continue; const [x, y, c] = onWall(R, r, d, h); if (c > .3) g += `<path d="${archPath(x, y + tall, y, w * c)}" fill="${pal.win}"${ink(1.1, pal.woodDark)}/>` }
    return g
  }
  const lantern = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="${pal.win}" opacity=".35"/><rect x="${x - 2}" y="${y - 2.6}" width="4" height="5.2" rx="1" fill="${pal.win}"${ink(.9)}/><path d="M${x - 2.4},${y - 2.6} H${x + 2.4} M${x},${y - 2.6} V${y - 4.4}" stroke="${pal.ink}" stroke-width="1"/>`
  const LR = 36, Lr = 12.5, LH = 18, UR = 22, Ur = 7.8, UH = 18, LIFT = 34

  /* the lower storey */
  let s = wall(`${uid}-lw`, LR, Lr, LH)
  s += arches(LR, Lr, -16, 10, 24, 7, true)
  s += `<path d="${archPath(0, Lr, -6, 11)}" fill="${pal.door}"${ink(1.3)}/><path d="M0,-2 V${Lr}" stroke="${pal.woodDark}" stroke-width="1"/>`
  /* the skirt roof, cut off where the upper storey rises */
  s += `<defs>${shade(`${uid}-sk`, -39, 39, [pal.roofLit, pal.roof, pal.roofDark], O)}</defs><path d="M-39,-18 A39,13.6 0 0 0 39,-18 L24,-36 A24,8.4 0 0 1 -24,-36 Z" fill="url(#${uid}-sk)"${ink(2.2, pal.roofEdge)}/>`

  /* the upper storey, its gallery and its cone */
  let u = wall(`${uid}-uw`, UR, Ur, UH)
  u += arches(UR, Ur, -15, 7, 30, 5.6, false)
  u += `<path d="M-28,-1 A28,10 0 0 0 28,-1" fill="none" stroke="${pal.woodDark}" stroke-width="2.4"/><path d="M-28,-6 A28,10 0 0 0 28,-6" fill="none" stroke="${pal.woodLit}" stroke-width="1.6"/>`
  for (let d = -80; d <= 80; d += 16) { const t = d * Math.PI / 180; u += `<line x1="${f(28 * Math.sin(t))}" y1="${f(-6 + 10 * Math.cos(t))}" x2="${f(28 * Math.sin(t))}" y2="${f(-1 + 10 * Math.cos(t))}" stroke="${pal.woodDark}" stroke-width="1.2"/>` }
  const CR = UR + 3, Cr = Ur + 1, CH = 24
  u += `<defs>${shade(`${uid}-co`, -CR, CR, [pal.roofLit, pal.roof, pal.roofDark], O)}</defs><path d="M${-CR},${-UH} A${CR},${Cr} 0 0 0 ${CR},${-UH} L0,${-UH - CH} Z" fill="url(#${uid}-co)"${ink(2.2, pal.roofEdge)}/>`
  for (const k of [.35, .65]) u += `<path d="M${f(-CR * (1 - k))},${f(-UH - CH * k)} A${f(CR * (1 - k))},${f(Cr * (1 - k))} 0 0 0 ${f(CR * (1 - k))},${f(-UH - CH * k)}" fill="none" stroke="${pal.roofEdge}" stroke-width="1" opacity=".6"/>`
  const py = -UH - CH
  u += `<line x1="0" y1="${py}" x2="0" y2="${py - 12}" stroke="${pal.woodDark}" stroke-width="2" stroke-linecap="round"/><polygon points="${P([[0, py - 12], [13, py - 10.4], [8.6, py - 7.4], [13, py - 3.6], [0, py - 2.6]])}" fill="${pal.sign}"${ink(1.4, pal.signInk)}/>`
  s += `<g transform="translate(0 ${-LIFT})">${u}</g>`

  /* lanterns from the eaves of the skirt roof */
  for (const x of [-30, 30]) s += `<path d="M${x},-20 v4" stroke="${pal.ink}" stroke-width="1"/>` + lantern(x, -13)
  /* the sign with the mug, on its bracket */
  s += `<path d="M-35,-14 L-49,-14" stroke="${pal.woodDark}" stroke-width="2.4" stroke-linecap="round"/><path d="M-46.5,-14 V-11 M-37.5,-14 V-11" stroke="${pal.woodDark}" stroke-width="1.2"/>`
  s += `<g transform="translate(-42 -11)"><path d="M-7.3,0 H7.3 V14 C4.3,12 2.3,16 .1,15 C-2.2,14 -4.2,17 -7.3,14 Z" fill="${pal.sign}" stroke="${pal.signInk}" stroke-width="1.8" stroke-linejoin="round"/><path d="M-3.5,3.5 H2 V11.5 H-3.5 Z M2,5.5 H3.8 V9 H2" fill="${pal.mug}" stroke="${pal.signInk}" stroke-width=".8"/><path d="M-3.8,3 C-3.5,1 -.5,1 0,2 C.8,.8 2.7,1.4 2.3,3 Z" fill="${pal.foam}"/></g>`
  return s
}

/* ---------- the portal: a round gate on a dais, one per planet it leads to ---------- */
/*
  A thick round gate standing on a two-step round dais of the destination
  planet's stone with a magenta edge: you see the top of its band and, inside,
  its far wall behind the swirl. Chevrons light in magenta and the planet's
  colour, the planet's emblem sits on top. The magenta stays the portal's;
  the stone, the light and the emblem are the planet it takes you to.
  Writes portal-<planet>.svg.
*/
const MAGENTA = '#ff3cf0', MAGENTA_DARK = '#8a1a86'
const INK = '#1c1626'
const PORTAL_WASH = (v, k = 0.3) => (hex(v).reduce((a, b) => a + b, 0) < 230 ? mix(v, '#2a1a0a', 0.1) : mix(v, '#e9d5a4', k))
/* each planet's look, taken from its own map */
const RAW = {
  eyeke: { stoneLit:'#b4c79a', stone:'#8aa070', stoneDark:'#55693f', accent:'#4fd07a', deep:'#0f6a3a', motif:'leaf' },
  kavian: { stoneLit:'#cfd1d6', stone:'#9a9ca3', stoneDark:'#5f6168', accent:'#b9c9e6', deep:'#3e4c6a', motif:'crystal' },
  magor: { stoneLit:'#e2a06a', stone:'#b8693a', stoneDark:'#7a3a1c', accent:'#ff8a2a', deep:'#8a2a08', motif:'spike' },
  naron: { stoneLit:'#ffffff', stone:'#dfe8ee', stoneDark:'#9fb2c0', accent:'#8fdcff', deep:'#2a6a9a', motif:'ice' },
  neri: { stoneLit:'#f2d68a', stone:'#d9b45a', stoneDark:'#9a7426', accent:'#ffd84a', deep:'#a8740a', motif:'sun' },
  veles: { stoneLit:'#7cc4bd', stone:'#4f9a96', stoneDark:'#24605e', accent:'#2fd6d0', deep:'#0a4a6a', motif:'wave' },
}
const PLANET_LOOK = Object.fromEntries(
  Object.entries(RAW).map(([k, t]) => [k, { ...t, name: k, stoneLit: PORTAL_WASH(t.stoneLit), stone: PORTAL_WASH(t.stone), stoneDark: PORTAL_WASH(t.stoneDark), accent: PORTAL_WASH(t.accent, 0.12) }]),
)
function portalGate(T, uid) {
  const ink = (w = 2.2, c = INK) => ` stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`
  const grad = (id, c0, c1, c2, x0, x1) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${x1}" y2="0"><stop offset="0" stop-color="${c0}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`
  /* the planet's emblem, small, centred on x, y */
  function motif(T, x, y, k = 1) {
    const g = (d) => `<g transform="translate(${f(x)} ${f(y)}) scale(${k})">${d}</g>`
    switch (T.motif) {
      case 'leaf': return g(`<path d="M0,5 C-6,1 -5,-5 0,-7 C5,-5 6,1 0,5 Z" fill="${T.accent}"${ink(1)}/><path d="M0,5 V-5" stroke="${T.deep}" stroke-width=".8"/>`)
      case 'crystal': return g(`<polygon points="0,-7 4,-1 0,6 -4,-1" fill="${T.accent}"${ink(1)}/><path d="M0,-7 V6" stroke="#fff" stroke-width=".7" opacity=".7"/>`)
      case 'spike': return g(`<polygon points="-5,4 -2,-6 1,1 3,-4 5,4" fill="${T.accent}"${ink(1)}/>`)
      case 'ice': return g(`<path d="M0,-6 V6 M-5.2,-3 L5.2,3 M-5.2,3 L5.2,-3" stroke="${T.accent}" stroke-width="2.4" stroke-linecap="round"/><path d="M0,-6 V6 M-5.2,-3 L5.2,3 M-5.2,3 L5.2,-3" stroke="#fff" stroke-width=".8" stroke-linecap="round"/>`)
      case 'sun': return g(`<circle r="3.4" fill="${T.accent}"${ink(1)}/>` + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const t = a * Math.PI / 180; return `<line x1="${f(4.6 * Math.cos(t))}" y1="${f(4.6 * Math.sin(t))}" x2="${f(7 * Math.cos(t))}" y2="${f(7 * Math.sin(t))}" stroke="${T.accent}" stroke-width="1.4" stroke-linecap="round"/>` }).join(''))
      case 'wave': return g(`<path d="M-6,2 C-4,-3 -1,-3 0,1 C1,-3 4,-3 6,2" fill="none" stroke="${T.accent}" stroke-width="2.4" stroke-linecap="round"/><path d="M-6,2 C-4,-3 -1,-3 0,1 C1,-3 4,-3 6,2" fill="none" stroke="#fff" stroke-width=".7" opacity=".7"/>`)
    }
  }
  /* the swirl: the planet's light with a magenta edge and spiral arms */
  function vortex(T, uid, cx, cy, rx, ry) {
    let s = `<defs><radialGradient id="${uid}-vx"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="${T.accent}"/><stop offset=".78" stop-color="${T.deep}"/><stop offset="1" stop-color="${MAGENTA_DARK}"/></radialGradient></defs>`
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${uid}-vx)"/>`
    for (let k = 0; k < 3; k++) {
      const pts = []
      for (let i = 0; i <= 14; i++) { const t = i / 14, a = k * 2.094 + t * 3.6, rr = 1 - t * .82; pts.push([cx + rx * .92 * rr * Math.cos(a), cy + ry * .92 * rr * Math.sin(a)]) }
      s += `<path d="M${pts.map((p) => p.map(f).join(',')).join(' L')}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>`
    }
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${MAGENTA}" stroke-width="1.8"/>`
    return s
  }
  const wash = PORTAL_WASH
  const METAL = { lit:wash('#e4ebf0'), mid:wash('#a6b2bc'), dark:wash('#5e6a76'), side:wash('#7c8894') }
  const stoneMat = (T) => ({ lit:T.stoneLit, mid:T.stone, dark:T.stoneDark, side:mix(T.stone, T.stoneDark, .5) })
  /* depth runs back and up: seen from a little above, the ring's top edge shows */
  const DX = 2.4, DY = -5.5
  /* a round cylinder seen from above: side from y up to y - h, top ellipse */
  function cyl(uid, rx, ry, y, h, m, edgeC) {
    return `<defs>${grad(uid, m.lit, m.mid, m.dark, -rx, rx)}</defs><path d="M${-rx},${y - h} V${y} A${rx},${ry} 0 0 0 ${rx},${y} V${y - h} Z" fill="url(#${uid})"${ink(1.8)}/><ellipse cx="0" cy="${y - h}" rx="${rx}" ry="${ry}" fill="${m.lit}"${ink(1.8)}/>` + (edgeC ? `<path d="M${-rx},${y - h} A${rx},${ry} 0 0 0 ${rx},${y - h}" fill="none" stroke="${edgeC}" stroke-width="1.4"/>` : '')
  }
  /*
    The ring: a thick round band standing upright, its face toward you, its
    depth going back and up so you see its top edge and, inside, its far wall.
    Drawn as slices from the back to the front; the swirl hangs in the middle.
  */
  function gateRing(T, uid, o) {
    const m = o.mat || METAL, R = o.R || 24, r = o.r || 17, cy = o.cy
    const N = 8
    const ann = (t) => { const x = DX * t, y = cy + DY * t; return `M${f(x - R)},${f(y)} a${R},${R} 0 1 0 ${2 * R},0 a${R},${R} 0 1 0 ${-2 * R},0 Z M${f(x - r)},${f(y)} a${r},${r} 0 1 1 ${2 * r},0 a${r},${r} 0 1 1 ${-2 * r},0 Z` }
    let s = ''
    /* the outline of the whole band first, so its silhouette is inked once */
    for (let i = 0; i <= N; i++) { const t = 1 - i / N; s += `<circle cx="${f(DX * t)}" cy="${f(cy + DY * t)}" r="${R}" fill="none" stroke="${INK}" stroke-width="4.4"/>` }
    const slice = (t) => `<path d="${ann(t)}" fill-rule="evenodd" fill="${t > .02 ? m.side : m.mid}"/>`
    for (let i = 0; i <= N / 2; i++) s += slice(1 - i / N)
    s += `<circle cx="${f(DX)}" cy="${f(cy + DY)}" r="${r}" fill="none" stroke="${INK}" stroke-width="1.4"/>`
    s += vortex(T, uid, f(DX * .5), f(cy + DY * .5), r + .5, r + .5)
    for (let i = N / 2 + 1; i < N; i++) s += slice(1 - i / N)
    /* the front face, lit from the upper left */
    s += `<defs><linearGradient id="${uid}-ff" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.lit}"/><stop offset=".55" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.dark}"/></linearGradient></defs><path d="${ann(0)}" fill-rule="evenodd" fill="url(#${uid}-ff)"${ink(1.8)}/>`
    if (o.segments) for (let i = 0; i < o.segments; i++) { const t = (i / o.segments) * Math.PI * 2 + Math.PI / o.segments; s += `<line x1="${f(r * Math.sin(t))}" y1="${f(cy - r * Math.cos(t))}" x2="${f(R * Math.sin(t))}" y2="${f(cy - R * Math.cos(t))}" stroke="${m.dark}" stroke-width="1.2"/>` }
    /* chevrons round the face */
    if (o.chevrons !== false) for (let i = 0; i < 9; i++) {
      const t = (i / 9) * Math.PI * 2, rc = (R + r) / 2, x = rc * Math.sin(t), y = cy - rc * Math.cos(t)
      const c = i === 0 ? MAGENTA : i % 2 ? T.accent : MAGENTA
      s += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(t * 180 / Math.PI)})"><circle r="3.6" fill="${c}" opacity=".35"/><path d="M-3,-2.4 L3,-2.4 L1.8,2.4 L-1.8,2.4 Z" fill="${c}"${ink(.9)}/></g>`
    }
    /* a soft highlight along the upper left of the face */
    s += `<path d="M${f(-R * .82)},${f(cy - R * .42)} A${R * .92},${R * .92} 0 0 1 ${f(-R * .2)},${f(cy - R * .9)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>`
    /* the emblem on a mount at the top */
    if (o.emblem !== false) s += `<path d="M${f(-4 + DX * .5)},${f(cy - R - .5 + DY * .5)} h8 l-1.4,-4 h-5.2 Z" fill="${m.mid}"${ink(1.2)}/>` + motif(T, DX * .5, cy - R - 9 + DY * .5, 1)
    return s
  }
  const draw = () => {
    let s = cyl(uid + 'a', 34, 11, 2, 4, stoneMat(T)) + cyl(uid + 'b', 26, 8.4, -2, 5, stoneMat(T), MAGENTA)
    s += gateRing(T, uid, { cy:-30 })
    return s
  }
  return draw()
}

const BUILD = { arena, dungeon, tavern }


/* Grey for the muted copies: most of the colour out, the light and shade kept. */
const grey = (pal) =>
  Object.fromEntries(
    Object.entries(pal).map(([k, v]) => {
      const [r, g, b] = hex(v)
      const l = Math.round(0.3 * r + 0.59 * g + 0.11 * b)
      return [k, mix(v, '#' + [l, l, l].map((x) => x.toString(16).padStart(2, '0')).join(''), 0.88)]
    }),
  )

/*
  A light wash over the painted colours, toward the map's parchment, so the
  buildings sit in the map rather than on it. The darks only warm a little,
  to keep the outlines and shadows.
*/
const PARCHMENT = '#e9d5a4'
const washed = (pal) =>
  Object.fromEntries(
    Object.entries(pal).map(([k, v]) => {
      const dark = hex(v).reduce((a, b) => a + b, 0) < 230
      return [k, dark ? mix(v, '#2a1a0a', 0.1) : mix(v, PARCHMENT, 0.3)]
    }),
  )

const O = { outline: true, soft: true }
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'markers', 'buildings')
mkdirSync(out, { recursive: true })
const write = (name, svg) => writeFileSync(join(out, name), svg)
const frame = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-58 -96 116 116" width="116" height="116">${body}</svg>\n`
/* The dungeon once per rank: dungeon-r1.svg to dungeon-r5.svg, and greyed. */
for (let rank = 1; rank <= 5; rank++) {
  for (const muted of [false, true]) {
    const pal = muted ? grey(washed(BASE.dungeon)) : washed(BASE.dungeon)
    write(`dungeon-r${rank}${muted ? '-muted' : ''}.svg`, frame(dungeon('b', pal, O, 'dungeon', DUNGEON_HEADS[rank])))
  }
}
/* The arena once per rank: arena-r1.svg to arena-r5.svg, and greyed. */
for (let rank = 1; rank <= 5; rank++) {
  for (const muted of [false, true]) {
    const pal = muted ? grey(washed(BASE.arena)) : washed(BASE.arena)
    write(`arena-r${rank}${muted ? '-muted' : ''}.svg`, frame(arena('b', pal, O, 'arena', ARENA_RANKS[rank])))
  }
}
/* The portal once per planet it leads to: portal-eyeke.svg and so on, a little larger than the rest. */
for (const [planet, look] of Object.entries(PLANET_LOOK)) write(`portal-${planet}.svg`, frame(`<g transform="scale(1.2)">${portalGate(look, `portal-${planet}`)}</g>`))
for (const kind of ['arena', 'dungeon', 'tavern']) {
  for (const muted of [false, true]) {
    const pal = muted ? grey(washed(BASE[kind])) : washed(BASE[kind])
    const body = BUILD[kind]('b', pal, O, kind)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-58 -96 116 116" width="116" height="116">${body}</svg>\n`
    writeFileSync(join(out, `${kind}${muted ? '-muted' : ''}.svg`), svg)
  }
}
console.log('buildings written to', out)
