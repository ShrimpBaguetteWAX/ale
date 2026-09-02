/**
 * Renders the Candle screen against live chain rows and writes a preview page,
 * so it can be looked at without a wallet.
 *
 *   npx vite build --ssr scripts/ssr-candle.tsx --outDir .ssr
 *   node .ssr/ssr-candle.js <wallet>
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import Candle, { Mission, Winnings } from '../src/routes/Candle'
import { useGame } from '../src/state/useGame'
import { activeOffer } from '../src/candle/rules'
import type { CandleClaim, CandleOffer, Contribution } from '../src/candle/types'
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

  const [players, offers, claims] = await Promise.all([
    rows<Player>({
      code: 'players.ale',
      scope: 'players.ale',
      table: 'players',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
    rows<CandleOffer>({ code: 'recovery.ale', scope: 'recovery.ale', table: 'offers' }),
    rows<CandleClaim>({
      code: 'recovery.ale',
      scope: 'recovery.ale',
      table: 'claims',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
  ])

  const player = players[0]
  if (!player) {
    console.error(`no player row for ${wallet}`)
    return
  }

  const now = Date.now()
  const offer = activeOffer(offers, now)
  const contributions = offer
    ? await rows<Contribution>({
        code: 'recovery.ale',
        scope: offer.offer_id,
        table: 'contribution',
      })
    : []

  const mine = Number(contributions.find((c) => c.wallet === wallet)?.amount ?? 0)
  const claim = claims[0]

  console.log(
    `# ${wallet}: offer ${offer?.offer_id ?? 'none'}, ` +
      `${contributions.length} contributors, ${offer?.total_gems ?? 0} gems in`,
  )

  const pages: { label: string; html: string }[] = []
  const render = (label: string, node: JSX.Element) => {
    const html = renderToStaticMarkup(node)
    console.log(`\n## ${label}\n${html.replace(/></g, '>\n<')}`)
    pages.push({ label, html })
  }

  primeStore({ account: wallet, playerLoaded: true, player })
  render('screen chrome (first paint)', <Candle />)

  const mission = (
    o: CandleOffer,
    p: Player,
    stake: number,
    typed: string,
    label: string,
  ) =>
    render(
      label,
      <div className="candle__cols">
        <Mission
          offer={o}
          player={p}
          mine={stake}
          contributors={contributions.length}
          now={now}
          balance={p.activestats.gems}
          gems={typed}
          amount={Math.max(0, Math.floor(Number(typed) || 0))}
          busy={null}
          canAct
          onGems={() => {}}
          onContribute={() => {}}
        />
        <aside className="candle__side">
          <Winnings claim={claim} busy={null} canAct onClaim={() => {}} />
        </aside>
      </div>,
    )

  if (offer) {
    mission(offer, player, mine, '', 'live mission')

    /*
     * The dilution projection only appears once an amount is typed, and the
     * gate only reads "qualified" for a player who meets the requirement —
     * neither is reachable from a single live render, so both are staged.
     */
    const qualified: Player = {
      ...player,
      permstats: [
        ...(player.permstats ?? []).filter((s) => s.first !== offer.requirement_type),
        { first: offer.requirement_type, second: offer.requirement_amount * 2 },
      ],
    }
    const withGems: CandleOffer = { ...offer, total_gems: 1_200 }

    mission(withGems, qualified, 300, '', 'qualified, already holding a stake')
    mission(withGems, qualified, 300, '200', 'contributing 200 more — the dilution shown')
    mission(offer, player, 0, '50', 'not qualified — contribution refused')
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
    .map(
      (p) =>
        `<h2 class="preview-label">${p.label}</h2><div class="candle">${p.html}</div>`,
    )
    .join('\n')
    .replace(/"\/assets\//g, '"assets/')
    .replace(/url\(&quot;\/assets\//g, 'url(&quot;assets/')

  writeFileSync(
    'docs/__preview-candle.html',
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Candle states</title>
<link rel="stylesheet" href="assets/${css}">
<style>
  body { padding: 24px; background: var(--bg); font-family: var(--font-body); }
  .preview-label { color: var(--text-heading); font-family: var(--font-display);
    font-size: 15px; margin: 32px 0 10px; text-transform: uppercase; letter-spacing: .1em; }
</style>
</head><body>${body}</body></html>`,
  )
  console.error('\nwrote docs/__preview-candle.html')
}

void main()
