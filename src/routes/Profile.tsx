import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchShardPools,
  fetchTlmPools,
  type PoolDescription,
  type ShardPool,
  type TlmPool,
} from '@/pools/queries'
import { poolBoard, trialPenalty } from '@/pools/rules'
import { useGame } from '@/state/useGame'
import type { Avatar } from '@/chain/types'
import {
  fetchCpuUsage,
  fetchAccountCpu,
  fetchRewardLog,
  fetchRewardLogCapacity,
  type RewardLogEntry,
} from '@/account/queries'
import {
  avatarBoard,
  logCapacity,
  CURRENCIES,
  claimPays,
  CURRENCY_LABEL,
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
import { usePhone } from '@/components/usePhone'
import { PhoneRewards, unclaimed } from '@/rewards/PhoneRewards'
import { DeskRewards } from '@/rewards/DeskRewards'
import { PhoneAccount, type AccountTab } from '@/account/PhoneAccount'
import { DeskAccount } from '@/account/DeskAccount'

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
    opened.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, params])
  /* Set once Rewards has chosen where to open, or the player has picked a tab. */
  const opened = useRef(false)
  const pickTab = (next: Tab) => {
    opened.current = true
    setTab(next)
  }
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
     Rewards opens where there is something to do: the first of TLM, Shards
     and WAX with something to mine or to claim, and Mining only when none
     has. Decided once the pools are read — and never over a tab the link
     asked for, or one the player has already picked.
  */
  useEffect(() => {
    if (section !== 'rewards' || params.get('tab') || opened.current || !own.data) return
    opened.current = true
    const ready = (c: Currency) =>
      (c === 'tlm' || c === 'shrds') && poolBoard(c, player, tlmPools, shardPools, poolNames).some((e) => e.ready)
    const first = (['tlm', 'shrds', 'wax'] as Currency[]).find(
      (c) => ready(c) || (claimPays(c) && unclaimed(player, c) > 0),
    )
    if (first) setTab(first)
  }, [section, params, own.data, player, tlmPools, shardPools, poolNames])
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
  /* A desktop's Account: an identity card beside the tabs. */
  const deskAccount = !phone && section === 'account'
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
      {(deskRewards || deskAccount) && (
        <header className="drew__head">
          <h1 className="drew__title">{deskRewards ? 'Rewards' : 'Account'}</h1>
        </header>
      )}


      {(error ?? own.error) && (
        <div className="alert alert--error">{error ?? own.error}</div>
      )}

      {(phoneAccount || deskAccount) && (
        <AccountFor
          phone={phoneAccount}
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


      {(phoneRewards || deskRewards) && (
        <RewardsFor
          phone={phoneRewards}
          tab={tab === 'mining' || currencyTab ? (tab as 'mining' | Currency) : 'mining'}
          onTab={pickTab}
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

/** The phone's Account or the desktop's: the same data and actions, laid out for the size. */
function AccountFor({
  phone,
  ...props
}: { phone: boolean } & React.ComponentProps<typeof PhoneAccount>) {
  return phone ? <PhoneAccount {...props} /> : <DeskAccount {...props} />
}
