import type { Player } from '@/chain/types'
import type { PoolEntry } from '@/pools/rules'
import { MINE_POWER, mineEstimate, poolAmount } from '@/pools/rules'
import { hasLegendAccess } from '@/account/rules'
import { kvToRecord } from '@/chain/types'
import { formatNumber } from '@/format'

/**
 * The briefing: "what can I do right now, and why would I want to?"
 *
 * Every other screen answers a question the player already knows to ask. This
 * one is for the player who does not know what the questions are yet — the
 * new recruit with two fighters, the returning player whose pools filled
 * while they were away, the landowner who never noticed an empty plot pays
 * nothing. So each suggestion carries its *why* in the game's own terms
 * (what it pays, what it unlocks) and a single way in.
 *
 * Kept free of React and of the network: the hook gathers whatever it can
 * read, and anything it could not read is simply absent here. A missing input
 * drops the suggestions built on it rather than guessing — "you have 0
 * dungeons left" from a failed read would be worse than saying nothing.
 */

export type BriefGroup = 'start' | 'now' | 'play' | 'grow'

export type BriefTone = 'claim' | 'warn' | 'play' | 'grow'

export interface BriefLink {
  label: string
  to: string
}

export interface BriefItem {
  id: string
  group: BriefGroup
  /** Lower comes first within its group. */
  rank: number
  tone: BriefTone
  icon: string
  title: string
  /** Why it is worth doing, in a sentence or two. */
  body: string
  /** A short figure beside the title — "23 open", "~142 TLM". */
  figure?: string
  cta: BriefLink
  /** A second, quieter way in, where the thing has two homes. */
  more?: BriefLink
  /** Pool bars, drawn under the words — the same numbers, at a glance. */
  meters?: BriefMeter[]
}

/** One pool's bar: how full, and what a mine there pays today. */
export interface BriefMeter {
  pool: string
  /** "TLM" or "Shards". */
  symbol: string
  icon: string
  /** 0–1 towards a full mine. */
  progress: number
  ready: boolean
  /** What one mine would pay: now if ready, at full power if not. */
  pays: string
}

/* ---------- inputs ---------- */

export interface RosterSummary {
  /** Fighters the player owns and has not listed on the market. */
  total: number
  /** Of those, the ones that could be sent into a fight right now. */
  available: number
  /** Available fighters still below level 10. */
  belowTen: number
  levelUps: number
  /** Fighters at the ascension level and free to ascend. */
  ascendable: number
  /** An ascension rolled and waiting for its pick. */
  ascensionWaiting: number
  /** Past their payday: benched until paid. */
  overdue?: number
  /** Milliseconds until the first overdue fighter is deleted. */
  soonestDeletionMs?: number
}

export interface CandleSummary {
  /** Open missions, soonest to close first. */
  open: {
    requirements: string
    qualified: boolean
    have: number
    need: number
    msLeft: number
    reward: string
  }[]
  /** Milliseconds until the next one opens, when none is running. */
  nextInMs?: number
  winnings: boolean
}

export interface LandSummary {
  owned: number
  /** Lands with nothing built on them. */
  empty: number
  /** TLM waiting across all lands, raw (4 places). */
  tlmWaiting: number
  /** Buildings whose boost has nearly run out. */
  fading: number
}

export interface BriefingInput {
  player: Player
  now?: number
  /** `trial_rewpow_mod` — the share of power a trial account banks. */
  trialMod?: number
  roster?: RosterSummary
  quests?: { claimable: number; openSlots: number }
  pools?: { tlm: PoolEntry[]; shards: PoolEntry[] }
  /** Average power one win has banked lately, per pool. */
  winPower?: { dungeon: Map<string, number>; arena: Map<string, number> }
  dungeons?: { open: number; total: number; energyCost?: number }
  arenas?: { total: number }
  freeEnergy?: boolean
  candle?: CandleSummary
  lands?: LandSummary
  /** Null for a player who has never staked; undefined when unread. */
  farming?: { staked: number; maxed: boolean } | null
  avatarsReady?: number
  cpuLow?: boolean
  /**
   * The Legend CPU boost: `cpu.ale` buys a 24-hour CPU powerup on the
   * game's account, `perWeek` times a week.
   */
  cpuBoosts?: { perWeek: number; left: number }
}

/* ---------- constants the copy leans on ---------- */

export const TEAM_SIZE = 5
export const LEVELING_BELOW = 10
/** How close to expiry a Legend pass is worth mentioning. */
export const LEGEND_REMIND_MS = 5 * 86_400_000

const TLM_PLACES = 4
const SHARD_PLACES = 1

const ICON = {
  tlm: '/assets/icons/tlm.svg',
  shards: '/assets/icons/shards.svg',
  energy: '/assets/icons/energy.png',
  dungeon: '/assets/icons/dungeons.svg',
  arena: '/assets/icons/arena.svg',
  quests: '/assets/icons/menu/quests.png',
  candle: '/assets/icons/menu/candle.png',
  fighters: '/assets/icons/menu/sword.png',
  recruit: '/assets/markers/tavern.svg',
  lands: '/assets/icons/menu/my-land.png',
  build: '/assets/icons/build.png',
  rewards: '/assets/icons/menu/rewards.png',
  legend: '/assets/icons/account-legend.svg',
  farming: '/assets/icons/menu/card.png',
  avatar: '/assets/icons/menu/settings.png',
  ascension: '/assets/icons/menu/ascension.png',
  level: '/assets/icons/medal.svg',
  map: '/assets/icons/menu/world.png',
} as const

/* ---------- small helpers ---------- */

function plural(n: number, one: string, many = one + 's'): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`
}

export function stat(player: Player, key: string): number {
  return Number(kvToRecord(player.permstats ?? [])[key] ?? 0)
}

/** "3 days", "5 hours", "20 minutes". */
export function spanLabel(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000))
  if (mins < 90) return plural(mins, 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 48) return plural(hours, 'hour')
  return plural(Math.round(hours / 24), 'day')
}

/** What one full mine of a pool would pay today, in whole tokens. */
function fullMine(entry: PoolEntry): string {
  const places = entry.type === 'shards' ? SHARD_PLACES : TLM_PLACES
  return poolAmount(mineEstimate(MINE_POWER, entry.balance), places)
}

function payoutNow(entry: PoolEntry): string {
  const places = entry.type === 'shards' ? SHARD_PLACES : TLM_PLACES
  return poolAmount(entry.payout, places)
}

const SYMBOL: Record<string, string> = { tlm: 'TLM', shards: 'Shards' }

/** The Dungeon Wins pair (or Arena Wins), TLM first. */
function venuePools(
  pools: BriefingInput['pools'],
  tlmPool: string,
  shardPool: string,
): PoolEntry[] {
  if (!pools) return []
  return [
    pools.tlm.find((p) => p.pool === tlmPool),
    pools.shards.find((p) => p.pool === shardPool),
  ].filter(Boolean) as PoolEntry[]
}

/**
 * "Your Dungeon Wins bars stand at 61% (TLM) and 88% (Shards). Once one is
 * full, a mine pays ~142 TLM or ~1,203 Shards at today's pool size."
 *
 * Where the bars stand and what a mine is worth are both facts. How many
 * wins it takes to fill them is not: the power a win banks moves with the
 * tools equipped, the building's boost, the difficulty and the account, so
 * any figure here is an average of the last few fights wearing the clothes
 * of a countdown.
 */
export function poolProgressLine(label: string, entries: PoolEntry[]): string {
  const waiting = entries.filter((e) => !e.ready)
  if (entries.length === 0) return ''
  if (waiting.length === 0) {
    return `Your ${label} pools are full and ready to mine.`
  }

  const bars = waiting
    .map((e) => `${Math.floor(e.progress * 100)}% (${SYMBOL[e.type] ?? e.type})`)
    .join(' and ')
  const pays = waiting.map((e) => `~${fullMine(e)} ${SYMBOL[e.type] ?? e.type}`).join(' or ')

  return `Your ${label} bars stand at ${bars}. Once one is full, a mine pays ${pays} at today's pool size.`
}

/** The bars for a venue's pools, in the order the words name them. */
export function metersFor(entries: PoolEntry[]): BriefMeter[] {
  return entries.map((e) => ({
    pool: e.pool,
    symbol: SYMBOL[e.type] ?? e.type,
    icon: e.type === 'shards' ? ICON.shards : ICON.tlm,
    progress: e.ready ? 1 : e.progress,
    ready: e.ready,
    pays: e.ready ? payoutNow(e) : fullMine(e),
  }))
}

/* ---------- the list ---------- */

export function buildBriefing(input: BriefingInput): BriefItem[] {
  const { player } = input
  const now = input.now ?? Date.now()
  const items: BriefItem[] = []
  const add = (item: BriefItem) => items.push(item)

  const legend = hasLegendAccess(player.legend_access_expiry, now)
  const roster = input.roster
  const teamReady = roster ? roster.available >= TEAM_SIZE : undefined
  const trialShare = input.trialMod && input.trialMod > 0 && input.trialMod < 1 ? input.trialMod : 0.1

  /* "for 24 hours, up to 25 times a week" — the count off the chain. */
  const boostLine = `boost your CPU for 24 hours${input.cpuBoosts?.perWeek ? `, up to ${input.cpuBoosts.perWeek} times a week` : ''}`

  /* ---- getting started ---- */

  if (roster && roster.total < TEAM_SIZE) {
    const need = TEAM_SIZE - roster.total
    const taverns = (player.active_taverns ?? []).length
    add({
      id: 'recruit-team',
      group: 'start',
      rank: 0,
      tone: 'play',
      icon: ICON.recruit,
      title: roster.total === 0 ? 'Recruit your first fighters' : `Recruit ${plural(need, 'more fighter')}`,
      figure: `${roster.total} / ${TEAM_SIZE}`,
      body:
        `Every fight takes a team of five, so this comes before anything else. ` +
        `Taverns are marked on your World Map${taverns ? ` — you have ${plural(taverns, 'tavern')} waiting` : ''}. ` +
        `Travel to one (it costs energy), ` +
        (legend
          ? 'your Legend pass reveals the recruit on offer for free as you arrive, '
          : 'reveal the recruit on offer, ') +
        `then hire them with credits. Showing the tavern the Alien Worlds NFTs it asks for makes the hire cheaper, and the NFTs stay yours.`,
      cta: { label: 'Find a tavern', to: '/map' },
      more: { label: 'How hiring works', to: '/tavern' },
    })
  }

  /* ---- ready now: things that are simply waiting to be taken ---- */

  const readyPools = [...(input.pools?.tlm ?? []), ...(input.pools?.shards ?? [])].filter(
    (p) => p.ready && p.payout > 0,
  )
  if (readyPools.length) {
    const tlm = readyPools.filter((p) => p.type === 'tlm')
    const shards = readyPools.filter((p) => p.type === 'shards')
    const parts = [
      ...tlm.map((p) => `${p.label}: ~${payoutNow(p)} TLM`),
      ...shards.map((p) => `${p.label}: ~${payoutNow(p)} Shards`),
    ]
    add({
      id: 'mine',
      group: 'now',
      rank: 0,
      tone: 'claim',
      icon: tlm.length ? ICON.tlm : ICON.shards,
      title: readyPools.length === 1 ? 'A reward pool is ready to mine' : `${readyPools.length} reward pools are ready to mine`,
      body:
        `Your wins have filled ${readyPools.length === 1 ? 'a pool' : 'these pools'} — mining turns the Reward Power into tokens. ${parts.join(' · ')}. ` +
        `Each mine takes a share of a pool every player draws from, so it pays most while the pool is full.`,
      cta: { label: 'Mine in Rewards', to: '/rewards' },
      meters: metersFor(readyPools),
    })
  }

  const unclaimedTlm = Number(player.activestats?.unclaimed_tlm ?? 0)
  if (unclaimedTlm > 0) {
    add({
      id: 'unclaimed-tlm',
      group: 'now',
      rank: 1,
      tone: 'claim',
      icon: ICON.tlm,
      title: 'Trilium waiting on your account',
      figure: `${poolAmount(unclaimedTlm, TLM_PLACES)} TLM`,
      body: 'The game is holding TLM for you. Claiming sends it to your wallet.',
      cta: { label: 'Claim TLM', to: '/rewards?tab=tlm' },
    })
  }

  if (input.quests && input.quests.claimable > 0) {
    add({
      id: 'quests-claim',
      group: 'now',
      rank: 2,
      tone: 'claim',
      icon: ICON.quests,
      title: `${plural(input.quests.claimable, 'quest')} ready to claim`,
      body: 'Finished quests pay out when you claim them, and claiming frees the slot for a new one.',
      cta: { label: 'Claim quests', to: '/quests' },
    })
  }

  if (input.freeEnergy) {
    add({
      id: 'free-energy',
      group: 'now',
      rank: 3,
      tone: 'claim',
      icon: ICON.energy,
      title: 'Free energy flask',
      body: 'Energy pays for travel, recruiting and dungeon runs. A free flask is on the shelf every day — take it before the day resets.',
      cta: { label: 'Claim energy', to: '/shop?c=flasks' },
    })
  }

  if (input.lands && input.lands.tlmWaiting > 0) {
    add({
      id: 'land-tlm',
      group: 'now',
      rank: 4,
      tone: 'claim',
      icon: ICON.lands,
      title: 'Your buildings have earned TLM',
      figure: `${poolAmount(input.lands.tlmWaiting, TLM_PLACES)} TLM`,
      body: 'Players have been using the buildings on your land. Claim All collects it from every land in one signature.',
      cta: { label: 'Claim on My Lands', to: '/lands' },
    })
  }

  if (input.candle?.winnings) {
    add({
      id: 'candle-win',
      group: 'now',
      rank: 5,
      tone: 'claim',
      icon: ICON.candle,
      title: 'Candle winnings to claim',
      body: 'A Candle mission you put gems into has paid out your share.',
      cta: { label: 'Claim at the Candle', to: '/candle' },
    })
  }

  if (roster?.overdue) {
    const n = roster.overdue
    add({
      id: 'payday',
      group: 'now',
      rank: 0,
      tone: 'warn',
      icon: ICON.fighters,
      title: n === 1 ? "A fighter won't fight until it's paid" : `${n} fighters won't fight until they're paid`,
      figure:
        roster.soonestDeletionMs !== undefined && Number.isFinite(roster.soonestDeletionMs)
          ? `deleted in ${spanLabel(Math.max(0, roster.soonestDeletionMs))}`
          : undefined,
      body:
        `${n === 1 ? 'Its' : 'Their'} payday has passed, so the game benches ${n === 1 ? 'it' : 'them'} from every fight. ` +
        `An unpaid fighter is also on a countdown: 90 days after the missed payday it is deleted for good. Paying costs credits and restarts the clock.`,
      cta: { label: 'Pay on My Fighters', to: '/fighters' },
    })
  }

  if (roster && roster.levelUps > 0) {
    add({
      id: 'level-up',
      group: 'now',
      rank: 6,
      tone: 'claim',
      icon: ICON.level,
      title: `${plural(roster.levelUps, 'fighter')} can level up`,
      body: 'They have the experience already. Levelling raises their stats for good — stronger teams clear harder dungeons, which bank more Reward Power.',
      cta: { label: 'Level up', to: '/fighters' },
    })
  }

  if (roster && roster.ascensionWaiting > 0) {
    add({
      id: 'ascension-pick',
      group: 'now',
      rank: 7,
      tone: 'claim',
      icon: ICON.ascension,
      title: 'An ascension is waiting for your pick',
      body: 'The upgrades have been rolled. Choose one to finish the ascension.',
      cta: { label: 'Open Ascension', to: '/ascension' },
    })
  }

  if (input.farming?.maxed) {
    add({
      id: 'farm-cap',
      group: 'now',
      rank: 8,
      tone: 'claim',
      icon: ICON.farming,
      title: 'Your farming power has hit its cap',
      body: 'Past the cap, waiting earns nothing more. Claim now and the power starts building again.',
      cta: { label: 'Claim in Farming', to: '/farming' },
    })
  }

  if (input.avatarsReady && input.avatarsReady > 0) {
    add({
      id: 'avatars',
      group: 'now',
      rank: 9,
      tone: 'claim',
      icon: ICON.avatar,
      title: input.avatarsReady === 1 ? 'A new avatar is unlocked' : `${input.avatarsReady} new avatars are unlocked`,
      body: 'Your lifetime stats have earned a new face. Claim it on your Account to show it on the leaderboards.',
      cta: { label: 'See avatars', to: '/profile?tab=avatar' },
    })
  }

  if (input.cpuLow) {
    add({
      id: 'cpu',
      group: 'now',
      rank: 10,
      tone: 'warn',
      icon: ICON.avatar,
      title: 'Your CPU is running low',
      figure: legend && input.cpuBoosts ? `${input.cpuBoosts.left} boosts left` : undefined,
      body:
        'Every action is a WAX transaction and needs CPU. When it runs out, the next one fails. ' +
        (legend
          ? input.cpuBoosts && input.cpuBoosts.left === 0
            ? "You've used this week's free CPU boosts, so this one is down to your own wallet until they reset."
            : `As a Legend you can ${boostLine} — claim one on your Account.`
          : `A Legend pass lets you ${boostLine}.`),
      cta: { label: legend && input.cpuBoosts?.left !== 0 ? 'Boost CPU' : 'Check CPU', to: '/profile?tab=cpu' },
    })
  }

  if (input.lands && input.lands.fading > 0) {
    add({
      id: 'boost',
      group: 'now',
      rank: 11,
      tone: 'warn',
      icon: ICON.build,
      title: input.lands.fading === 1 ? 'A building is running out of boost' : `${input.lands.fading} buildings are running out of boost`,
      body: 'Boost fades every hour. At zero, players can no longer use the building and it stops earning for you.',
      cta: { label: 'Boost on My Lands', to: '/lands' },
    })
  }

  /* ---- play: what today still holds ---- */

  const dungeonPools = venuePools(input.pools, 'tlmdung', 'shrddung')

  if (input.dungeons && teamReady) {
    const { open, total, energyCost } = input.dungeons
    const energy = Number(player.activestats?.action_points ?? 0)
    const short = energyCost !== undefined && energy < energyCost
    const progress = poolProgressLine('Dungeon Wins', dungeonPools)
    /*
       A team and no win yet: the first dungeon is the next milestone, not one
       option among many, so it moves up to "Start here" and says how.
    */
    const first = stat(player, 'dungeons_won') === 0
    if (open > 0) {
      add({
        id: first ? 'dungeon-first' : 'dungeons',
        group: first ? 'start' : 'play',
        rank: first ? 1 : 0,
        tone: 'play',
        icon: ICON.dungeon,
        title: first
          ? 'Win your first dungeon'
          : open === total
            ? `${plural(open, 'dungeon')} to play today`
            : `${plural(open, 'dungeon')} you haven't played today`,
        figure: first ? `${formatNumber(open)} open today` : `${formatNumber(open)} / ${formatNumber(total)}`,
        body:
          (first
            ? 'Your team is ready. Travel to a dungeon on the World Map, pick five fighters plus a crew card and a weapon card, and fight the team the landowner left there. ' +
              'A win banks Reward Power towards TLM and Shards and gives your five XP — each dungeon once a day. '
            : `Each dungeon can be run once a day, and every win banks Reward Power and gives your team XP. `) +
          progress +
          (short ? ` You have ${formatNumber(energy)} energy and a run costs ${formatNumber(energyCost!)}.` : ''),
        cta: { label: 'Find a dungeon', to: '/map' },
        more: short ? { label: 'Get energy', to: '/shop?c=flasks' } : undefined,
        meters: metersFor(dungeonPools),
      })
    } else if (total > 0) {
      add({
        id: 'dungeons-done',
        group: 'play',
        rank: 9,
        tone: 'play',
        icon: ICON.dungeon,
        title: "You've run every dungeon today",
        body: `All ${formatNumber(total)} are done — they open again at 00:00 UTC. ${progress}`,
        cta: { label: 'World Map', to: '/map' },
        meters: metersFor(dungeonPools),
      })
    }
  }

  if (input.quests && input.quests.openSlots > 0) {
    add({
      id: 'quests-new',
      group: 'play',
      rank: 1,
      tone: 'play',
      icon: ICON.quests,
      title: 'Pick up new quests',
      figure: `${input.quests.openSlots} open`,
      body:
        `You have ${plural(input.quests.openSlots, 'empty quest slot')} across the daily, weekly and monthly boards. ` +
        'Quests pay TLM and Shards for things you do anyway — running dungeons, travelling, levelling — so an empty slot is reward left on the table.',
      cta: { label: 'Get quests', to: '/quests' },
    })
  }

  for (const [i, offer] of (input.candle?.open ?? []).entries()) {
    if (offer.qualified) {
      add({
        id: `candle-open-${i}`,
        group: 'play',
        rank: 2,
        tone: 'play',
        icon: ICON.candle,
        title: 'A Candle mission is running',
        figure: `${spanLabel(offer.msLeft)} left`,
        body:
          `Put gems in before it closes and take a share of ${offer.reward}. ` +
          'The pot is split by how many gems everyone contributed.',
        cta: { label: 'Join the mission', to: '/candle' },
      })
    } else {
      add({
        id: `candle-locked-${i}`,
        group: 'grow',
        rank: 6,
        tone: 'grow',
        icon: ICON.candle,
        title: 'A Candle mission is running without you',
        figure: `${spanLabel(offer.msLeft)} left`,
        body:
          `It pays out ${offer.reward}, but only to players with at least ${formatNumber(offer.need)} ${offer.requirements.toLowerCase()} — you have ${formatNumber(offer.have)}. ` +
          'Missions ask for different lifetime stats each time, so playing a bit of everything keeps you eligible.',
        cta: { label: 'See the mission', to: '/candle' },
      })
    }
  }

  if (roster && teamReady && roster.belowTen > 0) {
    add({
      id: 'leveling',
      group: 'play',
      rank: 3,
      tone: 'play',
      icon: ICON.fighters,
      title: `${plural(roster.belowTen, 'fighter')} still below level ${LEVELING_BELOW}`,
      body:
        'Wins give XP to the five who fought. In a dungeon, set Auto-pick to Leveling and it fields your lowest fighters first' +
        (roster.ascendable === 0 ? `, which is also the road to Ascension at level ${LEVELING_BELOW}.` : '.'),
      cta: { label: 'Find a dungeon', to: '/map' },
      more: { label: 'My Fighters', to: '/fighters' },
    })
  }

  const arenasPlayed = stat(player, 'arenas_played')
  const arenaPools = venuePools(input.pools, 'tlmarena', 'shrdarena')
  if (teamReady && input.arenas && input.arenas.total > 0) {
    add({
      id: 'arena',
      group: 'play',
      rank: arenasPlayed === 0 ? 2 : 4,
      tone: 'play',
      icon: ICON.arena,
      title: arenasPlayed === 0 ? 'Challenge an arena' : 'Take on an arena',
      figure: `${formatNumber(input.arenas.total)} arenas`,
      body:
        (arenasPlayed === 0
          ? "Arenas are held by other players' fighters. Beat the defenders and your fighters take their place — "
          : 'Arena wins fill pools of their own, separate from the dungeons, and ') +
        'holding arenas earns Arena Domination rewards on top. ' +
        poolProgressLine('Arena Wins', arenaPools),
      cta: { label: 'Find an arena', to: '/map' },
      meters: metersFor(arenaPools),
    })
  }

  if (roster && roster.ascendable > 0) {
    add({
      id: 'ascend',
      group: 'play',
      rank: 5,
      tone: 'play',
      icon: ICON.ascension,
      title: `${plural(roster.ascendable, 'fighter')} can ascend`,
      body:
        'A fighter at the level cap can be pushed past it by sacrificing three others — one sharing its element, one its race, one carrying Sacrifice. ' +
        'You pick one of three rolled upgrades.',
      cta: { label: 'Open Ascension', to: '/ascension' },
    })
  }

  /* ---- grow: the account, the land, the long game ---- */

  if (!legend) {
    const perWin = input.winPower?.dungeon.get('tlmdung')
    add({
      id: 'legend',
      group: 'grow',
      rank: 0,
      tone: 'grow',
      icon: ICON.legend,
      title: 'Get a Legend pass',
      body:
        `Trial accounts bank only ${Math.round(trialShare * 100)}% of the Reward Power they earn` +
        (perWin
          ? ` — your recent dungeon wins banked ~${formatNumber(Math.round(perWin))} each, a Legend would have banked ~${formatNumber(Math.round(perWin / trialShare))}.`
          : '. A Legend banks all of it, so every win fills your pools many times faster.') +
        ` It also reveals tavern recruits for free as you arrive, lets you ${boostLine}, and gives a larger free energy flask every day.`,
      cta: { label: 'See Legend passes', to: '/shop?c=account' },
    })
  } else {
    const left = Date.parse(player.legend_access_expiry + 'Z') - now
    if (left > 0 && left < LEGEND_REMIND_MS) {
      add({
        id: 'legend-ending',
        group: 'now',
        rank: 12,
        tone: 'warn',
        icon: ICON.legend,
        title: `Your Legend pass ends in ${spanLabel(left)}`,
        body: `After that, wins bank only ${Math.round(trialShare * 100)}% of their Reward Power. Buying again adds to the time you have left.`,
        cta: { label: 'Extend Legend', to: '/shop?c=account' },
      })
    }
  }

  if ((player.mine_nfts ?? []).length === 0) {
    add({
      id: 'tools',
      group: 'grow',
      rank: 1,
      tone: 'grow',
      icon: ICON.rewards,
      title: 'Equip mining tools',
      body:
        'The Reward Power a win banks is worked out from the Alien Worlds tools you have equipped. With none, every win banks only the minimum. ' +
        'Equipping costs nothing and the tools stay in your wallet.',
      cta: { label: 'Equip in Rewards', to: '/rewards' },
    })
  }

  if (input.lands && input.lands.empty > 0) {
    const tlmShare = Math.max(0, Math.min(100, Number(player.landowner_tlm_share ?? 0)))
    const cut =
      tlmShare >= 100
        ? 'all as TLM'
        : tlmShare <= 0
          ? 'all as Shards'
          : `${tlmShare}% as TLM and ${100 - tlmShare}% as Shards`
    add({
      id: 'build',
      group: 'grow',
      rank: 2,
      tone: 'grow',
      icon: ICON.build,
      title:
        input.lands.empty === input.lands.owned
          ? input.lands.owned === 1
            ? 'Your land has no building'
            : `None of your ${input.lands.owned} lands has a building`
          : `${input.lands.empty} of your ${input.lands.owned} lands have no building`,
      body:
        'Build a tavern, dungeon or arena and you earn passively whenever another player uses it. ' +
        `Your Landowner setting sends your cut ${cut}.`,
      cta: { label: 'Build on My Lands', to: '/lands' },
      more: { label: 'Landowner setting', to: '/rewards' },
    })
  }

  if (roster && roster.total >= TEAM_SIZE) {
    const taverns = (player.active_taverns ?? []).length
    add({
      id: 'recruit-more',
      group: 'grow',
      rank: 4,
      tone: 'grow',
      icon: ICON.recruit,
      title: 'Grow your roster',
      figure: `${formatNumber(roster.total)} fighters`,
      body:
        (taverns ? `${plural(taverns, 'tavern')} on your map ${taverns === 1 ? 'is' : 'are'} offering recruits. ` : '') +
        'More fighters means more elements to counter each dungeon, spares while others rest, and sacrifices for Ascension.',
      cta: { label: 'Find a tavern', to: '/map' },
    })
  }

  if (input.farming === null || (input.farming && input.farming.staked === 0)) {
    add({
      id: 'farming',
      group: 'grow',
      rank: 5,
      tone: 'grow',
      icon: ICON.farming,
      title: 'Put spare cards to work in Farming',
      body:
        'Alien Worlds tools, crew and weapons you are not using can be staked to earn credits. Power builds day by day up to a cap, then you claim. ' +
        'Credits pay for hiring and building.',
      cta: { label: 'Open Farming', to: '/farming' },
    })
  }

  return items.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.rank - b.rank)
}

export const GROUP_ORDER: BriefGroup[] = ['start', 'now', 'play', 'grow']

/* ---------- the road so far ---------- */

export interface FirstStep {
  key: string
  label: string
  done: boolean
}

/**
 * The first things every player does, read off the lifetime stats.
 *
 * Shown until all of them are done — it is a map for the first day, not a
 * checklist to keep ticking — and each one is measured by the stat the
 * contract already keeps, so a veteran who predates this page sees them all
 * done without ever having looked at it.
 */
export function firstSteps(player: Player, roster?: RosterSummary): FirstStep[] {
  const owned = roster?.total ?? stat(player, 'recruits')
  return [
    { key: 'team', label: 'Recruit five fighters', done: owned >= TEAM_SIZE },
    { key: 'dungeon', label: 'Win a dungeon', done: stat(player, 'dungeons_won') > 0 },
    { key: 'level', label: 'Level up a fighter', done: stat(player, 'level_ups') > 0 },
    { key: 'quest', label: 'Complete a quest', done: stat(player, 'quests_completed') > 0 },
    {
      key: 'mine',
      label: 'Mine a reward pool',
      done: stat(player, 'tlm_earned') > 0 || stat(player, 'shards_earned') > 0,
    },
    { key: 'arena', label: 'Fight in an arena', done: stat(player, 'arenas_played') > 0 },
  ]
}

/** The lifetime figures worth a glance, in the order a player reads them. */
export const JOURNEY_STATS: { key: string; label: string; icon: string }[] = [
  { key: 'dungeons_won', label: 'Dungeons won', icon: ICON.dungeon },
  { key: 'arenas_won', label: 'Arenas won', icon: ICON.arena },
  { key: 'recruits', label: 'Recruits', icon: ICON.recruit },
  { key: 'level_ups', label: 'Level-ups', icon: ICON.level },
  { key: 'quests_completed', label: 'Quests', icon: ICON.quests },
  { key: 'tlm_earned', label: 'TLM earned', icon: ICON.tlm },
  { key: 'shards_earned', label: 'Shards earned', icon: ICON.shards },
]
