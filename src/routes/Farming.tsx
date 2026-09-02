import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import { fetchFarmInventory } from '@/chain/atomic'
import {
  FARM_SCHEMAS,
  SCHEMA_LABEL,
  fetchFarmConfig,
  fetchFarmPools,
  fetchFarmUser,
  fetchStakeWeights,
  fetchStakedCards,
  type FarmSchema,
} from '@/farming/queries'
import type {
  FarmCard,
  FarmConfig,
  FarmPool,
  FarmUser,
  StakeWeight,
  StakedCard,
} from '@/farming/types'
import {
  byWeight,
  farmBoard,
  formatToCap,
  stakeable,
  stakedByWeight,
  weightOf,
  weightPerDay,
  type PoolStatus,
} from '@/farming/rules'
import { claimFarming, stakeCards, unstakeCards } from '@/wharf/actions'
import { refreshChore } from '@/chores/signal'
import { readableError } from '@/wharf/errors'
import { formatNumber } from '@/format'
import { asset } from '@/assets'

/**
 * Farming.
 *
 * Alien Worlds cards are staked into `farm.ale` and earn **credits** — not
 * Trilium, which is what the name suggests and what every other pool in the
 * game pays. The contract books the result under `alf_credits_claimed`.
 *
 * The mechanic has one trap and one surprise, and the screen is built around
 * both:
 *
 *   • **Power is capped.** A claim is worth `weight × days since your last
 *     claim`, ceilinged at `config.max_power`. Past that ceiling the position
 *     earns nothing at all until it is claimed — a heavy staker hits it in
 *     under a day. Nothing on the chain row says so, so the screen counts
 *     down to it and says plainly when it has been reached.
 *
 *   • **Unstaking claims first.** `unstake` calls `claim` before returning the
 *     cards, so pulling out never forfeits what has accrued. Players expect
 *     the opposite, so the button says it.
 *
 * Staking itself is not an action but an AtomicAssets transfer carrying the
 * memo `nftstake`; the contract charges `gem_fee` gems per card on receipt.
 */

type Tab = FarmSchema | 'rewards'
type Mode = 'inventory' | 'staked'
type Busy = 'stake' | 'unstake' | 'claim' | null

/* ---------- data ---------- */

interface FarmData {
  config?: FarmConfig
  pools: FarmPool[]
  weights: StakeWeight[]
  user?: FarmUser
  staked: StakedCard[]
  inventory: Map<string, FarmCard[]>
  loading: boolean
  loadingInventory: boolean
  error: string | null
  reload: () => Promise<void>
}

function useFarm(account: string | null, schema: FarmSchema): FarmData {
  const [config, setConfig] = useState<FarmConfig>()
  const [pools, setPools] = useState<FarmPool[]>([])
  const [weights, setWeights] = useState<StakeWeight[]>([])
  const [user, setUser] = useState<FarmUser>()
  const [staked, setStaked] = useState<StakedCard[]>([])
  const [inventory, setInventory] = useState<Map<string, FarmCard[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadingInventory, setLoadingInventory] = useState(false)
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
        const [c, p, w, u, s] = await Promise.all([
          fetchFarmConfig(),
          fetchFarmPools(refresh),
          fetchStakeWeights(),
          fetchFarmUser(account, refresh),
          fetchStakedCards(account, refresh),
        ])
        if (!alive.current) return
        setConfig(c)
        setPools(p)
        setWeights(w)
        setUser(u)
        setStaked(s)
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

  /*
   * The wallet's own cards are fetched per schema, on demand.
   *
   * A real Alien Worlds wallet holds thousands across the three schemas, and
   * only one is on screen at a time — loading all three up front would be
   * three long paged crawls to show one.
   */
  useEffect(() => {
    if (!account || inventory.has(schema)) return
    let cancelled = false
    setLoadingInventory(true)
    fetchFarmInventory(account, schema)
      .then((cards) => {
        if (cancelled || !alive.current) return
        setInventory((prev) => new Map(prev).set(schema, cards))
      })
      .catch((err) => {
        if (!cancelled && alive.current) setError(readableError(err))
      })
      .finally(() => {
        if (!cancelled && alive.current) setLoadingInventory(false)
      })
    return () => {
      cancelled = true
    }
  }, [account, schema, inventory])

  const reload = useCallback(async () => {
    setInventory(new Map())
    await load(true)
  }, [load])

  return {
    config,
    pools,
    weights,
    user,
    staked,
    inventory,
    loading,
    loadingInventory,
    error,
    reload,
  }
}

/* ---------- the screen ---------- */

export default function Farming() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [tab, setTab] = useState<Tab>('tool.worlds')
  const [mode, setMode] = useState<Mode>('inventory')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState<Busy>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const schema: FarmSchema = tab === 'rewards' ? 'tool.worlds' : tab
  const data = useFarm(account, schema)
  const { config, pools, weights, user, staked } = data

  /* Power accrues by the second; a minute is fine for a number in credits. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const board = useMemo(
    () => farmBoard(FARM_SCHEMAS, user, pools, config, staked, now),
    [user, pools, config, staked, now],
  )

  /*
   * Only cards the farm will actually take.
   *
   * `stakeweight` has no row for Abundant, and the transfer handler rejects
   * anything missing from it — so those are not choices, they are noise. A
   * wallet holds hundreds of Abundant shovels for every card worth staking,
   * and showing them greyed out buries the ones that matter.
   */
  const inventory = useMemo(() => {
    const all = data.inventory.get(schema) ?? []
    return all.filter((c) => stakeable(c, weights)).sort(byWeight(weights))
  }, [data.inventory, schema, weights])

  /* Held but unstakeable, so an empty grid can explain itself. */
  const hiddenCount = (data.inventory.get(schema)?.length ?? 0) - inventory.length

  const stakedHere = useMemo(
    () => staked.filter((c) => c.schema === schema).sort(stakedByWeight),
    [staked, schema],
  )

  /* Leaving a tab drops a selection that no longer has anything to act on. */
  useEffect(() => setPicked([]), [tab, mode])

  const gemFee = Number(config?.gem_fee ?? 0)
  const gems = player?.activestats.gems ?? 0
  const stakeCost = picked.length * gemFee

  const run = useCallback(
    async (mark: Busy, act: () => Promise<unknown>, done: string) => {
      if (!session) return
      setBusy(mark)
      setError(null)
      setNotice(null)
      try {
        await act()
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 900))
          await Promise.all([data.reload(), refreshPlayer({ force: true })])
        }
        setPicked([])
        /* Claiming resets the power that had capped. */
        refreshChore('farming')
        setNotice(done)
      } catch (err) {
        setError(readableError(err))
      } finally {
        setBusy(null)
      }
    },
    [session, data, refreshPlayer],
  )

  const doStake = () =>
    run(
      'stake',
      () => stakeCards(session!, picked),
      `Staked ${picked.length} card${picked.length === 1 ? '' : 's'}.`,
    )

  const doUnstake = () =>
    run(
      'unstake',
      () => unstakeCards(session!, picked),
      `Unstaked ${picked.length} card${picked.length === 1 ? '' : 's'}, and claimed what they had earned.`,
    )

  const doClaim = () =>
    run('claim', () => claimFarming(session!), 'Credits claimed.')

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  if (!player) return null

  return (
    <div className="farming">
      <header className="farming__head">
        <div>
          <h1 className="farming__title">Farming</h1>
          <p className="farming__lede">
            Stake Alien Worlds cards to earn <strong>credits</strong> from a
            pool shared with every other farmer. A card's weight comes from its
            rarity and shine.
          </p>
        </div>

        <div className="farming__acts">
          {mode === 'inventory' ? (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!session || busy !== null || picked.length === 0 || stakeCost > gems}
              onClick={() => void doStake()}
              title={
                stakeCost > gems
                  ? `Staking costs ${gemFee} gem per card`
                  : 'Send these cards to the farm'
              }
            >
              {busy === 'stake' && <span className="spinner" />}
              Stake {picked.length || ''}
              {stakeCost > 0 && (
                <span className={`cost${stakeCost > gems ? ' cost--short' : ''}`}>
                  −{formatNumber(stakeCost)}
                  <img src={asset("/assets/icons/gems.png")} alt="gems" width={16} height={16} />
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!session || busy !== null || picked.length === 0}
              onClick={() => void doUnstake()}
              title="Returns the cards and claims what they have earned"
            >
              {busy === 'unstake' && <span className="spinner" />}
              Unstake {picked.length || ''}
            </button>
          )}

          <button
            type="button"
            className="btn btn--primary"
            disabled={!session || busy !== null || board.total <= 0}
            onClick={() => void doClaim()}
          >
            {busy === 'claim' && <span className="spinner" />}
            Claim {board.total > 0 ? formatNumber(board.total) : ''} credits
          </button>
        </div>
      </header>

      {/*
        The cap is the one thing that quietly costs a farmer money, so it is
        stated at the top rather than left inside a tab.
      */}
      {board.anyMaxed && (
        <div className="alert alert--warn">
          A pool has reached its power ceiling. Nothing more accrues there
          until you claim.
        </div>
      )}

      {notice && <div className="alert alert--ok">{notice}</div>}
      {(error || data.error) && (
        <div className="alert alert--error">{error ?? data.error}</div>
      )}

      <div className="farmtabs" role="tablist" aria-label="Card type">
        {FARM_SCHEMAS.map((s) => {
          const status = board.pools.find((p) => p.schema === s)
          return (
            <button
              type="button"
              key={s}
              role="tab"
              aria-selected={tab === s}
              className="farmtab"
              onClick={() => setTab(s)}
            >
              <span className="farmtab__name">{SCHEMA_LABEL[s]}</span>
              <span className="farmtab__meta">
                {status?.cards ?? 0} staked · {formatNumber(status?.weight ?? 0)} weight
              </span>
            </button>
          )
        })}
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rewards'}
          className="farmtab"
          onClick={() => setTab('rewards')}
        >
          <span className="farmtab__name">Rewards</span>
          <span className="farmtab__meta">
            {formatNumber(board.total)} credits waiting
          </span>
        </button>
      </div>

      {tab === 'rewards' ? (
        <Rewards
          board={board.pools}
          total={board.total}
          user={user}
          config={config}
        />
      ) : (
        <>
          <div className="farmmodes" role="tablist" aria-label="Card source">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'inventory'}
              className="farmmode"
              onClick={() => setMode('inventory')}
            >
              Inventory
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'staked'}
              className="farmmode"
              onClick={() => setMode('staked')}
            >
              Staked ({stakedHere.length})
            </button>
          </div>

          {mode === 'inventory' ? (
            data.loadingInventory ? (
              <CardSkeletons />
            ) : inventory.length === 0 ? (
              <p className="farming__empty">
                {hiddenCount > 0
                  ? `None of your ${SCHEMA_LABEL[schema].toLowerCase()} can be staked — the farm does not accept their rarity.`
                  : `No ${SCHEMA_LABEL[schema].toLowerCase()} in your wallet.`}
              </p>
            ) : (
              <div className="cardgridf">
                {inventory.map((card) => (
                  <CardTile
                    key={card.asset_id}
                    templateId={card.template_id}
                    name={card.name}
                    rarity={card.rarity}
                    shine={card.shine}
                    weight={weightOf(card, weights)}
                    picked={picked.includes(card.asset_id)}
                    disabled={busy !== null}
                    onClick={() => toggle(card.asset_id)}
                  />
                ))}
              </div>
            )
          ) : stakedHere.length === 0 ? (
            <p className="farming__empty">
              Nothing staked in this pool yet.
            </p>
          ) : (
            <div className="cardgridf">
              {stakedHere.map((card) => (
                <CardTile
                  key={card.asset_id}
                  templateId={card.template_id}
                  name={`#${card.template_id}`}
                  rarity={card.rarity}
                  shine={card.shine}
                  weight={card.weight}
                  picked={picked.includes(card.asset_id)}
                  disabled={busy !== null}
                  onClick={() => toggle(card.asset_id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ---------- pieces ---------- */

function CardSkeletons() {
  return (
    <div className="cardgridf">
      {Array.from({ length: 18 }, (_, i) => (
        <div className="cardtile cardtile--loading" key={i} />
      ))}
    </div>
  )
}

function CardTile({
  templateId,
  name,
  rarity,
  shine,
  weight,
  picked,
  disabled,
  onClick,
}: {
  templateId: number
  name: string
  rarity: string
  shine: string
  weight: number
  picked: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`cardtile${picked ? ' cardtile--picked' : ''}`}
      aria-pressed={picked}
      disabled={disabled}
      onClick={onClick}
      title={`${rarity} · ${shine} · weight ${formatNumber(weight)}`}
    >
      <img
        className="cardtile__art"
        src={asset(`/assets/cards/${templateId}.webp`)}
        alt=""
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget
          if (img.dataset.fallback) return
          img.dataset.fallback = '1'
          img.src = asset('/assets/default-card.png')
        }}
      />
      <span className="cardtile__name">{name}</span>
      <span className={`cardtile__rarity r-${rarity.toLowerCase()}`}>
        {shine === 'Stone' ? rarity : `${rarity} · ${shine}`}
      </span>
      <span className="cardtile__weight">{formatNumber(weight)}</span>
    </button>
  )
}

/* ---------- the rewards tab ---------- */

function Rewards({
  board,
  total,
  user,
  config,
}: {
  board: PoolStatus[]
  total: number
  user?: FarmUser
  config?: FarmConfig
}) {
  const perDay = weightPerDay(user)

  return (
    <div className="rewards">
      <section className="rewards__summary">
        <div className="tally">
          <img src={asset("/assets/icons/credits.png")} alt="" width={20} height={20} />
          <strong>{formatNumber(total)}</strong>
          <span>Estimated current claim</span>
        </div>
        <div className="tally">
          <img src={asset("/assets/icons/energy.png")} alt="" width={20} height={20} />
          <strong>{formatNumber(perDay)}</strong>
          <span>Mining power per day</span>
        </div>
        <div className="tally">
          <img src={asset("/assets/icons/credits.png")} alt="" width={20} height={20} />
          <strong>{formatNumber(Number(user?.total_reward ?? 0))}</strong>
          <span>Claimed all time</span>
        </div>
      </section>

      <p className="hint">
        Last claim:{' '}
        {user?.last_claim
          ? new Date(Date.parse(user.last_claim + 'Z')).toLocaleString()
          : 'never'}
        . Claiming resets the clock on every pool at once, so power banked in
        one is given up along with the rest.
      </p>

      <div className="poolgrid">
        {board.map((p) => (
          <article className="poolcard" key={p.schema}>
            <h3 className="panel__title">{SCHEMA_LABEL[p.schema] ?? p.schema}</h3>

            {p.weight === 0 ? (
              <p className="faint">You are not gaining minepower in this pool</p>
            ) : (
              <>
                <div className="powerbar">
                  <span
                    className={`powerbar__fill${p.maxed ? ' powerbar__fill--max' : ''}`}
                    style={{ width: `${p.percent}%` }}
                  />
                  <span className="powerbar__text">
                    {/* Two decimals: power creeps up slowly enough that a
                        whole-number reading sits on 0% for the first while and
                        looks like nothing is accruing at all. */}
                    {p.percent.toFixed(2)}% of the cap
                  </span>
                </div>

                <dl className="poolcard__facts">
                  <div>
                    <dt>Estimated claim</dt>
                    <dd>{formatNumber(p.estimate)}</dd>
                  </div>
                  <div>
                    <dt>Your weight</dt>
                    <dd>{formatNumber(p.weight)}</dd>
                  </div>
                  <div>
                    <dt>Cards staked</dt>
                    <dd>{formatNumber(p.cards)}</dd>
                  </div>
                  <div>
                    <dt>Cap</dt>
                    <dd className={p.maxed ? 'warn' : undefined}>
                      {p.maxed
                        ? 'You have reached the maximum'
                        : formatToCap(p.msToCap)}
                    </dd>
                  </div>
                  {/*
                    The pot is shared, so its size is half of what a claim is
                    worth — and it visibly shrinks as other farmers claim.
                  */}
                  <div>
                    <dt>Pool holds</dt>
                    <dd>{formatNumber(Number(p.pool?.current_size ?? 0))}</dd>
                  </div>
                  <div>
                    <dt>Your share of the pool</dt>
                    <dd>
                      {p.pool && p.pool.total_weight > 0
                        ? ((p.weight / p.pool.total_weight) * 100).toFixed(2) + '%'
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </article>
        ))}
      </div>

      {config && (
        <p className="hint">
          A claim is worth the pool's size times your power, where power is
          your weight multiplied by the days since your last claim and capped
          at {formatNumber(Number(config.max_power))}. Staking costs{' '}
          {formatNumber(Number(config.gem_fee))} gem per card; unstaking is
          free and claims first.
        </p>
      )}
    </div>
  )
}

export { CardTile, Rewards }
