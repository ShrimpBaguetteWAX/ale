import { describe, expect, it } from 'vitest'
import { paymentSources } from '@/rewards/rules'
import type { RewardLogEntry } from '@/account/queries'

const row = (pool: string, pool_description: string, reward: string, index = 0): RewardLogEntry => ({
  index,
  type: 'tlm',
  timestamp: '2026-10-24T10:00:00',
  reward,
  pool,
  pool_description,
})

describe('paymentSources', () => {
  it('folds the ledger by source, largest total first', () => {
    const out = paymentSources(
      [
        row('tlmlndowner', 'Landowner Rewards', '1.5000 TLM'),
        row('tlmlndowner', 'Landowner Rewards', '0.5000 TLM'),
        row('tlmquests', 'Reward for completing a quest', '17.6000 TLM'),
        row('tlmdung', 'Reward for beating a dungeon', '37.1357 TLM'),
      ],
      'fallback.svg',
    )
    expect(out.map((s) => [s.label, s.count, Number(s.total.toFixed(4))])).toEqual([
      ['Dungeon wins', 1, 37.1357],
      ['Quests', 1, 17.6],
      ['Landowner rewards', 2, 2],
    ])
  })

  it('tells arena domination from arena wins', () => {
    const out = paymentSources(
      [row('tlmarenadom', 'Arena Domination', '5.0000 TLM'), row('tlmarena', 'Arena win', '1.0000 TLM')],
      'fallback.svg',
    )
    expect(out.map((s) => s.label)).toEqual(['Arena domination', 'Arena wins'])
  })

  it('keeps an unknown source under its own words', () => {
    const paid = row('newpool', 'Something new', '2.0 WAX')
    const out = paymentSources([paid], 'fallback.svg')
    expect(out).toEqual([
      { key: 'Something new', label: 'Something new', icon: 'fallback.svg', count: 1, total: 2, payments: [paid] },
    ])
  })

  it('keeps every payment of a source, newest first', () => {
    const at = (timestamp: string, reward: string) => ({ ...row('tlmdung', 'Dungeon', reward), timestamp })
    const out = paymentSources(
      [at('2026-10-24T10:00:00', '1.0000 TLM'), at('2026-10-26T08:30:00', '3.0000 TLM'), at('2026-10-25T12:00:00', '2.0000 TLM')],
      'fallback.svg',
    )
    expect(out[0].payments.map((p) => p.reward)).toEqual(['3.0000 TLM', '2.0000 TLM', '1.0000 TLM'])
  })
})
