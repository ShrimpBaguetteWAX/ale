import { describe, expect, it } from 'vitest'
import { PrivateKey } from '@wharfkit/antelope'
import { isAuthorityError, normaliseKey, reconcile } from '@/wharf/autoSignSync'
import { AUTO_SIGN_GROUPS } from '@/wharf/autoSign'

/**
 * Auto-signing across browsers: the chain decides.
 *
 * Every browser keeps its own key under the one permission; any of them can
 * change the shared list or take a key away. These are the rules a browser
 * applies when it compares what it holds with what the chain says.
 */
const keyA = normaliseKey(String(PrivateKey.generate('K1').toPublic()))
const keyB = normaliseKey(String(PrivateKey.generate('K1').toPublic()))
const travel = AUTO_SIGN_GROUPS.find((g) => g.id === 'travel')!
const quests = AUTO_SIGN_GROUPS.find((g) => g.id === 'quests')!

describe('reconcile', () => {
  it('keeps this browser on while the permission still holds its key', () => {
    const r = reconcile(keyA, { keys: [keyA, keyB], links: [...travel.actions, ...quests.actions] })
    expect(r).toEqual({ groups: ['travel', 'quests'], active: true, exists: true })
  })

  it('turns this browser off when another took its key away', () => {
    const r = reconcile(keyA, { keys: [keyB], links: travel.actions })
    expect(r.active).toBe(false)
    expect(r.exists).toBe(true)
    expect(r.groups).toEqual(['travel'])
  })

  it('turns it off when the permission is gone altogether', () => {
    expect(reconcile(keyA, null)).toEqual({ groups: [], active: false, exists: false })
  })

  it('shows the shared list to a browser with no key of its own', () => {
    const r = reconcile(null, { keys: [keyB], links: quests.actions })
    expect(r).toEqual({ groups: ['quests'], active: false, exists: true })
  })

  it('counts a group only while every one of its actions is still linked', () => {
    const r = reconcile(keyA, { keys: [keyA], links: quests.actions.slice(1) })
    expect(r.groups).toEqual([])
  })
})

describe('normaliseKey', () => {
  it('reads the legacy and the K1 spelling of one key as the same', () => {
    const pub = PrivateKey.generate('K1').toPublic()
    expect(normaliseKey(pub.toLegacyString())).toBe(normaliseKey(String(pub)))
  })
})

describe('isAuthorityError', () => {
  it('knows the chain turning down who signed', () => {
    expect(isAuthorityError(new Error('transaction declares authority ... but does not have signatures for it: unsatisfied_authorization'))).toBe(true)
    expect(isAuthorityError({ json: { error: { name: 'irrelevant_auth_exception' } } })).toBe(true)
    expect(isAuthorityError(new Error('missing required authority someone.wam'))).toBe(true)
  })

  it('leaves every other failure alone', () => {
    expect(isAuthorityError(new Error('assertion failure with message: not enough energy'))).toBe(false)
    expect(isAuthorityError(new Error('User cancelled'))).toBe(false)
  })
})
