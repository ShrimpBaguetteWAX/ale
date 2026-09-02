/**
 * The dungeon picker's matchup controls and badges, against the real styles.
 *
 *   npx vite build --ssr scripts/ssr-matchup.tsx --outDir .ssr
 *   node .ssr/ssr-matchup.js
 *
 * A live dungeon is one line-up on one land, so the interesting cases — a
 * roster that is half useless against this element, a fighter whose abilities
 * all fire, one that blocks everything and tickles — cannot be looked at
 * without staging them. These are chosen to put one of each on screen.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { CombatCard, FighterGrid, RosterFilters } from '../src/fight/setup'
import { EMPTY_FILTER } from '../src/dungeon/filters'
import {
  battleAsFlat,
  enemyProfile,
  matchupBetween,
  matchupsFor,
} from '../src/fight/matchup'
import type { FlatFighter } from '../src/fight/matchup'
import type { BattleAbility, BattleFighter, RosterFighter } from '../src/dungeon/types'

const css = ['tokens.css', 'global.css', 'app.css', 'dungeon.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const NOW = Date.now()
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString().slice(0, 19)
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString().slice(0, 19)

/** A dungeon that resists fire heavily and attacks with fire and nature. */
const enemy = (over: Partial<BattleFighter>): BattleFighter =>
  ({
    fighter_id: 900, owner: 'dungeon', gamertag: '', avatar: '',
    health: 4000, max_health: 4000, damage: 900, taunt: 200,
    initiative: 300, attackspeed: 300,
    res_gem: 200, res_metal: 200, res_air: 150, res_fire: 700,
    res_nature: 200, res_neutral: 200,
    classname: 'brawler', racename: 'grumbler', element: 'fire',
    target: 'enemy_taunt_max', specialAbility: [], level: 6,
    battlestats: {
      attacks_made: 0, attacks_received: 0, damage_dealt: 0,
      damage_blocked_by_enemy: 0, damage_taken: 0, damage_blocked: 0,
      knockouts: 0, survived: true,
    },
    ...over,
  }) as BattleFighter

/*
   Ability gating is symmetric, so the dungeon carries one of its own: picking
   a fire fighter is what switches it on. Without an enemy ability in the
   fixture the exposure badge could never appear, and it is the half of the
   trade the screen used to leave out.
*/
const fireHunter = {
  ability: 'firehunter', displayname: 'Fire Hunter [rare]',
  check_condition: 1, condition_target: 'enemy_group',
  condition_group: 'element', condition_name: 'fire',
  effect_on_condition_count: 1,
} as unknown as BattleAbility

const enemies: BattleFighter[] = [
  enemy({ fighter_id: 901, specialAbility: [fireHunter] }),
  enemy({ fighter_id: 902 }),
  enemy({ fighter_id: 903, element: 'nature', classname: 'desperado' }),
  enemy({ fighter_id: 904, element: 'nature', classname: 'desperado' }),
  enemy({ fighter_id: 905, element: 'fire', classname: 'gunslinger' }),
  /*
     The dungeon's own NFT fighter, as the chain hands it over: no class, no
     race. It is the card that was sitting a row higher than the rest of the
     line, because an empty name span contributes no line box to the plate.
  */
  enemy({ fighter_id: 99999999999, element: 'nature', classname: '', racename: '' }),
]

const firebane: BattleAbility = {
  ability: 'firebane', displayname: 'Firebane [legendary]',
  check_condition: 1, condition_target: 'enemy_group',
  condition_group: 'element', condition_name: 'fire',
  effect_on_condition_count: 1,
  if_effects: [{ stat_name: 'damage', percentflat: 'flat', value: 40 }],
} as unknown as BattleAbility

const pierce: BattleAbility = {
  ability: 'irresistable', displayname: 'Irresistable [mythical]',
  on_attack: 1, ignore_res_percent: 60,
} as unknown as BattleAbility

const fighter = (
  id: number,
  classname: string,
  element: string,
  over: Record<string, unknown> = {},
): RosterFighter =>
  ({
    fighter_id: id, owner: 'me.wam', classname, racename: 'khaured',
    role: '', element, marker: '',
    creation_date: daysAgo(6), last_payday: daysAgo(2),
    next_payday: inDays(5), final_deletion_date: inDays(110),
    in_use: 0, use_type: '', use_details: '', active: 1,
    ascension_level: 0, ascension_in_progress: 0, ascension_upgrades: [],
    stats: {
      health_min: 2600, health_max: 3000, damage_min: 1380, damage_max: 1440,
      taunt_min: 200, taunt_max: 300, initiative_min: 420, initiative_max: 460,
      attackspeed_min: 430, attackspeed_max: 470,
      res_gem: 200, res_metal: 200, res_air: 200, res_fire: 200,
      res_nature: 200, res_neutral: 200,
      classname, racename: 'khaured', element,
      target: 'enemy_taunt_max', abilities: [],
      experience: 730, required_experience: 10000, level: 4, credits: 3390,
      ...over,
    },
  }) as unknown as RosterFighter

const roster: RosterFighter[] = [
  /* Wrong element into a 70% fire wall: the case the screen exists to warn about. */
  fighter(1, 'desperado', 'fire'),
  /* Right element, and their air resistance is the lowest they have. */
  fighter(2, 'gunslinger', 'air'),
  /* Wrong element, but pierces most of the wall. */
  fighter(3, 'brawler', 'fire', { abilities: [pierce] }),
  /* Right element and an ability that fires once per fire enemy. */
  fighter(4, 'ranger', 'air', { abilities: [firebane] }),
  /* A wall: resists both elements coming back, but hits nothing. */
  fighter(5, 'defender', 'fire', {
    res_fire: 700, res_nature: 700, damage_min: 400, damage_max: 440,
  }),
  /* Old enough that the decay curve has taken most of it — the case the age
     chip exists to make visible before the fighter is picked. */
  { ...fighter(6, 'mystic', 'air'), creation_date: daysAgo(190) } as RosterFighter,
  { ...fighter(7, 'hunter', 'air'), creation_date: daysAgo(260) } as RosterFighter,
]

const matchups = matchupsFor(roster, enemies, 1.15, 0.99997997283935547, NOW)
const noop = () => {}

/* The five picked, plus the sixth the crew and weapon fuse into. */
const asFlat = (f: RosterFighter): FlatFighter => ({
  element: f.element,
  classname: f.classname,
  racename: f.racename,
  damage: 1410,
  health: 2800,
  attackspeed: 450,
  taunt: 250,
  initiative: 440,
  res_gem: f.stats.res_gem, res_metal: f.stats.res_metal, res_air: f.stats.res_air,
  res_fire: f.stats.res_fire, res_nature: f.stats.res_nature,
  res_neutral: f.stats.res_neutral,
  abilities: f.stats.abilities ?? [],
})

const sixth: FlatFighter = {
  element: 'fire', classname: '', racename: '',
  damage: 600, health: 900, attackspeed: 500, taunt: 100, initiative: 400,
  res_gem: 0, res_metal: 0, res_air: 0, res_fire: 0, res_nature: 0, res_neutral: 0,
  abilities: [firebane],
}

const lineUp = [...roster.map(asFlat), sixth]
const enemyFlat = enemies.map(battleAsFlat)
const mySlots = lineUp.map((f) => matchupBetween(f, enemyFlat))
const enemySlots = enemyFlat.map((e) => matchupBetween(e, lineUp))

const body = renderToStaticMarkup(
  <section className="panel picker">
    <div className="versus">
      <div className="versus__side versus__side--enemy">
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
              abilities={enemySlots[i]}
              onOpen={noop}
            />
          ))}
        </div>
      </div>
      <div className="versus__side versus__side--mine">
        <div className="versus__row">
          {roster.map((f, i) => (
            <CombatCard
              key={f.fighter_id}
              element={f.element}
              classname={f.classname}
              racename={f.racename}
              level={f.stats.level}
              health={2800}
              damage={1410}
              side="mine"
              abilities={mySlots[i]}
              onOpen={noop}
            />
          ))}
          <CombatCard
            element="fire"
            classname="NFT Fighter"
            racename=""
            health={900}
            damage={600}
            side="mine"
            badge="NFT"
            abilities={mySlots[mySlots.length - 1]}
            onOpen={noop}
          />
        </div>
      </div>
    </div>

    <RosterFilters
      filter={{ ...EMPTY_FILTER, versus: { bonuses: 1, offense: 65, defense: 0 } }}
      onChange={noop}
      roster={roster}
      versus={enemyProfile(enemies)}
    />
    <FighterGrid
      roster={roster}
      filter={EMPTY_FILTER}
      ageDecay={0.99997997283935547}
      levelMod={1.15}
      teamIds={[2, 4]}
      full={false}
      matchups={matchups}
      onToggle={noop}
      onInspect={noop}
    />
  </section>,
)

const html = `<!doctype html>
<meta charset="utf-8">
<title>Dungeon matchup</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 20px; background: #05101e; font-family: var(--font-body); color: var(--text); }
  .panel { max-width: 960px; }
</style>
${body}
`

writeFileSync(new URL('../.ssr/matchup.html', import.meta.url), html)
console.log('wrote .ssr/matchup.html')
