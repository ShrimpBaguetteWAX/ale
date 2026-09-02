import { CONTRACTS, type Planet } from '@/chain/config'
import { getAllRows, getRow, getRows } from '@/chain/client'
import { TTL } from '@/chain/cache'
import { fetchOwnedCards, type CardTemplate } from '@/chain/atomic'
import type {
  BattleConfig,
  DifMod,
  DungeonConfig,
  DungeonRow,
  FightConfig,
  FightRow,
  RosterFighter,
} from './types'
import type { StatCaps } from './sim'
import type { NftValue } from './nftFighter'
import type { ClassTemplate } from '@/tavern/fighterStats'

/**
 * The dungeon standing on one land, with the team it fields.
 *
 * Scoped by planet and keyed by land id, so this is a single-row read. The
 * team only changes when the landowner rebuilds it, which is why it is
 * cached for minutes rather than seconds.
 */
export function fetchDungeon(
  planet: Planet,
  landId: string,
  refresh = false,
): Promise<DungeonRow | undefined> {
  return getRow<DungeonRow>(
    {
      code: CONTRACTS.dungeons,
      scope: planet,
      table: 'dungeons',
      key: landId,
    },
    { ttl: TTL.medium, refresh },
  )
}

/** Entry cost. Changes only when the team reprices it. */
export function fetchDungeonConfig(): Promise<DungeonConfig | undefined> {
  return getRow<DungeonConfig>(
    { code: CONTRACTS.dungeons, scope: CONTRACTS.dungeons, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * How hard the dungeon team hits at each difficulty, as a percentage of its
 * stored power. Difficulties with no row run at full strength — which is why
 * this is returned as a map rather than a list with assumed indices.
 */
export async function fetchDifMods(): Promise<Map<number, number>> {
  const rows = await getAllRows<DifMod>(
    { code: CONTRACTS.battle, scope: CONTRACTS.battle, table: 'difmod' },
    { ttl: TTL.long, persist: true },
  )
  return new Map(rows.map((r) => [r.dungeon_difficulty, r.percentage_power]))
}

/** The single global combat knob: taunt lost per blow taken. */
export async function fetchFightConfig(): Promise<number> {
  const row = await getRow<FightConfig>(
    { code: CONTRACTS.battle, scope: CONTRACTS.battle, table: 'fgtconfig', key: 0 },
    { ttl: TTL.long, persist: true },
  )
  return row?.taunt_deduction ?? 0
}

/** XP rates, the NFT-fighter threshold, and the stat caps the replay needs. */
export function fetchBattleConfig(): Promise<
  (BattleConfig & { battle_stat_caps: StatCaps }) | undefined
> {
  return getRow<BattleConfig & { battle_stat_caps: StatCaps }>(
    { code: CONTRACTS.battle, scope: CONTRACTS.battle, table: 'config', key: 0 },
    { ttl: TTL.long, persist: true },
  )
}

/**
 * Every fighter the player owns.
 *
 * The `owner` secondary index is a `uint128` of `owner << 64 | fighter_id`,
 * so one bounded read over that range returns the whole roster and nothing
 * else — far cheaper than scanning the table and filtering.
 */
export async function fetchRoster(
  wallet: string,
  refresh = false,
): Promise<RosterFighter[]> {
  const owner = nameToUint64(wallet)
  const lower = owner << 64n
  const upper = lower | 0xffffffffffffffffn
  return getAllRows<RosterFighter>(
    {
      code: CONTRACTS.fighters,
      scope: CONTRACTS.fighters,
      table: 'fighters',
      index_position: 2,
      key_type: 'i128',
      lower_bound: lower.toString(),
      upper_bound: upper.toString(),
    },
    { ttl: TTL.short, refresh },
  )
}

/**
 * One recorded battle.
 *
 * Returns undefined while the row has not landed yet — the caller polls.
 * `refresh` is forced because a cached miss from a second ago is exactly the
 * answer we must not trust here.
 */
export async function fetchFight(historyId: string): Promise<FightRow | undefined> {
  const rows = await getRows<FightRow>(
    {
      code: CONTRACTS.battle,
      scope: CONTRACTS.battle,
      table: 'fights',
      lower_bound: historyId,
      upper_bound: historyId,
      limit: 1,
    },
    { ttl: 0, refresh: true },
  )
  return rows.rows[0]
}

/**
 * The distinct crew and weapon cards in the player's wallet.
 *
 * Deduplicated to one entry per card design, with a count. Holding four
 * hundred copies of the same Onoros Drone is four hundred identical choices,
 * and the contract treats any copy as equivalent — so the picker offers the
 * design once and an asset id is resolved only when the run is signed.
 */
export async function fetchCrewCards(
  wallet: string,
): Promise<{ crew: CardTemplate[]; weapons: CardTemplate[] }> {
  const [crew, weapons] = await Promise.all([
    fetchOwnedCards(wallet, 'crew.worlds'),
    fetchOwnedCards(wallet, 'arms.worlds'),
  ])
  return { crew, weapons }
}

/**
 * `eosio::name` to its 64-bit value.
 *
 * Base-32 over `.12345abcdefghijklmnopqrstuvwxyz`, five bits per character
 * for the first twelve and four for the thirteenth.
 */
const NAME_CHARS = '.12345abcdefghijklmnopqrstuvwxyz'

export function nameToUint64(name: string): bigint {
  let value = 0n
  for (let i = 0; i <= 12; i++) {
    let c = 0n
    if (i < name.length) {
      const k = NAME_CHARS.indexOf(name[i])
      if (k < 0) throw new Error(`Not a valid account name: ${name}`)
      c = BigInt(k)
    }
    if (i < 12) value |= (c & 0x1fn) << BigInt(64 - 5 * (i + 1))
    else value |= c & 0x0fn
  }
  return value
}

/**
 * A random 12-character account name, used as the id the player's fight will
 * be filed under.
 *
 * The client picks it before signing so it knows what to read back. Only
 * characters 1–5 and a–z are legal in a `name`, and the first character must
 * not be a digit for the contract's own parsing, so the alphabet is
 * restricted rather than masked afterwards.
 */
export function randomHistoryId(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  const alphabet = letters + '12345'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  let out = letters[bytes[0] % letters.length]
  for (let i = 1; i < 12; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

/**
 * What every Alien Worlds card is worth in a fight.
 *
 * 272 rows — 108 crew and 164 weapons — that change only when the team
 * rebalances cards, so this is read whole and cached hard. It is also the
 * gate on which cards may be offered at all: `getFighterFromNFT` does a
 * `require_find` here, so a card with no row makes the run revert.
 */
export async function fetchNftValues(): Promise<Map<number, NftValue>> {
  const rows = await getAllRows<NftValue>(
    { code: CONTRACTS.fighters, scope: CONTRACTS.fighters, table: 'nftvalues' },
    { ttl: TTL.long, persist: true },
  )
  return new Map(rows.map((r) => [r.template_id, r]))
}

/**
 * The min/max bands for every class, which the grade arrows compare against.
 *
 * Read as one table rather than per class: a roster spans a dozen classes and
 * the arrows are wanted on all of them at once, so twelve keyed reads would
 * be twelve requests for what is a single small table.
 */
export async function fetchClassTemplates(): Promise<Map<string, ClassTemplate>> {
  const rows = await getAllRows<ClassTemplate>(
    { code: CONTRACTS.creation, scope: CONTRACTS.creation, table: 'classtemps' },
    { ttl: TTL.long, persist: true },
  )
  return new Map(rows.map((r) => [r.classname, r]))
}
