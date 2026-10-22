import { useMemo } from 'react'
import { useGame } from '@/state/useGame'
import { useChainQuery } from '@/chain/useChainQuery'
import { useAction } from '@/wharf/useAction'
import { DIRTIES, finishQuest } from '@/wharf/actions'
import { fetchActiveQuests } from '@/quests/queries'
import { progressOf, questArt, questKey, questText, rewardOf } from '@/quests/rules'
import { claimedRecently, rememberClaimed } from '@/quests/claimed'
import type { ActiveQuests, Quest } from '@/quests/types'

/**
 * Quests that are done, claimable from the map.
 *
 * Most quests finish on the map — travel somewhere, use a portal, walk into
 * a tavern — and the player is standing on the map when they do. Sending
 * them to the Quests screen to collect what they just earned is a detour,
 * so the finished ones are offered here as well. Only the finished ones:
 * this is a pocket to collect from, not the quest board.
 *
 * Its own query key, not the Quests screen's. That screen reads the row and
 * the scope clocks together under one key, and two readers of one key have
 * to agree on the shape of what it holds.
 */
export function useClaimableQuests() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)

  const query = useChainQuery(
    account && `map.quests:${account}`,
    () => fetchActiveQuests(account!),
    /* Claiming replaces the quest and pays onto the player row; walking
       moves the counters a quest watches. Either makes this stale. */
    { deps: ['quests', 'player'] },
  )

  const claimable = useMemo(
    () =>
      player
        ? (query.data?.quests ?? []).filter(
            /* A quest claimed here is gone, whatever a lagging node says. */
            (q) => progressOf(q, player).claimable && !claimedRecently(questKey(q)),
          )
        : [],
    [query.data, player],
  )

  return { claimable, reload: query.reload }
}

/** The finished quests, one Claim each. */
export function QuestClaims({
  quests,
  reload,
}: {
  quests: Quest[]
  reload: () => Promise<ActiveQuests | undefined>
}) {
  const session = useGame((s) => s.session)
  const { busy, error, notice, run } = useAction()

  const claim = (quest: Quest) => {
    const r = rewardOf(quest)
    const key = questKey(quest)
    const signed = () =>
      finishQuest(session!, quest).then((res) => {
        rememberClaimed(key)
        return res
      })
    return run(key, signed, `Claimed ${r.label} ${r.symbol}.`, {
      after: reload,
      dirties: DIRTIES.finishQuest,
      /* The claimed quest leaving the row is the chain having caught up. */
      settled: (fresh) => !!fresh && !fresh.quests.some((q) => questKey(q) === key),
    })
  }

  return (
    <div className="questclaims">
      <div className="questclaims__head">Quests done</div>
      {quests.map((q) => {
        const r = rewardOf(q)
        const key = questKey(q)
        const working = busy === key
        return (
          <div className="questclaim" key={key}>
            <img className="questclaim__art" src={questArt(q)} alt="" loading="lazy" />
            <div className="questclaim__text">
              <strong>{q.quest_title}</strong>
              <small>{questText(q)}</small>
            </div>
            <button
              type="button"
              className="questclaim__btn"
              disabled={!!busy || !session}
              onClick={() => void claim(q)}
            >
              {working && <span className="spinner" />}
              Claim
              <span className="questclaim__reward">
                <img src={r.icon} alt="" />
                {r.label} {r.symbol}
              </span>
            </button>
          </div>
        )
      })}
      {quests.length === 0 && <p className="hint">Nothing left to claim.</p>}
      {error && <div className="alert alert--error">{error}</div>}
      {notice && <div className="alert alert--ok">{notice}</div>}
    </div>
  )
}
