import { useEffect, useState } from 'react'
import { fetchMaintenance } from '@/chain/queries'
import type { Maintenance } from '@/chain/types'

/**
 * How often to ask whether the game is paused.
 *
 * Two rates, because the question is worth very different amounts at the two
 * moments it gets asked.
 *
 * Running, nobody is waiting on the answer. A pause is an admin action, and
 * the contracts start rejecting the moment it lands whether or not the screen
 * has caught up — so this is a courtesy, not a safety net, and five minutes is
 * a fair price for it. The app already spends about 1.5 network checks a
 * minute on the menu indicators; a minute-by-minute pause check would have
 * been most of that again for a flag that is false all year.
 *
 * Paused, the player is sitting on a dead screen with nothing to do but wait,
 * and notices are appended to the row while they wait. That is the one moment
 * worth spending requests on.
 */
const WHILE_RUNNING = 5 * 60_000
const WHILE_PAUSED = 20_000

export interface MaintenanceState {
  /** Undefined until the first read lands — not yet known, rather than false. */
  paused: boolean | undefined
  /** Oldest first, as the contract stores them. */
  updates: string[]
}

/**
 * Watch `admin.ale/maintenance`.
 *
 * Deliberately not `useChainQuery`: that reads when its key changes, and this
 * has no key — it is the same row for ever, and what matters is re-reading it
 * on a clock so the screen can put itself away without the player reloading.
 *
 * One loop that schedules its own next run, rather than an interval rebuilt
 * from state. Keying the timer on `paused` would tear the effect down and
 * start it again on the read that first answers the question, which costs a
 * second request on every boot to learn what was just learned.
 */
export function useMaintenance(): MaintenanceState {
  const [state, setState] = useState<MaintenanceState>({
    paused: undefined,
    updates: [],
  })

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    /* Kept across failures so an outage that stops answering keeps the fast
       cadence — the player is still waiting, and the node will come back. */
    let delay = WHILE_RUNNING

    const loop = async () => {
      try {
        /* Always fresh. A row cached from before a pause would let the game
           look open to somebody who refreshed to find out why it is not. */
        const row: Maintenance | undefined = await fetchMaintenance(true)
        if (!alive) return

        const paused = row ? !!row.game_paused : false
        setState({ paused, updates: row?.maintenance_updates ?? [] })
        delay = paused ? WHILE_PAUSED : WHILE_RUNNING
      } catch {
        /*
           A row that cannot be read is not a pause. A node hiccup must never
           put a working game behind this screen, so a failure leaves the last
           known state standing and simply tries again.
        */
      }

      if (alive) timer = setTimeout(() => void loop(), delay)
    }

    void loop()

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  return state
}
