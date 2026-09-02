import type { ChoreKey } from './checks'

/**
 * "I just did the thing that dot is about."
 *
 * The scheduler re-checks a section on its own interval, which is right for
 * noticing that the world moved — a quest completing because a fight paid
 * out, boost decaying past the mark. It is wrong for the player's own
 * actions: buying the free energy and then watching its dot sit there for
 * another three minutes is how an indicator teaches people to stop trusting
 * it.
 *
 * So every screen that performs an action calls this the moment it succeeds,
 * naming what it changed. The check runs on the next tick and bypasses the
 * cache, because the screen's own reads may not have landed yet and a cached
 * answer from before the action would light the dot straight back up.
 *
 * A module-level emitter rather than context or a store: the shell is the
 * only listener, the screens only ever fire, and threading a callback through
 * seven routes to say one word would be worse than this.
 */

type Listener = (key: ChoreKey) => void

const listeners = new Set<Listener>()

/** Called by screens after an action that could change their own indicator. */
export function refreshChore(key: ChoreKey): void {
  for (const fn of listeners) fn(key)
}

/** Subscribed by `useChores`. Returns the unsubscribe. */
export function onChoreRefresh(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
