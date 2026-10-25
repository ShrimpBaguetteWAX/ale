/**
 * `shop.ale` / `shopitems`.
 *
 * "dust" is credits throughout — `gain_dust` on a credit pack is what lands in
 * the player's `activestats.credits`.
 */
export interface ShopItem {
  item: string
  category: string
  /** Headline, e.g. "6,000,000 Credits". */
  offer_name: string
  /** Short name, e.g. "Credit Pack XL". */
  title: string
  /** e.g. "49.00000000 WAX". Non-zero means it can only be bought by transfer. */
  cost_wax: string
  cost_gem: number
  cost_dust: number
  cost_action_points: number
  gain_gem: number
  gain_dust: number
  gain_action_points: number
  gain_legend_acct_seconds: number
  cooldown_seconds: number
  /** False means Legend accounts only. */
  trial_availability: boolean | number
  powerup_cpu: number
  powerup_max_cost_wax: string
}

/** `shop.ale` / `cdclaimshp` — per-wallet cooldowns on the free claims. */
export interface ShopCooldown {
  index: number
  wallet: string
  item: string
  cooldown_expired: string
}

/**
 * The categories the contract uses, in the order the shop presents them —
 * which follows the economy: WAX buys gems, gems buy credits and Legend,
 * credits buy energy.
 */
export const SHOP_CATEGORIES: { key: string; label: string }[] = [
  {
    key: 'gems',
    label: 'Gems',
  },
  {
    key: 'credits',
    label: 'Credits',
  },
  {
    key: 'flasks',
    label: 'Energy',
  },
  {
    key: 'account',
    label: 'Legend',
  },
  /*
     Last, and outside the ladder the other three describe. `uspts.worlds` is
     the Alien Worlds Outpost: its offers are priced in Alien Worlds shards,
     which is the currency this game's reward pools pay out — so the shards
     are the player's own, but the shop, the price and the NFT all belong to
     Alien Worlds rather than to us.
  */
  {
    key: 'outpost',
    label: 'AW Outpost',
  },
  /*
     Alien Worlds tools, crew and weapons on AtomicMarket, bought for WAX
     through shop.ale.
  */
  {
    key: 'market',
    label: 'NFT Market',
  },
]

/**
 * What a Legend pass gets you, as a comparison: what a trial account gets and
 * what Legend gets, side by side — the difference is the reason to buy. Not
 * on chain; the contract only stores the seconds granted. The flask row is
 * filled from the shop's own free flasks where it can be.
 */
export const LEGEND_VS_TRIAL: [string, string, string][] = [
  ['Tavern reveals', 'Paid', 'Free'],
  ['Rewards', '10%', '100%'],
  ['CPU boost', '—', '25× a week'],
  ['Daily flask', 'Smaller', 'Larger'],
]
