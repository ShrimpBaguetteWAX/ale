import type { SessionKeyWhitelistInput } from '@wharfkit/session'
import { CONTRACTS } from '@/chain/config'

/**
 * Auto-signing: WharfKit session keys.
 *
 * A key kept in this browser is added to the player's account under its own
 * permission and linked to exactly the actions they chose. Those actions
 * then sign without the wallet window; everything else still goes through
 * the wallet, and the key can be removed at any time, here or from any
 * account tool.
 *
 * A transaction only signs itself when *every* action in it is allowed, so
 * the choices below are whole things a player does, not single actions.
 *
 * Three things are never on offer, whatever is ticked: sending WAX, sending
 * Trilium, and sending NFTs. A link is only ever a contract and an action
 * name, never who may receive what or how much, so a key allowed one
 * `transfer` is allowed all of them — and a key that lives in a browser must
 * not be able to empty a wallet. Buying with WAX, paying the signup fee and
 * staking cards therefore always ask. The list is checked for that in the
 * tests and refused at the whitelist, not only by leaving them out here.
 */

/** The permission the session key lives under, on the player's own account. */
export const AUTO_SIGN_PERMISSION = 'alienlegends'

export interface AutoSignAction {
  contract: string
  action: string
}

export interface AutoSignGroup {
  id: string
  label: string
  /** What signs itself once this is on. */
  note: string
  /** What still asks the wallet, where part of the screen moves tokens or NFTs. */
  asks?: string
  actions: AutoSignAction[]
}

const C = CONTRACTS

export const AUTO_SIGN_GROUPS: AutoSignGroup[] = [
  {
    id: 'travel',
    label: 'Travelling',
    note: 'Walking the map, on foot and through portals.',
    actions: [{ contract: C.players, action: 'travel' }],
  },
  {
    id: 'fighting',
    label: 'Dungeons and arenas',
    note: 'Entering a dungeon and challenging an arena.',
    actions: [
      { contract: C.dungeons, action: 'playdungeon' },
      { contract: C.arena, action: 'playarena' },
    ],
  },
  {
    id: 'fighters',
    label: 'Your fighters',
    note: 'Revealing and hiring in the tavern, paydays, levelling up, markers, and selling fighters back.',
    actions: [
      { contract: C.tavern, action: 'reveal' },
      { contract: C.players, action: 'hire' },
      { contract: C.fighters, action: 'payday' },
      { contract: C.fighters, action: 'levelup' },
      { contract: C.fighters, action: 'setmarker' },
      { contract: C.fighters, action: 'sellfighter' },
    ],
  },
  {
    id: 'ascension',
    label: 'Ascension',
    note: 'Ascending a fighter, rerolling and claiming the upgrade.',
    actions: [
      { contract: C.ascension, action: 'ascend' },
      { contract: C.ascension, action: 'rerollasc' },
      { contract: C.ascension, action: 'ascupgrade' },
    ],
  },
  {
    id: 'quests',
    label: 'Quests',
    note: 'Taking quests, finishing them and rerolling.',
    actions: [
      { contract: C.quests, action: 'getquests' },
      { contract: C.quests, action: 'finishquest' },
      { contract: C.quests, action: 'reroll' },
    ],
  },
  {
    id: 'lands',
    label: 'Lands and buildings',
    note: 'Building, boosting, tearing down, and claiming what your lands earned.',
    actions: [
      { contract: C.lands, action: 'build' },
      { contract: C.lands, action: 'boost' },
      { contract: C.lands, action: 'delbuilding' },
      { contract: C.lands, action: 'claimlndrwrd' },
    ],
  },
  {
    id: 'farming',
    label: 'Farming',
    note: 'Claiming credits and taking cards back out.',
    asks: 'Staking cards sends NFTs, so that always asks.',
    actions: [
      { contract: C.farm, action: 'claim' },
      { contract: C.farm, action: 'unstake' },
    ],
  },
  {
    id: 'candle',
    label: 'Candle',
    note: 'Contributing gems and claiming your share.',
    actions: [
      { contract: C.candle, action: 'contribute' },
      { contract: C.candle, action: 'payout' },
    ],
  },
  {
    id: 'market',
    label: 'Market',
    note: 'Listing fighters, bidding, buying at the asking price and cancelling.',
    actions: [
      { contract: C.market, action: 'addauction' },
      { contract: C.market, action: 'bidauction' },
      { contract: C.market, action: 'buyoffer' },
      { contract: C.market, action: 'cancelauct' },
    ],
  },
  {
    id: 'shop',
    label: 'Shop',
    note: 'Buying with gems or credits, and redeeming outpost offers.',
    asks: 'Buying with WAX sends WAX, so that always asks.',
    actions: [
      { contract: C.shop, action: 'buyshopitem' },
      { contract: C.outpost, action: 'redeempntnft' },
    ],
  },
  {
    id: 'tournament',
    label: 'Tournament',
    note: 'Entering a tournament.',
    actions: [{ contract: C.tournament, action: 'signup' }],
  },
  {
    id: 'rewards',
    label: 'Rewards',
    note: 'Claiming pool and leaderboard rewards, mining a pool, claiming currencies and unlocking reward rows.',
    actions: [
      { contract: C.pools, action: 'claimpreward' },
      { contract: C.dungeons, action: 'lbclaim' },
      { contract: C.players, action: 'claimcur' },
      { contract: C.rewardLog, action: 'unlockrows' },
    ],
  },
  {
    id: 'cpu',
    label: 'CPU',
    note: 'Claiming the daily CPU, which the game pays the network cost of.',
    actions: [
      { contract: C.cpu, action: 'maxpowerup' },
      /* The claim carries the game's no-op in front of the player's action
         so the game is billed for it; the key may only sign the transaction
         if that action is allowed too. It does nothing at all. */
      { contract: 'greymassnoop', action: 'noop' },
    ],
  },
  {
    id: 'account',
    label: 'Account settings',
    note: 'Your gamertag, avatar, unlocking avatars, the mining cards and the landowner share.',
    actions: [
      { contract: C.players, action: 'settag' },
      { contract: C.players, action: 'setavatar' },
      { contract: C.players, action: 'unlockavatar' },
      { contract: C.players, action: 'setminenfts' },
      { contract: C.players, action: 'setlndowshr' },
    ],
  },
]

/**
 * Never linked, whatever is chosen. Checked at the whitelist as well as at
 * the list, so a future group cannot slip one in.
 */
export const NEVER_AUTO_SIGNED: readonly AutoSignAction[] = [
  { contract: C.token, action: 'transfer' },
  { contract: 'alien.worlds', action: 'transfer' },
  { contract: C.atomicassets, action: 'transfer' },
]

const forbidden = (a: AutoSignAction) =>
  a.action === 'transfer' || NEVER_AUTO_SIGNED.some((n) => n.contract === a.contract && n.action === a.action)

/** The actions of the chosen groups, one entry per contract, as WharfKit wants them. */
export function whitelistFor(groupIds: readonly string[]): SessionKeyWhitelistInput[] {
  const byContract = new Map<string, Set<string>>()
  for (const group of AUTO_SIGN_GROUPS) {
    if (!groupIds.includes(group.id)) continue
    for (const a of group.actions) {
      if (forbidden(a)) continue
      const actions = byContract.get(a.contract) ?? new Set<string>()
      actions.add(a.action)
      byContract.set(a.contract, actions)
    }
  }
  return [...byContract].map(([contract, actions]) => ({ contract, actions: [...actions].sort() }))
}

/** Which groups a whitelist covers: every one of a group's actions has to be in it. */
export function groupsFrom(whitelisted: readonly AutoSignAction[]): string[] {
  const has = new Set(whitelisted.map((a) => `${a.contract}::${a.action}`))
  return AUTO_SIGN_GROUPS.filter((g) => g.actions.every((a) => has.has(`${a.contract}::${a.action}`))).map(
    (g) => g.id,
  )
}

const STORAGE_KEY = 'al:autosign.v1'

/** The player's last choice, kept in this browser so the whitelist is ready before the session is. */
export function savedGroups(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(saved)) return []
    const known = new Set(AUTO_SIGN_GROUPS.map((g) => g.id))
    return saved.filter((id): id is string => typeof id === 'string' && known.has(id))
  } catch {
    return []
  }
}

export function rememberGroups(groupIds: readonly string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...groupIds]))
  } catch {
    /* Without storage the chain still holds the links; the page reads them back on the next visit. */
  }
}
