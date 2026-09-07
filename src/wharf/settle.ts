import { announceTableDrop, cacheDropTable, type TableKey } from '@/chain/tables'
import { refreshChore } from '@/chores/signal'
import { choresFor, type ChoreKey } from '@/chores/checks'

/**
 * What has to happen after a transaction lands, for the screens that do their
 * own waiting.
 *
 * Most screens sign through `useAction`, which owns this. Six do not, and for
 * good reason: a travel plays a wormhole over the top of it, a dungeon and an
 * arena play a fight, and those have choreography a generic hook cannot time.
 * They kept their own loops.
 *
 * What they did not keep was any of the bookkeeping around them. `DIRTIES`
 * named what each of those actions changed and nothing read it for these six,
 * so a travel left every other screen on cached rows until their TTL ran out
 * and lit no indicator at all — finish a quest by walking somewhere and the
 * dot stayed dark. The declaration existed; only the call was missing.
 */

/**
 * Every dot built on something this action changed.
 *
 * Shared with `useAction` rather than written twice — this pairing has
 * already drifted once, and a second copy is a second place to forget.
 *
 * Forced only where the action touched that dot's *own* data. Quest progress
 * is a lifetime counter on the player row, so a travel moves it without
 * moving the quest board: that check re-reads the board it already holds and
 * compares it against the player row that was just refreshed. No request.
 */
export function wakeChores(dirties: readonly TableKey[]): void {
  const seen = new Set<ChoreKey>()
  for (const table of dirties) {
    for (const chore of choresFor(table)) {
      const force = table !== 'player'
      if (force || !seen.has(chore.key)) refreshChore(chore.key, force)
      seen.add(chore.key)
    }
  }
}

/**
 * Forget what the action changed, tell the screens, and wake the dots.
 *
 * For a screen that has already finished waiting for the chain. `useAction`
 * cannot use this as-is: it has to drop *before* it re-reads and announce
 * *after*, or its own confirmation reads a cache that still holds the answer
 * from before the transaction. A screen calling this has done its waiting
 * already, so there is nothing left to race.
 */
export function settle(dirties: readonly TableKey[]): void {
  for (const table of dirties) cacheDropTable(table, undefined, false)
  for (const table of dirties) announceTableDrop(table)
  wakeChores(dirties)
}
