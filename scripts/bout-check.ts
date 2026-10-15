/**
 * Does the broadcast's model of a tournament fight agree with the chain?
 *
 *   npx vite-node scripts/bout-check.ts <tournament_name> <round> <index>
 *
 * Runs the app's own simulator over the matchup row two ways — as the
 * broadcast seeds it today, and as `battle::fight` seeds it — and prints
 * the winner each way beside the winner the chain recorded. Reads only.
 */
import { simulate } from '../src/dungeon/sim'
import { simulateBout } from '../src/tournament/bout'
import { fieldInRing, nftAsFighter, rollFighter } from '../src/fight/odds'
import { fetchFightersByIds, fetchTournamentMatchups } from '../src/tournament/queries'
import { fetchWeatherRow, type Weather } from '../src/fight/weather'
import { combineNftFlat } from '../src/dungeon/nftFighter'
import { useConfigStore } from '../src/state/useConfig'
import { getRows } from '../src/chain/client'
import { fetchFightConfig } from '../src/dungeon/queries'
import type { BattleFighter, FightRow, RosterFighter } from '../src/dungeon/types'
import type { TournamentStage } from '../src/tournament/types'

const [name = '......3esfaa', roundArg = '2', indexArg = '0'] = process.argv.slice(2)
const round = Number(roundArg)
const index = Number(indexArg)

async function main() {
  await useConfigStore.getState().load()
  const { caps, levelMod, ageDecay, nftValues } = useConfigStore.getState()
  const taunt = await fetchFightConfig()

  const stage = (
    await getRows<TournamentStage>({ code: 'tournmnt.ale', scope: 'tournmnt.ale', table: 'curstage', limit: 10 })
  ).rows.find((s) => s.tournament_name === name)
  if (!stage) throw new Error('no curstage row for ' + name)

  const weather = (
    await Promise.all(stage.weather_effects.map((w) => fetchWeatherRow(w.planet, w.weather_id)))
  ).filter((w): w is Weather => !!w)

  const m = (await fetchTournamentMatchups(name, round)).find((x) => Number(x.index) === index)
  if (!m) throw new Error('no matchup')
  const [one, two] = await Promise.all([
    fetchFightersByIds(m.fighter_ids_player1),
    fetchFightersByIds(m.fighter_ids_player2),
  ])
  const nft1 = combineNftFlat(nftValues.get(m.crew_template_id_player1) ?? null, nftValues.get(m.arms_template_id_player1) ?? null)
  const nft2 = combineNftFlat(nftValues.get(m.crew_template_id_player2) ?? null, nftValues.get(m.arms_template_id_player2) ?? null)
  const now = Date.now()
  const seed = Number(m.matchup_seed)

  const build = (fighters: RosterFighter[], nft: typeof nft1, start: number) => {
    const team: BattleFighter[] = fighters.map((f, slot) => rollFighter(f, start, slot))
    const ages = fighters.map((f) => f.creation_date)
    if (nft) {
      const sixth = nftAsFighter(nft, now)
      team.push(sixth)
      ages.push(sixth.creation_date)
    }
    return { team, ages }
  }

  const run = (label: string, startB: number, building: string | undefined) => {
    const a = build(one, nft1, seed)
    const b = build(two, nft2, startB)
    const row: FightRow = {
      history_id: '', wallet: '', team1_fighters: a.team, team2_fighters: b.team,
      log: '', turns: 0, reward_power_added: [], reward_power_total: [], timestamp: '',
    }
    const replay = simulate(row, {
      tauntDeduction: taunt ?? 0,
      caps,
      building,
      prepare: (t1, t2) => {
        t1.forEach((f, i) => fieldInRing(f, a.ages[i], 0, { weather, caps, levelMod, ageDecay }, now))
        t2.forEach((f, i) => fieldInRing(f, b.ages[i], 0, { weather, caps, levelMod, ageDecay }, now))
      },
    })
    console.log(label.padEnd(44), 'winner', replay.winner === 1 ? 'player1' : replay.winner === 2 ? 'player2' : 'draw', 'turns', replay.turns.length)
  }

  console.log(`${m.gamertag_player1} (player1) vs ${m.gamertag_player2} (player2) · seed ${seed} · chain says ${m.winner}`)
  console.log('weather:', weather.map((w) => w.displayname).join(' | '), '· taunt deduction', taunt)
  run('app today: side B at seed+1, building=dungeon', seed + 1, undefined)
  run('side B at seed+1, no building', seed + 1, '')
  run('contract: side B continues at seed+50', seed + 10 * one.length, '')
  run('contract seeding, building=dungeon', seed + 10 * one.length, undefined)
  const bout = simulateBout(seed, { fighters: one, nft: nft1 }, { fighters: two, nft: nft2 }, { weather, caps, levelMod, ageDecay }, taunt ?? 0, now)
  console.log('simulateBout, as the broadcast runs it'.padEnd(44), 'winner', bout?.winner === 1 ? 'player1' : bout?.winner === 2 ? 'player2' : 'draw', 'turns', bout?.turns.length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
