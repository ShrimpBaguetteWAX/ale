/**
 * Resize an image set once, at build time.
 *
 * The original ships artwork at source resolution and renders it small: the
 * NFT cards average 587KB for a ~96px tile, and the fighter class art averages
 * 867KB (one file is 5MB) for a portrait a few hundred pixels wide. Left
 * as-is, a single screen is tens of megabytes — unusable on a phone, which is
 * the whole point of this rebuild.
 *
 *   node scripts/make-thumbs.mjs <source-dir> <out-dir> <max-px> [--flat]
 *
 * Used for:
 *   assets/aw-nft-images -> public/assets/cards    192   (tavern card tiles)
 *   assets/fighter/classes -> public/assets/fighters 512 (recruit portraits)
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import sharp from 'sharp'

const [src, out, sizeArg] = process.argv.slice(2)
const size = Number(sizeArg)

if (!src || !out || !Number.isFinite(size)) {
  console.error('usage: node scripts/make-thumbs.mjs <source-dir> <out-dir> <max-px>')
  process.exit(1)
}

await mkdir(out, { recursive: true })
const files = (await readdir(src)).filter((f) => /\.(webp|png|jpe?g|svg)$/i.test(f))

let done = 0
let bytesIn = 0
let bytesOut = 0

for (const file of files) {
  const from = join(src, file)
  const info = await stat(from)
  if (!info.isFile() || info.size === 0) continue

  try {
    const buf = await sharp(from, { density: 200 })
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer()
    await writeFile(join(out, `${basename(file, extname(file))}.webp`), buf)
    bytesIn += info.size
    bytesOut += buf.length
    done++
  } catch (err) {
    console.warn(`skipped ${file}: ${err.message}`)
  }
}

const mb = (n) => (n / 1048576).toFixed(1) + 'MB'
console.log(`${done} images: ${mb(bytesIn)} -> ${mb(bytesOut)}`)
