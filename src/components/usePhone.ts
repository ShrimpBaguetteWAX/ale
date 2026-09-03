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
     False before the first paint rather than a guess, so the server render
     and the first client render agree. A phone flips to true in the effect
     below on the same tick, before anything is committed to the screen.
  */
  const [phone, setPhone] = useState(false)

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
