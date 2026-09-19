import type { Player } from '../src/chain/types'
import type { PoolEntry } from '../src/pools/rules'
import {
  buildBriefing,
  firstSteps,
  GROUP_ORDER,
  type BriefingInput,
  type BriefItem,
} from '../src/briefing/rules'
import { BriefCard, GroupHead } from '../src/routes/Briefing'

/**
 * Every note the briefing can show, at once — for review, not for players.
 *
 * Several notes rule each other out (a Legend is never told to buy a pass,
 * "23 dungeons left" and "you've run every dungeon" never meet), so three
 * made-up accounts are run through the real rules and their notes merged.
 * Each card is captioned with the condition that brings it on.
 */

const NOW = Date.now()
const day = 86_400_000
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19)

const WHEN: Record<string, string> = {
  'recruit-team': 'Fewer than 5 fighters (not counting ones listed on the market).',
  mine: 'A reward pool has a full mine banked.',
  'unclaimed-tlm': 'The game holds unclaimed TLM on the account.',
  'quests-claim': 'A quest is finished and not yet claimed.',
  'free-energy': "The free daily flask hasn't been taken yet.",
  'land-tlm': 'Buildings on your lands hold TLM to claim.',
  'candle-win': 'A Candle mission paid out and the winnings are unclaimed.',
  'level-up': 'A fighter has the XP for its next level.',
  'ascension-pick': 'An ascension has rolled and is waiting for a pick.',
  'farm-cap': 'Farming power has reached its cap.',
  avatars: 'Lifetime stats have unlocked an avatar not claimed yet.',
  cpu: 'The wallet has less than 35 ms CPU left.',
  payday: "A fighter's payday has passed (not before). Fighters listed on the market don't count.",
  boost: "A building's boost is below 7%.",
  'legend-ending': 'Legend pass ends within 5 days.',
  dungeons: 'Team ready, and maintained dungeons remain unplayed today.',
  'dungeon-first': 'Team ready, no dungeon won yet — replaces the dungeon count under Start here.',
  'dungeons-done': 'Team ready, and every dungeon has been played today.',
  'quests-new': 'Quest slots are empty or expired.',
  'candle-open-0': 'A Candle mission is open and you qualify.',
  leveling: 'Team ready, and available fighters are below level 10.',
  arena: 'Team ready and arenas exist. Pitched as a first try until you have played one.',
  ascend: 'A fighter is at the ascension level, free, and you have 3+ others to sacrifice.',
  legend: 'Trial account.',
  tools: 'No mining tools equipped.',
  build: 'You own land with nothing built on it.',
  'recruit-more': '5 or more fighters.',
  farming: 'Nothing staked in Farming.',
  'candle-locked-1': "A Candle mission is open and you don't meet its requirement.",
}

const pool = (over: Partial<PoolEntry>): PoolEntry => ({
  pool: 'tlmdung',
  label: 'Dungeon Wins',
  type: 'tlm',
  power: 0,
  spend: 0,
  progress: 0,
  mines: 0,
  ready: false,
  balance: 9_600_000_000,
  payout: 0,
  anyAmount: false,
  ...over,
})

const player = (over: Partial<Player>): Player =>
  ({
    wallet: 'sample.wam',
    playertag: 'Sample',
    permstats: [{ first: 'dungeons_won', second: 12 }],
    activestats: { action_points: 20, unclaimed_tlm: 125_000 },
    active_taverns: [{}, {}, {}, {}],
    mine_nfts: [],
    legend_access_expiry: stamp(NOW - day),
    landowner_tlm_share: 70,
    reward_power: [],
    ...over,
  }) as unknown as Player

const pools: BriefingInput['pools'] = {
  tlm: [
    pool({ power: 6_100, progress: 0.61 }),
    pool({
      pool: 'tlmarena',
      label: 'Arena Wins',
      power: 10_400,
      progress: 1,
      mines: 1,
      ready: true,
      spend: 10_000,
      balance: 23_400_000_000,
      payout: 2_340_000,
    }),
  ],
  shards: [
    pool({ pool: 'shrddung', type: 'shards', power: 8_800, progress: 0.88, balance: 14_400_000 }),
    pool({ pool: 'shrdarena', label: 'Arena Wins', type: 'shards', power: 3_900, progress: 0.39, balance: 62_600_000 }),
  ],
}

const winPower = {
  dungeon: new Map([
    ['tlmdung', 1_000],
    ['shrddung', 900],
  ]),
  arena: new Map([['shrdarena', 1_500]]),
}

const roster = {
  total: 12,
  available: 12,
  belowTen: 6,
  levelUps: 2,
  ascendable: 1,
  ascensionWaiting: 1,
  overdue: 3,
  soonestDeletionMs: 86 * day,
}

const SCENARIOS: BriefingInput[] = [
  /* A trial account with a bit of everything going on. */
  {
    player: player({}),
    now: NOW,
    trialMod: 0.1,
    roster,
    quests: { claimable: 2, openSlots: 3 },
    pools,
    winPower,
    dungeons: { open: 23, total: 72, energyCost: 50 },
    arenas: { total: 61 },
    freeEnergy: true,
    candle: {
      open: [
        { requirements: 'Dungeons won', qualified: true, have: 12, need: 10, msLeft: 11 * 3_600_000, reward: '17,547 TLM' },
        { requirements: 'Portals used', qualified: false, have: 0, need: 175, msLeft: 23 * 3_600_000, reward: '45,724 Shards' },
      ],
      winnings: true,
    },
    lands: { owned: 3, empty: 2, tlmWaiting: 356_000, fading: 1 },
    farming: null,
    avatarsReady: 1,
    cpuLow: true,
    cpuBoosts: { perWeek: 25, left: 25 },
  },
  /* A brand-new recruit. */
  {
    player: player({ permstats: [], activestats: { action_points: 500 } as Player['activestats'] }),
    now: NOW,
    roster: { ...roster, total: 2, available: 2, belowTen: 2, levelUps: 0, ascendable: 0, ascensionWaiting: 0 },
  },
  /* A full team, no win yet. */
  {
    player: player({ permstats: [] }),
    now: NOW,
    roster,
    dungeons: { open: 72, total: 72, energyCost: 50 },
    pools,
  },
  /* A Legend near the end of the pass, done with today's dungeons. */
  {
    player: player({ legend_access_expiry: stamp(NOW + 2 * day), mine_nfts: ['1'] }),
    now: NOW,
    trialMod: 0.1,
    roster,
    pools,
    winPower,
    dungeons: { open: 0, total: 72, energyCost: 50 },
    farming: { staked: 40, maxed: true },
  },
]

export default function BriefingAll() {
  const seen = new Set<string>()
  const all: BriefItem[] = []
  for (const s of SCENARIOS) {
    for (const item of buildBriefing(s)) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      all.push(item)
    }
  }
  const steps = firstSteps(SCENARIOS[0].player, SCENARIOS[0].roster)

  return (
    <div className="brief">
      <header className="brief__hero" style={{ gridTemplateColumns: '1fr' }}>
        <div className="brief__who">
          <span className="brief__kicker">Review sheet</span>
          <h1 className="brief__title">Every briefing note</h1>
          <p className="brief__lead">
            {all.length} notes from four sample accounts, built by the real rules. Players only ever
            see the ones that apply to them; each card says when that is.
          </p>
        </div>
      </header>

      <section className="brief__steps" aria-label="Your first steps">
        <div className="brief__stepshead">
          <h2 className="brief__h2">Your first steps</h2>
          <span className="faint">Shown until all six are done</span>
        </div>
        <ol className="brief__steplist">
          {steps.map((s, i) => (
            <li key={s.key} className={s.done ? 'is-done' : ''}>
              <span className="brief__stepnum" aria-hidden="true">
                {s.done ? '✓' : i + 1}
              </span>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
      </section>

      {GROUP_ORDER.map((group) => {
        const list = all.filter((i) => i.group === group).sort((a, b) => a.rank - b.rank)
        return (
          <section key={group} className="brief__group">
            <GroupHead group={group} />
            {group === 'now' && (
              <p className="brief__clear">
                When nothing is waiting: “All caught up — nothing is waiting to be claimed.”
              </p>
            )}
            <div className="brief__list">
              {list.map((item) => (
                <div key={item.id} style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--cyan)', paddingLeft: 4 }}>
                    Shown when: {WHEN[item.id] ?? item.id}
                  </span>
                  <BriefCard item={item} />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
