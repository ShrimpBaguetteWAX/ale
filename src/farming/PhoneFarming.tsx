import { useState, type ReactNode } from 'react'
import { FARM_SCHEMAS, SCHEMA_LABEL, type FarmSchema } from '@/farming/queries'
import type { FarmConfig, FarmUser } from '@/farming/types'
import { clampCount, type CardStack } from '@/farming/stacks'
import { capPerDay, formatPerDay, formatToCap, type PoolStatus } from '@/farming/rules'
import { BottomSheet } from '@/components/BottomSheet'
import { GameImg } from '@/components/GameImg'
import { formatNumber } from '@/format'
import { asset, ipfsImage } from '@/assets'

export type FarmMode = 'inventory' | 'staked'

const CREDITS = asset('/assets/icons/credits.svg')
const GEMS = asset('/assets/icons/gems.svg')

/**
 * Farming on a phone.
 *
 * It opens on what is ready — one number and one Claim — then the three
 * pools as rings filling towards their cap, and a row per pool with what it
 * adds to a claim. A pool opens as its own page of cards, a compact list
 * with a stepper per design, and Stake or Unstake docked at the bottom.
 *
 * A pool's weight is shown as the share of the cap it fills in a day, since
 * that is what the weight decides: how soon the pool is full and stops
 * earning until the next claim.
 */
export function PhoneFarming({
  schema,
  onOpen,
  mode,
  onMode,
  board,
  user,
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
}: {
  schema: FarmSchema | null
  onOpen: (schema: FarmSchema | null, mode?: FarmMode) => void
  mode: FarmMode
  onMode: (mode: FarmMode) => void
  board: { pools: PoolStatus[]; total: number; anyMaxed: boolean }
  user?: FarmUser
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
}) {
  const [detail, setDetail] = useState<FarmSchema | null>(null)
  const detailPool = board.pools.find((p) => p.schema === detail)

  if (schema) {
    return (
      <PoolPage
        schema={schema}
        onBack={() => onOpen(null)}
        mode={mode}
        onMode={onMode}
        status={board.pools.find((p) => p.schema === schema)}
        config={config}
        invStacks={invStacks}
        outStacks={outStacks}
        counts={counts}
        onCount={onCount}
        onAll={onAll}
        onNone={onNone}
        loadingInventory={loadingInventory}
        hiddenCount={hiddenCount}
        pickedCount={pickedCount}
        stakeCost={stakeCost}
        gems={gems}
        busy={busy}
        canAct={canAct}
        onStake={onStake}
        onUnstake={onUnstake}
      />
    )
  }

  const lastClaim = Date.parse((user?.last_claim ?? '') + 'Z')

  return (
    <div className="prew pfarm">
      <h1 className="pfarm__title">Farming</h1>
      {board.anyMaxed && (
        <div className="pfarm__warn">
          <b>A pool is full</b>
          <small>Nothing more accrues there until you claim.</small>
        </div>
      )}

      <div className="pfarm__hero">
        <small>Ready to claim</small>
        <b className="mono">
          {formatNumber(board.total)}
          <img src={CREDITS} alt="credits" />
        </b>
        <button
          type="button"
          className="btn btn--gold"
          disabled={!canAct || busy !== null || board.total <= 0}
          onClick={onClaim}
        >
          {busy === 'claim' && <span className="spinner" />}
          Claim {formatNumber(board.total)} credits
        </button>
        <span>
          {formatNumber(Number(user?.total_reward ?? 0))} claimed so far
          {Number.isFinite(lastClaim) && <> · last claim {ago(now - lastClaim)}</>}
        </span>
      </div>

      <div className="pfarm__rings">
        {FARM_SCHEMAS.map((s) => {
          const p = board.pools.find((x) => x.schema === s)
          return (
            <button type="button" key={s} className="pfarm__ring" onClick={() => setDetail(s)}>
              <Ring percent={p?.percent ?? 0} full={!!p?.maxed} />
              <b>{SCHEMA_LABEL[s]}</b>
              <small>{capLine(p)}</small>
            </button>
          )
        })}
      </div>

      <div className="pfarm__list">
        {FARM_SCHEMAS.map((s) => {
          const p = board.pools.find((x) => x.schema === s)
          return (
            <button type="button" key={s} className="pfarm__pool" onClick={() => onOpen(s)}>
              <span className="pfarm__text">
                <b>{SCHEMA_LABEL[s]}</b>
                <small>
                  {formatNumber(p?.cards ?? 0)} staked ·{' '}
                  {formatPerDay(capPerDay(p?.weight ?? 0, config))}
                </small>
              </span>
              <span className="pfarm__est mono">
                {formatNumber(p?.estimate ?? 0)}
                <img src={CREDITS} alt="credits" />
              </span>
              <Chevron />
            </button>
          )
        })}
      </div>

      <p className="pfarm__note">Claiming resets the clock on every pool at once.</p>

      {detail && detailPool && (
        <PoolSheet
          status={detailPool}
          config={config}
          onClose={() => setDetail(null)}
          onOpen={(m) => {
            setDetail(null)
            onOpen(detail, m)
          }}
        />
      )}
    </div>
  )
}

/* ---------- one pool's cards ---------- */

function PoolPage({
  schema,
  onBack,
  mode,
  onMode,
  status,
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
}: {
  schema: FarmSchema
  onBack: () => void
  mode: FarmMode
  onMode: (mode: FarmMode) => void
  status?: PoolStatus
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
}) {
  const label = SCHEMA_LABEL[schema]
  const stacks = mode === 'inventory' ? invStacks : outStacks
  const held = stacks.reduce((n, s) => n + s.count, 0)
  const walletCount = invStacks.reduce((n, s) => n + s.count, 0)
  const pickedWeight = stacks.reduce(
    (n, s) => n + clampCount(counts[s.key] ?? 0, s.count) * s.weight,
    0,
  )
  const short = stakeCost > gems

  let body: ReactNode
  if (mode === 'inventory' && loadingInventory) {
    body = <p className="pfarm__note">Reading your wallet…</p>
  } else if (stacks.length === 0) {
    body = (
      <p className="pfarm__note">
        {mode === 'staked'
          ? 'Nothing staked in this pool yet.'
          : hiddenCount > 0
            ? `None of your ${label.toLowerCase()} can be staked — the farm does not accept their rarity.`
            : `No ${label.toLowerCase()} in your wallet.`}
      </p>
    )
  } else {
    body = (
      <>
        <div className="pfarm__pick">
          <span className="mono">
            {formatNumber(pickedCount)} of {formatNumber(held)} picked
          </span>
          <button type="button" disabled={busy !== null || pickedCount >= held} onClick={onAll}>
            All
          </button>
          <button type="button" disabled={busy !== null || pickedCount === 0} onClick={onNone}>
            Clear
          </button>
        </div>
        <div className="pfarm__list">
          {stacks.map((stack) => (
            <CardRow
              key={stack.key}
              stack={stack}
              count={counts[stack.key] ?? 0}
              disabled={busy !== null}
              onChange={(n) => onCount(stack.key, n, stack.count)}
            />
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="prew pfarm pfarm--pool">
      <button type="button" className="pfarm__back" onClick={onBack}>
        ‹ Farming
      </button>
      <h2 className="pfarm__title">{label}</h2>
      {status && status.weight > 0 && (
        <p className="pfarm__sub">
          {formatPerDay(capPerDay(status.weight, config))} · {capLine(status)}
        </p>
      )}

      <div className="prew__tabs" role="tablist" aria-label="Cards">
        <button
          type="button"
          role="tab"
          className="prew__tab"
          aria-selected={mode === 'inventory'}
          onClick={() => onMode('inventory')}
        >
          In wallet {formatNumber(walletCount)}
        </button>
        <button
          type="button"
          role="tab"
          className="prew__tab"
          aria-selected={mode === 'staked'}
          onClick={() => onMode('staked')}
        >
          Staked {formatNumber(status?.cards ?? outStacks.reduce((n, s) => n + s.count, 0))}
        </button>
      </div>

      {body}

      {pickedCount > 0 && (
        <div className="pfarm__dock">
          {mode === 'inventory' ? (
            <>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canAct || busy !== null || short}
                onClick={onStake}
              >
                {busy === 'stake' && <span className="spinner" />}
                Stake {formatNumber(pickedCount)}
                {stakeCost > 0 && (
                  <span className="pfarm__cost mono">
                    {formatNumber(stakeCost)}
                    <img src={GEMS} alt="gems" />
                  </span>
                )}
              </button>
              <small className={short ? 'pfarm__short' : undefined}>
                {short
                  ? `Not enough gems — ${formatNumber(stakeCost)} needed`
                  : `+${formatPerDay(capPerDay(pickedWeight, config))}`}
              </small>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!canAct || busy !== null}
                onClick={onUnstake}
              >
                {busy === 'unstake' && <span className="spinner" />}
                Unstake {formatNumber(pickedCount)}
              </button>
              <small>Claims what they earned first</small>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** One design: tap the card for all or none, or step the amount. */
function CardRow({
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
  return (
    <div className={`pcard${count > 0 ? ' is-on' : ''}`}>
      <button
        type="button"
        className="pcard__hit"
        disabled={disabled}
        onClick={() => onChange(count > 0 ? 0 : max)}
        aria-label={count > 0 ? `Take none of ${stack.name}` : `Take all ${max} ${stack.name}`}
      >
        <GameImg
          className="pcard__art"
          src={asset(`/assets/cards/${stack.template_id}.webp`)}
          alt=""
          loading="lazy"
          fallback={[ipfsImage(stack.img), asset('/assets/default-card.png')].filter(
            (s): s is string => !!s,
          )}
        />
        <span className="pcard__text">
          <b>{stack.name}</b>
          <small>
            <em className={`r-${rarity}`}>{stack.rarity}</em>
            {stack.shine && stack.shine !== 'Stone' && (
              <em className={`pcard__shine pcard__shine--${stack.shine.toLowerCase()}`}>
                {' '}
                · {stack.shine}
              </em>
            )}{' '}
            · ×{formatNumber(max)}
          </small>
        </span>
        <span className="pcard__w mono">{formatNumber(stack.weight)}</span>
      </button>
      {count > 0 ? (
        <span className="pcard__step">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(count - 1)}
            aria-label={`One fewer ${stack.name}`}
          >
            −
          </button>
          <b className="mono">{count}</b>
          <button
            type="button"
            disabled={disabled || count >= max}
            onClick={() => onChange(count + 1)}
            aria-label={`One more ${stack.name}`}
          >
            +
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="pcard__add"
          disabled={disabled}
          onClick={() => onChange(1)}
          aria-label={`Take one ${stack.name}`}
        >
          +
        </button>
      )}
    </div>
  )
}

/* ---------- a pool's details ---------- */

function PoolSheet({
  status,
  config,
  onClose,
  onOpen,
}: {
  status: PoolStatus
  config?: FarmConfig
  onClose: () => void
  onOpen: (mode: FarmMode) => void
}) {
  const label = SCHEMA_LABEL[status.schema as FarmSchema] ?? status.schema
  const share =
    status.pool && status.pool.total_weight > 0
      ? ((status.weight / status.pool.total_weight) * 100).toFixed(2) + '%'
      : '—'
  return (
    <BottomSheet
      title={`${label} pool`}
      onClose={onClose}
      foot={
        <div className="rsheet__actions">
          <button type="button" className="btn btn--ghost" onClick={() => onOpen('staked')}>
            Staked cards
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onOpen('inventory')}>
            Add cards
          </button>
        </div>
      }
    >
      <div className="pfarm__detail">
        <Ring percent={status.percent} full={status.maxed} big />
        <span>
          <b>
            {status.weight === 0
              ? 'Nothing staked'
              : status.maxed
                ? 'Full — claim to keep earning'
                : `Full ${formatToCap(status.msToCap)}`}
          </b>
          <small>Past the cap, nothing more accrues until you claim.</small>
        </span>
      </div>
      <div className="pfarm__facts">
        <div>
          <span>Estimated claim</span>
          <b className="mono">
            {formatNumber(status.estimate)}
            <img src={CREDITS} alt="credits" />
          </b>
        </div>
        <div>
          <span>Your weight</span>
          <b className="mono">{formatPerDay(capPerDay(status.weight, config))}</b>
        </div>
        <div>
          <span>Cards staked</span>
          <b className="mono">{formatNumber(status.cards)}</b>
        </div>
        <div>
          <span>Pool holds</span>
          <b className="mono">
            {formatNumber(Number(status.pool?.current_size ?? 0))}
            <img src={CREDITS} alt="credits" />
          </b>
        </div>
        <div>
          <span>Your share of the pool</span>
          <b className="mono">{share}</b>
        </div>
      </div>
    </BottomSheet>
  )
}

/* ---------- bits ---------- */

export function capLine(p: PoolStatus | undefined): string {
  if (!p || p.weight === 0) return 'nothing staked'
  if (p.maxed) return 'full — claim'
  return `full ${formatToCap(p.msToCap)}`
}

export function ago(ms: number): string {
  const minutes = Math.max(0, ms) / 60_000
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min ago`
  const hours = minutes / 60
  if (hours < 48) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'} ago`
  return `${Math.round(hours / 24)} days ago`
}

export function Ring({ percent, full, big }: { percent: number; full: boolean; big?: boolean }) {
  const r = 40
  const c = 2 * Math.PI * r
  /* A sliver even at zero, so the ring reads as a ring and not an outline. */
  const shown = Math.max(percent, 0.8)
  return (
    <span className={`pfring${big ? ' pfring--big' : ''}${full ? ' pfring--full' : ''}`}>
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r={r} className="pfring__track" />
        <circle
          cx="48"
          cy="48"
          r={r}
          className="pfring__fill"
          strokeDasharray={`${(c * Math.min(100, shown)) / 100} ${c}`}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <b className="mono">
        {percent < 0.05 ? '0%' : `${percent.toFixed(percent < 10 ? 1 : 0)}%`}
      </b>
    </span>
  )
}

function Chevron() {
  return (
    <svg className="pfarm__chev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
