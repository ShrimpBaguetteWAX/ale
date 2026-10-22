import { describe, expect, it } from 'vitest'
import { hottestLands } from '@/map/hot'
import type { Land } from '@/chain/types'

/* Boost in the contract's unit: 100,000 is 1x. Written `hoursAgo` ago. */
const land = (id: string, building: string, boost: number, special = '', hoursAgo = 1): Land =>
  ({
    land_id: id,
    x: 1,
    y: 1,
    special_effect: special,
    buildings: [
      {
        building_name: building,
        boost_score: boost,
        boost_score_update: new Date(Date.now() - hoursAgo * 3_600_000).toISOString().slice(0, 19),
      },
    ],
  }) as unknown as Land

describe('hottestLands', () => {
  it('takes the top arenas and the top dungeons separately, across planets', () => {
    const hot = hottestLands(
      {
        neri: [land('a1', 'arena', 900_000), land('d3', 'dungeon', 150_000)],
        magor: [land('a2', 'arena', 800_000)],
        veles: [land('a3', 'arena', 100_000)],
        eyeke: [land('d1', 'dungeon', 950_000)],
        kavian: [land('d2', 'dungeons', 200_000)],
      },
      0,
      2,
    )
    expect([...hot].sort()).toEqual(['eyeke:d1', 'kavian:d2', 'magor:a2', 'neri:a1'])
  })

  it('tells the same land id apart on different planets', () => {
    /* A land id is the tile's coordinates: the same one exists on every planet. */
    const hot = hottestLands({ neri: [land('bexb', 'dungeon', 900_000)], magor: [land('bexb', 'dungeon', 100_000)] }, 0, 1)
    expect([...hot]).toEqual(['neri:bexb'])
  })

  it('ranks by the live boost, after decay', () => {
    /* 20,000 an hour: ten hours takes the stale one from 6x down to 4x. */
    const hot = hottestLands({ neri: [land('fresh', 'arena', 500_000), land('stale', 'arena', 600_000, '', 10)] }, 20_000, 1)
    expect([...hot]).toEqual(['neri:fresh'])
  })

  it('leaves out taverns, portals and buildings too decayed to draw', () => {
    const hot = hottestLands(
      { neri: [land('t', 'tavern', 900_000), land('p', 'arena', 900_000, 'tpmagor'), land('cold', 'arena', 5_000), land('ok', 'arena', 300_000)] },
      0,
    )
    expect([...hot]).toEqual(['neri:ok'])
  })
})
