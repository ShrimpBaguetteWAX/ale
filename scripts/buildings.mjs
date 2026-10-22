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
  arena:{ lit:'#ffd04a', mid:'#f6a800', dark:'#b57200', top:'#ffdc80', inner:'#6e4300', tierA:'#c98a12', tierB:'#9f6a08', sand:'#ead08c', win:'#4e2f00', gate:'#2e1b00', ink:'#362700', flag:'#f6a800', flagLit:'#ffd36a', pole:'#4a3000' },
  dungeon:{ crown:'#ffcf3a', stoneLit:'#8d96a6', stone:'#626b7b', stoneDark:'#3b4250', cave:'#070d18', glow:'#00baff', lit:'#45b8ee', mid:'#0087c0', dark:'#005a84', ink:'#002738', eye:'#ffd36a' },
  tavern:{ wall:'#f2e0b4', wallSide:'#c7ab74', beam:'#5c3b1c', roofLit:'#2bd86b', roof:'#00b347', roofDark:'#007f31', roofEdge:'#005a23', win:'#ffd36a', winSide:'#e3b347', door:'#4a2a10', ink:'#2b1a08', sign:'#00c04a', signDark:'#008a35', signInk:'#002b10', mug:'#f4f0de', chimney:'#8b5a3a', chimneySide:'#5f3d27' },
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
  The arena's cloth by boost rank, the same bands as the rings: its pennants
  and banners change colour as the rank climbs, like a fighter's belts, and
  there are more of them. White, the arena's gold, red, crimson with gold
  trim, royal purple with gold trim. The building itself never changes.
*/
const RED = '#c04a35', CRIMSON = '#a52a35', PURPLE = '#6a3e8c', WHITE = '#efe6cf', GOLD_CLOTH = '#f4c547'
const GOLD_TRIM = '#e8b83a', GOLD_BRIGHT = '#ffd84a'
const ARENA_DRESS = {
  1: { flags: [180], flag: WHITE },
  2: { flags: [180, -110, 110], flag: GOLD_CLOTH },
  3: { flags: [180, -110, 110], flag: RED, banners: [-44, 44], banner: RED },
  4: { flags: [180, -110, 110, -150, 150], flag: CRIMSON, flagTrim: GOLD_TRIM, banners: [-56, -20, 20, 56], banner: CRIMSON, bannerTrim: GOLD_BRIGHT },
  5: { flags: [180, -110, 110, -150, 150], flag: PURPLE, flagTrim: GOLD_BRIGHT, banners: [-62, -36, -12, 12, 36, 62], long: true, banner: PURPLE, bannerTrim: GOLD_BRIGHT, finials: true },
}

/* ---------- the arena: a colosseum, its pennants and banners by rank ---------- */
function arena(sid, pal, O, uid, dress = ARENA_DRESS[2]) {
  const R = 40, r = 14, H = 34
  const wall = `M${-R},${-H} L${-R},0 A${R},${r} 0 0 0 ${R},0 L${R},${-H} A${R},${r} 0 0 1 ${-R},${-H} Z`
  const rim = (deg) => { const t = deg * Math.PI / 180; return [R * Math.sin(t), -H + r * Math.cos(t)] }
  const onWall = (deg, h) => { const t = deg * Math.PI / 180; return [R * Math.sin(t), h + r * Math.cos(t), Math.cos(t)] }
  /* cloth keeps a little of the wash the rest of the building has */
  const cloth = (c) => (pal.wash ? mix(c, pal.wash, 0.12) : c)
  let s = `<defs>${shade(`${uid}-aw`, -R, R, [pal.lit, pal.mid, pal.dark], O)}<clipPath id="${uid}-awc"><path d="${wall}"/></clipPath><clipPath id="${uid}-aic"><ellipse cx="0" cy="${-H + .6}" rx="${R - 6}" ry="${r - 2.2}"/></clipPath></defs>`
  const flag = (deg) => {
    const [x, y] = rim(deg)
    /* the pennants on the left catch the light */
    const lit = Math.sin(deg * Math.PI / 180) < 0
    const fill = cloth(lit ? mix(dress.flag, '#ffffff', 0.1) : dress.flag)
    const rim_ = dress.flagTrim ? ` stroke="${cloth(dress.flagTrim)}" stroke-width="1.4" stroke-linejoin="round"` : edge(O, pal.ink, 1.6)
    return `<line x1="${f(x)}" y1="${f(y + 1)}" x2="${f(x)}" y2="${f(y - 25)}" stroke="${pal.pole}" stroke-width="2.2" stroke-linecap="round"/><polygon points="${P([[x, y - 25], [x + 16, y - 23], [x + 10.5, y - 19.5], [x + 16, y - 15], [x, y - 14]])}" fill="${fill}"${rim_}/>` +
      (dress.finials ? `<circle cx="${f(x)}" cy="${f(y - 26.4)}" r="2" fill="${cloth(GOLD_BRIGHT)}" stroke="${pal.ink}" stroke-width=".8"/>` : '')
  }
  const behind = (d) => Math.cos(d * Math.PI / 180) <= 0
  /* pennants on the back half of the rim stand behind the bowl */
  dress.flags.filter(behind).forEach((d) => { s += flag(d) })
  s += `<path d="${wall}" fill="url(#${uid}-aw)"${edge(O, pal.ink)}/>`
  s += hatchOver(O, sid, `${uid}-awc`, R * .3, R + 2, -H - 2, r + 2)
  /* the band between the two storeys */
  s += `<path d="M${-R},-17 A${R},${r} 0 0 0 ${R},-17" fill="none" stroke="${pal.dark}" stroke-width="1.6" opacity=".8"/>`
  for (let d = -66; d <= 66; d += 22) { const [x, y, c] = onWall(d, -27); if (c > .3) s += `<path d="${archPath(x, y + 8, y, 6.4 * c)}" fill="${pal.win}" opacity=".85"/>` }
  for (let d = -72; d <= 72; d += 24) { if (d === 0) continue; const [x, y, c] = onWall(d, -14); if (c > .3) s += `<path d="${archPath(x, y + 11, y, 7.4 * c)}" fill="${pal.win}" opacity=".85"/>` }
  /* the gate */
  s += `<path d="${archPath(0, r, -4, 13)}" fill="${pal.gate}"/>`
  /* banners hanging from the top of the wall */
  ;(dress.banners || []).forEach((d) => {
    const [x, y, c] = onWall(d, -H + 1)
    const w = 5.6 * c, h = dress.long ? 22 : 14, fill = cloth(dress.banner)
    s += `<path d="M${f(x - w / 2)},${f(y)} H${f(x + w / 2)} V${f(y + h)} L${f(x)},${f(y + h - 3)} L${f(x - w / 2)},${f(y + h)} Z" fill="${fill}" stroke="${mix(fill, '#000000', .45)}" stroke-width=".9"/><line x1="${f(x - w / 2)}" y1="${f(y + 2)}" x2="${f(x + w / 2)}" y2="${f(y + 2)}" stroke="${cloth(dress.bannerTrim || pal.flagLit)}" stroke-width="${dress.bannerTrim ? 1.6 : 1}"/>`
  })
  /* the bowl from above: rim, then tiers stepping down to the sand */
  s += `<ellipse cx="0" cy="${-H}" rx="${R}" ry="${r}" fill="${pal.top}"${edge(O, pal.ink)}/>`
  s += `<g clip-path="url(#${uid}-aic)"><ellipse cx="0" cy="${-H + .6}" rx="${R - 6}" ry="${r - 2.2}" fill="${pal.inner}"/>`
  ;[[pal.tierA, 2.2, 4.4, 1.5], [pal.tierB, 4.6, 8.8, 3], [pal.tierA, 7, 13, 4.4], [pal.sand, 9.6, 17, 5.8]].forEach(([c, dy, dr, dry]) => { s += `<ellipse cx="0" cy="${f(-H + .6 + dy)}" rx="${f(R - 6 - dr)}" ry="${f(r - 2.2 - dry)}" fill="${c}"/>` })
  s += `</g>`
  dress.flags.filter((d) => !behind(d)).forEach((d) => { s += flag(d) })
  if (O.soft) s += `<path d="M${-R + 4},${-H + 4} L${-R + 4},-6" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>`
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

/* ---------- the tavern: a timbered house, green roof, the sign out front ---------- */
function tavern(sid, pal, O, uid) {
  let s = `<defs><clipPath id="${uid}-tsc"><polygon points="6,8 31,-2 31,-32 6,-22"/></clipPath></defs>`
  /* chimney behind the ridge */
  s += `<polygon points="${P([[16, -45], [22, -47.4], [22, -60], [16, -57.6]])}" fill="${pal.chimney}"${edge(O, pal.ink, 1.6)}/><polygon points="${P([[22, -47.4], [25, -48.6], [25, -61.2], [22, -60]])}" fill="${pal.chimneySide}"${edge(O, pal.ink, 1.6)}/>`
  /* side wall, receding to the right */
  s += `<polygon points="6,8 31,-2 31,-32 6,-22" fill="${pal.wallSide}"${edge(O, pal.ink)}/>`
  s += hatchOver(O, sid, `${uid}-tsc`, 4, 33, -34, 10)
  s += `<polygon points="${P([[12, -11.5], [18.5, -14.1], [18.5, -21.6], [12, -19]])}" fill="${pal.winSide}"${edge(O, pal.beam, 1.2)}/><polygon points="${P([[22, -15.1], [27.5, -17.3], [27.5, -24.8], [22, -22.6]])}" fill="${pal.winSide}"${edge(O, pal.beam, 1.2)}/>`
  s += `<path d="M6,-8 L31,-18" stroke="${pal.beam}" stroke-width="1.8"/>`
  /* front wall and gable */
  s += `<polygon points="-30,8 6,8 6,-22 -30,-22" fill="${pal.wall}"${edge(O, pal.ink)}/>`
  s += `<polygon points="-30,-22 6,-22 -12,-42" fill="${pal.wall}"${edge(O, pal.ink)}/>`
  /* the timber frame */
  s += `<path d="M-30,-8 L6,-8 M-30,-22 L6,-22 M-12,-22 L-12,-42 M-21,-22 L-12,-34 M-3,-22 L-12,-34" fill="none" stroke="${pal.beam}" stroke-width="2.2" stroke-linecap="round"/>`
  s += `<path d="${archPath(-12, 8, -6, 9)}" fill="${pal.door}"${edge(O, pal.ink, 1.2)}/>`
  s += `<rect x="-27" y="-18.5" width="8" height="7.5" fill="${pal.win}"${edge(O, pal.beam, 1.4)}/><rect x="-5" y="-18.5" width="8" height="7.5" fill="${pal.win}"${edge(O, pal.beam, 1.4)}/><path d="M-23,-18.5 V-11 M-27,-14.75 H-19 M-1,-18.5 V-11 M-5,-14.75 H3" stroke="${pal.beam}" stroke-width="1"/>`
  s += `<circle cx="-12" cy="-29.5" r="3" fill="${pal.win}"${edge(O, pal.beam, 1.2)}/>`
  /* roof: the plane seen from above on the right, and its edge along the gable */
  s += `<polygon points="${P([[-12, -44], [13, -54], [34, -31.5], [9, -21]])}" fill="${O.soft ? `url(#${uid}-tr)` : pal.roof}"${edge(O, pal.roofEdge)}/>`
  if (O.soft) s = s.replace('</defs>', `<linearGradient id="${uid}-tr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.roofLit}"/><stop offset="1" stop-color="${pal.roofDark}"/></linearGradient></defs>`)
  else s += `<polygon points="${P([[-12, -44], [13, -54], [16.5, -50.2], [-8.5, -40.2]])}" fill="${pal.roofLit}"/>`
  s += `<path d="M-4.5,-40 L21,-50 M3,-36 L28.5,-46 M10.5,-32 L36,-42" stroke="${pal.roofDark}" stroke-width="1.2" opacity=".7" transform="translate(-2 6)"/>`
  s += `<polygon points="${P([[-12, -44], [-34, -20.5], [-30.5, -19.5], [-12, -39.5]])}" fill="${pal.roofDark}"${edge(O, pal.roofEdge, 1.6)}/>`
  /* the sign on its bracket, the tavern's own green and mug */
  s += `<path d="M-30,-17 L-46,-17" stroke="${pal.beam}" stroke-width="2.4" stroke-linecap="round"/><path d="M-42,-17 V-14 M-34.5,-17 V-14" stroke="${pal.beam}" stroke-width="1.2"/>`
  s += `<path d="M-45.5,-14 H-31 V0 C-34,-2 -36,2 -38.2,1 C-40.5,0 -42.5,3 -45.5,0 Z" fill="${pal.sign}" stroke="${pal.signInk}" stroke-width="${O.outline ? 1.8 : 1.2}" stroke-linejoin="round"/>`
  s += `<path d="M-41.5,-10.5 H-36 V-2.5 H-41.5 Z M-36,-8.5 H-34.2 V-5 H-36" fill="${pal.mug}" stroke="${pal.signInk}" stroke-width=".8"/><path d="M-41.8,-11 C-41.5,-13 -38.5,-13 -38,-12 C-37.2,-13.2 -35.3,-12.6 -35.7,-11 Z" fill="#fff"/>`
  return s
}
const BUILD = { arena, dungeon, tavern }


/* Grey for the muted copies: most of the colour out, the light and shade kept. */
const greyOne = (v) => {
  const [r, g, b] = hex(v)
  const l = Math.round(0.3 * r + 0.59 * g + 0.11 * b)
  return mix(v, '#' + [l, l, l].map((x) => x.toString(16).padStart(2, '0')).join(''), 0.88)
}
const greyDress = (d) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'string' ? greyOne(v) : v]))
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
const washedWith = (pal) => ({ ...washed(pal), wash: PARCHMENT })

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
    const pal = washedWith(BASE.arena)
    const body = arena('b', muted ? { ...grey(pal), wash: PARCHMENT } : pal, O, 'arena', muted ? greyDress(ARENA_DRESS[rank]) : ARENA_DRESS[rank])
    write(`arena-r${rank}${muted ? '-muted' : ''}.svg`, frame(body))
  }
}
for (const kind of ['arena', 'dungeon', 'tavern']) {
  for (const muted of [false, true]) {
    const pal = muted ? grey(washed(BASE[kind])) : washed(BASE[kind])
    let body = BUILD[kind]('b', pal, O, kind)
    /* The house is drawn smaller than the other two; brought up to their size. */
    if (kind === 'tavern') body = `<g transform="scale(1.18)">${body}</g>`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-58 -96 116 116" width="116" height="116">${body}</svg>\n`
    writeFileSync(join(out, `${kind}${muted ? '-muted' : ''}.svg`), svg)
  }
}
console.log('buildings written to', out)
