import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import {
  fetchShopCooldowns,
  fetchShopItems,
  fetchWaxBalance,
} from '@/shop/queries'
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
  priceOf,
  rewardOf,
  waxAmount,
} from '@/shop/rules'
import {
  LEGEND_BENEFITS,
  SHOP_CATEGORIES,
  type ShopCooldown,
  type ShopItem,
} from '@/shop/types'
import { buyShopItem, buyShopItemWithWax } from '@/wharf/actions'
import { refreshChore } from '@/chores/signal'
import { readableError } from '@/wharf/errors'
import { asset } from '@/assets'

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
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [items, setItems] = useState<ShopItem[] | null>(null)
  const [cooldowns, setCooldowns] = useState<ShopCooldown[]>([])
  const [wax, setWax] = useState<number>(0)
  /*
     Readable from the URL so other screens can send a player straight to the
     section they need — the CPU tab links here for a Legend pass. Anything
     unrecognised falls back to the first tab.
   */
  const [params, setParams] = useSearchParams()
  const category =
    SHOP_CATEGORIES.find((c) => c.key === params.get('c'))?.key ??
    SHOP_CATEGORIES[0].key
  const setCategory = (key: string) =>
    setParams(key === SHOP_CATEGORIES[0].key ? {} : { c: key }, { replace: true })
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<ShopItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Ticks once a second so the cooldown countdowns stay honest.
  const [, setTick] = useState(0)

  const legend = isLegend(player)
  const expiry = legendExpiry(player)

  useEffect(() => {
    fetchShopItems()
      .then(setItems)
      .catch((err) => setError(readableError(err)))
  }, [])

  const reloadPlayerState = useCallback(async () => {
    const [cd, balance] = await Promise.all([
      fetchShopCooldowns(player.wallet, true).catch(() => [] as ShopCooldown[]),
      fetchWaxBalance(player.wallet).catch(() => undefined),
    ])
    setCooldowns(cd)
    setWax(parseFloat(balance ?? '0') || 0)
  }, [player.wallet])

  useEffect(() => {
    void reloadPlayerState()
  }, [reloadPlayerState])

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

  const buy = async (item: ShopItem) => {
    if (!session) return
    setConfirming(null)
    setBusy(item.item)
    setError(null)
    setNotice(null)
    try {
      if (isWaxPriced(item)) {
        await buyShopItemWithWax(session, item.item, item.cost_wax)
      } else {
        await buyShopItem(session, item.item)
      }

      // Balances and cooldowns both move; poll until the player row catches up.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 700))
        await refreshPlayer({ force: true })
      }
      await reloadPlayerState()
      /* The daily flask may have just gone on cooldown. */
      refreshChore('shop')
      setNotice(`${item.title} purchased.`)
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(null)
    }
  }

  const active = SHOP_CATEGORIES.find((c) => c.key === category)

  return (
    <div className="shop">
      <img className="shop__art" src={asset("/assets/background/bg-shop.png")} alt="" />
      <div className="shop__scrim" />

      <div className="shop__inner">
        <header className="shop__head">
          <div>
            <h1 className="page__title">Shop</h1>
            <p className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
              WAX buys gems · gems buy credits and Legend · credits buy energy
            </p>
          </div>
          <span className="spacer" />
          <div className="shop__status">
            <span className={`tag ${legend ? 'tag--legend' : ''}`}>
              {legend ? 'Legend' : 'Trial'}
            </span>
            <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
              {legend && expiry
                ? `until ${expiry.toISOString().slice(0, 10)}`
                : 'Trial account'}
            </span>
          </div>
        </header>

        {error && <div className="alert alert--error">{error}</div>}
        {notice && <div className="alert alert--ok">{notice}</div>}

        <div className="tabs" role="tablist">
          {SHOP_CATEGORIES.map((c) => (
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

        <p className="hint" style={{ marginTop: 0 }}>
          {active?.blurb}
        </p>

        {/*
          Gem packs are the one thing paid for with real money, so the wallet
          balance belongs on screen rather than in the wallet popup — it is
          what tells you which rung you can reach.
        */}
        {category === 'gems' && (
          <div className="waxbar">
            <span className="waxbar__label">Your current WAX balance</span>
            <span className="waxbar__value mono">{formatWax(wax)} WAX</span>
          </div>
        )}

        {!items ? (
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
                    </div>

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
            <div className="panel__title">Legend account benefits</div>
            <ul className="benefits">
              {LEGEND_BENEFITS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="hint">
              A pass extends whatever time you already have — buying again while
              active adds to it.
            </p>
          </section>
        )}
      </div>

      {confirming && (
        <ConfirmPurchase
          item={confirming}
          wax={wax}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void buy(confirming)}
        />
      )}
    </div>
  )
}

/**
 * Purchases are irreversible and some of them cost real money, so nothing is
 * signed until the player has seen exactly what leaves and what arrives.
 */
function ConfirmPurchase({
  item,
  wax,
  onCancel,
  onConfirm,
}: {
  item: ShopItem
  wax: number
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel])

  const price = priceOf(item)
  const reward = rewardOf(item)
  const withWax = isWaxPriced(item)
  const remaining = wax - waxAmount(item.cost_wax)

  return (
    <div
      className="confirm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm purchase"
      onClick={onCancel}
    >
      <div className="confirm__panel panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm__title">You are about to exchange the following</h2>

        <div className="confirm__deal">
          <div className="confirm__side">
            <span className="confirm__label">You pay</span>
            <span className="confirm__value confirm__value--cost">
              <Amount label={price.label} icon={price.icon} />
            </span>
          </div>
          <span className="confirm__arrow" aria-hidden="true">
            →
          </span>
          <div className="confirm__side">
            <span className="confirm__label">You receive</span>
            <span className="confirm__value confirm__value--gain">
              <Amount label={reward.label} icon={reward.icon} />
            </span>
          </div>
        </div>

        <div className="confirm__item">
          <img src={itemArt(item)} alt="" width={56} height={56} />
          <div>
            <div className="confirm__name">{item.title}</div>
            <div className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
              {item.offer_name}
            </div>
          </div>
        </div>

        {withWax && (
          <div className="confirm__balance">
            <div className="statline">
              <span className="statline__k">Your current WAX balance</span>
              <span className="statline__v mono">{formatWax(wax)} WAX</span>
            </div>
            <div className="statline">
              <span className="statline__k">After this purchase</span>
              <span className="statline__v mono">{formatWax(remaining)} WAX</span>
            </div>
            <p className="hint">
              This sends WAX from your wallet to the shop. It cannot be undone.
            </p>
          </div>
        )}

        <div className="confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            Confirm exchange
          </button>
        </div>
      </div>
    </div>
  )
}
