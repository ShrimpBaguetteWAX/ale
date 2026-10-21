import { describe, expect, it } from 'vitest'
import { AUTO_SIGN_GROUPS, NEVER_AUTO_SIGNED, groupsFrom, whitelistFor, type AutoSignAction } from '@/wharf/autoSign'

/**
 * What the key in a browser may ever be allowed to sign.
 *
 * The one property that matters is the negative one: no choice on the page,
 * and no combination of choices, can put a transfer of WAX, Trilium or NFTs
 * on the whitelist. The rest pins the shape WharfKit is handed.
 */
const flat = (ids: string[]): AutoSignAction[] =>
  whitelistFor(ids).flatMap((entry) =>
    (entry.actions ?? []).map((action) => ({ contract: String(entry.contract), action: String(action) })),
  )

const EVERY = AUTO_SIGN_GROUPS.map((g) => g.id)

describe('what may never sign itself', () => {
  it('allows no transfer at all, with every group on', () => {
    const all = flat(EVERY)
    expect(all.some((a) => a.action === 'transfer')).toBe(false)
    for (const never of NEVER_AUTO_SIGNED) {
      expect(all).not.toContainEqual(never)
    }
  })

  it('names the three transfers it refuses', () => {
    expect(NEVER_AUTO_SIGNED.map((a) => a.contract).sort()).toEqual(['alien.worlds', 'atomicassets', 'eosio.token'])
    expect(NEVER_AUTO_SIGNED.every((a) => a.action === 'transfer')).toBe(true)
  })

  it('lists no group that carries a transfer', () => {
    for (const group of AUTO_SIGN_GROUPS) {
      expect(group.actions.some((a) => a.action === 'transfer')).toBe(false)
    }
  })
})

describe('whitelistFor', () => {
  it('is empty when nothing is chosen', () => {
    expect(whitelistFor([])).toEqual([])
  })

  it('gathers a group s actions under their contracts', () => {
    expect(whitelistFor(['fighting'])).toEqual([
      { contract: 'dungeons.ale', actions: ['playdungeon'] },
      { contract: 'arena.ale', actions: ['playarena'] },
    ])
  })

  it('names a contract once when two groups share it', () => {
    /* Rewards and account settings both sign on players.ale. */
    const contracts = whitelistFor(['rewards', 'account']).map((e) => String(e.contract))
    expect(contracts.filter((c) => c === 'players.ale')).toHaveLength(1)
    expect(flat(['rewards', 'account'])).toContainEqual({ contract: 'players.ale', action: 'claimcur' })
    expect(flat(['rewards', 'account'])).toContainEqual({ contract: 'players.ale', action: 'settag' })
  })

  it('carries the no-op the CPU claim is billed through', () => {
    expect(flat(['cpu'])).toContainEqual({ contract: 'greymassnoop', action: 'noop' })
  })
})

describe('groupsFrom', () => {
  it('reads back the groups a whitelist covers', () => {
    expect(groupsFrom(flat(['travel', 'quests'])).sort()).toEqual(['quests', 'travel'])
  })

  it('leaves out a group whose actions are only half there', () => {
    const half = flat(['quests']).filter((a) => a.action !== 'reroll')
    expect(groupsFrom(half)).not.toContain('quests')
  })

  it('is empty for an empty whitelist', () => {
    expect(groupsFrom([])).toEqual([])
  })
})

describe('the groups themselves', () => {
  it('have an id, a label, a note and actions each, with no id twice', () => {
    const ids = new Set<string>()
    for (const group of AUTO_SIGN_GROUPS) {
      expect(group.id).toBeTruthy()
      expect(group.label).toBeTruthy()
      expect(group.note).toBeTruthy()
      expect(group.actions.length).toBeGreaterThan(0)
      expect(ids.has(group.id)).toBe(false)
      ids.add(group.id)
    }
  })
})
