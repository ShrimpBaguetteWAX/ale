import type { RewardPower } from '@/dungeon/types'

/**
 * What a win has been worth lately, per pool, remembered on this device.
 *
 * The briefing wants to say "about four more dungeon wins until you can
 * mine", and the contract gives no way to ask that up front: the power a win
 * banks is `pools.cpp`'s arithmetic over the player's equipped tools, the
 * building's boost score, the difficulty chosen and the account status — four
 * inputs, two of which change with every run. Re-deriving it here would be a
 * second copy of the formula that is quietly wrong the day any of them move.
 *
 * The fight row, though, carries the answer after the fact:
 * `reward_power_added` is exactly what the run banked. So the victory screen
 * files it here, and the briefing reads back an average of the last few.
 * No history means no estimate, and the briefing says so rather than
 * guessing.
 */

const KEY = 'al.winpower'
/** Enough to smooth out one odd difficulty, few enough to follow new tools. */
const KEEP = 8

export type WinVenue = 'dungeon' | 'arena'

type Store = Partial<Record<WinVenue, Record<string, number[]>>> & {
  /* Fights already filed, so rewatching a replay does not count it twice. */
  seen?: string[]
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Store) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Files one win's power. Called once per fight row, from the victory screen. */
export function rememberWinPower(
  historyId: string,
  venue: WinVenue,
  added: RewardPower[],
): void {
  if (!added?.length) return
  const store = read()
  if (store.seen?.includes(historyId)) return
  store.seen = [...(store.seen ?? []), historyId].slice(-40)
  const pools = { ...(store[venue] ?? {}) }
  for (const row of added) {
    const power = Number(row.power ?? 0)
    if (!(power > 0)) continue
    pools[row.pool] = [...(pools[row.pool] ?? []), power].slice(-KEEP)
  }
  store[venue] = pools
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* A private window: the briefing just goes without an estimate. */
  }
}

/** The average power one win has banked in each pool, where known. */
export function recallWinPower(venue: WinVenue): Map<string, number> {
  const out = new Map<string, number>()
  for (const [pool, list] of Object.entries(read()[venue] ?? {})) {
    const valid = (list ?? []).filter((n) => Number.isFinite(n) && n > 0)
    if (valid.length) out.set(pool, valid.reduce((a, b) => a + b, 0) / valid.length)
  }
  return out
}
