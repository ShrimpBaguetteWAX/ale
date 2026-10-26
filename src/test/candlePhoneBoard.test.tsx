import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { WhoBoard } from '@/candle/PhoneCandle'
import type { CandleOffer, Contribution } from '@/candle/types'
import type { Player } from '@/chain/types'

/**
 * The phone's contributors board, on the page under the contribution.
 *
 * What each contributor would take is the pot split by gems, and with gems
 * picked every share is of the pot plus those gems — so the player's row is
 * drawn as it would be after, and everyone else's shrinks.
 */
const offer = {
  offer_id: 'aaa3emtd3a',
  requirements: 'Damage Resisted',
  total_gems: 210,
  reward_type: 'shards',
  reward_amount: 380_890,
} as CandleOffer

const stakes: Contribution[] = [
  { offer_id: offer.offer_id, wallet: 'pombe.wam', amount: 101 },
  { offer_id: offer.offer_id, wallet: 'tbgo2.c.wam', amount: 100 },
  { offer_id: offer.offer_id, wallet: 'rubillo15.wam', amount: 9 },
]
const player = { wallet: 'someone.wam' } as Player
const board = (amount: number, mine = 0) =>
  render(
    <WhoBoard
      offer={offer}
      board={{ stakes, contributors: 3, mine }}
      player={player}
      amount={amount}
      tags={{ 'pombe.wam': 'PombeЯ' }}
      avatars={{}}
    />,
  )
const rows = (c: HTMLElement) => [...c.querySelectorAll('.pcandle__whorow:not(.pcandle__whorow--head)')]

afterEach(cleanup)

describe("the phone's contributors board", () => {
  it('lists everyone biggest first, by tag, with what each takes', () => {
    const { container } = board(0)
    const r = rows(container)
    expect(r).toHaveLength(3)
    expect(r[0].textContent).toContain('PombeЯ')
    /* 101 of 210 gems of a 38,089-shard pot. */
    expect(r[0].textContent).toContain('48.1%')
    /* 18,318.99… cut, not rounded. */
    expect(r[0].querySelector('.pcandle__gems')?.textContent).toBe('18,318')
    expect(container.querySelector('.is-you')).toBeNull()
  })

  it("draws the player's row as it would be with the picked gems", () => {
    const { container } = board(250)
    const you = container.querySelector('.pcandle__whorow.is-you')
    expect(you).not.toBeNull()
    /* 250 of 460: 54.3%, and 20,700 of the 38,089 cut rather than rounded. */
    expect(you?.textContent).toContain('54.3%')
    expect(you?.querySelector('.pcandle__gems')?.textContent).toBe('20,700')
    expect(rows(container)[0]).toBe(you)
    /* The rest shrink: 101 of 460. */
    expect(rows(container)[1].textContent).toContain('22.0%')
  })

  it('adds the picked gems to a stake the player already has', () => {
    const { container } = render(
      <WhoBoard
        offer={{ ...offer, total_gems: 250 }}
        board={{ stakes: [...stakes, { offer_id: offer.offer_id, wallet: 'someone.wam', amount: 40 }], contributors: 4, mine: 40 }}
        player={player}
        amount={50}
        tags={{}}
        avatars={{}}
      />,
    )
    /* One row for the player, not two: 40 in plus 50 picked, of 300. */
    const you = container.querySelectorAll('.pcandle__whorow.is-you')
    expect(you).toHaveLength(1)
    expect(you[0].textContent).toContain('30.0%')
  })
})
