import { asset } from '@/assets'
import type { Venue } from '@/dungeon/fightStore'
import { LAND_STAGES, PLANET_STAGES, type LandStageSpec, type PlanetStage } from './landStages.generated'

/**
 * Where a fight is fought, as two halves: the planet behind the horizon and
 * the ground the fighters stand on.
 *
 * A planet's half is its sky and the country seen under it; the ground is
 * everything in front, from the far edge to the camera. Each half is a set
 * of still images painted by scripts/build-lands.cjs, plus the few pieces
 * the page animates.
 *
 * Two kinds of ground. A dungeon is fought on a land, keyed by planet and the
 * land's `land_type` (`lands.ale` gives every land one): the planet's baked
 * backdrop behind that land's ground. An arena is fought in the arena, the
 * same bowl on every planet, under the sky of the planet the player is on.
 */
export type StageForm = 'wide' | 'tall'

/** A planet's sky, as the arena hangs it over its rim. */
export interface Sky {
  planet: string
  /** Which side the sun is on: the shadows fall to the other. */
  side: 'l' | 'r'
  /** The sky's own colours, top to bottom, as a CSS gradient. */
  gradient: string
  /** [x %, y % of the sky, size % of the field's width, colour]. */
  sun: [number, number, number, string]
  /** The same for each moon, with a lit and a shaded colour. */
  moons: [number, number, number, string, string][]
  clouds: 'puff' | 'streak' | 'dust' | 'mist' | 'overcast'
  /** What drifts across the whole picture, if anything. */
  motes?: 'snow' | 'dust'
  /** The colour of its light ("r g b"), how strongly it tints the arena, and how much it darkens it. */
  tint: string
  tintStrength: number
  shade: number
  /** The colour of its clouds and haze ("r g b"). */
  cloud: string
  /** The strip of the planet's country seen over the rim. */
  far: Record<StageForm, string>
}

/**
 * A land's ground, with the planet it lies on behind it.
 *
 * Any land type under any planet: the planet is one baked picture of its sky,
 * sun and horizon (`sky`), the land is a floor, one picture of what lies on
 * it and the few pieces that move (`spec`). Where each is, and how much of the
 * field it covers, comes from scripts/build-lands.cjs.
 */
export interface GroundStage {
  kind: 'land'
  /** For the label and for picking the CSS that colours the sky. */
  planet: string
  land: string
  sky: PlanetStage
  spec: LandStageSpec
  /** The turf laid on the floor plane, and the clumps that sway at its edges. */
  floor: string
  clump?: string
  /** What a blow tears out of this ground. */
  blades: string
  /** The picture for each shape of field. */
  backdrop: Record<StageForm, { src: string; h: number }>
  ground: Record<StageForm, { src: string; top: number; h: number }>
  /** The land type is not known yet: draw nothing, rather than the wrong ground. */
  waiting?: boolean
  glints: Record<StageForm, { src: string; top: number; h: number }> | null
  foam: Record<StageForm, { a: string; b: string; top: number; h: number }> | null
}

/** The arena: the same bowl on every planet, under that planet's sky. */
export interface ArenaStage {
  kind: 'arena'
  sky: Sky
  /** The stands and the wall round the sand, and the markings on it. */
  bowl: Record<StageForm, string>
  marks: Record<StageForm, string>
  /** The sand, laid on the floor plane. */
  floor: string
}

export type Stage = GroundStage | ArenaStage

const GRASS_COAST = 'grass-coastline'
const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')

/**
 * The stage for a fight on `landType` on `planet`.
 *
 * A planet or a land type there is no picture of (or none given, as for a
 * fight watched from a link) falls back to Veles and its Grass Coastline.
 */
export function stageFor(planet?: string, landType?: string): GroundStage {
  const p = planet && PLANET_STAGES[planet.toLowerCase()] ? planet.toLowerCase() : 'veles'
  const key = landType && LAND_STAGES[slugOf(landType)] ? slugOf(landType) : GRASS_COAST
  const spec = LAND_STAGES[key]
  const dir = `/assets/stages/lands/${key}`
  const both = <T,>(make: (form: StageForm) => T): Record<StageForm, T> => ({ wide: make('wide'), tall: make('tall') })
  return {
    kind: 'land',
    planet: p,
    land: spec.name,
    sky: PLANET_STAGES[p],
    spec,
    floor: asset(`${dir}/floor.webp`),
    clump: spec.clump ? asset(`${dir}/${spec.clump}`) : undefined,
    blades: asset('/assets/stages/veles/blades.webp'),
    backdrop: both((form) => ({ src: asset(PLANET_STAGES[p].backdrop[form].src), h: PLANET_STAGES[p].backdrop[form].h })),
    ground: both((form) => ({
      src: asset(`${dir}/ground-${form}${spec.sea ? '-' + p : ''}.webp`),
      ...spec.ground[form],
    })),
    glints: spec.glints
      ? both((form) => ({ src: asset(`${dir}/glints-${form}.webp`), ...spec.glints![form] }))
      : null,
    foam: spec.foam
      ? both((form) => ({ a: asset(`${dir}/foam-${form}-a.webp`), b: asset(`${dir}/foam-${form}-b.webp`), ...spec.foam![form] }))
      : null,
  }
}

const far = (planet: string) => ({
  wide: asset(`/assets/stages/skies/${planet}/far-wide.webp`),
  tall: asset(`/assets/stages/skies/${planet}/far-tall.webp`),
})

/** Each planet's sky: its colours, its sun and moons, its weather, its light. */
const SKIES: Record<string, Sky> = {
  /* A tropical blue, a low sun on the left, a pale sister world; Veles' sea and green islands over the rim. */
  veles: {
    planet: 'veles',
    side: 'l',
    gradient: 'linear-gradient(180deg, #2b7aa6 0%, #4fa4c6 34%, #8fd2da 68%, #d4f1e6 92%, #f2ecd0 100%)',
    sun: [16, 56, 5.5, '#fff3c4'],
    moons: [[84, 50, 6.5, '#fbf2e4', '#8e8aa4']],
    clouds: 'puff',
    tint: '255 240 210',
    tintStrength: 0.16,
    shade: 0,
    cloud: '255 255 255',
    far: far('veles'),
  },
  /* A golden evening, a big sun low on the right, gilded streaks; Neri's forest bands over the rim. */
  neri: {
    planet: 'neri',
    side: 'r',
    gradient: 'linear-gradient(180deg, #34507a 0%, #7d6f8a 30%, #d59a62 66%, #f3c47e 88%, #f7e2ae 100%)',
    sun: [80, 58, 7, '#ffe6a6'],
    moons: [[22, 48, 3.2, '#f4ead8', '#b0a088']],
    clouds: 'streak',
    tint: '255 214 150',
    tintStrength: 0.24,
    shade: 0,
    cloud: '255 226 170',
    far: far('neri'),
  },
  /* Rust and dust: a smothered sun in a burnt-orange sky; red mesas and a dust storm over the rim. */
  magor: {
    planet: 'magor',
    side: 'r',
    gradient: 'linear-gradient(180deg, #3e1a14 0%, #7a2f1c 30%, #b8572a 62%, #de8a46 86%, #ecb070 100%)',
    sun: [66, 52, 4, '#ffe8c8'],
    moons: [[22, 50, 4.5, '#d8a080', '#5a3020']],
    clouds: 'dust',
    motes: 'dust',
    tint: '255 168 110',
    tintStrength: 0.3,
    shade: 0.05,
    cloud: '196 112 62',
    far: far('magor'),
  },
  /* Cold and clear: a white sun, a great pale moon, mist and a little snow; snowy ranges over the rim. */
  naron: {
    planet: 'naron',
    side: 'l',
    gradient: 'linear-gradient(180deg, #4f6f98 0%, #7f9cbf 32%, #b9cfe2 66%, #e2ecf3 90%, #f4f8fa 100%)',
    sun: [28, 54, 4.6, '#ffffff'],
    moons: [[76, 50, 9, '#eef2f6', '#98a6b8']],
    clouds: 'mist',
    motes: 'snow',
    tint: '220 236 255',
    tintStrength: 0.2,
    shade: 0,
    cloud: '245 250 255',
    far: far('naron'),
  },
  /* Overcast olive-grey, a weak sun and two moons; grey crags and needle spires over the rim. */
  kavian: {
    planet: 'kavian',
    side: 'l',
    gradient: 'linear-gradient(180deg, #262b27 0%, #3e4539 30%, #666c56 62%, #9a9a7c 88%, #b9b597 100%)',
    sun: [34, 56, 4, '#ece6c4'],
    moons: [
      [72, 48, 12, '#d4d8c4', '#6c7262'],
      [89, 44, 4, '#c0c4b0', '#5a604e'],
    ],
    clouds: 'overcast',
    tint: '200 210 170',
    tintStrength: 0.22,
    shade: 0.12,
    cloud: '118 126 108',
    far: far('kavian'),
  },
  /* Humid teal and green under a hazy sun; jungle canopy, palms and a teal sea over the rim. */
  eyeke: {
    planet: 'eyeke',
    side: 'l',
    gradient: 'linear-gradient(180deg, #0f3842 0%, #25666a 30%, #58a288 62%, #b4d9a4 88%, #dceec0 100%)',
    sun: [20, 54, 5, '#fff6cc'],
    moons: [],
    clouds: 'puff',
    tint: '214 255 204',
    tintStrength: 0.18,
    shade: 0,
    cloud: '236 255 236',
    far: far('eyeke'),
  },
}

/** The sky of `planet`, or Veles' for one with none drawn. */
export function skyFor(planet?: string): Sky {
  return (planet && SKIES[planet.toLowerCase()]) || SKIES.veles
}

const arena = (file: string) => asset(`/assets/stages/arena/${file}.webp`)

/** The arena, under the sky of `planet`. */
export function arenaFor(planet?: string): ArenaStage {
  return {
    kind: 'arena',
    sky: skyFor(planet),
    bowl: { wide: arena('bowl-wide'), tall: arena('bowl-tall') },
    marks: { wide: arena('marks-wide'), tall: arena('marks-tall') },
    floor: arena('sand'),
  }
}

/**
 * The stage for a fight at `venue`: the arena under the player's planet's
 * sky, or the land a dungeon is on.
 */
export function fightStageFor(venue: Venue, planet?: string, landType?: string): Stage {
  return venue === 'arena' ? arenaFor(planet) : stageFor(planet, landType)
}
