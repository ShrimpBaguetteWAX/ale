import type { KeyValue, Player } from '@/chain/types'
import type { Quest, QuestScope } from './types'
import { NUM_LOCALE, formatDecimals } from '@/format'

/**
 * How quests actually work, read out of `quests.ale` rather than off the
 * live screen.
 *
 * Two things about them are counter-intuitive enough to shape this whole
 * screen:
 *
 * 1. **A quest watches a lifetime counter, not an activity log.** Every task
 *    type is a key in the player's `permstats` map, which only ever grows.
 *    Issuing a quest snapshots that counter into `task_start_value` and sets
 *    `task_end_value` to the snapshot plus a rolled goal — so progress is the
 *    *difference*, and the goal is the difference too. Neither number on the
 *    row is the number to show.
 *
 * 2. **The reward is fixed and escrowed when the quest is issued**, not when
 *    it is completed: `qpremine` takes `pool_current * mine_power / 1e6`,
 *    moves that TLM to `quests.ale`, and deducts it from the pool. So the
 *    figure on a card is money already set aside for this player — and a
 *    reroll hands it back and rolls a fresh one, which is a real trade rather
 *    than a free redraw.
 */

/** The three cadences, in the order the original tabs them. */
export const SCOPES = ['day', 'week', 'month'] as const
export type Scope = (typeof SCOPES)[number]

export const SCOPE_LABEL: Record<string, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
}

/** Chain timestamps carry no zone. */
function ts(date: string): number {
  return Date.parse(date + 'Z')
}

/** `permstats` arrives as eosio's serialised map: a list of key/value pairs. */
export function permstat(player: Player, key: string): number {
  const hit = (player.permstats as KeyValue[] | undefined)?.find(
    (p) => p.first === key,
  )
  return Number(hit?.second ?? 0)
}

export interface QuestProgress {
  /** How far past the snapshot the counter has moved, floored at zero. */
  done: number
  /** How far it has to move in total. */
  goal: number
  /** 0–100, capped — a counter can overshoot and a bar should not. */
  percent: number
  complete: boolean
  expired: boolean
  /** Complete, in date, and therefore claimable right now. */
  claimable: boolean
  msLeft: number
}

export function progressOf(
  quest: Quest,
  player: Player,
  now = Date.now(),
): QuestProgress {
  const goal = Math.max(0, quest.task_end_value - quest.task_start_value)
  const raw = permstat(player, quest.task_type) - quest.task_start_value
  const done = raw > 0 ? raw : 0

  const expiry = ts(quest.expiry_date)
  const expired = Number.isFinite(expiry) && now >= expiry
  const complete = goal > 0 ? done >= goal : false

  return {
    done,
    goal,
    percent: goal > 0 ? Math.min(100, (done / goal) * 100) : 0,
    complete,
    expired,
    claimable: complete && !expired,
    msLeft: Number.isFinite(expiry) ? expiry - now : 0,
  }
}

/**
 * The quest text with its goal filled in.
 *
 * Descriptions ship with a literal `[amount]` token — "Travel [amount]
 * distance" — and the number that belongs there is the goal, not either of
 * the stored values.
 */
export function questText(quest: Quest): string {
  const goal = Math.max(0, quest.task_end_value - quest.task_start_value)
  return quest.quest_description.replace('[amount]', goal.toLocaleString(NUM_LOCALE))
}

/* ---------- rewards ---------- */

/**
 * Token precisions, from the symbols the contract builds its assets with:
 * `symbol("TLM", 4)` and `symbol("SHARDS", 1)`.
 */
const PRECISION: Record<string, number> = { tlm: 4, shards: 1 }

export interface Reward {
  amount: number
  label: string
  symbol: string
  icon: string
}

/**
 * A reward, to one decimal.
 *
 * TLM is stored to four places and Shards to one, but nobody picks a quest on
 * the fourth decimal of a Trilium — the tenth is the resolution the choice
 * actually turns on, and it lets three cards' figures line up in a row.
 *
 * The one case that needs care is the contract's floor: a TLM reward can be
 * as low as 100, which is 0.01 and rounds to "0.0" — a card advertising
 * nothing for a quest that does pay. Anything that would round away is shown
 * as "<0.1" instead.
 */
function rewardLabel(amount: number): string {
  if (amount > 0 && amount < 0.05) return '<0.1'
  return formatDecimals(amount, 1)
}

export function rewardOf(quest: Quest): Reward {
  const type = (quest.reward_type ?? '').toLowerCase()
  const places = PRECISION[type] ?? 0
  const amount = quest.reward_amount / Math.pow(10, places)

  return {
    amount,
    label: rewardLabel(amount),
    symbol: type === 'shards' ? 'Shards' : 'TLM',
    icon: type === 'shards' ? '/assets/icons/shards.svg' : '/assets/icons/tlm.svg',
  }
}

/* ---------- the board ---------- */

export interface ScopeBoard {
  scope: string
  label: string
  /** In-date quests, oldest slot first. */
  quests: Quest[]
  /** Quests whose window has closed; they occupy no slot and pay nothing. */
  expired: Quest[]
  claimable: number
  /** Slots the scope offers but has not filled. */
  emptySlots: number
  /** When this scope's current window closes. */
  endsAt?: number
}

/**
 * Sort every quest into its cadence.
 *
 * Expired quests are separated rather than dropped: they sit on the row until
 * the next `getquests` call clears them, and a player who sees three cards
 * vanish with no explanation has no way to know that a button will bring
 * three more. The original renders them as a permanently shimmering loading
 * skeleton, which says nothing at all.
 */
export function boardOf(
  quests: Quest[],
  scopes: QuestScope[],
  player: Player,
  now = Date.now(),
): ScopeBoard[] {
  return SCOPES.map((scope) => {
    const mine = quests.filter((q) => q.quest_scope === scope)
    const live: Quest[] = []
    const expired: Quest[] = []
    let claimable = 0

    for (const q of mine) {
      const p = progressOf(q, player, now)
      if (p.expired) expired.push(q)
      else {
        live.push(q)
        if (p.claimable) claimable += 1
      }
    }

    const row = scopes.find((s) => s.scopename === scope)
    const max = row?.max_quests ?? 0

    return {
      scope,
      label: SCOPE_LABEL[scope] ?? scope,
      quests: live,
      expired,
      claimable,
      emptySlots: Math.max(0, max - live.length),
      endsAt: row ? ts(row.quest_end) : undefined,
    }
  })
}

/**
 * Whether `getquests` has anything to do.
 *
 * The contract tops every scope up to `max_quests` and drops anything
 * expired, so the button is worth offering exactly when a scope is short or
 * something has run out — and is worth *hiding* otherwise, because pressing
 * it then costs a transaction and changes nothing.
 */
export function needsRefill(board: ScopeBoard[]): boolean {
  return board.some((s) => s.emptySlots > 0 || s.expired.length > 0)
}

/* ---------- time ---------- */

/**
 * "2d 06h 14m", "06h 14m", "14m 09s".
 *
 * Follows the original's scale: days once there are any, then hours, then
 * minutes, dropping to seconds only in the last minutes — a monthly quest
 * ticking down by the second is noise, and a daily one in its final hour is
 * not.
 */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'expired'

  const secs = Math.floor(ms / 1000)
  const d = Math.floor(secs / 86_400)
  const h = Math.floor((secs % 86_400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60

  const pad = (n: number) => String(n).padStart(2, '0')

  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`
  if (h > 0) return `${pad(h)}h ${pad(m)}m`
  return `${pad(m)}m ${pad(s)}s`
}

/** Artwork is per task type *and* cadence — 18 × 3 banners. */
export function questArt(quest: Quest): string {
  return `/assets/quests/${quest.task_type}_${quest.quest_scope}.webp`
}

/** A stable identity for a quest, for React keys and reroll matching. */
export function questKey(quest: Quest): string {
  return `${quest.quest_scope}:${quest.quest_name}:${quest.task_end_value}:${quest.reward_amount}`
}
