/**
 * Every row the briefing can produce, on one page.
 *
 *   npx vite build --ssr scripts/ssr-briefing.tsx --outDir .ssr
 *   node .ssr/ssr-briefing.js [out.html]
 *
 * The briefing shows whichever of its two dozen rows apply to you, which
 * means most of them are never on screen at once and several are mutually
 * exclusive — a Legend pass running out and a trial account asking you to
 * buy one cannot both be true. So this runs `buildBriefing` over a set of
 * scenarios, each contrived to raise a different row, and prints the union.
 *
 * The rows are the real ones: same `buildBriefing`, same `BriefCard`, same
 * stylesheet off the last build. A row that reads badly here reads badly in
 * the game, and a row that is missing here is one the rules cannot produce.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { Player } from '../src/chain/types'
import type { PoolEntry } from '../src/pools/rules'
import {
  buildBriefing,
  firstSteps,
  type BriefGroup,
  type BriefItem,
  type BriefingInput,
  type RosterSummary,
} from '../src/briefing/rules'
import { BriefCard, GROUP_TITLE } from '../src/routes/Briefing'

const NOW = Date.parse('2026-09-26T12:00:00Z')
const DAY = 86_400_000
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19)

/** Where the images come from, so the file works on its own. */
const ORIGIN = 'https://new.alienlegends.io'

const player = (over: Partial<Player> = {}): Player =>
  ({
    wallet: 'tester.wam',
    playertag: 'Shrimp',
    permstats: [{ first: 'dungeons_won', second: 42 }],
    activestats: { action_points: 500, unclaimed_tlm: 0 },
    active_taverns: [],
    mine_nfts: ['1'],
    legend_access_expiry: stamp(NOW + 60 * DAY),
    landowner_tlm_share: 70,
    reward_power: [],
    ...over,
  }) as unknown as Player

const roster = (over: Partial<RosterSummary> = {}): RosterSummary => ({
  total: 8,
  available: 8,
  belowTen: 0,
  levelUps: 0,
  ascendable: 0,
  ascensionWaiting: 0,
  ...over,
})

const pool = (over: Partial<PoolEntry>): PoolEntry => ({
  pool: 'tlmdung',
  label: 'Dungeon Wins',
  type: 'tlm',
  power: 0,
  spend: 0,
  progress: 0,
  mines: 0,
  ready: false,
  balance: 10_000_000_000,
  payout: 0,
  anyAmount: false,
  ...over,
})

const dungeonPools = {
  tlm: [pool({ power: 6_200, progress: 0.62 })],
  shards: [pool({ pool: 'shrddung', type: 'shards', power: 9_200, progress: 0.92, balance: 7_700_000 })],
}

const arenaPools = {
  tlm: [pool({ pool: 'tlmarena', power: 5_000, progress: 0.5 })],
  shards: [pool({ pool: 'shrdarena', type: 'shards', power: 6_600, progress: 0.66, balance: 4_500_000 })],
}

/**
 * One scenario per cluster of rows.
 *
 * Named for what is true of the player rather than for the rows it raises,
 * because that is the thing a reader can check.
 */
const SCENARIOS: { label: string; input: Partial<BriefingInput> }[] = [
  {
    label: 'A new account: no fighters, no tools, nothing built',
    input: {
      player: player({ permstats: [], mine_nfts: [], legend_access_expiry: stamp(NOW - DAY) }),
      roster: roster({ total: 0, available: 0 }),
      trialMod: 0.1,
      lands: { owned: 2, empty: 2, tlmWaiting: 0, fading: 0 },
      farming: null,
    },
  },
  {
    label: 'A team, and the first dungeon still to win',
    input: {
      player: player({ permstats: [{ first: 'dungeons_won', second: 0 }] } as Partial<Player>),
      roster: roster(),
      dungeons: { open: 12, total: 12, energyCost: 40 },
      arenas: { total: 3 },
    },
  },
  {
    label: 'A day in progress: dungeons, arenas, quests, a Candle mission',
    input: {
      roster: roster({ belowTen: 4 }),
      dungeons: { open: 93, total: 96, energyCost: 40 },
      arenas: { total: 6 },
      pools: { tlm: [...dungeonPools.tlm, ...arenaPools.tlm], shards: [...dungeonPools.shards, ...arenaPools.shards] },
      quests: { claimable: 2, openSlots: 6 },
      candle: {
        open: [
          { requirements: '40 gems', qualified: true, have: 120, need: 40, msLeft: 7 * 3_600_000, reward: '27,438 TLM' },
          { requirements: '60 gems', qualified: false, have: 20, need: 60, msLeft: 19 * 3_600_000, reward: '46,700 Shards' },
        ],
        winnings: false,
      },
      freeEnergy: true,
      avatarsReady: 10,
    },
  },
  {
    label: 'Everything waiting at once: pools full, TLM unclaimed, land paying',
    input: {
      player: player({ activestats: { action_points: 20, unclaimed_tlm: 1_250_000 } } as Partial<Player>),
      roster: roster({ levelUps: 3, ascendable: 1, ascensionWaiting: 1 }),
      pools: {
        tlm: [pool({ ready: true, power: 12_000, progress: 1, payout: 1_000_000 })],
        shards: [pool({ pool: 'shrddung', type: 'shards', ready: true, power: 11_000, progress: 1, payout: 770_000 })],
      },
      dungeons: { open: 4, total: 96, energyCost: 40 },
      lands: { owned: 6, empty: 1, tlmWaiting: 4_200_000, fading: 2 },
      candle: { open: [], winnings: true, nextInMs: 5 * 3_600_000 },
      farming: { staked: 40, maxed: true },
      cpuLow: true,
      /* The live allowance: `cpu.ale`/`config.claims_per_week`. */
      cpuBoosts: { perWeek: 25, left: 23 },
    },
  },
  {
    label: 'A Legend pass about to run out, and fighters due a payday',
    input: {
      player: player({
        legend_access_expiry: stamp(NOW + 3 * DAY),
        fighters_payday: stamp(NOW - DAY),
      } as Partial<Player>),
      roster: roster({ available: 5, total: 8 }),
      dungeons: { open: 20, total: 96 },
    },
  },
  {
    label: 'Every dungeon played today, and fighters past their payday',
    input: {
      roster: roster({ total: 13, available: 8, overdue: 5, soonestDeletionMs: 9 * DAY }),
      dungeons: { open: 0, total: 96 },
      pools: dungeonPools,
    },
  },
  {
    label: 'A trial account, with recent wins to compare against',
    input: {
      player: player({ legend_access_expiry: stamp(NOW - DAY) }),
      roster: roster(),
      trialMod: 0.1,
      winPower: { dungeon: new Map([['tlmdung', 40]]), arena: new Map() },
      farming: { staked: 4, maxed: false },
    },
  },
]

/* ---------- collect one of each row ---------- */

const seen = new Map<string, { item: BriefItem; from: string }>()
for (const { label, input } of SCENARIOS) {
  for (const item of buildBriefing({ player: player(), now: NOW, ...input })) {
    if (!seen.has(item.id)) seen.set(item.id, { item, from: label })
  }
}

const byGroup = new Map<BriefGroup, { item: BriefItem; from: string }[]>()
for (const entry of seen.values()) {
  byGroup.set(entry.item.group, [...(byGroup.get(entry.item.group) ?? []), entry])
}

/* The first-steps strip, which is its own thing rather than a row. */
const steps = firstSteps(player({ permstats: [] }), roster({ total: 2 }))

/* ---------- render ---------- */

const css = (() => {
  const dir = 'docs/assets'
  const file = readdirSync(dir).find((f) => /^index-.*\.css$/.test(f))
  if (!file) throw new Error('No built stylesheet — run `npm run build` first.')
  return readFileSync(`${dir}/${file}`, 'utf8')
})()

const GROUP_ORDER: BriefGroup[] = ['start', 'now', 'play', 'grow']

const section = (group: BriefGroup) => {
  const rows = byGroup.get(group) ?? []
  if (!rows.length) return ''
  return `
    <section class="brief__group">
      <div class="brief__grouphead"><h2 class="brief__h2">${GROUP_TITLE[group]}</h2></div>
      <div class="brief__list">
        ${rows
          .map(
            ({ item, from }) => `
        <div class="catalogue__row">
          <p class="catalogue__meta"><code>${item.id}</code> · ${from}</p>
          ${renderToStaticMarkup(
            <MemoryRouter>
              <BriefCard item={item} />
            </MemoryRouter>,
          )}
        </div>`,
          )
          .join('\n')}
      </div>
    </section>`
}

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Briefing — every row</title>
<style>${css}</style>
<style>
  body { background: var(--bg); }
  .catalogue__meta {
    margin: 0 0 6px;
    font-size: 11px;
    color: var(--text-faint);
  }
  .catalogue__meta code {
    color: var(--cyan);
    font-family: ui-monospace, monospace;
  }
  /* A plain block: the card inside is the grid, and nesting a second one
     around it invented columns the real page does not have. */
  .catalogue__row { display: block; }
  .catalogue__row + .catalogue__row { margin-top: var(--sp-3); }
  .catalogue__note {
    max-width: 1080px;
    margin: 0 auto var(--sp-6);
    color: var(--text-dim);
    font-size: var(--fs-sm);
  }
</style>
<div class="shell">
  <div class="main"><div class="main__inner">
    <div class="brief">
      <header class="brief__hero">
        <div class="brief__who">
          <span class="brief__kicker">Briefing</span>
          <h1 class="brief__title">Every row the briefing can show</h1>
          <p class="brief__lead">
            ${seen.size} rows, each rendered by the game's own components against the last build's stylesheet.
            A player sees whichever apply to them; several here are mutually exclusive.
          </p>
        </div>
      </header>

      <section class="brief__steps" aria-label="Your first steps">
        <div class="brief__stepshead"><h2 class="brief__h2">Your first steps</h2></div>
        <ol class="brief__steplist">
          ${steps
            .map(
              (s, i) => `<li class="brief__step${s.done ? ' brief__step--done' : ''}">
              <span class="brief__stepnum" aria-hidden="true">${i + 1}</span>
              <span class="brief__steptext">${s.label}</span>
            </li>`,
            )
            .join('\n')}
        </ol>
      </section>

      ${GROUP_ORDER.map(section).join('\n')}
    </div>
  </div></div>
</div>
`

const out = process.argv[2] ?? 'docs/__preview-briefing.html'
writeFileSync(out, html.replaceAll('src="./assets/', `src="${ORIGIN}/assets/`).replaceAll('src="/assets/', `src="${ORIGIN}/assets/`))
console.log(`${seen.size} rows -> ${out}`)
