/**
 * Quests claimed in this browser, by `questKey`, with when.
 *
 * A claim replaces the quest on chain, but a node that has not caught up
 * yet still answers with the row from before it — and then the quest just
 * claimed comes back, ready to claim again, because the player's counters
 * have long since passed its target. Nothing can be done about the node, so
 * the screens remember what was claimed and leave it out.
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

/** Note a quest as claimed, the moment its claim is signed. */
export function rememberClaimed(key: string, now = Date.now()): void {
  write({ ...read(now), [key]: now })
}

/** Whether this quest was claimed here within the last hour. */
export function claimedRecently(key: string, now = Date.now()): boolean {
  return key in read(now)
}

/** For tests. */
export function forgetClaimed(): void {
  write({})
}
