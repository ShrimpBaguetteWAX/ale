import { getBalance } from '@/chain/client'
import { CONTRACTS } from '@/chain/config'

/**
 * The Shop's Swap tab: TLM into WAX, through Alcor.
 *
 * Alcor's router picks the pools and writes the memo the swap contract reads,
 * so the page never has to model concentrated liquidity itself. What the page
 * does own is the check: the memo is what decides where the WAX goes and the
 * least it may be, and it arrives from a server. So it is read back before it
 * can be signed — the right receiver, WAX out, and a minimum no lower than
 * the quote less the slippage the player was shown.
 */

const ROUTER = 'https://wax.alcor.exchange/api/v2/swapRouter/getRoute'

/** The slippage every swap allows, in percent. */
export const SWAP_SLIPPAGE = 0.5

export interface SwapQuote {
  tlm: number
  /** What the route pays at today's price. */
  wax: number
  /** The least it may pay; Alcor refuses the swap below this. */
  minWax: number
  memo: string
}

interface RouterAnswer {
  output?: string
  minReceived?: string
  memo?: string
}

const MEMO = /^swapexactin#\d+(?:,\d+)*#([a-z1-5.]{1,12})#(\d+\.\d{8}) WAX@eosio\.token#0$/

/** Check the router's answer, and turn it into a quote; throws on anything off. */
export function readQuote(tlm: number, receiver: string, answer: RouterAnswer): SwapQuote {
  const wax = Number(answer.output)
  const minWax = Number(answer.minReceived)
  const memo = String(answer.memo ?? '')
  const m = MEMO.exec(memo)
  if (!m || !(wax > 0) || !(minWax > 0)) throw new Error('No swap route right now.')
  if (m[1] !== receiver) throw new Error('The swap route names another account.')
  if (Number(m[2]) !== minWax) throw new Error('The swap route does not match its quote.')
  /* A hair of rounding below the slippage line, never more. */
  if (minWax < wax * (1 - SWAP_SLIPPAGE / 100) - 1e-8) throw new Error('The swap route allows too little.')
  return { tlm, wax, minWax, memo }
}

export async function fetchSwapQuote(tlm: number, receiver: string, signal?: AbortSignal): Promise<SwapQuote> {
  const query = new URLSearchParams({
    trade_type: 'EXACT_INPUT',
    input: `tlm-${CONTRACTS.alienWorlds}`,
    output: `wax-${CONTRACTS.token}`,
    amount: tlm.toFixed(4),
    slippage: String(SWAP_SLIPPAGE),
    receiver,
    maxHops: '2',
  })
  const res = await fetch(`${ROUTER}?${query}`, { signal })
  if (!res.ok) throw new Error('No swap route right now.')
  return readQuote(tlm, receiver, (await res.json()) as RouterAnswer)
}

/** A wallet's TLM and WAX, as numbers. */
export async function fetchSwapBalances(wallet: string): Promise<{ tlm: number; wax: number }> {
  const [tlm, wax] = await Promise.all([
    getBalance(wallet, CONTRACTS.alienWorlds, 'TLM'),
    getBalance(wallet, CONTRACTS.token, 'WAX'),
  ])
  return { tlm: parseFloat(tlm ?? '0') || 0, wax: parseFloat(wax ?? '0') || 0 }
}
