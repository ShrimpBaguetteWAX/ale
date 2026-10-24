/**
 * The whole game, seen as another wallet — see as-harness.html.
 *
 * Boots the app the normal way (node pool, config, any stored session),
 * then swaps the signed-in account for the one in `?as=` and reads that
 * player's row. There is no session for that wallet, so every button that
 * would sign stays disabled: it is a read-only look at what they see.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { useGame } from '../src/state/useGame'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/landing.css'
import '../src/styles/map.css'
import '../src/styles/tavern.css'
import '../src/styles/shop.css'
import '../src/styles/market.css'
import '../src/styles/fighters.css'
import '../src/styles/quests.css'
import '../src/styles/tournament.css'
import '../src/styles/lands.css'
import '../src/styles/farming.css'
import '../src/styles/leaderboard.css'
import '../src/styles/candle.css'
import '../src/styles/account.css'
import '../src/styles/dungeon.css'
import '../src/styles/battle.css'
import '../src/styles/maintenance.css'
import '../src/styles/briefing.css'

import { landCoords } from '../src/chain/landId'

document.documentElement.dataset.fx = 'full'

const as = new URLSearchParams(location.search).get('as')

const badge = document.createElement('div')
badge.style.cssText =
  'position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:99999;padding:6px 12px;border-radius:999px;background:#300;color:#fdd;font:12px/1.4 ui-monospace,monospace;pointer-events:none'
badge.textContent = as ? `viewing as ${as} · read-only` : 'no ?as=wallet given — showing your own account'
document.body.appendChild(badge)

async function boot() {
  await useGame.getState().boot()
  if (as) {
    /* Same shape `connect` uses, minus the session: the gate wants an
       account and a loaded player, and nothing can be signed without a
       session. */
    useGame.setState({ session: null, account: as, player: null, playerLoaded: false })
    await useGame.getState().refreshPlayer({ force: true })
    if (!useGame.getState().player) badge.textContent = `${as} has no player row — showing signup`
  }

  /*
     `&at=planet:landid` stands the spectated player somewhere else, so a
     screen that needs a building underfoot (an arena, a dungeon) can be seen
     without that wallet travelling there. Re-applied on every player refresh.
  */
  const at = new URLSearchParams(location.search).get('at')
  const coords = at ? landCoords(at.split(':')[1] ?? '') : null
  if (at && coords) {
    const planet = at.split(':')[0]
    const place = () => {
      const p = useGame.getState().player
      if (p && (p.x !== coords.x || p.y !== coords.y || p.planet !== planet)) {
        useGame.setState({ player: { ...p, ...coords, planet: planet as typeof p.planet } })
      }
    }
    place()
    useGame.subscribe(place)
    badge.textContent += ` · standing at ${at}`
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

boot().catch((e) => {
  badge.textContent = `[boot] ${e?.message ?? e}`
})
