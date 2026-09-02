/**
 * One stat's leaderboard, against the real stylesheets and the real table.
 *
 *   npx vite build --ssr scripts/ssr-statboard.tsx --outDir .ssr
 *   node .ssr/ssr-statboard.js
 *
 * The sheet fetches on mount, so server-rendering the whole dialog would only
 * ever show its loading line. This reads the players table here instead and
 * renders the real row component from the real ranking, which is the part
 * worth looking at: the medals, the tie handling, and the pinned "you" row.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { StatBoardRow } from '../src/routes/Profile'
import { rankBy, type PlayerStats } from '../src/account/statboard'

const css = ['tokens.css', 'global.css', 'app.css', 'account.css', 'leaderboard.css']
  .map((f) => {
    try {
      return readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8')
    } catch {
      return ''
    }
  })
  .join('\n')

/** Whoever is somewhere down the board, so the pinned row can be shown. */
const ME = '5thba.wam'

/*
   A token stat by default, because that is where the display scaling shows:
   the chain counts TLM in ten-thousandths, so the raw figures are four
   digits longer than the ones a player would recognise.
*/
const KEY = process.argv[2] || 'tlm_earned'
const LABEL = KEY.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const ICON = KEY.startsWith('tlm')
  ? '/assets/icons/tlm.svg'
  : KEY.startsWith('shards')
    ? '/assets/icons/shards.svg'
    : '/assets/icons/dungeons.svg'

/* No top-level await at this build target, so the whole thing runs in main(). */
async function main() {
  const res = await fetch('https://wax.greymass.com/v1/chain/get_table_rows', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({
      json: true,
      code: 'players.ale',
      scope: 'players.ale',
      table: 'players',
      limit: 1000,
    }),
  })
  const body = (await res.json()) as {
    rows: { wallet: string; playertag?: string; permstats?: { first: string; second: number }[] }[]
  }

  const players: PlayerStats[] = body.rows.map((r) => ({
    wallet: String(r.wallet),
    playertag: String(r.playertag ?? ''),
    stats: Object.fromEntries((r.permstats ?? []).map((e) => [e.first, e.second])),
  }))

  const TOP = 12
  const ranks = rankBy(players, KEY)
  const mine = ranks.find((r) => r.wallet === ME)
  const pinned = mine && mine.rank > TOP ? mine : undefined

  const board = renderToStaticMarkup(
    <div className="sheet" style={{ position: 'relative', background: 'none' }}>
      <div className="sheet__panel">
        <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
          <span className="panel__title statboard__title">
            <img className="statline__icon" src={ICON} alt="" />
            {LABEL}
          </span>
        </div>
        {ranks.slice(0, TOP).map((r) => (
          <StatBoardRow key={r.wallet} row={r} statKey={KEY} you={r.wallet === ME} />
        ))}
        {pinned && (
          <>
            <div className="statboard__gap">
              <span>{pinned.rank - TOP - 1} more</span>
            </div>
            <StatBoardRow row={pinned} statKey={KEY} you />
          </>
        )}
        <p className="hint" style={{ marginTop: 'var(--sp-3)' }}>
          {ranks.length} players have recorded this.
        </p>
      </div>
    </div>,
  )

  const html = `<!doctype html>
  <meta charset="utf-8">
  <title>Stat leaderboard</title>
  <style>${css}</style>
  <style>
    body { margin: 0; padding: 20px; background: #05101e; font-family: var(--font-body); color: var(--text); }
    .sheet { max-width: 520px; }
    .sheet__panel { border-radius: var(--radius-md); }
  </style>
  ${board}
  `

  writeFileSync(new URL('../.ssr/statboard.html', import.meta.url), html)
  console.log(`wrote .ssr/statboard.html — ${ranks.length} ranked, you are ${mine?.rank ?? 'unranked'}`)

}

void main()
