import type { StakeWeight } from './types'
import { weightOf } from './rules'

/**
 * Cards of one kind, counted rather than listed.
 *
 * A farming wallet holds hundreds of copies of a dozen designs, and every
 * copy of a design is worth exactly what every other copy is: `farm.ale`
 * prices a card by its rarity and shine and nothing else. So a grid of every
 * asset was a grid of duplicates, and picking forty shovels meant forty
 * clicks on forty tiles that could not be told apart.
 *
 * The stack is the design; the amount is what the player chooses. The asset
 * ids stay on it, because the chain still wants ids — `selectedIds` turns an
 * amount back into the ids to put in the transaction.
 */
export interface CardStack {
  /** template, rarity and shine — what decides both art and weight. */
  key: string
  template_id: number
  name: string
  rarity: string
  shine: string
  /** Weight of one card, so a stack's worth is this times the amount. */
  weight: number
  /** Every copy the player holds, in the order the chain returned them. */
  ids: string[]
  /** The card's own artwork on IPFS, for designs the build ships no file for. */
  img?: string
}

interface Groupable {
  asset_id: string
  template_id: number
  rarity: string
  shine: string
  img?: string
}

function keyOf(c: Groupable): string {
  return `${c.template_id}|${(c.rarity ?? '').toLowerCase()}|${(c.shine ?? '').toLowerCase()}`
}

/**
 * Group cards into stacks, heaviest first.
 *
 * Rarity and shine are part of the key, not just the template: the same
 * design in Gold is a different weight from the same design in Stone, and
 * merging them would make the weight on the tile a lie.
 */
export function stackCards<T extends Groupable>(
  cards: T[],
  nameOf: (card: T) => string,
  weightFor: (card: T) => number,
): CardStack[] {
  const stacks = new Map<string, CardStack>()

  for (const card of cards) {
    const key = keyOf(card)
    const found = stacks.get(key)
    if (found) {
      found.ids.push(card.asset_id)
      continue
    }
    stacks.set(key, {
      key,
      template_id: card.template_id,
      name: nameOf(card),
      rarity: card.rarity,
      shine: card.shine,
      weight: weightFor(card),
      ids: [card.asset_id],
      img: card.img,
    })
  }

  return [...stacks.values()].sort(
    (a, b) =>
      b.weight - a.weight ||
      a.name.localeCompare(b.name) ||
      a.template_id - b.template_id,
  )
}

/** Stacks of the cards in a wallet, weighted from `stakeweight`. */
export function inventoryStacks<T extends Groupable & { name: string }>(
  cards: T[],
  weights: StakeWeight[],
): CardStack[] {
  return stackCards(
    cards,
    (c) => c.name,
    (c) => weightOf(c, weights),
  )
}

/** Stacks of what is already staked, which carries its own weight. */
export function stakedStacks<T extends Groupable & { weight: number }>(
  cards: T[],
): CardStack[] {
  return stackCards(
    cards,
    (c) => `#${c.template_id}`,
    (c) => c.weight,
  )
}

/**
 * A typed or stepped amount, made safe for a stack.
 *
 * Whole cards only, never fewer than none and never more than are held —
 * typing 900 into a stack of 12 asks for the 12.
 */
export function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(Math.floor(value), max))
}

/** How many cards the amounts add up to. */
export function totalPicked(
  stacks: CardStack[],
  counts: Record<string, number>,
): number {
  return stacks.reduce(
    (sum, stack) => sum + clampCount(counts[stack.key] ?? 0, stack.ids.length),
    0,
  )
}

/**
 * The asset ids the amounts stand for.
 *
 * Taken from the front of each stack, which is the order the chain listed
 * them in: one copy of a design is worth exactly what the next is, so which
 * ones go is a choice with no consequence — but it has to be a stable one,
 * or the ids signed would not be the ids counted.
 */
export function selectedIds(
  stacks: CardStack[],
  counts: Record<string, number>,
): string[] {
  const out: string[] = []
  for (const stack of stacks) {
    const n = clampCount(counts[stack.key] ?? 0, stack.ids.length)
    if (n > 0) out.push(...stack.ids.slice(0, n))
  }
  return out
}
