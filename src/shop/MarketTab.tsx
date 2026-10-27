import { useEffect, useMemo, useState } from 'react'
import { useGame } from '@/state/useGame'
import { useChainQuery } from '@/chain/useChainQuery'
import { useAction } from '@/wharf/useAction'
import { usePhone } from '@/components/usePhone'
import { buyMarketSale } from '@/wharf/actions'
import { asset, ipfsImage, ipfsPreview } from '@/assets'
import { GameImg } from '@/components/GameImg'
import { formatNumber } from '@/format'
import {
  fetchAssetTemplates,
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
import { nftAsPanel } from '@/dungeon/nftFighter'
import { formatScaled, STAT_LABEL } from '@/tavern/fighterStats'
import { FighterAbilities, FighterStats } from '@/components/FighterPanel'
import {
  fetchSaleRecord,
  MARKET_SCHEMAS,
  rarityRank,
  saleStatus,
  sortCards,
  sortLabel,
  toolGain,
  type BagTool,
  type MarketSort,
} from '@/shop/market'
import { MINING_POWER } from '@/account/rules'
import { CardTags, rarityEdge, Showcase, type ShowcaseTile } from '@/shop/Showcase'

const SORTS: MarketSort[] = ['cheapest', 'dearest', 'power']

/* A balance, rounded down to the hundredth: never more than is there. */
function balanceLabel(wax: number): string {
  const down = Math.floor(wax * 100 + 1e-6) / 100
  return down.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' WAX'
}

/* Whole cents as a figure: 5 → "0.05", 67000 → "670", 669309 → "6,693.09". */
function centsLabel(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' WAX'
}

/**
 * A sale's price as every button and line shows it: two decimals at most,
 * rounded **up**. "0.04790691 WAX" is "0.05 WAX", and even 0.000001 WAX is
 * "0.01 WAX" — what is shown is never under what is charged.
 *
 * Worked in whole units of the token from the asset string, not in floating
 * point, so no rounding error can ever take a price down a cent.
 */
export function priceLabel(price: string): string {
  const [amount] = price.split(' ')
  const [whole, frac = ''] = amount.split('.')
  const units = BigInt(whole + frac.padEnd(8, '0').slice(0, 8))
  const perCent = BigInt(1_000_000)
  return centsLabel(Number((units + perCent - BigInt(1)) / perCent))
}

/** A worked-out WAX figure, the same way: two decimals, rounded up. */
export function waxLabel(wax: number): string {
  return centsLabel(Math.ceil(wax * 100 - 1e-9))
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
  const phone = usePhone()

  const [schema, setSchema] = useState<AwSchema>('tool.worlds')
  const [rarity, setRarity] = useState<string | null>(null)
  const [sort, setSort] = useState<MarketSort>('cheapest')
  const [search, setSearch] = useState('')
  const [buying, setBuying] = useState<MarketCard | null>(null)
  /* One row open at a time, showing everything the card does here. */
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    setRarity(null)
    setOpen(null)
  }, [schema])

  /*
     Tagged with the kind it was read for: the query holds the last kind's
     list until the new one lands, and showing it under the new chip looked
     like the switch had done nothing.
  */
  const market = useChainQuery(`awmarket:${schema}`, async () => ({
    schema,
    cards: await fetchMarketCards(schema),
  }))
  const current = market.data?.schema === schema ? market.data : undefined
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
  /* The tools the player mines with now, for what a tool here would add. */
  const equipped = (player.mine_nfts ?? []).map(String)
  const equippedTemplates = useChainQuery(`awmarket:bag:${equipped.join(',')}`, () =>
    fetchAssetTemplates(equipped),
  )
  const bag: BagTool[] | undefined =
    game.data && equippedTemplates.data
      ? equipped.flatMap((id) => {
          const templateId = equippedTemplates.data!.get(id)
          const t = templateId !== undefined ? game.data!.tools.get(templateId) : undefined
          return t ? [{ templateId: t.template_id, name: t.toolname, tlm: t.tlm_mp, shrd: t.shrd_mp }] : []
        })
      : undefined

  const cards = current?.cards ?? []
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

      {phone && (
        <div className="waxbar">
          <span className="waxbar__label">Your WAX</span>
          <span className="waxbar__value mono">{balanceLabel(wax)}</span>
        </div>
      )}

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
        {/*
          A phone has no room for a row of rarity chips, so rarity is a
          dropdown beside the sort, counts and all.
        */}
        {phone && rarities.length > 1 && (
          <select
            className="amk__sort"
            value={rarity ?? ''}
            onChange={(e) => setRarity(e.target.value || null)}
            aria-label="Rarity"
          >
            <option value="">All rarities ({cards.length})</option>
            {rarities.map(([r, n]) => (
              <option key={r} value={r}>
                {r} ({n})
              </option>
            ))}
          </select>
        )}
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

      {!phone && rarities.length > 1 && (
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

      {!current ? (
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
              <article
                className={`amk__row${open === card.templateId ? ' is-open' : ''}`}
                key={card.templateId}
              >
                <button
                  type="button"
                  className="amk__open"
                  aria-expanded={open === card.templateId}
                  onClick={() => setOpen(open === card.templateId ? null : card.templateId)}
                >
                {/* The game's own small copy of the card by its template; the IPFS original only if it is missing. */}
                <GameImg
                  className="amk__art"
                  src={asset(`/assets/cards/${card.templateId}.webp`)}
                  fallback={[ipfsImage(card.img), asset('/assets/default-card.png')].filter((u): u is string => !!u)}
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
                  <Benefits card={card} game={game.data} bag={bag} />
                </div>
                <svg className="amk__chev" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
                </button>
                <button
                  type="button"
                  className="btn btn--primary amk__buy"
                  disabled={busy !== null || short || !session}
                  title={short ? `Needs ${waxLabel(card.wax - wax)} more than you hold` : undefined}
                  onClick={() => setBuying(card)}
                >
                  {busy === key && <span className="spinner" />}
                  {busy === key ? 'Buying' : priceLabel(card.price)}
                </button>
                {open === card.templateId && game.data && (
                  <Details card={card} game={game.data} bag={bag} />
                )}
                {open === card.templateId && phone && (
                  <button
                    type="button"
                    className="btn btn--primary btn--block amk__morebuy"
                    disabled={busy !== null || short || !session}
                    onClick={() => setBuying(card)}
                  >
                    {busy === key && <span className="spinner" />}
                    {busy === key ? 'Buying' : `Buy for ${priceLabel(card.price)}`}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}

      {buying && (
        <ConfirmBuy
          card={buying}
          wax={wax}
          game={game.data}
          bag={bag}
          owned={owned.data?.get(buying.templateId) ?? 0}
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
  tools: Map<number, { template_id: number; toolname: string; tlm_mp: number; shrd_mp: number }>
  values: Awaited<ReturnType<typeof fetchNftValues>>
  weights: Awaited<ReturnType<typeof fetchStakeWeights>>
}

/**
 * Everything the card does here, under its row: a crew or weapon as the
 * game's own fighter panel — its stats, six resistances and every ability
 * written out — and a tool's mining numbers.
 */
function Details({ card, game, bag }: { card: MarketCard; game: Game; bag?: BagTool[] }) {
  if (card.schema === 'tool.worlds') {
    const t = game.tools.get(card.templateId)
    if (!t) {
      return (
        <div className="amk__more">
          <p className="amk__none">This tool has no mining power in Alien Legends.</p>
        </div>
      )
    }
    const sum = (b: BagTool[]) => ({
      tlm: b.reduce((n, x) => n + x.tlm, 0),
      shrd: b.reduce((n, x) => n + x.shrd, 0),
    })
    const gain = bag ? toolGain({ tlm: t.tlm_mp, shrd: t.shrd_mp }, bag) : undefined
    const now = bag ? sum(bag) : undefined
    return (
      <div className="amk__more">
        {bag && gain && now ? (
          <div className="amk__bag">
            <div>
              <h4 className="amk__morecap">Your tools now</h4>
              <ul className="amk__baglist">
                {bag.map((b, i) => (
                  <li
                    key={i}
                    className={gain.kind === 'replace' && gain.replaces === b ? 'is-out' : undefined}
                  >
                    <span>{b.name}</span>
                    <Power tlm={b.tlm} shrd={b.shrd} />
                  </li>
                ))}
                {Array.from({ length: Math.max(0, 3 - bag.length) }, (_, i) => (
                  <li key={`empty-${i}`} className="is-empty">
                    <span>Empty slot</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="amk__with">
              <span>
                Equipped now
                <Power tlm={now.tlm} shrd={now.shrd} />
              </span>
              <span>
                {gain.kind === 'empty' ? 'With this in your empty slot' : `With this instead of your ${gain.replaces.name}`}
                <Power tlm={now.tlm + gain.tlm} shrd={now.shrd + gain.shrd} />
                <Gain gain={gain} />
              </span>
            </div>
          </div>
        ) : (
          <p className="faint">Reading your equipped tools…</p>
        )}
        <p className="amk__note">
          Equip up to three tools under Rewards. Their TLM and shard power set the Reward Power every
          dungeon and arena win banks.
        </p>
      </div>
    )
  }

  const v = game.values.get(card.templateId)
  if (!v) {
    return (
      <div className="amk__more">
        <p className="amk__none">This card has no value in a fight here.</p>
      </div>
    )
  }
  const weapon = card.schema === 'arms.worlds'
  return (
    <div className="amk__more amk__more--fighter">
      <div>
        <h4 className="amk__morecap">As your sixth fighter</h4>
        <FighterStats fighter={nftAsPanel(v, card.name)} />
      </div>
      <div>
        <h4 className="amk__morecap">Abilities · {v.ability.length}</h4>
        {v.ability.length ? (
          <FighterAbilities abilities={v.ability} />
        ) : (
          <p className="amk__none">No ability.</p>
        )}
        <p className="amk__note">
          {weapon
            ? `Paired with a crew card, it joins a dungeon, arena or tournament fight. Their stats add up, and this weapon's element — ${v.element || 'neutral'} — becomes the fighter's.`
            : "Paired with a weapon, it joins a dungeon, arena or tournament fight. Their stats add up; the weapon sets the fighter's element."}
        </p>
      </div>
    </div>
  )
}

/** A tool's mining power, the way the Rewards page shows it. */
function Power({ tlm, shrd }: { tlm: number; shrd: number }) {
  const [t, sh] = MINING_POWER
  return (
    <span className="amk__power">
      <span title={t.hint}>
        <img src={t.icon} alt={t.label} />
        {formatNumber(tlm)}
      </span>
      <span title={sh.hint}>
        <img src={sh.icon} alt={sh.label} />
        {formatNumber(shrd)}
      </span>
    </span>
  )
}

/** What a tool would add: to an empty slot, or over the weakest tool. */
function Gain({ gain }: { gain: ReturnType<typeof toolGain> }) {
  const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + formatNumber(Math.abs(n))
  if (gain.tlm <= 0 && gain.shrd <= 0) {
    return <span className="amk__gain is-none">No gain over your {gain.kind === 'replace' ? gain.replaces.name : 'tools'}</span>
  }
  /* A trade — more of one, less of the other — shows its loss as a loss. */
  const part = (n: number, unit: string) => (
    <b className={n < 0 ? 'is-down' : undefined}>
      {signed(n)} {unit}
    </b>
  )
  return (
    <span className="amk__gain">
      <span className="amk__gainfig">
        {part(gain.tlm, 'TLM')} · {part(gain.shrd, 'shard')}
      </span>
      <small>{gain.kind === 'empty' ? 'in your empty slot' : `over your ${gain.replaces.name}`}</small>
    </span>
  )
}

/** What the card does here, in one line. */
function Benefits({ card, game, bag }: { card: MarketCard; game: Game | undefined; bag?: BagTool[] }) {
  if (!game) return <div className="amk__ben faint">Reading what it does…</div>
  const farm = weightOf(card, game.weights)
  const farming = farm ? (
    <span className="amk__farm">Farming {formatNumber(farm)}/day</span>
  ) : (
    <span className="amk__none">Can't be farmed</span>
  )

  if (card.schema === 'tool.worlds') {
    const t = game.tools.get(card.templateId)
    if (!t) return <div className="amk__ben amk__none">No mining power in Alien Legends</div>
    return (
      <div className="amk__ben">
        <Power tlm={t.tlm_mp} shrd={t.shrd_mp} />
        {bag && <Gain gain={toolGain({ tlm: t.tlm_mp, shrd: t.shrd_mp }, bag)} />}
      </div>
    )
  }

  const v = game.values.get(card.templateId)
  return (
    <div className="amk__ben">
      {v ? (
        <>
          {/* In the game's own units and names, as the fighter panel below shows them. */}
          <span>
            {STAT_LABEL.damage} <b>{formatScaled(v.stats.damage)}</b>
          </span>
          <span>
            {STAT_LABEL.health} <b>{formatScaled(v.stats.health)}</b>
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
  game,
  bag,
  owned,
  onCancel,
  onConfirm,
  onStale,
}: {
  card: MarketCard
  wax: number
  game: Game | undefined
  bag: BagTool[] | undefined
  owned: number
  onCancel: () => void
  onConfirm: () => void
  onStale: () => void
}) {
  const check = useChainQuery(`awmarket:sale:${card.saleId}`, () => fetchSaleRecord(card.saleId))
  const status = check.loading ? 'checking' : check.error ? 'error' : saleStatus(card, check.data)
  const title = `Buy ${card.name}`

  const stale = status === 'gone' || status === 'changed'
  const { tiles, line } = cardFigures(card, game, bag)
  return (
    <Showcase
      label={title}
      art={ipfsPreview(card.img) ?? ipfsImage(card.img)}
      artFallback={ipfsImage(card.img)}
      edge={rarityEdge(card.rarity)}
      name={card.name}
      tags={<CardTags rarity={card.rarity} shine={card.shine} owned={owned} />}
      tiles={tiles}
      line={line}
      price={priceLabel(card.price)}
      priceIcon={WAX_ICON}
      leaves={balanceLabel(Math.max(0, wax - card.wax))}
      fine={
        status === 'checking'
          ? 'Checking the sale is still open…'
          : 'Checked again when you sign — if the price or card changes, or it sells first, nothing is spent. No fee on top.'
      }
      alert={
        stale ? (
          <p className="alert alert--error">
            {status === 'gone'
              ? 'This sale has just closed — someone bought it, or the seller took it down.'
              : 'This sale has changed since the list was read.'}{' '}
            Nothing was spent.
          </p>
        ) : status === 'error' ? (
          <p className="alert alert--error">The sale could not be checked. Try again in a moment.</p>
        ) : undefined
      }
      action={
        stale
          ? { label: 'Show the current price', onClick: onStale }
          : { label: status === 'checking' ? 'Checking' : 'Buy', onClick: onConfirm, disabled: status !== 'ok' }
      }
      onCancel={onCancel}
    />
  )
}

const WAX_ICON = asset('/assets/icons/wax-coin.webp')

/** What the card does here, as the showcase's tiles and the line under them. */
function cardFigures(
  card: MarketCard,
  game: Game | undefined,
  bag: BagTool[] | undefined,
): { tiles: ShowcaseTile[]; line?: React.ReactNode } {
  if (!game) return { tiles: [], line: <span className="faint">Reading what it does…</span> }
  const farm = weightOf(card, game.weights)
  const farmTile: ShowcaseTile[] = farm ? [{ label: 'Farming', value: `${formatNumber(farm)}/day` }] : []
  if (card.schema === 'tool.worlds') {
    const t = game.tools.get(card.templateId)
    if (!t) return { tiles: farmTile, line: <span className="faint">No mining power in Alien Legends</span> }
    const [tlm, sh] = MINING_POWER
    return {
      tiles: [
        { label: tlm.label, icon: tlm.icon, value: formatNumber(t.tlm_mp) },
        { label: sh.label, icon: sh.icon, value: formatNumber(t.shrd_mp) },
        ...farmTile,
      ],
      line: bag && <Gain gain={toolGain({ tlm: t.tlm_mp, shrd: t.shrd_mp }, bag)} />,
    }
  }
  const v = game.values.get(card.templateId)
  if (!v) return { tiles: farmTile, line: <span className="faint">Not usable in a fight</span> }
  return {
    tiles: [
      { label: STAT_LABEL.damage, value: formatScaled(v.stats.damage) },
      { label: STAT_LABEL.health, value: formatScaled(v.stats.health) },
      ...farmTile,
    ],
    line: v.ability[0] && (
      <span className="amk__ability" title={v.ability[0].description}>
        ✦ {v.ability[0].displayname}
      </span>
    ),
  }
}

/**
 * The NFT Market's side column: the WAX there is to spend, and what these
 * cards are for in this game.
 */
export function MarketGuide({ wax }: { wax: number }) {
  const uses: [string, string, string][] = [
    [
      '/assets/icons/menu/rewards.svg',
      'Tools · mining',
      'Equip up to three. Their TLM and shard power set the Reward Power every win banks.',
    ],
    [
      '/assets/icons/menu/fighters.svg',
      'Crew + weapon · a sixth fighter',
      'Bring one of each into a dungeon, arena or tournament. Their stats add up; the weapon sets the element.',
    ],
    [
      '/assets/icons/menu/farming.svg',
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
          <img src={asset('/assets/icons/wax-coin.webp')} alt="" />
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
        <b>You never pay more than the price shown.</b> Each card is its cheapest sale on AtomicMarket. The
        purchase checks the sale on chain first; if its price or card changed, or someone bought it,
        nothing leaves your wallet.
      </p>
    </aside>
  )
}
