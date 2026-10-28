import { afterEach, describe, expect, it } from 'vitest'
import { fightLook } from '@/fight/fightLook'
import { stageFor } from '@/fight/stages'

/**
 * The fight's look and the ground it is fought on: the land look by
 * default, the switch back to the classic one, and every fight on Veles'
 * Grass Coastline until other stages are drawn.
 */
afterEach(() => localStorage.removeItem('fight-look'))

describe('the fight look', () => {
  it('plays on its ground by default', () => {
    expect(fightLook()).toBe('land')
  })

  it('goes back to the classic field when asked to, and ignores anything else', () => {
    localStorage.setItem('fight-look', 'classic')
    expect(fightLook()).toBe('classic')
    localStorage.setItem('fight-look', 'sideways')
    expect(fightLook()).toBe('land')
  })
})

describe('the stage', () => {
  it('is a Grass Coastline on Veles, wherever the fight is', () => {
    for (const [planet, land] of [
      ['veles', 'Grass Coastline'],
      ['veles', 'Tree Forest'],
      ['neri', 'Icy Desert'],
      [undefined, undefined],
    ] as const) {
      const stage = stageFor(planet, land)
      expect(stage.planet).toBe('veles')
      expect(stage.land).toBe('Grass Coastline')
    }
  })

  it('has a painted layer for both shapes of field', () => {
    const stage = stageFor()
    for (const form of ['wide', 'tall'] as const) {
      expect(stage.shore[form]).toMatch(/stages\/veles\/shore-/)
      expect(stage.far[form]).toMatch(/stages\/veles\/far-/)
      expect(stage.foam[form]).toHaveLength(2)
    }
  })
})
