import type { PaydayScope } from './rules'

/**
 * Which fighters the blanket payday pays, remembered on this device.
 *
 * The choice is a habit rather than a decision: a player who pays only the
 * benched ones is managing a bill, and will want the same next time. Kept
 * here rather than in the screen so a reload does not quietly put them back
 * on paying for the whole roster.
 */
const KEY = 'al.payscope'

export function recallPayScope(): PaydayScope {
  try {
    return localStorage.getItem(KEY) === 'overdue' ? 'overdue' : 'all'
  } catch {
    /* A private window: the default stands. */
    return 'all'
  }
}

export function rememberPayScope(scope: PaydayScope): void {
  try {
    localStorage.setItem(KEY, scope)
  } catch {
    /* Nothing to do — the screen still works, it just forgets. */
  }
}
