import { getRow } from '@/chain/client'
import { CONTRACTS } from '@/chain/config'
import { TTL } from '@/chain/cache'
import { addValue, capped, type StatCaps } from '@/dungeon/sim'

/**
 * The weather standing over a land, which every fight there is fought in.
 *
 * `apply_weather_and_age` runs before the first blow and before the level and
 * age scaling, so weather is the first thing that happens to a fighter and
 * everything else compounds on top of it. It is not decoration: of the 1,001
 * rolls on a planet, 862 are aimed at one class, race or element, which means
 * the usual case is a modifier that lands on one line-up harder than the
 * other. Facing a team of gem fighters under "-35% gem damage" is a different
 * fight from the one the raw numbers describe.
 *
 * It is chosen per land and re-rolled once a UTC day, by `rndweather` — which
 * runs on *travel*, not on fighting. A player standing on the land has
 * therefore already triggered the roll, so what `landtracking` says here is
 * what the fight will use.
 */

export interface WeatherEffect {
  /** `damage`, `health`, `taunt`, `initiative`, `attackspeed` or a `res_*`. */
  statname: string
  percent_change: number
  /** In the contract's tenths, like every other stat on the wire. */
  flat_change: number
}

export interface Weather {
  weather_id: string
  affected_class: string[]
  affected_element: string[]
  affected_race: string[]
  weather_effects: WeatherEffect[]
  displayname: string
  title: string
}

interface LandTracking {
  land_id: string
  weather_id: string
  last_change: string
}

/**
 * The weather on one land.
 *
 * Two reads, both keyed and both scoped by planet: which roll the land is
 * under, then what that roll does. Undefined when the land has never been
 * travelled to — `landtracking` only gains a row when somebody arrives.
 */
export async function fetchWeather(
  planet: string,
  land: string,
  refresh = false,
): Promise<Weather | undefined> {
  const tracking = await getRow<LandTracking>(
    { code: CONTRACTS.battle, scope: planet, table: 'landtracking', key: land },
    { ttl: TTL.short, refresh },
  )
  if (!tracking?.weather_id) return undefined

  return getRow<Weather>(
    {
      code: CONTRACTS.battle,
      scope: planet,
      table: 'weather',
      key: tracking.weather_id,
    },
    /* A weather row never changes; only which one a land points at does. */
    { ttl: TTL.long, persist: true },
  )
}

/** Who the weather can reach. */
export interface Weatherable {
  classname?: string
  racename?: string
  element?: string
}

/**
 * Whether this fighter is caught by the weather.
 *
 * Class, race and element are checked in that order and any one is enough —
 * and a roll that names none of the three catches everybody, which is the
 * contract's own reading of an empty target list rather than an assumption.
 */
export function weatherHits(weather: Weather, f: Weatherable): boolean {
  const { affected_class, affected_race, affected_element } = weather
  if (!affected_class.length && !affected_race.length && !affected_element.length) {
    return true
  }
  const has = (list: string[], value: string | undefined) =>
    !!value && list.some((v) => String(v).toLowerCase() === value.toLowerCase())

  return (
    has(affected_class, f.classname) ||
    has(affected_race, f.racename) ||
    has(affected_element, f.element)
  )
}

/** What the weather is aimed at, for the chips beside its name. */
export function weatherTargets(weather: Weather): string[] {
  return [
    ...weather.affected_class,
    ...weather.affected_race,
    ...weather.affected_element,
  ].map(String)
}

/**
 * Some rolls carry no effects at all, which is a real outcome and worth
 * saying plainly rather than drawing an empty panel around.
 */
export function weatherIsCalm(weather: Weather): boolean {
  return weather.weather_effects.length === 0
}

/**
 * How many of a line-up the weather reaches, and which way it pushes them.
 *
 * The direction is the sign of the effects taken together: a roll that only
 * subtracts is a penalty for whoever it catches, one that only adds is a gift,
 * and a mixed one is neither. Resistances count the same way as damage —
 * more is better — while `attackspeed` and `initiative` are wind-up, where a
 * larger number means a slower fighter, so their sign is read the other way
 * round.
 *
 * Taunt is left out of the sum entirely. It decides who a blow lands on, not
 * how the fight goes: more taunt makes a tank, and whether that is wanted
 * depends on the rest of the line-up. The fighter cards already refuse to put
 * an arrow on it for the same reason, and a panel that called "+25% taunt"
 * good would be the one place in the game claiming to know.
 */
export type WeatherLean = 'good' | 'bad' | 'mixed' | 'none'

/** Stats where a bigger number is a worse fighter. */
const INVERTED = new Set(['attackspeed', 'initiative'])

/** Stats that are a role rather than a quality. */
const NEUTRAL = new Set(['taunt'])

export function weatherLean(weather: Weather): WeatherLean {
  let up = 0
  let down = 0
  for (const e of weather.weather_effects) {
    if (NEUTRAL.has(e.statname)) continue
    const raw = e.percent_change + e.flat_change
    if (raw === 0) continue
    const helps = INVERTED.has(e.statname) ? raw < 0 : raw > 0
    if (helps) up++
    else down++
  }
  if (!up && !down) return 'none'
  if (up && down) return 'mixed'
  return up ? 'good' : 'bad'
}

/** One effect as a line a player can read. */
export function weatherEffectText(e: WeatherEffect): string {
  const parts: string[] = []
  if (e.percent_change) parts.push(`${e.percent_change > 0 ? '+' : ''}${e.percent_change}%`)
  /* Stats travel in tenths on the wire, as everywhere else in the game. */
  if (e.flat_change) {
    const flat = e.flat_change / 10
    parts.push(`${flat > 0 ? '+' : ''}${flat}`)
  }
  return parts.join(' and ') || 'no change'
}

/** Everything `apply_weather_and_age` can reach on a fighter. */
export interface WeatherableStats extends Weatherable {
  health: number
  max_health?: number
  damage: number
  taunt: number
  initiative: number
  attackspeed: number
  res_gem: number
  res_metal: number
  res_air: number
  res_fire: number
  res_nature: number
  res_neutral: number
}

/** The stats the contract actually branches on, and nothing else. */
const WEATHERED = new Set([
  'damage',
  'health',
  'taunt',
  'initiative',
  'attackspeed',
  'res_gem',
  'res_fire',
  'res_air',
  'res_metal',
  'res_neutral',
  'res_nature',
])

/**
 * A fighter as the weather leaves it, before level and age.
 *
 * The order is the contract's and it matters. `apply_weather_and_age` runs
 * weather *first* and then multiplies by `level_mod ^ level` and the age
 * decay, so a percentage from the sky compounds with the level curve rather
 * than being added to the end of it. Applying it the other way round would
 * be a different number on every fighter above level 1.
 *
 * Each effect is a percentage step and then a flat one, both capped, exactly
 * as the contract writes them:
 *
 *     stat = check_battle_caps(stat, stat * (100 + percent) / 100)
 *     stat = add_values(stat, flat, stat_name, true)
 *
 * Both lines run even when the figure in them is zero, which is not a
 * no-op — the cap check still fires, so a roll of "+0% damage" pulls a
 * fighter above the cap back down to it. Health drags `max_health` along
 * with it, because a fight where the bar starts fuller than it can ever be
 * refilled is not the fight the chain will run.
 *
 * A fighter the weather does not name comes back untouched, cap check and
 * all: the contract only enters this loop for the fighters it catches.
 */
export function applyWeather<T extends WeatherableStats>(
  fighter: T,
  weather: Weather | null | undefined,
  caps: StatCaps,
): T {
  if (!weather || !weather.weather_effects.length) return fighter
  if (!weatherHits(weather, fighter)) return fighter

  const out: T = { ...fighter }

  for (const e of weather.weather_effects) {
    if (!WEATHERED.has(e.statname)) continue
    const stat = e.statname as keyof WeatherableStats

    const step = (value: number): number =>
      addValue(
        capped(e.statname, Math.trunc((value * (100 + e.percent_change)) / 100), caps),
        e.flat_change,
        e.statname,
        caps,
      )

    const current = Number(out[stat] ?? 0)
    ;(out as Record<string, unknown>)[e.statname] = step(current)

    if (e.statname === 'health' && typeof out.max_health === 'number') {
      out.max_health = step(out.max_health)
    }
  }

  return out
}
