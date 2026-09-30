import { CONTRACTS } from '@/chain/config'
import { getAllRows, getRow } from '@/chain/client'
import { TTL } from '@/chain/cache'
import { nameToUint64 } from '@/dungeon/queries'
import type { RosterFighter } from '@/dungeon/types'
import type {
  TournamentConfig,
  TournamentMatchup,
  TournamentPayout,
  TournamentPlanStep,
  TournamentSignup,
  TournamentStage,
  TournamentStageTemplate,
  TournamentTracking,
} from './types'

/**
 * Reading `tournmnt.ale`.
 *
 * Six of these read the contract's own scope and two read a tournament's.
 * The split is the contract's, not a convention of ours, and getting it
 * wrong returns an empty list rather than an error — so every read that
 * needs a tournament takes its name as an argument and none of them guess.
 */

/** How often a tournament opens, and the energy a seat costs. */
export function fetchTournamentConfig(refresh = false): Promise<TournamentConfig | undefined> {
  return getRow<TournamentConfig>(
    { code: CONTRACTS.tournament, scope: CONTRACTS.tournament, table: 'config', key: 0 },
    { ttl: TTL.medium, refresh },
  )
}

/**
 * When the next tournament opens.
 *
 * Short-lived on purpose: this is the row a countdown is drawn from, and it
 * moves forward the moment `advance` starts one.
 */
export function fetchTournamentTracking(refresh = false): Promise<TournamentTracking | undefined> {
  return getRow<TournamentTracking>(
    { code: CONTRACTS.tournament, scope: CONTRACTS.tournament, table: 'tracking', key: 0 },
    { ttl: TTL.short, refresh },
  )
}

/**
 * The template every tournament is stamped out of.
 *
 * Effectively static — it changes when the team edits it — and it is what
 * lets the screen describe the shape of a day before one has started.
 */
export function fetchTournamentStages(refresh = false): Promise<TournamentStageTemplate[]> {
  return getAllRows<TournamentStageTemplate>(
    { code: CONTRACTS.tournament, scope: CONTRACTS.tournament, table: 'stages' },
    { ttl: TTL.medium, persist: true, refresh },
  )
}

/**
 * Every tournament currently running.
 *
 * A list rather than a row: `advance` starts one whenever the clock says so
 * and does not wait for the last to finish, so two can overlap.
 */
export function fetchLiveTournaments(refresh = false): Promise<TournamentStage[]> {
  return getAllRows<TournamentStage>(
    { code: CONTRACTS.tournament, scope: CONTRACTS.tournament, table: 'curstage' },
    { ttl: TTL.live, refresh },
  )
}

/** One tournament's whole schedule, start times and all. Scoped by its name. */
export function fetchTournamentPlan(
  tournamentName: string,
  refresh = false,
): Promise<TournamentPlanStep[]> {
  return getAllRows<TournamentPlanStep>(
    { code: CONTRACTS.tournament, scope: tournamentName, table: 'tournmnt' },
    { ttl: TTL.live, refresh },
  )
}

/** Everyone entered in one tournament. Scoped by its name. */
export function fetchTournamentSignups(
  tournamentName: string,
  refresh = false,
): Promise<TournamentSignup[]> {
  return getAllRows<TournamentSignup>(
    { code: CONTRACTS.tournament, scope: tournamentName, table: 'signups' },
    { ttl: TTL.live, refresh },
  )
}

/**
 * The pairings for one round of one tournament.
 *
 * Scoped per round, not per tournament: `create_matchups` writes into
 * `tournament_name.value + current_round`, so round 0 of a tournament and
 * round 1 of the tournament whose name is one greater would collide — they
 * do not in practice, because a name's value is astronomically larger than
 * a round number, but it does mean every round needs its own read and that
 * the scope is arithmetic rather than a name.
 *
 * `index` restarts at 0 in each round's scope, so a pairing is only
 * identified by round and index together.
 */
export function fetchTournamentMatchups(
  tournamentName: string,
  round: number,
  refresh = false,
): Promise<TournamentMatchup[]> {
  const scope = (nameToUint64(tournamentName) + BigInt(Math.max(0, Math.trunc(round)))).toString()
  return getAllRows<TournamentMatchup>(
    { code: CONTRACTS.tournament, scope, table: 'matchup' },
    { ttl: TTL.live, refresh },
  )
}

/** What each wallet is owed once the payout step has run. */
export function fetchTournamentPayouts(refresh = false): Promise<TournamentPayout[]> {
  return getAllRows<TournamentPayout>(
    { code: CONTRACTS.tournament, scope: CONTRACTS.tournament, table: 'payout' },
    { ttl: TTL.short, refresh },
  )
}

/**
 * The fighters behind an entry, by id.
 *
 * An entrant's row carries five ids and nothing else, and they belong to
 * somebody else — so the roster read, which is scoped by owner, is no use
 * here. One keyed read each, cached: an entry cannot change once it is in.
 */
export async function fetchFightersByIds(ids: number[]): Promise<RosterFighter[]> {
  const rows = await Promise.all(
    ids.map((id) =>
      getRow<RosterFighter>(
        { code: CONTRACTS.fighters, scope: CONTRACTS.fighters, table: 'fighters', key: id },
        { ttl: TTL.medium },
      ),
    ),
  )
  return rows.filter((r): r is RosterFighter => !!r)
}
