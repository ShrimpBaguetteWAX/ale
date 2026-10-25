import { useEffect, useMemo, useState } from 'react'
import { useGame } from '@/state/useGame'
import { useChainQuery } from '@/chain/useChainQuery'
import { useAction } from '@/wharf/useAction'
import { useModal } from '@/components/useModal'
import { buyMarketSale } from '@/wharf/actions'
import { asset, ipfsImage } from '@/assets'
import { formatNumber } from '@/format'
import {
  fetchMarketCards,
  fetchOwnedTemplates,
  forgetMarketCards,
  forgetOwnedTemplates,
  type AwSchema,
  type MarketCard,
} from '@/chain/atomic'
import { fetchToolTemplates } from '@/pools/queries'
import { fetchNftValues } from '@/dungeon/queries'
import { fetchStakeWeights } from '@/farming/queries'
import { weightOf } from '@/farming/rules'
import {
  fetchSaleRecord,
  MARKET_SCHEMAS,
  rarityRank,
  saleStatus,
  sortCards,
  sortLabel,
  type MarketSort,
} from '@/shop/market'

const TLM = asset('/assets/icons/tlm.svg')
const SHARDS = asset('/assets/icons/shards.svg')
const SORTS: MarketSort[] = ['cheapest', 'dearest', 'power']

/* A balance, rounded down to the hundredth: never more than is there. */
function balanceLabel(wax: number): string {
  const down = Math.floor(wax * 100 + 1e-6) / 100
  return down.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' WAX'
}

/**
 * "0.0480", "670", "6,693.08": a WAX figure as a row shows it.
 *
 * Rounded up, never to the nearest: 0.04790691 shown as 0.0479 would put a
 * price on the button a hair under what is charged. The confirmation shows
 * the exact figure.
 */
export function waxLabel(wax: number): string {
  const places = wax < 10 ? 4 : 2
  const up = Math.ceil(wax * 10 ** places - 1e-6) / 10 ** places
  return up.toLocaleString('en-US', { maximumFractionDigits: places }) + ' WAX'
}

/**
 * The Shop's NFT Market: Alien Worlds tools, crew and weapons for WAX.
 *
 * One row per template — its cheapest open sale on AtomicMarket — with what
 * the card does in this game beside the price: a tool's mining power, a crew
 * or weapon's part of the sixth fighter, and what it would farm. Whether the
 * player already holds one is marked, so they can see what they lack.
 *
 * Buying goes through `shop.ale` as the marketplace and is one transaction
 * that asserts the sale is unchanged, so the price on the button is the price
 * paid or nothing is.
 */
export function MarketTab({ wax }: { wax: number }) {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)
  const { busy, error, run } = useAction()

  const [schema, setSchema] = useState<AwSchema>('tool.worlds')
  const [rarity, setRarity] = useState<string | null>(null)
  const [sort, setSort] = useState<MarketSort>('cheapest')
  const [search, setSearch] = useState('')
  const [buying, setBuying] = useState<MarketCard | null>(null)
  useEffect(() => setRarity(null), [schema])

  const market = useChainQuery(`awmarket:${schema}`, () => fetchMarketCards(schema))
  /* What each card does here: three tables of the game's own, read once. */
  const game = useChainQuery('awmarket:game', async () => {
    const [tools, values, weights] = await Promise.all([
      fetchToolTemplates(),
      fetchNftValues(),
      fetchStakeWeights(),
    ])
    return { tools: new Map(tools.map((t) => [t.template_id, t])), values, weights }
  })
  const owned = useChainQuery(player.wallet && `awmarket:owned:${player.wallet}`, () =>
    fetchOwnedTemplates(player.wallet),
  )

  const cards = market.data ?? []
  const rarities = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of cards) counts.set(c.rarity, (counts.get(c.rarity) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => rarityRank(a[0]) - rarityRank(b[0]))
  }, [cards])

  const power = (c: MarketCard) =>
    c.schema === 'tool.worlds'
      ? (game.data?.tools.get(c.templateId)?.tlm_mp ?? 0)
      : (game.data?.values.get(c.templateId)?.stats.damage ?? 0)

  const needle = search.trim().toLowerCase()
  const shown = sortCards(
    cards.filter(
      (c) => (!rarity || c.rarity === rarity) && (!needle || c.name.toLowerCase().includes(needle)),
    ),
    sort,
    power,
  )

  const buy = (card: MarketCard) => {
    setBuying(null)
    const before = owned.data?.get(card.templateId) ?? 0
    const read = () => {
      forgetOwnedTemplates(player.wallet)
      return fetchOwnedTemplates(player.wallet)
    }
    return run(
      `awmarket:${card.saleId}`,
      () => buyMarketSale(session!, card),
      `${card.name} bought — it is in your wallet.`,
      {
        /* The card lands in the wallet; the indexer shows it a moment later. */
        after: read,
        settled: (fresh) => (fresh.get(card.templateId) ?? 0) > before,
        onSettled: async () => {
          forgetMarketCards(card.schema)
          await Promise.all([market.reload(), owned.reload()])
        },
      },
    )
  }

  const label = MARKET_SCHEMAS.find((s) => s.key === schema)?.label ?? 'Cards'

  return (
    <div className="amk">
      {error && <div className="alert alert--error">{error}</div>}

      <div className="amk__bar">
        <div className="amk__schemas" role="tablist" aria-label="Kind of card">
          {MARKET_SCHEMAS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              className="amk__chip"
              aria-selected={schema === s.key}
              onClick={() => setSchema(s.key)}
            >
              <img src={asset(s.icon)} alt="" />
              {s.label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <input
          className="amk__search"
          type="search"
          placeholder={`Search ${label.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={`Search ${label.toLowerCase()}`}
        />
        <select
          className="amk__sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as MarketSort)}
          aria-label="Sort"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {sortLabel(s, schema)}
            </option>
          ))}
        </select>
      </div>

      {rarities.length > 1 && (
        <div className="outpost__rarities amk__rarities" role="tablist" aria-label="Rarity">
          <button
            type="button"
            role="tab"
            className="outpost__rarity outpost__rarity--all"
            aria-selected={rarity === null}
            onClick={() => setRarity(null)}
          >
            All
            <i>{cards.length}</i>
          </button>
          {rarities.map(([r, n]) => (
            <button
              type="button"
              key={r}
              role="tab"
              className={`outpost__rarity outpost__rarity--${r.toLowerCase()}`}
              aria-selected={rarity === r}
              onClick={() => setRarity(r)}
            >
              {r}
              <i>{n}</i>
            </button>
          ))}
        </div>
      )}

      {market.error && <div className="alert alert--error">{market.error}</div>}

      {market.loading && !market.data ? (
        <div className="amk__rows">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="skeleton amk__row amk__row--loading" key={i} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="hint">No {label.toLowerCase()} on sale match these filters.</p>
      ) : (
        <div className="amk__rows">
          {shown.map((card) => {
            const have = owned.data?.get(card.templateId) ?? 0
            const short = card.wax > wax
            const key = `awmarket:${card.saleId}`
            return (
              <article className="amk__row" key={card.templateId}>
                <img
                  className="amk__art"
                  src={ipfsImage(card.img)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <div className="amk__who">
                  <div className="amk__top">
                    <h3 className="amk__name">{card.name}</h3>
                    <span className={`amk__rarity amk__rarity--${card.rarity.toLowerCase()}`}>
                      {card.rarity} · {card.shine}
                    </span>
                    {have > 0 && (
                      <span className="amk__owned" title="Already in your wallet">
                        Owned{have > 1 ? ` ×${have}` : ''}
                      </span>
                    )}
                  </div>
                  <Benefits card={card} game={game.data} />
                </div>
                <button
                  type="button"
                  className="btn btn--primary amk__buy"
                  disabled={busy !== null || short || !session}
                  title={short ? `Needs ${waxLabel(card.wax - wax)} more than you hold` : undefined}
                  onClick={() => setBuying(card)}
                >
                  {busy === key && <span className="spinner" />}
                  {busy === key ? 'Buying' : waxLabel(card.wax)}
                </button>
              </article>
            )
          })}
        </div>
      )}

      {buying && (
        <ConfirmBuy
          card={buying}
          wax={wax}
          onCancel={() => setBuying(null)}
          onConfirm={() => void buy(buying)}
          onStale={() => {
            setBuying(null)
            forgetMarketCards(buying.schema)
            void market.reload()
          }}
        />
      )}
    </div>
  )
}

type Game = {
  tools: Map<number, { tlm_mp: number; shrd_mp: number }>
  values: Awaited<ReturnType<typeof fetchNftValues>>
  weights: Awaited<ReturnType<typeof fetchStakeWeights>>
}

/** What the card does here, in one line. */
function Benefits({ card, game }: { card: MarketCard; game: Game | undefined }) {
  if (!game) return <div className="amk__ben faint">Reading what it does…</div>
  const farm = weightOf(card, game.weights)
  const farming = farm ? (
    <span className="amk__farm">Farming {formatNumber(farm)}/day</span>
  ) : (
    <span className="amk__none">Can't be farmed</span>
  )

  if (card.schema === 'tool.worlds') {
    const t = game.tools.get(card.templateId)
    return (
      <div className="amk__ben">
        {t ? (
          <>
            <span>
              <img src={TLM} alt="" />
              <b>{formatNumber(t.tlm_mp)}</b> TLM power
            </span>
            <span>
              <img src={SHARDS} alt="" />
              <b>{formatNumber(t.shrd_mp)}</b> shard power
            </span>
          </>
        ) : (
          <span className="amk__none">No mining power in Alien Legends</span>
        )}
        {farming}
      </div>
    )
  }

  const v = game.values.get(card.templateId)
  return (
    <div className="amk__ben">
      {v ? (
        <>
          <span>
            HP <b>{formatNumber(v.stats.health)}</b>
          </span>
          <span>
            DMG <b>{formatNumber(v.stats.damage)}</b>
          </span>
          <span>
            Init <b>{formatNumber(v.stats.initiative)}</b>
          </span>
          {v.ability[0] && (
            <span className="amk__ability" title={v.ability[0].description}>
              ✦ {v.ability[0].displayname}
            </span>
          )}
        </>
      ) : (
        <span className="amk__none">Not usable in a fight</span>
      )}
      {farming}
    </div>
  )
}

/**
 * The confirmation. It reads the sale from the chain as it opens, and only
 * offers the button while the sale is still exactly what the row showed.
 */
function ConfirmBuy({
  card,
  wax,
  onCancel,
  onConfirm,
  onStale,
}: {
  card: MarketCard
  wax: number
  onCancel: () => void
  onConfirm: () => void
  onStale: () => void
}) {
  const panel = useModal(onCancel)
  const check = useChainQuery(`awmarket:sale:${card.saleId}`, () => fetchSaleRecord(card.saleId))
  const status = check.loading ? 'checking' : check.error ? 'error' : saleStatus(card, check.data)

  return (
    <div className="confirm" role="dialog" aria-modal="true" aria-label="Confirm purchase" onClick={onCancel}>
      <div className="confirm__panel panel" ref={panel} onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm__title">Buy {card.name}</h2>

        <div className="confirm__deal">
          <div className="confirm__side">
            <span className="confirm__label">You pay</span>
            <span className="confirm__value confirm__value--cost mono">{card.price}</span>
            <span className="faint confirm__sub">exactly — no fee on top</span>
          </div>
          <span className="confirm__arrow" aria-hidden="true">
            →
          </span>
          <div className="confirm__side">
            <span className="confirm__label">You receive</span>
            <img className="amk__confirmart" src={ipfsImage(card.img)} alt="" />
            <span className="faint confirm__sub">into your WAX wallet</span>
          </div>
        </div>

        <div className="confirm__balance">
          <div className="statline">
            <span className="statline__k">Your WAX balance</span>
            <span className="statline__v mono">{balanceLabel(wax)}</span>
          </div>
          <div className="statline">
            <span className="statline__k">After this purchase</span>
            <span className="statline__v mono">{balanceLabel(Math.max(0, wax - card.wax))}</span>
          </div>
        </div>

        {status === 'ok' && (
          <p className="amk__safe">
            Checked again when you sign: if this sale's price or card changes, or it sells first,
            the purchase is cancelled and nothing is spent.
          </p>
        )}
        {status === 'checking' && <p className="hint">Checking the sale is still open…</p>}
        {(status === 'gone' || status === 'changed') && (
          <p className="alert alert--error">
            {status === 'gone'
              ? 'This sale has just closed — someone bought it, or the seller took it down.'
              : 'This sale has changed since the list was read.'}{' '}
            Nothing was spent.
          </p>
        )}
        {status === 'error' && (
          <p className="alert alert--error">The sale could not be checked. Try again in a moment.</p>
        )}

        <div className="confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          {status === 'gone' || status === 'changed' ? (
            <button type="button" className="btn btn--primary" onClick={onStale}>
              Show the current price
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={status !== 'ok'}
              onClick={onConfirm}
            >
              Buy for {waxLabel(card.wax)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The NFT Market's side column: the WAX there is to spend, and what these
 * cards are for in this game.
 */
export function MarketGuide({ wax }: { wax: number }) {
  const uses: [string, string, string][] = [
    [
      '/assets/icons/menu/rewards.png',
      'Tools · mining',
      'Equip up to three. Their TLM and shard power set the Reward Power every win banks.',
    ],
    [
      '/assets/icons/menu/sword.png',
      'Crew + weapon · a sixth fighter',
      'Bring one of each into a dungeon, arena or tournament. Their stats add up; the weapon sets the element.',
    ],
    [
      '/assets/icons/menu/card.png',
      'Farming · credits',
      "Stake spare cards for credits. Power comes from rarity and shine; Abundant can't be staked.",
    ],
    [
      '/assets/markers/tavern.svg',
      'Taverns · cheaper hires',
      "Cards that match a tavern's objectives cut the energy a hire costs.",
    ],
  ]
  return (
    <aside className="cguide amk__guide" aria-label="What these cards do here">
      <section className="cguide__card is-here">
        <header className="cguide__head">
          <img src={asset('/assets/icons/wax-coin.png')} alt="" />
          <b>Your WAX</b>
          <span className="cguide__bal mono">{balanceLabel(wax)}</span>
        </header>
      </section>
      <h2 className="cguide__title">What these cards do here</h2>
      <section className="cguide__card">
        {uses.map(([icon, title, text]) => (
          <div className="amk__use" key={title}>
            <img src={asset(icon)} alt="" />
            <b>{title}</b>
            <span>{text}</span>
          </div>
        ))}
      </section>
      <p className="amk__safe">
        <b>You pay exactly the price shown.</b> Each card is its cheapest sale on AtomicMarket. The
        purchase checks the sale on chain first; if its price or card changed, or someone bought it,
        nothing leaves your wallet.
      </p>
    </aside>
  )
}
