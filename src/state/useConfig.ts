import { useEffect } from 'react'
import { create } from 'zustand'
import {
  fetchBattleConfig,
  fetchClassTemplates,
  fetchDifMods,
  fetchFightConfig,
  fetchNftValues,
} from '@/dungeon/queries'
import { fetchFighterLevels, fetchFightersConfig } from '@/fighters/queries'
import { fetchLandsConfig, fetchAvatars } from '@/chain/queries'
import { fetchAscensionConfig, fetchAllUpgrades } from '@/ascension/queries'
import { fetchArenaConfig } from '@/arena/queries'
import { fetchDungeonConfig } from '@/dungeon/queries'
import { fetchMarketConfig } from '@/market/queries'
import { fetchTavernConfig, fetchTavernTemplates } from '@/tavern/queries'
import { fetchQuestConfig } from '@/quests/queries'
import { fetchShopItems } from '@/shop/queries'
import { fetchCandleConfig } from '@/candle/queries'
import { fetchFarmConfig } from '@/farming/queries'
import { fetchBuildingCosts, fetchRarityDiscounts } from '@/lands/queries'
import { fetchDungeonLbConfig } from '@/leaderboard/queries'
import { DEFAULT_CAPS, type StatCaps } from '@/dungeon/sim'
import type { BattleConfig } from '@/dungeon/types'
import type { NftValue } from '@/dungeon/nftFighter'
import type { ClassTemplate } from '@/tavern/fighterStats'
import type { FighterLevel, FightersConfig } from '@/fighters/types'
import type { LandsConfig } from '@/chain/types'

/**
 * The game's own settings, read once instead of once per screen.
 *
 * Thirty-six tables on chain are `TTL.long` config: the same numbers for
 * every player, changing only when the team edits them. Every route that
 * needed one held its own `useState`, its own `useEffect` and its own
 * loading gate for it — six routes each fetching the battle config, five
 * each fetching the class templates.
 *
 * That was not only repetition. Two routes derived `level_mod` from the same
 * row and disagreed about what to use when it had not arrived: one fell back
 * to 1 and the other to 1.15, so the same fighter's damage was quoted two
 * ways depending on which screen asked. A value with one source needs one
 * fallback, and this is where it lives.
 *
 * Split in two, because loading all of it at boot would make a player who
 * opens the map pay for the shop, the candle and the leaderboard:
 *
 * - **`useConfig()`** — the six tables read by more than one route. Loaded
 *   during boot, alongside the player.
 * - **`useLazyConfig(key)`** — the rest, fetched the first time a screen
 *   mounts that wants one, then kept for the session.
 *
 * All of it is `persist: true` underneath, so a returning player pays
 * nothing for either tier.
 */

/** The tables more than one screen needs. */
export interface CoreConfig {
  battle: (BattleConfig & { battle_stat_caps: StatCaps }) | undefined
  classes: Map<string, ClassTemplate>
  levels: FighterLevel[]
  fighters: FightersConfig | undefined
  nftValues: Map<number, NftValue>
  lands: LandsConfig | undefined
}

/**
 * Config the game cannot be described without, derived in one place.
 *
 * `level_mod` and `age_decay` arrive as strings because they are `float` on
 * chain, and every screen that shows a fighter's real damage needs both.
 *
 * Before `loaded` these hold neutral values — a multiplier of 1, uncapped
 * stats — which are *not* a guess at the real ones: a level 10 fighter reads
 * a quarter of its true damage at `levelMod: 1`. Nothing derived from them
 * should be rendered until `loaded` is true. That is the contract this store
 * replaces the old per-route fallbacks with: one neutral value, one flag,
 * and the flag is what a screen waits on.
 */
interface Derived {
  levelMod: number
  ageDecay: number
  caps: StatCaps
}

interface ConfigState extends CoreConfig, Derived {
  /** Every core table has answered. Gate anything derived on this. */
  loaded: boolean
  /** A load is in flight; `load()` is safe to call again regardless. */
  loading: boolean
  load: () => Promise<void>
}

/*
   The single-screen tables.

   Each is a zero-argument read of a table that is the same for everybody, so
   the key is enough to identify it and the map is the whole registry. Adding
   one is a line here; nothing else changes.
*/
const EXTRAS = {
  arena: fetchArenaConfig,
  ascension: fetchAscensionConfig,
  avatars: fetchAvatars,
  buildingCosts: fetchBuildingCosts,
  candle: fetchCandleConfig,
  difMods: fetchDifMods,
  dungeon: fetchDungeonConfig,
  dungeonLb: fetchDungeonLbConfig,
  farm: fetchFarmConfig,
  fightCost: fetchFightConfig,
  market: fetchMarketConfig,
  quest: fetchQuestConfig,
  rarityDiscounts: fetchRarityDiscounts,
  shopItems: fetchShopItems,
  tavern: fetchTavernConfig,
  tavernTemplates: fetchTavernTemplates,
  upgrades: fetchAllUpgrades,
} as const

export type ExtraKey = keyof typeof EXTRAS
type ExtraValues = { [K in ExtraKey]: Awaited<ReturnType<(typeof EXTRAS)[K]>> }

/* In flight, so twelve cards mounting at once ask for the same table once.
   The chain client dedupes the request itself; this stops the store from
   queueing twelve state updates behind it. */
const pending = new Set<ExtraKey>()

export const useConfigStore = create<ConfigState>((set, get) => ({
  battle: undefined,
  classes: new Map(),
  levels: [],
  fighters: undefined,
  nftValues: new Map(),
  lands: undefined,

  levelMod: 1,
  ageDecay: 1,
  caps: DEFAULT_CAPS,

  loaded: false,
  loading: false,

  async load() {
    if (get().loaded || get().loading) return
    set({ loading: true })

    const [battle, classes, levels, fighters, nftValues, lands] =
      await Promise.all([
        fetchBattleConfig(),
        fetchClassTemplates(),
        fetchFighterLevels(),
        fetchFightersConfig(),
        fetchNftValues(),
        fetchLandsConfig(),
      ])

    set({
      battle,
      classes,
      levels,
      fighters,
      nftValues,
      lands,
      /* One reading of the two floats, for every screen that shows a
         fighter. `|| 1` catches both a missing row and a `0` that would
         zero out every stat in the game. */
      levelMod: Number(battle?.level_mod) || 1,
      ageDecay: Number(battle?.age_decay) || 1,
      caps: battle?.battle_stat_caps ?? DEFAULT_CAPS,
      loaded: true,
      loading: false,
    })
  },
}))

/*
   The lazy tier is a store of its own, not a field on the one above.

   A single store means every screen reading the battle config re-renders
   when some other screen's shop items arrive — the core config settles once
   at boot and should stop notifying after that. Two stores keep those
   lifetimes apart, which is what they actually are.
*/
interface ExtraState {
  values: Partial<ExtraValues>
  load: (key: ExtraKey) => void
}

const useExtraStore = create<ExtraState>((set, get) => ({
  values: {},
  load(key) {
    if (get().values[key] !== undefined || pending.has(key)) return
    pending.add(key)
    void EXTRAS[key]()
      .then((value) => {
        set((s) => ({ values: { ...s.values, [key]: value } }))
      })
      /* Config is not a blocker: a screen that cannot read its own settings
         renders without them rather than failing shut. The read is cached,
         so a later mount tries again. */
      .catch(() => undefined)
      .finally(() => {
        pending.delete(key)
      })
  },
}))

/**
 * The core config, plus `loaded`.
 *
 * Read it anywhere; it is already in memory by the time a route mounts,
 * because boot loads it. Screens that draw scaled stats gate on `loaded`.
 */
export function useConfig(): ConfigState {
  return useConfigStore()
}

/**
 * One single-screen config table, fetched on first use.
 *
 * `undefined` until it lands — which is the same thing the route's own
 * `useState` used to say, minus the effect, the setter and the ceremony.
 */
export function useLazyConfig<K extends ExtraKey>(key: K): ExtraValues[K] | undefined {
  const value = useExtraStore((s) => s.values[key]) as ExtraValues[K] | undefined
  /* In an effect, not in render. `load` writes to a store, and a write
     during render is what React's double-invoked renders are there to
     catch — it would fire twice on mount in development and once more on
     every re-render while the value is still missing. */
  useEffect(() => {
    useExtraStore.getState().load(key)
  }, [key])
  return value
}
