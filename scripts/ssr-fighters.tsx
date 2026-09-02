/**
 * Renders the roster card and its detail dialog against live chain rows and
 * prints the markup, so the screen can be checked without a wallet.
 *
 *   npx vite build --ssr scripts/ssr-fighters.tsx --outDir ../ssr-out
 *   node ../ssr-out/ssr-fighters.js
 *
 * Not part of the app bundle; kept because a rendering bug in a card that
 * only appears for a fighter in an unusual state (locked, overdue, maxed) is
 * otherwise only findable by owning such a fighter.
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import Fighters, { FighterCard, FighterDialog } from '../src/routes/Fighters'
import { useGame } from '../src/state/useGame'
import type { RosterFighter } from '../src/dungeon/types'
import type { FighterLevel, FightersConfig } from '../src/fighters/types'
import type { ClassTemplate } from '../src/tavern/fighterStats'

const NODE = 'https://wax.greymass.com/v1/chain/get_table_rows'

/**
 * Make the store readable by hooks during static rendering.
 *
 * Zustand takes its server snapshot from `getServerState || getInitialState`,
 * and `getInitialState` returns the object the store was created with — which
 * `setState` replaces rather than mutates. So a plain `setState` is invisible
 * to every `useGame(...)` call under `renderToStaticMarkup`.
 */
function primeStore(patch: Record<string, unknown>) {
  useGame.setState(patch as never)
  Object.assign(useGame.getInitialState(), patch)
}

async function rows<T>(body: Record<string, unknown>): Promise<T[]> {
  const res = await fetch(NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ json: true, limit: 500, ...body }),
  })
  const data = (await res.json()) as { rows: T[] }
  return data.rows
}

function nameToUint64(name: string): bigint {
  const charmap = '.12345abcdefghijklmnopqrstuvwxyz'
  let value = 0n
  for (let i = 0; i <= 12; i++) {
    let c = 0n
    if (i < name.length && i <= 12) c = BigInt(charmap.indexOf(name[i]))
    if (i < 12) {
      c &= 0x1fn
      c <<= BigInt(64 - 5 * (i + 1))
    } else {
      c &= 0x0fn
    }
    value |= c
  }
  return value
}

async function main() {
  const wallet = process.argv[2] ?? '5thba.wam'
  const owner = nameToUint64(wallet)
  const lower = owner << 64n
  const upper = lower | 0xffffffffffffffffn

  const [roster, levels, fcfg, temps, bcfg] = await Promise.all([
    rows<RosterFighter>({
      code: 'fighters.ale',
      scope: 'fighters.ale',
      table: 'fighters',
      index_position: 2,
      key_type: 'i128',
      lower_bound: lower.toString(),
      upper_bound: upper.toString(),
    }),
    rows<FighterLevel>({ code: 'fighters.ale', scope: 'fighters.ale', table: 'levels' }),
    rows<FightersConfig>({ code: 'fighters.ale', scope: 'fighters.ale', table: 'config' }),
    rows<ClassTemplate>({ code: 'creation.ale', scope: 'creation.ale', table: 'classtemps' }),
    rows<{ level_mod: string; age_decay: string }>({
      code: 'battle.ale',
      scope: 'battle.ale',
      table: 'config',
    }),
  ])

  const templates = new Map(temps.map((t) => [t.classname, t]))
  const config = fcfg[0]
  const levelMod = Number(bcfg[0]?.level_mod) || 1.15
  const ageDecay = Number(bcfg[0]?.age_decay) || 1
  const now = Date.now()

  console.log(`# ${wallet}: ${roster.length} fighters`)
  if (roster.length === 0) return

  /*
   * One card per interesting state, not one per fighter: the states are what
   * differ, and a hundred near-identical cards would bury a bad one.
   */
  const base = roster[0]
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19)

  /*
   * States nobody in this roster happens to be in are synthesised from a real
   * row, because the branches that render them — the deletion countdown, the
   * max-level chip, a locked ability — are exactly the ones that never get
   * looked at until a player hits them.
   */
  const overdue: RosterFighter = {
    ...base,
    in_use: 0,
    last_payday: iso(now - 40 * 86_400_000),
    next_payday: iso(now - 10 * 86_400_000),
    final_deletion_date: iso(now + 80 * 86_400_000),
  }
  const maxed: RosterFighter = {
    ...base,
    in_use: 0,
    marker: 'gold-up',
    ascension_level: 3,
    stats: { ...base.stats, level: 10, experience: 12_000, required_experience: 10_000 },
  }
  const lockedAbility: RosterFighter = {
    ...base,
    in_use: 0,
    stats: {
      ...base.stats,
      abilities: (base.stats.abilities ?? []).map((a, i) =>
        i === (base.stats.abilities?.length ?? 1) - 1 ? { ...a, locked: 1 } : a,
      ),
    },
  }

  const picks = [
    ['plain', base],
    ['locked', roster.find((f) => f.in_use)],
    [
      'overdue (synthetic)',
      roster.find((f) => now >= Date.parse(f.next_payday + 'Z')) ?? overdue,
    ],
    ['can level', roster.find((f) => f.stats.experience >= f.stats.required_experience)],
    ['max level (synthetic)', roster.find((f) => f.stats.level >= 10) ?? maxed],
    ['locked ability (synthetic)', lockedAbility],
    ['marked', roster.find((f) => f.marker) ?? maxed],
  ] as [string, RosterFighter | undefined][]

  const gallery: string[] = []

  for (const [label, f] of picks) {
    if (!f) {
      console.log(`\n## ${label}: none in this roster`)
      continue
    }
    console.log(`\n## ${label} — fighter ${f.fighter_id}`)
    for (const [tabLabel, mode] of [
      ['inventory', 'inventory'],
      ['sell', 'sell'],
    ] as const) {
      const html = renderToStaticMarkup(
        <FighterCard
          fighter={f}
          levels={levels}
          config={config}
          template={templates.get(f.classname)}
          levelMod={levelMod}
          ageDecay={ageDecay}
          now={now}
          mode={mode}
          tab={tabLabel === 'sell' ? 'abilities' : 'primary'}
          selected={mode === 'inventory'}
          checked={mode === 'sell'}
          onSelect={() => {}}
          onCheck={() => {}}
          onOpen={() => {}}
        />,
      )
      console.log(html.replace(/></g, '>\n<'))
      gallery.push(`<h2>${label} · ${tabLabel}</h2><div class="rostergrid">${html}</div>`)
      if (tabLabel === 'sell') break
    }
  }

  /*
   * The chrome around the grid — header, action bar, filters. Effects do not
   * run under static rendering, so the roster stays empty and this is the
   * first-paint state: exactly the one a player sees before anything loads,
   * and the one most likely to be shipped unlooked-at.
   */
  console.log('\n## screen chrome (pre-load)')
  primeStore({
    account: wallet,
    playerLoaded: true,
    player: { activestats: { credits: 4200, gems: 12, action_points: 500 } },
  })
  console.log(renderToStaticMarkup(<Fighters />).replace(/></g, '>\n<'))

  console.log('\n## dialog')
  console.log(
    renderToStaticMarkup(
      <FighterDialog
        fighter={roster[0]}
        levels={levels}
        config={config}
        template={templates.get(roster[0].classname)}
        levelMod={levelMod}
        ageDecay={ageDecay}
        now={now}
        busy={false}
        canEdit
        onMarker={() => {}}
        onClose={() => {}}
      />,
    ).replace(/></g, '>\n<'),
  )

  writeGallery(gallery)
}

/**
 * A static page of every card state, dropped into the build output beside the
 * real stylesheet so it can be opened straight from disk.
 *
 * Markup on its own does not catch a card whose portrait overflows or whose
 * numbers wrap; this is the cheapest way to actually look at one. Asset paths
 * are rewritten relative so the page works over `file://`, and it lands in
 * `docs/`, which the next `npm run build` empties.
 */
function writeGallery(cards: string[]) {
  const css = readdirSync('docs/assets').find((f) => f.endsWith('.css'))
  if (!css) {
    console.error('\n(no built stylesheet in docs/assets — run npm run build first)')
    return
  }

  const body = cards
    .join('\n')
    .replace(/"\/assets\//g, '"assets/')
    .replace(/url\(&#x27;\/assets\//g, "url(&#x27;assets/")

  writeFileSync(
    'docs/__preview-fighters.html',
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Fighter card states</title>
<link rel="stylesheet" href="assets/${css}">
<style>
  body { padding: 24px; background: var(--bg); font-family: var(--font-body); }
  h2 { color: var(--text-heading); font-family: var(--font-display); font-size: 16px; margin: 28px 0 8px; }
</style>
</head><body>${body}</body></html>`,
  )
  console.error('\nwrote docs/__preview-fighters.html')
}

void main()
