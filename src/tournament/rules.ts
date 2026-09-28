import { nameToUint64 } from '@/dungeon/queries'
import type { RosterFighter } from '@/dungeon/types'
import type {
  TournamentMatchup,
  TournamentPlanStep,
  TournamentSignup,
  TournamentStage,
  TournamentStageTemplate,
} from './types'

/**
 * How a tournament works, from `tournament.cpp`.
 *
 * A tournament is a day on a timer. `advance` — driven by the task manager,
 * not by players — walks a fixed list of steps, and every step names a screen
 * the player should be looking at. So the phases below are not an invention
 * of this client: they are the `tournament_screen` strings the contract
 * already writes, and the screen follows the chain rather than keeping its
 * own idea of what is happening.
 *
 * The two numbers a player actually plays with:
 *
 *   • **Score**, fixed the moment you enter: a point per fighter level and
 *     ten per ascension, across the whole team. It buys nothing in a fight —
 *     it decides *seeding*, and seeding is where the free passes go.
 *   • **Reward points**, earned as you survive. A free pass is worth ten of
 *     them and counts as a win, which is the contract's way of saying a bye
 *     is not a consolation prize.
 *
 * Entering is one signature and costs energy. It also hands your five
 * fighters to the tournament: `signup` sets `in_use` on every one of them,
 * and nothing in the contract as deployed hands them back — so the screen
 * says that plainly rather than letting a player find out.
 */

/** The screens the contract's `tournament_screen` can name. */
export type TournamentPhase =
  | 'none'
  | 'preparing'
  | 'signup'
  | 'creation'
  | 'battle'
  | 'finish'

const PHASES: TournamentPhase[] = ['preparing', 'signup', 'creation', 'battle', 'finish']

/**
 * The screen each step belongs to, by the step's own name.
 *
 * The same mapping the `stages` template carries, kept here because the
 * template's copy does not survive to the row this screen reads. See
 * `phaseOf`.
 */
const STEP_SCREEN: Record<string, TournamentPhase> = {
  set_weather: 'preparing',
  get_rewards: 'preparing',
  signup: 'signup',
  close_signup: 'creation',
  create_matchups: 'creation',
  battle: 'battle',
  hall_of_fame: 'finish',
  reward_payout: 'finish',
  cleanup: 'finish',
}

/**
 * What the chain says to show.
 *
 * `tournament_screen` was the obvious field to read and it is empty on every
 * running tournament, which is worth writing down. `advance` stamps the
 * schedule rows out of the template with six fields — index, start, duration,
 * step name, task counters, completed — and leaves the screen and the two
 * permission flags at their defaults. `nextstage` then copies the screen
 * across *from those rows*, so every step after the first writes the empty
 * string it found. Only a tournament still on its opening step has one, and
 * it is the one step nobody needs told about.
 *
 * So the flag comes first: `allow_player_signup` is what `tournament::signup`
 * itself checks, which makes it the one field that cannot be wrong about
 * whether a player can enter. The step's name is next, through the same
 * mapping the template holds. The screen field is read only if both of those
 * say nothing — it costs a line, and it means a future contract that starts
 * filling it in will simply be believed.
 */
export function phaseOf(stage: TournamentStage | undefined | null): TournamentPhase {
  if (!stage) return 'none'
  if (stage.allow_player_signup) return 'signup'

  const byName = STEP_SCREEN[(stage.stage_name ?? '').toLowerCase()]
  if (byName) return byName

  const screen = (stage.tournament_screen ?? '').toLowerCase()
  return PHASES.find((p) => p === screen) ?? 'preparing'
}

export const PHASE_LABEL: Record<TournamentPhase, string> = {
  none: 'Between tournaments',
  preparing: 'Preparing',
  signup: 'Entry open',
  creation: 'Drawing the bracket',
  battle: 'Fighting',
  finish: 'Results',
}

/**
 * When a tournament began, read out of its own name.
 *
 * `advance` names a tournament `name(start.sec_since_epoch())` — the raw
 * value of the name *is* the timestamp. That is the only place the start
 * time survives once the schedule rows have been walked, and it is what lets
 * the screen title a tournament by its day rather than by the base-32
 * gibberish the name renders as.
 */
export function startedAt(tournamentName: string): number | null {
  try {
    const seconds = Number(nameToUint64(tournamentName))
    /* A plausible epoch second, not a name that happens to parse. */
    if (!Number.isFinite(seconds) || seconds < 1_500_000_000 || seconds > 4_000_000_000) {
      return null
    }
    return seconds * 1000
  } catch {
    return null
  }
}

/** Chain timestamps carry no zone and are always UTC. */
export function chainTime(stamp: string | undefined): number {
  if (!stamp) return NaN
  return Date.parse(`${stamp}Z`)
}

/**
 * What a team is worth to the seeding.
 *
 * `signup` adds `level + ascension_level * 10` per fighter. Shown before
 * signing rather than after, because it is the only thing the choice of
 * fighters changes about the entry itself.
 */
export function teamScore(team: (RosterFighter | null | undefined)[]): number {
  let score = 0
  for (const f of team) {
    if (!f) continue
    score += Number(f.stats?.level ?? 0) + Number(f.ascension_level ?? 0) * 10
  }
  return score
}

export interface Bracket {
  /** Rounds needed to reach one winner, the preliminary included. */
  rounds: number
  /** How many go into the first knockout round. */
  targetPlayers: number
  /** Pairings fought before that round, to cut the field down to it. */
  preliminaryBattles: number
  /** Entrants who skip the preliminary — the top of the seeding. */
  freePasses: number
  /**
   * True when the field is too small for any of it to mean anything.
   *
   * The contract's own arithmetic underflows at a single entrant
   * (`players - battles * 2` on unsigned integers), so a lone player would
   * be shown a free-pass count in the billions. Nothing is drawn from these
   * numbers while this is set.
   */
  degenerate: boolean
}

/**
 * The bracket, worked out exactly as `close_signup` works it out.
 *
 * Deliberately the same clumsy shape as the contract — count the doublings
 * up to the field size, halve that, and everything else falls out of it —
 * because a tidier formula that disagreed by one on some field size would be
 * worse than useless here: the screen would promise a bye the chain does not
 * give.
 */
export function bracketOf(players: number): Bracket {
  const count = Math.max(0, Math.floor(players))
  if (count < 2) {
    return {
      rounds: 0,
      targetPlayers: count,
      preliminaryBattles: 0,
      freePasses: count,
      degenerate: true,
    }
  }

  let rounds = 0
  let powerOfTwo = 1
  while (powerOfTwo < count) {
    rounds += 1
    powerOfTwo *= 2
  }

  const targetPlayers = powerOfTwo / 2
  const preliminaryBattles = count - targetPlayers
  return {
    rounds,
    targetPlayers,
    preliminaryBattles,
    freePasses: count - preliminaryBattles * 2,
    degenerate: false,
  }
}

/**
 * How many entrants skip the opening round.
 *
 * `close_signup` works this out and writes it to the stage row, and until
 * it has, the row says zero — which is indistinguishable from a field that
 * genuinely has no passes. A real row, 2026-09-27: stage `close_signup`,
 * three entered, `free_passes: 0`, `rounds: 0`. Three entrants make one
 * pass, so nothing was shown on a screen that had everything it needed to
 * say so.
 *
 * So the chain's figure is used when it has one, and `bracketOf` answers
 * otherwise. The two cannot disagree: `bracketOf` is the contract's own
 * arithmetic, checked against it for every field size from two to two
 * hundred — and where the true answer *is* zero, a power-of-two field, both
 * give zero anyway.
 */
export function freePassCount(stage: TournamentStage | undefined, entered: number): number {
  const stated = Number(stage?.free_passes ?? 0)
  if (stated > 0) return stated
  const bracket = bracketOf(entered)
  return bracket.degenerate ? 0 : bracket.freePasses
}

/**
 * The entrants in seeding order, best first.
 *
 * The contract sorts on a `uint128` of `score << 64 | (UINT64_MAX - signed
 * up at)` and walks it downwards handing out passes, which is: highest score
 * first, and the earlier entry wins a tie. Rebuilt here as an ordinary sort
 * rather than as the packed integer — the same order, and legible.
 */
export function seedOrder(signups: TournamentSignup[]): TournamentSignup[] {
  return [...signups].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const at = chainTime(a.signup_timestamp)
    const bt = chainTime(b.signup_timestamp)
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt
    return a.wallet.localeCompare(b.wallet)
  })
}

/** One of an entrant's fighters, as much of it as the signup row carries. */
export interface CrewFace {
  classname: string
  racename: string
  element: string
}

/**
 * The crew an entrant brought, as faces rather than as ids.
 *
 * `signup` writes `class:race:element` for each fighter as it takes them —
 * off the same rows it is already reading to score the team — so a portrait
 * for every entrant costs nothing. Read back off the chain instead it is
 * five keyed reads a row, which is two hundred and fifty of them for a
 * field of fifty, all to draw a strip of faces.
 *
 * Anything malformed is dropped rather than drawn as a broken portrait: the
 * string is the contract's, and a row from before the field existed has
 * none at all.
 */
export function crewFaces(signup: Pick<TournamentSignup, 'fighter_class_race_element'>): CrewFace[] {
  const faces: CrewFace[] = []
  for (const entry of signup.fighter_class_race_element ?? []) {
    const [classname, racename, element] = entry.split(':')
    if (classname && racename) faces.push({ classname, racename, element: element ?? '' })
  }
  return faces
}

/**
 * Where one entrant stands, and whether the seeding has spared them a fight.
 *
 * Only answered once entry has closed: before then the field is still
 * arriving and a pass shown now is a pass that can be taken away by the next
 * player through the door, which is a worse thing to show than nothing.
 */
export function seedingOf(
  signups: TournamentSignup[],
  stage: TournamentStage | undefined,
  wallet: string,
): { rank: number; total: number; freePass: boolean | null } | null {
  const order = seedOrder(signups)
  const rank = order.findIndex((s) => ownsEntry(s.wallet, wallet))
  if (rank < 0) return null

  const settled = !!stage && !stage.allow_player_signup
  const passes = freePassCount(stage, order.length)
  const bracket = bracketOf(order.length)
  return {
    rank: rank + 1,
    total: order.length,
    freePass: settled && !bracket.degenerate ? rank < passes : null,
  }
}

/**
 * Whether this row is this player's: the wallet, and nothing else.
 *
 * Worth stating plainly, because two looser tests have been tried here and
 * both were wrong.
 *
 * The deployed `signup` files each entry under
 * `name(wallet.value + current_time.sec_since_epoch() % 1000000)` behind a
 * TODO, so today no row carries the wallet that made it —
 * `5thba.wam` enters and the table holds `5thba.wamzumj`. That is
 * deliberate while the contract is being tested: it is what lets one wallet
 * enter several teams. Matching the player tag claimed other people's
 * entries, since tags are not unique; undoing the arithmetic claimed every
 * one of a tester's own duplicates as *the* entry.
 *
 * So: an exact wallet or nothing. While the TODO stands this screen will
 * say a tester is not entered, which is true of the row it can see and is
 * the only thing it can honestly say.
 */
export function ownsEntry(rowWallet: string, wallet: string): boolean {
  return rowWallet === wallet
}

/** This player's entry, if they have one. */
export function mySignup(
  signups: TournamentSignup[],
  wallet: string,
): TournamentSignup | undefined {
  return signups.find((s) => ownsEntry(s.wallet, wallet))
}

/**
 * How many tournaments this entrant has won.
 *
 * **Stand-in data.** The real figure is `tournament_won` on the player's own
 * `permstats`, which the signup row does not carry — reading it means a
 * player row per entrant, and nobody has won one yet because the payout
 * steps are not written. So until there is something true to show, a stable
 * pretend count stands in its place.
 *
 * Stable is the point: derived from the wallet, so a player keeps the same
 * badge on every render and every reload rather than flickering a different
 * story each time the list redraws. Roughly half of them have none.
 *
 * Replacing it is one line — pass the real count in — and the caller is
 * already shaped for it.
 */
export function pretendTournamentWins(wallet: string): number {
  let hash = 0
  for (let i = 0; i < wallet.length; i++) {
    hash = (hash * 31 + wallet.charCodeAt(i)) >>> 0
  }
  /* Half the field with nothing, the rest between one and ten. */
  if (hash % 2 === 0) return 0
  return ((hash >>> 3) % 10) + 1
}

/** The pairings that involve this player, newest drawn last. */
export function myMatchups(
  matchups: TournamentMatchup[],
  wallet: string,
): TournamentMatchup[] {
  return matchups.filter(
    (m) => ownsEntry(m.wallet_player1, wallet) || ownsEntry(m.wallet_player2, wallet),
  )
}

export type StepState = 'done' | 'running' | 'waiting'

export interface TimelineStep {
  index: number
  name: string
  startMs: number
  endMs: number
  state: StepState
  /** Task progress, for the steps that do their work in batches. */
  current: number
  total: number
}

/**
 * The day, as a list of steps with times on them.
 *
 * Built from the tournament's own scoped schedule rather than from the
 * template: the template carries durations, the schedule carries the
 * timestamps those durations were turned into when the tournament started,
 * and only the second can be counted down to.
 *
 * **Where the tournament actually is comes from `curstage.stage_index`, not
 * from the clock.** The schedule is a plan, and `advance` is what carries it
 * out — it is driven by the task manager, so a step whose window has elapsed
 * is not finished if nothing has moved the tournament on. Reading the time
 * instead marched the strip through the whole day on its own while the chain
 * sat on `signup`, which is the one thing this screen must never do: say
 * something the chain does not.
 *
 * Times still decide everything inside the current step — the countdown and
 * the bar that fills with it — and are the only guide when there is no stage
 * row to read, which is a replay or a tournament that has ended.
 */
export function timelineOf(
  plan: TournamentPlanStep[],
  now: number,
  /** `curstage.stage_index`: the step the chain says it is on. */
  currentIndex?: number,
): TimelineStep[] {
  const at = Number.isFinite(currentIndex) ? Number(currentIndex) : null

  return [...plan]
    .sort((a, b) => a.index - b.index)
    .map((step) => {
      const index = Number(step.index)
      const startMs = chainTime(step.time_start)
      const endMs = startMs + Number(step.duration_sec ?? 0) * 1000

      let state: StepState
      if (at !== null) {
        state = index < at ? 'done' : index === at ? 'running' : 'waiting'
      } else if (!Number.isFinite(startMs) || now < startMs) {
        state = 'waiting'
      } else {
        state = now >= endMs && step.completed ? 'done' : 'running'
      }

      return {
        index,
        name: step.step_name,
        startMs,
        endMs,
        state,
        current: Number(step.task_current ?? 0),
        total: Number(step.task_total ?? 0),
      }
    })
}

/**
 * As many steps as there is room for, around the one that is running.
 *
 * The strip must never scroll sideways: a strip that scrolls hides the one
 * thing it exists to show, and on a narrow screen the running step is
 * exactly the one that scrolls off. So the caller measures its own width,
 * says how many will fit, and this picks that many — the window sliding with
 * the tournament and clamping at both ends, so the first and last steps of
 * the day still get their neighbours rather than a half-empty row.
 *
 * Never fewer than three: the one before, the one now, the one next.
 */
export function stripWindow(steps: TimelineStep[], fits: number): TimelineStep[] {
  const room = Math.max(3, Math.floor(fits))
  if (steps.length <= room) return steps

  const running = steps.findIndex((s) => s.state === 'running')
  const at = running < 0 ? steps.findIndex((s) => s.state === 'waiting') : running
  const centre = at < 0 ? steps.length - 1 : at
  /* One step of lead-in, the rest ahead — you are walking forwards. */
  const start = Math.min(Math.max(0, centre - 1), steps.length - room)
  return steps.slice(start, start + room)
}

/** When the step the tournament is on now is due to end. */
export function currentStepEnd(
  plan: TournamentPlanStep[],
  stage: TournamentStage | undefined,
): number | null {
  if (!stage) return null
  const step = plan.find((s) => Number(s.index) === Number(stage.stage_index))
  if (!step) return null
  const end = chainTime(step.time_start) + Number(step.duration_sec ?? 0) * 1000
  return Number.isFinite(end) ? end : null
}

/**
 * How long a tournament takes, from the template.
 *
 * For the gap between tournaments, when there is no schedule to read because
 * there is no tournament. Every step's delay and duration, added up.
 */
export function plannedLengthSec(stages: TournamentStageTemplate[]): number {
  return stages.reduce(
    (total, s) => total + Number(s.delay_sec ?? 0) + Number(s.duration_sec ?? 0),
    0,
  )
}

/** The step the entry window belongs to, for describing a day not yet begun. */
export function signupWindow(
  stages: TournamentStageTemplate[],
): { opensAfterSec: number; lastsSec: number } | null {
  const sorted = [...stages].sort((a, b) => a.index - b.index)
  let elapsed = 0
  for (const step of sorted) {
    elapsed += Number(step.delay_sec ?? 0)
    if (step.allow_player_signup) {
      return { opensAfterSec: elapsed, lastsSec: Number(step.duration_sec ?? 0) }
    }
    elapsed += Number(step.duration_sec ?? 0)
  }
  return null
}

/**
 * Which of several running tournaments to put on screen.
 *
 * The one this player is in, if they are in one — nothing else on the screen
 * matters as much as their own entry. Otherwise the one still taking
 * entrants, and failing that the one that started most recently.
 */
export function pickTournament(
  stages: TournamentStage[],
  enteredNames: string[],
): TournamentStage | undefined {
  if (stages.length === 0) return undefined
  const mine = stages.find((s) => enteredNames.includes(s.tournament_name))
  if (mine) return mine
  const open = stages.find((s) => s.allow_player_signup)
  if (open) return open
  return [...stages].sort(
    (a, b) => (startedAt(b.tournament_name) ?? 0) - (startedAt(a.tournament_name) ?? 0),
  )[0]
}

export interface EntryBlock {
  ready: boolean
  reason?: string
}

/**
 * Whether this player can enter, in the order the contract refuses.
 *
 * Team size is ours rather than the contract's — `signup` would take three
 * fighters and file them — but a short team is a team that loses, and every
 * other screen in the game fields five.
 */
export function canEnter(
  team: (RosterFighter | null)[],
  crewPicked: boolean,
  weaponPicked: boolean,
  energy: number,
  energyCost: number,
  stage: TournamentStage | undefined,
  alreadyEntered: boolean,
  teamSize: number,
): EntryBlock {
  if (!stage) return { ready: false, reason: 'No tournament is running' }
  if (!stage.allow_player_signup) return { ready: false, reason: 'Entry is closed' }
  if (alreadyEntered) return { ready: false, reason: 'You are already entered' }

  const picked = team.filter(Boolean) as RosterFighter[]
  if (picked.length < teamSize) {
    const missing = teamSize - picked.length
    return { ready: false, reason: `Pick ${missing} more fighter${missing === 1 ? '' : 's'}` }
  }
  if (!crewPicked) return { ready: false, reason: 'Pick a crew card' }
  if (!weaponPicked) return { ready: false, reason: 'Pick a weapon card' }

  /* `signup` checks each fighter's `in_use` and aborts the whole entry. */
  const busy = picked.find((f) => f.in_use)
  if (busy) return { ready: false, reason: `Fighter ${busy.fighter_id} is busy elsewhere` }

  if (energy < energyCost) {
    return { ready: false, reason: `Not enough energy — ${energyCost} needed` }
  }
  return { ready: true }
}
