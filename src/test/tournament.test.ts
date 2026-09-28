import { describe, expect, it } from 'vitest'
import {
  bracketOf,
  freePassCount,
  canEnter,
  mySignup,
  ownsEntry,
  phaseOf,
  pickTournament,
  plannedLengthSec,
  seedOrder,
  seedingOf,
  signupWindow,
  startedAt,
  teamScore,
  stripWindow,
  timelineOf,
} from '@/tournament/rules'
import type {
  TournamentPlanStep,
  TournamentSignup,
  TournamentStage,
  TournamentStageTemplate,
} from '@/tournament/types'
import type { RosterFighter } from '@/dungeon/types'

/**
 * The tournament, checked against the contract rather than against itself.
 *
 * Two of these are the whole point of the file. `bracketOf` has to agree with
 * `close_signup` on every field size, because the screen uses it to tell a
 * player whether the seeding has spared them a fight — and a bracket that is
 * right for sixteen entrants and wrong for seventeen would only ever be
 * caught by the player it lied to. And `startedAt` has to read a tournament's
 * name back as the timestamp it was built from, since that name is the only
 * record of when a tournament began once its schedule has been walked.
 */

/* The contract's own arithmetic, transcribed, to check ours against. */
function contractBracket(players: number) {
  let rounds = 0
  let powerOfTwo = 1
  while (powerOfTwo < players) {
    rounds += 1
    powerOfTwo *= 2
  }
  const target = powerOfTwo / 2
  const battles = players - target
  return { rounds, target, battles, passes: players - battles * 2 }
}

/* `name(uint64)` the way eosio renders it, to build a tournament's name. */
const NAME_CHARS = '.12345abcdefghijklmnopqrstuvwxyz'
function nameOf(value: number): string {
  let v = BigInt(value)
  const out: string[] = []
  for (let i = 0; i <= 12; i++) {
    const bits = i === 12 ? 0x0fn : 0x1fn
    const shift = BigInt(i === 12 ? 0 : 64 - 5 * (i + 1))
    out.push(NAME_CHARS[Number((v >> shift) & bits)])
  }
  v = 0n
  return out.join('').replace(/\.+$/, '')
}

const stage = (over: Partial<TournamentStage> = {}): TournamentStage =>
  ({
    tournament_name: nameOf(1_790_000_000),
    stage_index: 3000,
    stage_name: 'signup',
    weather_effects: [],
    tournament_screen: 'signup',
    allow_player_signup: true,
    allow_player_cancellation: true,
    tlm_rewards: '0.0000 TLM',
    wax_rewards: '0.00000000 WAX',
    player_count: 0,
    rounds: 0,
    free_passes: 0,
    score_id_lookup_min: '0',
    score_id_lookup_max: '0',
    battles_preliminary_round: 0,
    players_first_ko_round: 0,
    current_round: 0,
    matchups_created: 0,
    battles_in_round: 0,
    current_battle: 0,
    round_complete: false,
    ...over,
  }) as TournamentStage

const entrant = (over: Partial<TournamentSignup>): TournamentSignup =>
  ({
    wallet: 'someone.wam',
    playertag: 'Someone',
    avatar: 1,
    fighter_ids: [1, 2, 3, 4, 5],
    crew_asset_id: 0,
    arms_asset_id: 0,
    score: 0,
    battles_won: 0,
    reward_points: 0,
    signup_timestamp: '2026-09-27T12:00:00',
    first_round_free_pass: false,
    ...over,
  }) as TournamentSignup

const fighter = (level: number, ascension = 0, busy = false): RosterFighter =>
  ({
    fighter_id: level * 100 + ascension,
    stats: { level },
    ascension_level: ascension,
    in_use: busy ? 1 : 0,
    creation_date: '2026-09-01T00:00:00',
  }) as unknown as RosterFighter

describe('the bracket', () => {
  it('matches close_signup for every field size it can see', () => {
    for (let players = 2; players <= 200; players++) {
      const theirs = contractBracket(players)
      const ours = bracketOf(players)
      expect({ players, ...ours }).toEqual({
        players,
        rounds: theirs.rounds,
        targetPlayers: theirs.target,
        preliminaryBattles: theirs.battles,
        freePasses: theirs.passes,
        degenerate: false,
      })
    }
  })

  it('reads a power of two as a clean bracket with no opening round', () => {
    const b = bracketOf(16)
    expect(b.rounds).toBe(4)
    expect(b.targetPlayers).toBe(8)
    expect(b.preliminaryBattles).toBe(8)
    expect(b.freePasses).toBe(0)
  })

  it('gives everyone above the cut a pass when the field is ragged', () => {
    const b = bracketOf(5)
    expect(b.preliminaryBattles).toBe(1)
    expect(b.freePasses).toBe(3)
    expect(b.targetPlayers).toBe(4)
  })

  it('refuses to describe a field of one, where the contract underflows', () => {
    /* `players - battles * 2` on unsigned integers: 1 - 2 is not -1 there. */
    expect(bracketOf(1).degenerate).toBe(true)
    expect(bracketOf(0).degenerate).toBe(true)
  })
})

describe('a tournament name', () => {
  it('is the second it started on', () => {
    const start = 1_790_000_000
    expect(startedAt(nameOf(start))).toBe(start * 1000)
  })

  it('is not read out of an ordinary account name', () => {
    expect(startedAt('5thba.wam')).toBeNull()
    expect(startedAt('not a name')).toBeNull()
  })
})

describe('how many skip the opening round', () => {
  it('believes the chain once it has worked it out', () => {
    expect(freePassCount(stage({ free_passes: 9 }), 23)).toBe(9)
  })

  it('works it out itself while the row still says zero', () => {
    /*
       A real row, 2026-09-27: the stage had moved to `close_signup` with
       three entered, but `free_passes`, `rounds` and the preliminary count
       were all still zero — the step had not done its work. Three entrants
       make one pass, and the screen had everything it needed to say so.
    */
    expect(freePassCount(stage({ free_passes: 0, allow_player_signup: false }), 3)).toBe(1)
  })

  it('still says none for a field that has none', () => {
    /* Sixteen is a clean bracket: everybody fights the opening round. */
    expect(freePassCount(stage({ free_passes: 0 }), 16)).toBe(0)
    expect(freePassCount(stage({ free_passes: 0 }), 1)).toBe(0)
    expect(freePassCount(undefined, 0)).toBe(0)
  })
})

describe('seeding', () => {
  it('ranks on score, and settles a tie on who entered first', () => {
    const early = entrant({ wallet: 'early.wam', score: 40, signup_timestamp: '2026-09-27T12:00:00' })
    const late = entrant({ wallet: 'late.wam', score: 40, signup_timestamp: '2026-09-27T12:05:00' })
    const best = entrant({ wallet: 'best.wam', score: 90 })
    expect(seedOrder([late, best, early]).map((s) => s.wallet)).toEqual([
      'best.wam',
      'early.wam',
      'late.wam',
    ])
  })

  it('says nothing about a free pass while the field is still arriving', () => {
    const field = [entrant({ wallet: 'me.wam', score: 50 }), entrant({ wallet: 'b.wam', score: 10 })]
    const open = seedingOf(field, stage({ free_passes: 1 }), 'me.wam')
    expect(open?.rank).toBe(1)
    expect(open?.freePass).toBeNull()
  })

  it('hands the passes to the top of the table once entry has closed', () => {
    const field = [
      entrant({ wallet: 'me.wam', score: 50 }),
      entrant({ wallet: 'b.wam', score: 40 }),
      entrant({ wallet: 'c.wam', score: 10 }),
    ]
    const closed = stage({ allow_player_signup: false, free_passes: 1, player_count: 3 })
    expect(seedingOf(field, closed, 'me.wam')?.freePass).toBe(true)
    expect(seedingOf(field, closed, 'b.wam')?.freePass).toBe(false)
  })
})

describe('finding your own entry', () => {
  it('reads the wallet when the contract files one', () => {
    const field = [entrant({ wallet: 'me.wam', playertag: 'Shade' })]
    expect(mySignup(field, 'me.wam')?.wallet).toBe('me.wam')
  })

  it('does not claim a row the contract scrambled off the wallet', () => {
    /*
       Real rows, 2026-09-27: `5thba.wam` entered twice and the table holds
       `5thba.wamzumj` and `5thba.wamzunj` — the wallet's value plus
       `seconds % 1000000`. The arithmetic can be undone, and undoing it is
       still the wrong answer: entering repeatedly is how the contract is
       being tested, and picking one of those rows as "your entry" is a
       guess. Only the wallet itself counts.
    */
    const field = [
      entrant({ wallet: '5thba.wamzumj', playertag: 'Shrimp' }),
      entrant({ wallet: '5thba.wamzunj', playertag: 'Shrimp' }),
    ]
    expect(mySignup(field, '5thba.wam')).toBeUndefined()
    expect(ownsEntry('5thba.wamzumj', '5thba.wam')).toBe(false)
  })

  it('does not hand somebody else their entry', () => {
    const field = [entrant({ wallet: '5thba.wamzumj', playertag: 'Shrimp' })]
    expect(mySignup(field, '42lra.wam')).toBeUndefined()
    expect(ownsEntry('5thba.wamzumj', '42lra.wam')).toBe(false)
  })

  it('will not take a shared player tag as proof', () => {
    /*
       Tags are not unique, and matching on one told a player who had not
       entered that they were in — in a tournament they could still have
       entered, which is the one moment the screen must not be wrong.
    */
    const field = [entrant({ wallet: 'someone.wam', playertag: 'Shrimp' })]
    expect(mySignup(field, '5thba.wam')).toBeUndefined()
  })
})

describe('the day', () => {
  const plan: TournamentPlanStep[] = [
    {
      index: 3000,
      time_start: '2026-09-27T12:00:00',
      duration_sec: 600,
      step_name: 'signup',
      task_current: 0,
      task_total: 0,
      completed: true,
    },
    {
      index: 4000,
      time_start: '2026-09-27T12:10:00',
      duration_sec: 600,
      step_name: 'close_signup',
      task_current: 0,
      task_total: 0,
      completed: false,
    },
  ]
  const at = (stamp: string) => Date.parse(`${stamp}Z`)

  it('keeps a completed step running until its time is up', () => {
    /* The signup step marks itself completed immediately; the window it
       holds open is the duration, not the flag. */
    const line = timelineOf(plan, at('2026-09-27T12:05:00'))
    expect(line[0].state).toBe('running')
    expect(line[1].state).toBe('waiting')
  })

  it('closes a step once both its time and its work are done', () => {
    const line = timelineOf(plan, at('2026-09-27T12:15:00'))
    expect(line[0].state).toBe('done')
    expect(line[1].state).toBe('running')
  })

  it('follows the chain rather than the clock when it is told where it is', () => {
    /*
       `advance` runs on the task manager, so a step whose window has long
       elapsed is not finished if nothing has moved the tournament on. Asked
       about a chain still sitting on the first step an hour later, the strip
       has to say so rather than marching through the day by itself.
    */
    const line = timelineOf(plan, at('2026-09-27T13:30:00'), 3000)
    expect(line[0].state).toBe('running')
    expect(line[1].state).toBe('waiting')
  })

  it('marks everything before the current step done, however it went', () => {
    const line = timelineOf(plan, at('2026-09-27T12:05:00'), 4000)
    expect(line[0].state).toBe('done')
    expect(line[1].state).toBe('running')
  })
})

describe('the strip, when it will not all fit', () => {
  const steps = (running: number) =>
    ['set_weather', 'get_rewards', 'signup', 'close_signup', 'create_matchups', 'battle', 'cleanup'].map(
      (name, i) => ({
        index: i,
        name,
        startMs: 0,
        endMs: 0,
        state: i < running ? 'done' : i === running ? 'running' : 'waiting',
        current: 0,
        total: 0,
      }),
    ) as Parameters<typeof stripWindow>[0]

  it('leaves the day alone when there is room for it', () => {
    expect(stripWindow(steps(2), 7)).toHaveLength(7)
    expect(stripWindow(steps(2), 99)).toHaveLength(7)
  })

  it('shows the step before, the one running and the one next', () => {
    expect(stripWindow(steps(3), 3).map((s) => s.name)).toEqual([
      'signup',
      'close_signup',
      'create_matchups',
    ])
  })

  it('uses whatever room it is given, not just three', () => {
    expect(stripWindow(steps(3), 5).map((s) => s.name)).toEqual([
      'signup',
      'close_signup',
      'create_matchups',
      'battle',
      'cleanup',
    ])
  })

  it('never goes under three, however little room is claimed', () => {
    expect(stripWindow(steps(3), 1)).toHaveLength(3)
    expect(stripWindow(steps(3), 0)).toHaveLength(3)
  })

  it('clamps at both ends rather than running short', () => {
    expect(stripWindow(steps(0), 3).map((s) => s.name)).toEqual([
      'set_weather',
      'get_rewards',
      'signup',
    ])
    expect(stripWindow(steps(6), 3).map((s) => s.name)).toEqual([
      'create_matchups',
      'battle',
      'cleanup',
    ])
  })
})

describe('the shape of a tournament, read from the template', () => {
  const template: TournamentStageTemplate[] = [
    { index: 1000, delay_sec: 0, duration_sec: 0, step_name: 'set_weather', task_current: 0, task_total: 0, tournament_screen: 'preparing', allow_player_signup: false, allow_player_cancellation: false },
    { index: 3000, delay_sec: 0, duration_sec: 600, step_name: 'signup', task_current: 0, task_total: 0, tournament_screen: 'signup', allow_player_signup: true, allow_player_cancellation: true },
    { index: 6000, delay_sec: 0, duration_sec: 2400, step_name: 'battle', task_current: 0, task_total: 0, tournament_screen: 'battle', allow_player_signup: false, allow_player_cancellation: false },
    { index: 7000, delay_sec: 600, duration_sec: 0, step_name: 'cleanup', task_current: 0, task_total: 0, tournament_screen: 'finish', allow_player_signup: false, allow_player_cancellation: false },
  ]

  it('finds the entry window and how long the whole thing takes', () => {
    expect(signupWindow(template)).toEqual({ opensAfterSec: 0, lastsSec: 600 })
    expect(plannedLengthSec(template)).toBe(600 + 2400 + 600)
  })
})

describe('what the screen shows', () => {
  it('reads the signup flag before anything else, because the contract does', () => {
    /*
       A real row, 2026-09-27: stage_name "signup", allow_player_signup 1,
       and tournament_screen empty — `advance` never copies the screen onto
       the schedule rows `nextstage` reads it back from. Trusting the screen
       field alone showed a shut gate through the whole entry window.
    */
    const live = stage({
      stage_name: 'signup',
      tournament_screen: '',
      allow_player_signup: true,
    })
    expect(phaseOf(live)).toBe('signup')
  })

  it('falls back to the step name when the screen is blank', () => {
    const blank = (stage_name: string) =>
      phaseOf(stage({ stage_name, tournament_screen: '', allow_player_signup: false }))
    expect(blank('set_weather')).toBe('preparing')
    expect(blank('close_signup')).toBe('creation')
    expect(blank('create_matchups')).toBe('creation')
    expect(blank('battle')).toBe('battle')
    expect(blank('cleanup')).toBe('finish')
  })

  it('still believes the screen field if a later contract fills it in', () => {
    expect(phaseOf(undefined)).toBe('none')
    expect(
      phaseOf(stage({ stage_name: '', tournament_screen: 'battle', allow_player_signup: false })),
    ).toBe('battle')
    expect(
      phaseOf(stage({ stage_name: '', tournament_screen: 'something_new', allow_player_signup: false })),
    ).toBe('preparing')
  })

  it('puts the tournament the player is in ahead of the one taking entries', () => {
    const mine = stage({ tournament_name: 'aaa', allow_player_signup: false })
    const open = stage({ tournament_name: 'bbb', allow_player_signup: true })
    expect(pickTournament([open, mine], ['aaa'])?.tournament_name).toBe('aaa')
    expect(pickTournament([open, mine], [])?.tournament_name).toBe('bbb')
    expect(pickTournament([], [])).toBeUndefined()
  })
})

describe('entering', () => {
  const five = [fighter(5), fighter(6), fighter(7), fighter(8), fighter(9)]

  it('scores a point a level and ten an ascension, as signup does', () => {
    expect(teamScore([fighter(8, 2), fighter(3)])).toBe(8 + 20 + 3)
    expect(teamScore([null, undefined])).toBe(0)
  })

  it('refuses in the order the contract does', () => {
    expect(canEnter(five, true, true, 50, 10, undefined, false, 5).reason).toBe(
      'No tournament is running',
    )
    expect(
      canEnter(five, true, true, 50, 10, stage({ allow_player_signup: false }), false, 5).reason,
    ).toBe('Entry is closed')
    expect(canEnter(five, true, true, 50, 10, stage(), true, 5).reason).toBe(
      'You are already entered',
    )
  })

  it('wants a full team, both cards and the energy', () => {
    const s = stage()
    expect(canEnter([...five.slice(0, 3), null, null], true, true, 50, 10, s, false, 5).reason)
      .toBe('Pick 2 more fighters')
    expect(canEnter(five, false, true, 50, 10, s, false, 5).reason).toBe('Pick a crew card')
    expect(canEnter(five, true, false, 50, 10, s, false, 5).reason).toBe('Pick a weapon card')
    expect(canEnter(five, true, true, 4, 10, s, false, 5).reason).toBe(
      'Not enough energy — 10 needed',
    )
    expect(canEnter(five, true, true, 50, 10, s, false, 5)).toEqual({ ready: true })
  })

  it('will not field a fighter that is busy, which signup aborts on', () => {
    const busy = [...five.slice(0, 4), fighter(9, 0, true)]
    expect(canEnter(busy, true, true, 50, 10, stage(), false, 5).reason).toMatch(/busy elsewhere/)
  })
})
