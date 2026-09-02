import type { Objective, TavernTemplate } from './types'

/**
 * Base action-point cost of a hire.
 *
 * Hardcoded in `users::hire` — `uint64_t ap_cost = 100;` with a TODO to make
 * it configurable. `tavern.ale`'s config carries a `cost_hire_ap` field that
 * currently also reads 100, but the contract does not consult it, so this
 * number is the one that governs.
 */
export const HIRE_BASE_AP = 100

/**
 * Cards a player may bring to a hire.
 *
 * A game rule, not a contract one: users::hire loops over whatever asset_ids
 * it is given without a length check, so this is enforced here and nowhere
 * else. Worth knowing if the rule ever needs to change.
 */
export const MAX_HIRE_CARDS = 3

/** Does one template satisfy one objective? Mirrors `users::hire`. */
export function matchesObjective(o: Objective, t: TavernTemplate): boolean {
  switch (o.objective_type) {
    case 'schema':
      return o.objective_string === t.schema
    case 'rarity':
      return o.objective_string === t.rarity
    case 'type':
      return o.objective_string === t.type
    case 'shine':
      return o.objective_string === t.shine
    case 'element':
      // The contract accepts either field here, so a weapon's class counts as
      // its element.
      return o.objective_string === t.element || o.objective_string === t.weaponclass
    case 'race':
      return o.objective_string === t.race
    case 'cardname':
      return o.objective_string === t.cardname
    case 'atk':
      return o.objective_value === t.atk
    case 'def':
      return o.objective_value === t.def
    case 'movcost':
      return o.objective_value === t.movcost
    case 'pow':
      return o.objective_value === t.pow
    case 'nft.mp':
      return o.objective_value === t.nft_mp
    case 'tlm.mp':
      return o.objective_value === t.tlm_mp
    default:
      return false
  }
}

export interface HireBreakdown {
  /** Action points the hire will cost. */
  cost: number
  /** Total reduction earned. */
  saved: number
  /** Indices into the original objective list that were consumed, per card. */
  matchedByCard: number[][]
  /** Every consumed objective index, for highlighting the list. */
  matched: Set<number>
}

/**
 * Work out what a hire costs for a given selection of cards.
 *
 * This has to mirror `users::hire` exactly, because the contract asserts the
 * client's number: `check(cost_action_points == ap_cost, ...)`. Get it wrong
 * and the transaction fails in the player's wallet with a cost mismatch.
 *
 * Two details that are easy to get wrong:
 *  - An objective is *consumed* by the first card that matches it, so two
 *    identical cards do not claim the same objective twice.
 *  - The contract walks objectives from the end of the list backwards, and
 *    erases as it goes. With distinct objectives the order is irrelevant, but
 *    it is replicated here so the two can never disagree.
 */
export function calculateHire(
  objectives: Objective[],
  cards: TavernTemplate[],
): HireBreakdown {
  const remaining = objectives.map((o, index) => ({ o, index }))
  const matchedByCard: number[][] = []
  const matched = new Set<number>()
  let saved = 0

  for (const card of cards) {
    const claimed: number[] = []
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (!matchesObjective(remaining[i].o, card)) continue
      saved += remaining[i].o.mod_value
      claimed.push(remaining[i].index)
      matched.add(remaining[i].index)
      remaining.splice(i, 1)
    }
    matchedByCard.push(claimed)
  }

  return {
    cost: Math.max(0, HIRE_BASE_AP - saved),
    saved,
    matchedByCard,
    matched,
  }
}

/** Objectives beyond this can't be held in a 31-bit mask. */
const MASK_LIMIT = 31

/**
 * The cheapest possible hire, exactly — not a heuristic.
 *
 * What makes this affordable is that cards collapse hard: a wallet holding 164
 * eligible templates has only ~37 *distinct* patterns of objectives it can
 * claim, because a card matters here solely for which objectives it satisfies.
 * Deduplicating on that pattern turns "choose 3 of 164" into "choose 3 of 37",
 * which is a few thousand combinations — instant, and provably optimal rather
 * than a greedy guess that can strand value under a tight card limit.
 *
 * Each pattern is a bitmask over the objective list, so combining cards is an
 * OR: a card claiming an objective a previous card already took adds nothing,
 * which is exactly the contract's consume-once behaviour.
 */
export function suggestCards(
  objectives: Objective[],
  inventory: TavernTemplate[],
  limit = MAX_HIRE_CARDS,
): TavernTemplate[] {
  if (objectives.length === 0 || inventory.length === 0) return []
  if (objectives.length > MASK_LIMIT) return greedyCards(objectives, inventory, limit)

  // One representative card per distinct claim-pattern.
  const byMask = new Map<number, TavernTemplate>()
  for (const card of inventory) {
    let mask = 0
    for (let i = 0; i < objectives.length; i++) {
      if (matchesObjective(objectives[i], card)) mask |= 1 << i
    }
    if (mask !== 0 && !byMask.has(mask)) byMask.set(mask, card)
  }

  const masks = [...byMask.keys()]
  if (masks.length === 0) return []

  const value = objectives.map((o) => o.mod_value)
  const scoreOf = (mask: number) => {
    let sum = 0
    for (let i = 0; i < value.length; i++) if (mask & (1 << i)) sum += value[i]
    return sum
  }

  let bestScore = -1
  let bestCombo: number[] = []

  // Every combination of up to `limit` patterns.
  const walk = (start: number, chosen: number[], mask: number) => {
    const score = scoreOf(mask)
    if (chosen.length > 0 && score > bestScore) {
      bestScore = score
      bestCombo = [...chosen]
    }
    if (chosen.length === limit) return
    for (let i = start; i < masks.length; i++) {
      // A pattern that adds nothing can only waste a slot.
      if ((mask | masks[i]) === mask) continue
      chosen.push(masks[i])
      walk(i + 1, chosen, mask | masks[i])
      chosen.pop()
    }
  }
  walk(0, [], 0)

  return bestCombo.map((m) => byMask.get(m)!).filter(Boolean)
}

/** Fallback for the pathological case of more objectives than mask bits. */
function greedyCards(
  objectives: Objective[],
  inventory: TavernTemplate[],
  limit: number,
): TavernTemplate[] {
  const pool = [...inventory]
  const chosen: TavernTemplate[] = []

  while (chosen.length < limit) {
    let bestGain = 0
    let bestIndex = -1
    const base = calculateHire(objectives, chosen).saved

    for (let i = 0; i < pool.length; i++) {
      const gain = calculateHire(objectives, [...chosen, pool[i]]).saved - base
      if (gain > bestGain) {
        bestGain = gain
        bestIndex = i
      }
    }

    if (bestIndex < 0) break
    chosen.push(pool[bestIndex])
    pool.splice(bestIndex, 1)
  }

  return chosen
}

/** Human label for an objective, e.g. "Element: Fire" or "Defense = 8". */
export function objectiveLabel(o: Objective): string {
  const numeric: Record<string, string> = {
    atk: 'Attack',
    def: 'Defense',
    movcost: 'Move cost',
    pow: 'Power',
    'nft.mp': 'NFT mining power',
    'tlm.mp': 'TLM mining power',
  }

  if (o.objective_type in numeric) {
    return `${numeric[o.objective_type]} = ${o.objective_value}`
  }

  const named: Record<string, string> = {
    schema: 'Schema',
    rarity: 'Rarity',
    type: 'Type',
    shine: 'Shine',
    element: 'Element',
    race: 'Race',
    cardname: 'Card',
  }
  const label = named[o.objective_type] ?? o.objective_type
  return `${label}: ${o.objective_string}`
}
