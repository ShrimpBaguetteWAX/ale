import { describe, expect, it } from 'vitest'
import { CHORE_CHECKS } from '@/chores/checks'
import type { Player } from '@/chain/types'

/**
 * The Rewards dot, and the pool nobody can mine.
 *
 * `shrdarenadom` still carries a balance on the chain — up to a million and
 * more for some Domination players — but the shard side of Arena Domination
 * is not mined and the Rewards page does not list it. The dot counted it
 * anyway, so it stayed lit for those players with nothing to do behind it.
 */

const rewards = CHORE_CHECKS.find((c) => c.key === 'rewards')!

const playerWith = (reward_power: { pool: string; power: number; type: string }[]) =>
  ({ wallet: 'test.wam', reward_power }) as unknown as Player

describe('the Rewards dot', () => {
  it('ignores power in shrdarenadom, however much there is', async () => {
    const player = playerWith([
      { pool: 'shrdarenadom', power: 1_054_490, type: 'shards' },
      { pool: 'tlmarenadom', power: 4_000, type: 'tlm' },
    ])
    expect(await rewards.run(player, false)).toBe(false)
  })

  it('still lights for a pool that can be mined', async () => {
    const player = playerWith([
      { pool: 'shrdarenadom', power: 1_054_490, type: 'shards' },
      { pool: 'tlmarenadom', power: 10_000, type: 'tlm' },
    ])
    expect(await rewards.run(player, false)).toBe(true)
  })
})
