import { describe, expect, it } from 'vitest'
import { roleOf } from '@/fighters/derived'

describe('roleOf', () => {
  it('reads high DPS with low survival as a glass cannon', () => {
    expect(roleOf('green-up', 'red-down').name).toBe('Glass cannon')
    expect(roleOf('gold-up', 'red-duble-down').key).toBe('glasscannon')
  })

  it('takes the flat grade, or none, as average', () => {
    expect(roleOf('middle', null).key).toBe('allrounder')
    expect(roleOf(null, 'green-duble-up').key).toBe('bulwark')
  })

  it('names all nine', () => {
    const bands = ['green-up', 'middle', 'red-down'] as const
    const keys = bands.flatMap((d) => bands.map((s) => roleOf(d, s).key))
    expect(keys).toEqual([
      'powerhouse',
      'striker',
      'glasscannon',
      'bulwark',
      'allrounder',
      'daredevil',
      'wall',
      'lightweight',
      'underdog',
    ])
  })
})

describe('the role filter', () => {
  it('counts as one active filter and clears with the rest', async () => {
    const { countActiveFilters, isFilterActive, EMPTY_FILTER } = await import('@/dungeon/filters')
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    const f = { ...EMPTY_FILTER, roles: ['wall' as const, 'glasscannon' as const] }
    expect(isFilterActive(f)).toBe(true)
    expect(countActiveFilters(f)).toBe(1)
  })
})
