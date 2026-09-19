import { describe, expect, it } from 'vitest'
import type { Player } from '@/chain/types'
import type { PoolEntry } from '@/pools/rules'
import {
  buildBriefing,
  firstSteps,
  poolProgressLine,
  winsToMine,
  type BriefingInput,
  type RosterSummary,
} from '@/briefing/rules'

const NOW = Date.parse('2026-09-19T12:00:00Z')
const day = 86_400_000
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19)

const player = (over: Partial<Player> = {}): Player =>
  ({
    wallet: 'tester.wam',
    playertag: 'Tester',
    permstats: [{ first: 'dungeons_won', second: 5 }],
    activestats: { action_points: 500, unclaimed_tlm: 0 },
    active_taverns: [],
    mine_nfts: ['1'],
    legend_access_expiry: stamp(NOW + 60 * day),
    landowner_tlm_share: 70,
    reward_power: [],
    ...over,
  }) as unknown as Player

const roster = (over: Partial<RosterSummary> = {}): RosterSummary => ({
  total: 8,
  available: 8,
  belowTen: 0,
  levelUps: 0,
  ascendable: 0,
  ascensionWaiting: 0,
  ...over,
})

const pool = (over: Partial<PoolEntry>): PoolEntry => ({
  pool: 'tlmdung',
  label: 'Dungeon Wins',
  type: 'tlm',
  power: 0,
  spend: 0,
  progress: 0,
  mines: 0,
  ready: false,
  balance: 10_000_000_000, // 1,000,000 TLM
  payout: 0,
  anyAmount: false,
  ...over,
})

const run = (over: Partial<BriefingInput> = {}) =>
  buildBriefing({ player: player(), now: NOW, ...over })
const ids = (over: Partial<BriefingInput> = {}) => run(over).map((i) => i.id)

describe('briefing', () => {
  it('puts recruiting first for a player without a team', () => {
    const items = run({ roster: roster({ total: 2, available: 2 }), dungeons: { open: 20, total: 20 } })
    expect(items[0].id).toBe('recruit-team')
    expect(items[0].figure).toBe('2 / 5')
    /* No team, so no dungeon nudge yet. */
    expect(items.some((i) => i.id === 'dungeons')).toBe(false)
  })

  it('counts the dungeons left today and estimates the wins to a mine', () => {
    const items = run({
      roster: roster(),
      dungeons: { open: 23, total: 30 },
      pools: { tlm: [pool({ power: 6_000, progress: 0.6 })], shards: [] },
      winPower: { dungeon: new Map([['tlmdung', 1_000]]), arena: new Map() },
    })
    const d = items.find((i) => i.id === 'dungeons')!
    expect(d.title).toBe("23 dungeons you haven't played today")
    expect(d.body).toContain('60% (TLM)')
    expect(d.body).toContain('About 4 more wins')
    /* A full mine is 1% of the pool. */
    expect(d.body).toContain('~10,000 TLM')
  })

  it('makes the first dungeon the next step for a team with no win yet', () => {
    const items = run({
      player: player({ permstats: [] }),
      roster: roster(),
      dungeons: { open: 72, total: 72 },
    })
    const first = items.find((i) => i.id === 'dungeon-first')!
    expect(first.group).toBe('start')
    expect(first.title).toBe('Win your first dungeon')
    expect(items.some((i) => i.id === 'dungeons')).toBe(false)
  })

  it('says nothing about wins left without a history to go on', () => {
    const line = poolProgressLine('Dungeon Wins', [pool({ power: 5_000, progress: 0.5 })], undefined)
    expect(line).not.toContain('more win')
    expect(winsToMine(pool({ power: 5_000 }), undefined)).toBeUndefined()
    expect(winsToMine(pool({ power: 9_999 }), 50)).toBe(1)
  })

  it('offers a ready pool as a claim', () => {
    const items = run({ pools: { tlm: [pool({ ready: true, power: 12_000, payout: 1_000_000 })], shards: [] } })
    expect(items[0].id).toBe('mine')
    expect(items[0].body).toContain('~100 TLM')
  })

  it('makes the Legend case for a trial account, with its own numbers', () => {
    const items = run({
      player: player({ legend_access_expiry: stamp(NOW - day) }),
      trialMod: 0.1,
      winPower: { dungeon: new Map([['tlmdung', 40]]), arena: new Map() },
    })
    const l = items.find((i) => i.id === 'legend')!
    expect(l.body).toContain('only 10%')
    expect(l.body).toContain('~40 each')
    expect(l.body).toContain('~400')
  })

  it('warns a Legend whose pass is about to lapse, and nobody else', () => {
    expect(ids({ player: player({ legend_access_expiry: stamp(NOW + 2 * day) }) })).toContain('legend-ending')
    expect(ids()).not.toContain('legend-ending')
    expect(ids()).not.toContain('legend')
  })

  it('tells a landowner about empty plots and where their cut goes', () => {
    const b = run({ lands: { owned: 3, empty: 2, tlmWaiting: 0, fading: 0 } }).find((i) => i.id === 'build')!
    expect(b.title).toBe('2 of your 3 lands have no building')
    expect(b.body).toContain('70% as TLM and 30% as Shards')
    expect(ids({ lands: { owned: 0, empty: 0, tlmWaiting: 0, fading: 0 } })).not.toContain('build')
  })

  it('explains the CPU boost as the 24-hour, per-week claim it is', () => {
    const trial = run({
      player: player({ legend_access_expiry: stamp(NOW - day) }),
      cpuLow: true,
      cpuBoosts: { perWeek: 25, left: 25 },
    })
    expect(trial.find((i) => i.id === 'cpu')!.body).toContain('boost your CPU for 24 hours, up to 25 times a week')
    expect(trial.find((i) => i.id === 'legend')!.body).toContain('up to 25 times a week')

    const spent = run({ cpuLow: true, cpuBoosts: { perWeek: 25, left: 0 } }).find((i) => i.id === 'cpu')!
    expect(spent.body).toContain("used this week's free CPU boosts")
    expect(spent.cta.label).toBe('Check CPU')
  })

  it('asks for tools only when none are equipped', () => {
    expect(ids({ player: player({ mine_nfts: [] }) })).toContain('tools')
    expect(ids()).not.toContain('tools')
  })

  it('leaves out what it could not read', () => {
    /* No roster, quests, pools or world: none of their suggestions. */
    const list = ids()
    for (const id of ['dungeons', 'quests-new', 'quests-claim', 'mine', 'recruit-team', 'arena']) {
      expect(list).not.toContain(id)
    }
  })

  it('splits a Candle mission by eligibility', () => {
    const offer = { requirements: 'Dungeons won', have: 3, need: 10, msLeft: 5 * 3_600_000, reward: '5,000 TLM' }
    const items = run({ candle: { open: [{ ...offer, qualified: false }], winnings: false } })
    const c = items.find((i) => i.id.startsWith('candle'))!
    expect(c.group).toBe('grow')
    expect(c.body).toContain('at least 10 dungeons won')
    expect(run({ candle: { open: [{ ...offer, qualified: true }], winnings: false } }).find((i) => i.id.startsWith('candle'))!.group).toBe('play')
  })

  it('orders claims before play before growth', () => {
    const items = run({
      player: player({ mine_nfts: [] }),
      roster: roster({ levelUps: 2 }),
      dungeons: { open: 5, total: 10 },
      quests: { claimable: 1, openSlots: 2 },
    })
    const groups = items.map((i) => i.group)
    expect(groups).toEqual([...groups].sort((a, b) => ['start', 'now', 'play', 'grow'].indexOf(a) - ['start', 'now', 'play', 'grow'].indexOf(b)))
    expect(items[0].group).toBe('now')
  })

  it('reads first steps off the lifetime stats', () => {
    const steps = firstSteps(
      player({ permstats: [{ first: 'dungeons_won', second: 3 }, { first: 'tlm_earned', second: 10 }] }),
      roster({ total: 5 }),
    )
    const done = Object.fromEntries(steps.map((s) => [s.key, s.done]))
    expect(done).toMatchObject({ team: true, dungeon: true, mine: true, level: false, arena: false })
  })
})
