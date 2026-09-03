/**
 * The real app shell at phone size, with a player and no wallet.
 *
 * Open it inside the phone frame so the media queries see a narrow viewport:
 *
 *   http://localhost:5273/harness/frame.html?src=/harness/mobile.html&w=390&h=760
 *
 * The browser pane scales rather than resizing, so a page loaded directly
 * still reports a desktop `innerWidth` and every `@media (max-width: …)`
 * evaluates false. An iframe has its own viewport and the queries answer to
 * that, which is the only way to look at this layout honestly.
 *
 *   ?route=/map   which screen to mount behind the shell
 *
 * Not part of the build — Vite only emits the entries in its config.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '../src/components/layout/AppShell'
import MapView from '../src/routes/MapView'
import Fighters from '../src/routes/Fighters'
import Quests from '../src/routes/Quests'
import Shop from '../src/routes/Shop'
import Arena from '../src/routes/Arena'
import Dungeon from '../src/routes/Dungeon'
import Profile from '../src/routes/Profile'
import { useGame } from '../src/state/useGame'
import { fetchConfig } from '../src/chain/queries'

import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/landing.css'
import '../src/styles/map.css'
import '../src/styles/tavern.css'
import '../src/styles/shop.css'
import '../src/styles/market.css'
import '../src/styles/fighters.css'
import '../src/styles/quests.css'
import '../src/styles/lands.css'
import '../src/styles/farming.css'
import '../src/styles/leaderboard.css'
import '../src/styles/candle.css'
import '../src/styles/account.css'
import '../src/styles/dungeon.css'
import '../src/styles/battle.css'

document.documentElement.dataset.fx = 'low'

const params = new URLSearchParams(location.search)
const route = params.get('route') || '/map'

/* A real wallet, so the map has somewhere to stand and lands to read. */
useGame.setState({
  account: '5thba.wam',
  session: null,
  playerLoaded: true,
  player: {
    wallet: '5thba.wam',
    playertag: 'Harness',
    planet: 'magor',
    x: 21,
    y: 16,
    activestats: { action_points: 480, credits: 1204500, gems: 86200, energy: 3400 },
    played_dungeons: [],
    /* Read directly by the map and the shell, so they cannot be absent. */
    active_taverns: [],
    mine_nfts: [],
    permstats: [],
    reward_power: [],
    last_dungeon_reset: '2026-01-01T00:00:00',
  },
  refreshPlayer: async () => {},
} as never)

/* The real config, so travel costs are the ones the game charges. */
void fetchConfig().then((config) => config && useGame.setState({ config }))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/map" element={<MapView />} />
          <Route path="/fighters" element={<Fighters />} />
          <Route path="/quests" element={<Quests />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/arena" element={<Arena />} />
          <Route path="/dungeon" element={<Dungeon />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<div className="panel">Not in this harness.</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  </StrictMode>,
)
