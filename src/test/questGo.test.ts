import { describe, expect, it } from 'vitest'
import { questGo } from '@/quests/rules'
import type { Quest } from '@/quests/types'

const q = (task_type: string) => ({ task_type }) as Quest

describe('questGo', () => {
  it('sends a fight quest to the map, and a roster quest to its screen', () => {
    expect(questGo(q('dungeons_won'))).toEqual({ label: 'Find a dungeon', to: '/map' })
    expect(questGo(q('arenas_won'))?.label).toBe('Find an arena')
    expect(questGo(q('level_ups'))?.to).toBe('/fighters')
    expect(questGo(q('gems_in_candle'))?.to).toBe('/candle')
  })

  it('offers nothing for quests about quests, or a task type it does not know', () => {
    expect(questGo(q('quests_completed'))).toBeNull()
    expect(questGo(q('quests_rerolled'))).toBeNull()
    expect(questGo(q('something_new'))).toBeNull()
  })
})
