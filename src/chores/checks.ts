import type { Player } from '@/chain/types'
import { fetchLandsConfig, fetchPlanetLands } from '@/chain/queries'
import { fetchOwnedLands } from '@/chain/atomic'
import type { Planet } from '@/chain/config'
import { liveBoostPercent } from '@/map/terrain'
import { fetchShopCooldowns, fetchShopItems } from '@/shop/queries'
import { cooldownUntil, isFree, isLegend } from '@/shop/rules'
import { fetchFighterLevels } from '@/fighters/queries'
import { levelUpOf } from '@/fighters/rules'
import { fetchRoster } from '@/dungeon/queries'
import { fetchActiveQuests } from '@/quests/queries'
import { progressOf } from '@/quests/rules'
import { fetchCandleClaim } from '@/candle/queries'
import { FARM_SCHEMAS, fetchFarmConfig, fetchFarmUser } from '@/farming/queries'
import { farmBoard } from '@/farming/rules'
import { MINE_POWER, poolHasMinimum } from '@/pools/rules'

/**
 * "Is there something waiting for me in here?", once per menu section.
 *
 * Every check is written to cost as little as possible, because seven of them
 * running on a timer is exactly how a client turns into a nuisance:
 *
 *   * None of them pass `refresh`, so they read through the same cache the
 *     screens use. Opening a section warms its own indicator for free, and an
 *     indicator that fires just after its screen was visited costs nothing.
 *   * The static halves — shop items, level costs, farm config — are on the
 *     twelve-hour TTL and are effectively free after the first read.
 *   * Two checks make no request at all: pools and quests both answer from
 *     the player row the app already holds.
 *
 * The scheduler in `useChores` is what keeps them from arriving together,
 * and it is the thing that makes the intervals below safe to shorten: however
 * many checks come due at once, they leave one at a time. The ceiling is the
 * tick, not the sum of the intervals.
 *
 * At the values below an idle hour costs well under two requests a minute,
 * against public nodes that tolerate orders of magnitude more — and
 * `verify-chores` asserts it rather than leaving it to be re-derived.
 */

export type ChoreKey =
  | 'shop'
  | 'fighters'
  | 'quests'
  | 'candle'
  | 'lands'
  | 'farming'
  | 'account'

/** How faint a building's boost has to get before it is worth flagging. */
export const LAND_BOOST_WARNING = 7

export interface ChoreCheck {
  key: ChoreKey
  /** The nav entry this lights up. */
  to: string
  /** How stale an answer may get before it is worth asking again. */
  every: number
  /** What the dot means, for the title attribute. */
  hint: string
  /**
   * `force` bypasses the cache for the wallet-scoped reads.
   *
   * Set only when the player has just done something in this very section, so
   * the answer that is about to be shown is one they can immediately check
   * against the screen in front of them. Everything else reads through the
   * cache; this is the one moment where a stale answer is worse than a
   * request.
   */
  run: (player: Player, force?: boolean) => Promise<boolean>
}

const MIN = 60_000

export const CHORE_CHECKS: ChoreCheck[] = [
  /*
     Free energy resets on the UTC day boundary rather than 24h after the
     claim, so this can turn true at any moment of the day for a player who
     was already waiting — but only once. Ten minutes is close enough.
  */
  {
    key: 'shop',
    to: '/shop',
    every: 3 * MIN,
    hint: 'Free energy is waiting',
    async run(player, force) {
      const [items, cooldowns] = await Promise.all([
        fetchShopItems(),
        fetchShopCooldowns(player.wallet, force),
      ])
      /* The shop screen decides Legend status this way, and `canBuy` gates the
         free flask on the same call — so the dot and the button agree. */
      const legend = isLegend(player)
      return items.some(
        (i) =>
          isFree(i) &&
          !cooldownUntil(i, cooldowns) &&
          /* The contract's anti-hoarding rule: a trial account over 1,999
             energy cannot take a free flask, so offering it would be a lie. */
          (legend || player.activestats.action_points <= 1999),
      )
    },
  },

  /*
     Only moves when a fight pays XP, which the player will have just done in
     another section — so five minutes catches it while it still feels prompt.
     The roster is shared with the dungeon, arena and market screens, so this
     is usually a cache hit.
  */
  {
    key: 'fighters',
    to: '/fighters',
    every: 3 * MIN,
    hint: 'A fighter is ready to level up',
    async run(player, force) {
      const [roster, levels] = await Promise.all([
        fetchRoster(player.wallet, force),
        fetchFighterLevels(),
      ])
      return roster.some((f) => levelUpOf(f, levels).ready)
    },
  },

  /*
     Progress is measured against the player's own permstats, which are on the
     row the app already holds — so this is one read of the quest list and the
     comparison is local.
  */
  {
    key: 'quests',
    to: '/quests',
    every: 3 * MIN,
    hint: 'A quest is ready to claim',
    async run(player, force) {
      const active = await fetchActiveQuests(player.wallet, force)
      return (active?.quests ?? []).some((q) => progressOf(q, player).claimable)
    },
  },

  /*
     A campaign pays out once, when it ends. Nothing about this changes on a
     minute-to-minute basis, so it is the cheapest one to leave alone.
  */
  {
    key: 'candle',
    to: '/candle',
    every: 10 * MIN,
    hint: 'You have winnings to claim',
    async run(player, force) {
      const claim = await fetchCandleClaim(player.wallet, force)
      return Number(claim?.tlm ?? 0) > 0 || Number(claim?.wax ?? 0) > 0
    },
  },

  /*
     Boost decays by the hour, so a building crossing the threshold is not
     news that travels fast. Half an hour is plenty, and the lands themselves
     come from a persisted cache.

     Only the planets the player actually owns land on are read, which is
     usually one or two rather than all six.
  */
  {
    key: 'lands',
    to: '/lands',
    every: 15 * MIN,
    hint: 'A building is running out of boost',
    async run(player, force) {
      const owned = await fetchOwnedLands(player.wallet)
      if (owned.length === 0) return false

      const planets = [...new Set(owned.map((l) => l.planet))].filter(
        Boolean,
      ) as Planet[]
      const [config, ...grids] = await Promise.all([
        fetchLandsConfig(),
        ...planets.map((p) => fetchPlanetLands(p, force)),
      ])

      const mine = new Set(owned.map((l) => String(l.asset_id)))
      const decay = Number(config?.boost_decay_per_hour ?? 0)

      return grids.flat().some((land) => {
        if (!mine.has(String(land.asset_id))) return false
        return (land.buildings ?? []).some(
          (b) =>
            liveBoostPercent(
              Number(b.boost_score ?? 0),
              String(b.boost_score_update ?? ''),
              decay,
            ) < LAND_BOOST_WARNING,
        )
      })
    },
  },

  /*
     Power accrues over a day and stops at the cap, so this is a slow fill
     with a hard ceiling — worth knowing about, never urgent.

     `farmBoard` is handed empty pools and staked lists on purpose: `maxed`
     is `weight × days >= max_power`, which needs neither, so the two
     expensive reads the farming screen makes are skipped here.
  */
  {
    key: 'farming',
    to: '/farming',
    every: 10 * MIN,
    hint: 'A farming claim has hit its cap',
    async run(player, force) {
      const [user, config] = await Promise.all([
        fetchFarmUser(player.wallet, force),
        fetchFarmConfig(),
      ])
      if (!user) return false
      return farmBoard(FARM_SCHEMAS, user, [], config, []).anyMaxed
    },
  },

  /*
     Free. Reward power is carried on the player row, and whether a pool can
     be mined is a comparison against its own threshold — no request at all,
     so this one re-answers as often as the player row refreshes.
  */
  {
    key: 'account',
    to: '/profile',
    every: MIN,
    hint: 'You can mine a reward pool',
    async run(player) {
      return (player.reward_power ?? []).some((row) => {
        const power = Math.max(0, Number(row.power ?? 0))
        return poolHasMinimum(row.pool) ? power >= MINE_POWER : power > 0
      })
    },
  },
]
