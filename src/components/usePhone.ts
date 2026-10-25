import { useEffect, useState } from 'react'

/**
 * Whether this is a phone-width screen, as a piece of React state.
 *
 * The CSS already answers this in a media query, and where a media query can
 * do the job it should — it costs nothing, it cannot get out of step with the
 * layout, and it survives a resize without a render. This exists for the
 * cases where the *markup* differs rather than its presentation: a control
 * that should not exist at all on a desktop cannot be hidden with `display:
 * none` and still be honest, because it stays in the accessibility tree and
 * in the tab order.
 *
 * Kept to the one breakpoint the rest of the app uses. A hook that took an
 * arbitrary query would invite a second phone width to drift into being.
 */
const PHONE = '(max-width: 719px)'

export function usePhone(): boolean {
  /*
     Read on the first render, where there is a window to ask. An effect runs
     after the paint, so starting at false showed a phone the desktop markup
     for a frame whenever a screen that branches on this mounted — Sell
     flashed its tile grid before the rows. The app renders with
     `createRoot`, not hydration, so there is no server markup to agree with;
     the SSR preview harness has no window and still gets false.
  */
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(PHONE)
    const read = () => setPhone(mq.matches)
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])

  return phone
}
