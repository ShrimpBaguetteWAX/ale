import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Player } from '@/chain/types'
import type { PoolEntry } from '@/pools/rules'
import type { BriefItem, FirstStep } from '@/briefing/rules'
import { DeskBriefing } from '@/briefing/DeskBriefing'

/**
 * The desktop briefing's lanes: what goes where, and what an empty lane
 * says. The items themselves are `buildBriefing`'s, tested on their own.
 */

afterEach(cleanup)

const player = { wallet: 'lanes.wam', playertag: 'lanes', active_avatar: 0 } as unknown as Player

const pool = (over: Partial<PoolEntry>): PoolEntry => ({
  pool: 'tlmdung',
  label: 'Dungeon Wins',
  type: 'tlm',
  power: 0,
  spend: 100,
  progress: 0.5,
  mines: 0,
  ready: false,
  balance: 10_000_000_000,
  payout: 0,
  anyAmount: false,
  ...over,
})

const POOLS = {
  tlm: [
    pool({ pool: 'tlmdung', label: 'Dungeon Wins', progress: 0.82 }),
    pool({ pool: 'tlmarena', label: 'Arena Wins', progress: 0.37 }),
    pool({ pool: 'tlmarenadom', label: 'Arena Domination', progress: 0.58 }),
  ],
  shards: [
    pool({ pool: 'shrddung', label: 'Dungeon Wins', type: 'shards', progress: 0.64 }),
    pool({ pool: 'shrdarena', label: 'Arena Wins', type: 'shards', progress: 0.12 }),
  ],
}

const item = (over: Partial<BriefItem>): BriefItem => ({
  id: 'x',
  group: 'play',
  rank: 0,
  tone: 'play',
  icon: '/assets/icons/tlm.svg',
  title: 'Something',
  body: 'First sentence. Second sentence.',
  cta: { label: 'Go', to: '/' },
  ...over,
})

const ALL_DONE: FirstStep[] = [{ key: 'a', label: 'A', done: true }]

const draw = (props: Partial<Parameters<typeof DeskBriefing>[0]> = {}) =>
  render(
    <MemoryRouter>
      <DeskBriefing
        player={player}
        items={[]}
        pools={POOLS}
        pending={0}
        steps={ALL_DONE}
        legend
        veteran
        {...props}
      />
    </MemoryRouter>,
  ).container

describe('the desktop briefing', () => {
  it('shows every pool filling, Arena Domination too, when nothing is waiting', () => {
    const c = draw()
    expect(c.querySelector('.dbrief__calm')?.textContent).toContain('All caught up')
    const names = [...c.querySelectorAll('.dbrief__meter > span:not([role])')].map((s) => s.textContent)
    expect(names).toEqual(['Dungeon wins', 'Arena wins', 'Arena domination', 'Dungeon wins', 'Arena wins'])
  })

  it('gives the pools tile every pool, ready or not, with domination a TLM-only row', () => {
    const ready = { ...POOLS, tlm: POOLS.tlm.map((p, i) => (i === 0 ? { ...p, ready: true, payout: 480000 } : p)) }
    const c = draw({
      pools: ready,
      items: [item({ id: 'mine', group: 'now', tone: 'claim', title: 'A reward pool is ready to mine' })],
    })
    const rows = [...c.querySelectorAll('.dbrief__prow')].map((r) => r.textContent)
    expect(rows).toHaveLength(3)
    expect(rows[2]).toBe('Arena domination58%–')
    expect(c.querySelector('.dbrief__calm')).toBeNull()
  })

  it('puts warnings across the top, not in the waiting lane, with one sentence of why', () => {
    const c = draw({ items: [item({ id: 'cpu', group: 'now', tone: 'warn', title: 'Your CPU is running low' })] })
    expect(c.querySelector('.dbrief__warn')?.textContent).toContain('First sentence.')
    expect(c.querySelector('.dbrief__warn')?.textContent).not.toContain('Second sentence.')
    expect(c.querySelector('.dbrief__lane--wait .dbrief__tile')).toBeNull()
  })

  it('leaves Grow out when there is nothing in it, and never says caught up while still reading', () => {
    const c = draw({ pending: 2 })
    expect(c.querySelector('.dbrief__lane--grow')).toBeNull()
    expect(c.querySelector('.dbrief__calm')).toBeNull()
    expect(c.querySelector('.dbrief__lane--wait .dbrief__sk')).not.toBeNull()
  })

  it('puts Start here across the board with the first steps beside it', () => {
    const steps: FirstStep[] = [
      { key: 'team', label: 'Recruit five fighters', done: false },
      { key: 'dungeon', label: 'Win a dungeon', done: false },
    ]
    const c = draw({
      steps,
      veteran: false,
      items: [item({ id: 'recruit-team', group: 'start', title: 'Recruit your first fighters' })],
    })
    expect(c.querySelector('.dbrief__start')?.textContent).toContain('Recruit your first fighters')
    expect(c.querySelector('.dbrief__start .dbrief__steps')).not.toBeNull()
    expect(c.querySelector('.dbrief__steps.is-line')).toBeNull()
  })
})
