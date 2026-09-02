/** `players.ale` player row, `last_tavern.objectives[]`. */
export interface Objective {
  objective_type: string
  objective_string: string
  objective_value: number
  mod_value: number
}

/**
 * `tavern.ale` / `nfttemplates` — the whitelist of Alien Worlds templates that
 * can be used to hire, plus the properties objectives are matched against.
 * A template not in this table is rejected outright by `users::hire`.
 */
export interface TavernTemplate {
  templateid: number
  schema: string
  rarity: string
  type: string
  shine: string
  element: string
  race: string
  /** IPFS hash of the card art. */
  nftimage: string
  /** IPFS hash of the smaller inventory art. */
  invimage: string
  cardname: string
  weaponclass: string
  atk: number
  def: number
  movcost: number
  pow: number
  nft_mp: number
  tlm_mp: number
  cardid: number
  level: number
}

/** `tavern.ale` / `config`. */
export interface TavernConfig {
  index: number
  cost_reveal_gem: number
  cost_reveal_credits: number
  /** Action points `tavern::reveal` spends. */
  cost_reveal_ap: number
  cost_hire_ap: number
}

/** A template the player owns, with how many copies. */
export interface OwnedTemplate extends TavernTemplate {
  count: number
}

/**
 * Inventory tabs, in the original's order. `items.worlds` and `land.worlds`
 * appear in the whitelist but have no tab in the original UI, so they fall
 * into "Other" rather than being hidden.
 */
export const SCHEMA_TABS: { key: string; label: string }[] = [
  { key: 'faces.worlds', label: 'Avatars' },
  { key: 'arms.worlds', label: 'Weapons' },
  { key: 'crew.worlds', label: 'Crew' },
  { key: 'tool.worlds', label: 'Tools' },
  { key: 'level.worlds', label: 'Levels' },
]
