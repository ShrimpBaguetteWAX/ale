import {
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
import { CHAIN_ID } from '@/chain/config'
import { endpointPool } from '@/chain/endpoints'
import { isUserCancel } from './errors'

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

  kit = new SessionKit(
    {
      appName: 'Alien Legends',
      chains: [chain],
      ui: new WebRenderer(),
      walletPlugins: [
        new WalletPluginAnchor(),
        new WalletPluginCloudWallet(),
      ],
    },
    {
      /*
         The game pays the network cost of every transaction, by putting a
         `greymassnoop::noop` authorised by `cpu.ale@cpu` in front of the
         player's own action. See `cosign.ts` for what that permission can and
         cannot do, and for why the key it needs is in the bundle.
      */
      transactPlugins: [new CosignPlugin()],
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
): Promise<TransactResult> {
  return session.transact(
    {
      actions: actions.map((a) => ({
        ...a,
        authorization: [session.permissionLevel],
      })),
    },
    { broadcast: true, expireSeconds: 120 },
  )
}

export { isUserCancel, readableError } from './errors'
export type { Session, TransactResult }
