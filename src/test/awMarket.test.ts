import { describe, expect, it, vi } from 'vitest'
import { marketCardsFrom, waxAsset } from '@/chain/atomic'
import { saleStatus } from '@/shop/market'
import { waxLabel } from '@/shop/MarketTab'
import { buyMarketSale } from '@/wharf/actions'
import type { Session } from '@/wharf/session'

/**
 * The Shop's Market tab spends real WAX on someone else's sale, so the parts
 * that decide how much are pinned down here: the price string is the
 * listing's own to the last decimal, nothing but a single card listed in WAX
 * is offered, and the transaction asserts, sends and buys at that one figure.
 */

const sale = (over: Record<string, unknown> = {}) => ({
  sale_id: '175029934',
  listing_price: '4790691',
  listing_symbol: 'WAX',
  price: { token_precision: 8 },
  assets: [
    {
      asset_id: '1099938642851',
      name: 'Standard Shovel',
      template: { template_id: '19552', immutable_data: { name: 'Standard Shovel', rarity: 'Abundant', shine: 'Stone', img: 'Qm1' } },
    },
  ],
  ...over,
})

describe('the market price', () => {
  it('keeps every decimal of the listing', () => {
    expect(waxAsset('4790691', 8)).toBe('0.04790691 WAX')
    expect(waxAsset('67000000000', 8)).toBe('670.00000000 WAX')
    expect(waxAsset('100000000', 8)).toBe('1.00000000 WAX')
    expect(waxAsset('7', 8)).toBe('0.00000007 WAX')
  })

  it('rounds a shown price up, never down', () => {
    expect(waxLabel(0.04790691)).toBe('0.048 WAX')
    expect(waxLabel(670)).toBe('670 WAX')
    expect(waxLabel(6693.081)).toBe('6,693.09 WAX')
  })
})

describe('the cards on sale', () => {
  it('turns a sale into a card at its exact price', () => {
    const [card] = marketCardsFrom([sale()], 'tool.worlds')
    expect(card).toMatchObject({
      saleId: '175029934',
      assetId: '1099938642851',
      templateId: 19552,
      name: 'Standard Shovel',
      rarity: 'Abundant',
      price: '0.04790691 WAX',
    })
  })

  it('offers only single cards listed in WAX, once per template', () => {
    const cards = marketCardsFrom(
      [
        sale(),
        sale({ sale_id: '2' }), // the same template again
        sale({ sale_id: '3', listing_symbol: 'USD' }),
        sale({ sale_id: '4', assets: [sale().assets[0], sale().assets[0]] }),
      ],
      'tool.worlds',
    )
    expect(cards.map((c) => c.saleId)).toEqual(['175029934'])
  })
})

describe('the sale check before buying', () => {
  const card = { assetId: '1099938642851', price: '0.04790691 WAX' }
  const record = {
    sale_id: 175029934,
    seller: 'trash.kid',
    asset_ids: ['1099938642851'],
    listing_price: '0.04790691 WAX',
    settlement_symbol: '8,WAX',
  }

  it('lets the purchase go ahead only while the sale is unchanged', () => {
    expect(saleStatus(card, record)).toBe('ok')
    expect(saleStatus(card, undefined)).toBe('gone')
    expect(saleStatus(card, { ...record, listing_price: '0.05000000 WAX' })).toBe('changed')
    expect(saleStatus(card, { ...record, asset_ids: ['1'] })).toBe('changed')
  })
})

describe('buying', () => {
  it('asserts, sends and buys at the one listed figure, through shop.ale', async () => {
    const transact = vi.fn(async () => ({}))
    const session = {
      actor: 'buyer.wam',
      permissionLevel: { actor: 'buyer.wam', permission: 'active' },
      transact,
    } as unknown as Session
    await buyMarketSale(session, { saleId: '175029934', assetId: '1099938642851', price: '0.04790691 WAX' })

    const { actions } = (transact.mock.calls[0] as unknown as [{ actions: { account: string; name: string; data: Record<string, unknown> }[] }])[0]
    expect(actions.map((a) => `${a.account}::${a.name}`)).toEqual([
      'atomicmarket::assertsale',
      'eosio.token::transfer',
      'atomicmarket::purchasesale',
    ])
    expect(actions[0].data).toMatchObject({
      sale_id: '175029934',
      asset_ids_to_assert: ['1099938642851'],
      listing_price_to_assert: '0.04790691 WAX',
      settlement_symbol_to_assert: '8,WAX',
    })
    expect(actions[1].data).toMatchObject({ to: 'atomicmarket', quantity: '0.04790691 WAX', memo: 'deposit' })
    expect(actions[2].data).toMatchObject({ buyer: 'buyer.wam', taker_marketplace: 'shop.ale', intended_delphi_median: 0 })
  })
})
