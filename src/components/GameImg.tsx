import type { ImgHTMLAttributes } from 'react'

/**
 * An image with somewhere to fall back to.
 *
 * Almost every picture in this game is addressed by convention rather than
 * looked up — a fighter's art is its class and race, a card's is its template
 * id — so a missing file is normal rather than exceptional, and sixteen `img`
 * tags each carried the same six lines to handle it.
 *
 * The guard is the part that matters and the part that would be easy to leave
 * out of the seventeenth: without it, a fallback that is itself missing fires
 * `onError` again and the browser loops on the same request. `data-fallback`
 * records that this element has already swapped once, so it swaps once.
 */
export function GameImg({
  fallback,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { fallback: string | string[] }) {
  /*
     A list is tried in order.

     Card art ships with the build, one file per template — so a template
     minted after the build has none, and the tile fell straight through to
     the blank card back. The asset's own IPFS image is the next thing to
     try, and the blank back is what is left when even that is missing.
  */
  const chain = Array.isArray(fallback) ? fallback : [fallback]
  return (
    <img
      {...props}
      onError={(e) => {
        const img = e.currentTarget
        const step = Number(img.dataset.fallback ?? 0)
        if (step >= chain.length) return
        img.dataset.fallback = String(step + 1)
        img.src = chain[step]
      }}
    />
  )
}
