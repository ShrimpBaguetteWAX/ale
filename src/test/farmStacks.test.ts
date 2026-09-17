import { describe, expect, it } from 'vitest'
import {
  clampCount,
  inventoryStacks,
  selectedIds,
  stakedStacks,
  totalPicked,
} from '@/farming/stacks'
import type { FarmCard, StakeWeight, StakedCard } from '@/farming/types'

const weights = [
  { index: 0, rarity: 'Common', shine: 'Stone', weight: 10 },
  { index: 1, rarity: 'Common', shine: 'Gold', weight: 40 },
  { index: 2, rarity: 'Epic', shine: 'Stone', weight: 100 },
] as StakeWeight[]

const card = (
  asset_id: string,
  template_id: number,
  rarity = 'Common',
  shine = 'Stone',
  name = `Card ${template_id}`,
): FarmCard => ({ asset_id, template_id, rarity, shine, name, schema: 'tool.worlds' })

describe('farming stacks', () => {
  it('counts one tile per design instead of one per asset', () => {
    const stacks = inventoryStacks(
      [card('1', 100), card('2', 100), card('3', 100), card('4', 200, 'Epic')],
      weights,
    )
    expect(stacks.map((s) => [s.template_id, s.ids.length])).toEqual([
      [200, 1],
      [100, 3],
    ])
  })

  it('keeps shines apart, because the weight differs', () => {
    const stacks = inventoryStacks(
      [card('1', 100), card('2', 100, 'Common', 'Gold')],
      weights,
    )
    expect(stacks.map((s) => [s.shine, s.weight, s.ids.length])).toEqual([
      ['Gold', 40, 1],
      ['Stone', 10, 1],
    ])
  })

  it('puts the heaviest stack first', () => {
    const stacks = inventoryStacks(
      [card('1', 100), card('2', 200, 'Epic'), card('3', 300, 'Common', 'Gold')],
      weights,
    )
    expect(stacks.map((s) => s.weight)).toEqual([100, 40, 10])
  })

  it('stacks what is already staked on its stored weight', () => {
    const staked = [
      { asset_id: '9', template_id: 100, rarity: 'Common', shine: 'Stone', weight: 10 },
      { asset_id: '8', template_id: 100, rarity: 'Common', shine: 'Stone', weight: 10 },
    ] as StakedCard[]
    const stacks = stakedStacks(staked)
    expect(stacks).toHaveLength(1)
    expect(stacks[0].ids).toEqual(['9', '8'])
    expect(stacks[0].weight).toBe(10)
  })

  describe('an amount', () => {
    it('is whole cards, never below zero and never above what is held', () => {
      expect(clampCount(3.7, 10)).toBe(3)
      expect(clampCount(-4, 10)).toBe(0)
      expect(clampCount(900, 12)).toBe(12)
      expect(clampCount(Number.NaN, 12)).toBe(0)
    })
  })

  it('turns amounts back into asset ids, from the front of each stack', () => {
    const stacks = inventoryStacks(
      [card('1', 100), card('2', 100), card('3', 100), card('4', 200, 'Epic')],
      weights,
    )
    const counts = { [stacks[0].key]: 1, [stacks[1].key]: 2 }
    expect(selectedIds(stacks, counts)).toEqual(['4', '1', '2'])
    expect(totalPicked(stacks, counts)).toBe(3)
  })

  it('cannot send more ids than the player holds', () => {
    const stacks = inventoryStacks([card('1', 100), card('2', 100)], weights)
    const counts = { [stacks[0].key]: 99 }
    expect(selectedIds(stacks, counts)).toEqual(['1', '2'])
    expect(totalPicked(stacks, counts)).toBe(2)
  })

  it('selects nothing when nothing is counted', () => {
    const stacks = inventoryStacks([card('1', 100)], weights)
    expect(selectedIds(stacks, {})).toEqual([])
    expect(totalPicked(stacks, {})).toBe(0)
  })
})
