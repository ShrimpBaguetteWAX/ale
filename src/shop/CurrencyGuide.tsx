import type { Player } from '@/chain/types'
import { useChainQuery } from '@/chain/useChainQuery'
import { asset } from '@/assets'
import { formatNumber } from '@/format'
import { fetchUserPoints } from '@/outpost/queries'
import { formatShards, shardBalance } from '@/outpost/rules'
import { formatWax } from '@/shop/rules'

/**
 * What each currency is for — the desktop shop's right-hand column.
 *
 * The shop sells currencies for other currencies, and a player looking at a
 * gem pack is really asking what the gems will do for them. So every currency
 * the shop deals in gets a card: the player's balance, what it is spent on
 * in this game. The currency this tab sells, and
 * the one it is paid in, are marked, so the card that matters sits lit.
 *
 * The uses are the game's real ones, read off the actions that spend each
 * currency — nothing here is a currency that is earned and never spent (TLM),
 * and nothing is listed that the contracts ignore today.
 */

type Key = 'wax' | 'gems' | 'credits' | 'energy' | 'shards'

const CURRENCIES: { key: Key; name: string; icon: string; uses: string[] }[] = [
  {
    key: 'wax',
    name: 'WAX',
    icon: '/assets/icons/wax-coin.png',
    uses: ['Buy gem packs'],
  },
  {
    key: 'gems',
    name: 'Gems',
    icon: '/assets/icons/gems.svg',
    uses: [
      'Buy credits and Legend passes',
      'Bid on and buy fighters at the Market, and list your own',
      'Put into Candle missions',
      'Build, upgrade or remove buildings on your land',
      'Stake cards in Farming',
    ],
  },
  {
    key: 'credits',
    name: 'Credits',
    icon: '/assets/icons/credits.svg',
    uses: [
      'Level up fighters',
      'Pay your fighters on payday',
      'Ascend a fighter and re-roll its upgrades',
      'Re-roll quests',
      'Build and boost buildings',
      'Buy energy flasks',
    ],
  },
  {
    key: 'energy',
    name: 'Energy',
    icon: '/assets/icons/energy.svg',
    uses: [
      'Travel on the World Map',
      'Reveal and hire recruits at taverns',
      'Fight dungeons and arenas',
      'Enter tournaments',
    ],
  },
  {
    key: 'shards',
    name: 'AW shards',
    icon: '/assets/icons/aw-shard.svg',
    uses: ['Redeem Alien Worlds NFTs at the Outpost'],
  },
]

/* What each tab sells, and what it is paid in. */
const TAB: Record<string, { sells?: Key; spends?: Key }> = {
  gems: { sells: 'gems', spends: 'wax' },
  credits: { sells: 'credits', spends: 'gems' },
  flasks: { sells: 'energy', spends: 'credits' },
  account: { spends: 'gems' },
  outpost: { spends: 'shards' },
}

export function CurrencyGuide({
  player,
  wax,
  category,
}: {
  player: Player
  wax: number
  category: string
}) {
  /*
     The shard balance is the Outpost's own ledger, not the player row. A
     light read of that one row, refreshed when a redemption drops it.
  */
  const points = useChainQuery(
    player.wallet && `outpost-points:${player.wallet}`,
    () => fetchUserPoints(player.wallet),
    { deps: ['outpostPoints'] },
  )

  const s = player.activestats
  const balance: Record<Key, string> = {
    wax: `${formatWax(wax)}`,
    gems: formatNumber(Number(s.gems ?? 0)),
    credits: formatNumber(Number(s.credits ?? 0)),
    energy: formatNumber(Number(s.action_points ?? 0)),
    shards: points.loading && !points.data
      ? '…'
      : points.data
        ? formatShards(shardBalance(points.data))
        : 'No account',
  }
  const tab = TAB[category] ?? {}

  return (
    <aside className="cguide" aria-label="What each currency is for">
      <h2 className="cguide__title">What each currency is for</h2>
      {CURRENCIES.map((c) => {
        const mark = tab.sells === c.key ? 'Sold here' : tab.spends === c.key ? 'Spent here' : null
        return (
          <section className={`cguide__card${mark ? ' is-here' : ''}`} key={c.key}>
            <header className="cguide__head">
              <img src={asset(c.icon)} alt="" />
              <b>{c.name}</b>
              {mark && <em>{mark}</em>}
              <span className="cguide__bal mono" title={`Your ${c.name}`}>
                {balance[c.key]}
              </span>
            </header>
            <ul className="cguide__uses">
              {c.uses.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </section>
        )
      })}
    </aside>
  )
}
