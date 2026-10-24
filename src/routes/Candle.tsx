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
  activeOffers,
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
  perGemPlaces,
} from '@/candle/rules'
import { claimCandle, contributeGems } from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { useModal } from '@/components/useModal'
import { DIRTIES } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import { formatNumber, formatDecimals } from '@/format'
import type { Player } from '@/chain/types'
import { fetchPlayerTags } from '@/chain/queries'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { rankClass } from '@/leaderboard/rules'
import { ActionBanner } from '@/components/ActionBanner'
import { asset } from '@/assets'
import { usePhone } from '@/components/usePhone'
import { PhoneCandle } from '@/candle/PhoneCandle'

/**
 * The Candle.
 *
 * A campaign puts up a fixed reward, anyone who meets its requirement can
 * throw gems at it, and when the day is up the reward is split in proportion
 * to what each contributor put in.
 *
 * Several can run at once. This screen assumed one — it asked for the running
 * campaign, singular, and got whichever the contract happened to return
 * first. The second was not shown as running and was not in "Coming up"
 * either, so a mission a player could have entered was simply missing.
 *
 * That makes it a dilution game, which is the opposite of how a "contribute"
 * screen normally reads. Adding gems raises your share and lowers what every
 * gem in the pot is worth — including the ones you already put in. So each
 * mission is drawn as the split itself: a bar of everyone's stake to scale,
 * with the player's own slice in teal and a ghost slice for what they are
 * about to add, so the dilution is seen rather than explained — alongside
 * what a gem is worth now and what it would be worth after.
 *
 * Entry is a gate, not a score. `contribute` checks the player's lifetime
 * counter against the requirement and refuses outright below it, so there is
 * nothing to show but qualified or short, and by how much.
 */

type Busy = string | null

/* ---------- data ---------- */

/**
 * Everyone in one running campaign, and this player's place in it.
 *
 * Held per campaign rather than as three loose values, because there can be
 * more than one running at a time and each has its own board. Flattened, the
 * second campaign's numbers would overwrite the first's.
 */
export interface Board {
  stakes: Contribution[]
  contributors: number
  mine: number
}

const EMPTY_BOARD: Board = { stakes: [], contributors: 0, mine: 0 }

interface CandleData {
  offers: CandleOffer[]
  /** Keyed by `offer_id`; missing until that campaign's board has been read. */
  boards: Map<string, Board>
  claim?: CandleClaim
  tracking?: CandleTracking
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

function useCandle(account: string | null): CandleData {
  const [offers, setOffers] = useState<CandleOffer[]>([])
  const [boards, setBoards] = useState<Map<string, Board>>(() => new Map())
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
         * Contributions are scoped by offer id, so a board can only be read
         * once its campaign is known — and there can be more than one running,
         * so this is one request each rather than one in total. They go
         * together: two campaigns should not appear a request apart.
         */
        const running = activeOffers(o)
        const rows = await Promise.all(
          running.map((offer) => fetchContributions(offer.offer_id, refresh)),
        )

        if (!alive.current) return
        setOffers(o)
        setClaim(c)
        setTracking(t)
        setBoards(
          new Map(
            running.map((offer, i) => [
              offer.offer_id,
              {
                stakes: rows[i],
                contributors: rows[i].length,
                mine: Number(rows[i].find((r) => r.wallet === account)?.amount ?? 0),
              },
            ]),
          ),
        )
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

  return { offers, boards, claim, tracking, loading, error, reload }
}

/* ---------- the screen ---------- */

export default function Candle() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)

  const data = useCandle(account)
  const phone = usePhone()
  const { offers, boards, claim, tracking } = data

  /*
     One draft per campaign, keyed by offer id.

     A single string was right while there could only be one mission on
     screen. With two, typing 400 into one of them put 400 into the other as
     well — and the contribute button reads this number.
  */
  const [gems, setGems] = useState<Record<string, string>>({})
  const setGemsFor = useCallback(
    (offerId: string, value: string) =>
      setGems((g) => ({ ...g, [offerId]: value })),
    [],
  )

  /*
     `busy` is the key of whatever is being signed, straight from the hook.
     It used to be narrowed to a fixed pair, but a contribute button now has
     to name which campaign it belongs to: one signature at a time still
     disables them all, while only the one that was pressed spins.
  */
  const { busy, error, run } = useAction()

  /*
     Player tags and faces, read once for the whole screen.

     Every mission's bar names its slices and every board names its rows,
     out of the same cached page the rest of the app resolves names from —
     so this is usually no request at all. Names are a courtesy; the
     wallets underneath are the real answer, so a failure is silent.
  */
  const [names, setNames] = useState<{
    tags: Record<string, string>
    avatars: Record<string, number>
  }>({ tags: {}, avatars: {} })
  useEffect(() => {
    let live = true
    fetchPlayerTags()
      .then((r) => {
        if (live) setNames({ tags: r.tags, avatars: r.avatars })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  /* Every campaign running right now, soonest to close first. */
  const running = useMemo(() => activeOffers(offers, now), [offers, now])
  /* Everything already fetched that has not started yet. */
  const upcoming = useMemo(() => upcomingOffers(offers, now), [offers, now])

  /* A claim empties the pot, so the dot stops waiting for its own timer. */
  const opts = (action: keyof typeof DIRTIES) => ({
    after: data.reload,
    dirties: DIRTIES[action],
  })

  if (!player) return null

  const balance = player.activestats.gems

  const amountFor = (offerId: string) =>
    Math.max(0, Math.floor(Number(gems[offerId]) || 0))

  const doContribute = (offer: CandleOffer) => {
    const amount = amountFor(offer.offer_id)
    setGemsFor(offer.offer_id, '')
    return run(
      `contribute:${offer.offer_id}`,
      () => contributeGems(session!, offer.offer_id, amount),
      'Contribution registered',
      opts('contributeGems'),
    )
  }

  const doClaim = () =>
    run('claim', () => claimCandle(session!), 'Rewards claimed successfully!', opts('claimCandle'))

  if (phone) {
    return (
      <div className="candle candle--phone">
        <img className="candle__art" src={asset('/assets/background/bg-candle.png')} alt="" />
        <div className="candle__scrim" />
        <ActionBanner error={error ?? data.error} />
        <PhoneCandle
          running={running}
          upcoming={upcoming}
          boards={boards}
          player={player}
          now={now}
          balance={balance}
          draft={gems}
          onDraft={setGemsFor}
          busy={busy}
          canAct={!!session}
          onContribute={(offer) => void doContribute(offer)}
          claim={claim}
          onClaim={() => void doClaim()}
          tracking={tracking}
          loading={data.loading}
          tags={names.tags}
          avatars={names.avatars}
        />
      </div>
    )
  }

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

        {/*
          What is waiting to be claimed, on the title's line.

          It was a full panel in a column of its own, which cost the missions
          a third of the width for two figures and a button. Up here it is
          read on the way past and the cabinets get the whole page.
        */}
        <Winnings
          claim={claim}
          busy={busy}
          canAct={!!session}
          onClaim={() => void doClaim()}
        />
      </header>

      <ActionBanner error={error ?? data.error} />

      <div className="candle__cols">
        <div>
          {data.loading ? (
            <div className="split split--loading" />
          ) : running.length === 0 ? (
            <p className="candle__empty">
              No mission is running.
              {tracking &&
                ` The next one is due ${countdown(
                  Date.parse(tracking.next_offer_creation + 'Z') - now,
                )} from now.`}
            </p>
          ) : (
            /* One card each. The contract can run several at once, and it
               does — the screen used to show whichever came back first. */
            running.map((offer) => {
              const board = boards.get(offer.offer_id) ?? EMPTY_BOARD
              return (
                <Mission
                  key={offer.offer_id}
                  offer={offer}
                  player={player}
                  mine={board.mine}
                  stakes={board.stakes}
                  contributors={board.contributors}
                  now={now}
                  balance={balance}
                  gems={gems[offer.offer_id] ?? ''}
                  amount={amountFor(offer.offer_id)}
                  busy={busy}
                  busyKey={`contribute:${offer.offer_id}`}
                  canAct={!!session}
                  onGems={(value) => setGemsFor(offer.offer_id, value)}
                  onContribute={() => void doContribute(offer)}
                  tags={names.tags}
                  avatars={names.avatars}
                />
              )
            })
          )}

          {upcoming.length > 0 && <UpNext offers={upcoming} player={player} now={now} />}
        </div>
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
export function UpNext({
  offers,
  player,
  now,
}: {
  offers: CandleOffer[]
  player: Player
  now: number
}) {
  return (
    <section className="upnext">
      <h3 className="panel__title">Coming up</h3>
      <div className="upnext__rows">
        {offers.map((o) => {
          const opensIn = Date.parse(o.offer_start + 'Z') - now
          /*
             Whether this one is already within reach.

             The bar on its own is half a sentence: a player reading "needs
             110 quests finished" has no idea whether that is a mission to
             plan for or one they are already through — and the only thing
             they can act on before it opens is the difference.
          */
          const gate = eligibility(o, player)
          return (
            <article
              className={`upnext__row${gate.qualified ? ' upnext__row--ready' : ''}`}
              key={o.offer_id}
            >
              <img
                className="upnext__icon"
                src={tokenIcon(o.reward_type)}
                alt=""
                width={26}
                height={26}
              />
              <span className="upnext__what">
                <span className="upnext__amt">
                  <b>
                    {formatDecimals(
                      tokenAmount(o.reward_amount, o.reward_type),
                      placesFor(tokenAmount(o.reward_amount, o.reward_type), o.reward_type),
                    )}
                  </b>
                  <span>{tokenSymbol(o.reward_type)}</span>
                </span>
                {/* The bar to get in, what it is measured on, and where the
                    player stands against it — the three together are the
                    whole of what can be done about a mission before it
                    opens. */}
                <span className="upnext__req">
                  Needs {formatNumber(o.requirement_amount)} {o.requirements.toLowerCase()} ·{' '}
                  <b>you have {formatNumber(gate.have)}</b>
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

/* ---------- who is in ---------- */

/**
 * Everyone's stake in the running campaign, biggest first.
 *
 * The bar on the card is this board drawn to scale; this is the same board
 * read down as a list, for when the slices are too thin to hover or the
 * player wants the figures in a column. Named and faced rather than listed
 * by wallet, because these are opponents rather than addresses — the same
 * tag and avatar the leaderboards show, resolved once by the screen and
 * handed down.
 */
function ContributorBoard({
  stakes,
  total,
  wallet,
  tags,
  avatars,
  onClose,
}: {
  stakes: Contribution[]
  total: number
  wallet: string
  tags: Record<string, string>
  avatars: Record<string, number>
  onClose: () => void
}) {
  const rows = useMemo(
    () => [...stakes].sort((a, b) => Number(b.amount) - Number(a.amount)),
    [stakes],
  )

  const panel = useModal(onClose)

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Contributors"
      onClick={onClose}
    >
      <div
        className="sheet__panel panel candleboard__panel"
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
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

const NO_TAGS: Record<string, string> = {}
const NO_AVATARS: Record<string, number> = {}

/**
 * The mission as a split.
 *
 * The pot is a fixed sum divided by gems, so the truest picture of a mission
 * is a proportional bar: everyone's stake as a slice, the player's own in
 * teal. Pulling the slider grows that slice and visibly shrinks everyone
 * else's — dilution is seen rather than explained, which is the one thing
 * about this screen that every earlier shape of it had to say in words.
 *
 * Hovering a slice names it; the player count opens the same board as a
 * list, for slices too thin to hover. Nothing folds: with the bar carrying
 * the board, the card is short enough to show every mission in full.
 */
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
  busyKey = 'contribute',
  canAct,
  onGems,
  onContribute,
  tags = NO_TAGS,
  avatars = NO_AVATARS,
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
  /**
   * The key this card's own button signs under.
   *
   * `busy` says what is being signed anywhere on the screen, which is what
   * disables every button — two signatures cannot be in flight at once. This
   * says which card is the one that was pressed, so only that spinner runs.
   */
  busyKey?: string
  canAct: boolean
  onGems: (v: string) => void
  onContribute: () => void
  /** Player tags and faces by wallet, for the slices and the board. */
  tags?: Record<string, string>
  avatars?: Record<string, number>
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
  const symbol = tokenSymbol(type)
  const icon = tokenIcon(type)

  const open = state.phase === 'open'
  const soon = state.phase === 'upcoming'
  const tooPoor = amount > balance
  /* Whether the controls take input at all — the gate, the clock and a
     signature in flight all shut them. */
  const usable = canAct && busy === null && open && gate.qualified
  const canContribute = usable && amount > 0 && !tooPoor
  /*
     Whether there is a contribution to price. The ghost slice and the two
     "after" figures appear together, and only when the contribution could
     actually be made — a locked or unopened mission has nothing to project.
  */
  const priced = amount > 0 && gate.qualified && open

  const clock = soon
    ? { label: 'Opens in', time: countdown(state.msLeft) }
    : open
      ? { label: 'Closes in', time: countdown(state.msLeft) }
      : { label: 'Closed', time: 'settling' }

  const action = soon
    ? 'Not open yet'
    : !open
      ? 'Closed'
      : !gate.qualified
        ? 'Locked'
        : 'Contribute gems'

  /* Biggest first, so the bar reads like the board. */
  const slices = useMemo(
    () => [...stakes].sort((a, b) => Number(b.amount) - Number(a.amount)),
    [stakes],
  )
  /* The bar's denominator: the pot, plus what is about to go in. */
  const whole = share.total + (priced ? amount : 0)
  const name = (wallet: string) => (wallet === player.wallet ? 'you' : tags[wallet] || wallet)

  const gateHint = `Needs ${formatNumber(gate.need)} lifetime ${offer.requirements.toLowerCase()} — you have ${formatNumber(gate.have)}`

  const gemIcon = (
    <img className="split__gem" src={asset('/assets/icons/gems.png')} alt="gems" width={13} height={13} />
  )

  return (
    <section
      className={`split${soon ? ' split--soon' : ''}${
        !gate.qualified && !soon ? ' split--locked' : ''
      }`}
    >
      <header className="split__top">
        <span className="split__kick">Mission</span>
        <h3 className="split__name">{offer.requirements}</h3>
        {/*
          The gate, as a chip beside the name.

          All a player needs from it is yes or how far short; the bar and
          where they stand against it are a tooltip on either answer.
        */}
        {gate.qualified ? (
          <span className="split__gate split__gate--ok" title={gateHint}>
            <span aria-hidden="true">&#10003;</span> qualified
          </span>
        ) : (
          <span className="split__gate split__gate--short" title={gateHint}>
            <span aria-hidden="true">&#10005;</span>
            <b>{formatNumber(gate.short)} short</b>
          </span>
        )}
        <span className="split__clock">
          <span>{clock.label}</span>
          <b>{clock.time}</b>
        </span>
      </header>

      <p className="split__pot">
        <img src={icon} alt="" width={28} height={28} />
        <b>{formatDecimals(prize, dp(prize))}</b>
        <span>
          {symbol} {soon ? 'on offer' : 'in the pot'}
        </span>
      </p>

      {/*
        The split itself. Every slice is a share of the bar's whole, so
        adding a ghost slice for the pending contribution is what shrinks
        the others — the arithmetic draws itself.
      */}
      <div
        className="split__bar"
        role="img"
        aria-label={`${formatNumber(share.total)} gems contributed by ${formatNumber(contributors)} players`}
      >
        {slices.map((r, i) => {
          const gemsIn = Number(r.amount)
          const you = r.wallet === player.wallet
          return (
            <span
              className={`split__seg${you ? ' split__seg--you' : ''}`}
              style={{ flexBasis: `${(gemsIn / whole) * 100}%` }}
              key={r.wallet}
            >
              <span className="split__tip">
                {i + 1}. {name(r.wallet)} · <b>{((gemsIn / whole) * 100).toFixed(1)}%</b> ·{' '}
                {formatNumber(gemsIn)} gems
              </span>
            </span>
          )
        })}
        {/* A pot with gems but no board yet: one plain slice, not an empty bar. */}
        {slices.length === 0 && share.total > 0 && (
          <span className="split__seg" style={{ flexBasis: `${(share.total / whole) * 100}%` }} />
        )}
        {priced && (
          <span className="split__seg split__seg--ghost" style={{ flexBasis: `${(amount / whole) * 100}%` }}>
            <span className="split__tip">+{formatNumber(amount)} gems you are about to add</span>
          </span>
        )}
      </div>

      {share.total === 0 && (
        <p className="split__none">
          {soon ? 'Nobody can contribute until it opens.' : 'Nobody has contributed yet.'}
        </p>
      )}

      <div className="split__under">
        <span>
          A gem buys{' '}
          <b>
            {share.total > 0
              ? formatDecimals(share.perGem, perGemPlaces(share.perGem, type))
              : '—'}
          </b>{' '}
          {share.total > 0 && symbol}
        </span>
        <span>
          <b>{formatNumber(share.total)}</b> gems contributed ·{' '}
          {/*
            The count opens the board rather than just stating it. What a
            gem buys here depends on who else has spent and how much, and
            "14 players" does not say whether that is fourteen small stakes
            or one whale and thirteen hopefuls.
          */}
          <button
            type="button"
            className="split__who"
            onClick={() => setShowBoard(true)}
            disabled={contributors === 0}
            title="See who has contributed and how much"
          >
            <b>{formatNumber(contributors)}</b> players
          </button>
        </span>
      </div>

      {/* The player's own row: what is in, what it is worth, and the control. */}
      <div className="split__you">
        <div className="split__share">
          <span className="split__kick">
            Your contribution · <b>{formatNumber(mine)}</b>
            {gemIcon}
          </span>
          <p className="split__now">
            Your share now{' '}
            <b>{mine > 0 ? `${formatDecimals(share.payout, dp(share.payout))} ${symbol}` : '—'}</b>
            {mine > 0 && <small>({(share.fraction * 100).toFixed(1)}%)</small>}
          </p>
          {/*
            What the contribution would do — to the share and to the rate.
            Adding to the pot lowers the rate for everyone, so both sides of
            the sum move and the gems go into the denominator too.
          */}
          {priced && (
            <p className="split__after">
              Your share after <b>{formatDecimals(after.payout, dp(after.payout))} {symbol}</b>
              <span aria-hidden="true"> · </span>
              Worth per gem after{' '}
              <b>{formatDecimals(after.perGem, perGemPlaces(after.perGem, type))} {symbol}</b>
            </p>
          )}
          {tooPoor && <p className="hint hint--error">That is more gems than you hold.</p>}
        </div>

        <div className="split__ctl">
          <span className="split__kick">
            You hold <b>{formatNumber(balance)}</b>
            {gemIcon}
          </span>
          {/*
            Slider, box and button as one control: the slider is for feeling
            the bar move, the box for an exact figure, and both write the
            same draft.
          */}
          <div className="split__field">
            <input
              className="split__range"
              type="range"
              min={0}
              max={Math.max(0, balance)}
              step={1}
              value={Math.min(amount, Math.max(0, balance))}
              onChange={(e) => onGems(e.target.value)}
              disabled={!usable || balance <= 0}
              aria-label="Gems to contribute"
            />
            <input
              className="split__in"
              type="number"
              min={1}
              max={balance}
              step={1}
              inputMode="numeric"
              placeholder="0"
              value={gems}
              onChange={(e) => onGems(e.target.value)}
              disabled={!usable}
              aria-label="Gems to contribute, exactly"
            />
            <button
              type="button"
              className="btn btn--primary split__go"
              disabled={!canContribute}
              onClick={onContribute}
              title={
                soon
                  ? 'This mission has not opened yet'
                  : !gate.qualified
                    ? 'You do not meet the requirement for this mission'
                    : tooPoor
                      ? 'More gems than you hold'
                      : 'Gems are spent immediately'
              }
            >
              {busy === busyKey && <span className="spinner" />}
              {action}
            </button>
          </div>
        </div>
      </div>

      {showBoard && (
        <ContributorBoard
          stakes={stakes}
          total={share.total}
          wallet={player.wallet}
          tags={tags}
          avatars={avatars}
          onClose={() => setShowBoard(false)}
        />
      )}
    </section>
  )
}

/* ---------- winnings ---------- */

/**
 * What is waiting to be claimed.
 *
 * This was a panel with the two tokens, two lifetime gem tallies and a
 * paragraph about what claiming does. None of it was a decision: the gem
 * tallies are a record rather than a reason, and the paragraph described a
 * button that has one outcome. What is left is the two figures and the
 * button, on one line beside the page title.
 */
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

  /*
     Whole tokens only.

     Decimals on a strip that exists to be glanced at are noise — nobody
     claims on the strength of a fourth decimal place. A balance that is
     real but rounds away says so rather than reading as nothing.
  */
  const whole = (v: number) => (v > 0 && v < 1 ? '<1' : formatNumber(Math.floor(v)))

  return (
    <section className={`claimbar${anything ? '' : ' claimbar--nil'}`}>
      <span className="claimbar__label">To claim</span>

      <span className="claimbar__amt">
        <img src={asset('/assets/icons/tlm.svg')} alt="" width={18} height={18} />
        <b>{whole(tlm)}</b>
        <span>TLM</span>
      </span>

      <span className="claimbar__amt">
        <img src={asset('/assets/icons/wax-coin.png')} alt="" width={18} height={18} />
        <b>{whole(wax)}</b>
        <span>WAX</span>
      </span>

      <button
        type="button"
        className="btn btn--primary claimbar__go"
        disabled={!canAct || busy !== null || !anything}
        onClick={onClaim}
        title={anything ? 'Claim both tokens at once' : 'Nothing has settled yet'}
      >
        {busy === 'claim' && <span className="spinner" />}
        Claim
      </button>
    </section>
  )
}

