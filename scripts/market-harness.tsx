/**
 * The real Market screen for a made-up player - see market-harness.html.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { useGame } from '../src/state/useGame'
import { useConfigStore } from '../src/state/useConfig'
import Market from '../src/routes/Market'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/game'

const PLAYER = {
  wallet: 'harness.wam',
  playertag: 'Harness',
  planet: 'magor',
  x: 21,
  y: 16,
  activestats: { action_points: 480, credits: 1_204_500, gems: 86_200, energy: 3_400 },
  played_dungeons: [],
  active_taverns: [],
  mine_nfts: [],
  permstats: [],
  reward_power: [],
  last_dungeon_reset: '2026-01-01T00:00:00',
}
useGame.setState({ account: PLAYER.wallet, session: null, playerLoaded: true, player: PLAYER, refreshPlayer: async () => {} } as never)

void useConfigStore
  .getState()
  .load()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <MemoryRouter initialEntries={['/market']}>
        <div style={{ padding: 24 }}>
          <Market />
        </div>
      </MemoryRouter>,
    )
  })
