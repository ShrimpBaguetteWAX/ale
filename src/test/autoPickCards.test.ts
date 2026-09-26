import { describe, expect, it, vi } from 'vitest'
import { autoPickCardsByOdds } from '@/fight/autopick'
import type { NftValue } from '@/dungeon/nftFighter'
import type { BattleFighter } from '@/dungeon/types'

/**
 * Choosing the crew and weapon by fighting with them.
 *
 * The rate function is a stub here: what matters is that the picker asks it
 * about the right pairs, trusts it over the paper ranking, and narrows to
 * the leaders rather than fighting the whole collection properly.
 */
const stats = (damage: number, health: number) =>
  ({
    damage,
    health,
    attackspeed: 500,
    taunt: 100,
    initiative: 500,
    res_gem: 0,
    res_metal: 0,
    res_air: 0,
    res_fire: 0,
    res_nature: 0,
    res_neutral: 0,
    target: '',
  }) as unknown as NftValue['stats']

const card = (template_id: number, damage: number, type: string): NftValue =>
  ({
    template_id,
    type,
    rarity: 'common',
    shine: 'stone',
    classname: '',
    racename: '',
    element: 'neutral',
    stats: stats(damage, damage),
    ability: [],
  }) as unknown as NftValue

const enemy = (): BattleFighter =>
  ({
    fighter_id: 1,
    health: 1000,
    max_health: 1000,
    damage: 100,
    taunt: 100,
    initiative: 500,
    attackspeed: 500,
    res_gem: 0,
    res_metal: 0,
    res_air: 0,
    res_fire: 0,
    res_nature: 0,
    res_neutral: 0,
    classname: 'juggernaut',
    racename: 'human',
    element: 'neutral',
    target: '',
    specialAbility: [],
    level: 1,
  }) as unknown as BattleFighter

const crew = [1, 2, 3].map((i) => card(i, i * 100, 'crew.worlds'))
const weapons = [11, 12, 13].map((i) => card(i, i * 100, 'arms.worlds'))
const values = new Map([...crew, ...weapons].map((v) => [v.template_id, v]))
const asCards = (v: NftValue[]) => v.map((x) => ({ template_id: x.template_id }))

describe('picking the cards by simulation', () => {
  it('takes the pair that wins most, not the one that reads best', () => {
    /* The paper ranking prefers the heaviest cards; this says 3 + 11 wins. */
    const rate = (c: NftValue | null, w: NftValue | null) =>
      c?.template_id === 3 && w?.template_id === 11 ? 0.9 : 0.2

    const pick = autoPickCardsByOdds({
      enemies: [enemy()],
      crewCards: asCards(crew),
      weaponCards: asCards(weapons),
      values,
      rate,
    })
    expect(pick.crew?.template_id).toBe(3)
    expect(pick.weapon?.template_id).toBe(11)
  })

  it('fights the shortlist once and only the leaders properly', () => {
    const rate = vi.fn(
      (c: NftValue | null, _w: NftValue | null, _runs: number) => (c?.template_id ?? 0) / 10,
    )
    autoPickCardsByOdds({
      enemies: [enemy()],
      crewCards: asCards(crew),
      weaponCards: asCards(weapons),
      values,
      rate,
      finalists: 2,
      runs: 49,
    })
    const single = rate.mock.calls.filter((c) => c[2] === 1).length
    const full = rate.mock.calls.filter((c) => c[2] === 49).length
    expect(single).toBe(9) // three crew against three weapons
    expect(full).toBe(2) // then the two leaders
  })

  it('handles a collection with only one side of the pair', () => {
    const pick = autoPickCardsByOdds({
      enemies: [enemy()],
      crewCards: asCards(crew),
      weaponCards: [],
      values,
      rate: (c) => (c?.template_id === 2 ? 1 : 0),
    })
    expect(pick.crew?.template_id).toBe(2)
    expect(pick.weapon).toBeNull()
  })

  it('has nothing to choose from an empty collection', () => {
    const pick = autoPickCardsByOdds({
      enemies: [enemy()],
      crewCards: [],
      weaponCards: [],
      values,
      rate: () => 1,
    })
    expect(pick).toEqual({ crew: null, weapon: null })
  })
})
