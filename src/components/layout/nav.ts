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
  /** What the section is for, in a line: the phone's More page shows it. */
  line?: string
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
  /*
     First, because it is the answer to "what now" and every other entry is
     a place to go once that is answered. It used to open from the logo,
     which is a fine place for a way home and a poor one for a screen: a
     player who has not been told does not click a wordmark to find out what
     is waiting for them.
  */
  { to: '/briefing', label: 'Briefing', icon: asset('/assets/icons/menu/briefing.svg'), line: 'Check what you can do right now' },
  { to: '/map', label: 'World Map', icon: asset('/assets/icons/menu/world.svg'), primary: true },
  { to: '/shop', label: 'Shop', icon: asset('/assets/icons/menu/shop.svg'), primary: true },
  {
    to: '/leaderboard',
    label: 'Leaderboards',
    icon: asset('/assets/icons/menu/leaderboard.svg'),
    line: 'Dungeon, arena and tournament ranks',
  },
  {
    to: '/fighters',
    label: 'My Fighters',
    icon: asset('/assets/icons/menu/fighters.svg'),
    primary: true,
  },
  {
    to: '/ascension',
    label: 'Ascension',
    icon: asset('/assets/icons/menu/ascension.svg'),
    line: 'Sacrifice fighters to raise one',
  },
  { to: '/quests', label: 'Quests', icon: asset('/assets/icons/menu/quests.svg'), primary: true },
  { to: '/candle', label: 'Candle', icon: asset('/assets/icons/menu/candle.svg'), line: 'Burn gems for a share of the pot' },
  {
    to: '/tournament',
    label: 'Tournament',
    icon: asset('/assets/icons/menu/tournament.svg'),
    /* The screen is built and everything behind it stays where it is; only
       the way in is closed while it is not ready to be found. */
    soon: true,
    line: 'Fight other players for the prize pot',
  },
  { to: '/market', label: 'Market', icon: asset('/assets/icons/menu/market.svg'), line: 'Buy and sell fighters' },
  { to: '/lands', label: 'My Lands', icon: asset('/assets/icons/menu/lands.svg'), line: 'Your lands and what they earn' },
  /*
     Rewards is everything the account screen held that pays out — the
     mine and the three ledgers — and Account is what is left: who you
     are, what the game is paying for you, and what you have done. They
     were one screen of seven tabs where four of them were a wallet and
     three were a profile, and the dot on it could only ever mean one of
     those things at a time.
  */
  { to: '/rewards', label: 'Rewards', icon: asset('/assets/icons/menu/rewards.svg'), line: 'Mine your reward pools' },
  { to: '/profile', label: 'Account', icon: asset('/assets/icons/menu/account.svg'), line: 'Avatar, wallet and settings' },
  { to: '/farming', label: 'Farming', icon: asset('/assets/icons/menu/farming.svg'), line: 'Stake cards for rewards' },
  /* Last on the rail, as help usually is; near the top of the phone's More page, where a new trainer looks first. */
  { to: '/guide', label: 'Guide', icon: asset('/assets/icons/menu/guide.svg'), line: 'The basics, chapter by chapter' },
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

/**
 * The phone's More page, top to bottom: what to do now, then the places that
 * are about fighting, then fighters, then what pays, and the account last.
 * The groups have no headings on the page; the order is enough to carry them.
 */
export const MORE_ORDER = [
  '/briefing',
  '/guide',
  '/leaderboard',
  '/tournament',
  '/ascension',
  '/market',
  '/rewards',
  '/candle',
  '/farming',
  '/lands',
  '/profile',
]

/** Screens that actually exist, keyed by label, for the ComingSoon copy. */
export const SECTION_BLURBS: Record<string, string> = {
  Ascension: 'Push a maxed fighter past its cap to unlock its true potential.',
  Market: 'Buy and sell fighters and land with other players.',
}
