/**
 * Renders every market card and dialog against synthetic listings.
 *
 *   npx vite build --ssr scripts/ssr-market.tsx --outDir .ssr
 *   node .ssr/ssr-market.js
 *
 * The chain's market is empty most of the time, and the states worth checking
 * — an auction inside its extension window, one already bid on, a fighter the
 * contract would refuse to list — are the ones least likely to be sitting
 * there when somebody looks. So the rows are made up and the real components
 * render them.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Market, {
  AuctionCard,
  BidDialog,
  BuyDialog,
  MyListings,
  OfferCard,
  SellDialog,
} from '../src/routes/Market'
import { useGame } from '../src/state/useGame'
import type { Auction, InstantOffer, MarketConfig } from '../src/market/queries'
import type { RosterFighter } from '../src/dungeon/types'

function primeStore(patch: Record<string, unknown>) {
  useGame.setState(patch as never)
  Object.assign(useGame.getInitialState(), patch)
}

/* Whole seconds: the row timestamps have no sub-second part, so a NOW with
   milliseconds would leave every fixture a fraction short and round the
   displayed clock down by an hour. */
const NOW = Math.floor(Date.now() / 1000) * 1000
const inHours = (h: number) => new Date(NOW + h * 3_600_000).toISOString().slice(0, 19)

const CFG: MarketConfig = {
  index: 0, gems_listing_price: 1, standard_duration_minutes: 2880,
  reset_duration_below_minutes: 720, gems_min_start_bid: 10,
  gems_processing_fee_min: 1, gems_processing_fee_percent: 15,
  gems_instant_buy_price: 10, gems_min_bid_increase: 2,
  gems_min_bid_increase_percent: 10,
}

/* A band the fixture rolls inside, so the grade arrows are real. */
const template = {
  classname: 'arcanist',
  total_min_max_stats: {
    health_min_min: 200, health_max_min: 260, health_min_max: 520, health_max_max: 600,
    damage_min_min: 300, damage_max_min: 360, damage_min_max: 640, damage_max_max: 700,
    attackspeed_min_min: 400, attackspeed_max_min: 460, attackspeed_min_max: 900, attackspeed_max_max: 980,
    initiative_min_min: 300, initiative_max_min: 360, initiative_min_max: 900, initiative_max_max: 980,
    res_fire_max: 800, res_air_max: 800, res_metal_max: 800,
    res_gem_max: 800, res_nature_max: 800, res_neutral_max: 800,
  },
} as never

const ABILITIES = [
  { ability: 'seheatpcleg', displayname: 'Self Heal on Attack [legendary]',
    description: 'Healed for [if:0:value]% of damage dealt when striking',
    if_effects: [{ stat_name: 'health_atk', percentflat: 'percent', value: 42 }],
    bf_effects: [], eof_effects: [] },
  { ability: 'frenzyrar', displayname: 'Frenzy [rare]',
    description: 'Gains [if:0:value] additional damage for the rest of the fight on each strike',
    if_effects: [{ stat_name: 'damage', percentflat: 'flat', value: 17 }],
    bf_effects: [], eof_effects: [] },
]

const stats = (over = {}) => ({
  health_min: 300, health_max: 480, damage_min: 420, damage_max: 610,
  taunt_min: 200, taunt_max: 350, initiative_min: 400, initiative_max: 800,
  attackspeed_min: 500, attackspeed_max: 900,
  res_gem: 200, res_metal: 200, res_air: 200, res_fire: 200,
  res_nature: 200, res_neutral: 200,
  classname: 'arcanist', racename: 'robotron', element: 'fire',
  target: 'enemy_taunt_max', abilities: ABILITIES, experience: 0,
  required_experience: 100, level: 4, credits: 0, ...over,
})

const auction = (over: Partial<Auction> = {}): Auction =>
  ({
    auction_id: 1, classname: 'arcanist', auction_start: inHours(-8),
    auction_end: inHours(40), bids: 0, current_bid: 10,
    current_bidder: 'none', current_bidder_gamertag: '-', keep_after_auction: 1,
    owner: 'seller.wam', owner_gamertag: 'Seller', fighter: stats(),
    fighter_id: 42, creation_date: inHours(-400), last_payday: inHours(-10),
    next_payday: inHours(200), ascension_level: 0, ascension_in_progress: 0,
    ascension_upgrades: [], ...over,
  }) as unknown as Auction

const offer = (over: Partial<InstantOffer> = {}): InstantOffer =>
  ({
    offer_id: 1, classname: 'lunatic', offer_start: inHours(-30),
    offer_end: inHours(26), gems: 10, owner: 'seller.wam',
    owner_gamertag: 'Seller', fighter: stats({ classname: 'lunatic', racename: 'onoros', element: 'air' }),
    fighter_id: 43, creation_date: inHours(-900), last_payday: inHours(-40),
    next_payday: inHours(26), ascension_level: 0, ascension_in_progress: 0,
    ascension_upgrades: [], ...over,
  }) as unknown as InstantOffer

const roster = (over: Partial<RosterFighter> = {}): RosterFighter =>
  ({
    fighter_id: 7, owner: 'me.wam', classname: 'hunter', racename: 'human',
    element: 'nature', stats: stats({ classname: 'hunter', racename: 'human', element: 'nature', level: 2 }),
    creation_date: inHours(-100), last_payday: inHours(-10),
    next_payday: inHours(100), in_use: 0, use_type: '', active: 1,
    ascension_level: 0, ascension_in_progress: 0, ascension_upgrades: [],
    ...over,
  }) as unknown as RosterFighter

const me = {
  wallet: 'me.wam', playertag: 'Me',
  activestats: { gems: 250, credits: 0, action_points: 100 },
}

function render(node: React.ReactElement) {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
}

function main() {
  primeStore({ player: me, session: null, refreshPlayer: async () => {} })

  const noop = () => {}
  const cases: [string, string, string[]][] = [
    [
      'fresh auction, no bids',
      render(<AuctionCard template={template} auction={auction()} config={CFG} now={NOW} mine={false} onOpen={noop} onBid={noop} />),
      ['Starting at', 'Bid 12', '1d 16h', 'Seller'],
    ],
    [
      'auction with bids',
      render(<AuctionCard template={template} auction={auction({ bids: 3, current_bid: 40, current_bidder_gamertag: 'Rival' })} config={CFG} now={NOW} mine={false} onOpen={noop} onBid={noop} />),
      ['Top bid', '3 bids', 'Bid 44', 'by Rival'],
    ],
    [
      'auction inside its closing window',
      render(<AuctionCard template={template} auction={auction({ auction_end: inHours(3) })} config={CFG} now={NOW} mine={false} onOpen={noop} onBid={noop} />),
      ['listingcard--closing', 'is-closing'],
    ],
    [
      'my own auction is not biddable',
      render(<AuctionCard template={template} auction={auction({ owner: 'me.wam' })} config={CFG} now={NOW} mine onOpen={noop} onBid={noop} />),
      ['Your auction', 'disabled'],
    ],
    [
      'instant offer',
      render(<OfferCard template={template} offer={offer()} now={NOW} mine={false} onOpen={noop} onBuy={noop} />),
      ['Buy now', '>Buy<', '1d 2h'],
    ],
    [
      'bid dialog quotes the minimum, not the start price',
      render(<BidDialog auction={auction()} config={CFG} now={NOW} busy={false} player={me as never} onClose={noop} onBid={noop} />),
      ['Minimum bid', 'Bid 12 gems', 'Your gems', 'taken as soon as you bid'],
    ],
    [
      'bid dialog warns inside the closing window',
      render(<BidDialog auction={auction({ auction_end: inHours(3) })} config={CFG} now={NOW} busy={false} player={me as never} onClose={noop} onBid={noop} />),
      ['pushes the end back out by 12 hours'],
    ],
    [
      'buy dialog',
      render(<BuyDialog offer={offer()} now={NOW} busy={false} player={me as never} onClose={noop} onBuy={noop} />),
      ['Buy for 10 gems', 'moves to your roster'],
    ],
    [
      'sell dialog with a listable fighter',
      render(<SellDialog sellable={[roster()]} config={CFG} player={me as never} busy={false} onClose={noop} onList={noop} />),
      ['Starting bid (min 10)', 'Keep it listed', 'Listing fee', 'You keep at', 'Pick a fighter to sell'],
    ],
    [
      'sell dialog with nothing listable',
      render(<SellDialog sellable={[]} config={CFG} player={me as never} busy={false} onClose={noop} onList={noop} />),
      ['None of your fighters can be listed'],
    ],
    [
      'my listings explains the broken offer cancel',
      render(<MyListings auctions={[auction({ owner: 'me.wam' })]} offers={[offer({ owner: 'me.wam' })]} config={CFG} now={NOW} busy={null} player={me as never} onOpen={noop} onCancel={noop} />),
      ['Withdraw', 'cannot be withdrawn', 'nets 9 after fee'],
    ],
    [
      'my listings blocks withdrawing a bid-on auction',
      render(<MyListings auctions={[auction({ owner: 'me.wam', bids: 2, current_bid: 40 })]} offers={[]} config={CFG} now={NOW} busy={null} player={me as never} onOpen={noop} onCancel={noop} />),
      ['Cannot cancel once somebody has bid', 'nets 34 after fee'],
    ],
    [
      'the page shell',
      render(<Market />),
      ['>Market<', 'Sell a fighter', 'market__purse', 'Auctions', 'Buy Now', 'My Listings'],
    ],
    [
      'the arrange bar holds the readout switch and Order together',
      render(<Market />),
      ['class="marketbar"', 'readoutpick', 'marketbar__sort', 'Ending soonest'],
    ],
    [
      /*
         Both roster controls the market cannot answer stay out of the markup
         rather than being hidden with CSS — a control that renders but cannot
         change the result is the thing this was fixing.
      */
      'the roster Status and Sort controls are not rendered at all',
      render(<Market />).includes('Requests Payday') || render(<Market />).includes('Sort by')
        ? 'one of them is still rendered'
        : 'neither is rendered',
      ['neither is rendered'],
    ],
  ]

  let bad = 0
  for (const [label, html, needles] of cases) {
    const missing = needles.filter((n) => !html.includes(n))
    if (missing.length) bad++
    console.log(`  ${missing.length ? 'MISS' : 'ok  '} ${label}`)
    for (const m of missing) console.log(`         missing: ${m}`)
  }
  console.log(`\n${cases.length - bad}/${cases.length} rendered as expected`)
  if (bad) process.exitCode = 1
}

main()
