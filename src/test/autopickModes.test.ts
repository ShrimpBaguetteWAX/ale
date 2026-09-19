import { describe, expect, it } from 'vitest'
import {
  eligibleFighters,
  markerPool,
  poolCounts,
  type AutoPickPrefs,
} from '@/fight/autopickModes'
import type { RosterFighter } from '@/dungeon/types'

let id = 0
const fighter = (level: number, marker = '', over: Partial<RosterFighter> = {}): RosterFighter =>
  ({
    fighter_id: ++id,
    marker,
    in_use: 0,
    use_type: '',
    next_payday: '2999-01-01T00:00:00',
    stats: { level },
    ...over,
  }) as unknown as RosterFighter

const roster = [
  fighter(10, 'fire'),
  fighter(4, 'fire'),
  fighter(9, 'black'),
  fighter(1),
  fighter(10, 'blue'),
  /* On the market: never picked, never counted. */
  fighter(2, 'black', { in_use: 1, use_type: 'Market' }),
]

const ids = (list: RosterFighter[]) => list.map((f) => f.fighter_id)

describe('auto-pick modes', () => {
  it('Suggested keeps everyone', () => {
    expect(eligibleFighters(roster, { mode: 'suggested', markers: [] })).toHaveLength(roster.length)
  })

  it('Leveling keeps only fighters below level 10', () => {
    const levels = eligibleFighters(roster, { mode: 'leveling', markers: [] }).map((f) => f.stats.level)
    expect(levels).toEqual([4, 9, 1, 2])
  })

  it('Marker keeps fighters carrying any of the chosen markers', () => {
    const prefs: AutoPickPrefs = { mode: 'marker', markers: ['fire', 'blue'] }
    expect(ids(eligibleFighters(roster, prefs))).toEqual(ids([roster[0], roster[1], roster[4]]))
  })

  it('Marker with nothing chosen keeps nobody', () => {
    expect(eligibleFighters(roster, { mode: 'marker', markers: [] })).toEqual([])
  })

  it('counts only fighters that can fight right now', () => {
    const counts = poolCounts(roster)
    expect(counts.all).toBe(5)
    expect(counts.leveling).toBe(3)
    expect(counts.markers).toEqual([
      { marker: 'black', count: 1 },
      { marker: 'blue', count: 1 },
      { marker: 'fire', count: 2 },
    ])
    expect(markerPool(counts, ['fire', 'black'])).toBe(3)
  })
})
