import type { FightRow } from './types'

/**
 * Local keeping of battles the player has just fought.
 *
 * `battle.ale`/`fights` is scratch space, not history: `deloldfights` erases
 * every row more than sixty seconds old. A player who watches the replay,
 * navigates away and comes back would otherwise find their own fight gone, and
 * a slow reload during the animation would lose it mid-watch.
 *
 * So the row is copied out of the chain the moment it appears and kept here.
 * sessionStorage rather than localStorage: this is worth surviving a reload,
 * not worth accumulating across days.
 */

const KEY = 'al.fights'
/** Enough to step back through a session's runs without unbounded growth. */
const KEEP = 12

type Store = Record<string, FightRow>

function read(): Store {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function write(store: Store): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // A full or unavailable sessionStorage is not worth failing a battle over;
    // the in-memory copy below still carries the current fight.
  }
}

/** Kept alongside the serialised copy so a quota failure is survivable. */
const memory = new Map<string, FightRow>()

export function rememberFight(row: FightRow): void {
  memory.set(row.history_id, row)

  const store = read()
  store[row.history_id] = row

  const ids = Object.keys(store)
  if (ids.length > KEEP) {
    // Oldest first by the chain's own timestamp, so trimming drops the runs
    // the player is least likely to want back.
    ids
      .sort(
        (a, b) =>
          Date.parse(store[a].timestamp + 'Z') - Date.parse(store[b].timestamp + 'Z'),
      )
      .slice(0, ids.length - KEEP)
      .forEach((id) => delete store[id])
  }
  write(store)
}

export function recallFight(historyId: string): FightRow | undefined {
  return memory.get(historyId) ?? read()[historyId]
}
