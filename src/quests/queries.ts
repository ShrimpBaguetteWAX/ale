import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { TTL } from '@/chain/cache'
import type { ActiveQuests, QuestConfig, QuestScope } from './types'

/**
 * The player's own quest row.
 *
 * One row keyed by wallet, holding every scope's quests together — so the
 * whole screen is a single read. Kept on a short TTL because progress moves
 * with the player row, and forced fresh after any quest action.
 */
export function fetchActiveQuests(
  wallet: string,
  refresh = false,
): Promise<ActiveQuests | undefined> {
  return getRow<ActiveQuests>(
    {
      code: CONTRACTS.quests,
      scope: CONTRACTS.quests,
      table: 'activequests',
      key: wallet,
    },
    { ttl: TTL.short, refresh },
  )
}

/**
 * The three cadences and their current windows.
 *
 * Cached only briefly: `quest_end` is what every countdown on the screen
 * reads, and the contract rolls the window forward the next time anyone calls
 * `getquests` or `reroll` — so a long cache would leave the page counting
 * down to a date that has already moved.
 */
export function fetchQuestScopes(refresh = false): Promise<QuestScope[]> {
  return getAllRows<QuestScope>(
    { code: CONTRACTS.quests, scope: CONTRACTS.quests, table: 'qscopes' },
    { ttl: TTL.short, refresh },
  )
}

/** Reroll price and the pools quests are funded from. */
export function fetchQuestConfig(): Promise<QuestConfig | undefined> {
  return getRow<QuestConfig>(
    { code: CONTRACTS.quests, scope: CONTRACTS.quests, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}
