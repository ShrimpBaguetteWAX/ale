/**
 * Renders the My Lands screen against live chain and AtomicAssets rows, and
 * writes a preview page so it can be looked at without a wallet.
 *
 *   npx vite build --ssr scripts/ssr-lands.tsx --outDir .ssr
 *   node .ssr/ssr-lands.js <wallet>
 *
 * The outDir has to sit inside the project or node cannot resolve `react`.
 * Effects never run under static rendering, so the route itself only shows its
 * first paint and the two panes are rendered directly with real rows.
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import Lands, { LandPanel, LandRow } from '../src/routes/Lands'
import { useGame } from '../src/state/useGame'
import type { Building, Land, LandsConfig, Player } from '../src/chain/types'
import type { Planet } from '../src/chain/config'
import type { BuildingCost, OwnedLand } from '../src/lands/types'

const NODE = 'https://wax.greymass.com/v1/chain/get_table_rows'
const ATOMIC = 'https://atomicassets-api.alienworlds.io'

/**
 * Make the store readable by hooks during static rendering — zustand takes its
 * server snapshot from the object the store was created with, which `setState`
 * replaces rather than mutates.
 */
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
  const wallet = process.argv[2] ?? '5thba.wam'

  const assetsRes = await fetch(
    `${ATOMIC}/atomicassets/v1/assets?collection_name=alien.worlds` +
      `&schema_name=land.worlds&owner=${wallet}&limit=1000`,
  )
  const assets = (await assetsRes.json()) as {
    data: { asset_id: string; name: string; data: Record<string, unknown> }[]
  }

  const [players, config, ...costRows] = await Promise.all([
    rows<Player>({
      code: 'players.ale',
      scope: 'players.ale',
      table: 'players',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
    rows<LandsConfig>({ code: 'lands.ale', scope: 'lands.ale', table: 'config' }),
    ...['tavern', 'dungeon', 'arena'].map((b) =>
      rows<BuildingCost>({ code: 'lands.ale', scope: b, table: 'buildingcost' }),
    ),
  ])

  const discountRows = await rows<{ rarity: string; credits_building_discount: number }>(
    { code: 'lands.ale', scope: 'lands.ale', table: 'raritydisc' },
  )

  const player = players[0]
  if (!player) {
    console.error(`no player row for ${wallet}`)
    return
  }

  const costs = new Map<string, BuildingCost[]>([
    ['tavern', costRows[0]],
    ['dungeon', costRows[1]],
    ['arena', costRows[2]],
  ])
  const discounts = new Map(
    discountRows.map((r) => [r.rarity, r.credits_building_discount]),
  )

  const planets = [
    ...new Set(
      assets.data.map((a) => a.name.split(' on ')[1]?.toLowerCase()).filter(Boolean),
    ),
  ] as Planet[]

  const byPlanet = new Map<string, Map<string, Land>>()
  for (const p of planets) {
    const ls = await rows<Land>({ code: 'lands.ale', scope: p, table: 'lands' })
    byPlanet.set(p, new Map(ls.map((l) => [`${l.x}:${l.y}`, l])))
  }

  const lands: OwnedLand[] = assets.data.map((a) => {
    const planet = (a.name.split(' on ')[1] ?? '').toLowerCase() as Planet
    const x = Number(a.data.x ?? 0)
    const y = Number(a.data.y ?? 0)
    const row = byPlanet.get(planet)?.get(`${x}:${y}`)
    return {
      asset_id: a.asset_id,
      name: a.name,
      planet,
      x,
      y,
      rarity: String(a.data.rarity ?? '').toLowerCase(),
      land: row,
      buildings: row?.buildings ?? [],
    }
  })

  const now = Date.now()
  const cfg = config[0]
  console.log(
    `# ${wallet}: ${lands.length} lands, ` +
      `${lands.filter((l) => l.buildings.length).length} built`,
  )

  const pages: { label: string; html: string }[] = []
  const render = (label: string, node: JSX.Element) => {
    const html = renderToStaticMarkup(node)
    console.log(`\n## ${label}\n${html.replace(/></g, '>\n<')}`)
    pages.push({ label, html })
  }

  primeStore({ account: wallet, playerLoaded: true, player })
  render('screen chrome (first paint)', <Lands />)

  const listColumn = (
    <>
      <div className="landlist__head">
        <span>Land</span>
        <span>Income since last claim</span>
        <span>Buildings</span>
        <span />
      </div>
      <div className="landlist">
        {lands.map((land, i) => (
          <LandRow
            key={land.asset_id}
            land={land}
            config={cfg}
            now={now}
            selected={i === 0}
            busy={null}
            canAct
            onSelect={() => {}}
            onClaim={() => {}}
          />
        ))}
      </div>
    </>
  )

  /*
   * The side column as the screen actually assembles it: the running totals
   * stacked above the selected land's panel. The route only renders this once
   * its data has loaded, which effects never do here, so it is built directly.
   */
  const totals = lands.reduce(
    (acc, l) => {
      for (const b of l.buildings) {
        acc.tlm += Number(b.tlm ?? 0)
        acc.credits += Number(b.credits ?? 0)
        acc.gems += Number(b.gems ?? 0)
        acc.shards += Number(b.shards ?? 0)
      }
      return acc
    },
    { tlm: 0, credits: 0, gems: 0, shards: 0 },
  )

  const dec = (v: number, places: number) =>
    v.toLocaleString('en-US', {
      minimumFractionDigits: places,
      maximumFractionDigits: places,
    })

  const sideColumn = (land: OwnedLand) => (
    <div className="lands__side">
      <div className="lands__totals">
        <div className="tally">
          <img src="/assets/icons/tlm.svg" alt="" width={20} height={20} />
          <strong>{dec(totals.tlm / 10_000, 1)}</strong>
          <span>TLM</span>
        </div>
        {totals.shards > 0 && (
          <div className="tally">
            <img src="/assets/icons/shards.svg" alt="" width={20} height={20} />
            <strong>{dec(totals.shards / 10, 1)}</strong>
            <span>Shards · not paid on claim</span>
          </div>
        )}
      </div>
      <aside className="landside">
        <LandPanel
          land={land}
          costs={costs}
          discounts={discounts}
          config={cfg}
          now={now}
          busy={null}
          credits={player.activestats.credits}
          gems={player.activestats.gems}
          canAct
          onBuild={() => {}}
          onBoost={() => {}}
          onDestroy={() => {}}
        />
      </aside>
    </div>
  )

  const panel = (land: OwnedLand, label: string) =>
    render(
      label,
      <aside className="landside">
        <LandPanel
          land={land}
          costs={costs}
          discounts={discounts}
          config={cfg}
          now={now}
          busy={null}
          credits={player.activestats.credits}
          gems={player.activestats.gems}
          canAct
          onBuild={() => {}}
          onBoost={() => {}}
          onDestroy={() => {}}
        />
      </aside>,
    )

  /*
   * The whole two-column layout, which is the only way to see whether the side
   * column and the first land row start on the same line.
   */
  const firstBuilt = lands.find((l) => l.buildings.length > 0)
  if (firstBuilt) {
    render(
      'both columns — alignment check',
      <div className="lands__cols">
        {listColumn}
        {sideColumn(firstBuilt)}
      </div>,
    )
  }

  const built = lands.find((l) => l.buildings.length > 0)
  if (built) panel(built, `built land — ${built.buildings[0].building_name}`)

  const empty = lands.find((l) => l.buildings.length === 0)
  if (empty) panel(empty, 'empty plot — build menu')

  /*
   * A land nobody in this wallet happens to own: an empty plot on a legendary
   * deed, where the rarity discount takes 69,999 credits down to 9,999. The
   * discount is asserted on by the contract, so it is worth seeing rendered.
   */
  if (empty) {
    panel(
      { ...empty, rarity: 'legendary', name: 'Legendary Plot (synthetic)' },
      'empty plot on legendary land (synthetic) — discounted price',
    )
  }

  /* A nearly-dead boost, which is the state the whole screen exists for. */
  if (built) {
    const b = built.buildings[0] as Building
    panel(
      {
        ...built,
        name: 'Neglected Land (synthetic)',
        buildings: [{ ...b, boost_score: 4_000 }],
      },
      'boost almost gone (synthetic)',
    )
  }

  writeGallery(pages)
}

function writeGallery(pages: { label: string; html: string }[]) {
  const css = readdirSync('docs/assets').find((f) => f.endsWith('.css'))
  if (!css) {
    console.error('\n(no built stylesheet in docs/assets — run npm run build first)')
    return
  }

  const body = pages
    .map((p) => `<h2 class="preview-label">${p.label}</h2><div class="lands">${p.html}</div>`)
    .join('\n')
    .replace(/"\/assets\//g, '"assets/')
    .replace(/url\(&#x27;\/assets\//g, "url(&#x27;assets/")

  writeFileSync(
    'docs/__preview-lands.html',
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>My Lands states</title>
<link rel="stylesheet" href="assets/${css}">
<style>
  body { padding: 24px; background: var(--bg); font-family: var(--font-body); }
  .preview-label { color: var(--text-heading); font-family: var(--font-display);
    font-size: 15px; margin: 32px 0 10px; text-transform: uppercase; letter-spacing: .1em; }
  .lands .lands__cols > .lands__side, .lands aside.landside { max-width: 420px; }
</style>
</head><body>${body}</body></html>`,
  )
  console.error('\nwrote docs/__preview-lands.html')
}

void main()
