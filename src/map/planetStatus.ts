import type { Land, Player } from '@/chain/types'
import type { Planet } from '@/chain/config'

/**
 * Per-planet availability, as the contracts define it.
 *
 * "Locked" means different things for the two building types, and neither is
 * about the building itself:
 *
 *  - A **dungeon** is locked for a player who has already run it today.
 *    `users::dungeonplay` appends `<planet>.<land_id>` to the player's
 *    `played_dungeons` list and rejects a repeat with "Dungeon already played
 *    today". The list is wiped the first time a player runs one on a new UTC
 *    day, so it is only meaningful while `last_dungeon_reset` falls on today.
 *
 *  - An **arena** is locked while the player still has a fighter standing in
 *    it — a row in `arena.ale`'s `livearena` (scoped by planet, keyed by
 *    land) whose `fighters[].owner` is them.
 */

export interface PlanetStatus {
  planet: Planet
  /** Taverns the player currently has active here. */
  taverns: number
  /** Dungeons on this planet the player can still run today. */
  dungeonsOpen: number
  dungeonsTotal: number
  /** Arenas here the player does not already have a fighter in. */
  arenasOpen: number
  arenasTotal: number
  /** False until this planet's land data has arrived. */
  loaded: boolean
}

/** `livearena` row, trimmed to what the lock check needs. */
export interface LiveArena {
  planet: string
  land_id: string
  fighters: { owner: string }[]
}

/** UTC day number, matching the contract's `sec_since_epoch() / 86400`. */
function utcDay(ms: number): number {
  return Math.floor(ms / 86_400_000)
}

/**
 * The set of `<planet>.<land_id>` keys the player has already run today.
 * Returns empty when the stored list is from a previous day — the contract
 * treats it as cleared at that point, and so should the UI.
 */
export function playedDungeonsToday(player: Player): Set<string> {
  const resetMs = Date.parse(player.last_dungeon_reset + 'Z')
  if (!Number.isFinite(resetMs)) return new Set()
  if (utcDay(resetMs) !== utcDay(Date.now())) return new Set()

  return new Set(
    (player.played_dungeons ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

function buildingNames(land: Land): string[] {
  return land.buildings.map((b) => String(b.building_name ?? '').toLowerCase())
}

export function summarisePlanet(
  planet: Planet,
  lands: Land[] | undefined,
  player: Player,
  playedToday: Set<string>,
  liveArenas: LiveArena[] | undefined,
): PlanetStatus {
  /*
   * active_taverns plus last_tavern: users::setreveal MOVES a tavern out of
   * the active list and into last_tavern, so counting only the active list
   * reports zero for a player standing in their own tavern.
   */
  const tavernLands = new Set(
    player.active_taverns.filter((t) => t.planet === planet).map((t) => t.land_id),
  )
  if (player.last_tavern?.planet === planet && player.last_tavern.land_id) {
    tavernLands.add(player.last_tavern.land_id)
  }
  const taverns = tavernLands.size

  if (!lands) {
    return {
      planet,
      taverns,
      dungeonsOpen: 0,
      dungeonsTotal: 0,
      arenasOpen: 0,
      arenasTotal: 0,
      loaded: false,
    }
  }

  // Which arenas on this planet already hold one of the player's fighters.
  const occupied = new Set(
    (liveArenas ?? [])
      .filter((a) => a.fighters?.some((f) => f.owner === player.wallet))
      .map((a) => a.land_id),
  )

  let dungeonsOpen = 0
  let dungeonsTotal = 0
  let arenasOpen = 0
  let arenasTotal = 0

  for (const land of lands) {
    for (const name of buildingNames(land)) {
      if (name === 'dungeon') {
        dungeonsTotal++
        if (!playedToday.has(`${planet}.${land.land_id}`)) dungeonsOpen++
      } else if (name === 'arena') {
        arenasTotal++
        if (!occupied.has(land.land_id)) arenasOpen++
      }
    }
  }

  return {
    planet,
    taverns,
    dungeonsOpen,
    dungeonsTotal,
    arenasOpen,
    arenasTotal,
    loaded: true,
  }
}
