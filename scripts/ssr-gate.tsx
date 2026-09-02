/**
 * The portal wormhole, against the real stylesheet.
 *
 *   npx vite build --ssr scripts/ssr-gate.tsx --outDir .ssr
 *   node .ssr/ssr-gate.js
 *
 * Watching this in the app means owning a portal tile, spending the energy and
 * signing a transaction — a long way to go to look at a transition, and it
 * cannot be replayed or paused. This drives the real component, with a
 * scrubber, so any moment of the run can be held and inspected.
 *
 * There is one timeline now. The overlay used to run in three phases with a
 * class swap between them, and the seam that swap produced is what this
 * harness exists to prove is gone: `Replay` re-mounts the markup exactly as
 * the app does, and nothing is re-triggered for the rest of the run.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { PortalWarp, WARP_TOTAL_MS } from '../src/map/PortalWarp'
import type { Planet } from '../src/chain/config'

const css = ['tokens.css', 'global.css', 'app.css', 'map.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const gate = (lowFx?: boolean) =>
  renderToStaticMarkup(<PortalWarp to={'kavian' as Planet} lowFx={lowFx} />)

const html = `<!doctype html>
<meta charset="utf-8">
<title>Portal wormhole</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 20px; background: #05101e; font-family: var(--font-body); color: var(--text);
         display: grid; grid-template-columns: 2fr 1fr; gap: 16px; align-items: start; }
  h2 { font: 12px/1 var(--font-body); color: #7d879e; text-transform: uppercase; letter-spacing: .08em; margin: 0 0 8px; }
  /* The overlay is position:fixed in the app; pinned to a box here so two can
     sit on one page instead of stacking on top of each other. */
  .stage { position: relative; height: 460px; overflow: hidden; border: 1px dashed #26314a;
           border-radius: 8px;
           background: repeating-linear-gradient(45deg, #0b1526, #0b1526 14px, #0e1a2e 14px, #0e1a2e 28px); }
  .stage .warpgate { position: absolute; }
  .bar { grid-column: 1 / -1; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  button { font: inherit; padding: 6px 12px; border-radius: 6px; border: 1px solid #26314a;
           background: #131c33; color: #e8ecf7; cursor: pointer; }
  input[type=range] { width: 320px; }
</style>

<div class="bar">
  <button id="replay">Replay</button>
  <label>scrub <input type="range" id="scrub" min="0" max="${WARP_TOTAL_MS}" value="0" step="20"></label>
  <span id="clock" class="faint"></span>
</div>

<section>
  <h2>full effects</h2>
  <div class="stage" id="a">${gate()}</div>
</section>

<section>
  <h2>reduced effects</h2>
  <div class="stage" id="b">${gate(true)}</div>
</section>

<script>
  const TOTAL = ${WARP_TOTAL_MS};
  const stages = [document.getElementById('a'), document.getElementById('b')];
  const templates = stages.map(function (s) { return s.innerHTML; });
  const clock = document.getElementById('clock');
  const scrub = document.getElementById('scrub');
  var live = false;

  function all() {
    var out = [];
    stages.forEach(function (s) {
      var g = s.querySelector('.warpgate');
      if (g) out = out.concat(g.getAnimations({ subtree: true }));
    });
    return out;
  }

  function replay() {
    stages.forEach(function (s, i) { s.innerHTML = templates[i]; });
    live = true;
    var t0 = performance.now();
    function tick() {
      if (!live) return;
      var t = performance.now() - t0;
      clock.textContent = (t / 1000).toFixed(2) + 's / ' + (TOTAL / 1000).toFixed(2) + 's';
      scrub.value = Math.min(TOTAL, Math.round(t));
      if (t < TOTAL) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  document.getElementById('replay').addEventListener('click', replay);
  scrub.addEventListener('input', function () {
    live = false;
    var t = Number(scrub.value);
    clock.textContent = (t / 1000).toFixed(2) + 's / ' + (TOTAL / 1000).toFixed(2) + 's';
    all().forEach(function (a) { try { a.currentTime = t; a.pause(); } catch (e) {} });
  });

  replay();
</script>
`

writeFileSync(new URL('../.ssr/gate.html', import.meta.url), html)
console.log('wrote .ssr/gate.html')
