/**
 * Pins the market arithmetic against `market.cpp`.
 *
 *   npx vite build --ssr scripts/verify-market.ts --outDir .ssr
 *   node .ssr/verify-market.js
 *
 * Every number here is integer maths on chain and every division truncates.
 * Being one gem out is the difference between a bid the contract takes and a
 * transaction the player signs and loses, so the expectations below are read
 * off the C++ rather than off the screen.
 *
 * The live config is fetched and the same cases re-run against it, because a
 * fixture that happens to match today's settings would stop meaning anything
 * the moment the team repriced the market.
 */
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
  processingFee,
  sellerPayout,
  sortListings,
  timeLeftLabel,
  listingPrice,
} from '../src/market/rules'
import type { Auction, InstantOffer, MarketConfig } from '../src/market/queries'
import type { RosterFighter } from '../src/dungeon/types'
import { EMPTY_FILTER, applyFilter, isFilterActive } from '../src/dungeon/filters'
import {
  FILTER_STATS,
  GRADE_ORDER,
  gradeOfStat,
  gradeRank,
  isGradedStat,
  type ClassTemplate,
} from '../src/tavern/fighterStats'
import { ageBand, ageBonus, battleFactor } from '../src/fighters/rules'
import type { Player } from '../src/chain/types'

let pass = 0
let fail = 0
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log((ok ? '  ok   ' : '  FAIL ') + name)
  if (!ok) {
    console.log('         got  ' + JSON.stringify(got))
    console.log('         want ' + JSON.stringify(want))
  }
  ok ? pass++ : fail++
}

/** The live settings at the time of writing, restated as a fixture. */
const CFG: MarketConfig = {
  index: 0,
  gems_listing_price: 1,
  standard_duration_minutes: 2880,
  reset_duration_below_minutes: 720,
  gems_min_start_bid: 10,
  gems_processing_fee_min: 1,
  gems_processing_fee_percent: 15,
  gems_instant_buy_price: 10,
  gems_min_bid_increase: 2,
  gems_min_bid_increase_percent: 10,
}

const NOW = Date.parse('2026-09-01T12:00:00Z')
const inHours = (h: number) => new Date(NOW + h * 3_600_000).toISOString().slice(0, 19)

const auction = (over: Partial<Auction> = {}): Auction =>
  ({
    auction_id: 1, classname: 'mystic', auction_start: inHours(-1),
    auction_end: inHours(40), bids: 0, current_bid: 10,
    current_bidder: 'none', current_bidder_gamertag: '-', keep_after_auction: 1,
    owner: 'seller.wam', owner_gamertag: 'Seller',
    fighter: { classname: 'mystic', racename: 'human', element: 'fire', level: 3 },
    fighter_id: 42, creation_date: inHours(-500), last_payday: inHours(-10),
    next_payday: inHours(200), ascension_level: 0, ascension_in_progress: 0,
    ascension_upgrades: [],
    ...over,
  }) as unknown as Auction

const offer = (over: Partial<InstantOffer> = {}): InstantOffer =>
  ({
    offer_id: 1, classname: 'mystic', offer_start: inHours(-1), offer_end: inHours(30),
    gems: 10, owner: 'seller.wam', owner_gamertag: 'Seller',
    fighter: { classname: 'mystic', racename: 'human', element: 'fire', level: 3 },
    fighter_id: 42, creation_date: inHours(-500), last_payday: inHours(-10),
    next_payday: inHours(30), ascension_level: 0, ascension_in_progress: 0,
    ascension_upgrades: [],
    ...over,
  }) as unknown as InstantOffer

const player = (gems: number, wallet = 'buyer.wam'): Player =>
  ({ wallet, activestats: { gems } }) as unknown as Player

const roster = (over: Partial<RosterFighter> = {}): RosterFighter =>
  ({
    fighter_id: 7, owner: 'buyer.wam', classname: 'mystic', racename: 'human',
    element: 'fire', stats: { level: 1 }, creation_date: inHours(-100),
    last_payday: inHours(-10), next_payday: inHours(100),
    in_use: 0, use_type: '', active: 1,
    ...over,
  }) as unknown as RosterFighter

/** The contract's own expression, so the test does not restate the answer. */
const contractMinBid = (current: number, c: MarketConfig) => {
  let min = current + c.gems_min_bid_increase
  const pct = Math.trunc((current * (100 + c.gems_min_bid_increase_percent)) / 100)
  if (min < pct) min = pct
  return min
}
const contractFee = (price: number, c: MarketConfig) => {
  let fee = c.gems_processing_fee_min
  const pct = Math.trunc((price * c.gems_processing_fee_percent) / 100)
  if (pct > fee) fee = pct
  return fee
}
const contractPayout = (price: number, c: MarketConfig) => {
  const fee = contractFee(price, c)
  let out = price
  if (out > fee) out -= fee
  return out
}

function suite(label: string, c: MarketConfig) {
  console.log(`\n${label}\n`)

  /* --- the minimum bid --- */
  {
    const cases = [10, 11, 19, 20, 21, 100, 999, 1, 0]
    const mine = cases.map((v) => minNextBid(v, c))
    check('minimum bid matches the contract expression at every step',
      mine, cases.map((v) => contractMinBid(v, c)))

    // The trap: a fresh auction stores the start price in current_bid with
    // bids still zero, so the opening bid must clear the increase as well.
    const fresh = auction({ current_bid: c.gems_min_start_bid, bids: 0 })
    check('the opening bid must beat the start price, not match it',
      minNextBid(fresh.current_bid, c) > fresh.current_bid, true)
    check('bidding exactly the start price is refused',
      canBid(fresh, player(999), c, fresh.current_bid, NOW).ok, false)
  }

  /* --- fee and payout --- */
  {
    const prices = [1, 2, 6, 7, 10, 20, 100, 333, 1000]
    check('processing fee matches the contract at every price',
      prices.map((p) => processingFee(p, c)), prices.map((p) => contractFee(p, c)))
    check('payout matches the contract at every price',
      prices.map((p) => sellerPayout(p, c)), prices.map((p) => contractPayout(p, c)))

    // `if (gem_payout > processing_fee) gem_payout -= processing_fee` — a sale
    // at or below the fee is paid in full rather than netting nothing.
    const tiny = c.gems_processing_fee_min
    check('a sale at the fee floor is paid out whole, not zeroed',
      sellerPayout(tiny, c), tiny)
  }

  /* --- the closing window --- */
  {
    const window = c.reset_duration_below_minutes / 60
    check('an auction outside the window does not extend',
      extendsOnBid(auction({ auction_end: inHours(window + 1) }), c, NOW), false)
    check('an auction inside the window does',
      extendsOnBid(auction({ auction_end: inHours(window - 1) }), c, NOW), true)
  }
}

async function main() {
  console.log('market rules')
  suite('against the fixture', CFG)

  const res = await fetch('https://wax.greymass.com/v1/chain/get_table_rows', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({
      json: true, code: 'market.ale', scope: 'market.ale', table: 'config', limit: 1,
    }),
  })
  const live = ((await res.json()) as { rows: MarketConfig[] }).rows[0]
  if (live) {
    suite('against the live config', live)
    const same = JSON.stringify(
      Object.fromEntries(Object.entries(CFG).filter(([k]) => k !== 'index')),
    ) === JSON.stringify(
      Object.fromEntries(Object.entries(live).filter(([k]) => k !== 'index' && k !== 'wallet')),
    )
    console.log(`\n  (the fixture ${same ? 'still matches' : 'has DRIFTED from'} the live config)`)
  }

  console.log('\ngates\n')

  /* --- bidding --- */
  {
    const a = auction({ current_bid: 20, bids: 2, current_bidder: 'other.wam' })
    check('a good bid passes', canBid(a, player(999), CFG, 22, NOW).ok, true)
    check('an ended auction is refused first',
      canBid(auction({ auction_end: inHours(-1) }), player(999), CFG, 999, NOW).reason,
      'This auction has ended')
    check('the seller cannot bid',
      canBid(a, player(999, 'seller.wam'), CFG, 99, NOW).reason,
      'You cannot bid on your own auction')
    check('the standing leader cannot raise themselves',
      canBid(a, player(999, 'other.wam'), CFG, 99, NOW).reason,
      'You already have the highest bid')
    check('a bid under the minimum names the minimum',
      canBid(a, player(999), CFG, 21, NOW).reason, 'Bid at least 22 gems')
    check('gems are checked last', canBid(a, player(5), CFG, 22, NOW).reason,
      'You have 5 gems')
  }

  /* --- buying --- */
  {
    check('a good buy passes', canBuy(offer(), player(999), NOW).ok, true)
    check('an expired offer is refused',
      canBuy(offer({ offer_end: inHours(-1) }), player(999), NOW).reason,
      'This offer has expired')
    check('the seller cannot buy their own',
      canBuy(offer(), player(999, 'seller.wam'), NOW).reason,
      'You cannot buy your own offer')
    check('too few gems is caught', canBuy(offer(), player(2), NOW).reason,
      'You have 2 gems')
  }

  /* --- withdrawing --- */
  {
    const mine = player(0, 'seller.wam')
    check('an untouched auction can be withdrawn',
      canCancelAuction(auction({ bids: 0 }), mine).ok, true)
    check('one bid makes it binding',
      canCancelAuction(auction({ bids: 1 }), mine).reason,
      'Cannot cancel once somebody has bid')
    check('somebody else’s auction is not yours to withdraw',
      canCancelAuction(auction(), player(0, 'nosy.wam')).reason, 'Not your auction')
    check('the broken offer cancel is explained, not offered',
      OFFER_CANCEL_IS_BROKEN.length > 0, true)
  }

  /* --- listing --- */
  {
    const me = player(50, 'buyer.wam')
    check('a clean fighter at the minimum can be listed',
      canList(roster(), 10, me, CFG, NOW).ok, true)
    check('nothing picked is the first thing said',
      canList(null, 10, me, CFG, NOW).reason, 'Pick a fighter to sell')
    check('a busy fighter names what it is doing',
      canList(roster({ in_use: 1, use_type: 'Arena' }), 10, me, CFG, NOW).reason,
      'Busy: Arena')
    check('an inactive fighter is refused',
      canList(roster({ active: 0 }), 10, me, CFG, NOW).reason,
      'This fighter is not active')
    check('a fighter due a payday is refused',
      canList(roster({ next_payday: inHours(-1) }), 10, me, CFG, NOW).reason,
      'This fighter wants a payday before it can be sold')
    check('a start below the floor names the floor',
      canList(roster(), 9, me, CFG, NOW).reason, 'Start at 10 gems or more')
    check('the listing fee is checked',
      canList(roster(), 10, player(0, 'buyer.wam'), CFG, NOW).reason,
      'Listing costs 1 gems')
  }

  /* --- filtering on how well a fighter rolled --- */
  {
    /*
       A band a class can roll inside. `gradeStat` reads the four corner keys
       and buckets a value into sixths of the span, so a floor of 100 and a
       span of 100 puts 110 near the bottom and 195 near the top.
    */
    const band = {
      classname: 'mystic',
      total_min_max_stats: {
        health_min_min: 100, health_max_min: 100,
        health_min_max: 200, health_max_max: 200,
        damage_min_min: 100, damage_max_min: 100,
        damage_min_max: 200, damage_max_max: 200,
        res_fire_max: 800,
      },
    } as unknown as ClassTemplate
    const templates = new Map([['mystic', band]])

    const rolled = (health: number, damage: number, resFire = 0): RosterFighter =>
      ({
        fighter_id: 1, owner: 'x', classname: 'mystic', racename: 'human',
        element: 'fire', marker: '', in_use: 0, use_type: '', active: 1,
        creation_date: inHours(-100), next_payday: inHours(100),
        stats: {
          health_min: health, health_max: health,
          damage_min: damage, damage_max: damage,
          res_fire: resFire, abilities: [], level: 1,
        },
      }) as unknown as RosterFighter

    /* Sanity: the fixture actually produces the grades the cases assume. */
    check('a top-of-band roll grades gold',
      gradeOfStat(rolled(198, 100).stats as never, 'health', band), 'gold-up')
    check('a bottom-of-band roll grades poorly',
      gradeOfStat(rolled(105, 100).stats as never, 'health', band), 'red-duble-down')

    const run = (fighters: RosterFighter[], qualities: { stat: string; min: never }[]) =>
      applyFilter(fighters, { ...EMPTY_FILTER, qualities } as never, 0, NOW, templates)

    const good = rolled(198, 198, 700)
    const poor = rolled(105, 105, 20)

    check('a floor keeps what clears it and drops what does not',
      run([good, poor], [{ stat: 'health', min: 'green-up' as never }]).length, 1)
    check('and it is the good roll that survives',
      run([good, poor], [{ stat: 'health', min: 'green-up' as never }])[0], good)
    check('a floor nothing clears empties the board',
      run([poor], [{ stat: 'health', min: 'gold-up' as never }]).length, 0)
    check('the lowest floor keeps everything',
      run([good, poor], [{ stat: 'health', min: GRADE_ORDER[0] as never }]).length, 2)

    /* Stacking is AND, which is the whole point of allowing more than one. */
    const mixed = rolled(198, 105)
    check('two rules both have to pass',
      run([mixed], [
        { stat: 'health', min: 'green-up' as never },
        { stat: 'damage', min: 'green-up' as never },
      ]).length, 0)
    check('and the same pair passes a fighter strong on both',
      run([good], [
        { stat: 'health', min: 'green-up' as never },
        { stat: 'damage', min: 'green-up' as never },
      ]).length, 1)

    /* Resistances grade off a single stored figure, not a min/max band. */
    check('a resistance rule reads the stored value',
      run([good, poor], [{ stat: 'res_fire', min: 'green-up' as never }]).length, 1)

    /*
       Without the class bands there is nothing to grade against. Letting
       everything through is the safe failure — hiding the whole market while
       a lookup table loads is the one that looks broken.
    */
    check('no templates means no filtering rather than no results',
      applyFilter([good, poor],
        { ...EMPTY_FILTER, qualities: [{ stat: 'health', min: 'gold-up' }] } as never,
        0, NOW).length,
      2)

    check('a quality rule counts as an active filter',
      isFilterActive({ ...EMPTY_FILTER, qualities: [{ stat: 'health', min: 'gold-up' }] } as never),
      true)
    check('and an empty rule list does not',
      isFilterActive(EMPTY_FILTER), false)
    check('grade ranks run worst to best',
      gradeRank('gold-up') > gradeRank('middle') && gradeRank('middle') > gradeRank('red-down'),
      true)

    /*
       Taunt takes a number rather than a grade, through the same rule list.

       `gradeStat` refuses taunt — it is a role, not a quality — so it has no
       arrow to compare against and would otherwise be the one stat a buyer
       could not search on at all. The rule carries a number instead, and the
       scale matters: a card prints taunt divided by ten, so a player typing
       40 means the 40 they can see.
    */
    check('taunt is offered as a filter', FILTER_STATS.some((f) => f.field === 'taunt'), true)
    check('isGradedStat agrees', [isGradedStat('damage'), isGradedStat('taunt')], [true, false])

    const withTaunt = (rawMin: number, rawMax: number) =>
      ({
        fighter_id: 1, owner: 'x', classname: 'mystic', racename: 'human',
        element: 'fire', marker: '', in_use: 0, use_type: '', active: 1,
        creation_date: inHours(-100), next_payday: inHours(100),
        stats: { taunt_min: rawMin, taunt_max: rawMax, abilities: [], level: 1 },
      }) as unknown as RosterFighter

    const tank = withTaunt(1200, 1200)   // prints 120
    const ghost = withTaunt(80, 80)      // prints 8

    check('a numeric floor keeps what clears it',
      run([tank, ghost], [{ stat: 'taunt', min: 50 as never }]).length, 1)
    check('and it is the tank that survives',
      run([tank, ghost], [{ stat: 'taunt', min: 50 as never }])[0], tank)
    check('a floor of 40 matches a fighter printing 120, not one storing 120',
      run([withTaunt(120, 120)], [{ stat: 'taunt', min: 40 as never }]).length, 0)
    check('a banded roll is judged on its midpoint',
      run([withTaunt(200, 400)], [{ stat: 'taunt', min: 30 as never }]).length, 1)

    /* The point of folding it into one list: it stacks with a graded rule. */
    const both = {
      ...(rolled(198, 198, 700) as unknown as Record<string, unknown>),
      stats: {
        ...(rolled(198, 198, 700).stats as unknown as Record<string, unknown>),
        taunt_min: 100, taunt_max: 100,
      },
    } as unknown as RosterFighter
    check('a graded rule and a numeric one AND together',
      run([both], [
        { stat: 'damage', min: 'green-up' as never },
        { stat: 'taunt', min: 5 as never },
      ]).length, 1)
    check('and the pair fails when only the numeric one does',
      run([both], [
        { stat: 'damage', min: 'green-up' as never },
        { stat: 'taunt', min: 50 as never },
      ]).length, 0)
  }

  /* --- ordering the board --- */
  {
    /*
       The roster's sorts order fighters by stat, which is the right question
       when picking a team out of fighters you already own and the wrong one
       when deciding what to spend gems on. The market overrode them silently,
       which left a Sort control on screen that could not change anything.
    */
    const cheapSoon = auction({ auction_id: 1, current_bid: 5, auction_end: inHours(2), auction_start: inHours(-40) })
    const dearLate = auction({ auction_id: 2, current_bid: 90, auction_end: inHours(40), auction_start: inHours(-1) })
    const midMid = auction({ auction_id: 3, current_bid: 40, auction_end: inHours(20), auction_start: inHours(-20) })
    const board = [dearLate, cheapSoon, midMid]
    const ids = (list: Auction[]) => list.map((a) => a.auction_id)

    check('ending soonest puts the closest deadline first',
      ids(sortListings(board, 'ending', NOW)), [1, 3, 2])
    check('cheapest first is by standing bid',
      ids(sortListings(board, 'price-asc', NOW)), [1, 3, 2])
    check('dearest first is its mirror',
      ids(sortListings(board, 'price-desc', NOW)), [2, 3, 1])
    check('newly listed is by when it opened',
      ids(sortListings(board, 'newest', NOW)), [2, 3, 1])

    /* The two kinds of listing price themselves differently. */
    check('an auction is priced by its standing bid',
      listingPrice(auction({ current_bid: 46 })), 46)
    check('an offer is priced by its fixed price',
      listingPrice(offer({ gems: 10 })), 10)

    /*
       Sorting by a stat, which is what the roster's own sorts were for and
       what the market silently dropped.

       Direction is the thing to get right, and the fixture is built so it
       can be caught: health and cooldown are deliberately *not* correlated
       here, because a fixture where they happen to agree would pass whether
       or not the lower-is-better rule works at all.
    */
    const statted = (id: number, health: number, speed: number) =>
      auction({
        auction_id: id,
        fighter: {
          ...(auction().fighter as unknown as Record<string, number>),
          health_min: health, health_max: health,
          attackspeed_min: speed, attackspeed_max: speed,
        } as never,
      })
    //                  id  health  cooldown
    const byStat = [
      statted(1, 300, 500),   // worst health, best cooldown
      statted(2, 500, 900),   // best health,  worst cooldown
      statted(3, 400, 700),   // middling both
    ]

    check('health sorts best first, which is highest',
      ids(sortListings(byStat, 'health', NOW)), [2, 3, 1])
    check('cooldown sorts best first, which is lowest — the other way round',
      ids(sortListings(byStat, 'attackspeed', NOW)), [1, 3, 2])
    check('so the two orders are mirrors on this board',
      ids(sortListings(byStat, 'health', NOW)).slice().reverse(),
      ids(sortListings(byStat, 'attackspeed', NOW)))

    check('every stat sort is offered and implemented',
      MARKET_SORTS.filter((o) => !['ending', 'newest', 'price-asc', 'price-desc'].includes(o.value))
        .every((o) => sortListings(byStat, o.value, NOW).length === 3),
      true)

    check('sorting does not mutate the board', ids(board), [2, 1, 3])
    check('every offered order is implemented',
      MARKET_SORTS.every((o) => sortListings(board, o.value, NOW).length === board.length),
      true)
  }

  /* --- the age bonus --- */
  {
    /*
       The scale is the live game's, recovered from its deployed client rather
       than invented, because the two have to print the same number for the
       same fighter:

           d     = 1 - age_decay ^ (days²)
           bonus = 100 - 200 * d

       Worth restating what that means, since it does not read the way a
       percentage usually does: a fighter that has lost nothing shows +100%,
       and one that has lost half its roll shows 0%. It is a condition gauge,
       not a multiplier.
    */
    const DECAY = 0.99997997283935547
    const aged = (days: number): RosterFighter =>
      ({
        fighter_id: 1, owner: 'x', classname: 'mystic', racename: 'human',
        element: 'fire', in_use: 0, use_type: '', active: 1,
        creation_date: new Date(NOW - days * 86_400_000).toISOString().slice(0, 19),
        last_payday: inHours(-1), next_payday: inHours(100),
        stats: { level: 1, abilities: [] },
      }) as unknown as RosterFighter

    /* The live expression, restated so the test is not the implementation. */
    const live = (days: number) => {
      const d = 1 - Math.pow(DECAY, days * days)
      return d * 100 * -2 + 100
    }

    for (const days of [0, 1, 7, 30, 100, 200, 400]) {
      check(`bonus at ${days} days matches the live formula`,
        Number(ageBonus(aged(days), DECAY, NOW).toFixed(6)),
        Number(live(days).toFixed(6)))
    }

    check('a brand new fighter reads +100', Math.round(ageBonus(aged(0), DECAY, NOW)), 100)
    check('the scale bottoms out at -100, never below',
      ageBonus(aged(10_000), DECAY, NOW) >= -100, true)

    /* The half-way point is a fighter that has lost half its roll — which the
       colour has to carry, because "+40%" still looks like a positive. */
    const half = battleFactor(aged(186), 1, DECAY, NOW).age
    check('zero on this scale means half the roll is gone',
      Math.abs(half - 0.5) < 0.02 && Math.abs(ageBonus(aged(186), DECAY, NOW)) < 4, true)

    check('bands run fresh, worn, bad',
      [ageBand(95), ageBand(60), ageBand(10)], ['fresh', 'worn', 'bad'])

    /* No decay configured must not invent a penalty. */
    check('a zero decay leaves every fighter at full', ageBonus(aged(400), 0, NOW), 100)

    /* --- filtering on it --- */

    check('age bonus is offered as a filter',
      FILTER_STATS.some((f) => f.field === 'age'), true)
    check('and it is ungraded, like taunt', isGradedStat('age'), false)
    check('the two ungraded stats are taunt and age',
      FILTER_STATS.filter((f) => !f.graded).map((f) => f.field), ['taunt', 'age'])

    const fresh = aged(2)
    const old = aged(200)
    const both = [fresh, old]
    const ageRule = (min: number) =>
      applyFilter(both, { ...EMPTY_FILTER, qualities: [{ stat: 'age', min }] } as never,
        DECAY, NOW)

    check('a high floor keeps only the fresh fighter', ageRule(80).length, 1)
    check('and it is the fresh one', ageRule(80)[0], fresh)
    check('a floor below both keeps both', ageRule(-100).length, 2)
    check('a floor above both empties the board', ageRule(101).length, 0)

    /*
       The age rule must work without the class bands. It is condition, not a
       roll, so there is nothing to grade it against — gating it behind the
       templates would have made an answerable filter wait on a lookup table.
    */
    check('an age rule works with no templates loaded',
      applyFilter(both, { ...EMPTY_FILTER, qualities: [{ stat: 'age', min: 80 }] } as never,
        DECAY, NOW).length,
      1)

    /* And it stacks with a graded rule, like every other. */
    check('age stacks with a grade rule',
      applyFilter([fresh],
        { ...EMPTY_FILTER, qualities: [
          { stat: 'age', min: 80 },
          { stat: 'health', min: 'gold-up' },
        ] } as never,
        DECAY, NOW).length,
      /* No band for this fixture's class, so the graded half lets it through
         and the age half decides — which is the documented fallback. */
      1)
  }

  /* --- clock --- */
  {
    check('days, hours, minutes, seconds',
      [timeLeftLabel(0), timeLeftLabel(45_000), timeLeftLabel(3_900_000),
        timeLeftLabel(97_200_000)],
      ['Ended', '45s', '1h 5m', '1d 3h'])
    check('an ended listing reads as ended',
      hasEnded(auction({ auction_end: inHours(-1) }), NOW), true)
    check('time left never goes negative',
      msLeft(auction({ auction_end: inHours(-5) }), NOW), 0)
  }

  /* --- the panel adapter --- */
  {
    const f = listingAsFighter(auction())
    check('a listing wears a roster fighter’s shape',
      [f.fighter_id, f.classname, f.element, f.stats.level],
      [42, 'mystic', 'fire', 3])
  }

  console.log('\n' + (fail === 0 ? `all ${pass} cases passed` : `${fail} FAILED`))
  if (fail) process.exitCode = 1
}

main()
