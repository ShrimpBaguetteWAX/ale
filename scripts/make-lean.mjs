/**
 * The game's big pictures, as WebP: the page backgrounds, the planet maps,
 * the building art and a few icons that shipped as large PNGs and JPEGs.
 *
 *   node scripts/make-lean.mjs
 *
 * A page background is drawn behind the screen, dimmed, on a phone often a
 * few hundred pixels wide — it shipped as a 1.5 MB PNG. Each gets a WebP at
 * its own size for a desktop and an 800px one for a phone (`-800.webp`),
 * which `artSet` in src/assets.ts offers the browser. The planet maps keep
 * their 2000px, since the map zooms; the buildings and icons come down to
 * the largest size they are drawn at. Run once after replacing a source
 * picture; the originals are not kept beside the WebP.
 */
import { readdir, stat, unlink } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const PUB = fileURLToPath(new URL('../public/assets/', import.meta.url))

const BACKGROUNDS = [
  'bg-fight.png',
  'bg-dungeon.png',
  'bg-tavern.png',
  'bg-catch-and-conquer.jpeg',
  'bg-arena.png',
  'bg-shop.png',
  'bg-candle.png',
  'bg-leaderboard.png',
  'bg-maintenance.png',
  'bg-menu.jpeg',
]
/* Drawn small: the largest size each is shown at, doubled for sharp screens. */
const ICONS = [
  ['icons/build.png', 256],
  ['icons/wax-coin.png', 128],
  ['logo.png', 674],
]

let before = 0
let after = 0
async function write(src, out, opts) {
  const s = (await stat(src)).size
  let img = sharp(src)
  if (opts.width) img = img.resize({ width: opts.width, withoutEnlargement: true })
  const info = await img.webp({ quality: opts.quality }).toFile(out)
  return { s, o: info.size }
}

for (const f of BACKGROUNDS) {
  const src = join(PUB, 'background', f)
  const base = basename(f, extname(f))
  const full = await write(src, join(PUB, 'background', base + '.webp'), { quality: 78 })
  const phone = await write(src, join(PUB, 'background', base + '-800.webp'), { width: 800, quality: 74 })
  before += full.s
  after += full.o
  console.log(`${f}: ${kb(full.s)} -> ${kb(full.o)} (phone ${kb(phone.o)})`)
  await unlink(src)
}

for (const f of await readdir(join(PUB, 'maps'))) {
  if (extname(f) !== '.jpg') continue
  const src = join(PUB, 'maps', f)
  const r = await write(src, join(PUB, 'maps', basename(f, '.jpg') + '.webp'), { quality: 80 })
  before += r.s
  after += r.o
  console.log(`maps/${f}: ${kb(r.s)} -> ${kb(r.o)}`)
  await unlink(src)
}

for (const f of await readdir(join(PUB, 'buildings'))) {
  if (extname(f) !== '.png') continue
  const src = join(PUB, 'buildings', f)
  const r = await write(src, join(PUB, 'buildings', basename(f, '.png') + '.webp'), { width: 512, quality: 80 })
  before += r.s
  after += r.o
  console.log(`buildings/${f}: ${kb(r.s)} -> ${kb(r.o)}`)
  await unlink(src)
}

for (const [f, width] of ICONS) {
  const src = join(PUB, f)
  const r = await write(src, join(PUB, f.replace(/\.png$/, '.webp')), { width, quality: 82 })
  before += r.s
  after += r.o
  console.log(`${f}: ${kb(r.s)} -> ${kb(r.o)}`)
  /* The logo's PNG stays: pages outside the game may link to it. */
  if (f !== 'logo.png') await unlink(src)
}

console.log(`total ${kb(before)} -> ${kb(after)}`)

function kb(n) {
  return Math.round(n / 1024) + ' KB'
}
