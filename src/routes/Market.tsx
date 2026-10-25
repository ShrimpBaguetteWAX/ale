import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGame } from '@/state/useGame'
import { NUM_LOCALE } from '@/format'
import {
  fetchAuctions,
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
import { fetchRoster } from '@/dungeon/queries'
import { useConfig, useLazyConfig } from '@/state/useConfig'
import { useChainQuery } from '@/chain/useChainQuery'
import { useModal } from '@/components/useModal'
import { BottomSheet } from '@/components/BottomSheet'
import { usePhone } from '@/components/usePhone'
import { HoverPopover, useHoverCard } from '@/components/HoverPopover'
import { FighterHoverCard } from '@/components/FighterPanel'
import { useAction } from '@/wharf/useAction'
import { DIRTIES } from '@/wharf/actions'
import { fighterAvailable } from '@/dungeon/rules'
import { ageBand, ageBonus, ageDays, ageNote, battleFactor } from '@/fighters/rules'
import {
  EMPTY_FILTER,
  applyFilter,
  isFilterActive,
  markerIcon,
  type RosterFilter,
} from '@/dungeon/filters'
import type { RosterFighter, RosterStats } from '@/dungeon/types'
import {
  DetailSheet,
  Portrait,
  RosterFilters,
  rosterPanel,
  type Detail,
} from '@/fight/setup'
import {
  ABILITY_RARITY_COLOR,
  GRADE_ICON,
  GRADE_LABEL,
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
  resolveAbilityDescription,
  statIcon,
  type ClassTemplate,
  type StatGrade,
} from '@/tavern/fighterStats'
import { addAuction, bidAuction, buyOffer, cancelAuction } from '@/wharf/actions'
import { SACRIFICE_ABILITY } from '@/ascension/rules'
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
/**
 * Selling is a tab, not a dialog.
 *
 * It was a modal off a header button, which is the wrong shape twice over:
 * choosing which of forty fighters to part with is browsing, and a modal is
 * for a decision already made. It also meant the one screen in the game
 * where you look hardest at your own roster was the one with no way to
 * filter it — a flat grid of every sellable fighter, name and level only.
 */
type Tab = 'auctions' | 'offers' | 'mine' | 'sell'

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
/** The phone row's grades: the primary figures that have one. */
const ROW_GRADES = ['damage', 'health', 'attackspeed', 'initiative'] as const

const RESISTANCES: [string, string][] = [
  ['res_fire', 'Fire'],
  ['res_air', 'Air'],
  ['res_metal', 'Metal'],
  ['res_gem', 'Gem'],
  ['res_nature', 'Nature'],
  ['res_neutral', 'Neutral'],
]

/** What the bid / buy dialog is doing. Selling is a tab. */
type Dialog =
  | { kind: 'bid'; auction: Auction }
  | { kind: 'buy'; offer: InstantOffer }
  | null

export default function Market() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)


  /*
     The class bands, the age curve and the level curve, from the store. A
     listing is a fighter and is graded against the same bands the roster
     grades against; reading them from anywhere else is how the same fighter
     ends up with two different grades on two screens.
  */
  const { classes, levelMod, ageDecay, fighters: fightersConfig } = useConfig()
  const config = useLazyConfig('market')
  /*
     The ascension level at which a fighter's locked ability starts working.

     A listing carries the `locked` flag on the ability itself, but not the
     level that clears it — that lives on `fighters.ale`'s config, the same
     read My Fighters makes. Without it the market was printing a locked
     ability exactly like a working one, which overstates every listed
     fighter by whatever its last ability is worth.
  */
  const unlockLevel = fightersConfig?.asc_ability_unlock_lvl

  const [tab, setTab] = useState<Tab>('auctions')
  const [readout, setReadout] = useState<Readout>('stats')
  const [sort, setSort] = useState<MarketSort>('ending')
  const [filter, setFilter] = useState<RosterFilter>(EMPTY_FILTER)
  const [detail, setDetail] = useState<Detail>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  /*
     A phone lists a row a listing and opens one in place; a desktop keeps the
     grid of cards. One open at a time, so the list stays a list.
  */
  const phone = usePhone()
  const [openRow, setOpenRow] = useState<string | null>(null)
  const toggleRow = (key: string) => setOpenRow((k) => (k === key ? null : key))

  const { busy, error, run } = useAction()

  /* A second hand, so the countdowns move without re-reading the chain. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  /*
     The board and this wallet's roster together: what is for sale, and which
     of the player's own fighters could be. A listing moves between the two,
     so reading them apart would show a fighter on both sides at once.
  */
  const listings = useChainQuery(
    `market:${player.wallet}`,
    async () => {
      const [a, o, r] = await Promise.all([
        fetchAuctions(),
        fetchOffers(),
        fetchRoster(player.wallet),
      ])
      return { auctions: a, offers: o, roster: r }
    },
    { deps: ['auctions', 'offers', 'fighters'] },
  )
  const auctions = listings.data?.auctions ?? null
  const offers = listings.data?.offers ?? null
  const roster = listings.data?.roster ?? null

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
  const myBids = useMemo(
    () =>
      (auctions ?? []).filter(
        (a) => a.current_bidder === player.wallet && a.owner !== player.wallet && Number(a.bids) > 0 && !hasEnded(a, now),
      ),
    [auctions, player.wallet, now],
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
    mine: myAuctions.length + myOffers.length + (phone ? myBids.length : 0),
    sell: sellable.length,
  }

  /* Closing the dialog is this screen's own business; everything else the
     hook does. */
  const opts = (action: keyof typeof DIRTIES) => ({
    after: listings.reload,
    onSettled: () => setDialog(null),
    dirties: DIRTIES[action],
  })

  const cancel = (a: Auction) =>
    void run(
      `cancel${a.auction_id}`,
      () =>
        cancelAuction(session!, {
          scope: a.fighter.classname,
          auctionId: a.auction_id,
        }),
      'Auction withdrawn.',
      opts('cancelAuction'),
    )

  const show = useCallback(
    (listing: Auction | InstantOffer) => {
      const f = listingAsFighter(listing)
      setDetail({
        kind: 'panel',
        panel: rosterPanel(f, levelMod, ageDecay),
        template: classes.get(f.classname),
      })
    },
    [classes, levelMod, ageDecay],
  )

  const pinned = phone && (tab === 'auctions' || tab === 'offers')
  const head = (
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
    </header>
  )
  /*
     Status and Sort are dropped rather than shown inert. Every listing is
     stamped "Market", so four of the five Status options match nothing and
     the fifth matches everything; and the board is ordered by the market's
     own sort below, which would silently override the roster one.
  */
  const browseTools = (
    <>
      <RosterFilters
        filter={filter}
        onChange={setFilter}
        roster={filterRoster}
        omit={['status', 'sort', 'markers']}
        sheet={
          phone
            ? { sort: { value: sort, options: MARKET_SORTS, onChange: (v) => setSort(v as MarketSort) } }
            : undefined
        }
      />
      {/* The roll-quality rules now come with `RosterFilters`, which
          is where every screen that has them wanted them. */}
      {/*
        One bar, two arrangements of the same grid: which face of the
        cards is up, and what order they are in. They were two boxes
        with the second floating clear of the first, which made the
        Order control look like it belonged to nothing.
      */}
      {!phone && (
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
      )}
    </>
  )

  return (
    <div className={`market${pinned ? ' market--pinned' : ''}`}>
      <img className="market__art" src={asset("/assets/background/bg-shop.png")} alt="" />
      <div className="market__scrim" />

      <div className="market__inner">

        {/*
           On the phone, Browse and Buy now pin the purse and the filter to the
           top and let only the rows scroll: the price on a row is weighed
           against the gems you hold, and the filter is what you reach for
           between looks.
        */}
        {pinned ? (
          <div className="mktop">
            {head}
            {browseTools}
          </div>
        ) : (
          head
        )}

        {error && <div className="alert alert--error">{error}</div>}

        <section className="panel market__panel">
          {!phone && (
          <div className="tabs" role="tablist">
            {(
              [
                ['auctions', 'Auctions'],
                ['offers', 'Buy Now'],
                ['mine', 'My Listings'],
                ['sell', 'Sell'],
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
          )}

          {!pinned && (tab === 'auctions' || tab === 'offers') && browseTools}

          {tab === 'auctions' && phone && (
            <PhoneRows loading={!auctions} empty="No auctions are running. List one and it will show up here.">
              {liveAuctions.map((a) => {
                const mine = a.owner === player.wallet
                return (
                  <ListingRow
                    key={`a${a.auction_id}`}
                    listing={a}
                    price={a.current_bid}
                    closing={extendsOnBid(a, config, now)}
                    open={openRow === `a${a.auction_id}`}
                    onToggle={() => toggleRow(`a${a.auction_id}`)}
                    template={classes.get(a.fighter.classname)}
                    unlockLevel={unlockLevel}
                    now={now}
                    onOpen={() => show(a)}
                    action={
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={mine}
                        onClick={() => setDialog({ kind: 'bid', auction: a })}
                      >
                        {mine ? 'Your auction' : `Bid ${minNextBid(a.current_bid, config)}`}
                      </button>
                    }
                  />
                )
              })}
            </PhoneRows>
          )}

          {tab === 'auctions' && !phone && (
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
                  unlockLevel={unlockLevel}
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

          {tab === 'offers' && phone && (
            <PhoneRows
              loading={!offers}
              empty="Nothing is on sale at a fixed price. These only appear when an auction ends unsold and the seller chose to keep it listed."
            >
              {liveOffers.map((o) => {
                const mine = o.owner === player.wallet
                return (
                  <ListingRow
                    key={`o${o.offer_id}`}
                    listing={o}
                    price={o.gems}
                    closing={false}
                    open={openRow === `o${o.offer_id}`}
                    onToggle={() => toggleRow(`o${o.offer_id}`)}
                    template={classes.get(o.fighter.classname)}
                    unlockLevel={unlockLevel}
                    now={now}
                    onOpen={() => show(o)}
                    action={
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={mine}
                        onClick={() => setDialog({ kind: 'buy', offer: o })}
                      >
                        {mine ? 'Your listing' : 'Buy'}
                      </button>
                    }
                  />
                )
              })}
            </PhoneRows>
          )}

          {tab === 'offers' && !phone && (
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
                  unlockLevel={unlockLevel}
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

          {tab === 'sell' && (
            <SellTab
              sellable={sellable}
              classes={classes}
              ageDecay={ageDecay}
              levelMod={levelMod}
              config={config}
              player={player}
              busy={busy === 'list'}
              onInspect={(f) =>
                setDetail({
                  kind: 'panel',
                  panel: rosterPanel(f, levelMod, ageDecay),
                  template: classes.get(f.classname),
                })
              }
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
                  opts('addAuction'),
                )
              }
            />
          )}

          {tab === 'mine' && phone && (
            <PhoneMine
              bids={myBids}
              auctions={myAuctions}
              offers={myOffers}
              config={config}
              now={now}
              busy={busy}
              player={player}
              classes={classes}
              unlockLevel={unlockLevel}
              openRow={openRow}
              onToggle={toggleRow}
              onOpen={show}
              onCancel={cancel}
              onSell={() => setTab('sell')}
            />
          )}

          {tab === 'mine' && !phone && (
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
              onCancel={cancel}
            />
          )}
        </section>
      </div>


      {phone && (
        <nav className="mkbar" role="tablist" aria-label="Market">
          {(
            [
              ['auctions', 'Browse'],
              ['offers', 'Buy now'],
              ['mine', 'Mine'],
              ['sell', 'Sell'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={`mkbar__tab${tab === key ? ' is-on' : ''}`}
              onClick={() => {
                setTab(key)
                setOpenRow(null)
              }}
            >
              <span>{label}</span>
              {counts[key] > 0 && <em className="mono">{counts[key]}</em>}
            </button>
          ))}
        </nav>
      )}

      {dialog?.kind === 'bid' && (
        <BidDialog
          auction={dialog.auction}
          config={config}
          player={player}
          now={now}
          busy={busy === 'bid'}
          phone={phone}
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
              opts('bidAuction'),
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
          phone={phone}
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
              opts('buyOffer'),
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


/* ---------- the phone: a row a listing, opened in place ---------- */

/**
 * One fighter as a phone row: portrait, who it is, and a right-hand column
 * the caller fills (a price and a clock on the board, a cue on Sell).
 *
 * A line can sit under the row whether or not it is open — what a listing
 * of your own is doing — and the row opens in place on whatever it was given
 * to show: the readouts on the board, the terms on Sell.
 */
function FighterRow({
  stats: f,
  ascension,
  template,
  right,
  open,
  onToggle,
  below,
  children,
}: {
  stats: RosterStats
  ascension: number
  template?: ClassTemplate
  right: React.ReactNode
  open: boolean
  onToggle: () => void
  below?: React.ReactNode
  children?: React.ReactNode
}) {
  const raw = f as unknown as Record<string, number>
  /*
     The four graded figures, each behind its stat's icon so an arrow says
     which number it grades: damage, health, cooldown, windup. Taunt is a role
     rather than a quality and carries no grade.
  */
  const grades = ROW_GRADES.map((field) => ({ field, grade: gradeOfStat(raw, field, template) }))
  /*
     A tag an ability, in its rarity's colour, the locked one hollow; and
     Sacrifice, which has no rarity and is the one ability a buyer may be
     shopping for (it feeds an ascension), as a skull on the portrait.
  */
  const abilities = f.abilities ?? []
  const sacrifice = abilities.some((a) => String(a.ability) === SACRIFICE_ABILITY)
  const tagged = abilities.filter((a) => String(a.ability) !== SACRIFICE_ABILITY)
  return (
    <div className={`mrow${open ? ' is-open' : ''}`}>
      <button type="button" className="mrow__hit" onClick={onToggle} aria-expanded={open}>
        <span className="mrow__art" style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}>
          <img
            src={fighterAvatar({ classname: f.classname, racename: f.racename })}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = fighterArtFallback()
            }}
          />
          {/* Level and ascension in one badge, the way a fighter is described. */}
          <span className="mrow__level">
            <span>L{f.level}</span>
            {ascension > 0 && (
              <em title={`Ascended ${ascension} time${ascension === 1 ? '' : 's'}`}>✦{ascension}</em>
            )}
          </span>
          {sacrifice && (
            <span className="mrow__skull" title="Has the Sacrifice ability">
              ☠
            </span>
          )}
        </span>
        <span className="mrow__who">
          <b>{f.classname}</b>
          <small>
            <img src={asset(`/assets/icons/elements/${f.element}.png`)} alt="" width={14} height={14} />
            {/* A fixed slot, so the grades stand in the same place on every row
                and the rows can be compared down the list. */}
            <span className="mrow__race">{f.racename}</span>
            <span className="mrow__grades">
              {grades.map(({ field, grade }) => (
                <span key={field} className="mrow__grade" title={`${STAT_LABEL[field] ?? field}${grade ? `: ${GRADE_LABEL[grade]}` : ''}`}>
                  <img className="mrow__staticon" src={statIcon(field)} alt="" />
                  {grade ? <img className="mrow__arrow" src={GRADE_ICON[grade]} alt="" /> : <i className="mrow__arrow" />}
                </span>
              ))}
            </span>
          </small>
          {tagged.length > 0 && (
            <span className="mrow__abilities">
              {tagged.map((a, i) => {
                const rarity = abilityRarity(a.displayname)
                return (
                  <span
                    key={`${a.ability}-${i}`}
                    className={`mrow__ab${a.locked ? ' is-locked' : ''}${rarity ? '' : ' is-plain'}`}
                    style={{ '--ab': rarity ? ABILITY_RARITY_COLOR[rarity] : undefined } as React.CSSProperties}
                    title={`${abilityName(a.displayname)}${rarity ? ` · ${rarity}` : ''}${a.locked ? ' · unlocks on ascension' : ''}`}
                  >
                    {rarity ? rarity.charAt(0).toUpperCase() : '·'}
                  </span>
                )
              })}
            </span>
          )}
        </span>
        {right}
      </button>
      {below && <div className="mrow__below">{below}</div>}
      {open && children && <div className="mrow__open">{children}</div>}
    </div>
  )
}

/**
 * One listing as a phone row: portrait, who it is, price and clock.
 *
 * A card a listing was a screenful each on a phone, so forty listings were
 * forty screens. The row is what is scanned; tapping it opens the same three
 * readouts the card has, and the bid or the buy, under it in place — the
 * list never goes away behind a dialog just to look.
 */
function ListingRow({
  listing,
  price,
  closing,
  open,
  onToggle,
  template,
  unlockLevel,
  now,
  below,
  action,
  onOpen,
}: {
  listing: Auction | InstantOffer
  price: number
  closing: boolean
  open: boolean
  onToggle: () => void
  template?: ClassTemplate
  unlockLevel?: number
  now: number
  /** What a listing of your own is doing, under the row. */
  below?: React.ReactNode
  /** The bid or buy button, or nothing on a listing of your own. */
  action?: React.ReactNode
  onOpen: () => void
}) {
  const f = listing.fighter
  return (
    <FighterRow
      stats={f}
      ascension={listing.ascension_level}
      template={template}
      open={open}
      onToggle={onToggle}
      below={below}
      right={
        <span className="mrow__price">
          <span className="mono">
            {price.toLocaleString(NUM_LOCALE)}
            <img src={asset('/assets/icons/gems.png')} alt="gems" width={14} height={14} />
          </span>
          <small className={closing ? 'is-closing' : ''}>{timeLeftLabel(msLeft(listing, now))}</small>
        </span>
      }
    >
      <ListingBody stats={f} template={template} readout="stats" unlockLevel={unlockLevel} />
      <div className="mrow__acts">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onOpen}>
          Details
        </button>
        {action}
      </div>
    </FighterRow>
  )
}

/**
 * Mine, on the phone: a section for each way a listing can stand.
 *
 * Winning — auctions where you hold the top bid. Selling — your auctions,
 * with who is on top and what you would net, and Withdraw while nobody has
 * bid (the only time the contract allows it). Fixed price — unsold fighters
 * kept at the market's fixed price, which cannot be withdrawn and end on the
 * fighter's payday.
 */
function PhoneMine({
  bids,
  auctions,
  offers,
  config,
  now,
  busy,
  player,
  classes,
  unlockLevel,
  openRow,
  onToggle,
  onOpen,
  onCancel,
  onSell,
}: {
  bids: Auction[]
  auctions: Auction[]
  offers: InstantOffer[]
  config: MarketConfig | undefined
  now: number
  busy: string | null
  player: NonNullable<ReturnType<typeof useGame.getState>['player']>
  classes: Map<string, ClassTemplate>
  unlockLevel?: number
  openRow: string | null
  onToggle: (key: string) => void
  onOpen: (l: Auction | InstantOffer) => void
  onCancel: (a: Auction) => void
  onSell: () => void
}) {
  if (bids.length + auctions.length + offers.length === 0) {
    return (
      <div className="mrows__empty">
        <p className="faint">Nothing of yours is on the market.</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onSell}>
          Sell a fighter
        </button>
      </div>
    )
  }
  const row = (key: string, l: Auction | InstantOffer, price: number, closing: boolean, below?: React.ReactNode) => (
    <ListingRow
      key={key}
      listing={l}
      price={price}
      closing={closing}
      open={openRow === key}
      onToggle={() => onToggle(key)}
      template={classes.get(l.fighter.classname)}
      unlockLevel={unlockLevel}
      now={now}
      below={below}
      onOpen={() => onOpen(l)}
    />
  )
  return (
    <>
      {bids.length > 0 && (
        <>
          <p className="mrows__head">
            <span>Winning · {bids.length}</span>
            <small>you hold the top bid</small>
          </p>
          <div className="mrows">
            {sortListings(bids, 'ending', now).map((a) =>
              row(`b${a.auction_id}`, a, a.current_bid, extendsOnBid(a, config, now)),
            )}
          </div>
        </>
      )}

      {auctions.length > 0 && (
        <>
          <p className="mrows__head">
            <span>Selling · {auctions.length}</span>
            <small>{Math.round(Number(config?.standard_duration_minutes ?? 0) / 60)}h auctions</small>
          </p>
          <div className="mrows">
            {sortListings(auctions, 'ending', now).map((a) => {
              const n = Number(a.bids)
              const gate = canCancelAuction(a, player)
              const ended = hasEnded(a, now)
              const cancelling = busy === `cancel${a.auction_id}`
              return row(
                `s${a.auction_id}`,
                a,
                a.current_bid,
                extendsOnBid(a, config, now),
                n > 0 ? (
                  <span className="mrow__line">
                    {n} bid{n === 1 ? '' : 's'} · top bid by <b>{a.current_bidder_gamertag || a.current_bidder}</b> · you
                    net <span className="mrow__lead">{sellerPayout(a.current_bid, config)}</span> after the fee
                  </span>
                ) : (
                  <>
                    <span className="mrow__line">
                      No bids yet · if nobody bids it{' '}
                      {a.keep_after_auction ? `stays listed at ${a.current_bid} gems` : 'comes back to you'}
                    </span>
                    {gate.ok && !ended && (
                      <button
                        type="button"
                        className="btn btn--sm mrow__withdraw"
                        onClick={() => onCancel(a)}
                        disabled={cancelling}
                      >
                        {cancelling && <span className="spinner" />}
                        Withdraw
                      </button>
                    )}
                  </>
                ),
              )
            })}
          </div>
        </>
      )}

      {offers.length > 0 && (
        <>
          <p className="mrows__head">
            <span>Fixed price · {offers.length}</span>
            <small>ends on the fighter's payday</small>
          </p>
          <div className="mrows">
            {sortListings(offers, 'ending', now).map((o) =>
              row(
                `o${o.offer_id}`,
                o,
                o.gems,
                false,
                <span className="mrow__line">
                  Can't be withdrawn · you net <span className="mrow__lead">{sellerPayout(o.gems, config)}</span> if it sells
                </span>,
              ),
            )}
          </div>
        </>
      )}
    </>
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

/** The phone's list: rows, a skeleton while reading, a line when empty. */
function PhoneRows({ loading, empty, children }: { loading: boolean; empty: string; children: React.ReactNode[] }) {
  if (loading) {
    return (
      <div className="mrows">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skeleton mrow mrow--loading" key={i} />
        ))}
      </div>
    )
  }
  if (children.length === 0) return <p className="faint listinggrid__empty">{empty}</p>
  return <div className="mrows">{children}</div>
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
        {/*
          What the fighter has been ascended to, opposite its level.

          An ascension is permanent, paid for, and the thing that unlocks the
          last ability — so between two otherwise identical listings it is
          most of the difference in what they are worth, and the market was
          the one screen carrying it in the data and not on the card. Absent
          below 1, the same rule My Fighters uses, so a card with no badge
          means the same thing on both screens.
        */}
        {listing.ascension_level > 0 && (
          <span
            className="listingcard__asc"
            title={`Ascended ${listing.ascension_level} time${listing.ascension_level === 1 ? '' : 's'}`}
          >
            Asc {listing.ascension_level}
          </span>
        )}
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
  unlockLevel,
}: {
  stats: RosterFighter['stats']
  template?: ClassTemplate
  readout: Readout
  /** Ascension level at which a locked ability starts working, from config. */
  unlockLevel?: number
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
          {abilities.map((a, i) => {
            /*
               A locked ability does nothing in a fight.

               Every fighter rolls with its last one locked, so this is the
               common case rather than an edge one — and on a market card it
               is the difference between what a fighter does and what it
               would do after somebody pays for several ascensions. Printed
               identically to a working ability, it was quietly overstating
               every listing on the screen.
            */
            const locked = !!a.locked
            return (
              <div
                className={`abilityline${locked ? ' abilityline--locked' : ''}`}
                key={`${a.ability}-${i}`}
              >
                <span
                  className="abilityline__name"
                  style={{ color: abilityColor(a.displayname) }}
                >
                  {abilityName(a.displayname)}
                  {abilityRarity(a.displayname) && (
                    <em className="abilityline__rarity">{abilityRarity(a.displayname)}</em>
                  )}
                </span>
                {locked && (
                  <span className="abilityline__lock">
                    <img src={asset('/assets/icons/lock.svg')} alt="" width={10} height={10} />
                    {unlockLevel
                      ? `Unlocks at ascension ${unlockLevel}`
                      : 'Unlocks on ascension'}
                  </span>
                )}
                <span className="abilityline__text">{resolveAbilityDescription(a)}</span>
              </div>
            )
          })}
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
  unlockLevel,
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
  unlockLevel?: number
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
      <ListingBody stats={auction.fighter} template={template} readout={readout} unlockLevel={unlockLevel} />

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
  unlockLevel,
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
  unlockLevel?: number
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
      <ListingBody stats={offer.fighter} template={template} readout={readout} unlockLevel={unlockLevel} />

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
  const panel = useModal(onClose)
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet__scrim" onClick={onClose} />
      <div className="sheet__panel marketdialog" ref={panel}>
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

/**
 * The frame a bid or a buy opens in: the phone's bottom sheet, in the quiet
 * palette its other sheets use, with the action held at the foot; the
 * centred dialog everywhere else.
 */
function DialogFrame({
  phone,
  title,
  onClose,
  action,
  children,
}: {
  phone: boolean
  title: string
  onClose: () => void
  action: React.ReactNode
  children: React.ReactNode
}) {
  if (phone) {
    return (
      <BottomSheet title={title} onClose={onClose} foot={<div className="rsheet__actions">{action}</div>}>
        {children}
      </BottomSheet>
    )
  }
  return (
    <Backdrop title={title} onClose={onClose}>
      {children}
      {action}
    </Backdrop>
  )
}

export function BidDialog({
  auction,
  config,
  player,
  now,
  busy,
  phone = false,
  onClose,
  onBid,
}: {
  auction: Auction
  config: MarketConfig | undefined
  player: ReturnType<typeof useGame.getState>['player']
  now: number
  busy: boolean
  phone?: boolean
  onClose: () => void
  onBid: (gems: number) => void
}) {
  const min = minNextBid(auction.current_bid, config)
  const [gems, setGems] = useState(min)
  const gate = canBid(auction, player!, config, gems, now)
  const closing = extendsOnBid(auction, config, now)
  const hint = phone ? 'rsheet__hint' : 'hint'

  return (
    <DialogFrame
      phone={phone}
      title={`Bid on ${auction.fighter.classname}`}
      onClose={onClose}
      action={
        <button
          type="button"
          className={`btn btn--primary${phone ? '' : ' btn--block'}`}
          onClick={() => onBid(gems)}
          disabled={busy || !gate.ok}
          title={gate.reason}
        >
          {busy && <span className="spinner" />}
          {gate.ok ? `Bid ${gems} gems` : gate.reason}
        </button>
      }
    >
      <dl className={phone ? 'mfacts' : 'marketdialog__facts'}>
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
      <p className={hint}>
        Your gems are taken as soon as you bid. If somebody outbids you they
        are refunded to you in the same transaction.
      </p>
      {closing && (
        <p className={hint}>
          This auction is inside its closing window, so any bid pushes the end
          back out by {Math.round(Number(config?.reset_duration_below_minutes ?? 0) / 60)} hours.
        </p>
      )}

      {phone ? (
        /* A thumb's stepper around the figure, which can still be typed. */
        <div className="mstep">
          <span className="rsheet__cap">Your bid</span>
          <div className="mstep__row">
            <button
              type="button"
              className="mstep__btn"
              onClick={() => setGems((g) => Math.max(min, g - 1))}
              disabled={gems <= min}
              aria-label="One gem less"
            >
              −
            </button>
            <input
              className="mstep__input mono"
              type="number"
              inputMode="numeric"
              min={min}
              step={1}
              value={gems}
              aria-label="Your bid"
              onChange={(e) => setGems(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
            <button
              type="button"
              className="mstep__btn"
              onClick={() => setGems((g) => g + 1)}
              aria-label="One gem more"
            >
              +
            </button>
          </div>
        </div>
      ) : (
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
      )}
    </DialogFrame>
  )
}

export function BuyDialog({
  offer,
  player,
  now,
  busy,
  phone = false,
  onClose,
  onBuy,
}: {
  offer: InstantOffer
  player: ReturnType<typeof useGame.getState>['player']
  now: number
  busy: boolean
  phone?: boolean
  onClose: () => void
  onBuy: () => void
}) {
  const gate = canBuy(offer, player!, now)
  return (
    <DialogFrame
      phone={phone}
      title={`Buy ${offer.fighter.classname}`}
      onClose={onClose}
      action={
        <button
          type="button"
          className={`btn btn--primary${phone ? '' : ' btn--block'}`}
          onClick={onBuy}
          disabled={busy || !gate.ok}
          title={gate.reason}
        >
          {busy && <span className="spinner" />}
          {gate.ok ? `Buy for ${offer.gems} gems` : gate.reason}
        </button>
      }
    >
      <dl className={phone ? 'mfacts' : 'marketdialog__facts'}>
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

      <p className={phone ? 'rsheet__hint' : 'hint'}>
        The fighter moves to your roster immediately. Its payday clock keeps
        running, and it is due at the time above.
      </p>
    </DialogFrame>
  )
}

/**
 * One sellable fighter, with the read the pickers already give.
 *
 * A seller is pricing the rolls and the tile says a class, a level and a
 * damage figure — everything the price actually turns on was behind a
 * button. This is the same card the dungeon and arena grids open on a rest
 * of the pointer, in the same way, so nothing new has to be learned and
 * nothing is built until the pointer settles on one.
 *
 * The hover is hung on a wrapper rather than the button: the hook measures
 * the element it is given, and the grid item is what the card should open
 * beside.
 */
function SellPickTile({
  fighter: f,
  classes,
  levelMod,
  ageDecay,
  picked,
  hoverStats,
  onPick,
}: {
  fighter: RosterFighter
  classes: Map<string, ClassTemplate>
  levelMod: number
  ageDecay: number
  picked: boolean
  hoverStats: boolean
  onPick: () => void
}) {
  const preview = useCallback(
    () => ({
      panel: rosterPanel(f, levelMod, ageDecay),
      template: classes.get(f.classname),
    }),
    [f, levelMod, ageDecay, classes],
  )
  const { ref, shown, close, handlers } = useHoverCard(preview, hoverStats)

  return (
    <div className="sellpick__slot" ref={ref} {...handlers}>
      {shown && (
        <HoverPopover anchor={shown.rect}>
          <FighterHoverCard fighter={shown.value.panel} template={shown.value.template} />
        </HoverPopover>
      )}
      <button
        type="button"
        className="sellpick__one"
        aria-pressed={picked}
        onClick={() => {
          close()
          onPick()
        }}
      >
        <Portrait element={f.element} classname={f.classname} racename={f.racename} />
        {!!f.marker && (
          <span className="sellpick__marker" title={`Marked ${f.marker}`}>
            <img src={markerIcon(f.marker)} alt="" width={14} height={14} />
          </span>
        )}
        <span className="sellpick__name">{f.classname}</span>
        <span className="sellpick__sub mono">
          L{f.stats.level} · {formatScaled(f.stats.damage_min)} dmg
        </span>
      </button>
    </div>
  )
}

export function SellTab({
  sellable,
  classes,
  ageDecay,
  levelMod,
  config,
  player,
  busy,
  onInspect,
  onList,
}: {
  sellable: RosterFighter[]
  /* The class bands, so the roll-quality rules have something to grade. */
  classes: Map<string, ClassTemplate>
  ageDecay: number
  /* Only the derived sorts read this; see `applyFilter`. */
  levelMod: number
  config: MarketConfig | undefined
  player: ReturnType<typeof useGame.getState>['player']
  busy: boolean
  /* Opens the full panel on the fighter being listed. */
  onInspect: (fighter: RosterFighter) => void
  onList: (fighterId: number, startPrice: number, keep: boolean) => void
}) {
  const minStart = Number(config?.gems_min_start_bid ?? 0)
  const [pickedId, setPickedId] = useState<number | null>(null)

  /*
     Its own filter, not the board’s.

     The tabs either side are filtering other people’s listings; this one is
     filtering your roster, and the two answer different questions with the
     same controls. Sharing one state would mean picking a fighter to sell
     re-sorted the auction board behind it.
  */
  const [filter, setFilter] = useState<RosterFilter>({ ...EMPTY_FILTER })
  /* Asked once here rather than in every tile; a roster is sixty of them. */
  const phone = usePhone()
  const shown = useMemo(
    () => applyFilter(sellable, filter, ageDecay, Date.now(), classes, undefined, levelMod),
    [sellable, filter, ageDecay, classes, levelMod],
  )
  const [price, setPrice] = useState(minStart)
  /* Ticked by default: an unsold fighter staying up at the price its seller
     already chose is the outcome most of them want, and the box is right
     there to untick. */
  const [keep, setKeep] = useState(true)
  /* Whether the terms are open. The choice is the page; this is the deal. */
  const [selling, setSelling] = useState(false)

  useEffect(() => setPrice(minStart), [minStart])

  const picked = sellable.find((f) => f.fighter_id === pickedId) ?? null
  const gate = canList(picked, price, player!, config)
  const hours = Math.round(Number(config?.standard_duration_minutes ?? 0) / 60)

  /*
     The dialog shuts itself once the listing lands.

     `onList` is fired and forgotten — the screen finds out it worked when
     the reload drops the fighter out of `sellable`, because it is in the
     market now. That is also the moment everything the dialog is saying
     stops being true, so it is the moment to close it.
  */
  useEffect(() => {
    if (!selling || pickedId === null) return
    if (sellable.some((f) => f.fighter_id === pickedId)) return
    setSelling(false)
    setPickedId(null)
  }, [selling, pickedId, sellable])

  /*
     The phone: the roster as the board's rows, under the same filter, and
     the terms opened in place under the fighter tapped — the price, whether
     to keep it listed, and what selling at that price would actually pay.
  */
  if (phone) {
    const listFee = Number(config?.gems_listing_price ?? 0)
    const resetHours = Math.round(Number(config?.reset_duration_below_minutes ?? 0) / 60)
    const payout = sellerPayout(price, config)
    const quick = [10, 25, 50, 100, 250].filter((q) => q >= minStart)
    return (
      <div className="selltab selltab--phone">
        {sellable.length === 0 ? (
          <p className="faint">
            None of your fighters can be listed right now. A fighter has to be
            active, idle, and not yet asking for a payday.
          </p>
        ) : (
          <>
            <RosterFilters filter={filter} onChange={setFilter} roster={sellable} sheet={{}} />
            {shown.length === 0 ? (
              <p className="faint">No fighter you can sell matches these filters.</p>
            ) : (
              <div className="mrows">
                {shown.map((f) => {
                  const open = f.fighter_id === pickedId
                  return (
                    <FighterRow
                      key={f.fighter_id}
                      stats={f.stats}
                      ascension={f.ascension_level}
                      template={classes.get(f.classname)}
                      open={open}
                      onToggle={() => setPickedId(open ? null : f.fighter_id)}
                      right={<span className="mrow__price mrow__cue">{open ? 'Close' : 'Sell ›'}</span>}
                    >
                      <div className="mstep">
                        <span className="msell__cap">Starting price</span>
                        <div className="mstep__row">
                          <button
                            type="button"
                            className="mstep__btn"
                            onClick={() => setPrice((p) => Math.max(minStart, p - 1))}
                            disabled={price <= minStart}
                            aria-label="One gem less"
                          >
                            −
                          </button>
                          <input
                            className="mstep__input mono"
                            type="number"
                            inputMode="numeric"
                            min={minStart}
                            step={1}
                            value={price}
                            aria-label="Starting price"
                            onChange={(e) => setPrice(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                          />
                          <button
                            type="button"
                            className="mstep__btn"
                            onClick={() => setPrice((p) => p + 1)}
                            aria-label="One gem more"
                          >
                            +
                          </button>
                        </div>
                        <div className="msell__quick">
                          {quick.map((q) => (
                            <button
                              type="button"
                              key={q}
                              className={price === q ? 'is-on' : ''}
                              onClick={() => setPrice(q)}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="msell__keep">
                        <span className="toggle">
                          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                          <span className="toggle__track" aria-hidden="true">
                            <span className="toggle__thumb" />
                          </span>
                        </span>
                        <span>
                          If nobody bids, keep it listed at <b className="mono">{price}</b> gems
                        </span>
                      </label>

                      <dl className="mfacts">
                        <div>
                          <dt>Starting price</dt>
                          <dd className="mono">{price}</dd>
                        </div>
                        <div>
                          <dt>Market fee on a sale ({config?.gems_processing_fee_percent ?? 0}%)</dt>
                          <dd className="mono">−{price - payout}</dd>
                        </div>
                        <div className="is-total">
                          <dt>You get if it sells at this price</dt>
                          <dd className="mono">{payout}</dd>
                        </div>
                      </dl>
                      <p className="msell__hint">
                        Listing costs {listFee} gem{listFee === 1 ? '' : 's'} now, sold or not. It runs {hours}h, and a bid in
                        the last {resetHours}h pushes the end back out. Once anybody bids it can't be withdrawn.
                      </p>

                      <div className="mrow__acts">
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onInspect(f)}>
                          Details
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => {
                            setSelling(true)
                            onList(f.fighter_id, price, keep)
                          }}
                          disabled={busy || !gate.ok}
                          title={gate.reason}
                        >
                          {busy && <span className="spinner" />}
                          {gate.ok ? `List for ${price} · costs ${listFee}` : gate.reason}
                        </button>
                      </div>
                    </FighterRow>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="selltab">
      {sellable.length === 0 ? (
        <p className="faint">
          None of your fighters can be listed right now. A fighter has to be
          active, idle, and not yet asking for a payday.
        </p>
      ) : (
        <>
          {/*
            The bar over the roster it is choosing from.

            The same arrangement My Fighters uses, and for the same reason:
            the button acts on something below it, the thing below it is
            usually past the fold, and scrolling back up to reach the button
            for the fighter you just tapped is the whole interaction. It
            pins itself only once there is a fighter to act on, so an
            untouched tab is not carrying a bar that does nothing.
          */}
          <div className={`selltab__bar${picked ? ' selltab__bar--pinned' : ''}`}>
            {picked ? (
              <span className="selltab__who">
                <span className="selltab__face">
                  <Portrait
                    element={picked.element}
                    classname={picked.classname}
                    racename={picked.racename}
                  />
                </span>
                <span>
                  <b>{picked.classname}</b>
                  <em className="faint mono">
                    L{picked.stats.level} · {picked.racename}
                  </em>
                </span>
              </span>
            ) : (
              <span className="selltab__who selltab__who--none">
                Pick a fighter below to sell it.
              </span>
            )}

            {/*
               Listing a fighter is permanent for as long as the auction
               runs, and a tile says a class and a level. The whole panel —
               every graded roll, the resistances, the abilities — is what a
               seller is actually pricing, so it is one button away rather
               than something to go and look up on another screen. It stays
               out here: from inside the terms it would be a second sheet on
               top of the first.
            */}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => picked && onInspect(picked)}
              disabled={!picked}
              title={picked ? undefined : 'Pick a fighter first'}
            >
              View fighter
            </button>

            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setSelling(true)}
              disabled={!picked}
              title={picked ? undefined : 'Pick a fighter first'}
            >
              Sell
            </button>
          </div>

          {/* The roll-quality rules come with `RosterFilters`, which renders
              them itself — a second one here was a duplicate of the same two
              selects, and would now be the copy that did not fold away. */}
          <RosterFilters filter={filter} onChange={setFilter} roster={sellable} />

          {shown.length === 0 ? (
            <p className="faint">No fighter you can sell matches these filters.</p>
          ) : (
          <div className="sellpick">
            {shown.map((f) => (
              <SellPickTile
                key={f.fighter_id}
                fighter={f}
                classes={classes}
                levelMod={levelMod}
                ageDecay={ageDecay}
                picked={f.fighter_id === pickedId}
                hoverStats={!phone}
                onPick={() => setPickedId(f.fighter_id)}
              />
            ))}
          </div>
          )}

          {selling && picked && (
            <Backdrop title={`Sell ${picked.classname}`} onClose={() => setSelling(false)}>
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
                  Keep listed if nobody bids
                  <em className="faint">
                    {' '}
                    — it becomes a fixed-price instant buy offer at your
                    starting price instead of coming back to you
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
                onClick={() => onList(picked.fighter_id, price, keep)}
                disabled={busy || !gate.ok}
                title={gate.reason}
              >
                {busy && <span className="spinner" />}
                {gate.ok
                  ? `List for ${config?.gems_listing_price ?? 0} gems`
                  : gate.reason}
              </button>
            </Backdrop>
          )}
        </>
      )}
    </div>
  )
}

