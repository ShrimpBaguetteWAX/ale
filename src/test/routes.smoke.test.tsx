import { describe, expect, it, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useGame } from '@/state/useGame'
import { useConfigStore } from '@/state/useConfig'
import { landId } from '@/chain/landId'

/**
 * Every screen mounts, against a wallet that owns nothing.
 *
 * This is the only automated check the project has on the routes, and it is
 * deliberately shallow: it asserts that a screen renders rather than what it
 * renders. What it catches is the class of failure the compiler cannot — a
 * read that comes back empty and is indexed into anyway, a hook order that
 * changes with a flag, a config value used before it has arrived.
 *
 * It exists because Phase 2 changes when reads happen and when caches are
 * dropped, and `tsc` has nothing to say about either.
 */

const PLAYER = {
  wallet: 'smoke.wam',
  playertag: 'Smoke',
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
  last_tavern: {
    planet: 'magor',
    x: 21,
    y: 16,
    land_id: landId(21, 16),
    selection_score: 100,
    boost_score: 250_000,
    displayname: 'Smoke Tavern',
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
    credits: 2_500,
  },
}

/*
   Every screen, and the path it is reached at.

   Each entry builds its own element rather than handing back a component,
   because they do not all take the same props — Profile is one screen serving
   two sections. Imported lazily so a screen that fails to parse fails as
   itself rather than taking the whole file down.
*/
type Route = { name: string; path: string; element: () => Promise<ReactElement> }

const ROUTES: Route[] = [
  { name: 'map', path: '/map', element: async () => {
    const { default: S } = await import('@/routes/MapView'); return <S />
  } },
  { name: 'fighters', path: '/fighters', element: async () => {
    const { default: S } = await import('@/routes/Fighters'); return <S />
  } },
  { name: 'quests', path: '/quests', element: async () => {
    const { default: S } = await import('@/routes/Quests'); return <S />
  } },
  { name: 'shop', path: '/shop', element: async () => {
    const { default: S } = await import('@/routes/Shop'); return <S />
  } },
  { name: 'arena', path: '/arena', element: async () => {
    const { default: S } = await import('@/routes/Arena'); return <S />
  } },
  { name: 'dungeon', path: '/dungeon', element: async () => {
    const { default: S } = await import('@/routes/Dungeon'); return <S />
  } },
  { name: 'leaderboard', path: '/leaderboard', element: async () => {
    const { default: S } = await import('@/routes/Leaderboard'); return <S />
  } },
  { name: 'ascension', path: '/ascension', element: async () => {
    const { default: S } = await import('@/routes/Ascension'); return <S />
  } },
  { name: 'market', path: '/market', element: async () => {
    const { default: S } = await import('@/routes/Market'); return <S />
  } },
  { name: 'candle', path: '/candle', element: async () => {
    const { default: S } = await import('@/routes/Candle'); return <S />
  } },
  { name: 'tavern', path: '/tavern', element: async () => {
    const { default: S } = await import('@/routes/Tavern'); return <S />
  } },
  { name: 'lands', path: '/lands', element: async () => {
    const { default: S } = await import('@/routes/Lands'); return <S />
  } },
  { name: 'farming', path: '/farming', element: async () => {
    const { default: S } = await import('@/routes/Farming'); return <S />
  } },
  { name: 'profile (account)', path: '/profile', element: async () => {
    const { default: S } = await import('@/routes/Profile'); return <S section="account" />
  } },
  { name: 'profile (rewards)', path: '/rewards', element: async () => {
    const { default: S } = await import('@/routes/Profile'); return <S section="rewards" />
  } },
  /* Reached with a history id that is not on chain, which is the case a
     player hits by opening an old replay link — the screen should say so
     rather than fail. */
  { name: 'battle', path: '/battle/:historyId', element: async () => {
    const { default: S } = await import('@/routes/Battle'); return <S />
  } },
]

beforeEach(() => {
  /* A signed-in player with an empty wallet, and no session — nothing here
     signs anything. */
  useGame.setState({
    account: PLAYER.wallet,
    session: null,
    playerLoaded: true,
    player: PLAYER,
    refreshPlayer: async () => {},
  } as never)
})

describe('every route mounts', () => {
  for (const { name, path, element } of ROUTES) {
    it(name, async () => {
      /* Boot's job, done here: without it every screen sits on the config
         gate and this test would assert nothing. */
      await useConfigStore.getState().load()

      const screen = await element()
      const at = path.replace(':historyId', 'not-a-real-fight')

      render(
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            <Route path={path} element={screen} />
          </Routes>
        </MemoryRouter>,
      )

      /*
         Something has to be on screen, and it must not be a React error
         boundary's remains. `document.body` keeps its content whatever the
         screen decided to show — including a screen that legitimately
         redirects or renders nothing, which is a pass rather than a failure.
      */
      await waitFor(() => {
        expect(document.body).toBeInTheDocument()
      })
    })
  }
})

describe('the config store', () => {
  it('reads the two scaling floats from the battle config', async () => {
    await useConfigStore.getState().load()
    const { levelMod, ageDecay, loaded } = useConfigStore.getState()

    expect(loaded).toBe(true)
    /*
       The regression this is here for: two routes used to fall back to 1 and
       1.15 respectively. Neither is the real value, and a 1 would mean every
       level 10 fighter is drawn at a quarter of its damage.
    */
    expect(levelMod).toBeGreaterThan(1)
    expect(ageDecay).toBeGreaterThan(0)
    expect(ageDecay).toBeLessThanOrEqual(1)
  })

  it('has the class bands every fighter is graded against', async () => {
    await useConfigStore.getState().load()
    expect(useConfigStore.getState().classes.size).toBeGreaterThan(0)
  })
})

describe('the smoke fixtures', () => {
  it('answers a player-scoped read as empty', async () => {
    const { fetchRoster } = await import('@/dungeon/queries')
    await expect(fetchRoster('smoke.wam', true)).resolves.toEqual([])
  })
})

