/**
 * The map legend, against the real stylesheet.
 *
 *   npx vite build --ssr scripts/ssr-legend.tsx --outDir .ssr
 *   node .ssr/ssr-legend.js
 *
 * The map screen needs a connected wallet and live land data, so the legend
 * cannot be opened from the running app without one.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { Legend } from '../src/routes/MapView'

const css = ['tokens.css', 'global.css', 'app.css', 'map.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const html = `<!doctype html>
<meta charset="utf-8">
<title>Map legend</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 20px; background: #05101e; font-family: var(--font-body); color: var(--text); }
  .mapoverlay { position: relative; max-width: 260px; }
</style>
<div class="mapoverlay legendpop">${renderToStaticMarkup(<Legend />)}</div>
`

writeFileSync(new URL('../.ssr/legend.html', import.meta.url), html)
console.log('wrote .ssr/legend.html')
