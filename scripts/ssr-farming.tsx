/**
 * Renders the Farming screen against live chain and AtomicAssets rows, and
 * writes a preview page so it can be looked at without a wallet.
 *
 *   npx vite build --ssr scripts/ssr-farming.tsx --outDir .ssr
 *   node .ssr/ssr-farming.js <wallet>
 *
 * The outDir has to sit inside the project or node cannot resolve `react`.
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import Farming, { CardTile, Rewards } from '../src/routes/Farming'
import { useGame } from '../src/state/useGame'
import { FARM_SCHEMAS } from '../src/farming/queries'
import { farmBoard, stakedByWeight } from '../src/farming/rules'
import type {
  FarmConfig,
  FarmPool,
  FarmUser,
  StakedCard,
} from '../src/farming/types'
import type { Player } from '../src/chain/types'

const NODE = 'https://wax.greymass.com/v1/chain/get_table_rows'

/** Zustand's server snapshot comes from the store's initial object. */
function primeStore(patch: Record<string, unknown>) {
  useGame.setState(patch as never)
  Object.assign(useGame.getInitialState(), patch)
}

async function rows<T>(body: Record<string, unknown>): Promise<T[]> {
  const res = await fetch(NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ json: true, limit: 1000, ...body }),
  })
  const data = (await res.json()) as { rows: T[] }
  return data.rows
}

function nameToUint64(name: string): bigint {
  const charmap = '.12345abcdefghijklmnopqrstuvwxyz'
  let value = 0n
  for (let i = 0; i <= 12; i++) {
    let c = 0n
    if (i < name.length && i <= 12) c = BigInt(charmap.indexOf(name[i]))
    if (i < 12) {
      c &= 0x1fn
      c <<= BigInt(64 - 5 * (i + 1))
    } else {
      c &= 0x0fn
    }
    value |= c
  }
  return value
}

async function main() {
  const wallet = process.argv[2] ?? '1x1ci.wam'
  const owner = nameToUint64(wallet)

  const [players, config, pools, users, staked] = await Promise.all([
    rows<Player>({
      code: 'players.ale',
      scope: 'players.ale',
      table: 'players',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
    rows<FarmConfig>({ code: 'farm.ale', scope: 'farm.ale', table: 'config' }),
    rows<FarmPool>({ code: 'farm.ale', scope: 'farm.ale', table: 'pools' }),
    rows<FarmUser>({
      code: 'farm.ale',
      scope: 'farm.ale',
      table: 'user',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
    rows<StakedCard>({
      code: 'farm.ale',
      scope: 'farm.ale',
      table: 'nfts',
      index_position: 2,
      key_type: 'i128',
      lower_bound: (owner << 64n).toString(),
      upper_bound: ((owner << 64n) | 0xffffffffffffffffn).toString(),
    }),
  ])

  const player = players[0]
  if (!player) {
    console.error(`no player row for ${wallet}`)
    return
  }

  const cfg = config[0]
  const user = users[0]
  const now = Date.now()
  const board = farmBoard(FARM_SCHEMAS, user, pools, cfg, staked, now)

  console.log(
    `# ${wallet}: ${staked.length} staked, ` +
      `${board.total.toLocaleString('en-US')} credits estimated`,
  )

  const pages: { label: string; html: string }[] = []
  const render = (label: string, node: JSX.Element) => {
    const html = renderToStaticMarkup(node)
    console.log(`\n## ${label}\n${html.replace(/></g, '>\n<')}`)
    pages.push({ label, html })
  }

  primeStore({ account: wallet, playerLoaded: true, player })
  render('screen chrome (first paint)', <Farming />)

  render(
    'rewards tab',
    <Rewards board={board.pools} total={board.total} user={user} config={cfg} />,
  )

  /*
   * A synthetic position that has hit the power ceiling — the state the whole
   * screen exists to warn about, and one nobody on chain is in right now.
   */
  const maxed: FarmUser | undefined = user && {
    ...user,
    last_claim: new Date(now - 90 * 86_400_000).toISOString().slice(0, 19),
  }
  const maxedBoard = farmBoard(FARM_SCHEMAS, maxed, pools, cfg, staked, now)
  render(
    'rewards tab — power ceiling reached (synthetic)',
    <Rewards
      board={maxedBoard.pools}
      total={maxedBoard.total}
      user={maxed}
      config={cfg}
    />,
  )

  /* The staked grid, with real cards across the weight range. */
  const tiles = [...staked].sort(stakedByWeight).slice(0, 24)
  render(
    'staked cards',
    <div className="cardgridf">
      {tiles.map((c, i) => (
        <CardTile
          key={c.asset_id}
          templateId={c.template_id}
          name={`#${c.template_id}`}
          rarity={c.rarity}
          shine={c.shine}
          weight={c.weight}
          picked={i < 3}
          disabled={false}
          onClick={() => {}}
        />
      ))}
    </div>,
  )

  writeGallery(pages)
}

function writeGallery(pages: { label: string; html: string }[]) {
  const css = readdirSync('docs/assets').find((f) => f.endsWith('.css'))
  if (!css) {
    console.error('\n(no built stylesheet in docs/assets — run npm run build first)')
    return
  }

  const body = pages
    .map(
      (p) =>
        `<h2 class="preview-label">${p.label}</h2><div class="farming">${p.html}</div>`,
    )
    .join('\n')
    .replace(/"\/assets\//g, '"assets/')
    .replace(/url\(&#x27;\/assets\//g, "url(&#x27;assets/")

  writeFileSync(
    'docs/__preview-farming.html',
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Farming states</title>
<link rel="stylesheet" href="assets/${css}">
<style>
  body { padding: 24px; background: var(--bg); font-family: var(--font-body); }
  .preview-label { color: var(--text-heading); font-family: var(--font-display);
    font-size: 15px; margin: 32px 0 10px; text-transform: uppercase; letter-spacing: .1em; }
</style>
</head><body>${body}</body></html>`,
  )
  console.error('\nwrote docs/__preview-farming.html')
}

void main()
