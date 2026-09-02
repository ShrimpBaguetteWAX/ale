import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import {
  fetchActiveQuests,
  fetchQuestConfig,
  fetchQuestScopes,
} from '@/quests/queries'
import type { ActiveQuests, Quest, QuestConfig, QuestScope } from '@/quests/types'
import {
  boardOf,
  formatTimeLeft,
  needsRefill,
  progressOf,
  questArt,
  questKey,
  questText,
  rewardOf,
  type Scope,
  type ScopeBoard,
} from '@/quests/rules'
import { finishQuest, getQuests, rerollQuest } from '@/wharf/actions'
import { refreshChore } from '@/chores/signal'
import { readableError } from '@/wharf/errors'
import type { Player } from '@/chain/types'
import { NUM_LOCALE } from '@/format'
import { asset } from '@/assets'

/**
 * Quests.
 *
 * Three cadences — daily, weekly, monthly — each holding three quests at a
 * time. What the screen has to get across is not the list but the economics
 * behind it, because both halves are invisible on the row:
 *
 *   • **The reward is already escrowed.** `getquests` prices each quest from
 *     the pool the instant it is issued and moves the TLM into the contract's
 *     own account. The figure on a card is money set aside for this player,
 *     not an estimate — and rerolling returns it to the pool, so a reroll is
 *     a trade rather than a free redraw. The screen says so before the click.
 *
 *   • **Progress is a lifetime counter minus a snapshot.** The task watches a
 *     `permstats` key that only ever grows; the quest stores where it stood
 *     when the quest was issued. So neither number on the row is the number
 *     to show, and everything here is the difference.
 *
 * Claiming refills the slot on chain — `finishquest` ends by calling
 * `getquests` — which is worth saying, because otherwise a card vanishing and
 * a new one appearing looks like a glitch.
 */

/**
 * What is in flight, keyed by quest.
 *
 * A map rather than a single value: one action locking every other card was
 * the whole complaint. Each key is a `questKey`, or `REFILL` for the header
 * button, so a card only ever disables itself.
 */
type Busy = Map<string, 'claim' | 'reroll' | 'refill'>

const REFILL = '\u0000refill'

/* ---------- data ---------- */

interface QuestData {
  active?: ActiveQuests
  scopes: QuestScope[]
  config?: QuestConfig
  loading: boolean
  error: string | null
  /** Resolves with the board it just read, so a caller can poll on it. */
  reload: () => Promise<ActiveQuests | undefined>
}

function useQuests(account: string | null): QuestData {
  const [active, setActive] = useState<ActiveQuests>()
  const [scopes, setScopes] = useState<QuestScope[]>([])
  const [config, setConfig] = useState<QuestConfig>()
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
    async (refresh: boolean): Promise<ActiveQuests | undefined> => {
      if (!account) return undefined
      setError(null)
      try {
        const [a, s, c] = await Promise.all([
          fetchActiveQuests(account, refresh),
          fetchQuestScopes(refresh),
          fetchQuestConfig(),
        ])
        if (!alive.current) return undefined
        setActive(a)
        setScopes(s)
        setConfig(c)
        return a
      } catch (err) {
        if (alive.current) setError(readableError(err))
        return undefined
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

  return { active, scopes, config, loading, error, reload }
}

/* ---------- the screen ---------- */

export default function Quests() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const data = useQuests(account)
  const { active, scopes, config } = data

  const [scope, setScope] = useState<Scope>('day')
  const [busy, setBusy] = useState<Busy>(() => new Map())
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReroll, setConfirmReroll] = useState<string | null>(null)

  /*
   * Countdowns tick, and a daily quest in its final hour shows seconds. A
   * second is the only honest interval for that, and it costs one state
   * write — the cards below are cheap to re-render.
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const board = useMemo(
    () => (player ? boardOf(active?.quests ?? [], scopes, player, now) : []),
    [active, scopes, player, now],
  )

  const current = board.find((b) => b.scope === scope)
  const refill = needsRefill(board)
  const credits = player?.activestats.credits ?? 0

  /**
   * Run one quest action, then re-read the board and the player.
   *
   * Both matter: the quest row changes, and so do `permstats` and the credit
   * balance every progress bar and price is drawn from. The node that answers
   * the next read is rarely the one that just applied the transaction, so this
   * polls — but it stops the moment the board actually reflects the change
   * rather than running a fixed six rounds. A reroll that landed on the first
   * read still left every button dead for another five seconds.
   */
  const run = useCallback(
    async (
      key: string,
      kind: 'claim' | 'reroll' | 'refill',
      act: () => Promise<unknown>,
      done: string,
      /** True once the freshly read board shows the change. */
      settled: (fresh: ActiveQuests | undefined) => boolean,
    ) => {
      if (!session) return
      setBusy((b) => new Map(b).set(key, kind))
      setError(null)
      setNotice(null)
      try {
        await act()
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 900))
          const [fresh] = await Promise.all([
            data.reload(),
            refreshPlayer({ force: true }),
          ])
          if (settled(fresh)) break
        }
        /* A claimed quest is no longer waiting. */
        refreshChore('quests')
        setNotice(done)
      } catch (err) {
        setError(readableError(err))
      } finally {
        setBusy((b) => {
          const next = new Map(b)
          next.delete(key)
          return next
        })
      }
    },
    [session, data, refreshPlayer],
  )

  /*
     Claiming and rerolling both replace the quest, and `questKey` folds in
     the name, the target and the reward — so the key leaving the board is the
     signal that the chain has caught up on this one card.
  */
  const gone = (key: string) => (fresh: ActiveQuests | undefined) =>
    !!fresh && !fresh.quests.some((q) => questKey(q) === key)

  const doRefill = () => {
    const before = new Set((data.active?.quests ?? []).map(questKey))
    return run(
      REFILL,
      'refill',
      () => getQuests(session!),
      'New quests issued, with their rewards set aside.',
      /* A refill replaces whichever slots were empty or expired, so the test
         is that the board is no longer the one we started from. */
      (fresh) =>
        !!fresh &&
        (fresh.quests.length !== before.size ||
          fresh.quests.some((q) => !before.has(questKey(q)))),
    )
  }

  const doClaim = (quest: Quest) => {
    const r = rewardOf(quest)
    const key = questKey(quest)
    return run(
      key,
      'claim',
      () => finishQuest(session!, quest),
      `Claimed ${r.label} ${r.symbol}. A new quest has taken its place.`,
      gone(key),
    )
  }

  const doReroll = (quest: Quest) => {
    setConfirmReroll(null)
    const key = questKey(quest)
    return run(key, 'reroll', () => rerollQuest(session!, quest), 'Quest rerolled.', gone(key))
  }

  if (!player) return null

  return (
    <div className="quests">
      <header className="quests__head">
        <div>
          <h1 className="quests__title">Quests</h1>
          <p className="quests__lede">
            Three at a time in each cadence. Every reward is set aside the
            moment its quest is issued, so the figure on a card is already
            yours to finish for.
          </p>
        </div>

        {refill && (
          <button
            type="button"
            className="btn btn--primary quests__refill"
            disabled={!session || busy.has(REFILL)}
            onClick={() => void doRefill()}
          >
            {busy.has(REFILL) && <span className="spinner" />}
            New quests
          </button>
        )}
      </header>

      {notice && <div className="alert alert--ok">{notice}</div>}
      {(error || data.error) && (
        <div className="alert alert--error">
          {error ?? data.error}
          {/*
            `getquests` dereferences the player's quest row before checking
            that it exists, so a wallet that has never held a quest gets an
            abort with no useful message. Saying so beats leaving someone
            pressing a button that cannot work for them.
          */}
          {busy.size === 0 && !active && (
            <>
              {' '}
              If you have never held a quest before, this is a known fault in
              the contract rather than something you can fix from here.
            </>
          )}
        </div>
      )}

      <div className="scopetabs" role="tablist" aria-label="Quest cadence">
        {board.map((b) => (
          <button
            type="button"
            key={b.scope}
            role="tab"
            aria-selected={b.scope === scope}
            className="scopetab"
            onClick={() => setScope(b.scope as Scope)}
          >
            <span className="scopetab__name">
              {b.label}
              {b.claimable > 0 && (
                <span className="scopetab__badge" title="Ready to claim">
                  {b.claimable}
                </span>
              )}
            </span>
            <span className="scopetab__meta">
              {b.endsAt ? `resets in ${formatTimeLeft(b.endsAt - now)}` : '—'}
            </span>
          </button>
        ))}
      </div>

      {data.loading ? (
        <div className="questgrid">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="qcard qcard--loading" key={i} />
          ))}
        </div>
      ) : !active ? (
        <p className="quests__empty">
          You have no quests yet. Press <strong>New quests</strong> to draw
          your first three in each cadence.
        </p>
      ) : (
        current && (
          <ScopePanel
            board={current}
            player={player}
            config={config}
            credits={credits}
            now={now}
            busy={busy}
            canAct={!!session}
            confirmReroll={confirmReroll}
            onClaim={(q) => void doClaim(q)}
            onReroll={(q) => void doReroll(q)}
            onAskReroll={setConfirmReroll}
          />
        )
      )}
    </div>
  )
}

/* ---------- one cadence ---------- */

export function ScopePanel({
  board,
  player,
  config,
  credits,
  now,
  busy,
  canAct,
  confirmReroll,
  onClaim,
  onReroll,
  onAskReroll,
}: {
  board: ScopeBoard
  player: Player
  config?: QuestConfig
  credits: number
  now: number
  busy: Busy
  canAct: boolean
  confirmReroll: string | null
  onClaim: (q: Quest) => void
  onReroll: (q: Quest) => void
  onAskReroll: (key: string | null) => void
}) {
  return (
    <>
      <div className="questgrid">
        {board.quests.map((q) => (
          <QuestCard
            key={questKey(q)}
            quest={q}
            player={player}
            config={config}
            credits={credits}
            now={now}
            busy={busy}
            canAct={canAct}
            confirming={confirmReroll === questKey(q)}
            onClaim={() => onClaim(q)}
            onReroll={() => onReroll(q)}
            onAskReroll={() => onAskReroll(questKey(q))}
            onCancelReroll={() => onAskReroll(null)}
          />
        ))}

        {/*
          An empty slot is not nothing: the cadence is entitled to it and one
          press fills it. Leaving a gap would read as the game having run out
          of quests.
        */}
        {Array.from({ length: board.emptySlots }, (_, i) => (
          <div className="qcard qcard--slot" key={`slot-${i}`}>
            <span>Empty slot</span>
            <span className="faint">Press “New quests” to fill it</span>
          </div>
        ))}
      </div>

      {board.expired.length > 0 && (
        <section className="expired">
          <h2 className="panel__title">
            Expired ({board.expired.length})
          </h2>
          <p className="hint">
            These ran out before they were finished and pay nothing. They clear
            the moment you draw new quests.
          </p>
          <ul className="expired__list">
            {board.expired.map((q) => (
              <li key={questKey(q)}>
                <span>{questText(q)}</span>
                <span className="faint">
                  {progressOf(q, player, now).done.toLocaleString(NUM_LOCALE)} /{' '}
                  {Math.max(
                    0,
                    q.task_end_value - q.task_start_value,
                  ).toLocaleString(NUM_LOCALE)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/* ---------- one quest ---------- */

function QuestCard({
  quest,
  player,
  config,
  credits,
  now,
  busy,
  canAct,
  confirming,
  onClaim,
  onReroll,
  onAskReroll,
  onCancelReroll,
}: {
  quest: Quest
  player: Player
  config?: QuestConfig
  credits: number
  now: number
  busy: Busy
  canAct: boolean
  confirming: boolean
  onClaim: () => void
  onReroll: () => void
  onAskReroll: () => void
  onCancelReroll: () => void
}) {
  const p = progressOf(quest, player, now)
  const reward = rewardOf(quest)
  const key = questKey(quest)
  const cost = config?.reroll_cost ?? 0
  const tooPoor = cost > credits

  /*
     Only this card's own action disables it. A quest being claimed says
     nothing about whether the other two can be acted on, and greying them out
     made every action feel like it locked the screen.
  */
  const working = busy.has(key)
  const doing = busy.get(key)

  /*
   * Red, amber, green — the original's own three bands. A bar that is one
   * colour all the way says only "some"; these say "barely started", "worth
   * pushing", "go and claim it" at a glance across three cards.
   */
  const band =
    p.percent >= 100 ? 'done' : p.percent >= 50 ? 'near' : 'far'

  return (
    <article className={`qcard qcard--${band}`}>
      <div className="qcard__banner">
        <img src={questArt(quest)} alt="" loading="lazy" />
        <span className="qcard__clock" title="Time left">
          {formatTimeLeft(p.msLeft)}
        </span>
        {p.claimable && <span className="qcard__ready">Ready</span>}
      </div>

      <div className="qcard__body">
        <h3 className="qcard__title">{quest.quest_title}</h3>
        <p className="qcard__desc">{questText(quest)}</p>

        <div className="qcard__reward" title="Set aside for you when this quest was issued">
          <img src={reward.icon} alt="" width={18} height={18} />
          <strong>{reward.label}</strong>
          <span>{reward.symbol}</span>
        </div>

        <div className="qbar">
          <span className="qbar__fill" style={{ width: `${p.percent}%` }} />
          <span className="qbar__text">
            {Math.min(p.done, p.goal).toLocaleString(NUM_LOCALE)} /{' '}
            {p.goal.toLocaleString(NUM_LOCALE)}
          </span>
        </div>

        {p.claimable ? (
          <button
            type="button"
            className="btn btn--primary qcard__action"
            disabled={!canAct || working}
            onClick={onClaim}
          >
            {doing === 'claim' && <span className="spinner" />}
            Claim {reward.label} {reward.symbol}
          </button>
        ) : confirming ? (
          <div className="qcard__confirm">
            {/*
              Rerolling hands this quest's escrowed reward back to the pool and
              prices a fresh one independently, so the replacement can be worth
              less. That is the part worth pausing on — not the 25 credits.
            */}
            <p className="qcard__warn">
              Give up {reward.label} {reward.symbol} and any progress for a
              different quest? The new one is priced separately.
            </p>
            <div className="qcard__confirmRow">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={onCancelReroll}
              >
                Keep it
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={!canAct || working}
                onClick={onReroll}
              >
                {doing === 'reroll' && <span className="spinner" />}
                Reroll
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--ghost qcard__action"
            disabled={!canAct || working || tooPoor}
            onClick={onAskReroll}
            title={
              tooPoor
                ? `Rerolling costs ${cost} credits`
                : 'Trade this quest for another in the same cadence'
            }
          >
            Reroll
            <span className={`cost${tooPoor ? ' cost--short' : ''}`}>
              {cost.toLocaleString(NUM_LOCALE)}
              <img src={asset("/assets/icons/credits.png")} alt="credits" width={16} height={16} />
            </span>
          </button>
        )}
      </div>
    </article>
  )
}
