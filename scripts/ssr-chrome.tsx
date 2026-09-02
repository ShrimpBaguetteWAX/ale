/**
 * Renders the app frame — left rail and top bar — against the real
 * stylesheets, without needing a wallet or a router.
 *
 *   npx vite build --ssr scripts/ssr-chrome.tsx --outDir .ssr
 *   node .ssr/ssr-chrome.js
 *
 * Both only appear once a player is connected, which makes purely visual work
 * on them awkward to check in the running app. This writes a page holding the
 * states that matter and the ones that are hard to catch live: the current
 * section, a hovered slot, a section still marked soon, and a currency
 * mid-flare.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { ResourceStrip } from '../src/components/ResourceStrip'
import { NAV_ITEMS } from '../src/components/layout/nav'
import type { Player } from '../src/chain/types'

const css = ['tokens.css', 'global.css', 'app.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const player = {
  wallet: 'previewer.wam',
  activestats: { action_points: 524, gems: 78_400, credits: 5_080_000 },
} as unknown as Player

/**
 * The rail, as AppShell builds it.
 *
 * NavLink resolves `aria-current` from the router, and :hover cannot be
 * captured in a static render — so both are set by hand here. That is the
 * whole point: these are the states worth looking at.
 */
const CURRENT = '/leaderboard'
const HOVERED = '/quests'

const rail = `
<nav class="rail" aria-label="Game menu">
  <div class="rail__brand">
    <a href="#"><img src="/assets/logo.png" alt="Alien Legends" width="337" height="152"></a>
  </div>
  ${NAV_ITEMS.map((item) => {
    const soon = item.soon
    const cls = [
      'navlink',
      soon ? 'navlink--soon' : '',
      item.to === HOVERED ? 'is-hovered' : '',
    ].filter(Boolean).join(' ')
    /* Sections with something waiting, so the dot renders beside the states
       it has to coexist with: current, hovered, and SOON. */
    const flagged = ['/shop', '/quests', '/candle', '/profile'].includes(item.to)
    const current = item.to === CURRENT ? ' aria-current="page"' : ''
    return `
  <a class="${cls}" href="#"${current}>
    <span class="navlink__inner">
      <span class="navlink__socket">
        <img class="navlink__icon" src="${item.icon}" alt="" width="28" height="28">
      </span>
      <span class="navlink__label">${item.label}</span>
      ${soon ? '<span class="navlink__badge">SOON</span>' : ''}
      ${flagged && !soon ? '<span class="navlink__dot"></span>' : ''}
    </span>
  </a>`
  }).join('')}
</nav>`

const topbar = `
<header class="topbar">
  ${renderToStaticMarkup(<ResourceStrip player={player} />)}
  <span class="spacer"></span>
  <button class="netdot netdot--ready" type="button">
    <span class="netdot__led"></span>
    <span class="mono">12/12 · 51ms</span>
  </button>
</header>`

const html = `<!doctype html>
<meta charset="utf-8">
<title>App frame</title>
<style>${css}</style>
<style>
  body { margin: 0; background: #05101e; font-family: var(--font-body); }
  .frame { display: grid; grid-template-columns: 236px 1fr; min-height: 100vh; }
  /* Both carry grid-area names that only .shell declares, so they land in
     implicit tracks under any other grid. */
  .rail, .topbar { grid-area: auto; }
  .rail { display: flex !important; }
  .topbar { position: static; }
  .col { display: flex; flex-direction: column; min-width: 0; }
  /* Stand in for the hover state, which a static render cannot produce. */
  .navlink.is-hovered {
    background:
      linear-gradient(180deg, rgb(255 255 255 / 6%), rgb(255 255 255 / 0%) 45%),
      rgb(145 54 188 / 20%);
    border-color: rgb(255 255 255 / 12%);
    color: var(--white);
    translate: 2px 0;
  }
  .page { padding: 24px; color: var(--text-dim); }
  .page h1 { font-family: var(--font-display); color: var(--yellow); }
  .note { font-size: 12px; color: #7d879e; margin-top: 4px; }
</style>
<div class="frame">
  ${rail}
  <div class="col">
    ${topbar}
    <div class="page">
      <h1>Leaderboards</h1>
      <p class="note">Current section: Leaderboards. Hover shown on Quests. Tournament is still marked soon.</p>
    </div>
  </div>
</div>
`

const out = new URL('../.ssr/chrome.html', import.meta.url)
writeFileSync(out, html)
console.log('wrote .ssr/chrome.html')
