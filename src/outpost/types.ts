/**
 * `uspts.worlds` — the Alien Worlds Outpost.
 *
 * A separate economy from the game's own: the shards spent here are Alien
 * Worlds points, earned by mining in Alien Worlds, and nothing in Alien
 * Legends grants or spends them. The Outpost tab is a window onto somebody
 * else's shop, which is why every figure on it is labelled as theirs.
 */

/** `uspts.worlds` / `pointoffers` — a timed offer, priced in shards. */
export interface PointOffer {
  id: number
  /** UTC, no zone suffix, as every WAX timestamp arrives. */
  start: string
  end: string
  template_id: number
  /** The cost, in raw chain units. See `SHARD_SCALE`. */
  required: number
}

/**
 * `uspts.worlds` / `userpoints` — one row per registered wallet.
 *
 * Absent for a wallet that has never mined in Alien Worlds, which is not an
 * error: it means no shards and nothing to spend.
 */
export interface UserPoints {
  user: string
  total_points: number
  /** What is actually spendable. Raw chain units. */
  redeemable_points: number
  daily_points: number
  weekly_points: number
  top_level_claimed: number
  last_action_timestamp: string
}

/** What the Outpost card needs about the NFT an offer pays out. */
export interface OfferTemplate {
  template_id: number
  name: string
  rarity: string
  shine: string
  /** `type` in the immutable data — Extractor, Manipulator, ExoTool… */
  kind: string
  /** IPFS hash of the artwork, for the resizer. */
  img: string
}

/** An offer with whatever is known about the NFT behind it. */
export interface OutpostOffer {
  offer: PointOffer
  template?: OfferTemplate
}
