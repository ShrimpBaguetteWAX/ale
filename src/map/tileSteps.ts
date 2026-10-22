/**
 * Where a trip touches down on the way: its two ends and, on a longer trip,
 * a few landing pads between them, roughly one every five tiles and never
 * more than three.
 *
 * The pads wander off the straight line, to one side and then the other, by
 * a different amount each, the way a real route bends round the land rather
 * than ruling a line across it. The wander comes from the trip's own ends, so
 * the same trip always draws the same way.
 *
 * A pad only lands where `free` says it may (on the map, no building, no
 * portal); otherwise on the nearest free tile around, and it is left out when
 * there is none. Only for drawing: travel is priced by straight-line distance.
 */
export function hopStops(
  from: { x: number; y: number },
  to: { x: number; y: number },
  free: (p: { x: number; y: number }) => boolean,
): { x: number; y: number }[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const n = Math.max(Math.abs(dx), Math.abs(dy))
  const hops = Math.min(4, Math.max(1, Math.round(n / 5)))
  const stops = [{ x: from.x, y: from.y }]
  if (hops > 1) {
    const len = Math.hypot(dx, dy)
    /* Across the route, and a little pseudo-random number per trip. */
    const px = -dy / len
    const py = dx / len
    let seed = (Math.imul(from.x, 73856093) ^ Math.imul(from.y, 19349663) ^ Math.imul(to.x, 83492791) ^ Math.imul(to.y, 50331653)) >>> 0
    const rand = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
      return seed / 4294967296
    }
    const side = rand() < 0.5 ? -1 : 1
    const used = new Set([from.x + ',' + from.y, to.x + ',' + to.y])
    for (let k = 1; k < hops; k++) {
      const off = (len / hops) * (0.2 + 0.25 * rand()) * (k % 2 ? side : -side)
      const ix = from.x + (dx * k) / hops + px * off
      const iy = from.y + (dy * k) / hops + py * off
      /* The tile under the ideal spot, then the ring around it, nearest first. */
      const near: { x: number; y: number; d: number }[] = []
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const x = Math.round(ix) + ox
          const y = Math.round(iy) + oy
          near.push({ x, y, d: Math.hypot(x - ix, y - iy) })
        }
      }
      near.sort((a, b) => a.d - b.d)
      const pick = near.find((p) => !used.has(p.x + ',' + p.y) && free(p))
      if (!pick) continue
      used.add(pick.x + ',' + pick.y)
      stops.push({ x: pick.x, y: pick.y })
    }
  }
  stops.push({ x: to.x, y: to.y })
  return stops
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
