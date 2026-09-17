import { useEffect, useMemo, useState } from 'react'
import { useGame } from '@/state/useGame'
import { fetchFarmInventory } from '@/chain/atomic'
import {
  FARM_SCHEMAS,
  SCHEMA_LABEL,
  fetchFarmPools,
  fetchFarmUser,
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
  clampCount,
  inventoryStacks,
  selectedIds,
  stakedStacks,
  totalPicked,
  type CardStack,
} from '@/farming/stacks'
import {
  byWeight,
  farmBoard,
  formatToCap,
  stakeable,
  stakedByWeight,
  weightPerDay,
  type PoolStatus,
} from '@/farming/rules'
import { claimFarming, stakeCards, unstakeCards } from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { useChainQuery } from '@/chain/useChainQuery'
import { useLazyConfig } from '@/state/useConfig'
import { DIRTIES } from '@/wharf/actions'
import { formatNumber } from '@/format'
import { ActionBanner } from '@/components/ActionBanner'
import { asset, ipfsImage } from '@/assets'
import { GameImg } from '@/components/GameImg'

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
  /** This schema's cards, not every schema's. */
  inventory: FarmCard[]
  loading: boolean
  loadingInventory: boolean
  error: string | null
  reload: () => Promise<void>
}

function useFarm(account: string | null, schema: FarmSchema): FarmData {
  /* The pool settings and the rarity weights are the same for everybody. */
  const config = useLazyConfig('farm')
  const weights = useLazyConfig('stakeWeights') ?? EMPTY_WEIGHTS

  const farm = useChainQuery(
    account && `farm:${account}`,
    async () => {
      const [p, u, s] = await Promise.all([
        fetchFarmPools(),
        fetchFarmUser(account!),
        fetchStakedCards(account!),
      ])
      return { pools: p, user: u, staked: s }
    },
    /* Staking, unstaking and claiming all move the accrued power and the
       cards behind it. */
    { deps: ['farmUser', 'farmStaked'] },
  )

  /*
     The wallet's own cards, per schema and on demand.

     A real Alien Worlds wallet holds thousands across the three schemas and
     only one is on screen at a time, so loading all three up front would be
     three long paged crawls to show one. The map that used to hold them all
     is gone: switching back to a schema is a cache hit in the client, which
     is what the map was reimplementing.
  */
  const inventory = useChainQuery(
    account && `farm-inv:${account}:${schema}`,
    () => fetchFarmInventory(account!, schema),
    { deps: ['farmStaked'] },
  )

  return {
    config,
    pools: farm.data?.pools ?? EMPTY_POOLS,
    weights,
    user: farm.data?.user,
    staked: farm.data?.staked ?? EMPTY_STAKED,
    inventory: inventory.data ?? EMPTY_CARDS,
    loading: farm.loading,
    loadingInventory: inventory.loading,
    error: farm.error ?? inventory.error,
    reload: async () => {
      await Promise.all([farm.reload(), inventory.reload()])
    },
  }
}

const EMPTY_POOLS: FarmPool[] = []
const EMPTY_WEIGHTS: StakeWeight[] = []
const EMPTY_STAKED: StakedCard[] = []
const EMPTY_CARDS: FarmCard[] = []

/* ---------- the screen ---------- */

export default function Farming() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)

  const [tab, setTab] = useState<Tab>('tool.worlds')
  const [mode, setMode] = useState<Mode>('inventory')
  /*
     How many of each stack the player is taking, by stack key.

     Amounts rather than a list of asset ids: every copy of a design is worth
     the same, so which copies go is not a choice worth making a player make.
     `selectedIds` turns the amounts back into the ids the chain wants at the
     moment of signing.
  */
  const [counts, setCounts] = useState<Record<string, number>>({})
  /* Narrowed where it enters the screen, so every comparison below still has
     to name one of this screen's three buttons. */
  const { busy: busyKey, error, notice, run } = useAction()
  const busy = busyKey as Busy

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
    const all = data.inventory
    return all.filter((c) => stakeable(c, weights)).sort(byWeight(weights))
  }, [data.inventory, weights])

  /* One tile per design, with what the player holds of it. */
  const invStacks = useMemo(() => inventoryStacks(inventory, weights), [inventory, weights])

  /* Held but unstakeable, so an empty grid can explain itself. */
  const hiddenCount = data.inventory.length - inventory.length

  const stakedHere = useMemo(
    () => staked.filter((c) => c.schema === schema).sort(stakedByWeight),
    [staked, schema],
  )

  const outStacks = useMemo(() => stakedStacks(stakedHere), [stakedHere])

  /* Whichever side is on screen is the side the amounts belong to. */
  const stacks = mode === 'inventory' ? invStacks : outStacks
  const picked = useMemo(() => selectedIds(stacks, counts), [stacks, counts])
  const pickedCount = useMemo(() => totalPicked(stacks, counts), [stacks, counts])

  /* Leaving a tab drops a selection that no longer has anything to act on. */
  useEffect(() => setCounts({}), [tab, mode])

  const setCount = (key: string, value: number, max: number) =>
    setCounts((prev) => ({ ...prev, [key]: clampCount(value, max) }))

  /* Every card on this side, or none of them — the two amounts a player
     picking a whole pool actually wants. */
  const takeAll = () =>
    setCounts(Object.fromEntries(stacks.map((s) => [s.key, s.ids.length])))
  const takeNone = () => setCounts({})

  const gemFee = Number(config?.gem_fee ?? 0)
  const gems = player?.activestats.gems ?? 0
  const stakeCost = pickedCount * gemFee

  /* Whatever was staked or claimed is no longer a pending selection, and
     claiming resets the power that had capped. */
  const opts = (action: keyof typeof DIRTIES) => ({
    after: data.reload,
    onSettled: () => setCounts({}),
    dirties: DIRTIES[action],
  })

  const doStake = () =>
    run(
      'stake',
      () => stakeCards(session!, picked),
      `Staked ${pickedCount} card${pickedCount === 1 ? '' : 's'}.`,
      opts('stakeCards'),
    )

  const doUnstake = () =>
    run(
      'unstake',
      () => unstakeCards(session!, picked),
      `Unstaked ${pickedCount} card${pickedCount === 1 ? '' : 's'}, and claimed what they had earned.`,
      opts('unstakeCards'),
    )

  const doClaim = () =>
    run('claim', () => claimFarming(session!), 'Credits claimed.', opts('claimFarming'))

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
              disabled={!session || busy !== null || pickedCount === 0 || stakeCost > gems}
              onClick={() => void doStake()}
              title={
                stakeCost > gems
                  ? `Staking costs ${gemFee} gem per card`
                  : 'Send these cards to the farm'
              }
            >
              {busy === 'stake' && <span className="spinner" />}
              Stake {pickedCount || ''}
              {stakeCost > 0 && (
                <span className={`cost${stakeCost > gems ? ' cost--short' : ''}`}>
                  {formatNumber(stakeCost)}
                  <img src={asset("/assets/icons/gems.png")} alt="gems" width={16} height={16} />
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!session || busy !== null || pickedCount === 0}
              onClick={() => void doUnstake()}
              title="Returns the cards and claims what they have earned"
            >
              {busy === 'unstake' && <span className="spinner" />}
              Unstake {pickedCount || ''}
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

      <ActionBanner notice={notice} error={error ?? data.error} />

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
              <>
                <StackBar
                  held={inventory.length}
                  picked={pickedCount}
                  disabled={busy !== null}
                  onAll={takeAll}
                  onNone={takeNone}
                />
                <div className="cardgridf">
                  {invStacks.map((stack) => (
                    <StackTile
                      key={stack.key}
                      stack={stack}
                      count={counts[stack.key] ?? 0}
                      disabled={busy !== null}
                      onChange={(n) => setCount(stack.key, n, stack.ids.length)}
                    />
                  ))}
                </div>
              </>
            )
          ) : stakedHere.length === 0 ? (
            <p className="farming__empty">
              Nothing staked in this pool yet.
            </p>
          ) : (
            <>
              <StackBar
                held={stakedHere.length}
                picked={pickedCount}
                disabled={busy !== null}
                onAll={takeAll}
                onNone={takeNone}
              />
              <div className="cardgridf">
                {outStacks.map((stack) => (
                  <StackTile
                    key={stack.key}
                    stack={stack}
                    count={counts[stack.key] ?? 0}
                    disabled={busy !== null}
                    onChange={(n) => setCount(stack.key, n, stack.ids.length)}
                  />
                ))}
              </div>
            </>
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

/** What is held on this side, and the two amounts worth one click. */
function StackBar({
  held,
  picked,
  disabled,
  onAll,
  onNone,
}: {
  held: number
  picked: number
  disabled: boolean
  onAll: () => void
  onNone: () => void
}) {
  return (
    <div className="stackbar">
      <p className="faint stackbar__count">
        {formatNumber(picked)} of {formatNumber(held)} selected
      </p>
      <span className="spacer" />
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={disabled || picked >= held}
        onClick={onAll}
      >
        Select all
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={disabled || picked === 0}
        onClick={onNone}
      >
        Clear
      </button>
    </div>
  )
}

/**
 * One design, with how many of it to use.
 *
 * The art is a button of its own: clicking it takes the whole stack, and
 * clicking it again puts it back — which is what a player who holds forty of
 * one card almost always wants. The stepper beside it is for the times they
 * want eleven.
 */
function StackTile({
  stack,
  count,
  disabled,
  onChange,
}: {
  stack: CardStack
  count: number
  disabled: boolean
  onChange: (next: number) => void
}) {
  const max = stack.ids.length
  const rarity = (stack.rarity || '').toLowerCase()

  return (
    <div className={`cardtile cardtile--stack${count > 0 ? ' cardtile--picked' : ''}`}>
      <button
        type="button"
        className="cardtile__hit"
        disabled={disabled}
        onClick={() => onChange(count > 0 ? 0 : max)}
        title={
          count > 0
            ? 'Take none of these'
            : `Take all ${max} — ${stack.rarity} · ${stack.shine}, weight ${formatNumber(stack.weight)} each`
        }
      >
        <span className="cardtile__frame">
          <GameImg
            className="cardtile__art"
            src={asset(`/assets/cards/${stack.template_id}.webp`)}
            alt=""
            loading="lazy"
            /* Ours, then the card's own on IPFS, then the blank back. */
            fallback={[ipfsImage(stack.img), asset('/assets/default-card.png')].filter(
              (s): s is string => !!s,
            )}
          />
          <span className="cardtile__owned mono">×{formatNumber(max)}</span>
        </span>
        <span className="cardtile__name">{stack.name}</span>
        <span className={`cardtile__rarity r-${rarity}`}>
          {stack.shine === 'Stone' ? stack.rarity : `${stack.rarity} · ${stack.shine}`}
        </span>
        <span className="cardtile__weight">{formatNumber(stack.weight)}</span>
      </button>

      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          disabled={disabled || count <= 0}
          onClick={() => onChange(count - 1)}
          aria-label={`One fewer ${stack.name}`}
        >
          −
        </button>
        <input
          className="stepper__n mono"
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={1}
          value={count}
          disabled={disabled}
          onChange={(e) => onChange(clampCount(Number(e.target.value), max))}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`How many ${stack.name} to use, up to ${max}`}
        />
        <button
          type="button"
          className="stepper__btn"
          disabled={disabled || count >= max}
          onClick={() => onChange(count + 1)}
          aria-label={`One more ${stack.name}`}
        >
          +
        </button>
      </div>
    </div>
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

export { StackTile, Rewards }
