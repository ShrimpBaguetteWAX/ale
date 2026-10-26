import { describe, expect, it } from 'vitest'
import { isOlderRow } from '@/state/useGame'
import type { Player } from '@/chain/types'

/**
 * A player row read from a node that is behind must not undo a newer one.
 *
 * Leaving an arena re-reads the row; a lagging node answered with the row
 * from before the last travel, and the map put the player back on the land
 * they had left. `users::travel` stamps `last_action` with the move, so the
 * older row is the one with the earlier stamp.
 */
const row = (wallet: string, last_action: string, x: number) =>
  ({ wallet, last_action, x, y: 5 }) as unknown as Player

describe('isOlderRow', () => {
  const now = row('someone.wam', '2026-10-26T18:20:00', 21)

  it('refuses a row stamped before the one held', () => {
    expect(isOlderRow(row('someone.wam', '2026-10-26T18:05:00', 14), now)).toBe(true)
  })

  it('takes a row stamped at the same time or later', () => {
    expect(isOlderRow(row('someone.wam', '2026-10-26T18:20:00', 21), now)).toBe(false)
    expect(isOlderRow(row('someone.wam', '2026-10-26T18:30:00', 22), now)).toBe(false)
  })

  it('takes anything when there is nothing held, or it is another wallet', () => {
    expect(isOlderRow(row('someone.wam', '2026-10-26T18:05:00', 14), null)).toBe(false)
    expect(isOlderRow(row('other.wam', '2020-01-01T00:00:00', 1), now)).toBe(false)
  })
})
