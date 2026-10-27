import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import { fetchActiveQuests, fetchQuestScopes } from '@/quests/queries'
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
import { useAction } from '@/wharf/useAction'
import { useChainQuery } from '@/chain/useChainQuery'
import { useLazyConfig } from '@/state/useConfig'
import { DIRTIES } from '@/wharf/actions'
import type { Player } from '@/chain/types'
import { NUM_LOCALE, formatDecimals } from '@/format'
import { asset } from '@/assets'
import { usePhone } from '@/components/usePhone'
import { claimedRecently, holdsReplaced, rememberClaimed } from '@/quests/claimed'
import { DeskQuests } from '@/quests/DeskQuests'
import { QuestName } from '@/quests/QuestName'

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
 *     a trade rather than a free redraw.
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
type BusyKind = 'claim' | 'reroll' | 'refill'
type Busy = Map<string, BusyKind>

/* One key for the hook, which identifies a working button by a single
   string. The kind never contains a colon, so the first one splits it. */
const busyKey = (kind: BusyKind, key: string) => `${kind}:${key}`

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
  /* The quest settings are the same for every player and come from the
     store; the board and the scope clocks are this wallet's. */
  const config = useLazyConfig('quest')

  const query = useChainQuery(
    account && `quests:${account}`,
    async () => {
      const [a, s] = await Promise.all([
        fetchActiveQuests(account!),
        fetchQuestScopes(),
      ])
      return { active: a, scopes: s }
    },
    /* Claiming refills the slot on chain and pays onto the player row, so
       both make this board stale. */
    { deps: ['quests', 'player'] },
  )

  return {
    active: query.data?.active,
    scopes: query.data?.scopes ?? EMPTY_SCOPES,
    config,
    loading: query.loading,
    error: query.error,
    /* The board, not just a promise: what an action waits on is whether the
       quest it claimed has left the freshly read board. */
    reload: async () => (await query.reload())?.active,
  }
}

const EMPTY_SCOPES: QuestScope[] = []

/* ---------- the screen ---------- */

export default function Quests() {
  const phone = usePhone()
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)

  const data = useQuests(account)
  const { active, scopes, config } = data

  const [scope, setScope] = useState<Scope>('day')
  const { busy: rawBusy, error, run } = useAction()
  /*
     The map is rebuilt from the hook's single key.

     It never held more than one entry — the old `run` set one and deleted it
     on the way out, and two quests cannot be signed at once — so this is the
     same value it always was, and `busy.has(key)`, `busy.size` and both child
     components go on working unchanged.
  */
  const busy = useMemo<Busy>(() => {
    const map: Busy = new Map()
    if (rawBusy) {
      const at = rawBusy.indexOf(':')
      map.set(rawBusy.slice(at + 1), rawBusy.slice(0, at) as BusyKind)
    }
    return map
  }, [rawBusy])

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

  /*
     A read that still holds a quest replaced here comes from a node that has
     not caught up. Once a read has caught up, that one is the better answer:
     a refresh landing on a node behind used to flash the old quest back for a
     moment, as if the reroll had undone itself. Right after a claim there is
     no such read yet, and the filter below leaves the claimed quest out.
  */
  const caughtUp = useRef<{ account: string | null; active: ActiveQuests } | null>(null)
  const behind = (a: ActiveQuests) => holdsReplaced(a.quests.map(questKey))
  let shown = active
  if (active && !behind(active)) caughtUp.current = { account, active }
  else if (active && caughtUp.current?.account === account && !behind(caughtUp.current.active))
    shown = caughtUp.current.active

  const board = useMemo(
    () =>
      player
        ? boardOf(
            /* A quest claimed here is gone, whatever a lagging node says. */
            (shown?.quests ?? []).filter((q) => !claimedRecently(questKey(q))),
            scopes,
            player,
            now,
          )
        : [],
    [shown, scopes, player, now],
  )

  const current = board.find((b) => b.scope === scope)
  /* "354.2 TLM on the board" — what every quest held pays, by token. */
  const onBoard = useMemo(() => {
    const sums = new Map<string, number>()
    for (const q of board.flatMap((b) => b.quests)) {
      const r = rewardOf(q)
      sums.set(r.symbol, (sums.get(r.symbol) ?? 0) + r.amount)
    }
    const parts = [...sums].map(([sym, n]) => `${formatDecimals(n, 1)} ${sym}`)
    return parts.length ? `Every quest · ${parts.join(' + ')} on the board` : ''
  }, [board])
  const refill = needsRefill(board)
  const credits = player?.activestats.credits ?? 0

  /*
     Both the board and the player matter after a quest action: the quest row
     changes, and so do permstats and the credit balance every progress bar
     and price is drawn from. The waiting stops the moment the board shows the
     change rather than running a fixed six rounds — a reroll that landed on
     the first read used to leave every button dead for another five seconds.
  */
  const opts = (action: keyof typeof DIRTIES) => ({
    after: data.reload,
    dirties: DIRTIES[action],
  })

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
      busyKey('refill', REFILL),
      () => getQuests(session!),
      /* No banner: the new quests appearing on the board is the answer. */
      '',
      {
        ...opts('getQuests'),
        /* A refill replaces whichever slots were empty or expired, so the
           test is that the board is no longer the one we started from. */
        settled: (fresh) =>
          !!fresh &&
          (fresh.quests.length !== before.size ||
            fresh.quests.some((q) => !before.has(questKey(q)))),
      },
    )
  }

  const doClaim = (quest: Quest) => {
    const r = rewardOf(quest)
    const key = questKey(quest)
    return run(
      busyKey('claim', key),
      () =>
        finishQuest(session!, quest).then((res) => {
          rememberClaimed(key)
          return res
        }),
      `Claimed ${r.label} ${r.symbol}. A new quest has taken its place.`,
      { ...opts('finishQuest'), settled: gone(key) },
    )
  }

  const doReroll = (quest: Quest) => {
    const key = questKey(quest)
    return run(
      busyKey('reroll', key),
      () => rerollQuest(session!, quest),
      'Quest rerolled.',
      {
        ...opts('rerollQuest'),
        /* Remembered only once the new quest is on the board: until then the
           old card stays, with its spinner, rather than an empty slot. */
        settled: (fresh) => {
          if (!gone(key)(fresh)) return false
          rememberClaimed(key)
          return true
        },
      },
    )
  }

  if (!player) return null

  return (
    <div className="quests">
      <header className="quests__head">
        <div>
          <h1 className="quests__title">Quests</h1>
          {!phone && onBoard && <p className="quests__sub">{onBoard}</p>}
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

      {/*
        A desktop is the journal: every cadence at once, the picked quest
        large beside the list, so there is no switch to draw.
      */}
      {!phone ? (
        /*
           The skeleton only before the first board: a refresh after a claim
           or a reroll keeps the journal mounted, so it stays on the quest
           that was open instead of starting over at the top.
        */
        data.loading && !active ? (
          <div className="dquests dquests--loading" aria-busy="true">
            <div className="dquests__list" />
            <div className="dquests__detail" />
          </div>
        ) : !active ? (
          <p className="quests__empty">
            You have no quests yet. Press <strong>New quests</strong> to draw your first three in
            each cadence.
          </p>
        ) : (
          <DeskQuests
            board={board}
            player={player}
            config={config}
            credits={credits}
            now={now}
            busy={busy}
            canAct={!!session}
            onClaim={(q) => void doClaim(q)}
            onReroll={(q) => void doReroll(q)}
          />
        )
      ) : (
        <>
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
              onClaim={(q) => void doClaim(q)}
              onReroll={(q) => void doReroll(q)}
            />
          )
        )}
        </>
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
  onClaim,
  onReroll,
}: {
  board: ScopeBoard
  player: Player
  config?: QuestConfig
  credits: number
  now: number
  busy: Busy
  canAct: boolean
  onClaim: (q: Quest) => void
  onReroll: (q: Quest) => void
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
            onClaim={() => onClaim(q)}
            onReroll={() => onReroll(q)}
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
  onClaim,
  onReroll,
}: {
  quest: Quest
  player: Player
  config?: QuestConfig
  credits: number
  now: number
  busy: Busy
  canAct: boolean
  onClaim: () => void
  onReroll: () => void
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
        <h3 className="qcard__title">
          <QuestName quest={quest} />
        </h3>
        <p className="qcard__desc">{questText(quest)}</p>

        <div className="qcard__reward" title="Set aside for you when this quest was issued">
          <img src={reward.icon} alt="" width={18} height={18} />
          <strong>{reward.label}</strong>
          <span>{reward.symbol}</span>
        </div>

        <div className="qprog">
          <div className="qbar">
            <span className="qbar__fill" style={{ width: `${p.percent}%` }} />
            <span className="qbar__text">
              {Math.min(p.done, p.goal).toLocaleString(NUM_LOCALE)} /{' '}
              {p.goal.toLocaleString(NUM_LOCALE)}
            </span>
          </div>
          <span className="qprog__count mono">
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
        ) : (
          <button
            type="button"
            className="btn btn--ghost qcard__action"
            disabled={!canAct || working || tooPoor}
            onClick={onReroll}
            title={
              tooPoor
                ? `Rerolling costs ${cost} credits`
                : 'Trade this quest for another in the same cadence'
            }
          >
            {doing === 'reroll' && <span className="spinner" />}
            Reroll
            <span className={`cost${tooPoor ? ' cost--short' : ''}`}>
              {cost.toLocaleString(NUM_LOCALE)}
              <img src={asset("/assets/icons/credits.svg")} alt="credits" width={16} height={16} />
            </span>
          </button>
        )}
      </div>
    </article>
  )
}
