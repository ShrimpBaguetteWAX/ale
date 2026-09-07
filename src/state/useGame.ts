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
import { useConfigStore } from './useConfig'

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
  /**
   * Whether boot has finished deciding whether there is a wallet.
   *
   * `phase` cannot answer this. It goes to `ready` once the node pool and the
   * config are in, which is before the wallet SDK has even been imported —
   * and restoring a stored session takes a chunk load and a round trip after
   * that. In that window a returning player has no `account` yet but is about
   * to, which the gate read as "not connected" and bounced to the wallet
   * picker. That is the flash between "Connecting to WAX" and the game.
   */
  sessionChecked: boolean

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
  sessionChecked: false,
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
      /* There is nothing to restore a session against, so the gate must stop
         waiting rather than hold a spinner over an error it could show. */
      set({ phase: 'offline', bootError: 'No WAX node responded.', sessionChecked: true })
      return
    }

    try {
      /*
         The game's config and the game's settings tables, together.

         `fetchConfig` is the signup gate and has to succeed; the settings in
         `useConfig` are what every screen scales its numbers by. Both are
         `persist: true`, so a returning player pays for neither — and
         loading them here rather than in six routes means a screen no longer
         renders a fighter's damage before it knows what to multiply it by.
      */
      const [config] = await Promise.all([fetchConfig(), useConfigStore.getState().load()])
      set({ config: config ?? null })
    } catch (err) {
      set({ bootError: err instanceof Error ? err.message : String(err) })
    }

    set({ phase: 'ready' })

    // Only pull in the wallet SDK if a session could actually be restored.
    if (!hasStoredSession()) {
      set({ sessionChecked: true })
      return
    }

    try {
      const { restore } = await wharf()
      const session = await restore()
      if (session) {
        /*
           The account lands in the same update as the flag, never after it.
           Split across two, there would be one frame holding "boot has
           decided" and "there is no wallet" at once — which is the exact
           pair the gate turns into a redirect.
        */
        set({ session, account: String(session.actor), sessionChecked: true })
        await get().refreshPlayer()
      }
    } finally {
      /*
         Whatever happened above — a chunk that would not load, a wallet that
         refused, a stored session the SDK rejected — the gate has to stop
         waiting. Without this a thrown restore leaves the spinner up for
         good, which is worse than the flash it replaced.
      */
      if (!get().sessionChecked) set({ sessionChecked: true })
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
