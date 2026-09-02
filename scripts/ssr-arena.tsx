/**
 * Renders the Arena screen against a real arena, without a wallet.
 *
 *   npx vite build --ssr scripts/ssr-arena.tsx --outDir .ssr
 *   node .ssr/ssr-arena.js
 *
 * The screen is reachable only by standing on a land that has a live arena,
 * which makes every rendering bug in it invisible until someone walks there.
 * This stands the player on one and prints the markup.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Arena from '../src/routes/Arena'
import { useGame } from '../src/state/useGame'

function primeStore(patch: Record<string, unknown>) {
  useGame.setState(patch as never)
  Object.assign(useGame.getInitialState(), patch)
}

const NODE = 'https://wax.greymass.com/v1/chain/get_table_rows'
async function rows<T>(body: Record<string, unknown>): Promise<T[]> {
  const res = await fetch(NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ json: true, limit: 200, ...body }),
  })
  return ((await res.json()) as { rows: T[] }).rows
}

async function main() {
  // Pick a real arena and the land it stands on, so the coordinates are real.
  const checks = await rows<{ planet: string; land_id: string; arena_power: number }>(
    { code: 'arena.ale', scope: 'arena.ale', table: 'arenacheck' },
  )
  let found: { planet: string; land_id: string; x: number; y: number } | null = null
  for (const c of checks) {
    const lands = await rows<{ land_id: string; x: number; y: number; buildings: { building_name: string }[] }>(
      { code: 'lands.ale', scope: c.planet, table: 'lands', limit: 1000 },
    )
    const land = lands.find(
      (l) => String(l.land_id) === String(c.land_id) &&
        String(l.buildings?.[0]?.building_name) === 'arena',
    )
    if (land) {
      found = { planet: c.planet, land_id: String(c.land_id), x: land.x, y: land.y }
      break
    }
  }
  if (!found) throw new Error('no live arena land found')
  console.log(`standing on ${found.planet} ${found.land_id} at ${found.x},${found.y}\n`)

  primeStore({
    player: {
      wallet: 'previewer.wam',
      playertag: 'Previewer',
      planet: found.planet,
      x: found.x,
      y: found.y,
      activestats: { action_points: 500, credits: 0, gems: 0 },
      played_dungeons: [],
      last_dungeon_reset: '2026-01-01T00:00:00',
    },
    session: null,
    refreshPlayer: async () => {},
  })

  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/arena']}>
      <Arena />
    </MemoryRouter>,
  )

  // The first paint is the loading state; what matters here is that it
  // renders at all and that the shell is present and correctly labelled.
  const want: [string, string][] = [
    ['page title', '>Arena<'],
    ['arena background', 'bg-arena.png'],
    ['challenge button', 'Challenge'],
    ['energy cost', 'dungeon__cost'],
    ['defender strength panel', 'arenastanding'],
    ['power bar', 'arenabar'],
    ['the stake warning', 'arena__stake'],
    ['defenders side', 'The defenders'],
    ['own side', 'Your team'],
    ['loadout', 'Loadout'],
    ['picker tabs', 'tabs__tab'],
  ]
  let bad = 0
  for (const [label, needle] of want) {
    const ok = html.includes(needle)
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'MISS'} ${label}`)
  }
  console.log(`\nmarkup ${html.length} bytes, ${bad} missing`)
  if (bad) process.exitCode = 1
}

main().catch((e) => {
  console.error('render threw:', e)
  process.exitCode = 1
})
