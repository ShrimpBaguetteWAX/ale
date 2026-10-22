import { describe, expect, it } from 'vitest'
import { hottestLands } from '@/map/hot'
import type { Land } from '@/chain/types'

/* Boost in the contract's unit: 100,000 is 1x. Written an hour ago. */
const land = (id: string, building: string, boost: number, planet = 'neri', special = ''): Land =>
  ({
    land_id: id,
    planet,
    x: 1,
    y: 1,
    special_effect: special,
    buildings: [
      {
        building_name: building,
        boost_score: boost,
        boost_score_update: new Date(Date.now() - 3_600_000).toISOString().slice(0, 19),
      },
    ],
  }) as unknown as Land

describe('hottestLands', () => {
  it('takes the top arenas and the top dungeons separately, across planets', () => {
    const lands = [
      land('a1', 'arena', 900_000, 'neri'),
      land('a2', 'arena', 800_000, 'magor'),
      land('a3', 'arena', 100_000, 'veles'),
      land('d1', 'dungeon', 950_000, 'eyeke'),
      land('d2', 'dungeons', 200_000, 'kavian'),
      land('d3', 'dungeon', 150_000, 'naron'),
    ]
    expect([...hottestLands(lands, 0, 2)].sort()).toEqual(['a1', 'a2', 'd1', 'd2'])
  })

  it('ranks by the live boost, after decay', () => {
    const fresh = land('fresh', 'arena', 500_000)
    const stale = {
      ...land('stale', 'arena', 600_000),
      buildings: [{ building_name: 'arena', boost_score: 600_000, boost_score_update: new Date(Date.now() - 10 * 3_600_000).toISOString().slice(0, 19) }],
    } as unknown as Land
    /* 20,000 an hour: ten hours takes the stale one from 6x down to 4x. */
    expect([...hottestLands([fresh, stale], 20_000, 1)]).toEqual(['fresh'])
  })

  it('leaves out taverns, portals and buildings too decayed to draw', () => {
    const lands = [
      land('t', 'tavern', 900_000),
      land('p', 'arena', 900_000, 'neri', 'tpmagor'),
      land('cold', 'arena', 5_000),
      land('ok', 'arena', 300_000),
    ]
    expect([...hottestLands(lands, 0)]).toEqual(['ok'])
  })
})
