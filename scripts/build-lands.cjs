/*
 * Paints and bakes the fight stages for every land type and planet.
 *
 * A fight is a planet behind the horizon and a land underfoot, and either
 * can change without the other: any land type under any planet. So they are
 * baked apart.
 *
 *   planets/<planet>/backdrop-<shape>.webp
 *     The sky, the sun and the country on the horizon in ONE picture, as far
 *     down as the horizon. Only the clouds are live on top of it.
 *
 *   lands/<land>/floor.webp
 *     The turf tile the page lays on the floor in perspective.
 *   lands/<land>/ground-<shape>[-<planet>].webp
 *     Everything painted on the ground and standing on it, merged and cropped
 *     to what it covers: the wash of light and dark patches, the band under
 *     the horizon (water, lava, dunes, mountains), the rocks and plants. A
 *     land with water gets one per planet, the planet's light baked into the
 *     water, so the page needs no filter.
 *   lands/<land>/glints-<shape>.webp, foam-<shape>-a|b.webp
 *     What moves on water, cropped to the rows it moves in.
 *
 * It also writes src/fight/landStages.generated.ts: where each picture is and
 * how much of the field it covers. Run from the web root:
 *
 *   node scripts/build-lands.cjs [land name ...]
 *
 * The painters are scripts/stages/*; nothing here is random, so a rebuild
 * paints the same pictures.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const sharp = require(path.resolve('node_modules/sharp'))
const E = require('./stages/engine.cjs')
const B = require('./stages/bands.cjs')
require('./stages/art.cjs')
const { RECIPES: R1 } = require('./stages/recipes1.cjs')
const { RECIPES2 } = require('./stages/recipes2.cjs')
const { RECIPES3 } = require('./stages/recipes3.cjs')
const { PLANETS, WATER, ZOOM, HZ, FIELD, waterMatrix } = require('./stages/planets.cjs')
const renderHorizons = require('./stages/horizons.cjs')

/* A later recipe of the same name replaces an earlier one. */
const RECIPES = [...new Map([...R1, ...RECIPES2, ...RECIPES3].map((r) => [r.name, r])).values()]
const FORMS = ['wide', 'tall']
const OUT = path.resolve('public/assets/stages')
const VELES = path.join(OUT, 'veles')
const only = process.argv.slice(2).map((s) => s.toLowerCase())

/* Where a blow tears turf, and where it only kicks up dust. */
const TURF = new Set(['grass-coastline', 'grassland', 'plains', 'tree-forest', 'inland-river', 'mushroom-forest', 'methane-swampland'])

const png = (svg) => sharp(Buffer.from(svg), { density: 72 }).png().toBuffer()
const webp = (buf, file, q = 82, a = 90) => sharp(buf).webp({ quality: q, alphaQuality: a, effort: 6, smartSubsample: true }).toFile(file)
const pc = (n) => Math.round(n * 1000) / 1000

/* The first and last rows that hold anything. */
async function rowsOf(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let first = -1
  let last = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 6) {
        if (first < 0) first = y
        last = y
        break
      }
    }
  }
  return [first, last, info.width, info.height]
}
/* A picture cropped to the rows it uses; says where, as % of the field. */
async function cropped(buf, file, form, mode = 'rows') {
  const [first, last, W, H] = await rowsOf(buf)
  if (first < 0) return null
  const top = Math.max(0, first - 2)
  const bottom = mode === 'ground' ? H - 1 : Math.min(H - 1, last + 2)
  const out = await sharp(buf).extract({ left: 0, top, width: W, height: bottom - top + 1 }).png().toBuffer()
  /* the ground is soft, broad shapes: it takes a lower quality, and most of its weight is its alpha */
  if (mode === 'ground') await webp(out, file, 68, 68)
  else await webp(out, file)
  return { top: pc((top / H) * 100), h: pc(((bottom - top + 1) / H) * 100) }
}
const tinted = (buf, planet) => {
  const spec = WATER[planet]
  return spec.length ? sharp(buf).recomb(waterMatrix(spec)).png().toBuffer() : Promise.resolve(buf)
}
const blank = (W, H) => sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })

/* ---------- planets ---------- */
async function bakeBackdrop(planet, form, strips) {
  const { W, H } = FIELD[form]
  const hz = Math.round((H * HZ[form]) / 100)
  const skyH = (H * (HZ[form] + 3)) / 100
  const P = PLANETS[planet]
  const cropH = hz + 8
  const stops = P.stops.map(([c, o]) => `<stop offset="${o}%" stop-color="${c}"/>`).join('')
  const size = ((W * P.sun[2] * ZOOM) / 100) * (form === 'tall' ? 1.55 : 1)
  const cx = (W * P.sun[0]) / 100
  const cy = (skyH * P.sun[1]) / 100
  const sc = P.sun[3]
  const R = size * 0.707
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${cropH}" viewBox="0 0 ${W} ${cropH}"><defs>
<linearGradient id="s" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="${skyH}">${stops}</linearGradient>
<radialGradient id="g"><stop offset="0" stop-color="${sc}" stop-opacity=".5"/><stop offset=".45" stop-color="${sc}" stop-opacity=".3"/><stop offset="1" stop-color="${sc}" stop-opacity="0"/></radialGradient>
<radialGradient id="d"><stop offset="0" stop-color="#fffef6"/><stop offset=".34" stop-color="#fffef6"/><stop offset=".52" stop-color="${sc}"/><stop offset=".72" stop-color="${sc}" stop-opacity="0"/></radialGradient>
</defs><rect width="${W}" height="${cropH}" fill="url(#s)"/><circle cx="${cx}" cy="${cy}" r="${size * 1.25}" fill="url(#g)"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#d)"/></svg>`
  const layers = []
  if (planet === 'veles') {
    /* Veles' islands, at the pulled-back size, the sea carrying on to the right in a mirrored copy. */
    const src = await sharp(path.join(VELES, `far-${form}.webp`)).metadata()
    const w = Math.round(W * ZOOM)
    const h = Math.round(src.height * ZOOM)
    const a = await sharp(path.join(VELES, `far-${form}.webp`)).resize(w, h).png().toBuffer()
    const b = await sharp(a).flop().extract({ left: 0, top: 0, width: Math.min(w, W - w), height: h }).png().toBuffer()
    layers.push({ input: a, left: 0, top: hz + 2 - h }, { input: b, left: w, top: hz + 2 - h })
  } else {
    const s = await sharp(path.join(strips, `${planet}-${form}.webp`)).png().toBuffer()
    const h = (await sharp(s).metadata()).height
    layers.push({ input: s, left: 0, top: hz + 2 - h })
  }
  const base = await png(svg)
  const out = await sharp(base).composite(layers).png().toBuffer()
  const dir = path.join(OUT, 'planets', planet)
  fs.mkdirSync(dir, { recursive: true })
  await webp(out, path.join(dir, `backdrop-${form}.webp`), 80)
  return { src: `/assets/stages/planets/${planet}/backdrop-${form}.webp`, h: pc((cropH / H) * 100) }
}

/* ---------- lands ---------- */
async function bakeLand(r, isGrassCoast) {
  const slug = E.slugOf(r.name)
  const dir = path.join(OUT, 'lands', slug)
  fs.mkdirSync(dir, { recursive: true })
  const seed = E.hashOf(slug)
  const entry = {
    slug, name: r.name, family: r.family, sea: !!r.sea, tile: r.tile || 1, mist: r.mist || null,
    mark: TURF.has(slug) ? 'turf' : 'sand', ground: {}, glints: null, foam: null, clump: null,
  }
  /* the floor */
  if (isGrassCoast) fs.copyFileSync(path.join(VELES, 'grass.webp'), path.join(dir, 'floor.webp'))
  else if (r.floorFile) fs.copyFileSync(r.floorFile, path.join(dir, 'floor.webp'))
  else await webp(await png(E.floorSVG(r.floor, seed)), path.join(dir, 'floor.webp'), 80)
  if (isGrassCoast) {
    fs.copyFileSync(path.join(VELES, 'clump.webp'), path.join(dir, 'clump.webp'))
    entry.clump = 'clump.webp'
  }

  for (const form of FORMS) {
    const g = E.GEO[form]
    const layers = []
    let band = null
    if (isGrassCoast) {
      band = await sharp(path.join(VELES, `shore-${form}.webp`)).png().toBuffer()
    } else if (r.band) {
      band = await png(B.BAND[r.band.type](g, r.band, form, seed + 1))
    }
    /* what moves on the water */
    let glints = null
    let foamA = null
    let foamB = null
    if (isGrassCoast) {
      glints = await sharp(path.join(VELES, `glints-${form}.webp`)).png().toBuffer()
      foamA = await sharp(path.join(VELES, `foam-${form}-a.webp`)).png().toBuffer()
      foamB = await sharp(path.join(VELES, `foam-${form}-b.webp`)).png().toBuffer()
    } else if (r.band && r.band.type === 'shore') {
      glints = await png(B.glintsSVG(g, r.band, form, seed + 2))
      foamA = await png(B.foamSVG(g, r.band, 0))
      foamB = await png(B.foamSVG(g, r.band, 1))
    } else if (r.band && r.band.type === 'river') {
      glints = await png(B.riverGlints(g, r.band, form, seed + 2))
    }
    if (glints) {
      entry.glints = entry.glints || {}
      entry.glints[form] = await cropped(glints, path.join(dir, `glints-${form}.webp`), form)
    }
    if (foamA) {
      entry.foam = entry.foam || {}
      const a = await cropped(foamA, path.join(dir, `foam-${form}-a.webp`), form)
      const b = await cropped(foamB, path.join(dir, `foam-${form}-b.webp`), form)
      /* both laps cover the same rows: the page places them as one */
      entry.foam[form] = { top: Math.min(a.top, b.top), h: Math.max(a.top + a.h, b.top + b.h) - Math.min(a.top, b.top) }
    }
    /* the wash under, the band, the things standing on it */
    const under = []
    if (!isGrassCoast && (r.wash || r.floor)) {
      const base = r.floor ? r.floor.base : '#808080'
      const [light, dark] = r.wash || [E.sh(base, 0.24), E.sh(base, -0.3)]
      under.push({ input: await png(B.washSVG(g, form, light, dark, seed + 5, r.decals)) })
    }
    const over = []
    if (r.props) over.push({ input: await png(E.propsSVG(g, form, r, seed + 3)) })

    const planets = r.sea || isGrassCoast ? Object.keys(PLANETS) : [null]
    for (const planet of planets) {
      const stack = [...under]
      if (band) stack.push({ input: planet ? await tinted(band, planet) : band })
      stack.push(...over)
      if (!stack.length) continue
      const flat = await blank(g.W, g.H).composite(stack).png().toBuffer()
      const file = `ground-${form}${planet ? '-' + planet : ''}.webp`
      const at = await cropped(flat, path.join(dir, file), form, 'ground')
      entry.ground[form] = at
    }
  }
  return entry
}

;(async () => {
  const strips = fs.mkdtempSync(path.join(os.tmpdir(), 'horizons-'))
  await renderHorizons(strips)

  const planets = {}
  for (const planet of Object.keys(PLANETS)) {
    const P = PLANETS[planet]
    const back = {}
    for (const form of FORMS) back[form] = await bakeBackdrop(planet, form, strips)
    planets[planet] = { side: P.side, clouds: P.clouds, motes: P.motes || null, tint: P.tint, ta: P.ta, shade: P.shade, cloud: P.cloud, lx: P.sun[0], zenith: P.stops[0][0], backdrop: back }
    console.log('planet', planet)
  }

  const lands = {}
  const grass = { name: 'Grass Coastline', family: 'Coast', sea: true, mist: null }
  const todo = [{ r: grass, coast: true }, ...RECIPES.filter((r) => r.name !== 'Grass Coastline').map((r) => ({ r, coast: false }))]
  for (const { r, coast } of todo) {
    if (only.length && !only.includes(r.name.toLowerCase())) continue
    const e = await bakeLand(r, coast)
    lands[e.slug] = e
    console.log('land', e.slug)
  }
  if (only.length) {
    /* a partial run keeps what was already in the registry */
    const prev = path.resolve('src/fight/landStages.generated.json')
    if (fs.existsSync(prev)) Object.assign(lands, { ...JSON.parse(fs.readFileSync(prev, 'utf8')).lands, ...lands })
  }
  fs.writeFileSync(path.resolve('src/fight/landStages.generated.json'), JSON.stringify({ planets, lands }, null, 1))
  const ts = `/*
 * Where each planet's backdrop and each land's pictures are, and how much of
 * the field they cover. Written by scripts/build-lands.cjs: do not edit by hand.
 */
export type Shape = 'wide' | 'tall'
/** A picture's place in the field: where it starts and how tall it is, as % of the field's height. */
export interface Place {
  top: number
  h: number
}
export interface PlanetStage {
  side: 'l' | 'r'
  clouds: 'puff' | 'streak' | 'dust' | 'mist' | 'overcast'
  motes: 'snow' | 'dust' | null
  /** The colour of its light ("r g b"), how strongly it tints the ground, and how much it darkens it. */
  tint: string
  ta: number
  shade: number
  /** The colour of its clouds ("r g b"). */
  cloud: string
  /** Where the sun is, % of the width. */
  lx: number
  /** The top of its sky: a phone's taller field continues it upward. */
  zenith: string
  backdrop: Record<Shape, { src: string; h: number }>
}
export interface LandStageSpec {
  slug: string
  name: string
  family: string
  /** Water that takes the planet's light: its ground has one picture per planet. */
  sea: boolean
  tile: number
  mist: string | null
  /** What a blow tears or kicks up. */
  mark: 'turf' | 'sand'
  ground: Record<Shape, { top: number; h: number }>
  glints: Record<Shape, Place> | null
  foam: Record<Shape, Place> | null
  clump: string | null
}

export const PLANET_STAGES: Record<string, PlanetStage> = ${JSON.stringify(planets, null, 2)}

export const LAND_STAGES: Record<string, LandStageSpec> = ${JSON.stringify(lands, null, 2)}
`
  fs.writeFileSync(path.resolve('src/fight/landStages.generated.ts'), ts)
  console.log('registry:', Object.keys(lands).length, 'lands,', Object.keys(planets).length, 'planets')
})()
