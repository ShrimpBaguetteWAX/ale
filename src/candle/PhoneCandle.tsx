import { useMemo, useState } from 'react'
import type { Player } from '@/chain/types'
import type { CandleClaim, CandleOffer, CandleTracking, Contribution } from '@/candle/types'
import {
  countdown,
  eligibility,
  firstMission,
  offerState,
  perGemPlaces,
  placesFor,
  projectShare,
  shareOf,
  tokenAmount,
  tokenIcon,
  tokenSymbol,
} from '@/candle/rules'
import type { Board } from '@/routes/Candle'
import { BottomSheet } from '@/components/BottomSheet'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { formatCompact, formatDecimals, formatNumber } from '@/format'
import { asset } from '@/assets'

const GEMS = asset('/assets/icons/gems.png')
const EMPTY_BOARD: Board = { stakes: [], contributors: 0, mine: 0 }

/**
 * The Candle on a phone: one mission at a time.
 *
 * A switch along the top holds every mission — the running ones and the ones
 * coming up — each with its reward, its time and whether the player can get
 * in, so a locked one is known before it is opened. The page under it is that
 * one mission in full: the pot, the split, and the contribution with its
 * button docked at the bottom.
 */
export function PhoneCandle({
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
}) {
  const all = useMemo(() => [...running, ...upcoming], [running, upcoming])
  const [picked, setPicked] = useState<string | null>(null)
  const offer =
    all.find((o) => o.offer_id === picked) ?? firstMission(running, upcoming, player)
  const [whoOpen, setWhoOpen] = useState(false)

  const tlm = tokenAmount(Number(claim?.tlm ?? 0), 'tlm')
  const wax = tokenAmount(Number(claim?.wax ?? 0), 'wax')

  return (
    <div className="prew pcandle">
      <h1 className="pcandle__title">Candle</h1>

      {(tlm > 0 || wax > 0) && (
        <div className="pcandle__claim">
          <img src={asset('/assets/icons/tlm.svg')} alt="" />
          <span>
            <small>Ready to claim</small>
            <b className="mono">
              {wholeToken(tlm)} TLM · {wholeToken(wax)} WAX
            </b>
          </span>
          <button
            type="button"
            className="btn btn--gold btn--sm"
            disabled={!canAct || busy !== null}
            onClick={onClaim}
          >
            {busy === 'claim' && <span className="spinner" />}
            Claim
          </button>
        </div>
      )}

      {loading ? (
        <p className="pcandle__note">Reading the missions…</p>
      ) : all.length === 0 || !offer ? (
        <p className="pcandle__note">
          No mission is running.
          {tracking &&
            ` The next one is due in ${countdown(
              Date.parse(tracking.next_offer_creation + 'Z') - now,
            )}.`}
        </p>
      ) : (
        <>
          <div className="pcandle__tabs" role="tablist" aria-label="Missions">
            {all.map((o) => {
              const state = offerState(o, now)
              const gate = eligibility(o, player)
              const soon = state.phase === 'upcoming'
              const prize = tokenAmount(o.reward_amount, o.reward_type)
              return (
                <button
                  type="button"
                  role="tab"
                  key={o.offer_id}
                  aria-selected={o.offer_id === offer.offer_id}
                  className={`pcandle__tab${gate.qualified ? '' : ' is-locked'}`}
                  onClick={() => setPicked(o.offer_id)}
                >
                  <img src={tokenIcon(o.reward_type)} alt="" />
                  <b className="mono">{formatCompact(Math.floor(prize))}</b>
                  <small>
                    {soon ? 'opens ' : ''}
                    {countdown(state.msLeft).split(' ')[0]}
                  </small>
                  {/* Whether the player can get in, before opening it. */}
                  <span
                    className={`pcandle__gate${gate.qualified ? ' is-ok' : ''}`}
                    aria-label={gate.qualified ? 'You qualify' : 'Locked'}
                  >
                    {gate.qualified ? <Check /> : <Lock />}
                  </span>
                </button>
              )
            })}
          </div>

          <MissionPage
            key={offer.offer_id}
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
            onWho={() => setWhoOpen(true)}
          />

          {whoOpen && (
            <WhoSheet
              stakes={(boards.get(offer.offer_id) ?? EMPTY_BOARD).stakes}
              total={Number(offer.total_gems ?? 0)}
              wallet={player.wallet}
              tags={tags}
              avatars={avatars}
              onClose={() => setWhoOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

/* ---------- one mission ---------- */

const PRESETS = [100, 250, 500]

function MissionPage({
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
  onWho,
}: {
  offer: CandleOffer
  board: Board
  player: Player
  now: number
  balance: number
  draft: string
  onDraft: (value: string) => void
  busy: string | null
  canAct: boolean
  onContribute: () => void
  onWho: () => void
}) {
  const state = offerState(offer, now)
  const gate = eligibility(offer, player)
  const open = state.phase === 'open'
  const soon = state.phase === 'upcoming'
  const type = offer.reward_type
  const symbol = tokenSymbol(type)
  const prize = tokenAmount(offer.reward_amount, type)
  const amount = Math.max(0, Math.floor(Number(draft) || 0))
  const share = shareOf(offer, board.mine)
  const after = projectShare(offer, board.mine, amount)
  const usable = canAct && busy === null && open && gate.qualified
  const tooPoor = amount > balance
  const priced = amount > 0 && open && gate.qualified
  const dp = (v: number) => placesFor(v, type)
  const rate = (v: number) => formatDecimals(v, perGemPlaces(v, type))

  const slices = useMemo(
    () => [...board.stakes].sort((a, b) => Number(b.amount) - Number(a.amount)),
    [board.stakes],
  )
  const whole = share.total + (priced ? amount : 0)

  return (
    <div className="pcandle__page">
      <div className="pcandle__hero">
        <span className="pcandle__pot">
          <img src={tokenIcon(type)} alt="" />
          <b className="mono">{formatDecimals(prize, dp(prize))}</b>
          <em>{symbol}</em>
        </span>
        <span className="pcandle__clock">
          <small>{soon ? 'Opens in' : open ? 'Closes in' : 'Closed'}</small>
          <b className="mono">{open || soon ? countdown(state.msLeft) : 'settling'}</b>
        </span>
      </div>

      <div className="pcandle__req">
        <span>
          {offer.requirements} · {formatNumber(gate.need)}+
        </span>
        {gate.qualified ? (
          <span className="pcandle__chip is-ok">
            <Check /> {soon ? `you have ${formatNumber(gate.have)}` : 'qualified'}
          </span>
        ) : (
          <span className="pcandle__chip">
            <Lock /> {formatNumber(gate.short)} short
          </span>
        )}
      </div>

      {!soon && (
        <>
          {/* Everyone's stake to scale, with the player's own about-to-add slice in teal. */}
          <div
            className="pcandle__bar"
            role="img"
            aria-label={`${formatNumber(share.total)} gems from ${formatNumber(board.contributors)} players`}
          >
            {slices.map((r) => (
              <i
                key={r.wallet}
                className={r.wallet === player.wallet ? 'is-you' : undefined}
                style={{ flexBasis: `${(Number(r.amount) / Math.max(1, whole)) * 100}%` }}
              />
            ))}
            {priced && (
              <i className="is-add" style={{ flexBasis: `${(amount / whole) * 100}%` }} />
            )}
          </div>
          <div className="pcandle__under">
            <span>
              A gem buys{' '}
              <b>{share.total > 0 ? `${rate(share.perGem)} ${symbol}` : '—'}</b>
            </span>
            <button
              type="button"
              onClick={onWho}
              disabled={board.contributors === 0}
              title="See who has contributed and how much"
            >
              {formatNumber(share.total)}
              <img src={GEMS} alt="gems" /> · {formatNumber(board.contributors)} player
              {board.contributors === 1 ? '' : 's'} ›
            </button>
          </div>
        </>
      )}

      {soon ? (
        <p className="pcandle__note pcandle__note--left">
          {gate.qualified
            ? 'You can put gems in when it opens.'
            : `Needs ${formatNumber(gate.need)} lifetime ${offer.requirements.toLowerCase()} — you have ${formatNumber(gate.have)}.`}
        </p>
      ) : !gate.qualified ? (
        <div className="pcandle__locked">
          <b>Locked</b>
          <small>
            Needs {formatNumber(gate.need)} lifetime {offer.requirements.toLowerCase()} — you have{' '}
            {formatNumber(gate.have)}.
          </small>
        </div>
      ) : open ? (
        <>
          <div className="rsheet__cap">
            Your contribution
            <span>
              you hold {formatNumber(balance)}
              <img className="pcandle__gem" src={GEMS} alt="gems" />
            </span>
          </div>
          <input
            className="landsheet__range pcandle__range"
            type="range"
            min={0}
            max={Math.max(0, balance)}
            step={1}
            value={Math.min(amount, Math.max(0, balance))}
            onChange={(e) => onDraft(e.target.value)}
            disabled={!usable || balance <= 0}
            aria-label="Gems to contribute"
          />
          <div className="pcandle__presets">
            {PRESETS.filter((p) => p < balance).map((p) => (
              <button
                type="button"
                key={p}
                aria-pressed={amount === p}
                disabled={!usable}
                onClick={() => onDraft(String(p))}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={amount === balance && balance > 0}
              disabled={!usable || balance <= 0}
              onClick={() => onDraft(String(balance))}
            >
              All {formatNumber(balance)}
            </button>
          </div>
          <div className="pcandle__share">
            {board.mine > 0 && (
              <div>
                <span>In already</span>
                <b className="mono">
                  {formatNumber(board.mine)} · {(share.fraction * 100).toFixed(1)}% ·{' '}
                  {formatDecimals(share.payout, dp(share.payout))} {symbol}
                </b>
              </div>
            )}
            <div>
              <span>Your share</span>
              <b className="mono">
                {priced
                  ? `${(after.fraction * 100).toFixed(1)}% · ${formatDecimals(after.payout, dp(after.payout))} ${symbol}`
                  : '— pick an amount'}
              </b>
            </div>
            {priced && (
              <div>
                <span>A gem buys</span>
                <b className="mono">
                  {rate(share.perGem)} → {rate(after.perGem)} {symbol}
                </b>
              </div>
            )}
          </div>
          {tooPoor && <p className="pcandle__note pcandle__warn">That is more gems than you hold.</p>}

          <div className="pcandle__dock">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!usable || amount <= 0 || tooPoor}
              onClick={onContribute}
            >
              {busy === `contribute:${offer.offer_id}` && <span className="spinner" />}
              Contribute{amount > 0 ? ` ${formatNumber(amount)}` : ''}
              <img className="pcandle__gem" src={GEMS} alt="gems" />
            </button>
            <small>
              {priced
                ? `About ${formatDecimals(after.payout, dp(after.payout))} ${symbol} if nobody else adds`
                : 'Gems are spent at once'}
            </small>
          </div>
        </>
      ) : (
        <p className="pcandle__note">This mission has closed and is being settled.</p>
      )}
    </div>
  )
}

/* ---------- who is in ---------- */

function WhoSheet({
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
  const rows = [...stakes].sort((a, b) => Number(b.amount) - Number(a.amount))
  return (
    <BottomSheet title="Who is in" onClose={onClose}>
      <p className="rsheet__hint">
        {formatNumber(total)} gems from {formatNumber(rows.length)} player
        {rows.length === 1 ? '' : 's'}. Each share is that player&apos;s gems over everyone&apos;s.
      </p>
      <div className="pcandle__who">
        {rows.map((r, i) => {
          const amount = Number(r.amount)
          const you = r.wallet === wallet
          return (
            <div className={`pcandle__whorow${you ? ' is-you' : ''}`} key={r.wallet}>
              <span className={`pcandle__rank${i < 3 ? ' is-top' : ''}`}>{i + 1}</span>
              <PlayerAvatar
                id={avatars[r.wallet]}
                name={tags[r.wallet] || r.wallet}
                className="pcandle__avatar"
                size={26}
              />
              <span className="pcandle__name">
                {tags[r.wallet] || r.wallet}
                {you && <em> · you</em>}
              </span>
              <span className="pcandle__cut mono">
                {total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0'}%
              </span>
              <span className="pcandle__gems mono">
                {formatNumber(amount)}
                <img src={GEMS} alt="gems" />
              </span>
            </div>
          )
        })}
      </div>
    </BottomSheet>
  )
}

/* ---------- bits ---------- */

/* Whole tokens on the strip; a real balance under one says so rather than 0. */
function wholeToken(v: number): string {
  return v > 0 && v < 1 ? '<1' : formatNumber(Math.floor(v))
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

function Lock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
