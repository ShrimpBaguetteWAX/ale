/**
 * Chain constants for Alien Legends.
 *
 * Contract accounts are taken from the deployed smart contracts in
 * `monstergame/` (the `*.ale` namespace) and verified against WAX mainnet.
 */

export const CHAIN_ID =
  '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4'

export const CHAIN_NAME = 'WAX'

/**
 * Candidate WAX API nodes. Every one of these was verified to answer
 * `get_info` *and* `get_table_rows` with `Access-Control-Allow-Origin: *`,
 * which is what the browser actually needs.
 *
 * The order here is only a starting hint — the real order is decided at
 * runtime by `EndpointPool.probe()`, which measures each node and drops the
 * ones that are down or lagging behind the head block.
 */
export const RPC_ENDPOINTS: readonly string[] = [
  'https://wax.greymass.com',
  'https://api.hivebp.io',
  'https://wax.eosdac.io',
  'https://wax.blacklusion.io',
  'https://api.waxsweden.org',
  'https://waxapi.ledgerwise.io',
  'https://api.wax.bountyblok.io',
  'https://wax.eosusa.io',
  'https://wax.eosphere.io',
  'https://wax.api.eosnation.io',
  'https://api.wax.alohaeos.com',
  'https://wax.cryptolions.io',
]

/** AtomicAssets nodes, used for NFT metadata and images. */
export const ATOMIC_ENDPOINTS: readonly string[] = [
  'https://atomicassets-api.alienworlds.io',
  'https://aa.wax.blacklusion.io',
  'https://wax.api.atomicassets.io',
  'https://wax-atomic-api.eosphere.io',
]

/** Deployed contract accounts. */
export const CONTRACTS = {
  /** `users` contract: players, config, avatars, signup. */
  players: 'players.ale',
  /** `maps` contract: lands, buildings, building costs. */
  lands: 'lands.ale',
  /** Core game / permission account. */
  legends: 'legends',
  fighters: 'fighters.ale',
  arena: 'arena.ale',
  quests: 'quests.ale',
  /** NFT staking — the game calls it Farming. */
  farm: 'farm.ale',
  /** The campaign board the game calls the Candle. */
  candle: 'recovery.ale',
  /** Pays the CPU for player transactions. */
  cpu: 'cpu.ale',
  dungeons: 'dungeons.ale',
  /** Ascension: spend three fighters to push a maxed one past its cap. */
  ascension: 'ascend.ale',
  pools: 'pools.ale',
  taskmgr: 'taskmngr.ale',
  tavern: 'tavern.ale',
  shop: 'shop.ale',
  /** Player-to-player fighter sales: gem auctions and fixed-price offers. */
  market: 'market.ale',
  /** Class templates: the stat bands every fighter roll falls inside. */
  creation: 'creation.ale',
  nfts: 'nfts.ale',
  battle: 'battle.ale',
  rewardLog: 'rwrdlog.ale',
  /** Receives the WAX signup fee after it is forwarded on. */
  ram: 'ram.ale',
  token: 'eosio.token',
  atomicassets: 'atomicassets',
  /** Alien Worlds TLM token contract. */
  alienWorlds: 'alien.worlds',
  /** Alien Worlds bag contract, read on signup to seed mining NFTs. */
  federation: 'm.federation',
} as const

/** The six Alien Worlds planets a player can stand on. */
export const PLANETS = [
  'magor',
  'naron',
  'neri',
  'eyeke',
  'veles',
  'kavian',
] as const

export type Planet = (typeof PLANETS)[number]

/**
 * Map bounds, straight from `users::travel`:
 *   check(x >= 0 && x <= 40 && y >= 0 && y <= 20, "Coordinates are invalid")
 */
export const MAP_MIN_X = 0
export const MAP_MAX_X = 40
export const MAP_MIN_Y = 0
export const MAP_MAX_Y = 20
export const MAP_WIDTH = MAP_MAX_X - MAP_MIN_X + 1 // 41
export const MAP_HEIGHT = MAP_MAX_Y - MAP_MIN_Y + 1 // 21

/** Planets reachable through a land's `special_effect` teleporter. */
export const PORTAL_EFFECTS: Record<string, Planet> = {
  tpmagor: 'magor',
  tpnaron: 'naron',
  tpneri: 'neri',
  tpeyeke: 'eyeke',
  tpveles: 'veles',
  tpkavian: 'kavian',
}

/**
 * The contract's bounds allow 0, but no land row exists at x=0 or y=0 on any
 * planet — every planet holds exactly 800 lands over x:1-40, y:1-20. Travel
 * into row/column 0 would fail the contract's `require_find` on the land, so
 * the playable grid is the 40x20 block.
 */
export const PLAY_MIN_X = 1
export const PLAY_MAX_X = 40
export const PLAY_MIN_Y = 1
export const PLAY_MAX_Y = 20
export const PLAY_WIDTH = PLAY_MAX_X - PLAY_MIN_X + 1 // 40
export const PLAY_HEIGHT = PLAY_MAX_Y - PLAY_MIN_Y + 1 // 20
export const LANDS_PER_PLANET = PLAY_WIDTH * PLAY_HEIGHT // 800

/**
 * Content type used for every chain POST.
 *
 * `application/json` is not on the CORS safelist, so it makes the browser
 * send an OPTIONS preflight before each request — doubling the round trips
 * and, on some nodes, failing outright (wax.greymass.com answers preflights
 * with HTTP 400, which Chrome treats as a rejection).
 *
 * `text/plain` *is* safelisted, so the request goes out directly with no
 * preflight. eosio's HTTP plugin never inspects the content type, so the JSON
 * body is parsed exactly the same way.
 */
export const CORS_SAFE_CONTENT_TYPE = 'text/plain;charset=UTF-8'
