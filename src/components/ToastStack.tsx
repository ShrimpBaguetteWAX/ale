import { useEffect, useRef, useState } from 'react'
import { useToasts, type Toast } from './toasts'

const SHOW_MS = 4000

/**
 * The toasts, drawn once for the whole game at the top of the screen —
 * under the top bar on a phone, top right on a desktop. Each goes by itself
 * after a few seconds, waits while a finger or the pointer is on it, and
 * goes at once on × or a flick upwards.
 */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <NoticeToast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function NoticeToast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [held, setHeld] = useState(false)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  /* Starts over from full whenever it is let go of. */
  useEffect(() => {
    if (held) return
    const id = window.setTimeout(() => close.current(), SHOW_MS)
    return () => window.clearTimeout(id)
  }, [held])

  /* A flick upwards: the way it came in. */
  const start = useRef<number | null>(null)

  return (
    <div
      className="toast"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onPointerDown={(e) => {
        setHeld(true)
        start.current = e.clientY
      }}
      onPointerUp={(e) => {
        setHeld(false)
        if (start.current !== null && start.current - e.clientY > 24) onClose()
        start.current = null
      }}
      onPointerCancel={() => {
        setHeld(false)
        start.current = null
      }}
    >
      <span className="toast__tick" aria-hidden="true">
        ✓
      </span>
      <span className="toast__text">{toast.message}</span>
      <button
        type="button"
        className="toast__x"
        aria-label="Close"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        ×
      </button>
      {!held && (
        <i className="toast__time" style={{ animationDuration: `${SHOW_MS}ms` }} aria-hidden="true" />
      )}
    </div>
  )
}
