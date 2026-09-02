/**
 * The farming pool cards' power bar, at the narrowest width the grid produces.
 *
 *   npx vite build --ssr scripts/ssr-powerbar.tsx --outDir .ssr
 *   node .ssr/ssr-powerbar.js
 *
 * The full Farming screen needs a wallet with a player row to render, which
 * makes it a poor place to check a label's width. The bar on its own does not,
 * and the width is the only thing at risk when the reading grows three
 * characters.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'

const css = ['tokens.css', 'global.css', 'app.css', 'farming.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

/* The readings that matter: a pool that has barely started, one mid-way, and
   one at the cap — plus the widest string the format can produce. */
const readings = [0, 0.04, 12.5, 66.6666, 99.995, 100]

const body = renderToStaticMarkup(
  <div className="poolgrid">
    {readings.map((percent) => (
      <article className="poolcard" key={percent}>
        <h3 className="panel__title">Land</h3>
        <div className="powerbar">
          <span
            className={`powerbar__fill${percent >= 100 ? ' powerbar__fill--max' : ''}`}
            style={{ width: `${percent}%` }}
          />
          <span className="powerbar__text">{percent.toFixed(2)}% of the cap</span>
        </div>
      </article>
    ))}
  </div>,
)

const html = `<!doctype html>
<meta charset="utf-8">
<title>Power bar</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 20px; background: #05101e; font-family: var(--font-body); color: var(--text); }
</style>
${body}
`

writeFileSync(new URL('../.ssr/powerbar.html', import.meta.url), html)
console.log('wrote .ssr/powerbar.html')
