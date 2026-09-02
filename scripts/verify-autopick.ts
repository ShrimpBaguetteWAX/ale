/**
 * Pins auto-pick against a live roster and a live opponent.
 *
 *   npx vite build --ssr scripts/verify-autopick.ts --outDir .ssr
 *   node .ssr/verify-autopick.js
 *
 * The dungeon and the arena now share one auto-pick. The properties worth
 * holding it to are the ones a player would notice going wrong: it never
 * fields a fighter the contract would refuse, it fields the five the badges
 * rank highest, and the crew-and-weapon pair it lands on is at least as good
 * against *this* opponent as taking the heaviest card in each slot — which is
 * what both screens used to do, and what makes the pairing loop worth its
 * cost.
 *
 * Run against a real roster and a real arena line rather than fixtures: the
 * pairing is only interesting when the cards have elements and abilities that
 * disagree with each other, and inventing that is how you write a test that
 * passes on data nobody has.
 */
import { autoPickTeam } from '../src/fight/autopick'
import { flatMatchup, matchupsFor } from '../src/fight/matchup'
import { applyArenaPower } from '../src/arena/rules'
import { fieldedStats } from '../src/fight/scaling'
import { fighterAvailable } from '../src/dungeon/rules'
import type { LiveArenaRow } from '../src/arena/queries'
import type { NftValue } from '../src/dungeon/nftFighter'
import type { BattleFighter, RosterFighter } from '../src/dungeon/types'

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

const TEAM_SIZE = 5

const post = async (b: Record<string, unknown>) =>
  (
    await fetch('https://wax.greymass.com/v1/chain/get_table_rows', {
      method: 'POST',
      /* text/plain dodges the CORS preflight the node does not answer. */
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ json: true, limit: 1000, ...b }),
    })
  ).json() as Promise<{ rows: Record<string, never>[]; more: boolean }>

/** `name_to_uint64`, so the roster can be read off the owner index. */
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

/** The heaviest card in each slot, which is what both screens used to take. */
function heaviestPair(
  crewCards: { template_id: number }[],
  weaponCards: { template_id: number }[],
  values: Map<number, NftValue>,
) {
  const bulk = (c: { template_id: number }) => {
    const v = values.get(c.template_id)
    return (v?.stats.damage ?? 0) + (v?.stats.health ?? 0)
  }
  const top = (cards: { template_id: number }[]) =>
    [...cards].sort((a, b) => bulk(b) - bulk(a))[0] ?? null
  return { crew: top(crewCards), weapon: top(weaponCards) }
}

/** A crew/weapon pair scored the way the fight will read it. */
function pairScore(
  crew: { template_id: number } | null,
  weapon: { template_id: number } | null,
  values: Map<number, NftValue>,
  enemies: BattleFighter[],
): number {
  const cv = crew ? values.get(crew.template_id) : undefined
  const wv = weapon ? values.get(weapon.template_id) : undefined
  if (!cv || !wv) return -1
  const add = (pick: (v: NftValue) => number) => pick(cv) + pick(wv)
  return flatMatchup(
    {
      element: wv.element,
      damage: add((v) => v.stats.damage),
      health: add((v) => v.stats.health),
      attackspeed: add((v) => v.stats.attackspeed),
      res_gem: add((v) => v.stats.res_gem),
      res_metal: add((v) => v.stats.res_metal),
      res_air: add((v) => v.stats.res_air),
      res_fire: add((v) => v.stats.res_fire),
      res_nature: add((v) => v.stats.res_nature),
      res_neutral: add((v) => v.stats.res_neutral),
      abilities: [...(cv.ability ?? []), ...(wv.ability ?? [])],
    },
    enemies,
  ).score
}

async function main(): Promise<void> {
  const cfg = (
    await post({ code: 'battle.ale', scope: 'battle.ale', table: 'config', limit: 1 })
  ).rows[0] as Record<string, string>
  const levelMod = Number(cfg.level_mod) || 1
  const ageDecay = Number(cfg.age_decay) || 0

  /* A wallet with enough fighters that the ranking has something to say. */
  const WALLET = '5thba.wam'
  const owner = nameToUint64(WALLET)
  const roster = (
    await post({
      code: 'fighters.ale',
      scope: 'fighters.ale',
      table: 'fighters',
      index_position: 2,
      key_type: 'i128',
      lower_bound: (owner << 64n).toString(),
      upper_bound: ((owner << 64n) | 0xffffffffffffffffn).toString(),
    })
  ).rows as unknown as RosterFighter[]

  const nftRows = (
    await post({ code: 'fighters.ale', scope: 'fighters.ale', table: 'nftvalues' })
  ).rows as unknown as NftValue[]
  const values = new Map(nftRows.map((r) => [r.template_id, r]))

  /*
     Every card in the table, split by what it is. The real screens only offer
     what the player owns; auto-pick does not care where the list came from,
     and the whole table is a harder pairing problem than any one wallet.
  */
  const crewCards = nftRows.filter((r) => r.type === 'crew.worlds').map((r) => ({ template_id: r.template_id }))
  const weaponCards = nftRows.filter((r) => r.type === 'arms.worlds').map((r) => ({ template_id: r.template_id }))

  console.log('\nwhat came off the chain')
  check('the roster has fighters', roster.length > 0, true)
  check('there are crew cards', crewCards.length > 0, true)
  check('there are weapon cards', weaponCards.length > 0, true)
  console.log(
    `  (${roster.length} fighters, ${crewCards.length} crew, ${weaponCards.length} weapons)`,
  )

  /* --- a live arena line --- */
  const checks = (
    await post({ code: 'arena.ale', scope: 'arena.ale', table: 'arenacheck', limit: 100 })
  ).rows as unknown as { planet: string; land_id: string; arena_power: number }[]

  let enemies: BattleFighter[] = []
  let where = ''
  for (const c of checks) {
    const rows = (
      await post({ code: 'arena.ale', scope: c.planet, table: 'livearena', limit: 100 })
    ).rows as unknown as LiveArenaRow[]
    const live = rows.find((r) => String(r.land_id) === String(c.land_id))
    if (!live?.fighters.length) continue
    enemies = applyArenaPower(
      live.fighters.map((f) => fieldedStats(f, f.level, f.creation_date, levelMod, ageDecay)),
      Number(c.arena_power),
    )
    where = `${c.planet}/${c.land_id}`
    break
  }
  check('a live arena line was found', enemies.length > 0, true)
  console.log(`  (${where}: ${enemies.length} defenders)`)

  const matchups = matchupsFor(roster, enemies, levelMod, ageDecay)
  const pick = autoPickTeam({
    roster,
    matchups,
    enemies,
    teamSize: TEAM_SIZE,
    crewCards,
    weaponCards,
    values,
  })

  console.log('\nthe team it fields')
  check('five fighters, not four and not six', pick.fighterIds.length, TEAM_SIZE)
  check('no duplicates', new Set(pick.fighterIds).size, TEAM_SIZE)

  /*
     The contract refuses a fighter that is on the market, defending an arena
     or waiting on a payday. Fielding one produces a Start button that will
     not light up and no explanation on the screen.
  */
  const byId = new Map(roster.map((f) => [f.fighter_id, f]))
  const allAvailable = pick.fighterIds.every((id) => fighterAvailable(byId.get(id)!).available)
  check('every fighter it picked can actually be fielded', allAvailable, true)

  /* The five the badges rank highest, which is what makes the picks auditable. */
  const ranked = roster
    .filter((f) => fighterAvailable(f).available)
    .sort(
      (a, b) =>
        (matchups.get(b.fighter_id)?.score ?? 0) - (matchups.get(a.fighter_id)?.score ?? 0) ||
        a.fighter_id - b.fighter_id,
    )
  check(
    'and they are the five the badges rank highest',
    pick.fighterIds,
    ranked.slice(0, TEAM_SIZE).map((f) => f.fighter_id),
  )

  console.log('\nthe pair it lands on')
  const mine = pairScore(pick.crew, pick.weapon, values, enemies)
  const naive = heaviestPair(crewCards, weaponCards, values)
  const theirs = pairScore(naive.crew, naive.weapon, values, enemies)
  check('it chose a crew card', pick.crew !== null, true)
  check('it chose a weapon card', pick.weapon !== null, true)
  /*
     The point of pairing. Taking the heaviest of each is a defensible guess;
     it is also how you hand a resistant opponent 60% off your sixth fighter,
     because the weapon alone decides the element both cards attack with.
  */
  check('and the pair beats the heaviest-of-each guess', mine >= theirs, true)
  console.log(`  (paired ${mine.toFixed(0)} vs heaviest-of-each ${theirs.toFixed(0)})`)

  console.log('\nwith nothing to rank against')
  const blind = autoPickTeam({
    roster,
    matchups: new Map(),
    enemies: [],
    teamSize: TEAM_SIZE,
    crewCards,
    weaponCards,
    values,
  })
  /*
     Before the opponent has loaded there is no matchup to sort on. Picking
     nothing would be the honest answer and the useless one, so it falls back
     to the heaviest card in each slot.
  */
  check('it still fields a full team', blind.fighterIds.length, TEAM_SIZE)
  check('and still fills both card slots', !!blind.crew && !!blind.weapon, true)

  console.log('\na smaller roster than the team it is asked for')
  const two = roster.filter((f) => fighterAvailable(f).available).slice(0, 2)
  const short = autoPickTeam({
    roster: two,
    matchups,
    enemies,
    teamSize: TEAM_SIZE,
    crewCards,
    weaponCards,
    values,
  })
  check('it fields what there is rather than repeating one', short.fighterIds.length, two.length)

  console.log('\n' + (fail === 0 ? `all ${pass} cases passed` : `${fail} FAILED`))
  if (fail) process.exitCode = 1
}

void main()
