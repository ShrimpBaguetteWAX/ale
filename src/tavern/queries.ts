import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { TTL } from '@/chain/cache'
import type { TavernConfig, TavernTemplate } from './types'
import type { ClassTemplate } from './fighterStats'

/** `tavern.ale` config: what a reveal costs. */
export function fetchTavernConfig(): Promise<TavernConfig | undefined> {
  return getRow<TavernConfig>(
    { code: CONTRACTS.tavern, scope: CONTRACTS.tavern, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * The whitelist of templates that can be used to hire (~520 rows).
 *
 * Effectively static, so it is cached hard and kept in localStorage — a
 * returning player opens the tavern with no request for it at all.
 */
export function fetchTavernTemplates(): Promise<TavernTemplate[]> {
  return getAllRows<TavernTemplate>(
    { code: CONTRACTS.tavern, scope: CONTRACTS.tavern, table: 'nfttemplates' },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * One class's stat bands, used to grade a recruit's roll.
 *
 * Keyed by class name, so this is a single-row read for whichever class the
 * tavern is offering — and cached hard, because the bands never move.
 */
export function fetchClassTemplate(
  classname: string,
): Promise<ClassTemplate | undefined> {
  return getRow<ClassTemplate>(
    {
      code: CONTRACTS.creation,
      scope: CONTRACTS.creation,
      table: 'classtemps',
      key: classname,
    },
    { ttl: TTL.long, persist: true },
  )
}
