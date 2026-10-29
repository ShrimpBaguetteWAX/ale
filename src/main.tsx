import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
/* The first page's stylesheets. The game's own come with its screens: styles/game.ts. */
import './styles/fonts.css'
import './styles/global.css'
import './styles/app.css'
import './styles/landing.css'
import './styles/prizes.css'
import './styles/maintenance.css'

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

/*
 * Off for now: the guess caught most phones (iOS reports no memory at all,
 * and many phones cap the cores they report) on hardware that runs the full
 * look without trouble. The cheap path stays in the code and still answers to
 * `al:fx` = 'low' in storage; set this to true to guess again.
 */
const AUTO_LOW_FX = false

const stored = localStorage.getItem('al:fx')
const low = stored ? stored === 'low' : AUTO_LOW_FX && detectLowPower()
document.documentElement.dataset.fx = low ? 'low' : 'full'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
