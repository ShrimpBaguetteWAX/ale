import { describe, expect, it } from 'vitest'
import { hopStops, shortSpan } from '@/map/tileSteps'

describe('hopStops', () => {
  const anywhere = () => true
  const key = (p: { x: number; y: number }) => p.x + ',' + p.y
  const offLine = (from: { x: number; y: number }, to: { x: number; y: number }, p: { x: number; y: number }) =>
    Math.abs((to.x - from.x) * (p.y - from.y) - (to.y - from.y) * (p.x - from.x)) /
    Math.hypot(to.x - from.x, to.y - from.y)

  it('flies a short trip in one hop, no pads between', () => {
    expect(hopStops({ x: 0, y: 0 }, { x: 3, y: 1 }, anywhere)).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 1 },
    ])
  })

  it('sets pads along a longer trip, ends included, never more than three', () => {
    expect(hopStops({ x: 0, y: 0 }, { x: 15, y: 2 }, anywhere)).toHaveLength(4)
    expect(hopStops({ x: 0, y: 0 }, { x: 60, y: 10 }, anywhere)).toHaveLength(5)
  })

  it('wanders off the straight line, to both sides, the same way every time', () => {
    const from = { x: 2, y: 3 }
    const to = { x: 22, y: 9 }
    const stops = hopStops(from, to, anywhere)
    const pads = stops.slice(1, -1)
    expect(pads.some((p) => offLine(from, to, p) >= 1)).toBe(true)
    const sides = pads.map((p) => Math.sign((to.x - from.x) * (p.y - from.y) - (to.y - from.y) * (p.x - from.x)))
    expect(new Set(sides.filter(Boolean)).size).toBe(2)
    expect(hopStops(from, to, anywhere)).toEqual(stops)
  })

  it('lands only on free tiles, and leaves a pad out when there is none', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 15, y: 0 }
    const first = hopStops(from, to, anywhere)[1]
    const blocked = new Set([key(first)])
    const moved = hopStops(from, to, (p) => !blocked.has(key(p)))[1]
    expect(moved).not.toEqual(first)
    expect(Math.abs(moved.x - first.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(moved.y - first.y)).toBeLessThanOrEqual(1)
    expect(hopStops(from, to, () => false)).toEqual([from, to])
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
