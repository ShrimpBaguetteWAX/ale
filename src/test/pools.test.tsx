import { describe, expect, it } from 'vitest'
import {
  MAX_BATCH_MINES,
  MINE_POWER,
  batchPayout,
  batchableMines,
  poolPayout,
} from '@/pools/rules'
import type { PoolEntry } from '@/pools/rules'

/**
 * Mining several banked claims in one signature.
 *
 * Power accrues past the 10,000 threshold and `claimpreward` spends only
 * 10,000 of it, so a player who has been away has several banked and used to
 * sign for each one. A batch is that action repeated inside one transaction.
 *
 * The arithmetic is the part worth pinning. Each mine takes its share of what
 * the pool holds *at that moment* and leaves the rest, so ten mines do not
 * pay ten times the first — and the pool does not refill inside a single
 * transaction, so there is nothing to make up the difference.
 */

const entry = (over: Partial<PoolEntry>): PoolEntry =>
  ({
    pool: 'tlmdungeon',
    label: 'Dungeon',
    type: 'tlm',
    power: 10_000,
    spend: 10_000,
    progress: 1,
    mines: 1,
    ready: true,
    balance: 1_000_000,
    payout: 0,
    anyAmount: false,
    ...over,
  }) as PoolEntry

describe('batchPayout', () => {
  it('pays less than the same mine repeated, because the pool drains', () => {
    const balance = 1_000_000
    const single = poolPayout(balance, MINE_POWER)

    expect(batchPayout(balance, MINE_POWER, 10)).toBeLessThan(single * 10)
  })

  it('agrees with one mine when only one is spent', () => {
    const balance = 1_000_000
    expect(batchPayout(balance, MINE_POWER, 1)).toBe(poolPayout(balance, MINE_POWER))
  })

  it('is the sum the chain would arrive at, mine by mine', () => {
    /* The same loop the contract performs across ten sequential actions:
       pay a share, take it out of the pool, pay a share of what is left. */
    let left = 5_000_000
    let expected = 0
    for (let i = 0; i < 7; i++) {
      const paid = poolPayout(left, MINE_POWER)
      expected += paid
      left -= paid
    }

    expect(batchPayout(5_000_000, MINE_POWER, 7)).toBe(expected)
  })

  it('never pays out more than the pool holds', () => {
    expect(batchPayout(100, MINE_POWER, MAX_BATCH_MINES)).toBeLessThanOrEqual(100)
  })

  it('stops early rather than looping on an empty pool', () => {
    expect(batchPayout(0, MINE_POWER, MAX_BATCH_MINES)).toBe(0)
  })
})

describe('batchableMines', () => {
  it('offers what is banked, up to the cap', () => {
    expect(batchableMines(entry({ mines: 3 }))).toBe(3)
    expect(batchableMines(entry({ mines: 25 }))).toBe(MAX_BATCH_MINES)
  })

  it('offers nothing extra when only one is banked', () => {
    /* The screen shows the second button above one, so this is what keeps a
       single banked mine from being offered twice under two names. */
    expect(batchableMines(entry({ mines: 1 }))).toBe(1)
  })

  it('never batches a pool with no minimum', () => {
    /*
       A leaderboard pool takes whatever power is there in one call and leaves
       nothing, so a second action in the same transaction would spend nothing
       and pay nothing — a signature for a no-op.
    */
    expect(batchableMines(entry({ anyAmount: true, mines: 9 }))).toBe(0)
  })
})

describe('the Mine ×N button', () => {
  it('appears only once there is more than one banked mine', async () => {
    const { render, screen, cleanup } = await import('@testing-library/react')
    const { PoolRow } = await import('@/routes/Profile')

    const row = (mines: number, over: Partial<PoolEntry> = {}) => {
      cleanup()
      render(
        <PoolRow
          entry={entry({ mines, power: mines * MINE_POWER, ...over })}
          places={4}
          symbol="TLM"
          busy={false}
          disabled={false}
          onMine={() => {}}
        />,
      )
      return screen.queryByText(/^Mine ×/)
    }

    expect(row(1), 'one banked mine is just Mine').toBeNull()
    expect(row(4)?.textContent).toBe('Mine ×4')
    /* Capped, however much is banked. */
    expect(row(40)?.textContent).toBe(`Mine ×${MAX_BATCH_MINES}`)
    /* And never for a pool that spends everything in one call. */
    expect(row(9, { anyAmount: true })).toBeNull()
    cleanup()
  })

  it('asks for exactly the number on the button', async () => {
    const { render, screen, fireEvent, cleanup } = await import('@testing-library/react')
    const { PoolRow } = await import('@/routes/Profile')

    const asked: number[] = []
    render(
      <PoolRow
        entry={entry({ mines: 6, power: 6 * MINE_POWER })}
        places={4}
        symbol="TLM"
        busy={false}
        disabled={false}
        onMine={(times) => asked.push(times)}
      />,
    )

    fireEvent.click(screen.getByText('Mine'))
    fireEvent.click(screen.getByText('Mine ×6'))
    cleanup()

    expect(asked).toEqual([1, 6])
  })
})
