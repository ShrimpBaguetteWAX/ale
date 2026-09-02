/**
 * The battle replay, on its own, with a real fight and no wallet.
 *
 * Open http://localhost:5273/ale/harness/battle.html with the dev server
 * running. Not part of the build — Vite only emits the entries in its config,
 * and this directory is not one of them.
 *
 * The screen is reachable in the app only in the minute after a fight, which
 * makes every timing bug in it nearly impossible to reproduce on purpose.
 * This primes the fight store with a captured row and mounts the route, so
 * Pause, Play, the speed controls and Skip can actually be clicked.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Battle from '../src/routes/Battle'
import { rememberFight } from '../src/dungeon/fightStore'
import { useGame } from '../src/state/useGame'
import type { FightRow } from '../src/dungeon/types'
import row from './fight.json'

import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/dungeon.css'
import '../src/styles/battle.css'

const fight = row as unknown as FightRow
rememberFight(fight)

useGame.setState({
  player: {
    wallet: String(fight.wallet),
    playertag: 'Harness',
    reward_power: [],
  },
} as never)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter initialEntries={[`/battle/${fight.history_id}`]}>
      <Routes>
        <Route path="/battle/:historyId" element={<Battle />} />
      </Routes>
    </MemoryRouter>
  </StrictMode>,
)
