/**
 * The market grid as a full page, against the real stylesheets.
 *
 *   npx vite build --ssr scripts/ssr-market-page.tsx --outDir .ssr
 *   node .ssr/ssr-market-page.js
 *
 * The chain's market is usually empty, so the cards — the grades, the ability
 * chips, the quality filter — cannot be looked at without inventing listings.
 * These are three fighters of deliberately different quality against one class
 * band, which is the comparison the screen exists to support.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { AuctionCard, OfferCard, QualityFilters, ReadoutPicker } from '../src/routes/Market'
import { EMPTY_FILTER } from '../src/dungeon/filters'
import type { Auction, InstantOffer, MarketConfig } from '../src/market/queries'
import type { ClassTemplate } from '../src/tavern/fighterStats'

const css = ['tokens.css', 'global.css', 'app.css', 'market.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const NOW = Math.floor(Date.now() / 1000) * 1000
const iso = (h: number) => new Date(NOW + h * 3_600_000).toISOString().slice(0, 19)

const CFG: MarketConfig = {
  index: 0, gems_listing_price: 1, standard_duration_minutes: 2880,
  reset_duration_below_minutes: 720, gems_min_start_bid: 10,
  gems_processing_fee_min: 1, gems_processing_fee_percent: 15,
  gems_instant_buy_price: 10, gems_min_bid_increase: 2,
  gems_min_bid_increase_percent: 10,
}

/** One class band, so the arrows mean something across the three cards. */
const template = {
  classname: 'desperado',
  total_min_max_stats: {
    health_min_min: 200, health_max_min: 260, health_min_max: 520, health_max_max: 600,
    damage_min_min: 300, damage_max_min: 360, damage_min_max: 640, damage_max_max: 700,
    attackspeed_min_min: 400, attackspeed_max_min: 460,
    attackspeed_min_max: 900, attackspeed_max_max: 980,
    initiative_min_min: 300, initiative_max_min: 360,
    initiative_min_max: 900, initiative_max_max: 980,
    res_fire_max: 800,
  },
} as unknown as ClassTemplate

const abilities = (n: number) =>
  [
    {
      ability: 'seheatpcleg', displayname: 'Self Heal on Attack [legendary]',
      description: 'Healed for [if:0:value]% of damage dealt when striking',
      if_effects: [{ stat_name: 'health_atk', percentflat: 'percent', value: 42 }],
      bf_effects: [], eof_effects: [],
    },
    {
      ability: 'frenzyrar', displayname: 'Frenzy [rare]',
      description: 'Gains [if:0:value] additional damage for the rest of the fight on each strike',
      if_effects: [{ stat_name: 'damage', percentflat: 'flat', value: 17 }],
      bf_effects: [], eof_effects: [],
    },
    {
      ability: 'thornsabu', displayname: 'Thorns [abundant]',
      description: 'Upon being hit, reduces attacker health by [if:0:value]',
      if_effects: [{ stat_name: 'health', percentflat: 'flat', value: -31 }],
      bf_effects: [], eof_effects: [],
    },
  ].slice(0, n)

const statsOf = (health: number, damage: number, speed: number, wind: number, n: number) => ({
  health_min: health, health_max: health + 40,
  damage_min: damage, damage_max: damage + 40,
  taunt_min: 200, taunt_max: 300,
  attackspeed_min: speed, attackspeed_max: speed + 40,
  initiative_min: wind, initiative_max: wind + 40,
  res_gem: 200, res_metal: 200, res_air: 200, res_fire: 640,
  res_nature: 200, res_neutral: 200,
  classname: 'desperado', racename: 'khaured', element: 'fire',
  target: 'enemy_taunt_max', abilities: abilities(n),
  experience: 0, required_experience: 100, level: 4, credits: 0,
})

const AGE_DECAY = 0.99997997283935547
const LEVEL_MOD = 1.15

const auction = (over: Partial<Auction>, s: ReturnType<typeof statsOf>): Auction =>
  ({
    auction_id: 1, classname: 'desperado', auction_start: iso(-8), auction_end: iso(40),
    bids: 0, current_bid: 10, current_bidder: 'none', current_bidder_gamertag: '-',
    keep_after_auction: 1, owner: 'seller.wam', owner_gamertag: 'Seller',
    fighter: s, fighter_id: 42, creation_date: iso(over.auction_id === 2 ? -40 : -900), last_payday: iso(-10),
    next_payday: iso(200), ascension_level: 0, ascension_in_progress: 0,
    ascension_upgrades: [], ...over,
  }) as unknown as Auction

const offer = (s: ReturnType<typeof statsOf>): InstantOffer =>
  ({
    offer_id: 1, classname: 'desperado', offer_start: iso(-30), offer_end: iso(26),
    gems: 10, owner: 'seller.wam', owner_gamertag: 'Seller',
    fighter: s, fighter_id: 43, creation_date: iso(-2400), last_payday: iso(-40),
    next_payday: iso(26), ascension_level: 0, ascension_in_progress: 0,
    ascension_upgrades: [], ...{},
  }) as unknown as InstantOffer

const noop = () => {}

const body = renderToStaticMarkup(
  <div className="market__inner">
    <QualityFilters
      filter={{
        ...EMPTY_FILTER,
        qualities: [
          { stat: 'damage', min: 'green-up' },
          { stat: 'res_fire', min: 'middle' },
          { stat: 'taunt', min: 40 },
          { stat: 'age', min: 80 },
        ],
      }}
      onChange={noop}
    />

    <div className="listinggrid">
      <AuctionCard
        auction={auction({ bids: 3, current_bid: 46, current_bidder_gamertag: 'Rival' },
          statsOf(560, 660, 430, 330, 3))}
        config={CFG}
        template={template}
        readout={'stats'}
        ageDecay={AGE_DECAY}
        levelMod={LEVEL_MOD}
        now={NOW}
        mine={false}
        onOpen={noop}
        onBid={noop}
      />
      <AuctionCard
        auction={auction({ auction_end: iso(3) }, statsOf(300, 400, 800, 820, 2))}
        config={CFG}
        template={template}
        readout={'stats'}
        ageDecay={AGE_DECAY}
        levelMod={LEVEL_MOD}
        now={NOW}
        mine={false}
        onOpen={noop}
        onBid={noop}
      />
      <OfferCard
        offer={offer(statsOf(420, 520, 640, 600, 1))}
        template={template}
        readout={'stats'}
        ageDecay={AGE_DECAY}
        levelMod={LEVEL_MOD}
        now={NOW}
        mine={false}
        onOpen={noop}
        onBuy={noop}
      />
    </div>

    <ReadoutPicker value={'resist'} onChange={noop} />
    <div className="listinggrid">
      <AuctionCard
        auction={auction({ bids: 3, current_bid: 46 }, statsOf(560, 660, 430, 330, 3))}
        config={CFG} template={template} readout={'resist'} ageDecay={AGE_DECAY} levelMod={LEVEL_MOD} now={NOW}
        mine={false} onOpen={noop} onBid={noop}
      />
      <OfferCard
        offer={offer(statsOf(420, 520, 640, 600, 2))}
        template={template} readout={'abilities'} ageDecay={AGE_DECAY} levelMod={LEVEL_MOD} now={NOW}
        mine={false} onOpen={noop} onBuy={noop}
      />
    </div>
  </div>,
)

const html = `<!doctype html>
<meta charset="utf-8">
<title>Market cards</title>
<style>${css}</style>
<style>
  body { margin: 0; background: #05101e; font-family: var(--font-body); color: var(--text); }
</style>
${body}
`

writeFileSync(new URL('../.ssr/market.html', import.meta.url), html)
console.log('wrote .ssr/market.html')
