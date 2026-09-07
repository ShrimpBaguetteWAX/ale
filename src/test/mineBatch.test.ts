import { describe, expect, it, vi } from 'vitest'

/**
 * That "Mine ×N" is really N mines, in one transaction, under one id.
 *
 * `claimpreward` spends at most `max_mine_power` — 10,000 — and takes that
 * off the player's banked power, so mining ten is the same action ten times
 * rather than one action asked for more. Sending them together is what makes
 * it one signature, and makes it all or nothing: a batch that runs out of CPU
 * part way leaves the player exactly as they were.
 *
 * The shared `history_id` is deliberate and is the contract's own behaviour:
 * `claimpreward` looks that row up and adds to it where it already exists
 * (`total_tlm + row.total_tlm`, `total_shards +=`), so the whole batch lands
 * as a single record of what the claim paid — which is the row the
 * celebration reads back afterwards. Ten ids would have meant ten rows and a
 * celebration that could only show one of them.
 */

describe('mineRewardPool', () => {
  it('sends one action per banked mine, all sharing a history id', async () => {
    vi.resetModules()
    const sent: unknown[][] = []
    vi.doMock('@/wharf/session', () => ({
      transact: (_s: unknown, actions: unknown[]) => {
        sent.push(actions)
        return Promise.resolve()
      },
    }))
    const { mineRewardPool } = await import('@/wharf/actions')
    const session = { actor: 'smoke.wam' } as never

    await mineRewardPool(session, 'tlmdungeon', 'abc123', 10)
    const actions = sent[0] as {
      name: string
      data: { history_id: string; pool: string }
    }[]

    expect(actions).toHaveLength(10)
    expect(new Set(actions.map((a) => a.name))).toEqual(new Set(['claimpreward']))
    expect(new Set(actions.map((a) => a.data.history_id))).toEqual(new Set(['abc123']))
    expect(new Set(actions.map((a) => a.data.pool))).toEqual(new Set(['tlmdungeon']))
  })

  it('is a single action when nothing asks for more', async () => {
    /* The plain Mine button, unchanged by any of this. */
    vi.resetModules()
    const sent: unknown[][] = []
    vi.doMock('@/wharf/session', () => ({
      transact: (_s: unknown, actions: unknown[]) => {
        sent.push(actions)
        return Promise.resolve()
      },
    }))
    const { mineRewardPool } = await import('@/wharf/actions')

    await mineRewardPool({ actor: 'smoke.wam' } as never, 'tlmdungeon', 'def456')
    expect(sent[0]).toHaveLength(1)
  })
})
