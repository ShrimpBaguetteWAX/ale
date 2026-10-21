import type { Session } from '@wharfkit/session'
import { AUTO_SIGN_GROUPS, groupsFrom, rememberGroups, savedGroups, whitelistFor, type AutoSignAction } from './autoSign'

/**
 * Setting auto-signing up, changing it and taking it away.
 *
 * Each is one wallet approval: the key is added to the account under its
 * own permission and linked to the chosen actions, or the permission is
 * removed again. The chain is what counts, so the groups shown come from
 * there.
 */

export interface AutoSignState {
  /** Groups whose every action the account's session key may sign. */
  groups: string[]
  /** Whether a key exists and is ready to sign in this browser. */
  active: boolean
  /** A key exists on the account but not in this browser, e.g. after clearing site data. */
  elsewhere: boolean
}

const EMPTY: AutoSignState = { groups: [], active: false, elsewhere: false }

type Keyed = Session & {
  walletPlugin: { getWhitelist?: () => { contract: unknown; actions?: unknown[] }[]; whitelist?: unknown }
}

/** What the account's session key may sign right now, read from the chain. */
export async function autoSignState(session: Session | null): Promise<AutoSignState> {
  if (!session?.getSessionKeyStatus) return EMPTY
  try {
    const status = await session.getSessionKeyStatus()
    /* No key yet: the switches still belong to this player, they have simply not set one up. */
    if (!status.exists) return { ...EMPTY, groups: savedGroups() }
    const plugin = (session as Keyed).walletPlugin
    const whitelisted: AutoSignAction[] = (plugin.getWhitelist?.() ?? []).flatMap((entry) =>
      (entry.actions ?? []).map((action) => ({ contract: String(entry.contract), action: String(action) })),
    )
    /* With a key on the account but none here, the saved choice is the best the page can show. */
    const groups = status.active ? groupsFrom(whitelisted) : savedGroups()
    return { groups, active: status.active, elsewhere: status.exists && !status.active }
  } catch {
    return EMPTY
  }
}

/**
 * Applies a new set of groups: one wallet approval, whether that is the
 * first key, a change to what it may sign, or turning the whole thing off.
 * The old whitelist goes back on failure, so a declined approval leaves the
 * page and the chain saying the same thing.
 */
export async function applyAutoSign(session: Session | null, groupIds: readonly string[]): Promise<void> {
  if (!session?.getSessionKeyStatus) throw new Error('Connect your wallet first.')

  const wanted = AUTO_SIGN_GROUPS.filter((g) => groupIds.includes(g.id)).map((g) => g.id)
  const manager = session.sessionKeyManager
  const plugin = (session as Keyed).walletPlugin
  const status = await session.getSessionKeyStatus()
  const before = { manager: manager?.whitelist, plugin: status.active ? plugin.whitelist : undefined }
  const list = whitelistFor(wanted)

  try {
    if (wanted.length === 0) {
      if (status.exists) await session.removeSessionKey()
    } else if (!status.active) {
      if (manager) manager.whitelist = list
      await session.setupSessionKey()
    } else {
      if (manager) manager.whitelist = list
      plugin.whitelist = list
      await session.updateSessionKeyLinks()
    }
  } catch (err) {
    if (manager && before.manager) manager.whitelist = before.manager
    if (before.plugin) plugin.whitelist = before.plugin
    throw err
  }

  rememberGroups(wanted)
}
