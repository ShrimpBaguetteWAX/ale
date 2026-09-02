export interface NavItem {
  to: string
  label: string
  /** Original menu artwork from the live game. */
  icon: string
  /** Contract is live on chain but the screen isn't built yet. */
  soon?: boolean
  /** Shown in the mobile tab bar rather than the "More" sheet. */
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
  { to: '/map', label: 'World Map', icon: '/assets/icons/menu/world.png', primary: true },
  { to: '/shop', label: 'Shop', icon: '/assets/icons/menu/coin.png' },
  {
    to: '/leaderboard',
    label: 'Leaderboards',
    icon: '/assets/icons/menu/leaderboard.png',
  },
  {
    to: '/fighters',
    label: 'My Fighters',
    icon: '/assets/icons/menu/sword.png',
    primary: true,
  },
  {
    to: '/ascension',
    label: 'Ascension',
    icon: '/assets/icons/menu/ascension.png',
  },
  { to: '/quests', label: 'Quests', icon: '/assets/icons/menu/quests.png', primary: true },
  { to: '/candle', label: 'Candle', icon: '/assets/icons/menu/candle.png' },
  {
    to: '/tournament',
    label: 'Tournament',
    icon: '/assets/icons/menu/tournament.png',
    soon: true,
  },
  { to: '/market', label: 'Market', icon: '/assets/icons/menu/market.png' },
  { to: '/lands', label: 'My Lands', icon: '/assets/icons/menu/my-land.png' },
  { to: '/profile', label: 'Account', icon: '/assets/icons/menu/settings.png', primary: true },
  { to: '/farming', label: 'Farming', icon: '/assets/icons/menu/card.png' },
]

/** Screens that actually exist, keyed by label, for the ComingSoon copy. */
export const SECTION_BLURBS: Record<string, string> = {
  Ascension: 'Push a maxed fighter past its cap to unlock its true potential.',
  Tournament: 'Weekly bracketed tournaments for the top squads.',
  Market: 'Buy and sell fighters and land with other players.',
}
