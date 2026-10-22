import type { Land } from '@/chain/types'
import { boostShown, buildingMarker, liveBoostPercent } from './terrain'

/**
 * The buildings that are hottest right now: the `n` arenas and the `n`
 * dungeons with the highest live boost across every planet, by land id.
 *
 * Read from the lands the map has already loaded, so it costs no request:
 * the map warms every planet for the planet menu anyway. A planet that has
 * not arrived yet simply is not in the running until it does. A building
 * decayed below what the map draws is never hot.
 */
export function hottestLands(
  lands: Iterable<Land>,
  decayPerHour: number,
  n = 10,
  now = Date.now(),
): Set<string> {
  const ranked: Record<'arena' | 'dungeon', { id: string; boost: number }[]> = { arena: [], dungeon: [] }
  for (const land of lands) {
    const b = land.buildings[0]
    if (!b || land.special_effect) continue
    const kind = buildingMarker(String(b.building_name))
    if (kind !== 'arena' && kind !== 'dungeon') continue
    const boost = liveBoostPercent(Number(b.boost_score ?? 0), String(b.boost_score_update ?? ''), decayPerHour, now)
    if (!boostShown(boost)) continue
    ranked[kind].push({ id: land.land_id, boost })
  }
  const top = (list: { id: string; boost: number }[]) =>
    list
      .sort((a, b) => b.boost - a.boost || a.id.localeCompare(b.id))
      .slice(0, n)
      .map((e) => e.id)
  return new Set([...top(ranked.arena), ...top(ranked.dungeon)])
}
