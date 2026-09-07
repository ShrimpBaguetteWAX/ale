import { describe, expect, it, beforeEach } from 'vitest'
import { cacheGet, cacheSet, TTL } from '@/chain/cache'
import { TABLES, cacheDropTable, type TableKey } from '@/chain/tables'

/**
 * That a table key drops what it claims to.
 *
 * This is the test the whole phase turns on. `cacheDropTable` names a table
 * and the cache stores a read under a key the client builds — if the two
 * disagree by one character, nothing throws, nothing fails to compile, and
 * the only symptom is data that never refreshes after an action. Which looks
 * exactly like the bug the invalidation is meant to fix.
 *
 * So the keys here are built the way `chain/client` builds them, and the
 * agreement is asserted rather than assumed.
 */

/** `keyOf` in `chain/client.ts`, which is private to it. */
function cacheKey(kind: 'rows' | 'all', q: {
  code: string
  scope: string
  table: string
  lower_bound?: string
  limit?: number
}): string {
  return `${kind}:${[
    q.code,
    q.scope,
    q.table,
    q.lower_bound ?? '',
    '',
    q.limit ?? '',
    '',
    '',
    '',
  ].join('|')}`
}

beforeEach(() => {
  /* Every key this file writes, gone — the store is module-level. */
  for (const key of Object.keys(TABLES) as TableKey[]) cacheDropTable(key)
})

describe('cacheDropTable', () => {
  it('drops a read of the table it names', () => {
    const { code, table } = TABLES.player
    const key = cacheKey('rows', { code, scope: code, table })

    cacheSet(key, { rows: ['before'] }, TTL.long)
    expect(cacheGet(key)).toBeDefined()

    cacheDropTable('player')
    expect(cacheGet(key)).toBeUndefined()
  })

  it('leaves every other table alone', () => {
    const player = cacheKey('rows', {
      code: TABLES.player.code,
      scope: TABLES.player.code,
      table: TABLES.player.table,
    })
    const fighters = cacheKey('rows', {
      code: TABLES.fighters.code,
      scope: TABLES.fighters.code,
      table: TABLES.fighters.table,
    })

    cacheSet(player, { rows: [] }, TTL.long)
    cacheSet(fighters, { rows: [] }, TTL.long)

    cacheDropTable('player')

    expect(cacheGet(player)).toBeUndefined()
    expect(cacheGet(fighters)).toBeDefined()
  })

  it('drops every scope when given none', () => {
    const { code, table } = TABLES.lands
    const kavian = cacheKey('rows', { code, scope: 'kavian', table })
    const magor = cacheKey('rows', { code, scope: 'magor', table })

    cacheSet(kavian, { rows: [] }, TTL.long)
    cacheSet(magor, { rows: [] }, TTL.long)

    cacheDropTable('lands')

    expect(cacheGet(kavian)).toBeUndefined()
    expect(cacheGet(magor)).toBeUndefined()
  })

  it('drops one scope when given one, which is what building on a land does', () => {
    const { code, table } = TABLES.lands
    const kavian = cacheKey('rows', { code, scope: 'kavian', table })
    const magor = cacheKey('rows', { code, scope: 'magor', table })

    cacheSet(kavian, { rows: [] }, TTL.long)
    cacheSet(magor, { rows: [] }, TTL.long)

    cacheDropTable('lands', 'kavian')

    expect(cacheGet(kavian)).toBeUndefined()
    /* The whole point of the scope argument: five other planets' land rows
       are still good, and re-reading them would be five requests for nothing. */
    expect(cacheGet(magor)).toBeDefined()
  })

  it('drops both shapes the client writes', () => {
    const { code, table } = TABLES.fighters
    const rows = cacheKey('rows', { code, scope: code, table, limit: 100 })
    const all = cacheKey('all', { code, scope: code, table })

    cacheSet(rows, { rows: [] }, TTL.long)
    cacheSet(all, [], TTL.long)

    cacheDropTable('fighters')

    expect(cacheGet(rows)).toBeUndefined()
    expect(cacheGet(all)).toBeUndefined()
  })

  it('does not match a table whose name merely starts the same', () => {
    /*
       `player` and `players` would both survive a `startsWith`, which is why
       the match is on the key's parts. A near-miss here is the failure this
       whole file exists to make loud.
    */
    const { code } = TABLES.player
    const other = cacheKey('rows', { code, scope: code, table: 'playerstats' })

    cacheSet(other, { rows: [] }, TTL.long)
    cacheDropTable('player')

    expect(cacheGet(other)).toBeDefined()
  })
})

describe('against the real client', () => {
  /*
     The check the reconstruction above cannot make.

     Every test so far builds a key the way `keyOf` builds one, from a copy of
     its rules — so a mistake shared by both passes. This one never names a
     key: it reads through the client, watches the cache serve the second
     read, drops the table, and watches the third read go back to the wire.
     If `cacheDropTable` and the client disagree about anything, the third
     read is served from cache and this fails.
  */
  it('drops what a real read cached', async () => {
    const { fetchPlayer } = await import('@/chain/queries')
    const calls = () => (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length

    await fetchPlayer('smoke.wam')
    const afterFirst = calls()
    expect(afterFirst).toBeGreaterThan(0)

    await fetchPlayer('smoke.wam')
    expect(calls(), 'the second read should have been cached').toBe(afterFirst)

    cacheDropTable('player')

    await fetchPlayer('smoke.wam')
    expect(calls(), 'the third read should have gone to the chain').toBeGreaterThan(afterFirst)
  })
})

describe('the table map', () => {
  it('names a real contract for every entry', () => {
    for (const [key, { code, table }] of Object.entries(TABLES)) {
      expect(code, `${key} has no contract`).toBeTruthy()
      expect(table, `${key} has no table`).toBeTruthy()
      /* Chain account names are at most twelve characters; a typo long
         enough to break that would otherwise read as a table nobody has. */
      expect(code.length, `${key}: ${code} is not an account name`).toBeLessThanOrEqual(13)
    }
  })

  it('is read by the app under the names it records', async () => {
    /*
       Every table here must actually be queried somewhere, or the entry is
       describing a read that does not happen and an action would be dropping
       a cache nothing fills.
    */
    const sources = import.meta.glob('/src/**/queries.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const all = Object.values(sources).join('\n')

    for (const [key, { table }] of Object.entries(TABLES)) {
      expect(all, `${key}: nothing reads '${table}'`).toContain(`table: '${table}'`)
    }
  })
})
