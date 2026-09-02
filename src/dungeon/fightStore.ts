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

/**
 * Where a fight was fought.
 *
 * The row itself does not say. It matters twice: abilities can be conditioned
 * on the building hosting the fight, and a player leaving the result screen
 * wants to go back to the screen they came from rather than out to the map.
 */
export type Venue = 'dungeon' | 'arena'

interface Kept {
  row: FightRow
  /*
     Absent when the row was pulled off the chain rather than watched being
     fought. The chain does not record a venue, and guessing one is worse than
     admitting to not knowing: it would send a player leaving an arena replay
     to the dungeon screen.
  */
  venue?: Venue
}

type Store = Record<string, Kept>

function read(): Store {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Kept | FightRow>
    /*
       Entries written before venues existed are bare rows. A player who was
       mid-session when this shipped still has some, and they are worth
       reading rather than throwing away.
    */
    const out: Store = {}
    for (const [id, value] of Object.entries(parsed)) {
      out[id] = 'row' in value ? (value as Kept) : { row: value as FightRow }
    }
    return out
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
const memory = new Map<string, Kept>()

export function rememberFight(row: FightRow, venue?: Venue): void {
  memory.set(row.history_id, { row, venue })

  const store = read()
  store[row.history_id] = { row, venue }

  const ids = Object.keys(store)
  if (ids.length > KEEP) {
    // Oldest first by the chain's own timestamp, so trimming drops the runs
    // the player is least likely to want back.
    ids
      .sort(
        (a, b) =>
          Date.parse(store[a].row.timestamp + 'Z') -
          Date.parse(store[b].row.timestamp + 'Z'),
      )
      .slice(0, ids.length - KEEP)
      .forEach((id) => delete store[id])
  }
  write(store)
}

export function recallFight(historyId: string): FightRow | undefined {
  return (memory.get(historyId) ?? read()[historyId])?.row
}

/**
 * Where the fight was fought, if this browser saw it happen.
 *
 * Undefined for a replay reached by a direct link or by a reload after the
 * session store was cleared: the chain row carries no venue, so the screen
 * has to fall back rather than guess.
 */
export function recallVenue(historyId: string): Venue | undefined {
  return (memory.get(historyId) ?? read()[historyId])?.venue
}
