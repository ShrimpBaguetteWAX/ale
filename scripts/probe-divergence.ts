/**
 * Which stored fights the contract change should move, and which it should not.
 *
 *   npx vite build --ssr scripts/probe-divergence.ts --outDir .ssr
 *   node .ssr/probe-divergence.js
 *
 * Every fight in `battle.ale/fights` was fought under the *old* rules, so a
 * replay under the new ones is only expected to agree where nothing the change
 * touched was present. This cross-checks the two sets: a fight that diverges
 * without carrying an affected ability would be a real bug, and so would one
 * that carries several and still lands on the same turn count.
 */
import { simulate, DEFAULT_CAPS } from '../src/dungeon/sim'
import type { FightRow, BattleFighter } from '../src/dungeon/types'

const NODE = 'https://wax.greymass.com/v1/chain/get_table_rows'

async function rows<T>(body: Record<string, unknown>): Promise<T[]> {
  const res = await fetch(NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ json: true, limit: 100, ...body }),
  })
  return ((await res.json()) as { rows: T[] }).rows
}

/** What the four rule changes can reach. */
function affected(row: FightRow): string[] {
  const found = new Set<string>()
  const sides = ['team1_fighters', 'team2_fighters'] as const
  for (const side of sides) {
    for (const f of (row[side] ?? []) as BattleFighter[]) {
      for (const a of f.specialAbility ?? []) {
        if (a.locked) continue
        if (Number(a.ignore_res_percent ?? 0) > 0 && a.on_attack) {
          found.add('ignore_res_percent')
        }
        if (!a.bf_target || a.on_fight_start) continue
        if (!a.on_attack && !a.on_defense) continue
        for (const e of a.if_effects ?? []) {
          const stat = String(e.stat_name ?? '')
          if (stat !== 'health' && stat !== 'health_atk') continue
          // A negative health effect could not kill before; a positive one was
          // reduced by resistance and could overheal past max_health.
          found.add(Number(e.value) < 0 ? `${stat} (damage)` : `${stat} (heal)`)
        }
      }
    }
  }
  return [...found].sort()
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
  const tauntDeduction = Number(cfg[0]?.taunt_deduction ?? 0)

  let explained = 0
  let unexplained = 0
  let quietlyAffected = 0

  console.log(`${fights.length} stored fights, replayed under the new rules\n`)

  for (const row of fights) {
    const replay = simulate(row, { tauntDeduction, caps: DEFAULT_CAPS })
    const tags = affected(row)
    const diverged = !replay.matchesChain

    if (diverged && tags.length) {
      explained++
      console.log(
        `  moved     ${row.history_id}  chain ${row.turns} -> sim ${replay.turns.length}  [${tags.join(', ')}]`,
      )
    } else if (diverged) {
      unexplained++
      console.log(
        `  UNEXPLAINED ${row.history_id}  chain "${row.log}" in ${row.turns} -> sim in ${replay.turns.length}  [no affected ability]`,
      )
    } else if (tags.length) {
      quietlyAffected++
    }
  }

  console.log(
    `\nmoved and explained by an affected ability: ${explained}` +
      `\nmoved with nothing to explain it:          ${unexplained}` +
      `\nunmoved though an ability was present:     ${quietlyAffected}` +
      `\nunmoved and untouched:                     ${fights.length - explained - unexplained - quietlyAffected}`,
  )
  console.log(
    unexplained === 0
      ? '\nevery divergence is accounted for by the rule change'
      : `\n${unexplained} divergence(s) NOT accounted for - investigate`,
  )
}

main()
