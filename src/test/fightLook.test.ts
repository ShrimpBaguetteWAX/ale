import { afterEach, describe, expect, it } from 'vitest'
import { fightLook } from '@/fight/fightLook'
import { arenaFor, fightStageFor, skyFor, stageFor } from '@/fight/stages'

/**
 * The fight's look and the ground it is fought on: the land look by
 * default, the switch back to the classic one, every dungeon fight on Veles'
 * Grass Coastline until other lands are drawn, and every arena fight in the
 * arena under the sky of the planet the player is on.
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
  it('is the land it is fought on, under the planet it is on', () => {
    const stage = stageFor('neri', 'Icy Desert')
    expect(stage.planet).toBe('neri')
    expect(stage.land).toBe('Icy Desert')
  })

  it('falls back to what it has a picture of, down to the Grass Coastline on Veles', () => {
    expect(stageFor().planet).toBe('veles')
    expect(stageFor().land).toBe('Grass Coastline')
    const unknownPlanet = stageFor('nowhere', 'Dunes')
    expect([unknownPlanet.planet, unknownPlanet.land]).toEqual(['veles', 'Dunes'])
    const unknownLand = stageFor('neri', 'Cheese Plains')
    expect([unknownLand.planet, unknownLand.land]).toEqual(['neri', 'Grass Coastline'])
  })

  it('has a picture of the ground for both shapes of field, one per planet where there is water', () => {
    for (const form of ['wide', 'tall'] as const) {
      expect(stageFor('magor', 'Sandy Coastline').ground[form].src).toContain(`ground-${form}-magor.webp`)
      expect(stageFor('magor', 'Dunes').ground[form].src).toContain(`ground-${form}.webp`)
      expect(stageFor('veles').backdrop[form].src).toContain('/planets/veles/backdrop-')
    }
  })

  it('moves only where there is water to move', () => {
    expect(stageFor('veles', 'Grass Coastline').foam).not.toBeNull()
    expect(stageFor('veles', 'Dunes').foam).toBeNull()
    expect(stageFor('veles', 'Inland River').glints).not.toBeNull()
  })
})

describe('the arena', () => {
  it('is where an arena fight is fought, and a dungeon fight stays on its land', () => {
    expect(fightStageFor('arena', 'neri').kind).toBe('arena')
    const dungeon = fightStageFor('dungeon', 'neri')
    expect(dungeon.kind).toBe('land')
    expect(dungeon.kind === 'land' && dungeon.land).toBe('Grass Coastline')
  })

  it('hangs the sky of the planet the player is on over the same bowl', () => {
    const naron = arenaFor('naron')
    const magor = arenaFor('Magor')
    expect(naron.sky.planet).toBe('naron')
    expect(naron.sky.motes).toBe('snow')
    expect(magor.sky.planet).toBe('magor')
    expect(magor.sky.side).toBe('r')
    expect(naron.bowl).toEqual(magor.bowl)
    expect(naron.sky.far.wide).toMatch(/stages\/skies\/naron\/far-wide/)
  })

  it("falls back to Veles' sky for a planet it does not know", () => {
    for (const planet of [undefined, '', 'pluto']) expect(skyFor(planet).planet).toBe('veles')
  })

  it('shows no giant planet over Eyeke', () => {
    expect(skyFor('eyeke').moons).toHaveLength(0)
  })
})
