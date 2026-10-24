import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { kvToRecord, type Player } from '@/chain/types'
import type { AccountCpu, CpuConfig, CpuUsage } from '@/account/queries'
import {
  TAG_MAX,
  avatarArt,
  avatarTracks,
  claimableAvatars,
  cpuLow,
  cpuStatus,
  formatCpuTime,
  hasLegendAccess,
  nextCpuReset,
  untilLabel,
  validateTag,
  type AvatarEntry,
  type AvatarTrack,
} from '@/account/rules'
import { fetchAllPlayerStats, rankBy } from '@/account/statboard'
import { STAT_GROUP_ORDER, prettyStat, statGroup, statIconFor } from '@/account/stats'
import { StatBoardSheet } from '@/account/StatLeaderboard'
import { PhoneAutoSign } from '@/components/AutoSign'
import { BottomSheet } from '@/components/BottomSheet'
import { GameImg } from '@/components/GameImg'
import { formatCompact, formatNumber, formatStat } from '@/format'
import { asset } from '@/assets'

export type AccountTab = 'avatar' | 'cpu' | 'autosign' | 'stats'

const TABS: [AccountTab, string][] = [
  ['avatar', 'Avatar'],
  ['cpu', 'CPU'],
  ['autosign', 'Auto-sign'],
  ['stats', 'Stats'],
]

const UNKNOWN_AVATAR = asset('/assets/avatar/unknown.webp')

/**
 * Account on a phone.
 *
 * A slim header — the avatar you wear, your gamertag with a pencil to change
 * it, and Disconnect at its end — over the same four tabs the desktop has.
 * The avatars are shown as tracks rather than a grid: every tier of one
 * counter on a line, how far up it you are and what the next one costs.
 */
export function PhoneAccount({
  tab,
  onTab,
  player,
  board,
  busy,
  canAct,
  cpu,
  onTag,
  onSelect,
  onUnlock,
  onClaimCpu,
  onDisconnect,
}: {
  tab: AccountTab
  onTab: (tab: AccountTab) => void
  player: Player
  board: AvatarEntry[]
  busy: string | null
  canAct: boolean
  cpu: { config?: CpuConfig; usage?: CpuUsage; account?: AccountCpu }
  onTag: (tag: string) => void
  onSelect: (id: number) => void
  onUnlock: (ids: number[]) => void
  onClaimCpu: () => void
  onDisconnect: () => void
}) {
  const [tagOpen, setTagOpen] = useState(false)
  const ready = claimableAvatars(board)
  const legend = hasLegendAccess(player.legend_access_expiry)

  return (
    <div className="prew pacc">
      <div className="pacc__head">
        <GameImg
          className="pacc__av"
          src={avatarArt(player.active_avatar)}
          fallback={UNKNOWN_AVATAR}
          alt=""
        />
        <span className="pacc__who">
          <b>
            {player.playertag || 'No gamertag yet'}
            <button
              type="button"
              className="pacc__pen"
              aria-label="Change gamertag"
              onClick={() => setTagOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
            </button>
          </b>
          <small>
            <span className="mono">{player.wallet}</span>
            {legend && <em> · Legend</em>}
          </small>
        </span>
        <button
          type="button"
          className="pacc__leave"
          title="Disconnect wallet"
          aria-label="Disconnect wallet"
          onClick={onDisconnect}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <path d="M10 16l-4-4 4-4" />
            <path d="M6 12h10" />
          </svg>
        </button>
      </div>

      <div className="prew__tabs" role="tablist" aria-label="Account">
        {TABS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="prew__tab"
            onClick={() => onTab(key)}
          >
            {label}
            {key === 'avatar' && ready.length > 0 && (
              <span className="prew__tabdot" aria-label="Avatars to claim" />
            )}
            {key === 'cpu' && cpuLow(cpu.account) && (
              <span className="prew__tabdot" aria-label="Your CPU is running low" />
            )}
          </button>
        ))}
      </div>

      {tab === 'avatar' && (
        <AvatarTracks
          board={board}
          busy={busy}
          canAct={canAct}
          onSelect={onSelect}
          onUnlock={onUnlock}
        />
      )}
      {tab === 'cpu' && (
        <PhoneCpu
          player={player}
          cpu={cpu}
          busy={busy}
          canAct={canAct}
          onClaim={onClaimCpu}
        />
      )}
      {tab === 'autosign' && <PhoneAutoSign />}
      {tab === 'stats' && <PhoneStats player={player} />}

      {tagOpen && (
        <TagSheet
          player={player}
          busy={busy}
          canAct={canAct}
          onSave={(tag) => {
            onTag(tag)
            setTagOpen(false)
          }}
          onClose={() => setTagOpen(false)}
        />
      )}
    </div>
  )
}

function TagSheet({
  player,
  busy,
  canAct,
  onSave,
  onClose,
}: {
  player: Player
  busy: string | null
  canAct: boolean
  onSave: (tag: string) => void
  onClose: () => void
}) {
  const [tag, setTag] = useState(player.playertag)
  const problem = validateTag(tag)
  const changed = tag.trim() !== player.playertag
  return (
    <BottomSheet
      title="Gamertag"
      onClose={onClose}
      foot={
        <div className="rsheet__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAct || busy !== null || !!problem || !changed}
            onClick={() => onSave(tag.trim())}
          >
            Save
          </button>
        </div>
      }
    >
      <p className="rsheet__hint">
        Four to {TAG_MAX} characters. It is what other players see on the leaderboards.
      </p>
      <input
        className="input"
        value={tag}
        maxLength={TAG_MAX}
        onChange={(e) => setTag(e.target.value)}
        disabled={!canAct || busy !== null}
        placeholder="Please set a gamertag."
        aria-label="Gamertag"
      />
      {problem && changed && <p className="rsheet__hint pacc__warn">{problem}</p>}
    </BottomSheet>
  )
}

/* ---------- avatars, as tracks ---------- */

function AvatarTracks({
  board,
  busy,
  canAct,
  onSelect,
  onUnlock,
}: {
  board: AvatarEntry[]
  busy: string | null
  canAct: boolean
  onSelect: (id: number) => void
  onUnlock: (ids: number[]) => void
}) {
  const tracks = useMemo(() => avatarTracks(board), [board])
  const ready = claimableAvatars(board)
  const [openStat, setOpenStat] = useState<string | null>(null)
  const open = tracks.find((t) => t.stat === openStat)

  if (tracks.length === 0) return <p className="rsheet__hint">Reading the avatars…</p>

  return (
    <>
      {ready.length > 0 && (
        <div className="pacc__claim">
          <span>
            <b>{ready.length} to claim</b>
            <small>
              Across {tracks.filter((t) => t.ready > 0).length} track
              {tracks.filter((t) => t.ready > 0).length === 1 ? '' : 's'}
            </small>
          </span>
          <button
            type="button"
            className="btn btn--gold btn--sm"
            disabled={!canAct || busy !== null}
            onClick={() => onUnlock(ready)}
          >
            {busy === 'unlock' && <span className="spinner" />}
            Unlock all
          </button>
        </div>
      )}

      <div className="pacc__list">
        {tracks.map((t) => (
          <button
            type="button"
            className="ptrack"
            key={t.stat}
            onClick={() => setOpenStat(t.stat)}
          >
            <TrackIcon stat={t.stat} />
            <span className="ptrack__text">
              <b>
                {t.label}
                <em className="mono">{formatCompact(t.have)}</em>
              </b>
              <span className="ptrack__pips" aria-hidden="true">
                {t.tiers.map((tier) => (
                  <i key={tier.avatar.avatar_id} className={`is-${tier.state}`} />
                ))}
              </span>
              <small>
                {t.ready > 0 && <span className="ptrack__gold">{t.ready} to claim · </span>}
                {t.next
                  ? `next at ${formatCompact(t.next.need)} · ${formatCompact(t.next.need - t.have)} to go`
                  : 'All earned'}
              </small>
            </span>
            {t.next && (
              <GameImg
                className="ptrack__next"
                src={avatarArt(t.next.avatar.avatar_id)}
                fallback={UNKNOWN_AVATAR}
                alt=""
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>

      {open && (
        <TrackSheet
          track={open}
          busy={busy}
          canAct={canAct}
          onSelect={onSelect}
          onUnlock={onUnlock}
          onClose={() => setOpenStat(null)}
        />
      )}
    </>
  )
}

function TrackIcon({ stat }: { stat: string }) {
  const icon = statIconFor(stat)
  return icon ? (
    <img className="ptrack__icon" src={asset(icon)} alt="" />
  ) : (
    <span className="ptrack__icon" />
  )
}

/** Every tier of one track: wear what is yours, claim what is earned, see how far the rest are. */
function TrackSheet({
  track,
  busy,
  canAct,
  onSelect,
  onUnlock,
  onClose,
}: {
  track: AvatarTrack
  busy: string | null
  canAct: boolean
  onSelect: (id: number) => void
  onUnlock: (ids: number[]) => void
  onClose: () => void
}) {
  const ready = track.tiers.filter((t) => t.state === 'ready').map((t) => Number(t.avatar.avatar_id))
  return (
    <BottomSheet
      title={track.label}
      onClose={onClose}
      foot={
        ready.length > 0 ? (
          <div className="rsheet__actions">
            <button
              type="button"
              className="btn btn--gold"
              disabled={!canAct || busy !== null}
              onClick={() => onUnlock(ready)}
            >
              {busy === 'unlock' && <span className="spinner" />}
              Unlock {ready.length}
            </button>
          </div>
        ) : undefined
      }
    >
      <p className="rsheet__hint">
        You are on <b className="mono">{formatNumber(track.have)}</b>. Each avatar on this track
        unlocks at the number under it.
      </p>
      <div className="ptiers">
        {track.tiers.map((t) => (
          <div className={`ptier is-${t.state}`} key={t.avatar.avatar_id}>
            <GameImg
              className="ptier__art"
              src={avatarArt(t.avatar.avatar_id)}
              fallback={UNKNOWN_AVATAR}
              alt=""
              loading="lazy"
            />
            <span className="ptier__need mono">{formatCompact(t.need)}</span>
            {t.state === 'active' ? (
              <span className="ptier__badge">Wearing</span>
            ) : t.state === 'unlocked' ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!canAct || busy !== null}
                onClick={() => onSelect(Number(t.avatar.avatar_id))}
              >
                Wear
              </button>
            ) : t.state === 'ready' ? (
              <span className="ptier__badge ptier__badge--ready">Earned</span>
            ) : (
              <span
                className="ptier__bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={t.need}
                aria-valuenow={Math.min(t.have, t.need)}
                aria-label={`${formatNumber(t.have)} of ${formatNumber(t.need)}`}
              >
                <i style={{ width: `${Math.min(100, (t.have / Math.max(1, t.need)) * 100)}%` }} />
              </span>
            )}
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}

/* ---------- CPU ---------- */

function Ring({ share, tone, children }: { share: number; tone: 'go' | 'ok' | 'low'; children: React.ReactNode }) {
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <span className={`pring2 pring2--${tone}`}>
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r={r} className="pring2__track" />
        <circle
          cx="48"
          cy="48"
          r={r}
          className="pring2__fill"
          strokeDasharray={`${c * Math.max(0, Math.min(1, share))} ${c}`}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <span className="pring2__in">{children}</span>
    </span>
  )
}

function PhoneCpu({
  player,
  cpu,
  busy,
  canAct,
  onClaim,
}: {
  player: Player
  cpu: { config?: CpuConfig; usage?: CpuUsage; account?: AccountCpu }
  busy: string | null
  canAct: boolean
  onClaim: () => void
}) {
  const status = cpuStatus(cpu.config, cpu.usage)
  const legend = hasLegendAccess(player.legend_access_expiry)
  const untilReset = untilLabel(nextCpuReset(status.resetsAt) - Date.now())
  const max = Number(cpu.account?.max ?? 0)
  const used = Number(cpu.account?.current_used ?? 0)
  const free = Math.max(0, max - used)
  const low = cpuLow(cpu.account)

  return (
    <>
      <div className="pacc__gauges">
        <div className="pgauge">
          <Ring share={status.allowance > 0 ? status.left / status.allowance : 0} tone="go">
            <b className="mono">{status.left}</b>
            <small>of {status.allowance}</small>
          </Ring>
          <b>Free claims</b>
          <small>resets in {untilReset}</small>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={!canAct || busy !== null || status.left === 0 || !legend}
            onClick={onClaim}
          >
            {busy === 'cpu' && <span className="spinner" />}
            Claim
          </button>
        </div>
        <div className="pgauge">
          {cpu.account ? (
            <Ring share={max > 0 ? free / max : 0} tone={low ? 'low' : 'ok'}>
              <b className="mono">{max > 0 ? Math.floor((free / max) * 100) : 0}%</b>
              <small>free</small>
            </Ring>
          ) : (
            <Ring share={0} tone="ok">
              <small>…</small>
            </Ring>
          )}
          <b>Wallet CPU</b>
          <small>
            {formatCpuTime(free)} of {formatCpuTime(max)}
          </small>
          <span className="pgauge__note">Refills by itself</span>
        </div>
      </div>
      {!legend && (
        <p className="rsheet__hint">
          Claiming needs <Link to="/shop?c=account">Legend Access</Link>.
        </p>
      )}
      {legend && status.left === 0 && (
        <p className="rsheet__hint">
          You have used all {formatNumber(status.allowance)} claims this week. The next one is
          available in {untilReset}.
        </p>
      )}
      {low && (
        <p className="rsheet__hint pacc__warn">
          Almost none left. Transactions will start failing until it refills or you claim.
        </p>
      )}
    </>
  )
}

/* ---------- stats ---------- */

function PhoneStats({ player }: { player: Player }) {
  const stats = useMemo(() => Object.entries(kvToRecord(player.permstats)), [player.permstats])
  const [ranks, setRanks] = useState<Record<string, { rank: number; of: number }>>({})
  const [board, setBoard] = useState<string | null>(null)

  /* One read covers every stat; the board a row opens reuses it. */
  useEffect(() => {
    let live = true
    fetchAllPlayerStats()
      .then((players) => {
        if (!live) return
        const out: Record<string, { rank: number; of: number }> = {}
        for (const [key] of stats) {
          const ranked = rankBy(players, key)
          const mine = ranked.find((r) => r.wallet === player.wallet)
          if (mine) out[key] = { rank: mine.rank, of: ranked.length }
        }
        setRanks(out)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [stats, player.wallet])

  if (stats.length === 0) return <p className="rsheet__hint">Nothing recorded yet. Go do something.</p>

  /* Best placed first within each group, then the rest by name. */
  const order = (a: string, b: string) =>
    (ranks[a]?.rank ?? Infinity) - (ranks[b]?.rank ?? Infinity) ||
    prettyStat(a).localeCompare(prettyStat(b))

  return (
    <>
      {STAT_GROUP_ORDER.map((group) => {
        const rows = stats.filter(([k]) => statGroup(k) === group).sort(([a], [b]) => order(a, b))
        if (rows.length === 0) return null
        return (
          <section key={group} className="pacc__group">
            <div className="rsheet__cap">{group}</div>
            <div className="pacc__list">
              {rows.map(([k, v]) => {
                const icon = statIconFor(k)
                const rank = ranks[k]
                return (
                  <button
                    type="button"
                    className="pstat"
                    key={k}
                    onClick={() => setBoard(k)}
                    title={`Where you stand on ${prettyStat(k).toLowerCase()}`}
                  >
                    {icon ? (
                      <img className="pstat__icon" src={asset(icon)} alt="" />
                    ) : (
                      <span className="pstat__icon" />
                    )}
                    <span className="pstat__name">{prettyStat(k)}</span>
                    {rank && (
                      <span className={`pstat__rank${rank.rank <= 3 ? ' is-top' : ''}`}>
                        #{rank.rank}
                        <em>of {rank.of}</em>
                      </span>
                    )}
                    <span className="pstat__v mono">{formatStat(k, Number(v))}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      {board && (
        <StatBoardSheet
          statKey={board}
          label={prettyStat(board)}
          wallet={player.wallet}
          onClose={() => setBoard(null)}
        />
      )}
    </>
  )
}
