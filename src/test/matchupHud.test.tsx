import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HudCentre } from '@/fight/OddsCentre'
import { CombatCard } from '@/fight/setup'

/**
 * The matchup's HUD look: the fighters as medallions and the chance on a
 * gauge with the head-to-head under it — and the switch back to the cards.
 */
const mine = { landShare: 0.67, blockShare: 0.48, bonuses: 0 }
const theirs = { landShare: 0.56, blockShare: 0.34, bonuses: 3 }

afterEach(() => localStorage.removeItem('matchup-style'))

describe('the HUD centre', () => {
  it('says VS until there are odds', () => {
    render(<HudCentre odds={null} mine={mine} theirs={theirs} />)
    expect(screen.getByText('VS')).toBeTruthy()
  })

  it('shows the chance, its word, and the head-to-head', () => {
    const { container } = render(<HudCentre odds={{ winRate: 0.72, runs: 200 }} mine={mine} theirs={theirs} />)
    expect(container.querySelector('.hudcentre--good')).toBeTruthy()
    expect(container.querySelector('.hudcentre__gauge b')!.textContent).toBe('72%')
    expect(screen.getByText(/Favoured/)).toBeTruthy()
    const rows = [...container.querySelectorAll('.hudcentre__row')].map((r) => r.textContent)
    expect(rows).toEqual(['67%Lands56%', '48%Blocks34%', '+0Bonus+3'])
  })

  it('also sets the figures as mirrored columns, each figure nearest the gauge', () => {
    const { container } = render(<HudCentre odds={{ winRate: 0.72, runs: 200 }} mine={mine} theirs={theirs} />)
    const col = (who: string) =>
      [...container.querySelectorAll(`.hudcentre__side--${who} .hudcentre__line`)].map((l) => [...l.children].map((c) => c.textContent).join(' '))
    expect(col('mine')).toEqual(['Lands 67%', 'Blocks 48%', 'Bonus +0'])
    expect(col('theirs')).toEqual(['56% Lands', '34% Blocks', '+3 Bonus'])
  })
})

describe('a fighter in the HUD', () => {
  const card = (extra: Partial<Parameters<typeof CombatCard>[0]> = {}) => (
    <CombatCard element="air" classname="Mystic" racename="Altan" level={6} health={79} damage={114} side="enemy" onOpen={() => {}} {...extra} />
  )

  it('is a medallion on its side, with the level on its tab', () => {
    const { container } = render(card())
    expect(container.querySelector('.medal.medal--enemy')).toBeTruthy()
    expect(container.querySelector('.medal__tab')!.textContent).toBe('6')
    expect(container.querySelector('.medal__name')!.textContent).toBe('Mystic')
    expect(container.querySelector('.combatcard')).toBeNull()
  })

  it('wears its badge in place of a level, and can be taken out on my side', () => {
    const { container } = render(card({ side: 'mine', badge: 'NFT', level: undefined, onRemove: () => {} }))
    expect(container.querySelector('.medal__tab--badge')!.textContent).toBe('NFT')
    expect(container.querySelector('.medal__remove')).toBeTruthy()
  })

  it('goes back to the leaning cards when the switch says so', () => {
    localStorage.setItem('matchup-style', 'cards')
    const { container } = render(card())
    expect(container.querySelector('.combatcard.combatcard--enemy')).toBeTruthy()
    expect(container.querySelector('.medal')).toBeNull()
  })
})
