import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { SellTab } from '@/routes/Market'
import type { RosterFighter } from '@/dungeon/types'
import type { MarketConfig } from '@/market/queries'

/**
 * The sell tab on a desktop: the roster on the left, the fighter being priced
 * in full in the middle, the terms beside it.
 *
 * What is pinned here is that the terms are always for the fighter on show —
 * the first one until another is picked, and exactly the one picked after —
 * that the price cannot be stepped under the market's minimum, and that the
 * keep-if-nobody-bids flag starts ticked and goes through as the seller
 * leaves it.
 */

let id = 0
/* The stats carry the class, race and element too, as a roster's do: the
   rows and the fighter in full are drawn from them. */
const fighter = (over: Partial<RosterFighter> = {}): RosterFighter => {
  const classname = over.classname ?? 'Hunter'
  return {
    fighter_id: ++id,
    owner: 'me.wam',
    classname: 'Hunter',
    racename: 'Elgem',
    element: 'nature',
    marker: '',
    active: 1,
    in_use: 0,
    use_type: '',
    creation_date: '2025-01-01T00:00:00',
    next_payday: '2999-01-01T00:00:00',
    ascension_level: 0,
    stats: {
      classname,
      racename: 'elgem',
      element: 'nature',
      level: 12,
      health_min: 400,
      health_max: 600,
      damage_min: 90,
      damage_max: 130,
    },
    ...over,
  } as unknown as RosterFighter
}

const CONFIG: MarketConfig = {
  index: 0,
  gems_listing_price: 1,
  standard_duration_minutes: 2880,
  reset_duration_below_minutes: 720,
  gems_min_start_bid: 10,
  gems_processing_fee_min: 1,
  gems_processing_fee_percent: 5,
  gems_instant_buy_price: 20,
  gems_min_bid_increase: 2,
  gems_min_bid_increase_percent: 10,
}

const PLAYER = { wallet: 'me.wam', activestats: { gems: 500 } } as never

const draw = (sellable: RosterFighter[], onList: (...a: never[]) => void = () => {}) =>
  render(
    <SellTab
      sellable={sellable}
      classes={new Map()}
      ageDecay={0}
      levelMod={1}
      config={CONFIG}
      player={PLAYER}
      busy={false}
      onInspect={() => {}}
      onList={onList as never}
    />,
  )

/* By name, never by position: the list draws `applyFilter`'s order, not the
   order the fixtures were written in. */
const row = (c: HTMLElement, classname: string) =>
  [...c.querySelectorAll('.mdesk .mrow')].find((r) =>
    r.querySelector('b')?.textContent === classname,
  )?.querySelector('.mrow__hit') as HTMLElement
const shown = (c: HTMLElement) => c.querySelector('.mfighter__name')?.textContent
const listBtn = (c: HTMLElement) => c.querySelector('.mdeal .btn--primary') as HTMLButtonElement
const keepBox = (c: HTMLElement) => c.querySelector('.mdeal .msell__keep input') as HTMLInputElement

afterEach(cleanup)

describe('the sell tab', () => {
  it('shows a fighter and its terms from the start', () => {
    const { container } = draw([fighter(), fighter()])
    expect(shown(container)).toBe('Hunter')
    expect(listBtn(container).disabled).toBe(false)
    expect(listBtn(container).textContent).toContain('List for 10')
  })

  it('shows the fighter that was picked', () => {
    const { container } = draw([fighter(), fighter({ classname: 'Juggernaut' })])
    fireEvent.click(row(container, 'Juggernaut'))

    expect(shown(container)).toBe('Juggernaut')
    expect(container.querySelector('.mdesk .mrow.is-open b')?.textContent).toBe('Juggernaut')
  })

  it('will not step the price under the minimum start', () => {
    const { container } = draw([fighter()])
    const less = container.querySelector('.mdeal .mstep__btn') as HTMLButtonElement
    expect(less.disabled).toBe(true)

    const quick = [...container.querySelectorAll('.mdeal .msell__quick button')]
    fireEvent.click(quick.find((b) => b.textContent === '25') as HTMLElement)
    expect(listBtn(container).textContent).toContain('List for 25')
    expect(less.disabled).toBe(false)
  })

  /*
     On unless the seller says otherwise: an unsold fighter staying up at
     the price its seller already chose is the outcome most of them want,
     and the switch is right there to turn off.
  */
  it('starts with the keep-if-nobody-bids flag ticked', () => {
    const { container } = draw([fighter()])
    expect(keepBox(container).checked).toBe(true)
  })

  it('carries the flag through to the listing when it is unticked', () => {
    const calls: unknown[][] = []
    const { container } = draw([fighter()], ((...a: unknown[]) => calls.push(a)) as never)

    fireEvent.click(keepBox(container))
    fireEvent.click(listBtn(container))

    expect(calls[0][2]).toBe(false)
  })

  it('lists the fighter on show', () => {
    const wanted = fighter({ classname: 'Arcanist' })
    const calls: unknown[][] = []
    const { container } = draw([fighter(), wanted], ((...a: unknown[]) =>
      calls.push(a)) as never)

    fireEvent.click(row(container, 'Arcanist'))
    fireEvent.click(listBtn(container))

    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe(wanted.fighter_id)
    expect(calls[0][1]).toBe(10)
    expect(calls[0][2]).toBe(true)
  })

  it('says so plainly when there is nothing to sell', () => {
    const { container, getByText } = draw([])
    getByText(/None of your fighters can be listed right now/)
    expect(container.querySelector('.mdesk')).toBeNull()
  })
})
