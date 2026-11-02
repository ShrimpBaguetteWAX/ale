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
export const SHOP_CATEGORIES: {
  key: string
  label: string
  /** Drawn before the label: the currency the tab sells. */
  icon?: string
}[] = [
  {
    key: 'gems',
    label: 'Gems',
    icon: '/assets/icons/gems.svg',
  },
  {
    key: 'credits',
    label: 'Credits',
    icon: '/assets/icons/credits.svg',
  },
  {
    key: 'flasks',
    label: 'Energy',
    icon: '/assets/icons/energy.svg',
  },
  {
    key: 'account',
    label: 'Legend Pass',
    icon: '/assets/icons/account-legend.svg',
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
  /* TLM into WAX through Alcor; see shop/swap.ts. */
  {
    key: 'swap',
    label: 'Swap',
  },
]

/**
 * What a Legend Pass gets you, as the guide sells it: the six things it
 * brings, each with an icon and one line. Not on chain; the contract only
 * stores the seconds granted. The flask's numbers are filled from the shop's
 * own free flasks where it can.
 */
export const LEGEND_PERKS: { icon: string; gold?: string; title: string; line: string; flask?: true }[] = [
  { icon: '/assets/icons/menu/rewards.svg', gold: '10×', title: 'Reward Power', line: 'Every win mines ten times as much.' },
  { icon: '/assets/icons/menu/quests.svg', title: 'Full quest rewards', line: 'Trial trainers get a tenth.' },
  { icon: '/assets/icons/menu/tournament.svg', title: 'Full tournament prizes', line: 'WAX and TLM, not a tenth.' },
  { icon: '/assets/icons/energy.svg', gold: '1,000', title: 'energy a day', line: 'The Legend flask, instead of 100.', flask: true },
  { icon: '/assets/markers/buildings/tavern.svg', title: 'Free recruit reveals', line: 'When you arrive at your tavern.' },
  { icon: '/assets/icons/menu/account.svg', title: 'Weekly CPU boost', line: "So your actions don't fail." },
]
