import type { RosterFighter } from './types'
import type { Matchup } from '@/fight/matchup'
import { fighterAvailable } from './rules'
import { ageBonus } from '@/fighters/rules'
import {
  STAT_SCALE,
  gradeOfStat,
  gradeRank,
  type ClassTemplate,
  type StatGrade,
} from '@/tavern/fighterStats'
import { asset } from '@/assets'

/**
 * Roster filtering and sorting, following the live site's model.
 *
 * A free-text box is the wrong tool here: a player picking a team is asking
 * structured questions — "which of my fire fighters are free right now, by
 * damage" — and answering those by typing guesses at substrings is worse than
 * not filtering at all. So the controls are the ones the original settled on:
 * element as a multi-select, class / race / status as pickers, and an explicit
 * sort. Ability text stays a search box because that genuinely is free text.
 */

export const ELEMENTS = ['gem', 'nature', 'metal', 'neutral', 'fire', 'air'] as const
export type Element = (typeof ELEMENTS)[number]

/**
 * Availability, as the original words it.
 *
 * `Requests Payday` is the contract's own condition read forwards: a fighter
 * is usable while `next_payday` is in the future, so once that date passes
 * they are asking to be paid and cannot be sent out.
 */
export const STATUSES = [
  'All',
  'Available',
  'Requests Payday',
  'Arena',
  'Market',
] as const
export type Status = (typeof STATUSES)[number]

/**
 * The markers a fighter can be pinned with, in the original's order.
 *
 * `fighters::setmarker` takes a free string, so this is a UI vocabulary
 * rather than a contract one — but keeping to it matters, because each name
 * has to resolve to `/assets/markers/<name>.svg` to be visible at all.
 *
 * The empty string is the first entry and means "no marker"; it is how the
 * picker offers clearing one.
 */
export const MARKERS = [
  '',
  'damage',
  'health',
  'attackspeed',
  'initiative',
  'taunt',
  'target',
  'red-duble-down',
  'red-down',
  'middle',
  'green-up',
  'green-duble-up',
  'gold-up',
  'white',
  'black',
  'blue',
  'yellow',
  'red',
  'credits',
  'gems',
  'energy',
  'dungeons',
  'arena',
  'tavern',
  'fire',
  'nature',
  'gem',
  'metal',
  'neutral',
  'air',
] as const

export function markerIcon(marker: string): string {
  return marker ? asset(`/assets/markers/${marker}.svg`) : asset('/assets/markers/empty-marker.svg')
}

export interface SortOption {
  value: string
  label: string
}

/**
 * Sorts, in the original's order. Health and damage are compared *after* age
 * decay, because that is the number the fighter will actually bring.
 */
export const SORTS: SortOption[] = [
  { value: 'level', label: 'Level' },
  { value: 'health_max', label: 'Health' },
  { value: 'damage_max', label: 'Damage' },
  { value: 'initiative_max', label: 'Windup' },
  { value: 'attackspeed_max', label: 'Cooldown' },
  { value: 'taunt_max', label: 'Taunt' },
  { value: 'res_fire', label: 'Fire resistance' },
  { value: 'res_air', label: 'Air resistance' },
  { value: 'res_metal', label: 'Metal resistance' },
  { value: 'res_gem', label: 'Gem resistance' },
  { value: 'res_nature', label: 'Nature resistance' },
  { value: 'res_neutral', label: 'Neutral resistance' },
]

/**
 * Sorts that only exist while there is an enemy team to compare against.
 *
 * Kept apart from `SORTS` because the roster screen has no opponent, and an
 * option that silently sorts by nothing is worse than one that is absent.
 */
export const VERSUS_SORTS: SortOption[] = [
  /*
     Not 'best'. The ranking has no idea about healing, targeting or turn
     order, and calling its answer the best one would claim a certainty it
     cannot back — the player would be right to be annoyed the first time a
     'best' pick lost to a healer.
  */
  { value: 'versus_score', label: 'Suggestions against this team' },
  { value: 'versus_offense', label: 'Damage lands' },
  { value: 'versus_defense', label: 'Damage blocked' },
  { value: 'versus_bonuses', label: 'Ability bonuses' },
]

/**
 * "At least this good on this stat."
 *
 * The one question a market makes you ask that a roster does not. Browsing
 * your own dozen fighters, the arrows on the card are enough; browsing
 * everybody's, the arrows are what you are shopping *for*, and reading them
 * one card at a time is not a search.
 *
 * Rules stack, and they stack as AND — "green damage and at least average
 * fire resistance" is a single buying decision, not two searches.
 */
export interface QualityRule {
  /** A field from `FILTER_STATS`. */
  stat: string
  /**
   * The floor, in whichever currency the stat deals in.
   *
   * A graded stat takes a `StatGrade` and passes at that grade or better. The
   * one ungraded stat, taunt, takes a number on the scale the card prints and
   * passes at that value or above. One rule type rather than two lists,
   * because to the player it is one question — "at least this much" — and the
   * only difference is what "this much" is measured in.
   */
  min: StatGrade | number
}

/**
 * Floors on how a fighter fares against the team it is about to face.
 *
 * Three separate questions, because they have three separate answers and a
 * player is usually asking only one of them: who can hurt these enemies, who
 * can survive them, and whose abilities actually fire against them. Zero means
 * the question is not being asked.
 */
export interface VersusFilter {
  /** Ability firings this enemy line hands the fighter, at least this many. */
  bonuses: number
  /** Percentage of damage that lands, at least this much. */
  offense: number
  /** Percentage of incoming damage turned away, at least this much. */
  defense: number
}

export const NO_VERSUS: VersusFilter = { bonuses: 0, offense: 0, defense: 0 }

export interface RosterFilter {
  elements: Element[]
  /**
   * Markers the player has pinned on fighters. Empty means "any", as with
   * elements — a marker is a private label, so this is the one filter whose
   * vocabulary the player writes themselves.
   */
  markers: string[]
  classname: string
  racename: string
  status: Status
  ability: string
  /** Stat-quality floors, ANDed. Empty means the grades are not filtered on. */
  qualities: QualityRule[]
  /** Matchup floors. Only meaningful on a screen that has an enemy team. */
  versus: VersusFilter
  sort: string
}

export const EMPTY_FILTER: RosterFilter = {
  elements: [],
  markers: [],
  classname: '',
  racename: '',
  status: 'All',
  ability: '',
  qualities: [],
  versus: NO_VERSUS,
  sort: 'level',
}

export function isFilterActive(f: RosterFilter): boolean {
  return (
    f.elements.length > 0 ||
    f.markers.length > 0 ||
    f.classname !== '' ||
    f.racename !== '' ||
    f.status !== 'All' ||
    f.ability !== '' ||
    (f.qualities?.length ?? 0) > 0 ||
    (f.versus?.bonuses ?? 0) > 0 ||
    (f.versus?.offense ?? 0) > 0 ||
    (f.versus?.defense ?? 0) > 0
  )
}

/**
 * A stat after age decay.
 *
 * `apply_weather_and_age` multiplies health and damage by
 * `age_decay ^ (days² )`, so an old fighter brings less than its stored range
 * suggests. The original applies the same curve when sorting, and sorting by
 * a number the fight will not use would be misleading.
 */
export function decayed(
  value: number,
  creationDate: string,
  ageDecay: number,
  now = Date.now(),
): number {
  if (!ageDecay) return value
  const created = Date.parse(creationDate + 'Z')
  if (!Number.isFinite(created)) return value
  const days = Math.floor((now - created) / 86_400_000)
  if (days <= 0) return value
  return Math.floor(Math.pow(ageDecay, days * days) * value)
}

const mid = (min: number, max: number) => (min + max) / 2

function matchesStatus(f: RosterFighter, status: Status, now: number): boolean {
  switch (status) {
    case 'All':
      return true
    case 'Available':
      return fighterAvailable(f, now).available
    case 'Requests Payday':
      return Date.parse(f.next_payday + 'Z') <= now
    case 'Arena':
      return !!f.in_use && f.use_type.toLowerCase() === 'arena'
    case 'Market':
      return !!f.in_use && f.use_type.toLowerCase() === 'market'
    default:
      return true
  }
}

export function applyFilter(
  roster: RosterFighter[],
  filter: RosterFilter,
  ageDecay: number,
  now = Date.now(),
  /*
     The class bands, needed only by the quality rules — a grade is a
     comparison against what the class can produce, so without these there is
     nothing to compare to. Optional so every existing caller is unaffected;
     when the rules are set and the bands are missing, nothing is filtered out
     rather than everything, because hiding the whole market while a lookup
     table loads is the worse failure.
  */
  templates?: Map<string, ClassTemplate>,
  /*
     How each fighter fares against the team on the other side, when there is
     one. Computed by the screen that knows the opponent, so this module stays
     free of battle maths; absent on the roster screen, where the versus
     filters and sorts are not offered either.
  */
  matchups?: Map<number, Matchup>,
): RosterFighter[] {
  const ability = filter.ability.trim().toLowerCase()

  const out = roster.filter((f) => {
    if (filter.elements.length && !filter.elements.includes(f.element as Element)) {
      return false
    }
    if (filter.markers?.length && !filter.markers.includes(f.marker ?? '')) return false
    if (filter.classname && f.classname !== filter.classname) return false
    if (filter.racename && f.racename !== filter.racename) return false
    if (!matchesStatus(f, filter.status, now)) return false
    if (filter.qualities?.length) {
      /*
         A graded rule needs the class band to compare against; an age or
         taunt rule does not. Gating the whole list on the templates would
         have made a perfectly answerable filter wait on a lookup table.
      */
      const template = templates?.get(f.classname)
      {
        const meets = filter.qualities.every((rule) => {
          if (typeof rule.min === 'number') {
            /*
               Age bonus is condition rather than a rolled stat, so it comes
               off the decay curve instead of out of a min/max band — and it
               is already the number the card prints, so it takes no scaling.
            */
            if (rule.stat === 'age') {
              return ageBonus(f, ageDecay, now) >= rule.min
            }
            /* Ungraded rolls: the midpoint, on the scale the card prints,
               because the number a player types is the number they are
               reading off a listing. */
            const raw = f.stats as unknown as Record<string, number>
            const value =
              mid(Number(raw[`${rule.stat}_min`] ?? 0), Number(raw[`${rule.stat}_max`] ?? 0)) /
              STAT_SCALE
            return value >= rule.min
          }
          /* No band, nothing to compare to — let it through rather than
             hiding the whole market while a lookup table loads. */
          if (!template) return true
          return (
            gradeRank(gradeOfStat(f.stats as never, rule.stat, template)) >=
            gradeRank(rule.min)
          )
        })
        if (!meets) return false
      }
    }
    /*
       A missing matchup is not a failure to match: it means the screen has no
       opponent loaded yet, and hiding the whole roster behind a table that is
       still arriving is the worse of the two wrong answers.
    */
    const versus = filter.versus
    if (versus && matchups) {
      const m = matchups.get(f.fighter_id)
      if (m) {
        if (versus.bonuses > 0 && m.bonuses < versus.bonuses) return false
        if (versus.offense > 0 && m.offense * 100 < versus.offense) return false
        if (versus.defense > 0 && m.defense * 100 < versus.defense) return false
      }
    }
    if (ability) {
      const hit = (f.stats.abilities ?? []).some(
        (a) =>
          a.ability.toLowerCase().includes(ability) ||
          (a.displayname ?? '').toLowerCase().includes(ability),
      )
      if (!hit) return false
    }
    return true
  })

  const value = (f: RosterFighter): number => {
    const s = f.stats
    switch (filter.sort) {
      case 'health_max':
        return decayed(mid(s.health_min, s.health_max), f.creation_date, ageDecay, now)
      case 'damage_max':
        return decayed(mid(s.damage_min, s.damage_max), f.creation_date, ageDecay, now)
      case 'taunt_max':
        return mid(s.taunt_min, s.taunt_max)
      // Windup and cooldown are delays, so the best fighter is the smallest.
      // Negated here so every sort can stay "biggest first".
      case 'initiative_max':
        return -mid(s.initiative_min, s.initiative_max)
      case 'attackspeed_max':
        return -mid(s.attackspeed_min, s.attackspeed_max)
      case 'versus_score':
        return matchups?.get(f.fighter_id)?.score ?? 0
      case 'versus_offense':
        return matchups?.get(f.fighter_id)?.offense ?? 0
      case 'versus_defense':
        return matchups?.get(f.fighter_id)?.defense ?? 0
      case 'versus_bonuses':
        return matchups?.get(f.fighter_id)?.bonuses ?? 0
      case 'level':
        return s.level
      default:
        return (s as unknown as Record<string, number>)[filter.sort] ?? 0
    }
  }

  return out.sort((a, b) => {
    // Usable fighters lead whatever the sort, because an unusable one is not
    // a candidate however good its numbers look.
    const av = fighterAvailable(a, now).available ? 0 : 1
    const bv = fighterAvailable(b, now).available ? 0 : 1
    return av - bv || value(b) - value(a) || a.fighter_id - b.fighter_id
  })
}

/** The distinct classes and races present in a roster, for the pickers. */
export function facetsOf(roster: RosterFighter[]): {
  classes: string[]
  races: string[]
} {
  const classes = new Set<string>()
  const races = new Set<string>()
  for (const f of roster) {
    if (f.classname) classes.add(f.classname)
    if (f.racename) races.add(f.racename)
  }
  return {
    classes: [...classes].sort(),
    races: [...races].sort(),
  }
}

/**
 * How many of the filters are doing something, for a collapsed filter bar.
 *
 * A hidden control that is still filtering is the worst kind: the grid is
 * short and nothing on screen says why. This is the number that goes on the
 * button that hides them, so the answer is always in view even when the
 * controls are not.
 */
export function countActiveFilters(f: RosterFilter): number {
  return (
    (f.elements.length > 0 ? 1 : 0) +
    (f.markers.length > 0 ? 1 : 0) +
    (f.classname !== '' ? 1 : 0) +
    (f.racename !== '' ? 1 : 0) +
    (f.status !== 'All' ? 1 : 0) +
    (f.ability !== '' ? 1 : 0) +
    ((f.qualities?.length ?? 0) > 0 ? 1 : 0) +
    ((f.versus?.bonuses ?? 0) > 0 ? 1 : 0) +
    ((f.versus?.offense ?? 0) > 0 ? 1 : 0) +
    ((f.versus?.defense ?? 0) > 0 ? 1 : 0)
  )
}
