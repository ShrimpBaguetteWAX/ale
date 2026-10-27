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
