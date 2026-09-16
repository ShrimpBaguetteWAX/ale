import { describe, expect, it, vi } from 'vitest'
import { claimAllTargets } from '@/lands/rules'
import { claimAllLandRewards } from '@/wharf/actions'
import type { Building } from '@/chain/types'

const b = (over: Partial<Building>) =>
  ({ building_name: 'dungeon', tlm: 0, gems: 0, credits: 0, shards: 0, ...over }) as Building

const land = (id: string, buildings: Building[]) => ({ planet: 'naron', x: id.length, y: 1, id, buildings })

describe('Claim All Buildings', () => {
  it('takes only lands holding TLM', () => {
    const lands = [
      land('tlm', [b({ tlm: 12_345 })]),
      land('gems-only', [b({ gems: 40, credits: 900 })]),
      land('nothing', [b({})]),
      land('tlm-on-second', [b({}), b({ tlm: 1 })]),
    ]
    expect(claimAllTargets(lands).map((l) => l.id)).toEqual(['tlm', 'tlm-on-second'])
  })

  it('sends every land as one transaction', async () => {
    const transact = vi.fn().mockResolvedValue({})
    const session = { actor: 'me.wam', permissionLevel: 'me.wam@active', transact } as never
    await claimAllLandRewards(session, [
      { planet: 'naron', x: 10, y: 19 },
      { planet: 'magor', x: 3, y: 4 },
    ])
    expect(transact).toHaveBeenCalledTimes(1)
    const actions = transact.mock.calls[0][0].actions
    expect(actions.map((a: { name: string }) => a.name)).toEqual(['claimlndrwrd', 'claimlndrwrd'])
    expect(actions[1].data).toEqual({ wallet: 'me.wam', planet: 'magor', x: 3, y: 4 })
  })
})
