import type { Player } from '@/chain/types'
import type { ShopCooldown, ShopItem } from './types'
import { NUM_LOCALE } from '@/format'
import { asset } from '@/assets'

/** Legend access is a timestamp on the player, not a flag. */
export function isLegend(player: Player): boolean {
  const until = Date.parse(player.legend_access_expiry + 'Z')
  return Number.isFinite(until) && until > Date.now()
}

export function legendExpiry(player: Player): Date | null {
  const until = Date.parse(player.legend_access_expiry + 'Z')
  return Number.isFinite(until) && until > Date.now() ? new Date(until) : null
}

export function waxAmount(costWax: string): number {
  return parseFloat(costWax) || 0
}

export function isWaxPriced(item: ShopItem): boolean {
  return waxAmount(item.cost_wax) > 0
}

/** Nothing to pay in any currency — the daily flasks. */
export function isFree(item: ShopItem): boolean {
  return (
    !isWaxPriced(item) &&
    item.cost_gem === 0 &&
    item.cost_dust === 0 &&
    item.cost_action_points === 0
  )
}

/**
 * When this item next becomes claimable, or null if it is ready.
 *
 * The contract snaps a 24h cooldown to the UTC day boundary
 * (`.../86400*86400`), so the daily flask resets at midnight UTC rather than
 * 24 hours after you claimed it. Showing a rolling 24h countdown would be
 * wrong by up to a day.
 */
export function cooldownUntil(
  item: ShopItem,
  cooldowns: ShopCooldown[],
): Date | null {
  if (item.cooldown_seconds <= 0) return null
  let latest = 0
  for (const row of cooldowns) {
    if (row.item !== item.item) continue
    const t = Date.parse(row.cooldown_expired + 'Z')
    if (Number.isFinite(t) && t > latest) latest = t
  }
  return latest > Date.now() ? new Date(latest) : null
}

export interface Affordability {
  /** Whether the buy button should be enabled. */
  canBuy: boolean
  /**
   * Short enough to sit on the button, and only set when the price alone
   * would not explain the block. Simply being unable to afford something
   * needs no words: the price on a greyed-out button already says it.
   */
  reason?: string
  /** The long form, for the button title. */
  detail?: string
}

/**
 * Whether the player can buy this right now, mirroring every check in
 * `shop::buyshopitem` so the UI never offers a purchase the chain will reject.
 */
export function canBuy(
  item: ShopItem,
  player: Player,
  cooldowns: ShopCooldown[],
  waxBalance: number,
): Affordability {
  const legend = isLegend(player)

  if (!item.trial_availability && !legend) {
    return {
      canBuy: false,
      reason: 'Legend only',
      detail: 'This item is only available to Legend accounts',
    }
  }

  const until = cooldownUntil(item, cooldowns)
  if (until) return { canBuy: false, reason: 'On cooldown' }

  /*
   * The contract's trial guard: a non-Legend player sitting on more than 1999
   * energy cannot take a free flask. It reads as an anti-hoarding rule — top
   * up when you are low, not to stockpile.
   */
  if (isFree(item) && !legend && player.activestats.action_points > 1999) {
    return {
      canBuy: false,
      reason: 'Under 2,000 energy only',
      detail:
        'Trial accounts can only claim free energy while holding under 2,000',
    }
  }

  if (isWaxPriced(item)) {
    const cost = waxAmount(item.cost_wax)
    if (cost <= waxBalance) return { canBuy: true }
    return {
      canBuy: false,
      detail:
        'Costs ' + cost.toLocaleString(NUM_LOCALE) + ' WAX — you have ' +
        Math.floor(waxBalance).toLocaleString(NUM_LOCALE),
    }
  }

  if (item.cost_gem > player.activestats.gems) {
    return {
      canBuy: false,
      detail:
        'Costs ' + item.cost_gem.toLocaleString(NUM_LOCALE) + ' gems — you have ' +
        player.activestats.gems.toLocaleString(NUM_LOCALE),
    }
  }
  if (item.cost_dust > player.activestats.credits) {
    return {
      canBuy: false,
      detail:
        'Costs ' + item.cost_dust.toLocaleString(NUM_LOCALE) + ' credits — you have ' +
        player.activestats.credits.toLocaleString(NUM_LOCALE),
    }
  }
  if (item.cost_action_points > player.activestats.action_points) {
    return {
      canBuy: false,
      detail:
        'Costs ' + item.cost_action_points.toLocaleString(NUM_LOCALE) + ' energy — you have ' +
        player.activestats.action_points.toLocaleString(NUM_LOCALE),
    }
  }

  return { canBuy: true }
}

/** "2h 14m", "45m", "30s" — enough precision to know whether to wait. */
export function formatCountdown(until: Date): string {
  const secs = Math.max(0, Math.round((until.getTime() - Date.now()) / 1000))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${secs}s`
}

export interface Price {
  label: string
  icon?: string
}

/** What this costs, as one line. */
export function priceOf(item: ShopItem): Price {
  if (isWaxPriced(item)) {
    return { label: waxAmount(item.cost_wax).toLocaleString(NUM_LOCALE) + ' WAX' }
  }
  if (item.cost_gem > 0) {
    return { label: item.cost_gem.toLocaleString(NUM_LOCALE), icon: asset('/assets/icons/gems.png') }
  }
  if (item.cost_dust > 0) {
    return { label: item.cost_dust.toLocaleString(NUM_LOCALE), icon: asset('/assets/icons/credits.png') }
  }
  if (item.cost_action_points > 0) {
    return {
      label: item.cost_action_points.toLocaleString(NUM_LOCALE),
      icon: asset('/assets/icons/energy.png'),
    }
  }
  return { label: 'Free' }
}

/** What this gives, as one line. */
export function rewardOf(item: ShopItem): Price {
  if (item.gain_gem > 0) {
    return { label: item.gain_gem.toLocaleString(NUM_LOCALE), icon: asset('/assets/icons/gems.png') }
  }
  if (item.gain_dust > 0) {
    return { label: item.gain_dust.toLocaleString(NUM_LOCALE), icon: asset('/assets/icons/credits.png') }
  }
  if (item.gain_action_points > 0) {
    return {
      label: item.gain_action_points.toLocaleString(NUM_LOCALE),
      icon: asset('/assets/icons/energy.png'),
    }
  }
  if (item.gain_legend_acct_seconds > 0) {
    return { label: Math.round(item.gain_legend_acct_seconds / 86400) + ' days' }
  }
  return { label: '—' }
}

/** What an item costs and gives as plain numbers, in its own units. */
function costAmount(item: ShopItem): number {
  if (isWaxPriced(item)) return waxAmount(item.cost_wax)
  return item.cost_gem || item.cost_dust || item.cost_action_points || 0
}
function gainAmount(item: ShopItem): number {
  return item.gain_gem || item.gain_dust || item.gain_action_points || item.gain_legend_acct_seconds || 0
}

/* The unit a price or a reward is counted in, for a sentence. */
function costUnit(item: ShopItem): string {
  if (isWaxPriced(item)) return 'WAX'
  return item.cost_gem ? 'gems' : item.cost_dust ? 'credits' : 'energy'
}
function gainUnit(item: ShopItem): string {
  return item.gain_gem ? 'gems' : item.gain_dust ? 'credits' : 'energy'
}

/**
 * What one unit of the price buys: "2.04 gems per WAX", "1,200 credits per
 * gem" — or, for a Legend pass, which is time, "833 gems a month". The badge
 * says how much better a rung is; this says what it is, so two rows can be
 * compared without arithmetic. Nothing for a free item.
 */
export function rateOf(item: ShopItem): string | undefined {
  const cost = costAmount(item)
  const gain = gainAmount(item)
  if (!cost || !gain) return undefined
  if (item.gain_legend_acct_seconds > 0) {
    const months = item.gain_legend_acct_seconds / (30 * 86400)
    return `${Math.round(cost / months).toLocaleString(NUM_LOCALE)} ${costUnit(item)} a month`
  }
  const per = gain / cost
  const figure =
    per >= 100
      ? Math.round(per).toLocaleString(NUM_LOCALE)
      : per.toLocaleString(NUM_LOCALE, {
          minimumFractionDigits: per >= 10 ? 1 : 2,
          maximumFractionDigits: per >= 10 ? 1 : 2,
        })
  const unit = costUnit(item)
  return `${figure} ${gainUnit(item)} per ${unit === 'gems' ? 'gem' : unit === 'credits' ? 'credit' : unit}`
}

/**
 * How much better a rung of the ladder is than the bottom one, as a short
 * badge: "+22%" more of the reward for the same money, or "save 17%" on a
 * Legend pass, which is time and so reads as a price per day.
 *
 * Measured against the cheapest paid item in the same list and the same
 * currency; free items and the bottom rung itself get nothing.
 */
export function valueBadges(items: ShopItem[]): Map<string, string> {
  return new Map([...valueAgainst(items)].map(([k, v]) => [k, v.badge]))
}

/** A rung's badge and the bottom rung it is measured against. */
export interface PackValue {
  badge: string
  base: ShopItem
}

/** valueBadges, keeping the rung each badge is measured against. */
export function valueAgainst(items: ShopItem[]): Map<string, PackValue> {
  const values = new Map<string, PackValue>()
  const paid = items.filter((i) => costAmount(i) > 0 && gainAmount(i) > 0)
  const groups = new Map<string, ShopItem[]>()
  for (const i of paid) {
    const unit = isWaxPriced(i) ? 'wax' : i.cost_gem ? 'gem' : i.cost_dust ? 'dust' : 'ap'
    groups.set(unit, [...(groups.get(unit) ?? []), i])
  }
  for (const group of groups.values()) {
    const base = group.reduce((a, b) => (costAmount(b) < costAmount(a) ? b : a))
    const baseRatio = gainAmount(base) / costAmount(base)
    for (const i of group) {
      if (i === base) continue
      const ratio = gainAmount(i) / costAmount(i)
      if (i.gain_legend_acct_seconds > 0) {
        const save = Math.round((1 - baseRatio / ratio) * 100)
        if (save >= 1) values.set(i.item, { badge: `save ${save}%`, base })
      } else {
        const more = Math.round((ratio / baseRatio - 1) * 100)
        if (more >= 1) values.set(i.item, { badge: `+${more}%`, base })
      }
    }
  }
  return values
}

/**
 * The badge as a sentence that names what it is measured against, for the
 * purchase dialog: "+8% more gems per WAX than Gem Pack S", or for a pass,
 * "17% less a month than Legend - 1 Month".
 */
export function valueLine(item: ShopItem, value: PackValue): string {
  if (item.gain_legend_acct_seconds > 0) {
    return `${value.badge.replace('save ', '')} less a month than ${value.base.title}`
  }
  const per = costUnit(item)
  return `${value.badge} more ${gainUnit(item)} per ${per === 'gems' ? 'gem' : per === 'credits' ? 'credit' : per} than ${value.base.title}`
}

/** What a purchase leaves of the currency it is paid in, or nothing for a free one. */
export function leftAfter(item: ShopItem, player: Player, waxBalance: number): string | undefined {
  const left = (have: number, cost: number, unit: string) =>
    `${Math.max(0, Math.floor(have - cost)).toLocaleString(NUM_LOCALE)} ${unit}`
  if (isWaxPriced(item)) return left(waxBalance, waxAmount(item.cost_wax), 'WAX')
  if (item.cost_gem > 0) return left(player.activestats.gems, item.cost_gem, 'gems')
  if (item.cost_dust > 0) return left(player.activestats.credits, item.cost_dust, 'credits')
  if (item.cost_action_points > 0) return left(player.activestats.action_points, item.cost_action_points, 'energy')
  return undefined
}

/**
 * The two free daily energy flasks, trial and Legend, by how much energy
 * each gives — read off the shop's own rows so the Legend benefit can say
 * "1,000 energy a day, not 100" and stay right if the contract changes them.
 */
export function dailyFlasks(items: ShopItem[]): { trial: number; legend: number } | null {
  const free = items.filter((i) => isFree(i) && i.gain_action_points > 0)
  const trial = free.find((i) => i.trial_availability)?.gain_action_points
  const legend = free.find((i) => !i.trial_availability)?.gain_action_points
  return trial && legend ? { trial, legend } : null
}

export function itemArt(item: ShopItem): string {
  return asset(`/assets/shop/${item.item}.webp`)
}

/**
 * A WAX balance as a whole number.
 *
 * Rounded *down*: the fractional part is noise next to prices that run to
 * five figures, and flooring can never show a player more spending power than
 * they actually have.
 */
export function formatWax(amount: number): string {
  return Math.floor(amount).toLocaleString(NUM_LOCALE)
}

/**
 * What is left on a Legend pass, the way a player counts it: whole days
 * while there are any ("157 days left"), then hours and minutes for the
 * last one ("5h 12m left").
 */
export function legendLeft(ms: number): string {
  if (ms <= 0) return 'Ended'
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`
}
