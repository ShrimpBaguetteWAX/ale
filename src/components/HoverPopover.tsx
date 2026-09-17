import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Gap between the hovered element and the popover, and from the screen edge. */
const GAP = 8
const EDGE = 16

/**
 * Whether this device hovers with a precise pointer — a mouse or trackpad.
 *
 * Read once per mount: a touch screen synthesises hover on tap, which would
 * open a popover under the finger that never closes.
 */
export function canFineHover(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
  )
}

/**
 * Floats \`children\` beside an element on screen, below it where there is
 * room and above it where there is not.
 *
 * Portalled to the body so no clipping or skewed ancestor can cut it, and
 * never a pointer target — it must not take the hover off the element that
 * opened it, or it would close the moment the pointer moved.
 */
export function HoverPopover({ anchor, children }: { anchor: DOMRect; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    const clampX = (x: number) => Math.max(EDGE, Math.min(x, vw - EDGE - width))
    const clampY = (y: number) => Math.max(EDGE, Math.min(y, vh - EDGE - height))
    const centredX = clampX(anchor.left + anchor.width / 2 - width / 2)

    /* Below, then above — and where neither has the room, beside it, so the
       card being read is never the thing covered. */
    const below = anchor.bottom + GAP
    const above = anchor.top - GAP - height
    const right = anchor.right + GAP
    const left = anchor.left - GAP - width
    if (below + height <= vh - EDGE) {
      setPos({ top: below, left: centredX })
    } else if (above >= EDGE) {
      setPos({ top: above, left: centredX })
    } else {
      const top = clampY(anchor.top + anchor.height / 2 - height / 2)
      if (right + width <= vw - EDGE) setPos({ top, left: right })
      else if (left >= EDGE) setPos({ top, left })
      else setPos({ top: clampY(below), left: centredX })
    }
  }, [anchor])

  return createPortal(
    <div
      ref={box}
      className="hoverpop"
      role="tooltip"
      style={
        pos
          ? { top: pos.top, left: pos.left }
          : /* Measured before it is shown, so it never flashes in the corner. */
            { top: 0, left: 0, visibility: 'hidden' }
      }
    >
      {children}
    </div>,
    document.body,
  )
}
