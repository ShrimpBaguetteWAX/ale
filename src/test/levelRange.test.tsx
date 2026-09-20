import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LevelRange } from '@/fight/LevelRange'

/**
 * The level range auto-pick draws from: one slider with an end at each side.
 *
 * What these pin is that the ends cannot cross, and that a press on the track
 * moves the nearer one — the track takes the press itself, so one that misses
 * a handle does not fall through to the menu the slider sits in.
 */
const ends = () => screen.getAllByRole('slider') as HTMLInputElement[]

/* The track, at a width jsdom will not measure on its own. */
const track = (width = 100) => {
  const el = document.querySelector('.lvlrange__track') as HTMLDivElement
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 0, width } as DOMRect)
  return el
}

describe('level range', () => {
  it('moves each end on its own', () => {
    const onChange = vi.fn()
    render(<LevelRange value={{ min: 1, max: 9 }} onChange={onChange} />)
    const [low, high] = ends()
    expect([low.value, high.value]).toEqual(['1', '9'])

    fireEvent.change(low, { target: { value: '4' } })
    expect(onChange).toHaveBeenLastCalledWith({ min: 4, max: 9 })

    fireEvent.change(high, { target: { value: '6' } })
    expect(onChange).toHaveBeenLastCalledWith({ min: 1, max: 6 })
  })

  it('stops an end beside the other rather than past it', () => {
    const onChange = vi.fn()
    render(<LevelRange value={{ min: 3, max: 6 }} onChange={onChange} />)
    const [low, high] = ends()

    fireEvent.change(low, { target: { value: '9' } })
    expect(onChange).toHaveBeenLastCalledWith({ min: 6, max: 6 })

    fireEvent.change(high, { target: { value: '1' } })
    expect(onChange).toHaveBeenLastCalledWith({ min: 3, max: 3 })
  })

  it('moves the nearer end to a press on the track', () => {
    const onChange = vi.fn()
    render(<LevelRange value={{ min: 2, max: 8 }} onChange={onChange} />)

    /* Level 1 is nearest the low end: 0% of a 100px track. */
    fireEvent.pointerDown(track(), { clientX: 0 })
    expect(onChange).toHaveBeenLastCalledWith({ min: 1, max: 8 })

    /* Level 10, at the far side, is nearest the high end. */
    fireEvent.pointerDown(track(), { clientX: 100 })
    expect(onChange).toHaveBeenLastCalledWith({ min: 2, max: 10 })
  })

  it('keeps a press inside the levels, however far past the end it lands', () => {
    const onChange = vi.fn()
    render(<LevelRange value={{ min: 4, max: 5 }} onChange={onChange} />)
    fireEvent.pointerDown(track(), { clientX: -40 })
    expect(onChange).toHaveBeenLastCalledWith({ min: 1, max: 5 })
    fireEvent.pointerDown(track(), { clientX: 400 })
    expect(onChange).toHaveBeenLastCalledWith({ min: 4, max: 10 })
  })
})
