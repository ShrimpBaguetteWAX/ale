import { useCallback, useEffect, useRef, useState } from 'react'
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
  rewardCount,
  seasonPot,
  seasonTiming,
} from '@/leaderboard/rules'
import { claimLeaderboardReward } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import { formatNumber, formatDecimals } from '@/format'
import { fighterArt, fighterArtFallback } from '@/tavern/fighterStats'
import { asset } from '@/assets'
import { avatarArt } from '@/account/rules'

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
  reload: () => Promise<void>
}

function useBoards(account: string | null): BoardData {
  const [ranks, setRanks] = useState<DungeonRank[]>([])
  const [config, setConfig] = useState<DungeonConfigLb>()
  const [pool, setPool] = useState<TlmPool>()
  const [cooldown, setCooldown] = useState<ClaimCooldown>()
  const [seasons, setSeasons] = useState<ArenaSeason[]>([])
  const [arena, setArena] = useState<Map<string, ArenaRank[]>>(new Map())
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
    async (refresh: boolean) => {
      if (!account) return
      setError(null)
      try {
        const cfg = await fetchDungeonLbConfig()
        const poolName = cfg?.lb_tlmpools?.[0]?.first ?? 'tlmdunglb'

        const [r, p, cd, s] = await Promise.all([
          /* A hundred, not the top twenty that are paid: the board is also
             how a player sees where they stand and how far there is to climb,
             and twenty-five rows answered neither for most people. */
          fetchDungeonRanks(100, refresh),
          fetchTlmPool(poolName, refresh),
          fetchClaimCooldown(account, refresh),
          fetchArenaSeasons(refresh),
        ])

        /* Each season's board is its own scope, so they are read together. */
        const boards = await Promise.all(
          s.map((season) => fetchArenaRanks(season.scope, refresh)),
        )

        if (!alive.current) return
        setConfig(cfg)
        setRanks(r)
        setPool(p)
        setCooldown(cd)
        setSeasons(s)
        setArena(new Map(s.map((season, i) => [season.scope, boards[i]])))
      } catch (err) {
        if (alive.current) setError(readableError(err))
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

  return { ranks, config, pool, cooldown, seasons, arena, loading, error, reload }
}

/* ---------- the screen ---------- */

/**
 * The player, as the player chose to be seen.
 *
 * Both leaderboard tables already carried `avatar` on every row and neither
 * drew it, so a board of the best players in the game was a list of wallet
 * addresses. The avatars are unlocked by playing — each one has a permstat
 * it is earned against — which makes them worth showing precisely on the
 * screen that is about who has played the most.
 *
 * `unknown.webp` covers both a player who has never set one (the id is 0)
 * and an id this build has no art for, which is what a new avatar shipped
 * on chain before a client update looks like.
 */
function PlayerAvatar({ id, name }: { id: number | undefined; name: string }) {
  const unknown = asset('/assets/avatar/unknown.webp')
  return (
    <img
      className="lbrow__avatar"
      src={id ? avatarArt(id) : unknown}
      alt=""
      title={name}
      loading="lazy"
      width={34}
      height={34}
      onError={(e) => {
        const img = e.currentTarget
        if (img.dataset.fallback) return
        img.dataset.fallback = '1'
        img.src = unknown
      }}
    />
  )
}

export default function Leaderboard() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const data = useBoards(account)
  const { ranks, config, pool, cooldown, seasons, arena } = data

  const [tab, setTab] = useState<Tab>('dungeons')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const claimAt = cooldown ? Date.parse(cooldown.cooldown_expired + 'Z') : 0
  const onCooldown = claimAt > now

  const doClaim = async () => {
    if (!session) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await claimLeaderboardReward(session)
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 900))
        await Promise.all([data.reload(), refreshPlayer({ force: true })])
      }
      setNotice('Daily leaderboard reward claimed.')
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!player) return null

  return (
    <div className="lboard">
      <header className="lboard__head">
        <div>
          <h1 className="lboard__title">Leaderboards</h1>
          <p className="lboard__lede">{LEDE[tab]}</p>
        </div>

        {/*
          Only the dungeon board is claimed by hand. `claimlbrwrd` pays a
          dungeon rank and nothing else; the arena settles itself when a
          season closes, and the tournament has no board yet. Showing the
          button on those tabs offered an action that either does nothing for
          what is on screen or fails outright.
        */}
        {tab === 'dungeons' && (
          <button
            type="button"
            className="btn btn--primary lboard__claim"
            disabled={!session || busy || onCooldown}
            onClick={() => void doClaim()}
            title={
              onCooldown
                ? 'One claim a day'
                : 'Pays out your dungeon leaderboard rank'
            }
          >
            {busy && <span className="spinner" />}
            {onCooldown
              ? `Rewards available in ${countdown(claimAt - now)}`
              : 'Claim daily Rewards'}
          </button>
        )}
      </header>

      {notice && <div className="alert alert--ok">{notice}</div>}
      {(error || data.error) && (
        <div className="alert alert--error">{error ?? data.error}</div>
      )}

      <div className="lbtabs" role="tablist" aria-label="Leaderboard">
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
            className="lbtab"
            onClick={() => setTab(key)}
          >
            <img src={icon} alt="" width={20} height={20} />
            {label}
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
}: {
  ranks: DungeonRank[]
  config?: DungeonConfigLb
  pool?: TlmPool
  wallet: string
}) {
  /* Still the cutoff for the "Pays now" column and the threshold rule. */
  const paid = rewardCount(config)

  return (
    <>
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

        {ranks.map((row, i) => {
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
                <span className="lbrow__team">
                  {(row.recent_fighters ?? []).slice(0, 6).map((f, n) => (
                    <img
                      key={`${row.wallet}-${n}`}
                      src={fighterArt({
                        classname: f.classname,
                        racename: f.racename,
                      })}
                      alt={`${f.racename} ${f.classname}`}
                      title={`${f.racename} ${f.classname}`}
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget
                        if (img.dataset.fallback) return
                        img.dataset.fallback = '1'
                        img.src = fighterArtFallback()
                      }}
                    />
                  ))}
                </span>

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

  /* Follow the opening choice until the player picks for themselves. */
  const touched = useRef(false)
  useEffect(() => {
    if (!touched.current) setScope(opening)
  }, [opening])

  if (seasons.length === 0) {
    return <p className="lboard__empty">No arena season is running.</p>
  }

  const shown = seasons.filter((s) => s.scope === (scope ?? seasons[0].scope))

  return (
    <div className="seasons">
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

      {shown.map((season) => {
        const timing = seasonTiming(season, now)
        const rows = boards.get(season.scope) ?? []
        const pot = seasonPot(season)

        return (
          <section className="season" key={season.scope}>
            <header className="season__head">
              <div>
                <h2 className="season__name">{season.displayname}</h2>
                <p className="season__meta">
                  Top {formatNumber(season.winners)} share{' '}
                  {formatDecimals(pot, 4)} TLM
                </p>
              </div>
              <div className="season__clock">
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
              </div>
            </header>

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
                  <span>Earned</span>
                </div>

                {rows.map((row, i) => {
                  const rank = i + 1
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
                            `earned_*` only fills in once a season is settled,
                            so during a run this is honestly blank rather than
                            a guess at a share nobody has been awarded.
                          */}
                          {row.earned_tlm > 0 ? (
                            <>
                              <img
                                src={asset("/assets/icons/tlm.svg")}
                                alt="TLM"
                                width={14}
                                height={14}
                              />
                              {formatDecimals(row.earned_tlm / 10_000, 4)}
                            </>
                          ) : (
                            <span className="faint">—</span>
                          )}
                        </span>
                      </article>

                      {rank === season.winners && rows.length > season.winners && (
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
