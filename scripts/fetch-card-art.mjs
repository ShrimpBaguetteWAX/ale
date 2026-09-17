/**
 * Fill in card art the build is missing.
 *
 * `/public/assets/cards` is one file per Alien Worlds template, rasterised
 * small — but Alien Worlds keeps minting templates, and a card minted since
 * the last run has no file here. The screens fall back to the card's own
 * picture on IPFS, which works and costs a round trip to a gateway on every
 * tile; this puts the missing ones in the build where the rest are.
 *
 *   node scripts/fetch-card-art.mjs [--dry]
 *
 * Reads the template lists from AtomicAssets, downloads only what is absent,
 * and writes it at the same size and quality `make-thumbs.mjs` uses.
 */
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT = 'public/assets/cards'
const SIZE = 192
const QUALITY = 78
const SCHEMAS = ['tool.worlds', 'crew.worlds', 'arms.worlds']
const API = 'https://wax.api.atomicassets.io'
const GATEWAYS = ['https://ipfs.alienworlds.io/ipfs/', 'https://ipfs.io/ipfs/']

const dry = process.argv.includes('--dry')

async function templates(schema) {
  const res = await fetch(
    `${API}/atomicassets/v1/templates?collection_name=alien.worlds` +
      `&schema_name=${encodeURIComponent(schema)}&limit=1000`,
  )
  const json = await res.json()
  return (json.data ?? []).map((t) => ({
    id: Number(t.template_id),
    name: String(t.name ?? ''),
    img: t.immutable_data?.img ? String(t.immutable_data.img) : '',
  }))
}

async function download(hash) {
  let last
  for (const gateway of GATEWAYS) {
    const url = /^https?:\/\//.test(hash) ? hash : gateway + hash
    try {
      const res = await fetch(url)
      if (!res.ok) {
        last = new Error(`${res.status} ${res.statusText}`)
        continue
      }
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      last = err
    }
    if (/^https?:\/\//.test(hash)) break
  }
  throw last ?? new Error('no gateway answered')
}

let missing = 0
let written = 0
const failed = []

for (const schema of SCHEMAS) {
  const rows = await templates(schema)
  for (const t of rows) {
    if (!t.id || existsSync(join(OUT, `${t.id}.webp`))) continue
    missing++
    console.log(`${schema} ${t.id} ${t.name}${t.img ? '' : ' — no image on the template'}`)
    if (dry || !t.img) {
      if (!t.img) failed.push(`${t.id} (no img)`)
      continue
    }
    try {
      const buf = await sharp(await download(t.img), { density: 200 })
        .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()
      await writeFile(join(OUT, `${t.id}.webp`), buf)
      written++
      console.log(`  wrote ${t.id}.webp (${Math.round(buf.length / 1024)}KB)`)
    } catch (err) {
      failed.push(`${t.id} (${err.message})`)
    }
  }
}

console.log(
  `\n${missing} template${missing === 1 ? '' : 's'} without local art; ` +
    `${written} written${failed.length ? `; failed: ${failed.join(', ')}` : ''}`,
)
