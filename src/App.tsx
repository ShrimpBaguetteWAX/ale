import { Suspense, lazy, useEffect } from 'react'
import {
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { useGame } from './state/useGame'
import { Landing } from './routes/Landing'
import { Connect } from './routes/Connect'

// Everything past the door is split out: a visitor who only reads the landing
// page never downloads the game screens or the wallet SDK.
const Signup = lazy(() => import('./routes/Signup'))
const MapView = lazy(() => import('./routes/MapView'))
const Profile = lazy(() => import('./routes/Profile'))
const Tavern = lazy(() => import('./routes/Tavern'))
const Fighters = lazy(() => import('./routes/Fighters'))
const Quests = lazy(() => import('./routes/Quests'))
const Lands = lazy(() => import('./routes/Lands'))
const Farming = lazy(() => import('./routes/Farming'))
const Ascension = lazy(() => import('./routes/Ascension'))
const Leaderboard = lazy(() => import('./routes/Leaderboard'))
const Candle = lazy(() => import('./routes/Candle'))
const Shop = lazy(() => import('./routes/Shop'))
const Dungeon = lazy(() => import('./routes/Dungeon'))
const Arena = lazy(() => import('./routes/Arena'))
const Market = lazy(() => import('./routes/Market'))
const Battle = lazy(() => import('./routes/Battle'))
const ComingSoon = lazy(() => import('./routes/ComingSoon'))

function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="row"
      style={{ justifyContent: 'center', padding: 'var(--sp-20)', gap: 'var(--sp-3)' }}
    >
      <span className="spinner" />
      <span className="muted">{label}…</span>
    </div>
  )
}

/**
 * Gate for the in-game routes: a wallet must be connected and that wallet must
 * have a player row. Anyone missing a step is sent to the screen that fixes
 * it, carrying where they were headed so they land there afterwards.
 */
function RequirePlayer() {
  const phase = useGame((s) => s.phase)
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const playerLoaded = useGame((s) => s.playerLoaded)
  const location = useLocation()

  if (phase === 'idle' || phase === 'probing') return <Loading label="Connecting to WAX" />
  if (!account) return <Navigate to="/connect" replace state={{ from: location.pathname }} />
  if (!playerLoaded) return <Loading label="Loading your commander" />
  if (!player) return <Navigate to="/signup" replace />

  return <Outlet />
}

function Boot({ children }: { children: React.ReactNode }) {
  const boot = useGame((s) => s.boot)
  useEffect(() => {
    void boot()
  }, [boot])
  return <>{children}</>
}

/** Sections whose contracts are live but whose screens aren't built yet. */
const SOON_ROUTES = [['tournament', 'Tournament']] as const

export default function App() {
  return (
    <HashRouter>
      <Boot>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/signup" element={<Signup />} />

            <Route element={<RequirePlayer />}>
              <Route element={<AppShell />}>
                <Route path="/map" element={<MapView />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/tavern" element={<Tavern />} />
                <Route path="/fighters" element={<Fighters />} />
                <Route path="/quests" element={<Quests />} />
                <Route path="/lands" element={<Lands />} />
                <Route path="/farming" element={<Farming />} />
                <Route path="/ascension" element={<Ascension />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/candle" element={<Candle />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/dungeon" element={<Dungeon />} />
                <Route path="/arena" element={<Arena />} />
                <Route path="/market" element={<Market />} />
                <Route path="/battle/:historyId" element={<Battle />} />
                {SOON_ROUTES.map(([path, title]) => (
                  <Route
                    key={path}
                    path={`/${path}`}
                    element={<ComingSoon title={title} />}
                  />
                ))}
              </Route>
            </Route>

            {/* The world map is the game's home screen. */}
            <Route path="/home" element={<Navigate to="/map" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Boot>
    </HashRouter>
  )
}
