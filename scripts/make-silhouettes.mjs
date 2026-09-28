/**
 * Throw away what the screen throws away anyway.
 *
 * The gates draw the roster in silhouette, and the first thing that filter
 * does is `brightness(0)` — every pixel of colour in those files is decoded
 * and then multiplied by nothing. All that survives is the alpha channel,
 * the outline.
 *
 * So this writes the outline and nothing else: same pixel dimensions as the
 * portrait, RGB flattened to black, alpha untouched. The image renders
 * identically — the filter was already producing exactly this — and a flat
 * colour plane costs a webp almost nothing, so the files come out a fraction
 * of the size.
 *
 *   node scripts/make-silhouettes.mjs <in-dir> <out-dir>
 *
 * Used for:
 *   public/assets/fighters -> public/assets/silhouettes   (the gates crowd)
 *
 * Avatars are skipped: they are head crops, and nothing renders a head crop
 * as a shape.
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const [src, out] = process.argv.slice(2)

if (!src || !out) {
  console.error('usage: node scripts/make-silhouettes.mjs <in-dir> <out-dir>')
  process.exit(1)
}

await mkdir(out, { recursive: true })
const files = (await readdir(src)).filter(
  (f) => /\.(webp|png)$/i.test(f) && !f.includes('_avatar'),
)

let done = 0
let bytesIn = 0
let bytesOut = 0

for (const file of files) {
  const from = join(src, file)
  const info = await stat(from)
  if (!info.isFile() || info.size === 0) continue

  try {
    /* Raw, because the point is to rewrite three of the four channels. */
    const { data, info: meta } = await sharp(from)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
    }

    const buf = await sharp(data, {
      raw: { width: meta.width, height: meta.height, channels: 4 },
    })
      /* The colour plane is one value, so quality buys nothing there; the
         alpha edge is the whole picture and is worth keeping clean. */
      .webp({ quality: 60, alphaQuality: 80, effort: 6 })
      .toBuffer()

    await writeFile(join(out, `${basename(file, extname(file))}.webp`), buf)
    bytesIn += info.size
    bytesOut += buf.length
    done++
  } catch (err) {
    console.warn(`skipped ${file}: ${err.message}`)
  }
}

const kb = (n) => (n / 1024).toFixed(0) + 'KB'
console.log(`${done} silhouettes: ${kb(bytesIn)} -> ${kb(bytesOut)}`)
