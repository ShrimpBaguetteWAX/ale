import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CombatLogSheet } from '@/dungeon/CombatLogSheet'
import type { Replay, TurnEvent } from '@/dungeon/sim'

/**
 * Which side a knockout belongs to.
 *
 * The sheet writes your fighters in cyan and the opposing team in red, on
 * every name in every line. The knockout was the exception: both the band
 * behind the row and the "… is knocked out" line were red whoever went down,
 * so losing one of your own was announced in the colour the sheet uses to
 * mean theirs — in a log whose whole job is telling the two apart.
 *
 * It follows the defender now, like the name directly above it.
 */

const fighter = (uid: string, team: 1 | 2, classname: string) =>
  ({
    uid,
    team,
    classname,
    fighter_id: Number(uid.replace(/\D/g, '')) || 1,
    gamertag: team === 1 ? 'You' : 'AI',
    racename: 'human',
    element: 'fire',
    health: 0,
    max_health: 100,
  }) as unknown as Replay['fighters'][number]

const blow = (attackerUid: string, defenderUid: string, killed: boolean): TurnEvent =>
  ({
    turn: 1,
    attackerUid,
    defenderUid,
    damage: 50,
    raw: 50,
    blocked: 0,
    effectiveness: 100,
    element: 'fire',
    killed,
    defenderHealthBefore: 50,
    defenderHealthAfter: killed ? 0 : 10,
    defenderMaxHealth: 100,
    attackerHealth: 100,
    effects: [],
    clock: 1,
  }) as unknown as TurnEvent

const replay = (turns: TurnEvent[]): Replay =>
  ({
    turns,
    fighters: [fighter('m1', 1, 'juggernaut'), fighter('t1', 2, 'mindblade')],
    opening: [],
    openingEffects: [],
    winner: 1,
    matchesChain: true,
  }) as unknown as Replay

const sheet = (turns: TurnEvent[]) =>
  render(
    <CombatLogSheet
      replay={replay(turns)}
      playertag="You"
      onClose={vi.fn()}
      onDownload={vi.fn()}
    />,
  )

describe('a knockout in the combat log', () => {
  it('is marked as yours when your fighter goes down', () => {
    const { container } = sheet([blow('t1', 'm1', true)])

    const ko = container.querySelector('.clog__ko')!
    expect(ko.classList.contains('clog__ko--mine')).toBe(true)
    expect(ko.classList.contains('clog__ko--theirs')).toBe(false)
    /* The band behind the row has to agree with the line inside it. */
    expect(ko.closest('.clog__turn')!.classList.contains('clog__turn--ko-mine')).toBe(true)
  })

  it('is marked as theirs when an enemy goes down', () => {
    const { container } = sheet([blow('m1', 't1', true)])

    const ko = container.querySelector('.clog__ko')!
    expect(ko.classList.contains('clog__ko--theirs')).toBe(true)
    expect(ko.closest('.clog__turn')!.classList.contains('clog__turn--ko-theirs')).toBe(true)
  })

  it('follows the fighter that fell, not the one that swung', () => {
    /*
       The distinction the old code could not make. Both of these are your
       fighter swinging; only the second is your fighter dying.
    */
    const theirs = sheet([blow('m1', 't1', true)])
    expect(theirs.container.querySelector('.clog__ko--theirs')).toBeTruthy()
    theirs.unmount()

    const mine = sheet([blow('t1', 'm1', true)])
    expect(mine.container.querySelector('.clog__ko--mine')).toBeTruthy()
  })

  it('marks nothing on a blow that did not kill', () => {
    const { container } = sheet([blow('m1', 't1', false)])

    expect(container.querySelector('.clog__ko')).toBeNull()
    expect(container.querySelector('.clog__turn--ko')).toBeNull()
  })

  it('keeps the row a knockout row as well as a sided one', () => {
    /*
       The tint lives on `.clog__turn.clog__turn--ko` — doubled so it outweighs
       the even-row stripe, which is a class and a pseudo-class and used to
       paint straight over it. Losing the base class would take the band with
       it and leave only the coloured edge.
    */
    const { container } = sheet([blow('t1', 'm1', true)])
    const row = container.querySelector('.clog__turn--ko-mine')!

    expect(row.classList.contains('clog__turn--ko')).toBe(true)
  })
})
