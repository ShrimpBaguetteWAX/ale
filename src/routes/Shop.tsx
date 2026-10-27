import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { fetchShopCooldowns, fetchWaxBalance } from '@/shop/queries'
import {
  canBuy,
  cooldownUntil,
  formatCountdown,
  isFree,
  isLegend,
  isWaxPriced,
  itemArt,
  formatWax,
  legendExpiry,
  dailyFlasks,
  priceOf,
  legendLeft,
  rewardOf,
  rateOf,
  leftAfter,
  valueAgainst,
  valueLine,
  waxAmount,
  type PackValue,
} from '@/shop/rules'
import {
  LEGEND_VS_TRIAL,
  SHOP_CATEGORIES,
  type ShopCooldown,
  type ShopItem,
} from '@/shop/types'
import { buyShopItem, buyShopItemWithWax, DIRTIES } from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { useChainQuery } from '@/chain/useChainQuery'
import { useLazyConfig } from '@/state/useConfig'
import { asset, artSet } from '@/assets'
import { NUM_LOCALE } from '@/format'
import { OutpostTab } from '@/outpost/OutpostTab'
import { CurrencyGuide } from '@/shop/CurrencyGuide'
import { MarketGuide, MarketTab } from '@/shop/MarketTab'
import { usePhone } from '@/components/usePhone'
import { Showcase, type ShowcaseTile } from '@/shop/Showcase'
import type { Player } from '@/chain/types'

const EMPTY_COOLDOWNS: ShopCooldown[] = []

function Amount({ label, icon }: { label: string; icon?: string }) {
  return (
    <span className="amount">
      {icon && <img src={icon} alt="" width={18} height={18} />}
      {label}
    </span>
  )
}

export default function Shop() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)

  /* The catalogue is the same for everybody; the cooldowns and the WAX
     balance are this wallet's. */
  const items = useLazyConfig('shopItems') ?? null

  const own = useChainQuery(
    player.wallet && `shop:${player.wallet}`,
    async () => {
      const [cd, balance] = await Promise.all([
        fetchShopCooldowns(player.wallet).catch(() => [] as ShopCooldown[]),
        fetchWaxBalance(player.wallet).catch(() => undefined),
      ])
      return { cooldowns: cd, wax: parseFloat(balance ?? '0') || 0 }
    },
    { deps: ['shopCooldowns'] },
  )
  const cooldowns = own.data?.cooldowns ?? EMPTY_COOLDOWNS
  const wax = own.data?.wax ?? 0
  /*
     Readable from the URL so other screens can send a player straight to the
     section they need — the CPU tab links here for a Legend pass. Anything
     unrecognised falls back to the first tab.
   */
  const phone = usePhone()
  const tabs = SHOP_CATEGORIES
  const [params, setParams] = useSearchParams()
  const category = tabs.find((c) => c.key === params.get('c'))?.key ?? tabs[0].key
  const setCategory = (key: string) =>
    setParams(key === SHOP_CATEGORIES[0].key ? {} : { c: key }, { replace: true })
  const [confirming, setConfirming] = useState<ShopItem | null>(null)
  const { busy, error, run } = useAction()
  // Ticks once a second so the cooldown countdowns stay honest.
  const [, setTick] = useState(0)

  const legend = isLegend(player)
  const expiry = legendExpiry(player)

  // Only run the clock while something is actually counting down.
  const anyCooldown = useMemo(
    () => (items ?? []).some((i) => cooldownUntil(i, cooldowns)),
    [items, cooldowns],
  )
  useEffect(() => {
    if (!anyCooldown) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [anyCooldown])

  const shown = useMemo(
    () =>
      (items ?? [])
        .filter((i) => i.category === category)
        // Cheapest first, so the ladder reads in one direction.
        .sort(
          (a, b) =>
            waxAmount(a.cost_wax) - waxAmount(b.cost_wax) ||
            a.cost_gem - b.cost_gem ||
            a.cost_dust - b.cost_dust ||
            a.gain_action_points - b.gain_action_points,
        ),
    [items, category],
  )
  /* "+22%", "save 17%": what each rung gives over the bottom one. */
  const values = useMemo(() => valueAgainst(shown), [shown])
  /* The daily flask with and without Legend, in energy, for the benefits. */
  const flasks = useMemo(() => dailyFlasks(items ?? []), [items])
  const energy = (n: number) => n.toLocaleString(NUM_LOCALE)

  const buy = (item: ShopItem) => {
    setConfirming(null)
    return run(
      item.item,
      () =>
        isWaxPriced(item)
          ? buyShopItemWithWax(session!, item.item, item.cost_wax)
          : buyShopItem(session!, item.item),
      `${item.title} purchased.`,
      {
        // Balances move on the player row, which the hook refreshes itself.
        intervalMs: 700,
        /* Cooldowns move once and stay moved, so they are read after the
           waiting rather than on every attempt. */
        onSettled: async () => {
          await own.reload()
        },
        /* Balances on the player row, and the cooldown row the purchase just
           wrote — both stale for every other screen the moment this returns. */
        dirties: isWaxPriced(item) ? DIRTIES.buyShopItemWithWax : DIRTIES.buyShopItem,
      },
    )
  }

  return (
    <div className="shop">
      <img className="shop__art" {...artSet('bg-shop')} alt="" />
      <div className="shop__scrim" />

      <div className="shop__inner">
        <header className="shop__head">
          <h1 className="page__title">Shop</h1>
          <span className="spacer" />
          <div className="shop__status">
            <span className={`tag ${legend ? 'tag--legend' : ''}`}>
              {legend ? 'Legend' : 'Trial'}
            </span>
            <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
              {legend && expiry ? legendLeft(expiry.getTime() - Date.now()) : 'Trial account'}
            </span>
          </div>
        </header>

        {error && <div className="alert alert--error">{error}</div>}

        <div className="tabs" role="tablist">
          {tabs.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              className="tabs__tab"
              aria-selected={category === c.key}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/*
          Gem packs are the one thing paid for with real money, so the wallet
          balance belongs on screen rather than in the wallet popup — it is
          what tells you which rung you can reach.
        */}
        {phone && category === 'gems' && (
          <div className="waxbar">
            <span className="waxbar__label">Your current WAX balance</span>
            <span className="waxbar__value mono">{formatWax(wax)} WAX</span>
          </div>
        )}

        <ShopBoard
          phone={phone}
          guide={
            category === 'market' ? (
              <MarketGuide wax={wax} />
            ) : (
              <CurrencyGuide player={player} wax={wax} category={category} />
            )
          }
        >
        {/*
          The Outpost is somebody else's shop and shares none of this
          screen's data: different contract, different currency, and an NFT
          rather than a balance. So it renders itself and the shop's own item
          grid sits out.
        */}
        {category === 'outpost' ? (
          <OutpostTab />
        ) : category === 'market' ? (
          <MarketTab wax={wax} />
        ) : !items ? (
          <div className="packgrid">
            {Array.from({ length: 4 }, (_, i) => (
              <div className="skeleton pack pack--loading" key={i} />
            ))}
          </div>
        ) : (
          <div className="packgrid">
            {shown.map((item) => {
              const { canBuy: allowed, reason, detail } = canBuy(item, player, cooldowns, wax)
              const until = cooldownUntil(item, cooldowns)
              const price = priceOf(item)
              const reward = rewardOf(item)
              const legendOnly = !item.trial_availability

              return (
                <article
                  className={`pack${allowed ? '' : ' pack--blocked'}`}
                  key={item.item}
                >
                  <div className="pack__art">
                    <img src={itemArt(item)} alt="" loading="lazy" decoding="async" />
                    {legendOnly && <span className="pack__badge">Legend</span>}
                    {isFree(item) && !legendOnly && (
                      <span className="pack__badge pack__badge--free">Daily</span>
                    )}
                  </div>

                  <div className="pack__body">
                    <h2 className="pack__title">{item.title}</h2>
                    <div className="pack__offer">
                      <Amount label={reward.label} icon={reward.icon} />
                      {values.has(item.item) && (
                        <span className="pack__value">{values.get(item.item)!.badge}</span>
                      )}
                    </div>
                    {!phone && rateOf(item) && (
                      <span className="pack__rate">
                        {rateOf(item)}
                        {/* What the badge is measured against: the bottom rung's own rate. */}
                        {values.has(item.item) && (
                          <small className="pack__vs">
                            vs {rateOf(values.get(item.item)!.base)?.split(' ')[0]} on {values.get(item.item)!.base.title}
                          </small>
                        )}
                      </span>
                    )}

                    {/*
                      The button carries the price when you can buy and the
                      blocker when you cannot, rather than growing a line of
                      red text underneath — that line only appeared on some
                      cards and knocked every button in the row out of line.
                    */}
                    <button
                      type="button"
                      className={`btn ${isFree(item) ? 'btn--gold' : 'btn--primary'} btn--block`}
                      onClick={() => setConfirming(item)}
                      disabled={busy !== null || !allowed}
                      title={detail}
                    >
                      {busy === item.item && <span className="spinner" />}
                      {busy === item.item ? (
                        'Buying'
                      ) : until ? (
                        `Ready in ${formatCountdown(until)}`
                      ) : !allowed && reason ? (
                        reason
                      ) : (
                        <Amount label={price.label} icon={price.icon} />
                      )}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {category === 'account' && (
          <section className="panel legendcard">
            <div className="panel__title">Trial against Legend</div>
            <div className="legendvs" role="table" aria-label="Trial against Legend">
              <div className="legendvs__row legendvs__row--head" role="row">
                <span role="columnheader" />
                <span role="columnheader">Trial</span>
                <span role="columnheader" className="legendvs__legend">
                  Legend
                </span>
              </div>
              {LEGEND_VS_TRIAL.map(([what, trial, legendHas], i) => (
                <div className="legendvs__row" role="row" key={what}>
                  <span role="rowheader">{what}</span>
                  <span role="cell" className="legendvs__trial">
                    {flasks && i === 3 ? energy(flasks.trial) : trial}
                  </span>
                  <span role="cell" className="legendvs__legend">
                    {flasks && i === 3 ? energy(flasks.legend) : legendHas}
                  </span>
                </div>
              ))}
            </div>
            <p className="hint">
              A pass extends whatever time you already have — buying again while
              active adds to it.
            </p>
          </section>
        )}
        </ShopBoard>
      </div>

      {confirming && (
        <ConfirmPurchase
          item={confirming}
          value={values.get(confirming.item)}
          player={player}
          wax={wax}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void buy(confirming)}
        />
      )}
    </div>
  )
}

/**
 * The tab's goods, and on a desktop the currencies beside them.
 *
 * A phone has the width for the list alone. A desktop has room for what the
 * list cannot say — what each currency on these buttons is actually for — so
 * the guide sits in a column of its own on the right.
 */
function ShopBoard({
  phone,
  guide,
  children,
}: {
  phone: boolean
  guide: React.ReactNode
  children: React.ReactNode
}) {
  if (phone) return <>{children}</>
  return (
    <div className="shop__board">
      <div className="shop__main">{children}</div>
      {guide}
    </div>
  )
}

/**
 * A purchase, as the showcase: the pack large, what it gives as
 * tiles, and its bonus spelled out against the pack it is measured from —
 * "+8%" alone left players guessing what it was more than.
 */
function ConfirmPurchase({
  item,
  value,
  player,
  wax,
  onCancel,
  onConfirm,
}: {
  item: ShopItem
  value: PackValue | undefined
  player: Player
  wax: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const price = priceOf(item)
  const reward = rewardOf(item)
  const free = isFree(item)
  const rate = rateOf(item)
  const tiles: ShowcaseTile[] = [{ label: rewardName(item), icon: reward.icon, value: reward.label }]
  if (rate && !item.gain_legend_acct_seconds) {
    const [figure, ...rest] = rate.split(' ')
    tiles.push({ label: rest.join(' '), value: figure })
  }
  if (value) tiles.push({ label: 'Bonus', value: value.badge, good: true })
  return (
    <Showcase
      label={`Buy ${item.title}`}
      art={itemArt(item)}
      pack
      name={item.title}
      tiles={tiles}
      line={value && <span className="bshow__bonus">{valueLine(item, value)}</span>}
      price={price.label}
      priceIcon={isWaxPriced(item) ? asset('/assets/icons/wax-coin.webp') : price.icon}
      leaves={leftAfter(item, player, wax)}
      fine={
        free
          ? 'Free — added to your account at once.'
          : isWaxPriced(item)
            ? 'Paid from your WAX wallet. It cannot be undone.'
            : 'Added to your account at once. It cannot be undone.'
      }
      action={{ label: free ? 'Claim' : 'Buy', onClick: onConfirm, gold: free }}
      onCancel={onCancel}
    />
  )
}

/* What a pack's reward is called on its tile. */
function rewardName(item: ShopItem): string {
  if (item.gain_gem > 0) return 'Gems'
  if (item.gain_dust > 0) return 'Credits'
  if (item.gain_action_points > 0) return 'Energy'
  return 'Legend'
}

