import { describe, expect, it } from 'vitest'
import { readQuote } from '@/shop/swap'

/**
 * The Swap tab signs a memo that arrives from Alcor's router. The memo decides
 * who receives the WAX and the least the swap may pay, so it is read back
 * before anything is signed.
 */
const ok = {
  output: '140.02944701',
  minReceived: '139.33278309',
  memo: 'swapexactin#12406,12501#swapper.wam#139.33278309 WAX@eosio.token#0',
}

describe('readQuote', () => {
  it('takes a good answer', () => {
    expect(readQuote(500, 'swapper.wam', ok)).toEqual({
      tlm: 500,
      wax: 140.02944701,
      minWax: 139.33278309,
      memo: ok.memo,
    })
  })

  it('refuses a memo paying somebody else', () => {
    const memo = ok.memo.replace('swapper.wam', 'thief.wam')
    expect(() => readQuote(500, 'swapper.wam', { ...ok, memo })).toThrow(/another account/)
  })

  it('refuses a minimum that differs from the quote', () => {
    const memo = ok.memo.replace('139.33278309', '1.00000000')
    expect(() => readQuote(500, 'swapper.wam', { ...ok, memo })).toThrow(/does not match/)
  })

  it('refuses a minimum below the slippage', () => {
    const low = { ...ok, minReceived: '100.00000000', memo: ok.memo.replace('139.33278309', '100.00000000') }
    expect(() => readQuote(500, 'swapper.wam', low)).toThrow(/too little/)
  })

  it('refuses anything that is not TLM into WAX', () => {
    const memo = ok.memo.replace('WAX@eosio.token', 'TLM@alien.worlds')
    expect(() => readQuote(500, 'swapper.wam', { ...ok, memo })).toThrow(/No swap route/)
    expect(() => readQuote(500, 'swapper.wam', {})).toThrow(/No swap route/)
  })
})
