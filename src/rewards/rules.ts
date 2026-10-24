import { asset } from '@/assets'
import { assetValue } from '@/account/rules'
import type { RewardLogEntry } from '@/account/queries'

/**
 * How many tools a player can mine with at once. `setminenfts` takes the
 * list whole, so the screen is what keeps it to three.
 */
export const MAX_TOOLS = 3

/** One line of the phone's payments: every payment from one source, summed. */
export interface PaymentSource {
  key: string
  label: string
  icon: string
  count: number
  total: number
}

/*
   The ledger's own wording is long and repeats itself a hundred times
   ("Reward for completing a quest"); a phone has room for the short name of
   where the money came from. Matched on the pool name first, which is
   stable, then on the description for anything new.
*/
const SOURCES: { test: RegExp; label: string; icon: string }[] = [
  { test: /lndowner|landowner/i, label: 'Landowner rewards', icon: '/assets/icons/menu/my-land.png' },
  { test: /quest/i, label: 'Quests', icon: '/assets/icons/menu/quests.png' },
  { test: /arenadom|domination/i, label: 'Arena domination', icon: '/assets/icons/arena.svg' },
  { test: /arena/i, label: 'Arena wins', icon: '/assets/icons/arena.svg' },
  { test: /dung/i, label: 'Dungeon wins', icon: '/assets/icons/dungeons.svg' },
  { test: /candle|rec$|recovery/i, label: 'Candle recovery', icon: '/assets/icons/menu/candle.png' },
]

/**
 * The ledger folded by where each payment came from, largest total first.
 *
 * A hundred rows of which ninety-five say "Landowner Rewards" is a list to
 * scroll past, not to read; one line per source with a count and a sum says
 * the same thing in four.
 */
export function paymentSources(rows: RewardLogEntry[], fallbackIcon: string): PaymentSource[] {
  const by = new Map<string, PaymentSource>()
  for (const r of rows) {
    const hit = SOURCES.find((s) => s.test.test(r.pool) || s.test.test(r.pool_description))
    const key = hit?.label ?? (r.pool_description || r.pool)
    const entry =
      by.get(key) ??
      ({
        key,
        label: key,
        icon: hit ? asset(hit.icon) : fallbackIcon,
        count: 0,
        total: 0,
      } satisfies PaymentSource)
    entry.count += 1
    entry.total += assetValue(r.reward)
    by.set(key, entry)
  }
  return [...by.values()].sort((a, b) => b.total - a.total)
}
