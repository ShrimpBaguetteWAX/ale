import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { FighterAbilities, FighterStats, type PanelFighter } from '@/components/FighterPanel'
import { GameImg } from '@/components/GameImg'
import { useAction } from '@/wharf/useAction'
import { DIRTIES } from '@/wharf/actions'
import { fighterAvailable } from '@/dungeon/rules'
import { ageNote } from '@/fighters/rules'
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
  RosterFilters,
  rosterPanel,
  type Detail,
} from '@/fight/setup'
import { elementBackground, fighterArt, fighterArtFallback, type ClassTemplate, elementIcon } from '@/tavern/fighterStats'
import { addAuction, bidAuction, buyOffer, cancelAuction } from '@/wharf/actions'
import { SACRIFICE_ABILITY } from '@/ascension/rules'
import { asset } from '@/assets'
import { Row, VIEWS, figuresOf, type View } from '@/fighters/DeskRoster'

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

/** What the bid / buy dialog is doing. Selling is a tab. */
type Dialog =
  | { kind: 'bid'; auction: Auction }
  | { kind: 'buy'; offer: InstantOffer }
  | null

/*
 * A board this wide gives its list My Fighters' full desktop row — the stats
 * in columns under one head, the price and the clock in a column of their
 * own at the right; narrower, the list takes the stacked card instead.
 */
const WIDE_BOARD = 1360
const WideBoard = createContext(false)
/* What the cards show — Default, Stats, Res, Combat, Abilities — as on My Fighters. */
const CardView = createContext<View>('default')

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

  /* `?tab=mine` opens on your listings — My Fighters links there. */
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(
    () => (['auctions', 'offers', 'mine', 'sell'] as Tab[]).find((t) => t === params.get('tab')) ?? 'auctions',
  )
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
  /* The board's own width, as the side rail takes a different share at each window size. */
  const [boardW, setBoardW] = useState(0)
  const sizeObs = useRef<ResizeObserver | null>(null)
  const panelRef = useCallback((el: HTMLElement | null) => {
    sizeObs.current?.disconnect()
    if (!el || typeof ResizeObserver === 'undefined') return
    sizeObs.current = new ResizeObserver(([e]) => setBoardW(e.contentRect.width))
    sizeObs.current.observe(el)
  }, [])
  const wide = !phone && boardW >= WIDE_BOARD
  const [view, setView] = useState<View>('default')
  const toggleRow = (key: string) => setOpenRow((k) => (k === key ? null : key))
  /* A desktop shows one listing in full beside the list: which one. */
  const [pick, setPick] = useState<string | null>(null)

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

  /*
     The player's own markers, by fighter. A listing carries no marker — it
     is private to the owner and never reaches the market's tables — so a
     listing of the player's own is matched back to their roster for it.
     Only Mine and Sell draw them: Browse and Buy now are other people's.
  */
  const markerOf = useMemo(
    () => new Map((roster ?? []).filter((f) => f.marker).map((f) => [f.fighter_id, f.marker])),
    [roster],
  )

  const counts: Record<Tab, number> = {
    auctions: liveAuctions.length,
    offers: liveOffers.length,
    mine: myAuctions.length + myOffers.length + myBids.length,
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

  const placeBid = (a: Auction, gems: number) =>
    void run(
      'bid',
      () =>
        bidAuction(session!, {
          scope: a.fighter.classname,
          auctionId: a.auction_id,
          gems,
        }),
      'Bid placed.',
      opts('bidAuction'),
    )

  const buyNow = (o: InstantOffer) =>
    void run(
      'buy',
      () =>
        buyOffer(session!, {
          scope: o.fighter.classname,
          offerId: o.offer_id,
          gems: o.gems,
        }),
      'Bought. The fighter is on your roster.',
      opts('buyOffer'),
    )

  /*
     The desktop board: the list on the tab, and the listing shown in full —
     the one picked, or the first, so the middle is never empty while there
     is anything to show.
  */
  const mineBids = useMemo(() => sortListings(myBids, 'ending', now), [myBids, now])
  const mineAuctions = useMemo(() => sortListings(myAuctions, 'ending', now), [myAuctions, now])
  const mineOffers = useMemo(() => sortListings(myOffers, 'ending', now), [myOffers, now])
  const board: (Auction | InstantOffer)[] =
    tab === 'offers'
      ? liveOffers
      : tab === 'mine'
        ? [...mineBids, ...mineAuctions, ...mineOffers]
        : liveAuctions
  const picked = board.find((l) => listingKey(l) === pick) ?? board[0] ?? null
  /* A row of the desktop list: picking it shows it beside the list. */
  const deskRow = (l: Auction | InstantOffer) => (
    <MarketCard
      key={listingKey(l)}
      listing={l}
      price={'auction_id' in l ? l.current_bid : l.gems}
      closing={'auction_id' in l && extendsOnBid(l, config, now)}
      picked={l === picked}
      onPick={() => setPick(listingKey(l))}
      now={now}
      marker={tab === 'mine' ? markerOf.get(l.fighter_id) : undefined}
      wide={wide}
    />
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
        <img src={asset("/assets/icons/gems.svg")} alt="gems" width={18} height={18} />
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
        sheet={{ sort: { value: sort, options: MARKET_SORTS, onChange: (v) => setSort(v as MarketSort) } }}
      />
      {/* The roll-quality rules now come with `RosterFilters`, which
          is where every screen that has them wanted them. */}
    </>
  )

  return (
    <WideBoard.Provider value={wide}>
    <CardView.Provider value={view}>
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

        <section className="panel market__panel" ref={panelRef}>
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

          {/* What the cards show, as on My Fighters: one switch, for every tab. */}
          <span className="drost__seg drost__seg--sm mview" role="tablist" aria-label="Cards show">
            {VIEWS.map(([v, label]) => (
              <button type="button" role="tab" key={v} aria-selected={view === v} onClick={() => setView(v)}>
                {label}
              </button>
            ))}
          </span>

          {!phone && (tab === 'auctions' || tab === 'offers' || tab === 'mine') && (
            <DeskBoard
              order={board}
              picked={picked}
              onPick={(l) => setPick(listingKey(l))}
              list={
                tab === 'mine' ? (
                  !auctions || !offers ? (
                    <PhoneRows loading empty="">
                      {[]}
                    </PhoneRows>
                  ) : board.length === 0 ? (
                    <div className="mrows__empty">
                      <p className="faint">Nothing of yours is on the market.</p>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTab('sell')}>
                        Sell a fighter
                      </button>
                    </div>
                  ) : (
                    /* Mine in the phone's sections, by where each listing stands. */
                    (
                      [
                        ['Winning', mineBids, 'you hold the top bid'],
                        ['Selling', mineAuctions, `${Math.round(Number(config?.standard_duration_minutes ?? 0) / 60)}h auctions`],
                        ['Fixed price', mineOffers, "ends on the fighter's payday"],
                      ] as [string, (Auction | InstantOffer)[], string][]
                    ).map(
                      ([title, ls, note]) =>
                        ls.length > 0 && (
                          <Fragment key={title}>
                            <p className="mrows__head">
                              <span>
                                {title} · {ls.length}
                              </span>
                              <small>{note}</small>
                            </p>
                            <div className="mrows">{ls.map(deskRow)}</div>
                          </Fragment>
                        ),
                    )
                  )
                ) : (
                  <>
                    {browseTools}
                    <PhoneRows
                      loading={tab === 'auctions' ? !auctions : !offers}
                      empty={
                        tab === 'auctions'
                          ? 'No auctions are running. List one and it will show up here.'
                          : 'Nothing is on sale at a fixed price. These only appear when an auction ends unsold and the seller chose to keep it listed.'
                      }
                    >
                      {board.map(deskRow)}
                    </PhoneRows>
                  </>
                )
              }
              fighter={
                picked && (
                  <ListingFighter
                    listing={picked}
                    panel={rosterPanel(listingAsFighter(picked), levelMod, ageDecay)}
                    template={classes.get(picked.fighter.classname)}
                    unlockLevel={unlockLevel}
                    marker={tab === 'mine' ? markerOf.get(picked.fighter_id) : undefined}
                  />
                )
              }
              deal={
                picked &&
                ('auction_id' in picked ? (
                  <AuctionDeal
                    key={listingKey(picked)}
                    auction={picked}
                    config={config}
                    player={player}
                    now={now}
                    busy={busy}
                    onBid={(gems) => placeBid(picked, gems)}
                    onCancel={() => cancel(picked)}
                  />
                ) : (
                  <OfferDeal
                    key={listingKey(picked)}
                    offer={picked}
                    config={config}
                    player={player}
                    now={now}
                    busy={busy === 'buy'}
                    onBuy={() => buyNow(picked)}
                  />
                ))
              }
            />
          )}

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

          {tab === 'sell' && (
            <SellTab
              sellable={sellable}
              classes={classes}
              ageDecay={ageDecay}
              levelMod={levelMod}
              config={config}
              player={player}
              busy={busy === 'list'}
              unlockLevel={unlockLevel}
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
              markerOf={markerOf}
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
          onBid={(gems) => placeBid(dialog.auction, gems)}
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
          onBuy={() => buyNow(dialog.offer)}
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
    </CardView.Provider>
    </WideBoard.Provider>
  )
}


/* ---------- the desktop: My Fighters' card, with the price ---------- */

/**
 * A listing on the desktop board, as My Fighters draws a fighter: the same
 * card, so a fighter looks the same in your roster and on sale. The price
 * and the time left take the end of the name line.
 *
 * Every listed fighter is "in use" by the market; saying "In Market" on each
 * card of the market is noise, so the card is drawn as if free. A payday the
 * fighter is overdue on still shows.
 */
function MarketCard({
  listing,
  price,
  closing,
  picked,
  onPick,
  now,
  marker,
  wide,
}: {
  listing: Auction | InstantOffer
  price: number
  closing: boolean
  picked: boolean
  onPick: () => void
  now: number
  /** The player's marker, for a listing of their own. */
  marker?: string
  /** A wide board: the price takes a column of its own rather than the name line. */
  wide: boolean
}) {
  const { classes, fighters, levelMod, ageDecay } = useConfig()
  const view = useContext(CardView)
  const f = useMemo(
    () => ({ ...listingAsFighter(listing), in_use: 0, marker: marker ?? '' }),
    [listing, marker],
  )
  const fig = useMemo(
    () => figuresOf(f, classes.get(f.classname), fighters, levelMod, ageDecay, now, false),
    [f, classes, fighters, levelMod, ageDecay, now],
  )
  return (
    <Row
      f={f}
      fig={fig}
      view={view}
      mode="inventory"
      now={now}
      picked={picked}
      checked={false}
      gate={{ ok: true }}
      onClick={onPick}
      wideAside={!wide}
      aside={
        <span className="mcard__price">
          <b className="mono">
            {price.toLocaleString(NUM_LOCALE)}
            <img src={asset('/assets/icons/gems.svg')} alt="gems" />
          </b>
          <small className={closing ? 'is-closing' : ''}>{timeLeftLabel(msLeft(listing, now))}</small>
        </span>
      }
    />
  )
}

/** One of your own fighters on the desktop Sell board: My Fighters' card, as it is there. */
function OwnCard({
  f,
  picked,
  onPick,
  cue = 'Sell ›',
}: {
  f: RosterFighter
  picked: boolean
  onPick: () => void
  cue?: string
}) {
  const { classes, fighters, levelMod, ageDecay } = useConfig()
  const view = useContext(CardView)
  const [now] = useState(() => Date.now())
  const fig = useMemo(
    () => figuresOf(f, classes.get(f.classname), fighters, levelMod, ageDecay, now, false),
    [f, classes, fighters, levelMod, ageDecay, now],
  )
  return (
    <Row
      f={f}
      fig={fig}
      view={view}
      mode="inventory"
      now={now}
      picked={picked}
      checked={false}
      gate={{ ok: true }}
      onClick={onPick}
      aside={<span className="mrow__cue">{cue}</span>}
    />
  )
}

/* ---------- the phone: a row a listing, opened in place ---------- */

/**
 * One listing on the phone, as My Fighters draws a fighter there: the same
 * card, the price and its clock at the end of the name line. Tapping it opens
 * Details and the bid or the buy under it in place — the list never goes away
 * behind a dialog just to look.
 *
 * As on the desktop board, the card is drawn as if free: "In Market" on every
 * card of the market says nothing.
 */
function ListingRow({
  listing,
  price,
  closing,
  open,
  onToggle,
  now,
  below,
  marker,
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
  /** What a listing of your own is doing, under the card. */
  below?: React.ReactNode
  /** The player's marker, for a listing of their own. */
  marker?: string
  /** The bid or buy button, or nothing on a listing of your own. */
  action?: React.ReactNode
  onOpen: () => void
}) {
  const { classes, fighters, levelMod, ageDecay } = useConfig()
  const view = useContext(CardView)
  const f = useMemo(
    () => ({ ...listingAsFighter(listing), in_use: 0, marker: marker ?? '' }),
    [listing, marker],
  )
  const fig = useMemo(
    () => figuresOf(f, classes.get(f.classname), fighters, levelMod, ageDecay, now, false),
    [f, classes, fighters, levelMod, ageDecay, now],
  )
  return (
    <div className={`drost--stack mcard${open ? ' is-open' : ''}`}>
      <Row
        f={f}
        fig={fig}
        view={view}
        mode="inventory"
        now={now}
        picked={open}
        checked={false}
        gate={{ ok: true }}
        onClick={onToggle}
        note={below}
        wideAside
        aside={
          <span className="mcard__price">
            <b className="mono">
              {price.toLocaleString(NUM_LOCALE)}
              <img src={asset('/assets/icons/gems.svg')} alt="gems" />
            </b>
            <small className={closing ? 'is-closing' : ''}>{timeLeftLabel(msLeft(listing, now))}</small>
          </span>
        }
      />
      {open && (
        <div className="mcard__acts">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onOpen}>
            Details
          </button>
          {action}
        </div>
      )}
    </div>
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
  markerOf,
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
  /** The player's markers by fighter, for their own listings. */
  markerOf: Map<number, string>
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
      marker={markerOf.get(l.fighter_id)}
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

/* ---------- the desktop board: the list, the fighter, the deal ---------- */

const listingKey = (l: Auction | InstantOffer) => ('auction_id' in l ? `a${l.auction_id}` : `o${l.offer_id}`)

/** "23 Oct", for the dates a listing carries. */
function shortDay(date: string): string {
  const t = Date.parse(date + 'Z')
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'
}

/** Up to the next multiple of `step`, for quick bids that read as round numbers. */
const roundUp = (n: number, step: number) => Math.ceil(n / step) * step

/**
 * The desktop market: the phone's list on the left, the one picked shown in
 * full in the middle, and what can be done with it on the right — a bid, a
 * buy, a withdrawal, a listing, by tab.
 *
 * A desktop has the width to stop asking a player to open each fighter to
 * judge it: the rolls, the resistances and every ability's text stand next
 * to the price, and the deal is beside them. The arrow keys walk the list,
 * so comparing two fighters is a keypress.
 */
function DeskBoard<T>({
  order,
  picked,
  onPick,
  list,
  fighter,
  deal,
}: {
  /** Everything in the list, top to bottom, for the arrow keys. */
  order: T[]
  picked: T | null
  onPick: (item: T) => void
  list: React.ReactNode
  fighter: React.ReactNode
  deal: React.ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const wide = useContext(WideBoard)
  const index = picked === null ? -1 : order.indexOf(picked)

  /* The picked row kept in sight as the keys walk past the fold. */
  useEffect(() => {
    const row = box.current?.querySelector('.mrow.is-open, .drost__row.is-picked')
    /* Absent where there is no layout to scroll, as in the tests' DOM. */
    if (typeof row?.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
  }, [picked])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if ((e.target as HTMLElement).closest('input, select, textarea')) return
    const next = order[Math.min(order.length - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (next === undefined) return
    e.preventDefault()
    onPick(next)
  }

  return (
    <div className={`mdesk${wide ? ' mdesk--wide' : ''}`}>
      {/* Narrow, the list is a phone's width and takes My Fighters' stacked card. */}
      <div className={`mdesk__list${wide ? '' : ' drost--stack'}`} ref={box} onKeyDown={onKey}>
        {list}
      </div>
      {/* One box for the two, so a narrower board can stack them in one
          column; a wide one lays them out as columns of their own. */}
      {picked !== null && (
        <div className="mdesk__side">
          {fighter}
          {deal}
        </div>
      )}
    </div>
  )
}

/**
 * A fighter in full: what the Details sheet shows, standing in the board
 * rather than over it. The game's own stat lines, resistances and ability
 * texts, laid out as tiles for the width. The same for a listing and for a
 * fighter of your own about to be listed; `facts` is what differs.
 */
function MarketFighter({
  stats: f,
  ascension,
  id,
  panel,
  template,
  unlockLevel,
  facts,
  marker,
}: {
  stats: RosterStats
  ascension: number
  id: number
  panel: PanelFighter
  template?: ClassTemplate
  unlockLevel?: number
  /** The dated lines under the name: listed, payday. */
  facts: string[]
  /** The player's marker, on a fighter of their own. */
  marker?: string
}) {
  const sacrifice = (f.abilities ?? []).some((a) => String(a.ability) === SACRIFICE_ABILITY)
  return (
    <section className="mfighter" aria-label={`${f.classname}, in full`}>
      <div className="mfighter__hero">
        <span className="mfighter__art" style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}>
          <GameImg
            src={fighterArt({ classname: f.classname, racename: f.racename })}
            fallback={fighterArtFallback()}
            alt=""
          />
          <span className="mrow__level">
            <span>Level {f.level}</span>
            {ascension > 0 && <em>✦{ascension}</em>}
          </span>
          {marker && (
            <span className="mrow__marker" title="Your marker">
              <img src={markerIcon(marker)} alt="" />
            </span>
          )}
          {sacrifice && (
            <span className="mrow__skull" title="Has the Sacrifice ability">
              ☠
            </span>
          )}
        </span>
        <div className="mfighter__who">
          <span className="mfighter__kick">Fighter #{id}</span>
          <h2 className="mfighter__name">{f.classname}</h2>
          <span className="mfighter__line">
            <img src={elementIcon(f.element)} alt="" width={18} height={18} />
            {f.racename} · {f.element}
          </span>
          <div className="mfighter__meta">
            {facts.map((t) => (
              <span key={t}>{t}</span>
            ))}
            {panel.age && (
              <span
                className="mfighter__age"
                title={ageNote(panel.age.bonus, panel.age.days, panel.age.factor)}
              >
                Age {panel.age.bonus > 0 ? '+' : ''}
                {panel.age.bonus.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>
      <h3 className="mfighter__cap">Stats</h3>
      <FighterStats fighter={panel} template={template} />
      {panel.abilities.length > 0 && (
        <>
          <h3 className="mfighter__cap">Abilities · {panel.abilities.length}</h3>
          <FighterAbilities abilities={panel.abilities} abilityUnlockLevel={unlockLevel} />
        </>
      )}
    </section>
  )
}

/** A listing in full, with the dates a buyer weighs. */
function ListingFighter({
  listing,
  panel,
  template,
  unlockLevel,
  marker,
}: {
  listing: Auction | InstantOffer
  panel: PanelFighter
  template?: ClassTemplate
  unlockLevel?: number
  marker?: string
}) {
  return (
    <MarketFighter
      marker={marker}
      stats={listing.fighter}
      ascension={listing.ascension_level}
      id={listing.fighter_id}
      panel={panel}
      template={template}
      unlockLevel={unlockLevel}
      facts={[
        `Listed ${shortDay('auction_id' in listing ? listing.auction_start : listing.offer_start)}`,
        `Payday ${shortDay(listing.next_payday)}`,
      ]}
    />
  )
}

/** An auction's side of the board: where it stands, and the bid. */
function AuctionDeal({
  auction: a,
  config,
  player,
  now,
  busy,
  onBid,
  onCancel,
}: {
  auction: Auction
  config: MarketConfig | undefined
  player: NonNullable<ReturnType<typeof useGame.getState>['player']>
  now: number
  busy: string | null
  onBid: (gems: number) => void
  onCancel: () => void
}) {
  const mine = a.owner === player.wallet
  const min = minNextBid(a.current_bid, config)
  const [gems, setGems] = useState(min)
  /* A bid landing elsewhere raises the floor under the one being typed. */
  useEffect(() => setGems((g) => Math.max(g, min)), [min])
  const gate = canBid(a, player, config, gems, now)
  const withdraw = canCancelAuction(a, player)
  const n = Number(a.bids)
  const closing = extendsOnBid(a, config, now)
  const quick = [...new Set([min, roundUp(min * 1.1, 5), roundUp(min * 1.4, 10), roundUp(min * 1.85, 10)])]
  const gemIcon = <img src={asset('/assets/icons/gems.svg')} alt="gems" width={14} height={14} />

  return (
    <aside className="mdeal" aria-label="The auction">
      <span className="mdeal__cap">{mine ? 'Your auction' : 'Auction'}</span>
      <div className="mdeal__price">
        <span className="mono">
          {a.current_bid.toLocaleString(NUM_LOCALE)}
          <img src={asset('/assets/icons/gems.svg')} alt="gems" width={20} height={20} />
        </span>
        <small>
          {n > 0
            ? `${n} bid${n === 1 ? '' : 's'} · top bid by ${a.current_bidder_gamertag || a.current_bidder}`
            : 'starting price · no bids yet'}
        </small>
      </div>
      <dl className="mfacts">
        {!mine && (
          <div>
            <dt>Minimum bid</dt>
            <dd className="mono">{min}</dd>
          </div>
        )}
        <div>
          <dt>Ends in</dt>
          <dd className={`mono${closing ? ' is-closing' : ''}`}>{timeLeftLabel(msLeft(a, now))}</dd>
        </div>
        <div>
          <dt>Seller</dt>
          <dd>{mine ? 'You' : a.owner_gamertag}</dd>
        </div>
        {mine ? (
          <div className="is-total">
            <dt>You net at {a.current_bid}</dt>
            <dd className="mono">{sellerPayout(a.current_bid, config)}</dd>
          </div>
        ) : (
          <div>
            <dt>Your gems</dt>
            <dd className="mono">{player.activestats.gems.toLocaleString(NUM_LOCALE)}</dd>
          </div>
        )}
      </dl>

      {mine ? (
        withdraw.ok ? (
          <>
            <button
              type="button"
              className="btn mrow__withdraw mdeal__go"
              onClick={onCancel}
              disabled={busy === `cancel${a.auction_id}`}
            >
              {busy === `cancel${a.auction_id}` && <span className="spinner" />}
              Withdraw
            </button>
            <p className="msell__hint">An auction can be withdrawn until the first bid. After that it runs to the end.</p>
          </>
        ) : (
          <p className="msell__hint">Somebody has bid, so it runs to the end.</p>
        )
      ) : (
        <>
          <span className="mdeal__cap">Your bid</span>
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
            <button type="button" className="mstep__btn" onClick={() => setGems((g) => g + 1)} aria-label="One gem more">
              +
            </button>
          </div>
          <div className="msell__quick">
            {quick.map((q) => (
              <button type="button" key={q} className={gems === q ? 'is-on' : ''} onClick={() => setGems(q)}>
                {q}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--primary mdeal__go"
            onClick={() => onBid(gems)}
            disabled={busy === 'bid' || !gate.ok}
            title={gate.reason}
          >
            {busy === 'bid' && <span className="spinner" />}
            {gate.ok ? (
              <span className="msell__go">
                Bid {gems}
                {gemIcon}
              </span>
            ) : (
              gate.reason
            )}
          </button>
          <p className="msell__hint">
            Your gems are taken as soon as you bid. If somebody outbids you they are refunded to you in the same
            transaction.
          </p>
          {closing && (
            <p className="msell__hint">
              This auction is inside its closing window, so any bid pushes the end back out by{' '}
              {Math.round(Number(config?.reset_duration_below_minutes ?? 0) / 60)} hours.
            </p>
          )}
          {n === 0 && (
            <p className="msell__hint">
              The first bid has to clear the starting price by the minimum raise, so {a.current_bid} opens at {min}.
            </p>
          )}
        </>
      )}
    </aside>
  )
}

/** A fixed-price offer's side of the board: the price, and the buy. */
function OfferDeal({
  offer: o,
  config,
  player,
  now,
  busy,
  onBuy,
}: {
  offer: InstantOffer
  config: MarketConfig | undefined
  player: NonNullable<ReturnType<typeof useGame.getState>['player']>
  now: number
  busy: boolean
  onBuy: () => void
}) {
  const mine = o.owner === player.wallet
  const gate = canBuy(o, player, now)
  return (
    <aside className="mdeal" aria-label="The offer">
      <span className="mdeal__cap">{mine ? 'Your fixed-price listing' : 'Buy now'}</span>
      <div className="mdeal__price">
        <span className="mono">
          {o.gems.toLocaleString(NUM_LOCALE)}
          <img src={asset('/assets/icons/gems.svg')} alt="gems" width={20} height={20} />
        </span>
        <small>fixed price</small>
      </div>
      <dl className="mfacts">
        <div>
          <dt>Offer ends</dt>
          <dd className="mono">{timeLeftLabel(msLeft(o, now))}</dd>
        </div>
        <div>
          <dt>Seller</dt>
          <dd>{mine ? 'You' : o.owner_gamertag}</dd>
        </div>
        {mine ? (
          <div className="is-total">
            <dt>You net if it sells</dt>
            <dd className="mono">{sellerPayout(o.gems, config)}</dd>
          </div>
        ) : (
          <>
            <div>
              <dt>Your gems</dt>
              <dd className="mono">{player.activestats.gems.toLocaleString(NUM_LOCALE)}</dd>
            </div>
            {gate.ok && (
              <div>
                <dt>After buying</dt>
                <dd className="mono">{(player.activestats.gems - o.gems).toLocaleString(NUM_LOCALE)}</dd>
              </div>
            )}
          </>
        )}
      </dl>
      {mine ? (
        <p className="msell__hint">{OFFER_CANCEL_IS_BROKEN}</p>
      ) : (
        <>
          <button
            type="button"
            className="btn btn--primary mdeal__go"
            onClick={onBuy}
            disabled={busy || !gate.ok}
            title={gate.reason}
          >
            {busy && <span className="spinner" />}
            {gate.ok ? (
              <span className="msell__go">
                Buy for {o.gems}
                <img src={asset('/assets/icons/gems.svg')} alt="gems" width={14} height={14} />
              </span>
            ) : (
              gate.reason
            )}
          </button>
          <p className="msell__hint">
            The fighter moves to your roster at once. Its payday clock keeps running: wages fall due on{' '}
            {shortDay(o.next_payday)}.
          </p>
        </>
      )}
    </aside>
  )
}

/* ---------- listing cards ---------- */

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

export function SellTab({
  sellable,
  classes,
  ageDecay,
  levelMod,
  config,
  player,
  busy,
  onInspect,
  unlockLevel,
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
  /** The ascension that frees a locked ability, for the desktop's fighter. */
  unlockLevel?: number
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

  const listFee = Number(config?.gems_listing_price ?? 0)
  const resetHours = Math.round(Number(config?.reset_duration_below_minutes ?? 0) / 60)
  const payout = sellerPayout(price, config)
  const quick = [10, 25, 50, 100, 250].filter((q) => q >= minStart)
  const gemIcon = <img src={asset('/assets/icons/gems.svg')} alt="gems" width={13} height={13} />

  /*
     The terms, the same on both layouts: the price, whether to keep it
     listed, what selling at that price would actually pay, and List. The
     phone adds Details beside List; the desktop is already showing them.
  */
  const terms = (f: RosterFighter, details?: () => void) => {
    /* Asked of the fighter these terms are for: on a desktop that is the
       one on show, which is the first before anything is clicked. */
    const gate = canList(f, price, player!, config)
    const list = (
      <button
        type="button"
        className={`btn btn--primary${details ? ' btn--sm' : ' mdeal__go'}`}
        onClick={() => {
          setSelling(true)
          onList(f.fighter_id, price, keep)
        }}
        disabled={busy || !gate.ok}
        title={gate.reason}
      >
        {busy && <span className="spinner" />}
        {gate.ok ? (
          <span className="msell__go">
            List for {price}
            {gemIcon}· costs {listFee}
            {gemIcon}
          </span>
        ) : (
          gate.reason
        )}
      </button>
    )
    return (
      <>
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
            <button type="button" className="mstep__btn" onClick={() => setPrice((p) => p + 1)} aria-label="One gem more">
              +
            </button>
          </div>
          <div className="msell__quick">
            {quick.map((q) => (
              <button type="button" key={q} className={price === q ? 'is-on' : ''} onClick={() => setPrice(q)}>
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
          Listing costs {listFee} gem{listFee === 1 ? '' : 's'} now, sold or not. It runs {hours}h, and a bid in the
          last {resetHours}h pushes the end back out. Once anybody bids it can't be withdrawn.
        </p>

        {details ? (
          <div className="mrow__acts">
            <button type="button" className="btn btn--ghost btn--sm" onClick={details}>
              Details
            </button>
            {list}
          </div>
        ) : (
          list
        )}
      </>
    )
  }

  const none = (
    <p className="faint">
      None of your fighters can be listed right now. A fighter has to be active, idle, and not yet asking for a
      payday.
    </p>
  )
  const filters = <RosterFilters filter={filter} onChange={setFilter} roster={sellable} sheet={{}} />

  /*
     The phone: the roster as the board's rows, under the same filter, and
     the terms opened in place under the fighter tapped.
  */
  if (phone) {
    return (
      <div className="selltab selltab--phone">
        {sellable.length === 0 ? (
          none
        ) : (
          <>
            {filters}
            {shown.length === 0 ? (
              <p className="faint">No fighter you can sell matches these filters.</p>
            ) : (
              <div className="mrows">
                {shown.map((f) => {
                  const open = f.fighter_id === pickedId
                  return (
                    <div key={f.fighter_id} className={`drost--stack mcard${open ? ' is-open' : ''}`}>
                      <OwnCard
                        f={f}
                        picked={open}
                        cue={open ? 'Close' : 'Sell ›'}
                        onPick={() => setPickedId(open ? null : f.fighter_id)}
                      />
                      {open && <div className="mcard__terms">{terms(f, () => onInspect(f))}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  /*
     The desktop: the board the other tabs use — your roster on the left, the
     fighter you are about to price in full in the middle, so its rolls and
     abilities are in front of you while you set the number, and the terms on
     the right.
  */
  const deskPicked = shown.find((f) => f.fighter_id === pickedId) ?? shown[0] ?? null
  if (sellable.length === 0) return none
  return (
    <DeskBoard
      order={shown}
      picked={deskPicked}
      onPick={(f) => setPickedId(f.fighter_id)}
      list={
        <>
          {filters}
          {shown.length === 0 ? (
            <p className="faint">No fighter you can sell matches these filters.</p>
          ) : (
            <div className="mrows">
              {shown.map((f) => (
                <OwnCard key={f.fighter_id} f={f} picked={f === deskPicked} onPick={() => setPickedId(f.fighter_id)} />
              ))}
            </div>
          )}
        </>
      }
      fighter={
        deskPicked && (
          <MarketFighter
            marker={deskPicked.marker}
            stats={deskPicked.stats}
            ascension={deskPicked.ascension_level}
            id={deskPicked.fighter_id}
            panel={rosterPanel(deskPicked, levelMod, ageDecay)}
            template={classes.get(deskPicked.classname)}
            unlockLevel={unlockLevel}
            facts={[`Yours since ${shortDay(deskPicked.creation_date)}`, `Payday ${shortDay(deskPicked.next_payday)}`]}
          />
        )
      }
      deal={
        deskPicked && (
          <aside className="mdeal" aria-label="Sell this fighter">
            <span className="mdeal__cap">Sell this fighter</span>
            {terms(deskPicked)}
          </aside>
        )
      }
    />
  )
}

