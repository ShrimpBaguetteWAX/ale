import { describe, expect, it } from 'vitest'
import {
  fightSlots,
  passesFrom,
  payoutOrder,
  prizesOf,
  replay,
  roundName,
  roundSizes,
  stripCells,
  waxBands,
  waxFor,
  waxShares,
  winsAhead,
} from '@/tournament/standings'
import type { TournamentMatchup, TournamentStage } from '@/tournament/types'

const bout = (
  index: number,
  a: [string, string],
  b: [string, string],
  winner: '' | 'player1' | 'player2',
): TournamentMatchup => ({
  index,
  matchup_seed: 1,
  wallet_player1: a[0],
  wallet_player2: b[0],
  gamertag_player1: a[1],
  gamertag_player2: b[1],
  avatar_player1: 0,
  avatar_player2: 0,
  fighter_ids_player1: [],
  fighter_ids_player2: [],
  crew_template_id_player1: 0,
  crew_template_id_player2: 0,
  arms_template_id_player1: 0,
  arms_template_id_player2: 0,
  play_time: '2026-10-24T08:00:00',
  winner,
})

const SHADE: [string, string] = ['1x1ci.wam', 'Shade']
const CRYPT: [string, string] = ['5t14m.c.wam', 'CryptOhioan']
const PEST: [string, string] = ['42lra.wam', 'Pestilentia']
const SHRIMP: [string, string] = ['5thba.wam', 'Shrimp']
const STORAGE: [string, string] = ['szu4g.c.wam', 'Storage']

/* The first real tournament, 2026-10-24: five players, the final still to come. */
const OCT24: TournamentMatchup[][] = [
  [bout(0, SHRIMP, STORAGE, 'player1')],
  [bout(0, SHADE, SHRIMP, 'player1'), bout(1, CRYPT, PEST, 'player1')],
  [bout(0, SHADE, CRYPT, '')],
]

describe('roundSizes', () => {
  it('cuts the field to a power of two, then halves it', () => {
    expect(roundSizes(5)).toEqual([1, 2, 1])
    expect(roundSizes(12)).toEqual([4, 4, 2, 1])
    expect(roundSizes(16)).toEqual([8, 4, 2, 1])
    expect(roundSizes(23)).toEqual([7, 8, 4, 2, 1])
    expect(roundSizes(2)).toEqual([1])
  })
  it('adds up to one fight fewer than players', () => {
    for (let n = 2; n <= 200; n++) {
      expect(roundSizes(n).reduce((a, b) => a + b, 0)).toBe(n - 1)
    }
  })
  it('has nothing for a field too small to fight', () => {
    expect(roundSizes(1)).toEqual([])
  })
})

describe('roundName', () => {
  it('counts back from the final', () => {
    expect(roundName(3, 4, true)).toBe('Final')
    expect(roundName(2, 4, true)).toBe('Semi-finals')
    expect(roundName(1, 4, true)).toBe('Quarter-finals')
    expect(roundName(0, 4, true)).toBe('Opening round')
  })
  it('calls a first round with no free passes by its size', () => {
    expect(roundName(0, 4, false)).toBe('Last 16')
    expect(roundName(1, 7, false, true)).toBe('Last 64')
  })
})

describe('fightSlots', () => {
  it('splits the window into one slot a fight, in order', () => {
    const start = Date.parse('2026-10-24T08:00:00Z')
    const slots = fightSlots(5, start, 43200)
    const iso = slots.map((r) => r.map((t) => new Date(t).toISOString().slice(11, 16)))
    /* What the chain stamped on the real one: 08:00, 11:00, 14:00, 17:00 UTC. */
    expect(iso).toEqual([['08:00'], ['11:00', '14:00'], ['17:00']])
  })
})

describe('replay', () => {
  it('reproduces the points the chain holds for the first tournament', () => {
    const passes = passesFrom(OCT24, [])
    expect(passes.map((p) => p.tag).sort()).toEqual(['CryptOhioan', 'Pestilentia', 'Shade'])
    const runs = replay(OCT24, passes, roundSizes(5))
    const pts = Object.fromEntries([...runs.values()].map((r) => [r.tag, r.points]))
    /* Shade's semi was the first of two, CryptOhioan's the last: one point more. */
    expect(pts).toEqual({ Shade: 21, CryptOhioan: 22, Pestilentia: 10, Shrimp: 1, Storage: 0 })
  })
  it('records who beat whom', () => {
    const runs = replay(OCT24, passesFrom(OCT24, []), roundSizes(5))
    const shrimp = runs.get(SHRIMP[0])!
    expect(shrimp.outIn).toBe(1)
    expect(shrimp.lostTo?.tag).toBe('Shade')
    expect(shrimp.beat.map((b) => b.who.tag)).toEqual(['Storage'])
    expect(runs.get(SHADE[0])!.outIn).toBeNull()
  })
  it('falls back to the given passes before the second round is drawn', () => {
    const passes = passesFrom([OCT24[0]], [{ wallet: SHADE[0], tag: 'Shade', avatar: 0 }])
    expect(passes.map((p) => p.tag)).toEqual(['Shade'])
  })
})

describe('payoutOrder', () => {
  it('puts most points first, and breaks ties by wallet', () => {
    const rows = [
      { wallet: 'b.wam', points: 1 },
      { wallet: 'c.wam', points: 22 },
      { wallet: 'a.wam', points: 1 },
    ]
    expect(payoutOrder(rows).map((r) => r.wallet)).toEqual(['c.wam', 'a.wam', 'b.wam'])
  })
})

describe('prizes', () => {
  const stage = {
    wax_rewards: '2195.07044119 WAX',
    tlm_rewards: '4.8904 TLM',
    rounds: 3,
  } as TournamentStage

  it('shares WAX in 48ths by place', () => {
    expect([1, 2, 3, 4, 5, 8, 9, 16, 17].map(waxShares)).toEqual([16, 8, 4, 4, 2, 2, 1, 1, 0])
    const prizes = prizesOf(stage)
    expect(waxFor(prizes, 1)).toBeCloseTo(731.69, 2)
    expect(waxFor(prizes, 2)).toBeCloseTo(365.85, 2)
  })
  it('pays TLM per point over the sum of r² · 2^(R−r)', () => {
    /* R = 3: 1·4 + 4·2 + 9·1 = 21, as the contract divides it. */
    expect(prizesOf(stage).perPoint).toBeCloseTo(0.2328, 4)
  })
  it('cuts the WAX places to the field', () => {
    expect(waxBands(5)).toEqual([
      { from: 1, to: 1, shares: 16 },
      { from: 2, to: 2, shares: 8 },
      { from: 3, to: 4, shares: 4 },
      { from: 5, to: 5, shares: 2 },
    ])
  })
})

describe('winsAhead', () => {
  it('doubles and adds the round, a win at a time', () => {
    expect(winsAhead(10, 1, 4).map((s) => s.points)).toEqual([21, 44, 91])
    expect(winsAhead(0, 0, 3).map((s) => s.points)).toEqual([0, 1, 4])
  })
})

describe('stripCells', () => {
  const items = Array.from({ length: 10 }, (_, i) => i)
  it('shows everything when it fits', () => {
    expect(stripCells(items.slice(0, 6), 2).map((c) => c.item)).toEqual([0, 1, 2, 3, 4, 5])
  })
  it('never grows past its columns, folding both ends', () => {
    const cells = stripCells(items, 5)
    expect(cells).toHaveLength(6)
    expect(cells[0].more).toEqual({ count: 4, side: 'before', first: 3 })
    expect(cells.slice(1, 5).map((c) => c.item)).toEqual([4, 5, 6, 7])
    expect(cells[5].more).toEqual({ count: 2, side: 'after', first: 8 })
  })
  it('keeps the focus in view at either end', () => {
    expect(stripCells(items, 0).map((c) => c.item).slice(0, 5)).toEqual([0, 1, 2, 3, 4])
    const end = stripCells(items, 9)
    expect(end[end.length - 1].item).toBe(9)
    expect(end[0].more?.side).toBe('before')
  })
})
