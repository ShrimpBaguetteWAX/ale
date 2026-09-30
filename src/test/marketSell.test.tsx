import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { SellTab } from '@/routes/Market'
import type { RosterFighter } from '@/dungeon/types'
import type { MarketConfig } from '@/market/queries'

/**
 * The sell tab: choose on the page, agree the terms in a dialog.
 *
 * The listing form used to stand under a grid of every sellable fighter,
 * which on a real roster put the price box most of a screen below the
 * fighter being priced. What is pinned here is that the way into the terms
 * rides above the grid and only works once there is something to sell, that
 * the terms are not on the page until they are asked for, and that the
 * keep-if-nobody-bids flag — a second decision about a fighter the market
 * has already refused once — is not made on the seller's behalf.
 */

let id = 0
const fighter = (over: Partial<RosterFighter> = {}): RosterFighter =>
  ({
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
    stats: { level: 12, health_min: 400, health_max: 600, damage_min: 90, damage_max: 130 },
    ...over,
  }) as unknown as RosterFighter

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

const bar = (c: HTMLElement) => c.querySelector('.selltab__bar') as HTMLElement
const sellBtn = (c: HTMLElement) =>
  [...bar(c).querySelectorAll('button')].find((b) => b.textContent === 'Sell') as HTMLButtonElement

/* By name, never by position: the grid draws `applyFilter`'s order, not the
   order the fixtures were written in. */
const tile = (c: HTMLElement, classname: string) =>
  [...c.querySelectorAll('.sellpick__one')].find((t) =>
    t.textContent?.includes(classname),
  ) as HTMLElement

afterEach(cleanup)

describe('the sell tab', () => {
  it('waits for a fighter before it will sell one', () => {
    const { container, getByText } = draw([fighter(), fighter()])
    expect(sellBtn(container).disabled).toBe(true)
    getByText('Pick a fighter below to sell it.')
    /* Nothing follows you down the page while it can do nothing. */
    expect(bar(container).className).not.toContain('selltab__bar--pinned')
    expect(container.querySelector('.sheet')).toBeNull()
  })

  it('pins the bar to the fighter that was picked', () => {
    const { container } = draw([fighter(), fighter({ classname: 'Juggernaut' })])
    fireEvent.click(tile(container, 'Juggernaut'))

    expect(bar(container).className).toContain('selltab__bar--pinned')
    expect(bar(container).textContent).toContain('Juggernaut')
    expect(sellBtn(container).disabled).toBe(false)
  })

  it('keeps the terms off the page until they are asked for', () => {
    const { container, queryByText, getByText } = draw([fighter()])
    expect(queryByText(/Starting bid/)).toBeNull()

    fireEvent.click(tile(container, 'Hunter'))
    fireEvent.click(sellBtn(container))

    expect(container.querySelector('.sheet')).not.toBeNull()
    getByText(/Starting bid/)
    getByText(/List for 1 gems/)
  })

  /*
     Off unless the seller says so. It turns an auction nobody bid on into a
     fixed-price offer rather than handing the fighter back, which is not a
     decision to make for them because a box happened to be ticked.
  */
  it('starts with the keep-if-nobody-bids flag ticked', () => {
    const { container } = draw([fighter()])
    fireEvent.click(tile(container, 'Hunter'))
    fireEvent.click(sellBtn(container))

    const box = container.querySelector('.checkline input') as HTMLInputElement
    expect(box.checked).toBe(true)
  })

  it('carries the flag through to the listing when it is unticked', () => {
    const calls: unknown[][] = []
    const { container } = draw([fighter()], ((...a: unknown[]) => calls.push(a)) as never)

    fireEvent.click(tile(container, 'Hunter'))
    fireEvent.click(sellBtn(container))
    fireEvent.click(container.querySelector('.checkline input') as HTMLElement)
    fireEvent.click(container.querySelector('.sheet .btn--primary') as HTMLElement)

    expect(calls[0][2]).toBe(false)
  })

  it('lists the fighter the bar was showing', () => {
    const wanted = fighter({ classname: 'Arcanist' })
    const calls: unknown[][] = []
    const { container } = draw([fighter(), wanted], ((...a: unknown[]) =>
      calls.push(a)) as never)

    fireEvent.click(tile(container, 'Arcanist'))
    fireEvent.click(sellBtn(container))
    fireEvent.click(container.querySelector('.sheet .btn--primary') as HTMLElement)

    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe(wanted.fighter_id)
    expect(calls[0][2]).toBe(true)
  })

  it('says so plainly when there is nothing to sell', () => {
    const { container, getByText } = draw([])
    getByText(/None of your fighters can be listed right now/)
    expect(container.querySelector('.selltab__bar')).toBeNull()
  })
})
