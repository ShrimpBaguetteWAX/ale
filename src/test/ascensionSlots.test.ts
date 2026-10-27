import { describe, expect, it } from 'vitest'
import type { RosterFighter } from '@/dungeon/types'
import { coverableSlots } from '@/ascension/rules'

/**
 * The 1/3 on a fighter's Ascend button: how many of the three sacrifice slots
 * (element, race, the Sacrifice ability) the roster could fill, each from a
 * different fighter of the same class.
 */
let next = 1
const fighter = (element: string, racename: string, sacrifice = false, classname = 'mystic'): RosterFighter =>
  ({
    fighter_id: next++,
    classname,
    element,
    racename,
    in_use: 0,
    ascension_in_progress: 0,
    stats: { abilities: sacrifice ? [{ ability: 'sacrifice', displayname: 'Sacrifice' }] : [] },
  }) as unknown as RosterFighter

describe('sacrifice slots a roster can fill', () => {
  const target = fighter('air', 'lopati')

  it('counts nothing without another of the class', () => {
    expect(coverableSlots([target, fighter('air', 'lopati', true, 'juggernaut')], target)).toBe(0)
  })

  it('fills one slot only, however much one fighter matches', () => {
    expect(coverableSlots([target, fighter('air', 'lopati', true)], target)).toBe(1)
  })

  it('fills each slot from a different fighter', () => {
    const roster = [target, fighter('air', 'khaured'), fighter('fire', 'lopati'), fighter('gem', 'altan', true)]
    expect(coverableSlots(roster, target)).toBe(3)
  })

  it('finds the arrangement that fills the most', () => {
    /* The all-rounder has to take the ability slot for the other two to fit. */
    const roster = [target, fighter('air', 'lopati', true), fighter('air', 'khaured'), fighter('fire', 'lopati')]
    expect(coverableSlots(roster, target)).toBe(3)
  })

  it('leaves out fighters that are busy', () => {
    const busy = { ...fighter('air', 'khaured'), in_use: 1 } as RosterFighter
    expect(coverableSlots([target, busy], target)).toBe(0)
  })
})
