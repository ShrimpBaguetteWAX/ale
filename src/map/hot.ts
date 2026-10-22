import type { Land } from '@/chain/types'
import { boostShown, buildingMarker, liveBoostPercent } from './terrain'

/**
 * A hot building's key: planet and land id together. A land id is the
 * tile's coordinates, so the same id names a land on every planet.
 */
export const hotKey = (planet: string, landId: string) => planet + ':' + landId

/**
 * The buildings that are hottest right now: the `n` arenas and the `n`
 * dungeons with the highest live boost across every planet, by `hotKey`.
 *
 * Read from the lands the map has already loaded, so it costs no request:
 * the map warms every planet for the planet menu anyway. A building
 * decayed below what the map draws is never hot.
 */
export function hottestLands(
  byPlanet: Partial<Record<string, Land[]>>,
  decayPerHour: number,
  n = 10,
  now = Date.now(),
): Set<string> {
  const ranked: Record<'arena' | 'dungeon', { id: string; boost: number }[]> = { arena: [], dungeon: [] }
  for (const [planet, lands] of Object.entries(byPlanet)) {
    for (const land of lands ?? []) {
      const b = land.buildings[0]
      if (!b || land.special_effect) continue
      const kind = buildingMarker(String(b.building_name))
      if (kind !== 'arena' && kind !== 'dungeon') continue
      const boost = liveBoostPercent(Number(b.boost_score ?? 0), String(b.boost_score_update ?? ''), decayPerHour, now)
      if (!boostShown(boost)) continue
      ranked[kind].push({ id: hotKey(planet, land.land_id), boost })
    }
  }
  const top = (list: { id: string; boost: number }[]) =>
    list
      .sort((a, b) => b.boost - a.boost || a.id.localeCompare(b.id))
      .slice(0, n)
      .map((e) => e.id)
  return new Set([...top(ranked.arena), ...top(ranked.dungeon)])
}
