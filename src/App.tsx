import {
  Component,
  Suspense,
  lazy,
  useEffect,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react'
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

/**
 * A lazily-loaded screen that survives a deploy.
 *
 * Vite hashes every chunk, so publishing renames all of them. A player with
 * the page already open is holding an `index.html` that names chunks the
 * server no longer has — and the moment they open a screen they have not
 * visited yet, the import 404s, React unmounts the tree, and they are left
 * looking at a blank page with the explanation in a console they will never
 * open. Which is exactly what has been happening.
 *
 * Reloading fixes it, because the fresh `index.html` names the chunks that
 * exist. Doing it automatically means the player never sees the fault; doing
 * it *once* means a failure that is not a stale deploy — an offline
 * connection, a genuinely broken build — cannot put the page in a reload
 * loop. The second failure falls through to the boundary below.
 */
const RELOAD_FLAG = 'al.chunkreload'

/*
   The guard has to survive the reload, which means storage — and storage is
   the one thing a privacy mode takes away. Without it there is no way to
   know this is the second attempt, so the honest answer is not to reload at
   all: an unguarded reload on a genuinely broken build is an infinite loop,
   and a loop is a worse failure than the blank page it was meant to fix. The
   boundary below still offers the button.
*/
const flag = {
  available(): boolean {
    try {
      sessionStorage.setItem(RELOAD_FLAG + '.probe', '1')
      sessionStorage.removeItem(RELOAD_FLAG + '.probe')
      return true
    } catch {
      return false
    }
  },
  get(): boolean {
    try {
      return sessionStorage.getItem(RELOAD_FLAG) !== null
    } catch {
      return true
    }
  },
  set(on: boolean): void {
    try {
      if (on) sessionStorage.setItem(RELOAD_FLAG, '1')
      else sessionStorage.removeItem(RELOAD_FLAG)
    } catch {
      /* nothing to do */
    }
  },
}

function lazyScreen<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => {
    try {
      const mod = await load()
      /* Loaded fine, so a later deploy is allowed its own one reload. */
      flag.set(false)
      return mod
    } catch (err) {
      /* Already tried, or no way to remember trying. */
      if (!flag.available() || flag.get()) throw err
      flag.set(true)
      window.location.reload()
      /* The reload is asynchronous. Never resolving keeps the spinner up
         rather than flashing an error on its way out. */
      return new Promise<never>(() => {})
    }
  })
}

/**
 * What is left when even the reload did not help.
 *
 * A blank page is the worst possible answer to "the build moved": it looks
 * like the game is broken rather than out of date, and it offers nothing to
 * do about it.
 */
class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="main__inner" style={{ padding: 'var(--sp-8) 0' }}>
        <div className="alert alert--error">
          This screen could not be loaded. A new version of the game was
          probably published while you had this page open.
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            flag.set(false)
            window.location.reload()
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}

// Everything past the door is split out: a visitor who only reads the landing
// page never downloads the game screens or the wallet SDK.
const Signup = lazyScreen(() => import('./routes/Signup'))
const MapView = lazyScreen(() => import('./routes/MapView'))
const Profile = lazyScreen(() => import('./routes/Profile'))
const Tavern = lazyScreen(() => import('./routes/Tavern'))
const Fighters = lazyScreen(() => import('./routes/Fighters'))
const Quests = lazyScreen(() => import('./routes/Quests'))
const Lands = lazyScreen(() => import('./routes/Lands'))
const Farming = lazyScreen(() => import('./routes/Farming'))
const Ascension = lazyScreen(() => import('./routes/Ascension'))
const Leaderboard = lazyScreen(() => import('./routes/Leaderboard'))
const Candle = lazyScreen(() => import('./routes/Candle'))
const Shop = lazyScreen(() => import('./routes/Shop'))
const Dungeon = lazyScreen(() => import('./routes/Dungeon'))
const Arena = lazyScreen(() => import('./routes/Arena'))
const Market = lazyScreen(() => import('./routes/Market'))
const Battle = lazyScreen(() => import('./routes/Battle'))
const ComingSoon = lazyScreen(() => import('./routes/ComingSoon'))

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
        <ScreenBoundary>
          <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/signup" element={<Signup />} />

            <Route element={<RequirePlayer />}>
              <Route element={<AppShell />}>
                <Route path="/map" element={<MapView />} />
                <Route path="/profile" element={<Profile section="account" />} />
                <Route path="/rewards" element={<Profile section="rewards" />} />
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
        </ScreenBoundary>
      </Boot>
    </HashRouter>
  )
}
