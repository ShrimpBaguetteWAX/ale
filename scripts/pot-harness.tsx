/**
 * The prize strip, mounted with React running — see pot-harness.html.
 *
 * Three copies at once: the strip on its own, the preparing screen that
 * carries it, and the strip told to stack. The first two measure
 * themselves; dragging the window narrower is the test.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Preparing, PrizeBar } from '../src/routes/Tournament'
import type { TournamentStage } from '../src/tournament/types'
import type { Weather } from '../src/fight/weather'
/* Every stylesheet the app loads, in the app's order: the weather chip's
   layout lives in dungeon.css, and a harness that skipped it drew the
   rolls as a column and the strip nine pixels too tall. */
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

const stage: TournamentStage = {
  tournament_name: '.....2fbjyq',
  stage_index: 2000,
  stage_name: 'get_rewards',
  weather_effects: [],
  tournament_screen: 'preparing',
  allow_player_signup: false,
  allow_player_cancellation: false,
  tlm_rewards: '4.0000 TLM',
  wax_rewards: '23.00000000 WAX',
  player_count: 0,
  rounds: 0,
  free_passes: 0,
  score_id_lookup_min: '0',
  score_id_lookup_max: '0',
  battles_preliminary_round: 0,
  players_first_ko_round: 0,
  current_round: 0,
  matchups_created: 0,
  battles_in_round: 0,
  current_battle: 0,
  round_complete: false,
}

/* The three rolls from the screenshot — the long one is the point. */
const roll = (
  weather_id: string,
  displayname: string,
  effects: Weather['weather_effects'],
  affected_class: string[] = [],
): Weather =>
  ({
    weather_id,
    affected_class,
    affected_element: [],
    affected_race: [],
    weather_effects: effects,
    displayname,
    title: displayname,
  }) as Weather

const weather = [
  {
    planet: 'eyeke',
    weather: roll('firetaunt', '-20% fire fighter taunt', [{ statname: 'taunt', percent_change: -20, flat_change: 0 }], ['fire']),
  },
  {
    planet: 'kavian',
    weather: roll('hunterhp', '-20 hunter health', [{ statname: 'health', percent_change: 0, flat_change: -20 }], ['hunter']),
  },
  {
    planet: 'naron',
    weather: roll('gemfire', '+40% gem resistance and -20 fire resistance', [
      { statname: 'res_gem', percent_change: 40, flat_change: 0 },
      { statname: 'res_fire', percent_change: 0, flat_change: -20 },
    ]),
  },
]

const RING = [
  { fighter_id: 1, classname: 'desperado', racename: 'human' },
  { fighter_id: 2, classname: 'arcanist', racename: 'robotron' },
  { fighter_id: 3, classname: 'astralknight', racename: 'lopati' },
  { fighter_id: 4, classname: 'explosioneer', racename: 'robotron' },
  { fighter_id: 5, classname: 'desperado', racename: 'human' },
]

function Harness() {
  return (
    <div className="tour" style={{ padding: 24, display: 'grid', gap: 40 }}>
      <section>
        <p className="faint" style={{ margin: '0 0 8px' }}>The strip alone, measuring itself</p>
        <PrizeBar stage={stage} weather={weather} />
      </section>

      <section>
        <p className="faint" style={{ margin: '0 0 8px' }}>The preparing screen, as the game shows it</p>
        <Preparing fighters={RING} stage={stage} weather={weather} signupAt={Date.now() + 95_000} now={Date.now()} />
      </section>

      <section>
        <p className="faint" style={{ margin: '0 0 8px' }}>Told to stack</p>
        <PrizeBar stage={stage} weather={weather} stacked />
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
