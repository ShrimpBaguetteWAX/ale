/**
 * A roster card on its own, against the real stylesheet.
 *
 *   npx vite build --ssr scripts/ssr-fcard.tsx --outDir .ssr
 *   node .ssr/ssr-fcard.js
 *
 * The card is a grid whose last track gives it its height, so an extra child
 * silently collapses the shape rather than erroring — which is exactly how it
 * broke. This renders one at a real size so that is visible.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { FighterCard } from '../src/routes/Fighters'
import type { RosterFighter } from '../src/dungeon/types'
import type { FighterLevel, FightersConfig } from '../src/fighters/types'
import type { ClassTemplate } from '../src/tavern/fighterStats'

const css = ['tokens.css', 'global.css', 'app.css', 'fighters.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const NOW = Date.now()
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString().slice(0, 19)
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString().slice(0, 19)

const template = {
  classname: 'desperado',
  total_min_max_stats: {
    health_min_min: 200, health_max_min: 260, health_min_max: 520, health_max_max: 600,
    damage_min_min: 300, damage_max_min: 360, damage_min_max: 640, damage_max_max: 700,
    attackspeed_min_min: 400, attackspeed_max_min: 460,
    attackspeed_min_max: 900, attackspeed_max_max: 980,
    initiative_min_min: 300, initiative_max_min: 360,
    initiative_min_max: 900, initiative_max_max: 980,
    res_fire_max: 800,
  },
} as unknown as ClassTemplate

const ABILITIES = [
  {
    ability: 'frenzyrar', displayname: 'Frenzy [rare]',
    description: 'Gains [if:0:value] additional damage for the rest of the fight on each strike',
    if_effects: [{ stat_name: 'damage', percentflat: 'flat', value: 17 }],
    bf_effects: [], eof_effects: [], locked: 0,
  },
  {
    ability: 'seheatpcleg', displayname: 'Self Heal on Attack [legendary]',
    description: 'Healed for [if:0:value]% of the damage dealt when striking',
    if_effects: [{ stat_name: 'health_atk', percentflat: 'percent', value: 42 }],
    bf_effects: [], eof_effects: [], locked: 0,
  },
  {
    ability: 'thornsabu', displayname: 'Thorns [abundant]',
    description: 'Upon being hit, reduces attacker health by [if:0:value]',
    if_effects: [{ stat_name: 'health', percentflat: 'flat', value: -31 }],
    bf_effects: [], eof_effects: [], locked: 1,
  },
  {
    ability: 'resigmyt', displayname: 'Resistance Ignore [mythical]',
    description: 'Ignores [if:0:resignore:value]% of the resistance of the target when attacking',
    if_effects: [{ stat_name: 'ignore_res_percent', percentflat: 'percent', value: 35 }],
    bf_effects: [], eof_effects: [], locked: 0,
  },
]

const fighter = (days: number, id: number, nAbilities = 1): RosterFighter =>
  ({
    fighter_id: id, owner: 'me.wam', classname: 'desperado', racename: 'khaured',
    role: '', element: 'fire', marker: '',
    creation_date: daysAgo(days), last_payday: daysAgo(2), next_payday: inDays(5),
    final_deletion_date: inDays(120),
    in_use: 0, use_type: '', use_details: '', active: 1,
    ascension_level: 0, ascension_in_progress: 0, ascension_upgrades: [],
    stats: {
      health_min: 260, health_max: 300, damage_min: 1380, damage_max: 1440,
      taunt_min: 200, taunt_max: 300, initiative_min: 420, initiative_max: 460,
      attackspeed_min: 430, attackspeed_max: 470,
      res_gem: 200, res_metal: 200, res_air: 200, res_fire: 640,
      res_nature: 200, res_neutral: 200,
      classname: 'desperado', racename: 'khaured', element: 'fire',
      target: 'enemy_taunt_max',
      abilities: ABILITIES.slice(0, nAbilities),
      experience: 730, required_experience: 10000, level: 4, credits: 3390,
    },
  }) as unknown as RosterFighter

const levels = [{ level: 4 }, { level: 5 }] as unknown as FighterLevel[]
const config = { standard_pay_payday: 30, asc_ability_unlock_lvl: 3 } as unknown as FightersConfig
const noop = () => {}

const card = (
  days: number,
  id: number,
  tab: 'primary' | 'resistance' | 'abilities' = 'primary',
  nAbilities = 3,
) =>
  renderToStaticMarkup(
    <FighterCard
      fighter={fighter(days, id, nAbilities)}
      levels={levels}
      config={config}
      template={template}
      levelMod={1.15}
      ageDecay={0.99997997283935547}
      now={NOW}
      mode="view"
      tab={tab}
      selected={false}
      checked={false}
      onSelect={noop}
      onCheck={noop}
      onOpen={noop}
    />,
  )

const html = `<!doctype html>
<meta charset="utf-8">
<title>Roster card</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 20px; background: #05101e; font-family: var(--font-body); color: var(--text); }
  /* The roster grid is repeat(auto-fill, minmax(420px, 1fr)), so 420px is the
     narrowest a card is ever asked to be. Render at exactly that. */
  .grid { display: grid; grid-template-columns: 420px; gap: 14px; width: 420px; }
  h2 { font: 12px/1 var(--font-body); color: #7d879e; text-transform: uppercase; letter-spacing: .08em; }
</style>
${[420, 380, 340, 300].map((w) => `
<h2>${w}px column - 2 days, 100 days, 220 days old</h2>
<div class="grid" style="grid-template-columns: ${w}px; width: ${w}px">${card(2, 1)}${card(100, 2)}${card(220, 3)}</div>
`).join('')}

<h2>420px column - each tab</h2>
<div class="grid" style="grid-template-columns: 420px; width: 420px">${card(2, 4, 'primary')}${card(2, 5, 'resistance')}${card(2, 6, 'abilities')}</div>

<h2>420px column - 1, 2, 3 and 4 abilities</h2>
<div class="grid" style="grid-template-columns: 420px; width: 420px">${[1, 2, 3, 4].map((n) => card(2, 10 + n, 'abilities', n)).join('')}</div>
`

writeFileSync(new URL('../.ssr/fcard.html', import.meta.url), html)
console.log('wrote .ssr/fcard.html')
