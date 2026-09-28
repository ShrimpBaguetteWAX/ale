/**
 * The Candle screen as a full page, against the real stylesheets.
 *
 *   npx vite build --ssr scripts/ssr-candle-page.tsx --outDir .ssr
 *   node .ssr/ssr-candle-page.js
 *
 * The live mission is often absent or in a phase that hides half the screen,
 * so this drives the real components with a mission mid-flight: open, the
 * player qualified and already in, with winnings waiting to be claimed.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { Mission, UpNext, Winnings } from '../src/routes/Candle'
import type { CandleOffer } from '../src/candle/types'
import type { Player } from '../src/chain/types'

const css = ['tokens.css', 'global.css', 'app.css', 'candle.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const NOW = Date.now()
const iso = (ms: number) => new Date(NOW + ms).toISOString().slice(0, 19)

const offer: CandleOffer = {
  offer_id: 'aaa3emtd3a',
  offer_start: iso(-6 * 3_600_000),
  offer_end: iso(9 * 3_600_000),
  requirements: 'Energy saved in Taverns',
  requirement_type: 'tavern_energy_saved',
  requirement_amount: 5_000,
  total_gems: 18_400,
  reward_type: 'tlm',
  reward_amount: 124_500_000,
}

const player = {
  wallet: 'previewer.wam',
  playertag: 'Previewer',
  activestats: { gems: 4_200, credits: 0, action_points: 0 },
  /* Enough taverns to clear that gate, not enough portals to clear the
     other — so the page shows a mission this player is in, one they are
     short of, and both sides of the "coming up" readout. */
  permstats: [
    { first: 'tavern_energy_saved', second: 7_400 },
    { first: 'portals_used', second: 12 },
  ],
} as unknown as Player

const claim = { wallet: 'previewer.wam', gems: 0, total_gems: 0, tlm: 92_400, wax: 6_500, expiry_date: iso(5 * 86_400_000) }

/*
   The panel with its lid up.

   `Mission` keeps its own folded flag and starts shut, which a static
   render has no way to click — so the expanded half of the screen, the
   whole of the contributing, was not in this preview at all. Whether it is
   folded is nothing but a class, so the harness takes it off: the markup is
   identical to what the component draws once a player opens one.
*/
const opened = renderToStaticMarkup(
  <Mission
    offer={offer}
    player={player}
    mine={900}
    contributors={37}
    now={NOW}
    balance={4_200}
    gems={''}
    amount={0}
    busy={null}
    canAct
    onGems={() => {}}
    onContribute={() => {}}
  />,
).replace('class="mach mach--shut"', 'class="mach"')

const body = renderToStaticMarkup(
  <div className="candle">
    <header className="candle__head">
      <div>
        <h1 className="candle__title">Candle</h1>
        <p className="candle__lede">
          Missions that turn gems into Trilium, Shards or WAX. Everyone who
          qualifies puts gems in, and the reward is split by how much each of
          them put up.
        </p>
      </div>
      <Winnings claim={claim} busy={null} canAct onClaim={() => {}} />
    </header>
    <div className="candle__cols">
      <div>
        <Mission
          offer={offer}
          player={player}
          mine={900}
          contributors={37}
          now={NOW}
          balance={4_200}
          gems={''}
          amount={0}
          busy={null}
          canAct
          onGems={() => {}}
          onContribute={() => {}}
        />
        {/*
          One the player cannot enter.

          A mission whose gate is unmet renders a line the qualified one
          never shows, and it is the state a live screen is least likely to
          be in when somebody looks — `permstats` carries no `portals_used`
          row for this player, so the gate reads 40 short of 40.
        */}
        <Mission
          offer={{
            ...offer,
            offer_id: 'ddd',
            requirements: 'Portals used',
            requirement_type: 'portals_used',
            requirement_amount: 40,
            total_gems: 6_200,
            reward_type: 'shards',
            reward_amount: 880,
          }}
          player={player}
          mine={0}
          contributors={12}
          now={NOW}
          balance={4_200}
          gems={''}
          amount={0}
          busy={null}
          canAct
          onGems={() => {}}
          onContribute={() => {}}
        />
        {/* Swapped for the unfolded panel below; see `opened`. */}
        <div id="opened-slot" />
        <UpNext
          offers={[
            {
              ...offer,
              offer_id: 'bbb',
              offer_start: iso(11 * 3_600_000),
              offer_end: iso(26 * 3_600_000),
              requirements: 'Portals used',
              requirement_type: 'portals_used',
              requirement_amount: 40,
              reward_type: 'wax',
              reward_amount: 90_000_000_000,
            },
            {
              ...offer,
              offer_id: 'ccc',
              offer_start: iso(30 * 3_600_000),
              offer_end: iso(45 * 3_600_000),
              /* One the player is already through, for the cleared mark. */
              requirements: 'Energy saved in Taverns',
              requirement_type: 'tavern_energy_saved',
              requirement_amount: 5_000,
              reward_type: 'shards',
              reward_amount: 87_452,
            },
          ]}
          player={player}
          now={NOW}
        />
      </div>
    </div>
  </div>,
).replace('<div id="opened-slot"></div>', opened)

const html = `<!doctype html>
<meta charset="utf-8">
<title>Candle</title>
<style>${css}</style>
<style>
  body { margin: 0; background: #05101e; font-family: var(--font-body); color: var(--text); }
  .main__inner { max-width: 1100px; margin: 0 auto; padding: 24px; }
</style>
<div class="main__inner">${body}</div>
`

writeFileSync(new URL('../.ssr/candle.html', import.meta.url), html)
console.log('wrote .ssr/candle.html')
