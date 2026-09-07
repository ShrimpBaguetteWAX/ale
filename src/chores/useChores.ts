import { useEffect, useRef, useState } from 'react'
import type { Player } from '@/chain/types'
import { CHORE_CHECKS, type ChoreKey } from './checks'
import { onChoreRefresh } from './signal'

/**
 * The menu's "something is waiting for you here" dots.
 *
 * Seven checks on seven timers would be seven bursts of requests landing
 * together every few minutes, which is the failure mode this is built to
 * avoid. Instead there is one clock, and on each tick **at most one** check
 * runs — whichever is furthest past its own due time.
 *
 * That gives a ceiling on the request rate that does not depend on how many
 * checks there are: one every `TICK`. Adding an eighth indicator later costs
 * nothing extra at the network, it only lengthens the queue. The per-check
 * `every` still decides how fresh each answer is; the scheduler only decides
 * when it is that check's turn.
 *
 * The exception is a queue an action caused, which drains on `SIGNAL_TICK`
 * with the dot the action changed at its head. Idling is what the four-second
 * ceiling is for; the seconds after a signature are not idling, and at one
 * per four seconds a claimed quest kept its dot for twelve of them. It is
 * still one request at a time, still finite — eight checks at most, most of
 * them answering from cache — and it returns to the idle pace by itself.
 *
 * Nothing runs while the tab is hidden, and everything is due on the first
 * tick after it comes back — so a player returning to a backgrounded tab gets
 * the queue drained one request at a time rather than all at once.
 */

/** The floor on how often any request may leave, in ms. */
const TICK = 4_000

/** A first pass shortly after login, rather than waiting out a whole tick. */
const FIRST_TICK = 800

/**
 * The floor while draining the batch one action woke.
 *
 * The idle ceiling is about being a good neighbour to public nodes over an
 * hour. It is the wrong number for the seconds after a player signs
 * something: an action wakes every dot built on the player row — eight of
 * them — and at one per four seconds the quest dot was the third in line, so
 * claiming a quest left it lit for eight to twelve seconds while the player
 * watched. The queue this drains exists only because somebody just acted, it
 * is bounded by the number of checks, and most of it answers from cache.
 */
const SIGNAL_TICK = 700

export type ChoreState = Partial<Record<ChoreKey, boolean>>

export function useChores(
  player: Player | null | undefined,
  /** The section the player is looking at, from the router. */
  pathname: string,
): ChoreState {
  const [state, setState] = useState<ChoreState>({})

  /*
     Due times live in a ref, not in state: they change on every tick and
     nothing renders from them, so putting them in state would re-render the
     whole shell four times a minute for nothing.
  */
  const due = useRef<Map<ChoreKey, number>>(new Map())
  const running = useRef(false)
  /** Keys whose next run must bypass the cache. See the effect below. */
  const forced = useRef<Set<ChoreKey>>(new Set())
  /**
   * Keys an action woke, as against ones that simply came due.
   *
   * They go first and they drain on `SIGNAL_TICK`, because a player is
   * watching the result of something they just did. Emptied as they run, so
   * the queue returns to its idle pace on its own.
   */
  const signalled = useRef<Set<ChoreKey>>(new Set())
  /** Lets the signal wake the scheduler instead of waiting for its interval. */
  const kick = useRef<() => void>(() => {})
  const wallet = player?.wallet

  /* A new wallet invalidates every answer. */
  useEffect(() => {
    due.current = new Map()
    forced.current = new Set()
    setState({})
  }, [wallet])

  /*
     Spending or earning something means the player just acted, and the
     section they are standing in is the one that acted. Its dot is now
     suspect — waiting out the normal interval would leave it lit for up to
     half an hour after the thing it points at was already done, which is how
     an indicator teaches people to ignore it.

     Marked due immediately *and* forced past the cache. The screen behind it
     refreshes its own reads after an action, but not necessarily before this
     runs, and reading the pre-action cooldown would light the dot straight
     back up.
  */
  /*
     A screen telling us outright that it changed something. This is the
     precise path: the section is named rather than inferred, so it works even
     when an action moves nothing the player row shows — claiming from the
     candle, for one, pays out to the wallet rather than to a balance here.
  */
  useEffect(
    () =>
      onChoreRefresh((key, force) => {
        if (force) forced.current.add(key)
        signalled.current.add(key)
        due.current.set(key, 0)
        /* Not on the next interval tick, which could be a full four seconds
           away: the action has already landed, so the answer is available
           now. */
        kick.current()
      }),
    [],
  )

  /*
     The safety net under that, for any action not wired to the signal: if a
     balance moved, the player acted, and the section they are standing in is
     the one that acted. Both paths mark the same key, and marking it twice
     costs nothing — the scheduler still runs it once.
  */
  const purse = player ? JSON.stringify(player.activestats) : ''
  const lastPurse = useRef(purse)
  useEffect(() => {
    if (lastPurse.current === purse) return
    lastPurse.current = purse
    const here = CHORE_CHECKS.find((c) => c.to === pathname)
    if (!here) return
    forced.current.add(here.key)
    signalled.current.add(here.key)
    due.current.set(here.key, 0)
    kick.current()
  }, [purse, pathname])

  /*
     `player` is read through a ref so the scheduler is not torn down and
     rebuilt every time a balance moves — which would reset the clock and, for
     an active player, mean the later checks never came due at all.
  */
  const playerRef = useRef(player)
  playerRef.current = player

  useEffect(() => {
    if (!wallet) return
    let live = true
    let soon: ReturnType<typeof setTimeout> | undefined

    const step = async () => {
      const now = Date.now()
      const current = playerRef.current
      if (!live || !current) return
      if (typeof document !== 'undefined' && document.hidden) return
      if (running.current) return

      const ready = CHORE_CHECKS.filter((c) => (due.current.get(c.key) ?? 0) <= now)

      /*
         What the player is owed an answer about first.

         A dot whose own table the action changed leads: that is the section
         they acted in and the one they are most likely looking at. Then the
         rest of the batch that action woke. Only with none of those left does
         this fall back to the idle rule, which is the most overdue check.

         Before this the pick was the idle rule alone, and every woken dot
         arrived at whatever place declaration order put it in — quests was
         third, so a claimed quest stayed lit for three ticks.
      */
      let pick =
        ready.find((c) => forced.current.has(c.key)) ??
        ready.find((c) => signalled.current.has(c.key)) ??
        null

      if (!pick) {
        let worst = 0
        for (const check of ready) {
          const overdue = now - (due.current.get(check.key) ?? 0)
          if (!pick || overdue > worst) {
            pick = check
            worst = overdue
          }
        }
      }
      if (!pick) return

      running.current = true
      /*
         Booked before the request, not after. A check that throws or hangs
         would otherwise come due again on the very next tick and retry in a
         tight loop against an endpoint that is already unhappy.
      */
      due.current.set(pick.key, now + pick.every)

      /* `delete` reports whether it was there, which is exactly the question. */
      const force = forced.current.delete(pick.key)
      signalled.current.delete(pick.key)

      try {
        const flag = await pick.run(current, force)
        if (!live) return
        setState((prev) => (prev[pick.key] === flag ? prev : { ...prev, [pick.key]: flag }))
      } catch {
        /* An indicator is a convenience. A failed check leaves the dot as it
           was and tries again when its turn comes round; surfacing an error
           for it would be louder than the thing it is reporting. */
      } finally {
        running.current = false
        /*
           Straight on to the rest of the batch, at the faster pace. The queue
           is finite and was caused by something the player just did; once it
           is empty this stops scheduling and the idle interval takes over.
        */
        if (live && signalled.current.size > 0) {
          clearTimeout(soon)
          soon = setTimeout(() => void step(), SIGNAL_TICK)
        }
      }
    }

    /*
       A signal runs the scheduler now rather than on its next interval tick,
       which could be a full four seconds away. Still through the `running`
       guard and still one at a time — this changes when the queue is looked
       at, not how many requests may be in flight.
    */
    kick.current = () => {
      clearTimeout(soon)
      soon = setTimeout(() => void step(), 0)
    }

    const first = setTimeout(() => void step(), FIRST_TICK)
    const timer = setInterval(() => void step(), TICK)

    /* Coming back to the tab should not wait out a tick. */
    const onVisible = () => {
      if (!document.hidden) void step()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      live = false
      kick.current = () => {}
      clearTimeout(soon)
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [wallet])

  return state
}
