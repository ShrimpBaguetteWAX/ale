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
import Leaderboard from '../src/routes/Leaderboard'
import Ascension from '../src/routes/Ascension'
import Market from '../src/routes/Market'
import Candle from '../src/routes/Candle'
import Tavern from '../src/routes/Tavern'
import { landId } from '../src/chain/landId'
import { MineCelebration } from '../src/pools/MineCelebration'
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
    /*
       Overridable, so a screen can be opened standing somewhere that has
       the data it is about: `?planet=kavian&x=10&y=5` is a dungeon with a
       team defending it, which magor 21,16 is not.
    */
    planet: params.get('planet') || 'magor',
    x: Number(params.get('x') ?? 21),
    y: Number(params.get('y') ?? 16),
    activestats: { action_points: 480, credits: 1204500, gems: 86200, energy: 3400 },
    played_dungeons: [],
    /* Read directly by the map and the shell, so they cannot be absent. */
    active_taverns: [],
    mine_nfts: [],
    /*
       Empty by default, and filled from a real wallet with `?permstats=<name>`.

       The All stats panel is a list of whatever `permstats` happens to hold,
       so with none of them there is nothing on the screen to look at — which
       is exactly the screen you want when checking that every tracked stat
       has a symbol beside it.
    */
    permstats: [],
    reward_power: [],
    last_dungeon_reset: '2026-01-01T00:00:00',

    /*
       A revealed tavern under the player, so `/tavern` can be opened at
       all: the screen sends you back to the map unless `last_tavern` names
       the land you are standing on, and a real wallet is only ever standing
       on one tile. Ranges rather than fixed numbers because that is what a
       tavern shows — what the recruit could roll, before `hire` fixes it.
    */
    last_tavern: {
      planet: (params.get('planet') || 'magor') as never,
      x: Number(params.get('x') ?? 21),
      y: Number(params.get('y') ?? 16),
      land_id: landId(Number(params.get('x') ?? 21), Number(params.get('y') ?? 16)),
      selection_score: 100,
      boost_score: 250000,
      displayname: 'Harness Tavern',
      required_maintenance: '0.0000 TLM',
      objectives: [],
    },
    last_tavern_fighter: {
      health_min: 180, health_max: 260,
      damage_min: 90, damage_max: 140,
      taunt_min: 20, taunt_max: 45,
      initiative_min: 30, initiative_max: 70,
      attackspeed_min: 40, attackspeed_max: 95,
      res_gem: 120, res_metal: 80, res_air: 200,
      res_fire: 60, res_nature: 150, res_neutral: 100,
      classname: 'arcanist',
      racename: 'altan',
      element: 'gem',
      target: 'highest_health',
      abilities: [],
      experience: 0,
      required_experience: 100,
      level: 1,
      credits: 2500,
    },
  },
  refreshPlayer: async () => {},
} as never)

/* The real config, so travel costs are the ones the game charges. */
void fetchConfig().then((config) => config && useGame.setState({ config }))

/*
 * `?borrow=<wallet>` — take a real player's row for the parts no mock has.
 *
 * Read straight off `players.ale`: the lifetime counters, so All stats shows
 * the keys the contract actually writes in the amounts it writes them, and
 * the tavern recruit, whose last ability arrives flagged `locked`.
 *
 * `?permstats=` is the older name for the same thing and still works.
 */
const borrow = params.get('permstats') ?? params.get('borrow')
if (borrow) {
  void fetch('https://wax.greymass.com/v1/chain/get_table_rows', {
    method: 'POST',
    body: JSON.stringify({
      json: true,
      code: 'players.ale',
      scope: 'players.ale',
      table: 'players',
      lower_bound: borrow,
      upper_bound: borrow,
      limit: 1,
    }),
  })
    .then((r) => r.json())
    .then((d) => {
      const row = d.rows?.[0]
      if (!row) return
      const player = useGame.getState().player
      if (player) {
        useGame.setState({
          player: {
            ...player,
            permstats: row.permstats ?? [],
            /*
               The recruit too, when that row has one revealed: its last
               ability arrives flagged `locked`, and no mock carries that.
            */
            last_tavern_fighter:
              Number(row.last_tavern_fighter?.level ?? 0) > 0
                ? row.last_tavern_fighter
                : player.last_tavern_fighter,
            /*
               And the tavern itself when it is asking for something. The
               mock asks for nothing, which is the one tavern where the
               discounts panel has nothing in it to look at.

               The screen sends you back to the map unless you are standing
               on the tavern's own land, so the player moves to it.
            */
            ...((row.last_tavern?.objectives ?? []).length > 0
              ? {
                  last_tavern: row.last_tavern,
                  planet: row.last_tavern.planet,
                  x: row.last_tavern.x,
                  y: row.last_tavern.y,
                }
              : {}),
          },
        } as never)
      }
    })
}

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
          <Route path="/profile" element={<Profile section="account" />} />
          <Route path="/rewards" element={<Profile section="rewards" />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/ascension" element={<Ascension />} />
          <Route path="/market" element={<Market />} />
          <Route path="/candle" element={<Candle />} />
          <Route path="/tavern" element={<Tavern />} />
          {/* The mine receipt, which needs a claim to exist otherwise. */}
          <Route
            path="/cheer"
            element={
              <MineCelebration
                rewards={[
                  {
                    index: 1,
                    type: 'tlm',
                    timestamp: '2026-09-03T12:00:00',
                    reward: '13.6764 TLM',
                    pool: 'tlmdung',
                    pool_description: 'Dungeon Wins',
                  },
                  {
                    index: 2,
                    type: 'shrds',
                    timestamp: '2026-09-03T12:00:00',
                    reward: '63.1 SHRDS',
                    pool: 'shrddung',
                    pool_description: 'Dungeon Wins',
                  },
                ]}
                onClose={() => {}}
              />
            }
          />
          <Route path="*" element={<div className="panel">Not in this harness.</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  </StrictMode>,
)
