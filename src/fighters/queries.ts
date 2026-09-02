import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { TTL } from '@/chain/cache'
import type { FighterLevel, FightersConfig } from './types'

/**
 * `fighters.ale` / `levels` — the XP wall and price of each level.
 *
 * Ten rows that only move when the team retunes progression, so it is cached
 * hard and kept in localStorage: a returning player opens the roster with no
 * request for it at all.
 */
export function fetchFighterLevels(): Promise<FighterLevel[]> {
  return getAllRows<FighterLevel>(
    { code: CONTRACTS.fighters, scope: CONTRACTS.fighters, table: 'levels' },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * `fighters.ale` / `config` — upkeep terms and the level ceiling.
 *
 * `standard_pay_payday` is the full price of a payday and
 * `standard_days_payday` the interval it buys, which together are what makes
 * the roster screen's cost figures computable client-side rather than
 * guessed at.
 */
export function fetchFightersConfig(): Promise<FightersConfig | undefined> {
  return getRow<FightersConfig>(
    { code: CONTRACTS.fighters, scope: CONTRACTS.fighters, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}
