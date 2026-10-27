import type { Session } from '@wharfkit/session'
import { AUTO_SIGN_GROUPS, AUTO_SIGN_PERMISSION, rememberGroups, savedGroups, whitelistFor } from './autoSign'
import { readPermission, syncAutoSign } from './autoSignSync'

/**
 * Setting auto-signing up, changing it and taking it away.
 *
 * Each is one wallet approval: the key is added to the account under its
 * own permission and linked to the chosen actions, or the permission is
 * removed again. The chain is what counts, so the groups shown come from
 * there — every browser sees the one shared list, whichever set it.
 */

export interface AutoSignState {
  /** Groups whose every action the account's keys may sign, from the chain. */
  groups: string[]
  /** Whether a key exists and is ready to sign in this browser. */
  active: boolean
  /** Auto-signing is on for the account, but not with a key in this browser. */
  elsewhere: boolean
}

const EMPTY: AutoSignState = { groups: [], active: false, elsewhere: false }

type Keyed = Session & { walletPlugin: { whitelist?: unknown } }

/**
 * Where auto-signing stands, from the chain — and this browser brought in
 * line with it first, so a key taken away elsewhere reads as off here.
 */
export async function autoSignState(session: Session | null): Promise<AutoSignState> {
  if (!session?.getSessionKeyStatus) return EMPTY
  const reading = await syncAutoSign(session)
  /* The chain could not be read: the last choice made here is the best guess. */
  if (!reading) return { ...EMPTY, groups: savedGroups() }
  return { groups: reading.groups, active: reading.active, elsewhere: reading.exists && !reading.active }
}

/**
 * Applies a new set of groups: one wallet approval, whether that is the
 * first key, another browser's key beside the ones already there, a change
 * to what they may sign, or turning it off. The old whitelist goes back on
 * failure, so a declined approval leaves the page and the chain saying the
 * same thing.
 */
export async function applyAutoSign(session: Session | null, groupIds: readonly string[]): Promise<void> {
  if (!session?.getSessionKeyStatus) throw new Error('Connect your wallet first.')

  const wanted = AUTO_SIGN_GROUPS.filter((g) => groupIds.includes(g.id)).map((g) => g.id)
  const manager = session.sessionKeyManager
  const plugin = (session as Keyed).walletPlugin
  /* Against the chain, not this browser's memory: another one may have changed it. */
  const reading = await syncAutoSign(session)
  const active = reading?.active ?? (await session.getSessionKeyStatus()).active
  const exists = reading?.exists ?? false
  const before = { manager: manager?.whitelist, plugin: active ? plugin.whitelist : undefined }
  const list = whitelistFor(wanted)

  try {
    if (wanted.length === 0) {
      if (active) {
        /* This browser's key; the others, if any, go on signing. */
        await session.removeSessionKey()
      } else if (exists) {
        /* No key here to remove: off from here means off on every device. */
        await removeEverywhere(session)
      }
    } else if (!active) {
      if (manager) manager.whitelist = list
      /* Beside any keys already on the permission — see `ui.onSessionKeyConflict`. */
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

/** Unlink every action and delete the permission, through the wallet. */
async function removeEverywhere(session: Session): Promise<void> {
  const chain = await readPermission(session)
  if (!chain) return
  const auth = [session.permissionLevel]
  await session.transact({
    actions: [
      ...chain.links.map((l) => ({
        account: 'eosio',
        name: 'unlinkauth',
        authorization: auth,
        data: { account: session.actor, code: l.contract, type: l.action },
      })),
      {
        account: 'eosio',
        name: 'deleteauth',
        authorization: auth,
        data: { account: session.actor, permission: AUTO_SIGN_PERMISSION },
      },
    ],
  })
}
