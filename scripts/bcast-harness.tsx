/**
 * The fight broadcast on its own, running — see bcast-harness.html.
 *
 * Mounts `BoutBroadcast` and the opened line-up on the final of a real tournament (the matchup row
 * as it was on chain; the rows themselves are erased at cleanup) and plays
 * it, so the scorebar, the arena and the deck can be looked at live at any
 * width. `?as=wallet` marks that side as yours.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BoutBroadcast } from '../src/tournament/BoutBroadcast'
import { BoutLineup } from '../src/routes/Tournament'
import { useConfigStore } from '../src/state/useConfig'
import type { TournamentMatchup } from '../src/tournament/types'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/tournament.css'
import '../src/styles/dungeon.css'
import '../src/styles/battle.css'

/* The Grand Tournament of 2026-10-10, final: Shrimp vs Shade. */
const FINAL: TournamentMatchup = {
  index: 0,
  matchup_seed: 3582663286,
  wallet_player1: '5thba.wam',
  wallet_player2: '1x1ci.wam',
  gamertag_player1: 'Shrimp',
  gamertag_player2: 'Shade',
  avatar_player1: 201,
  avatar_player2: 0,
  fighter_ids_player1: [6, 12, 1728, 1812, 2643],
  fighter_ids_player2: [16768, 5946, 3463, 988, 1123],
  crew_template_id_player1: 141549,
  crew_template_id_player2: 141526,
  arms_template_id_player1: 19623,
  arms_template_id_player2: 141476,
  play_time: '2026-10-10T17:00:00',
  winner: 'player1',
} as TournamentMatchup

async function boot() {
  await useConfigStore.getState().load()
  const as = new URLSearchParams(location.search).get('as')
  /* ?lock=1 pretends the fight's slot is an hour off, so the poster locks. */
  const lock = new URLSearchParams(location.search).get('lock') === '1'
  const lockedUntil = lock ? Date.now() + 3_600_000 : NaN
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <div className="tour" style={{ padding: 12 }}>
        <section className="tour__panel">
          <BoutBroadcast
            m={FINAL}
            round={2}
            bout={0}
            weather={[]}
            mineWallet={as}
            autoPlay
            lockedUntil={lockedUntil}
            now={Date.now()}
          />
          {/* The same fight on the board, opened: both line-ups as the row shows them. */}
          <ol className="tour__bouts" style={{ marginTop: 16 }}>
            <li className="tour__bout tour__bout--open">
              <BoutLineup m={FINAL} />
            </li>
          </ol>
        </section>
      </div>
    </StrictMode>,
  )
}

boot().catch((e) => {
  document.body.textContent = `[boot] ${e?.message ?? e}`
})
