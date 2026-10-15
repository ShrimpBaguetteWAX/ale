import { simulate, type Replay, type SimFighter } from '@/dungeon/sim'
import { fieldInRing, nftAsFighter, rollFighter, type Fielding } from '@/fight/odds'
import type { BattleFighter, FightRow, RosterFighter } from '@/dungeon/types'
import type { FlatFighter } from '@/fight/matchup'

/**
 * One side of a pairing, as the matchup row describes it.
 *
 * The five come off `fighters.ale` by the ids on the row; the sixth is the
 * crew card and the weapon fused, which is a fighter the chain never stores
 * — `getFighterFromNFT` builds it on the fly for the fight and so does this.
 */
export interface BoutSide {
  fighters: RosterFighter[]
  /** The crew-and-weapon fighter, where both halves were entered. */
  nft: FlatFighter | null
}

/**
 * Fight a tournament pairing from the row that describes it.
 *
 * The contract records who was drawn against whom, the ids they brought and
 * a seed — and nothing about what happened. `battle::fight`'s tournament
 * path rolls both sides off that seed and fights them with the same loop a
 * dungeon uses, so the same roll here reproduces the fight blow for blow:
 * a **model that agrees with the chain**, checked against every fight of a
 * real tournament (scripts/bout-check.ts), rather than footage.
 *
 * It stays right only while it walks the contract's path exactly. Three
 * things it has to match, and did not always:
 *
 *   • **One roll stream, not two.** The contract rolls side one's fighters
 *     ten positions apart and then carries on, so side two's first fighter
 *     starts at seed + 10 × (side one's count). Restarting side two at
 *     seed + 1 rolled every stat on it from different numbers, and a final
 *     the chain gave to player one played out for player two.
 *
 *   • **No building.** The contract fights a tournament on no land, so no
 *     building-gated ability fires; the simulator's default is a dungeon.
 *
 *   • **The crew card's target rule**, kept on the sixth fighter the way
 *     `getFighterFromNFT` keeps it.
 *
 * Two things differ from a dungeon:
 *
 *   • **Nobody is scaled down.** A dungeon cuts the far side by `difmod` and
 *     an arena by the tile's power; a tournament is two players, so both
 *     sides are fielded at their own levels with nothing taken off.
 *
 *   • **Every roll falls on both.** A dungeon stands on one land and is
 *     fought under its one weather; a tournament rolls per planet and all
 *     of them apply, to both sides alike, compounding in turn.
 */
export function simulateBout(
  seed: number,
  a: BoutSide,
  b: BoutSide,
  fielding: Fielding,
  tauntDeduction: number,
  now = Date.now(),
): Replay | null {
  const one = teamOf(a, seed, now)
  /* Side two picks up the stream where side one's fighters left it. */
  const two = teamOf(b, seed + 10 * a.fighters.length, now)
  if (!one.team.length || !two.team.length) return null

  /*
     The buffs land on the rolled numbers and only then are the two sides
     put in the ring — `fight()` does it in that order and says so, so a
     flat +400 health goes through the level curve with everything else.
  */
  const prepare = (team1: SimFighter[], team2: SimFighter[]) => {
    team1.forEach((f, i) => fieldInRing(f, one.ages[i], 0, fielding, now))
    team2.forEach((f, i) => fieldInRing(f, two.ages[i], 0, fielding, now))
  }

  const row: FightRow = {
    history_id: '',
    wallet: '',
    team1_fighters: one.team,
    team2_fighters: two.team,
    /* No recorded log: this is a fight being run, not one being replayed. */
    log: '',
    turns: 0,
    reward_power_added: [],
    reward_power_total: [],
    timestamp: '',
  }

  return simulate(row, {
    tauntDeduction,
    caps: fielding.caps,
    /* Not a dungeon and not an arena: the contract fights a tournament on
       no land, so no building-gated ability can fire. Named rather than
       left to the simulator's default, which is a dungeon. */
    building: 'tournament',
    prepare,
  })
}

/** The six a side, rolled off the seed in the order they were entered. */
function teamOf(
  side: BoutSide,
  seed: number,
  now: number,
): { team: BattleFighter[]; ages: (string | undefined)[] } {
  const team = side.fighters.map((f, slot) => rollFighter(f, seed, slot))
  const ages: (string | undefined)[] = side.fighters.map((f) => f.creation_date)

  if (side.nft) {
    /* `nftAsFighter` dates it now, so it is ageless by construction —
       there is no mint to be old relative to. */
    const sixth = nftAsFighter(side.nft, now)
    team.push(sixth)
    ages.push(sixth.creation_date)
  }

  return { team, ages }
}
