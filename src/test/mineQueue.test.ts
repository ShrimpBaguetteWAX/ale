import { describe, expect, it } from 'vitest'
import { mineQueue, type PoolEntry } from '@/pools/rules'

const entry = (pool: string, mines: number, balance = 1_000_000, anyAmount = false): PoolEntry => ({
  pool,
  label: pool,
  type: 'tlm',
  power: mines * 10_000,
  spend: 10_000,
  progress: Math.min(1, mines),
  mines,
  ready: anyAmount ? mines > 0 : mines >= 1,
  balance,
  payout: Math.floor(balance / 100),
  anyAmount,
})

describe('mineQueue', () => {
  it('takes every ready mine, in turns between pools', () => {
    const q = mineQueue([entry('dung', 1), entry('arena', 3), entry('dom', 0)])
    expect(q.claims).toEqual(['dung', 'arena', 'arena', 'arena'])
    expect(q.byPool.map((p) => [p.entry.pool, p.times])).toEqual([
      ['dung', 1],
      ['arena', 3],
    ])
    expect(q.banked).toBe(4)
  })

  it('stops at ten without leaving a pool out', () => {
    const q = mineQueue([entry('dung', 7), entry('arena', 7)])
    expect(q.claims).toHaveLength(10)
    expect(q.byPool.map((p) => p.times)).toEqual([5, 5])
    expect(q.banked).toBe(14)
  })

  it('prices each later mine against the smaller pool the last one left', () => {
    const q = mineQueue([entry('dung', 2, 1_000_000)])
    /* 1% of 1,000,000, then 1% of what is left. */
    expect(q.total).toBe(10_000 + 9_900)
  })

  it('mines a pool with no minimum once', () => {
    const q = mineQueue([entry('lbpool', 3, 500_000, true)])
    expect(q.claims).toEqual(['lbpool'])
  })

  it('has nothing to mine when nothing is ready', () => {
    expect(mineQueue([entry('dung', 0)])).toMatchObject({ claims: [], total: 0, banked: 0 })
  })
})
