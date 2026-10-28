import { describe, expect, it } from 'vitest'
import { isMelee, onGround, roleLines, type Lineup } from '@/fight/formation'

/**
 * Where a team stands when a fight on the ground opens: the melee classes in
 * the near line, the rest in the far one, each line ordered by taunt toward
 * the enemy, and the team's top taunt at the near line's innermost spot.
 */
const f = (uid: string, classname: string, taunt: number, health = 100): Lineup => ({ uid, classname, taunt, health })

/* The near line is r 0.9 (or its stagger, 0.74); the far line r 0.04 (or 0.18). */
const near = (spots: Map<string, [number, number]>, uid: string) => spots.get(uid)![1] > 0.5
/* Closer to the enemy is a larger x, from the team's own edge. */
const x = (spots: Map<string, [number, number]>, uid: string) => spots.get(uid)![0]

describe('role lines', () => {
  it('knows who fights up close, however the class is written', () => {
    expect(isMelee('Astral Knight')).toBe(true)
    expect(isMelee('juggernaut')).toBe(true)
    expect(isMelee('Hunter')).toBe(false)
    expect(isMelee('')).toBe(false)
  })

  it('puts the melee classes in the near line and the rest in the far one', () => {
    const spots = roleLines([
      f('jug', 'Juggernaut', 50),
      f('hun', 'Hunter', 10),
      f('lun', 'Lunatic', 20),
      f('arc', 'Arcanist', 5),
    ])
    expect(near(spots, 'jug')).toBe(true)
    expect(near(spots, 'lun')).toBe(true)
    expect(near(spots, 'hun')).toBe(false)
    expect(near(spots, 'arc')).toBe(false)
  })

  it('stands the most taunt closest to the enemy in each line', () => {
    const spots = roleLines([
      f('a', 'Juggernaut', 30),
      f('b', 'Voidwarden', 60),
      f('c', 'Tactician', 45),
      f('d', 'Mystic', 12),
      f('e', 'Hunter', 25),
      f('g', 'Desperado', 18),
    ])
    expect(x(spots, 'b')).toBeGreaterThan(x(spots, 'c'))
    expect(x(spots, 'c')).toBeGreaterThan(x(spots, 'a'))
    expect(x(spots, 'e')).toBeGreaterThan(x(spots, 'g'))
    expect(x(spots, 'g')).toBeGreaterThan(x(spots, 'd'))
  })

  it('brings a ranged fighter with the team’s top taunt forward, to the near line’s innermost spot', () => {
    const spots = roleLines([
      f('jug', 'Juggernaut', 40),
      f('mys', 'Mystic', 90),
      f('hun', 'Hunter', 10),
    ])
    expect(near(spots, 'mys')).toBe(true)
    expect(x(spots, 'mys')).toBeGreaterThan(x(spots, 'jug'))
    expect(near(spots, 'hun')).toBe(false)
  })

  it('stands the NFT fighter, which has no class, in the far line', () => {
    const spots = roleLines([f('jug', 'Juggernaut', 40), f('nft', '', 20)])
    expect(near(spots, 'nft')).toBe(false)
  })

  it('breaks a tie in taunt on health, then on roster order', () => {
    const health = roleLines([f('a', 'Juggernaut', 30, 100), f('b', 'Juggernaut', 30, 150)])
    expect(x(health, 'b')).toBeGreaterThan(x(health, 'a'))
    const order = roleLines([f('a', 'Juggernaut', 30, 100), f('b', 'Juggernaut', 30, 100)])
    expect(x(order, 'a')).toBeGreaterThan(x(order, 'b'))
  })

  it('staggers a line of more than three, so nobody hides behind a neighbour', () => {
    const spots = roleLines(['a', 'b', 'c', 'd'].map((u, i) => f(u, 'Juggernaut', 40 - i)))
    const depths = new Set([...spots.values()].map(([, r]) => r))
    expect(depths.size).toBe(2)
  })

  it('never steps the innermost fighter out of its line', () => {
    const spots = roleLines(['a', 'b', 'c', 'd'].map((u, i) => f(u, 'Juggernaut', 40 - i)))
    expect(spots.get('a')![1]).toBe(0.9)
  })

  it('places from the team’s own edge, so both sides read the same way and mirror on screen', () => {
    const team = [f('a', 'Juggernaut', 50), f('b', 'Hunter', 10)]
    const spots = roleLines(team)
    for (const [sx] of spots.values()) {
      expect(sx).toBeGreaterThanOrEqual(0)
      expect(sx).toBeLessThanOrEqual(50)
    }
  })

  /*
   * On screen, both teams, both shapes of the field: "closest to the enemy"
   * is the smallest distance across to the contact line, the field's middle.
   */
  describe('on screen, toward the contact line', () => {
    const teams: Lineup[][] = [
      [f('a', 'Juggernaut', 30), f('b', 'Voidwarden', 60), f('c', 'Tactician', 45), f('d', 'Mystic', 12), f('e', 'Hunter', 25), f('g', 'Desperado', 18)],
      [f('a', 'Mystic', 90), f('b', 'Juggernaut', 40), f('c', 'Hunter', 35), f('d', 'Arcanist', 20), f('e', 'Lunatic', 10), f('g', '', 5)],
      [f('a', 'Juggernaut', 50), f('b', 'Voidwarden', 49), f('c', 'Lunatic', 48), f('d', 'Mindblade', 47), f('e', 'Tactician', 46), f('g', 'Hunter', 45)],
      [f('a', 'Hunter', 70), f('b', 'Mystic', 60), f('c', 'Arcanist', 50), f('d', 'Desperado', 40), f('e', '', 30), f('g', 'Juggernaut', 20)],
      [f('a', 'Juggernaut', 30), f('b', 'Hunter', 10)],
    ]
    const cases = teams.flatMap((team) =>
      [true, false].flatMap((wide) => [1, 2].map((side) => ({ team, wide, side }))),
    )
    /* Each fighter's distance across to the middle, with the right-hand team mirrored as the field draws it. */
    const across = (team: Lineup[], wide: boolean, side: number) => {
      const spots = roleLines(team)
      return new Map(
        team.map((t) => {
          const [gx] = onGround(spots.get(t.uid)!, wide)
          const sx = side === 1 ? gx : 100 - gx
          return [t.uid, { d: Math.abs(sx - 50), near: spots.get(t.uid)![1] > 0.5, taunt: t.taunt }]
        }),
      )
    }

    it.each(cases)('stands the team’s top taunt nearest the middle (%#)', ({ team, wide, side }) => {
      const at = across(team, wide, side)
      const top = [...team].sort((p, q) => q.taunt - p.taunt)[0].uid
      for (const [uid, { d }] of at) if (uid !== top) expect(at.get(top)!.d).toBeLessThan(d)
    })

    it.each(cases)('orders each line by taunt toward the middle (%#)', ({ team, wide, side }) => {
      const at = [...across(team, wide, side).values()]
      for (const near of [true, false]) {
        const line = at.filter((p) => p.near === near).sort((p, q) => q.taunt - p.taunt)
        for (let k = 1; k < line.length; k++) expect(line[k - 1].d).toBeLessThan(line[k].d)
      }
    })

    it.each(cases)('stands the melee line nearer the middle than the ranged line (%#)', ({ team, wide, side }) => {
      const at = [...across(team, wide, side).values()]
      const mean = (near: boolean) => {
        const line = at.filter((p) => p.near === near)
        return line.reduce((sum, p) => sum + p.d, 0) / line.length
      }
      if (at.some((p) => p.near) && at.some((p) => !p.near)) expect(mean(true)).toBeLessThan(mean(false))
    })
  })
})
