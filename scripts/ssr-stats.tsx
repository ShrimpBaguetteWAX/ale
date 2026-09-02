/**
 * The account's Stats tab, against the real stylesheets.
 *
 *   npx vite build --ssr scripts/ssr-stats.tsx --outDir .ssr
 *   node .ssr/ssr-stats.js
 *
 * Driven by the twenty-eight `permstats` keys a real player actually carries,
 * read off `players.ale`, so the icon matching is exercised against the live
 * vocabulary rather than a list I made up — including the keys that
 * deliberately get no icon.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { StatsTab, statIconFor } from '../src/routes/Profile'
import type { Player } from '../src/chain/types'

const css = ['tokens.css', 'global.css', 'app.css', 'account.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

/* Exactly what 5thba.wam has on chain. */
const PERMSTATS: [string, number][] = [
  ['arenas_constructed', 1],
  ['arenas_played', 8],
  ['arenas_won', 2],
  ['buildings_constructed', 15],
  ['credits_gained', 6000000],
  ['damage_blocked', 3962],
  ['damage_blocked_by_enemy', 5290],
  ['damage_dealt', 11681],
  ['damage_taken', 9026],
  ['dungeons_constructed', 5],
  ['dungeons_played', 24],
  ['dungeons_won', 19],
  ['energy_gained', 13600],
  ['energy_saved_recruiting', 1348],
  ['gems_gained', 280400],
  ['knockouts', 116],
  ['level_ups', 27],
  ['nfts_staked', 3],
  ['portals_used', 63],
  ['premium_account_months', 1],
  ['quests_completed', 14],
  ['quests_rerolled', 21],
  ['recruits', 53],
  ['shards_earned', 272157],
  ['taverns_constructed', 9],
  ['tlm_earned', 1926008],
  ['total_dungeon_difficulty', 58],
  ['total_travel_distance', 1470],
]

const player = {
  wallet: '5thba.wam',
  permstats: PERMSTATS.map(([first, second]) => ({ first, second })),
} as unknown as Player

/* Coverage over the live vocabulary, printed when the harness runs. */
const missing = PERMSTATS.map(([k]) => k).filter((k) => !statIconFor(k))
console.log(
  `icons: ${PERMSTATS.length - missing.length}/${PERMSTATS.length} keys matched`,
)
if (missing.length) console.log('  no icon:', missing.join(', '))

const body = renderToStaticMarkup(
  <div className="main__inner">
    <StatsTab player={player} onDisconnect={() => {}} />
  </div>,
)

const html = `<!doctype html>
<meta charset="utf-8">
<title>Account stats</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 20px; background: #05101e; font-family: var(--font-body); color: var(--text); }
  .main__inner { max-width: 620px; }
</style>
${body}
`

writeFileSync(new URL('../.ssr/stats.html', import.meta.url), html)
console.log('wrote .ssr/stats.html')
