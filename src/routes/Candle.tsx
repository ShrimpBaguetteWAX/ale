import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import {
  fetchCandleClaim,
  fetchCandleOffers,
  fetchCandleTracking,
  fetchContributions,
} from '@/candle/queries'
import type { CandleClaim, CandleOffer, CandleTracking, Contribution } from '@/candle/types'
import {
  activeOffer,
  upcomingOffers,
  countdown,
  eligibility,
  offerState,
  projectShare,
  shareOf,
  tokenAmount,
  tokenIcon,
  tokenSymbol,
  placesFor,
} from '@/candle/rules'
import { claimCandle, contributeGems } from '@/wharf/actions'
import { refreshChore } from '@/chores/signal'
import { readableError } from '@/wharf/errors'
import { formatNumber, formatDecimals } from '@/format'
import type { Player } from '@/chain/types'
import { fetchPlayerTags } from '@/chain/queries'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { rankClass } from '@/leaderboard/rules'
import { asset } from '@/assets'

/**
 * The Candle.
 *
 * One campaign runs at a time. It puts up a fixed reward, anyone who meets
 * its requirement can throw gems at it, and when the day is up the reward is
 * split in proportion to what each contributor put in.
 *
 * That makes it a dilution game, which is the opposite of how a "contribute"
 * screen normally reads. Adding gems raises your share and lowers what every
 * gem in the pot is worth — including the ones you already put in. So the
 * screen leads with the **rate** rather than the prize: what a gem is worth
 * right now, and what it would be worth after the contribution you are about
 * to make.
 *
 * Entry is a gate, not a score. `contribute` checks the player's lifetime
 * counter against the requirement and refuses outright below it, so there is
 * nothing to show but qualified or short, and by how much.
 */

type Busy = 'contribute' | 'claim' | null

/* ---------- data ---------- */

interface CandleData {
  offers: CandleOffer[]
  mine: number
  contributors: number
  /** Everyone in the running campaign, for the board behind the button. */
  stakes: Contribution[]
  claim?: CandleClaim
  tracking?: CandleTracking
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

function useCandle(account: string | null): CandleData {
  const [offers, setOffers] = useState<CandleOffer[]>([])
  const [mine, setMine] = useState(0)
  const [contributors, setContributors] = useState(0)
  const [stakes, setStakes] = useState<Contribution[]>([])
  const [claim, setClaim] = useState<CandleClaim>()
  const [tracking, setTracking] = useState<CandleTracking>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(
    async (refresh: boolean) => {
      if (!account) return
      setError(null)
      try {
        const [o, c, t] = await Promise.all([
          fetchCandleOffers(refresh),
          fetchCandleClaim(account, refresh),
          fetchCandleTracking(refresh),
        ])

        /*
         * Contributions are scoped by offer id, so the board can only be read
         * once the campaign is known — one more request, and the one that
         * makes a player's share showable rather than just their own stake.
         */
        const current = activeOffer(o)
        const rows = current ? await fetchContributions(current.offer_id, refresh) : []

        if (!alive.current) return
        setOffers(o)
        setClaim(c)
        setTracking(t)
        setContributors(rows.length)
        setStakes(rows)
        setMine(Number(rows.find((r) => r.wallet === account)?.amount ?? 0))
      } catch (err) {
        if (alive.current) setError(readableError(err))
      } finally {
        if (alive.current) setLoading(false)
      }
    },
    [account],
  )

  useEffect(() => {
    setLoading(true)
    void load(false)
  }, [load])

  const reload = useCallback(() => load(true), [load])

  return { offers, mine, contributors, stakes, claim, tracking, loading, error, reload }
}

/* ---------- the screen ---------- */

export default function Candle() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const data = useCandle(account)
  const { offers, mine, contributors, stakes, claim, tracking } = data

  const [gems, setGems] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const offer = useMemo(() => activeOffer(offers, now), [offers, now])
  /* Everything already fetched that has not started yet. */
  const upcoming = useMemo(() => upcomingOffers(offers, now), [offers, now])

  const run = useCallback(
    async (mark: Busy, act: () => Promise<unknown>, done: string) => {
      if (!session) return
      setBusy(mark)
      setError(null)
      setNotice(null)
      try {
        await act()
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 900))
          await Promise.all([data.reload(), refreshPlayer({ force: true })])
        }
        /* A claim empties the pot. */
        refreshChore('candle')
        setNotice(done)
      } catch (err) {
        setError(readableError(err))
      } finally {
        setBusy(null)
      }
    },
    [session, data, refreshPlayer],
  )

  if (!player) return null

  const amount = Math.max(0, Math.floor(Number(gems) || 0))
  const balance = player.activestats.gems

  const doContribute = () => {
    setGems('')
    return run(
      'contribute',
      () => contributeGems(session!, offer!.offer_id, amount),
      'Contribution registered',
    )
  }

  const doClaim = () =>
    run('claim', () => claimCandle(session!), 'Rewards claimed successfully!')

  return (
    <div className="candle">
      {/* The one screen that never had its backdrop, though the art was
          already in the build. */}
      <img className="candle__art" src={asset("/assets/background/bg-candle.png")} alt="" />
      <div className="candle__scrim" />

      <header className="candle__head">
        <div>
          <h1 className="candle__title">Candle</h1>
          <p className="candle__lede">
            Missions that turn gems into Trilium, Shards or WAX. Everyone who
            qualifies puts gems in, and the reward is split by how much each of
            them put up.
          </p>
        </div>
      </header>

      {notice && <div className="alert alert--ok">{notice}</div>}
      {(error || data.error) && (
        <div className="alert alert--error">{error ?? data.error}</div>
      )}

      <div className="candle__cols">
        <div>
          {data.loading ? (
            <div className="mission mission--loading" />
          ) : !offer ? (
            <p className="candle__empty">
              No mission is running.
              {tracking &&
                ` The next one is due ${countdown(
                  Date.parse(tracking.next_offer_creation + 'Z') - now,
                )} from now.`}
            </p>
          ) : (
            <Mission
              offer={offer}
              player={player}
              mine={mine}
              stakes={stakes}
              contributors={contributors}
              now={now}
              balance={balance}
              gems={gems}
              amount={amount}
              busy={busy}
              canAct={!!session}
              onGems={setGems}
              onContribute={() => void doContribute()}
            />
          )}

          {upcoming.length > 0 && <UpNext offers={upcoming} now={now} />}
        </div>

        <aside className="candle__side">
          <Winnings
            claim={claim}
            busy={busy}
            canAct={!!session}
            onClaim={() => void doClaim()}
          />
        </aside>
      </div>
    </div>
  )
}

/* ---------- what is coming ---------- */

/**
 * The missions queued behind this one.
 *
 * Gems are finite and a mission is a bet on a rate, so what is coming next is
 * part of the decision: holding back for a WAX mission in six hours is a
 * legitimate play, and the screen could not previously tell anyone one
 * existed. Every offer is already in memory — this is a filter, not a fetch.
 */
export function UpNext({ offers, now }: { offers: CandleOffer[]; now: number }) {
  return (
    <section className="upnext">
      <h3 className="panel__title">Coming up</h3>
      <div className="upnext__rows">
        {offers.map((o) => {
          const opensIn = Date.parse(o.offer_start + 'Z') - now
          return (
            <article className="upnext__row" key={o.offer_id}>
              <img
                className="upnext__icon"
                src={tokenIcon(o.reward_type)}
                alt=""
                width={26}
                height={26}
              />
              <span className="upnext__what">
                <strong>
                  {formatDecimals(
                    tokenAmount(o.reward_amount, o.reward_type),
                    placesFor(tokenAmount(o.reward_amount, o.reward_type), o.reward_type),
                  )}{' '}
                  {tokenSymbol(o.reward_type)}
                </strong>
                {/* The bar to get in, not just what it is measured on:
                    "Portals used" alone does not say whether the player is
                    anywhere near qualifying for it. */}
                <span className="upnext__req">
                  Needs {formatNumber(o.requirement_amount)} {o.requirements.toLowerCase()}
                </span>
              </span>
              <span className="upnext__when">
                <span>Opens in</span>
                <strong>{countdown(opensIn)}</strong>
              </span>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- the mission clock ---------- */

/**
 * How long is left, as a ring that empties.
 *
 * The figure alone is easy to skim past; a ring that is visibly draining says
 * "decide now" at a glance, and its colour does the rest — the fill turns
 * amber and then red as the window closes, so urgency is legible without
 * reading the number at all.
 *
 * `--left` is the percentage still to run and drives a conic gradient, masked
 * into an annulus so the countdown can sit inside it.
 */
function MissionClock({
  left,
  label,
  time,
  running,
}: {
  /** Fraction of the window still to run, 0–1. */
  left: number
  label: string
  time: string
  running: boolean
}) {
  const pct = Math.min(100, Math.max(0, left * 100))
  const urgency = !running ? 'done' : pct > 50 ? 'calm' : pct > 20 ? 'soon' : 'now'

  return (
    <div
      className={`missionclock missionclock--${urgency}`}
      style={{ ['--left' as string]: pct }}
    >
      <span className="missionclock__ring" aria-hidden="true" />
      <span className="missionclock__face">
        <span className="missionclock__label">{label}</span>
        <strong className="missionclock__time">{time}</strong>
      </span>
    </div>
  )
}

/* ---------- who is in ---------- */

/**
 * Everyone's stake in the running campaign, biggest first.
 *
 * The screen already read this board — it is how a player's share of the pot
 * is worked out — and then reduced it to a count. But a candle is a contest
 * between the people in it: what a gem buys depends entirely on who else has
 * spent and how much, and "14 players" does not say whether that is fourteen
 * small stakes or one whale and thirteen hopefuls.
 *
 * Named and faced rather than listed by wallet, because these are opponents
 * rather than addresses — the same tag and avatar the leaderboards show.
 */
function ContributorBoard({
  stakes,
  total,
  wallet,
  onClose,
}: {
  stakes: Contribution[]
  total: number
  wallet: string
  onClose: () => void
}) {
  const [tags, setTags] = useState<Record<string, string>>({})
  const [avatars, setAvatars] = useState<Record<string, number>>({})

  /*
     Read only once the board is opened, and from the same cached page the
     rest of the app resolves names out of — so this is usually no request at
     all, and never one for a player who does not open it.
  */
  useEffect(() => {
    let live = true
    fetchPlayerTags()
      .then((r) => {
        if (!live) return
        setTags(r.tags)
        setAvatars(r.avatars)
      })
      /* Names are a courtesy; the wallets underneath are the real answer. */
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const rows = useMemo(
    () => [...stakes].sort((a, b) => Number(b.amount) - Number(a.amount)),
    [stakes],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet" role="dialog" aria-label="Contributors" onClick={onClose}>
      <div className="sheet__panel panel" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
          <span className="panel__title">Who is in</span>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="muted">Nobody has contributed yet.</p>
        ) : (
          <div className="candleboard">
            {rows.map((r, i) => {
              const amount = Number(r.amount)
              const cut = total > 0 ? (amount / total) * 100 : 0
              const you = r.wallet === wallet
              return (
                <div
                  className={`candleboard__row${you ? ' candleboard__row--you' : ''}`}
                  key={r.wallet}
                >
                  <span className={`rank ${rankClass(i + 1)}`}>{i + 1}</span>
                  <PlayerAvatar
                    id={avatars[r.wallet]}
                    name={tags[r.wallet] || r.wallet}
                    className="candleboard__avatar"
                    size={28}
                  />
                  <span className="candleboard__name">
                    {tags[r.wallet] || r.wallet}
                    {you && <span className="candleboard__you">you</span>}
                  </span>
                  {/* The share is what the gems actually bought. */}
                  <span className="candleboard__cut mono">{cut.toFixed(1)}%</span>
                  <span className="candleboard__gems mono">
                    {formatNumber(amount)}
                    <img
                      src={asset('/assets/icons/gems.png')}
                      alt="gems"
                      width={14}
                      height={14}
                    />
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- the running mission ---------- */

export function Mission({
  offer,
  player,
  mine,
  stakes,
  contributors,
  now,
  balance,
  gems,
  amount,
  busy,
  canAct,
  onGems,
  onContribute,
}: {
  offer: CandleOffer
  player: Player
  mine: number
  stakes: Contribution[]
  contributors: number
  now: number
  balance: number
  gems: string
  amount: number
  busy: Busy
  canAct: boolean
  onGems: (v: string) => void
  onContribute: () => void
}) {
  const [showBoard, setShowBoard] = useState(false)
  const state = offerState(offer, now)
  const gate = eligibility(offer, player)
  const share = shareOf(offer, mine)
  const after = projectShare(offer, mine, amount)
  const type = offer.reward_type
  const prize = tokenAmount(offer.reward_amount, type)
  /* Per figure, not per screen: only the sub-one ones keep decimals. */
  const dp = (v: number) => placesFor(v, type)
  const symbol = tokenSymbol(offer.reward_type)
  const icon = tokenIcon(offer.reward_type)

  const tooPoor = amount > balance
  const canContribute =
    canAct && busy === null && state.phase === 'open' && gate.qualified && amount > 0 && !tooPoor

  /*
     How much of the window is left, as a fraction.

     Falls back to a full ring rather than an empty one when the dates cannot
     be read: an empty one claims the mission is nearly over, which is the
     more damaging thing to say wrongly.
  */
  const opened = Date.parse(offer.offer_start + 'Z')
  const closes = Date.parse(offer.offer_end + 'Z')
  const span = closes - opened
  const burn =
    Number.isFinite(span) && span > 0
      ? Math.min(1, Math.max(0, (closes - now) / span))
      : 1

  return (
    <section className="mission">
      <header className="mission__head">
        <div className="mission__intro">
          <p className={`mission__phase mission__phase--${state.phase}`}>
            {state.phase === 'open'
              ? 'Open now'
              : state.phase === 'upcoming'
                ? 'Not started'
                : 'Closed — waiting for claim'}
          </p>
          <h2 className="mission__title">{offer.requirements}</h2>

          <div className="mission__prize">
            <img src={icon} alt="" width={34} height={34} />
            <span className="mission__prizeval">
              {formatDecimals(prize, dp(prize))}
            </span>
            <span className="mission__prizesym">{symbol}</span>
            <span className="mission__prizecap">to share</span>
          </div>
        </div>

        <MissionClock
          left={burn}
          running={state.phase === 'open'}
          label={state.phase === 'upcoming' ? 'Starts in' : 'Closes in'}
          time={state.phase === 'closed' ? '—' : countdown(state.msLeft)}
        />
      </header>

      {/*
        The entry requirement, as one line.

        It was a titled panel wrapping a paragraph wrapping a badge, for what
        is a yes or a no. The badge already carries the whole answer — "288
        short — 12 of 300" — so the prose around it was restating it at
        length. The rest of the sentence it used to make survives as the
        tooltip, for anyone who wants to know it is a gate rather than a
        target.
      */}
      <div
        className={`gate${gate.qualified ? ' gate--ok' : ''}`}
        title={`Taking part needs ${formatNumber(gate.need)} lifetime ${offer.requirements.toLowerCase()}. It is a gate rather than a target — the contract refuses a contribution below it outright.`}
      >
        <span className="gate__mark">{gate.qualified ? '✓' : '✕'}</span>
        <span className="gate__text">
          {gate.qualified
            ? `Qualified — ${formatNumber(gate.have)} of ${formatNumber(gate.need)} ${offer.requirements.toLowerCase()}`
            : `${formatNumber(gate.short)} short — ${formatNumber(gate.have)} of ${formatNumber(gate.need)} ${offer.requirements.toLowerCase()}`}
        </span>
      </div>

      {/* ---------- contributions ---------- */}

      {/*
        Five small numbers. As stacked full-width rows inside a titled panel
        they took more height than the mission above them; as a row of tiles
        they are read in one pass, which is what a stat block is for.
      */}
      <dl className="mission__facts">
          <div>
            <dt>Total in</dt>
            <dd>
              {formatNumber(share.total)}
              <img src={asset("/assets/icons/gems.png")} alt="gems" width={14} height={14} />
            </dd>
          </div>
          <div>
            <dt>You put in</dt>
            <dd>
              {formatNumber(share.mine)}
              <img src={asset("/assets/icons/gems.png")} alt="gems" width={14} height={14} />
            </dd>
          </div>
          <div>
            <dt>Players</dt>
            {/*
              The count opens the board rather than just stating it. What a
              gem buys here depends on who else has spent and how much, and
              "14 players" does not say whether that is fourteen small stakes
              or one whale and thirteen hopefuls.
            */}
            <dd>
              <button
                type="button"
                className="mission__who"
                onClick={() => setShowBoard(true)}
                disabled={contributors === 0}
                title="See who has contributed and how much"
              >
                {formatNumber(contributors)}
                <span className="mission__whoHint">view</span>
              </button>
            </dd>
          </div>
          {/*
            The rate, not the prize. It is what a contribution is actually
            buying, and it falls every time anybody adds to the pot.
          */}
          <div>
            <dt>Per gem</dt>
            <dd>
              {share.total > 0 ? formatDecimals(share.perGem, dp(share.perGem)) : '—'}
              {share.total > 0 && <span className="faint">{symbol}</span>}
            </dd>
          </div>
          <div className="mission__facts--lead">
            <dt>Your share now</dt>
            <dd>
              {formatDecimals(share.payout, dp(share.payout))}
              <span className="faint">
                {symbol} · {(share.fraction * 100).toFixed(1)}%
              </span>
            </dd>
          </div>
      </dl>

      {/* ---------- contribute ---------- */}

      {state.phase === 'open' && (
        <section className="missionact">
          <div className="missionact__lead">
            <strong>{mine > 0 ? 'Add more gems' : 'Contribute gems'}</strong>
            <span className="faint">
              You hold {formatNumber(balance)}
              <img src={asset("/assets/icons/gems.png")} alt="gems" width={13} height={13} />
            </span>
          </div>

          <div className="contribute">
            <input
              className="input"
              type="number"
              min={1}
              max={balance}
              step={1}
              inputMode="numeric"
              placeholder="0"
              value={gems}
              onChange={(e) => onGems(e.target.value)}
              disabled={!canAct || busy !== null || !gate.qualified}
            />
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canContribute}
              onClick={onContribute}
              title={
                !gate.qualified
                  ? 'You do not meet the requirement for this mission'
                  : tooPoor
                    ? 'More gems than you hold'
                    : 'Gems are spent immediately'
              }
            >
              {busy === 'contribute' && <span className="spinner" />}
              Contribute Gems
            </button>
          </div>

          {/*
            What the contribution would actually do — to the share and to the
            rate. Adding to the pot lowers the rate for everyone, so quoting
            today's rate against tomorrow's gems would flatter every one of
            these decisions. Hidden for a player who does not qualify, since
            the contract would refuse the contribution the figure describes.
          */}
          {amount > 0 && gate.qualified && (
            <dl className="mission__facts mission__facts--after">
              <div>
                <dt>Your share after</dt>
                <dd>
                  {formatDecimals(after.payout, dp(after.payout))}
                  <span className="faint">
                    {symbol} · {(after.fraction * 100).toFixed(1)}%
                  </span>
                </dd>
              </div>
              <div>
                <dt>Worth per gem after</dt>
                <dd>
                  {formatDecimals(after.perGem, dp(after.perGem))}
                  <span className="faint">{symbol}</span>
                </dd>
              </div>
              <div>
                <dt>Gain over contributing nothing</dt>
                <dd>
                  +{formatDecimals(after.payout - share.payout, dp(after.payout - share.payout))}
                  <span className="faint">{symbol}</span>
                </dd>
              </div>
            </dl>
          )}

          {tooPoor && (
            <p className="hint hint--error">
              That is more gems than you hold.
            </p>
          )}
        </section>
      )}

      {showBoard && (
        <ContributorBoard
          stakes={stakes}
          total={share.total}
          wallet={player.wallet}
          onClose={() => setShowBoard(false)}
        />
      )}
    </section>
  )
}

/* ---------- winnings ---------- */

export function Winnings({
  claim,
  busy,
  canAct,
  onClaim,
}: {
  claim?: CandleClaim
  busy: Busy
  canAct: boolean
  onClaim: () => void
}) {
  const tlm = tokenAmount(Number(claim?.tlm ?? 0), 'tlm')
  const wax = tokenAmount(Number(claim?.wax ?? 0), 'wax')
  const anything = tlm > 0 || wax > 0

  return (
    <section className="winnings">
      <h3 className="panel__title">Gains since last claim</h3>

      {!claim ? (
        <p className="faint">
          Nothing waiting. Finished missions pay out here once they settle.
        </p>
      ) : (
        <>
          <div className="winnings__rows">
            <div className="winnings__row">
              <img src={asset("/assets/icons/tlm.svg")} alt="" width={20} height={20} />
              <strong>{formatDecimals(tlm, placesFor(tlm, 'tlm'))}</strong>
              <span>TLM</span>
            </div>
            <div className="winnings__row">
              <img src={asset("/assets/icons/wax-coin.png")} alt="" width={20} height={20} />
              <strong>{formatDecimals(wax, placesFor(wax, 'wax'))}</strong>
              <span>WAX</span>
            </div>
          </div>

          <dl className="mission__facts">
            <div>
              <dt>Gems you have contributed</dt>
              <dd>{formatNumber(Number(claim.gems ?? 0))}</dd>
            </div>
            <div>
              <dt>Gems across those missions</dt>
              <dd>{formatNumber(Number(claim.total_gems ?? 0))}</dd>
            </div>
          </dl>

          {/*
            `payout` sends both tokens and then erases the row, which takes
            the lifetime gem tallies with it. Worth saying, because they read
            like a permanent record.
          */}
          <p className="hint">
            Claiming takes both tokens at once and clears this record,
            including the gem tallies above.
          </p>
        </>
      )}

      <button
        type="button"
        className="btn btn--primary winnings__claim"
        disabled={!canAct || busy !== null || !anything}
        onClick={onClaim}
      >
        {busy === 'claim' && <span className="spinner" />}
        Claim Rewards
      </button>
    </section>
  )
}
