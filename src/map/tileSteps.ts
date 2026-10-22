type Pt = { x: number; y: number }

/**
 * A trip drawn as a flight: one long, gentle curve from `from` to `to`, the
 * way a flight path bends on a map, with a few landing pads along it on a
 * longer trip (about one every four tiles, never more than four).
 *
 * The curve bows to the side facing up the map, so every trip bends the same
 * way and a trip north or south bends too. A pad only lands where `free` says
 * it may (on the map, no building, no portal): on the tile under the curve,
 * or the nearest free one around it, and it is left out when there is none.
 *
 * Each leg comes back as its piece of the curve on the ground (`a`, `ground`,
 * `b`: a quadratic) and the same piece lifted a little off it (`air`), so
 * every hop rises clear of its shadow. In tiles, from tile corners like the
 * input. Only for drawing: travel is priced by straight-line distance.
 */
export function tripHops(
  from: Pt,
  to: Pt,
  free: (p: Pt) => boolean,
): { stops: Pt[]; legs: { a: Pt; b: Pt; ground: Pt; air: Pt }[] } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return { stops: [{ ...from }], legs: [] }
  const n = Math.max(Math.abs(dx), Math.abs(dy))
  const hops = Math.min(5, Math.max(1, Math.round(n / 4)))
  /* Across the route, on the side facing up the map. */
  let nx = dy / len
  let ny = -dx / len
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx
    ny = -ny
  }
  /* The curve's control point: its middle stands off the line by a tenth of the trip. */
  const bow = 2 * Math.min(4, len * 0.1)
  const c = { x: (from.x + to.x) / 2 + nx * bow, y: (from.y + to.y) / 2 + ny * bow }
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * from.x + 2 * t * (1 - t) * c.x + t * t * to.x,
    y: (1 - t) * (1 - t) * from.y + 2 * t * (1 - t) * c.y + t * t * to.y,
  })

  const stops: { p: Pt; t: number }[] = [{ p: { ...from }, t: 0 }]
  const used = new Set([from.x + ',' + from.y, to.x + ',' + to.y])
  for (let k = 1; k < hops; k++) {
    const t = k / hops
    const ideal = at(t)
    /* The tile under the curve, then the ring around it, nearest first. */
    const near: (Pt & { d: number })[] = []
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const x = Math.round(ideal.x) + ox
        const y = Math.round(ideal.y) + oy
        near.push({ x, y, d: Math.hypot(x - ideal.x, y - ideal.y) })
      }
    }
    near.sort((p, q) => p.d - q.d)
    const pick = near.find((p) => !used.has(p.x + ',' + p.y) && free(p))
    if (!pick) continue
    used.add(pick.x + ',' + pick.y)
    stops.push({ p: { x: pick.x, y: pick.y }, t })
  }
  stops.push({ p: { ...to }, t: 1 })

  const legs = stops.slice(1).map(({ p: b, t: t1 }, i) => {
    const { p: a, t: t0 } = stops[i]
    /* The control point of the curve's piece between t0 and t1. */
    const w0 = (1 - t0) * (1 - t1)
    const w1 = t0 * (1 - t1) + t1 * (1 - t0)
    const w2 = t0 * t1
    const ground = { x: w0 * from.x + w1 * c.x + w2 * to.x, y: w0 * from.y + w1 * c.y + w2 * to.y }
    /* Lifted a little more for a longer hop, the way a flight climbs. */
    const lift = 2 * Math.min(0.9, Math.hypot(b.x - a.x, b.y - a.y) * 0.08)
    return { a, b, ground, air: { x: ground.x + nx * lift, y: ground.y + ny * lift } }
  })
  return { stops: stops.map((s) => s.p), legs }
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
