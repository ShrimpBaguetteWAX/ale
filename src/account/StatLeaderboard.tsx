import { useEffect, useState } from 'react'
import { fetchAllPlayerStats, rankBy, type StatRank } from '@/account/statboard'
/* The same medal colours the dungeon and arena boards use. */
import { rankClass } from '@/leaderboard/rules'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useModal } from '@/components/useModal'
import { BottomSheet } from '@/components/BottomSheet'
import { readableError } from '@/wharf/errors'
import { formatStat } from '@/format'
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

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} leaderboard`}
      onClick={onClose}
    >
      <div
        className="sheet__panel"
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
          <span className="panel__title statboard__title">
            {icon && <img className="statline__icon" src={asset(icon)} alt="" />}
            {label}
          </span>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            Close
          </button>
        </div>
        <StatBoardList statKey={statKey} wallet={wallet} />
      </div>
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

function StatBoardList({ statKey, wallet }: { statKey: string; wallet: string }) {
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
