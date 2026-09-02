/**
 * Renders the Leaderboards screen against live chain rows and writes a preview
 * page, so it can be looked at without a wallet.
 *
 *   npx vite build --ssr scripts/ssr-leaderboard.tsx --outDir .ssr
 *   node .ssr/ssr-leaderboard.js <wallet>
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import Leaderboard, { ArenaBoards, DungeonBoard } from '../src/routes/Leaderboard'
import { useGame } from '../src/state/useGame'
import type {
  ArenaRank,
  ArenaSeason,
  DungeonConfigLb,
  DungeonRank,
  TlmPool,
} from '../src/leaderboard/types'
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

async function main() {
  const wallet = process.argv[2] ?? '1x1ci.wam'

  const [players, cfg, ranks, pools, seasons] = await Promise.all([
    rows<Player>({
      code: 'players.ale',
      scope: 'players.ale',
      table: 'players',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
    rows<DungeonConfigLb>({
      code: 'dungeons.ale',
      scope: 'dungeons.ale',
      table: 'config',
    }),
    rows<DungeonRank>({
      code: 'dungeons.ale',
      scope: 'dungeons.ale',
      table: 'leaderboard',
      index_position: 2,
      key_type: 'i64',
      reverse: true,
      limit: 25,
    }),
    rows<TlmPool>({ code: 'pools.ale', scope: 'pools.ale', table: 'tlmpools' }),
    rows<ArenaSeason>({ code: 'arena.ale', scope: 'arena.ale', table: 'lbscopes' }),
  ])

  const player = players[0]
  if (!player) {
    console.error(`no player row for ${wallet}`)
    return
  }

  const config = cfg[0]
  const pool = pools.find((p) => p.pool === (config?.lb_tlmpools?.[0]?.first ?? 'tlmdunglb'))

  const boards = new Map<string, ArenaRank[]>()
  for (const s of seasons) {
    const list = await rows<ArenaRank>({
      code: 'arena.ale',
      scope: s.scope,
      table: 'leaderboard',
    })
    boards.set(s.scope, [...list].sort((a, b) => b.rating - a.rating))
  }

  const now = Date.now()
  console.log(
    `# ${wallet}: ${ranks.length} dungeon ranks, ${seasons.length} arena seasons, ` +
      `pot ${pool?.tlm_current ?? 'none'}`,
  )

  const pages: { label: string; html: string }[] = []
  const render = (label: string, node: JSX.Element) => {
    const html = renderToStaticMarkup(node)
    console.log(`\n## ${label}\n${html.replace(/></g, '>\n<')}`)
    pages.push({ label, html })
  }

  primeStore({ account: wallet, playerLoaded: true, player })
  render('screen chrome (first paint)', <Leaderboard />)

  render(
    'dungeon board',
    <DungeonBoard ranks={ranks} config={config} pool={pool} wallet={wallet} />,
  )

  /*
   * Only four players have a dungeon rating, so the reward threshold — the
   * line at rank 20 — is unreachable with live data. Padding the board out
   * with synthetic ranks is the only way to see it drawn.
   */
  const padded: DungeonRank[] = [...ranks]
  for (let i = ranks.length; i < 23; i++) {
    padded.push({
      ...ranks[i % ranks.length],
      wallet: `player${i}.wam`,
      gamertag: `Contender ${i + 1}`,
      rating: Math.max(1, (ranks[0]?.rating ?? 100) - i * 5),
    })
  }
  render(
    'dungeon board — reward threshold (synthetic ranks below 4)',
    <DungeonBoard ranks={padded} config={config} pool={pool} wallet={wallet} />,
  )

  render(
    'arena seasons',
    <ArenaBoards seasons={seasons} boards={boards} wallet={wallet} now={now} />,
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
        `<h2 class="preview-label">${p.label}</h2><div class="lboard">${p.html}</div>`,
    )
    .join('\n')
    .replace(/"\/assets\//g, '"assets/')
    .replace(/url\(&#x27;\/assets\//g, "url(&#x27;assets/")

  writeFileSync(
    'docs/__preview-leaderboard.html',
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Leaderboard states</title>
<link rel="stylesheet" href="assets/${css}">
<style>
  body { padding: 24px; background: var(--bg); font-family: var(--font-body); }
  .preview-label { color: var(--text-heading); font-family: var(--font-display);
    font-size: 15px; margin: 32px 0 10px; text-transform: uppercase; letter-spacing: .1em; }
</style>
</head><body>${body}</body></html>`,
  )
  console.error('\nwrote docs/__preview-leaderboard.html')
}

void main()
