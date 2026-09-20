import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AutoPickSplit } from '@/fight/AutoPickSplit'
import { keptFighters } from '@/fight/autopickModes'
import type { RosterFighter } from '@/dungeon/types'

/**
 * The switch on the picking half: fill the empty slots, or replace the team.
 *
 * What these pin is that the button says what it is about to do, that filling
 * keeps the fighters already chosen and hands the screen only the slots left
 * over, and that Undo puts back exactly what was there.
 */

let id = 0
const fighter = (level: number, over: Partial<RosterFighter> = {}): RosterFighter =>
  ({
    fighter_id: ++id,
    marker: '',
    in_use: 0,
    use_type: '',
    next_payday: '2999-01-01T00:00:00',
    stats: { level },
    ...over,
  }) as unknown as RosterFighter

const roster = [fighter(3), fighter(4), fighter(5), fighter(6), fighter(7), fighter(8), fighter(9)]
const onMarket = fighter(5, { in_use: 1, use_type: 'Market' })
/* The picking half; the mode button beside it mentions auto-pick too. */
const go = () => document.querySelector('.autosplit__go') as HTMLButtonElement

beforeEach(() => {
  localStorage.clear()
})

describe('keptFighters', () => {
  it('keeps the fighters of the team that can still fight', () => {
    const team = [roster[0].fighter_id, onMarket.fighter_id, 999]
    expect(keptFighters([...roster, onMarket], team)).toEqual([roster[0].fighter_id])
  })
})

describe('the fill and replace switch', () => {
  it('is put away while there is nothing to keep', () => {
    render(<AutoPickSplit roster={roster} teamIds={[]} teamSize={5} onPick={() => 5} />)
    expect(go()).toHaveTextContent(/auto-pick/i)
    expect(screen.queryByRole('group', { name: /what auto-pick does/i })).toBeNull()
  })

  it('says how many slots it will fill, and fills only those', () => {
    const onPick = vi.fn().mockReturnValue(3)
    const team = [roster[0].fighter_id, roster[1].fighter_id]
    render(<AutoPickSplit roster={roster} teamIds={team} teamSize={5} onPick={onPick} />)

    expect(go()).toHaveTextContent('Fill 3 empty slots')
    fireEvent.click(go())
    expect(onPick).toHaveBeenCalledWith(expect.anything(), team)
    expect(screen.getByRole('status')).toHaveTextContent('Filled 3.')
  })

  it('replaces the whole team on the other side of the switch', () => {
    const onPick = vi.fn().mockReturnValue(5)
    const team = [roster[0].fighter_id, roster[1].fighter_id]
    render(<AutoPickSplit roster={roster} teamIds={team} teamSize={5} onPick={onPick} />)

    fireEvent.click(screen.getByTitle(/replace all 5 fighters/i))
    expect(go()).toHaveTextContent('Replace all 5')
    fireEvent.click(go())
    /* Nothing is kept, so the screen is free to place all five. */
    expect(onPick).toHaveBeenCalledWith(expect.anything(), [])
  })

  it('will not pretend to fill a full team', () => {
    const onPick = vi.fn()
    render(
      <AutoPickSplit roster={roster} teamIds={roster.slice(0, 5).map((f) => f.fighter_id)} teamSize={5} onPick={onPick} />,
    )
    expect(go()).toHaveTextContent('No empty slots')
    expect(go()).toBeDisabled()

    fireEvent.click(screen.getByTitle(/replace all 5 fighters/i))
    expect(go()).toBeEnabled()
    fireEvent.click(go())
    expect(onPick).toHaveBeenCalledWith(expect.anything(), [])
  })

  it('counts a fighter that can no longer fight as an empty slot', () => {
    const onPick = vi.fn().mockReturnValue(4)
    const team = [roster[0].fighter_id, onMarket.fighter_id]
    render(<AutoPickSplit roster={[...roster, onMarket]} teamIds={team} teamSize={5} onPick={onPick} />)

    expect(go()).toHaveTextContent('Fill 4 empty slots')
    fireEvent.click(go())
    expect(onPick).toHaveBeenCalledWith(expect.anything(), [roster[0].fighter_id])
  })

  it('puts the team back with Undo', () => {
    const before = [roster[0].fighter_id, roster[1].fighter_id]
    const onRestore = vi.fn()
    render(
      <AutoPickSplit roster={roster} teamIds={before} teamSize={5} onPick={() => 3} onRestore={onRestore} />,
    )
    fireEvent.click(go())
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onRestore).toHaveBeenCalledWith(before)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('remembers which side the switch is on', () => {
    const team = [roster[0].fighter_id]
    const { unmount } = render(<AutoPickSplit roster={roster} teamIds={team} teamSize={5} onPick={() => 4} />)
    fireEvent.click(screen.getByTitle(/replace all 5 fighters/i))
    unmount()

    render(<AutoPickSplit roster={roster} teamIds={team} teamSize={5} onPick={() => 5} />)
    expect(go()).toHaveTextContent('Replace all 5')
  })
})

describe('what it says it did', () => {
  it('tells a replacement from a first pick', () => {
    const team = [roster[0].fighter_id]
    const { unmount } = render(<AutoPickSplit roster={roster} teamIds={team} teamSize={5} onPick={() => 5} />)
    fireEvent.click(screen.getByTitle(/replace all 5 fighters/i))
    fireEvent.click(go())
    expect(screen.getByRole('status')).toHaveTextContent('Replaced 5.')
    unmount()

    render(<AutoPickSplit roster={roster} teamIds={[]} teamSize={5} onPick={() => 5} />)
    fireEvent.click(go())
    expect(screen.getByRole('status')).toHaveTextContent('Picked 5.')
  })

  it('says so when the pool was too small to finish the team', () => {
    render(<AutoPickSplit roster={roster} teamIds={[]} teamSize={5} onPick={() => 2} />)
    fireEvent.click(go())
    expect(screen.getByRole('status')).toHaveTextContent('Only 2 matched')
  })
})
