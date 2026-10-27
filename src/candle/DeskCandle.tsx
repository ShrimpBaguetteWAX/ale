import { useMemo, useState } from 'react'
import type { Player } from '@/chain/types'
import type { CandleClaim, CandleOffer, CandleTracking } from '@/candle/types'
import {
  countdown,
  eligibility,
  firstMission,
  offerState,
  perGemPlaces,
  projectShare,
  shareOf,
  tokenAmount,
  tokenIcon,
  tokenSymbol,
  wholeTokens,
  type OfferState,
} from '@/candle/rules'
import type { Board } from '@/routes/Candle'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { formatCompact, formatDecimals, formatNumber } from '@/format'
import { asset } from '@/assets'

const GEMS = asset('/assets/icons/gems.svg')
const EMPTY_BOARD: Board = { stakes: [], contributors: 0, mine: 0 }
const HOUR = 3_600_000
const QUICK = [100, 250, 500]

/**
 * The Candle on a desktop: a mission board.
 *
 * Every mission down the left — the running ones, then the ones coming up —
 * each with its reward, whether the player can get in, and a ring for how
 * much of its day is left. The picked one fills the middle in full: the pot,
 * how far through its day it is, what a gem buys, and everyone who is in with
 * what each of them would take if it closed now. Contributing sits on the
 * right and stays there while the missions are compared.
 *
 * The split is the whole game: a fixed pot shared by gems put in, so adding
 * gems raises your share and lowers what every gem is worth. The board shows
 * it as rows — with the player's own row as it would be after the gems in the
 * box go in — rather than explaining it.
 */
export function DeskCandle({
  running,
  upcoming,
  boards,
  player,
  now,
  balance,
  draft,
  onDraft,
  busy,
  canAct,
  onContribute,
  claim,
  onClaim,
  tracking,
  loading,
  tags,
  avatars,
  banner,
}: {
  running: CandleOffer[]
  upcoming: CandleOffer[]
  boards: Map<string, Board>
  player: Player
  now: number
  balance: number
  draft: Record<string, string>
  onDraft: (offerId: string, value: string) => void
  busy: string | null
  canAct: boolean
  onContribute: (offer: CandleOffer) => void
  claim?: CandleClaim
  onClaim: () => void
  tracking?: CandleTracking
  loading: boolean
  tags: Record<string, string>
  avatars: Record<string, number>
  banner?: React.ReactNode
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const all = useMemo(() => [...running, ...upcoming], [running, upcoming])
  const offer = all.find((o) => o.offer_id === picked) ?? firstMission(running, upcoming, player)
  const open = running.filter((o) => offerState(o, now).phase === 'open')

  return (
    <div className="dcan">
      <header className="dcan__head">
        <h1 className="dcan__title">Candle</h1>
        <span className="dcan__sub">
          {open.length} running · {upcoming.length} coming up
        </span>
        <span className="dcan__sp" />
        <ClaimBar claim={claim} busy={busy} canAct={canAct} onClaim={onClaim} />
      </header>

      {banner}

      {loading && all.length === 0 ? (
        <div className="dcan__board">
          <div className="dcan__list">
            {[0, 1, 2].map((i) => (
              <div className="dcan__card is-loading" key={i} />
            ))}
          </div>
          <div className="dcan__panel dcan__dossier is-loading" />
        </div>
      ) : !offer ? (
        <p className="dcan__panel dcan__empty">
          No mission is running.
          {tracking &&
            ` The next one is due in ${countdown(Date.parse(tracking.next_offer_creation + 'Z') - now)}.`}
        </p>
      ) : (
        <div className="dcan__board">
          <nav className="dcan__list" aria-label="Missions">
            <span className="dcan__cap">Running · {running.length}</span>
            {running.map((o) => (
              <MissionCard key={o.offer_id} offer={o} player={player} now={now} picked={o.offer_id === offer.offer_id} onPick={() => setPicked(o.offer_id)} />
            ))}
            {upcoming.length > 0 && <span className="dcan__cap">Coming up · {upcoming.length}</span>}
            {upcoming.map((o) => (
              <MissionCard key={o.offer_id} offer={o} player={player} now={now} picked={o.offer_id === offer.offer_id} onPick={() => setPicked(o.offer_id)} />
            ))}
            <p className="dcan__note">The ring is what is left of the mission's day.</p>
          </nav>

          <Dossier
            offer={offer}
            board={boards.get(offer.offer_id) ?? EMPTY_BOARD}
            player={player}
            now={now}
            amount={amountOf(draft[offer.offer_id])}
            tags={tags}
            avatars={avatars}
          />

          <Contribute
            offer={offer}
            board={boards.get(offer.offer_id) ?? EMPTY_BOARD}
            player={player}
            now={now}
            balance={balance}
            draft={draft[offer.offer_id] ?? ''}
            onDraft={(v) => onDraft(offer.offer_id, v)}
            busy={busy}
            canAct={canAct}
            onContribute={() => onContribute(offer)}
          />
        </div>
      )}
    </div>
  )
}

const amountOf = (v: string | undefined) => Math.max(0, Math.floor(Number(v) || 0))

/* How much of the mission's day is left, 0–1; nothing yet before it opens. */
function dayLeft(state: OfferState): number {
  const day = state.endsAt - state.startsAt
  return state.phase === 'open' && day > 0 ? state.msLeft / day : 0
}

function Gate({ offer, player, compact = false }: { offer: CandleOffer; player: Player; compact?: boolean }) {
  const gate = eligibility(offer, player)
  const hint = `Needs ${formatNumber(gate.need)} lifetime ${offer.requirements.toLowerCase()} — you have ${formatNumber(gate.have)}`
  return gate.qualified ? (
    <span className="dcan__gate is-ok" title={hint}>
      <span aria-hidden="true">✓</span> Qualified
    </span>
  ) : (
    <span className="dcan__gate is-short" title={hint}>
      <span aria-hidden="true">✕</span> {compact ? formatCompact(gate.short) : formatNumber(gate.short)} short
    </span>
  )
}

/* ---------- the list ---------- */

function MissionCard({
  offer,
  player,
  now,
  picked,
  onPick,
}: {
  offer: CandleOffer
  player: Player
  now: number
  picked: boolean
  onPick: () => void
}) {
  const state = offerState(offer, now)
  const gate = eligibility(offer, player)
  const prize = tokenAmount(offer.reward_amount, offer.reward_type)
  const [first, second] = countdown(state.msLeft).split(' ')
  return (
    <button
      type="button"
      className={`dcan__card${picked ? ' is-picked' : ''}${gate.qualified ? '' : ' is-locked'}${state.phase === 'upcoming' ? ' is-soon' : ''}`}
      aria-pressed={picked}
      onClick={onPick}
    >
      <span className="dcan__icon">
        <img src={tokenIcon(offer.reward_type)} alt="" />
      </span>
      <span className="dcan__cardtext">
        <b>
          {wholeTokens(prize, offer.reward_type)} <small>{tokenSymbol(offer.reward_type)}</small>
        </b>
        <span>{offer.requirements}</span>
        <Gate offer={offer} player={player} compact />
      </span>
      <span className="dcan__ring" style={{ '--p': dayLeft(state) * 100 } as React.CSSProperties}>
        <b>
          {state.phase === 'upcoming' ? 'opens' : state.phase === 'closed' ? 'closed' : first}
          <br />
          {state.phase === 'upcoming' ? first : state.phase === 'closed' ? '' : second}
        </b>
      </span>
    </button>
  )
}

/* ---------- the mission in full ---------- */

export function Dossier({
  offer,
  board,
  player,
  now,
  amount,
  tags = {},
  avatars = {},
}: {
  offer: CandleOffer
  board: Board
  player: Player
  now: number
  /** The gems in the box, not yet contributed. */
  amount: number
  tags?: Record<string, string>
  avatars?: Record<string, number>
}) {
  const state = offerState(offer, now)
  const gate = eligibility(offer, player)
  const type = offer.reward_type
  const prize = tokenAmount(offer.reward_amount, type)
  const symbol = tokenSymbol(type)
  const icon = tokenIcon(type)
  const share = shareOf(offer, board.mine)
  const open = state.phase === 'open'
  /* Only a contribution that could actually be made is drawn into the board. */
  const priced = amount > 0 && open && gate.qualified
  const whole = share.total + (priced ? amount : 0)
  const day = state.endsAt - state.startsAt
  const elapsed = open ? 1 - dayLeft(state) : state.phase === 'closed' ? 1 : 0

  /* Everyone in, biggest first; the player's row as it would be after the box goes in. */
  const rows = useMemo(() => {
    const list = board.stakes.map((s) => ({ wallet: s.wallet, gems: Number(s.amount) }))
    if (priced) {
      const mine = list.find((r) => r.wallet === player.wallet)
      if (mine) mine.gems += amount
      else list.push({ wallet: player.wallet, gems: amount })
    }
    return list.sort((a, b) => b.gems - a.gems)
  }, [board.stakes, priced, amount, player.wallet])

  const name = (wallet: string) => tags[wallet] || wallet

  return (
    <section className="dcan__panel dcan__dossier" aria-label={offer.requirements}>
      <div className="dcan__dhead">
        <span className={`dcan__emblem is-${type.toLowerCase()}`}>
          <img src={icon} alt="" />
        </span>
        <span className="dcan__dtitle">
          <small>Mission · {offer.requirements}</small>
          <h2>
            {wholeTokens(prize, type)} {symbol}
          </h2>
          <span className="dcan__dline">
            <Gate offer={offer} player={player} />
            <span>Needs {formatCompact(gate.need)} lifetime</span>
          </span>
        </span>
        <span className="dcan__clock">
          <small>{state.phase === 'upcoming' ? 'Opens in' : open ? 'Closes in' : 'Closed'}</small>
          <b>{state.phase === 'closed' ? 'settling' : countdown(state.msLeft)}</b>
        </span>
      </div>

      <div className="dcan__burn">
        <span className="dcan__burnbar">
          {state.phase !== 'upcoming' && (
            <>
              <i style={{ width: `${elapsed * 100}%` }} />
              <b style={{ left: `${elapsed * 100}%` }} />
            </>
          )}
        </span>
        <span className="dcan__burnlbl">
          {state.phase === 'upcoming' ? (
            <>
              <span>Not open yet</span>
              <span>Runs {Math.round(day / HOUR)} hours once open</span>
            </>
          ) : open ? (
            <>
              <span>Opened {countdown(now - state.startsAt)} ago</span>
              <span>Settles in {countdown(state.msLeft)}</span>
            </>
          ) : (
            <>
              <span>Closed</span>
              <span>Rewards land in To claim once it settles</span>
            </>
          )}
        </span>
      </div>

      <div className="dcan__stats">
        <span className="dcan__stat">
          <small>Pot</small>
          <b>
            {wholeTokens(prize, type)} <img src={icon} alt="" />
          </b>
        </span>
        <span className="dcan__stat">
          <small>A gem buys</small>
          <b>
            {share.total > 0 ? formatDecimals(share.perGem, perGemPlaces(share.perGem, type)) : '—'} <em>{symbol}</em>
          </b>
        </span>
        <span className="dcan__stat">
          <small>Gems in</small>
          <b>
            {formatNumber(share.total)} <img src={GEMS} alt="" />
          </b>
        </span>
        <span className="dcan__stat">
          <small>Players</small>
          <b>{formatNumber(board.contributors)}</b>
        </span>
      </div>

      <span className="dcan__cap">
        Contributors <span>the pot is split by gems put in</span>
      </span>

      {whole > 0 && (
        <div className="dcan__split" role="img" aria-label={`${formatNumber(share.total)} gems from ${formatNumber(board.contributors)} players`}>
          {board.stakes.length === 0 && <span className="dcan__seg" style={{ flexBasis: `${(share.total / whole) * 100}%` }} />}
          {[...board.stakes]
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .map((s, i) => (
              <span
                key={s.wallet}
                className={`dcan__seg${s.wallet === player.wallet ? ' dcan__seg--you' : ''}`}
                style={{ flexBasis: `${(Number(s.amount) / whole) * 100}%` }}
                title={`${i + 1}. ${s.wallet === player.wallet ? 'you' : name(s.wallet)} · ${((Number(s.amount) / whole) * 100).toFixed(1)}% · ${formatNumber(Number(s.amount))} gems`}
              />
            ))}
          {priced && (
            <span
              className="dcan__seg dcan__seg--ghost"
              style={{ flexBasis: `${(amount / whole) * 100}%` }}
              title={`+${formatNumber(amount)} gems you are about to add`}
            />
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="dcan__none">
          {state.phase === 'upcoming' ? 'Nobody can contribute until it opens.' : 'Nobody has contributed yet.'}
        </p>
      ) : (
        <div className="dcan__rows" role="table" aria-label="Contributors">
          <div className="dcan__row dcan__row--head" role="row">
            <span>#</span>
            <span />
            <span>Player</span>
            <span>Gems</span>
            <span>Share</span>
            <span>Takes</span>
          </div>
          {rows.map((r, i) => {
            const you = r.wallet === player.wallet
            const takes = whole > 0 ? (prize * r.gems) / whole : 0
            return (
              <div className={`dcan__row${you ? ' is-you' : ''}`} role="row" key={r.wallet}>
                <span className={`dcan__rank is-${i + 1}`}>{i + 1}</span>
                <PlayerAvatar id={avatars[r.wallet]} name={name(r.wallet)} className="dcan__avatar" size={26} />
                <span className="dcan__name">
                  {you ? <b>You</b> : name(r.wallet)}
                  {you && priced && <small> · with the {formatNumber(amount)} in the box</small>}
                </span>
                <span className="dcan__num is-dim">{formatNumber(r.gems)}</span>
                <span className="dcan__num">{whole > 0 ? ((r.gems / whole) * 100).toFixed(1) : '0.0'}%</span>
                <span className="dcan__num">{wholeTokens(takes, type)}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ---------- contributing ---------- */

export function Contribute({
  offer,
  board,
  player,
  now,
  balance,
  draft,
  onDraft,
  busy,
  canAct,
  onContribute,
}: {
  offer: CandleOffer
  board: Board
  player: Player
  now: number
  balance: number
  draft: string
  onDraft: (v: string) => void
  busy: string | null
  canAct: boolean
  onContribute: () => void
}) {
  const state = offerState(offer, now)
  const gate = eligibility(offer, player)
  const type = offer.reward_type
  const symbol = tokenSymbol(type)
  const icon = tokenIcon(type)
  const amount = amountOf(draft)
  const share = shareOf(offer, board.mine)
  const after = projectShare(offer, board.mine, amount)
  const tooPoor = amount > balance
  const usable = canAct && busy === null && state.phase === 'open' && gate.qualified
  const fill = balance > 0 ? Math.min(100, (amount / balance) * 100) : 0
  const gemIcon = <img src={GEMS} alt="gems" />

  if (state.phase === 'upcoming')
    return (
      <aside className="dcan__panel dcan__side">
        <h3 className="dcan__sidetitle">Coming up</h3>
        <div className="dcan__math">
          <span>
            Opens in<b>{countdown(state.msLeft)}</b>
          </span>
          <span>
            Requirement<b>{formatNumber(gate.need)}</b>
          </span>
          <span>
            You have
            <b className={gate.qualified ? 'is-ok' : 'is-short'}>
              {formatNumber(gate.have)} · {gate.qualified ? 'qualified' : `${formatNumber(gate.short)} short`}
            </b>
          </span>
        </div>
        <p className="dcan__note">
          Nobody can put gems in until it opens. A gem starts out worth the whole pot, and that falls with every
          contribution.
        </p>
        <button type="button" className="btn btn--primary dcan__go" disabled>
          Not open yet
        </button>
      </aside>
    )

  if (state.phase === 'closed')
    return (
      <aside className="dcan__panel dcan__side">
        <h3 className="dcan__sidetitle">Closed</h3>
        <p className="dcan__note">
          This mission has closed and is settling. What it owes you lands in To claim, at the top of the page.
        </p>
      </aside>
    )

  if (!gate.qualified)
    return (
      <aside className="dcan__panel dcan__side is-locked">
        <h3 className="dcan__sidetitle">Locked</h3>
        <div className="dcan__req">
          <span>
            Lifetime {offer.requirements.toLowerCase()}
            <b>
              {formatNumber(gate.have)} / {formatNumber(gate.need)}
            </b>
          </span>
          <span className="dcan__reqbar">
            <i style={{ width: `${Math.min(100, (gate.have / Math.max(1, gate.need)) * 100)}%` }} />
          </span>
        </div>
        <button type="button" className="btn btn--primary dcan__go" disabled>
          Locked
        </button>
      </aside>
    )

  return (
    <aside className="dcan__panel dcan__side">
      <h3 className="dcan__sidetitle">Contribute</h3>
      <span className="dcan__cap">
        Your gems in · {formatNumber(board.mine)}
        <span>
          You hold {formatNumber(balance)} {gemIcon}
        </span>
      </span>

      <label className="dcan__amount">
        {gemIcon}
        <input
          type="number"
          min={1}
          max={balance}
          step={1}
          inputMode="numeric"
          placeholder="0"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          disabled={!usable}
          aria-label="Gems to contribute, exactly"
        />
        <small>gems</small>
      </label>
      <input
        className="dcan__range"
        type="range"
        min={0}
        max={Math.max(0, balance)}
        step={1}
        value={Math.min(amount, Math.max(0, balance))}
        onChange={(e) => onDraft(e.target.value)}
        disabled={!usable || balance <= 0}
        aria-label="Gems to contribute"
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
      />
      <div className="dcan__quick">
        {QUICK.map((q) => (
          <button type="button" key={q} aria-pressed={amount === q} disabled={!usable || q > balance} onClick={() => onDraft(String(q))}>
            {q}
          </button>
        ))}
        <button type="button" aria-pressed={amount === balance && balance > 0} disabled={!usable || balance <= 0} onClick={() => onDraft(String(balance))}>
          All {formatCompact(balance)}
        </button>
      </div>

      <div className="dcan__math">
        <span>
          Your share now
          <b>
            {board.mine > 0 ? (
              <>
                {wholeTokens(share.payout, type)} <img src={icon} alt={symbol} /> ·{' '}
                {(share.fraction * 100).toFixed(1)}%
              </>
            ) : (
              '—'
            )}
          </b>
        </span>
        {amount > 0 && (
          <>
            <span className="dcan__after">
              A gem buys after
              <b>
                {formatDecimals(after.perGem, perGemPlaces(after.perGem, type))} <img src={icon} alt={symbol} />
              </b>
            </span>
            <span className="is-sum">
              You'd take at close
              <b>
                {wholeTokens(after.payout, type)} <img src={icon} alt={symbol} /> ·{' '}
                {(after.fraction * 100).toFixed(1)}%
              </b>
            </span>
          </>
        )}
      </div>
      {tooPoor && <p className="hint hint--error">That is more gems than you hold.</p>}

      <button
        type="button"
        className="btn btn--primary dcan__go"
        disabled={!usable || amount <= 0 || tooPoor}
        onClick={onContribute}
        title="Gems are spent immediately"
      >
        {busy === `contribute:${offer.offer_id}` && <span className="spinner" />}
        {amount > 0 ? `Contribute ${formatNumber(amount)} gems` : 'Contribute gems'}
      </button>
      <p className="dcan__note">Gems are spent at once. What you take falls if others add gems before it closes.</p>
    </aside>
  )
}

/* ---------- winnings ---------- */

/** What has settled and not been taken: whole tokens and one button, on the title's line. */
function ClaimBar({
  claim,
  busy,
  canAct,
  onClaim,
}: {
  claim?: CandleClaim
  busy: string | null
  canAct: boolean
  onClaim: () => void
}) {
  const tlm = tokenAmount(Number(claim?.tlm ?? 0), 'tlm')
  const wax = tokenAmount(Number(claim?.wax ?? 0), 'wax')
  const anything = tlm > 0 || wax > 0
  /* A balance that is real but rounds away says so rather than reading as nothing. */
  const whole = (v: number) => (v > 0 && v < 1 ? '<1' : formatNumber(Math.floor(v)))
  return (
    <section className={`dcan__claim${anything ? ' is-ready' : ''}`} aria-label="To claim">
      <small>To claim</small>
      <span>
        <img src={asset('/assets/icons/tlm.svg')} alt="" />
        <b>{whole(tlm)}</b> TLM
      </span>
      <span>
        <img src={asset('/assets/icons/wax-coin.png')} alt="" />
        <b>{whole(wax)}</b> WAX
      </span>
      <button
        type="button"
        className="btn btn--gold btn--sm"
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
