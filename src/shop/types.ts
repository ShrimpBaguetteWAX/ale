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
export const SHOP_CATEGORIES: { key: string; label: string; blurb: string }[] = [
  {
    key: 'gems',
    label: 'Gems',
    blurb: 'Bought with WAX. Gems buy credits and Legend passes.',
  },
  {
    key: 'credits',
    label: 'Credits',
    blurb: 'Bought with gems. Credits buy energy.',
  },
  {
    key: 'flasks',
    label: 'Energy',
    blurb: 'Bought with credits, plus a free flask every day.',
  },
  {
    key: 'account',
    label: 'Legend',
    blurb: 'Bought with gems. Unlocks the benefits below.',
  },
]

/**
 * What a Legend pass gets you, in the original's own words. These are not on
 * chain — the contract only stores the seconds granted.
 */
export const LEGEND_BENEFITS = [
  'Auto-reveal fighters instantly and for free whenever you visit a tavern',
  'Claim full rewards instead of the 10% limit on trial accounts',
  'Every day, stake a significant amount of CPU for you if needed',
  'A larger free daily energy flask',
]
