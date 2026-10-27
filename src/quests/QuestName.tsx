import { NUM_LOCALE } from '@/format'
import { questName } from './rules'
import type { Quest } from './types'

/** "Distance Traveled 120": the quest's name with its goal, the goal set off in its own colour. */
export function QuestName({ quest }: { quest: Quest }) {
  const { name, amount } = questName(quest)
  return (
    <>
      <span className="qname__name">{name}</span> <span className="qname__amt">{amount.toLocaleString(NUM_LOCALE)}</span>
    </>
  )
}

/** The same as plain text, for a title or a label. */
export function questNameText(quest: Quest): string {
  const { name, amount } = questName(quest)
  return `${name} ${amount.toLocaleString(NUM_LOCALE)}`
}
