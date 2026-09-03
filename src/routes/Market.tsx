import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGame } from '@/state/useGame'
import { NUM_LOCALE } from '@/format'
import {
  fetchAuctions,
  fetchMarketConfig,
  fetchOffers,
  type Auction,
  type InstantOffer,
  type MarketConfig,
} from '@/market/queries'
import {
  MARKET_SORTS,
  OFFER_CANCEL_IS_BROKEN,
  canBid,
  canBuy,
  canCancelAuction,
  canList,
  extendsOnBid,
  hasEnded,
  listingAsFighter,
  minNextBid,
  msLeft,
  sellerPayout,
  sortListings,
  timeLeftLabel,
  type MarketSort,
} from '@/market/rules'
import { fetchBattleConfig, fetchClassTemplates, fetchRoster } from '@/dungeon/queries'
import { fighterAvailable } from '@/dungeon/rules'
import { ageBand, ageBonus, ageDays, ageNote, battleFactor } from '@/fighters/rules'
import {
  EMPTY_FILTER,
  applyFilter,
  isFilterActive,
  type QualityRule,
  type RosterFilter,
} from '@/dungeon/filters'
import type { RosterFighter } from '@/dungeon/types'
import {
  DetailSheet,
  Portrait,
  RosterFilters,
  rosterPanel,
  type Detail,
} from '@/fight/setup'
import {
  FILTER_STATS,
  GRADE_ICON,
  GRADE_LABEL,
  GRADE_ORDER,
  STAT_LABEL,
  abilityColor,
  abilityName,
  abilityRarity,
  elementBackground,
  fighterArt,
  fighterArtFallback,
  fighterAvatar,
  formatResistance,
  formatScaled,
  formatStat,
  gradeOfStat,
  isGradedStat,
  resolveAbilityDescription,
  statIcon,
  type ClassTemplate,
  type StatGrade,
} from '@/tavern/fighterStats'
import { addAuction, bidAuction, buyOffer, cancelAuction } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import { asset } from '@/assets'

/**
 * The fighter market.
 *
 * Two kinds of listing sit side by side and behave quite differently. An
 * auction is a 48-hour gem contest a seller starts; an instant offer is a
 * fixed price nobody chooses to create — it is what an unsold auction turns
 * into when the seller ticked "keep after auction". So this screen shows them
 * apart rather than merging them into one price column that would mean two
 * different things in two rows.
 */
type Tab = 'auctions' | 'offers' | 'mine'

/**
 * Which readout every card is showing.
 *
 * A fighter has eleven graded numbers and its abilities, which does not fit
 * on a card worth scanning — the Fighters screen settled this by putting them
 * behind three tabs, and the market has the same problem with more cards.
 *
 * Held by the screen rather than the card because the question a market
 * answers is comparative — "which of these has the best fire resistance" —
 * and per-card tabs make that a click per listing. A card can still be
 * switched on its own; the next change to the shared readout takes them all
 * back in step.
 */
export type Readout = 'stats' | 'resist' | 'abilities'

const READOUTS: [Readout, string][] = [
  ['stats', 'Stats'],
  ['resist', 'Resist'],
  ['abilities', 'Abilities'],
]

/** The five banded stats, in the order the fighter panel uses. */
const PRIMARY_STATS = ['damage', 'health', 'taunt', 'attackspeed', 'initiative'] as const

const RESISTANCES: [string, string][] = [
  ['res_fire', 'Fire'],
  ['res_air', 'Air'],
  ['res_metal', 'Metal'],
  ['res_gem', 'Gem'],
  ['res_nature', 'Nature'],
  ['res_neutral', 'Neutral'],
]

/** What the sell / bid / buy dialog is doing. */
type Dialog =
  | { kind: 'sell' }
  | { kind: 'bid'; auction: Auction }
  | { kind: 'buy'; offer: InstantOffer }
  | null

export default function Market() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [auctions, setAuctions] = useState<Auction[] | null>(null)
  const [offers, setOffers] = useState<InstantOffer[] | null>(null)
  const [config, setConfig] = useState<MarketConfig | undefined>(undefined)
  const [roster, setRoster] = useState<RosterFighter[] | null>(null)
  const [classes, setClasses] = useState<Map<string, ClassTemplate>>(new Map())
  /* The age curve. Static config, so this costs one hard-cached read. */
  const [ageDecay, setAgeDecay] = useState(0)
  const [levelMod, setLevelMod] = useState(1)

  const [tab, setTab] = useState<Tab>('auctions')
  const [readout, setReadout] = useState<Readout>('stats')
  const [sort, setSort] = useState<MarketSort>('ending')
  const [filter, setFilter] = useState<RosterFilter>(EMPTY_FILTER)
  const [detail, setDetail] = useState<Detail>(null)
  const [dialog, setDialog] = useState<Dialog>(null)

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /* A second hand, so the countdowns move without re-reading the chain. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(
    async (refresh = false) => {
      try {
        const [a, o, c, r, t, b] = await Promise.all([
          fetchAuctions(refresh),
          fetchOffers(refresh),
          fetchMarketConfig(),
          fetchRoster(player.wallet, refresh),
          fetchClassTemplates(),
          fetchBattleConfig(),
        ])
        setAuctions(a)
        setOffers(o)
        setConfig(c)
        setRoster(r)
        setClasses(t)
        if (b) {
          setAgeDecay(Number(b.age_decay) || 0)
          setLevelMod(Number(b.level_mod) || 1)
        }
      } catch (err) {
        setError(readableError(err))
      }
    },
    [player.wallet],
  )

  useEffect(() => {
    void load()
  }, [load])

  /*
     Listings are filtered through the roster filter by wearing a roster
     fighter's shape. The rows carry the same `Fighterstats`, so class, race,
     element and ability search all work on them unchanged rather than needing
     a second filter that would drift from the first.
  */
  const asFighters = useMemo(() => {
    const m = new Map<string, RosterFighter>()
    for (const a of auctions ?? []) m.set(`a${a.auction_id}`, listingAsFighter(a))
    for (const o of offers ?? []) m.set(`o${o.offer_id}`, listingAsFighter(o))
    return m
  }, [auctions, offers])

  const keep = useCallback(
    (key: string) => {
      const f = asFighters.get(key)
      if (!f) return false
      if (!isFilterActive(filter)) return true
      /* The decay curve, so an age-bonus rule has something to work from. */
      return applyFilter([f], filter, ageDecay, Date.now(), classes).length > 0
    },
    [asFighters, filter, classes, ageDecay],
  )

  const liveAuctions = useMemo(
    () =>
      sortListings(
        (auctions ?? []).filter((a) => !hasEnded(a, now) && keep(`a${a.auction_id}`)),
        sort,
        now,
      ),
    [auctions, keep, now, sort],
  )

  const liveOffers = useMemo(
    () =>
      sortListings(
        (offers ?? []).filter((o) => !hasEnded(o, now) && keep(`o${o.offer_id}`)),
        sort,
        now,
      ),
    [offers, keep, now, sort],
  )

  const myAuctions = useMemo(
    () => (auctions ?? []).filter((a) => a.owner === player.wallet),
    [auctions, player.wallet],
  )
  const myOffers = useMemo(
    () => (offers ?? []).filter((o) => o.owner === player.wallet),
    [offers, player.wallet],
  )

  /** Roster fighters `addauction` would actually accept. */
  const sellable = useMemo(
    () =>
      (roster ?? []).filter(
        (f) => fighterAvailable(f).available && f.active && !f.in_use,
      ),
    [roster],
  )

  const filterRoster = useMemo(() => [...asFighters.values()], [asFighters])

  const counts: Record<Tab, number> = {
    auctions: liveAuctions.length,
    offers: liveOffers.length,
    mine: myAuctions.length + myOffers.length,
  }

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      await fn()
      setNotice(done)
      setDialog(null)
      void refreshPlayer({ force: true })
      await load(true)
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(null)
    }
  }

  const show = useCallback(
    (listing: Auction | InstantOffer) => {
      const f = listingAsFighter(listing)
      setDetail({
        kind: 'panel',
        panel: rosterPanel(f),
        template: classes.get(f.classname),
      })
    },
    [classes],
  )

  return (
    <div className="market">
      <img className="market__art" src={asset("/assets/background/bg-shop.png")} alt="" />
      <div className="market__scrim" />

      <div className="market__inner">
        <header className="market__head">
          <div>
            <h1 className="page__title">Market</h1>
            <p className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
              Buy and sell fighters for gems
            </p>
          </div>
          <span className="spacer" />
          <span className="market__purse mono">
            {player.activestats.gems.toLocaleString(NUM_LOCALE)}
            <img src={asset("/assets/icons/gems.png")} alt="gems" width={18} height={18} />
          </span>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setDialog({ kind: 'sell' })}
            disabled={!!busy}
          >
            Sell a fighter
          </button>
        </header>

        {error && <div className="alert alert--error">{error}</div>}
        {notice && <div className="alert">{notice}</div>}

        <section className="panel">
          <div className="tabs" role="tablist">
            {(
              [
                ['auctions', 'Auctions'],
                ['offers', 'Buy Now'],
                ['mine', 'My Listings'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                role="tab"
                className="tabs__tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
                <span className="tabs__count">{counts[key]}</span>
              </button>
            ))}
          </div>

          {tab !== 'mine' && (
            <>
              {/*
                Status and Sort are dropped rather than shown inert. Every
                listing is stamped "Market", so four of the five Status
                options match nothing and the fifth matches everything; and
                the board is ordered by the market's own sort below, which
                would silently override the roster one.
              */}
              <RosterFilters
                filter={filter}
                onChange={setFilter}
                roster={filterRoster}
                omit={['status', 'sort']}
              />
              <QualityFilters filter={filter} onChange={setFilter} />
              {/*
                One bar, two arrangements of the same grid: which face of the
                cards is up, and what order they are in. They were two boxes
                with the second floating clear of the first, which made the
                Order control look like it belonged to nothing.
              */}
              <div className="marketbar">
                <span className="qfilter__lead">Show</span>
                <ReadoutPicker value={readout} onChange={setReadout} />
                <span className="marketbar__gap" />
                <span className="qfilter__lead">Order</span>
                <select
                  className="input marketbar__sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as MarketSort)}
                  aria-label="Order"
                >
                  {MARKET_SORTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {tab === 'auctions' && (
            <ListingGrid
              loading={!auctions}
              empty="No auctions are running. List one and it will show up here."
            >
              {liveAuctions.map((a) => (
                <AuctionCard
                  key={a.auction_id}
                  auction={a}
                  config={config}
                  template={classes.get(a.fighter.classname)}
                  readout={readout}
                  ageDecay={ageDecay}
                  levelMod={levelMod}
                  now={now}
                  mine={a.owner === player.wallet}
                  onOpen={() => show(a)}
                  onBid={() => setDialog({ kind: 'bid', auction: a })}
                />
              ))}
            </ListingGrid>
          )}

          {tab === 'offers' && (
            <ListingGrid
              loading={!offers}
              empty={
                'Nothing is on sale at a fixed price. These only appear when an ' +
                'auction ends unsold and the seller chose to keep it listed.'
              }
            >
              {liveOffers.map((o) => (
                <OfferCard
                  key={o.offer_id}
                  offer={o}
                  template={classes.get(o.fighter.classname)}
                  readout={readout}
                  ageDecay={ageDecay}
                  levelMod={levelMod}
                  now={now}
                  mine={o.owner === player.wallet}
                  onOpen={() => show(o)}
                  onBuy={() => setDialog({ kind: 'buy', offer: o })}
                />
              ))}
            </ListingGrid>
          )}

          {tab === 'mine' && (
            <MyListings
              auctions={myAuctions}
              offers={myOffers}
              config={config}
              now={now}
              busy={busy}
              ageDecay={ageDecay}
              levelMod={levelMod}
              player={player}
              onOpen={show}
              onCancel={(a) =>
                void run(
                  `cancel${a.auction_id}`,
                  () =>
                    cancelAuction(session!, {
                      scope: a.fighter.classname,
                      auctionId: a.auction_id,
                    }),
                  'Auction withdrawn.',
                )
              }
            />
          )}
        </section>
      </div>

      {dialog?.kind === 'sell' && (
        <SellDialog
          sellable={sellable}
          config={config}
          player={player}
          busy={busy === 'list'}
          onClose={() => setDialog(null)}
          onList={(fighterId, startPrice, keep_) =>
            void run(
              'list',
              () =>
                addAuction(session!, {
                  fighterId,
                  startPrice,
                  keepAfterAuction: keep_,
                }),
              'Listed. It runs for the next two days.',
            )
          }
        />
      )}

      {dialog?.kind === 'bid' && (
        <BidDialog
          auction={dialog.auction}
          config={config}
          player={player}
          now={now}
          busy={busy === 'bid'}
          onClose={() => setDialog(null)}
          onBid={(gems) =>
            void run(
              'bid',
              () =>
                bidAuction(session!, {
                  scope: dialog.auction.fighter.classname,
                  auctionId: dialog.auction.auction_id,
                  gems,
                }),
              'Bid placed.',
            )
          }
        />
      )}

      {dialog?.kind === 'buy' && (
        <BuyDialog
          offer={dialog.offer}
          player={player}
          now={now}
          busy={busy === 'buy'}
          onClose={() => setDialog(null)}
          onBuy={() =>
            void run(
              'buy',
              () =>
                buyOffer(session!, {
                  scope: dialog.offer.fighter.classname,
                  offerId: dialog.offer.offer_id,
                  gems: dialog.offer.gems,
                }),
              'Bought. The fighter is on your roster.',
            )
          }
        />
      )}

      {detail && (
        <DetailSheet
          panel={detail.panel}
          template={detail.template}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

/* ---------- filtering on how well a fighter rolled ---------- */

/**
 * Stat-quality floors, stacked.
 *
 * The market's own filter, and the one the roster never needed: everything
 * above narrows *which* fighters are listed, this narrows how good they are.
 * Rules are added one at a time and AND together, so "green damage" and "at
 * least average fire resistance" is one search rather than two.
 */
/**
 * Stat floors, stacked.
 *
 * The market's own filter, and the one the roster never needed: everything
 * above narrows *which* fighters are listed, this narrows how good they are.
 * Rules AND together, so "green damage" and "at least 40 taunt" is one search
 * rather than two passes.
 *
 * The second control changes shape with the stat, because the stats do not
 * all answer the same way. Ten of them have a grade and take one; taunt does
 * not and takes a number. Putting taunt in its own bar said they were
 * different questions, and to a buyer they are the same question with
 * different units.
 */
export function QualityFilters({
  filter,
  onChange,
}: {
  filter: RosterFilter
  onChange: (f: RosterFilter) => void
}) {
  const rules = filter.qualities ?? []
  const [stat, setStat] = useState(FILTER_STATS[0].field)
  const [grade, setGrade] = useState<StatGrade>('green-up')
  /* Taunt and age live on different scales, so the box starts somewhere
     useful for whichever is picked rather than on one number for both. */
  const [value, setValue] = useState('40')

  const graded = isGradedStat(stat)
  const label = (field: string) =>
    FILTER_STATS.find((g) => g.field === field)?.label ?? field

  const add = () => {
    const min: StatGrade | number = graded
      ? grade
      : Math.max(0, Math.floor(Number(value) || 0))
    /* One rule per stat: two floors on the same stat is just the higher one. */
    const kept = rules.filter((r) => r.stat !== stat)
    onChange({ ...filter, qualities: [...kept, { stat, min }] })
  }

  const drop = (rule: QualityRule) =>
    onChange({ ...filter, qualities: rules.filter((r) => r.stat !== rule.stat) })

  return (
    <div className="qfilter">
      <div className="qfilter__add">
        <span className="qfilter__lead">Roll quality</span>

        <select
          className="input qfilter__stat"
          value={stat}
          onChange={(e) => {
            const next = e.target.value
            setStat(next)
            if (!isGradedStat(next)) setValue(next === 'age' ? '80' : '40')
          }}
          aria-label="Stat"
        >
          {FILTER_STATS.map((g) => (
            <option key={g.field} value={g.field}>
              {g.label}
            </option>
          ))}
        </select>

        <span className="qfilter__at">at least</span>

        {graded ? (
          <select
            className="input qfilter__grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value as StatGrade)}
            aria-label="Minimum grade"
          >
            {/* Best first: the useful end of the scale is the top of it. */}
            {[...GRADE_ORDER].reverse().map((g) => (
              <option key={g} value={g}>
                {GRADE_LABEL[g]}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input qfilter__num"
            type="number"
            /* Age bonus runs down to -100, so this one is not floored at 0. */
            min={stat === 'age' ? -100 : 0}
            inputMode="numeric"
            value={value}
            aria-label={`Minimum ${label(stat)}`}
            onChange={(e) => setValue(e.target.value)}
          />
        )}

        <button type="button" className="btn btn--ghost btn--sm" onClick={add}>
          Add
        </button>

        {!graded && (
          <span className="qfilter__note">
            {stat === 'age'
              ? 'Condition rather than a roll: +100% is untouched, 0% has lost half its stats.'
              : 'Taunt has no quality arrow — high suits a tank, low keeps a fighter out of the way — so it takes a number instead.'}
          </span>
        )}
      </div>

      {rules.length > 0 && (
        <div className="qfilter__rules">
          {rules.map((r) => (
            <button
              type="button"
              className="qfilter__rule"
              key={r.stat}
              onClick={() => drop(r)}
              title="Remove this rule"
            >
              {typeof r.min === 'number' ? (
                <span className="qfilter__min mono">
                  {r.min}
                  {r.stat === 'age' ? '%+' : '+'}
                </span>
              ) : (
                <img className="qfilter__arrow" src={GRADE_ICON[r.min]} alt="" />
              )}
              {label(r.stat)}
              <span className="qfilter__x" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onChange({ ...filter, qualities: [] })}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- listing cards ---------- */

function ListingGrid({
  loading,
  empty,
  children,
}: {
  loading: boolean
  empty: string
  children: React.ReactNode[]
}) {
  if (loading) {
    return (
      <div className="listinggrid">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skeleton listingcard listingcard--loading" key={i} />
        ))}
      </div>
    )
  }
  if (children.length === 0) return <p className="faint listinggrid__empty">{empty}</p>
  return <div className="listinggrid">{children}</div>
}

/**
 * The portrait and who the fighter is.
 *
 * The art sits on its elemental backdrop, the way it does everywhere else a
 * fighter is shown in full — a listing was the one place a fighter appeared
 * as a thumbnail on a plain card, which made the market look like a table of
 * rows rather than a shelf of fighters.
 */
function ListingHead({
  listing,
  onOpen,
  ageDecay,
  levelMod,
}: {
  listing: Auction | InstantOffer
  onOpen: () => void
  ageDecay: number
  levelMod: number
}) {
  const f = listing.fighter
  /*
     What age has already taken off this fighter.

     `apply_weather_and_age` multiplies health and damage by
     `age_decay ^ (days²)`, which is imperceptible for a week and then falls
     off a cliff. On a market that is the difference between a bargain and a
     fighter with weeks left in it, and nothing else on the card hints at it —
     the stat figures are the stored roll, which does not move as a fighter
     ages.
  */
  const asFighter = listingAsFighter(listing)
  const days = ageDays(asFighter, Date.now())
  const factor = battleFactor(asFighter, levelMod, ageDecay, Date.now())
  /* The same scale My Fighters prints, so a fighter does not change its
     apparent condition on the way from one screen to the other. */
  const bonus = ageBonus(asFighter, ageDecay, Date.now())
  const band = ageBand(bonus)

  return (
    <button type="button" className="listingcard__hit" onClick={onOpen}>
      <span
        className="listingcard__art"
        style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}
      >
        <img
          src={fighterAvatar({ classname: f.classname, racename: f.racename })}
          alt={`${f.classname} ${f.racename}`}
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget
            /*
               Two steps down, not one: the avatar crop, then the full body,
               then the generic. Falling straight to the placeholder would
               throw away perfectly good art whenever a single crop is
               missing.
            */
            if (img.dataset.step === 'full') return
            if (img.dataset.step === 'avatar') {
              img.dataset.step = 'full'
              img.src = fighterArtFallback()
              return
            }
            img.dataset.step = 'avatar'
            img.src = fighterArt({ classname: f.classname, racename: f.racename })
          }}
        />
        <span className="listingcard__level">L{f.level}</span>
      </span>

      <span className="listingcard__who">
        <span className="listingcard__class">{f.classname}</span>
        <span className="listingcard__race">{f.racename}</span>
        <span className="listingcard__element">
          <img
            src={asset(`/assets/icons/elements/${f.element}.png`)}
            alt=""
            width={14}
            height={14}
          />
          {f.element}
        </span>

        <span
          className={`listingcard__age listingcard__age--${band}`}
          title={ageNote(bonus, days, factor.age)}
        >
          {days}d
          <em>
            {bonus > 0 ? '+' : ''}
            {bonus.toFixed(0)}%
          </em>
        </span>
      </span>
    </button>
  )
}

/**
 * One graded row: the figure, then how good it is for the class.
 *
 * The number leads and the arrow follows, because the number is what is read
 * and the arrow is what is scanned. Taunt carries no arrow — it is a role
 * choice rather than a quality, and `gradeStat` refuses it.
 */
function StatRow({
  field,
  label,
  value,
  grade,
}: {
  field: string
  label: string
  value: string
  grade: StatGrade | null
}) {
  return (
    <div className="statrow">
      <img className="statrow__icon" src={statIcon(field)} alt="" width={14} height={14} />
      <span className="statrow__label">{label}</span>
      <span className="statrow__value mono">{value}</span>
      <span className="statrow__grade">
        {grade ? (
          <img src={GRADE_ICON[grade]} alt="" title={GRADE_LABEL[grade]} />
        ) : null}
      </span>
    </div>
  )
}

/**
 * Everything about the fighter, three readouts deep.
 *
 * All eleven graded figures are here — the four the card used to show were
 * missing taunt entirely and every resistance, which is half of what decides
 * whether a fighter is worth buying.
 */
function ListingBody({
  stats,
  template,
  readout,
}: {
  stats: RosterFighter['stats']
  template?: ClassTemplate
  readout: Readout
}) {
  /* A card can be flipped on its own; the shared picker takes them all back
     in step, which is what `useEffect` on the incoming value does. */
  const [override, setOverride] = useState<Readout | null>(null)
  useEffect(() => setOverride(null), [readout])
  const shown = override ?? readout

  const raw = stats as unknown as Record<string, number>
  const abilities = stats.abilities ?? []

  return (
    <div className="listingcard__body">
      <div className="listingcard__readouts" role="tablist">
        {READOUTS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={shown === key}
            className="listingcard__readout"
            onClick={() => setOverride(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {shown === 'stats' && (
        <div className="listingcard__rows">
          {PRIMARY_STATS.map((field) => (
            <StatRow
              key={field}
              field={field}
              label={STAT_LABEL[field] ?? field}
              value={formatStat(raw[`${field}_min`] ?? 0, raw[`${field}_max`] ?? 0)}
              grade={gradeOfStat(raw, field, template)}
            />
          ))}
        </div>
      )}

      {shown === 'resist' && (
        <div className="listingcard__rows">
          {RESISTANCES.map(([field, label]) => (
            <StatRow
              key={field}
              field={field}
              label={label}
              value={formatResistance(raw[field] ?? 0)}
              grade={gradeOfStat(raw, field, template)}
            />
          ))}
        </div>
      )}

      {shown === 'abilities' && (
        <div className="listingcard__rows listingcard__rows--abilities">
          {abilities.length === 0 && <p className="faint">No abilities.</p>}
          {abilities.map((a, i) => (
            <div className="abilityline" key={`${a.ability}-${i}`}>
              <span
                className="abilityline__name"
                style={{ color: abilityColor(a.displayname) }}
              >
                {abilityName(a.displayname)}
                {abilityRarity(a.displayname) && (
                  <em className="abilityline__rarity">{abilityRarity(a.displayname)}</em>
                )}
              </span>
              <span className="abilityline__text">{resolveAbilityDescription(a)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** The screen-level readout switch, so a whole grid is compared at once. */
export function ReadoutPicker({
  value,
  onChange,
}: {
  value: Readout
  onChange: (r: Readout) => void
}) {
  return (
    <div className="readoutpick" role="tablist" aria-label="Card readout">
      {READOUTS.map(([key, label]) => (
        <button
          type="button"
          key={key}
          role="tab"
          aria-selected={value === key}
          className="readoutpick__one"
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function AuctionCard({
  auction,
  config,
  template,
  readout,
  ageDecay,
  levelMod,
  now,
  mine,
  onOpen,
  onBid,
}: {
  auction: Auction
  config: MarketConfig | undefined
  template?: ClassTemplate
  readout: Readout
  ageDecay: number
  levelMod: number
  now: number
  mine: boolean
  onOpen: () => void
  onBid: () => void
}) {
  const left = msLeft(auction, now)
  const closing = extendsOnBid(auction, config, now)
  const opened = Number(auction.bids) > 0

  return (
    <article className={`listingcard${closing ? ' listingcard--closing' : ''}`}>
      <ListingHead listing={auction} onOpen={onOpen} ageDecay={ageDecay} levelMod={levelMod} />
      <ListingBody stats={auction.fighter} template={template} readout={readout} />

      <div className="listingcard__price">
        <span className="listingcard__label">
          {opened ? `Top bid · ${auction.bids} bids` : 'Starting at'}
        </span>
        <span className="listingcard__gems mono">
          {auction.current_bid.toLocaleString(NUM_LOCALE)}
          <img src={asset("/assets/icons/gems.png")} alt="gems" width={16} height={16} />
        </span>
      </div>

      <div className="listingcard__meta">
        <span className={`listingcard__clock${closing ? ' is-closing' : ''}`}>
          {timeLeftLabel(left)}
        </span>
        <span className="faint">
          {opened ? `by ${auction.current_bidder_gamertag}` : auction.owner_gamertag}
        </span>
      </div>

      <button
        type="button"
        className="btn btn--primary btn--sm btn--block"
        onClick={onBid}
        disabled={mine}
        title={mine ? 'You cannot bid on your own auction' : undefined}
      >
        {mine ? 'Your auction' : `Bid ${minNextBid(auction.current_bid, config)}`}
      </button>
    </article>
  )
}

export function OfferCard({
  offer,
  template,
  readout,
  ageDecay,
  levelMod,
  now,
  mine,
  onOpen,
  onBuy,
}: {
  offer: InstantOffer
  template?: ClassTemplate
  readout: Readout
  ageDecay: number
  levelMod: number
  now: number
  mine: boolean
  onOpen: () => void
  onBuy: () => void
}) {
  return (
    <article className="listingcard">
      <ListingHead listing={offer} onOpen={onOpen} ageDecay={ageDecay} levelMod={levelMod} />
      <ListingBody stats={offer.fighter} template={template} readout={readout} />

      <div className="listingcard__price">
        <span className="listingcard__label">Buy now</span>
        <span className="listingcard__gems mono">
          {offer.gems.toLocaleString(NUM_LOCALE)}
          <img src={asset("/assets/icons/gems.png")} alt="gems" width={16} height={16} />
        </span>
      </div>

      <div className="listingcard__meta">
        <span className="listingcard__clock">{timeLeftLabel(msLeft(offer, now))}</span>
        <span className="faint">{offer.owner_gamertag}</span>
      </div>

      <button
        type="button"
        className="btn btn--primary btn--sm btn--block"
        onClick={onBuy}
        disabled={mine}
        title={mine ? 'You cannot buy your own offer' : undefined}
      >
        {mine ? 'Your listing' : 'Buy'}
      </button>
    </article>
  )
}

/* ---------- my listings ---------- */

export function MyListings({
  auctions,
  offers,
  config,
  now,
  busy,
  ageDecay,
  levelMod,
  player,
  onOpen,
  onCancel,
}: {
  auctions: Auction[]
  offers: InstantOffer[]
  config: MarketConfig | undefined
  now: number
  busy: string | null
  ageDecay: number
  levelMod: number
  player: NonNullable<ReturnType<typeof useGame.getState>['player']>
  onOpen: (l: Auction | InstantOffer) => void
  onCancel: (a: Auction) => void
}) {
  if (auctions.length === 0 && offers.length === 0) {
    return <p className="faint listinggrid__empty">You have nothing listed.</p>
  }

  return (
    <>
      {auctions.length > 0 && (
        <div className="listinggrid">
          {auctions.map((a) => {
            const gate = canCancelAuction(a, player)
            const ended = hasEnded(a, now)
            return (
              <article className="listingcard" key={a.auction_id}>
                <ListingHead listing={a} onOpen={() => onOpen(a)} ageDecay={ageDecay} levelMod={levelMod} />
                <div className="listingcard__price">
                  <span className="listingcard__label">
                    {Number(a.bids) > 0 ? `${a.bids} bids` : 'No bids yet'}
                  </span>
                  <span className="listingcard__gems mono">
                    {a.current_bid.toLocaleString(NUM_LOCALE)}
                    <img src={asset("/assets/icons/gems.png")} alt="gems" width={16} height={16} />
                  </span>
                </div>
                <div className="listingcard__meta">
                  <span className="listingcard__clock">
                    {timeLeftLabel(msLeft(a, now))}
                  </span>
                  <span className="faint">
                    {Number(a.bids) > 0
                      ? `nets ${sellerPayout(a.current_bid, config)} after fee`
                      : a.keep_after_auction
                        ? 'will relist at the fixed price'
                        : 'will come back to you'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--block"
                  onClick={() => onCancel(a)}
                  disabled={!gate.ok || ended || busy === `cancel${a.auction_id}`}
                  title={gate.reason}
                >
                  {busy === `cancel${a.auction_id}` && <span className="spinner" />}
                  {gate.ok ? 'Withdraw' : (gate.reason ?? 'Withdraw')}
                </button>
              </article>
            )
          })}
        </div>
      )}

      {offers.length > 0 && (
        <>
          <p className="hint" style={{ marginTop: 'var(--sp-4)' }}>
            {OFFER_CANCEL_IS_BROKEN}
          </p>
          <div className="listinggrid">
            {offers.map((o) => (
              <article className="listingcard" key={o.offer_id}>
                <ListingHead listing={o} onOpen={() => onOpen(o)} ageDecay={ageDecay} levelMod={levelMod} />
                <div className="listingcard__price">
                  <span className="listingcard__label">Listed at</span>
                  <span className="listingcard__gems mono">
                    {o.gems.toLocaleString(NUM_LOCALE)}
                    <img src={asset("/assets/icons/gems.png")} alt="gems" width={16} height={16} />
                  </span>
                </div>
                <div className="listingcard__meta">
                  <span className="listingcard__clock">
                    {timeLeftLabel(msLeft(o, now))}
                  </span>
                  <span className="faint">
                    nets {sellerPayout(o.gems, config)} after fee
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}

/* ---------- dialogs ---------- */

function Backdrop({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet__scrim" onClick={onClose} />
      <div className="sheet__panel marketdialog">
        <header className="sheet__head">
          <h2 className="panel__title">{title}</h2>
          <button
            type="button"
            className="tilecard__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function BidDialog({
  auction,
  config,
  player,
  now,
  busy,
  onClose,
  onBid,
}: {
  auction: Auction
  config: MarketConfig | undefined
  player: ReturnType<typeof useGame.getState>['player']
  now: number
  busy: boolean
  onClose: () => void
  onBid: (gems: number) => void
}) {
  const min = minNextBid(auction.current_bid, config)
  const [gems, setGems] = useState(min)
  const gate = canBid(auction, player!, config, gems, now)
  const closing = extendsOnBid(auction, config, now)

  return (
    <Backdrop title={`Bid on ${auction.fighter.classname}`} onClose={onClose}>
      <dl className="marketdialog__facts">
        <div>
          <dt>{Number(auction.bids) > 0 ? 'Current bid' : 'Starting price'}</dt>
          <dd className="mono">{auction.current_bid}</dd>
        </div>
        <div>
          <dt>Minimum bid</dt>
          <dd className="mono">{min}</dd>
        </div>
        <div>
          <dt>Your gems</dt>
          <dd className="mono">{player!.activestats.gems}</dd>
        </div>
        <div>
          <dt>Ends in</dt>
          <dd className="mono">{timeLeftLabel(msLeft(auction, now))}</dd>
        </div>
      </dl>

      {/*
        Two facts a bidder cannot see from the card and would resent learning
        afterwards: the gems leave now rather than on winning, and bidding
        late does not shorten the wait.
      */}
      <p className="hint">
        Your gems are taken as soon as you bid. If somebody outbids you they
        are refunded to you in the same transaction.
      </p>
      {closing && (
        <p className="hint">
          This auction is inside its closing window, so any bid pushes the end
          back out by {Math.round(Number(config?.reset_duration_below_minutes ?? 0) / 60)} hours.
        </p>
      )}

      <label className="field">
        <span className="field__label">Your bid</span>
        <input
          className="input mono"
          type="number"
          min={min}
          step={1}
          value={gems}
          onChange={(e) => setGems(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        />
      </label>

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={() => onBid(gems)}
        disabled={busy || !gate.ok}
        title={gate.reason}
      >
        {busy && <span className="spinner" />}
        {gate.ok ? `Bid ${gems} gems` : gate.reason}
      </button>
    </Backdrop>
  )
}

export function BuyDialog({
  offer,
  player,
  now,
  busy,
  onClose,
  onBuy,
}: {
  offer: InstantOffer
  player: ReturnType<typeof useGame.getState>['player']
  now: number
  busy: boolean
  onClose: () => void
  onBuy: () => void
}) {
  const gate = canBuy(offer, player!, now)
  return (
    <Backdrop title={`Buy ${offer.fighter.classname}`} onClose={onClose}>
      <dl className="marketdialog__facts">
        <div>
          <dt>Price</dt>
          <dd className="mono">{offer.gems}</dd>
        </div>
        <div>
          <dt>Your gems</dt>
          <dd className="mono">{player!.activestats.gems}</dd>
        </div>
        <div>
          <dt>Offer ends</dt>
          <dd className="mono">{timeLeftLabel(msLeft(offer, now))}</dd>
        </div>
        <div>
          <dt>Seller</dt>
          <dd>{offer.owner_gamertag}</dd>
        </div>
      </dl>

      <p className="hint">
        The fighter moves to your roster immediately. Its payday clock keeps
        running, and it is due at the time above.
      </p>

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={onBuy}
        disabled={busy || !gate.ok}
        title={gate.reason}
      >
        {busy && <span className="spinner" />}
        {gate.ok ? `Buy for ${offer.gems} gems` : gate.reason}
      </button>
    </Backdrop>
  )
}

export function SellDialog({
  sellable,
  config,
  player,
  busy,
  onClose,
  onList,
}: {
  sellable: RosterFighter[]
  config: MarketConfig | undefined
  player: ReturnType<typeof useGame.getState>['player']
  busy: boolean
  onClose: () => void
  onList: (fighterId: number, startPrice: number, keep: boolean) => void
}) {
  const minStart = Number(config?.gems_min_start_bid ?? 0)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [price, setPrice] = useState(minStart)
  const [keep, setKeep] = useState(true)

  useEffect(() => setPrice(minStart), [minStart])

  const picked = sellable.find((f) => f.fighter_id === pickedId) ?? null
  const gate = canList(picked, price, player!, config)
  const hours = Math.round(Number(config?.standard_duration_minutes ?? 0) / 60)

  return (
    <Backdrop title="Sell a fighter" onClose={onClose}>
      {sellable.length === 0 ? (
        <p className="faint">
          None of your fighters can be listed right now. A fighter has to be
          active, idle, and not yet asking for a payday.
        </p>
      ) : (
        <>
          <div className="sellpick">
            {sellable.map((f) => (
              <button
                type="button"
                key={f.fighter_id}
                className="sellpick__one"
                aria-pressed={f.fighter_id === pickedId}
                onClick={() => setPickedId(f.fighter_id)}
              >
                <Portrait
                  element={f.element}
                  classname={f.classname}
                  racename={f.racename}
                />
                <span className="sellpick__name">{f.classname}</span>
                <span className="sellpick__sub mono">
                  L{f.stats.level} · {formatScaled(f.stats.damage_min)} dmg
                </span>
              </button>
            ))}
          </div>

          <label className="field">
            <span className="field__label">Starting bid (min {minStart})</span>
            <input
              className="input mono"
              type="number"
              min={minStart}
              step={1}
              value={price}
              onChange={(e) =>
                setPrice(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
            />
          </label>

          <label className="checkline">
            <input
              type="checkbox"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
            />
            <span>
              Keep it listed if nobody bids
              <em className="faint">
                {' '}
                — it becomes a fixed-price offer at{' '}
                {config?.gems_instant_buy_price ?? 0} gems instead of coming back
                to you
              </em>
            </span>
          </label>

          <dl className="marketdialog__facts">
            <div>
              <dt>Listing fee</dt>
              <dd className="mono">{config?.gems_listing_price ?? 0}</dd>
            </div>
            <div>
              <dt>Runs for</dt>
              <dd className="mono">{hours}h</dd>
            </div>
            <div>
              <dt>Fee on sale</dt>
              <dd className="mono">
                {config?.gems_processing_fee_percent ?? 0}% (min{' '}
                {config?.gems_processing_fee_min ?? 0})
              </dd>
            </div>
            <div>
              <dt>You keep at {price}</dt>
              <dd className="mono">{sellerPayout(price, config)}</dd>
            </div>
          </dl>

          <p className="hint">
            The fighter is locked in the market while it is listed, and the
            listing fee is spent whether or not it sells. Once anybody bids,
            the auction cannot be withdrawn.
          </p>

          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => picked && onList(picked.fighter_id, price, keep)}
            disabled={busy || !gate.ok}
            title={gate.reason}
          >
            {busy && <span className="spinner" />}
            {gate.ok
              ? `List for ${config?.gems_listing_price ?? 0} gems`
              : gate.reason}
          </button>
        </>
      )}
    </Backdrop>
  )
}

