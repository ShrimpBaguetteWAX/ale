/**
 * The dungeon's balance bar, against the real stylesheet.
 *
 *   npx vite build --ssr scripts/ssr-balance.tsx --outDir .ssr
 *   node .ssr/ssr-balance.js
 *
 * Three matchups that the old health-times-damage bar could not tell apart:
 * one genuinely even, one where the totals are even but the player's damage
 * is being absorbed, and one where the player is landing everything into a
 * line that cannot hurt them back. The point of the screenshot is that the
 * three now read differently.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { teamOutlook, type FlatFighter, type SideOutlook } from '../src/fight/matchup'
import { formatScaled } from '../src/tavern/fighterStats'
import type { BattleAbility, BattleFighter } from '../src/dungeon/types'

const css = ['tokens.css', 'global.css', 'app.css', 'dungeon.css']
  .map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8'))
  .join('\n')

const mineFlat = (over: Partial<FlatFighter> = {}): FlatFighter => ({
  element: 'fire', classname: 'desperado', racename: 'khaured',
  damage: 900, health: 700, attackspeed: 430, taunt: 250, initiative: 440,
  res_gem: 200, res_metal: 200, res_air: 200, res_fire: 200,
  res_nature: 200, res_neutral: 200,
  abilities: [],
  ...over,
})

const foe = (over: Partial<BattleFighter> = {}): BattleFighter =>
  ({
    fighter_id: 900, owner: 'dungeon', gamertag: '', avatar: '',
    health: 700, max_health: 700, damage: 900, taunt: 250,
    initiative: 440, attackspeed: 430,
    res_gem: 200, res_metal: 200, res_air: 200, res_fire: 200,
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

const firebane = {
  ability: 'firebane', displayname: 'Firebane [legendary]',
  check_condition: 1, condition_target: 'enemy_group',
  condition_group: 'element', condition_name: 'fire',
  effect_on_condition_count: 1,
} as unknown as BattleAbility

const airHunter = {
  ability: 'airhunter', displayname: 'Air Hunter [rare]',
  check_condition: 1, condition_target: 'enemy_group',
  condition_group: 'element', condition_name: 'air',
  effect_on_condition_count: 1,
} as unknown as BattleAbility

/* Copied from Dungeon.tsx so the harness shows exactly what the screen does. */
function Elemental({
  side,
  against,
  who,
}: {
  side: { landShare: number; blockShare: number; bonuses: number }
  against: number
  who: string
}) {
  const land = Math.round(side.landShare * 100)
  const block = Math.round(side.blockShare * 100)
  return (
    <span className="elemental">
      <span
        className={`elemental__bit elemental__bit--${land >= 80 ? 'good' : land >= 55 ? 'fair' : 'poor'}`}
        title={`${who} land ${land}% of that damage once the other side's resistances are applied`}
      >
        <img src="/assets/icons/swords.svg" alt="" width={11} height={11} />
        {land}%
      </span>
      <span
        className={`elemental__bit elemental__bit--${block >= 45 ? 'good' : block >= 25 ? 'fair' : 'poor'}`}
        title={`${who} turn away ${block}% of the damage coming the other way`}
      >
        <img src="/assets/icons/shield.svg" alt="" width={11} height={11} />
        {block}%
      </span>
      {side.bonuses > 0 && (
        <span className="elemental__bit elemental__bit--bonus">
          <img src="/assets/icons/medal.svg" alt="" width={11} height={11} />
          {side.bonuses}
        </span>
      )}
      {against > 0 && (
        <span className="elemental__bit elemental__bit--exposed">
          <img src="/assets/icons/exclamation.svg" alt="" width={11} height={11} />
          {against}
        </span>
      )}
    </span>
  )
}

const Head = ({ side, against, who, label, share }: { side: SideOutlook; against: number; who: string; label: string; share: number }) => (
  <header className="versus__head" style={{ ['--share' as string]: `${share * 100}%` }}>
    <span className="versus__team">{label}</span>
    <span className="versus__totals mono">
      {formatScaled(side.health)} HP · {formatScaled(side.damage)} DMG
      <Elemental side={side} against={against} who={who} />
    </span>
  </header>
)

const scenarios: [string, FlatFighter[], BattleFighter[]][] = [
  [
    'Even — same stats, neither side resists the other',
    Array.from({ length: 5 }, () => mineFlat()),
    Array.from({ length: 5 }, () => foe()),
  ],
  [
    'Same totals, but they resist fire at 80% — the old bar called this even',
    Array.from({ length: 5 }, () => mineFlat()),
    Array.from({ length: 5 }, () => foe({ res_fire: 800 })),
  ],
  [
    'Right element, and an ability that fires once per fire enemy',
    Array.from({ length: 5 }, (_, i) =>
      mineFlat({ element: 'air', res_fire: 600, abilities: i === 0 ? [firebane] : [] }),
    ),
    /* And one of theirs that fires back, so both counts appear. */
    Array.from({ length: 5 }, (_, i) =>
      foe({ res_air: 100, specialAbility: i < 2 ? [airHunter] : [] }),
    ),
  ],
]

const body = renderToStaticMarkup(
  <div className="dungeon__inner">
    {scenarios.map(([title, mine, theirs]) => {
      const o = teamOutlook(mine, theirs)
      return (
        <section className="panel" key={title} style={{ marginBottom: '18px' }}>
          <p className="faint" style={{ fontSize: 'var(--fs-xs)', margin: '0 0 8px' }}>
            {title}
          </p>
          <div className="versus">
            <div className="versus__side versus__side--enemy">
              <Head side={o.theirs} against={o.mine.bonuses} who="They" label="The dungeon" share={1 - o.share} />
            </div>
            <div className="versus__side versus__side--mine">
              <Head side={o.mine} against={o.theirs.bonuses} who="You" label="Your team" share={o.share} />
            </div>
          </div>
        </section>
      )
    })}
  </div>,
)

const html = `<!doctype html>
<meta charset="utf-8">
<title>Balance bar</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 20px; background: #05101e; font-family: var(--font-body); color: var(--text); }
</style>
${body}
`

writeFileSync(new URL('../.ssr/balance.html', import.meta.url), html)
console.log('wrote .ssr/balance.html')
