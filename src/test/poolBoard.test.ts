import { describe, expect, it } from 'vitest'
import { poolBoard } from '@/pools/rules'
import type { ShardPool, TlmPool } from '@/pools/queries'

const pool = (name: string): TlmPool => ({
  pool: name,
  subpools: [],
  has_fillrate: false,
  fillrate: '0.0000 TLM',
  tlm_reserve: '1000.0000 TLM',
  tlm_current: '1000.0000 TLM',
  last_reserve_update: '2026-09-22T00:00:00',
  last_current_update: '2026-09-22T00:00:00',
  fillrate_expiry: '2026-09-22T00:00:00',
  claim_per_hour_percent: 0,
  fillrate_1d_percent: 0,
})

const shardPool = (name: string): ShardPool => ({
  pool: name,
  shard_current: 100_000,
  fillrate_per_hour: 0,
  last_current_update: '2026-09-22T00:00:00',
})

describe('reward pool board', () => {
  it('leaves out the leaderboard pool that a leaderboard claim leaves behind', () => {
    /* What `lbclaim` leaves on a player: the leaderboard row, spent to zero. */
    const player = {
      reward_power: [
        { pool: 'tlmdunglb', power: 0, type: 'tlm' },
        { pool: 'tlmdung', power: 2812, type: 'tlm' },
      ],
    }
    const board = poolBoard('tlm', player, [pool('tlmdung'), pool('tlmdunglb')], [], [])
    const pools = board.map((e) => e.pool)
    expect(pools).toContain('tlmdung')
    expect(pools).not.toContain('tlmdunglb')
  })

  it('keeps the Arena Domination shard pool off the shards tab even with power banked', () => {
    /*
       Marking its shard side null is not enough on its own — that only
       leaves it out of the standing set, and a power row then readmits it
       through the "anything else" pass. The chain really does carry this
       pool with a balance, so the only thing keeping the card away is the
       exclusion.
    */
    const player = {
      reward_power: [
        { pool: 'shrdarenadom', power: 48_000, type: 'shards' },
        { pool: 'shrdarena', power: 12_000, type: 'shards' },
      ],
    }
    const board = poolBoard(
      'shrds',
      player,
      [],
      [shardPool('shrdarena'), shardPool('shrddung'), shardPool('shrdarenadom')],
      [],
    )
    expect(board.map((e) => e.pool).sort()).toEqual(['shrdarena', 'shrddung'])
  })
})
