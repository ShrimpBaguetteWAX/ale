import type { Player } from '@/chain/types'
import type { ShopCooldown, ShopItem } from './types'
import { NUM_LOCALE } from '@/format'

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
    return { label: item.cost_gem.toLocaleString(NUM_LOCALE), icon: '/assets/icons/gems.png' }
  }
  if (item.cost_dust > 0) {
    return { label: item.cost_dust.toLocaleString(NUM_LOCALE), icon: '/assets/icons/credits.png' }
  }
  if (item.cost_action_points > 0) {
    return {
      label: item.cost_action_points.toLocaleString(NUM_LOCALE),
      icon: '/assets/icons/energy.png',
    }
  }
  return { label: 'Free' }
}

/** What this gives, as one line. */
export function rewardOf(item: ShopItem): Price {
  if (item.gain_gem > 0) {
    return { label: item.gain_gem.toLocaleString(NUM_LOCALE), icon: '/assets/icons/gems.png' }
  }
  if (item.gain_dust > 0) {
    return { label: item.gain_dust.toLocaleString(NUM_LOCALE), icon: '/assets/icons/credits.png' }
  }
  if (item.gain_action_points > 0) {
    return {
      label: item.gain_action_points.toLocaleString(NUM_LOCALE),
      icon: '/assets/icons/energy.png',
    }
  }
  if (item.gain_legend_acct_seconds > 0) {
    return { label: Math.round(item.gain_legend_acct_seconds / 86400) + ' days' }
  }
  return { label: '—' }
}

export function itemArt(item: ShopItem): string {
  return `/assets/shop/${item.item}.webp`
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
