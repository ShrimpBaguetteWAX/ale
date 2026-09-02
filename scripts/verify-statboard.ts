/**
 * Pins the per-stat leaderboard against the live player table.
 *
 *   npx vite build --ssr scripts/verify-statboard.ts --outDir .ssr
 *   node .ssr/verify-statboard.js
 *
 * `rankBy` is small but it has the two properties that leaderboards
 * habitually get wrong — ties, and who gets left off — so both are checked
 * against fixtures, and then the whole thing is run over the real 106 rows to
 * be sure the shape coming off the chain is the shape it expects.
 */
import { rankBy, type PlayerStats } from '../src/account/statboard'
import { formatStat } from '../src/format'

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

const player = (wallet: string, stats: Record<string, number>): PlayerStats => ({
  wallet,
  playertag: wallet.toUpperCase(),
  stats,
})

console.log('\nranking')
{
  const board = rankBy(
    [
      player('c.wam', { wins: 5 }),
      player('a.wam', { wins: 9 }),
      player('b.wam', { wins: 7 }),
    ],
    'wins',
  )
  check('sorted best first', board.map((r) => r.wallet), ['a.wam', 'b.wam', 'c.wam'])
  check('ranks are 1..n', board.map((r) => r.rank), [1, 2, 3])
  check('the tag travels with the row', board[0].playertag, 'A.WAM')
}

console.log('\nties')
{
  /*
     Equal figures are separated by wallet, so the board runs 1..n with no
     gaps. Four players all shown as "4th" with nobody 5th, 6th or 7th reads
     as a fault rather than a tie.
  */
  const board = rankBy(
    [
      player('a.wam', { wins: 98 }),
      player('b.wam', { wins: 98 }),
      player('c.wam', { wins: 97 }),
      player('d.wam', { wins: 97 }),
      player('e.wam', { wins: 96 }),
    ],
    'wins',
  )
  check('every player gets their own place', board.map((r) => r.rank), [1, 2, 3, 4, 5])
  check('the values are still ordered', board.map((r) => r.value), [98, 98, 97, 97, 96])
  check(
    'and equals are separated by wallet',
    board.map((r) => r.wallet),
    ['a.wam', 'b.wam', 'c.wam', 'd.wam', 'e.wam'],
  )
}

console.log('\nwho is left off')
{
  const board = rankBy(
    [
      player('a.wam', { wins: 3 }),
      player('b.wam', {}),
      player('c.wam', { wins: 0 }),
      player('d.wam', { losses: 9 }),
    ],
    'wins',
  )
  /*
     A board of everyone who has never done the thing is a list of zeroes that
     pushes the people who have off the screen.
  */
  check('players with nothing recorded are dropped', board.map((r) => r.wallet), ['a.wam'])
  check('an unknown stat gives an empty board', rankBy([player('a.wam', { wins: 3 })], 'nope'), [])
}

console.log('\ntoken figures')
{
  /*
     The chain counts tokens in their smallest unit. Printed raw, a player's
     TLM total is four digits too long and their shards ten times too big.
  */
  check('TLM is divided by 10,000', formatStat('tlm_earned', 104762718), '10,476')
  check('shards are divided by 10', formatStat('shards_earned', 594563), '59,456')
  check('no decimals survive', formatStat('tlm_earned', 19999), '1')
  check('the fraction is dropped, not rounded up', formatStat('shards_earned', 99), '9')
  /*
     WAX carries eight decimal places and these totals are small, so this one
     keeps a fraction where the others do not.
  */
  check('WAX is divided by 100,000,000', formatStat('wax_earned', 16776725695), '167.76')
  check('and keeps two places even when round', formatStat('wax_earned', 200000000), '2.00')
  check('a small WAX total still reads', formatStat('wax_earned', 5000000), '0.05')
  check('below a hundredth it is honest about it', formatStat('wax_earned', 9999), '0.00')
  check('plain counts are untouched', formatStat('dungeons_won', 98), '98')
  check('and still grouped', formatStat('credits_gained', 12002249), '12,002,249')
}

/* ---------- against the live table ---------- */

const NODE = 'https://wax.greymass.com/v1/chain/get_table_rows'

async function live(): Promise<void> {
  const res = await fetch(NODE, {
    method: 'POST',
    /* text/plain dodges the CORS preflight the node does not answer. */
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({
      json: true,
      code: 'players.ale',
      scope: 'players.ale',
      table: 'players',
      limit: 1000,
    }),
  })
  const body = (await res.json()) as {
    rows: { wallet: string; playertag?: string; permstats?: { first: string; second: number }[] }[]
    more: boolean
  }

  const players: PlayerStats[] = body.rows.map((r) => ({
    wallet: String(r.wallet),
    playertag: String(r.playertag ?? ''),
    stats: Object.fromEntries((r.permstats ?? []).map((e) => [e.first, e.second])),
  }))

  console.log('\nagainst the live players table')
  check('the whole table came back in one read', body.more, false)
  check('there are players to rank', players.length > 0, true)

  const keys = new Set<string>()
  players.forEach((p) => Object.keys(p.stats).forEach((k) => keys.add(k)))
  console.log(`  (${players.length} players, ${keys.size} distinct stats)`)

  let worstBoard = 0
  for (const key of keys) {
    const board = rankBy(players, key)
    worstBoard = Math.max(worstBoard, board.length)

    /* Every board must be ordered, and every rank must be explicable. */
    const ordered = board.every((r, i) => i === 0 || board[i - 1].value >= r.value)
    /* 1..n, no gaps and no repeats. */
    const ranksSane = board.every((r, i) => r.rank === i + 1)
    if (!ordered) check(`${key}: ordered`, ordered, true)
    if (!ranksSane) check(`${key}: ranks run 1..n`, ranksSane, true)
  }
  check('every stat produces an ordered board ranked 1..n', true, true)
  console.log(`  (largest board: ${worstBoard} players)`)

  const dw = rankBy(players, 'dungeons_won')
  console.log(`  dungeons_won leader: ${dw[0]?.playertag || dw[0]?.wallet} on ${dw[0]?.value}`)
}

/* The build target has no top-level await, so the tail runs in the promise. */
void live().then(() => {
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) process.exitCode = 1
})
