import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { AutoPickCards, type CardPair } from '@/fight/AutoPickCards'

type Card = { template_id: number; name: string }
const A: Card = { template_id: 1, name: 'A' }
const B: Card = { template_id: 2, name: 'B' }
const C: Card = { template_id: 3, name: 'C' }
const D: Card = { template_id: 4, name: 'D' }

/** A loadout as the dungeon holds it, with the picker wired the same way. */
function Loadout({ start, picks }: { start: CardPair<Card>; picks: CardPair<Card> }) {
  const [crew, setCrew] = useState(start.crew)
  const [weapon, setWeapon] = useState(start.weapon)
  return (
    <>
      <output>
        {crew?.name ?? '-'}/{weapon?.name ?? '-'}
      </output>
      <button type="button" onClick={() => setCrew(D)}>
        by hand
      </button>
      <AutoPickCards
        crew={crew}
        weapon={weapon}
        onPick={() => {
          setCrew(picks.crew)
          setWeapon(picks.weapon)
          return picks
        }}
        onRestore={(pair) => {
          setCrew(pair.crew)
          setWeapon(pair.weapon)
        }}
      />
    </>
  )
}

const shown = () => screen.getByRole('status', { hidden: true }).textContent
const undo = () => screen.getByRole('button', { name: /undo/i }) as HTMLButtonElement

describe('Auto-pick cards with Undo', () => {
  it('has nothing to undo until a pick changes the pair', () => {
    render(<Loadout start={{ crew: null, weapon: null }} picks={{ crew: A, weapon: B }} />)
    expect(undo().disabled).toBe(true)
    fireEvent.click(screen.getByText('Auto-pick cards'))
    expect(shown()).toBe('A/B')
    expect(undo().disabled).toBe(false)
  })

  it('puts the pair back as it was, then has nothing to undo', () => {
    render(<Loadout start={{ crew: C, weapon: null }} picks={{ crew: A, weapon: B }} />)
    fireEvent.click(screen.getByText('Auto-pick cards'))
    expect(shown()).toBe('A/B')
    fireEvent.click(undo())
    expect(shown()).toBe('C/-')
    expect(undo().disabled).toBe(true)
  })

  it('leaves nothing to undo when the pick changes nothing, and says so', () => {
    render(<Loadout start={{ crew: A, weapon: B }} picks={{ crew: A, weapon: B }} />)
    fireEvent.click(screen.getByText('Auto-pick cards'))
    expect(undo().disabled).toBe(true)
    expect(screen.getByText('Nothing beats your pair.')).toBeTruthy()
  })

  it('says nothing when there was no pair to keep', () => {
    render(<Loadout start={{ crew: null, weapon: null }} picks={{ crew: null, weapon: null }} />)
    fireEvent.click(screen.getByText('Auto-pick cards'))
    expect(screen.queryByText('Nothing beats your pair.')).toBeNull()
  })

  it('withdraws Undo once the pair is changed by hand', () => {
    render(<Loadout start={{ crew: C, weapon: null }} picks={{ crew: A, weapon: B }} />)
    fireEvent.click(screen.getByText('Auto-pick cards'))
    expect(undo().disabled).toBe(false)
    fireEvent.click(screen.getByText('by hand'))
    expect(shown()).toBe('D/B')
    expect(undo().disabled).toBe(true)
  })
})
