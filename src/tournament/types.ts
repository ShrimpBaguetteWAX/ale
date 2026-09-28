/**
 * The rows `tournmnt.ale` keeps, named as the ABI names them.
 *
 * Two of the eight tables are scoped by the tournament rather than by the
 * contract, which is the one thing worth knowing before reading any of this:
 * `tournmnt` (the schedule) and `signups` (the entrants) live under a scope
 * that *is* the tournament's name. Everything else sits under the contract.
 */

/** How often a tournament starts, and what a seat costs. */
export interface TournamentConfig {
  index: number
  tournament_every_sec: number
  energy_cost_signup: number
}

/** When the next one opens, and which are running now. */
export interface TournamentTracking {
  index: number
  /** Chain time, no zone — parsed as UTC. */
  next_tournament_start: string
  current_tournaments: string[]
}

/**
 * One step of the template every tournament is stamped out of.
 *
 * `index` is spaced in thousands so a step can be inserted between two
 * others without renumbering the rest.
 */
export interface TournamentStageTemplate {
  index: number
  delay_sec: number
  duration_sec: number
  step_name: string
  task_current: number
  task_total: number
  tournament_screen: string
  allow_player_signup: boolean
  allow_player_cancellation: boolean
}

/**
 * The same step, once a tournament has been stamped out and given it a time.
 *
 * Scope: the tournament's name. This is the only place the schedule exists —
 * `curstage` says which step is current, but not when any of them run.
 */
export interface TournamentPlanStep {
  index: number
  time_start: string
  duration_sec: number
  step_name: string
  task_current: number
  task_total: number
  completed: boolean
}

/** A planet's weather, rolled once for the whole tournament. */
export interface TournamentWeather {
  planet: string
  weather_id: string
}

/**
 * Where a running tournament has got to.
 *
 * One row per tournament, keyed by its name, and the name is not decorative:
 * the contract builds it from the start time, so `nameToUint64` of it is the
 * epoch second the tournament began. See `startedAt` in `rules.ts`.
 */
export interface TournamentStage {
  tournament_name: string
  stage_index: number
  stage_name: string
  weather_effects: TournamentWeather[]
  tournament_screen: string
  allow_player_signup: boolean
  allow_player_cancellation: boolean
  tlm_rewards: string
  wax_rewards: string
  player_count: number
  rounds: number
  free_passes: number
  score_id_lookup_min: string
  score_id_lookup_max: string
  battles_preliminary_round: number
  players_first_ko_round: number
  current_round: number
  matchups_created: number
  battles_in_round: number
  current_battle: number
  round_complete: boolean
}

/**
 * One entrant. Scope: the tournament's name.
 *
 * `score` is fixed at signup — a level and ten an ascension across the five
 * fighters — and is what the seeding reads. `battles_won` and `reward_points`
 * are filled in as the tournament runs, starting with the free passes handed
 * to the top of the table.
 */
export interface TournamentSignup {
  wallet: string
  playertag: string
  avatar: number
  fighter_ids: number[]
  /**
   * Each fighter as `class:race:element`, in the order of `fighter_ids`.
   *
   * Written by `signup` out of the fighter rows it is already reading to
   * score the team, so the field list can draw who an entrant brought
   * without reading any of them back. Optional here only because a row
   * written before the field existed does not carry it.
   */
  fighter_class_race_element?: string[]
  crew_asset_id: number
  arms_asset_id: number
  score: number
  battles_won: number
  reward_points: number
  signup_timestamp: string
  first_round_free_pass: boolean
}

/** A drawn pairing. `winner` is empty until it has been fought. */
export interface TournamentMatchup {
  index: number
  matchup_seed: number
  wallet_player1: string
  wallet_player2: string
  gamertag_player1: string
  gamertag_player2: string
  avatar_player1: number
  avatar_player2: number
  fighter_ids_player1: number[]
  fighter_ids_player2: number[]
  crew_asset_id_player1: number
  crew_asset_id_player2: number
  arms_asset_id_player1: number
  arms_asset_id_player2: number
  winner: string
}

/** What a wallet is owed once the payout step has run. */
export interface TournamentPayout {
  wallet: string
  reward_points: number
}
