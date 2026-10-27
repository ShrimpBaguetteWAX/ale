import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DeskQuests } from '@/quests/DeskQuests'
import { ScopePanel } from '@/routes/Quests'
import type { ScopeBoard } from '@/quests/rules'
import type { Quest } from '@/quests/types'
import type { Player } from '@/chain/types'

/**
 * The journal stays on a quest through a reroll.
 *
 * A reroll replaces the quest with one that has a new key, so the picked
 * quest leaves the board — and the journal used to fall back to the top of
 * the list. It should land on the replacement: the quest in the same cadence
 * that was not there before.
 */
const NOW = Date.parse('2026-10-27T12:00:00Z')

const quest = (name: string, scope: string, title: string): Quest =>
  ({
    quest_name: name,
    quest_scope: scope,
    quest_title: title,
    quest_description: 'Do the thing [amount] times',
    task_type: 'dungeons_won',
    task_start_value: 0,
    task_end_value: 4,
    expiry_date: '2026-11-30T00:00:00',
    reward_type: 'tlm',
    reward_amount: 98000,
    mine_power: 1,
    mine_completed: true,
  }) as Quest

const player = { wallet: 'someone.wam', permstats: [{ first: 'dungeons_won', second: 0 }] } as unknown as Player

const boardOf = (day: Quest[], week: Quest[]): ScopeBoard[] => [
  { scope: 'day', label: 'Daily', quests: day, expired: [], claimable: 0, emptySlots: 0 },
  { scope: 'week', label: 'Weekly', quests: week, expired: [], claimable: 0, emptySlots: 0 },
]

const view = (board: ScopeBoard[], onReroll = vi.fn()) => (
  <MemoryRouter>
    <DeskQuests
      board={board}
      player={player}
      credits={1000}
      now={NOW}
      busy={new Map()}
      canAct
      onClaim={vi.fn()}
      onReroll={onReroll}
    />
  </MemoryRouter>
)

describe('the quest journal', () => {
  it('lands on the replacement after a reroll, not the top of the list', () => {
    const a = quest('a', 'day', 'Daily one')
    const b = quest('b', 'week', 'Weekly one')
    const c = quest('c', 'week', 'Weekly two')
    const onReroll = vi.fn()
    const { rerender } = render(view(boardOf([a], [b, c]), onReroll))

    fireEvent.click(screen.getByRole('button', { name: /Weekly two/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Weekly two' })).toBeInTheDocument()

    /* No confirmation: Reroll goes straight through. */
    fireEvent.click(screen.getByRole('button', { name: /Reroll/ }))
    expect(onReroll).toHaveBeenCalledWith(c)

    const fresh = quest('d', 'week', 'Weekly three')
    rerender(view(boardOf([a], [b, fresh]), onReroll))
    expect(screen.getByRole('heading', { level: 2, name: 'Weekly three' })).toBeInTheDocument()
  })
})

describe('the phone quest cards', () => {
  it('reroll on the first press', () => {
    const a = quest('a', 'day', 'Daily one')
    const onReroll = vi.fn()
    render(
      <MemoryRouter>
        <ScopePanel
          board={boardOf([a], [])[0]}
          player={player}
          credits={1000}
          now={NOW}
          busy={new Map()}
          canAct
          onClaim={vi.fn()}
          onReroll={onReroll}
        />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Reroll/ }))
    expect(onReroll).toHaveBeenCalledWith(a)
  })
})
