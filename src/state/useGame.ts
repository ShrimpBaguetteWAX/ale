import { create } from 'zustand'
import type { Session } from '@wharfkit/session'
import { endpointPool } from '@/chain/endpoints'
import {
  fetchConfig,
  fetchPlayer,
  fetchSignupStat,
  fetchIsWhitelisted,
} from '@/chain/queries'
import type { GameConfig, Player } from '@/chain/types'
import { hasStoredSession } from '@/wharf/errors'

/**
 * WharfKit and its wallet plugins are ~190KB gzipped. Loading them behind a
 * dynamic import keeps them out of the initial bundle, so a visitor reading
 * the landing page never pays for a wallet SDK they haven't asked for.
 */
const wharf = () => import('@/wharf/session')

export type BootPhase = 'idle' | 'probing' | 'ready' | 'offline'

interface GameState {
  phase: BootPhase
  bootError: string | null

  session: Session | null
  account: string | null

  config: GameConfig | null

  player: Player | null
  playerLoaded: boolean
  /** Fee paid but `signup` not yet called — resume the flow here. */
  signupPending: boolean
  whitelisted: boolean

  boot: () => Promise<void>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refreshPlayer: (opts?: { force?: boolean }) => Promise<void>
}

export const useGame = create<GameState>((set, get) => ({
  phase: 'idle',
  bootError: null,
  session: null,
  account: null,
  config: null,
  player: null,
  playerLoaded: false,
  signupPending: false,
  whitelisted: false,

  /**
   * App boot: probe the node pool first, then load the (cached) game config
   * and silently restore a previous wallet session. Nothing else touches the
   * chain until a screen actually needs it.
   */
  async boot() {
    if (get().phase !== 'idle') return
    set({ phase: 'probing', bootError: null })

    const status = await endpointPool.probe()
    if (status.healthy.length === 0) {
      set({ phase: 'offline', bootError: 'No WAX node responded.' })
      return
    }

    try {
      const config = await fetchConfig()
      set({ config: config ?? null })
    } catch (err) {
      set({ bootError: err instanceof Error ? err.message : String(err) })
    }

    set({ phase: 'ready' })

    // Only pull in the wallet SDK if a session could actually be restored.
    if (!hasStoredSession()) return

    const { restore } = await wharf()
    const session = await restore()
    if (session) {
      set({ session, account: String(session.actor) })
      await get().refreshPlayer()
    }
  },

  async connect() {
    const { login } = await wharf()
    const session = await login()
    if (!session) return
    set({ session, account: String(session.actor), playerLoaded: false })
    await get().refreshPlayer({ force: true })
  },

  async disconnect() {
    const { session } = get()
    const { logout } = await wharf()
    await logout(session ?? undefined)
    set({
      session: null,
      account: null,
      player: null,
      playerLoaded: false,
      signupPending: false,
      whitelisted: false,
    })
  },

  /**
   * Load everything that depends on the connected wallet. Deliberately one
   * batch: the player row, and only if there is no player, the two cheap
   * signup-gate reads.
   */
  async refreshPlayer({ force = false } = {}) {
    const { account, config } = get()
    if (!account) return

    const player = await fetchPlayer(account, force)
    if (player) {
      set({ player, playerLoaded: true, signupPending: false })
      return
    }

    const [stat, whitelisted] = await Promise.all([
      fetchSignupStat(account, true),
      config?.allowlist_active ? fetchIsWhitelisted(account) : Promise.resolve(true),
    ])

    set({
      player: null,
      playerLoaded: true,
      signupPending: !!stat,
      whitelisted,
    })
  },
}))

// Dev-only handle so the store can be inspected and driven from the console.
// Stripped from production builds by the bundler's dead-code elimination.
if (import.meta.env.DEV) {
  ;(window as unknown as { __game?: unknown }).__game = useGame
}
