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
import { asset } from '@/assets'

/**
 * The landing page, as the key art leads it: the game's own illustration
 * shown whole — the trainer and the floating city — with the promise and
 * Play beside it. Then what you do (recruit, battle, build), each with real
 * game art, the six worlds, and Play once more.
 */

/* A squad of five, as a tavern would line them up: one of each kind of fighter. */
const SQUAD = ['hunter_elgem', 'astralknight_lopati', 'mystic_altan', 'juggernaut_khaured', 'voidcaller_altan']

const ROWS: { id: string; kick: string; title: [string, string]; body: string; chips?: string[]; art: string }[] = [
  {
    id: 'recruit',
    kick: 'Recruit',
    title: ['A squad that ', 'fits together'],
    body: 'Hire fighters at taverns across six planets and field five of them. Class, race and element decide who holds the line and who hits hardest, and every fighter brings its own abilities into the fight.',
    chips: ['Class', 'Race', 'Element', 'Abilities'],
    art: asset('/assets/background/bg-tavern.png'),
  },
  {
    id: 'battle',
    kick: 'Battle',
    title: ['Dungeons, arenas, ', 'tournaments'],
    body: 'Fight through dungeons for rewards, take on other trainers in the arena, and fight for rewards in the weekly tournament.',
    art: asset('/assets/background/bg-fight.png'),
  },
  {
    id: 'build',
    kick: 'Build',
    title: ['Own a piece ', 'of the map'],
    body: 'Claim land, raise taverns, mines and arenas, and take a cut of everything they earn. The hottest arenas and dungeons burn on the map.',
    art: asset('/assets/landing/build-veles.webp'),
  },
]

const WORLDS = ['eyeke', 'kavian', 'magor', 'naron', 'neri', 'veles']

export function Landing() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const rowsRef = useRef<HTMLDivElement>(null)

  const toRows = useCallback(() => {
    rowsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const primary = player
    ? { to: '/map', label: 'Play' }
    : account
      ? { to: '/signup', label: 'Become a trainer' }
      : { to: '/connect', label: 'Play' }

  return (
    <div className="kart">
      <header className="kart__hero">
        <img
          {...HIGH_PRIORITY}
          className="kart__art"
          src={asset('/assets/background/bg-catch-and-conquer.jpeg')}
          alt=""
          decoding="async"
        />
        <div className="kart__shade" />
        <div className="kart__status">
          <NetworkStatus />
        </div>
        <div className="kart__copy">
          <GameLogo className="kart__logo" priority />
          <h1 className="kart__title">
            Recruit. Battle.
            <span>Become a legend.</span>
          </h1>
          <p className="kart__lead">
            Build a squad of alien fighters, fight through dungeons and arenas, and climb the weekly tournament across
            six worlds.
          </p>
          <div className="kart__btns">
            <Link className="btn btn--primary btn--charged btn--lg heroplay kart__play" to={primary.to}>
              {primary.label}
            </Link>
            <button type="button" className="kart__how" onClick={toRows}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              How it works
            </button>
          </div>
          <p className="kart__note">{account ? <SwitchWallet /> : 'Play with Anchor or MyCloudWallet.'}</p>
        </div>
      </header>

      <div className="kart__rows" ref={rowsRef}>
        {ROWS.map((r, i) => (
          <section className={`kart__row${i % 2 ? ' is-flip' : ''}`} key={r.id}>
            <div className={`kart__media${r.id === 'build' ? ' is-map' : ''}`} style={{ backgroundImage: `url(${r.art})` }}>
              {r.id === 'recruit' && (
                <div className="kart__squad">
                  {SQUAD.map((f) => (
                    <img key={f} src={asset(`/assets/fighters/${f}.webp`)} alt="" loading="lazy" decoding="async" />
                  ))}
                </div>
              )}
            </div>
            <div className="kart__text">
              <div className="kart__kick">{r.kick}</div>
              <h2 className="kart__h2">
                {r.title[0]}
                <em>{r.title[1]}</em>
              </h2>
              <p className="kart__body">{r.body}</p>
              {r.chips && (
                <div className="kart__chips">
                  {r.chips.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="kart__worlds">
        <div className="kart__kick">Six worlds</div>
        <h2 className="kart__h2">
          Where will you <em>land?</em>
        </h2>
        <div className="kart__orbs">
          {WORLDS.map((w) => (
            <span className="kart__orb" key={w}>
              <span className="kart__planet" style={{ backgroundImage: `url(${asset(`/assets/landing/world-${w}.webp`)})` }} />
              {w}
            </span>
          ))}
        </div>
      </section>

      <section
        className="kart__band"
        style={{
          backgroundImage: `linear-gradient(100deg, rgb(0 120 220 / 55%), rgb(80 30 160 / 70%)), url(${asset('/assets/background/bg-dungeon.png')})`,
        }}
      >
        <div>
          <h2 className="kart__h2">Your legend starts here</h2>
          <p className="kart__body">Connect a wallet and become a trainer in two steps.</p>
        </div>
        <Link className="btn btn--gold btn--lg kart__play" to={primary.to}>
          {primary.label}
        </Link>
      </section>

      <footer className="kart__foot">
        <span>Alien Legends runs on the WAX blockchain.</span>
        <span>Play with Anchor or MyCloudWallet</span>
      </footer>
    </div>
  )
}
