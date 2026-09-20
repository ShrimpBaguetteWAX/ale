import { useEffect, useMemo, useRef, useState } from 'react'
import type { RosterFighter } from '@/dungeon/types'
import { markerIcon } from '@/dungeon/filters'
import { formatNumber } from '@/format'
import { LevelRange } from './LevelRange'
import {
  AUTO_PICK_MODES,
  clampRange,
  eligibleFighters,
  keptFighters,
  levelPool,
  markerPool,
  MAX_LEVEL,
  poolCounts,
  rangeLabel,
  readAutoPickPrefs,
  saveAutoPickPrefs,
  type AutoPickMode,
  type AutoPickPrefs,
} from './autopickModes'

const ICON: Record<AutoPickMode, JSX.Element> = {
  suggested: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  ),
  leveling: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 15 6-6 6 6" />
      <path d="m6 20 6-6 6 6" />
      <path d="M6 4h12" />
    </svg>
  ),
  marker: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 21V4a1 1 0 0 1 1-1h11l-2.5 4.5L17 12H6" />
    </svg>
  ),
}

const NAME: Record<AutoPickMode, string> = {
  suggested: 'Suggested',
  leveling: 'Levels',
  marker: 'Marker',
}

/* The two sides of the switch: add to the team, or start it over. */
const FILL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const REPLACE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
)

const UNDO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h11a5 5 0 0 1 0 10H8" />
    <path d="m7 4-4 4 4 4" />
  </svg>
)

const DESCRIPTION: Record<AutoPickMode, string> = {
  suggested: "Suggested for this opponent's line-up, from all your available fighters.",
  leveling: 'Only fighters in the level range you choose.',
  marker: 'Only fighters carrying the markers you choose.',
}

/**
 * Auto-pick, with a choice of what it picks from.
 *
 * One button split in two. The left half picks, exactly as the single button
 * did. The right half shows the current mode and opens a small menu to change
 * it — Suggested, Leveling, or Marker with markers to tick. The choice is
 * remembered on this device and shared by the dungeon and the arena, so most
 * of the time the menu is never opened.
 *
 * A switch on that left half decides what happens to a team that already
 * has fighters in it: fill what is empty and keep them, or replace the lot.
 * The label says which of the two it will be before it is pressed, and what
 * it did can be undone.
 *
 * The ranking is the screen's own: `onPick` receives the fighters the mode
 * allows and the ones to keep, and returns how many it placed, which is how a
 * pool smaller than a team gets said out loud rather than leaving slots empty
 * without a word.
 */
export function AutoPickSplit({
  roster,
  teamIds = [],
  teamSize = 5,
  disabled,
  onPick,
  onRestore,
}: {
  roster: RosterFighter[] | null
  /** The team as it stands, so the button can say what it will do to it. */
  teamIds?: number[]
  teamSize?: number
  disabled?: boolean
  onPick: (eligible: RosterFighter[], keep: number[]) => number
  /** Puts the team back as it was, for Undo. */
  onRestore?: (ids: number[]) => void
}) {
  const [prefs, setPrefs] = useState<AutoPickPrefs>(readAutoPickPrefs)
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<{ before: number[]; after: number[] | null; short: string | null } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const update = (next: AutoPickPrefs) => {
    setPrefs(next)
    saveAutoPickPrefs(next)
  }

  const counts = useMemo(() => poolCounts(roster ?? []), [roster])
  const levels = clampRange(prefs.levels)
  const pool =
    prefs.mode === 'suggested'
      ? counts.all
      : prefs.mode === 'leveling'
        ? levelPool(counts, levels)
        : markerPool(counts, prefs.markers)

  /* The fighters in the team that can still fight; whatever is left of it is empty slots. */
  const kept = useMemo(() => keptFighters(roster ?? [], teamIds), [roster, teamIds])
  const empty = Math.max(0, teamSize - kept.length)
  /* With nothing to keep, the two sides do the same thing, so the switch is put away. */
  const switchable = kept.length > 0
  const filling = prefs.fill && switchable
  const nothingToFill = filling && empty === 0

  /* A marker chosen before that no fighter carries any more is not a choice. */
  const chosen = prefs.markers.filter((m) => counts.markers.some((c) => c.marker === m))
  const noMarkers = prefs.mode === 'marker' && chosen.length === 0

  /* Outside clicks and Escape close the menu, as any menu should. */
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /*
   * Undo stands until it is used, or until the team is changed by something
   * other than that press — a fighter swapped by hand makes putting the old
   * team back a surprise rather than a correction.
   */
  useEffect(() => {
    if (!done) return
    const now = teamIds.join()
    /* The team the press produced is only known once the screen has set it. */
    if (done.after === null) {
      if (now !== done.before.join()) setDone((d) => (d ? { ...d, after: teamIds } : d))
    } else if (now !== done.after.join()) setDone(null)
  }, [teamIds, done])

  /* The word about a pool too short for the team says itself and goes. */
  useEffect(() => {
    if (!done?.short) return
    const id = window.setTimeout(() => setDone((d) => (d ? { ...d, short: null } : d)), 6000)
    return () => window.clearTimeout(id)
  }, [done])

  const pick = () => {
    if (!roster) return
    setOpen(false)
    const keep = filling ? kept : []
    const before = teamIds
    const placed = onPick(eligibleFighters(roster, { ...prefs, markers: chosen, levels }), keep)
    setDone({
      before,
      after: null,
      short:
        keep.length + placed < teamSize
          ? placed === 0
            ? 'No available fighter matches.'
            : `Only ${placed} matched — the rest is yours to fill.`
          : null,
    })
  }

  /* Undo puts back the exact team that was there before the press. */
  const undo = () => {
    if (!done) return
    onRestore?.(done.before)
    setDone(null)
  }

  const modeLabel =
    prefs.mode === 'marker' && chosen.length > 0 ? (
      <span className="autosplit__marks">
        {chosen.slice(0, 3).map((m) => (
          <img key={m} src={markerIcon(m)} alt={m} />
        ))}
        {chosen.length > 3 && <span className="autosplit__more">+{chosen.length - 3}</span>}
      </span>
    ) : (
      <>
        <span className="autosplit__icon">{ICON[prefs.mode]}</span>
        {prefs.mode === 'leveling' ? rangeLabel(levels) : NAME[prefs.mode]}
      </>
    )

  return (
    <div className="autosplit" ref={box}>
      {switchable && (
        <span className="autosplit__switch" role="group" aria-label="What auto-pick does with the team">
          {[
            { fill: true, icon: FILL_ICON, title: 'Fill the empty slots, keeping the fighters already chosen' },
            { fill: false, icon: REPLACE_ICON, title: `Replace all ${teamSize} fighters` },
          ].map((side) => (
            <button
              key={String(side.fill)}
              type="button"
              aria-pressed={prefs.fill === side.fill}
              onClick={() => update({ ...prefs, fill: side.fill })}
              disabled={disabled || !roster}
              title={side.title}
            >
              {side.icon}
            </button>
          ))}
        </span>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--sm autosplit__go"
        onClick={pick}
        disabled={disabled || !roster || noMarkers || nothingToFill}
        title={
          nothingToFill
            ? 'No empty slots to fill — switch to replacing the team'
            : noMarkers
              ? 'Choose at least one marker'
              : `${
                  filling ? `Fill ${empty} empty slot${empty === 1 ? '' : 's'}` : `Choose ${teamSize} fighters`
                } for this opponent — ${(prefs.mode === 'leveling'
                  ? rangeLabel(levels)
                  : NAME[prefs.mode]
                ).toLowerCase()}, from ${pool} available`
        }
      >
        <span className="autosplit__icon">{ICON.suggested}</span>
        {/* The word the header does not need, as before. */}
        {nothingToFill ? (
          'No empty slots'
        ) : filling ? (
          <>
            Fill {empty} empty<span className="teamauto__what"> slot{empty === 1 ? '' : 's'}</span>
          </>
        ) : switchable ? (
          <>
            Replace all<span className="teamauto__what"> {teamSize}</span>
          </>
        ) : (
          <>
            Auto-pick<span className="teamauto__what"> fighters</span>
          </>
        )}
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm autosplit__mode"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || !roster}
        title="Change what auto-pick picks from"
      >
        {modeLabel}
        <span className="autosplit__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {onRestore && (
        <button
          type="button"
          className="btn btn--ghost btn--sm autosplit__undo"
          onClick={undo}
          /* Always in its place, so the group never changes width under the hand. */
          disabled={!done}
          title={done ? 'Undo — put the team back as it was' : 'Nothing to undo'}
          aria-label={done ? 'Undo — put the team back as it was' : 'Undo — nothing to undo'}
        >
          {UNDO_ICON}
        </button>
      )}

      {done?.short && (
        <span className="autosplit__note" role="status">
          {done.short}
        </span>
      )}

      {open && (
        <div className="autosplit__menu" role="menu">
          {AUTO_PICK_MODES.map((mode) => (
            <div key={mode}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={prefs.mode === mode}
                className="autosplit__opt"
                onClick={() => {
                  update({ ...prefs, mode })
                  /* Marker and Levels stay open: what they pick from is chosen next. */
                  if (mode === 'suggested') setOpen(false)
                }}
              >
                <span className="autosplit__opticon">{ICON[mode]}</span>
                <span>
                  <span className="autosplit__optname">{NAME[mode]}</span>
                  <span className="autosplit__optdesc">{DESCRIPTION[mode]}</span>
                </span>
                <span className="autosplit__optcount">
                  {mode === 'suggested'
                    ? `${formatNumber(counts.all)} fighters`
                    : mode === 'leveling'
                      ? `${formatNumber(levelPool(counts, levels))} fighters`
                      : ''}
                </span>
              </button>

              {mode === 'leveling' && prefs.mode === 'leveling' && (
                <div className="autosplit__markers">
                  <p className="autosplit__hint">
                    Drag either end. Both count, and level {MAX_LEVEL} is Ascension.
                  </p>
                  <LevelRange value={levels} onChange={(next) => update({ ...prefs, levels: next })} />
                  <p className="autosplit__foot">
                    {pool
                      ? `${formatNumber(pool)} fighter${pool === 1 ? '' : 's'} in ${rangeLabel(levels).toLowerCase()}`
                      : `No available fighter is in ${rangeLabel(levels).toLowerCase()}`}
                  </p>
                </div>
              )}

              {mode === 'marker' && prefs.mode === 'marker' && (
                <div className="autosplit__markers">
                  {counts.markers.length === 0 ? (
                    <p className="autosplit__hint">
                      None of your available fighters carries a marker yet. Set them in My Fighters.
                    </p>
                  ) : (
                    <>
                      <p className="autosplit__hint">Pick one or more — fighters with any of them count.</p>
                      <div className="autosplit__grid">
                        {counts.markers.map(({ marker, count }) => {
                          const on = chosen.includes(marker)
                          return (
                            <button
                              type="button"
                              key={marker}
                              className="markbtn"
                              aria-pressed={on}
                              title={`${marker} — ${count} fighter${count === 1 ? '' : 's'}`}
                              onClick={() =>
                                update({
                                  ...prefs,
                                  markers: on
                                    ? chosen.filter((m) => m !== marker)
                                    : [...chosen, marker],
                                })
                              }
                            >
                              <img src={markerIcon(marker)} alt={marker} />
                              <span className="markbtn__count">{count}</span>
                            </button>
                          )
                        })}
                      </div>
                      <p className="autosplit__foot">
                        {chosen.length
                          ? `${formatNumber(pool)} fighter${pool === 1 ? '' : 's'} carry these markers`
                          : 'No marker chosen yet'}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
