/**
 * The map's planet strip, open and collapsed, against the real stylesheet.
 *
 *   npx vite build --ssr scripts/ssr-planetbar.tsx --outDir .ssr
 *   node .ssr/ssr-planetbar.js
 *
 * The map screen itself needs a connected wallet and live land data, so the
 * strip cannot be looked at from the running app without one. This renders the
 * real `PlanetCard` against staged summaries, in both states, so the width the
 * bar costs the map is visible.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { PlanetCard } from '../src/routes/MapView'
import type { PlanetStatus } from '../src/map/planetStatus'
import type { Planet } from '../src/chain/config'

const css = ['tokens.css', 'global.css', 'app.css', 'map.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const at = (
  planet: string,
  taverns: number,
  dungeonsOpen: number,
  arenasOpen: number,
): PlanetStatus => ({
  planet: planet as Planet,
  taverns,
  dungeonsOpen,
  dungeonsTotal: dungeonsOpen,
  arenasOpen,
  arenasTotal: arenasOpen,
  loaded: true,
})

/* The six planets, with the counts from the screenshot. */
const summaries = [
  at('magor', 1, 22, 8),
  at('naron', 3, 0, 6),
  at('neri', 0, 6, 4),
  at('eyeke', 4, 7, 5),
  at('veles', 1, 2, 4),
  at('kavian', 1, 7, 6),
]

const viewing = 'kavian'
const noop = () => {}

const strip = (open: boolean) =>
  renderToStaticMarkup(
    <div className="planetbar" style={{ position: 'relative', left: 0, top: 0, right: 'auto' }}>
      <div className="planetpick" role="group" aria-label="Planet">
        {(open ? summaries : summaries.filter((s) => s.planet === viewing)).map((status) => (
          <PlanetCard
            key={status.planet}
            status={status}
            isCurrent={status.planet === 'magor'}
            isViewing={status.planet === viewing}
            onSelect={noop}
          />
        ))}
        <button
          type="button"
          className="planetpick__toggle"
          aria-expanded={open}
          onClick={noop}
          title={open ? 'Collapse the planet bar' : 'Show every planet'}
          aria-label={open ? 'Collapse the planet bar' : 'Show every planet'}
        >
          <img src="/assets/icons/arrow-right.svg" alt="" width={14} height={14} />
        </button>
      </div>
    </div>,
  )

const html = `<!doctype html>
<meta charset="utf-8">
<title>Planet bar</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 20px; background: #05101e; font-family: var(--font-body); color: var(--text); }
  h2 { font: 12px/1 var(--font-body); color: #7d879e; text-transform: uppercase; letter-spacing: .08em; margin: 18px 0 8px; }
  /* A stand-in for the map underneath, so the width the bar covers is visible. */
  .board { position: relative; height: 120px; border: 1px dashed #26314a; border-radius: 6px;
           background: repeating-linear-gradient(45deg, #0b1526, #0b1526 12px, #0e1a2e 12px, #0e1a2e 24px); }
  .board > .planetbar { position: absolute !important; left: 10px !important; top: 10px !important; }
</style>
<h2>Open</h2>
<div class="board">${strip(true)}</div>
<h2>Collapsed — the planet you are viewing, and its counts</h2>
<div class="board">${strip(false)}</div>
`

writeFileSync(new URL('../.ssr/planetbar.html', import.meta.url), html)
console.log('wrote .ssr/planetbar.html')
