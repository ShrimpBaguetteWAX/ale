import {
  BrowserLocalStorage,
  ChainDefinition,
  Session,
  SessionKit,
  type SerializedSession,
  type TransactResult,
} from '@wharfkit/session'
import WebRenderer from '@wharfkit/web-renderer'
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor'
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet'
import { CosignPlugin } from './cosign'
import { AUTO_SIGN_PERMISSION, savedGroups, whitelistFor } from './autoSign'
import { CHAIN_ID } from '@/chain/config'
import { endpointPool } from '@/chain/endpoints'
import { isUserCancel, SESSION_STORAGE_PREFIX } from './errors'
import { isAuthorityError, signsWithKey, syncAutoSign, walletOnly } from './autoSignSync'

let kit: SessionKit | null = null

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
  /*
     A second browser setting auto-signing up finds keys already on the
     permission, and WharfKit asks whether to add this one or replace them.
     Replacing would leave every other browser signing with a key the chain
     has forgotten, so it is never offered: this browser's key goes beside
     the others, and each is taken away only from its own browser.
  */
  const renderer = () => {
    const ui = new WebRenderer()
    ui.onSessionKeyConflict = async () => 'add'
    return ui
  }

  kit = new SessionKit(
    {
      appName: 'Alien Legends',
      chains: [chain],
      ui: renderer(),
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

/** Restore a previous session without prompting, if one was persisted. */
export async function restore(): Promise<Session | null> {
  const k = await getSessionKit()
  try {
    const session = await k.restore()
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
