import { useCallback, useRef, useState } from 'react'
import type { CardTemplate } from '@/chain/atomic'
import type { NftValue } from '@/dungeon/nftFighter'
import { EMPTY_FILTER, type RosterFilter } from '@/dungeon/filters'
import { TEAM_SIZE, type RosterFighter } from '@/dungeon/types'
import { useSwipeToClose } from '@/components/useSwipeToClose'
import {
  CardGrid,
  FighterGrid,
  RosterFilters,
  recallDensity,
  rememberDensity,
  type PickDensity,
  type Tab,
} from '@/fight/setup'

/**
 * The roster, as a sheet over the screen — the phone's way of picking a team.
 *
 * The dungeon's own sheet, markup and all, for any screen that fields five
 * fighters and a card pair without an opponent to measure them against:
 * Fighters, Crew and Weapons as the tabs in its head, the card size a player
 * chose last time, and Done at the foot. Kept mounted and slid in and out by
 * the `.picker--sheet` rules, so it opens where it was left.
 */
export function PickerSheet({
  open,
  onClose,
  tab,
  onTab,
  roster,
  teamIds,
  onToggle,
  onInspect,
  levelMod,
  ageDecay,
  crewCards,
  weaponCards,
  values,
  crew,
  weapon,
  onCrew,
  onWeapon,
  onInspectCard,
  inline = false,
}: {
  open: boolean
  onClose: () => void
  tab: Tab
  onTab: (t: Tab) => void
  roster: RosterFighter[] | null
  teamIds: number[]
  onToggle: (f: RosterFighter) => void
  onInspect: (f: RosterFighter) => void
  levelMod: number
  ageDecay: number
  crewCards: CardTemplate[]
  weaponCards: CardTemplate[]
  values: Map<number, NftValue>
  crew: CardTemplate | null
  weapon: CardTemplate | null
  onCrew: (c: CardTemplate) => void
  onWeapon: (c: CardTemplate) => void
  onInspectCard: (c: CardTemplate) => void
  /** On the page, as a desktop has it: the panel with its tabs, no sheet. */
  inline?: boolean
}) {
  const [filter, setFilter] = useState<RosterFilter>(EMPTY_FILTER)
  const [atLevelOne, setAtLevelOne] = useState(false)
  const [cardQuery, setCardQuery] = useState('')
  const [shownCount, setShownCount] = useState<{ shown: number; total: number } | null>(null)
  /* A desktop starts on the full cards — their numbers and quality marks are the point of the room. */
  /* Compact cards by default, on a desktop as on the phone. */
  const [density, setDensity] = useState<PickDensity>(() => (inline ? 'compact' : recallDensity(true)))
  const chooseDensity = (next: PickDensity) => {
    setDensity(next)
    rememberDensity(next, true)
  }
  const countFighters = useCallback(
    (shown: number, total: number) =>
      setShownCount((c) => (c && c.shown === shown && c.total === total ? c : { shown, total })),
    [],
  )
  const sheet = useRef<HTMLElement>(null)
  const { grip } = useSwipeToClose(onClose, sheet)
  const picked = teamIds.length

  return (
    <>
      {open && !inline && <div className="picker__scrim" onClick={onClose} aria-hidden="true" />}
      <section
        className={inline ? 'panel picker picker--inline' : `panel picker picker--sheet${open ? ' picker--open' : ''}`}
        ref={sheet}
        aria-hidden={open || inline ? undefined : true}
      >
        {inline ? (
          <div className="tabs" role="tablist">
            {(
              [
                ['fighters', 'Fighters'],
                ['crew', 'Crew'],
                ['weapon', 'Weapons'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                role="tab"
                className="tabs__tab"
                aria-selected={tab === key}
                onClick={() => onTab(key)}
              >
                {label}
                <span className="tabs__count">
                  {key === 'fighters'
                    ? `${picked}/${TEAM_SIZE}`
                    : (key === 'crew' ? crewCards : weaponCards).length}
                </span>
              </button>
            ))}
          </div>
        ) : (
        <div className="picker__sheethead" {...grip}>
          {/* The tabs are the title: they already say what is being chosen. */}
          <div className="picker__sheettabs" role="tablist">
            {(
              [
                ['fighters', 'Fighters'],
                ['crew', 'Crew'],
                ['weapon', 'Weapons'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                role="tab"
                className="picker__sheettab"
                aria-selected={tab === key}
                onClick={() => onTab(key)}
              >
                {label}
                {key === 'fighters' && (
                  <i>
                    {picked}/{TEAM_SIZE}
                  </i>
                )}
              </button>
            ))}
          </div>
          <span className="picker__sheetcount">
            {tab === 'fighters' && shownCount
              ? shownCount.shown < shownCount.total
                ? `${shownCount.shown}/${shownCount.total}`
                : shownCount.total
              : null}
          </span>
          <button type="button" className="picker__sheetclose" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        )}

        {tab === 'fighters' ? (
          <>
            <RosterFilters
              filter={filter}
              onChange={setFilter}
              roster={roster ?? []}
              atLevelOne={atLevelOne}
              onAtLevelOne={setAtLevelOne}
              /* No "showing n of m" on a desktop: the grid says it. The markers and
                 the rest sit behind the Filter button, as on the phone's sheet. */
              count={inline ? undefined : shownCount}
              sheet={{ density, onDensity: inline ? setDensity : chooseDensity }}
              drop={inline}
            />
            <FighterGrid
              roster={roster}
              filter={filter}
              ageDecay={ageDecay}
              levelMod={levelMod}
              atLevelOne={atLevelOne}
              teamIds={teamIds}
              full={picked >= TEAM_SIZE}
              onToggle={onToggle}
              onCount={countFighters}
              onInspect={onInspect}
              density={density}
              onDensity={inline ? setDensity : chooseDensity}
            />
          </>
        ) : (
          <CardGrid
            cards={tab === 'crew' ? crewCards : weaponCards}
            values={values}
            query={cardQuery}
            onQuery={setCardQuery}
            selected={tab === 'crew' ? crew : weapon}
            onPick={(c) => {
              if (tab !== 'crew') {
                onWeapon(c)
                return
              }
              onCrew(c)
              /* Straight on to weapons: the pair is one choice in two halves. */
              onTab('weapon')
              setCardQuery('')
            }}
            onInspect={onInspectCard}
            kind={tab}
          />
        )}
        {!inline && (
          <button type="button" className="btn btn--primary picker__done" onClick={onClose}>
            Done
          </button>
        )}
      </section>
    </>
  )
}
