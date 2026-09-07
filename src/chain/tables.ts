import { CONTRACTS } from './config'
import { cacheDropWhere } from './cache'

/**
 * The tables an action can change, by name.
 *
 * Not a registry of every read in the app — the eighty-six `fetch*` functions
 * are left exactly where they are, and this deliberately does not try to
 * replace them. It exists for one job: letting an action say what it dirtied
 * without repeating a contract account and a table name at the call site,
 * where a typo would be silent and would show up as data that never
 * refreshes.
 *
 * Config tables are absent on purpose. They change when the team edits them,
 * not when a player does something, and nothing a player signs should drop
 * the class bands.
 */
export const TABLES = {
  /** The player row: balances, position, the tavern recruit, lifetime stats. */
  player: { code: CONTRACTS.players, table: 'players' },
  /** Every fighter in every wallet, read by an owner index. */
  fighters: { code: CONTRACTS.fighters, table: 'fighters' },
  /** The three-a-cadence quest board. */
  quests: { code: CONTRACTS.quests, table: 'activequests' },
  /** Land rows, scoped by planet — buildings live inside them. */
  lands: { code: CONTRACTS.lands, table: 'lands' },
  /** Who is standing in an arena, scoped by planet. */
  arena: { code: CONTRACTS.arena, table: 'livearena' },
  /** Gem auctions, and the fixed-price offers beside them. */
  auctions: { code: CONTRACTS.market, table: 'auctions' },
  offers: { code: CONTRACTS.market, table: 'instantoffer' },
  /** A farmer's accrued power, and the cards behind it. */
  farmUser: { code: CONTRACTS.farm, table: 'user' },
  farmStaked: { code: CONTRACTS.farm, table: 'nfts' },
  /** What a wallet has banked in the reward pools. */
  rewardUsers: { code: CONTRACTS.rewardLog, table: 'rwrdusers' },
  /** The Candle: what a wallet put in, and what it is owed. */
  candleClaims: { code: CONTRACTS.candle, table: 'claims' },
  candleStakes: { code: CONTRACTS.candle, table: 'contribution' },
  /** Purchase cooldowns — the daily flask and its siblings. */
  shopCooldowns: { code: CONTRACTS.shop, table: 'cdclaimshp' },
  /** The daily dungeon allowance. */
  dungeonCooldowns: { code: CONTRACTS.dungeons, table: 'cdclaim' },
  /** Settled and running leaderboard standings. */
  leaderboard: { code: CONTRACTS.arena, table: 'leaderboard' },
} as const

export type TableKey = keyof typeof TABLES

/**
 * Forget what was read from a table, so the next read asks the chain.
 *
 * `scope` narrows it to one scope where an action only dirties one — building
 * on Kavian says nothing about Magor's land rows, and dropping all six would
 * cost five re-reads for nothing. Left off, every scope of that table goes,
 * which is right for the tables read under a single scope.
 *
 * Matching is on the key's own parts rather than a prefix: a read's key is
 * `rows:code|scope|table|…`, and the scope sits between the two parts that
 * name the table.
 */
export function cacheDropTable(
  key: TableKey,
  scope?: string,
  /**
   * Whether to tell the screens.
   *
   * Off for the drop an action makes *before* it waits for the chain, and
   * that is not a detail — announcing there caused a bug worth recording.
   * A screen woken by the drop re-read at once, got the pre-transaction
   * answer because the chain had not caught up yet, and wrote it back into
   * the cache the confirmation was about to read from. Every round after
   * that was a cache hit on stale data, so the wait never settled and the
   * quest a player had just claimed stayed on the board under a message
   * saying it had been claimed.
   *
   * So: forget quietly, wait for the chain, then say so.
   */
  announce = true,
): void {
  const { code, table } = TABLES[key]

  cacheDropWhere((cacheKey) => {
    /* `rows:` and `all:` are the two shapes `chain/client` writes. */
    const at = cacheKey.indexOf(':')
    if (at < 0) return false
    const parts = cacheKey.slice(at + 1).split('|')
    if (parts[0] !== code || parts[2] !== table) return false
    return scope === undefined || parts[1] === scope
  })

  if (announce) announceTableDrop(key)
}

/** Tell the screens a table is stale, without dropping anything. */
export function announceTableDrop(key: TableKey): void {
  for (const fn of watchers) fn(key)
}

/*
   Who wants to know a table was forgotten.

   Dropping the entry is only half of invalidation. The other half is the
   screen looking at that data right now, which has no reason to ask again
   unless it is told — and telling it by table rather than by cache key is
   what lets a screen say what it depends on in the same words an action
   says what it changed.

   A module-level set rather than React context: the cache is module-level
   itself, and threading a provider through the app to announce something
   the cache already knows would be ceremony.
*/
type Watcher = (key: TableKey) => void
const watchers = new Set<Watcher>()

/** Subscribe to table drops. Returns the unsubscribe. */
export function onTableDrop(fn: Watcher): () => void {
  watchers.add(fn)
  return () => {
    watchers.delete(fn)
  }
}
