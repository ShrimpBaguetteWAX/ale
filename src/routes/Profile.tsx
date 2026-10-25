import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchShardPools,
  fetchTlmPools,
  type PoolDescription,
  type ShardPool,
  type TlmPool,
} from '@/pools/queries'
import { poolBoard, trialPenalty } from '@/pools/rules'
import { useGame } from '@/state/useGame'
import { kvToRecord, type Avatar, type Player } from '@/chain/types'
import { landId } from '@/chain/landId'
import { AutoSign } from '@/components/AutoSign'
import { prettyStat, statIconFor } from '@/account/stats'
import { StatBoard } from '@/account/StatLeaderboard'
import { landThumbStyle } from '@/map/terrain'
import {
  fetchCpuUsage,
  fetchAccountCpu,
  fetchRewardLog,
  fetchRewardLogCapacity,
  type AccountCpu,
  type CpuConfig,
  type CpuUsage,
  type RewardLogEntry,
} from '@/account/queries'
import {
  TAG_MAX,
  avatarArt,
  avatarBoard,
  claimableAvatars,
  cpuLow,
  cpuStatus,
  formatCpuTime,
  hasLegendAccess,
  nextCpuReset,
  untilLabel,
  validateTag,
  logCapacity,
  CURRENCIES,
  CURRENCY_LABEL,
  type AvatarEntry,
  type Currency,
} from '@/account/rules'
import {
  setAvatarId,
  setLandownerShare,
  setMiningNfts,
  setPlayertag,
  unlockAvatars,
  claimCpu,
  claimCurrencies,
  unlockRewardRows,
  mineRewardPool,
  claimPoolRewards,
} from '@/wharf/actions'
import { randomHistoryId } from '@/dungeon/queries'
import { useAction } from '@/wharf/useAction'
import { useChainQuery } from '@/chain/useChainQuery'
import { useLazyConfig } from '@/state/useConfig'
import { DIRTIES } from '@/wharf/actions'
import {
  readMinedRewards,
} from '@/pools/MineCelebration'
import { MineToast, type MineToastState } from '@/pools/MineToast'
import { formatNumber, formatStat } from '@/format'
import { asset } from '@/assets'
import { GameImg } from '@/components/GameImg'
import { usePhone } from '@/components/usePhone'
import { PhoneRewards } from '@/rewards/PhoneRewards'
import { DeskRewards } from '@/rewards/DeskRewards'
import { PhoneAccount, type AccountTab } from '@/account/PhoneAccount'

/**
 * Account.
 *
 * The original's three tabs — Avatar, Mining and CPU — plus the stats this
 * rebuild already had, which nothing on the live site shows.
 *
 * One contract quirk shapes the avatar tab. `unlockavatar` checks each id's
 * `permstats_requirement` and **silently skips** anything short of it: no
 * error, no avatar, a successful transaction that did nothing. So the screen
 * only ever offers to claim what it has already confirmed as earned, and
 * shows the rest with the number still to reach.
 */

type Tab = 'avatar' | 'mining' | 'cpu' | 'autosign' | 'stats' | Currency

/**
 * Which half of the old account screen this is.
 *
 * It was seven tabs where four were a wallet and three were a profile, and
 * the one dot on the menu entry could only ever mean one of those things.
 * Split, each half gets a dot that means what it says: Rewards lights up
 * when a pool can be mined, Account when the free CPU allowance is running
 * out.
 *
 * One component rather than two, because the halves share their data — the
 * player row, the pools, the ledgers and the config all load together and
 * several are read by both.
 */
export type Section = 'account' | 'rewards'

const SECTION_TABS: Record<Section, [Tab, string][]> = {
  rewards: [
    ['mining', 'Mining'],
    ['tlm', CURRENCY_LABEL.tlm],
    ['shrds', CURRENCY_LABEL.shrds],
    ['wax', CURRENCY_LABEL.wax],
  ],
  account: [
    ['avatar', 'Avatar'],
    ['cpu', 'CPU'],
    ['autosign', 'Auto-sign'],
    ['stats', 'Stats'],
  ],
}
type Busy =
  | 'tag'
  | 'avatar'
  | 'unlock'
  | 'mining'
  | 'share'
  | 'claim'
  | 'rows'
  | 'cpu'
  | 'mine'
  | null



/** The handful of stats worth showing above the full list. */
/* ---------- the screen ---------- */

const EMPTY_AVATARS: Avatar[] = []
const EMPTY_POOL_NAMES: PoolDescription[] = []
const EMPTY_TLM_POOLS: TlmPool[] = []
const EMPTY_SHARD_POOLS: ShardPool[] = []

export default function Profile({ section = 'account' }: { section?: Section }) {
  const player = useGame((s) => s.player)!
  const account = useGame((s) => s.account)
  const session = useGame((s) => s.session)
  const disconnect = useGame((s) => s.disconnect)
  const navigate = useNavigate()

  /*
     The first tab of whichever half this is — unless the link asked for a
     particular one (`?tab=cpu`), which is how the briefing sends a player
     straight to the thing it is talking about.
  */
  const [params] = useSearchParams()
  const askedTab = () => {
    const asked = params.get('tab')
    return SECTION_TABS[section].find(([key]) => key === asked)?.[0] ?? SECTION_TABS[section][0][0]
  }
  const [tab, setTab] = useState<Tab>(askedTab)

  /*
     Both halves are the same component, so moving between them in the menu
     is a prop change rather than a mount — without this the Rewards page
     would open on whatever tab the Account page was left on, and one of the
     two would render nothing at all.
  */
  useEffect(() => {
    setTab(askedTab())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, params])
  const { busy: busyKey, error, run } = useAction()
  const busy = busyKey as Busy
  /* Which pool the running mine belongs to, so only its button spins. */
  /* The mine in progress, then what it paid: a toast, from the tap on. */
  const [mineToast, setMineToast] = useState<MineToastState | null>(null)
  const [minedPool, setMinedPool] = useState<string | null>(null)

  /*
     Five of the ten reads this screen made were config — the avatar
     definitions, the CPU rules, the reward-log rules, the pool names and the
     trial modifier. They are the same for every player and come from the
     store; what is left below is this wallet's own.
  */
  const avatars = useLazyConfig('avatars') ?? EMPTY_AVATARS
  const cpuCfg = useLazyConfig('cpu')
  const logCfg = useLazyConfig('rewardLog')
  const poolNames = useLazyConfig('poolNames') ?? EMPTY_POOL_NAMES
  const usersCfg = useLazyConfig('users')

  const own = useChainQuery(
    account && `profile:${account}`,
    async () => {
      const [u, ac, cap, tp, sp] = await Promise.all([
        fetchCpuUsage(account!, true),
        fetchAccountCpu(account!, true),
        fetchRewardLogCapacity(account!, true),
        fetchTlmPools(true),
        fetchShardPools(true),
      ])
      return { cpuUse: u, accountCpu: ac, logCap: cap, tlmPools: tp, shardPools: sp }
    },
    /* Mining and claiming both move what the pools owe this wallet. */
    { deps: ['rewardUsers'] },
  )
  const cpuUse = own.data?.cpuUse
  const accountCpu = own.data?.accountCpu
  const logCap = own.data?.logCap
  const tlmPools = own.data?.tlmPools ?? EMPTY_TLM_POOLS
  const shardPools = own.data?.shardPools ?? EMPTY_SHARD_POOLS
  /*
     The reward log is read one currency at a time, so it is cached per tab
     rather than fetched as one page — a mixed page would hide a quiet
     currency behind a noisy one.
   */
  const [logs, setLogs] = useState<Partial<Record<Currency, RewardLogEntry[]>>>({})

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /* What the actions re-read while they wait for the chain. */
  const load = own.reload

  /* One currency's ledger, fetched the first time its tab is opened. */
  const currencyTab = (CURRENCIES as readonly string[]).includes(tab)
    ? (tab as Currency)
    : null

  useEffect(() => {
    if (!account || !currencyTab || logs[currencyTab]) return
    let cancelled = false
    fetchRewardLog(account, currencyTab, 100, true)
      .then((rows) => {
        if (!cancelled) setLogs((prev) => ({ ...prev, [currencyTab]: rows }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [account, currencyTab, logs])

  /*
     Whichever dot the action just answered.

     Mining spends the banked reward power, which is what lights Rewards;
     claiming a CPU powerup spends the weekly allowance, which is what lights
     Account. One shared line used to say 'account' for both, so a mine
     refreshed the CPU dot and left the one it had actually changed to notice
     on its own. Naming it per action makes that impossible to get wrong.
  */
  const opts = (action: keyof typeof DIRTIES) => ({
    after: load,
    dirties: DIRTIES[action],
  })
  const mineOpts = opts('mineRewardPool')
  const cpuOpts = opts('claimCpu')

  const board = useMemo(() => avatarBoard(avatars, player), [avatars, player])

  /*
     A phone gets its own Rewards: one number first on every tab, the pools
     as rings, the payments folded by source, and the tool and landowner
     settings in sheets. Same data, same actions — only the layout differs.
  */
  const phone = usePhone()
  const phoneRewards = phone && section === 'rewards'
  /* A desktop's Rewards: the pools as the stage, under a page title of its own. */
  const deskRewards = !phone && section === 'rewards'
  const phoneAccount = phone && section === 'account'
  const leave = async () => {
    await disconnect()
    navigate('/', { replace: true })
  }
  const onMine = (pool: string, times: number) => {
    if (!currencyTab) return
    setMinedPool(pool)
    /*
       Made here rather than inside the action, because it is the key
       to `pools.ale` / `rwrdhistory` — the contract's own record of
       what this claim paid, and the only way to ask afterwards.
    */
    const historyId = randomHistoryId()
    const label =
      poolBoard(currencyTab, player, tlmPools, shardPools, poolNames).find((e) => e.pool === pool)
        ?.label ?? 'Reward pool'
    setMineToast({ label, times, rewards: null })
    /* Only a mine that went through has a receipt to wait for. */
    let mined = false
    void run(
      'mine',
      () => mineRewardPool(session!, pool, historyId, times),
      /* No banner: the toast says what the mine paid. */
      '',
      {
        ...mineOpts,
        onSettled: () => {
          mined = true
        },
      },
    ).then(async () => {
      setMinedPool(null)
      if (!mined) {
        setMineToast(null)
        return
      }
      /* The mine writes a ledger row, so drop the cached page. */
      setLogs((prev) => ({ ...prev, [currencyTab]: undefined }))
      /*
         And show what it paid. Read from the chain rather than taken
         from the bar: the pool moves between the two, so the figure
         beside the bar is a projection and this is not.
      */
      const rewards = await readMinedRewards(historyId)
      setMineToast((t) => (t ? { ...t, rewards } : t))
    })
  }
  /*
     Every ready mine in this currency, in one signature: the same action the
     victory screen sends, one `claimpreward` per mine under a shared receipt.
  */
  const onMineAll = (claims: string[], label: string) => {
    if (!currencyTab || claims.length === 0) return
    const historyId = randomHistoryId()
    setMineToast({ label, times: claims.length, rewards: null })
    let mined = false
    void run(
      'mine',
      () => claimPoolRewards(session!, claims, historyId),
      '',
      {
        ...opts('claimPoolRewards'),
        onSettled: () => {
          mined = true
        },
      },
    ).then(async () => {
      if (!mined) {
        setMineToast(null)
        return
      }
      setLogs((prev) => ({ ...prev, [currencyTab]: undefined }))
      const rewards = await readMinedRewards(historyId)
      setMineToast((t) => (t ? { ...t, rewards } : t))
    })
  }
  const onSaveTools = (ids: string[]) =>
    void run('mining', () => setMiningNfts(session!, ids), 'Mining settings saved !', opts('setMiningNfts'))
  const onShare = (share: number) =>
    void run('share', () => setLandownerShare(session!, share), 'Mining settings saved !', opts('setLandownerShare'))
  const onClaim = () =>
    void run('claim', () => claimCurrencies(session!), 'Rewards claimed.', opts('claimCurrencies'))
  const onUnlockRows = (rows: number) => {
    if (!currencyTab) return
    void run('rows', () => unlockRewardRows(session!, currencyTab, rows), 'History unlocked.', opts('unlockRewardRows'))
  }

  return (
    <div className="account">
      {deskRewards && (
        <header className="drew__head">
          <h1 className="drew__title">Rewards</h1>
        </header>
      )}

      {!phoneRewards && !deskRewards && !phoneAccount && (
      <header className="account__head">
        <span
          className="account__avatar"
          style={{
            backgroundImage: `url('${avatarArt(player.active_avatar)}'), url('${asset('/assets/avatar/unknown.webp')}')`,
          }}
          aria-hidden="true"
        />
        <div className="account__who">
          <h1 className="account__tag">{player.playertag}</h1>
          <p className="account__wallet mono">{player.wallet}</p>
          <p className="account__where">
            <span
              className="account__thumb"
              style={landThumbStyle(player.planet, player.x, player.y, 22)}
              aria-hidden="true"
            />
            <span style={{ textTransform: 'capitalize' }}>{player.planet}</span>{' '}
            <span className="mono">
              {player.x}:{player.y}
            </span>{' '}
            · <span className="mono">{landId(player.x, player.y)}</span>
          </p>
        </div>
      </header>
      )}

      {(error ?? own.error) && (
        <div className="alert alert--error">{error ?? own.error}</div>
      )}

      {/*
         The tabs, and the one control that is not a tab.

         Disconnecting used to be the last thing on the Stats tab, below a
         list of forty lifetime counters — somewhere you would only find it
         by scrolling past everything you were not looking for. It belongs
         on the line you already read to move around this screen, at the
         opposite end so it is never the thing a thumb reaches first.
      */}
      {!phoneRewards && !deskRewards && !phoneAccount && (
      <div className="accounthead">
      <div
        className="accounttabs"
        role="tablist"
        aria-label={section === 'rewards' ? 'Rewards' : 'Account'}
      >
        {SECTION_TABS[section].map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="accounttab"
            onClick={() => setTab(key)}
          >
            {label}
            {/* The same dot the menu shows, on the tab that answers it. */}
            {key === 'cpu' && cpuLow(accountCpu) && (
              <span
                className="accounttab__dot"
                title="Your CPU is running low"
                aria-label="Your CPU is running low"
              />
            )}
          </button>
        ))}
      </div>

      {section === 'account' && (
        <button
          type="button"
          className="btn btn--ghost accounthead__leave"
          title="Disconnect wallet"
          aria-label="Disconnect wallet"
          onClick={leave}
        >
          {/* The glyph carries it on a phone, where the words would push the
              tabs onto a line of their own. */}
          <svg className="accounthead__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <path d="M10 16l-4-4 4-4" />
            <path d="M6 12h10" />
          </svg>
          <span className="accounthead__word">Disconnect wallet</span>
        </button>
      )}
      </div>
      )}

      {phoneAccount && (
        <PhoneAccount
          tab={(['avatar', 'cpu', 'autosign', 'stats'].includes(tab) ? tab : 'avatar') as AccountTab}
          onTab={setTab}
          player={player}
          board={board}
          busy={busy}
          canAct={!!session}
          cpu={{ config: cpuCfg, usage: cpuUse, account: accountCpu }}
          onTag={(tag) =>
            void run('tag', () => setPlayertag(session!, tag), 'Gamertag saved.', opts('setPlayertag'))
          }
          onSelect={(id) =>
            void run('avatar', () => setAvatarId(session!, id), 'Avatar selected !', opts('setAvatarId'))
          }
          onUnlock={(ids) =>
            void run('unlock', () => unlockAvatars(session!, ids), 'Avatar unlocked !', opts('unlockAvatars'))
          }
          onClaimCpu={() => void run('cpu', () => claimCpu(session!), 'CPU claimed.', cpuOpts)}
          onDisconnect={() => void leave()}
        />
      )}

      {tab === 'avatar' && !phoneAccount && (
        <AvatarTab
          board={board}
          player={player}
          busy={busy}
          canAct={!!session}
          onTag={(tag) =>
            void run('tag', () => setPlayertag(session!, tag), 'Gamertag saved.', opts('setPlayertag'))
          }
          onSelect={(id) =>
            void run('avatar', () => setAvatarId(session!, id), 'Avatar selected !', opts('setAvatarId'))
          }
          onUnlock={(ids) =>
            void run('unlock', () => unlockAvatars(session!, ids), 'Avatar unlocked !', opts('unlockAvatars'))
          }
        />
      )}

      {(phoneRewards || deskRewards) && (
        <RewardsFor
          phone={phoneRewards}
          tab={tab === 'mining' || currencyTab ? (tab as 'mining' | Currency) : 'mining'}
          onTab={setTab}
          player={player}
          account={account ?? ''}
          busy={busy}
          canAct={!!session}
          onSaveTools={onSaveTools}
          onShare={onShare}
          mineReady={{
            tlm: poolBoard('tlm', player, tlmPools, shardPools, poolNames).some((e) => e.ready),
            shrds: poolBoard('shrds', player, tlmPools, shardPools, poolNames).some((e) => e.ready),
          }}
          currency={
            currencyTab
              ? {
                  currency: currencyTab,
                  log: logs[currencyTab],
                  capacity: logCapacity(currencyTab, logCap, logCfg),
                  board: poolBoard(currencyTab, player, tlmPools, shardPools, poolNames),
                  trial: trialPenalty(player.legend_access_expiry, usersCfg?.trial_rewpow_mod),
                  minedPool,
                  onMine,
                  onMineAll,
                  onClaim,
                  onUnlock: onUnlockRows,
                }
              : null
          }
        />
      )}

      {tab === 'cpu' && !phoneAccount && (
        <CpuTab
          player={player}
          config={cpuCfg}
          usage={cpuUse}
          accountCpu={accountCpu}
          busy={busy}
          canAct={!!session}
          onClaim={() =>
            void run('cpu', () => claimCpu(session!), 'CPU claimed.', cpuOpts)
          }
        />
      )}

      {tab === 'autosign' && !phoneAccount && <AutoSign />}

      {tab === 'stats' && !phoneAccount && <StatsTab player={player} />}

      {mineToast && (
        <MineToast
          state={mineToast}
          onClose={() => setMineToast(null)}
        />
      )}
    </div>
  )
}

/** The phone's Rewards or the desktop's: the same data and actions, laid out for the size. */
function RewardsFor({
  phone,
  ...props
}: { phone: boolean } & React.ComponentProps<typeof PhoneRewards>) {
  return phone ? <PhoneRewards {...props} /> : <DeskRewards {...props} />
}

/* ---------- avatar ---------- */

export function AvatarTab({
  board,
  player,
  busy,
  canAct,
  onTag,
  onSelect,
  onUnlock,
}: {
  board: AvatarEntry[]
  player: Player
  busy: Busy
  canAct: boolean
  onTag: (tag: string) => void
  onSelect: (id: number) => void
  onUnlock: (ids: number[]) => void
}) {
  const [tag, setTag] = useState(player.playertag)
  const problem = validateTag(tag)
  const changed = tag.trim() !== player.playertag
  const ready = claimableAvatars(board)

  return (
    <div className="stack">
      <section className="panel">
        <h2 className="panel__title">Gamertag</h2>
        <p className="hint">
          Four to {TAG_MAX} characters. It is what other players see on the
          leaderboards.
        </p>
        <div className="taginput">
          <input
            className="input"
            value={tag}
            maxLength={TAG_MAX}
            onChange={(e) => setTag(e.target.value)}
            disabled={!canAct || busy !== null}
            placeholder="Please set a gamertag."
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAct || busy !== null || !!problem || !changed}
            onClick={() => onTag(tag.trim())}
          >
            {busy === 'tag' && <span className="spinner" />}
            Save Settings
          </button>
        </div>
        {problem && changed && <p className="hint hint--error">{problem}</p>}
      </section>

      {/*
        Claiming is offered only for avatars already confirmed as earned. The
        contract skips the rest without saying anything, so sending them would
        buy a transaction that changes nothing.
      */}
      {ready.length > 0 && (
        <section className="panel">
          <div className="row">
            <div>
              <h2 className="panel__title">
                {ready.length} avatar{ready.length === 1 ? '' : 's'} earned
              </h2>
              <p className="hint">
                Unlocked avatars have to be claimed before they can be worn.
              </p>
            </div>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canAct || busy !== null}
              onClick={() => onUnlock(ready)}
            >
              {busy === 'unlock' && <span className="spinner" />}
              Unlock all
            </button>
          </div>
        </section>
      )}

      <div className="avatargrid">
        {board.map(({ avatar, state, have, need }) => (
          <article className={`avatarcard avatarcard--${state}`} key={avatar.avatar_id}>
            {/*
              The art keeps its own colours, locked or not — an avatar you are
              working towards is the reason to work towards it, and a grid of
              grey silhouettes sold none of them. What says "not yours yet" is
              the padlock over the corner, the cut border, and the bar
              underneath, none of which touch the picture.
            */}
            <div className="avatarcard__frame">
              <GameImg
                className="avatarcard__art"
                src={avatarArt(avatar.avatar_id)}
                alt=""
                loading="lazy"
                fallback={asset('/assets/avatar/unknown.webp')}
              />
              {state === 'locked' && (
                <span className="avatarcard__lock" title="Not earned yet">
                  <img
                    src={asset('/assets/icons/lock.svg')}
                    alt="Locked"
                    width={12}
                    height={12}
                  />
                </span>
              )}
            </div>
            <span className="avatarcard__cat">{avatar.avatar_category}</span>
            <span className="avatarcard__name">{avatar.avatar_name}</span>

            {state === 'locked' ? (
              /*
                 How far off it is, not just how far along. The numbers were
                 already here; the bar is what makes "a third of the way" a
                 glance rather than a division, and it is the same shape the
                 quest board uses for the same question.
              */
              <span className="avatarcard__need">
                <span
                  className="avatarcard__bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={need}
                  aria-valuenow={Math.min(have, need)}
                  aria-label={`${avatar.avatar_name}: ${formatNumber(have)} of ${formatNumber(need)}`}
                >
                  <span
                    className="avatarcard__fill"
                    style={{
                      width: `${need > 0 ? Math.min(100, (have / need) * 100) : 0}%`,
                    }}
                  />
                </span>
                {formatNumber(have)} / {formatNumber(need)}
              </span>
            ) : state === 'ready' ? (
              <span className="avatarcard__badge avatarcard__badge--ready">Earned</span>
            ) : state === 'active' ? (
              <span className="avatarcard__badge avatarcard__badge--active">Wearing</span>
            ) : (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!canAct || busy !== null}
                onClick={() => onSelect(Number(avatar.avatar_id))}
              >
                Wear
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
/* ---------- mining ---------- */

export function CpuTab({
  player,
  config,
  usage,
  accountCpu,
  busy,
  canAct,
  onClaim,
}: {
  player: Player
  config?: CpuConfig
  usage?: CpuUsage
  accountCpu?: AccountCpu
  busy: Busy
  canAct: boolean
  onClaim: () => void
}) {
  const status = cpuStatus(config, usage)
  const percent =
    status.allowance > 0 ? Math.min(100, (status.used / status.allowance) * 100) : 0

  const legend = hasLegendAccess(player.legend_access_expiry)
  const resetsAt = nextCpuReset(status.resetsAt)
  const untilReset = untilLabel(resetsAt - Date.now())

  /*
     The wallet's own CPU, which is what a powerup tops up. `current_used` is
     the decayed figure the chain actually bills against.
   */
  const cpuMax = Number(accountCpu?.max ?? 0)
  const cpuUsed = Number(accountCpu?.current_used ?? 0)
  const cpuPercent = cpuMax > 0 ? Math.min(100, (cpuUsed / cpuMax) * 100) : 0
  const cpuBand = cpuPercent > 90 ? 'low' : cpuPercent > 70 ? 'mid' : 'high'

  return (
    <div className="stack">
      <section className="panel">
        <div className="row row--wrap">
          <div className="miningintro">
            <h2 className="panel__title">Free CPU</h2>
          </div>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAct || busy !== null || status.left === 0 || !legend}
            onClick={onClaim}
          >
            {busy === 'cpu' && <span className="spinner" />}
            Claim CPU
          </button>
        </div>

        {/*
          `maxpowerup` returns without error for a lapsed player — it signs,
          succeeds, and sends nothing — so the button is disabled rather than
          left to fail quietly, and the line points at the fix.
        */}
        {!legend && (
          <p className="hint">
            Requires <Link to="/shop?c=account">Legend Access</Link>.
          </p>
        )}
        {legend && status.left === 0 && (
          <p className="hint">
            You have used all {formatNumber(status.allowance)} claims for this
            week. The next one is available in {untilReset}.
          </p>
        )}

        <div className="cpubar">
          <span
            className={`cpubar__fill${status.left === 0 ? ' cpubar__fill--out' : ''}`}
            style={{ width: `${percent}%` }}
          />
          <span className="cpubar__text">
            {formatNumber(status.used)} of {formatNumber(status.allowance)} claims used
          </span>
        </div>

        <div className="statline">
          <span className="statline__k">Claims left this week</span>
          <span className="statline__v mono">{formatNumber(status.left)}</span>
        </div>
        <div className="statline">
          <span className="statline__k">Resets in</span>
          <span className="statline__v">
            <strong className="mono">{untilReset}</strong>
            <em className="statline__note">
              {new Date(resetsAt).toLocaleString()}
            </em>
          </span>
        </div>
      </section>

      {/*
        The wallet's own CPU. A player out of claims and a player out of CPU
        have different problems, and without both on screen there is no way to
        tell which one you have.
      */}
      <section className="panel">
        <h2 className="panel__title">Your wallet's CPU</h2>
        {!accountCpu ? (
          <p className="muted">Reading your account…</p>
        ) : (
          <>
            <p className="hint">
              What the network gives your account to spend on transactions.
              A claim above tops this up; it refills on its own as well, over
              about a day.
            </p>

            <div className="cpubar" data-band={cpuBand}>
              <span
                className={`cpubar__fill${cpuBand === 'low' ? ' cpubar__fill--out' : ''}`}
                style={{ width: `${cpuPercent}%` }}
              />
              <span className="cpubar__text">
                {formatCpuTime(cpuUsed)} of {formatCpuTime(cpuMax)} used
              </span>
            </div>

            <div className="statline">
              <span className="statline__k">Available now</span>
              <span className="statline__v mono">
                {formatCpuTime(Math.max(0, cpuMax - cpuUsed))}
              </span>
            </div>
            <div className="statline">
              <span className="statline__k">Used</span>
              <span className="statline__v mono">{formatCpuTime(cpuUsed)}</span>
            </div>
            <div className="statline">
              <span className="statline__k">Total</span>
              <span className="statline__v mono">{formatCpuTime(cpuMax)}</span>
            </div>

            {cpuPercent > 90 && (
              <p className="hint hint--error">
                Almost none left. Transactions will start failing until this
                refills or you claim above.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}

/* ---------- stats ---------- */

export function StatsTab({ player }: { player: Player }) {
  const [showAll, setShowAll] = useState(false)
  /* Which stat's board is open, if any. */
  const [board, setBoard] = useState<string | null>(null)

  const stats = useMemo(() => kvToRecord(player.permstats), [player.permstats])
  const allStats = useMemo(
    () => Object.entries(stats).sort(([a], [b]) => a.localeCompare(b)),
    [stats],
  )


  return (
    <div className="stack">
      <section className="panel">
        <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
          <span className="panel__title">All stats</span>
          <span className="spacer" />
          <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
            {allStats.length} tracked
          </span>
        </div>

        {allStats.length === 0 ? (
          <p className="muted">Nothing recorded yet. Go do something.</p>
        ) : (
          <>
            {(showAll ? allStats : allStats.slice(0, 8)).map(([k, v]) => {
              const icon = statIconFor(k)
              return (
                /*
                  A button, not a row with a click handler: this opens a
                  dialog, so it has to be reachable and operable from the
                  keyboard like anything else that does.
                */
                <button
                  type="button"
                  className="statline statline--open"
                  key={k}
                  onClick={() => setBoard(k)}
                  title={`Where you stand on ${prettyStat(k).toLowerCase()}`}
                >
                  <span className="statline__k">
                    {icon ? (
                      <img className="statline__icon" src={asset(icon)} alt="" />
                    ) : (
                      /* Holds the column so unmatched rows still line up. */
                      <span className="statline__icon statline__icon--none" />
                    )}
                    {prettyStat(k)}
                  </span>
                  <span className="statline__v mono">{formatStat(k, Number(v))}</span>
                </button>
              )
            })}
            {allStats.length > 8 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--block"
                style={{ marginTop: 'var(--sp-3)' }}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Show less' : `Show all ${allStats.length}`}
              </button>
            )}
          </>
        )}
      </section>

      {board && (
        <StatBoard
          statKey={board}
          label={prettyStat(board)}
          icon={statIconFor(board)}
          wallet={player.wallet}
          onClose={() => setBoard(null)}
        />
      )}

    </div>
  )
}
