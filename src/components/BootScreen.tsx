import { useState } from 'react'
import { asset } from '@/assets'
import '@/styles/boot.css'

/** One turn of the ring, as `bootscreen-turn` in styles/boot.css runs it. */
const TURN_MS = 2400

/**
 * The boot screen: the logo inside a turning ring, over the darkened map.
 *
 * index.html draws this before any JavaScript runs; the game draws the same
 * markup for as long as boot takes — restoring the wallet, reading the
 * player — so the hand-over is invisible. Its rules are styles/boot.css,
 * which index.html links and this module imports.
 *
 * One calm state, deliberately: naming each step of boot only advertised how
 * many there were (see `RequirePlayer`). The ring picks up at the angle the
 * static one had reached, rather than starting its turn again.
 */
export function BootScreen() {
  const [delay] = useState(() => {
    const t0 = (window as Window & { __bootT0?: number }).__bootT0 ?? 0
    return `${-((performance.now() - t0) % TURN_MS)}ms`
  })
  return (
    <div className="bootscreen" role="status" aria-live="polite" aria-label="Loading">
      <EmblemRing delay={delay} />
      <span className="bootscreen__word">Loading</span>
    </div>
  )
}

/**
 * The logo inside its ring. The boot screen turns it; the connect screen
 * draws the same ring at rest, so boot, connect and the game read as one
 * scene.
 */
export function EmblemRing({ delay, className }: { delay?: string; className?: string }) {
  return (
    <div className={`bootscreen__ring${className ? ` ${className}` : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true" style={{ animationDelay: delay }}>
        <defs>
          <linearGradient id="bootarc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00baff" stopOpacity="0" />
            <stop offset="0.6" stopColor="#00baff" />
            <stop offset="1" stopColor="#f6a800" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="49.2"
          fill="none"
          stroke="url(#bootarc)"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeDasharray="80 229"
        />
      </svg>
      <img src={asset('/assets/logo.webp')} alt="Alien Legends" />
    </div>
  )
}
