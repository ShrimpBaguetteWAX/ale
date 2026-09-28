import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { Mission } from '@/routes/Candle'
import type { CandleOffer } from '@/candle/types'
import type { Player } from '@/chain/types'

/**
 * The three things about the machine that only exist on screen.
 *
 * Its shape is checked by eye against the SSR preview, but a preview has no
 * clicks: it cannot show that the cabinet folds, that a player short of the
 * requirement is refused the hopper, or that the player count still opens
 * the board. Those are here.
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

const machine = (over: Partial<Parameters<typeof Mission>[0]> = {}) =>
  render(
    <Mission
      offer={offer}
      player={player(7_400)}
      mine={900}
      stakes={[]}
      contributors={37}
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

describe('the machine', () => {
  it('opens folded, and unfolds when the sign is pressed', () => {
    const { container, getByLabelText } = machine()
    /* A screen of missions is a list first: see the note on the state. */
    expect(container.querySelector('.mach--shut')).not.toBeNull()
    /* The body is still in the document — it is the class that hides it —
       so what is asserted is the state, not the absence of nodes. */
    expect(container.querySelector('.mach__mini')).not.toBeNull()

    fireEvent.click(getByLabelText('Expand mission'))
    expect(container.querySelector('.mach--shut')).toBeNull()

    fireEvent.click(getByLabelText('Collapse mission'))
    expect(container.querySelector('.mach--shut')).not.toBeNull()
  })

  it('says nothing about a requirement the player has cleared', () => {
    const { container } = machine()
    expect(container.querySelector('.mach__gate')).toBeNull()
    expect(container.querySelector('.mach--barred')).toBeNull()
  })

  it('shuts the hopper and says what is short when they have not', () => {
    const { container, getByText } = machine({ player: player(2_400), mine: 0 })
    expect(container.querySelector('.mach--barred')).not.toBeNull()
    expect(getByText(/2,600 short/)).toBeTruthy()
    expect(container.querySelector('.mach__in')).toHaveProperty('disabled', true)
    expect(getByText('Locked')).toBeTruthy()
  })

  it('counts up to the start rather than down to the close before it opens', () => {
    const soon = { ...offer, offer_start: iso(2 * 3_600_000), offer_end: iso(11 * 3_600_000) }
    const { container, getByText } = machine({ offer: soon as CandleOffer, mine: 0 })
    expect(container.querySelector('.mach--soon')).not.toBeNull()
    expect(getByText('Opens in')).toBeTruthy()
    expect(getByText('Not open yet')).toBeTruthy()
    expect(container.querySelector('.mach__empty')).not.toBeNull()
  })

  it('opens the board from the player count, and does not offer it when nobody is in', () => {
    const { container, getByTitle } = machine()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    fireEvent.click(getByTitle('See who has contributed and how much'))
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    cleanup()

    const empty = machine({ contributors: 0 })
    expect(empty.container.querySelector('.mach__who')).toHaveProperty('disabled', true)
  })

  it('prices the contribution only once there is one to price', () => {
    const quiet = machine()
    expect(quiet.container.querySelectorAll('.mach__after')).toHaveLength(0)
    cleanup()

    const typing = machine({ gems: '500', amount: 500 })
    expect(typing.container.querySelectorAll('.mach__after')).toHaveLength(2)
  })
})
