import { describe, expect, it } from 'vitest'
import { keepUnlessBeaten } from '@/fight/autopick'

/**
 * Auto-pick replacing a team never leaves it winning fewer fights.
 *
 * The rate here is a sum of made-up worths, with a bonus for a pair that
 * works together — the thing a ranking of single fighters cannot see, and
 * the reason a press used to lower the bar.
 */

const worth: Record<number, number> = { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 11: 12, 12: 12, 13: 3, 14: 3, 15: 3 }
const together = (ids: number[]) => (ids.includes(1) && ids.includes(2) ? 30 : 0)
const rate = (ids: number[]) => ids.reduce((n, id) => n + (worth[id] ?? 0), 0) + together(ids)

const all = new Set(Object.keys(worth).map(Number))
const before = [1, 2, 3, 4, 5]
const pick = [11, 12, 13, 14, 15]

describe('keepUnlessBeaten', () => {
  it('keeps the team when the pick would win fewer fights', () => {
    const team = keepUnlessBeaten({ pick, before, allowed: all, teamSize: 5, rate })
    expect(rate(team)).toBeGreaterThanOrEqual(rate(before))
  })

  it('takes only the swaps that win more, and keeps the pair that works together', () => {
    const team = keepUnlessBeaten({ pick, before, allowed: all, teamSize: 5, rate })
    expect(team).toEqual(expect.arrayContaining([1, 2, 11, 12]))
    expect(team).not.toContain(13)
    expect(rate(team)).toBe(rate([1, 2, 11, 12, 3]))
  })

  it('leaves the team exactly as it was when no swap wins more', () => {
    const weak = [13, 14, 15]
    expect(keepUnlessBeaten({ pick: weak, before, allowed: all, teamSize: 5, rate })).toEqual(before)
  })

  it('replaces the fighters the mode does not allow, whatever they were worth', () => {
    const allowed = new Set([3, 4, 5, ...pick])
    const team = keepUnlessBeaten({ pick, before, allowed, teamSize: 5, rate })
    expect(team).not.toContain(1)
    expect(team).not.toContain(2)
    expect(team).toHaveLength(5)
  })

  it('returns the pick untouched when nothing of the team is allowed', () => {
    expect(keepUnlessBeaten({ pick, before, allowed: new Set(pick), teamSize: 5, rate })).toEqual(pick)
    expect(keepUnlessBeaten({ pick, before: [], allowed: all, teamSize: 5, rate })).toEqual(pick)
  })

  it('fills the slots a short team left empty', () => {
    const team = keepUnlessBeaten({ pick, before: [1, 2], allowed: all, teamSize: 5, rate })
    expect(team.slice(0, 2)).toEqual([1, 2])
    expect(team).toHaveLength(5)
  })
})
