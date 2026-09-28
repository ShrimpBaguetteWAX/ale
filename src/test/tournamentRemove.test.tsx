import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { TeamRow } from '@/routes/Tournament'
import type { RosterFighter } from '@/dungeon/types'

/**
 * Taking a fighter back out of the signup line-up.
 *
 * The card face is already a button and it opens the fighter's panel, so
 * the removal lives on a pair that the row offers when a player reaches for
 * a place: "Details" over "Remove". What is worth pinning is that the pair
 * belongs to the place it is drawn on — the wrong fighter coming out of a
 * five-man team during a ten minute signup is not a mistake a player can
 * afford — and that a phone, which has no pointer to rest, can still get at
 * it.
 */

let id = 0
const fighter = (over: Partial<RosterFighter> = {}): RosterFighter =>
  ({
    fighter_id: ++id,
    classname: 'Hunter',
    racename: 'Elgem',
    element: 'nature',
    marker: '',
    creation_date: '2025-01-01T00:00:00',
    stats: { level: 10, health_min: 400, health_max: 600, damage_min: 90, damage_max: 130 },
    ...over,
  }) as unknown as RosterFighter

const onPhone = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('719'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))

const draw = (team: (RosterFighter | null)[], on: { remove?: () => void; inspect?: () => void } = {}) =>
  render(
    <TeamRow
      team={team}
      levelMod={1}
      ageDecay={1}
      onInspect={on.inspect ?? (() => {})}
      onRemove={on.remove ?? (() => {})}
      onEmpty={() => {}}
    />,
  )

afterEach(cleanup)

describe('the signup line-up', () => {
  it('offers the pair on every picked place, and on no empty one', () => {
    const { container } = draw([fighter(), fighter(), null, null, null])
    expect(container.querySelectorAll('.tour__slotout')).toHaveLength(2)
    expect(container.querySelectorAll('.tour__slotsee')).toHaveLength(2)
    expect(container.querySelectorAll('.tour__empty')).toHaveLength(3)
  })

  it('removes the fighter whose place was reached, not the first one', () => {
    const wanted = fighter({ classname: 'Juggernaut' })
    const removed: RosterFighter[] = []
    const { container } = draw([fighter(), wanted, fighter()], {
      remove: ((f: RosterFighter) => removed.push(f)) as never,
    })

    const outs = container.querySelectorAll('.tour__slotout')
    fireEvent.click(outs[1])
    expect(removed).toHaveLength(1)
    expect(removed[0].fighter_id).toBe(wanted.fighter_id)
  })

  it('still opens the panel from the top half', () => {
    const opened: RosterFighter[] = []
    const one = fighter()
    const { container } = draw([one], {
      inspect: ((f: RosterFighter) => opened.push(f)) as never,
    })

    fireEvent.click(container.querySelector('.tour__slotsee') as HTMLElement)
    expect(opened.map((f) => f.fighter_id)).toEqual([one.fighter_id])
  })

  /*
     A phone has no rest of a pointer, so the first tap is the reach. The
     catcher that takes it is drawn only while the pair is shut — otherwise
     it would be lying over the two buttons it just opened.
  */
  it('opens the pair on a tap on a phone, and gets out of their way', () => {
    onPhone()
    const { container } = draw([fighter(), fighter()])

    expect(container.querySelectorAll('.tour__slottap')).toHaveLength(2)
    expect(container.querySelectorAll('.tour__slot--open')).toHaveLength(0)

    fireEvent.click(container.querySelectorAll('.tour__slottap')[0])
    expect(container.querySelectorAll('.tour__slot--open')).toHaveLength(1)
    /* The one that was tapped no longer has a catcher over it. */
    expect(container.querySelectorAll('.tour__slottap')).toHaveLength(1)
  })

  it('has only one place open at a time on a phone', () => {
    onPhone()
    const { container } = draw([fighter(), fighter()])

    fireEvent.click(container.querySelectorAll('.tour__slottap')[0])
    fireEvent.click(container.querySelectorAll('.tour__slottap')[0])
    expect(container.querySelectorAll('.tour__slot--open')).toHaveLength(1)
  })

  it('shuts the pair behind whichever button was pressed', () => {
    onPhone()
    const { container } = draw([fighter()])

    fireEvent.click(container.querySelector('.tour__slottap') as HTMLElement)
    fireEvent.click(container.querySelector('.tour__slotsee') as HTMLElement)
    expect(container.querySelectorAll('.tour__slot--open')).toHaveLength(0)
  })
})
