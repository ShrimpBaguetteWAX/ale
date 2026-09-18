import { describe, expect, it } from 'vitest'
import {
  clampCount,
  ownedStacks,
  selectedIds,
  selectedTemplates,
  stakedStacks,
  totalPicked,
} from '@/farming/stacks'
import type { OwnedCard, StakeWeight, StakedCard } from '@/farming/types'

const weights = [
  { index: 0, rarity: 'Common', shine: 'Stone', weight: 10 },
  { index: 1, rarity: 'Common', shine: 'Gold', weight: 40 },
  { index: 2, rarity: 'Epic', shine: 'Stone', weight: 100 },
] as StakeWeight[]

const owned = (
  template_id: number,
  count: number,
  rarity = 'Common',
  shine = 'Stone',
): OwnedCard => ({ template_id, count, rarity, shine, name: `Card ${template_id}` })

describe('farming stacks from a wallet', () => {
  it('is one tile per design, holding the count the summary gave', () => {
    const stacks = ownedStacks([owned(100, 15_170), owned(200, 1, 'Epic')], weights)
    expect(stacks.map((s) => [s.template_id, s.count])).toEqual([
      [200, 1],
      [100, 15_170],
    ])
  })

  it('carries no asset ids — those are looked up when staking', () => {
    const [stack] = ownedStacks([owned(100, 3)], weights)
    expect(stack.ids).toEqual([])
    expect(selectedIds([stack], { [stack.key]: 2 })).toEqual([])
  })

  it('puts the heaviest design first', () => {
    const stacks = ownedStacks(
      [owned(100, 1), owned(200, 1, 'Epic'), owned(300, 1, 'Common', 'Gold')],
      weights,
    )
    expect(stacks.map((s) => s.weight)).toEqual([100, 40, 10])
  })

  it('leaves out a design the wallet holds none of', () => {
    expect(ownedStacks([owned(100, 0)], weights)).toEqual([])
  })

  it('says which designs to look up, and how many of each', () => {
    const stacks = ownedStacks([owned(100, 15_170), owned(200, 4, 'Epic')], weights)
    const counts = { [stacks[0].key]: 3, [stacks[1].key]: 2_500 }
    expect(selectedTemplates(stacks, counts)).toEqual([
      { template_id: 200, count: 3, held: 4, name: 'Card 200' },
      { template_id: 100, count: 2_500, held: 15_170, name: 'Card 100' },
    ])
    expect(totalPicked(stacks, counts)).toBe(2_503)
  })

  it('never asks for more than the wallet holds', () => {
    const stacks = ownedStacks([owned(100, 12)], weights)
    const counts = { [stacks[0].key]: 900 }
    expect(selectedTemplates(stacks, counts)).toEqual([
      { template_id: 100, count: 12, held: 12, name: 'Card 100' },
    ])
    expect(totalPicked(stacks, counts)).toBe(12)
  })
})

describe('farming stacks of staked cards', () => {
  const staked = [
    { asset_id: '9', template_id: 100, rarity: 'Common', shine: 'Stone', weight: 10 },
    { asset_id: '8', template_id: 100, rarity: 'Common', shine: 'Stone', weight: 10 },
    { asset_id: '7', template_id: 100, rarity: 'Common', shine: 'Gold', weight: 40 },
  ] as StakedCard[]

  it('groups by design and shine, counting what is there', () => {
    const stacks = stakedStacks(staked)
    expect(stacks.map((s) => [s.shine, s.count, s.ids])).toEqual([
      ['Gold', 1, ['7']],
      ['Stone', 2, ['9', '8']],
    ])
  })

  it('hands back the ids for an amount, from the front of each stack', () => {
    const stacks = stakedStacks(staked)
    const counts = { [stacks[1].key]: 1, [stacks[0].key]: 5 }
    expect(selectedIds(stacks, counts)).toEqual(['7', '9'])
  })
})

describe('an amount', () => {
  it('is whole cards, never below zero and never above what is held', () => {
    expect(clampCount(3.7, 10)).toBe(3)
    expect(clampCount(-4, 10)).toBe(0)
    expect(clampCount(900, 12)).toBe(12)
    expect(clampCount(Number.NaN, 12)).toBe(0)
  })
})
