import { useCallback, useRef } from 'react'

/**
 * React 18 has no mapping for the fetchPriority DOM attribute, so passing it
 * camelCased logs a warning and drops it. Spreading the lowercase attribute
 * sets it for real.
 */
const HIGH_PRIORITY = { fetchpriority: 'high' } as Record<string, string>
import { Link } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { NetworkStatus } from '@/components/NetworkStatus'
import { SwitchWallet } from '@/components/SwitchWallet'
import { GameLogo } from '@/components/GameLogo'

/** Copy is kept verbatim from the live site — players know these words. */
const PITCHES = [
  {
    title: 'Recruit, Battle, Conquer, Repeat',
    body: 'Recruit fighters, explore dungeons, tackle arenas, mine valuable resources, and rise on the leaderboards. Every decision in Alien Legends shapes your journey.',
  },
  {
    title: 'Build your Squad',
    body: 'Recruit unique fighters with different classes, races, elements, and abilities! From frontliners to debuffers, every fighter brings distinct strengths. Build your squad and master combat in Alien Legends.',
  },
  {
    title: 'Become a Legend!',
    body: 'Travel across six diverse planets and carve your legend in the galaxy of Alien Legends. Construct buildings, recruit fighters with unique classes, races, and abilities, and build the ultimate squad. Test your strategy in dungeons, dominate arenas, and compete in epic weekly tournaments. Complete quests, earn rewards, and ascend your fighters to unlock their true potential. Every choice, every battle, and every victory brings you closer to becoming a legend in a universe full of adventure and challenge.',
  },
]

const PILLARS = [
  {
    icon: '/assets/icons/catch.png',
    title: 'Recruit',
    body: 'Hire fighters at taverns across six planets. Class, race and element decide how a squad holds together.',
  },
  {
    icon: '/assets/icons/battle.png',
    title: 'Battle',
    body: 'Run dungeons, take the arena, and climb the weekly tournament ladder for shards and rewards.',
  },
  {
    icon: '/assets/icons/build.png',
    title: 'Build',
    body: 'Claim land, raise taverns, mines and arenas, and take a cut of everything they generate.',
  },
]

export function Landing() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const sectionsRef = useRef<HTMLDivElement>(null)

  const scrollToSections = useCallback(() => {
    sectionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const primary = player
    ? { to: '/map', label: 'Play' }
    : account
      ? { to: '/signup', label: 'Create commander' }
      : { to: '/connect', label: 'Play' }

  return (
    <div className="landing">
      <header className="hero">
        {/*
          fetchPriority high + eager: this image *is* the first paint, so
          letting the browser deprioritise it would be exactly wrong.
        */}
        <img
          {...HIGH_PRIORITY}
          className="hero__art"
          src="/assets/background/bg-catch-and-conquer.jpeg"
          alt=""
          decoding="async"
        />
        <div className="hero__scrim" />

        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 3 }}>
          <NetworkStatus />
        </div>

        <div className="hero__inner">
          <GameLogo className="hero__logo" priority />

          <p className="hero__tagline">Recruit. Battle. Conquer. Repeat.</p>

          <div className="hero__cta">
            <Link className="btn btn--primary btn--charged btn--lg heroplay" to={primary.to}>
              {primary.label}
            </Link>
          </div>

          <p className="hero__note">
            {account ? (
              <SwitchWallet />
            ) : (
              'Play with Anchor or MyCloudWallet. Free to browse.'
            )}
          </p>
        </div>

        <button type="button" className="hero__more" onClick={scrollToSections}>
          Learn more
          <svg viewBox="0 0 28 18" fill="none" aria-hidden="true">
            <path
              d="M3 3l11 10L25 3"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <div
        className="sections"
        ref={sectionsRef}
        style={
          {
            '--sections-art': "url('/assets/background/bg-catch-and-conquer-footer.jpeg')",
          } as React.CSSProperties
        }
      >
        <div className="sections__inner">
          <div className="cards">
            {PILLARS.map((p) => (
              <article className="panel" key={p.title}>
                <img
                  className="card__icon"
                  src={p.icon}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <h2 className="card__title">{p.title}</h2>
                <p className="card__body">{p.body}</p>
              </article>
            ))}
          </div>

          {PITCHES.map((s) => (
            <section className="panel pitch" key={s.title}>
              <h2 className="pitch__title">{s.title}</h2>
              <p className="pitch__body">{s.body}</p>
            </section>
          ))}

          <div style={{ textAlign: 'center', paddingTop: 'var(--sp-4)' }}>
            <Link className="btn btn--primary btn--charged btn--lg heroplay" to={primary.to}>
              {primary.label}
            </Link>
          </div>
        </div>

        <footer className="landing__foot">
          Alien Legends runs on the WAX blockchain.
        </footer>
      </div>
    </div>
  )
}
