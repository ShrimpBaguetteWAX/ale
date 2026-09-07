/**
 * Waiting for the chain to catch up with something that was just signed.
 *
 * `transact` resolving means the transaction was accepted, not that the node
 * answering the next read has the block yet. Every screen used to cope with
 * that by re-reading on a fixed timer and hoping — six rounds at 900ms,
 * whether the answer arrived on the first or never.
 *
 * Two things are wrong with a fixed count. It is slow when the chain is
 * quick: a reroll that landed on the first read still left every button dead
 * for another five seconds. And it cannot tell "not yet" from "never", so it
 * spends the same twelve requests either way.
 *
 * So the caller says what changing looks like, and this stops as soon as it
 * has. What it must never do is stop *early* on a bad answer, which is the
 * failure mode this whole file is written around: under load a WAX node
 * answers a table read with an empty result rather than an error, and an
 * empty answer is the chain not having caught up — never the row being gone.
 * `hasMoved` is only ever asked about a read that succeeded, and a read that
 * throws is a round that did not happen rather than a reason to stop.
 */

/**
 * Six rounds at 900ms — the longer of the two the screens used to use.
 *
 * It is a ceiling now rather than a schedule: with a `hasMoved` that can
 * answer, the common case is one round.
 */
export const CONFIRM_ATTEMPTS = 6
export const CONFIRM_INTERVAL_MS = 900

export interface ConfirmOptions {
  attempts?: number
  intervalMs?: number
  /** Overridable so tests do not sit through real timers. */
  wait?: (ms: number) => Promise<void>
}

export interface ConfirmResult<T> {
  /** The last successful read, if there was one. */
  value: T | undefined
  /** Whether a read ever showed the change. */
  confirmed: boolean
  /**
   * Rounds actually spent. Returned rather than logged so the cost of an
   * action is something that can be asserted on.
   */
  rounds: number
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function confirmThen<T>(
  read: () => Promise<T>,
  hasMoved: (fresh: T) => boolean,
  {
    attempts = CONFIRM_ATTEMPTS,
    intervalMs = CONFIRM_INTERVAL_MS,
    wait = sleep,
  }: ConfirmOptions = {},
): Promise<ConfirmResult<T>> {
  let value: T | undefined
  let rounds = 0

  for (let i = 0; i < attempts; i++) {
    await wait(intervalMs)
    rounds++

    try {
      const fresh = await read()
      value = fresh
      if (hasMoved(fresh)) return { value, confirmed: true, rounds }
    } catch {
      /*
         A read that failed says nothing about whether the transaction
         landed. It is a round that did not happen — and emphatically not an
         error to show the player, who signed something that was accepted.
      */
    }
  }

  return { value, confirmed: false, rounds }
}
