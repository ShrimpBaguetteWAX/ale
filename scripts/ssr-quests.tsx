/**
 * Renders the quest screen against live chain rows and writes a preview page,
 * so it can be looked at without a wallet.
 *
 *   npx vite build --ssr scripts/ssr-quests.tsx --outDir .ssr
 *   node .ssr/ssr-quests.js <wallet>
 *
 * The outDir has to sit inside the project or node cannot resolve `react`.
 * Effects never run under static rendering, so the route itself only ever
 * renders its first paint — the cadence panels are rendered directly with
 * real rows instead.
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import Quests, { ScopePanel } from '../src/routes/Quests'
import { useGame } from '../src/state/useGame'
import { boardOf, needsRefill } from '../src/quests/rules'
import type { ActiveQuests, Quest, QuestConfig, QuestScope } from '../src/quests/types'
import type { Player } from '../src/chain/types'

const NODE = 'https://wax.greymass.com/v1/chain/get_table_rows'

/**
 * Make the store readable by hooks during static rendering.
 *
 * Zustand takes its server snapshot from `getServerState || getInitialState`,
 * and `getInitialState` returns the object the store was created with — which
 * `setState` replaces rather than mutates. So a plain `setState` is invisible
 * to every `useGame(...)` call under `renderToStaticMarkup`, and a screen that
 * reads the player renders as if no wallet were connected.
 *
 * Writing through both puts the same values on the live state and on the
 * initial object the server snapshot still points at.
 */
function primeStore(patch: Record<string, unknown>) {
  useGame.setState(patch as never)
  Object.assign(useGame.getInitialState(), patch)
}

async function rows<T>(body: Record<string, unknown>): Promise<T[]> {
  const res = await fetch(NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ json: true, limit: 1000, ...body }),
  })
  const data = (await res.json()) as { rows: T[] }
  return data.rows
}

async function main() {
  const wallet = process.argv[2] ?? '1x1ci.wam'

  const [players, active, scopes, config] = await Promise.all([
    rows<Player>({
      code: 'players.ale',
      scope: 'players.ale',
      table: 'players',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
    rows<ActiveQuests>({
      code: 'quests.ale',
      scope: 'quests.ale',
      table: 'activequests',
      lower_bound: wallet,
      upper_bound: wallet,
    }),
    rows<QuestScope>({ code: 'quests.ale', scope: 'quests.ale', table: 'qscopes' }),
    rows<QuestConfig>({ code: 'quests.ale', scope: 'quests.ale', table: 'config' }),
  ])

  const player = players[0]
  if (!player) {
    console.error(`no player row for ${wallet}`)
    return
  }

  const quests = active[0]?.quests ?? []
  const now = Date.now()
  console.log(`# ${wallet}: ${quests.length} quests`)

  const pages: { label: string; html: string }[] = []
  const render = (label: string, node: JSX.Element) => {
    const html = renderToStaticMarkup(node)
    console.log(`\n## ${label}\n${html.replace(/></g, '>\n<')}`)
    pages.push({ label, html })
  }

  primeStore({ account: wallet, playerLoaded: true, player })
  render('screen chrome (first paint)', <Quests />)

  /*
   * One panel per cadence, against this wallet's real quests. Between them a
   * live roster covers most states — in progress, finished and waiting to be
   * claimed, and expired — because the three cadences move at different
   * speeds.
   */
  const board = boardOf(quests, scopes, player, now)
  const panel = (b: (typeof board)[number], confirming: string | null = null) => (
    <ScopePanel
      board={b}
      player={player}
      config={config[0]}
      credits={player.activestats.credits}
      now={now}
      busy={null}
      canAct
      confirmReroll={confirming}
      onClaim={() => {}}
      onReroll={() => {}}
      onAskReroll={() => {}}
    />
  )

  for (const b of board) {
    render(
      `${b.label} — ${b.quests.length} live, ${b.claimable} claimable, ` +
        `${b.expired.length} expired, ${b.emptySlots} empty`,
      panel(b),
    )
  }

  /* The reroll warning only appears once a player has asked for it. */
  const withQuests = board.find((b) => b.quests.length > 0)
  if (withQuests) {
    const first = withQuests.quests[0]
    render('reroll confirmation', panel(withQuests, questKeyOf(first)))
  }

  /*
   * A finished quest and a half-finished one, synthesised by moving the
   * snapshot rather than the player's counters — the goal is the difference,
   * so lowering `task_end_value` is the same thing as having done the work.
   *
   * Both bands, and the claim button, are otherwise unreachable: on this
   * chain nobody currently holds a quest they have finished.
   */
  if (withQuests) {
    const base = withQuests.quests[0]
    const at = (fraction: number): Quest => {
      const goal = base.task_end_value - base.task_start_value
      const doneNow = Math.max(
        0,
        (player.permstats.find((p) => p.first === base.task_type)?.second ?? 0) -
          base.task_start_value,
      )
      /* Set the goal so the counter's real position lands at `fraction`. */
      return {
        ...base,
        task_end_value:
          base.task_start_value +
          Math.max(1, Math.round(Number(doneNow) / fraction) || goal),
      }
    }

    render(
      'progress bands (synthetic: 40%, 70%, complete)',
      panel(
        {
          ...withQuests,
          quests: [at(0.4), at(0.7), at(1)],
          claimable: 1,
          emptySlots: 0,
        },
        null,
      ),
    )
  }

  /*
   * The refill button is the one control that decides whether the screen is
   * usable at all, and it is conditional on pure logic rather than on markup
   * — so it is checked as logic. The three cases are the whole truth table:
   * nothing held, everything held, and the real row in between.
   */
  console.log('\n## needsRefill')
  const cases: [string, Quest[]][] = [
    ['this wallet', quests],
    ['no quests at all', []],
    [
      'every slot full and in date',
      scopes.flatMap((s) =>
        Array.from({ length: s.max_quests }, (_, i) => ({
          ...quests[0],
          quest_scope: s.scopename,
          quest_name: `filler${i}`,
          expiry_date: s.quest_end,
        })),
      ),
    ],
  ]
  for (const [label, qs] of cases) {
    const b = boardOf(qs, scopes, player, now)
    console.log(
      `  ${label}: needsRefill=${needsRefill(b)} ` +
        b.map((x) => `${x.scope}(${x.quests.length}/${x.quests.length + x.emptySlots})`).join(' '),
    )
  }

  writeGallery(pages)
}

/** Mirrors `questKey` so the harness can arm one card's confirm state. */
function questKeyOf(q: Quest): string {
  return `${q.quest_scope}:${q.quest_name}:${q.task_end_value}:${q.reward_amount}`
}

function writeGallery(pages: { label: string; html: string }[]) {
  const css = readdirSync('docs/assets').find((f) => f.endsWith('.css'))
  if (!css) {
    console.error('\n(no built stylesheet in docs/assets — run npm run build first)')
    return
  }

  const body = pages
    .map(
      (p) =>
        `<h2 class="preview-label">${p.label}</h2><div class="quests">${p.html}</div>`,
    )
    .join('\n')
    .replace(/"\/assets\//g, '"assets/')
    .replace(/url\(&#x27;\/assets\//g, "url(&#x27;assets/")

  writeFileSync(
    'docs/__preview-quests.html',
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Quest screen states</title>
<link rel="stylesheet" href="assets/${css}">
<style>
  body { padding: 24px; background: var(--bg); font-family: var(--font-body); }
  .preview-label { color: var(--text-heading); font-family: var(--font-display);
    font-size: 15px; margin: 32px 0 10px; text-transform: uppercase; letter-spacing: .1em; }
</style>
</head><body>${body}</body></html>`,
  )
  console.error('\nwrote docs/__preview-quests.html')
}

void main()
