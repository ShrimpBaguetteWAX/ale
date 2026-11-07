import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/** How many a long list draws at first, and adds each time its end comes near. */
export const PROGRESSIVE_STEP = 48

/* How far each list had grown, so leaving a screen and coming back keeps the place. */
const reached = new Map<string, number>()

/** The element a list scrolls inside: its own scroller (a sheet, a panel), or the page. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}

/**
 * A long list drawn as it is scrolled, rather than all at once.
 *
 * A wallet of a thousand fighters drew a thousand cards before the screen
 * would move: fourteen thousand elements and five seconds of a blocked phone
 * on the arena's picker, for the ten cards anyone can see. Now the first
 * `step` are drawn, and the next `step` each time the end of what is drawn
 * comes within a screen or so of the view — well before it is reached, so
 * scrolling never meets an empty edge.
 *
 * Only the drawing is cut. Filters, sorts, counts, auto-pick and "select all"
 * all work on the whole list, as before.
 *
 * - `id` remembers how far a list had grown, so coming back to it (the
 *   fighter opened and closed, the screen left and returned to) keeps the
 *   scroll position rather than shrinking it to the first step.
 * - `atLeast` is an index that must be drawn: the row the Market's arrow
 *   keys have walked to, a fighter opened from a link.
 * - Where there is no IntersectionObserver (the tests' DOM, the SSR
 *   harness) everything is drawn, as it always was.
 *
 * `more` goes after the list's last item, inside the same container: an
 * empty marker the observer watches. It spans every column of a grid.
 */
export function useProgressive<T>(
  items: readonly T[],
  { id, atLeast = -1, step = PROGRESSIVE_STEP }: { id?: string; atLeast?: number; step?: number } = {},
): { shown: readonly T[]; more: ReactNode } {
  const [count, setCount] = useState(() => Math.max(step, (id && reached.get(id)) || 0))
  const marker = useRef<HTMLDivElement>(null)
  const watching = typeof IntersectionObserver !== 'undefined'
  const limit = watching ? Math.max(count, atLeast + 1) : items.length
  const rest = items.length > limit

  useEffect(() => {
    if (id) reached.set(id, count)
  }, [id, count])

  /*
     A new observer for every step: one already on screen reports at once, so
     a short page or a tall screen keeps adding until the marker is out of
     reach, and then waits for the scroll.
  */
  useEffect(() => {
    const el = marker.current
    if (!el || !rest) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setCount((c) => Math.max(c, limit) + step)
      },
      { root: scrollParent(el), rootMargin: '1200px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rest, limit, step])

  /* The same array until the list or the step changes, so what is worked out per drawn item can be memoised on it. */
  const shown = useMemo(() => (rest ? items.slice(0, limit) : items), [items, rest, limit])

  return {
    shown,
    more: rest ? <div ref={marker} className="progressive__more" aria-hidden="true" /> : null,
  }
}
