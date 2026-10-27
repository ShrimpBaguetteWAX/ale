import { PublicKey } from '@wharfkit/antelope'
import { Session, isSessionKeyWallet, type AnyAction } from '@wharfkit/session'
import { AUTO_SIGN_PERMISSION, groupsFrom, rememberGroups, whitelistFor, type AutoSignAction } from './autoSign'

/**
 * Keeping this browser's auto-signing true to the chain.
 *
 * Auto-signing can be on in several browsers at once: each keeps its own key,
 * and every key sits under the one `alienlegends` permission on the account,
 * linked to one shared list of actions. So any browser can change what the
 * others are allowed to sign, or take their key away — and a browser that
 * only believed what it stored would go on signing with a key the chain no
 * longer accepts, every auto-signed action failing until the player found
 * the switch.
 *
 * So the chain decides: on load, before the settings are shown, and after
 * a key's signature is turned down. A key the permission no longer holds is
 * dropped here; the actions it may sign are the ones still linked.
 */

/** The account's `alienlegends` permission, as far as auto-signing cares. */
export interface ChainPermission {
  /** Its keys, normalised, so they compare as strings. */
  keys: string[]
  /** The actions linked to it. */
  links: AutoSignAction[]
}

export interface AutoSignReading {
  /** The groups every device may sign, from the chain. */
  groups: string[]
  /** Whether this browser holds a key the chain still accepts. */
  active: boolean
  /** Whether the permission is on the account at all. */
  exists: boolean
}

/** A key in the one spelling, whichever prefix it arrived with. */
export function normaliseKey(key: string): string {
  return String(PublicKey.from(key))
}

/**
 * What this browser should believe, given what it holds and what the chain
 * says. Pure, so the rules are testable without a chain.
 */
export function reconcile(localKey: string | null, chain: ChainPermission | null): AutoSignReading {
  const groups = chain ? groupsFrom(chain.links) : []
  const active = !!localKey && !!chain && chain.keys.includes(localKey)
  return { groups, active, exists: !!chain }
}

/** Read the permission off the account. Null when it is not there; throws when the node does. */
export async function readPermission(session: Session): Promise<ChainPermission | null> {
  const account = await session.client.v1.chain.get_account(session.actor)
  const perm = account.permissions.find((p) => String(p.perm_name) === AUTO_SIGN_PERMISSION)
  if (!perm) return null
  const raw = perm as unknown as {
    required_auth: { keys: { key: unknown }[] }
    linked_actions?: { account: unknown; action?: unknown }[]
  }
  return {
    keys: raw.required_auth.keys.map((k) => normaliseKey(String(k.key))),
    links: (raw.linked_actions ?? []).map((l) => ({ contract: String(l.account), action: String(l.action ?? '') })),
  }
}

/** This browser's key, if it holds one. */
export function localKey(session: Session): string | null {
  const plugin = session.walletPlugin
  return plugin && isSessionKeyWallet(plugin) ? normaliseKey(plugin.getPublicKey()) : null
}

/**
 * Bring this browser in line with the chain, and say where it stands.
 *
 * Returns null, changing nothing, when the chain cannot be read: a node
 * that does not answer is not a reason to switch a player's auto-signing
 * off.
 */
export async function syncAutoSign(session: Session): Promise<AutoSignReading | null> {
  let chain: ChainPermission | null
  try {
    chain = await readPermission(session)
  } catch {
    return null
  }
  const mine = localKey(session)
  const reading = reconcile(mine, chain)
  const plugin = session.walletPlugin
  const list = whitelistFor(reading.groups)

  if (mine && plugin && isSessionKeyWallet(plugin)) {
    if (reading.active) {
      /* Still ours: sign only what is still linked. */
      ;(plugin as unknown as { whitelist: unknown }).whitelist = list
    } else {
      /* Taken away elsewhere: back to the wallet for everything, as WharfKit itself does on removal. */
      ;(session as unknown as { _walletPlugin: unknown })._walletPlugin = plugin.getPrimaryWallet()
    }
    await session.onPersist?.(session)
  }
  /* What the next setup or change starts from: the shared list, not this browser's memory. */
  if (session.sessionKeyManager) session.sessionKeyManager.whitelist = list
  rememberGroups(reading.groups)
  return reading
}

/**
 * Whether an error is the chain turning down who signed, rather than what
 * was asked — the signature of a key that is no longer on the permission,
 * or of an action no longer linked to it.
 */
export function isAuthorityError(err: unknown): boolean {
  const text = (() => {
    try {
      return JSON.stringify(err) + String((err as { message?: unknown })?.message ?? err)
    } catch {
      return String(err)
    }
  })()
  return /unsatisfied_authorization|irrelevant_auth|missing_auth|missing required authority|do not satisfy declared authorit|provided keys, permissions, and delays/i.test(
    text,
  )
}

/** Whether this transaction is going to be signed by this browser's key. */
export function signsWithKey(session: Session, actions: AnyAction[]): boolean {
  const plugin = session.walletPlugin
  return !!plugin && isSessionKeyWallet(plugin) && plugin.allActionsWhitelisted(actions)
}

/** The same account through the wallet alone, for a transaction the key may not sign. */
export function walletOnly(session: Session): Session {
  const plugin = session.walletPlugin
  if (!plugin || !isSessionKeyWallet(plugin)) return session
  return new Session(
    { chain: session.chain, permissionLevel: session.permissionLevel, walletPlugin: plugin.getPrimaryWallet() },
    { fetch: session.fetch, ui: session.ui },
  )
}
