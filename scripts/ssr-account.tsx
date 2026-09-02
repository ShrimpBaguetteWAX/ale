/**
 * Renders the Account screen's tabs against live chain rows and writes a
 * preview page.
 *
 *   npx vite build --ssr scripts/ssr-account.tsx --outDir .ssr
 *   node .ssr/ssr-account.js <wallet>
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Profile, {
  AvatarTab,
  CpuTab,
  CurrencyTab,
  ToolCard,
  MiningTab,
  StatsTab,
} from '../src/routes/Profile'
import { useGame } from '../src/state/useGame'
import { avatarBoard, logCapacity } from '../src/account/rules'
import { poolBoard } from '../src/pools/rules'
import type { PoolDescription, ShardPool, TlmPool } from '../src/pools/queries'
import { nameToUint64 } from '../src/dungeon/queries'
import type { CpuConfig, CpuUsage } from '../src/account/queries'
import type { RewardLogConfig, RewardLogEntry } from '../src/account/queries'
import type { Avatar, Player } from '../src/chain/types'

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
  const wallet = process.argv[2] ?? '5t14m.c.wam'

  const [players, avatars, cpuCfg, cpuUse] = await Promise.all([
    rows<Player>({
      code: 'players.ale',
      scope: 'players.ale',
      table: 'players',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
    rows<Avatar>({ code: 'players.ale', scope: 'players.ale', table: 'avatars' }),
    rows<CpuConfig>({ code: 'cpu.ale', scope: 'cpu.ale', table: 'config' }),
    rows<CpuUsage>({
      code: 'cpu.ale',
      scope: 'cpu.ale',
      table: 'cpuusage',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
  ])

  const player = players[0]
  if (!player) {
    console.error(`no player row for ${wallet}`)
    return
  }

  const board = avatarBoard(avatars, player)
  const counts = board.reduce<Record<string, number>>((acc, e) => {
    acc[e.state] = (acc[e.state] ?? 0) + 1
    return acc
  }, {})

  console.log(
    `# ${wallet}: ${avatars.length} avatars — ${JSON.stringify(counts)}; ` +
      `cpu ${cpuUse[0]?.uses ?? 0}/${cpuCfg[0]?.claims_per_week ?? 0}`,
  )

  const pages: { label: string; html: string }[] = []
  const render = (label: string, node: JSX.Element) => {
    const html = renderToStaticMarkup(node)
    console.log(`\n## ${label}\n${html.replace(/></g, '>\n<')}`)
    pages.push({ label, html })
  }

  primeStore({ account: wallet, playerLoaded: true, player })
  /* Profile calls useNavigate for the disconnect link, so it needs a router. */
  render(
    'screen chrome (first paint)',
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  )

  render(
    'avatar tab',
    <AvatarTab
      board={board.slice(0, 24)}
      player={player}
      busy={null}
      canAct
      onTag={() => {}}
      onSelect={() => {}}
      onUnlock={() => {}}
    />,
  )

  /* The tool grid loads from AtomicAssets in an effect, so only the share
     control and the loading grid render here. */
  render(
    'mining tab',
    <MiningTab
      account={wallet}
      player={player}
      busy={null}
      canAct
      onSave={() => {}}
      onShare={() => {}}
    />,
  )

  render('cpu tab', <CpuTab config={cpuCfg[0]} usage={cpuUse[0]} />)

  /*
   * A wallet that has burned the whole weekly allowance. Nobody on chain has,
   * and the exhausted bar is the only state the tab exists to warn about.
   */
  render(
    'cpu tab — allowance spent (synthetic)',
    <CpuTab
      config={cpuCfg[0]}
      usage={{
        wallet,
        uses: Number(cpuCfg[0]?.claims_per_week ?? 25),
        expiry_time: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 19),
      }}
    />,
  )

  /* Real tool cards, which the tab itself only loads in an effect. */
  const toolsRes = await fetch(
    'https://atomicassets-api.alienworlds.io/atomicassets/v1/assets' +
      '?collection_name=alien.worlds&schema_name=tool.worlds&owner=' +
      wallet +
      '&limit=6&order=desc&sort=asset_id',
  )
  const toolsJson = (await toolsRes.json()) as {
    data: { asset_id: string; name: string; template?: { template_id?: string } | null; data: Record<string, unknown> }[]
  }
  const tools = toolsJson.data.map((a) => ({
    asset_id: String(a.asset_id),
    name: String(a.name ?? ''),
    template_id: Number(a.template?.template_id ?? 0),
    rarity: String(a.data.rarity ?? ''),
    shine: String(a.data.shine ?? 'Stone'),
    type: String(a.data.type ?? ''),
    ease: Number(a.data.ease ?? 0),
    luck: Number(a.data.luck ?? 0),
    delay: Number(a.data.delay ?? 0),
    difficulty: Number(a.data.difficulty ?? 0),
  }))
  console.error('tools fetched:', tools.length)

  render(
    'tool cards',
    <div className="toolgrid">
      {tools.map((t, i) => (
        <ToolCard key={t.asset_id} tool={t} picked={i < 2} disabled={false} onClick={() => {}} />
      ))}
    </div>,
  )

  /* Per-currency ledgers and the capacity row that gates them. */
  const capRows = await rows<{
    wallet: string
    unlocked_datarows: { first: string; second: number }[]
    used_datarows: { first: string; second: number }[]
    last_interaction: string
  }>({
    code: 'rwrdlog.ale',
    scope: 'rwrdlog.ale',
    table: 'rwrdusers',
    lower_bound: wallet,
    upper_bound: wallet,
  })
  const tlmPools = await rows<TlmPool>({
    code: 'pools.ale',
    scope: 'pools.ale',
    table: 'tlmpools',
  })
  const shardPools = await rows<ShardPool>({
    code: 'pools.ale',
    scope: 'pools.ale',
    table: 'shardpools',
  })
  const poolNames = await rows<PoolDescription>({
    code: 'rwrdlog.ale',
    scope: 'rwrdlog.ale',
    table: 'pooldesc',
  })

  const logCfg = (
    await rows<RewardLogConfig>({ code: 'rwrdlog.ale', scope: 'rwrdlog.ale', table: 'config' })
  )[0]
  console.error('capacity:', JSON.stringify(capRows[0]?.unlocked_datarows))

  for (const cur of ['tlm', 'wax', 'shrds'] as const) {
    const type = nameToUint64(cur)
    const log = await rows<RewardLogEntry>({
      code: 'rwrdlog.ale',
      scope: wallet,
      table: 'rewards',
      index_position: 2,
      key_type: 'i128',
      lower_bound: (type << 64n).toString(),
      upper_bound: (((type + 1n) << 64n) - 1n).toString(),
      reverse: true,
      limit: 100,
    })
    console.error(cur, 'rows:', log.length)
    render(
      cur + ' tab',
      <CurrencyTab
        currency={cur}
        player={player}
        log={log}
        capacity={logCapacity(cur, capRows[0] as never, logCfg)}
        busy={null}
        canAct
        onClaim={() => {}}
        onUnlock={() => {}}
        board={poolBoard(cur, player, tlmPools, shardPools, poolNames)}
        trial={null}
        minedPool={null}
        onMine={() => {}}
      />,
    )
  }

  /*
   * Nobody on this chain has reached the 10,000 threshold, and the ready
   * state is the one the button exists for — so force one.
   */
  const ready = {
    ...player,
    reward_power: (player.reward_power ?? []).map((r) =>
      r.pool === 'tlmarena' ? { ...r, power: 24_500 } : r,
    ),
  }
  render(
    'tlm tab — a pool ready to mine (synthetic power)',
    <CurrencyTab
      currency="tlm"
      player={ready}
      log={[]}
      capacity={logCapacity('tlm', capRows[0] as never, logCfg)}
      busy={null}
      canAct
      onClaim={() => {}}
      onUnlock={() => {}}
      board={poolBoard('tlm', ready, tlmPools, shardPools, poolNames)}
      trial={0.1}
      minedPool={null}
      onMine={() => {}}
    />,
  )

  render('stats tab', <StatsTab player={player} onDisconnect={() => {}} />)

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
        `<h2 class="preview-label">${p.label}</h2><div class="account">${p.html}</div>`,
    )
    .join('\n')
    .replace(/"\/assets\//g, '"assets/')
    .replace(/url\(&#x27;\/assets\//g, "url(&#x27;assets/")

  writeFileSync(
    'docs/__preview-account.html',
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Account states</title>
<link rel="stylesheet" href="assets/${css}">
<style>
  body { padding: 24px; background: var(--bg); font-family: var(--font-body); }
  .preview-label { color: var(--text-heading); font-family: var(--font-display);
    font-size: 15px; margin: 32px 0 10px; text-transform: uppercase; letter-spacing: .1em; }
</style>
</head><body>${body}</body></html>`,
  )
  console.error('\nwrote docs/__preview-account.html')
}

void main()
