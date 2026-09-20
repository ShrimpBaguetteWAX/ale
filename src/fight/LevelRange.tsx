import { clampRange, MAX_LEVEL, MIN_LEVEL, type LevelRange as Range } from './autopickModes'

/**
 * One slider with two handles: the lowest and highest level auto-pick may
 * draw from.
 *
 * Two range inputs lie over the same track. Only their handles take the
 * pointer, so each is grabbable wherever it stands, and the track between
 * them is filled to show what is chosen. Being real inputs, they take the
 * arrow keys and read out as sliders without anything extra.
 */
export function LevelRange({ value, onChange }: { value: Range; onChange: (next: Range) => void }) {
  const { min, max } = clampRange(value)
  const span = MAX_LEVEL - MIN_LEVEL
  const at = (level: number) => ((level - MIN_LEVEL) / span) * 100

  /* A handle dragged past the other stops beside it rather than crossing over. */
  const setMin = (v: number) => onChange({ min: Math.min(v, max), max })
  const setMax = (v: number) => onChange({ min, max: Math.max(v, min) })

  /*
   * A press on the track moves the nearer end to it. The track takes the
   * pointer itself, so a press that misses a handle by a few pixels lands
   * here rather than falling through to the menu behind.
   */
  const pressTrack = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    if (!box.width) return
    const level = Math.round(MIN_LEVEL + ((e.clientX - box.left) / box.width) * span)
    const to = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level))
    if (Math.abs(to - min) <= Math.abs(to - max)) setMin(to)
    else setMax(to)
  }

  return (
    <div className="lvlrange">
      <div className="lvlrange__track" onPointerDown={pressTrack}>
        <span className="lvlrange__fill" style={{ left: `${at(min)}%`, right: `${100 - at(max)}%` }} />
        <span className="lvlrange__dot" style={{ left: `${at(min)}%` }} />
        <span className="lvlrange__dot" style={{ left: `${at(max)}%` }} />
      </div>
      <input
        type="range"
        min={MIN_LEVEL}
        max={MAX_LEVEL}
        step={1}
        value={min}
        aria-label="Lowest level"
        onChange={(e) => setMin(Number(e.target.value))}
      />
      <input
        type="range"
        min={MIN_LEVEL}
        max={MAX_LEVEL}
        step={1}
        value={max}
        aria-label="Highest level"
        onChange={(e) => setMax(Number(e.target.value))}
      />
      <div className="lvlrange__scale" aria-hidden="true">
        <span>{MIN_LEVEL}</span>
        <span>{MAX_LEVEL}</span>
      </div>
    </div>
  )
}
