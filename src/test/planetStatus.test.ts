import { describe, expect, it } from 'vitest'
import { summarisePlanet } from '@/map/planetStatus'
import type { Land, Player } from '@/chain/types'

/**
 * The counts on the planet pill say what the map shows.
 *
 * A dungeon or arena whose boost has decayed under the map's floor is not
 * drawn, so it must not be counted either — a "12 dungeons" that includes
 * three the player cannot find on the map is a number that lies.
 */
/* Boost in the contract's unit: 10,000 is 1x, 1,000 is 0.1x. Written `hoursAgo` ago. */
const land = (id: string, building: string, boost: number, hoursAgo = 1): Land =>
  ({
    land_id: id,
    planet: 'neri',
    x: 1,
    y: 1,
    asset_id: id,
    buildings: [
      {
        building_name: building,
        boost_score: boost,
        boost_score_update: new Date(Date.now() - hoursAgo * 3_600_000).toISOString().slice(0, 19),
      },
    ],
  }) as unknown as Land

const player = {
  wallet: 'qa.wam',
  active_taverns: [],
  last_tavern: null,
  played_dungeons: '',
  last_dungeon_reset: '2000-01-01T00:00:00',
} as unknown as Player

describe('summarisePlanet', () => {
  it('counts every dungeon and arena when nothing has decayed', () => {
    const s = summarisePlanet(
      'neri',
      [land('1', 'dungeon', 350_000), land('2', 'dungeon', 2_000), land('3', 'arena', 1_000)],
      player,
      new Set(),
      [],
      0,
    )
    expect(s.dungeonsTotal).toBe(2)
    expect(s.dungeonsOpen).toBe(2)
    expect(s.arenasTotal).toBe(1)
    expect(s.arenasOpen).toBe(1)
  })

  it('leaves out what the map hides: a boost under 0.1x, as it stands now', () => {
    const s = summarisePlanet(
      'neri',
      [
        land('1', 'dungeon', 350_000),
        /* Stored at 2x ten hours ago, decaying 1,500 an hour: 0.5x now. */
        land('2', 'dungeon', 20_000, 10),
        /* Stored at 2x twenty hours ago: gone to nothing. */
        land('3', 'dungeon', 20_000, 20),
        land('4', 'arena', 0),
        land('5', 'arena', 1_000, 0),
      ],
      player,
      new Set(),
      [],
      1_500,
    )
    expect(s.dungeonsTotal).toBe(2)
    expect(s.dungeonsOpen).toBe(2)
    expect(s.arenasTotal).toBe(1)
    expect(s.arenasOpen).toBe(1)
  })

  it('still marks a shown dungeon as run today', () => {
    const s = summarisePlanet(
      'neri',
      [land('1', 'dungeon', 350_000), land('2', 'dungeon', 350_000)],
      player,
      new Set(['neri.2']),
      [],
      0,
    )
    expect(s.dungeonsTotal).toBe(2)
    expect(s.dungeonsOpen).toBe(1)
  })
})
