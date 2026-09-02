import { CONTRACTS } from '@/chain/config'
import { transact, type ActionInput, type Session } from './session'
import type { GameConfig } from '@/chain/types'
import type { Quest } from '@/quests/types'
import { randomHistoryId } from '@/dungeon/queries'

/**
 * Step 1 of signup: send the WAX fee to `players.ale`.
 *
 * The contract's `eosio.token::transfer` handler checks the amount matches
 * `config.signup_fee` exactly, refuses if the player already exists or has
 * already paid, then writes a `signupstat` row and forwards the WAX on to
 * `config.signup_fee_wallet`. The memo may be anything except "gift", which
 * the handler treats as a donation and ignores.
 */
export function paySignupFee(session: Session, config: GameConfig) {
  const action: ActionInput = {
    account: CONTRACTS.token,
    name: 'transfer',
    data: {
      from: String(session.actor),
      to: CONTRACTS.players,
      quantity: config.signup_fee,
      memo: 'signup',
    },
  }
  return transact(session, [action])
}

/**
 * Step 2 of signup: claim the paid slot and pick a tag.
 *
 * `playertag` must be 4-12 characters — the contract asserts
 * `length() <= 12 && length() > 3`.
 */
export function signup(session: Session, playertag: string) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'signup',
    data: { wallet: String(session.actor), playertag },
  }
  return transact(session, [action])
}

export const PLAYERTAG_MIN = 4
export const PLAYERTAG_MAX = 12

export function validatePlayertag(tag: string): string | null {
  const t = tag.trim()
  if (t.length < PLAYERTAG_MIN) return `At least ${PLAYERTAG_MIN} characters.`
  if (t.length > PLAYERTAG_MAX) return `At most ${PLAYERTAG_MAX} characters.`
  return null
}

/** Move to a tile. Costs action points; may teleport via a portal land. */
export function travel(session: Session, x: number, y: number) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'travel',
    data: { wallet: String(session.actor), x, y },
  }
  return transact(session, [action])
}

/** Choose an unlocked avatar. */
export function setAvatar(session: Session, avatarId: number) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'setavatar',
    data: { wallet: String(session.actor), avatar_id: avatarId },
  }
  return transact(session, [action])
}

/**
 * Roll the fighter currently on offer at the tavern you are standing on.
 *
 * Costs `tavern.ale` config's `cost_reveal_ap` action points (10 today) and
 * writes the result into the player's `last_tavern_fighter`. Note the live
 * ABI takes only `wallet` — an older build of the site sent a `use_gems`
 * flag that the deployed contract no longer has.
 */
export function revealFighter(session: Session) {
  const action: ActionInput = {
    account: CONTRACTS.tavern,
    name: 'reveal',
    data: { wallet: String(session.actor) },
  }
  return transact(session, [action])
}

/**
 * Hire the revealed fighter.
 *
 * `cost_action_points` must equal what the contract computes or it aborts with
 * "Cost mismatch" — see `calculateHire`. The NFTs are not spent: `nfts.ale`
 * only records that they were used, capping how often one asset can be shared
 * between different accounts.
 */
export function hireFighter(
  session: Session,
  assetIds: string[],
  costActionPoints: number,
) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'hire',
    data: {
      wallet: String(session.actor),
      asset_ids: assetIds,
      cost_action_points: costActionPoints,
    },
  }
  return transact(session, [action])
}

/**
 * Buy a shop item that is paid for in-game (gems, credits or energy).
 *
 * `shop::buyshopitem` explicitly refuses anything with a WAX price —
 * `check(cost_wax.amount == 0, "This item needs to be purchased with WAX")` —
 * so gem packs go through `buyShopItemWithWax` instead.
 */
export function buyShopItem(session: Session, item: string) {
  const action: ActionInput = {
    account: CONTRACTS.shop,
    name: 'buyshopitem',
    data: { wallet: String(session.actor), item },
  }
  return transact(session, [action])
}

/**
 * Buy a WAX-priced item by transferring to the shop.
 *
 * The contract's notify handler parses the item out of the memo after the
 * first comma and asserts the amount matches exactly, so both the memo shape
 * and the quantity have to be right.
 */
export function buyShopItemWithWax(
  session: Session,
  item: string,
  costWax: string,
) {
  const action: ActionInput = {
    account: CONTRACTS.token,
    name: 'transfer',
    data: {
      from: String(session.actor),
      to: CONTRACTS.shop,
      quantity: costWax,
      memo: `purchase,${item}`,
    },
  }
  return transact(session, [action])
}

/**
 * Enter a dungeon and fight it.
 *
 * `history_id` is chosen by the client before signing, because it is the only
 * handle on the resulting battle: `dungeons::playdungeon` files the fight
 * under that name and `battle.ale`/`fights` is then read back by it. The row
 * is short-lived — `deloldfights` erases anything older than sixty seconds —
 * so the caller has to start polling immediately after this resolves.
 *
 * `use_gems` is carried by the action but ignored by the current contract,
 * which always spends energy; it is passed as the original client does.
 */
export function playDungeon(
  session: Session,
  params: {
    planet: string
    landId: string
    x: number
    y: number
    crewAssetId: string
    weaponAssetId: string
    fighterIds: number[]
    difficulty: number
    historyId: string
  },
) {
  const action: ActionInput = {
    account: CONTRACTS.dungeons,
    name: 'playdungeon',
    data: {
      wallet: String(session.actor),
      planet: params.planet,
      land_id: params.landId,
      crew_asset_id: params.crewAssetId,
      weapon_asset_id: params.weaponAssetId,
      fighter_ids: params.fighterIds,
      difficulty: params.difficulty,
      use_gems: true,
      history_id: params.historyId,
      x: params.x,
      y: params.y,
    },
  }
  return transact(session, [action])
}

/**
 * Challenge the team holding an arena.
 *
 * The same shape as `playDungeon` without a difficulty: an arena has one
 * standing team rather than a ladder, and `arena::playarena` takes no
 * difficulty argument at all — `inline_fight` is called with 0.
 *
 * The contract refuses outright if any defender belongs to the caller, and
 * spends `arena.ale`/`config.energy_cost` rather than the dungeon's, so both
 * are checked on the screen before this is reached.
 */
export function playArena(
  session: Session,
  params: {
    planet: string
    landId: string
    x: number
    y: number
    crewAssetId: string
    weaponAssetId: string
    fighterIds: number[]
    historyId: string
  },
) {
  const action: ActionInput = {
    account: CONTRACTS.arena,
    name: 'playarena',
    data: {
      wallet: String(session.actor),
      planet: params.planet,
      land_id: params.landId,
      crew_asset_id: params.crewAssetId,
      weapon_asset_id: params.weaponAssetId,
      fighter_ids: params.fighterIds,
      history_id: params.historyId,
      x: params.x,
      y: params.y,
    },
  }
  return transact(session, [action])
}

/**
 * List a fighter for auction, priced in gems.
 *
 * Costs `gems_listing_price` whether or not it sells, and marks the fighter
 * in use for the duration. `keep_after_auction` decides what happens when
 * nobody bids: false returns the fighter, true relists it at the config's
 * fixed instant-buy price instead.
 */
export function addAuction(
  session: Session,
  params: { fighterId: number; startPrice: number; keepAfterAuction: boolean },
) {
  const action: ActionInput = {
    account: CONTRACTS.market,
    name: 'addauction',
    data: {
      wallet: String(session.actor),
      fighter_id: params.fighterId,
      startprice: params.startPrice,
      keep_after_auction: params.keepAfterAuction,
    },
  }
  return transact(session, [action])
}

/**
 * Bid on an auction.
 *
 * The gems are taken immediately and the previous leader is refunded in the
 * same transaction, so a bid is a real spend rather than a promise. `scope`
 * is the fighter's class — the contract uses it only to keep its per-class
 * counters straight, not to find the auction.
 */
export function bidAuction(
  session: Session,
  params: { scope: string; auctionId: number; gems: number },
) {
  const action: ActionInput = {
    account: CONTRACTS.market,
    name: 'bidauction',
    data: {
      wallet: String(session.actor),
      scope: params.scope,
      auction_id: params.auctionId,
      gems_bid: params.gems,
    },
  }
  return transact(session, [action])
}

/** Withdraw an auction. Refused once anybody has bid. */
export function cancelAuction(
  session: Session,
  params: { scope: string; auctionId: number },
) {
  const action: ActionInput = {
    account: CONTRACTS.market,
    name: 'cancelauct',
    data: {
      wallet: String(session.actor),
      scope: params.scope,
      auction_id: params.auctionId,
    },
  }
  return transact(session, [action])
}

/**
 * Buy a fixed-price listing outright.
 *
 * The price is sent as well as the id and the contract checks the two agree
 * — "Price mismatch" — so a stale screen fails cleanly rather than spending
 * more than the player was shown.
 */
export function buyOffer(
  session: Session,
  params: { scope: string; offerId: number; gems: number },
) {
  const action: ActionInput = {
    account: CONTRACTS.market,
    name: 'buyoffer',
    data: {
      wallet: String(session.actor),
      scope: params.scope,
      offer_id: params.offerId,
      gems: params.gems,
    },
  }
  return transact(session, [action])
}

/**
 * Claim the banked mining power for one or more pools.
 *
 * Dungeon and arena runs do not pay out directly — they add mining power to
 * a pool on the player row, and `pools.ale::claimpreward` turns that into
 * Trilium or Shards. The contract takes one pool per action, so claiming both
 * halves of a run is two actions in one transaction.
 *
 * `history_id` ties the claim to the fight that earned it.
 */
export function claimPoolRewards(
  session: Session,
  pools: string[],
  historyId: string,
) {
  const actions: ActionInput[] = pools.map((pool) => ({
    account: CONTRACTS.pools,
    name: 'claimpreward',
    data: {
      wallet: String(session.actor),
      player: String(session.actor),
      pool,
      history_id: historyId,
    },
  }))
  return transact(session, actions)
}

/* ---------- roster upkeep ---------- */

/**
 * Level fighters up.
 *
 * The contract recomputes the bill and aborts on `Cost mismatch`, so the two
 * totals passed here have to be exactly `sum(levels[fighter.level])` over the
 * same ids — note that is the level being *left*, not the one being entered.
 * `levelUpPlan` in `@/fighters/rules` is the only thing that should be
 * producing these numbers.
 */
export function levelUpFighters(
  session: Session,
  fighterIds: number[],
  cost: { credits: number; gems: number },
) {
  const action: ActionInput = {
    account: CONTRACTS.fighters,
    name: 'levelup',
    data: {
      wallet: String(session.actor),
      fighter_ids: fighterIds,
      cost_gems: cost.gems,
      cost_credits: cost.credits,
    },
  }
  return transact(session, [action])
}

/**
 * Pay a fighter's upkeep.
 *
 * This *spends* credits — `den::payday` ends in `inline_spendcur` — and in
 * return resets the fighter's clock to a full interval and pushes their
 * deletion date out with it. The cost is priced by elapsed time and worked
 * out by the contract, so nothing is quoted to it here.
 *
 * The action's parameter really is the singular `fighter_id` holding a
 * vector; that is the deployed ABI, not a typo on this side.
 */
export function payFighters(session: Session, fighterIds: number[]) {
  const action: ActionInput = {
    account: CONTRACTS.fighters,
    name: 'payday',
    data: { wallet: String(session.actor), fighter_id: fighterIds },
  }
  return transact(session, [action])
}

/**
 * Sell fighters back for their credit value.
 *
 * Irreversible: the row is not deleted but its owner becomes `sold`, which
 * takes it out of the owner index for good. A fighter that is `in_use` is
 * refused outright.
 */
export function sellFighters(session: Session, fighterIds: number[]) {
  const action: ActionInput = {
    account: CONTRACTS.fighters,
    name: 'sellfighter',
    data: { wallet: String(session.actor), fighter_ids: fighterIds },
  }
  return transact(session, [action])
}

/**
 * Pin a marker on a fighter, or clear it with an empty string.
 *
 * Purely a player-side label — no contract reads it — but it is the only
 * organisational tool a large roster has, so it is stored on chain and
 * filterable.
 */
export function setFighterMarker(
  session: Session,
  fighterId: number,
  marker: string,
) {
  const action: ActionInput = {
    account: CONTRACTS.fighters,
    name: 'setmarker',
    data: { wallet: String(session.actor), fighter_id: fighterId, marker },
  }
  return transact(session, [action])
}

/* ---------- quests ---------- */

/**
 * Top every quest cadence back up to its full slot count.
 *
 * `quest::getquests` drops anything expired, refills each scope to
 * `max_quests`, and inline-calls `pools.ale::qpremine` to price and escrow the
 * reward for each new quest — so this is the action that decides what the
 * cards are worth, not the one that pays them.
 *
 * It reads the player's existing `activequests` row without first checking
 * that one exists, so a player who has never held a quest can see it abort.
 * There is nothing the client can do about that beyond reporting it clearly.
 */
export function getQuests(session: Session) {
  const action: ActionInput = {
    account: CONTRACTS.quests,
    name: 'getquests',
    data: { wallet: String(session.actor) },
  }
  return transact(session, [action])
}

/**
 * Claim a finished quest.
 *
 * The contract matches the quest on all four of name, scope, reward and end
 * value, so every one of them has to be sent back exactly as stored — and it
 * re-checks `task_end_value <= permstats[task_type]` itself, quietly leaving
 * the quest in place if the goal is not actually met. Payment is a direct
 * transfer of the escrowed TLM or Shards, after which it refills the slot.
 */
export function finishQuest(session: Session, quest: Quest) {
  const action: ActionInput = {
    account: CONTRACTS.quests,
    name: 'finishquest',
    data: {
      wallet: String(session.actor),
      quest_name: quest.quest_name,
      quest_scope: quest.quest_scope,
      reward_amount: quest.reward_amount,
      task_end_value: quest.task_end_value,
    },
  }
  return transact(session, [action])
}

/**
 * Trade a quest for a different one in the same cadence.
 *
 * Costs `config.reroll_cost` credits, and returns this quest's escrowed
 * reward to the pool before rolling a replacement — so the new quest's reward
 * is priced independently and can be worth less. The goal is re-snapshotted
 * against the player's counters as they stand now.
 */
export function rerollQuest(session: Session, quest: Quest) {
  const action: ActionInput = {
    account: CONTRACTS.quests,
    name: 'reroll',
    data: {
      wallet: String(session.actor),
      scope: quest.quest_scope,
      quest_name: quest.quest_name,
      reward_amount: quest.reward_amount,
      task_end_value: quest.task_end_value,
    },
  }
  return transact(session, [action])
}

/* ---------- land ---------- */

/**
 * Build a new building, or upgrade one a level.
 *
 * `maps::build` asserts three things the caller has to get right: the land NFT
 * is in this wallet, the level is exactly one above what stands there now, and
 * `cost_credits + rarityDiscount == buildingcost.cost_credits` — so the
 * credits sent are the *discounted* figure, not the listed one. It also
 * refuses a second primary building on a land, and any non-primary before the
 * first.
 */
export function buildBuilding(
  session: Session,
  params: {
    planet: string
    x: number
    y: number
    building: string
    level: number
    costGem: number
    costCredits: number
  },
) {
  const action: ActionInput = {
    account: CONTRACTS.lands,
    name: 'build',
    data: {
      wallet: String(session.actor),
      planet: params.planet,
      x: params.x,
      y: params.y,
      building: params.building,
      level: params.level,
      cost_gem: params.costGem,
      cost_credits: params.costCredits,
    },
  }
  return transact(session, [action])
}

/**
 * Raise a building's boost to a target, on the contract's 0–1,000,000 scale.
 *
 * The contract computes and charges its own price and only checks that the
 * quoted one is not more than about a percent above it, so `costCredits` is a
 * declaration rather than the amount spent — but a stale quote still aborts
 * with "Submitted costs mismatch". The target must be strictly above the
 * building's current, already-decayed boost.
 */
export function boostBuilding(
  session: Session,
  params: {
    planet: string
    building: string
    x: number
    y: number
    costCredits: number
    target: number
  },
) {
  const action: ActionInput = {
    account: CONTRACTS.lands,
    name: 'boost',
    data: {
      wallet: String(session.actor),
      planet: params.planet,
      building: params.building,
      x: params.x,
      y: params.y,
      cost_gems: 0,
      cost_credits: params.costCredits,
      boost_target: params.target,
    },
  }
  return transact(session, [action])
}

/**
 * Collect everything a land's buildings have earned.
 *
 * Pays out TLM, gems and credits across every building on the land at once.
 * It also zeroes each building's accrued shards *without* paying them —
 * `gaincur` is called with 0 in its `unclaimed_shards` argument — so claiming
 * destroys those. Nothing the client can do about it beyond warning first.
 */
export function claimLandRewards(
  session: Session,
  params: { planet: string; x: number; y: number },
) {
  const action: ActionInput = {
    account: CONTRACTS.lands,
    name: 'claimlndrwrd',
    data: {
      wallet: String(session.actor),
      planet: params.planet,
      x: params.x,
      y: params.y,
    },
  }
  return transact(session, [action])
}

/**
 * Tear a building down.
 *
 * Costs `config.delete_building_gems_cost` gems, and the contract asserts the
 * figure matches. It pays out the building's accrued TLM, gems and credits on
 * the way — but, as with claiming, silently drops its shards.
 */
export function destroyBuilding(
  session: Session,
  params: {
    planet: string
    x: number
    y: number
    building: string
    costGems: number
  },
) {
  const action: ActionInput = {
    account: CONTRACTS.lands,
    name: 'delbuilding',
    data: {
      wallet: String(session.actor),
      player: String(session.actor),
      x: params.x,
      y: params.y,
      planet: params.planet,
      building: params.building,
      cost: params.costGems,
    },
  }
  return transact(session, [action])
}

/* ---------- farming ---------- */

/**
 * Stake cards by sending them to the farm.
 *
 * There is no stake action: `farm.ale` picks the cards up through an
 * `atomicassets::transfer` notification, and the memo has to be exactly
 * `nftstake` or the handler ignores it and the cards are simply gone into the
 * contract's inventory. The contract claims first, charges `gem_fee` gems per
 * card, and rejects any rarity-and-shine pair missing from `stakeweight`.
 */
export function stakeCards(session: Session, assetIds: string[]) {
  const action: ActionInput = {
    account: CONTRACTS.atomicassets,
    name: 'transfer',
    data: {
      from: String(session.actor),
      to: CONTRACTS.farm,
      asset_ids: assetIds,
      memo: 'nftstake',
    },
  }
  return transact(session, [action])
}

/**
 * Take cards back out.
 *
 * `unstake` claims the pending credits first and then returns the assets, so
 * pulling out never forfeits what has accrued — which is worth saying on the
 * button, because players expect the opposite.
 */
export function unstakeCards(session: Session, assetIds: string[]) {
  const action: ActionInput = {
    account: CONTRACTS.farm,
    name: 'unstake',
    data: { wallet: String(session.actor), asset_ids: assetIds },
  }
  return transact(session, [action])
}

/**
 * Collect the credits every staked card has earned.
 *
 * One action covers all three pools. It resets the clock on the whole
 * position, so claiming one pool early gives up the power banked in the
 * others — there is no per-pool claim.
 */
export function claimFarming(session: Session) {
  const action: ActionInput = {
    account: CONTRACTS.farm,
    name: 'claim',
    data: { wallet: String(session.actor) },
  }
  return transact(session, [action])
}

/* ---------- leaderboard ---------- */

/**
 * Claim the dungeon leaderboard's daily reward.
 *
 * `dungeons.ale::lbclaim` pays from the `tlmdunglb` pool according to the
 * player's rank and then writes a `cdclaim` row holding the wallet on
 * cooldown for `lb_cooldown_minutes` — a day. Only the top
 * `lb_reward_count` places earn anything, so an unranked player can call it
 * and receive nothing.
 */
export function claimLeaderboardReward(session: Session) {
  const action: ActionInput = {
    account: CONTRACTS.dungeons,
    name: 'lbclaim',
    data: { wallet: String(session.actor) },
  }
  return transact(session, [action])
}

/* ---------- candle ---------- */

/**
 * Throw gems at the running campaign.
 *
 * `recovery.ale::contribute` spends the gems immediately and adds them both
 * to the campaign's pot and to this player's stake in it. It refuses unless
 * the campaign is open *and* the player's lifetime
 * `permstats[requirement_type]` already meets the requirement — the gate is
 * pass-or-fail, with no partial credit.
 *
 * The reward is fixed, so every gem added dilutes the pot for everybody
 * including the contributor.
 */
export function contributeGems(session: Session, offerId: string, gems: number) {
  const action: ActionInput = {
    account: CONTRACTS.candle,
    name: 'contribute',
    data: { wallet: String(session.actor), offer_id: offerId, gems },
  }
  return transact(session, [action])
}

/**
 * Take the winnings.
 *
 * `payout` sends the whole claim — TLM and WAX together — and then erases the
 * row, which also wipes the lifetime gem tallies stored alongside. There is
 * no partial claim.
 */
export function claimCandle(session: Session) {
  const action: ActionInput = {
    account: CONTRACTS.candle,
    name: 'payout',
    data: { wallet: String(session.actor) },
  }
  return transact(session, [action])
}

/* ---------- account ---------- */

/** Rename. `settag` asserts 4–12 characters. */
export function setPlayertag(session: Session, playertag: string) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'settag',
    data: { wallet: String(session.actor), playertag },
  }
  return transact(session, [action])
}

/** Wear an avatar the player has already unlocked. */
export function setAvatarId(session: Session, avatarId: number) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'setavatar',
    data: { wallet: String(session.actor), avatar_id: avatarId },
  }
  return transact(session, [action])
}

/**
 * Claim avatars whose requirement has been met.
 *
 * `unlockavatar` checks each id's `permstats_requirement` and quietly skips
 * any that fall short — no error, no avatar. So only ids the client has
 * already confirmed as earned should be sent, or a player gets a successful
 * transaction that did nothing.
 */
export function unlockAvatars(session: Session, avatarIds: number[]) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'unlockavatar',
    data: { wallet: String(session.actor), avatar_ids: avatarIds },
  }
  return transact(session, [action])
}

/**
 * Choose which Alien Worlds cards to mine with.
 *
 * The contract resolves each asset id to its template and stores both, so the
 * ids have to be assets the wallet actually holds. Duplicates are rejected
 * outright.
 */
export function setMiningNfts(session: Session, assetIds: string[]) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'setminenfts',
    data: {
      wallet: String(session.actor),
      player: String(session.actor),
      mine_nfts: assetIds,
    },
  }
  return transact(session, [action])
}

/**
 * How a landowner takes the cut other players generate by mining on their
 * land: `landowner_tlm_share` percent as Trilium, the rest as Shards.
 * `pools.cpp` reads this from the *landowner*'s row, so it changes nothing
 * for a player who owns no land.
 */
export function setLandownerShare(session: Session, share: number) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'setlndowshr',
    data: { wallet: String(session.actor), landowner_tlm_share: share },
  }
  return transact(session, [action])
}

/**
 * Sweep whatever the game is holding for the player.
 *
 * `claimcur` folds unclaimed gems and credits into the live balances and
 * transfers unclaimed TLM. It also zeroes `unclaimed_shards` and
 * `unclaimed_wax` **without paying them** — both are normally paid out
 * directly and sit at zero, but the screen should never call this a claim for
 * those two.
 */
export function claimCurrencies(session: Session) {
  const action: ActionInput = {
    account: CONTRACTS.players,
    name: 'claimcur',
    data: { wallet: String(session.actor) },
  }
  return transact(session, [action])
}

/**
 * Buy more reward-history rows for one currency.
 *
 * `unlockrows` charges gems, insists the order is a whole multiple of
 * `order_increments`, and caps the total at `max_datarows`. Until a currency
 * has rows unlocked, `addhistory` drops its payments on the floor — so this
 * is what turns an empty ledger on.
 */
export function unlockRewardRows(session: Session, currency: string, rows: number) {
  const action: ActionInput = {
    account: CONTRACTS.rewardLog,
    name: 'unlockrows',
    data: { wallet: String(session.actor), type: currency, rows },
  }
  return transact(session, [action])
}

/**
 * Spend banked Reward Power on one pool.
 *
 * `claimpreward` takes `pool_current * power / 1,000,000`, spending at most
 * 10,000 power per call, and refuses outright below a full 10,000 unless the
 * pool is a leaderboard one. It files the payment under `history_id`, which
 * the client picks so it can read the result back.
 */
export function mineRewardPool(session: Session, pool: string) {
  const action: ActionInput = {
    account: CONTRACTS.pools,
    name: 'claimpreward',
    data: {
      wallet: String(session.actor),
      player: String(session.actor),
      pool,
      history_id: randomHistoryId(),
    },
  }
  return transact(session, [action])
}

/**
 * Claim a CPU powerup from the game.
 *
 * `cpu.ale::maxpowerup` buys `wax_per_claim` of network CPU for the player
 * out of the game's own funds, up to `claims_per_week`.
 *
 * Two things it does quietly, which the screen has to say instead: it returns
 * without error for a player who is not registered, and — importantly — for
 * one whose `legend_access_expiry` has passed. So a trial player can sign
 * this, have it succeed, and receive nothing at all.
 *
 * The only cosigned action in the game. A player asking for CPU is by
 * definition a player who has none, so this is the one transaction they
 * cannot be asked to pay for themselves.
 */
export function claimCpu(session: Session) {
  const action: ActionInput = {
    account: CONTRACTS.cpu,
    name: 'maxpowerup',
    data: { user: String(session.actor) },
  }
  return transact(session, [action], { cosign: true })
}

/**
 * Spend three fighters to push a maxed one past its cap.
 *
 * `ascend` checks all three sacrifices share the ascending fighter's class,
 * that between them they cover element, race and the Sacrifice ability with
 * no fighter counted twice, and that the ascender is exactly
 * `min_ascension_level`. It then charges credits, rolls three upgrade offers,
 * and marks the sacrifices for deletion.
 *
 * The `fee` argument is sent for the contract's own record; the price check
 * that used it is commented out, and the flat config fee is what gets spent.
 */
export function ascendFighter(
  session: Session,
  fighterId: number,
  sacrifices: number[],
  fee: number,
) {
  const action: ActionInput = {
    account: CONTRACTS.ascension,
    name: 'ascend',
    data: {
      wallet: String(session.actor),
      ascending_fighter: fighterId,
      sacrifices,
      fee,
    },
  }
  return transact(session, [action])
}

/** Re-roll the three offers. Costs `ascension_reroll_credit_cost` credits. */
export function rerollAscension(session: Session, fighterId: number, fee: number) {
  const action: ActionInput = {
    account: CONTRACTS.ascension,
    name: 'rerollasc',
    data: { wallet: String(session.actor), ascending_fighter: fighterId, fee },
  }
  return transact(session, [action])
}

/**
 * Take one of the three offers, ending the ascension.
 *
 * The contract matches the chosen stat, value and direction against the
 * fighter's stored offers and refuses anything that is not one of them, so
 * all three fields have to be passed back exactly as they were rolled.
 */
export function claimAscensionUpgrade(
  session: Session,
  fighterId: number,
  stat: string,
  value: number,
  positive: boolean,
) {
  const action: ActionInput = {
    account: CONTRACTS.ascension,
    name: 'ascupgrade',
    data: {
      wallet: String(session.actor),
      ascending_fighter: fighterId,
      stat_name: stat,
      value,
      positiveval: positive,
    },
  }
  return transact(session, [action])
}
