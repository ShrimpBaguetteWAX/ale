import { describe, expect, it } from 'vitest'
import { LAND_STAGES, PLANET_STAGES } from '@/fight/landStages.generated'
import { stageFor } from '@/fight/stages'

/**
 * Every land type `lands.ale` gives a land (20 of them, across the six
 * planets) has a stage, and every picture the registry names is there. The
 * pictures are baked by scripts/build-lands.cjs; this is what catches a land
 * type added to the chain, or a bake that did not finish.
 */
const LAND_TYPES = [
  'Grass Coastline', 'Sandy Coastline', 'Rocky Coastline', 'Small Island',
  'Grassland', 'Plains', 'Tree Forest', 'Mushroom Forest', 'Inland River',
  'Mountains', 'Icy Mountains', 'Rocky Desert', 'Rocky Crater',
  'Dunes', 'Icy Desert', 'Sandy Desert',
  'Active Volcano', 'Dormant Volcano', 'Geothermal Springs', 'Methane Swampland',
]
const PLANETS = ['veles', 'neri', 'magor', 'naron', 'kavian', 'eyeke']
const FORMS = ['wide', 'tall'] as const
/* The pictures that are there, as the build sees them. */
const files = new Set(Object.keys(import.meta.glob('/public/assets/stages/**/*.webp')))
const has = (url: string) => files.has('/public' + url)

describe('the land stages', () => {
  it('has a stage for every land type, under every planet', () => {
    for (const land of LAND_TYPES) {
      for (const planet of PLANETS) {
        const stage = stageFor(planet, land)
        expect([stage.planet, stage.land]).toEqual([planet, land])
      }
    }
  })

  it('has every picture the registry names', () => {
    for (const planet of PLANETS) {
      for (const form of FORMS) expect(has(PLANET_STAGES[planet].backdrop[form].src), `${planet} ${form}`).toBe(true)
    }
    for (const spec of Object.values(LAND_STAGES)) {
      const dir = `/assets/stages/lands/${spec.slug}`
      expect(has(`${dir}/floor.webp`), `${spec.slug} floor`).toBe(true)
      for (const form of FORMS) {
        /* water has one ground per planet, the planet's light baked in */
        for (const planet of spec.sea ? PLANETS : [undefined]) {
          const name = `ground-${form}${planet ? '-' + planet : ''}.webp`
          expect(has(`${dir}/${name}`), `${spec.slug} ${name}`).toBe(true)
        }
        if (spec.glints) expect(has(`${dir}/glints-${form}.webp`), `${spec.slug} glints`).toBe(true)
        if (spec.foam) {
          expect(has(`${dir}/foam-${form}-a.webp`), `${spec.slug} foam a`).toBe(true)
          expect(has(`${dir}/foam-${form}-b.webp`), `${spec.slug} foam b`).toBe(true)
        }
      }
    }
  })

  it('covers a plausible part of the field with each picture', () => {
    for (const spec of Object.values(LAND_STAGES)) {
      for (const form of FORMS) {
        const g = spec.ground[form]
        expect(g.top).toBeGreaterThanOrEqual(0)
        expect(g.top + g.h).toBeCloseTo(100, 0)
        /* nothing paints the sky's upper third: that is the backdrop's */
        expect(g.top).toBeGreaterThan(2)
      }
    }
  })
})
