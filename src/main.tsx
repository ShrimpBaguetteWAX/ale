import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/app.css'
import './styles/landing.css'
import './styles/map.css'
import './styles/tavern.css'
import './styles/shop.css'
import './styles/market.css'
import './styles/fighters.css'
import './styles/quests.css'
import './styles/lands.css'
import './styles/farming.css'
import './styles/leaderboard.css'
import './styles/candle.css'
import './styles/account.css'
import './styles/dungeon.css'
import './styles/battle.css'

/**
 * Decide once, before first paint, whether to run the cheap visual path.
 * `deviceMemory` and `hardwareConcurrency` are crude but they are the only
 * capability signals a browser actually gives us, and getting this wrong only
 * costs some decoration.
 */
function detectLowPower(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) {
    return true
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const stored = localStorage.getItem('al:fx')
const low = stored ? stored === 'low' : detectLowPower()
document.documentElement.dataset.fx = low ? 'low' : 'full'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

document.getElementById('boot')?.remove()
