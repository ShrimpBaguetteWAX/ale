import { useEffect, useState } from 'react'
import { fetchAllPlayerStats, rankBy, type StatRank } from '@/account/statboard'
/* The same medal colours the dungeon and arena boards use. */
import { rankClass } from '@/leaderboard/rules'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useModal } from '@/components/useModal'
import { BottomSheet } from '@/components/BottomSheet'
import { readableError } from '@/wharf/errors'
import { formatNumber, formatStat } from '@/format'
import { asset } from '@/assets'

/**
 * Where one stat puts you against everybody else.
 *
 * Opened from a row in All stats. The read behind it covers every stat at
 * once, so the first board a player opens pays for the rest of them.
 *
 * The player's own row is pinned below the top of the board when they are not
 * already in it — a leaderboard you cannot find yourself on is a list of
 * strangers, and "you are 47th of 61" is the thing most people opened it to
 * learn.
 */
/* The board shows the top of the field; anything past it is one pinned row. */
const DESK_TOP = 25

/**
 * The board on a desktop, in the Account page's own look: a dark card over
 * the page, where you stand first — your rank, your figure and how far the
 * player above is — then the field, with medals for the top three and your
 * own row lit.
 */
export function StatBoard({
  statKey,
  label,
  icon,
  wallet,
  onClose,
}: {
  statKey: string
  label: string
  icon?: string
  wallet: string
  onClose: () => void
}) {
  const panel = useModal(onClose)
  const { ranks, error } = useStatRanks(statKey)
  const mine = ranks?.find((r) => r.wallet === wallet)
  const above = mine && mine.rank > 1 ? ranks![mine.rank - 2] : undefined
  const below = mine && mine.rank === 1 ? ranks![1] : undefined
  const shown = ranks?.slice(0, DESK_TOP) ?? []
  const pinned = mine && mine.rank > DESK_TOP ? mine : undefined

  return (
    <div
      className="dboard"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} leaderboard`}
      onClick={onClose}
    >
      <div className="dboard__panel" ref={panel} onClick={(e) => e.stopPropagation()}>
        <header className="dboard__head">
          {icon ? <img src={asset(icon)} alt="" /> : <span />}
          <span className="dboard__title">
            <b>{label}</b>
            <small>
              {ranks
                ? `${formatNumber(ranks.length)} player${ranks.length === 1 ? ' has' : 's have'} recorded this`
                : 'Reading every player…'}
            </small>
          </span>
          <button type="button" className="dboard__close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {error && <div className="alert alert--error">{error}</div>}

        {ranks && (
          <div className="dboard__you">
            {mine ? (
              <>
                <span className={`dboard__bigrank ${rankClass(mine.rank)}`}>
                  <small>You are</small>#{formatNumber(mine.rank)}
                </span>
                <span className="dboard__youtext">
                  <b className="mono">{formatStat(statKey, mine.value)}</b>
                  <small>
                    {above
                      ? `${formatStat(statKey, above.value - mine.value)} behind #${above.rank} ${above.playertag || above.wallet}`
                      : below
                        ? `${formatStat(statKey, mine.value - below.value)} ahead of #2 ${below.playertag || below.wallet}`
                        : 'Nobody else has recorded this yet'}
                  </small>
                </span>
                <span className="dboard__of mono">
                  of {formatNumber(ranks.length)}
                </span>
              </>
            ) : (
              <span className="dboard__youtext">
                <b>You are not on this board yet</b>
                <small>It counts once you have recorded any of it.</small>
              </span>
            )}
          </div>
        )}

        <div className="dboard__list">
          {ranks && ranks.length === 0 && <p className="rsheet__hint">Nobody has recorded this yet.</p>}
          {shown.map((r) => (
            <DeskRow key={r.wallet} row={r} statKey={statKey} you={r.wallet === wallet} />
          ))}
          {pinned && (
            <>
              <div className="dboard__gap">{formatNumber(pinned.rank - DESK_TOP - 1)} more</div>
              <DeskRow row={pinned} statKey={statKey} you />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DeskRow({ row, statKey, you }: { row: StatRank; statKey: string; you: boolean }) {
  return (
    <div className={`dboard__row${you ? ' is-you' : ''}`}>
      <span className={`rank ${rankClass(row.rank)}`}>{row.rank}</span>
      <PlayerAvatar id={row.avatar} name={row.playertag || row.wallet} className="dboard__avatar" size={32} />
      <span className="dboard__name">
        {row.playertag || row.wallet}
        {you && <em>You</em>}
      </span>
      <span className="dboard__v mono">{formatStat(statKey, row.value)}</span>
    </div>
  )
}

/** The same board on a phone, in a bottom sheet. */
export function StatBoardSheet({
  statKey,
  label,
  wallet,
  onClose,
}: {
  statKey: string
  label: string
  wallet: string
  onClose: () => void
}) {
  return (
    <BottomSheet title={label} onClose={onClose}>
      <div className="statboard--sheet">
        <StatBoardList statKey={statKey} wallet={wallet} />
      </div>
    </BottomSheet>
  )
}

/** Every player ranked on one stat, read once for all of them. */
function useStatRanks(statKey: string) {
  const [ranks, setRanks] = useState<StatRank[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetchAllPlayerStats()
      .then((players) => live && setRanks(rankBy(players, statKey)))
      .catch((err) => live && setError(readableError(err)))
    return () => {
      live = false
    }
  }, [statKey])

  return { ranks, error }
}

function StatBoardList({ statKey, wallet }: { statKey: string; wallet: string }) {
  const { ranks, error } = useStatRanks(statKey)

  const TOP = 25
  const mine = ranks?.find((r) => r.wallet === wallet)
  const shown = ranks?.slice(0, TOP) ?? []
  const minePinned = mine && mine.rank > TOP ? mine : undefined

  return (
    <>
      {error && <div className="alert alert--error">{error}</div>}

      {!ranks && !error && <p className="muted">Reading every player…</p>}

      {ranks && ranks.length === 0 && (
        <p className="muted">Nobody has recorded this yet.</p>
      )}

      {ranks && ranks.length > 0 && (
        <>
          {shown.map((r) => (
            <StatBoardRow
              key={r.wallet}
              row={r}
              statKey={statKey}
              you={r.wallet === wallet}
            />
          ))}

          {minePinned && (
            <>
              <div className="statboard__gap">
                <span>
                  {minePinned.rank - TOP - 1} more
                </span>
              </div>
              <StatBoardRow row={minePinned} statKey={statKey} you />
            </>
          )}

          <p className="hint" style={{ marginTop: 'var(--sp-3)' }}>
            {ranks.length} player{ranks.length === 1 ? '' : 's'} have recorded this.
          </p>
        </>
      )}
    </>
  )
}

export function StatBoardRow({
  row,
  statKey,
  you,
}: {
  row: StatRank
  statKey: string
  you: boolean
}) {
  return (
    <div className={`statline statboard__row${you ? ' statboard__row--you' : ''}`}>
      <span className="statline__k">
        <span className={`rank ${rankClass(row.rank)}`}>{row.rank}</span>
        {/*
          The same face the leaderboards show. These boards rank the same
          people off the same field, and a row of wallet addresses is what the
          avatars were unlocked to replace.
        */}
        <PlayerAvatar
          id={row.avatar}
          name={row.playertag || row.wallet}
          className="statboard__avatar"
          size={22}
        />
        {row.playertag || row.wallet}
      </span>
      <span className="statline__v mono">
        {formatStat(statKey, row.value)}
      </span>
    </div>
  )
}
