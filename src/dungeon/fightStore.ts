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

/** Each fighter's experience as it stood when the fight was started. */
export type XpBefore = Record<number, number>

interface Kept {
  row: FightRow
  /*
     Absent when the row was pulled off the chain rather than watched being
     fought. The chain does not record a venue, and guessing one is worse than
     admitting to not knowing: it would send a player leaving an arena replay
     to the dungeon screen.
  */
  venue?: Venue
  /*
     What the team had banked before the run, so the result can say what the
     run paid.

     Kept here because the chain does not answer it. The fight row carries
     `experience` and `required_experience` fields on every fighter and writes
     zero into both, so subtracting the row from the live roster reports the
     fighter's whole lifetime total as though one run had earned it — which is
     what it did, on a defeat, which pays nothing at all.

     Deriving it instead would mean re-deriving the contract's own sum:
     `xp_per_dungeon_difficulty x difficulty`, or `xp_per_arena_win`, run
     through every fighter's `eofeffect`. Recording the before is exact and
     needs none of that. Absent for a replay reached by a link, the same as
     the venue, and the result screen then says nothing rather than guessing.
  */
  xpBefore?: XpBefore
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

export function rememberFight(
  row: FightRow,
  venue?: Venue,
  xpBefore?: XpBefore,
): void {
  memory.set(row.history_id, { row, venue, xpBefore })

  const store = read()
  store[row.history_id] = { row, venue, xpBefore }

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

/**
 * What the team had banked before this fight, if this browser started it.
 *
 * Undefined for a replay reached by a link, in which case the result screen
 * shows the bars without claiming what the run was worth.
 */
export function recallXpBefore(historyId: string): XpBefore | undefined {
  return (memory.get(historyId) ?? read()[historyId])?.xpBefore
}
