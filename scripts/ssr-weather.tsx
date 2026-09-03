/**
 * The weather panel, against every kind of roll the chain actually holds.
 *
 *   npx vite build --ssr scripts/ssr-weather.tsx --outDir .ssr
 *   node .ssr/ssr-weather.js
 *
 * The live arena land carries one roll out of a thousand, so looking only at
 * that one says nothing about the others. This renders the real land's
 * weather first and then a spread pulled from the same table: aimed at a
 * class, at a race, at an element, one that helps, one that hurts, one that
 * does both, one with seven effects at once, and one with none.
 *
 * The counts are computed against a real arena line-up and a real roster, so
 * "3 of the defenders" is a number the screen would actually print.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { WeatherPanel } from '../src/fight/setup'
import {
  weatherHits,
  weatherIsCalm,
  weatherLean,
  type Weather,
} from '../src/fight/weather'
import { applyArenaPower } from '../src/arena/rules'
import { fieldedStats } from '../src/fight/scaling'
import type { LiveArenaRow } from '../src/arena/queries'
import type { BattleFighter, RosterFighter } from '../src/dungeon/types'

const css = ['tokens.css', 'global.css', 'app.css', 'dungeon.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const post = async <T,>(b: Record<string, unknown>): Promise<{ rows: T[]; more: boolean; next_key: string }> => {
  const res = await fetch('https://wax.greymass.com/v1/chain/get_table_rows', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ json: true, limit: 1000, ...b }),
  })
  return res.json() as Promise<{ rows: T[]; more: boolean; next_key: string }>
}

function nameToUint64(name: string): bigint {
  const CHARMAP = '.12345abcdefghijklmnopqrstuvwxyz'
  let value = 0n
  for (let i = 0; i <= 12; i++) {
    let c = 0n
    if (i < name.length && i <= 12) c = BigInt(CHARMAP.indexOf(name[i]))
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
  const cfg = (
    await post<Record<string, string>>({
      code: 'battle.ale', scope: 'battle.ale', table: 'config', limit: 1,
    })
  ).rows[0]
  const levelMod = Number(cfg.level_mod) || 1
  const ageDecay = Number(cfg.age_decay) || 0

  /* A live arena, and the land it stands on. */
  const checks = (
    await post<{ planet: string; land_id: string; arena_power: number }>({
      code: 'arena.ale', scope: 'arena.ale', table: 'arenacheck', limit: 100,
    })
  ).rows

  let enemies: BattleFighter[] = []
  let planet = 'magor'
  let land = ''
  for (const c of checks) {
    const live = (
      await post<LiveArenaRow>({ code: 'arena.ale', scope: c.planet, table: 'livearena', limit: 100 })
    ).rows.find((r) => String(r.land_id) === String(c.land_id))
    if (!live?.fighters.length) continue
    enemies = applyArenaPower(
      live.fighters.map((f) => fieldedStats(f, f.level, f.creation_date, levelMod, ageDecay)),
      Number(c.arena_power),
    )
    planet = c.planet
    land = String(c.land_id)
    break
  }

  /* Five real fighters standing in for a picked team. */
  const owner = nameToUint64('5thba.wam')
  const roster = (
    await post<RosterFighter>({
      code: 'fighters.ale', scope: 'fighters.ale', table: 'fighters',
      index_position: 2, key_type: 'i128',
      lower_bound: (owner << 64n).toString(),
      upper_bound: ((owner << 64n) | 0xffffffffffffffffn).toString(),
    })
  ).rows
  const mine = roster.slice(0, 5)

  /* What this land is actually under. */
  const tracking = (
    await post<{ land_id: string; weather_id: string; last_change: string }>({
      code: 'battle.ale', scope: planet, table: 'landtracking',
      lower_bound: land, upper_bound: land, limit: 1,
    })
  ).rows[0]

  /* And the whole table, to pick out the shapes worth looking at. */
  let all: Weather[] = []
  let next = ''
  for (let i = 0; i < 4; i++) {
    const page = await post<Weather>({
      code: 'battle.ale', scope: planet, table: 'weather',
      ...(next ? { lower_bound: next } : {}),
    })
    all.push(...page.rows)
    if (!page.more) break
    next = page.next_key
  }
  all = [...new Map(all.map((w) => [w.weather_id, w])).values()]

  const live = all.find((w) => w.weather_id === String(tracking?.weather_id))
  const pick = (test: (w: Weather) => boolean) => all.find((w) => test(w) && w !== live)

  const cases: [string, Weather | undefined][] = [
    [`live on ${planet}/${land}`, live],
    ['aimed at a class', pick((w) => w.affected_class.length > 0)],
    ['aimed at a race', pick((w) => w.affected_race.length > 0)],
    ['aimed at an element', pick((w) => w.affected_element.length > 0)],
    ['catches everybody', pick((w) => !w.affected_class.length && !w.affected_race.length && !w.affected_element.length && w.weather_effects.length > 0)],
    ['helps whoever it catches', pick((w) => weatherLean(w) === 'good')],
    ['hurts whoever it catches', pick((w) => weatherLean(w) === 'bad')],
    ['does both', pick((w) => weatherLean(w) === 'mixed')],
    ['seven effects at once', pick((w) => w.weather_effects.length >= 6)],
    ['no effects at all', pick((w) => weatherIsCalm(w))],
  ]

  console.log(`arena ${planet}/${land}, ${enemies.length} defenders, ${mine.length} picked`)
  console.log(`weather table: ${all.length} rolls\n`)

  const body = cases
    .map(([label, w]) => {
      if (!w) {
        console.log(`  ${label.padEnd(28)} (none in the table)`)
        return `<h2 class="faint">${label} — none in the table</h2>`
      }
      const hitMine = mine.filter((f) => weatherHits(w, f)).length
      const hitTheirs = enemies.filter((f) => weatherHits(w, f)).length
      console.log(
        `  ${label.padEnd(28)} ${weatherLean(w).padEnd(6)} ${w.displayname}` +
          `  [mine ${hitMine}/${mine.length}, theirs ${hitTheirs}/${enemies.length}]`,
      )
      return (
        `<h2>${label}</h2>` +
        renderToStaticMarkup(
          <div className="dungeon">
            <header className="dungeon__head">
              <div>
                <h1 className="page__title">Arena</h1>
                <WeatherPanel weather={w} />
              </div>
            </header>
          </div>,
        )
      )
    })
    .join('\n')

  const html = `<!doctype html>
<meta charset="utf-8">
<title>Weather panel</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 24px; background: #05101e; font-family: var(--font-body); color: var(--text); }
  .panel { max-width: 520px; }
  h2 { margin: 28px 0 8px; font: 600 12px var(--font-body); letter-spacing: .1em;
       text-transform: uppercase; color: #8fa6bd; }
</style>
${body}
`
  writeFileSync(new URL('../.ssr/weather.html', import.meta.url), html)
  console.log('\nwrote .ssr/weather.html')
}

main().catch((e) => {
  console.error('render threw:', e)
  process.exitCode = 1
})
