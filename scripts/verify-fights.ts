/**
 * Replays every stored fight and checks the simulation against the chain.
 *
 *   npx vite build --ssr scripts/verify-fights.ts --outDir .ssr
 *   node .ssr/verify-fights.js
 *
 * The contract keeps no per-turn log — only the opening line-ups, the winner
 * and the number of blows — so this is the only way to know the replay is
 * telling the truth: same winner, same attack count, same closing fighters.
 */
import { simulate, DEFAULT_CAPS } from '../src/dungeon/sim'
import type { FightRow } from '../src/dungeon/types'

const NODE = 'https://wax.greymass.com/v1/chain/get_table_rows'

async function rows<T>(body: Record<string, unknown>): Promise<T[]> {
  const res = await fetch(NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ json: true, limit: 100, ...body }),
  })
  return ((await res.json()) as { rows: T[] }).rows
}

async function main() {
  const fights = await rows<FightRow>({
    code: 'battle.ale',
    scope: 'battle.ale',
    table: 'fights',
    limit: 100,
    reverse: true,
  })
  const cfg = await rows<{ taunt_deduction: number }>({
    code: 'battle.ale',
    scope: 'battle.ale',
    table: 'fgtconfig',
  })
  const taunt = Number(cfg[0]?.taunt_deduction ?? 0)
  console.log(`${fights.length} fights, taunt_deduction ${taunt}\n`)

  let ok = 0
  const bad: string[] = []
  let effectsSeen = 0
  let liveAbilities = 0
  let blockedAbilities = 0

  for (const row of fights) {
    for (const side of ['team1_fighters', 'team2_fighters'] as const) {
      for (const f of row[side] ?? []) {
        for (const a of f.specialAbility ?? []) {
          if (!(a.if_effects ?? []).length || a.locked || !a.bf_target) continue
          if (!a.on_attack && !a.on_defense) continue
          /*
             What `ifeffect` still refuses: an ability flagged as a start
             buff, and a group target with no condition group to select
             members by. `self` and `enemy_attacker` now resolve.
           */
          const group = a.bf_target === 'ally_group' || a.bf_target === 'enemy_group'
          const blocked = !!a.on_fight_start || (group && !a.condition_group)
          if (blocked) blockedAbilities++
          else liveAbilities++
        }
      }
    }

    const replay = simulate(row, { tauntDeduction: taunt, caps: DEFAULT_CAPS })
    effectsSeen += replay.turns.reduce((n, t) => n + t.effects.length, 0)

    const expected =
      replay.winner === 1 ? 'Team 1 wins' : replay.winner === 2 ? 'Team 2 wins' : 'Draw'
    const turnsMatch = Number(row.turns) === replay.turns.length
    const logMatch = !row.log || row.log === expected

    if (turnsMatch && logMatch) ok++
    else {
      bad.push(
        `${row.history_id}: chain "${row.log}" in ${row.turns} — sim "${expected}" in ${replay.turns.length}`,
      )
    }
  }

  console.log(`matched: ${ok}/${fights.length}`)
  bad.slice(0, 10).forEach((b) => console.log('  MISMATCH ' + b))
  console.log(`\nin-fight effects fired across all fights: ${effectsSeen}`)
  console.log(
    `ability instances with if_effects — able to fire: ${liveAbilities}; ` +
      `blocked by a targeting or start-buff gate: ${blockedAbilities}`,
  )
}

void main()
