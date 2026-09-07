import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import { refreshChore } from '@/chores/signal'
import type { ChoreKey } from '@/chores/checks'
import { readableError } from '@/wharf/errors'
import { cacheDropTable, type TableKey } from '@/chain/tables'
import { confirmThen, CONFIRM_ATTEMPTS, CONFIRM_INTERVAL_MS } from '@/chain/confirm'

/**
 * Signing something, and everything that has to happen around it.
 *
 * Seven screens had written the same twenty lines: guard on a session, mark
 * which button is working, clear the last error and the last notice, sign,
 * wait for the chain to catch up, tell the chore dot, say what happened, and
 * put the button back whatever the outcome. Forty-four pieces of state
 * between them for one idea.
 *
 * The waiting is the part worth having in one place. After `transact`
 * resolves, the API node has not necessarily served the new row yet — so
 * every screen re-read on a fixed timer and hoped. That loop now lives here,
 * once, which is what makes it replaceable: when a read can say for itself
 * whether the change has landed, only this file changes.
 *
 * `settled` is the first step of that. Quests already had it — it re-reads
 * the board and stops as soon as the board shows the claim — and it belongs
 * to every action, not to the one screen that happened to write it.
 */

export interface RunOptions<T> {
  /**
   * What to re-read once the action is signed. Usually the screen's own
   * loader. The player row is always refreshed alongside it.
   */
  after?: () => Promise<T>
  /**
   * True once the fresh read shows the change, which ends the waiting early.
   *
   * Without one the loop runs its full length whatever happens, which is
   * both slower than it needs to be and unable to tell "not yet" from
   * "never".
   */
  settled?: (fresh: T) => boolean
  /**
   * What the action left stale, from `DIRTIES` in `wharf/actions.ts`.
   *
   * Dropped the moment the signature comes back, before anything is re-read.
   * The screen that acted was already re-reading past the cache, so this is
   * not for its benefit — it is for every other screen. Ascend a fighter and
   * the market would go on serving the roster it read before, for as long as
   * its TTL had left, with no way to tell it otherwise. `cacheDrop` has been
   * in this codebase since the beginning and was called from nowhere.
   */
  dirties?: readonly TableKey[]
  /** The chore dot this action clears, if any. */
  chore?: ChoreKey
  /**
   * Ran once after the chain has caught up, before the notice is shown.
   *
   * Awaited, because some screens have a second read to make that is not
   * worth repeating on every attempt — the shop's cooldowns move once and
   * stay moved.
   */
  onSettled?: () => void | Promise<void>
  /** How many times to re-read, and how far apart. */
  attempts?: number
  intervalMs?: number
}

/**
 * What the player's own numbers look like right now.
 *
 * The default answer to "has the chain caught up", and it needs no help from
 * the caller: almost everything a player signs moves one of these. A payday
 * spends credits, a dungeon spends energy, a claim adds to a balance, a
 * travel spends action points.
 *
 * `action_point_update` is left out on purpose. It is the bookkeeping
 * timestamp behind the points rather than a number anyone is shown, and
 * watching it would mean confirming on a write that changed nothing the
 * player asked for.
 */
function playerFigures(): string | null {
  const s = useGame.getState().player?.activestats
  if (!s) return null
  return [
    s.credits,
    s.gems,
    s.action_points,
    s.unclaimed_gems,
    s.unclaimed_credits,
    s.unclaimed_shards,
    s.unclaimed_tlm,
    s.unclaimed_wax,
  ].join('|')
}

export interface ActionState {
  /**
   * Which action is working, by the key the caller passed. One string rather
   * than a flag per button: two actions cannot be signed at once anyway, and
   * a screen with nine buttons had nine booleans to keep in step.
   */
  busy: string | null
  error: string | null
  notice: string | null
  run: <T>(
    key: string,
    act: () => Promise<unknown>,
    done: string,
    opts?: RunOptions<T>,
  ) => Promise<void>
  /** For a screen that raises its own errors — a failed check before signing. */
  setError: (message: string | null) => void
  setNotice: (message: string | null) => void
}

export function useAction(): ActionState {
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /*
     A signature can outlive the screen that asked for it — the wallet dialog
     is modal to the browser, not to the route — so nothing is written back
     to a component that has already gone.
  */
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback(
    async <T,>(
      key: string,
      act: () => Promise<unknown>,
      done: string,
      opts: RunOptions<T> = {},
    ) => {
      if (!session) return

      const {
        after,
        settled,
        chore,
        dirties,
        onSettled,
        attempts = CONFIRM_ATTEMPTS,
        intervalMs = CONFIRM_INTERVAL_MS,
      } = opts

      setBusy(key)
      setError(null)
      setNotice(null)

      try {
        await act()

        /*
           Before anything is re-read, not after.

           A drop that happens after the first re-read would be dropping the
           entry that read just wrote — throwing away a fresh answer and
           leaving the stale one nowhere. Order is the whole correctness
           argument here, and it is one line apart from being wrong.
        */
        for (const table of dirties ?? []) cacheDropTable(table)

        /*
           Wait for the chain, and stop as soon as it has caught up.

           What counts as caught up is the caller's `settled` where it has
           one — the quest board no longer holding the quest that was just
           claimed is a better signal than any balance. Where it has none,
           the player's own figures are the signal, and they need no help:
           almost everything a player signs spends or gains something.

           An action that moves neither — setting a marker, renaming an
           avatar — has nothing to watch, so it waits out the full count
           exactly as it did before. That is the floor, not the common case.
        */
        const before = playerFigures()
        await confirmThen<T>(
          async () => {
            const [fresh] = await Promise.all([
              after ? after() : Promise.resolve(undefined as T),
              refreshPlayer({ force: true }),
            ])
            return fresh as T
          },
          (fresh) => {
            if (settled && after) return settled(fresh)
            const now = playerFigures()
            /* A read that came back without a player row is the node not
               having answered properly, which is "not yet". */
            return now !== null && now !== before
          },
          { attempts, intervalMs },
        )

        await onSettled?.()
        if (!alive.current) return
        /* The dot this action was about, so it stops waiting for its own
           timer to notice what the player just did. */
        if (chore) refreshChore(chore)
        setNotice(done)
      } catch (err) {
        if (alive.current) setError(readableError(err))
      } finally {
        if (alive.current) setBusy(null)
      }
    },
    [session, refreshPlayer],
  )

  return { busy, error, notice, run, setError, setNotice }
}
