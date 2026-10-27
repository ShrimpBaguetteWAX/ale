/**
 * React 18 has no mapping for the fetchPriority DOM attribute, so passing it
 * camelCased logs a warning and drops it. Spreading the lowercase attribute
 * sets it for real.
 */
const HIGH_PRIORITY = { fetchpriority: 'high' } as Record<string, string>
import { Link } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { SwitchWallet } from '@/components/SwitchWallet'
import { GameLogo } from '@/components/GameLogo'
import { asset } from '@/assets'
import { useChainQuery } from '@/chain/useChainQuery'
import { fetchArenaRanks, fetchArenaSeasons } from '@/leaderboard/queries'
import { defaultSeason, displayName } from '@/leaderboard/rules'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { formatNumber } from '@/format'
import { PrizeStrip } from '@/prizes/WeeklyPrizes'

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
    body: 'Claim land, raise a tavern, dungeon or arena on it, and take a cut of everything it earns. The hottest arenas and dungeons burn on the map.',
    art: asset('/assets/landing/map-live.webp'),
  },
]

const WORLDS = ['eyeke', 'kavian', 'magor', 'naron', 'neri', 'veles']

export function Landing() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
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
            <Link className="kart__how" to="/guide">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              How it works
            </Link>
          </div>
          <PrizeStrip />
          <p className="kart__note">{account ? <SwitchWallet /> : 'Play with Anchor or MyCloudWallet.'}</p>
        </div>
      </header>

      <div className="kart__rows">
        {ROWS.map((r, i) => (
          <section className={`kart__row${i % 2 ? ' is-flip' : ''}`} key={r.id}>
            <div className="kart__media" style={{ backgroundImage: `url(${r.art})` }}>
              {r.id === 'recruit' && (
                <div className="kart__squad">
                  {SQUAD.map((f) => (
                    <img key={f} src={asset(`/assets/fighters/${f}.webp`)} alt="" loading="lazy" decoding="async" />
                  ))}
                </div>
              )}
              {r.id === 'battle' && <BattleScene />}
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
        <div className="kart__worldgrid">
          {WORLDS.map((w) => (
            <span className="kart__world" key={w} style={{ backgroundImage: `url(${asset(`/assets/landing/worldcard-${w}.webp`)})` }}>
              <b>{w}</b>
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

/* Who stands on each side of the arena floor: your three, their two. */
const US = ['hunter_elgem', 'astralknight_lopati', 'mystic_altan']
const THEM = ['juggernaut_khaured', 'voidcaller_altan']

/**
 * The Battle row's picture: a fight caught mid-swing on the arena floor, and
 * over it the live arena leaderboard — real trainers, read from the chain,
 * so the page shows people actually playing rather than a stock image. The
 * board is left out until it has loaded, and if the read fails the fight
 * still stands on its own.
 */
function BattleScene() {
  const board = useChainQuery('landing:arena-board', async () => {
    const season = defaultSeason(await fetchArenaSeasons())
    if (!season) return null
    const rows = await fetchArenaRanks(season.scope)
    return { name: season.displayname, rows: rows.slice(0, 5) }
  })
  return (
    <div className="kart__battle">
      <div className="kart__team is-us">
        {US.map((f, i) => (
          <span key={f} style={{ ['--hp' as string]: [72, 45, 88][i] + '%' }}>
            <i />
            <img src={asset(`/assets/fighters/${f}.webp`)} alt="" loading="lazy" decoding="async" />
          </span>
        ))}
      </div>
      <div className="kart__team is-them">
        {THEM.map((f, i) => (
          <span key={f} style={{ ['--hp' as string]: [18, 61][i] + '%' }}>
            <i />
            <img src={asset(`/assets/fighters/${f}.webp`)} alt="" loading="lazy" decoding="async" />
          </span>
        ))}
      </div>
      <span className="kart__burst" aria-hidden="true" />
      <span className="kart__dmg is-a" aria-hidden="true">
        −172
      </span>
      <span className="kart__dmg is-b" aria-hidden="true">
        −96
      </span>
      {board.data && board.data.rows.length > 0 && (
        <div className="kart__lb">
          <div className="kart__lbhead">
            <b>Arena</b>
            <span>{board.data.name}</span>
          </div>
          {board.data.rows.map((r, i) => (
            <div className="kart__lbrow" key={r.wallet}>
              <span className={`kart__lbrank${i < 3 ? ` is-${i + 1}` : ''}`}>{i + 1}</span>
              <PlayerAvatar id={r.avatar} name={displayName(r)} className="kart__lbav" size={22} />
              <span className="kart__lbname">{displayName(r)}</span>
              <span className="kart__lbpts">{formatNumber(r.rating)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
