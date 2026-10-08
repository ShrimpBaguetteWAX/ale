/**
 * The real Candle screen, mounted past the wallet gate — see
 * candle-harness.html.
 *
 * Reads live rows for the first registered player it finds, so the bar is
 * drawn from a real board. The window error handler is installed before
 * anything mounts, so a throw that the screen's boundary would otherwise
 * swallow into "could not be loaded" is written to the page as well as the
 * console.
 */
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { useGame } from '../src/state/useGame'
import { useConfigStore } from '../src/state/useConfig'
import { fetchPlayersPage } from '../src/chain/queries'
import Candle from '../src/routes/Candle'
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

const log = document.createElement('pre')
log.id = 'harness-log'
log.style.cssText =
  'position:fixed;left:0;right:0;bottom:0;max-height:40vh;overflow:auto;margin:0;padding:8px 12px;background:#300;color:#fdd;font:12px/1.4 ui-monospace,monospace;z-index:99999;white-space:pre-wrap'
document.body.appendChild(log)
const note = (s: string) => {
  log.textContent += s + '\n'
}
window.addEventListener('error', (e) => note(`[error] ${e.message}\n${e.error?.stack ?? ''}`))
window.addEventListener('unhandledrejection', (e) =>
  note(`[rejection] ${(e.reason && (e.reason.stack || e.reason.message)) || String(e.reason)}`),
)
const origError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  origError(...args)
  const head = String(args[0] ?? '')
  if (/error|Error|hooks|Maximum update depth/.test(head)) note(`[console.error] ${head.slice(0, 600)}`)
}

async function boot() {
  /* ?as=wallet picks the player; otherwise the first registered one. */
  const as = new URLSearchParams(location.search).get('as')
  const page = await fetchPlayersPage(as ?? undefined, 5)
  const player = page.rows?.[0]
  if (!player) throw new Error('no registered player found')
  note(`player: ${(player as { wallet: string }).wallet}`)
  useGame.setState({ account: (player as { wallet: string }).wallet, player: player as never, playerLoaded: true })
  await useConfigStore.getState().load()
  note(`config loaded: ${useConfigStore.getState().loaded}`)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <Suspense fallback={<p>loading…</p>}>
          <Routes>
            <Route path="*" element={<Candle />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </StrictMode>,
  )
}

boot().catch((e) => note(`[boot] ${e?.stack ?? e}`))
