import { getAllRows } from '@/chain/client'
import { CONTRACTS } from '@/chain/config'
import { kvToRecord } from '@/chain/types'
import { TTL } from '@/chain/cache'

/**
 * A leaderboard for any tracked stat.
 *
 * `permstats` lives on each player's own row as a vector of key/value pairs,
 * so there is no index to rank by — the only way to answer "who has won the
 * most dungeons" is to read every player and sort. That is viable here purely
 * because the table is small: 106 rows at the time of writing, one read, no
 * paging.
 *
 * It is not cheap, though. A `players` row carries `mine_nfts`,
 * `played_dungeons`, `battle_nfts`, `active_variables` and a good deal else
 * that a leaderboard has no use for — about 14 KB a player, 1.5 MB for the
 * table. So the rows are trimmed to the three fields a board needs the moment
 * they arrive, and the trimmed copy is what gets cached: one read then serves
 * every stat the player cares to open, and the 1.5 MB is not held in memory
 * afterwards.
 *
 * If the player base grows by an order of magnitude this stops being
 * reasonable and wants a contract-side index instead.
 */
export interface PlayerStats {
  wallet: string
  playertag: string
  /** `active_avatar`: the face the player picked, or 0 for none. */
  avatar: number
  stats: Record<string, number>
}

/** One row of a ranked board. */
export interface StatRank {
  rank: number
  wallet: string
  playertag: string
  avatar: number
  value: number
}

export async function fetchAllPlayerStats(refresh = false): Promise<PlayerStats[]> {
  const rows = await getAllRows<{
    wallet: string
    playertag?: string
    active_avatar?: number
    permstats?: { first: string; second: number }[]
  }>(
    { code: CONTRACTS.players, scope: CONTRACTS.players, table: 'players' },
    /*
       Paced, because this is the one read in the app that crawls a whole
       table. At 106 players it is a single page and the delay never happens;
       past a thousand it becomes several, and firing those back to back is
       how a client gets rate limited. The board sits behind a loading state,
       so a few hundred milliseconds between pages costs nothing anyone will
       notice.
    */
    { ttl: TTL.short, refresh, pageDelayMs: 250 },
  )

  return rows.map((r) => ({
    wallet: String(r.wallet),
    playertag: String(r.playertag ?? ''),
    avatar: Number(r.active_avatar ?? 0),
    stats: kvToRecord(r.permstats ?? []) as Record<string, number>,
  }))
}

/**
 * Every player ranked by one stat, best first.
 *
 * Players with nothing recorded for the stat are dropped rather than ranked
 * at zero: a board of two hundred people tied on "never done this" tells the
 * reader nothing, and pushes the ones who have off the screen.
 *
 * Ties are broken by wallet, so every player has a place of their own and the
 * ranks run 1..n with no gaps. It is an arbitrary order among equals, but a
 * board where four people are all "4th" and nobody is 5th, 6th or 7th reads
 * as a fault rather than a tie.
 */
export function rankBy(players: PlayerStats[], key: string): StatRank[] {
  const scored = players
    .map((p) => ({
      wallet: p.wallet,
      playertag: p.playertag,
      avatar: p.avatar,
      value: Number(p.stats[key] ?? 0),
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value || a.wallet.localeCompare(b.wallet))

  return scored.map((p, i) => ({ ...p, rank: i + 1 }))
}
