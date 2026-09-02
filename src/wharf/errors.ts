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
 * Where WharfKit persists the active session. Checking this directly lets the
 * app decide whether a restore is even possible before importing the SDK.
 */
const SESSION_STORAGE_KEY = 'wharf--session'

export function hasStoredSession(): boolean {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY) !== null
  } catch {
    return false
  }
}
