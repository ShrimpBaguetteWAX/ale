import { useEffect, useRef, useState } from 'react'

/**
 * How long a chance-to-win gauge takes to reach a new value. The arc's CSS
 * transition (dungeon.css) runs for the same time, so the figure counts in
 * step with the fill.
 */
export const GAUGE_MS = 600

/**
 * A number that travels to its new value instead of jumping to it.
 *
 * It starts at the value it is first given, so a gauge that appears already
 * knowing the odds shows them at once; only a change counts. A count cut off
 * by the next change carries on from wherever it had got to. A player who
 * asked for less motion gets each new value straight away.
 */
export function useCountUp(target: number | null, ms = GAUGE_MS): number | null {
  const [shown, setShown] = useState(target)
  const at = useRef(target)

  useEffect(() => {
    const from = at.current
    const still =
      target === null ||
      from === null ||
      from === target ||
      typeof requestAnimationFrame !== 'function' ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    if (still) {
      at.current = target
      setShown(target)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      /* The ease the arc uses: quick away, settling into the value. */
      const value = from + (target - from) * (1 - Math.pow(1 - k, 3))
      at.current = value
      setShown(Math.round(value))
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, ms])

  return shown
}
