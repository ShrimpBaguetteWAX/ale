import { useMemo } from 'react'
import { FARM_SCHEMAS, SCHEMA_LABEL, type FarmSchema } from '@/farming/queries'
import type { FarmConfig, FarmPool, FarmUser } from '@/farming/types'
import { RARITIES, capPerDay, formatPerDay, formatToCap, withWeight, type PoolStatus } from '@/farming/rules'
import { clampCount, type CardStack } from '@/farming/stacks'
import { Ring, ago, capLine, type FarmMode } from '@/farming/PhoneFarming'
import { GameImg } from '@/components/GameImg'
import { formatNumber } from '@/format'
import { asset, ipfsImage } from '@/assets'

const CREDITS = asset('/assets/icons/credits.png')
const GEMS = asset('/assets/icons/gems.png')
/* Best first, the way a player reads their own collection. */
const SHELVES = [...RARITIES].reverse()

/**
 * Farming on a desktop: the card table.
 *
 * A strip across the top holds what is ready to claim and the three pools as
 * rings filling towards their cap — the phone's home screen, laid flat. Under
 * it the picked pool's cards sit on shelves by rarity, best first, each card
 * with its art, weight and how many are held. Clicking a card plays it into
 * the hand along the bottom; the hand says what staking (or unstaking) those
 * cards does to the pool — how much of the cap it fills a day, and how soon
 * it is full — and carries the one button.
 */
export function DeskFarming({
  schema,
  onSchema,
  mode,
  onMode,
  board,
  user,
  pools,
  config,
  invStacks,
  outStacks,
  counts,
  onCount,
  onAll,
  onNone,
  loadingInventory,
  hiddenCount,
  pickedCount,
  stakeCost,
  gems,
  busy,
  canAct,
  onStake,
  onUnstake,
  onClaim,
  now,
  banner,
}: {
  schema: FarmSchema
  onSchema: (schema: FarmSchema) => void
  mode: FarmMode
  onMode: (mode: FarmMode) => void
  board: { pools: PoolStatus[]; total: number; anyMaxed: boolean }
  user?: FarmUser
  pools: FarmPool[]
  config?: FarmConfig
  invStacks: CardStack[]
  outStacks: CardStack[]
  counts: Record<string, number>
  onCount: (key: string, value: number, max: number) => void
  onAll: () => void
  onNone: () => void
  loadingInventory: boolean
  hiddenCount: number
  pickedCount: number
  stakeCost: number
  gems: number
  busy: string | null
  canAct: boolean
  onStake: () => void
  onUnstake: () => void
  onClaim: () => void
  now: number
  banner?: React.ReactNode
}) {
  const label = SCHEMA_LABEL[schema]
  const status = board.pools.find((p) => p.schema === schema)
  const stacks = mode === 'inventory' ? invStacks : outStacks
  const held = stacks.reduce((n, s) => n + s.count, 0)
  const walletCount = invStacks.reduce((n, s) => n + s.count, 0)
  const lastClaim = Date.parse((user?.last_claim ?? '') + 'Z')

  /* The cards on shelves by rarity, best first. */
  const shelves = useMemo(() => {
    const by = new Map<string, CardStack[]>()
    for (const s of stacks) {
      const r = SHELVES.find((x) => x.toLowerCase() === (s.rarity || '').toLowerCase()) ?? s.rarity
      by.set(r, [...(by.get(r) ?? []), s])
    }
    const order = [...SHELVES, ...[...by.keys()].filter((k) => !SHELVES.includes(k))]
    return order.filter((r) => by.has(r)).map((r) => ({ rarity: r, stacks: by.get(r)! }))
  }, [stacks])

  /* What the hand holds, and what it does to the pool. */
  const hand = stacks.filter((s) => (counts[s.key] ?? 0) > 0)
  const handWeight = hand.reduce((n, s) => n + clampCount(counts[s.key] ?? 0, s.count) * s.weight, 0)
  const after = withWeight(schema, mode === 'inventory' ? handWeight : -handWeight, user, pools, config, now)
  const short = stakeCost > gems

  return (
    <div className="dfarm">
      <header className="dfarm__head">
        <h1 className="dfarm__title">Farming</h1>
        <span className="dfarm__sub">Play cards into the pools · they earn credits until the pool is full</span>
      </header>

      {banner}

      {/* What is ready, and the three pools filling towards their cap. */}
      <section className="dfarm__hud" aria-label="Pools">
        <div className="dfarm__claim">
          <span className="dfarm__ready">
            <small>Ready</small>
            <b className="mono">
              <img src={CREDITS} alt="credits" />
              {formatNumber(board.total)}
            </b>
          </span>
          <button
            type="button"
            className="btn btn--gold btn--sm"
            disabled={!canAct || busy !== null || board.total <= 0}
            onClick={onClaim}
            title={`${formatNumber(Number(user?.total_reward ?? 0))} claimed so far${
              Number.isFinite(lastClaim) ? ` · last claim ${ago(now - lastClaim)}` : ''
            }. Claiming resets every pool at once.`}
          >
            {busy === 'claim' && <span className="spinner" />}
            Claim
          </button>
        </div>
        {FARM_SCHEMAS.map((s) => {
          const p = board.pools.find((x) => x.schema === s)
          return (
            <button
              type="button"
              key={s}
              className="dfarm__pool"
              aria-pressed={s === schema}
              onClick={() => onSchema(s)}
            >
              <Ring percent={p?.percent ?? 0} full={!!p?.maxed} />
              <span className="dfarm__pooltext">
                <b>{SCHEMA_LABEL[s]}</b>
                <small>
                  {formatNumber(p?.cards ?? 0)} staked · {formatPerDay(capPerDay(p?.weight ?? 0, config))}
                </small>
                <small className={p?.maxed ? 'is-full' : undefined}>{capLine(p)}</small>
              </span>
              <span className="dfarm__est mono">
                {formatNumber(p?.estimate ?? 0)}
                <img src={CREDITS} alt="credits" />
              </span>
            </button>
          )
        })}
      </section>

      {board.anyMaxed && (
        <p className="dfarm__warn">A pool is full. Nothing more accrues there until you claim.</p>
      )}

      <div className="dfarm__bar">
        <h2 className="dfarm__bartitle">
          {label} · {mode === 'inventory' ? 'your cards' : 'on the farm'}
        </h2>
        {held > 0 && (
          <span className="dfarm__pick">
            {formatNumber(pickedCount)} of {formatNumber(held)} in hand
            <button type="button" className="linklike" disabled={busy !== null || pickedCount >= held} onClick={onAll}>
              All
            </button>
            <button type="button" className="linklike" disabled={busy !== null || pickedCount === 0} onClick={onNone}>
              Clear
            </button>
          </span>
        )}
        <span className="dfarm__sp" />
        <div className="tabs dfarm__tabs" role="tablist" aria-label="Cards">
          <button
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={mode === 'inventory'}
            onClick={() => onMode('inventory')}
          >
            In wallet <span className="tabs__count">{formatNumber(walletCount)}</span>
          </button>
          <button
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={mode === 'staked'}
            onClick={() => onMode('staked')}
          >
            Staked{' '}
            <span className="tabs__count">
              {formatNumber(status?.cards ?? outStacks.reduce((n, s) => n + s.count, 0))}
            </span>
          </button>
        </div>
      </div>

      {mode === 'inventory' && loadingInventory ? (
        <div className="dfarm__grid">
          {Array.from({ length: 12 }, (_, i) => (
            <span className="dfarm__card is-loading" key={i} />
          ))}
        </div>
      ) : stacks.length === 0 ? (
        <p className="dfarm__empty">
          {mode === 'staked'
            ? 'Nothing staked in this pool yet.'
            : hiddenCount > 0
              ? `None of your ${label.toLowerCase()} can be staked — the farm does not accept their rarity.`
              : `No ${label.toLowerCase()} in your wallet.`}
        </p>
      ) : (
        shelves.map(({ rarity, stacks: row }) => {
          const n = row.reduce((sum, s) => sum + s.count, 0)
          const ws = row.map((s) => s.weight)
          const lo = Math.min(...ws)
          const hi = Math.max(...ws)
          return (
            <section className={`dfarm__shelf is-${rarity.toLowerCase()}`} key={rarity} aria-label={rarity}>
              <span className="dfarm__shelfhead">
                {rarity}
                <small>
                  {formatNumber(n)} card{n === 1 ? '' : 's'} · weight{' '}
                  {lo === hi ? formatNumber(lo) : `${formatNumber(lo)}–${formatNumber(hi)}`}
                </small>
              </span>
              <div className="dfarm__grid">
                {row.map((stack) => (
                  <Card
                    key={stack.key}
                    stack={stack}
                    count={counts[stack.key] ?? 0}
                    disabled={busy !== null}
                    onChange={(v) => onCount(stack.key, v, stack.count)}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      {/* The hand: what is about to be staked or unstaked, what it does, and the one button. */}
      {pickedCount > 0 && (
        <div className={`dfarm__hand${mode === 'staked' ? ' is-out' : ''}`}>
          <span className="dfarm__fan" aria-hidden="true">
            {hand.slice(0, 7).map((s) => (
              <GameImg
                key={s.key}
                className={`r-edge-${(s.rarity || '').toLowerCase()}`}
                src={asset(`/assets/cards/${s.template_id}.webp`)}
                alt=""
                fallback={[ipfsImage(s.img), asset('/assets/default-card.png')].filter((x): x is string => !!x)}
              />
            ))}
          </span>
          <span className="dfarm__handtext">
            <b>
              {formatNumber(pickedCount)} card{pickedCount === 1 ? '' : 's'} to {mode === 'inventory' ? 'stake' : 'unstake'} ·{' '}
              {mode === 'inventory' ? '+' : '−'}
              {formatNumber(handWeight)} weight
            </b>
            <small>
              {label} fills {formatPerDay(capPerDay(status?.weight ?? 0, config))} →{' '}
              <em>{formatPerDay(capPerDay(after.weight, config))}</em> ·{' '}
              {status && status.weight > 0 ? `full ${formatToCap(status.msToCap)}` : 'nothing staked'} →{' '}
              <em>{after.weight > 0 ? (after.maxed ? 'full now' : `full ${formatToCap(after.msToCap)}`) : 'nothing staked'}</em>
            </small>
            {mode === 'inventory' && short && (
              <small className="dfarm__short">Not enough gems: {formatNumber(stakeCost)} needed, you hold {formatNumber(gems)}.</small>
            )}
            {mode === 'staked' && <small>Unstaking claims what these cards earned first.</small>}
          </span>
          {mode === 'inventory' ? (
            <button type="button" className="btn btn--primary" disabled={!canAct || busy !== null || short} onClick={onStake}>
              {busy === 'stake' && <span className="spinner" />}
              Stake {formatNumber(pickedCount)}
              {stakeCost > 0 && (
                <span className="dfarm__cost mono">
                  · {formatNumber(stakeCost)}
                  <img src={GEMS} alt="gems" />
                </span>
              )}
            </button>
          ) : (
            <button type="button" className="btn btn--ghost" disabled={!canAct || busy !== null} onClick={onUnstake}>
              {busy === 'unstake' && <span className="spinner" />}
              Unstake {formatNumber(pickedCount)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One design on a shelf: click the card to play all of them into the hand or
 * take them back; the stepper under it is for when it is eleven of forty.
 */
function Card({
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
  const max = stack.count
  const rarity = (stack.rarity || '').toLowerCase()
  const shine = stack.shine && stack.shine !== 'Stone' ? stack.shine : null
  return (
    <div className={`dfarm__card${count > 0 ? ' is-on' : ''}`}>
      <button
        type="button"
        className="dfarm__hit"
        disabled={disabled}
        onClick={() => onChange(count > 0 ? 0 : max)}
        title={count > 0 ? 'Take these back' : `Play all ${max} — ${stack.rarity}${shine ? ` · ${shine}` : ''}, weight ${formatNumber(stack.weight)} each`}
      >
        <span className="dfarm__art">
          <GameImg
            src={asset(`/assets/cards/${stack.template_id}.webp`)}
            alt=""
            loading="lazy"
            fallback={[ipfsImage(stack.img), asset('/assets/default-card.png')].filter((s): s is string => !!s)}
          />
          {shine && <span className={`dfarm__shine is-${shine.toLowerCase()}`}>{shine}</span>}
          <span className="dfarm__owned mono">×{formatNumber(max)}</span>
          {count > 0 && <span className="dfarm__chosen mono">×{formatNumber(count)}</span>}
        </span>
        <span className="dfarm__name">{stack.name}</span>
        <span className="dfarm__meta">
          <em className={`r-${rarity}`}>{stack.rarity}</em>
          <b className="mono">{formatNumber(stack.weight)}</b>
        </span>
      </button>
      <span className="dfarm__step">
        <button type="button" disabled={disabled || count <= 0} onClick={() => onChange(count - 1)} aria-label={`One fewer ${stack.name}`}>
          −
        </button>
        <input
          className="mono"
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
        <button type="button" disabled={disabled || count >= max} onClick={() => onChange(count + 1)} aria-label={`One more ${stack.name}`}>
          +
        </button>
      </span>
    </div>
  )
}
