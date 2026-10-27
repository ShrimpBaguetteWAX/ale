import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FilterDrop } from '@/fighters/DeskRoster'
import { VersusFloors } from '@/fight/setup'
import { EMPTY_FILTER, type RosterFilter } from '@/dungeon/filters'

/**
 * The fight screens' filters are My Fighters' panel, with what only a fight
 * asks under "Against this team": damage that lands, damage blocked and the
 * ability bonuses. Without an opponent that section is left out, and the
 * level switch is My Fighters' alone.
 */
function panel(onFilter: (f: RosterFilter) => void, withVersus: boolean) {
  return render(
    <FilterDrop
      className="drost__pop--filters pickfilters"
      fields={{
        roster: [],
        filter: EMPTY_FILTER,
        onFilter,
        atLevelOne: false,
        onAtLevelOne: () => {},
        versus: withVersus && <VersusFloors filter={EMPTY_FILTER} onChange={onFilter} labelClass="drost__fhead" />,
      }}
      matching={12}
      onClear={() => {}}
      onClose={() => {}}
    />,
  )
}

describe('the fight filter panel', () => {
  it('adds the three floors against the team under their own heading', () => {
    const onFilter = vi.fn()
    panel(onFilter, true)
    expect(screen.getByText('Against this team')).toBeTruthy()
    for (const label of ['Damage lands', 'Damage blocked', 'Ability bonuses']) expect(screen.getByText(label)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Damage lands'), { target: { value: '80' } })
    expect(onFilter).toHaveBeenCalledWith(expect.objectContaining({ versus: expect.objectContaining({ offense: 80 }) }))
    expect(screen.getByRole('button', { name: 'Show 12 fighters' })).toBeTruthy()
  })

  it('leaves them out without an opponent, and the level switch out where nothing levels', () => {
    panel(() => {}, false)
    expect(screen.queryByText('Against this team')).toBeNull()
    expect(screen.queryByText('Ready to level')).toBeNull()
    expect(screen.getByText('Compare at level 1')).toBeTruthy()
  })
})
