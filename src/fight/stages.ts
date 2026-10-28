import { asset } from '@/assets'

/**
 * Where a fight is fought, as two halves: the planet behind the horizon and
 * the land the fighters stand on.
 *
 * A planet's backdrop is its sky, its sea and the far islands or ridges it is
 * known for; a land's stage is the ground in front, from the waterline to
 * the camera. Each half is a set of still images painted by
 * scripts/build-stages.cjs, plus the few pieces the page animates.
 *
 * Keyed so that a planet can carry several lands (`lands.ale` gives every
 * land its `land_type`), but there is one entry so far: every fight is on
 * a Grass Coastline on Veles, whatever land it is really on.
 */
export type StageForm = 'wide' | 'tall'

export interface Stage {
  /** For the label and for picking the CSS that colours the sky. */
  planet: string
  land: string
  /** The painted layers, per field shape. */
  far: Record<StageForm, string>
  shore: Record<StageForm, string>
  glints: Record<StageForm, string>
  foam: Record<StageForm, [string, string]>
  /** The turf laid on the floor plane, and the clumps that sway at its edges. */
  floor: string
  clump: string
  /** What a blow tears out of this ground. */
  blades: string
}

const veles = (file: string) => asset(`/assets/stages/veles/${file}.webp`)

const VELES_GRASS_COASTLINE: Stage = {
  planet: 'veles',
  land: 'Grass Coastline',
  far: { wide: veles('far-wide'), tall: veles('far-tall') },
  shore: { wide: veles('shore-wide'), tall: veles('shore-tall') },
  glints: { wide: veles('glints-wide'), tall: veles('glints-tall') },
  foam: {
    wide: [veles('foam-wide-a'), veles('foam-wide-b')],
    tall: [veles('foam-tall-a'), veles('foam-tall-b')],
  },
  floor: veles('grass'),
  clump: veles('clump'),
  blades: veles('blades'),
}

/** Every stage there is, by planet and then by the land's type. */
const STAGES: Record<string, Record<string, Stage>> = {
  veles: { 'Grass Coastline': VELES_GRASS_COASTLINE },
}

/**
 * The stage for a fight on `landType` on `planet`.
 *
 * For now every fight is fought on Veles' Grass Coastline: the one stage
 * that is drawn. Once others are, this looks the pair up and falls back to
 * the planet's first land, then to Veles.
 */
export function stageFor(planet?: string, landType?: string): Stage {
  const lands = (planet && STAGES[planet.toLowerCase()]) || undefined
  return (lands && landType && lands[landType]) || VELES_GRASS_COASTLINE
}
