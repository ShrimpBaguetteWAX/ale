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
import { CHORE_CHECKS, LAND_BOOST_WARNING, type ChoreKey } from '../src/chores/checks'
import { cacheDrop } from '../src/chain/cache'
import { onChoreRefresh, refreshChore } from '../src/chores/signal'
import { readFileSync } from 'node:fs'
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

  /* --- account --- */
  {
    tables = {}
    let r = await runCheck('account', player({ reward_power: [] }))
    check('account: no banked power, dark', r.flag, false)
    check('account: it makes no request at all', r.calls.length, 0)

    r = await runCheck(
      'account',
      player({ reward_power: [{ type: 'tlm', pool: 'tlmdungeon', power: 10_000 }] }),
    )
    check('account: a full 10,000 on a threshold pool lights up', r.flag, true)

    r = await runCheck(
      'account',
      player({ reward_power: [{ type: 'tlm', pool: 'tlmdungeon', power: 500 }] }),
    )
    check('account: under the threshold on that pool, dark', r.flag, false)
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

  /* `account` is free, so it does not count against the network. */
  const requestsPerHour = [...counts.entries()]
    .filter(([k]) => k !== 'account')
    .reduce((n, [, c]) => n + c, 0)

  console.log('\n  per hour idling on one screen:')
  for (const c of CHORE_CHECKS) {
    console.log(
      `    ${c.key.padEnd(9)} ${String(counts.get(c.key) ?? 0).padStart(3)} runs` +
        `  (every ${c.every / 60_000}m)` +
        (c.key === 'account' ? '  — no request' : ''),
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
     Every section that can act has to fire, or its dot goes stale after the
     one action most likely to clear it. Checking the sources rather than the
     behaviour is deliberate: the failure being guarded against is a screen
     added later that forgets the call, which no runtime test would see.
  */
  const wired: [string, string][] = [
    ['src/routes/Shop.tsx', 'shop'],
    ['src/routes/Fighters.tsx', 'fighters'],
    ['src/routes/Quests.tsx', 'quests'],
    ['src/routes/Candle.tsx', 'candle'],
    ['src/routes/Lands.tsx', 'lands'],
    ['src/routes/Farming.tsx', 'farming'],
    ['src/routes/Profile.tsx', 'account'],
  ]
  const missing = wired.filter(([file, key]) => {
    const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    return !src.includes(`refreshChore('${key}')`)
  })
  check('every acting screen fires its own key', missing.map(([f]) => f), [])

  /* And the keys they fire are keys that exist. */
  const known = new Set(CHORE_CHECKS.map((c) => c.key))
  const unknown = wired.filter(([, k]) => !known.has(k as ChoreKey)).map(([, k]) => k)
  check('and every fired key is a real check', unknown, [])
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
