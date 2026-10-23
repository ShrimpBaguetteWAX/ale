import { describe, expect, it } from 'vitest'
import { valueBadges } from '@/shop/rules'
import type { ShopItem } from '@/shop/types'

/* Just enough of a shop row to price it. */
const item = (patch: Partial<ShopItem>): ShopItem => ({
  item: 'x',
  category: 'gems',
  offer_name: '',
  title: '',
  cost_wax: '0.00000000 WAX',
  cost_gem: 0,
  cost_dust: 0,
  cost_action_points: 0,
  gain_gem: 0,
  gain_dust: 0,
  gain_action_points: 0,
  gain_legend_acct_seconds: 0,
  cooldown_seconds: 0,
  trial_availability: true,
  powerup_cpu: 0,
  powerup_max_cost_wax: '0.00000000 WAX',
  ...patch,
})

describe('the value badges', () => {
  it('says how much more a bigger gem pack gives per WAX', () => {
    const badges = valueBadges([
      item({ item: 's', cost_wax: '49.00000000 WAX', gain_gem: 100 }),
      item({ item: 'm', cost_wax: '499.00000000 WAX', gain_gem: 1100 }),
      item({ item: 'xl', cost_wax: '49999.00000000 WAX', gain_gem: 140000 }),
    ])
    expect(badges.has('s')).toBe(false)
    expect(badges.get('m')).toBe('+8%')
    expect(badges.get('xl')).toBe('+37%')
  })

  it('says what a longer Legend pass saves per day', () => {
    const day = 86400
    const badges = valueBadges([
      item({ item: 'one', category: 'account', cost_gem: 999, gain_legend_acct_seconds: 30 * day }),
      item({ item: 'three', category: 'account', cost_gem: 2499, gain_legend_acct_seconds: 90 * day }),
      item({ item: 'six', category: 'account', cost_gem: 3999, gain_legend_acct_seconds: 180 * day }),
    ])
    expect(badges.get('three')).toBe('save 17%')
    expect(badges.get('six')).toBe('save 33%')
  })

  it('leaves free items out of the comparison', () => {
    const badges = valueBadges([
      item({ item: 'daily', gain_action_points: 100 }),
      item({ item: 's', cost_dust: 1999, gain_action_points: 300 }),
    ])
    expect(badges.size).toBe(0)
  })
})
