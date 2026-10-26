/**
 * Error helpers, deliberately free of any WharfKit import.
 *
 * Screens need to render a failure message, but pulling them in from
 * `session.ts` would drag the whole wallet SDK (~190KB gzipped) into the
 * initial bundle for anyone who merely opens the landing page.
 */

export function isUserCancel(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /cancel|abort|reject|closed|declin/i.test(msg)
}

/**
 * Turn the chain's error blobs into something a player can read. eosio buries
 * the useful part in `json.error.details[0].message`, prefixed with
 * "assertion failure with message:".
 */
export function readableError(err: unknown): string {
  const anyErr = err as {
    message?: string
    response?: { json?: { error?: { details?: { message?: string }[] } } }
    json?: { error?: { details?: { message?: string }[] } }
  }
  const details = anyErr?.response?.json?.error?.details ?? anyErr?.json?.error?.details
  const detail = details?.[0]?.message
  if (detail) return detail.replace(/^assertion failure with message:\s*/i, '')

  const msg = anyErr?.message ?? String(err)
  return msg.replace(/^assertion failure with message:\s*/i, '')
}

/**
 * The prefix WharfKit's storage puts this game's sessions under.
 *
 * Without one, every WharfKit app keeps its login at `wharf--session`, and
 * apps that share an origin share it. The alpha and the Planetary Defense
 * deck are both on shrimpbaguettewax.github.io, so the game restored the
 * deck's login — auto-sign key and all — and turning auto-sign on here
 * offered to relink the deck's `pdauto` permission.
 */
export const SESSION_STORAGE_PREFIX = 'ale'

/**
 * Where WharfKit persists the active session. Checking this directly lets the
 * app decide whether a restore is even possible before importing the SDK.
 */
const SESSION_STORAGE_KEY = `wharf-${SESSION_STORAGE_PREFIX}-session`
const LEGACY = ['session', 'sessions'] as const

export function hasStoredSession(): boolean {
  try {
    adoptLegacySession()
    return localStorage.getItem(SESSION_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * Carries a login from before the prefix over, once, so nobody is signed out
 * by it — but only on a host of the game's own. On github.io the old keys may
 * well be another app's, which is the whole reason for the prefix.
 */
function adoptLegacySession() {
  if (location.hostname.endsWith('github.io')) return
  if (localStorage.getItem(SESSION_STORAGE_KEY) !== null) return
  for (const key of LEGACY) {
    const value = localStorage.getItem(`wharf--${key}`)
    if (value === null) continue
    localStorage.setItem(`wharf-${SESSION_STORAGE_PREFIX}-${key}`, value)
    localStorage.removeItem(`wharf--${key}`)
  }
}
