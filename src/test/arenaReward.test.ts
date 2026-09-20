import { describe, expect, it } from 'vitest'
import { arenaReward, arenaWeight, seasonPot } from '@/leaderboard/rules'
import type { ArenaSeason } from '@/leaderboard/types'

/**
 * What each place on an arena board is paid.
 *
 * The figures below are not invented: they are the last settled Domination
 * and Weekend boards, read off `arena.ale` — the pot each season started with
 * and the twenty amounts it paid. If the contract ever changes how it splits,
 * these stop matching, which is the point of pinning them.
 */
const season = (pot: number, winners = 20): ArenaSeason =>
  ({ available_tlm: Math.round(pot * 10_000), winners }) as unknown as ArenaSeason

/* Domination, settled 18 Sep 2026: 41,958.7373 TLM in the pot. */
const DOMINATION = {
  pot: 41_958.7373,
  paid: [
    11_687.6, 5843.8, 3891.9708, 2921.9, 2337.52, 1940.1416, 1659.6392, 1460.95, 1297.3236, 1168.76, 1051.884,
    970.0708, 888.2576, 829.8196, 771.3816, 724.6312, 677.8808, 642.818, 607.7552, 584.38,
  ],
}

/* Weekend Challenge, settled 13 Sep 2026: 25,743.4474 TLM. */
const WEEKEND = {
  pot: 25_743.4474,
  paid: [
    7170.8, 3585.4, 2387.8764, 1792.7, 1434.16, 1190.3528, 1018.2536, 896.35, 795.9588, 717.08, 645.372, 595.1764,
    544.9808, 509.1268, 473.2728, 444.5896, 415.9064, 394.394, 372.8816, 358.54,
  ],
}

describe('arena weights', () => {
  it('cuts 1 / rank to three decimals, as the contract does', () => {
    expect(arenaWeight(1)).toBe(1)
    expect(arenaWeight(2)).toBe(0.5)
    /* Not 0.167: the contract cuts rather than rounds. */
    expect(arenaWeight(6)).toBe(0.166)
    expect(arenaWeight(7)).toBe(0.142)
    expect(arenaWeight(19)).toBe(0.052)
  })
})

describe('arena rewards', () => {
  for (const [name, board] of [
    ['Domination', DOMINATION],
    ['Weekend Challenge', WEEKEND],
  ] as const) {
    it(`matches every place the last ${name} board paid`, () => {
      const s = season(board.pot)
      board.paid.forEach((amount, i) => {
        expect(arenaReward(i + 1, s)).toBeCloseTo(amount, 4)
      })
    })

    it(`pays out the ${name} pot but for the rounding left behind`, () => {
      const s = season(board.pot)
      const total = board.paid.reduce((n, a) => n + a, 0)
      expect(total).toBeLessThanOrEqual(seasonPot(s))
      /* What the cutting leaves in the pot is small change, not a slice. */
      expect(seasonPot(s) - total).toBeLessThan(1)
    })
  }

  it('pays nothing below the last paid place', () => {
    const s = season(DOMINATION.pot)
    expect(arenaReward(21, s)).toBe(0)
    expect(arenaReward(0, s)).toBe(0)
    expect(arenaReward(1, undefined)).toBe(0)
  })

  it('follows the winner count a season sets, not a fixed twenty', () => {
    const s = season(1000, 3)
    /* Weights 1 + 0.5 + 0.333 = 1.833, so first place takes 545.5 of the thousand. */
    expect(arenaReward(1, s)).toBeCloseTo(545.5, 4)
    expect(arenaReward(2, s)).toBeCloseTo(272.75, 4)
    expect(arenaReward(3, s)).toBeCloseTo(181.6515, 4)
    expect(arenaReward(4, s)).toBe(0)
  })
})
