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
 * gem in the pot is worth — including the ones you already put in. So the
 * screen leads with the **rate** rather than the prize: what a gem is worth
 * right now, and what it would be worth after the contribution you are about
 * to make.
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
  const { busy, error, notice, run } = useAction()

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

      <ActionBanner notice={notice} error={error ?? data.error} />

      <div className="candle__cols">
        <div>
          {data.loading ? (
            <div className="mach mach--loading" />
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
}) {
  const [showBoard, setShowBoard] = useState(false)
  /*
     Folded to begin with.

     The cabinet keeps the four things worth knowing at a glance: the
     mission, the clock, the prize and what you have already put in. A
     player with three missions running wants to see all of them at once
     more often than they want to feed any one of them, so the screen opens
     as a list and a mission is opened deliberately.
  */
  const [shut, setShut] = useState(true)

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
  const canContribute =
    canAct && busy === null && open && gate.qualified && amount > 0 && !tooPoor

  /* What the plate on the marquee counts down to. */
  const clock = soon
    ? { label: 'Opens in', time: countdown(state.msLeft) }
    : open
      ? { label: 'Closes in', time: countdown(state.msLeft) }
      : { label: 'Closed', time: 'settling' }

  const action = soon ? 'Not open yet' : !open ? 'Closed' : !gate.qualified ? 'Locked' : 'Drop them in'

  const toggle = () => setShut((was) => !was)
  /* The sign is the handle, so anything on it that is not the handle has to
     say so — a countdown that collapsed the panel when you looked at it
     would be a small betrayal. */
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

  const gemIcon = (
    <img className="mach__gem" src={asset('/assets/icons/gems.png')} alt="gems" width={13} height={13} />
  )

  return (
    <section
      className={`mach${shut ? ' mach--shut' : ''}${soon ? ' mach--soon' : ''}${
        !gate.qualified && !soon ? ' mach--barred' : ''
      }`}
    >
      {/* The room the machine stands in. See `.mach__pile`. */}
      <img className="mach__pile" src={asset('/assets/shop/candle-gems.webp')} alt="" />

      <header className="mach__marquee" onClick={toggle}>
        {/*
          The gate, on the sign opposite the clock.

          It was a row of its own under the marquee, which pushed the
          mission's own figures down the page for the one mission a player
          cannot act on. All they need from it is how far short they are;
          the arithmetic behind that number is a tooltip.
        */}
        {!gate.qualified && (
          <span
            className="mach__gate"
            title={`Needs ${formatNumber(gate.need)} lifetime ${offer.requirements.toLowerCase()} — you have ${formatNumber(gate.have)}`}
          >
            <span aria-hidden="true">&#10005;</span>
            <b>{formatNumber(gate.short)} short</b>
          </span>
        )}

        <div className="mach__title">
          <span>Mission</span>
          <b>{offer.requirements}</b>
        </div>

        <span className="mach__tools">
          <span className="mach__clock" onClick={stop}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5.2l3.2 2" />
            </svg>
            <span className="mach__clockcol">
              <span>{clock.label}</span>
              <b>{clock.time}</b>
            </span>
          </span>
          <button
            type="button"
            className="mach__toggle"
            aria-expanded={!shut}
            aria-label={shut ? 'Expand mission' : 'Collapse mission'}
            onClick={(e) => {
              stop(e)
              toggle()
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 9l7 7 7-7" />
            </svg>
          </button>
        </span>
      </header>

      {/* What survives the fold. */}
      <div className="mach__mini">
        <span>
          <img src={icon} alt="" width={20} height={20} />
          <b>{formatDecimals(prize, dp(prize))}</b> {symbol} {soon ? 'on offer' : 'in the pot'}
        </span>
        {/*
          What the pot is being split between.

          The reward alone says what is on the table and not what a share of
          it is worth — that depends entirely on how many gems are in
          against it, which was a fact you had to unfold the panel to see.
        */}
        <span>
          <img src={asset('/assets/icons/gems.png')} alt="" width={20} height={20} />
          <b>{formatNumber(share.total)}</b> gems contributed
        </span>
        <span>
          <img src={asset('/assets/icons/gems.png')} alt="" width={20} height={20} />
          <b>{formatNumber(mine)}</b> your contribution
        </span>
      </div>

      <div className="mach__body">
        <div className="mach__glass">
          <div className="mach__pot">
            <img src={icon} alt="" width={44} height={44} />
            <b>{formatDecimals(prize, dp(prize))}</b>
            <span>
              {symbol} {soon ? 'on offer' : 'in the pot'}
            </span>
          </div>
          {soon && (
            <p className="mach__empty">
              <b>The case is empty</b>nobody can feed it until it opens
            </p>
          )}
        </div>

        {/*
          One control, not two: the amount and the action share a box, so the
          decision is in one place and the focus ring lights all of it.
        */}
        <div className="mach__slot">
          <span className="mach__kick">Contribute gems</span>
          <div className="mach__field">
            <input
              className="mach__in"
              type="number"
              min={1}
              max={balance}
              step={1}
              inputMode="numeric"
              placeholder="0"
              value={gems}
              onChange={(e) => onGems(e.target.value)}
              disabled={!canAct || busy !== null || !open || !gate.qualified}
            />
            <button
              type="button"
              className="mach__go"
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

        {tooPoor && <p className="hint hint--error">That is more gems than you hold.</p>}

        <div className="mach__meta">
          <span>
            In the pot <b>{formatNumber(share.total)}</b>
            {gemIcon}
          </span>
          <span>
            Your contribution <b>{formatNumber(share.mine)}</b>
            {gemIcon}
          </span>
          <span>
            Players{' '}
            {/*
              The count opens the board rather than just stating it. What a
              gem buys here depends on who else has spent and how much, and
              "14 players" does not say whether that is fourteen small stakes
              or one whale and thirteen hopefuls.
            */}
            <button
              type="button"
              className="mach__who"
              onClick={() => setShowBoard(true)}
              disabled={contributors === 0}
              title="See who has contributed and how much"
            >
              <b>{formatNumber(contributors)}</b>
            </button>
          </span>
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
            You hold <b>{formatNumber(balance)}</b>
            {gemIcon}
          </span>

          {/*
            What the contribution would do — to the share and to the rate.
            Adding to the pot lowers the rate for everyone, so both sides of
            the sum move and the gems go into the denominator too. Only shown
            once there is a contribution to talk about.
          */}
          {amount > 0 && gate.qualified && open && (
            <>
              <span className="mach__after">
                Your share after <b>{formatDecimals(after.payout, dp(after.payout))}</b> {symbol}
              </span>
              <span className="mach__after">
                Worth per gem after{' '}
                <b>{formatDecimals(after.perGem, perGemPlaces(after.perGem, type))}</b> {symbol}
              </span>
            </>
          )}
        </div>

        <div className="mach__tray">
          <span className="mach__kick">Payout tray — your share now</span>
          <span className="mach__trayval">
            {mine > 0 ? (
              <>
                {formatDecimals(share.payout, dp(share.payout))} {symbol}
                <small>({(share.fraction * 100).toFixed(1)}%)</small>
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>

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

