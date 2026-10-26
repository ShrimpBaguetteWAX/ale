import { useEffect, useState } from 'react'
import type { RosterFighter, RosterStats } from '@/dungeon/types'
import { markerIcon } from '@/dungeon/filters'
import { SACRIFICE_ABILITY } from '@/ascension/rules'
import {
  ABILITY_RARITY_COLOR,
  GRADE_ICON,
  GRADE_LABEL,
  STAT_LABEL,
  abilityColor,
  abilityName,
  abilityRarity,
  elementBackground,
  fighterArtFallback,
  fighterAvatar,
  formatResistance,
  formatStat,
  gradeOfStat,
  gradeStat,
  resolveAbilityDescription,
  statIcon,
  type ClassTemplate,
  type StatGrade,
} from '@/tavern/fighterStats'
import { asset } from '@/assets'
import { ageBand } from '@/fighters/rules'

/**
 * A fighter as a row, the market's way: portrait with level, ascension, the
 * Sacrifice skull and the owner's marker, then class, element, race, the four
 * graded stats and a tag an ability. Opened, it shows the full readouts.
 *
 * The market's board, its Sell list and the Ascension picker all draw their
 * fighters this way, so a fighter looks the same wherever it is chosen.
 */

/**
 * Which readout every card is showing.
 *
 * A fighter has eleven graded numbers and its abilities, which does not fit
 * on a card worth scanning — the Fighters screen settled this by putting them
 * behind three tabs, and the market has the same problem with more cards.
 *
 * Held by the screen rather than the card because the question a market
 * answers is comparative — "which of these has the best fire resistance" —
 * and per-card tabs make that a click per listing. A card can still be
 * switched on its own; the next change to the shared readout takes them all
 * back in step.
 */
export type Readout = 'stats' | 'resist' | 'abilities'

const READOUTS: [Readout, string][] = [
  ['stats', 'Stats'],
  ['resist', 'Resist'],
  ['abilities', 'Abilities'],
]

/** The five banded stats, in the order the fighter panel uses. */
const PRIMARY_STATS = ['damage', 'health', 'taunt', 'attackspeed', 'initiative'] as const
/** The phone row's grades: the primary figures that have one. */
const ROW_GRADES = ['damage', 'health', 'attackspeed', 'initiative'] as const

/**
 * A stat's grade, with health and damage taken at what the fighter fights
 * with after age.
 *
 * The contract multiplies both by `age_decay ^ (days²)` before the first
 * blow, so an old fighter's rolled health is not the health it brings. Level
 * is left out on purpose: the class bands describe a fresh roll, and folding
 * in `level_mod ^ level` would grade every levelled fighter gold. Everything
 * else is fought with exactly as rolled and graded that way.
 */
export function gradeAged(
  raw: Record<string, number>,
  field: string,
  template: ClassTemplate | undefined,
  ageFactor = 1,
): StatGrade | null {
  if (ageFactor !== 1 && (field === 'damage' || field === 'health')) {
    if (!template) return null
    const mid = ((raw[`${field}_min`] ?? 0) + (raw[`${field}_max`] ?? 0)) / 2
    return gradeStat(field, mid * ageFactor, template)
  }
  return gradeOfStat(raw, field, template)
}

const RESISTANCES: [string, string][] = [
  ['res_fire', 'Fire'],
  ['res_air', 'Air'],
  ['res_metal', 'Metal'],
  ['res_gem', 'Gem'],
  ['res_nature', 'Nature'],
  ['res_neutral', 'Neutral'],
]

/**
 * One fighter as a phone row: portrait, who it is, and a right-hand column
 * the caller fills (a price and a clock on the board, a cue on Sell).
 *
 * A line can sit under the row whether or not it is open — what a listing
 * of your own is doing — and the row opens in place on whatever it was given
 * to show: the readouts on the board, the terms on Sell.
 */
export function FighterRow({
  stats: f,
  ascension,
  template,
  right,
  open,
  onToggle,
  below,
  marker,
  dim = false,
  age,
  ageFactor,
  children,
}: {
  stats: RosterStats
  ascension: number
  /**
   * The owner's own label for the fighter, from My Fighters. Only ever for a
   * fighter of the player's: other people's listings carry none, and would
   * not be ours to show.
   */
  marker?: string
  /** Shown but set back, as for a fighter already placed somewhere else. */
  dim?: boolean
  template?: ClassTemplate
  right: React.ReactNode
  open: boolean
  onToggle: () => void
  below?: React.ReactNode
  /**
   * The age bonus, +100% down to -100%. A buyer has to see it on the row:
   * health and damage fight at `age_decay ^ (days²)` of the roll, so two
   * fighters with the same stats can be worth very different amounts.
   */
  age?: { bonus: number; note: string }
  /** `age_decay ^ (days²)`, so health and damage are graded as fought with. */
  ageFactor?: number
  children?: React.ReactNode
}) {
  const raw = f as unknown as Record<string, number>
  /*
     The four graded figures, each behind its stat's icon so an arrow says
     which number it grades: damage, health, cooldown, windup. Taunt is a role
     rather than a quality and carries no grade.
  */
  const grades = ROW_GRADES.map((field) => ({ field, grade: gradeAged(raw, field, template, ageFactor) }))
  /*
     A tag every ability, in its rarity's colour, the locked one hollow, so
     the count is the fighter's count. Sacrifice has no rarity and is the one
     ability a buyer may be shopping for (it feeds an ascension): its tag is
     a skull, and the portrait carries one too.
  */
  const abilities = f.abilities ?? []
  const isSacrifice = (a: (typeof abilities)[number]) => String(a.ability) === SACRIFICE_ABILITY
  const sacrifice = abilities.some(isSacrifice)
  return (
    <div className={`mrow${open ? ' is-open' : ''}${dim ? ' is-dim' : ''}`}>
      <button type="button" className="mrow__hit" onClick={onToggle} aria-expanded={open}>
        <span className="mrow__art" style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}>
          <img
            src={fighterAvatar({ classname: f.classname, racename: f.racename })}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = fighterArtFallback()
            }}
          />
          {/* Level and ascension in one badge, the way a fighter is described. */}
          <span className="mrow__level">
            <span>L{f.level}</span>
            {ascension > 0 && (
              <em title={`Ascended ${ascension} time${ascension === 1 ? '' : 's'}`}>✦{ascension}</em>
            )}
          </span>
          {marker && (
            <span className="mrow__marker" title="Your marker">
              <img src={markerIcon(marker)} alt="" />
            </span>
          )}
          {sacrifice && (
            <span className="mrow__skull" title="Has the Sacrifice ability">
              ☠
            </span>
          )}
        </span>
        <span className="mrow__who">
          <b>{f.classname}</b>
          <small>
            <img src={asset(`/assets/icons/elements/${f.element}.png`)} alt="" width={14} height={14} />
            {/* A fixed slot, so the grades stand in the same place on every row
                and the rows can be compared down the list. */}
            <span className="mrow__race">{f.racename}</span>
            <span className="mrow__grades">
              {grades.map(({ field, grade }) => (
                <span key={field} className="mrow__grade" title={`${STAT_LABEL[field] ?? field}${grade ? `: ${GRADE_LABEL[grade]}` : ''}`}>
                  <img className="mrow__staticon" src={statIcon(field)} alt="" />
                  {grade ? <img className="mrow__arrow" src={GRADE_ICON[grade]} alt="" /> : <i className="mrow__arrow" />}
                </span>
              ))}
            </span>
          </small>
          {(abilities.length > 0 || age) && (
            <span className="mrow__abilities">
              {age && (
                <span className={`mrow__age is-${ageBand(age.bonus)}`} title={age.note}>
                  Age {age.bonus > 0 ? '+' : ''}
                  {age.bonus.toFixed(0)}%
                </span>
              )}
              {abilities.map((a, i) => {
                const rarity = abilityRarity(a.displayname)
                const skull = isSacrifice(a)
                return (
                  <span
                    key={`${a.ability}-${i}`}
                    className={`mrow__ab${a.locked ? ' is-locked' : ''}${skull ? ' is-sacrifice' : rarity ? '' : ' is-plain'}`}
                    style={{ '--ab': rarity ? ABILITY_RARITY_COLOR[rarity] : undefined } as React.CSSProperties}
                    title={`${abilityName(a.displayname)}${rarity ? ` · ${rarity}` : ''}${a.locked ? ' · unlocks on ascension' : ''}`}
                  >
                    {skull ? '☠' : rarity ? rarity.charAt(0).toUpperCase() : '·'}
                  </span>
                )
              })}
            </span>
          )}
        </span>
        {right}
      </button>
      {below && <div className="mrow__below">{below}</div>}
      {open && children && <div className="mrow__open">{children}</div>}
    </div>
  )
}

/**
 * One graded row: the figure, then how good it is for the class.
 *
 * The number leads and the arrow follows, because the number is what is read
 * and the arrow is what is scanned. Taunt carries no arrow — it is a role
 * choice rather than a quality, and `gradeStat` refuses it.
 */
function StatRow({
  field,
  label,
  value,
  grade,
}: {
  field: string
  label: string
  value: string
  grade: StatGrade | null
}) {
  return (
    <div className="statrow">
      <img className="statrow__icon" src={statIcon(field)} alt="" width={14} height={14} />
      <span className="statrow__label">{label}</span>
      <span className="statrow__value mono">{value}</span>
      <span className="statrow__grade">
        {grade ? (
          <img src={GRADE_ICON[grade]} alt="" title={GRADE_LABEL[grade]} />
        ) : null}
      </span>
    </div>
  )
}

/**
 * Everything about the fighter, three readouts deep.
 *
 * All eleven graded figures are here — the four the card used to show were
 * missing taunt entirely and every resistance, which is half of what decides
 * whether a fighter is worth buying.
 */
export function ListingBody({
  stats,
  template,
  readout,
  unlockLevel,
  factor,
}: {
  stats: RosterFighter['stats']
  template?: ClassTemplate
  readout: Readout
  /**
   * Level and age, for a fighter that has them: health and damage are shown
   * as fought with (`total`) and graded after age alone (`age`).
   */
  factor?: { total: number; age: number }
  /** Ascension level at which a locked ability starts working, from config. */
  unlockLevel?: number
}) {
  /* A card can be flipped on its own; the shared picker takes them all back
     in step, which is what `useEffect` on the incoming value does. */
  const [override, setOverride] = useState<Readout | null>(null)
  useEffect(() => setOverride(null), [readout])
  const shown = override ?? readout

  const raw = stats as unknown as Record<string, number>
  const abilities = stats.abilities ?? []

  return (
    <div className="listingcard__body">
      <div className="listingcard__readouts" role="tablist">
        {READOUTS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={shown === key}
            className="listingcard__readout"
            onClick={() => setOverride(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {shown === 'stats' && (
        <div className="listingcard__rows">
          {PRIMARY_STATS.map((field) => {
            const scale = factor && (field === 'health' || field === 'damage') ? factor.total : 1
            return (
              <StatRow
                key={field}
                field={field}
                label={STAT_LABEL[field] ?? field}
                value={formatStat((raw[`${field}_min`] ?? 0) * scale, (raw[`${field}_max`] ?? 0) * scale)}
                grade={gradeAged(raw, field, template, factor?.age)}
              />
            )
          })}
        </div>
      )}

      {shown === 'resist' && (
        <div className="listingcard__rows">
          {RESISTANCES.map(([field, label]) => (
            <StatRow
              key={field}
              field={field}
              label={label}
              value={formatResistance(raw[field] ?? 0)}
              grade={gradeOfStat(raw, field, template)}
            />
          ))}
        </div>
      )}

      {shown === 'abilities' && (
        <div className="listingcard__rows listingcard__rows--abilities">
          {abilities.length === 0 && <p className="faint">No abilities.</p>}
          {abilities.map((a, i) => {
            /*
               A locked ability does nothing in a fight.

               Every fighter rolls with its last one locked, so this is the
               common case rather than an edge one — and on a market card it
               is the difference between what a fighter does and what it
               would do after somebody pays for several ascensions. Printed
               identically to a working ability, it was quietly overstating
               every listing on the screen.
            */
            const locked = !!a.locked
            return (
              <div
                className={`abilityline${locked ? ' abilityline--locked' : ''}`}
                key={`${a.ability}-${i}`}
              >
                <span
                  className="abilityline__name"
                  style={{ color: abilityColor(a.displayname) }}
                >
                  {abilityName(a.displayname)}
                  {abilityRarity(a.displayname) && (
                    <em className="abilityline__rarity">{abilityRarity(a.displayname)}</em>
                  )}
                </span>
                {locked && (
                  <span className="abilityline__lock">
                    <img src={asset('/assets/icons/lock.svg')} alt="" width={10} height={10} />
                    {unlockLevel
                      ? `Unlocks at ascension ${unlockLevel}`
                      : 'Unlocks on ascension'}
                  </span>
                )}
                <span className="abilityline__text">{resolveAbilityDescription(a)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
