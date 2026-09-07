import { useEffect, useState } from 'react'

/**
 * Whether a set of images is decoded and would paint without a flash.
 *
 * A skeleton that clears when the *data* arrives is only half a loading
 * state: the cards appear, and the portraits behind them arrive a beat later,
 * so the screen finishes twice. Holding the skeleton until the artwork is
 * decoded means the swap happens once.
 *
 * `decode()` rather than `onload`, where the browser has it — a loaded image
 * is bytes in memory, a decoded one is pixels ready to draw, and it is the
 * decode that costs the visible beat on a page putting up a dozen portraits.
 *
 * Failures count as ready. A portrait that 404s has an `onError` fallback on
 * the element itself, and a screen that will not open because one file is
 * missing is worse than a screen with one broken picture on it.
 */
export function useImagesReady(urls: string[], timeoutMs = 5000): boolean {
  /* A dependency the effect can compare by value: the array is rebuilt on
     every render, so depending on the array itself would restart the load
     on each one. */
  const key = urls.join('|')
  const [readyKey, setReadyKey] = useState<string | null>(null)

  useEffect(() => {
    if (urls.length === 0) {
      setReadyKey(key)
      return
    }

    let live = true
    let waiting = urls.length
    const settle = () => {
      if (live && --waiting <= 0) setReadyKey(key)
    }

    const imgs = urls.map((url) => {
      const img = new Image()
      img.src = url
      if (img.decode) {
        img.decode().then(settle, settle)
      } else {
        img.onload = settle
        img.onerror = settle
      }
      return img
    })

    /*
       A ceiling, because this gates a screen. One slow or hanging request
       should cost the player the flash it was meant to avoid, not the page.
     */
    const timer = window.setTimeout(() => {
      if (live) setReadyKey(key)
    }, timeoutMs)

    return () => {
      live = false
      window.clearTimeout(timer)
      for (const img of imgs) {
        img.onload = null
        img.onerror = null
      }
    }
    // `key` is the value form of `urls`; `timeoutMs` never changes in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  /* Compared against the current key, so a changed list is not ready yet
     merely because the previous one was. */
  return readyKey === key
}
