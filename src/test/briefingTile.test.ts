import { describe, expect, it } from 'vitest'
import { tileOf } from '@/briefing/rules'

describe('tileOf', () => {
  it('takes the amount from a figure that is one', () => {
    expect(tileOf({ title: 'Trilium waiting on your account', figure: '1,509 TLM' })).toEqual({
      amount: '1,509',
      unit: 'TLM',
      label: 'Trilium waiting on your account',
    })
  })

  it('falls back to a count leading the title', () => {
    expect(tileOf({ title: '4 fighters can level up' })).toEqual({
      amount: '4',
      label: 'Fighters can level up',
    })
  })

  it('ignores a figure that is not an amount', () => {
    expect(tileOf({ title: '7 new avatars are unlocked', figure: 'today' })).toEqual({
      amount: '7',
      label: 'New avatars are unlocked',
    })
  })

  it('keeps the title whole when there is no number at all', () => {
    expect(tileOf({ title: 'Free energy flask' })).toEqual({ label: 'Free energy flask' })
  })
})
