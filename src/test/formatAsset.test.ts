import { describe, expect, it } from 'vitest'
import { formatAsset } from '@/format'

describe('formatAsset', () => {
  it('cuts a WAX payment down to one place', () => {
    /* Real rows off `rwrdlog.ale`, as the Wax tab lists them. */
    expect(formatAsset('583.04025064 WAX', 1)).toBe('583.0 WAX')
    expect(formatAsset('1462.69308020 WAX', 1)).toBe('1,462.6 WAX')
    expect(formatAsset('2600.00871602 WAX', 1)).toBe('2,600.0 WAX')
  })

  it('cuts rather than rounds, so a row never claims more than it paid', () => {
    expect(formatAsset('0.99999999 WAX', 1)).toBe('0.9 WAX')
  })

  it('pads a short fraction and keeps the symbol', () => {
    expect(formatAsset('5 WAX', 1)).toBe('5.0 WAX')
    expect(formatAsset('12.5 TLM', 1)).toBe('12.5 TLM')
  })

  it('hands back anything it cannot read', () => {
    expect(formatAsset('', 1)).toBe('')
    expect(formatAsset('lots of WAX', 1)).toBe('lots of WAX')
  })
})
