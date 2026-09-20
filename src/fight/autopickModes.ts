import { fighterAvailable } from '@/dungeon/rules'
import { MARKERS } from '@/dungeon/filters'
import type { RosterFighter } from '@/dungeon/types'

/**
 * What auto-pick is allowed to pick from.
 *
 * The ranking never changes — fighters are ordered on how they stand against
 * this opponent's line-up, as `autoPickFighters` has always done. The mode
 * only narrows the pool first:
 *
 *   • Suggested — every available fighter.
 *   • Levels — only fighters in a level range the player sets, for someone
 *     who wants the runs to go to the ones that still gain from them, or
 *     who wants their strongest out for a hard opponent.
 *   • Marker — only fighters carrying one of the markers the player chose.
 *     Any of them, not all: a fighter carries one marker, so "all" of two
 *     would always be nobody.
 */
export type AutoPickMode = 'suggested' | 'leveling' | 'marker'

export const AUTO_PICK_MODES: AutoPickMode[] = ['suggested', 'leveling', 'marker']

/** Levels run 1 to 10, where 10 is Ascension. */
export const MIN_LEVEL = 1
export const MAX_LEVEL = 10

export interface LevelRange {
  min: number
  max: number
}

/** Everything that still gains from a run — what Levels mode used to be fixed at. */
export const DEFAULT_LEVELS: LevelRange = { min: MIN_LEVEL, max: MAX_LEVEL - 1 }

export interface AutoPickPrefs {
  mode: AutoPickMode
  /** The markers Marker mode picks from. */
  markers: string[]
  /** The levels Levels mode picks from, both ends included. */
  levels: LevelRange
}

export const DEFAULT_PREFS: AutoPickPrefs = { mode: 'suggested', markers: [], levels: DEFAULT_LEVELS }

const levelOf = (f: RosterFighter) => Number(f.stats?.level ?? 0)

/** A level range that can be used, whatever was stored or asked for. */
export function clampRange(range: Partial<LevelRange> | undefined): LevelRange {
  const inside = (v: unknown, fallback: number) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) ? Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, n)) : fallback
  }
  const min = inside(range?.min, DEFAULT_LEVELS.min)
  const max = inside(range?.max, DEFAULT_LEVELS.max)
  /* Ends the wrong way round are read as the range between them. */
  return { min: Math.min(min, max), max: Math.max(min, max) }
}

/** Whether one fighter is in the pool for a mode. */
export function inPool(f: RosterFighter, prefs: AutoPickPrefs): boolean {
  if (prefs.mode === 'leveling') {
    const { min, max } = clampRange(prefs.levels)
    return levelOf(f) >= min && levelOf(f) <= max
  }
  if (prefs.mode === 'marker') return !!f.marker && prefs.markers.includes(f.marker)
  return true
}

/** The fighters auto-pick may choose from, for these settings. */
export function eligibleFighters(roster: RosterFighter[], prefs: AutoPickPrefs): RosterFighter[] {
  return roster.filter((f) => inPool(f, prefs))
}

export interface PoolCounts {
  /** Available fighters in all, which Suggested picks from. */
  all: number
  /** Available fighters at each level, indexed by level — 0 is unused. */
  levels: number[]
  /** Available fighters per marker, for the markers this roster uses, in the game's marker order. */
  markers: { marker: string; count: number }[]
}

/**
 * How many fighters each mode would have to pick from.
 *
 * Counted among the fighters that can fight right now — one that is on the
 * market, in an arena or due for payday is never picked, so counting it
 * would promise a pool that is not there.
 */
export function poolCounts(roster: RosterFighter[]): PoolCounts {
  const available = roster.filter((f) => fighterAvailable(f).available)
  const perMarker = new Map<string, number>()
  const levels = Array<number>(MAX_LEVEL + 1).fill(0)
  for (const f of available) {
    if (f.marker) perMarker.set(f.marker, (perMarker.get(f.marker) ?? 0) + 1)
    const level = levelOf(f)
    if (level >= MIN_LEVEL && level <= MAX_LEVEL) levels[level] += 1
  }
  return {
    all: available.length,
    levels,
    markers: (MARKERS as readonly string[])
      .filter((m) => perMarker.has(m))
      .map((marker) => ({ marker, count: perMarker.get(marker)! })),
  }
}

/** How many available fighters a level range covers. */
export function levelPool(counts: PoolCounts, range: LevelRange): number {
  const { min, max } = clampRange(range)
  return counts.levels.slice(min, max + 1).reduce((n, c) => n + c, 0)
}

/** "Levels 1-9", or "Level 7" when the range is one level. */
export function rangeLabel(range: LevelRange): string {
  const { min, max } = clampRange(range)
  return min === max ? `Level ${min}` : `Levels ${min}–${max}`
}

/** How many available fighters the chosen markers cover together. */
export function markerPool(counts: PoolCounts, markers: string[]): number {
  return counts.markers.filter((m) => markers.includes(m.marker)).reduce((n, m) => n + m.count, 0)
}

/* ---------- remembered on this device ---------- */

const PREFS_KEY = 'al.autopick'

/** The last settings, shared by the dungeon and the arena. */
export function readAutoPickPrefs(): AutoPickPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null')
    if (!raw || !AUTO_PICK_MODES.includes(raw.mode)) return DEFAULT_PREFS
    return {
      mode: raw.mode,
      markers: Array.isArray(raw.markers) ? raw.markers.filter((m: unknown) => typeof m === 'string') : [],
      /* Saved before the range existed: the levels it used to mean. */
      levels: clampRange(raw.levels),
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function saveAutoPickPrefs(prefs: AutoPickPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* Private mode: the choice lasts until the page is left. */
  }
}
