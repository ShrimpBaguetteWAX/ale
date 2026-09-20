import { describe, expect, it } from 'vitest'
import {
  clampRange,
  DEFAULT_LEVELS,
  eligibleFighters,
  levelPool,
  markerPool,
  poolCounts,
  rangeLabel,
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

/** The settings a menu would hand over, with whatever is being tested changed. */
const prefs = (over: Partial<AutoPickPrefs> = {}): AutoPickPrefs => ({
  mode: 'suggested',
  markers: [],
  levels: DEFAULT_LEVELS,
  ...over,
})

describe('auto-pick modes', () => {
  it('Suggested keeps everyone', () => {
    expect(eligibleFighters(roster, prefs())).toHaveLength(roster.length)
  })

  it('Levels keeps fighters in the range, both ends included', () => {
    const at = (over: Partial<AutoPickPrefs>) => eligibleFighters(roster, prefs(over)).map((f) => f.stats.level)
    /* The default range is everything that still gains from a run. */
    expect(at({ mode: 'leveling' })).toEqual([4, 9, 1, 2])
    expect(at({ mode: 'leveling', levels: { min: 4, max: 9 } })).toEqual([4, 9])
    expect(at({ mode: 'leveling', levels: { min: 10, max: 10 } })).toEqual([10, 10])
    expect(at({ mode: 'leveling', levels: { min: 1, max: 10 } })).toHaveLength(roster.length)
  })

  it('reads a stored range that is missing, reversed or out of bounds', () => {
    expect(clampRange(undefined)).toEqual(DEFAULT_LEVELS)
    expect(clampRange({ min: 9, max: 2 })).toEqual({ min: 2, max: 9 })
    expect(clampRange({ min: 0, max: 99 })).toEqual({ min: 1, max: 10 })
  })

  it('names the range', () => {
    expect(rangeLabel({ min: 1, max: 9 })).toBe('Levels 1–9')
    expect(rangeLabel({ min: 7, max: 7 })).toBe('Level 7')
  })

  it('Marker keeps fighters carrying any of the chosen markers', () => {
    const chosen = prefs({ mode: 'marker', markers: ['fire', 'blue'] })
    expect(ids(eligibleFighters(roster, chosen))).toEqual(ids([roster[0], roster[1], roster[4]]))
  })

  it('Marker with nothing chosen keeps nobody', () => {
    expect(eligibleFighters(roster, prefs({ mode: 'marker' }))).toEqual([])
  })

  it('counts only fighters that can fight right now', () => {
    const counts = poolCounts(roster)
    expect(counts.all).toBe(5)
    /* Two at level 10, one each at 9, 4 and 1; the one on the market counts nowhere. */
    expect(counts.levels[10]).toBe(2)
    expect(counts.levels[2]).toBe(0)
    expect(levelPool(counts, DEFAULT_LEVELS)).toBe(3)
    expect(levelPool(counts, { min: 9, max: 10 })).toBe(3)
    expect(counts.markers).toEqual([
      { marker: 'black', count: 1 },
      { marker: 'blue', count: 1 },
      { marker: 'fire', count: 2 },
    ])
    expect(markerPool(counts, ['fire', 'black'])).toBe(3)
  })
})
