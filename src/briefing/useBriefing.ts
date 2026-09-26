import { useEffect, useMemo, useState } from 'react'
import type { Player } from '@/chain/types'
import { PLANETS, type Planet } from '@/chain/config'
import { fetchAvatars, fetchLandsConfig, fetchPlanetLands } from '@/chain/queries'
import { fetchOwnedLands } from '@/chain/atomic'
import { fetchRoster, fetchDungeonConfig } from '@/dungeon/queries'
import { dungeonMaintained, fighterAvailable } from '@/dungeon/rules'
import { playedDungeonsToday } from '@/map/planetStatus'
import { fetchFighterLevels } from '@/fighters/queries'
import { levelUpOf, msUntilDeletion, wantsPayday } from '@/fighters/rules'
import { fetchAscensionConfig } from '@/ascension/queries'
import { canAscend, SACRIFICE_COUNT } from '@/ascension/rules'
import { fetchActiveQuests, fetchQuestScopes } from '@/quests/queries'
import { boardOf } from '@/quests/rules'
import {
  fetchPoolDescriptions,
  fetchShardPools,
  fetchTlmPools,
  fetchUsersConfig,
} from '@/pools/queries'
import { poolBoard } from '@/pools/rules'
import { fetchShopCooldowns, fetchShopItems } from '@/shop/queries'
import { canBuy, isFree } from '@/shop/rules'
import { fetchCandleClaim, fetchCandleOffers } from '@/candle/queries'
import { eligibility, offerState, tokenAmount, tokenSymbol } from '@/candle/rules'
import { FARM_SCHEMAS, fetchFarmConfig, fetchFarmUser } from '@/farming/queries'
import { farmBoard } from '@/farming/rules'
import { avatarBoard, claimableAvatars, cpuLow, cpuStatus } from '@/account/rules'
import { fetchAccountCpu, fetchCpuConfig, fetchCpuUsage } from '@/account/queries'
import { incomeOf } from '@/lands/rules'
import { liveBoostPercent } from '@/map/terrain'
import { LAND_BOOST_WARNING } from '@/chores/checks'
import { formatNumber } from '@/format'
import { recallWinPower } from './winPower'
import { buildBriefing, LEVELING_BELOW, type BriefingInput } from './rules'

type Parts = Omit<BriefingInput, 'player' | 'now'>

/**
 * Everything the briefing reads, gathered in parallel and applied as it lands.
 *
 * Each part is its own small loader, and each settles on its own: the page
 * draws what it knows as soon as it knows it, and a part whose read fails is
 * simply left out — its suggestions do not appear, and nothing else waits on
 * it. Every read goes through the same cache the screens use, so a player who
 * has just been on the map or in Rewards costs this page next to nothing.
 */
const LOADERS: Record<string, (player: Player) => Promise<Parts>> = {
  async roster(player) {
    const [roster, levels, ascension] = await Promise.all([
      fetchRoster(player.wallet),
      fetchFighterLevels(),
      fetchAscensionConfig().catch(() => undefined),
    ])
    /* Listed on the market is sold in all but signature — not part of the team. */
    const owned = roster.filter((f) => !(f.in_use && /market/i.test(String(f.use_type ?? ''))))
    const available = owned.filter((f) => fighterAvailable(f).available)
    const overdue = owned.filter((f) => wantsPayday(f))
    const ascendable =
      Number(ascension?.min_ascension_level ?? 0) > 0 && owned.length > SACRIFICE_COUNT
        ? owned.filter((f) => canAscend(f, ascension).ok).length
        : 0
    return {
      roster: {
        total: owned.length,
        available: available.length,
        belowTen: available.filter((f) => Number(f.stats?.level ?? 0) < LEVELING_BELOW).length,
        levelUps: owned.filter((f) => levelUpOf(f, levels).ready).length,
        ascendable,
        ascensionWaiting: owned.filter((f) => !!f.ascension_in_progress).length,
        /* The contract writes "Arena" into `use_type` while a fighter is
           standing on one — the same field that says "Market" for a listing. */
        defending: owned.filter(
          (f) => f.in_use && /arena/i.test(String(f.use_type ?? '')),
        ).length,
        overdue: overdue.length,
        soonestDeletionMs: overdue.length ? Math.min(...overdue.map((f) => msUntilDeletion(f))) : undefined,
      },
    }
  },

  async quests(player) {
    const [active, scopes] = await Promise.all([
      fetchActiveQuests(player.wallet),
      fetchQuestScopes(),
    ])
    const board = boardOf(active?.quests ?? [], scopes, player)
    return {
      quests: {
        claimable: board.reduce((n, s) => n + s.claimable, 0),
        openSlots: board.reduce((n, s) => n + s.emptySlots, 0),
      },
    }
  },

  async pools(player) {
    const [tlm, shards, names] = await Promise.all([
      fetchTlmPools(),
      fetchShardPools(),
      fetchPoolDescriptions().catch(() => []),
    ])
    return {
      pools: {
        tlm: poolBoard('tlm', player, tlm, shards, names),
        shards: poolBoard('shrds', player, tlm, shards, names),
      },
    }
  },

  /*
     Six planets, one read each — the same reads the map makes and persists,
     so for anyone who has opened the map this is a cache hit.
  */
  async world(player) {
    const [config, ...grids] = await Promise.all([
      fetchDungeonConfig().catch(() => undefined),
      ...PLANETS.map((p) => fetchPlanetLands(p)),
    ])
    const played = playedDungeonsToday(player)
    let open = 0
    let total = 0
    let arenas = 0
    grids.forEach((lands, i) => {
      const planet = PLANETS[i]
      for (const land of lands) {
        const first = String(land.buildings?.[0]?.building_name ?? '').toLowerCase()
        if (first === 'dungeon' && dungeonMaintained(land)) {
          total++
          if (!played.has(`${planet}.${land.land_id}`)) open++
        } else if (first === 'arena') {
          arenas++
        }
      }
    })
    return {
      dungeons: { open, total, energyCost: config ? Number(config.energy_cost ?? 0) : undefined },
      arenas: { total: arenas },
    }
  },

  async shop(player) {
    const [items, cooldowns] = await Promise.all([
      fetchShopItems(),
      fetchShopCooldowns(player.wallet),
    ])
    return { freeEnergy: items.some((i) => isFree(i) && canBuy(i, player, cooldowns, 0).canBuy) }
  },

  async candle(player) {
    const [offers, claim] = await Promise.all([
      fetchCandleOffers(),
      fetchCandleClaim(player.wallet).catch(() => undefined),
    ])
    const now = Date.now()
    const open = offers
      .map((o) => ({ o, s: offerState(o, now) }))
      .filter(({ s }) => s.phase === 'open')
      .sort((a, b) => a.s.msLeft - b.s.msLeft)
      .map(({ o, s }) => {
        const e = eligibility(o, player)
        return {
          requirements: o.requirements || o.requirement_type.replace(/_/g, ' '),
          qualified: e.qualified,
          have: e.have,
          need: e.need,
          msLeft: s.msLeft,
          reward: `${formatNumber(Math.floor(tokenAmount(o.reward_amount, o.reward_type)))} ${tokenSymbol(o.reward_type)}`,
        }
      })
    return {
      candle: {
        open,
        winnings: Number(claim?.tlm ?? 0) > 0 || Number(claim?.wax ?? 0) > 0,
      },
    }
  },

  async lands(player) {
    const owned = await fetchOwnedLands(player.wallet)
    if (owned.length === 0) return { lands: { owned: 0, empty: 0, tlmWaiting: 0, fading: 0 } }

    const planets = [...new Set(owned.map((l) => l.planet))].filter(Boolean) as Planet[]
    const [config, ...grids] = await Promise.all([
      fetchLandsConfig(),
      ...planets.map((p) => fetchPlanetLands(p)),
    ])
    const decay = Number(config?.boost_decay_per_hour ?? 0)
    const rows = new Map<string, (typeof grids)[number][number]>()
    planets.forEach((p, i) => {
      for (const land of grids[i]) rows.set(`${p}:${land.x}:${land.y}`, land)
    })

    let empty = 0
    let tlmWaiting = 0
    let fading = 0
    for (const a of owned) {
      const buildings = rows.get(`${a.planet}:${a.x}:${a.y}`)?.buildings ?? []
      if (buildings.length === 0) {
        empty++
        continue
      }
      tlmWaiting += incomeOf(buildings).tlm
      fading += buildings.filter(
        (b) =>
          liveBoostPercent(Number(b.boost_score ?? 0), String(b.boost_score_update ?? ''), decay) <
          LAND_BOOST_WARNING,
      ).length
    }
    return { lands: { owned: owned.length, empty, tlmWaiting, fading } }
  },

  async farming(player) {
    const [user, config] = await Promise.all([fetchFarmUser(player.wallet), fetchFarmConfig()])
    if (!user) return { farming: null }
    return {
      farming: {
        staked: Number(user.total_nfts ?? 0),
        maxed: farmBoard(FARM_SCHEMAS, user, [], config, []).anyMaxed,
      },
    }
  },

  async avatars(player) {
    const avatars = await fetchAvatars()
    return { avatarsReady: claimableAvatars(avatarBoard(avatars, player)).length }
  },

  async cpu(player) {
    const [wallet, config, usage] = await Promise.all([
      fetchAccountCpu(player.wallet),
      fetchCpuConfig().catch(() => undefined),
      fetchCpuUsage(player.wallet).catch(() => undefined),
    ])
    const status = cpuStatus(config, usage)
    return {
      cpuLow: cpuLow(wallet),
      cpuBoosts: status.allowance > 0 ? { perWeek: status.allowance, left: status.left } : undefined,
    }
  },

  async config() {
    const cfg = await fetchUsersConfig()
    return { trialMod: Number(cfg?.trial_rewpow_mod ?? 0) || undefined }
  },
}

const LOADER_KEYS = Object.keys(LOADERS)

export function useBriefing(player: Player) {
  const [parts, setParts] = useState<Parts>({})
  const [pending, setPending] = useState<Set<string>>(() => new Set(LOADER_KEYS))

  /*
     Re-run when the player row changes — a claim or a fight elsewhere moves
     half of what this page says — but the reads are cached, so a re-run is
     mostly local arithmetic.
  */
  useEffect(() => {
    let live = true
    for (const key of LOADER_KEYS) {
      LOADERS[key](player)
        .then((part) => {
          if (live) setParts((prev) => ({ ...prev, ...part }))
        })
        .catch(() => {
          /* Left out: the suggestions built on it just do not appear. */
        })
        .finally(() => {
          if (!live) return
          setPending((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        })
    }
    return () => {
      live = false
    }
  }, [player])

  const items = useMemo(
    () =>
      buildBriefing({
        player,
        ...parts,
        winPower: { dungeon: recallWinPower('dungeon'), arena: recallWinPower('arena') },
      }),
    [player, parts],
  )

  return { items, roster: parts.roster, pending: pending.size, total: LOADER_KEYS.length }
}
