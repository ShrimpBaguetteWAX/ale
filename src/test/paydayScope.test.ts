import { describe, expect, it } from 'vitest'
import { paydayAllPlan, wantsPayday } from '@/fighters/rules'
import type { FightersConfig } from '@/fighters/types'
import type { RosterFighter } from '@/dungeon/types'

/**
 * Who a blanket payday pays.
 *
 * "All" keeps the roster off the bench; "unwilling" settles only the
 * fighters the contract is already refusing. On a large roster the two are
 * very different bills, which is the whole point of the choice.
 */
const NOW = Date.parse('2026-09-26T12:00:00Z')
const DAY = 86_400_000
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19)

/* `standard_pay_payday` is the rate a full cycle charges. */
const config = { standard_pay_payday: 1_000 } as unknown as FightersConfig

/** `nextPayday` in the past means benched until paid. */
const fighter = (id: number, nextPayday: number, level = 5): RosterFighter =>
  ({
    fighter_id: id,
    owner: 'tester.wam',
    creation_date: stamp(NOW - 30 * DAY),
    next_payday: stamp(nextPayday),
    last_payday: stamp(nextPayday - 28 * DAY),
    in_use: 0,
    active: 1,
    stats: { level },
  }) as unknown as RosterFighter

const overdue = [fighter(1, NOW - 2 * DAY), fighter(2, NOW - 5 * DAY)]
const fine = [fighter(3, NOW + 10 * DAY), fighter(4, NOW + 20 * DAY)]
const roster = [...overdue, ...fine]

describe('payday scope', () => {
  it('knows which fighters the contract is refusing', () => {
    expect(overdue.every((f) => wantsPayday(f, NOW))).toBe(true)
    expect(fine.some((f) => wantsPayday(f, NOW))).toBe(false)
  })

  it('pays the whole roster by default', () => {
    const plan = paydayAllPlan(roster, config, NOW)
    expect(plan.ids).toEqual([1, 2, 3, 4])
  })

  it('narrows to the unwilling when asked', () => {
    const plan = paydayAllPlan(roster, config, NOW, 'overdue')
    expect(plan.ids).toEqual([1, 2])
  })

  it('costs less than paying everyone, which is the reason to offer it', () => {
    const all = paydayAllPlan(roster, config, NOW)
    const only = paydayAllPlan(roster, config, NOW, 'overdue')
    expect(only.credits).toBeLessThan(all.credits)
    expect(only.ids.length).toBeLessThan(all.ids.length)
  })

  it('has nothing to pay when the whole roster is willing', () => {
    const plan = paydayAllPlan(fine, config, NOW, 'overdue')
    expect(plan.ids).toEqual([])
    expect(plan.credits).toBe(0)
  })
})
