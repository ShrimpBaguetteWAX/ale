import { asset } from '@/assets'
export interface NavItem {
  to: string
  label: string
  /**
   * Original menu artwork from the live game.
   *
   * Empty for an entry the artwork does not cover yet: the rail keeps the
   * icon column so the labels stay aligned, rather than one row's text
   * starting where every other row’s picture does.
   */
  icon: string
  /** Contract is live on chain but the screen isn't built yet. */
  soon?: boolean
  /**
   * Shown in the mobile tab bar rather than the "More" sheet.
   *
   * Four of them, chosen for how often a player reaches for the thing rather
   * than how important it sounds: the map, the roster, the day's quests and
   * the shop. Account is a place you visit occasionally and on purpose, which
   * is exactly what the More sheet is for.
   *
   * Desktop never reads this — the left rail lists everything — so the tab
   * bar is the only thing this flag moves.
   */
  primary?: boolean
}

/**
 * The game menu — items, icons and order taken from the live build's own menu
 * definition rather than reconstructed.
 *
 * Two things that were wrong before and are worth naming, because both made
 * the game harder to recognise:
 *
 *   • **The icons were mismatched.** There are exactly twelve pieces of menu
 *     art and exactly twelve entries, one each. `sword` belongs to My
 *     Fighters and `card` to Farming; this menu had `card` on Fighters and
 *     `sword` on an Arena entry that does not exist in the original at all.
 *     `candle` belongs to the Candle screen, not to Dungeons.
 *
 *   • **Arena and Dungeons are not menu items.** Like the tavern, you can
 *     only enter the one you are standing on, so all three are reached from
 *     the map. A menu entry that is dead wherever you happen to be standing
 *     is worse than no entry.
 *
 * Paths stay as this rebuild has them (`/map`, `/profile`) rather than
 * matching the original's `/home` and `/settings` — they are already linked
 * from elsewhere in the app, and the original's own naming is not consistent
 * enough to be worth chasing.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/map', label: 'World Map', icon: asset('/assets/icons/menu/world.png'), primary: true },
  { to: '/shop', label: 'Shop', icon: asset('/assets/icons/menu/coin.png'), primary: true },
  {
    to: '/leaderboard',
    label: 'Leaderboards',
    icon: asset('/assets/icons/menu/leaderboard.png'),
  },
  {
    to: '/fighters',
    label: 'My Fighters',
    icon: asset('/assets/icons/menu/sword.png'),
    primary: true,
  },
  {
    to: '/ascension',
    label: 'Ascension',
    icon: asset('/assets/icons/menu/ascension.png'),
  },
  { to: '/quests', label: 'Quests', icon: asset('/assets/icons/menu/quests.png'), primary: true },
  { to: '/candle', label: 'Candle', icon: asset('/assets/icons/menu/candle.png') },
  {
    to: '/tournament',
    label: 'Tournament',
    icon: asset('/assets/icons/menu/tournament.png'),
    soon: true,
  },
  { to: '/market', label: 'Market', icon: asset('/assets/icons/menu/market.png') },
  { to: '/lands', label: 'My Lands', icon: asset('/assets/icons/menu/my-land.png') },
  /*
     Rewards is everything the account screen held that pays out — the
     mine and the three ledgers — and Account is what is left: who you
     are, what the game is paying for you, and what you have done. They
     were one screen of seven tabs where four of them were a wallet and
     three were a profile, and the dot on it could only ever mean one of
     those things at a time.
  */
  { to: '/rewards', label: 'Rewards', icon: '' },
  { to: '/profile', label: 'Account', icon: asset('/assets/icons/menu/settings.png') },
  { to: '/farming', label: 'Farming', icon: asset('/assets/icons/menu/card.png') },
]

/**
 * The order the tab bar puts its four in, most-reached first.
 *
 * Separate from `NAV_ITEMS` because that list is the desktop rail's order and
 * the two are answering different questions: the rail is a menu to read down,
 * the tab bar is four thumbs' worth of the things a player opens most. Left
 * to the rail's order, Shop would land second because it happens to sit
 * second in the menu.
 */
export const TABBAR_ORDER = ['/map', '/fighters', '/quests', '/shop']

/** Screens that actually exist, keyed by label, for the ComingSoon copy. */
export const SECTION_BLURBS: Record<string, string> = {
  Ascension: 'Push a maxed fighter past its cap to unlock its true potential.',
  Tournament: 'Weekly bracketed tournaments for the top squads.',
  Market: 'Buy and sell fighters and land with other players.',
}
