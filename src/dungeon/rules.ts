import type { Land, Player } from '@/chain/types'
import { playedDungeonsToday } from '@/map/planetStatus'
import type { BattleFighter, RosterFighter } from './types'
import { TEAM_SIZE } from './types'

/**
 * How the enemy team scales with difficulty.
 *
 * Two multipliers stack, and they pull in opposite directions from the
 * rewards. `battle.ale`/`config.level_mod` raises health and damage by 15% a
 * level, compounding, while `difmod` holds the first few levels back to a
 * fraction of full power. Rewards meanwhile compound at only 7% a level, so
 * climbing pays less than it costs the deeper you go — the ladder has a top
 * even though the contract never names one.
 */
export const LEVEL_MOD = 1.15
/** Reward growth per level, from `pools.ale`/`config`. */
export const REWARD_MOD = 1.07

/**
 * Difficulties the screen offers. The contract accepts any `uint8`; this is a
 * presented range, not a contract limit.
 */
export const MAX_DIFFICULTY = 20
export const DIFFICULTIES = Array.from({ length: MAX_DIFFICULTY }, (_, i) => i + 1)

/**
 * The enemy's power at a difficulty, relative to its stored stats.
 *
 * `difMods` holds only the levels that are held back; anything missing runs
 * at full strength.
 */
export function powerAt(difficulty: number, difMods: Map<number, number>): number {
  const held = difMods.get(difficulty) ?? 100
  return Math.pow(LEVEL_MOD, difficulty) * (held / 100)
}

/** Reward multiplier at a difficulty, relative to difficulty zero. */
export function rewardAt(difficulty: number): number {
  return Math.pow(REWARD_MOD, difficulty)
}

/**
 * The enemy team as it will actually be fielded.
 *
 * Applies the same two steps the contract does, in the same order: the level
 * factor from `apply_weather_and_age`, then the `difmod` percentage from
 * `apply_dungdif`. Weather is deliberately left out — it depends on the
 * land's current roll and is surfaced beside the team rather than folded into
 * it, so a player can see the two influences apart.
 */
export function scaleEnemies(
  fighters: BattleFighter[],
  difficulty: number,
  difMods: Map<number, number>,
): BattleFighter[] {
  const level = Math.pow(LEVEL_MOD, difficulty)
  const held = (difMods.get(difficulty) ?? 100) / 100
  return fighters.map((f) => ({
    ...f,
    level: difficulty,
    health: Math.trunc(Math.trunc(f.health * level) * held),
    max_health: Math.trunc(Math.trunc(f.max_health * level) * held),
    damage: Math.trunc(Math.trunc(f.damage * level) * held),
  }))
}

/**
 * The stand-in the contract uses for a dungeon's own NFT fighter, which only
 * joins the enemy line-up from `dungeon_nft_fighter_min_difficulty` upward.
 */
export const NFT_FIGHTER_ID = 99999999999

/** The enemy line-up at a difficulty, before scaling. */
export function enemiesAt(
  fighters: BattleFighter[],
  difficulty: number,
  nftMinDifficulty: number,
): BattleFighter[] {
  return fighters.filter(
    (f) => difficulty >= nftMinDifficulty || f.fighter_id !== NFT_FIGHTER_ID,
  )
}

/* ---------- eligibility ---------- */

/**
 * Whether the dungeon on this land can still be entered.
 *
 * The contract refuses a run when the landowner has let the building's boost
 * score decay to nothing — "has not been maintained for a while" — so a
 * standing but dead dungeon is not an opportunity.
 */
export function dungeonMaintained(land: Land | undefined): boolean {
  if (!land) return false
  // The contract looks at `buildings[0]` specifically, not at any dungeon on
  // the land, and compares the *stored* boost score against zero rather than
  // ageing it forward — so this mirrors that rather than reusing the map's
  // decay-aware `isBuildingUnlocked`, which answers a different question.
  const first = land.buildings[0]
  if (!first || String(first.building_name) !== 'dungeon') return false
  return Number(first.boost_score ?? 0) > 0
}

/**
 * Whether the player has already run this dungeon today.
 *
 * Goes through `playedDungeonsToday` rather than reading `played_dungeons`
 * directly, because that list is only meaningful alongside
 * `last_dungeon_reset` — a stale list from a previous day still holds
 * yesterday's land ids until the next run clears it.
 */
export function playedHere(player: Player, planet: string, land: string): boolean {
  return playedDungeonsToday(player).has(`${planet}.${land}`)
}

/**
 * Whether a roster fighter can be sent into a fight right now.
 *
 * `next_payday` reads backwards from expectation: the contract requires it to
 * be in the *future*, so a fighter becomes unavailable once the date passes
 * and they start asking to be paid.
 */
export interface Availability {
  available: boolean
  reason?: string
}

export function fighterAvailable(f: RosterFighter, now = Date.now()): Availability {
  if (f.in_use) {
    return { available: false, reason: f.use_type ? `Busy: ${f.use_type}` : 'Busy' }
  }
  const payday = Date.parse(f.next_payday + 'Z')
  if (Number.isFinite(payday) && payday < now) {
    return { available: false, reason: 'Wants a payday' }
  }
  return { available: true }
}

/** Everything that has to be true before the Start Fight button lights up. */
export interface RunBlock {
  ready: boolean
  reason?: string
}

export function canRun(
  team: (RosterFighter | null)[],
  /* Card *designs*, not assets: a concrete asset id is only resolved when the
     run is signed, so all that matters here is that something is chosen. */
  crewPicked: boolean,
  weaponPicked: boolean,
  player: Player,
  energyCost: number,
): RunBlock {
  const picked = team.filter(Boolean) as RosterFighter[]
  if (picked.length < TEAM_SIZE) {
    const missing = TEAM_SIZE - picked.length
    return {
      ready: false,
      reason: `Pick ${missing} more fighter${missing === 1 ? '' : 's'}`,
    }
  }
  if (!crewPicked) return { ready: false, reason: 'Pick a crew card' }
  if (!weaponPicked) return { ready: false, reason: 'Pick a weapon card' }

  const busy = picked.find((f) => !fighterAvailable(f).available)
  if (busy) {
    return { ready: false, reason: `Fighter ${busy.fighter_id} is not available` }
  }
  if (player.activestats.action_points < energyCost) {
    return { ready: false, reason: `Needs ${energyCost} energy` }
  }
  return { ready: true }
}

/** XP a win pays, from `battle.ale`/`config.xp_per_dungeon_difficulty`. */
export function xpFor(difficulty: number, xpPerDifficulty: number): number {
  return xpPerDifficulty * difficulty
}

/** Total health across a team, for the rough strength comparison. */
export function teamHealth(fighters: { health: number }[]): number {
  return fighters.reduce((sum, f) => sum + f.health, 0)
}

/** Total damage across a team. */
export function teamDamage(fighters: { damage: number }[]): number {
  return fighters.reduce((sum, f) => sum + f.damage, 0)
}
