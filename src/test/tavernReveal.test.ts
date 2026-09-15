import { describe, expect, it } from 'vitest'
import { unrevealedTavernHere } from '@/tavern/rules'
import { landId } from '@/chain/landId'
import type { Player, Tavern } from '@/chain/types'

const HERE = { x: 3, y: 4 }
const here = landId(HERE.x, HERE.y)

const tavern = (over: Partial<Tavern> = {}): Tavern =>
  ({ planet: 'eyeke', x: HERE.x, y: HERE.y, land_id: here, objectives: [], ...over }) as Tavern

const player = (over: {
  legend?: boolean
  active?: Tavern[]
  last?: Partial<Tavern>
  planet?: string
}): Player =>
  ({
    planet: over.planet ?? 'eyeke',
    ...HERE,
    legend_access_expiry: over.legend ? '2999-01-01T00:00:00' : '2000-01-01T00:00:00',
    active_taverns: over.active ?? [],
    last_tavern: { planet: '', land_id: '', ...over.last },
  }) as unknown as Player

describe('unrevealedTavernHere', () => {
  it('finds the active tavern a trial player is standing on', () => {
    expect(unrevealedTavernHere(player({ active: [tavern()] }))?.land_id).toBe(here)
  })

  it('leaves legend players exactly as they were', () => {
    expect(unrevealedTavernHere(player({ legend: true, active: [tavern()] }))).toBeUndefined()
  })

  it('is nothing once this tavern is already the last_tavern', () => {
    expect(
      unrevealedTavernHere(
        player({ active: [tavern()], last: { planet: 'eyeke', land_id: here } }),
      ),
    ).toBeUndefined()
  })

  it('ignores a stale last_tavern from somewhere else', () => {
    expect(
      unrevealedTavernHere(
        player({ active: [tavern()], last: { planet: 'eyeke', land_id: 'elsewhere' } }),
      )?.land_id,
    ).toBe(here)
  })

  it('needs the same planet, as users::setreveal does', () => {
    expect(unrevealedTavernHere(player({ planet: 'kavian', active: [tavern()] }))).toBeUndefined()
  })

  it('is nothing on a land with no tavern of the player', () => {
    expect(unrevealedTavernHere(player({ active: [tavern({ land_id: 'other' })] }))).toBeUndefined()
  })
})
