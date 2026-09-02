import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchPoolDescriptions,
  fetchShardPools,
  fetchTlmPools,
  fetchToolTemplates,
  fetchUsersConfig,
  type PoolDescription,
  type ShardPool,
  type TlmPool,
  type ToolTemplate,
  type UsersConfig,
} from '@/pools/queries'
import {
  poolAmount,
  poolBoard,
  trialPenalty,
  MINE_POWER,
  type PoolEntry,
} from '@/pools/rules'
import { useGame } from '@/state/useGame'
import { kvToRecord, type Avatar, type Player } from '@/chain/types'
import { landId } from '@/chain/landId'
import { landThumbStyle } from '@/map/terrain'
import { fetchAvatars } from '@/chain/queries'
import { fetchMiningTools, type MiningTool } from '@/chain/atomic'
import {
  fetchCpuConfig,
  fetchCpuUsage,
  fetchAccountCpu,
  fetchRewardLog,
  fetchRewardLogCapacity,
  fetchRewardLogConfig,
  type CpuConfig,
  type AccountCpu,
  type CpuUsage,
  type RewardLogEntry,
  type RewardLogCapacity,
  type RewardLogConfig,
} from '@/account/queries'
import {
  TAG_MAX,
  avatarArt,
  avatarBoard,
  claimableAvatars,
  cpuStatus,
  formatCpuTime,
  hasLegendAccess,
  nextCpuReset,
  untilLabel,
  validateTag,
  assetValue,
  bagPower,
  claimPays,
  logCapacity,
  type LogCapacity,
  powerBias,
  CURRENCIES,
  CURRENCY_ICON,
  CURRENCY_LABEL,
  CURRENCY_PRECISION,
  CURRENCY_UNCLAIMED,
  MINING_POWER,
  POWER_SORTS,
  powerScore,
  type PowerSort,
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
} from '@/wharf/actions'
import { refreshChore } from '@/chores/signal'
import { readableError } from '@/wharf/errors'
import { formatNumber, formatDecimals, NUM_LOCALE } from '@/format'
import { asset } from '@/assets'

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

type Tab = 'avatar' | 'mining' | 'cpu' | 'stats' | Currency
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

function prettyStat(key: string): string {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function since(iso: string): string {
  const then = Date.parse(iso + 'Z')
  if (!Number.isFinite(then)) return '—'
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** The handful of stats worth showing above the full list. */
const HIGHLIGHTS = [
  ['arenas_won', 'Arenas won'],
  ['dungeons_won', 'Dungeons won'],
  ['knockouts', 'Knockouts'],
  ['total_travel_distance', 'Distance travelled'],
  ['portals_used', 'Portals used'],
  ['shards_earned', 'Shards earned'],
] as const

/* ---------- the screen ---------- */

export default function Profile() {
  const player = useGame((s) => s.player)!
  const account = useGame((s) => s.account)
  const session = useGame((s) => s.session)
  const disconnect = useGame((s) => s.disconnect)
  const refreshPlayer = useGame((s) => s.refreshPlayer)
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('avatar')
  const [busy, setBusy] = useState<Busy>(null)
  /* Which pool the running mine belongs to, so only its button spins. */
  const [minedPool, setMinedPool] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [cpuCfg, setCpuCfg] = useState<CpuConfig>()
  const [cpuUse, setCpuUse] = useState<CpuUsage>()
  const [accountCpu, setAccountCpu] = useState<AccountCpu>()
  /*
     The reward log is read one currency at a time, so it is cached per tab
     rather than fetched as one page — a mixed page would hide a quiet
     currency behind a noisy one.
   */
  const [logs, setLogs] = useState<Partial<Record<Currency, RewardLogEntry[]>>>({})
  const [logCfg, setLogCfg] = useState<RewardLogConfig>()
  const [logCap, setLogCap] = useState<RewardLogCapacity>()

  /* The pools reward power is spent in, and the names the game gives them. */
  const [tlmPools, setTlmPools] = useState<TlmPool[]>([])
  const [shardPools, setShardPools] = useState<ShardPool[]>([])
  const [poolNames, setPoolNames] = useState<PoolDescription[]>([])
  const [usersCfg, setUsersCfg] = useState<UsersConfig>()

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!account) return
    try {
      const [a, c, u, ac, lc, cap, tp, sp, pd, uc] = await Promise.all([
        fetchAvatars(),
        fetchCpuConfig(),
        fetchCpuUsage(account, true),
        fetchAccountCpu(account, true),
        fetchRewardLogConfig(),
        fetchRewardLogCapacity(account, true),
        fetchTlmPools(true),
        fetchShardPools(true),
        fetchPoolDescriptions(),
        fetchUsersConfig(),
      ])
      if (!alive.current) return
      setAvatars(a)
      setCpuCfg(c)
      setCpuUse(u)
      setAccountCpu(ac)
      setLogCfg(lc)
      setLogCap(cap)
      setTlmPools(tp)
      setShardPools(sp)
      setPoolNames(pd)
      setUsersCfg(uc)
    } catch (err) {
      if (alive.current) setError(readableError(err))
    }
  }, [account])

  useEffect(() => {
    void load()
  }, [load])

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

  const run = useCallback(
    async (mark: Busy, act: () => Promise<unknown>, done: string) => {
      if (!session) return
      setBusy(mark)
      setError(null)
      setNotice(null)
      try {
        await act()
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 900))
          await Promise.all([refreshPlayer({ force: true }), load()])
        }
        /* Mining spends the banked reward power. */
        refreshChore('account')
        setNotice(done)
      } catch (err) {
        setError(readableError(err))
      } finally {
        setBusy(null)
      }
    },
    [session, refreshPlayer, load],
  )

  const board = useMemo(() => avatarBoard(avatars, player), [avatars, player])

  return (
    <div className="account">
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

      {notice && <div className="alert alert--ok">{notice}</div>}
      {error && <div className="alert alert--error">{error}</div>}

      <div className="accounttabs" role="tablist" aria-label="Account">
        {(
          [
            ['avatar', 'Avatar'],
            ['mining', 'Mining'],
            ['cpu', 'CPU'],
            ['tlm', CURRENCY_LABEL.tlm],
            ['wax', CURRENCY_LABEL.wax],
            ['shrds', CURRENCY_LABEL.shrds],
            ['stats', 'Stats'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="accounttab"
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'avatar' && (
        <AvatarTab
          board={board}
          player={player}
          busy={busy}
          canAct={!!session}
          onTag={(tag) =>
            void run('tag', () => setPlayertag(session!, tag), 'Gamertag saved.')
          }
          onSelect={(id) =>
            void run('avatar', () => setAvatarId(session!, id), 'Avatar selected !')
          }
          onUnlock={(ids) =>
            void run('unlock', () => unlockAvatars(session!, ids), 'Avatar unlocked !')
          }
        />
      )}

      {tab === 'mining' && (
        <MiningTab
          account={account ?? ''}
          player={player}
          busy={busy}
          canAct={!!session}
          onSave={(ids) =>
            void run(
              'mining',
              () => setMiningNfts(session!, ids),
              'Mining settings saved !',
            )
          }
          onShare={(share) =>
            void run(
              'share',
              () => setLandownerShare(session!, share),
              'Mining settings saved !',
            )
          }
        />
      )}

      {tab === 'cpu' && (
        <CpuTab
          player={player}
          config={cpuCfg}
          usage={cpuUse}
          accountCpu={accountCpu}
          busy={busy}
          canAct={!!session}
          onClaim={() =>
            void run('cpu', () => claimCpu(session!), 'CPU claimed.')
          }
        />
      )}

      {currencyTab && (
        <CurrencyTab
          currency={currencyTab}
          player={player}
          log={logs[currencyTab]}
          capacity={logCapacity(currencyTab, logCap, logCfg)}
          busy={busy}
          canAct={!!session}
          onClaim={() =>
            void run('claim', () => claimCurrencies(session!), 'Rewards claimed.')
          }
          onUnlock={(rows) =>
            void run(
              'rows',
              () => unlockRewardRows(session!, currencyTab, rows),
              'History unlocked.',
            )
          }
          board={poolBoard(
            currencyTab,
            player,
            tlmPools,
            shardPools,
            poolNames,
          )}
          trial={trialPenalty(player.legend_access_expiry, usersCfg?.trial_rewpow_mod)}
          minedPool={minedPool}
          onMine={(pool) => {
            setMinedPool(pool)
            void run('mine', () => mineRewardPool(session!, pool), 'Mined.').then(
              () => {
                /* The mine writes a ledger row, so drop the cached page. */
                setLogs((prev) => ({ ...prev, [currencyTab]: undefined }))
                setMinedPool(null)
              },
            )
          }}
        />
      )}

      {tab === 'stats' && (
        <StatsTab
          player={player}
          onDisconnect={async () => {
            await disconnect()
            navigate('/', { replace: true })
          }}
        />
      )}
    </div>
  )
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
            <img
              className="avatarcard__art"
              src={avatarArt(avatar.avatar_id)}
              alt=""
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget
                if (img.dataset.fallback) return
                img.dataset.fallback = '1'
                img.src = asset('/assets/avatar/unknown.webp')
              }}
            />
            <span className="avatarcard__cat">{avatar.avatar_category}</span>
            <span className="avatarcard__name">{avatar.avatar_name}</span>

            {state === 'locked' ? (
              <span className="avatarcard__need">
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

export function MiningTab({
  account,
  player,
  busy,
  canAct,
  onSave,
  onShare,
}: {
  account: string
  player: Player
  busy: Busy
  canAct: boolean
  onSave: (ids: string[]) => void
  onShare: (share: number) => void
}) {
  const [tools, setTools] = useState<MiningTool[]>([])
  const [templates, setTemplates] = useState<ToolTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<string[]>(
    () => (player.mine_nfts ?? []).map(String),
  )
  const [share, setShare] = useState(Number(player.landowner_tlm_share ?? 0))
  const [sort, setSort] = useState<PowerSort>('combined')

  useEffect(() => {
    let cancelled = false
    if (!account) return
    setLoading(true)
    Promise.all([fetchMiningTools(account), fetchToolTemplates()])
      .then(([rows, temps]) => {
        if (cancelled) return
        setTools(rows)
        setTemplates(temps)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [account])

  /*
     Mining power lives on the template, not the asset — the contract looks it
     up by `template_id` and never reads the NFT's own stats — so every tool
     is joined to `templatemp` before anything is shown, sorted or summed.
   */
  const powerOf = useMemo(() => {
    const byTemplate = new Map(templates.map((t) => [t.template_id, t]))
    return (templateId: number) => byTemplate.get(templateId)
  }, [templates])

  const stored = useMemo(
    () => (player.mine_nfts ?? []).map(String),
    [player.mine_nfts],
  )
  const storedKey = stored.join(',')

  /*
     Re-seed when the chain's list actually changes — after a save, or after
     `mineland` pruned tools the player no longer owns. Keyed on the contents
     rather than the array, so an unrelated player refresh does not throw away
     a selection in progress.
   */
  useEffect(() => {
    setPicked(storedKey ? storedKey.split(',') : [])
  }, [storedKey])

  /*
     Picks the wallet cannot back.

     `setminenfts` looks every id up in the player's own AtomicAssets rows and
     dereferences the result without checking it found anything, so a single
     id they no longer hold aborts the whole transaction. Such a tool has no
     card to render either — it arrives in `mine_nfts` from the chain but is
     absent from the wallet — so it was an invisible pick that silently broke
     Save. Only judged once the wallet has actually loaded; before that,
     everything would look missing.
   */
  const missing = useMemo(() => {
    if (loading || !tools.length) return []
    const held = new Set(tools.map((t) => t.asset_id))
    return picked.filter((id) => !held.has(id))
  }, [loading, tools, picked])

  /*
     What Save actually sends: the visible selection, deduplicated. The
     contract rejects duplicates outright ("duplicate NFT ids found"), and the
     transaction should never disagree with the cards on screen.
   */
  const sendable = useMemo(
    () => [...new Set(picked.filter((id) => !missing.includes(id)))],
    [picked, missing],
  )

  /*
     A pick only takes effect once `setminenfts` has run, and nothing else on
     the card says so — a player could equip three tools, navigate away and
     mine with the old bag none the wiser.
   */
  const unsaved = (id: string) => picked.includes(id) !== stored.includes(id)
  const changed =
    sendable.length !== stored.length || sendable.some((id) => !stored.includes(id))
  const shareChanged = share !== Number(player.landowner_tlm_share ?? 0)

  /*
     Strongest first. Which "strongest" depends on what the player is building
     for — a bag for Trilium and a bag for shards rank the same tools
     differently — so the ordering is theirs to choose. Without it a wallet of
     dozens of tools sits in whatever order AtomicAssets returned.
   */
  const byPower = useMemo(
    () => (a: MiningTool, b: MiningTool) =>
      powerScore(sort, powerOf(b.template_id)) -
      powerScore(sort, powerOf(a.template_id)),
    [powerOf, sort],
  )

  const equipped = useMemo(
    () => tools.filter((t) => picked.includes(t.asset_id)).sort(byPower),
    [tools, picked, byPower],
  )
  const spare = useMemo(
    () => tools.filter((t) => !picked.includes(t.asset_id)).sort(byPower),
    [tools, picked, byPower],
  )
  const bag = useMemo(
    () => bagPower(equipped.map((t) => powerOf(t.template_id) ?? {})),
    [equipped, powerOf],
  )

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <div className="stack">
      <section className="panel">
        {/*
          Title, totals and the save button share one line. The totals are two
          short numbers; given a row of their own they stretched across the
          whole panel and pushed everything below the fold for no gain.
        */}
        <div className="row row--wrap">
          <div className="miningintro">
            <h2 className="panel__title">Mining Tools</h2>
            <p className="hint">
              Mining adds the power of every equipped tool together. The tools
              stay in your wallet — the game only records which you picked.
            </p>
          </div>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAct || busy !== null || !changed}
            onClick={() => onSave(sendable)}
          >
            {busy === 'mining' && <span className="spinner" />}
            Save Settings
          </button>
        </div>

        {/*
          The equipped bag sits under its own totals rather than in a panel of
          its own: with one or two tools picked, the separate panel was mostly
          empty, and the numbers above are a sum of exactly these cards.
        */}
        <div className="row row--wrap subhead">
          <h3 className="panel__sub">Currently equipped ({equipped.length})</h3>

          {/* The sum of exactly the cards below, so it sits with them. */}
          <dl className="bagtotals" title="The bag's combined mining power">
            <dt>Total Minepower</dt>
            {MINING_POWER.map((m) => (
              <dd key={m.key} className="mpchip" title={m.hint}>
                <img src={m.icon} alt={m.label} width={18} height={18} />
                {formatNumber(bag[m.key])}
              </dd>
            ))}
          </dl>
        </div>

        {/*
          Worth saying out loud rather than quietly correcting. The player
          equipped these, the wallet no longer holds them, and Save is about
          to leave them behind — and until now they were an invisible pick
          that aborted the whole transaction.
        */}
        {missing.length > 0 && (
          <p className="hint hint--error">
            {missing.length === 1
              ? 'One equipped tool is no longer in this wallet, so it has'
              : `${formatNumber(missing.length)} equipped tools are no longer in this wallet, so they have`}{' '}
            been left out of the selection. Saving drops{' '}
            {missing.length === 1 ? 'it' : 'them'} on chain too.
          </p>
        )}

        {loading ? (
          <div className="toolgrid">
            {Array.from({ length: 3 }, (_, i) => (
              <div className="toolcard toolcard--loading" key={i} />
            ))}
          </div>
        ) : equipped.length === 0 ? (
          <p className="muted">
            Nothing equipped. Pick tools below and save to mine with them.
          </p>
        ) : (
          <div className="toolgrid">
            {equipped.map((t) => (
              <ToolCard
                key={t.asset_id}
                tool={t}
                power={powerOf(t.template_id)}
                picked
                unsaved={unsaved(t.asset_id)}
                disabled={!canAct || busy !== null}
                onClick={() => toggle(t.asset_id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="row row--wrap subhead subhead--top">
          <h3 className="panel__title">Available in your wallet ({spare.length})</h3>
          <span className="spacer" />
          {/*
            The sort lives here rather than with the equipped bag: that list
            is two or three cards, this one can be dozens, and this is where a
            player is actually comparing tools.
          */}
          <span className="sortby">Sort by</span>
          <PowerSortButtons value={sort} onChange={setSort} />
        </div>
        {loading ? (
          <div className="toolgrid toolgrid--fill">
            {Array.from({ length: 6 }, (_, i) => (
              <div className="toolcard toolcard--loading" key={i} />
            ))}
          </div>
        ) : spare.length === 0 ? (
          <p className="muted">No other Alien Worlds tools in this wallet.</p>
        ) : (
          <div className="toolgrid toolgrid--fill">
            {spare.map((t) => (
              <ToolCard
                key={t.asset_id}
                tool={t}
                power={powerOf(t.template_id)}
                picked={false}
                unsaved={unsaved(t.asset_id)}
                disabled={!canAct || busy !== null}
                onClick={() => toggle(t.asset_id)}
              />
            ))}
          </div>
        )}
      </section>

      <ToolCatalogue templates={templates} owned={tools} loading={loading} />

      {/*
        This setting belongs to the landowner, not the miner. `pools.cpp` looks
        up whoever owns the land a mine happened on, reads *their*
        `landowner_tlm_share`, and splits the mining power they earn between
        the TLM pools and the shard pools — `shard_share = 100 - tlm_share`.
        It changes nothing for a player who owns no land, so the panel says so
        rather than implying a cost.
      */}
      <section className="panel">
        <h2 className="panel__title">Landowner Rewards</h2>
        <p className="hint">
          When other players mine on land you own, you earn a cut. This decides
          whether that cut arrives as Trilium or as Shards. It only applies to
          land you own — it takes nothing from your own mining.
        </p>

        <div className="splitbar">
          <span className="splitbar__tlm" style={{ width: `${share}%` }} />
          <span className="splitbar__shards" style={{ width: `${100 - share}%` }} />
        </div>
        <div className="splitlabels">
          <span>
            <img src={asset("/assets/icons/tlm.svg")} alt="" width={14} height={14} />
            {share}% TLM
          </span>
          <span>
            {100 - share}% Shards
            <img src={asset("/assets/icons/shards.svg")} alt="" width={14} height={14} />
          </span>
        </div>

        <div className="sharerow">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={share}
            onChange={(e) => setShare(Number(e.target.value))}
            disabled={!canAct || busy !== null}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAct || busy !== null || !shareChanged}
            onClick={() => onShare(share)}
          >
            {busy === 'share' && <span className="spinner" />}
            Save Settings
          </button>
        </div>
      </section>
    </div>
  )
}

export function ToolCard({
  tool,
  power,
  picked,
  unsaved = false,
  disabled,
  onClick,
}: {
  tool: MiningTool
  /** From `templatemp`; absent only if the template is not registered yet. */
  power: ToolTemplate | undefined
  picked: boolean
  /** Picked or dropped since the last save, so the chain does not know yet. */
  unsaved?: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={
        'toolcard' +
        (picked ? ' toolcard--picked' : '') +
        (unsaved ? ' toolcard--unsaved' : '')
      }
      aria-pressed={picked}
      disabled={disabled}
      onClick={onClick}
    >
      <img
        className="toolcard__art"
        src={asset(`/assets/cards/${tool.template_id}.webp`)}
        alt=""
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget
          if (img.dataset.fallback) return
          img.dataset.fallback = '1'
          img.src = asset('/assets/default-card.png')
        }}
      />
      <span className="toolcard__body">
        <span className="toolcard__name">
          {tool.name}
          {unsaved && <em className="toolcard__flag">Unsaved</em>}
        </span>
        <span className={`toolcard__rarity r-${tool.rarity.toLowerCase()}`}>
          {tool.shine === 'Stone' ? tool.rarity : `${tool.rarity} · ${tool.shine}`}
          {tool.type && ` · ${tool.type}`}
        </span>
        <span className="toolstats">
          {MINING_POWER.map((m) => (
            <span className="toolstat" key={m.key} title={`${m.label} — ${m.hint}`}>
              <img src={m.icon} alt={m.label} width={13} height={13} />
              {power ? formatNumber(power[m.key]) : '—'}
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}

/** The three orderings, as one control so both lists offer the same set. */
function PowerSortButtons({
  value,
  onChange,
}: {
  value: PowerSort
  onChange: (next: PowerSort) => void
}) {
  return (
    <>
      {POWER_SORTS.map((s) => (
        <button
          type="button"
          key={s.key}
          className={`btn btn--sm ${value === s.key ? 'btn--primary' : 'btn--ghost'}`}
          aria-pressed={value === s.key}
          onClick={() => onChange(s.key)}
        >
          {s.label}
        </button>
      ))}
    </>
  )
}

/* ---------- the tool catalogue ---------- */

type CatalogueSort = PowerSort | 'toolname'

/**
 * Every tool in the game, whether or not the player owns one.
 *
 * `templatemp` holds the mining power of all 150-odd templates, so a player
 * can see what a tool would be worth before going to the market for it —
 * which is the question the equipped list cannot answer. Owned templates are
 * marked rather than filtered, so the list doubles as a comparison against
 * what is already in the bag.
 */
function ToolCatalogue({
  templates,
  owned,
  loading,
}: {
  templates: ToolTemplate[]
  owned: MiningTool[]
  loading: boolean
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<CatalogueSort>('combined')
  const [mineOnly, setMineOnly] = useState(false)

  /* How many of each template sit in the wallet. */
  const held = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of owned) map.set(t.template_id, (map.get(t.template_id) ?? 0) + 1)
    return map
  }, [owned])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = templates.filter((t) => {
      if (mineOnly && !held.has(t.template_id)) return false
      if (!needle) return true
      return (
        t.toolname.toLowerCase().includes(needle) ||
        t.rarity.toLowerCase().includes(needle) ||
        t.shine.toLowerCase().includes(needle) ||
        String(t.template_id) === needle
      )
    })
    return list.sort((a, b) =>
      sort === 'toolname'
        ? a.toolname.localeCompare(b.toolname)
        : powerScore(sort, b) - powerScore(sort, a),
    )
  }, [templates, query, sort, mineOnly, held])

  /* The best in the game, so a row can be read against something. */
  const peak = useMemo(
    () => ({
      tlm_mp: Math.max(1, ...templates.map((t) => Number(t.tlm_mp))),
      shrd_mp: Math.max(1, ...templates.map((t) => Number(t.shrd_mp))),
    }),
    [templates],
  )

  return (
    <section className="panel">
      <div className="row row--wrap">
        <div>
          <h2 className="panel__title">Every Tool</h2>
          <p className="hint">
            The mining power of every tool in the game, from{' '}
            <span className="mono">templatemp</span> — including ones you do
            not own, so you can see what a tool is worth before buying it.
          </p>
        </div>
      </div>

      <div className="cataloguebar">
        <input
          type="search"
          className="input"
          placeholder="Search by name, rarity or template id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="cataloguebar__sorts">
          <PowerSortButtons
            value={sort === 'toolname' ? 'combined' : sort}
            onChange={setSort}
          />
          <button
            type="button"
            className={`btn btn--sm ${sort === 'toolname' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setSort('toolname')}
          >
            Name
          </button>
          <button
            type="button"
            className={`btn btn--sm ${mineOnly ? 'btn--primary' : 'btn--ghost'}`}
            aria-pressed={mineOnly}
            onClick={() => setMineOnly((v) => !v)}
          >
            Mine only
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No tool matches that.</p>
      ) : (
        <>
          <div className="catalogue">
            <div className="catalogue__head">
              <span>Tool</span>
              {MINING_POWER.map((m) => (
                <span key={m.key} title={m.hint}>
                  <img src={m.icon} alt="" width={12} height={12} />
                  {m.label}
                </span>
              ))}
              <span>Leans</span>
            </div>
            {rows.map((t) => {
              const count = held.get(t.template_id) ?? 0
              const bias = powerBias(t)
              return (
                <div
                  className={`catalogue__row${count ? ' is-owned' : ''}`}
                  key={t.template_id}
                  title={`Template ${t.template_id} — ${t.rarity} ${t.shine}`}
                >
                  <span className="catalogue__name">
                    <strong>{t.toolname}</strong>
                    <em>
                      {t.rarity} · {t.shine}
                      {count > 0 && ` · you own ${count}`}
                    </em>
                  </span>
                  <span className="catalogue__mp">
                    <b>{formatNumber(t.tlm_mp)}</b>
                    <span className="catalogue__meter">
                      <i style={{ width: `${(t.tlm_mp / peak.tlm_mp) * 100}%` }} />
                    </span>
                  </span>
                  <span className="catalogue__mp">
                    <b>{formatNumber(t.shrd_mp)}</b>
                    <span className="catalogue__meter catalogue__meter--shard">
                      <i style={{ width: `${(t.shrd_mp / peak.shrd_mp) * 100}%` }} />
                    </span>
                  </span>
                  {/*
                    A tool's two powers come from its ease and its luck, so it
                    always leans one way. Worth seeing at a glance when picking
                    a bag for Trilium or for shards.
                  */}
                  <span className="catalogue__bias" aria-hidden="true">
                    <i style={{ width: `${bias * 100}%` }} />
                  </span>
                </div>
              )
            })}
          </div>
          <p className="hint">
            Showing {formatNumber(rows.length)} of {formatNumber(templates.length)} tools.
          </p>
        </>
      )}
    </section>
  )
}

/* ---------- currencies ---------- */

/**
 * One token's ledger.
 *
 * The unclaimed balance is almost always zero — nearly everything the game
 * pays goes straight out — so the ledger is the point of the tab: it is the
 * only place that says *where* a payment came from, in the contract's own
 * words.
 */
export function CurrencyTab({
  currency,
  player,
  log,
  capacity,
  busy,
  canAct,
  onClaim,
  onUnlock,
  board,
  trial,
  minedPool,
  onMine,
}: {
  currency: Currency
  player: Player
  /** Undefined until this currency's ledger has been read. */
  log: RewardLogEntry[] | undefined
  capacity: LogCapacity
  busy: Busy
  canAct: boolean
  onClaim: () => void
  onUnlock: (rows: number) => void
  /** The pools this currency's reward power can be spent in. */
  board: PoolEntry[]
  /** The share of reward power a trial account banks, or null on Legend. */
  trial: number | null
  minedPool: string | null
  onMine: (pool: string) => void
}) {
  const places = CURRENCY_PRECISION[currency]
  const raw = Number(
    (player.activestats as unknown as Record<string, number>)[
      CURRENCY_UNCLAIMED[currency]
    ] ?? 0,
  )
  const pending = raw / Math.pow(10, places)
  const rows = log ?? []
  const total = rows.reduce((sum, r) => sum + assetValue(r.reward), 0)
  const pays = claimPays(currency)

  return (
    <div className="stack">
      <section className="panel">
        <div className="row row--wrap">
          <img src={CURRENCY_ICON[currency]} alt="" width={32} height={32} />
          <div>
            <h2 className="panel__title">{CURRENCY_LABEL[currency]}</h2>
            <p className="hint">
              {rows.length === 0
                ? 'No payments on record.'
                : `${formatDecimals(total, places)} across the ${
                    rows.length === 1 ? 'one payment' : `${rows.length} payments`
                  } below.`}
            </p>
          </div>
          <span className="spacer" />
          <div className="pending">
            <span>Waiting</span>
            <strong>{formatDecimals(pending, places)}</strong>
          </div>
          {pays && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canAct || busy !== null || pending <= 0}
              onClick={onClaim}
            >
              {busy === 'claim' && <span className="spinner" />}
              Claim
            </button>
          )}
        </div>

        {/*
          `claimcur` transfers TLM but zeroes unclaimed shards and WAX without
          sending them. Both are paid out directly in practice and sit at zero
          — but offering a claim button that destroys a balance would be worse
          than offering none.
        */}
        {!pays && pending > 0 && (
          <p className="hint hint--error">
            The game holds {formatDecimals(pending, places)}{' '}
            {CURRENCY_LABEL[currency]} against your account, but the claim
            action clears this figure without paying it out. Nothing here can
            release it.
          </p>
        )}
      </section>

      {board.length > 0 && (
        <section className="panel">
          <div className="row">
            <h2 className="panel__title">Reward Pools</h2>
          </div>
          {/*
            The pool balance is the headline, not the power. A mine takes
            `balance * power / 1,000,000` — one percent at a full 10,000 —
            from a shared figure every other player is also drawing on, so the
            same power is worth several times more against a full pool. Both
            numbers sit on the row for that reason.
          */}
          <p className="hint">
            Playing the game banks Reward Power in each pool. Spending it takes
            a slice of what that pool is holding — one percent at a full{' '}
            {formatNumber(MINE_POWER)} — so the pool's size decides what your
            power is worth.
          </p>

          {trial !== null && (
            <p className="hint hint--error">
              Your Legend access has lapsed, so you are banking{' '}
              {Math.round(trial * 100)}% of the Reward Power you earn.
            </p>
          )}

          <div className="poollist">
            {board.map((entry) => (
              <PoolRow
                key={entry.pool}
                entry={entry}
                places={places}
                symbol={CURRENCY_LABEL[currency]}
                busy={busy === 'mine' && minedPool === entry.pool}
                disabled={!canAct || busy !== null || !entry.ready}
                onMine={() => onMine(entry.pool)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="row">
          <h3 className="panel__title">Payments</h3>
          <span className="spacer" />
          {capacity.unlocked > 0 && (
            <span className="rowcount">
              {formatNumber(capacity.used)} / {formatNumber(capacity.unlocked)} kept
            </span>
          )}
        </div>

        {/*
          The history is rented storage, not a record of what happened.
          `addhistory` writes nothing at all for a currency with no rows
          unlocked, and drops the oldest row once the rows are full — so an
          empty ledger has to say which of the two it is, or a player reads it
          as never having earned anything.
        */}
        {capacity.unlocked === 0 ? (
          <p className="muted">
            {CURRENCY_LABEL[currency]} payments are not being recorded. Unlock
            history rows and everything you earn from here on is listed —
            earlier payments are gone, as the game only kept what was unlocked
            at the time.
          </p>
        ) : log === undefined ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">
            Nothing recorded yet. The next {CURRENCY_LABEL[currency]} you earn
            appears here.
          </p>
        ) : (
          <>
            {capacity.used >= capacity.unlocked && (
              <p className="hint">
                These rows are full, so each new payment now pushes out the
                oldest one.
              </p>
            )}
            <div className="ledger">
              {rows.map((r) => (
                <div className="ledger__row" key={r.index}>
                  <span className="ledger__what">
                    <strong>{r.pool_description || r.pool}</strong>
                    <em>{r.pool}</em>
                  </span>
                  <span className="ledger__when">
                    {new Date(Date.parse(r.timestamp + 'Z')).toLocaleString()}
                  </span>
                  <span className="ledger__amount">{r.reward}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {!capacity.atMax && (
          <div className="unlockrow">
            <span>
              {formatNumber(capacity.step)} more rows ·{' '}
              <img src={asset("/assets/icons/gems.png")} alt="" width={13} height={13} />
              {formatNumber(capacity.price)} gems
            </span>
            <span className="spacer" />
            <button
              type="button"
              className="btn"
              disabled={!canAct || busy !== null}
              onClick={() => onUnlock(capacity.step)}
            >
              {busy === 'rows' && <span className="spinner" />}
              {capacity.unlocked === 0 ? 'Start recording' : 'Keep more'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * One pool: what it holds, how close the power is to a mine, and the button.
 *
 * The bar is the power towards a full mine, not the pool's balance — the
 * balance has no ceiling to measure against, and the threshold is the thing
 * the button waits on.
 */
export function PoolRow({
  entry,
  places,
  symbol,
  busy,
  disabled,
  onMine,
}: {
  entry: PoolEntry
  places: number
  symbol: string
  busy: boolean
  disabled: boolean
  onMine: () => void
}) {
  /* Whole units: the fractional tail on a pool balance is pure noise. */
  const payout = poolAmount(entry.payout, places)
  const balance = poolAmount(entry.balance, places)

  return (
    <div className={`poolrow${entry.ready ? ' poolrow--ready' : ''}`}>
      <div className="poolrow__head">
        <div>
          <strong>{entry.label}</strong>
          <em>{entry.pool}</em>
        </div>
        <span className="spacer" />
        <div className="poolrow__held">
          <span>In the pool</span>
          <strong>
            {balance} {symbol}
          </strong>
        </div>
      </div>

      <div className="poolbar">
        <span style={{ width: `${Math.round(entry.progress * 100)}%` }} />
      </div>

      {/*
        Where the power comes from. The bar sits at zero until a player has
        earned some, and without this the panel says what they have but never
        how to get more.
      */}
      {entry.how && <p className="poolrow__how">{entry.how}</p>}

      <div className="poolrow__foot">
        <span className="poolrow__power">
          {entry.anyAmount
            ? `${formatNumber(entry.power)} power · no minimum`
            : `${formatNumber(entry.power)} / ${formatNumber(MINE_POWER)} power`}
          {/*
            Power keeps accruing past the threshold and a mine spends only
            10,000 of it, so more than one banked mine is worth saying — it is
            the difference between coming back later and coming back at once.
          */}
          {entry.mines > 1 && ` · ${formatNumber(entry.mines)} mines banked`}
        </span>
        <span className="spacer" />
        {entry.ready ? (
          <span className="poolrow__payout">
            +{payout} {symbol}
          </span>
        ) : (
          <span className="poolrow__short">
            {entry.anyAmount
              ? 'No power banked'
              : `${formatNumber(MINE_POWER - entry.power)} more to mine`}
          </span>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={disabled}
          onClick={onMine}
        >
          {busy && <span className="spinner" />}
          Mine
        </button>
      </div>
    </div>
  )
}

/* ---------- cpu ---------- */

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
            <p className="hint">
              The game buys network CPU for you out of its own funds —{' '}
              {formatDecimals(status.waxPerClaim, 4)} WAX a time, up to{' '}
              {formatNumber(status.allowance)} times a week.
            </p>
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

export function StatsTab({
  player,
  onDisconnect,
}: {
  player: Player
  onDisconnect: () => void | Promise<void>
}) {
  const [showAll, setShowAll] = useState(false)
  const [lowFx, setLowFx] = useState(
    () =>
      typeof document !== 'undefined' && document.documentElement.dataset.fx === 'low',
  )

  const stats = useMemo(() => kvToRecord(player.permstats), [player.permstats])
  const allStats = useMemo(
    () => Object.entries(stats).sort(([a], [b]) => a.localeCompare(b)),
    [stats],
  )

  const toggleFx = () => {
    const next = !lowFx
    setLowFx(next)
    document.documentElement.dataset.fx = next ? 'low' : 'full'
    localStorage.setItem('al:fx', next ? 'low' : 'full')
  }

  return (
    <div className="stack">
      <div className="account__grid">
        <section className="panel">
          <div className="panel__title" style={{ marginBottom: 'var(--sp-3)' }}>
            Record
          </div>
          {HIGHLIGHTS.map(([key, label]) => (
            <div className="statline" key={key}>
              <span className="statline__k">{label}</span>
              <span className="statline__v mono">
                {Number(stats[key] ?? 0).toLocaleString(NUM_LOCALE)}
              </span>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel__title" style={{ marginBottom: 'var(--sp-3)' }}>
            Status
          </div>
          <div className="statline">
            <span className="statline__k">Last action</span>
            <span className="statline__v">{since(player.last_action)}</span>
          </div>
          <div className="statline">
            <span className="statline__k">Signed up</span>
            <span className="statline__v">{player.signup_date.slice(0, 10)}</span>
          </div>
          <div className="statline">
            <span className="statline__k">Active taverns</span>
            <span className="statline__v mono">{player.active_taverns.length}</span>
          </div>
          <div className="statline">
            <span className="statline__k">Mining NFTs</span>
            <span className="statline__v mono">{player.mine_nfts.length}</span>
          </div>
          <div className="statline">
            <span className="statline__k">Landowner TLM share</span>
            <span className="statline__v mono">{player.landowner_tlm_share}%</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel__title" style={{ marginBottom: 'var(--sp-3)' }}>
            Display
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 'var(--fw-medium)' }}>Reduced effects</div>
              <p className="hint" style={{ marginTop: 2 }}>
                Turns off the background art, glows and the high-DPI map buffer.
                Worth it on an older phone.
              </p>
            </div>
            <span className="spacer" />
            <button
              type="button"
              className={`btn btn--sm ${lowFx ? 'btn--primary' : 'btn--ghost'}`}
              onClick={toggleFx}
              aria-pressed={lowFx}
            >
              {lowFx ? 'On' : 'Off'}
            </button>
          </div>
        </section>
      </div>

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
            {(showAll ? allStats : allStats.slice(0, 8)).map(([k, v]) => (
              <div className="statline" key={k}>
                <span className="statline__k">{prettyStat(k)}</span>
                <span className="statline__v mono">
                  {Number(v).toLocaleString(NUM_LOCALE)}
                </span>
              </div>
            ))}
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

      <section className="panel">
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => void onDisconnect()}
        >
          Disconnect wallet
        </button>
      </section>
    </div>
  )
}
