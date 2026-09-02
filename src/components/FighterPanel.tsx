import type { BattleAbility } from '@/dungeon/types'
import type { ClassTemplate } from '@/tavern/fighterStats'
import {
  GRADE_ICON,
  GRADE_LABEL,
  abilityColor,
  abilityName,
  abilityRarity,
  elementBackground,
  fighterArt,
  fighterArtFallback,
  formatResistance,
  formatScaled,
  formatStat,
  formatTarget,
  gradeStat,
  midpoint,
  resolveAbilityDescription,
  statIcon,
  STAT_LABEL,
} from '@/tavern/fighterStats'

/**
 * The full read on a fighter — the tavern's display, made reusable.
 *
 * Anywhere a fighter is being judged deserves the same information: the class
 * art on its elemental backdrop, every stat with its grade arrow, the six
 * resistances, and the abilities in their rarity colours. The dungeon is
 * exactly such a place — picking a team is the same "is this one good?"
 * question the tavern asks, so it gets the same answer rather than a name and
 * two numbers.
 *
 * Stats arrive either as min/max ranges (a roster fighter, not yet rolled for
 * this fight) or as settled values (a dungeon opponent, or the fighter a crew
 * and weapon pair combine into). Both are accepted; ranges show as
 * "29 (+-12)" with the arrow grading the midpoint, settled values show plain.
 */

export interface PanelStat {
  /** A settled value, or the low end of a range. */
  min: number
  /** Omit for a settled value. */
  max?: number
  /**
   * The raw roll to grade, when it differs from what is displayed.
   *
   * A roster fighter's health and damage are shown *as fought with* — level
   * and age factors already applied — but the class bands describe the roll
   * before either. Grading the scaled number would put a gold arrow on every
   * levelled fighter and say nothing about the roll, so the two are kept
   * separate. Omitted everywhere the displayed number is the roll.
   */
  grade?: number
}

export interface PanelFighter {
  classname: string
  racename: string
  element: string
  target: string
  level?: number
  health: PanelStat
  damage: PanelStat
  taunt: PanelStat
  attackspeed: PanelStat
  initiative: PanelStat
  res_gem: number
  res_metal: number
  res_air: number
  res_fire: number
  res_nature: number
  res_neutral: number
  abilities: BattleAbility[]
  /** Overrides the class art — the NFT fighter has no class of its own. */
  art?: string
  /** Shown instead of the class name, for the same reason. */
  title?: string
  subtitle?: string
}

const RESISTANCES: [string, string][] = [
  ['res_gem', 'Gem'],
  ['res_metal', 'Metal'],
  ['res_air', 'Air'],
  ['res_fire', 'Fire'],
  ['res_nature', 'Nature'],
  ['res_neutral', 'Neutral'],
]

const STAT_ORDER: (keyof PanelFighter)[] = [
  'health',
  'damage',
  'taunt',
  'attackspeed',
  'initiative',
]

function Grade({
  field,
  raw,
  template,
}: {
  field: string
  raw: number
  template: ClassTemplate | undefined
}) {
  /*
   * No band, no arrow. `gradeStat` answers "middle" when it has no template,
   * which is a reasonable default in the tavern where one always loads — but
   * here it would put "Average for this class" on the NFT fighter, which has
   * no class and nothing to be average against.
   */
  if (!template) return null
  const grade = gradeStat(field, raw, template)
  if (!grade) return null
  return (
    <img
      className="grade"
      src={GRADE_ICON[grade]}
      alt={GRADE_LABEL[grade]}
      title={GRADE_LABEL[grade]}
      width={16}
      height={16}
    />
  )
}

function StatLine({
  field,
  stat,
  template,
}: {
  field: string
  stat: PanelStat
  template: ClassTemplate | undefined
}) {
  const ranged = stat.max !== undefined && stat.max !== stat.min
  return (
    <div className="statline">
      <span className="statline__k">
        <img className="statline__icon" src={statIcon(field)} alt="" />
        {STAT_LABEL[field] ?? field}
      </span>
      <span className="statline__v mono">
        {ranged ? formatStat(stat.min, stat.max!) : formatScaled(stat.min)}
        <Grade
          field={field}
          raw={stat.grade ?? (ranged ? midpoint(stat.min, stat.max!) : stat.min)}
          template={template}
        />
      </span>
    </div>
  )
}

export function FighterPanel({
  fighter,
  template,
  compact = false,
  abilityUnlockLevel,
}: {
  fighter: PanelFighter
  /**
   * The class's own min/max bands, which the grade arrows compare against.
   * Without it the arrows are simply omitted rather than guessed at.
   */
  template?: ClassTemplate
  /** Drops the resistances and abilities, for a side-by-side comparison. */
  compact?: boolean
  /**
   * `fighters.ale`/`config.asc_ability_unlock_lvl`, so a locked ability can
   * name the ascension that frees it instead of just saying "locked".
   */
  abilityUnlockLevel?: number
}) {
  const art =
    fighter.art ??
    fighterArt({ classname: fighter.classname, racename: fighter.racename })

  return (
    <div className="fpanel">
      <div
        className="portrait"
        style={{ backgroundImage: `url('${elementBackground(fighter.element)}')` }}
      >
        <img
          className="portrait__art"
          src={art}
          /* The NFT fighter has neither class nor race, so it falls back to
             whatever the panel is titled rather than to a blank alt. */
          alt={
            [fighter.classname, fighter.racename].filter(Boolean).join(' ') ||
            (fighter.title ?? 'Fighter')
          }
          onError={(e) => {
            const img = e.currentTarget
            if (img.dataset.fallback) return
            img.dataset.fallback = '1'
            img.src = fighterArtFallback()
          }}
        />
        {fighter.level !== undefined && (
          <span className="portrait__level tag">Level {fighter.level}</span>
        )}
      </div>

      <div className="recruit__head">
        <div>
          <div className="recruit__class">{fighter.title ?? fighter.classname}</div>
          <div className="recruit__meta">
            {fighter.subtitle ?? `${fighter.racename} · ${fighter.element}`}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--sp-3)' }}>
        {STAT_ORDER.map((field) => (
          <StatLine
            key={field}
            field={field}
            stat={fighter[field] as PanelStat}
            template={template}
          />
        ))}
        <div className="statline">
          <span className="statline__k">Targets</span>
          {/*
            An empty target is not "no target": `pick_defender` falls through
            to highest taunt for anything it does not recognise, and most crew
            cards leave it blank. Showing the blank would hide a real
            behaviour behind an apparent gap in the data.
          */}
          <span className="statline__v">
            {fighter.target ? formatTarget(fighter.target) : 'Highest Taunt'}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="resgrid">
          {RESISTANCES.map(([key, label]) => {
            const raw = (fighter as unknown as Record<string, number>)[key]
            return (
              <div className="resgrid__cell" key={key}>
                <img src={`/assets/icons/elements/${label.toLowerCase()}.png`} alt="" />
                <span className="resgrid__label">{label}</span>
                <span className="resgrid__value mono">
                  {formatResistance(raw)}
                  <Grade field={key} raw={raw} template={template} />
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!compact && fighter.abilities.length > 0 && (
        <div className="abilities">
          {fighter.abilities.map((a, i) => {
            const rarity = abilityRarity(a.displayname)
            /*
             * A locked ability does nothing in a fight. Every fighter rolls
             * with its last one locked until ascension, so showing it
             * alongside the working ones with no distinction overstates what
             * the fighter can currently do — and it is exactly the row a
             * player would otherwise pick a team on.
             */
            const locked = !!a.locked
            return (
              <div
                className={`ability${locked ? ' ability--locked' : ''}`}
                key={`${a.ability}-${i}`}
                style={{ borderLeftColor: abilityColor(a.displayname) }}
              >
                <div
                  className="ability__name"
                  style={{ color: abilityColor(a.displayname) }}
                >
                  {abilityName(a.displayname)}
                  {rarity && <span className="ability__rarity">{rarity}</span>}
                  {locked && (
                    <span className="ability__locked">
                      <img src="/assets/icons/lock.svg" alt="" width={11} height={11} />
                      {abilityUnlockLevel
                        ? `Locked until ascension ${abilityUnlockLevel}`
                        : 'Locked until ascension'}
                    </span>
                  )}
                </div>
                <div className="ability__desc">{resolveAbilityDescription(a)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
