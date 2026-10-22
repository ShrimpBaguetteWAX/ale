import { describe, expect, it } from 'vitest'
import { shortSpan, tileSteps } from '@/map/tileSteps'

describe('tileSteps', () => {
  it('crosses one tile per step along the longer axis, both ends included', () => {
    const steps = tileSteps({ x: 2, y: 10 }, { x: 15, y: 7 })
    expect(steps).toHaveLength(14)
    expect(steps[0]).toEqual({ x: 2, y: 10 })
    expect(steps[13]).toEqual({ x: 15, y: 7 })
    /* Every step moves to a neighbouring tile, never skips one. */
    for (let i = 1; i < steps.length; i++) {
      expect(Math.abs(steps[i].x - steps[i - 1].x)).toBeLessThanOrEqual(1)
      expect(Math.abs(steps[i].y - steps[i - 1].y)).toBeLessThanOrEqual(1)
    }
  })

  it('draws a trip west as the mirror of the same trip east', () => {
    const east = tileSteps({ x: 0, y: 0 }, { x: 4, y: -2 })
    const west = tileSteps({ x: 0, y: 0 }, { x: -4, y: -2 })
    /* `|| 0` folds the -0 that negating zero gives. */
    expect(west.map((p) => ({ x: -p.x || 0, y: p.y }))).toEqual(east)
  })

  it('is a single tile when there is nowhere to go', () => {
    expect(tileSteps({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual([{ x: 3, y: 3 }])
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
