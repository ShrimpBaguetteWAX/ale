/**
 * The arena's versus panel, against a real arena and a real roster.
 *
 *   npx vite build --ssr scripts/ssr-arena-versus.tsx --outDir .ssr
 *   node .ssr/ssr-arena-versus.js
 *
 * The route itself only server-renders its loading state — everything worth
 * looking at arrives in an effect and needs a wallet — so this feeds the same
 * components the screen uses with the same pipeline: `fieldedStats`, then
 * `apply_arenapow`, then the matchup. What it is here to show is that the
 * arena now says everything the dungeon says: the balance bar weighted by
 * resistances, the landed and blocked percentages, both sides' ability
 * counts, and the per-card badges including the ones the *defenders* get out
 * of the challenger's picks.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { CombatCard, Elemental } from '../src/fight/setup'
import { autoPickTeam } from '../src/fight/autopick'
import {
  battleAsFlat,
  matchupBetween,
  matchupsFor,
  teamOutlook,
  type FlatFighter,
} from '../src/fight/matchup'
import { applyArenaPower } from '../src/arena/rules'
import { NFT_FIGHTER_ID } from '../src/arena/rules'
import { NFT_FIGHTER_ART } from '../src/dungeon/nftFighter'
import { ageFactor, fieldedStats, levelFactor } from '../src/fight/scaling'
import { formatScaled } from '../src/tavern/fighterStats'
import type { LiveArenaRow } from '../src/arena/queries'
import type { NftValue } from '../src/dungeon/nftFighter'
import type { BattleFighter, RosterFighter } from '../src/dungeon/types'

const css = ['tokens.css', 'global.css', 'app.css', 'dungeon.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const TEAM_SIZE = 5
const mid = (min: number, max: number) => Math.round((min + max) / 2)

const post = async <T,>(b: Record<string, unknown>): Promise<T[]> => {
  const res = await fetch('https://wax.greymass.com/v1/chain/get_table_rows', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ json: true, limit: 1000, ...b }),
  })
  return ((await res.json()) as { rows: T[] }).rows
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
  )[0]
  const levelMod = Number(cfg.level_mod) || 1
  const ageDecay = Number(cfg.age_decay) || 0

  /* A live arena with defenders standing in it. */
  const checks = await post<{ planet: string; land_id: string; arena_power: number }>({
    code: 'arena.ale', scope: 'arena.ale', table: 'arenacheck', limit: 100,
  })
  let enemies: BattleFighter[] = []
  let where = ''
  let power = 0
  for (const c of checks) {
    const live = (
      await post<LiveArenaRow>({ code: 'arena.ale', scope: c.planet, table: 'livearena', limit: 100 })
    ).find((r) => String(r.land_id) === String(c.land_id))
    if (!live?.fighters.length) continue
    enemies = applyArenaPower(
      live.fighters.map((f) => fieldedStats(f, f.level, f.creation_date, levelMod, ageDecay)),
      Number(c.arena_power),
    )
    where = `${c.planet}/${c.land_id}`
    power = Number(c.arena_power)
    break
  }
  if (!enemies.length) throw new Error('no live arena with defenders')

  /* A real roster, and the cards a real wallet could field. */
  const WALLET = '5thba.wam'
  const owner = nameToUint64(WALLET)
  const roster = await post<RosterFighter>({
    code: 'fighters.ale', scope: 'fighters.ale', table: 'fighters',
    index_position: 2, key_type: 'i128',
    lower_bound: (owner << 64n).toString(),
    upper_bound: ((owner << 64n) | 0xffffffffffffffffn).toString(),
  })
  const nftRows = await post<NftValue>({
    code: 'fighters.ale', scope: 'fighters.ale', table: 'nftvalues',
  })
  const values = new Map(nftRows.map((r) => [r.template_id, r]))
  const crewCards = nftRows.filter((r) => r.type === 'crew.worlds')
  const weaponCards = nftRows.filter((r) => r.type === 'arms.worlds')

  /* Fielded by the screen's own auto-pick, so this is a team it would offer. */
  const matchups = matchupsFor(roster, enemies, levelMod, ageDecay)
  const pick = autoPickTeam({
    roster, matchups, enemies, teamSize: TEAM_SIZE,
    crewCards, weaponCards, values,
  })
  const byId = new Map(roster.map((f) => [f.fighter_id, f]))
  const picked = pick.fighterIds.map((id) => byId.get(id)!).filter(Boolean)

  const myFielded = picked.map((f) => {
    const factor = levelFactor(f.stats.level, levelMod) * ageFactor(f.creation_date, ageDecay)
    return {
      health: Math.trunc(mid(f.stats.health_min, f.stats.health_max) * factor),
      damage: Math.trunc(mid(f.stats.damage_min, f.stats.damage_max) * factor),
    }
  })

  const myFlat: FlatFighter[] = picked.map((f, i) => ({
    element: f.element, classname: f.classname, racename: f.racename,
    damage: myFielded[i].damage, health: myFielded[i].health,
    attackspeed: mid(f.stats.attackspeed_min, f.stats.attackspeed_max),
    taunt: mid(f.stats.taunt_min, f.stats.taunt_max),
    initiative: mid(f.stats.initiative_min, f.stats.initiative_max),
    res_gem: f.stats.res_gem, res_metal: f.stats.res_metal, res_air: f.stats.res_air,
    res_fire: f.stats.res_fire, res_nature: f.stats.res_nature,
    res_neutral: f.stats.res_neutral,
    abilities: f.stats.abilities ?? [],
  }))

  const cv = pick.crew ? values.get(pick.crew.template_id) : undefined
  const wv = pick.weapon ? values.get(pick.weapon.template_id) : undefined
  if (cv || wv) {
    const add = (p: (v: NftValue) => number) => (cv ? p(cv) : 0) + (wv ? p(wv) : 0)
    myFlat.push({
      element: wv?.element ?? cv?.element ?? 'neutral',
      classname: cv?.classname ?? '', racename: cv?.racename ?? '',
      damage: add((v) => v.stats.damage), health: add((v) => v.stats.health),
      attackspeed: add((v) => v.stats.attackspeed),
      taunt: add((v) => v.stats.taunt), initiative: add((v) => v.stats.initiative),
      res_gem: add((v) => v.stats.res_gem), res_metal: add((v) => v.stats.res_metal),
      res_air: add((v) => v.stats.res_air), res_fire: add((v) => v.stats.res_fire),
      res_nature: add((v) => v.stats.res_nature), res_neutral: add((v) => v.stats.res_neutral),
      abilities: [...(cv?.ability ?? []), ...(wv?.ability ?? [])],
    })
  }

  const outlook = teamOutlook(myFlat, enemies)
  const enemyFlat = enemies.map(battleAsFlat)
  const mySlots = myFlat.map((f) => matchupBetween(f, enemyFlat))
  const enemySlots = enemyFlat.map((e) => matchupBetween(e, myFlat))

  const body = renderToStaticMarkup(
    <section className="versus">
      <div className="versus__side versus__side--enemy">
        <header
          className="versus__head"
          style={{ ['--share' as string]: `${(1 - outlook.share) * 100}%` }}
        >
          <span className="versus__team">The defenders</span>
          <span className="versus__totals mono">
            {formatScaled(outlook.theirs.health)} HP ·{' '}
            {formatScaled(outlook.theirs.damage)} DMG
            <Elemental side={outlook.theirs} against={outlook.mine.bonuses} who="They" />
          </span>
        </header>
        <div className="versus__row">
          {enemies.map((f, i) => (
            <CombatCard
              key={`${f.fighter_id}-${i}`}
              element={f.element}
              classname={f.classname}
              racename={f.racename}
              level={f.level}
              health={f.health}
              damage={f.damage}
              side="enemy"
              badge={f.fighter_id === NFT_FIGHTER_ID ? 'NFT' : undefined}
              art={f.fighter_id === NFT_FIGHTER_ID ? NFT_FIGHTER_ART : undefined}
              owner={f.gamertag || f.owner}
              abilities={enemySlots[i]}
            />
          ))}
        </div>
      </div>

      <div className="versus__divider">
        <span className="versus__vs" aria-hidden="true">VS</span>
      </div>

      <div className="versus__side versus__side--mine">
        <header
          className="versus__head"
          style={{ ['--share' as string]: `${outlook.share * 100}%` }}
        >
          <span className="versus__team">
            Your team
            <span className="versus__count">{picked.length}/{TEAM_SIZE}</span>
          </span>
          <span className="versus__totals mono">
            {formatScaled(outlook.mine.health)} HP ·{' '}
            {formatScaled(outlook.mine.damage)} DMG
            <Elemental side={outlook.mine} against={outlook.theirs.bonuses} who="You" />
          </span>
        </header>
        <div className="versus__row">
          {picked.map((f, i) => (
            <CombatCard
              key={f.fighter_id}
              element={f.element}
              classname={f.classname}
              racename={f.racename}
              level={f.stats.level}
              health={myFielded[i].health}
              damage={myFielded[i].damage}
              side="mine"
              abilities={mySlots[i]}
            />
          ))}
        </div>
      </div>
    </section>,
  )

  const html = `<!doctype html>
<meta charset="utf-8">
<title>Arena versus</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 24px; background: #05101e; font-family: var(--font-body); color: var(--text); }
  .versus { max-width: 900px; }
</style>
${body}
`
  writeFileSync(new URL('../.ssr/arena-versus.html', import.meta.url), html)

  console.log(`arena ${where}, power ${(power / 100).toFixed(0)}%`)
  console.log(
    `  defenders  ${formatScaled(outlook.theirs.health)} HP · ${formatScaled(outlook.theirs.damage)} DMG` +
    `  land ${Math.round(outlook.theirs.landShare * 100)}%  block ${Math.round(outlook.theirs.blockShare * 100)}%` +
    `  bonuses ${outlook.theirs.bonuses}`,
  )
  console.log(
    `  your team  ${formatScaled(outlook.mine.health)} HP · ${formatScaled(outlook.mine.damage)} DMG` +
    `  land ${Math.round(outlook.mine.landShare * 100)}%  block ${Math.round(outlook.mine.blockShare * 100)}%` +
    `  bonuses ${outlook.mine.bonuses}`,
  )
  console.log(`  balance    you ${(outlook.share * 100).toFixed(0)}%`)
  console.log(`  card badges: ${mySlots.filter((m) => m.bonuses > 0).length} of yours firing, ` +
    `${enemySlots.filter((m) => m.bonuses > 0).length} of theirs`)
  console.log('wrote .ssr/arena-versus.html')
}

main().catch((e) => {
  console.error('render threw:', e)
  process.exitCode = 1
})
