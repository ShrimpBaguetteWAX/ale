import { useEffect, useMemo, useRef, useState } from 'react'
import type { RosterFighter } from '@/dungeon/types'
import { markerIcon } from '@/dungeon/filters'
import { formatNumber } from '@/format'
import {
  AUTO_PICK_MODES,
  clampRange,
  eligibleFighters,
  levelPool,
  markerPool,
  MAX_LEVEL,
  MIN_LEVEL,
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

const LEVELS = Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => MIN_LEVEL + i)

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
 * The ranking is the screen's own: `onPick` receives the fighters the mode
 * allows and returns how many it placed, which is how a pool smaller than a
 * team gets said out loud rather than leaving slots empty without a word.
 */
export function AutoPickSplit({
  roster,
  disabled,
  onPick,
}: {
  roster: RosterFighter[] | null
  disabled?: boolean
  onPick: (eligible: RosterFighter[]) => number
}) {
  const [prefs, setPrefs] = useState<AutoPickPrefs>(readAutoPickPrefs)
  const [open, setOpen] = useState(false)
  const [shortfall, setShortfall] = useState<string | null>(null)
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

  /* The note about a short pool fades out on its own. */
  useEffect(() => {
    if (!shortfall) return
    const id = window.setTimeout(() => setShortfall(null), 5000)
    return () => window.clearTimeout(id)
  }, [shortfall])

  const pick = () => {
    if (!roster) return
    setOpen(false)
    const placed = onPick(eligibleFighters(roster, { ...prefs, markers: chosen, levels }))
    setShortfall(
      placed < 5
        ? placed === 0
          ? 'No available fighter matches.'
          : `Only ${placed} matched — the rest is yours to fill.`
        : null,
    )
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
      <button
        type="button"
        className="btn btn--ghost btn--sm autosplit__go"
        onClick={pick}
        disabled={disabled || !roster || noMarkers}
        title={
          noMarkers
            ? 'Choose at least one marker'
            : `Choose five fighters for this opponent — ${(prefs.mode === 'leveling'
                ? rangeLabel(levels)
                : NAME[prefs.mode]
              ).toLowerCase()}, from ${pool} available`
        }
      >
        <span className="autosplit__icon">{ICON.suggested}</span>
        {/* The word the header does not need, as before. */}
        Auto-pick<span className="teamauto__what"> fighters</span>
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

      {shortfall && (
        <span className="autosplit__note" role="status">
          {shortfall}
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
                  <p className="autosplit__hint">Both ends count. Level {MAX_LEVEL} is Ascension.</p>
                  <div className="autosplit__range">
                    <label>
                      From
                      <select
                        value={levels.min}
                        onChange={(e) => update({ ...prefs, levels: clampRange({ ...levels, min: Number(e.target.value) }) })}
                      >
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            Level {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      To
                      <select
                        value={levels.max}
                        onChange={(e) => update({ ...prefs, levels: clampRange({ ...levels, max: Number(e.target.value) }) })}
                      >
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            Level {l}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="autosplit__ladder" aria-hidden="true">
                    {LEVELS.map((l) => (
                      <span
                        key={l}
                        className={`autosplit__rung${l >= levels.min && l <= levels.max ? ' is-on' : ''}`}
                        title={`Level ${l} — ${counts.levels[l] ?? 0} available`}
                      >
                        <b>{l}</b>
                        {formatNumber(counts.levels[l] ?? 0)}
                      </span>
                    ))}
                  </div>
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
