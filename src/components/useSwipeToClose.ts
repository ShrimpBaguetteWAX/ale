import { useRef } from 'react'
import type React from 'react'

/**
 * Swipe a bottom sheet down to close it.
 *
 * `panel` goes on the sheet that moves; `grip` is spread onto the part a
 * thumb drags — the head, never the scrolling body, so a list that scrolls
 * is not fought over. The sheet follows the finger down; let go past a
 * third of its travel, or with a flick, and it slides away and closes;
 * otherwise it settles back.
 *
 * A drag that started on a button inside the grip does not also click it.
 */
export function useSwipeToClose<T extends HTMLElement>(
  onClose: () => void,
  /** The sheet's own ref, when it already has one (a modal's, say). */
  existing?: React.RefObject<T | null>,
) {
  const own = useRef<T>(null)
  const panel = existing ?? own
  const drag = useRef<{ y: number; t: number; id: number; dy: number } | null>(null)
  const moved = useRef(false)

  const place = (dy: number, animate: boolean) => {
    const p = panel.current
    if (!p) return
    p.style.transition = animate ? 'transform 200ms cubic-bezier(.2, .8, .3, 1)' : 'none'
    p.style.transform = dy > 0 ? `translateY(${dy}px)` : ''
  }
  const clear = () => {
    const p = panel.current
    if (!p) return
    p.style.transition = ''
    p.style.transform = ''
  }

  const end = (cancelled: boolean) => {
    const d = drag.current
    drag.current = null
    const p = panel.current
    if (!d || !p) return
    const speed = d.dy / Math.max(1, performance.now() - d.t)
    const far = d.dy > Math.min(140, p.offsetHeight / 3)
    if (!cancelled && d.dy > 0 && (far || (d.dy > 30 && speed > 0.6))) {
      place(p.offsetHeight, true)
      window.setTimeout(() => {
        onClose()
        clear()
      }, 200)
    } else {
      place(0, true)
      window.setTimeout(clear, 200)
    }
  }

  const grip = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      moved.current = false
      drag.current = { y: e.clientY, t: performance.now(), id: e.pointerId, dy: 0 }
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      d.dy = Math.max(0, e.clientY - d.y)
      if (d.dy > 6 && !moved.current) {
        moved.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      if (moved.current) place(d.dy, false)
    },
    onPointerUp: () => end(false),
    onPointerCancel: () => end(true),
    onClickCapture: (e: React.MouseEvent) => {
      if (moved.current) {
        e.preventDefault()
        e.stopPropagation()
        moved.current = false
      }
    },
  }

  return { panel, grip }
}
