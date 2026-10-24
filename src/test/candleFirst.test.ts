import { describe, expect, it } from 'vitest'
import { firstMission } from '@/candle/rules'
import type { Player } from '@/chain/types'
import type { CandleOffer } from '@/candle/types'

/* Only what `eligibility` reads: the gate and the player's lifetime counter. */
const offer = (id: string, need: number) =>
  ({ offer_id: id, requirement_type: 'arenas_won', requirement_amount: need }) as unknown as CandleOffer
const player = { permstats: [{ first: 'arenas_won', second: 20 }] } as unknown as Player

describe('firstMission', () => {
  it('opens on the first running mission the player can enter', () => {
    expect(firstMission([offer('locked', 125), offer('open', 15)], [], player)?.offer_id).toBe('open')
  })

  it('falls back to the first running one, then the next to open', () => {
    expect(firstMission([offer('locked', 125)], [offer('soon', 1)], player)?.offer_id).toBe('locked')
    expect(firstMission([], [offer('soon', 1)], player)?.offer_id).toBe('soon')
    expect(firstMission([], [], player)).toBeUndefined()
  })
})
