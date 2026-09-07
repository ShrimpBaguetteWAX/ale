/**
 * Record the chain responses the smoke test answers with.
 *
 * Only the config tables — the ones that are the same for every player and
 * that every screen scales its numbers by. Player-scoped reads are answered
 * with an empty result instead, deliberately: a screen that cannot cope with
 * a wallet that owns nothing is a screen with a bug, and that is exactly what
 * the smoke test is for.
 *
 *   node scripts/record-fixtures.mjs
 *
 * Re-run when a config table's shape changes on chain. The recorded values
 * are not asserted on, so they going stale costs nothing until then.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'src', 'test', 'fixtures')

const NODE = 'https://wax.greymass.com'

/*
 * Every self-scoped table in the app — `code === scope`, which is what a
 * config table looks like here. Taken from the source rather than guessed:
 *
 *   grep -rho "code: CONTRACTS.\w*, scope: CONTRACTS.\w*, table: '[a-z]*'"
 */
const TABLES = [
  ['arena.ale', 'config'],
  ['arena.ale', 'lbscopes'],
  ['ascend.ale', 'asccats'],
  ['ascend.ale', 'config'],
  ['battle.ale', 'config'],
  ['battle.ale', 'difmod'],
  ['battle.ale', 'fgtconfig'],
  ['recovery.ale', 'config'],
  ['recovery.ale', 'offers'],
  ['recovery.ale', 'tracking'],
  ['cpu.ale', 'config'],
  ['creation.ale', 'classtemps'],
  ['dungeons.ale', 'config'],
  ['farm.ale', 'config'],
  ['farm.ale', 'poolconfig'],
  ['farm.ale', 'pools'],
  ['farm.ale', 'stakeweight'],
  ['fighters.ale', 'config'],
  ['fighters.ale', 'levels'],
  ['fighters.ale', 'nftvalues'],
  ['lands.ale', 'config'],
  ['market.ale', 'config'],
  ['players.ale', 'config'],
  ['pools.ale', 'shardpools'],
  ['pools.ale', 'tlmpools'],
  ['pools.ale', 'templatemp'],
  ['quests.ale', 'config'],
  ['quests.ale', 'qscopes'],
  ['rwrdlog.ale', 'config'],
  ['rwrdlog.ale', 'pooldesc'],
  ['shop.ale', 'shopitems'],
  ['tavern.ale', 'config'],
  ['tavern.ale', 'nfttemplates'],
].map(([code, table]) => [code, code, table])

const out = {}

for (const [code, scope, table] of TABLES) {
  const body = { json: true, limit: 100, code, scope, table }
  const res = await fetch(`${NODE}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(`skip ${code}/${table}: HTTP ${res.status}`)
    continue
  }
  const data = await res.json()
  out[`${code}/${table}`] = data
  console.log(`ok   ${code}/${table}  (${(data.rows ?? []).length} rows)`)
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'tables.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`wrote ${Object.keys(out).length} tables`)
