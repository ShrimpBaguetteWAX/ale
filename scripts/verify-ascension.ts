/**
 * The sacrifice rule, against the contract's own test.
 *
 * `ascend` asks whether element, race and the Sacrifice ability can each be
 * covered by a *different* one of the three sacrifices. That is easy to get
 * subtly wrong — a fighter matching all three still only fills one slot — so
 * the cases below are derived from the nested loops in `ascension.cpp` rather
 * than from what this implementation happens to do.
 */
import { checkSacrifices, eligibleSacrifice, canAscend } from '../src/ascension/rules'
import type { RosterFighter } from '../src/dungeon/types'

let failures = 0
const check = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ok   ${name}`)
  else { failures++; console.log(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`) }
}

let id = 0
const f = (o: Partial<RosterFighter> & { sacrifice?: boolean } = {}): RosterFighter =>
  ({
    fighter_id: ++id,
    owner: 'w',
    classname: 'mystic',
    racename: 'human',
    element: 'fire',
    ascension_level: 0,
    ascension_in_progress: false,
    ascension_upgrades: [],
    stats: { level: 10, abilities: o.sacrifice ? [{ ability: 'sacrifice' }] : [] },
    ...o,
  }) as unknown as RosterFighter

function main() {
  console.log('ascension sacrifices\n')

  const target = f({ classname: 'mystic', racename: 'human', element: 'fire' })

  /* 1. Three fighters, one per requirement. */
  check(
    'one fighter per requirement passes',
    checkSacrifices(
      [
        f({ element: 'fire', racename: 'alien' }),
        f({ element: 'air', racename: 'human' }),
        f({ element: 'air', racename: 'alien', sacrifice: true }),
      ],
      target,
    ).ok,
    true,
  )

  /*
   * 2. One fighter covering everything is not enough — it can only fill one
   *    slot, which is the rule players trip on.
   */
  check(
    'a single fighter cannot cover two requirements',
    checkSacrifices(
      [
        f({ element: 'fire', racename: 'human', sacrifice: true }),
        f({ element: 'air', racename: 'alien' }),
        f({ element: 'air', racename: 'alien' }),
      ],
      target,
    ).ok,
    false,
  )

  /* 3. …but with two more that each cover one, the same trio works. */
  check(
    'an all-rounder plus two specialists passes',
    checkSacrifices(
      [
        f({ element: 'fire', racename: 'human', sacrifice: true }),
        f({ element: 'fire', racename: 'alien' }),
        f({ element: 'air', racename: 'human' }),
      ],
      target,
    ).ok,
    true,
  )

  /* 4. A missing requirement is named, so the player knows what to fix. */
  check(
    'the uncovered requirement is reported',
    checkSacrifices(
      [
        f({ element: 'fire', racename: 'alien' }),
        f({ element: 'air', racename: 'human' }),
        f({ element: 'air', racename: 'alien' }),
      ],
      target,
    ).unmet,
    ['ability'],
  )

  /* 5. Fewer than three is never valid. */
  check(
    'two sacrifices cannot pass',
    checkSacrifices([f({ element: 'fire' }), f({ racename: 'human' })], target).ok,
    false,
  )

  /* 6. Class is checked before anything else. */
  check(
    'a different class is not an eligible sacrifice',
    eligibleSacrifice(f({ classname: 'juggernaut' }), target),
    false,
  )
  check(
    'the fighter cannot sacrifice itself',
    eligibleSacrifice(target, target),
    false,
  )

  /* 7. The level rule is equality, not "at least". */
  const cfg = { min_ascension_level: 10 } as never
  check('level 10 can ascend', canAscend(f({ stats: { level: 10, abilities: [] } } as never), cfg).ok, true)
  check('level 9 cannot', canAscend(f({ stats: { level: 9, abilities: [] } } as never), cfg).ok, false)
  check(
    'a fighter mid-ascension cannot start another',
    canAscend(f({ ascension_in_progress: true, stats: { level: 10, abilities: [] } } as never), cfg).ok,
    false,
  )

  console.log(`\n${failures === 0 ? 'all cases passed' : `${failures} FAILED`}`)
}
main()
