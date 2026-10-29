import {
  BrowserLocalStorage,
  ChainDefinition,
  Session,
  SessionKit,
  cancelable,
  type Cancelable,
  type LocaleDefinitions,
  type PromptResponse,
  type SerializedSession,
  type TransactResult,
  type UserInterface,
} from '@wharfkit/session'
import type WebRenderer from '@wharfkit/web-renderer'
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor'
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet'
import { CosignPlugin } from './cosign'
import { AUTO_SIGN_PERMISSION, savedGroups, whitelistFor } from './autoSign'
import { CHAIN_ID } from '@/chain/config'
import { endpointPool } from '@/chain/endpoints'
import { isUserCancel, SESSION_STORAGE_PREFIX } from './errors'
import { isAuthorityError, signsWithKey, syncAutoSign, walletOnly } from './autoSignSync'

let kit: SessionKit | null = null
/* WharfKit's window, kept so a screen can tell when the player shut it. */
let ui: WebRenderer | null = null

/*
   WharfKit's window (the wallet picker, the signing prompts) is a third of
   the wallet code, and a returning player's reload restored their session
   through all of it before the game could show, with no window ever opened.
   It is fetched on its own instead: when Connect is pressed, when a
   transaction starts, or quietly a few seconds after a session is restored,
   so the first transaction does not wait on it either.
*/
let uiLoading: Promise<WebRenderer> | null = null
/* What the kit tells the window before it exists, handed over when it does. */
const pendingTranslations: LocaleDefinitions[] = []
let pendingMinimal: boolean | undefined

export function loadWalletWindow(): Promise<WebRenderer> {
  return (uiLoading ??= import('@wharfkit/web-renderer')
    .then(({ default: Renderer }) => {
      const r = new Renderer()
      /*
         A second browser setting auto-signing up finds keys already on the
         permission, and WharfKit asks whether to add this one or replace them.
         Replacing would leave every other browser signing with a key the chain
         has forgotten, so it is never offered: this browser's key goes beside
         the others, and each is taken away only from its own browser.
      */
      r.onSessionKeyConflict = async () => 'add'
      for (const t of pendingTranslations.splice(0)) r.addTranslations(t)
      if (pendingMinimal !== undefined) r.setMinimal?.(pendingMinimal)
      ui = r
      return r
    })
    .catch((err: unknown) => {
      /* A failed fetch may be retried by the next thing that needs the window. */
      uiLoading = null
      throw err
    }))
}

/**
 * The window as the kit sees it: every call waits for the real one, and the
 * few the kit makes before anything is shown (translations, minimal mode)
 * are kept until it arrives.
 */
const lazyUi: UserInterface = {
  login: async (context) => (await loadWalletWindow()).login(context),
  onError: async (error) => (await loadWalletWindow()).onError(error),
  onAccountCreate: async (context) => (await loadWalletWindow()).onAccountCreate(context),
  onAccountCreateComplete: async () => (await loadWalletWindow()).onAccountCreateComplete(),
  onLogin: async () => (await loadWalletWindow()).onLogin(),
  onLoginComplete: async () => (await loadWalletWindow()).onLoginComplete(),
  onTransact: async () => (await loadWalletWindow()).onTransact(),
  onTransactComplete: async () => (await loadWalletWindow()).onTransactComplete(),
  onSign: async () => (await loadWalletWindow()).onSign(),
  onSignComplete: async () => (await loadWalletWindow()).onSignComplete(),
  onBroadcast: async () => (await loadWalletWindow()).onBroadcast(),
  onBroadcastComplete: async () => (await loadWalletWindow()).onBroadcastComplete(),
  onSessionKeyConsent: async (args) => (await loadWalletWindow()).onSessionKeyConsent(args),
  onSessionKeyConflict: async (args) => (await loadWalletWindow()).onSessionKeyConflict(args),
  onSessionKeyMismatch: async (args) => (await loadWalletWindow()).onSessionKeyMismatch(args),
  onSessionKeyRemove: async (args) => (await loadWalletWindow()).onSessionKeyRemove(args),
  prompt(args) {
    if (ui) return ui.prompt(args)
    /* Cancelled while the window was still on its way: it never opens. */
    let inner: Cancelable<PromptResponse> | null = null
    let cancelled = false
    return cancelable(
      loadWalletWindow().then((r) => {
        if (cancelled) throw new Error('Prompt cancelled')
        inner = r.prompt(args)
        return inner
      }),
      (canceled) => {
        cancelled = true
        inner?.cancel(canceled.message, true)
      },
    )
  },
  status(message) {
    if (ui) ui.status(message)
    else void loadWalletWindow().then((r) => r.status(message))
  },
  translate(key, options, namespace) {
    return ui ? ui.translate(key, options, namespace) : (options?.default ?? key)
  },
  getTranslate(namespace) {
    return (key, options) => lazyUi.translate(key, options, namespace)
  },
  addTranslations(translations) {
    if (ui) ui.addTranslations(translations)
    else pendingTranslations.push(translations)
  },
  getMinimal() {
    return ui?.getMinimal?.() ?? pendingMinimal ?? false
  },
  setMinimal(minimal) {
    if (ui?.setMinimal) ui.setMinimal(minimal)
    else pendingMinimal = minimal
  },
}

/**
 * SessionKit is built lazily, after the endpoint pool has been probed, so the
 * wallet signs and broadcasts through a node we've confirmed is up and in
 * sync this session rather than a hardcoded default.
 */
export async function getSessionKit(): Promise<SessionKit> {
  if (kit) return kit

  await endpointPool.probe()

  const chain = ChainDefinition.from({
    id: CHAIN_ID,
    url: endpointPool.next(),
  })

  /*
     No transact plugins here on purpose. A plugin registered on the kit runs
     on every transaction the game makes; the one the game has is wanted on
     exactly one action, and `transact` below passes it there.
  */
  kit = new SessionKit(
    {
      appName: 'Alien Legends',
      chains: [chain],
      ui: lazyUi,
      walletPlugins: [new WalletPluginAnchor(), new WalletPluginCloudWallet()],
    },
    {
      /* The game's own storage keys, never another WharfKit app's on the same origin. */
      storage: new BrowserLocalStorage(SESSION_STORAGE_PREFIX),
      /*
         Auto-signing: a key kept in this browser that may sign only what the
         player chose on the Account screen. Nothing until they choose, and
         never a transfer — see autoSign.ts.
      */
      sessionKey: { permission: AUTO_SIGN_PERMISSION, whitelist: whitelistFor(savedGroups()) },
    },
  )

  return kit
}

/** Open the wallet picker. Resolves to null if the user cancels. */
export async function login(): Promise<Session | null> {
  /* The picker's code comes down alongside the kit, not after it. */
  void loadWalletWindow().catch(() => {})
  const k = await getSessionKit()
  try {
    const { session } = await k.login()
    return session
  } catch (err) {
    // WharfKit throws on user cancellation; that isn't an error worth raising.
    if (isUserCancel(err)) return null
    throw err
  }
}

/**
 * Call `cb` when WharfKit's window closes; returns the unsubscribe.
 *
 * Shutting the window with its × leaves the login it opened pending for good
 * (web-renderer 4.0.2), so the Connect button sat on "Waiting for wallet"
 * until a reload. A screen waiting on a login watches the window instead. The
 * login itself is left alone: a Cloud Wallet popup still open can finish it.
 */
export function onLoginWindowClosed(cb: () => void): () => void {
  let stopped = false
  let off = () => {}
  const watch = () => {
    if (stopped) return
    const dialog = ui?.shadow?.querySelector('dialog')
    /* Only a window that has opened can close. */
    if (!dialog?.open) return void setTimeout(watch, 150)
    dialog.addEventListener('close', cb, { once: true })
    off = () => dialog.removeEventListener('close', cb)
  }
  watch()
  return () => {
    stopped = true
    off()
  }
}

/** Restore a previous session without prompting, if one was persisted. */
export async function restore(): Promise<Session | null> {
  const k = await getSessionKit()
  try {
    const session = await k.restore()
    /* Ready before the first transaction asks for it, once the game is up. */
    if (session) setTimeout(() => void loadWalletWindow().catch(() => {}), 4000)
    return session ?? null
  } catch {
    return null
  }
}

export async function logout(session?: Session): Promise<void> {
  const k = await getSessionKit()
  await k.logout(session)
}

export async function listSessions(): Promise<SerializedSession[]> {
  const k = await getSessionKit()
  return k.getSessions()
}


export interface ActionInput {
  account: string
  name: string
  data: Record<string, unknown>
}

/**
 * Sign and broadcast. Authorization defaults to the session's own permission,
 * which is what every gameplay action needs.
 */
export async function transact(
  session: Session,
  actions: ActionInput[],
  options: {
    /**
     * Have the game pay this transaction's network cost.
     *
     * Off by default, and deliberately per-call rather than on the session:
     * a plugin registered on the kit runs on *everything*, which bills
     * `cpu.ale` for every fight, claim and step a player takes. The one place
     * it is wanted is the CPU claim itself, where the player has no CPU left
     * to pay with — which is the whole reason they are asking. See
     * `cosign.ts`.
     */
    cosign?: boolean
  } = {},
): Promise<TransactResult> {
  const args = {
    actions: actions.map((a) => ({
      ...a,
      authorization: [session.permissionLevel],
    })),
  }
  const opts = {
    broadcast: true,
    expireSeconds: 120,
    ...(options.cosign ? { transactPlugins: [new CosignPlugin()] } : {}),
  }
  const keyed = signsWithKey(session, args.actions as Parameters<typeof signsWithKey>[1])
  try {
    return await session.transact(args, opts)
  } catch (err) {
    /*
       This browser's key turned down: taken away in another browser, or
       the action unlinked there. Bring this browser in line with the chain,
       and send the same transaction once more through the wallet.
    */
    if (!keyed || !isAuthorityError(err)) throw err
    await syncAutoSign(session)
    return walletOnly(session).transact(args, opts)
  }
}

export { isUserCancel, readableError } from './errors'
export { syncAutoSign } from './autoSignSync'
export type { Session, TransactResult }
