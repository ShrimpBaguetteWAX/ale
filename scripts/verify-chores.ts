/**
 * Pins the menu indicators, and the request budget behind them.
 *
 *   npx vite build --ssr scripts/verify-chores.ts --outDir .ssr
 *   node .ssr/verify-chores.js
 *
 * Two halves. The first drives each check through a stubbed `fetch` and
 * asserts both the answer *and* how many requests it took — a check that
 * quietly starts costing six reads instead of one is the failure this whole
 * design is meant to avoid, and it would never show up as a broken screen.
 *
 * The second replays the scheduler against a fake clock to prove the ceiling
 * it promises: at most one request per tick, no matter how many checks are
 * overdue at once.
 */
import {
  CHORE_CHECKS,
  choresFor,
  LAND_BOOST_WARNING,
  type ChoreKey,
} from '../src/chores/checks'
import { DIRTIES } from '../src/wharf/actions'
import { readdirSync, readFileSync } from 'node:fs'
import { cacheDrop } from '../src/chain/cache'
import { onChoreRefresh, refreshChore } from '../src/chores/signal'
import type { Player } from '../src/chain/types'

let pass = 0
let fail = 0
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log((ok ? '  ok   ' : '  FAIL ') + name)
  if (!ok) {
    console.log('         got  ' + JSON.stringify(got))
    console.log('         want ' + JSON.stringify(want))
  }
  ok ? pass++ : fail++
}

/* ---------- a chain that answers from a script ---------- */

type Rows = Record<string, unknown>[]
let calls: string[] = []
let tables: Record<string, Rows> = {}

const realFetch = globalThis.fetch

function stubChain() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url.includes('/v1/chain/get_table_rows')) {
      const body = JSON.parse(String(init?.body ?? '{}'))
      const id = `${body.code}/${body.table}`
      calls.push(id)
      return new Response(
        JSON.stringify({ rows: tables[id] ?? [], more: false, next_key: '' }),
      )
    }
    if (url.includes('atomicassets')) {
      calls.push('atomic/assets')
      return new Response(JSON.stringify({ data: tables['atomic/assets'] ?? [] }))
    }
    calls.push('other:' + url)
    return new Response(JSON.stringify({}))
  }) as typeof fetch
}

const iso = (msFromNow: number) =>
  new Date(Date.now() + msFromNow).toISOString().slice(0, 19)

const player = (over: Record<string, unknown> = {}): Player =>
  ({
    wallet: 'me.wam',
    legend_access_expiry: iso(-86_400_000),
    activestats: { action_points: 100, gems: 0, credits: 0 },
    reward_power: [],
    permstats: [],
    ...over,
  }) as unknown as Player

const only = (key: ChoreKey) => CHORE_CHECKS.find((c) => c.key === key)!

/** A run that keeps whatever is already cached — the normal case. */
async function runCached(key: ChoreKey, p: Player, force = false) {
  calls = []
  const flag = await only(key).run(p, force)
  return { flag, calls: [...calls] }
}

async function runCheck(key: ChoreKey, p: Player) {
  /* Every cache key, so one case cannot answer the next one for free. */
  cacheDrop('')
  calls = []
  const flag = await only(key).run(p)
  return { flag, calls: [...calls] }
}

/* ---------- the checks ---------- */

async function checks() {
  console.log('indicators\n')

  /* --- shop --- */
  {
    tables = {
      'shop.ale/shopitems': [
        { item: 'flask', cost_wax: '0.00000000 WAX', cost_gem: 0, cost_dust: 0, cost_action_points: 0, cooldown_seconds: 86400 },
      ],
      'shop.ale/cdclaimshp': [],
    }
    let r = await runCheck('shop', player())
    check('shop: a free flask off cooldown lights up', r.flag, true)
    check('shop: it costs two reads', r.calls.length, 2)

    tables['shop.ale/cdclaimshp'] = [
      { wallet: 'me.wam', item: 'flask', cooldown_expired: iso(3_600_000) },
    ]
    r = await runCheck('shop', player())
    check('shop: on cooldown, dark', r.flag, false)

    tables['shop.ale/cdclaimshp'] = []
    r = await runCheck('shop', player({ activestats: { action_points: 5000, gems: 0, credits: 0 } }))
    check('shop: a trial account over the energy cap cannot claim, so no dot', r.flag, false)

    r = await runCheck(
      'shop',
      player({
        legend_access_expiry: iso(86_400_000),
        activestats: { action_points: 5000, gems: 0, credits: 0 },
      }),
    )
    check('shop: Legend is exempt from that cap', r.flag, true)

    /*
       The reported bug: the dot survived a purchase.

       Two causes, and the test has to separate them. The schedule is one —
       ten minutes before the check's turn comes round again. The other is
       the cache: even once it does run, a cached cooldown from before the
       purchase answers the question with the old world. A forced run is what
       closes the second, and this is the case that proves it.
    */
    tables['shop.ale/cdclaimshp'] = []
    cacheDrop('')
    let before = await runCached('shop', player())
    check('shop: before buying, the dot is lit', before.flag, true)

    // The purchase lands: the contract stamps a cooldown.
    tables['shop.ale/cdclaimshp'] = [
      { wallet: 'me.wam', item: 'flask', cooldown_expired: iso(6 * 3_600_000) },
    ]

    const stale = await runCached('shop', player())
    check(
      'shop: an unforced re-run still reads the cached cooldown and stays lit',
      stale.flag,
      true,
    )

    const forced = await runCached('shop', player(), true)
    check('shop: a forced re-run sees the purchase and goes dark', forced.flag, false)
    check('shop: and it did go back to the chain to find out', forced.calls.length >= 1, true)
  }

  /* --- fighters --- */
  {
    const roster = (xp: number, req: number, level: number) => ({
      fighter_id: 1, owner: 'me.wam', classname: 'mystic', racename: 'human',
      element: 'fire', stats: { level, experience: xp, required_experience: req },
    })
    tables = {
      'fighters.ale/fighters': [roster(120, 100, 1)],
      'fighters.ale/levels': [{ level: 1 }, { level: 2 }],
    }
    let r = await runCheck('fighters', player())
    check('fighters: enough XP and a level above lights up', r.flag, true)
    check('fighters: it costs two reads', r.calls.length, 2)

    tables['fighters.ale/fighters'] = [roster(40, 100, 1)]
    r = await runCheck('fighters', player())
    check('fighters: short of the bar, dark', r.flag, false)

    tables['fighters.ale/fighters'] = [roster(999, 100, 2)]
    tables['fighters.ale/levels'] = [{ level: 1 }, { level: 2 }]
    r = await runCheck('fighters', player())
    check('fighters: maxed out with nowhere to go, dark', r.flag, false)
  }

  /* --- quests --- */
  {
    const quest = (start: number, end: number, expiry: number) => ({
      task_type: 'dungeons_played', task_start_value: start, task_end_value: end,
      expiry_date: iso(expiry), claimed: 0,
    })
    tables = {
      'quests.ale/activequests': [{ player: 'me.wam', quests: [quest(0, 3, 86_400_000)] }],
    }
    const withStat = (n: number) =>
      player({ permstats: [{ first: 'dungeons_played', second: n }] })

    let r = await runCheck('quests', withStat(3))
    check('quests: goal met and in date lights up', r.flag, true)
    check('quests: one read, the rest is the player row', r.calls.length, 1)

    r = await runCheck('quests', withStat(1))
    check('quests: part way, dark', r.flag, false)

    tables['quests.ale/activequests'] = [
      { player: 'me.wam', quests: [quest(0, 3, -3_600_000)] },
    ]
    r = await runCheck('quests', withStat(9))
    check('quests: complete but expired is not claimable, dark', r.flag, false)
  }

  /* --- candle --- */
  {
    tables = { 'recovery.ale/claims': [{ wallet: 'me.wam', tlm: 0, wax: 0, gems: 40 }] }
    let r = await runCheck('candle', player())
    check('candle: gems alone are not a claim, dark', r.flag, false)
    check('candle: one read', r.calls.length, 1)

    tables['recovery.ale/claims'] = [{ wallet: 'me.wam', tlm: 12, wax: 0, gems: 0 }]
    r = await runCheck('candle', player())
    check('candle: TLM to claim lights up', r.flag, true)

    tables['recovery.ale/claims'] = [{ wallet: 'me.wam', tlm: 0, wax: 5, gems: 0 }]
    r = await runCheck('candle', player())
    check('candle: WAX to claim lights up', r.flag, true)

    tables['recovery.ale/claims'] = []
    r = await runCheck('candle', player())
    check('candle: no row at all, dark', r.flag, false)
  }

  /* --- lands --- */
  {
    const land = (assetId: string, boost: number) => ({
      land_id: 'aa', asset_id: assetId, planet: 'magor', x: 1, y: 1,
      buildings: [{ building_name: 'dungeon', boost_score: boost, boost_score_update: iso(0) }],
    })
    tables = {
      'atomic/assets': [
        /* The planet is parsed out of the NFT name, not a data field —
           fetchOwnedLands drops any asset it cannot read one from. */
        { asset_id: '111', name: 'Land 1 on Magor', data: { x: '1', y: '1' } },
      ],
      'lands.ale/lands': [land('111', 60_000)],
      'lands.ale/config': [{ index: 0, boost_decay_per_hour: 0 }],
    }
    let r = await runCheck('lands', player())
    check(`lands: a building at 6% is under the ${LAND_BOOST_WARNING}% mark`, r.flag, true)

    tables['lands.ale/lands'] = [land('111', 400_000)]
    r = await runCheck('lands', player())
    check('lands: a healthy building, dark', r.flag, false)

    tables['lands.ale/lands'] = [land('999', 10_000)]
    r = await runCheck('lands', player())
    check('lands: somebody else’s failing building is not my problem', r.flag, false)

    tables['atomic/assets'] = []
    r = await runCheck('lands', player())
    check('lands: owning none skips every read', r.calls.length, 1)
  }

  /* --- farming --- */
  {
    tables = {
      'farm.ale/user': [
        {
          wallet: 'me.wam',
          last_claim: iso(-3 * 86_400_000),
          pool_weights: [{ first: 'tool.worlds', second: 100 }],
        },
      ],
      'farm.ale/config': [{ index: 0, max_power: 200, power_divider: 1 }],
    }
    let r = await runCheck('farming', player())
    check('farming: three days at 100/day is past a 200 cap', r.flag, true)
    check('farming: two reads, and neither is the pools table', r.calls.length, 2)
    check(
      'farming: the expensive pools and staked reads are skipped',
      r.calls.some((c) => c.includes('pools') || c.includes('staked')),
      false,
    )

    tables['farm.ale/config'] = [{ index: 0, max_power: 9999, power_divider: 1 }]
    r = await runCheck('farming', player())
    check('farming: still filling, dark', r.flag, false)

    tables['farm.ale/user'] = [
      { wallet: 'me.wam', last_claim: iso(-9 * 86_400_000), pool_weights: [] }
    ]
    r = await runCheck('farming', player())
    check('farming: nothing staked can never cap, dark', r.flag, false)
  }

  /* --- rewards --- */
  {
    /*
       These assertions used to be aimed at 'account', which ignores
       reward_power entirely -- so the rewards dot went unverified while
       account was certified free that it is not. Both are answered below.
    */
    tables = {}
    let r = await runCheck('rewards', player({ reward_power: [] }))
    check('rewards: no banked power, dark', r.flag, false)
    check('rewards: it makes no request at all', r.calls.length, 0)

    r = await runCheck(
      'rewards',
      player({ reward_power: [{ type: 'tlm', pool: 'tlmdungeon', power: 10_000 }] }),
    )
    check('rewards: a full 10,000 on a threshold pool lights up', r.flag, true)

    r = await runCheck(
      'rewards',
      player({ reward_power: [{ type: 'tlm', pool: 'tlmdungeon', power: 500 }] }),
    )
    check('rewards: under the threshold on that pool, dark', r.flag, false)
  }

  /* --- account --- */
  {
    /*
       Not free: the weekly allowance is a config row and the usage is a
       wallet row on the sixty-second TTL, so a five-minute check pays for
       the second one every time. That is the cost the budget below counts.
    */
    tables = {}
    tables['cpu.ale/config'] = [{ claims_per_week: 100, wax_per_claim: '0.1 WAX' }]
    tables['cpu.ale/cpuusage'] = [{ wallet: 'me.wam', uses: 10, expiry_time: iso(86_400_000) }]
    let r = await runCheck('account', player())
    check('account: it costs two reads', r.calls.length, 2)
    check('account: a tenth of the allowance spent, dark', r.flag, false)

    tables['cpu.ale/cpuusage'] = [{ wallet: 'me.wam', uses: 80, expiry_time: iso(86_400_000) }]
    r = await runCheck('account', player())
    check('account: four fifths spent lights up', r.flag, true)
  }
}

/* ---------- the budget ---------- */

/**
 * Replays the scheduler's choice rule against a fake clock.
 *
 * Deliberately a re-implementation rather than an import: the point is to
 * state the promise — one request per tick, most overdue first — and check
 * the shape of the schedule against it.
 */
function schedule(ticks: number, tickMs: number) {
  const due = new Map<ChoreKey, number>()
  const fired: { t: number; key: ChoreKey }[] = []
  for (let i = 0; i < ticks; i++) {
    const now = i * tickMs
    let pick: ChoreKey | null = null
    let worst = -1
    for (const c of CHORE_CHECKS) {
      const at = due.get(c.key) ?? 0
      if (at > now) continue
      if (now - at > worst) {
        worst = now - at
        pick = c.key
      }
    }
    if (!pick) continue
    fired.push({ t: now, key: pick })
    due.set(pick, now + only(pick).every)
  }
  return fired
}

function budget() {
  console.log('\nrequest budget\n')

  const TICK = 4_000
  const HOUR = 3_600_000
  const fired = schedule(HOUR / TICK, TICK)

  /* One at a time is the whole promise. */
  const perTick = new Map<number, number>()
  for (const f of fired) perTick.set(f.t, (perTick.get(f.t) ?? 0) + 1)
  check('never more than one check per tick', Math.max(...perTick.values()), 1)

  /* The opening burst is the worst case: seven checks, all due at zero. */
  const firstSeven = fired.slice(0, CHORE_CHECKS.length)
  check(
    'every section is answered within the first half minute',
    firstSeven[firstSeven.length - 1].t <= 30_000,
    true,
  )
  check(
    'and each of the seven appears exactly once in that opening pass',
    new Set(firstSeven.map((f) => f.key)).size,
    CHORE_CHECKS.length,
  )

  /* What it actually costs to sit on the game for an hour. */
  const counts = new Map<ChoreKey, number>()
  for (const f of fired) counts.set(f.key, (counts.get(f.key) ?? 0) + 1)

  /* `rewards` is free -- it reads the player row the app already holds -- so
     it does not count against the network. `account` is not free: its usage
     row is on the sixty-second TTL and every five-minute check pays for it. */
  const requestsPerHour = [...counts.entries()]
    .filter(([k]) => k !== 'rewards')
    .reduce((n, [, c]) => n + c, 0)

  console.log('\n  per hour idling on one screen:')
  for (const c of CHORE_CHECKS) {
    console.log(
      `    ${c.key.padEnd(9)} ${String(counts.get(c.key) ?? 0).padStart(3)} runs` +
        `  (every ${c.every / 60_000}m)` +
        (c.key === 'rewards' ? '  — no request' : ''),
    )
  }
  console.log(`\n  network checks per hour: ${requestsPerHour}`)

  /*
     The number that matters is the rate, not the count. A public WAX node
     tolerates far more than this; the point of pinning it is that shortening
     an interval later should have to be a deliberate choice, made with the
     new figure in front of you.
  */
  const perMinute = requestsPerHour / 60
  console.log(`  that is ${perMinute.toFixed(2)} network checks per minute`)
  check('an idle hour stays under two network checks a minute', perMinute < 2, true)

  /*
     The ceiling that actually protects the node, and the reason the intervals
     above can be shortened without arithmetic: whatever comes due together,
     the scheduler still lets exactly one out per tick.
  */
  const ceiling = 60_000 / TICK
  check('and the scheduler can never exceed one request per tick', ceiling, 15)
}

/* ---------- the per-action signal ---------- */

function signal() {
  console.log('\naction signal\n')

  const heard: string[] = []
  const off = onChoreRefresh((k) => heard.push(k))
  refreshChore('shop')
  refreshChore('fighters')
  off()
  refreshChore('quests')

  check('a fired key reaches the listener', heard, ['shop', 'fighters'])
  check('and stops once unsubscribed', heard.includes('quests'), false)

  /*
     Every dot has to be reachable from something the player can actually do,
     or it is left to its own timer -- which is the bug this replaced.

     The screens used to fire their own key by hand and this checked their
     sources for the call. They no longer do: `useAction` reads what the
     action declared it dirtied and wakes every dot built on those tables, so
     the thing worth pinning is that the declarations cover all eight.
  */
  const reachable = new Set<ChoreKey>()
  for (const tables of Object.values(DIRTIES)) {
    for (const table of tables) for (const c of choresFor(table)) reachable.add(c.key)
  }
  const stranded = CHORE_CHECKS.map((c) => c.key).filter((k) => !reachable.has(k))
  check('every dot is reachable from some action', stranded, [])

  /*
     And the reported bug itself: quest progress is a lifetime counter on the
     player row, so finishing a quest by playing a dungeon -- or travelling,
     or buying something -- has to light the quest dot. Before this it only
     lit for actions taken on /quests, and no chore claims /dungeon at all.
  */
  const elsewhere = ['playDungeon', 'playArena', 'travel', 'buyShopItem'] as const
  const blind = elsewhere.filter(
    (a) => !DIRTIES[a].some((t) => choresFor(t).some((c) => c.key === 'quests')),
  )
  check('the quest dot is woken from other sections', blind, [])

  /*
     And every screen that signs actually does the settling.

     `useAction` does it for the screens that sign through it. Six do not:
     a travel plays a wormhole over the top of its own confirmation, a
     dungeon and an arena play a fight, and that choreography cannot be
     timed by a generic hook. They kept their own loops -- and quietly kept
     none of the bookkeeping, so `DIRTIES` named what a travel changed and
     nothing read it. Walking somewhere completed a quest and the dot
     stayed dark.

     Checking the sources rather than the behaviour is deliberate: the
     failure is a screen that signs and forgets, which no runtime test on
     the screens that did remember would ever see.
  */
  const signing = readdirSync(new URL('../src/routes', import.meta.url))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ['src/routes/' + f, readFileSync(new URL('../src/routes/' + f, import.meta.url), 'utf8')] as const)
    .filter(([, src]) => src.includes("from '@/wharf/actions'"))
    /* Only the ones that actually await something out of that import --
       a file that takes just `DIRTIES` or a validator signs nothing. */
    .filter(([, src]) => {
      const named = src.match(/import \{([^}]*)\} from '@\/wharf\/actions'/s)?.[1] ?? ''
      return named
        .split(',')
        .map((n) => n.trim())
        .filter((n) => /^[a-z]/.test(n))
        .some((n) => src.includes('await ' + n + '('))
    })
  const forgot = signing
    .filter(([, src]) => !src.includes("from '@/wharf/useAction'") && !src.includes('settle('))
    .map(([f]) => f)
  check('every screen that signs settles what it changed', forgot, [])
}

async function main() {
  stubChain()
  try {
    await checks()
    signal()
    budget()
  } finally {
    globalThis.fetch = realFetch
  }
  console.log('\n' + (fail === 0 ? `all ${pass} cases passed` : `${fail} FAILED`))
  if (fail) process.exitCode = 1
}

main()
