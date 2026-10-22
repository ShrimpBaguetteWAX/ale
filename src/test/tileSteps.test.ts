import { describe, expect, it } from 'vitest'
import { shortSpan, tripHops } from '@/map/tileSteps'

describe('tripHops', () => {
  const anywhere = () => true
  const key = (p: { x: number; y: number }) => p.x + ',' + p.y
  /* Which side of the straight line a point is on, and how far off it. */
  const across = (from: { x: number; y: number }, to: { x: number; y: number }, p: { x: number; y: number }) =>
    ((to.x - from.x) * (p.y - from.y) - (to.y - from.y) * (p.x - from.x)) / Math.hypot(to.x - from.x, to.y - from.y)

  it('flies a short trip in one hop, no pads between', () => {
    const { stops, legs } = tripHops({ x: 0, y: 0 }, { x: 3, y: 1 }, anywhere)
    expect(stops).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 1 },
    ])
    expect(legs).toHaveLength(1)
  })

  it('sets pads along a longer trip, ends included, never more than four', () => {
    expect(tripHops({ x: 0, y: 0 }, { x: 12, y: 2 }, anywhere).stops).toHaveLength(4)
    expect(tripHops({ x: 0, y: 0 }, { x: 60, y: 10 }, anywhere).stops).toHaveLength(6)
  })

  it('bends as one curve: every pad on the same side, up the map, no zig-zag', () => {
    const from = { x: 2, y: 3 }
    const to = { x: 22, y: 9 }
    const pads = tripHops(from, to, anywhere).stops.slice(1, -1)
    expect(pads).toHaveLength(4)
    /* Up the map is the negative side for a trip running east. */
    for (const p of pads) expect(across(from, to, p)).toBeLessThan(0)
    /* Furthest off the line in the middle, as on a curve. */
    const off = pads.map((p) => -across(from, to, p))
    expect(Math.max(off[1], off[2])).toBeGreaterThanOrEqual(Math.max(off[0], off[3]))
  })

  it('chains its legs end to end, each hop lifted clear of its shadow', () => {
    const { stops, legs } = tripHops({ x: 30, y: 2 }, { x: 4, y: 16 }, anywhere)
    expect(legs).toHaveLength(stops.length - 1)
    legs.forEach((l, i) => {
      expect(l.a).toEqual(stops[i])
      expect(l.b).toEqual(stops[i + 1])
      expect(Math.hypot(l.air.x - l.ground.x, l.air.y - l.ground.y)).toBeGreaterThan(0)
    })
  })

  it('lands only on free tiles, and leaves a pad out when there is none', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 15, y: 0 }
    const first = tripHops(from, to, anywhere).stops[1]
    const blocked = new Set([key(first)])
    const moved = tripHops(from, to, (p) => !blocked.has(key(p))).stops[1]
    expect(moved).not.toEqual(first)
    expect(Math.abs(moved.x - first.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(moved.y - first.y)).toBeLessThanOrEqual(1)
    expect(tripHops(from, to, () => false).stops).toEqual([from, to])
  })
})

describe('shortSpan', () => {
  it('says minutes, then hours and minutes, then days and hours', () => {
    expect(shortSpan(20_000)).toBe('1m')
    expect(shortSpan(12 * 60_000)).toBe('12m')
    expect(shortSpan((5 * 60 + 12) * 60_000)).toBe('5h 12m')
    expect(shortSpan((52 * 60 + 5) * 60_000)).toBe('2d 4h')
  })
})
