import { useEffect, useMemo, useState } from 'react'
import type { CardTemplate } from '@/chain/atomic'
import { FighterPanel, type PanelFighter } from '@/components/FighterPanel'
import { fighterAvailable } from '@/dungeon/rules'
import { ageBand, ageBonus, ageDays, ageNote } from '@/fighters/rules'
import { ageFactor, levelFactor } from '@/fight/scaling'
import {
  ELEMENTS,
  EMPTY_FILTER,
  NO_VERSUS,
  SORTS,
  STATUSES,
  VERSUS_SORTS,
  applyFilter,
  facetsOf,
  countActiveFilters,
  MARKERS,
  isFilterActive,
  markerIcon,
  type Element,
  type QualityRule,
  type RosterFilter,
  type Status,
} from '@/dungeon/filters'
import type { Matchup } from '@/fight/matchup'
import {
  weatherEffectText,
  weatherIsCalm,
  weatherLean,
  weatherTargets,
  type Weather,
} from '@/fight/weather'
import { byQuality, rarityRank, type NftValue } from '@/dungeon/nftFighter'
import type { BattleFighter, RosterFighter } from '@/dungeon/types'
import {
  FILTER_STATS,
  GRADE_ICON,
  GRADE_LABEL,
  GRADE_ORDER,
  STAT_LABEL,
  elementBackground,
  isGradedStat,
  statIcon,
  fighterArt,
  fighterArtFallback,
  formatScaled,
  type ClassTemplate,
  type StatGrade,
} from '@/tavern/fighterStats'
import { asset } from '@/assets'
import { usePhone } from '@/components/usePhone'

/**
 * The parts of a fight setup screen that the dungeon and the arena share.
 *
 * Both screens ask the same question — which five fighters, which crew card,
 * which weapon — and only differ in who is on the other side and what the
 * fight costs. Everything that answers the shared question lives here; what
 * makes a dungeon a dungeon (the difficulty ladder) or an arena an arena (the
 * defenders' power) stays in the screen that owns it.
 */

/** What a fighter detail overlay is showing. */
export type Detail = { kind: 'panel'; panel: PanelFighter; template?: ClassTemplate } | null

/** How long to keep asking the chain for the fight row before giving up. */
export const POLL_ATTEMPTS = 20
export const POLL_INTERVAL_MS = 700

/** Which picker tab is open. */
export type Tab = 'fighters' | 'crew' | 'weapon'

export const mid = (min: number, max: number) => Math.round((min + max) / 2)

/** Element icons live alongside the resistance icons the panel already uses. */
export const elementIcon = (element: string) =>
  asset("/assets/icons/elements/") + (element || "neutral") + ".png"

/* ---------- adapters into the shared panel ---------- */

/**
 * A roster fighter as the panel shows it: fielded, not stored.
 *
 * The numbers on the row are the roll, and nothing fights at its roll —
 * `apply_weather_and_age` multiplies health and damage by `level_mod ^ level`
 * and by `age_decay ^ (days²)` before the first blow. At the live 1.15 a
 * level 7 fighter hits for two and a half times what this screen used to
 * print, and a fortnight-old one for rather less than it. Both were being
 * shown raw, so the detail view disagreed with the card that opened it and
 * with the fight that followed.
 *
 * The grade arrows keep comparing the roll, since that is what the class
 * bands describe — see `PanelStat.grade`.
 */
export function rosterPanel(
  f: RosterFighter,
  levelMod: number,
  ageDecay: number,
  now = Date.now(),
): PanelFighter {
  const s = f.stats
  const age = ageFactor(f.creation_date, ageDecay, now)
  const factor = levelFactor(s.level, levelMod) * age
  return {
    classname: f.classname,
    racename: f.racename,
    element: f.element,
    target: s.target,
    level: s.level,
    age: { bonus: ageBonus(f, ageDecay, now), days: ageDays(f, now), factor: age },
    health: {
      min: s.health_min * factor,
      max: s.health_max * factor,
      grade: mid(s.health_min, s.health_max),
    },
    damage: {
      min: s.damage_min * factor,
      max: s.damage_max * factor,
      grade: mid(s.damage_min, s.damage_max),
    },
    taunt: { min: s.taunt_min, max: s.taunt_max },
    attackspeed: { min: s.attackspeed_min, max: s.attackspeed_max },
    initiative: { min: s.initiative_min, max: s.initiative_max },
    res_gem: s.res_gem,
    res_metal: s.res_metal,
    res_air: s.res_air,
    res_fire: s.res_fire,
    res_nature: s.res_nature,
    res_neutral: s.res_neutral,
    abilities: s.abilities ?? [],
  }
}

export function battlePanel(f: BattleFighter): PanelFighter {
  return {
    classname: f.classname,
    racename: f.racename,
    element: f.element,
    target: f.target,
    level: f.level,
    health: { min: f.health },
    damage: { min: f.damage },
    taunt: { min: f.taunt },
    attackspeed: { min: f.attackspeed },
    initiative: { min: f.initiative },
    res_gem: f.res_gem,
    res_metal: f.res_metal,
    res_air: f.res_air,
    res_fire: f.res_fire,
    res_nature: f.res_nature,
    res_neutral: f.res_neutral,
    abilities: f.specialAbility ?? [],
  }
}/* ---------- portraits ---------- */

export function Portrait({
  element,
  classname,
  racename,
}: {
  element: string
  classname: string
  racename: string
}) {
  return (
    <span
      className="portrait portrait--slot"
      style={{ backgroundImage: `url('${elementBackground(element)}')` }}
    >
      <img
        className="portrait__art"
        src={fighterArt({ classname, racename })}
        alt={`${classname} ${racename}`}
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget
          if (img.dataset.fallback) return
          img.dataset.fallback = '1'
          img.src = fighterArtFallback()
        }}
      />
    </span>
  )
}

/* ---------- the versus line-up ---------- */

/**
 * The weather standing over the land, on one line.
 *
 * `apply_weather_and_age` runs before the first blow and before the level and
 * age scaling, so this is the first thing that happens to a fighter and
 * everything else compounds on top of it. It was on the screen nowhere.
 *
 * It is a strip rather than a panel because it is one fact, and the chain
 * already words it: `displayname` names the effect *and* who it falls on —
 * "-20 arcanist damage", "+15 gem fighter cooldown". Spelling that out again
 * in stat chips and a "falls on" line cost five rows to repeat one sentence.
 *
 * It carried a count of how many fighters on each side it reached, which
 * looked like the most useful thing on the row and was not: "5 of yours · 6
 * of the defenders" reads as a score without saying what is being scored, and
 * a number nobody can act on is worse than no number. The weather's effect on
 * the two teams belongs in the balance bar, where it can be felt rather than
 * counted.
 */
export function WeatherPanel({ weather }: { weather: Weather | null | undefined }) {
  if (!weather) return null

  const calm = weatherIsCalm(weather)
  const lean = weatherLean(weather)
  const icons = weatherStatIcons(weather)

  /* The detail the strip drops, kept for anyone who hovers it. */
  const detail = calm
    ? 'This roll carries no effects.'
    : weather.weather_effects
        .map((e) => `${STAT_LABEL[e.statname] ?? prettyStatname(e.statname)} ${weatherEffectText(e)}`)
        .join(' · ')
  const targets = weatherTargets(weather)
  const falls = targets.length
    ? `Falls on ${targets.join(', ')}`
    : 'Falls on every fighter on the field'

  return (
    <div
      className={`weather weather--${lean}`}
      title={`${detail}. ${falls}. Changes daily.`}
    >
      {/*
        The stats the roll touches, as their own icons. A generic weather
        glyph said only "this row is about weather", which the sentence beside
        it already says; the stat symbols say which numbers move, and that is
        what a player scans a row like this for.
      */}
      {!!icons.length && (
        <span className="weather__stats">
          {icons.map(({ src, label }) => (
            <img
              className="weather__stat"
              key={label}
              src={src}
              alt={label}
              title={label}
              width={18}
              height={18}
            />
          ))}
        </span>
      )}
      <span className="weather__name">{weatherTitle(weather.displayname)}</span>
    </div>
  )
}

/** The element a resistance stat belongs to, or nothing. */
function resElement(statname: string): string | null {
  const m = /^res_([a-z]+)$/.exec(statname)
  return m ? m[1] : null
}

/**
 * A roll's name in the game's own capitalisation.
 *
 * The chain stores these in running prose — "-25% mystic health", "+15 gem
 * fighter cooldown" — where every other surface in the game writes Mystic,
 * Gem and Cooldown as proper terms. Title-casing the lot reads as a label
 * rather than a sentence fragment, which is what a row under a heading should
 * be. The joining words stay lower so it does not shout: "-40 Air Resistance
 * and +20 Nature Resistance".
 */
const LOWER = new Set(['and', 'or', 'the', 'a', 'an', 'of', 'to', 'per', 'in', 'on'])

function weatherTitle(name: string): string {
  return name
    .split(/(\s+)/)
    .map((word, i) => {
      if (!word.trim()) return word
      if (i > 0 && LOWER.has(word.toLowerCase())) return word.toLowerCase()
      /*
         The first character only. Reaching for the first *lowercase* letter
         instead turns "Altan" into "ALtan", and "+15" and "-20%" are left
         alone either way because they do not start with one.
      */
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join('')
}

/**
 * One icon per stat a roll touches, in the order the contract lists them.
 *
 * Resistances have no icon of their own in `icons/stats`, but each belongs to
 * an element that does — and the element icon is the one a player already
 * reads on every fighter card. Deduplicated, because a roll that moves the
 * same stat twice is still one stat moving.
 */
function weatherStatIcons(weather: Weather): { src: string; label: string }[] {
  const seen = new Set<string>()
  const out: { src: string; label: string }[] = []
  for (const e of weather.weather_effects) {
    if (seen.has(e.statname)) continue
    seen.add(e.statname)
    const el = resElement(e.statname)
    out.push({
      src: el ? elementIcon(el) : statIcon(e.statname),
      label: STAT_LABEL[e.statname] ?? prettyStatname(e.statname),
    })
  }
  return out
}

/** `res_fire` reads as "Fire res" rather than as a column name. */
function prettyStatname(statname: string): string {
  const el = resElement(statname)
  if (!el) return statname
  return el[0].toUpperCase() + el.slice(1) + ' res'
}


/**
 * What the elements do to one side's totals.
 *
 * The two figures beside a team's health and damage are the part of the
 * matchup the raw sums cannot say: how much of its damage survives the far
 * side's resistances, and how much of what is aimed at it is turned away.
 * They are the difference between a team that looks even on paper and one
 * that is about to lose, and until now the screen never mentioned them.
 */
export function Elemental({
  side,
  against,
  who,
}: {
  side: { landShare: number; blockShare: number; bonuses: number }
  /**
   * Ability firings the *other* side gets out of this one.
   *
   * Each header showed only what its own team's abilities did, which reads as
   * a scoreboard of one team's strengths rather than a matchup — and it is
   * the same asymmetry the fighter cards used to have. Both counts on both
   * sides means a header can be read without looking across at the other.
   */
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
        <img src={asset("/assets/icons/swords.svg")} alt="" width={11} height={11} />
        {land}%
      </span>
      <span
        className={`elemental__bit elemental__bit--${block >= 45 ? 'good' : block >= 25 ? 'fair' : 'poor'}`}
        title={`${who} turn away ${block}% of the damage coming the other way`}
      >
        <img src={asset("/assets/icons/shield.svg")} alt="" width={11} height={11} />
        {block}%
      </span>
      {side.bonuses > 0 && (
        <span
          className="elemental__bit elemental__bit--bonus"
          title={`${side.bonuses} of ${who === 'You' ? 'your' : 'their'} ability firing${side.bonuses === 1 ? '' : 's'} that only this matchup allows, across the whole line-up — the crew-and-weapon fighter included`}
        >
          <img src={asset("/assets/icons/medal.svg")} alt="" width={11} height={11} />
          {side.bonuses}
        </span>
      )}
      {against > 0 && (
        <span
          className="elemental__bit elemental__bit--exposed"
          title={`${against} ability firing${against === 1 ? '' : 's'} the other side gets out of ${who === 'You' ? 'your' : 'their'} line-up`}
        >
          <img src={asset("/assets/icons/exclamation.svg")} alt="" width={11} height={11} />
          {against}
        </span>
      )}
    </span>
  )
}

/**
 * One fighter on the versus screen.
 *
 * Deliberately bigger than a picker tile: this is the line-up a player is
 * about to commit energy to, so the class art gets room to read as a
 * character rather than a thumbnail. The name plate sits over a scrim at the
 * foot of the art, which is what keeps the card legible whatever the
 * illustration behind it does.
 */
export function CombatCard({
  element,
  classname,
  racename,
  level,
  health,
  damage,
  side,
  art,
  badge,
  abilities,
  owner,
  onOpen,
  onRemove,
  dormant,
}: {
  element: string
  classname: string
  racename: string
  level?: number
  health: number
  damage: number
  side: "mine" | "enemy"
  art?: string
  badge?: string
  /**
   * The two ability counts for this combatant, when there is an opposing
   * line to read them against.
   *
   * On the line-up rather than only in the picker because the sixth fighter
   * — the crew and weapon fused together — never passes through the picker at
   * all, and its abilities count towards the totals beside the bar. Without
   * this the balance bar's tally could not be reconciled with anything on
   * screen.
   */
  abilities?: { bonuses: number; bonusNames: string[]; exposure: number; exposureNames: string[] }
  /**
   * Whose fighter this is, when that is not obvious.
   *
   * A dungeon's team belongs to nobody, so this stays unset there. An arena's
   * defenders are other players' fighters, and which player is worth knowing
   * — you may be about to knock a friend off a land, or recognise the tag
   * that keeps beating you.
   */
  owner?: string
  onOpen: () => void
  /**
   * Take this combatant back out of the line-up, when it can be taken out.
   *
   * Unset on the opposing side and on anything not being chosen, so the
   * button exists only where it means something — but the *space* it takes
   * is reserved by the row (`--removerow`), so the cards on a side stay level
   * whether or not every slot in it happens to be filled.
   */
  onRemove?: () => void
  /**
   * Why this fighter is on the card but not in the fight.
   *
   * The dungeon’s own NFT fighter only joins from a difficulty the
   * contract sets, and below it the card used to be dropped from the row
   * altogether — which tells a player nothing, and specifically not that
   * the dungeon has a sixth fighter waiting three difficulties up. Shown
   * greyed with the reason on it instead.
   */
  dormant?: string
}) {
  /*
     On a phone the ability counts move out from under the card and sit
     below it.

     They are a row on the plate, and the plate is the dark band painted
     over the bottom of the portrait — so on a 58px card those two little
     chips were costing a fifth of the artwork to say something a player
     reads once while choosing. Below the card the band gets that height
     back and the chips are easier to read for not being over a portrait.

     They cannot simply be positioned outside: `.combatcard__hit` is 124%
     of the card wide by design — that is what covers the wedges the skew
     leaves — so the card must go on clipping, and anything that escapes
     it has to be a sibling rather than a descendant.
  */
  const phone = usePhone()

  /*
     Always a row, whether or not there is anything to put in it.

     It used to appear only when `abilities` was given, and the NFT fighter
     is never given any - so its plate was one row shorter than the five
     beside it, and because the plate is anchored to the bottom of the card
     that shortfall came off the top: its name sat 15px lower than every
     other name in the line-up and its damage and health with it.

     A card in a line-up is read across the row, so the rows have to agree
     more than any one card has to be compact.
  */
  const counts = (
    <span className="combatcard__vs">
      {!!abilities && abilities.bonuses > 0 && (
        <span
          className="combatcard__vsbit combatcard__vsbit--bonus"
          title={`Fires here: ${abilities.bonusNames.join(', ')}`}
        >
          <img src={asset('/assets/icons/medal.svg')} alt="" width={10} height={10} />
          {abilities.bonuses}
        </span>
      )}
      {!!abilities && abilities.exposure > 0 && (
        <span
          className="combatcard__vsbit combatcard__vsbit--exposed"
          title={`Switches on for the other side: ${abilities.exposureNames.join(', ')}`}
        >
          <img src={asset('/assets/icons/exclamation.svg')} alt="" width={10} height={10} />
          {abilities.exposure}
        </span>
      )}
    </span>
  )

  return (
    <div className="combatslot">
      {/*
        The elemental backdrop sits on the skewed card itself, not on the
        content inside it. The content is counter-skewed to keep the art
        upright, which leaves wedges of its own background uncovered at two
        corners however much bleed it is given; painting the backdrop on the
        parallelogram fills it exactly, by construction.
      */}
      <div
        className={`combatcard combatcard--${side}${dormant ? ' combatcard--dormant' : ''}`}
        style={{ backgroundImage: `url('${elementBackground(element)}')` }}
      >
      <button
        type="button"
        className="combatcard__hit"
        onClick={onOpen}
        title={`${classname} — details`}
      >
        <span className="combatcard__art">
          <img
            className="combatcard__fighter"
            src={art ?? fighterArt({ classname, racename })}
            alt={`${classname} ${racename}`}
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget
              if (img.dataset.fallback) return
              img.dataset.fallback = "1"
              img.src = fighterArtFallback()
            }}
          />
          {element && (
            <img
              className="combatcard__element"
              src={asset(`/assets/icons/elements/${element}.png`)}
              alt={element}
              title={element}
              width={20}
              height={20}
            />
          )}
          {badge && <span className="combatcard__badge">{badge}</span>}
          {level !== undefined && level > 0 && (
            <span className="combatcard__level">
              {/*
                The L is dropped on a phone. It is a sixth of the chip's width
                spent on a letter that the chip's own corner already says, and
                at six cards to a row that sixth is what put "L10" over the
                element mark opposite it.
              */}
              <span className="combatcard__levelL">L</span>
              {level}
            </span>
          )}
        </span>

        <span className="combatcard__plate">
          {/*
            Never empty.

            The plate is a grid, and a span with no text contributes no line
            box at all — so a nameless fighter loses a whole row and every
            other card in the line-up sits higher than it should. The
            dungeon's own NFT fighter is exactly that case:
            `getFighterFromNFT` leaves it with no class or race, because no
            crew row on chain carries either.
          */}
          <span className="combatcard__name">{classname || racename || 'Fighter'}</span>
          {owner && <span className="combatcard__owner">{owner}</span>}
          {/*
            Damage first, health second, here and everywhere else a pair of
            them is printed. Damage is what a player is choosing on - it is
            the number the elements move, the number the matchup badges
            qualify, and the one that decides whether a fighter belongs in
            this fight; health is how long it keeps doing it.
          */}
          <span className="combatcard__stats mono">
            <span className="combatcard__dmg">{formatScaled(damage)}</span>
            <span className="combatcard__hp">{formatScaled(health)}</span>
          </span>
          {/*
            Rendered whenever there is an opposing line to read, even when
            both counts are zero.

            The plate is what paints the dark band over the bottom of the
            art, so a card that dropped this row painted a shorter band than
            the ones beside it and the whole line-up looked ragged along the
            bottom. An empty row costs nothing to look at; an uneven band is
            immediately visible.
          */}
          {!phone && counts}
        </span>
      </button>

      {/*
         A child of the card, not of the artwork.

         `.combatcard__art` is 124% of the card wide - that overhang is what
         covers the wedges the lean leaves - so a strip spanning the art hung
         outside the card on both sides and the card clipped the ends off the
         words. Spanning the card instead means it spans what you can see.
         Counter-skewed for the same reason every other direct child is.
      */}
      {dormant && <span className="combatcard__dormant">{dormant}</span>}
      </div>

      {/*
        The ability counts, under the card rather than on it.

        The row is rendered whether or not it has anything to say. It is
        what makes every slot in a line-up the same height, and a slot that
        skipped it grew to fill the row on its own — which is what the NFT
        fighter, alone in never being given counts, was doing.
      */}
      {phone && <div className="combatslot__under">{counts}</div>}

      {/*
        Undo, at the thing it undoes.

        Taking a fighter out meant finding it again in the picker below and
        tapping it a second time — a list of a hundred, filtered and sorted
        for choosing rather than for finding one particular card, and on a
        phone it is not even on screen. The line-up is where a player decides
        somebody does not belong; the control belongs there too.

        A bar rather than a corner cross: at six cards to a row the card is
        58px wide on a phone, and a floating × over the artwork is both a
        smaller target and something to mistake for part of the portrait. It
        stays upright while the card leans, for the same reason the ability
        chips out here do — skewing a 20px bar shifts its edges by under a
        pixel while the card's bottom edge moves by six, so a matching lean
        would only look like a misalignment.
      */}
      {onRemove && (
        <button
          type="button"
          className="combatslot__remove"
          onClick={onRemove}
          aria-label={`Remove ${classname || 'this fighter'} from your team`}
          title={`Remove ${classname || 'this fighter'} from your team`}
        >
          <span aria-hidden="true">×</span>
          {/* The word is desktop-only: 58px does not hold it, and the cross
              on a red bar under a chosen fighter is not ambiguous. */}
          <span className="combatslot__removeword">Remove</span>
        </button>
      )}
    </div>
  )
}

/* ---------- filters ---------- */

/**
 * The filter bar, following the live site's controls rather than a search box.
 *
 * Element is a row of toggles because it is the one axis players think in
 * sets about — "show me fire and metal" — while class, race and status are
 * single choices and belong in pickers. Ability stays free text because it
 * genuinely is.
 */
export function RosterFilters({
  filter,
  onChange,
  roster,
  omit = [],
  versus,
}: {
  filter: RosterFilter
  onChange: (f: RosterFilter) => void
  roster: RosterFighter[]
  /**
   * What the fighters are being measured against, when there is an opponent.
   *
   * Its presence is what turns on the matchup controls and sorts: the roster
   * screen has nobody to compare to, and a filter that cannot change the
   * result is worse than a missing one. The tallies are shown beside the
   * controls so a player can see *why* a fighter scores badly here without
   * opening five enemy cards.
   */
  versus?: {
    elements: { name: string; count: number }[]
    classes: { name: string; count: number }[]
  }
  /**
   * Controls this screen has no use for.
   *
   * The roster and the market ask overlapping but not identical questions,
   * and a control that cannot change the result is worse than a missing one:
   * it looks like it works. The market drops `status` — every listing is
   * stamped "Market", so four of the five options match nothing and the fifth
   * matches everything — and `sort`, which it overrides with its own.
   */
  omit?: ('status' | 'sort' | 'markers')[]
}) {
  const { classes, races } = useMemo(() => facetsOf(roster), [roster])

  /*
     Only markers this roster actually carries, counted.

     There are thirty in the vocabulary and a player uses two or three, so
     offering all of them is twenty-seven switches that match nothing — and
     the count doubles as the answer to "how many did I mark".
  */
  const usedMarkers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of roster) {
      if (f.marker) counts.set(f.marker, (counts.get(f.marker) ?? 0) + 1)
    }
    return counts
  }, [roster])
  const set = (patch: Partial<RosterFilter>) => onChange({ ...filter, ...patch })

  /*
     On a phone the controls are folded away behind a button.

     Nine controls and a matchup read-out is a screenful and a half before a
     single fighter is visible, on the screen whose whole job is showing
     fighters. They are worth that room on a desktop, where they sit beside
     the grid rather than on top of it, so this is a phone-only fold and the
     button does not exist at all above the breakpoint.

     The count of what is switched on rides on the button, because a hidden
     filter that is still filtering leaves a short grid with nothing on screen
     to explain it.
  */
  const phone = usePhone()
  const [open, setOpen] = useState(false)
  const active = countActiveFilters(filter)
  const folded = phone && !open

  const toggleElement = (el: Element) =>
    set({
      elements: filter.elements.includes(el)
        ? filter.elements.filter((e) => e !== el)
        : [...filter.elements, el],
    })

  return (
    <div className={`filters${folded ? ' filters--folded' : ''}`}>
      {phone && (
        <button
          type="button"
          className="filters__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="filters__togglelabel">Filters</span>
          {active > 0 && <span className="filters__badge">{active}</span>}
          <span className="filters__chev" aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        </button>
      )}

      {/*
         Markers first, because a player who has labelled a fighter is
         looking for that fighter, and every other control here is a way of
         describing one you have not found yet.

         Offered only where the roster is your own — a marker is private,
         and a market listing carries none, so on those tabs it would be a
         row of switches that match nothing.
      */}
      {!omit.includes('markers') && usedMarkers.size > 0 && (
        <div className="filters__markers" role="group" aria-label="Marker">
          {MARKERS.filter((m) => usedMarkers.has(m)).map((m) => (
            <button
              type="button"
              key={m || 'none'}
              className="markbtn"
              aria-pressed={filter.markers.includes(m)}
              onClick={() =>
                set({
                  markers: filter.markers.includes(m)
                    ? filter.markers.filter((x) => x !== m)
                    : [...filter.markers, m],
                })
              }
              title={`${m} — ${usedMarkers.get(m)} fighter${usedMarkers.get(m) === 1 ? '' : 's'}`}
            >
              <img src={markerIcon(m)} alt={m} />
              <span className="markbtn__count">{usedMarkers.get(m)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="filters__elements" role="group" aria-label="Element">
        {ELEMENTS.map((el) => (
          <button
            type="button"
            key={el}
            className="elembtn"
            aria-pressed={filter.elements.includes(el)}
            onClick={() => toggleElement(el)}
            title={el}
          >
            <img src={asset(`/assets/icons/elements/${el}.png`)} alt={el} />
          </button>
        ))}
      </div>

      <div className="filters__row">
        <label className="field">
          <span className="field__label">Class</span>
          <select
            className="input"
            value={filter.classname}
            onChange={(e) => set({ classname: e.target.value })}
          >
            <option value="">Any</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Race</span>
          <select
            className="input"
            value={filter.racename}
            onChange={(e) => set({ racename: e.target.value })}
          >
            <option value="">Any</option>
            {races.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {!omit.includes('status') && (
          <label className="field">
            <span className="field__label">Status</span>
            <select
              className="input"
              value={filter.status}
              onChange={(e) => set({ status: e.target.value as Status })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}

        {!omit.includes('sort') && (
          <label className="field">
            <span className="field__label">Sort by</span>
            <select
              className="input"
              value={filter.sort}
              onChange={(e) => set({ sort: e.target.value })}
            >
              {versus && (
                <optgroup label="Against this team">
                  {VERSUS_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field field--grow">
          <span className="field__label">Ability</span>
          <input
            className="input"
            placeholder="Search ability names"
            value={filter.ability}
            onChange={(e) => set({ ability: e.target.value })}
          />
        </label>

        {isFilterActive(filter) && (
          <button
            type="button"
            className="btn btn--ghost btn--sm filters__clear"
            onClick={() => onChange({ ...EMPTY_FILTER, sort: filter.sort })}
          >
            Clear
          </button>
        )}
      </div>

      {/*
        The matchup controls.

        The elemental system decides a great deal of a fight and the setup
        screen never mentioned it: damage is cut by the defender's resistance
        to the attacker's element, and a good many abilities only fire against
        a particular class, race or element. So the same fighter is excellent
        against one dungeon and useless against the next, and nothing on its
        card says which. These ask the three questions that answer separately
        - who can hurt them, who can survive them, whose abilities fire.
      */}
      {versus && (
        <div className="matchupbar">
          <p className="matchupbar__who">
            <span className="matchupbar__label">They field</span>
            {versus.elements.map((e) => (
              <span className="matchupbar__tally" key={e.name} title={e.name}>
                <img src={asset(`/assets/icons/elements/${e.name}.png`)} alt={e.name} width={14} height={14} />
                {e.count}
              </span>
            ))}
            {versus.classes.length > 0 && (
              <span className="matchupbar__classes">
                {versus.classes.map((c) => `${c.count}\u00d7 ${c.name}`).join(' \u00b7 ')}
              </span>
            )}
          </p>

          <div className="filters__row">
            <label className="field">
              <span className="field__label">Damage lands</span>
              <select
                className="input"
                value={filter.versus?.offense ?? 0}
                onChange={(e) =>
                  set({
                    versus: { ...(filter.versus ?? NO_VERSUS), offense: Number(e.target.value) },
                  })
                }
                title="Share of this fighter's damage that survives the enemy's resistance to its element"
              >
                <option value={0}>Any</option>
                <option value={50}>50% or more</option>
                <option value={65}>65% or more</option>
                <option value={80}>80% or more</option>
                <option value={95}>95% or more</option>
              </select>
            </label>

            <label className="field">
              <span className="field__label">Damage blocked</span>
              <select
                className="input"
                value={filter.versus?.defense ?? 0}
                onChange={(e) =>
                  set({
                    versus: { ...(filter.versus ?? NO_VERSUS), defense: Number(e.target.value) },
                  })
                }
                title="Share of the enemy's damage this fighter's resistances turn away, across their elements"
              >
                <option value={0}>Any</option>
                <option value={20}>20% or more</option>
                <option value={35}>35% or more</option>
                <option value={50}>50% or more</option>
                <option value={65}>65% or more</option>
              </select>
            </label>

            <label className="field">
              <span className="field__label">Ability bonuses</span>
              <select
                className="input"
                value={filter.versus?.bonuses ?? 0}
                onChange={(e) =>
                  set({
                    versus: { ...(filter.versus ?? NO_VERSUS), bonuses: Number(e.target.value) },
                  })
                }
                title="Abilities that fire because of who is on the other side"
              >
                <option value={0}>Any</option>
                <option value={1}>At least 1</option>
                <option value={2}>At least 2</option>
                <option value={3}>At least 3</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- filtering on how well a fighter rolled ---------- */

/**
 * Stat-quality floors, stacked.
 *
 * The market's own filter, and the one the roster never needed: everything
 * above narrows *which* fighters are listed, this narrows how good they are.
 * Rules are added one at a time and AND together, so "green damage" and "at
 * least average fire resistance" is one search rather than two.
 */
/**
 * Stat floors, stacked.
 *
 * The market's own filter, and the one the roster never needed: everything
 * above narrows *which* fighters are listed, this narrows how good they are.
 * Rules AND together, so "green damage" and "at least 40 taunt" is one search
 * rather than two passes.
 *
 * The second control changes shape with the stat, because the stats do not
 * all answer the same way. Ten of them have a grade and take one; taunt does
 * not and takes a number. Putting taunt in its own bar said they were
 * different questions, and to a buyer they are the same question with
 * different units.
 */
/**
 * Why the two ungraded stats take a number rather than an arrow.
 *
 * Worth saying: a player who has learnt to read the arrows would otherwise
 * read their absence here as an omission rather than as the point.
 */
function numberNote(stat: string): string {
  return stat === 'age'
    ? 'Condition rather than a roll: +100% is untouched, 0% has lost half its stats.'
    : 'Taunt has no quality arrow — high suits a tank, low keeps a fighter out of the way — so it takes a number instead.'
}

export function QualityFilters({
  filter,
  onChange,
}: {
  filter: RosterFilter
  onChange: (f: RosterFilter) => void
}) {
  const rules = filter.qualities ?? []
  const [stat, setStat] = useState(FILTER_STATS[0].field)
  const [grade, setGrade] = useState<StatGrade>('green-up')
  /* Taunt and age live on different scales, so the box starts somewhere
     useful for whichever is picked rather than on one number for both. */
  const [value, setValue] = useState('40')

  const graded = isGradedStat(stat)
  const label = (field: string) =>
    FILTER_STATS.find((g) => g.field === field)?.label ?? field

  const add = () => {
    const min: StatGrade | number = graded
      ? grade
      : Math.max(0, Math.floor(Number(value) || 0))
    /* One rule per stat: two floors on the same stat is just the higher one. */
    const kept = rules.filter((r) => r.stat !== stat)
    onChange({ ...filter, qualities: [...kept, { stat, min }] })
  }

  const drop = (rule: QualityRule) =>
    onChange({ ...filter, qualities: rules.filter((r) => r.stat !== rule.stat) })

  return (
    <div className="qfilter">
      <div className="qfilter__add">
        {/*
          "Roll" alone on a phone. Spelled out the label wrapped to two lines
          and took fifty pixels to name a hundred and forty of controls, which
          came off the two selects it was naming — and "Roll ≥ Good for this
          class" is the same sentence with the same meaning.
        */}
        <span className="qfilter__lead">
          Roll<span className="qfilter__leadLong"> quality</span>
        </span>

        <select
          className="input qfilter__stat"
          value={stat}
          onChange={(e) => {
            const next = e.target.value
            setStat(next)
            if (!isGradedStat(next)) setValue(next === 'age' ? '80' : '40')
          }}
          aria-label="Stat"
        >
          {FILTER_STATS.map((g) => (
            <option key={g.field} value={g.field}>
              {g.label}
            </option>
          ))}
        </select>

        {/*
          "at least" in full where there is room for it, the symbol where
          there is not — a phone spends a third of this row on two words that
          the comparison either side of them already implies.
        */}
        <span className="qfilter__at">
          <span className="qfilter__atLong">at least</span>
          <span className="qfilter__atShort" aria-hidden="true">
            ≥
          </span>
        </span>

        {graded ? (
          <select
            className="input qfilter__grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value as StatGrade)}
            aria-label="Minimum grade"
          >
            {/* Best first: the useful end of the scale is the top of it. */}
            {[...GRADE_ORDER].reverse().map((g) => (
              <option key={g} value={g}>
                {GRADE_LABEL[g]}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input qfilter__num"
            type="number"
            /* Age bonus runs down to -100, so this one is not floored at 0. */
            min={stat === 'age' ? -100 : 0}
            inputMode="numeric"
            value={value}
            /* Also the note beside it, which a phone has no room to print. */
            aria-label={`Minimum ${label(stat)}. ${numberNote(stat)}`}
            title={numberNote(stat)}
            onChange={(e) => setValue(e.target.value)}
          />
        )}

        <button type="button" className="btn btn--ghost btn--sm" onClick={add}>
          Add
        </button>

        {!graded && <span className="qfilter__note">{numberNote(stat)}</span>}
      </div>

      {rules.length > 0 && (
        <div className="qfilter__rules">
          {rules.map((r) => (
            <button
              type="button"
              className="qfilter__rule"
              key={r.stat}
              onClick={() => drop(r)}
              title="Remove this rule"
            >
              {typeof r.min === 'number' ? (
                <span className="qfilter__min mono">
                  {r.min}
                  {r.stat === 'age' ? '%+' : '+'}
                </span>
              ) : (
                <img className="qfilter__arrow" src={GRADE_ICON[r.min]} alt="" />
              )}
              {label(r.stat)}
              <span className="qfilter__x" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onChange({ ...filter, qualities: [] })}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- the roster ---------- */

export function FighterGrid({
  roster,
  filter,
  ageDecay,
  teamIds,
  full,
  levelMod = 1,
  matchups,
  onToggle,
  onInspect,
}: {
  roster: RosterFighter[] | null
  filter: RosterFilter
  ageDecay: number
  /**
   * Per-level growth, so the card can show a fighter as it will be fielded.
   *
   * Defaults to 1 — no growth — rather than being required, so a caller with
   * no battle config loaded shows stored stats instead of nothing at all.
   */
  levelMod?: number
  /**
   * How each fighter fares against the team on the other side.
   *
   * Shown on every card rather than only when filtered on, because the point
   * is to make the elemental system visible - a player who has to switch a
   * filter on to discover that half their roster cannot hurt this dungeon has
   * already been failed by the screen.
   */
  matchups?: Map<number, Matchup>
  teamIds: number[]
  full: boolean
  onToggle: (f: RosterFighter) => void
  onInspect: (f: RosterFighter) => void
}) {
  const shown = useMemo(
    () =>
      roster ? applyFilter(roster, filter, ageDecay, undefined, undefined, matchups) : [],
    [roster, filter, ageDecay, matchups],
  )

  if (!roster) {
    return (
      <div className="fightergrid">
        {Array.from({ length: 10 }, (_, i) => (
          <div className="skeleton fightercard fightercard--loading" key={i} />
        ))}
      </div>
    )
  }

  if (shown.length === 0) {
    return (
      <p className="faint">
        {roster.length === 0
          ? 'No fighters in this wallet yet. Hire one at a tavern.'
          : 'No fighters match those filters.'}
      </p>
    )
  }

  return (
    <>
      <p className="faint picker__count">
        Showing {shown.length} of {roster.length}
      </p>
      <div className="fightergrid">
        {shown.map((f) => {
          const state = fighterAvailable(f)
          const inTeam = teamIds.includes(f.fighter_id)
          const blocked = !state.available || (full && !inTeam)

          /*
             The numbers this fighter will actually bring, not the ones stored
             on its row.

             `apply_weather_and_age` scales health and damage by the fighter's
             own level and by `age_decay ^ (days²)` before the first blow. The
             picker used to print the stored roll while the line-up beside it
             printed the fielded figure, so a fighter changed its numbers the
             moment it was picked. Same arithmetic as the line-up, so the two
             now agree exactly.
          */
          const age = ageFactor(f.creation_date, ageDecay)
          const factor = levelFactor(f.stats.level, levelMod) * age
          const health = Math.trunc(mid(f.stats.health_min, f.stats.health_max) * factor)
          const damage = Math.trunc(mid(f.stats.damage_min, f.stats.damage_max) * factor)
          const bonus = ageBonus(f, ageDecay)

          return (
            <div
              className={
                'fightercard' +
                (inTeam ? ' fightercard--picked' : '') +
                (blocked ? ' fightercard--off' : '')
              }
              key={f.fighter_id}
            >
              <button
                type="button"
                className="fightercard__hit"
                onClick={() => onToggle(f)}
                disabled={blocked}
                title={
                  state.available
                    ? inTeam
                      ? 'Remove from team'
                      : full
                        ? 'Your team is full'
                        : 'Add to team'
                    : state.reason
                }
              >
                <Portrait
                  element={f.element}
                  classname={f.classname}
                  racename={f.racename}
                />
                <span className="fightercard__name">{f.classname}</span>
                <span className="fightercard__meta">
                  {f.racename} · L{f.stats.level}
                  {/*
                    Age, beside level, because they are the two things scaling
                    the figures underneath — and the only one of the two that
                    can quietly halve a fighter while the player is not
                    watching. The scale is the live game's, +100% down to
                    -100%, so it reads the same here as on the roster.
                  */}
                  {ageDecay > 0 && (
                    <span
                      className={`fightercard__age fightercard__age--${ageBand(bonus)}`}
                      title={ageNote(bonus, ageDays(f), age)}
                    >
                      {bonus > 0 ? '+' : ''}
                      {bonus.toFixed(0)}%
                    </span>
                  )}
                </span>
                <span
                  className="fightercard__stats mono"
                  title={`As fielded: level ${f.stats.level} and ${ageDays(f)} days of age already applied (×${factor.toFixed(3)} of the roll)`}
                >
                  {formatScaled(damage)} DMG · {formatScaled(health)} HP
                </span>
                <VersusBadges matchup={matchups?.get(f.fighter_id)} />
                {inTeam && <span className="fightercard__tick">In team</span>}
                {!state.available && (
                  <span className="fightercard__block">{state.reason}</span>
                )}
              </button>
              {/*
                 The marker a player put on this fighter.

                 It is a private label, set on the roster screen and used
                 for exactly this — finding a fighter again in a grid of
                 forty while picking a team. It was drawn only on the screen
                 where it is set, which is the one screen where you already
                 know which fighter you are looking at.

                 Not a control here: the roster screen owns setting it, and
                 a second way to change it inside a team picker would be a
                 mis-tap away from re-labelling a fighter you meant to
                 field.
              */}
              {!!f.marker && (
                <span
                  className="fightercard__marker"
                  title={`Marked ${f.marker}`}
                  aria-label={`Marked ${f.marker}`}
                >
                  <img src={markerIcon(f.marker)} alt="" width={16} height={16} />
                </span>
              )}

              <button
                type="button"
                className="fightercard__info"
                onClick={() => onInspect(f)}
                aria-label={`Details for ${f.classname}`}
              >
                i
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

/**
 * The three matchup numbers, on a roster card.
 *
 * Percentages rather than a single grade, because the two halves pull apart:
 * a fighter can land everything and die immediately, or block everything and
 * tickle. Collapsing that into one letter would hide the choice the player is
 * making.
 */
function VersusBadges({ matchup }: { matchup?: Matchup }) {
  if (!matchup) return null
  const atk = Math.round(matchup.offense * 100)
  const def = Math.round(matchup.defense * 100)
  return (
    <span className="vsbadges">
      <span
        className={`vsbadge vsbadge--${atk >= 80 ? 'good' : atk >= 55 ? 'fair' : 'poor'}`}
        title={`${atk}% of this fighter's damage gets past their resistances`}
      >
        <img src={asset("/assets/icons/swords.svg")} alt="Damage lands" width={11} height={11} />
        {atk}%
      </span>
      <span
        className={`vsbadge vsbadge--${def >= 45 ? 'good' : def >= 25 ? 'fair' : 'poor'}`}
        title={`${def}% of their damage is turned away by this fighter's resistances`}
      >
        <img src={asset("/assets/icons/shield.svg")} alt="Damage blocked" width={11} height={11} />
        {def}%
      </span>
      {matchup.bonuses > 0 && (
        <span
          className="vsbadge vsbadge--bonus"
          title={`Fires against this team: ${matchup.bonusNames.join(', ')}`}
        >
          <img src={asset("/assets/icons/medal.svg")} alt="Ability bonuses" width={11} height={11} />
          {matchup.bonuses}
        </span>
      )}
      {/*
        The same trade, seen from their side.

        Ability conditions are symmetric — a dungeon fighter can carry
        "against fire" exactly as readily as yours can — so a pick can be the
        reason the enemy gets extra firings. Showing only the half that
        flatters the player would make the screen an advocate rather than an
        instrument.
      */}
      {matchup.exposure > 0 && (
        <span
          className="vsbadge vsbadge--exposed"
          title={`Picking this fighter switches on, for them: ${matchup.exposureNames.join(', ')}`}
        >
          <img src={asset("/assets/icons/exclamation.svg")} alt="Gives them" width={11} height={11} />
          {matchup.exposure}
        </span>
      )}
    </span>
  )
}

/* ---------- crew and weapons ---------- */

export function CardSlot({
  label,
  card,
  onClear,
  onOpen,
}: {
  label: string
  card: CardTemplate | null
  onClear: () => void
  onOpen: () => void
}) {
  return (
    <div className={`cardslot${card ? ' cardslot--filled' : ''}`}>
      <span className="cardslot__label">{label}</span>
      {card ? (
        <>
          <button type="button" className="cardslot__open" onClick={onOpen}>
            <img
              className="cardslot__art"
              src={asset(`/assets/cards/${card.template_id}.webp`)}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = asset('/assets/default-card.png')
              }}
            />
            <span className="cardslot__name">{card.name}</span>
          </button>
          <button type="button" className="slot__remove" onClick={onClear}>
            Remove
          </button>
        </>
      ) : (
        <span className="cardslot__empty">
          Pick one from the {label.toLowerCase()} tab
        </span>
      )}
    </div>
  )
}

/**
 * The card grid.
 *
 * Each tile carries what the card actually contributes — the health and
 * damage it adds to your sixth fighter, and how many abilities it brings —
 * because that, not the artwork, is what the choice turns on.
 */
export function CardGrid({
  cards,
  values,
  query,
  onQuery,
  selected,
  onPick,
  onInspect,
  kind,
}: {
  cards: CardTemplate[]
  values: Map<number, NftValue>
  query: string
  onQuery: (q: string) => void
  selected: CardTemplate | null
  onPick: (c: CardTemplate) => void
  onInspect: (c: CardTemplate) => void
  kind: 'crew' | 'weapon'
}) {
  const [rarity, setRarity] = useState('')
  const [element, setElement] = useState('')
  /* Best cards first, which is the order a player looks for them in. */
  const [sort, setSort] = useState<'damage' | 'health' | 'rarity'>('rarity')

  const rarities = useMemo(
    () =>
      [...new Set(cards.map((c) => values.get(c.template_id)?.rarity ?? ''))]
        .filter(Boolean)
        .sort((a, b) => rarityRank(a) - rarityRank(b)),
    [cards, values],
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cards
      .filter((c) => {
        const v = values.get(c.template_id)
        if (!v) return false
        if (rarity && v.rarity !== rarity) return false
        if (element && v.element !== element) return false
        if (q && !c.name.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        const av = values.get(a.template_id)!
        const bv = values.get(b.template_id)!
        if (sort === 'rarity') return byQuality(av, bv)
        /* Same numbers, better card first. */
        return bv.stats[sort] - av.stats[sort] || byQuality(av, bv)
      })
  }, [cards, values, query, rarity, element, sort])

  if (cards.length === 0) {
    return (
      <p className="faint">
        No usable {kind === 'crew' ? 'crew' : 'weapon'} cards in this wallet. A
        dungeon run needs one of each.
      </p>
    )
  }

  return (
    <>
      <div className="filters">
        <div className="filters__row">
          <label className="field">
            <span className="field__label">Rarity</span>
            <select
              className="input"
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
            >
              <option value="">Any</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Element</span>
            <select
              className="input"
              value={element}
              onChange={(e) => setElement(e.target.value)}
            >
              <option value="">Any</option>
              {ELEMENTS.map((el) => (
                <option key={el} value={el}>
                  {el}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Sort by</span>
            <select
              className="input"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="damage">Damage added</option>
              <option value="health">Health added</option>
              <option value="rarity">Rarity &amp; shine</option>
            </select>
          </label>

          <label className="field field--grow">
            <span className="field__label">Name</span>
            <input
              className="input"
              placeholder="Search card names"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
            />
          </label>
        </div>
      </div>

      <p className="faint picker__count">
        Showing {shown.length} of {cards.length}
        {kind === 'weapon' && ' · the weapon decides your NFT fighter’s element'}
      </p>

      {shown.length === 0 ? (
        <p className="faint">No cards match those filters.</p>
      ) : (
        <div className="cardgrid">
          {shown.map((c) => {
            const v = values.get(c.template_id)!
            const abilities = v.ability?.length ?? 0
            return (
              <div
                className={`nftcard${selected?.template_id === c.template_id ? ' nftcard--picked' : ''}`}
                key={c.template_id}
              >
                <button
                  type="button"
                  className="nftcard__hit"
                  onClick={() => onPick(c)}
                >
                  <img
                    className="nftcard__art"
                    src={asset(`/assets/cards/${c.template_id}.webp`)}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = asset('/assets/default-card.png')
                    }}
                  />
                  <span className="nftcard__name">{c.name}</span>
                  <span className={`nftcard__rarity nftcard__rarity--${v.rarity}`}>
                    {v.rarity}
                    {v.shine && v.shine !== 'stone' ? ` · ${v.shine}` : ''}
                  </span>
                  <span className="nftcard__stats mono">
                    +{formatScaled(v.stats.damage)} DMG · +{formatScaled(v.stats.health)} HP
                  </span>
                  {v.element && (
                    <span className="nftcard__element">
                      <img
                        src={asset(`/assets/icons/elements/${v.element}.png`)}
                        alt=""
                        width={14}
                        height={14}
                      />
                      {v.element}
                    </span>
                  )}
                  {abilities > 0 && (
                    <span className="nftcard__abilities">
                      {abilities} {abilities === 1 ? 'ability' : 'abilities'}
                    </span>
                  )}
                  {c.owned > 1 && <span className="cardtile__count">×{c.owned}</span>}
                </button>
                <button
                  type="button"
                  className="fightercard__info"
                  onClick={() => onInspect(c)}
                  aria-label={`Details for ${c.name}`}
                >
                  i
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ---------- detail overlay ---------- */

export function DetailSheet({
  panel,
  template,
  onClose,
}: {
  panel: PanelFighter
  template?: ClassTemplate
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="sheet" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="sheet__panel panel sheet__panel--fighter"
        onClick={(e) => e.stopPropagation()}
      >
        <FighterPanel fighter={panel} template={template} />
        <div className="confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
