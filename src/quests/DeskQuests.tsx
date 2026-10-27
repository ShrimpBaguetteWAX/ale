import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Player } from '@/chain/types'
import type { Quest, QuestConfig } from './types'
import {
  formatTimeLeft,
  progressOf,
  questArt,
  questGo,
  questKey,
  questText,
  rewardOf,
  type ScopeBoard,
} from './rules'
import { NUM_LOCALE } from '@/format'
import { asset } from '@/assets'
import { QuestName, questNameText } from './QuestName'

/**
 * Quests on a desktop: the journal.
 *
 * Every quest down the left, grouped by cadence under its clock, each a row
 * with a small bar and what it pays; the one picked opens large on the right
 * — its art as a banner, a ring for how far along it is, the reward on a gold
 * plate, and where to go to move it on. The same split as Market, My
 * Fighters and My Lands, and nothing behind a Daily/Weekly/Monthly switch.
 */
export function DeskQuests({
  board,
  player,
  config,
  credits,
  now,
  busy,
  canAct,
  onClaim,
  onReroll,
}: {
  board: ScopeBoard[]
  player: Player
  config?: QuestConfig
  credits: number
  now: number
  busy: ReadonlyMap<string, string>
  canAct: boolean
  onClaim: (q: Quest) => void
  onReroll: (q: Quest) => void
}) {
  const live = board.flatMap((b) => b.quests)
  const liveKeys = live.map(questKey)
  const [picked, setPicked] = useState<{ key: string; scope: string } | null>(null)
  /* The board as it stood while the picked quest was on it. */
  const known = useRef<Set<string>>(new Set())

  /*
     A reroll or a claim replaces the quest, and the replacement has a new
     key — so the one to stay on is the quest in the same cadence that was
     not on the board before. Without this the journal jumped back to the
     top of the list the moment the chain answered.
  */
  const successor = (from: { scope: string }) =>
    live.find((q) => q.quest_scope === from.scope && !known.current.has(questKey(q)))
  const held = picked ? (live.find((q) => questKey(q) === picked.key) ?? successor(picked)) : undefined
  /* The one picked; else the first ready to claim; else the first on the list. */
  const shown =
    held ?? live.find((q) => progressOf(q, player, now).claimable) ?? live[0] ?? null

  const signature = liveKeys.join('|')
  useEffect(() => {
    if (!picked) return
    if (liveKeys.includes(picked.key)) {
      known.current = new Set(liveKeys)
      return
    }
    const next = successor(picked)
    if (next) {
      known.current = new Set(liveKeys)
      setPicked({ key: questKey(next), scope: picked.scope })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  /* Hold on to a quest — clicked, or acted on while it was only the default. */
  const pick = (q: Quest) => {
    known.current = new Set(liveKeys)
    setPicked({ key: questKey(q), scope: q.quest_scope })
  }

  /*
     A reroll straight from the list, without opening the quest first. The
     journal stays on whatever it was showing: pinned now if it was only the
     default, so the board changing under it does not move it; and if the
     quest rerolled is the one on show, it follows its replacement.
  */
  const cost = config?.reroll_cost ?? 0
  const tooPoor = cost > credits
  const rerollRow = (q: Quest) => {
    if (shown && !picked) pick(shown)
    else known.current = new Set(liveKeys)
    onReroll(q)
  }

  return (
    <div className="dquests">
      <nav className="dquests__list" aria-label="Your quests">
        {board.map((b) => (
          <section className="dquests__group" key={b.scope} aria-label={b.label}>
            <h2 className="dquests__grp">
              {b.label}
              {b.claimable > 0 && <em>{b.claimable} ready</em>}
              {b.endsAt !== undefined && Number.isFinite(b.endsAt) && (
                <span className="mono">{formatTimeLeft(b.endsAt - now)}</span>
              )}
            </h2>
            {b.quests.map((q) => {
              const p = progressOf(q, player, now)
              const r = rewardOf(q)
              const key = questKey(q)
              const doing = busy.get(key)
              return (
                <div className={`dquests__item${p.claimable ? '' : ' has-reroll'}`} key={key}>
                <button
                  type="button"
                  className={`dquests__row is-${band(p.percent)}${shown && questKey(shown) === key ? ' is-on' : ''}`}
                  onClick={() => pick(q)}
                >
                  <img src={questArt(q)} alt="" loading="lazy" />
                  <span className="dquests__rowtext">
                    <b title={questNameText(q)}>
                      <QuestName quest={q} />
                    </b>
                    <span className="dquests__bar">
                      <i style={{ width: `${Math.max(2, p.percent)}%` }} />
                    </span>
                  </span>
                  {p.claimable ? (
                    <span className="dquests__ready">Ready</span>
                  ) : (
                    <span className="dquests__pay mono">
                      <img src={r.icon} alt="" />
                      {r.label}
                    </span>
                  )}
                </button>
                {!p.claimable && (
                  <button
                    type="button"
                    className="dquests__reroll"
                    disabled={!canAct || busy.has(key) || tooPoor}
                    onClick={() => rerollRow(q)}
                    aria-label={`Reroll ${questNameText(q)} for ${cost.toLocaleString(NUM_LOCALE)} credits`}
                    title={tooPoor ? `Rerolling costs ${cost.toLocaleString(NUM_LOCALE)} credits` : `Reroll for ${cost.toLocaleString(NUM_LOCALE)} credits`}
                  >
                    {doing === 'reroll' ? (
                      <span className="spinner" />
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
                        <path d="M4 3v5h5" />
                        <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
                        <path d="M20 21v-5h-5" />
                      </svg>
                    )}
                    <span className={`dquests__rrcost${tooPoor ? ' is-short' : ''}`}>
                      {cost.toLocaleString(NUM_LOCALE)}
                      <img src={asset('/assets/icons/credits.svg')} alt="" />
                    </span>
                  </button>
                )}
                </div>
              )
            })}
            {Array.from({ length: b.emptySlots }, (_, i) => (
              <div className="dquests__row is-empty" key={`slot-${i}`}>
                <span className="dquests__slot" aria-hidden="true">+</span>
                <span className="dquests__rowtext">
                  <b>Empty slot</b>
                  <small>New quests fills it</small>
                </span>
              </div>
            ))}
            {b.expired.map((q) => (
              <div className="dquests__row is-expired" key={questKey(q)} title="Ran out before it was finished; pays nothing">
                <img src={questArt(q)} alt="" loading="lazy" />
                <span className="dquests__rowtext">
                  <b>
                    <QuestName quest={q} />
                  </b>
                  <small>Expired · clears with New quests</small>
                </span>
              </div>
            ))}
          </section>
        ))}
      </nav>

      {shown ? (
        <Detail
          quest={shown}
          label={board.find((b) => b.scope === shown.quest_scope)?.label ?? ''}
          player={player}
          config={config}
          credits={credits}
          now={now}
          busy={busy}
          canAct={canAct}
          onClaim={() => {
            pick(shown)
            onClaim(shown)
          }}
          onReroll={() => {
            pick(shown)
            onReroll(shown)
          }}
        />
      ) : (
        <section className="dquests__detail dquests__detail--none">
          <p>No quests on the board. New quests draws three in each cadence.</p>
        </section>
      )}
    </div>
  )
}

/* Red, amber, green: barely started, worth pushing, go and claim it. */
function band(percent: number): 'done' | 'near' | 'far' {
  return percent >= 100 ? 'done' : percent >= 50 ? 'near' : 'far'
}

function Detail({
  quest,
  label,
  player,
  config,
  credits,
  now,
  busy,
  canAct,
  onClaim,
  onReroll,
}: {
  quest: Quest
  label: string
  player: Player
  config?: QuestConfig
  credits: number
  now: number
  busy: ReadonlyMap<string, string>
  canAct: boolean
  onClaim: () => void
  onReroll: () => void
}) {
  const p = progressOf(quest, player, now)
  const r = rewardOf(quest)
  const key = questKey(quest)
  const go = questGo(quest)
  const cost = config?.reroll_cost ?? 0
  const tooPoor = cost > credits
  /* Only this quest's own action disables its buttons. */
  const working = busy.has(key)
  const doing = busy.get(key)
  const done = Math.min(p.done, p.goal)

  return (
    <section className={`dquests__detail is-${band(p.percent)}`}>
      <div className="dquests__hero" style={{ backgroundImage: `url('${questArt(quest)}')` }}>
        <div className="dquests__plate">
          <span>
            <small>{label} quest</small>
            <h2>
              <QuestName quest={quest} />
            </h2>
          </span>
          {p.claimable && <span className="dquests__readychip">Ready to claim</span>}
          <span className="dquests__clock mono">ends in {formatTimeLeft(p.msLeft)}</span>
        </div>
      </div>

      <div className="dquests__body">
        <div
          className="dquests__ring"
          style={{ '--p': p.percent } as React.CSSProperties}
          role="img"
          aria-label={`${done} of ${p.goal}`}
        >
          <span>
            <b>{Math.floor(p.percent)}%</b>
            <small className="mono">
              {done.toLocaleString(NUM_LOCALE)} / {p.goal.toLocaleString(NUM_LOCALE)}
            </small>
          </span>
        </div>

        <div className="dquests__info">
          <p className="dquests__desc">{questText(quest)}</p>

          <div className="dquests__reward">
            <b className="mono">
              <img src={r.icon} alt="" />
              {r.label}
              <small>{r.symbol}</small>
            </b>
          </div>

          {p.claimable ? (
            <div className="dquests__acts">
              <button
                type="button"
                className="btn btn--gold dquests__main"
                disabled={!canAct || working}
                onClick={onClaim}
              >
                {doing === 'claim' && <span className="spinner" />}
                Claim {r.label} {r.symbol}
              </button>
            </div>
          ) : (
            <div className="dquests__acts">
              {go && (
                <Link className="btn btn--primary dquests__main" to={go.to}>
                  {go.label}
                </Link>
              )}
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!canAct || working || tooPoor}
                onClick={onReroll}
                title={tooPoor ? `Rerolling costs ${cost} credits` : 'Trade this quest for another in the same cadence'}
              >
                {doing === 'reroll' && <span className="spinner" />}
                Reroll
                <span className={`cost${tooPoor ? ' cost--short' : ''}`}>
                  {cost.toLocaleString(NUM_LOCALE)}
                  <img src={asset('/assets/icons/credits.svg')} alt="credits" width={16} height={16} />
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
