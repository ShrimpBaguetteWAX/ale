import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import {
  fetchArenaRanks,
  fetchArenaSeasons,
  fetchClaimCooldown,
  fetchDungeonLbConfig,
  fetchDungeonRanks,
  fetchTlmPool,
} from '@/leaderboard/queries'
import type {
  ArenaRank,
  ArenaSeason,
  ClaimCooldown,
  DungeonConfigLb,
  DungeonRank,
  TlmPool,
} from '@/leaderboard/types'
import {
  countdown,
  defaultSeason,
  displayName,
  dungeonReward,
  rankClass,
  arenaReward,
  rewardCount,
  seasonPot,
  seasonTiming,
} from '@/leaderboard/rules'
import { claimLeaderboardReward, DIRTIES } from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { useChainQuery } from '@/chain/useChainQuery'
import { formatNumber, formatDecimals } from '@/format'
import { fighterArt, fighterArtFallback } from '@/tavern/fighterStats'
import { ActionBanner } from '@/components/ActionBanner'
import { asset } from '@/assets'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { GameImg } from '@/components/GameImg'
import { usePhone } from '@/components/usePhone'
import { FighterHoverCard } from '@/components/FighterPanel'
import { HoverPopover, useHoverCard } from '@/components/HoverPopover'
import { battlePanel, enemyNftPanel, nftCards } from '@/fight/setup'
import { fetchSchemaTemplates } from '@/chain/atomic'
import { useConfig } from '@/state/useConfig'
import { NFT_FIGHTER_ID } from '@/dungeon/rules'
import { NFT_FIGHTER_ART } from '@/dungeon/nftFighter'
import type { BattleFighter } from '@/dungeon/types'

/**
 * Leaderboards.
 *
 * Two boards run on entirely different footings, and conflating them is the
 * easy mistake:
 *
 *   • **Dungeons** is a standing ranking with no end. Rating is earned by the
 *     team you leave defending your dungeon, and the reward is claimed daily
 *     from a shared pot on a decaying curve — rank one takes a hundredth of
 *     the pot, and only the top `lb_reward_count` places earn at all. So the
 *     board draws the qualifying line, and shows what each place would pay
 *     right now.
 *
 *   • **Arena** runs in seasons, each with its own scope, clock and fixed
 *     prize pot. Two overlap today: a fortnightly Domination and a two-day
 *     Weekend Challenge. Position matters only at the moment a season ends,
 *     so those boards lead with the clock.
 *
 * The Tournament tab exists in the original with nothing behind it. Saying so
 * beats rendering an empty panel.
 */

type Tab = 'dungeons' | 'arena' | 'tournament'

/**
 * What each board is, in the player's terms.
 *
 * One line per tab rather than one line covering all of them: the two boards
 * are earned and paid in different ways, and a sentence that has to describe
 * both at once ends up describing neither well enough to act on.
 */
export const LEDE: Record<Tab, string> = {
  dungeons:
    'Dungeon rating is earned by winning dungeons. The higher the difficulty, ' +
    'the more rating you gain. The top 20 can claim rewards for their rank ' +
    'every day.',
  arena:
    'The arena leaderboard automatically pays out rewards to the winners when ' +
    'they end.',
  tournament:
    'Tournament standings will appear here once the season format goes live.',
}

/* ---------- data ---------- */

interface BoardData {
  ranks: DungeonRank[]
  config?: DungeonConfigLb
  pool?: TlmPool
  cooldown?: ClaimCooldown
  seasons: ArenaSeason[]
  arena: Map<string, ArenaRank[]>
  loading: boolean
  error: string | null
  reload: () => Promise<unknown>
}

function useBoards(account: string | null): BoardData {
  /*
     One query, because the reads are not independent: the pool is named by
     the config, and which arena scopes exist is named by the seasons. Two of
     the four steps here cannot start until an earlier one has answered, so
     splitting them into separate hooks would only make the sequence harder
     to read without making it any faster.

     `deps` is what re-reads it: a claim moves the standings, and this screen
     is the one looking at them.
  */
  const query = useChainQuery(
    account && `boards:${account}`,
    async () => {
      const cfg = await fetchDungeonLbConfig()
      const poolName = cfg?.lb_tlmpools?.[0]?.first ?? 'tlmdunglb'

      const [r, p, cd, s] = await Promise.all([
        /* A hundred, not the top twenty that are paid: the board is also
           how a player sees where they stand and how far there is to climb,
           and twenty-five rows answered neither for most people. */
        fetchDungeonRanks(100),
        fetchTlmPool(poolName),
        fetchClaimCooldown(account!),
        fetchArenaSeasons(),
      ])

      /*
         Each season's board is its own scope, so they are read together —
         and so is each season's settled one.

         `finishlb` copies the paying places into the scope named by
         `winner_scope` when a season rolls over, ranks and payouts filled
         in, and leaves them there until the next rollover. That snapshot is
         the only record of who won the last one: the live board is wiped
         and starts again from nothing.
      */
      const scopes = s.flatMap((season) => [season.scope, season.winner_scope])
      const boards = await Promise.all(scopes.map((scope) => fetchArenaRanks(scope)))

      return {
        config: cfg,
        ranks: r,
        pool: p,
        cooldown: cd,
        seasons: s,
        arena: new Map(scopes.map((scope, i) => [scope, boards[i]])),
      }
    },
    { deps: ['leaderboard', 'player'] },
  )

  return {
    ranks: query.data?.ranks ?? EMPTY_RANKS,
    config: query.data?.config,
    pool: query.data?.pool,
    cooldown: query.data?.cooldown,
    seasons: query.data?.seasons ?? EMPTY_SEASONS,
    arena: query.data?.arena ?? EMPTY_ARENA,
    loading: query.loading,
    error: query.error,
    reload: query.reload,
  }
}

/* Stable empties, so a screen with no data yet does not hand every `useMemo`
   below a new array on each render. */
const EMPTY_RANKS: DungeonRank[] = []
const EMPTY_SEASONS: ArenaSeason[] = []
const EMPTY_ARENA = new Map<string, ArenaRank[]>()

/* ---------- the screen ---------- */



export default function Leaderboard() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)

  const data = useBoards(account)
  const { ranks, config, pool, cooldown, seasons, arena } = data

  const [tab, setTab] = useState<Tab>('dungeons')
  const [showLede, setShowLede] = useState(false)
  /* A boolean here: this screen has one button. */
  const { busy: busyKey, error, run } = useAction()
  const busy = busyKey !== null

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const claimAt = cooldown ? Date.parse(cooldown.cooldown_expired + 'Z') : 0
  const onCooldown = claimAt > now

  /**
   * Whether this wallet is high enough on the board to be paid at all.
   *
   * `lbclaim` walks the rating index down from the top for `lb_reward_count`
   * places looking for the caller, and ends `check(false, "You need to be
   * above a certain rank to qualify for rewards")` if it does not find them.
   * So for everyone outside that range the button was an offer to spend a
   * transaction on a guaranteed failure.
   *
   * The count comes from the config rather than the twenty it happens to be,
   * so the button follows the contract if the number is ever changed. The
   * board is read a hundred deep and the paid range is the top twenty of it,
   * so a rank found here is a rank the contract will find too.
   */
  const paidPlaces = rewardCount(config)
  const myRank = ranks.findIndex((r) => r.wallet === player?.wallet) + 1
  const canClaim = myRank >= 1 && paidPlaces >= 1 && myRank <= paidPlaces

  const doClaim = () =>
    run(
      'claim',
      () => claimLeaderboardReward(session!),
      'Daily leaderboard reward claimed.',
      { after: data.reload, dirties: DIRTIES.claimLeaderboardReward },
    )

  /*
     A desktop has room to say on each tab where you stand on it: your dungeon
     place, and your place on the season the Arena tab opens on, with its clock.
  */
  const phone = usePhone()
  const openSeason = defaultSeason(seasons, now)
  const arenaRank = openSeason
    ? (arena.get(openSeason.scope) ?? []).findIndex((r) => r.wallet === player?.wallet) + 1
    : 0
  const openTiming = openSeason ? seasonTiming(openSeason, now) : undefined
  const tabMeta: Partial<Record<Tab, string>> = {
    dungeons: myRank > 0 ? `#${myRank}` : undefined,
    arena: openTiming
      ? [
          arenaRank > 0 ? `#${arenaRank}` : '',
          openTiming.phase === 'running'
            ? countdown(openTiming.msLeft)
            : openTiming.phase === 'upcoming'
              ? `in ${countdown(openTiming.msLeft)}`
              : '',
        ]
          .filter(Boolean)
          .join(' · ') || undefined
      : undefined,
  }

  /* The desktop's claim, in the strip that says where you stand. */
  const pays = canClaim ? Math.floor(dungeonReward(myRank, config, pool)) : 0
  const deskClaim = (
    <button
      type="button"
      className="btn btn--gold dlb__claim"
      disabled={!session || busy || onCooldown || !canClaim}
      onClick={() => void doClaim()}
      title={
        !canClaim
          ? `Only the top ${paidPlaces} are paid`
          : onCooldown
            ? 'One claim a day'
            : 'Pays out your dungeon leaderboard rank'
      }
    >
      {busy && <span className="spinner" />}
      {!canClaim
        ? `Top ${paidPlaces} only`
        : onCooldown
          ? `Next claim in ${countdown(claimAt - now)}`
          : `Claim ${formatNumber(pays)} TLM`}
    </button>
  )

  if (!player) return null

  return (
    <div className={`lboard${showLede ? ' lboard--lede' : ''}`}>
      <header className="lboard__head">
        <div>
          <h1 className="lboard__title">
            Leaderboards
            {/* A phone keeps the explanation behind this. */}
            <button
              type="button"
              className="lboard__info"
              aria-expanded={showLede}
              aria-label="How this board works"
              onClick={() => setShowLede((v) => !v)}
            >
              i
            </button>
          </h1>
          <p className="lboard__lede">{LEDE[tab]}</p>
        </div>

        {/*
          Only the dungeon board is claimed by hand. `claimlbrwrd` pays a
          dungeon rank and nothing else; the arena settles itself when a
          season closes, and the tournament has no board yet. Showing the
          button on those tabs offered an action that either does nothing for
          what is on screen or fails outright.
        */}
        {tab === 'dungeons' && phone && (
          <button
            type="button"
            className="btn btn--primary lboard__claim"
            disabled={!session || busy || onCooldown || !canClaim}
            onClick={() => void doClaim()}
            title={
              !canClaim
                ? `Only the top ${paidPlaces} are paid${myRank ? ` — you are ${myRank}` : ''}`
                : onCooldown
                  ? 'One claim a day'
                  : 'Pays out your dungeon leaderboard rank'
            }
          >
            {busy && <span className="spinner" />}
            {/*
              The label says what the button is for, not why it is off. Being
              outside the paid places is a fact about the board, and the board
              is the thing on screen underneath — the greyed control and the
              lede above it carry that between them.
            */}
            {onCooldown ? (
              <>
                <span className="lboard__claimlong">Rewards available in </span>
                <span className="lboard__claimshort">Claim · </span>
                {countdown(claimAt - now)}
              </>
            ) : (
              <>
                Claim<span className="lboard__claimlong"> daily Rewards</span>
              </>
            )}
          </button>
        )}
      </header>

      <ActionBanner error={error ?? data.error} />

      {/* A desktop draws the boards as the shop's tabs; a phone keeps its segmented control. */}
      <div className={phone ? 'lbtabs' : 'tabs lbtabs--desk'} role="tablist" aria-label="Leaderboard">
        {(
          [
            ['dungeons', 'Dungeons', asset('/assets/icons/dungeons.svg')],
            ['arena', 'Arena', asset('/assets/icons/arena.svg')],
            ['tournament', 'Tournament', asset('/assets/icons/tournament.svg')],
          ] as [Tab, string, string][]
        ).map(([key, label, icon]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={phone ? 'lbtab' : 'tabs__tab'}
            onClick={() => setTab(key)}
          >
            <img src={icon} alt="" width={phone ? 20 : 16} height={phone ? 20 : 16} />
            {label}
            {!phone && tabMeta[key] && <span className="tabs__count">{tabMeta[key]}</span>}
          </button>
        ))}
      </div>

      {data.loading ? (
        <div className="lbtable">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="lbrow lbrow--loading" key={i} />
          ))}
        </div>
      ) : tab === 'dungeons' ? (
        <DungeonBoard
          ranks={ranks}
          config={config}
          pool={pool}
          wallet={account ?? ''}
          claim={deskClaim}
        />
      ) : tab === 'arena' ? (
        <ArenaBoards
          seasons={seasons}
          boards={arena}
          wallet={account ?? ''}
          now={now}
        />
      ) : (
        <p className="lboard__empty">
          No tournament is running. The contract is deployed and the tab exists
          in the game, but nothing has been scheduled behind it yet.
        </p>
      )}
    </div>
  )
}

/* ---------- dungeons ---------- */

export function DungeonBoard({
  ranks,
  config,
  pool,
  wallet,
  claim,
}: {
  ranks: DungeonRank[]
  config?: DungeonConfigLb
  pool?: TlmPool
  wallet: string
  /** The daily claim, which a desktop holds in the strip that says where you stand. */
  claim?: React.ReactNode
}) {
  /* Still the cutoff for the "Pays now" column and the threshold rule. */
  const paid = rewardCount(config)
  const phone = usePhone()
  /* Both put the top three on a podium and list from fourth. */
  const from = Math.min(3, ranks.length)
  const payNow = (rank: number) =>
    rank <= paid ? (
      <>
        <img src={asset('/assets/icons/tlm.svg')} alt="TLM" width={14} height={14} />
        {formatNumber(Math.floor(dungeonReward(rank, config, pool)))}
      </>
    ) : null
  const mine = ranks.findIndex((r) => r.wallet === wallet)

  return (
    <>
      {phone && ranks.length > 0 && (
        <Podium
          places={ranks.slice(0, 3).map((r, i) => ({
            rank: i + 1,
            wallet: r.wallet,
            name: displayName(r),
            avatar: r.avatar,
            rating: r.rating,
            pays: payNow(i + 1),
          }))}
        />
      )}
      {phone && wallet && (
        <YouPin
          rank={mine + 1}
          name={mine >= 0 ? displayName(ranks[mine]) : ''}
          wallet={wallet}
          avatar={mine >= 0 ? ranks[mine].avatar : undefined}
          rating={mine >= 0 ? ranks[mine].rating : 0}
          pays={mine >= 0 ? payNow(mine + 1) : null}
          gap={
            mine >= paid && paid > 0 && ranks[paid - 1]
              ? `${formatNumber(ranks[paid - 1].rating - ranks[mine].rating)} to top ${paid}`
              : undefined
          }
          absent="Win dungeons to earn a rating"
        />
      )}
      {!phone && ranks.length > 0 && (
        <DeskPodium
          places={ranks.slice(0, 3).map((r, i) => ({
            rank: i + 1,
            wallet: r.wallet,
            name: displayName(r),
            avatar: r.avatar,
            rating: r.rating,
            pays: payNow(i + 1),
            team: <Team row={r} />,
          }))}
          wallet={wallet}
        />
      )}
      {!phone && wallet && (
        <YouStrip
          verb="You are"
          rank={mine + 1}
          name={mine >= 0 ? displayName(ranks[mine]) : ''}
          avatar={mine >= 0 ? ranks[mine].avatar : undefined}
          rating={mine >= 0 ? ranks[mine].rating : 0}
          line={mine >= 0 ? dungeonLine(ranks, mine, paid) : ''}
          stats={[['Pays now', mine >= 0 ? payNow(mine + 1) : null]]}
          action={claim}
          absent="Win dungeons to earn a rating"
        />
      )}
      <div className="lbtable">
        <div className="lbtable__head lbtable__head--dungeon">
          <span>Rank</span>
          <span>Player</span>
          <span>Defending team</span>
          <span>Rating</span>
          <span>Pays now</span>
        </div>

        {ranks.length === 0 && (
          <p className="lboard__empty">Nobody has defended a dungeon yet.</p>
        )}

        {ranks.slice(from).map((row, n) => {
          const i = n + from
          const rank = i + 1
          return (
            <div key={row.wallet}>
              <article
                className={`lbrow lbrow--dungeon${
                  row.wallet === wallet ? ' lbrow--you' : ''
                }`}
              >
                <span className={`rank ${rankClass(rank)}`}>{rank}</span>

                <span className="lbrow__who">
                  <PlayerAvatar id={row.avatar} name={displayName(row)} />
                  <span className="lbrow__id">
                    <span className="lbrow__name">{displayName(row)}</span>
                    <span className="lbrow__wallet">{row.wallet}</span>
                  </span>
                </span>

                {/*
                  The defending team is the whole reason the row has a rating,
                  and it is already in the row — so it is shown rather than
                  hidden behind a click.
                */}
                <Team row={row} />

                <span className="lbrow__rating">{formatNumber(row.rating)}</span>

                <span className="lbrow__pays">
                  {rank <= paid ? (
                    <>
                      <img src={asset("/assets/icons/tlm.svg")} alt="TLM" width={14} height={14} />
                      {/*
                        Whole Trilium. The reward curve gives four decimal
                        places because that is TLM’s own precision, but a
                        column of "323.9938" against "167.7097" is eight
                        characters of noise around the two digits that
                        separate one rank from the next.
                      */}
                      {formatNumber(Math.floor(dungeonReward(rank, config, pool)))}
                    </>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </span>
              </article>

              {/*
                Where the payouts stop. A line is the only way to show that
                rank 21 earns nothing while rank 20 earns something.
              */}
              {rank === paid && (
                <div className="lbthreshold">
                  <span>REWARD THRESHOLD</span>
                  <span>Score higher to qualify for rewards</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ---------- arena ---------- */

export function ArenaBoards({
  seasons,
  boards,
  wallet,
  now,
}: {
  seasons: ArenaSeason[]
  boards: Map<string, ArenaRank[]>
  wallet: string
  now: number
}) {
  /*
   * One season at a time. Stacked, the second board sat below a full first
   * one and was never seen; as tabs each gets the whole width, and the tab
   * strip doubles as a summary of what is running.
   */
  const opening = defaultSeason(seasons, now)?.scope
  const [scope, setScope] = useState<string | undefined>(opening)
  /*
     Which board of the chosen season is being read: the one being played, or
     the last one that paid out. Kept per screen rather than per season — a
     player looking at last month's winners wants the other season's winners
     too, not to be put back on a running board when they switch.
  */
  const [settled, setSettled] = useState(false)

  /* Follow the opening choice until the player picks for themselves. */
  const touched = useRef(false)
  useEffect(() => {
    if (!touched.current) setScope(opening)
  }, [opening])

  if (seasons.length === 0) {
    return <p className="lboard__empty">No arena season is running.</p>
  }

  const shown = seasons.filter((s) => s.scope === (scope ?? seasons[0].scope))
  const phone = usePhone()

  return (
    <div className="seasons">
      {!phone ? (
        /* A desktop: each season as a card with its pot and its clock. */
        <div className="dseasons" role="tablist" aria-label="Arena season">
          {seasons.map((s) => {
            const t = seasonTiming(s, now)
            return (
              <button
                type="button"
                key={s.scope}
                role="tab"
                aria-selected={s.scope === (scope ?? seasons[0].scope)}
                className="dseason"
                onClick={() => {
                  touched.current = true
                  setScope(s.scope)
                }}
              >
                <img src={asset('/assets/icons/arena.svg')} alt="" />
                <span className="dseason__text">
                  <b>{s.displayname}</b>
                  <small>
                    Top {formatNumber(s.winners)} share {formatDecimals(seasonPot(s), 0)} TLM
                  </small>
                </span>
                <span className={`dseason__clock${t.phase === 'upcoming' ? ' is-soon' : ''}`}>
                  <small>
                    {t.phase === 'running' ? 'Remaining' : t.phase === 'upcoming' ? 'Starts in' : 'Ended'}
                  </small>
                  <b className="mono">{t.phase === 'ended' ? '—' : countdown(t.msLeft)}</b>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
      <div className="seasontabs" role="tablist" aria-label="Arena season">
        {seasons.map((s) => {
          const t = seasonTiming(s, now)
          return (
            <button
              type="button"
              key={s.scope}
              role="tab"
              aria-selected={s.scope === (scope ?? seasons[0].scope)}
              className="seasontab"
              onClick={() => {
                touched.current = true
                setScope(s.scope)
              }}
            >
              <span className="seasontab__name">{s.displayname}</span>
              <span className="seasontab__meta">
                {t.phase === 'running'
                  ? `${countdown(t.msLeft)} left`
                  : t.phase === 'upcoming'
                    ? `starts in ${countdown(t.msLeft)}`
                    : 'Ended'}
              </span>
            </button>
          )
        })}
      </div>
      )}

      {shown.map((season) => {
        const timing = seasonTiming(season, now)
        const finished = boards.get(season.winner_scope) ?? []
        /* Offered only when there is a settled season to look at. */
        const canSwitch = finished.length > 0
        const showing = settled && canSwitch
        const rows = showing ? finished : boards.get(season.scope) ?? []
        const pot = seasonPot(season)
        const placePays = (rank: number, row: ArenaRank) =>
          !showing && rank <= season.winners ? (
            <>
              <img src={asset('/assets/icons/tlm.svg')} alt="TLM" width={14} height={14} />
              {formatNumber(Math.floor(arenaReward(rank, season)))}
            </>
          ) : row.earned_tlm > 0 ? (
            <>
              <img src={asset('/assets/icons/tlm.svg')} alt="TLM" width={14} height={14} />
              {formatDecimals(row.earned_tlm / 10_000, 0)}
            </>
          ) : null
        const rankOf = (row: ArenaRank, i: number) => (showing ? row.rank : i + 1)
        const from = Math.min(3, rows.length)
        const mine = rows.findIndex((r) => r.wallet === wallet)
        const mineRank = mine >= 0 ? rankOf(rows[mine], mine) : 0
        const above = mine > 0 ? rows[mine - 1] : undefined

        return (
          <section className="season" key={season.scope}>
            <header className={`season__head${phone ? '' : ' season__head--desk'}`}>
              <div>
                <h2 className="season__name">
                  {season.displayname}
                  {!phone && (
                    <span>
                      {showing ? 'last results' : `${formatNumber(rows.length)} players`}
                    </span>
                  )}
                </h2>
                {/* A desktop's season card already says what the running one shares. */}
                {(phone || showing) && (
                  <p className="season__meta">
                    {showing
                      ? `${formatNumber(finished.length)} paid, ${formatDecimals(
                          finished.reduce((sum, r) => sum + r.earned_tlm, 0) / 10_000,
                          0,
                        )} TLM between them`
                      : `Top ${formatNumber(season.winners)} share ${formatDecimals(pot, 0)} TLM`}
                  </p>
                )}
              </div>

              {/*
                Only where there is something to switch to. A season that has
                never rolled over has no settled board, and a control that
                shows an empty list is worse than no control.
              */}
              {canSwitch && (
                <div className="showtabs seasonview" role="group" aria-label="Which board">
                  <button
                    type="button"
                    className="showtabs__btn"
                    aria-pressed={!settled}
                    onClick={() => setSettled(false)}
                  >
                    Current
                  </button>
                  <button
                    type="button"
                    className="showtabs__btn"
                    aria-pressed={settled}
                    onClick={() => setSettled(true)}
                    title="Where the last season finished, and what each place was paid"
                  >
                    Last results
                  </button>
                </div>
              )}

              <div className="season__clock">
                {showing ? (
                  <>
                    <span className="season__phase">Settled</span>
                    <strong>Final</strong>
                  </>
                ) : (
                  <>
                    <span className="season__phase">
                      {timing.phase === 'upcoming'
                        ? 'Starting In'
                        : timing.phase === 'ended'
                          ? 'Ended'
                          : 'Remaining Time'}
                    </span>
                    <strong>
                      {timing.phase === 'ended' ? '—' : countdown(timing.msLeft)}
                    </strong>
                  </>
                )}
              </div>
            </header>

            {phone && rows.length > 0 && (
              <Podium
                places={rows.slice(0, 3).map((r, i) => ({
                  rank: rankOf(r, i),
                  wallet: r.wallet,
                  name: displayName(r),
                  avatar: r.avatar,
                  rating: r.rating,
                  pays: placePays(rankOf(r, i), r),
                }))}
              />
            )}
            {!phone && rows.length > 0 && (
              <DeskPodium
                places={rows.slice(0, 3).map((r, i) => ({
                  rank: rankOf(r, i),
                  wallet: r.wallet,
                  name: displayName(r),
                  avatar: r.avatar,
                  rating: r.rating,
                  pays: placePays(rankOf(r, i), r),
                }))}
                wallet={wallet}
              />
            )}
            {!phone && wallet && (
              <YouStrip
                verb={showing ? 'You were' : 'You are'}
                rank={mineRank}
                name={mine >= 0 ? displayName(rows[mine]) : ''}
                avatar={mine >= 0 ? rows[mine].avatar : undefined}
                rating={mine >= 0 ? rows[mine].rating : 0}
                line={
                  showing
                    ? `Last ${season.displayname} · ${formatNumber(finished.length)} paid`
                    : [
                        above
                          ? `${formatNumber(above.rating - rows[mine].rating)} behind #${rankOf(above, mine - 1)} ${displayName(above)}`
                          : mine === 0 && rows[1]
                            ? `${formatNumber(rows[0].rating - rows[1].rating)} ahead of #2 ${displayName(rows[1])}`
                            : '',
                        timing.phase === 'running' ? `${countdown(timing.msLeft)} left` : '',
                        'paid automatically when it ends',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                }
                stats={[
                  [showing ? 'You earned' : 'Place pays', mine >= 0 ? placePays(mineRank, rows[mine]) : null],
                  ...(showing ? [] : ([[`Of ${formatNumber(rows.length)}`, `Top ${formatNumber(season.winners)} paid`]] as [string, React.ReactNode][])),
                ]}
                absent={
                  showing
                    ? 'You were not among the places paid last time'
                    : 'Win an arena fight this season to get a rating'
                }
              />
            )}
            {phone && wallet && !showing && (
              <YouPin
                rank={mine + 1}
                name={mine >= 0 ? displayName(rows[mine]) : ''}
                wallet={wallet}
                avatar={mine >= 0 ? rows[mine].avatar : undefined}
                rating={mine >= 0 ? rows[mine].rating : 0}
                pays={mine >= 0 ? placePays(mine + 1, rows[mine]) : null}
                absent="Win an arena fight this season to get a rating"
              />
            )}
            {rows.length === 0 ? (
              <p className="lboard__empty">
                No data available for this leaderboard
              </p>
            ) : (
              <div className="lbtable">
                <div className="lbtable__head lbtable__head--arena">
                  <span>Rank</span>
                  <span>Player</span>
                  <span>Rating</span>
                  <span title={showing ? undefined : 'What the place pays when the season settles'}>
                    {showing ? 'Earned' : 'Place pays'}
                  </span>
                </div>

                {rows.slice(from).map((row, n) => {
                  const i = n + from
                  /* A settled board carries the place it actually paid. */
                  const rank = showing ? row.rank : i + 1
                  return (
                    <div key={row.wallet}>
                      <article
                        className={`lbrow lbrow--arena${
                          row.wallet === wallet ? ' lbrow--you' : ''
                        }`}
                      >
                        <span className={`rank ${rankClass(rank)}`}>{rank}</span>
                        <span className="lbrow__who">
                          <PlayerAvatar id={row.avatar} name={displayName(row)} />
                          <span className="lbrow__id">
                            <span className="lbrow__name">{displayName(row)}</span>
                            <span className="lbrow__wallet">{row.wallet}</span>
                          </span>
                        </span>
                        <span className="lbrow__rating">
                          {formatNumber(row.rating)}
                        </span>
                        <span className="lbrow__pays">
                          {/*
                            `earned_*` only fills in once a season is settled.
                            While one runs, what the place pays is still known
                            — the pot is fixed when the season starts and the
                            split never varies — so the board shows that
                            instead of a column of dashes. What nobody knows
                            yet is who will be standing here at the end.
                          */}
                          {!showing && rank <= season.winners ? (
                            <>
                              <img
                                src={asset('/assets/icons/tlm.svg')}
                                alt="TLM"
                                width={14}
                                height={14}
                              />
                              {formatNumber(Math.floor(arenaReward(rank, season)))}
                            </>
                          ) : row.earned_tlm > 0 ? (
                            <>
                              <img
                                src={asset("/assets/icons/tlm.svg")}
                                alt="TLM"
                                width={14}
                                height={14}
                              />
                              {formatDecimals(row.earned_tlm / 10_000, 0)}
                            </>
                          ) : (
                            <span className="faint">—</span>
                          )}
                        </span>
                      </article>

                      {/* Nothing to qualify for on a board that has paid. */}
                      {!showing && rank === season.winners && rows.length > season.winners && (
                        <div className="lbthreshold">
                          <span>REWARD THRESHOLD</span>
                          <span>Score higher to qualify for rewards</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

/* ---------- the defending team ---------- */

/*
 * The defending team is the whole reason a dungeon row has a rating, and it is
 * already in the row — so it is shown rather than hidden behind a click.
 */
function Team({ row }: { row: DungeonRank }) {
  return (
    <span className="lbrow__team">
      {(row.recent_fighters ?? []).slice(0, 6).map((f, n) => (
        <TeamFace key={`${row.wallet}-${n}`} fighter={f} templateIds={row.used_template_ids} />
      ))}
    </span>
  )
}

/**
 * One fighter of a defending team, opening the same stat card the Dungeon's
 * line-up does on a resting pointer.
 *
 * The sixth is the NFT fighter fused from the row's crew and weapon cards: it
 * has no class or race, so it is drawn and read the way the Dungeon draws it.
 * The card catalogue that names those two cards is only read once one of
 * them is hovered — a board of twenty rows should not cost it otherwise.
 */
function TeamFace({ fighter: f, templateIds }: { fighter: BattleFighter; templateIds: number[] }) {
  const phone = usePhone()
  const { classes } = useConfig()
  /* A uint64 on chain, so the row hands it over as a string. */
  const nft = Number(f.fighter_id) === NFT_FIGHTER_ID
  const [wanted, setWanted] = useState(false)
  const catalogue = useChainQuery(
    'card-catalogue',
    async () => {
      const [crewTemplates, weaponTemplates] = await Promise.all([
        fetchSchemaTemplates('crew.worlds'),
        fetchSchemaTemplates('arms.worlds'),
      ])
      return new Map([...crewTemplates, ...weaponTemplates])
    },
    { enabled: nft && wanted },
  )
  const preview = useMemo(
    () => () =>
      nft
        ? { panel: enemyNftPanel(f), template: undefined, cards: nftCards(templateIds ?? [], catalogue.data) }
        : { panel: battlePanel(f), template: classes.get(f.classname), cards: undefined },
    [f, nft, templateIds, catalogue.data, classes],
  )
  const { ref, shown, handlers } = useHoverCard(preview, !phone)

  /* The NFT's cards arrive after the pointer did: reopen with them named. */
  const [resting, setResting] = useState(false)
  useEffect(() => {
    if (resting && catalogue.data) handlers.onMouseEnter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue.data])

  const name = nft ? 'NFT Fighter' : `${f.racename} ${f.classname}`
  return (
    <span
      className="lbrow__face"
      ref={ref}
      onMouseEnter={() => {
        setWanted(true)
        setResting(true)
        handlers.onMouseEnter()
      }}
      onMouseLeave={() => {
        setResting(false)
        handlers.onMouseLeave()
      }}
    >
      {shown && (
        <HoverPopover anchor={shown.rect}>
          <FighterHoverCard
            fighter={shown.value.panel}
            template={shown.value.template}
            cards={shown.value.cards}
          />
        </HoverPopover>
      )}
      <GameImg
        src={nft ? NFT_FIGHTER_ART : fighterArt({ classname: f.classname, racename: f.racename })}
        alt={name}
        loading="lazy"
        fallback={fighterArtFallback()}
      />
    </span>
  )
}

/** Where you stand on the dungeon board, in one line: the place above, and the paid line. */
function dungeonLine(ranks: DungeonRank[], mine: number, paid: number): string {
  const me = ranks[mine]
  const parts: string[] = []
  const inside = paid > 0 && mine < paid
  if (inside) parts.push(`Inside the paid top ${paid}`)
  else if (paid > 0 && ranks[paid - 1])
    parts.push(`${formatNumber(ranks[paid - 1].rating - me.rating)} to reach the top ${paid}`)
  if (mine > 0) {
    const above = ranks[mine - 1]
    parts.push(`${formatNumber(above.rating - me.rating)} behind #${mine} ${displayName(above)}`)
  } else if (ranks[1]) {
    parts.push(`${formatNumber(me.rating - ranks[1].rating)} ahead of #2 ${displayName(ranks[1])}`)
  }
  if (inside && ranks[paid - 1] && mine < paid - 1)
    parts.push(`the line is ${formatNumber(me.rating - ranks[paid - 1].rating)} below you`)
  return parts.join(' · ')
}

/* ---------- a desktop's podium and your place ---------- */

/**
 * The phone's podium, given width: first in the middle and larger, second
 * and third either side, each a card in its medal's colour with the rating,
 * what the place pays and — on the dungeon board — the defending team.
 */
function DeskPodium({ places, wallet }: { places: (Place & { team?: React.ReactNode })[]; wallet: string }) {
  return (
    <div className="dpodium">
      {places.map((p) => (
        <div
          className={`dpodium__place dpodium__place--${p.rank}${p.wallet === wallet ? ' is-you' : ''}`}
          key={p.wallet}
        >
          <span className="dpodium__num">{p.rank}</span>
          <PlayerAvatar
            id={p.avatar}
            name={p.name}
            className="dpodium__avatar"
            size={p.rank === 1 ? 92 : 72}
          />
          <span className="dpodium__name">{p.name}</span>
          {p.wallet === wallet && <em className="dpodium__you">You</em>}
          <span className="dpodium__rating mono">{formatNumber(p.rating)}</span>
          <span className="lbrow__pays dpodium__pays">{p.pays}</span>
          {p.team}
        </div>
      ))}
    </div>
  )
}

/**
 * Your place, under the podium: the rank large, how far the next place is,
 * what it pays, and on the dungeon board the claim. On a board you are not
 * on, it says how to get on it.
 */
function YouStrip({
  verb,
  rank,
  name,
  avatar,
  rating,
  line,
  stats,
  action,
  absent,
}: {
  verb: string
  rank: number
  name: string
  avatar?: number
  rating: number
  line: string
  stats: [string, React.ReactNode][]
  action?: React.ReactNode
  absent: string
}) {
  if (rank < 1) {
    return (
      <div className="dyou is-absent">
        <span className="dyou__text">
          <b>You are not on this board yet</b>
          <small>{absent}</small>
        </span>
      </div>
    )
  }
  return (
    <div className="dyou">
      <span className={`dyou__rank ${rankClass(rank)}`}>
        <small>{verb}</small>#{formatNumber(rank)}
      </span>
      <PlayerAvatar id={avatar} name={name} className="dyou__avatar" size={44} />
      <span className="dyou__text">
        <b>
          {name} · {formatNumber(rating)} rating
        </b>
        <small>{line}</small>
      </span>
      {stats.map(([label, value]) => (
        <span className="dyou__stat" key={label}>
          <small>{label}</small>
          <b className="lbrow__pays">{value ?? <span className="faint">—</span>}</b>
        </span>
      ))}
      {action}
    </div>
  )
}

/* ---------- a phone's podium and pinned row ---------- */

interface Place {
  rank: number
  wallet: string
  name: string
  avatar?: number
  rating: number
  pays: React.ReactNode
}

/**
 * The top three on a podium: first in the middle and highest, gold, silver
 * and bronze. A phone shows this above the list, which carries on from
 * fourth.
 */
function Podium({ places }: { places: Place[] }) {
  return (
    <div className="podium">
      {places.map((p) => (
        <div className={`podium__place podium__place--${p.rank}`} key={p.wallet}>
          <PlayerAvatar
            id={p.avatar}
            name={p.name}
            className="podium__avatar"
            size={p.rank === 1 ? 58 : 46}
          />
          <span className="podium__name">{p.name}</span>
          <span className="podium__rating mono">{formatNumber(p.rating)}</span>
          <span className="podium__pays">{p.pays}</span>
          <span className="podium__step">{p.rank}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * The player's own place, pinned above the tab bar on a phone, so however
 * far the list is scrolled it says where they stand — and how far from the
 * paid places. On a board they are not on, it says how to get on it.
 */
function YouPin({
  rank,
  name,
  wallet,
  avatar,
  rating,
  pays,
  gap,
  absent,
}: {
  rank: number
  name: string
  wallet: string
  avatar?: number
  rating: number
  pays: React.ReactNode
  gap?: string
  absent: string
}) {
  if (rank < 1) {
    return (
      <div className="lbpin">
        <article className="lbrow lbrow--you lbpin__row">
          <span className="rank">–</span>
          <span className="lbrow__id">
            <span className="lbrow__name">You are not on this board yet</span>
            <span className="lbrow__wallet">{absent}</span>
          </span>
        </article>
      </div>
    )
  }
  return (
    <div className="lbpin">
      <article className="lbrow lbrow--you lbpin__row">
        <span className={`rank ${rankClass(rank)}`}>{rank}</span>
        <span className="lbrow__who">
          <PlayerAvatar id={avatar} name={name} />
          <span className="lbrow__id">
            <span className="lbrow__name">{name}</span>
            <span className="lbrow__wallet">{gap ?? wallet}</span>
          </span>
        </span>
        <span className="lbrow__rating">{formatNumber(rating)}</span>
        <span className="lbrow__pays">{pays ?? <span className="faint">—</span>}</span>
      </article>
    </div>
  )
}
