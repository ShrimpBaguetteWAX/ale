/**
 * Quests claimed or rerolled in this browser, by `questKey`, with when.
 *
 * Both replace the quest on chain, but a node that has not caught up yet
 * still answers with the row from before — and then the quest just claimed
 * comes back, ready to claim again, because the player's counters have long
 * since passed its target, or the quest just rerolled flashes back as if the
 * reroll had undone itself. Nothing can be done about the node, so the
 * screens remember what was replaced and treat a read that still holds it as
 * a read from behind.
 *
 * A key cannot come back legitimately: it folds in the scope, the name, the
 * target and the reward, and a fresh quest in the slot has its own target
 * and its own escrowed reward. An hour is far longer than any node lags,
 * and sessionStorage keeps it through a reload without keeping it forever.
 */

const STORAGE_KEY = 'al:quests.claimed.v1'
const HOLD_MS = 3_600_000

type Claimed = Record<string, number>

let memory: Claimed | null = null

function read(now: number): Claimed {
  if (!memory) {
    try {
      memory = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Claimed
    } catch {
      memory = {}
    }
  }
  for (const [key, at] of Object.entries(memory)) {
    if (!(now - at < HOLD_MS)) delete memory[key]
  }
  return memory
}

function write(claimed: Claimed) {
  memory = claimed
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(claimed))
  } catch {
    /* Without storage the memory lasts as long as the page. */
  }
}

/** Note a quest as replaced: a claim the moment it is signed, a reroll once the board shows it. */
export function rememberClaimed(key: string, now = Date.now()): void {
  write({ ...read(now), [key]: now })
}

/** Whether this quest was claimed here within the last hour. */
export function claimedRecently(key: string, now = Date.now()): boolean {
  return key in read(now)
}

/** Whether a board still holds a quest replaced here — a read from a node behind. */
export function holdsReplaced(keys: Iterable<string>, now = Date.now()): boolean {
  const replaced = read(now)
  for (const key of keys) if (key in replaced) return true
  return false
}

/** For tests. */
export function forgetClaimed(): void {
  write({})
}
