/**
 * A rig for the travel animation, against the real map styles.
 *
 * ```
 * npx vite build --ssr scripts/ssr-warp.tsx --outDir .ssr
 * node .ssr/ssr-warp.js
 * ```
 *
 * The marker only moves when a real wallet travels a real map, which is a
 * long way to go to look at a 400ms animation. This drives the same pin
 * markup, the same stylesheet and the same easing on a loop, so the flight
 * and the arrival can be watched — and stepped through frame by frame.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const css = ['tokens.css', 'map.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const html = `<!doctype html>
<meta charset="utf-8">
<title>Travel</title>
<style>${css}</style>
<style>
  body { margin: 0; background: #0b1626; font-family: system-ui, sans-serif; color: #b9c2d6; }
  .stage { position: relative; height: 260px; margin: 16px; border: 1px solid rgb(145 54 188 / 45%);
           border-radius: 8px; overflow: hidden;
           background:
             repeating-linear-gradient(90deg, rgb(255 255 255 / 4%) 0 1px, transparent 1px 48px),
             repeating-linear-gradient(180deg, rgb(255 255 255 / 4%) 0 1px, transparent 1px 48px),
             #12203a; }
  .playerpin { display: block; }
  .bar { display: flex; gap: 8px; align-items: center; margin: 0 16px 8px; font-size: 13px; }
  button { font: inherit; padding: 6px 12px; border-radius: 6px; cursor: pointer;
           background: #1b2a48; color: #fff; border: 1px solid rgb(145 54 188 / 60%); }
  code { color: #f6a800; }
</style>

<div class="bar">
  <button id="go">Travel</button>
  <button id="step">Step frames</button>
  <span>duration <code id="ms">—</code> · eased position <code id="t">—</code></span>
</div>

<div class="stage" id="stage">
  <div class="playerpin" id="pin">
    <span class="playerpin__pulse"></span>
    <span class="playerpin__streak"></span>
    <span class="playerpin__core"></span>
  </div>
</div>

<p style="margin:16px;font-size:13px">
  Same easing and timings as <code>MapCanvas</code>: quartic ease-out, 240ms
  floor, 560ms ceiling, and a 560ms arrival ring.
</p>

<script>
  // Mirrors MapCanvas exactly.
  const WARP_MIN_MS = 240, WARP_MAX_MS = 560, LAND_MS = 560
  const ease = (t) => 1 - Math.pow(1 - t, 4)

  const pin = document.getElementById('pin')
  const stage = document.getElementById('stage')
  pin.style.setProperty('--pin-size', '34px')

  let from = { x: 90, y: 190 }
  let to = { x: 620, y: 70 }
  let landTimer = 0

  const place = (x, y) => { pin.style.transform = 'translate(' + x + 'px,' + y + 'px)' }
  place(from.x, from.y)

  function fly(slow) {
    const dx = to.x - from.x, dy = to.y - from.y
    // Distance here is in px; on the map it is tiles. Same shape either way.
    const ms = Math.min(WARP_MAX_MS, WARP_MIN_MS + Math.hypot(dx, dy) / 12 * 9) * (slow ? 8 : 1)
    document.getElementById('ms').textContent = Math.round(ms) + 'ms'
    pin.style.setProperty('--warp-ms', ms + 'ms')
    pin.style.setProperty('--warp-angle', Math.atan2(dy, dx) * 180 / Math.PI + 'deg')
    pin.classList.remove('is-landing')
    void pin.offsetWidth
    pin.classList.add('is-warping')

    const start = performance.now()
    const step = () => {
      const now = performance.now()
      const t = Math.min(1, (now - start) / ms)
      const e = ease(t)
      document.getElementById('t').textContent = e.toFixed(3)
      place(from.x + dx * e, from.y + dy * e)
      if (t < 1) { requestAnimationFrame(step); return }
      pin.classList.remove('is-warping')
      void pin.offsetWidth
      pin.classList.add('is-landing')
      clearTimeout(landTimer)
      landTimer = setTimeout(() => pin.classList.remove('is-landing'), LAND_MS)
      const swap = from; from = to; to = swap
    }
    requestAnimationFrame(step)
  }

  document.getElementById('go').onclick = () => fly(false)
  document.getElementById('step').onclick = () => fly(true)
  stage.onclick = (e) => {
    const r = stage.getBoundingClientRect()
    to = { x: e.clientX - r.left, y: e.clientY - r.top }
    fly(false)
  }
</script>
`

writeFileSync(new URL('../.ssr/warp.html', import.meta.url), html)
console.log('wrote .ssr/warp.html')
