import { useEffect, useRef } from 'react'

/**
 * The three things every overlay in this game owes the player.
 *
 * They were written by hand nine times and came out differently nine times.
 * Four overlays never locked the page behind them, which on a phone means
 * scrolling the sheet to its end and watching the page underneath start to
 * move — and two of those four, the market's bid dialog and the profile's,
 * could not be closed with Escape at all. A dialog that spends gems and has
 * no keyboard way out is not a small thing.
 *
 * So: Escape closes, the page behind holds still, and focus goes into the
 * dialog and comes back out to whatever opened it.
 *
 * Returns a ref for the panel — the inner box, not the backdrop. Put it on
 * the element that holds the dialog's own controls; the trap reads its
 * focusables from there.
 */

/*
 * What can hold focus, in the order the browser would visit it.
 *
 * `:not([disabled])` matters more than it looks: a confirm dialog whose
 * action button is disabled until a box is ticked would otherwise trap focus
 * onto a control that cannot be used.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useModal(onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      /*
         Tab stays inside. Without this the next Tab from the last control
         goes to whatever is behind the dialog — which is still there, still
         clickable, and now has the focus ring on it.
      */
      const box = panel.current
      if (!box) return
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      const here = document.activeElement

      if (e.shiftKey && (here === first || !box.contains(here))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && here === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)

    /* Restored rather than cleared: a screen that had its own reason to stop
       the page scrolling should still be doing so once this closes. */
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    /*
       Focus moves in, once. The first control rather than the panel itself
       where there is one — a player who opens a confirm dialog and presses
       Enter should be answering it, not tabbing to find it.
    */
    const box = panel.current
    const target = box?.querySelector<HTMLElement>(FOCUSABLE) ?? box
    target?.focus?.()

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      /* Back where it came from, if that is still on the page. */
      if (opener && document.contains(opener)) opener.focus?.()
    }
  }, [onClose])

  return panel
}
