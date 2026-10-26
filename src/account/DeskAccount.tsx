import { useMemo, useState } from 'react'
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
  nextCpuReset,
  untilLabel,
  validateTag,
  type AvatarEntry,
  type AvatarTrack,
} from '@/account/rules'
import { STAT_GROUP_ORDER, prettyStat, statGroup, statIconFor } from '@/account/stats'
import { StatBoard } from '@/account/StatLeaderboard'
import { fetchAllPlayerStats, rankBy } from '@/account/statboard'
import { Ring, TrackIcon, type AccountTab } from '@/account/PhoneAccount'
import { DeskAutoSign, useAutoSign } from '@/components/AutoSign'
import { GameImg } from '@/components/GameImg'
import { useChainQuery } from '@/chain/useChainQuery'
import { landId } from '@/chain/landId'
import { landThumbStyle } from '@/map/terrain'
import { legendExpiry } from '@/shop/rules'
import { AUTO_SIGN_GROUPS } from '@/wharf/autoSign'
import { formatCompact, formatNumber, formatStat } from '@/format'
import { asset } from '@/assets'

const TABS: [AccountTab, string][] = [
  ['avatar', 'Avatar'],
  ['cpu', 'CPU'],
  ['autosign', 'Auto-sign'],
  ['stats', 'Stats'],
]

const UNKNOWN_AVATAR = asset('/assets/avatar/unknown.webp')
/* The closest tracks are the ones worth a look; the rest are one click away. */
const TRACKS_FIRST = 9
const DAY = 86_400_000

/**
 * Account on a desktop: an identity card beside the tabs.
 *
 * Who you are stays in a card on the left whatever the tab — the avatar you
 * wear, the gamertag (changed in place), the wallet, Legend Access with a way
 * to renew it, where you are on the map, one line per tab and Disconnect. The
 * tabs take the right: avatars as tracks with every tier in line, CPU as the
 * phone's two rings, auto-signing as three choices over its switches, and
 * the stats in their groups, each with where you rank.
 */
export function DeskAccount({
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
  const ready = claimableAvatars(board)
  const autoSign = useAutoSign()

  return (
    <div className="dacc">
      <IdentityCard
        player={player}
        board={board}
        busy={busy}
        canAct={canAct}
        cpu={cpu}
        autoSign={autoSign.live.length}
        onTag={onTag}
        onDisconnect={onDisconnect}
      />

      <div className="dacc__main">
        <div className="prew__tabs drew__tabs" role="tablist" aria-label="Account">
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
          <DeskTracks board={board} busy={busy} canAct={canAct} onSelect={onSelect} onUnlock={onUnlock} />
        )}
        {tab === 'cpu' && (
          <DeskCpu player={player} cpu={cpu} busy={busy} canAct={canAct} onClaim={onClaimCpu} />
        )}
        {tab === 'autosign' && <DeskAutoSign state={autoSign} />}
        {tab === 'stats' && <DeskStats player={player} />}
      </div>
    </div>
  )
}

/* ---------- who you are ---------- */

function IdentityCard({
  player,
  board,
  busy,
  canAct,
  cpu,
  autoSign,
  onTag,
  onDisconnect,
}: {
  player: Player
  board: AvatarEntry[]
  busy: string | null
  canAct: boolean
  cpu: { config?: CpuConfig; usage?: CpuUsage; account?: AccountCpu }
  /** How many kinds of action sign by themselves, as saved. */
  autoSign: number
  onTag: (tag: string) => void
  onDisconnect: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [tag, setTag] = useState(player.playertag)
  const problem = validateTag(tag)
  const changed = tag.trim() !== player.playertag

  const legend = legendExpiry(player)
  const daysLeft = legend ? Math.max(1, Math.ceil((legend.getTime() - Date.now()) / DAY)) : 0
  const owned = board.filter((e) => e.state === 'active' || e.state === 'unlocked').length
  const status = cpuStatus(cpu.config, cpu.usage)

  return (
    <aside className="dacc__card" aria-label="Your account">
      <GameImg
        className="dacc__av"
        src={avatarArt(player.active_avatar)}
        fallback={UNKNOWN_AVATAR}
        alt=""
      />

      {editing ? (
        <form
          className="dacc__tagedit"
          onSubmit={(e) => {
            e.preventDefault()
            if (problem || !changed) return
            onTag(tag.trim())
            setEditing(false)
          }}
        >
          <input
            className="input"
            value={tag}
            maxLength={TAG_MAX}
            autoFocus
            onChange={(e) => setTag(e.target.value)}
            disabled={!canAct || busy !== null}
            placeholder="Please set a gamertag."
            aria-label="Gamertag"
          />
          {problem && changed && <small className="pacc__warn">{problem}</small>}
          <span className="dacc__tagactions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setTag(player.playertag)
                setEditing(false)
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={!canAct || busy !== null || !!problem || !changed}
            >
              {busy === 'tag' && <span className="spinner" />}
              Save
            </button>
          </span>
        </form>
      ) : (
        <h2 className="dacc__tag">
          {player.playertag || 'No gamertag yet'}
          <button
            type="button"
            className="pacc__pen"
            aria-label="Change gamertag"
            onClick={() => {
              setTag(player.playertag)
              setEditing(true)
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16v4z" />
              <path d="M13.5 6.5l4 4" />
            </svg>
          </button>
        </h2>
      )}
      <span className="dacc__wallet mono">{player.wallet}</span>
      {legend ? (
        <span className={`dacc__legend${daysLeft <= 7 ? ' is-soon' : ''}`}>
          <img src={asset('/assets/icons/account-legend.svg')} alt="" />
          Legend · {daysLeft === 1 ? '1 day' : `${daysLeft} days`} left
        </span>
      ) : (
        <span className="dacc__legend is-off">No Legend Access</span>
      )}

      <dl className="dacc__facts">
        <div>
          <dt>Avatars</dt>
          <dd className="mono">
            {formatNumber(owned)} of {formatNumber(board.length)}
          </dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            <span
              className="dacc__thumb"
              style={landThumbStyle(player.planet, player.x, player.y, 14)}
              aria-hidden="true"
            />
            <span className="dacc__planet">{player.planet}</span>{' '}
            <span className="mono">
              {player.x}:{player.y}
            </span>{' '}
            · <span className="mono">{landId(player.x, player.y)}</span>
          </dd>
        </div>
        <div>
          <dt>Free CPU claims</dt>
          <dd className="mono">
            {cpu.usage || cpu.config ? `${formatNumber(status.left)} of ${formatNumber(status.allowance)}` : '…'}
          </dd>
        </div>
        <div>
          <dt>Auto-sign</dt>
          <dd className="mono">
            {autoSign === 0
              ? 'Off'
              : autoSign === AUTO_SIGN_GROUPS.length
                ? 'Everything'
                : `${autoSign} of ${AUTO_SIGN_GROUPS.length}`}
          </dd>
        </div>
        <div>
          <dt>Legend Access</dt>
          <dd>
            {legend && (
              <span className="mono">
                {legend.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </span>
            )}
            {legend && ' · '}
            <Link to="/shop?c=account">{legend ? 'Renew' : 'Get it'}</Link>
          </dd>
        </div>
      </dl>

      <button type="button" className="btn btn--ghost dacc__leave" onClick={onDisconnect}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
          <path d="M10 16l-4-4 4-4" />
          <path d="M6 12h10" />
        </svg>
        Disconnect wallet
      </button>
    </aside>
  )
}

/* ---------- avatars, every tier in line ---------- */

function DeskTracks({
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
  const [everything, setEverything] = useState(false)

  if (tracks.length === 0) return <p className="rsheet__hint">Reading the avatars…</p>

  const shown = everything ? tracks : tracks.slice(0, TRACKS_FIRST)
  const readyTracks = tracks.filter((t) => t.ready > 0)
  const off = !canAct || busy !== null

  return (
    <>
      {ready.length > 0 && (
        <div className="dacc__claim">
          <GameImg
            src={avatarArt(readyTracks[0].tiers.find((t) => t.state === 'ready')!.avatar.avatar_id)}
            fallback={UNKNOWN_AVATAR}
            alt=""
          />
          <span>
            <b>
              {ready.length} avatar{ready.length === 1 ? '' : 's'} to claim
            </b>
            <small>
              Across {readyTracks.length} track{readyTracks.length === 1 ? '' : 's'} ·{' '}
              {readyTracks.map((t) => t.label).join(', ')}
            </small>
          </span>
          <button type="button" className="btn btn--gold" disabled={off} onClick={() => onUnlock(ready)}>
            {busy === 'unlock' && <span className="spinner" />}
            Unlock all
          </button>
        </div>
      )}

      <h2 className="drew__cap">
        Avatar tracks
        <span>click one of yours to wear it · closest first</span>
      </h2>
      <div className="dacc__tracks">
        {shown.map((t) => (
          <TrackRow key={t.stat} track={t} off={off} onSelect={onSelect} onUnlock={onUnlock} />
        ))}
      </div>
      {tracks.length > TRACKS_FIRST && (
        <button type="button" className="btn btn--ghost btn--sm drew__more" onClick={() => setEverything((v) => !v)}>
          {everything ? 'Show the closest only' : `Show all ${tracks.length} tracks`}
        </button>
      )}
    </>
  )
}

function TrackRow({
  track: t,
  off,
  onSelect,
  onUnlock,
}: {
  track: AvatarTrack
  off: boolean
  onSelect: (id: number) => void
  onUnlock: (ids: number[]) => void
}) {
  const readyIds = t.tiers.filter((x) => x.state === 'ready').map((x) => Number(x.avatar.avatar_id))
  return (
    <div className="dtrack">
      <TrackIcon stat={t.stat} />
      <span className="dtrack__name">
        <b>
          {t.label}
          <em className="mono">{formatCompact(t.have)}</em>
        </b>
        <span className="ptrack__pips" aria-hidden="true">
          {t.tiers.map((x) => (
            <i key={x.avatar.avatar_id} className={`is-${x.state}`} />
          ))}
        </span>
      </span>
      <span className="dtrack__tiers">
        {t.tiers.map((x) => {
          const id = Number(x.avatar.avatar_id)
          const art = (
            <GameImg src={avatarArt(id)} fallback={UNKNOWN_AVATAR} alt="" loading="lazy" />
          )
          const need = <small className="mono">{formatCompact(x.need)}</small>
          if (x.state === 'unlocked')
            return (
              <button
                type="button"
                key={id}
                className="dtier is-unlocked"
                title={`Wear · ${formatNumber(x.need)}`}
                disabled={off}
                onClick={() => onSelect(id)}
              >
                {art}
                {need}
              </button>
            )
          if (x.state === 'ready')
            return (
              <button
                type="button"
                key={id}
                className="dtier is-ready"
                title={`Unlock · ${formatNumber(x.need)}`}
                disabled={off}
                onClick={() => onUnlock(readyIds)}
              >
                {art}
                <em>Earned</em>
                {need}
              </button>
            )
          return (
            <span
              key={id}
              className={`dtier is-${x.state}`}
              title={x.state === 'locked' ? `${formatNumber(x.need - t.have)} to go` : 'Wearing'}
            >
              {art}
              {x.state === 'active' && <em>Wearing</em>}
              {need}
            </span>
          )
        })}
      </span>
      <span className="dtrack__next">
        {t.next && (
          <span className={`dtrack__bar${t.ready > 0 ? ' is-ready' : ''}`}>
            <i style={{ width: `${Math.min(100, (t.have / Math.max(1, t.next.need)) * 100)}%` }} />
          </span>
        )}
        <small>
          {t.ready > 0 ? (
            <b className="ptrack__gold">{t.ready} to claim</b>
          ) : t.next ? (
            <>
              next at <b>{formatCompact(t.next.need)}</b> · {formatCompact(t.next.need - t.have)} to go
            </>
          ) : (
            'All earned'
          )}
        </small>
      </span>
    </div>
  )
}

/* ---------- CPU ---------- */

function DeskCpu({
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
  const legend = !!legendExpiry(player)
  const resetsAt = nextCpuReset(status.resetsAt)
  const untilReset = untilLabel(resetsAt - Date.now())
  /* `current_used` is the decayed figure the chain actually bills against. */
  const max = Number(cpu.account?.max ?? 0)
  const used = Number(cpu.account?.current_used ?? 0)
  const free = Math.max(0, max - used)
  const low = cpuLow(cpu.account)

  return (
    <div className="dacc__gauges">
      <section className="dgauge">
        <Ring share={status.allowance > 0 ? status.left / status.allowance : 0} tone="go">
          <b className="mono">{formatNumber(status.left)}</b>
          <small>of {formatNumber(status.allowance)} left</small>
        </Ring>
        <span className="dgauge__text">
          <h2 className="dgauge__title">Free CPU claims</h2>
          <p className="rsheet__hint">
            The game pays the network for a CPU top-up, up to {formatNumber(status.allowance)} times a
            week with Legend Access.
          </p>
          <span className="dgauge__facts">
            <span>
              <small>Used</small>
              <b className="mono">
                {formatNumber(status.used)} / {formatNumber(status.allowance)}
              </b>
            </span>
            <span>
              <small>Resets in</small>
              <b className="mono">{untilReset}</b>
            </span>
            <span>
              <small>Resets</small>
              <b className="mono">
                {new Date(resetsAt).toLocaleString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </b>
            </span>
          </span>
          <span className="dgauge__act">
            {/*
              `maxpowerup` returns without error for a lapsed player — it signs,
              succeeds, and sends nothing — so the button is disabled rather than
              left to fail quietly, and the line points at the fix.
            */}
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canAct || busy !== null || status.left === 0 || !legend}
              onClick={onClaim}
            >
              {busy === 'cpu' && <span className="spinner" />}
              Claim CPU
            </button>
            {!legend ? (
              <small>
                Claiming needs <Link to="/shop?c=account">Legend Access</Link>.
              </small>
            ) : status.left === 0 ? (
              <small>All {formatNumber(status.allowance)} used this week. The next is back in {untilReset}.</small>
            ) : null}
          </span>
        </span>
      </section>

      <section className="dgauge">
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
        <span className="dgauge__text">
          <h2 className="dgauge__title">Your wallet's CPU</h2>
          <p className="rsheet__hint">
            What the network gives your account to spend on transactions. It refills on its own over
            about a day, and a claim tops it up.
          </p>
          <span className="dgauge__facts">
            <span>
              <small>Free now</small>
              <b className="mono">{cpu.account ? formatCpuTime(free) : '…'}</b>
            </span>
            <span>
              <small>Used</small>
              <b className="mono">{cpu.account ? formatCpuTime(used) : '…'}</b>
            </span>
            <span>
              <small>Total</small>
              <b className="mono">{cpu.account ? formatCpuTime(max) : '…'}</b>
            </span>
          </span>
          {low && (
            <p className="rsheet__hint pacc__warn">
              Almost none left. Transactions will start failing until it refills or you claim.
            </p>
          )}
        </span>
      </section>
    </div>
  )
}

/* ---------- stats ---------- */

function DeskStats({ player }: { player: Player }) {
  const stats = useMemo(() => Object.entries(kvToRecord(player.permstats)), [player.permstats])
  const [board, setBoard] = useState<string | null>(null)
  /* One read of every player answers every rank on the page. */
  const everyone = useChainQuery('player-stats', () => fetchAllPlayerStats())
  const ranks = useMemo(() => {
    const map = new Map<string, { rank: number; of: number }>()
    if (!everyone.data) return map
    for (const [k] of stats) {
      const ranked = rankBy(everyone.data, k)
      const mine = ranked.find((r) => r.wallet === player.wallet)
      if (mine) map.set(k, { rank: mine.rank, of: ranked.length })
    }
    return map
  }, [everyone.data, stats, player.wallet])

  if (stats.length === 0) return <p className="rsheet__hint">Nothing recorded yet. Go do something.</p>

  const order = (a: string, b: string) => prettyStat(a).localeCompare(prettyStat(b))

  return (
    <>
      <h2 className="drew__cap">
        All stats
        <span>
          {stats.length} tracked
          {everyone.data && ` · ranked against ${formatNumber(everyone.data.length)} players`} · click
          one for its leaderboard
        </span>
      </h2>
      <div className="dacc__stats">
        {STAT_GROUP_ORDER.map((group) => {
          const rows = stats.filter(([k]) => statGroup(k) === group).sort(([a], [b]) => order(a, b))
          if (rows.length === 0) return null
          return (
            <section key={group} className="dacc__group">
              <h3 className="drew__cap">
                {group}
                <span>{rows.length}</span>
              </h3>
              <div className="pacc__list">
                {rows.map(([k, v]) => {
                  const icon = statIconFor(k)
                  const r = ranks.get(k)
                  return (
                    <button
                      type="button"
                      className="pstat dstat"
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
                      <span className="pstat__v mono">{formatStat(k, Number(v))}</span>
                      <span className={`dstat__rank mono${r && r.rank <= 10 ? ' is-top' : ''}`}>
                        {r ? `#${formatNumber(r.rank)} of ${formatNumber(r.of)}` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {board && (
        <StatBoard
          statKey={board}
          label={prettyStat(board)}
          icon={statIconFor(board)}
          wallet={player.wallet}
          onClose={() => setBoard(null)}
        />
      )}
    </>
  )
}
