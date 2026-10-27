import { describe, expect, it } from 'vitest'
import { lastWeek, weekLabel } from '@/prizes/weekly'

describe('the weekly prizes window', () => {
  it('is the last full Monday-to-Sunday week, in UTC', () => {
    /* Tuesday 27 Oct 2026, mid-afternoon. */
    const w = lastWeek(Date.UTC(2026, 9, 27, 15, 30))
    expect(new Date(w.start).toISOString()).toBe('2026-10-19T00:00:00.000Z')
    expect(new Date(w.end).toISOString()).toBe('2026-10-26T00:00:00.000Z')
  })

  it('rolls over at Monday midnight UTC, not before', () => {
    const sunday = lastWeek(Date.UTC(2026, 9, 25, 23, 59))
    const monday = lastWeek(Date.UTC(2026, 9, 26, 0, 0))
    expect(new Date(sunday.start).toISOString()).toBe('2026-10-12T00:00:00.000Z')
    expect(new Date(monday.start).toISOString()).toBe('2026-10-19T00:00:00.000Z')
  })

  it('names the week by its Monday and Sunday', () => {
    expect(weekLabel(Date.UTC(2026, 9, 19))).toBe('19–25 Oct')
    expect(weekLabel(Date.UTC(2026, 8, 28))).toBe('28 Sept – 4 Oct')
  })
})
