import { asset } from '@/assets'
/**
 * The map itself is the original planet artwork, so terrain no longer needs a
 * colour ramp. What still needs colour is rarity, which the art doesn't show
 * and the chain does.
 */
export const RARITY_COLOR: Record<string, string> = {
  '': '#3a4460',
  common: '#b9c2d6',
  uncommon: '#0ed4a8',
  rare: '#00baff',
  epic: '#9136bc',
  legendary: '#f6a800',
  mythical: '#ff3434',
}

export function rarityColor(rarity: string): string {
  return RARITY_COLOR[rarity] ?? RARITY_COLOR['']
}

/** Building name (from the chain) to its original icon. */
const BUILDING_ICONS: Record<string, string> = {
  tavern: 'tavern',
  arena: 'arena',
  dungeon: 'dungeon',
  market: 'market',
  mine: 'mine',
  portal: 'portal',
  'ascension-hall': 'ascension-hall',
  ascensionhall: 'ascension-hall',
  'training-center': 'training-center',
  trainingcenter: 'training-center',
}

export function buildingIcon(name: string): string {
  const key = BUILDING_ICONS[name?.toLowerCase()] ?? 'no-build'
  return asset(`/assets/buildings/${key}.webp`)
}

/** Planet artwork: 2000x1000, i.e. 50px per tile across the 40x20 grid. */
export const PLANET_MAP_W = 2000
export const PLANET_MAP_H = 1000
export const PLANET_TILE = 50

export function planetMapSrc(planet: string): string {
  return asset(`/assets/maps/${planet}.webp`)
}

/**
 * Inspector thumbnail for one land.
 *
 * The original ships a separate 50x50 JPEG per land (4,800 of them). Since
 * the planet image is already downloaded and every tile is a crop of it, the
 * thumbnail is just that image offset behind a window — no extra request, and
 * it works for any tile the moment the planet loads.
 */
export function landThumbStyle(
  planet: string,
  x: number,
  y: number,
  size = 64,
): React.CSSProperties {
  const k = size / PLANET_TILE
  return {
    backgroundImage: `url('${planetMapSrc(planet)}')`,
    backgroundSize: `${PLANET_MAP_W * k}px ${PLANET_MAP_H * k}px`,
    backgroundPosition: `-${(x - 1) * size}px -${(y - 1) * size}px`,
    width: size,
    height: size,
  }
}

/**
 * Map markers.
 *
 * The original ships vector markers for the things that sit on land, so the
 * map draws those rather than a generic dot. Only three building types exist
 * on chain today — tavern, dungeon and arena — plus the portal special
 * effect.
 */
export const MARKER_SRC = {
  tavern: asset('/assets/markers/tavern.svg'),
  dungeon: asset('/assets/markers/dungeons.svg'),
  arena: asset('/assets/markers/arena.svg'),
  portal: asset('/assets/old-markers/portal.svg'),
} as const

export type MarkerKey = keyof typeof MARKER_SRC

/**
 * The buildings standing on the map: the arena, dungeon and tavern drawn as
 * little painted buildings (scripts/buildings.mjs), each with a greyed copy
 * for a spent dungeon or an arena being defended. Portals are in PORTAL_SRC.
 */
export const BUILDING_SRC = {
  tavern: { lit: asset('/assets/markers/buildings/tavern.svg'), muted: asset('/assets/markers/buildings/tavern-muted.svg') },
  dungeon: { lit: asset('/assets/markers/buildings/dungeon.svg'), muted: asset('/assets/markers/buildings/dungeon-muted.svg') },
  arena: { lit: asset('/assets/markers/buildings/arena.svg'), muted: asset('/assets/markers/buildings/arena-muted.svg') },
} as const

/**
 * How a building sits on its tile, in the drawing's own units (100 across a
 * building): the square it is drawn in reaches 58 either side and 96 above
 * the ground, 116 in all; a building is about a tile across; and the ground
 * under it is a little below the tile's middle, so it stands on the tile
 * rather than floating over the one above.
 */
/**
 * The arena and the dungeon once per boost rank, 1 to 5: the arena's cloth
 * changes colour with the rank, and the hydra grows heads.
 */
const ranked = (kind: string) =>
  [1, 2, 3, 4, 5].map((rank) => ({
    lit: asset(`/assets/markers/buildings/${kind}-r${rank}.svg`),
    muted: asset(`/assets/markers/buildings/${kind}-r${rank}-muted.svg`),
  }))
export const RANKED_SRC = { arena: ranked('arena'), dungeon: ranked('dungeon') }

/** The portal as a round gate on a dais, one for each planet it leads to. */
export const PORTAL_SRC = Object.fromEntries(
  ['eyeke', 'kavian', 'magor', 'naron', 'neri', 'veles'].map((p) => [p, asset(`/assets/markers/buildings/portal-${p}.svg`)]),
) as Record<string, string>

export const BUILDING_VIEW = { half: 58, above: 96, size: 116 } as const
export const BUILDING_UNIT = 0.4 / 42
export const BUILDING_GROUND = 6 / 42

/** Chain `building_name` to its marker, if we have artwork for it. */
export function buildingMarker(name: string): MarkerKey | null {
  const key = name?.toLowerCase()
  if (key === 'tavern') return 'tavern'
  if (key === 'dungeon' || key === 'dungeons') return 'dungeon'
  if (key === 'arena') return 'arena'
  return null
}

/** The chain's own full-boost value: `maps::boost` refuses anything above it. */
export const BOOST_MAX = 1_000_000

/**
 * A building's boost, as a percentage.
 *
 * `boost_score` runs 0–1,000,000 and the contract reads it as hundredths of a
 * percent throughout: `boost` rejects a target over 1,000,000 with "Boost
 * Target cannot be above 100%", and its cost formula raises the modifier to
 * the power of `target / 10000 + 1` — a percentage plus one. So a new
 * building's 350,000 is 35 in the contract's own unit, which is what this
 * returns and what the bar widths and slider arithmetic run on.
 *
 * The screen does not show that unit. See `formatBoost`.
 *
 * The stored value is almost always stale: `maps.cpp` only rewrites it when
 * someone touches the land, and decays it by `boost_decay_per_hour` for every
 * whole hour since `boost_score_update`. Ageing it forward here shows the
 * value the contract would actually use right now.
 */
export function liveBoostScore(
  boostScore: number,
  boostScoreUpdate: string,
  decayPerHour: number,
  now = Date.now(),
): number {
  const updated = Date.parse(boostScoreUpdate + 'Z')
  let score = boostScore
  if (Number.isFinite(updated) && decayPerHour > 0) {
    const hours = Math.floor((now - updated) / 3_600_000)
    if (hours > 0) score = Math.max(0, score - hours * decayPerHour)
  }
  return score
}

export function liveBoostPercent(
  boostScore: number,
  boostScoreUpdate: string,
  decayPerHour: number,
  now = Date.now(),
): number {
  return liveBoostScore(boostScore, boostScoreUpdate, decayPerHour, now) / 10_000
}

/**
 * The boost below which a building is not worth walking to, and so is not
 * drawn on the map.
 *
 * In the contract's unit, which is the one `liveBoostPercent` returns: 1
 * is 0.1x on the screen. A building this far decayed pays nothing worth
 * the trip, and a marker for it is a promise the land cannot keep — the
 * tile still exists and the land card still says what is there, it is only
 * the map that stops pointing at it.
 *
 * Taverns and portals carry no boost and are never hidden by this.
 */
export const MIN_SHOWN_BOOST = 1

export function boostShown(percent: number): boolean {
  return percent >= MIN_SHOWN_BOOST
}

/**
 * A boost, written the way the game shows it: a multiplier, not a percentage.
 *
 * The contract counts in percent — full boost is 1,000,000, which `boost`
 * describes as 100% when it refuses to go past it — but what a player buys
 * reads as a multiplier, so the scale runs 0x to 10x and a building sitting on
 * 340,000 shows as 3.4x. Every other value here stays in the contract's unit;
 * this is the only place that converts, so a caller cannot show one screen in
 * percent and another in multiples.
 */
export function formatBoost(percent: number): string {
  return (percent / 10).toFixed(1) + 'x'
}

/**
 * A building's rank on the map, 1 to 5, by the boost the player is shown:
 * up to 2.0x, 4.0x, 6.0x, 8.0x, and above. Read off the rounded multiplier,
 * so the frame and the label under it can never disagree at a boundary.
 */
export function boostRank(percent: number): 1 | 2 | 3 | 4 | 5 {
  const shown = Math.round(percent) / 10
  if (shown <= 2) return 1
  if (shown <= 4) return 2
  if (shown <= 6) return 3
  if (shown <= 8) return 4
  return 5
}

/**
 * Whether a building is still usable.
 *
 * `maps.cpp` refuses to run any building whose boost has decayed to
 * `disable_building_boost_score` or below — "this building has been disabled
 * as it has not been maintained by the landowner" — so that threshold, not
 * the building's presence, decides whether a dungeon or arena is actually
 * open to players.
 */
export function isBuildingUnlocked(
  boostScore: number,
  boostScoreUpdate: string,
  decayPerHour: number,
  disableThreshold: number,
): boolean {
  return liveBoostScore(boostScore, boostScoreUpdate, decayPerHour) > disableThreshold
}
