/**
 * The wormhole as the app actually mounts it: `position: fixed`, inside a page
 * that scrolls.
 *
 *   npx vite build --ssr scripts/ssr-gate-fixed.tsx --outDir .ssr
 *   node .ssr/ssr-gate-fixed.js
 *
 * `ssr-gate.tsx` pins the overlay into a box so two can be compared, which
 * means it never exercises the one property the app depends on. This one does
 * not override anything: if the overlay fails to cover the viewport, or grows
 * the document and shoves the page, it happens here too.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { PortalWarp, WARP_TOTAL_MS } from '../src/map/PortalWarp'
import type { Planet } from '../src/chain/config'

const css = ['tokens.css', 'global.css', 'app.css', 'map.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const html = `<!doctype html>
<meta charset="utf-8">
<title>Wormhole, fixed</title>
<style>${css}</style>
<style>
  body { margin: 0; background: #05101e; font-family: var(--font-body); color: var(--text); }
  /* Something tall underneath, so a broken overlay shows up as the page
     growing or jumping rather than as nothing at all. */
  .filler { height: 2400px; padding: 20px;
            background: repeating-linear-gradient(45deg, #0b1526, #0b1526 18px, #0e1a2e 18px, #0e1a2e 36px); }
  .readout { position: fixed; left: 10px; bottom: 10px; z-index: 99; font: 12px/1.5 monospace;
             background: #0008; padding: 8px 10px; border-radius: 6px; white-space: pre; }
</style>

<div class="filler">page content underneath</div>
<div id="host"></div>
<div class="readout" id="out">click to mount</div>

<script>
  const MARKUP = ${JSON.stringify(
    renderToStaticMarkup(<PortalWarp to={'kavian' as Planet} />),
  )};
  const TOTAL = ${WARP_TOTAL_MS};
  const host = document.getElementById('host');
  const out = document.getElementById('out');

  function report(label) {
    const g = host.querySelector('.warpgate');
    const cs = g ? getComputedStyle(g) : null;
    const r = g ? g.getBoundingClientRect() : null;
    out.textContent = [
      label,
      'scrollY        ' + Math.round(window.scrollY),
      'docHeight      ' + document.documentElement.scrollHeight,
      g ? 'position       ' + cs.position : 'no overlay',
      g ? 'rect           ' + Math.round(r.width) + ' x ' + Math.round(r.height) +
          ' @ ' + Math.round(r.left) + ',' + Math.round(r.top) : '',
      g ? 'opacity        ' + cs.opacity : '',
      g ? 'coversViewport ' + (r.width >= innerWidth - 1 && r.height >= innerHeight - 1 &&
                               Math.abs(r.left) < 2 && Math.abs(r.top) < 2) : '',
      g ? 'animations     ' + g.getAnimations({ subtree: true }).length : '',
    ].filter(Boolean).join('\\n');
  }

  window.mountGate = function () {
    const before = { scrollY: window.scrollY, h: document.documentElement.scrollHeight };
    host.innerHTML = MARKUP;
    requestAnimationFrame(() => {
      const after = { scrollY: window.scrollY, h: document.documentElement.scrollHeight };
      window.__delta = {
        scrollMoved: after.scrollY - before.scrollY,
        docGrew: after.h - before.h,
      };
      report('mounted');
    });
    setTimeout(() => { host.innerHTML = ''; report('cleared'); }, TOTAL);
  };

  document.addEventListener('click', window.mountGate);
  report('idle');
</script>
`

writeFileSync(new URL('../.ssr/gate-fixed.html', import.meta.url), html)
console.log('wrote .ssr/gate-fixed.html')
