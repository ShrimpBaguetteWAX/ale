import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { asset } from '@/assets'
import guideCss from '@/guide/guide.css?raw'
import guideHtml from '@/guide/guide.html?raw'
import { mountGuide } from '@/guide/mount'

/**
 * The trainer's guide: every part of the game, the short way, with pieces
 * that move. Reachable without a wallet, from "How it works" on the landing
 * page, and from the game's menu.
 *
 * The guide itself is built from mockups/guide-v2.html (mockups/guide-build.cjs
 * writes src/guide/). It renders inside a shadow root, so its stylesheet and
 * the game's never meet: it looks exactly like the page it was designed as,
 * and nothing it styles can leak into the game around it. Every statement in
 * it was checked against the client and the contracts; the few figures it
 * reads live (the prize pool, the farm) come straight from the chain.
 */
export default function Guide() {
  const player = useGame((s) => s.player)
  const account = useGame((s) => s.account)
  const host = useRef<HTMLDivElement>(null)

  /* In the game's frame for a trainer who is playing (App's GuideFrame): no bar of its own. */
  const inGame = !!player
  const play = player ? '/map' : account ? '/signup' : '/connect'
  const back = player ? { to: '/map', label: 'Back to game' } : { to: '/', label: 'Home' }

  useEffect(() => {
    document.title = "Trainer's guide | Alien Legends"
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const shadow = el.shadowRoot ?? el.attachShadow({ mode: 'open' })
    const A = asset('/assets').replace(/\/$/, '')
    shadow.innerHTML = `<style>${guideCss.split('%A%').join(A)}</style>${guideHtml.split('%A%').join(A)}`
    shadow.querySelector('.gx')?.classList.toggle('ingame', inGame)
    const unmount = mountGuide(shadow, A)
    return () => {
      unmount()
      shadow.innerHTML = ''
    }
  }, [inGame])

  return (
    <div className={`guide${inGame ? ' guide--ingame' : ''}`}>
      {!inGame && (
        <header className="guide__bar">
          <Link to={back.to} className="guide__back" aria-label={back.label}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            <span>{back.label}</span>
          </Link>
          <Link to="/" className="guide__logo" aria-label="Alien Legends home">
            <img src={asset('/assets/logo.webp')} alt="Alien Legends" width={337} height={152} decoding="async" />
          </Link>
          <Link to={play} className="btn btn--primary guide__play">
            Play
          </Link>
        </header>
      )}
      <div ref={host} />
    </div>
  )
}
