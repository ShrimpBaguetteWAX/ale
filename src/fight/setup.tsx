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
  isFilterActive,
  type Element,
  type RosterFilter,
  type Status,
} from '@/dungeon/filters'
import type { Matchup } from '@/fight/matchup'
import { rarityRank, type NftValue } from '@/dungeon/nftFighter'
import type { BattleFighter, RosterFighter } from '@/dungeon/types'
import {
  elementBackground,
  fighterArt,
  fighterArtFallback,
  formatScaled,
  type ClassTemplate,
} from '@/tavern/fighterStats'
import { asset } from '@/assets'

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

export function rosterPanel(f: RosterFighter): PanelFighter {
  const s = f.stats
  return {
    classname: f.classname,
    racename: f.racename,
    element: f.element,
    target: s.target,
    level: s.level,
    health: { min: s.health_min, max: s.health_max },
    damage: { min: s.damage_min, max: s.damage_max },
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
  onRemove?: () => void
}) {
  return (
    /*
      The elemental backdrop sits on the skewed card itself, not on the
      content inside it. The content is counter-skewed to keep the art
      upright, which leaves wedges of its own background uncovered at two
      corners however much bleed it is given; painting the backdrop on the
      parallelogram fills it exactly, by construction.
    */
    <div
      className={`combatcard combatcard--${side}`}
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
            <span className="combatcard__level">L{level}</span>
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
          <span className="combatcard__stats mono">
            <span className="combatcard__hp">{formatScaled(health)}</span>
            <span className="combatcard__dmg">{formatScaled(damage)}</span>
          </span>
          {/*
            Rendered whenever there is an opposing line to read, even when both
            counts are zero.

            The plate is what paints the dark band over the bottom of the art,
            so a card that dropped this row painted a shorter band than the
            ones beside it and the whole line-up looked ragged along the
            bottom. An empty row costs nothing to look at; an uneven band is
            immediately visible.
          */}
          {!!abilities && (
            <span className="combatcard__vs">
              {abilities.bonuses > 0 && (
                <span
                  className="combatcard__vsbit combatcard__vsbit--bonus"
                  title={`Fires here: ${abilities.bonusNames.join(', ')}`}
                >
                  <img src={asset("/assets/icons/medal.svg")} alt="" width={10} height={10} />
                  {abilities.bonuses}
                </span>
              )}
              {abilities.exposure > 0 && (
                <span
                  className="combatcard__vsbit combatcard__vsbit--exposed"
                  title={`Switches on for the other side: ${abilities.exposureNames.join(', ')}`}
                >
                  <img src={asset("/assets/icons/exclamation.svg")} alt="" width={10} height={10} />
                  {abilities.exposure}
                </span>
              )}
            </span>
          )}
        </span>
      </button>

      {onRemove && (
        <button
          type="button"
          className="combatcard__remove"
          onClick={onRemove}
          aria-label={`Remove ${classname}`}
          title="Remove from team"
        >
          ×
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
  omit?: ('status' | 'sort')[]
}) {
  const { classes, races } = useMemo(() => facetsOf(roster), [roster])
  const set = (patch: Partial<RosterFilter>) => onChange({ ...filter, ...patch })

  const toggleElement = (el: Element) =>
    set({
      elements: filter.elements.includes(el)
        ? filter.elements.filter((e) => e !== el)
        : [...filter.elements, el],
    })

  return (
    <div className="filters">
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
                  {formatScaled(health)} HP · {formatScaled(damage)} DMG
                </span>
                <VersusBadges matchup={matchups?.get(f.fighter_id)} />
                {inTeam && <span className="fightercard__tick">In team</span>}
                {!state.available && (
                  <span className="fightercard__block">{state.reason}</span>
                )}
              </button>
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
  const [sort, setSort] = useState<'damage' | 'health' | 'rarity'>('damage')

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
        if (sort === 'rarity') {
          return rarityRank(bv.rarity) - rarityRank(av.rarity)
        }
        return bv.stats[sort] - av.stats[sort]
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
              <option value="rarity">Rarity</option>
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
                    +{formatScaled(v.stats.health)} HP · +{formatScaled(v.stats.damage)} DMG
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
