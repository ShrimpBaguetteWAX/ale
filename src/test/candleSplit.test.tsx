import { describe, expect, it, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { Mission } from '@/routes/Candle'
import type { CandleOffer, Contribution } from '@/candle/types'
import type { Player } from '@/chain/types'

/**
 * The things about the split that only exist on screen.
 *
 * Its shape is checked by eye against the harness, but a harness has no
 * assertions: it cannot show that the bar is drawn from the board, that a
 * player short of the requirement is refused the control, that the slider
 * and the box write the same draft, or that the pending slice appears only
 * once there is something to price. Those are here.
 */
const NOW = Date.parse('2026-09-27T12:00:00Z')
const iso = (ms: number) => new Date(NOW + ms).toISOString().slice(0, 19)

const offer: CandleOffer = {
  offer_id: 'aaa3emtd3a',
  offer_start: iso(-6 * 3_600_000),
  offer_end: iso(9 * 3_600_000),
  requirements: 'Energy saved in Taverns',
  requirement_type: 'tavern_energy_saved',
  requirement_amount: 5_000,
  total_gems: 18_400,
  reward_type: 'tlm',
  reward_amount: 124_500_000,
} as CandleOffer

const player = (saved: number) =>
  ({
    wallet: 'someone.wam',
    playertag: 'Someone',
    activestats: { gems: 4_200, credits: 0, action_points: 0 },
    permstats: [{ first: 'tavern_energy_saved', second: saved }],
  }) as unknown as Player

const stakes: Contribution[] = [
  { offer_id: offer.offer_id, wallet: 'whale.wam', amount: 9_000 },
  { offer_id: offer.offer_id, wallet: 'someone.wam', amount: 900 },
  { offer_id: offer.offer_id, wallet: 'other.wam', amount: 8_500 },
]

const split = (over: Partial<Parameters<typeof Mission>[0]> = {}) =>
  render(
    <Mission
      offer={offer}
      player={player(7_400)}
      mine={900}
      stakes={stakes}
      contributors={3}
      now={NOW}
      balance={4_200}
      gems=""
      amount={0}
      busy={null}
      canAct
      onGems={() => {}}
      onContribute={() => {}}
      {...over}
    />,
  )

afterEach(cleanup)

describe('the split', () => {
  it('draws one slice per stake, biggest first, with the player marked', () => {
    const { container } = split()
    const segs = [...container.querySelectorAll('.split__seg')]
    expect(segs).toHaveLength(3)
    /* 9,000 of 18,400 leads; the player's 900 is last and teal. */
    expect(segs[0].textContent).toMatch(/^1\. whale\.wam/)
    expect(segs[0].textContent).toContain('48.9%')
    expect(segs[2].classList.contains('split__seg--you')).toBe(true)
    expect(segs[2].textContent).toMatch(/^3\. you/)
    /* Nothing pending: no ghost, no projection. */
    expect(container.querySelector('.split__seg--ghost')).toBeNull()
    expect(container.querySelector('.split__after')).toBeNull()
  })

  it('names a slice by tag when the screen has one', () => {
    const { container } = split({ tags: { 'whale.wam': 'Vornax' } })
    expect(container.querySelector('.split__seg')?.textContent).toMatch(/^1\. Vornax/)
  })

  it('adds a ghost slice and prices the contribution once there is one', () => {
    const { container } = split({ gems: '1000', amount: 1_000 })
    const ghost = container.querySelector('.split__seg--ghost')
    expect(ghost).not.toBeNull()
    /* Every slice is a share of pot plus pending: 1,000 of 19,400. */
    expect((ghost as HTMLElement).style.flexBasis).toMatch(/^5\.15/)
    expect(container.querySelector('.split__after')?.textContent).toContain('Your share after')
    expect(container.querySelector('.split__after')?.textContent).toContain('Worth per gem after')
  })

  it('writes the same draft from the slider and from the box', () => {
    const onGems = vi.fn()
    const { getByLabelText } = split({ onGems })
    fireEvent.change(getByLabelText('Gems to contribute'), { target: { value: '750' } })
    fireEvent.change(getByLabelText('Gems to contribute, exactly'), { target: { value: '12' } })
    expect(onGems).toHaveBeenNthCalledWith(1, '750')
    expect(onGems).toHaveBeenNthCalledWith(2, '12')
  })

  it('says qualified when the requirement is cleared, and how far past it', () => {
    const { container } = split()
    const ok = container.querySelector('.split__gate--ok')
    expect(ok).not.toBeNull()
    expect(ok?.getAttribute('title')).toBe(
      'Needs 5,000 lifetime energy saved in taverns — you have 7,400',
    )
    expect(container.querySelector('.split--locked')).toBeNull()
  })

  it('locks the control and says what is short when it is not', () => {
    const { container, getByText, getByLabelText } = split({
      player: player(2_400),
      mine: 0,
      gems: '500',
      amount: 500,
    })
    expect(container.querySelector('.split--locked')).not.toBeNull()
    expect(getByText(/2,600 short/)).toBeTruthy()
    expect(getByLabelText('Gems to contribute')).toHaveProperty('disabled', true)
    expect(getByLabelText('Gems to contribute, exactly')).toHaveProperty('disabled', true)
    expect(getByText('Locked')).toBeTruthy()
    /* A locked mission has nothing to project, whatever is in the box. */
    expect(container.querySelector('.split__seg--ghost')).toBeNull()
    expect(container.querySelector('.split__after')).toBeNull()
  })

  it('counts up to the start rather than down to the close before it opens', () => {
    const soon = { ...offer, offer_start: iso(2 * 3_600_000), offer_end: iso(11 * 3_600_000) }
    const { container, getByText } = split({ offer: soon as CandleOffer, mine: 0 })
    expect(container.querySelector('.split--soon')).not.toBeNull()
    expect(getByText('Opens in')).toBeTruthy()
    expect(getByText('Not open yet')).toBeTruthy()
  })

  it('opens the board from the player count, and does not offer it when nobody is in', () => {
    const { container, getByTitle } = split()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    fireEvent.click(getByTitle('See who has contributed and how much'))
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    cleanup()

    const empty = split({ stakes: [], contributors: 0, offer: { ...offer, total_gems: 0 } })
    expect(empty.container.querySelector('.split__who')).toHaveProperty('disabled', true)
    expect(empty.container.querySelector('.split__none')?.textContent).toContain('Nobody has contributed yet')
  })

  it('draws a pot whose board has not arrived as one plain slice', () => {
    const { container } = split({ stakes: [] })
    const segs = container.querySelectorAll('.split__seg')
    expect(segs).toHaveLength(1)
    expect((segs[0] as HTMLElement).style.flexBasis).toBe('100%')
  })
})
