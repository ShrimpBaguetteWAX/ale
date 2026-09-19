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
 *   • Leveling — only fighters still below level 10, for a player who wants
 *     the runs to go to the ones that still gain from them.
 *   • Marker — only fighters carrying one of the markers the player chose.
 *     Any of them, not all: a fighter carries one marker, so "all" of two
 *     would always be nobody.
 */
export type AutoPickMode = 'suggested' | 'leveling' | 'marker'

export const AUTO_PICK_MODES: AutoPickMode[] = ['suggested', 'leveling', 'marker']

/** Leveling picks fighters below this level. */
export const LEVELING_BELOW = 10

export interface AutoPickPrefs {
  mode: AutoPickMode
  /** The markers Marker mode picks from. */
  markers: string[]
}

export const DEFAULT_PREFS: AutoPickPrefs = { mode: 'suggested', markers: [] }

/** Whether one fighter is in the pool for a mode. */
export function inPool(f: RosterFighter, prefs: AutoPickPrefs): boolean {
  if (prefs.mode === 'leveling') return Number(f.stats?.level ?? 0) < LEVELING_BELOW
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
  /** Available fighters still below level 10. */
  leveling: number
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
  for (const f of available) {
    if (f.marker) perMarker.set(f.marker, (perMarker.get(f.marker) ?? 0) + 1)
  }
  return {
    all: available.length,
    leveling: available.filter((f) => Number(f.stats?.level ?? 0) < LEVELING_BELOW).length,
    markers: (MARKERS as readonly string[])
      .filter((m) => perMarker.has(m))
      .map((marker) => ({ marker, count: perMarker.get(marker)! })),
  }
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
