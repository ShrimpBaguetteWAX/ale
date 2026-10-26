import { describe, expect, it, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { Contribute, Dossier } from '@/candle/DeskCandle'
import type { CandleOffer, Contribution } from '@/candle/types'
import type { Player } from '@/chain/types'

/**
 * The things about the desktop mission board that only exist on screen.
 *
 * Its shape is checked by eye against the harness, but a harness has no
 * assertions: it cannot show that the bar and the board are drawn from the
 * stakes, that a player short of the requirement is refused the control, that
 * the slider and the box write the same draft, or that the pending gems are
 * drawn in only once there is something to price. Those are here.
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
const board = { stakes, contributors: 3, mine: 900 }

const dossier = (over: Partial<Parameters<typeof Dossier>[0]> = {}) =>
  render(<Dossier offer={offer} board={board} player={player(7_400)} now={NOW} amount={0} {...over} />)

const contribute = (over: Partial<Parameters<typeof Contribute>[0]> = {}) =>
  render(
    <Contribute
      offer={offer}
      board={board}
      player={player(7_400)}
      now={NOW}
      balance={4_200}
      draft=""
      onDraft={() => {}}
      busy={null}
      canAct
      onContribute={() => {}}
      {...over}
    />,
  )

afterEach(cleanup)

describe('the mission in full', () => {
  it('draws one slice and one row per stake, biggest first, with the player marked', () => {
    const { container } = dossier()
    const segs = [...container.querySelectorAll('.dcan__seg')]
    expect(segs).toHaveLength(3)
    /* 9,000 of 18,400 leads; the player's 900 is last. */
    expect(segs[0].getAttribute('title')).toMatch(/^1\. whale\.wam · 48\.9%/)
    expect(segs[2].classList.contains('dcan__seg--you')).toBe(true)
    const rows = [...container.querySelectorAll('.dcan__row:not(.dcan__row--head)')]
    expect(rows).toHaveLength(3)
    expect(rows[2].classList.contains('is-you')).toBe(true)
    /* Nothing pending: no ghost. */
    expect(container.querySelector('.dcan__seg--ghost')).toBeNull()
  })

  it('names a row by tag when the screen has one', () => {
    const { container } = dossier({ tags: { 'whale.wam': 'Vornax' } })
    expect(container.querySelector('.dcan__row:not(.dcan__row--head) .dcan__name')?.textContent).toBe('Vornax')
  })

  it('draws the pending gems in, and every share against pot plus pending', () => {
    const { container } = dossier({ amount: 1_000 })
    const ghost = container.querySelector('.dcan__seg--ghost') as HTMLElement
    expect(ghost).not.toBeNull()
    /* 1,000 of 19,400. */
    expect(ghost.style.flexBasis).toMatch(/^5\.15/)
    /* The player's row is what it would be after: 900 + 1,000 of 19,400. */
    const you = container.querySelector('.dcan__row.is-you')
    expect(you?.textContent).toContain('1,900')
    expect(you?.textContent).toContain('9.8%')
  })

  it('does not draw pending gems into a mission the player is locked out of', () => {
    const { container } = dossier({ player: player(2_400), amount: 500 })
    expect(container.querySelector('.dcan__seg--ghost')).toBeNull()
  })

  it('draws a pot whose board has not arrived as one plain slice', () => {
    const { container } = dossier({ board: { stakes: [], contributors: 0, mine: 0 } })
    const segs = container.querySelectorAll('.dcan__seg')
    expect(segs).toHaveLength(1)
    expect((segs[0] as HTMLElement).style.flexBasis).toBe('100%')
  })

  it('says nobody is in yet on an empty pot', () => {
    const { container } = dossier({ board: { stakes: [], contributors: 0, mine: 0 }, offer: { ...offer, total_gems: 0 } })
    expect(container.querySelector('.dcan__none')?.textContent).toContain('Nobody has contributed yet')
  })

  it('says qualified when the requirement is cleared, and how far past it', () => {
    const { container } = dossier()
    expect(container.querySelector('.dcan__gate.is-ok')?.getAttribute('title')).toBe(
      'Needs 5,000 lifetime energy saved in taverns — you have 7,400',
    )
  })
})

describe('contributing', () => {
  it('writes the same draft from the slider, the box and the quick amounts', () => {
    const onDraft = vi.fn()
    const { getByLabelText, getByText } = contribute({ onDraft })
    fireEvent.change(getByLabelText('Gems to contribute'), { target: { value: '750' } })
    fireEvent.change(getByLabelText('Gems to contribute, exactly'), { target: { value: '12' } })
    fireEvent.click(getByText('250'))
    expect(onDraft).toHaveBeenNthCalledWith(1, '750')
    expect(onDraft).toHaveBeenNthCalledWith(2, '12')
    expect(onDraft).toHaveBeenNthCalledWith(3, '250')
  })

  it('prices a contribution once there is one', () => {
    const { container, getByText } = contribute({ draft: '1000' })
    expect(container.querySelector('.dcan__after')?.textContent).toContain('A gem buys after')
    expect(getByText("You'd take at close")).toBeTruthy()
    expect(getByText('Contribute 1,000 gems')).toBeTruthy()
  })

  it('locks the control and shows how far along the requirement the player is', () => {
    const { container, getByText, getByRole, queryByLabelText } = contribute({ player: player(2_400), draft: '500' })
    expect(container.querySelector('.is-locked')).not.toBeNull()
    expect(getByText('2,400 / 5,000')).toBeTruthy()
    expect(queryByLabelText('Gems to contribute')).toBeNull()
    expect(getByRole('button', { name: 'Locked' })).toHaveProperty('disabled', true)
  })

  it('counts up to the start rather than down to the close before it opens', () => {
    const soon = { ...offer, offer_start: iso(2 * 3_600_000), offer_end: iso(11 * 3_600_000) } as CandleOffer
    const { getByText } = contribute({ offer: soon })
    expect(getByText('Opens in')).toBeTruthy()
    expect(getByText('Not open yet')).toHaveProperty('disabled', true)
  })

  it('refuses more gems than the player holds', () => {
    const { getByText } = contribute({ draft: '5000' })
    expect(getByText('That is more gems than you hold.')).toBeTruthy()
    expect(getByText('Contribute 5,000 gems')).toHaveProperty('disabled', true)
  })
})
