/* What a tracked `permstats` key is called on screen, and its icon. */

/*
 * Stat keys that do not read as English once the underscores are gone.
 *
 * `alf` is the farming contract's own prefix — nothing in the game is called
 * that, and "Alf credits earned" reads as a name rather than a section.
 */
const STAT_RENAMES: [RegExp, string][] = [[/^alf_credits/, 'Farming Credits']]

export function prettyStat(key: string): string {
  for (const [pattern, name] of STAT_RENAMES) {
    if (pattern.test(key)) return key.replace(pattern, name).replace(/_/g, ' ')
  }
  return key
    .replace(/_/g, ' ')
    .replace(/\b(tlm|wax)\b/g, (w) => w.toUpperCase())
    .replace(/\bnfts\b/g, 'NFTs')
    .replace(/^./, (c) => c.toUpperCase())
}

/**
 * An icon for a tracked stat, where one is unambiguous.
 *
 * Matched on the stat's own words rather than a key-by-key table: the
 * contract adds `permstats` entries as features ship, and a table would show
 * a bare row for every new one until somebody remembered to extend it. The
 * order matters — `energy_saved_recruiting` is about energy, not recruits,
 * so the currencies are tested before the activities.
 *
 * Anything unmatched simply has no icon, which is the honest answer for a
 * stat nobody has given a meaning yet.
 */
const STAT_ICONS: [RegExp, string][] = [
  /* Currencies first: several activity words appear in currency stats. */
  [/^credits/, '/assets/icons/credits.svg'],
  [/^gems/, '/assets/icons/gems.svg'],
  [/^energy/, '/assets/icons/energy.svg'],
  [/^shards/, '/assets/icons/shards.svg'],
  [/^tlm/, '/assets/icons/tlm.svg'],
  [/^wax/, '/assets/icons/wax-coin.webp'],
  /*
     Two currency stats that do not start with the currency's own name, so
     the rules above cannot reach them. Both are checked against the
     contract rather than guessed from the wording: `market.cpp` pays
     `market_earned` out of `gem_payout` and charges `market_spent` in gems,
     and `nftstake.cpp` hands `alf_credits_claimed` to `inline_gaincur` in
     the same argument slot that `sellfighter` fills with credits.
  */
  [/^market_(earned|spent)/, '/assets/icons/gems.svg'],
  [/^alf_credits/, '/assets/icons/credits.svg'],

  /* Places and activities. */
  [/^arenas/, '/assets/icons/arena.svg'],
  [/dungeon/, '/assets/icons/dungeons.svg'],
  [/^taverns/, '/assets/markers/tavern.svg'],
  [/^buildings/, '/assets/icons/build.webp'],
  [/^portals/, '/assets/old-markers/portal.svg'],
  [/^quests/, '/assets/icons/menu/quests.png'],
  [/^recruits/, '/assets/icons/add-fighter.svg'],
  [/^nfts_staked/, '/assets/icons/menu/card.png'],
  [/^premium/, '/assets/icons/account-legend.svg'],
  [/travel/, '/assets/icons/menu/world.png'],
  [/^level_ups/, '/assets/icons/medal.svg'],
  [/^ascensions/, '/assets/icons/menu/ascension.png'],
  /*
     The game's own "raised" mark, which is what boosting does: `maps.cpp`
     records the distance a top-up moves a building's boost score, so the
     figure is a lift rather than a place or a currency.
  */
  [/^boosting/, '/assets/icons/arrows/green-duble-up.png'],

  /* Combat. */
  [/^knockouts/, '/assets/icons/swords.svg'],
  [/^damage_dealt/, '/assets/icons/stats/damage.svg'],
  [/^damage_(taken|blocked)/, '/assets/icons/shield.svg'],
]

export function statIconFor(key: string): string | undefined {
  return STAT_ICONS.find(([re]) => re.test(key))?.[1]
}

/** The kinds of stat the phone's Stats tab groups them by. */
export type StatGroup = 'Earnings' | 'Fighting' | 'Fighters' | 'World' | 'Other'

export const STAT_GROUP_ORDER: StatGroup[] = ['Earnings', 'Fighting', 'Fighters', 'World', 'Other']

/* Matched on the key's words, like the icons, so a new stat lands somewhere sensible. */
const STAT_GROUPS: [RegExp, StatGroup][] = [
  [/^level_ups|^recruits|^energy_saved|^ascension/, 'Fighters'],
  [/_earned$|_gained$|^alf_credits|^market_|^gems_in_candle/, 'Earnings'],
  [/^(dungeons|arenas)_(played|won)$|^knockouts|^damage_|dungeon_difficulty|dungeon_leaderboard/, 'Fighting'],
  [/^quests|travel|^portals|_constructed$|^boosting|^nfts_staked|^premium/, 'World'],
]

export function statGroup(key: string): StatGroup {
  return STAT_GROUPS.find(([re]) => re.test(key))?.[1] ?? 'Other'
}
