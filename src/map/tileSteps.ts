/**
 * The tiles a trip crosses, from one tile to another, both ends included.
 *
 * One tile per step along whichever axis is longer, the other axis rounded
 * to the nearest tile: the way a strategy map plots a march. Rounding is
 * symmetric about zero, so a trip west draws the mirror of the same trip
 * east rather than leaning a tile differently.
 *
 * Only for drawing. Travel is priced by straight-line distance, so the
 * route here is how the trip reads on the map, not what it costs.
 */
export function tileSteps(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const n = Math.max(Math.abs(dx), Math.abs(dy))
  if (n === 0) return [{ x: from.x, y: from.y }]
  const round = (v: number) => Math.sign(v) * Math.round(Math.abs(v))
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: from.x + round((i * dx) / n),
    y: from.y + round((i * dy) / n),
  }))
}

/**
 * A length of time, the way the map says how long something has been so:
 * "12m", "5h 12m", "2d 4h". Two units at most; under a minute is "1m".
 */
export function shortSpan(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}
