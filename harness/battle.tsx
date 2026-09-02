/**
 * The battle replay, on its own, with real fights and no wallet.
 *
 * Open http://localhost:5273/ale/harness/battle.html with the dev server
 * running. Not part of the build — Vite only emits the entries in its config,
 * and this directory is not one of them.
 *
 *   ?outcome=win|loss     which captured fight to replay
 *   ?venue=dungeon|arena  where to pretend it was fought
 *   ?remember=novenue     store the row with no venue, which is the state a
 *                         replay reached by link leaves behind
 *   ?remember=no          skip the store entirely; only works while the fight
 *                         is still on chain, the same minute the app has
 *
 * The screen is reachable in the app only in the minute after a fight, which
 * makes every timing and navigation bug in it nearly impossible to reproduce
 * on purpose. This primes the fight store and mounts the route, with stand-in
 * pages behind /map, /dungeon and /arena so it is visible where Back actually
 * goes.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Battle from '../src/routes/Battle'
import { rememberFight, type Venue } from '../src/dungeon/fightStore'
import { useGame } from '../src/state/useGame'
import type { FightRow } from '../src/dungeon/types'
import won from './fight-win.json'
import lost from './fight-loss.json'

import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/dungeon.css'
import '../src/styles/battle.css'

const params = new URLSearchParams(location.search)
const venue = (params.get('venue') === 'arena' ? 'arena' : 'dungeon') as Venue
const fight = (params.get('outcome') === 'loss' ? lost : won) as unknown as FightRow

/*
   A replay reached by a link rather than by fighting: nothing in the store,
   so the row comes off the chain and the venue is unknowable. Only reachable
   while the fight is still on chain, which is the same window the app has.
*/
/* The store outlives a navigation, so an earlier run would answer for it. */
sessionStorage.clear()
const remember = params.get('remember')
if (remember === 'novenue') rememberFight(fight)
else if (remember !== 'no') rememberFight(fight, venue)

useGame.setState({
  player: {
    wallet: String(fight.wallet),
    playertag: 'Harness',
    reward_power: [],
  },
} as never)

/** So a Back that navigates somewhere shows where it landed. */
const Landed = ({ where }: { where: string }) => (
  <div id="landed" data-where={where} style={{ padding: 40, fontSize: 24 }}>
    landed on /{where}
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter initialEntries={[`/battle/${fight.history_id}`]}>
      <Routes>
        <Route path="/battle/:historyId" element={<Battle />} />
        <Route path="/map" element={<Landed where="map" />} />
        <Route path="/dungeon" element={<Landed where="dungeon" />} />
        <Route path="/arena" element={<Landed where="arena" />} />
      </Routes>
    </MemoryRouter>
  </StrictMode>,
)
