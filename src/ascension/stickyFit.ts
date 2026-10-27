import { useLayoutEffect, useState } from 'react'

/**
 * A column that stays in view while the page scrolls past a longer one
 * beside it — the altar and the deal beside a list of seventy fighters — so
 * nothing on the board scrolls but the page.
 *
 * One that fits the window sticks at its `top`. One taller than the window
 * sticks only once its foot is in view, so every part of it can still be
 * scrolled to: the hook works out how far above the top it may ride and
 * hands that to the CSS as `--lift`, which the column's `top` takes off.
 * Returns a callback ref.
 */
export function useStickyFit<T extends HTMLElement>(): (el: T | null) => void {
  const [el, setEl] = useState<T | null>(null)
  useLayoutEffect(() => {
    if (!el) return
    const narrow = window.matchMedia('(max-width: 1023px)')
    const fit = () => {
      el.style.removeProperty('--lift')
      const top = parseFloat(getComputedStyle(el).top) || 0
      /* A phone-sized window's tab bar covers the foot of the page. */
      const foot = (narrow.matches ? 64 : 0) + 16
      el.style.setProperty('--lift', `${Math.min(0, window.innerHeight - top - foot - el.offsetHeight)}px`)
    }
    fit()
    window.addEventListener('resize', fit)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    ro?.observe(el)
    return () => {
      window.removeEventListener('resize', fit)
      ro?.disconnect()
    }
  }, [el])
  return setEl
}
