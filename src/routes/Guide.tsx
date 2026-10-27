import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { GameLogo } from '@/components/GameLogo'
import { asset } from '@/assets'

/**
 * The trainer's guide: the basics a new trainer meets, in the order they
 * meet them. Reachable without a wallet, from "How it works" on the landing
 * page.
 *
 * Every statement here was checked against the client and the contracts.
 * Amounts the chain's config sets — the sign-up fee, starting energy, travel,
 * reveal and fight costs, flask sizes, payday price, level cost — are left
 * out on purpose: they can change without a release, and a guide that quotes
 * a stale number is worse than one that says "costs energy". The numbers that
 * are here are fixed in the code: 100 energy to hire, the 2,000-energy flask
 * rule, 3 tools, level 10, 10,000 power, 1% of a pool, 90 days.
 */

const I = (p: string) => asset(`/assets/icons/${p}`)

const CHAPTERS: [string, string][] = [
  ['welcome', 'Welcome'],
  ['trainer', 'Become a trainer'],
  ['energy', 'Energy & currencies'],
  ['map', 'The map'],
  ['recruit', 'Recruit fighters'],
  ['fighter', 'Read a fighter'],
  ['squad', 'Your squad'],
  ['fight', 'How a fight plays'],
  ['modes', 'Dungeons & arenas'],
  ['rewards', 'Rewards'],
  ['upkeep', 'Keep them fighting'],
  ['next', 'What next'],
]

const WORLDS = ['magor', 'naron', 'neri', 'eyeke', 'veles', 'kavian']
const ELEMENTS = ['gem', 'metal', 'air', 'fire', 'nature', 'neutral']
const SQUAD: [string, string][] = [
  ['hunter_elgem', 'Hunter'],
  ['astralknight_lopati', 'Astral Knight'],
  ['mystic_altan', 'Mystic'],
  ['juggernaut_khaured', 'Juggernaut'],
  ['voidcaller_altan', 'Voidcaller'],
]

const TipIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </svg>
)
const WarnIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3 2 20h20z" />
    <path d="M12 10v4M12 17v.5" />
  </svg>
)
const Tip = ({ children }: { children: ReactNode }) => (
  <div className="guide__tip">
    <TipIcon />
    <span>{children}</span>
  </div>
)
const Warn = ({ children }: { children: ReactNode }) => (
  <div className="guide__warn">
    <WarnIcon />
    <span>{children}</span>
  </div>
)

function Chapter({ id, n, title, children }: { id: string; n: number; title: ReactNode; children: ReactNode }) {
  return (
    <section className="guide__ch" id={`guide-${id}`}>
      <div className="guide__chhead">
        <span className="guide__num">{String(n).padStart(2, '0')}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <div className="guide__steps">
      {items.map((s, i) => (
        <span className="guide__step" key={i}>
          <i>{i + 1}</i>
          {s}
        </span>
      ))}
    </div>
  )
}

export default function Guide() {
  const player = useGame((s) => s.player)
  const account = useGame((s) => s.account)
  const [on, setOn] = useState(0)
  const chips = useRef<HTMLElement>(null)
  /* The chapter last clicked in the contents, while the page scrolls to it. */
  const clicked = useRef<{ i: number; until: number } | null>(null)

  useEffect(() => {
    document.title = "Trainer's guide | Alien Legends"
    window.scrollTo(0, 0)
  }, [])

  /*
     The chapter in view, for the contents list and the phone's strip.

     The last chapters are shorter than a screen, so the page ends before
     they can reach the top: at the foot of the page the last one counts as
     in view — or, if one was just clicked, that one, since the page has gone
     as far towards it as it can.
  */
  useEffect(() => {
    const pick = () => {
      const c = clicked.current
      const atFoot = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (c) {
        /* Held while the page is still scrolling to it, and for good where the page ends short of it. */
        if (atFoot || Date.now() < c.until) {
          c.until = Math.max(c.until, Date.now() + 250)
          setOn(c.i)
          return
        }
        clicked.current = null
      }
      if (atFoot) {
        setOn(CHAPTERS.length - 1)
        return
      }
      let i = 0
      CHAPTERS.forEach(([id], k) => {
        const el = document.getElementById(`guide-${id}`)
        if (el && el.getBoundingClientRect().top - 140 <= 0) i = k
      })
      setOn(i)
    }
    /* The reader scrolling by hand lets go of the chapter they clicked. */
    const release = () => {
      clicked.current = null
    }
    pick()
    window.addEventListener('scroll', pick, { passive: true })
    window.addEventListener('wheel', release, { passive: true })
    window.addEventListener('touchstart', release, { passive: true })
    window.addEventListener('keydown', release)
    return () => {
      window.removeEventListener('scroll', pick)
      window.removeEventListener('wheel', release)
      window.removeEventListener('touchstart', release)
      window.removeEventListener('keydown', release)
    }
  }, [])
  useEffect(() => {
    chips.current?.querySelector('.is-on')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [on])

  const go = (id: string) => {
    const el = document.getElementById(`guide-${id}`)
    if (!el) return
    const i = CHAPTERS.findIndex(([c]) => c === id)
    clicked.current = { i, until: Date.now() + 600 }
    setOn(i)
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' })
  }

  const play = player ? '/map' : account ? '/signup' : '/connect'
  /* Opened from the game's menu, the way back is the game; from the landing page, home. */
  const back = player ? { to: '/map', label: 'Back to game' } : { to: '/', label: 'Home' }

  return (
    <div className="guide">
      <header className="guide__bar">
        <Link to={back.to} className="guide__back" aria-label={back.label}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span>{back.label}</span>
        </Link>
        <Link to="/" className="guide__logo" aria-label="Alien Legends home">
          <GameLogo />
        </Link>
        <Link to={play} className="btn btn--primary guide__play">
          Play
        </Link>
      </header>

      <div className="guide__hero" style={{ backgroundImage: `url(${asset('/assets/background/bg-catch-and-conquer.jpeg')})` }}>
        <div className="guide__heroin">
          <div className="guide__kick">Trainer's guide</div>
          <h1 className="guide__title">
            Everything you need <em>for your first fights</em>
          </h1>
          <p className="guide__lead">
            Twelve short chapters, from connecting a wallet to keeping your squad paid. Come back any time.
          </p>
        </div>
      </div>

      <div className="guide__body">
        <nav className="guide__toc" aria-label="Chapters">
          <b>Contents</b>
          {CHAPTERS.map(([id, t], i) => (
            <button
              type="button"
              key={id}
              className={i === on ? 'is-on' : i < on ? 'is-done' : undefined}
              onClick={() => go(id)}
            >
              <span>{i + 1}</span>
              {t}
            </button>
          ))}
        </nav>

        <main className="guide__main">
          <nav className="guide__chips" ref={chips} aria-label="Chapters">
            {CHAPTERS.map(([id, t], i) => (
              <button type="button" key={id} className={i === on ? 'is-on' : undefined} onClick={() => go(id)}>
                {i + 1} · {t}
              </button>
            ))}
          </nav>

          <Chapter id="welcome" n={1} title={<>What is <em>Alien Legends?</em></>}>
            <p>
              A squad battler on the WAX blockchain. You are a <b>trainer</b>: you recruit alien fighters, send five of
              them into automatic battles, and earn rewards from the wins.
            </p>
            <Steps items={['Recruit at taverns', 'Fight dungeons & arenas', 'Bank Reward Power', 'Mine TLM & Shards']} />
          </Chapter>

          <Chapter id="trainer" n={2} title={<>Become a <em>trainer</em></>}>
            <ul className="guide__pts">
              <li>
                <b>Connect a WAX wallet</b>: Anchor or MyCloudWallet. There's no password and no separate game account.
              </li>
              <li>
                <b>Register</b> with a one-off WAX fee (shown on the sign-up screen), then <b>pick your trainer name</b>:
                4–12 characters, seen by every other player.
              </li>
              <li>Paid and closed the tab? You come back to the name step. You're never charged twice.</li>
              <li>
                You start with energy, no credits or gems, on <b>one of the six planets</b>, picked at random.
              </li>
            </ul>
            <Tip>
              Alien Worlds tools in your mining bag at sign-up become your first <b>mining tools</b> here. More on tools
              in chapter 10.
            </Tip>
          </Chapter>

          <Chapter id="energy" n={3} title={<>Energy &amp; <em>currencies</em></>}>
            <p>
              <b>Energy</b> pays for almost everything you do:
            </p>
            <div className="guide__spend">
              {['Travel', 'Reveal a recruit', 'Hire', 'Dungeon run', 'Arena challenge', 'Tournament entry'].map((s) => (
                <span key={s}>
                  <img src={I('energy.svg')} alt="" />
                  {s}
                </span>
              ))}
            </div>
            <Warn>
              <b>Energy doesn't refill by itself.</b> Claim the <b>free energy flask once a day</b> in the Shop (it
              resets at midnight UTC), or buy more there. Trial trainers can claim the flask only while holding under
              2,000 energy.
            </Warn>
            <div className="guide__curr">
              {(
                [
                  ['credits.svg', 'Credits', 'Pay paydays, level-ups, ascension, quest rerolls and land boosts. Earned from Farming, land and selling fighters back.'],
                  ['gems.svg', 'Gems', 'Bought with WAX. Buy credits and Legend, trade on the Market, enter the Candle.'],
                  ['wax-coin.png', 'WAX', "The chain's own coin. Pays the sign-up fee and gem packs."],
                  ['tlm.svg', 'TLM', 'Trilium, the main payout from reward pools, quests, tournaments and land.'],
                  ['shards.svg', 'Shards', 'Alien Worlds shards: paid by reward pools, spent at the AW Outpost in the Shop.'],
                  ['energy.svg', 'Energy', 'Your action budget (see above). Bought with credits.'],
                ] as const
              ).map(([icon, name, body]) => (
                <div key={name}>
                  <img src={I(icon)} alt="" />
                  <b>{name}</b>
                  <small>{body}</small>
                </div>
              ))}
            </div>
          </Chapter>

          <Chapter id="map" n={4} title={<>The <em>map</em></>}>
            <p>
              There are <b>six planets</b>, each a grid of 800 lands. Travel within a planet costs energy: a base cost
              plus more for every tile of distance. To change planet, step onto a <b>portal</b>; you arrive at the same
              spot on the other planet, for an extra fee.
            </p>
            <div className="guide__planets">
              {WORLDS.map((w) => (
                <span key={w} style={{ backgroundImage: `url(${asset(`/assets/landing/worldcard-${w}.webp`)})` }}>
                  <b>{w}</b>
                </span>
              ))}
            </div>
            <div className="guide__mapfig" style={{ backgroundImage: `url(${asset('/assets/landing/map-live.webp')})` }} />
            <div className="guide__bldg">
              {(
                [
                  ['tavern', 'Tavern', 'Where you recruit fighters.'],
                  ['dungeon', 'Dungeon', "Fight the dungeon's team at a difficulty you pick."],
                  ['arena', 'Arena', 'Fight the team other trainers left holding it.'],
                ] as const
              ).map(([k, name, body]) => (
                <div key={k}>
                  <img src={asset(`/assets/markers/buildings/${k}.svg`)} alt="" />
                  <b>{name}</b>
                  <small>{body}</small>
                </div>
              ))}
            </div>
            <Tip>
              You enter a building by <b>standing on it</b>: travel there on the map, then open it. The hottest arenas
              and dungeons <b>burn</b> on the map. Each new arrival rolls the land's <b>weather</b>, which can raise or
              lower stats in a fight.
            </Tip>
          </Chapter>

          <Chapter id="recruit" n={5} title={<>Recruit <em>fighters</em></>}>
            <Steps items={['Travel to one of your taverns', 'Reveal the recruit (energy)', 'Hire']} />
            <ul className="guide__pts">
              <li>You have your own list of taverns on the map. Revealing uses that tavern up, and a new one is added to your list.</li>
              <li>
                The recruit's class, race, element, stats and abilities are rolled when you <b>reveal</b>. Look before
                you hire.
              </li>
              <li>
                <b>Hiring costs 100 energy</b>, minus what the tavern's <b>objectives</b> take off. You meet objectives by
                showing <b>Alien Worlds NFTs</b> from your wallet (by rarity, shine, element, race and so on). Each
                objective counts once; up to 3 cards per hire. The NFTs are <b>not spent</b>.
              </li>
            </ul>
            <div className="guide__card guide__hire">
              <div className="guide__cap">
                Hire cost<span className="guide__ex">example</span>
              </div>
              <div className="guide__hirebar">
                <div className="is-pay" style={{ width: '45%' }}>
                  You pay 45
                </div>
                <div className="is-cut" style={{ width: '30%' }}>
                  −30 objective
                </div>
                <div className="is-cut" style={{ width: '25%' }}>
                  −25 objective
                </div>
              </div>
              <div className="guide__hirelegend">
                <span>0</span>
                <span>
                  <b>100 energy</b> before objectives
                </span>
              </div>
            </div>
            <Tip>
              <b>Legend</b> trainers get the recruit revealed for free when they arrive at the tavern.
            </Tip>
          </Chapter>

          <Chapter id="fighter" n={6} title={<>Read a <em>fighter</em></>}>
            <div className="guide__card guide__anat">
              <div className="guide__anatimg">
                <img src={asset('/assets/fighters/mystic_altan.webp')} alt="" />
              </div>
              <div>
                <div className="guide__who">
                  <b>Mystic</b>
                  <img src={I('elements/air.svg')} alt="" />
                  <small>Altan · Level 4 · 12 days old</small>
                  <span className="guide__ex">example</span>
                </div>
                <div className="guide__tiles">
                  {(
                    [
                      ['damage', 'Damage', '172', 'green-up'],
                      ['health', 'Health', '126', 'middle'],
                      ['taunt', 'Taunt', '22', ''],
                      ['attackspeed', 'Cooldown', '89', 'green-duble-up'],
                      ['initiative', 'Windup', '73', 'green-up'],
                    ] as const
                  ).map(([icon, label, v, g]) => (
                    <span key={label}>
                      <small>
                        <img src={I(`stats/${icon}.svg`)} alt="" />
                        {label}
                      </small>
                      <b>
                        {v}
                        {g && <img src={I(`arrows/${g}.svg`)} alt="" />}
                      </b>
                    </span>
                  ))}
                </div>
                <div className="guide__res">
                  {ELEMENTS.map((e, i) => (
                    <span key={e}>
                      <img src={I(`elements/${e}.svg`)} alt="" />
                      {[45, 36, 24, 50, 23, 57][i]}%
                    </span>
                  ))}
                </div>
                <div className="guide__abil">
                  <span>✦ At fight start</span>
                  <span>✦ When hit</span>
                  <span className="is-lock">Unlocks with ascension</span>
                </div>
              </div>
            </div>
            <div className="guide__legend">
              <span>
                <b>Damage / Health</b>: how hard it hits and how much it takes.
              </span>
              <span>
                <b>Taunt</b>: draws enemy attacks. A role, not a quality; it drops with each hit taken.
              </span>
              <span>
                <b>Cooldown / Windup</b>: <b>lower is better</b>. Windup decides who acts first; cooldown, how soon again.
              </span>
              <span>
                <b>Resistances</b>: one per element; each cuts damage of that element by its %.
              </span>
              <span>
                <b>Grades</b>: the chevrons compare each stat with its class's range, from Poor to Exceptional for the class.
              </span>
              <span>
                <b>Abilities</b> trigger at the start, on attack, on being hit or at the end. They have rarities; the last
                unlocks with ascension.
              </span>
            </div>
          </Chapter>

          <Chapter id="squad" n={7} title={<>Your <em>squad</em></>}>
            <p>
              Every fight takes <b>exactly five</b> of your fighters, plus a sixth: the <b>NFT fighter</b>, built from
              one Alien Worlds <b>crew</b> card and one <b>weapon</b> card. The crew sets class, race and targeting, the
              weapon sets the element, and their stats and abilities add up. The order you put them in doesn't matter.
            </p>
            <div className="guide__squad">
              {SQUAD.map(([f, name]) => (
                <span key={f}>
                  <img src={asset(`/assets/fighters/${f}.webp`)} alt="" />
                  {name}
                </span>
              ))}
              <i>+</i>
              <span className="is-nft">
                <div>
                  <span>Crew</span>
                  <span>Weapon</span>
                </div>
                NFT fighter
              </span>
            </div>
            <Tip>
              A fighter can't fight while it's <b>busy</b> (defending an arena, listed on the Market, in a tournament) or
              while its <b>payday is overdue</b>.
            </Tip>
          </Chapter>

          <Chapter id="fight" n={8} title={<>How a <em>fight plays</em></>}>
            <p>
              Fights are <b>automatic</b> and settled on the chain; the battle screen is a replay. The fighter with the{' '}
              <b>lowest windup</b> acts next; after attacking, its windup goes up by its cooldown. Ties go to your side.
              Each fighter attacks by its <b>targeting rule</b> (for example Highest Taunt or Lowest Health). The last
              team standing wins.
            </p>
            <div className="guide__card guide__tl">
              <div className="guide__cap">
                Who acts when<span className="guide__ex">example</span>
              </div>
              {(
                [
                  ['Your Hunter', 'windup 40 · cooldown 60', 'me', [[13, 1], [33, 3], [53, 5], [73, 8]]],
                  ['Your Juggernaut', 'windup 70 · cooldown 110', 'me', [[23, 2], [60, 6]]],
                  ['Enemy Mystic', 'windup 120 · cooldown 90', 'them', [[40, 4], [70, 7]]],
                ] as const
              ).map(([who, sub, side, marks]) => (
                <div className="guide__tlrow" key={who}>
                  <b>
                    {who}
                    <small>{sub}</small>
                  </b>
                  <div className="guide__track">
                    {marks.map(([at, n]) => (
                      <i key={n} className={`is-${side}`} style={{ left: `${at}%` }}>
                        {n}
                      </i>
                    ))}
                  </div>
                </div>
              ))}
              <div className="guide__tlaxis">
                <span />
                <div>
                  <span>0</span>
                  <span>time →</span>
                  <span>300</span>
                </div>
              </div>
            </div>
            <ul className="guide__pts">
              <li>
                Damage comes in the attacker's <b>element</b>; the target's resistance to it cuts it. There's no fixed
                element chart; resistances decide.
              </li>
              <li>
                Before the fight, health and damage grow <b>×1.15 per level</b> and shrink with <b>age</b>. The land's{' '}
                <b>weather</b> can raise or lower stats for both teams.
              </li>
            </ul>
          </Chapter>

          <Chapter id="modes" n={9} title={<>Dungeons &amp; <em>arenas</em></>}>
            <div className="guide__grid2">
              <div className="guide__tile">
                <h4>
                  <img src={asset('/assets/markers/buildings/dungeon.svg')} alt="" />
                  Dungeons
                </h4>
                <p>
                  Pick a <b>difficulty</b>: enemies get stronger and rewards bigger with each step. Each dungeon can be{' '}
                  <b>won once a day</b> (resets 00:00 UTC). A win gives XP and Reward Power; a loss gives nothing, and the
                  energy is still spent.
                </p>
              </div>
              <div className="guide__tile">
                <h4>
                  <img src={asset('/assets/markers/buildings/arena.svg')} alt="" />
                  Arenas
                </h4>
                <p>
                  Challenge the team other trainers left holding an arena. Win, and <b>one of your five stays to defend</b>{' '}
                  it (with your NFT fighter) until someone knocks it out. You can't challenge an arena you already hold.
                </p>
              </div>
            </div>
            <Tip>Start with low dungeon difficulties: your fighters level up from the XP, and a loss still costs energy.</Tip>
          </Chapter>

          <Chapter id="rewards" n={10} title={<em>Rewards</em>}>
            <p>
              Wins don't pay out directly. They bank <b>Reward Power</b> in a reward pool, and you <b>mine</b> the pool for
              TLM and Shards.
            </p>
            <div className="guide__flow">
              <div>
                <b>Win</b>
                <small>A dungeon or arena fight.</small>
              </div>
              <span>→</span>
              <div>
                <b>Reward Power</b>
                <small>Your tools' mining power × the building's boost (× difficulty in dungeons).</small>
              </div>
              <span>→</span>
              <div>
                <b>Pool</b>
                <small>Dungeon Wins, Arena Wins, Arena Domination.</small>
              </div>
              <span>→</span>
              <div className="is-gold">
                <img src={I('tlm.svg')} alt="" />
                <b>Mine</b>
                <small>At 10,000 power: 1% of the pool, straight to your wallet.</small>
              </div>
            </div>
            <ul className="guide__pts">
              <li>
                Equip up to <b>3 Alien Worlds tools</b> in Rewards. Only their TLM and Shard mining power count.
              </li>
              <li>
                <b>Arena Domination</b> rewards holding arenas and pays TLM.
              </li>
              <li>Trial trainers bank less power than Legend trainers.</li>
            </ul>
          </Chapter>

          <Chapter id="upkeep" n={11} title={<>Keep them <em>fighting</em></>}>
            <Warn>
              <b>Payday is upkeep you pay in credits.</b> A fighter whose payday has passed <b>can't fight</b>, and{' '}
              <b>90 days</b> after a missed payday it is <b>deleted</b>. Pay from My Fighters.
            </Warn>
            <div className="guide__grid3">
              <div className="guide__tile">
                <h4>Level up</h4>
                <p>
                  Fights earn XP; when it's full, level up for credits. <b>Max level 10.</b> Each level: ×1.15 health and
                  damage.
                </p>
              </div>
              <div className="guide__tile">
                <h4>Age</h4>
                <p>Health and damage fade as a fighter ages. My Fighters shows how much is left.</p>
              </div>
              <div className="guide__tile">
                <h4>Sell back</h4>
                <p>Sell a fighter you don't need back to the game for credits.</p>
              </div>
            </div>
          </Chapter>

          <Chapter id="next" n={12} title={<>What <em>next</em></>}>
            <div className="guide__next">
              {(
                [
                  ['menu/quests.png', 'Quests', 'Daily, weekly and monthly goals that pay TLM or Shards.'],
                  ['menu/tournament.png', 'Tournament', 'Five level-10 fighters plus crew and weapon, for TLM and WAX prizes, on a schedule.'],
                  ['menu/ascension.png', 'Ascension', 'A level-10 fighter plus three sacrifices of its class: pick one of three upgrades.'],
                  ['menu/market.png', 'Market', 'Buy and sell fighters for gems.'],
                  ['menu/my-land.png', 'Lands', 'Own AW land, build a tavern, dungeon or arena, earn from it. Keep its boost up.'],
                  ['menu/card.png', 'Farming', 'Stake AW tools, crew or weapons for credits.'],
                  ['menu/candle.png', 'Candle', 'Put gems into a campaign for a share of a fixed prize.'],
                  ['account-legend.svg', 'Legend', 'Free reveals, full reward power, a bigger daily flask, full tournament prizes.'],
                ] as const
              ).map(([icon, name, body]) => (
                <div key={name}>
                  <img src={I(icon)} alt="" />
                  <b>{name}</b>
                  <small>{body}</small>
                </div>
              ))}
            </div>
            <div className="guide__end">
              <div>
                <h3>Ready for your first recruit?</h3>
                <p>Once you're in, open Briefing: it lists what you can do right now.</p>
              </div>
              <div className="guide__endbtns">
                <Link to={back.to} className="guide__home">
                  {player ? 'Back to the game' : 'Back to home'}
                </Link>
                <Link to={play} className="btn btn--primary btn--lg">
                  Play
                </Link>
              </div>
            </div>
          </Chapter>
        </main>
      </div>
    </div>
  )
}
