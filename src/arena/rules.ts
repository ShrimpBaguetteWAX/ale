import type { Land, Player } from '@/chain/types'
import type { BattleFighter, RosterFighter } from '@/dungeon/types'
import { TEAM_SIZE } from '@/dungeon/types'
import { fighterAvailable } from '@/dungeon/rules'
import type { LiveArenaRow } from './queries'

/**
 * The arena, from `arena.ale` and the `is_arena` branch of `battle.cpp`.
 *
 * Where a dungeon is a ladder the player picks a rung on, an arena is a fixed
 * team of other players' fighters holding one piece of land. There is no
 * difficulty to choose and no once-a-day limit; what varies is how hard the
 * defenders currently hit, and what a win costs you.
 */

/** `arena_power` at full strength. `apply_arenapow` divides by this. */
export const ARENA_POWER_FULL = 10_000

/** The floor `updarenachk` and `upddefense` refuse to go below. */
export const ARENA_POWER_FLOOR = 1_000

/** Power lost by the defenders each time a challenger loses. */
export const ARENA_POWER_PER_LOSS = 100

/** Power lost per minute, from `(seconds / 60) * 0.4`. */
export const ARENA_POWER_DECAY_PER_MINUTE = 0.4

/** The stand-in id for the NFT fighter a winner leaves behind. */
export const NFT_FIGHTER_ID = 99999999999

/** `arena_power` as a percentage, for display. */
export function arenaPowerPercent(power: number): number {
  return (power / ARENA_POWER_FULL) * 100
}

/**
 * The defenders as they will actually be fielded.
 *
 * `apply_arenapow` scales health, max health and damage — and nothing else,
 * so taunt, wind-up and cooldown are untouched. Each multiplication truncates
 * on its own, which is why this rounds down at every step rather than once at
 * the end.
 */
export function applyArenaPower(
  fighters: BattleFighter[],
  power: number,
): BattleFighter[] {
  return fighters.map((f) => ({
    ...f,
    health: Math.trunc((f.health * power) / ARENA_POWER_FULL),
    max_health: Math.trunc((f.max_health * power) / ARENA_POWER_FULL),
    damage: Math.trunc((f.damage * power) / ARENA_POWER_FULL),
  }))
}

/**
 * Whether the arena on this land can still be challenged.
 *
 * `battle.cpp` checks `buildings[0]` specifically — not any arena on the land
 * — and refuses when its name is not the building being used or its *stored*
 * boost score is zero: "This building has not been maintained for a while by
 * the land owner and cannot be used anymore". Mirrors that exactly rather
 * than reusing the map's decay-aware check, which answers a different
 * question.
 */
export function arenaMaintained(land: Land | undefined): boolean {
  if (!land) return false
  const first = land.buildings[0]
  if (!first || String(first.building_name) !== 'arena') return false
  return Number(first.boost_score ?? 0) > 0
}

/**
 * Whether the player already holds a place in this arena.
 *
 * `playarena` refuses outright — "You cannot play against your own fighters"
 * — if any defender belongs to the caller. Winning leaves one of your
 * fighters behind, so this is the normal state after a victory, not an edge
 * case.
 */
export function alreadyDefending(
  arena: LiveArenaRow | undefined,
  wallet: string,
): boolean {
  return !!arena?.fighters?.some((f) => f.owner === wallet)
}

/** Which of your own fighters are standing in this arena. */
export function myDefenders(
  arena: LiveArenaRow | undefined,
  wallet: string,
): BattleFighter[] {
  return (arena?.fighters ?? []).filter((f) => f.owner === wallet)
}

/** Everything that has to be true before the challenge button lights up. */
export interface ArenaBlock {
  ready: boolean
  reason?: string
}

export function canChallenge(
  team: (RosterFighter | null)[],
  crewPicked: boolean,
  weaponPicked: boolean,
  player: Player,
  energyCost: number,
  arena: LiveArenaRow | undefined,
  land: Land | undefined,
): ArenaBlock {
  if (!arenaMaintained(land)) {
    return { ready: false, reason: 'This arena is no longer maintained' }
  }
  if (!arena || arena.fighters.length === 0) {
    return { ready: false, reason: 'Nobody is holding this arena' }
  }
  if (alreadyDefending(arena, player.wallet)) {
    return { ready: false, reason: 'You already have a fighter in this arena' }
  }

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
