import { describe, expect, it } from 'vitest'
import { claimPays } from '@/account/rules'

/**
 * Which currencies the Rewards page offers to claim with `claimcur`. A Claim
 * button on a currency the action does not pay out would wipe the balance, so
 * the list is pinned here.
 */
describe('what Rewards offers to claim', () => {
  it('claims TLM and WAX (tournament prizes)', () => {
    expect(claimPays('tlm')).toBe(true)
    expect(claimPays('wax')).toBe(true)
  })

  it('never offers to claim shards, which claimcur drops without paying', () => {
    expect(claimPays('shrds')).toBe(false)
  })
})
