import { beforeEach, describe, expect, it } from 'vitest'
import { claimedRecently, forgetClaimed, rememberClaimed } from '@/quests/claimed'

describe('quests claimed here', () => {
  beforeEach(() => forgetClaimed())

  it('remembers a claim, so a lagging node cannot bring the quest back', () => {
    const now = Date.parse('2026-10-22T12:00:00Z')
    expect(claimedRecently('day:useportals:181:41168', now)).toBe(false)
    rememberClaimed('day:useportals:181:41168', now)
    expect(claimedRecently('day:useportals:181:41168', now + 5 * 60_000)).toBe(true)
    /* A different quest in the same slot is not hidden. */
    expect(claimedRecently('day:useportals:183:40211', now)).toBe(false)
  })

  it('forgets after an hour', () => {
    const now = Date.parse('2026-10-22T12:00:00Z')
    rememberClaimed('week:recruitsl:171:67439', now)
    expect(claimedRecently('week:recruitsl:171:67439', now + 59 * 60_000)).toBe(true)
    expect(claimedRecently('week:recruitsl:171:67439', now + 61 * 60_000)).toBe(false)
  })
})
