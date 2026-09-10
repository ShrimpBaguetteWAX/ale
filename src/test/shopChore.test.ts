import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CHORE_CHECKS } from '@/chores/checks'
import type { Player } from '@/chain/types'
import type { ShopCooldown, ShopItem } from '@/shop/types'

/**
 * The shop dot, and who each free offer is actually free for.
 *
 * Reported from the game: the indicator was still lit after the day's free
 * energy had been claimed. Two of the sixteen shop items cost nothing, and
 * only one of them is free to everybody - the premium flask is Legend-only.
 *
 * A trial account can never claim that one, so it never gets a cooldown row
 * for it, so a check that asked "is it free, and is it off cooldown" found an
 * unclaimed free offer every single time it ran. Verified against mainnet
 * while the bug was live: fourteen wallets had claimed nrg.free today and not
 * nrg.freeleg, and every one of them was a trial account holding under 2,000
 * energy - fourteen dots that could not go out until midnight.
 *
 * The fix routes the check through the same canBuy the buy button uses. These
 * pin both halves: that a Legend-only offer is not a chore for a trial
 * account, and that it still is one for a Legend.
 */

const items = vi.hoisted(() => ({ list: [] as unknown[] }))
const cooldowns = vi.hoisted(() => ({ list: [] as unknown[] }))

vi.mock('@/shop/queries', () => ({
  fetchShopItems: async () => items.list,
  fetchShopCooldowns: async () => cooldowns.list,
}))

const shop = CHORE_CHECKS.find((c) => c.key === 'shop')!

/* The two free rows exactly as mainnet holds them, plus a priced one. */
const NRG_FREE: ShopItem = {
  item: 'nrg.free',
  category: 'flasks',
  offer_name: '100 Energy',
  title: 'Daily Energy',
  cost_wax: '0.00000000',
  cost_gem: 0,
  cost_dust: 0,
  cost_action_points: 0,
  gain_gem: 0,
  gain_dust: 0,
  gain_action_points: 100,
  gain_legend_acct_seconds: 0,
  cooldown_seconds: 86_400,
  trial_availability: 1,
  powerup_cpu: 0,
  powerup_max_cost_wax: '0.00000000',
}

/** Free, and Legend-only. The row that kept the dot lit. */
const NRG_FREELEG: ShopItem = {
  ...NRG_FREE,
  item: 'nrg.freeleg',
  offer_name: '1,000 Energy',
  title: 'Premium Daily Energy',
  gain_action_points: 1_000,
  trial_availability: 0,
}

const GEM_PACK: ShopItem = {
  ...NRG_FREE,
  item: 'gem.pack',
  category: 'gems',
  cost_wax: '49.00000000',
  gain_action_points: 0,
  gain_gem: 500,
  cooldown_seconds: 0,
  trial_availability: 1,
}

/** Midnight tonight, which is what the contract writes on a claim. */
const tonight = () => {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d.toISOString().replace('Z', '').slice(0, 19)
}

const claimed = (item: string, when = tonight()): ShopCooldown => ({
  index: 1,
  wallet: 'smoke.wam',
  item,
  cooldown_expired: when,
})

const player = (over: { legend?: boolean; energy?: number } = {}): Player =>
  ({
    wallet: 'smoke.wam',
    /* Every trial account on chain carries the epoch here, not an empty string. */
    legend_access_expiry: over.legend
      ? new Date(Date.now() + 86_400_000).toISOString().replace('Z', '').slice(0, 19)
      : '1970-01-01T00:00:00',
    activestats: { action_points: over.energy ?? 500, gems: 0, credits: 0 },
  }) as unknown as Player

beforeEach(() => {
  items.list = [GEM_PACK, NRG_FREE, NRG_FREELEG]
  cooldowns.list = []
})

describe('the shop chore, for a trial account', () => {
  it('goes out as soon as the one free offer it can take is claimed', async () => {
    /* The report, as a test. Before the fix this stayed true until midnight. */
    cooldowns.list = [claimed('nrg.free')]

    expect(await shop.run(player(), true)).toBe(false)
  })

  it('is lit while that offer is still there', async () => {
    expect(await shop.run(player(), true)).toBe(true)
  })

  it('counts nothing from a claim that expired at midnight', async () => {
    cooldowns.list = [claimed('nrg.free', '2020-01-01T00:00:00')]

    expect(await shop.run(player(), true)).toBe(true)
  })

  it('stays out above 1,999 energy, which the contract will not top up', async () => {
    /* Anti-hoarding: buyshopitem rejects the claim, so offering it would lie. */
    expect(await shop.run(player({ energy: 2_000 }), true)).toBe(false)
  })
})

describe('the shop chore, for a Legend', () => {
  it('still counts the premium flask, which is genuinely theirs to take', async () => {
    cooldowns.list = [claimed('nrg.free')]

    expect(await shop.run(player({ legend: true }), true)).toBe(true)
  })

  it('goes out only once both are claimed', async () => {
    cooldowns.list = [claimed('nrg.free'), claimed('nrg.freeleg')]

    expect(await shop.run(player({ legend: true }), true)).toBe(false)
  })

  it('is not woken by the 1,999 rule, which is a trial rule', async () => {
    expect(await shop.run(player({ legend: true, energy: 50_000 }), true)).toBe(true)
  })
})

describe('what the chore does not count', () => {
  it('ignores anything with a price on it', async () => {
    /* A gem pack has no cooldown at all, so a check that looked only at
       cooldowns would have found it claimable for ever. */
    items.list = [GEM_PACK]

    expect(await shop.run(player(), true)).toBe(false)
    expect(await shop.run(player({ legend: true }), true)).toBe(false)
  })
})
