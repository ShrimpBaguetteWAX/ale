import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { DayStrip, dayClock } from '@/routes/Tournament'
import type { TimelineStep } from '@/tournament/rules'

/**
 * The strip must never scroll sideways.
 *
 * `stripWindow` is unit-tested on its own, but the thing that decides how
 * many steps it is asked for lives in the component — it measures its own
 * box — and that is exactly the part a static preview cannot show. So this
 * renders the real strip at two widths and counts the tiles.
 *
 * jsdom reports every element as zero-wide unless told otherwise, which is
 * the narrow case for free; the wide case stubs `clientWidth`, and both go
 * through the same measuring effect the browser runs.
 *
 * The seven steps below are the contract's; the strip draws four, because
 * `stripSteps` drops the two nobody waits on and merges the rest into
 * Signup closed and Results. The counts here are of cells, not of steps.
 */
const STEPS = [
  'set_weather',
  'get_rewards',
  'signup',
  'close_signup',
  'create_matchups',
  'battle',
  'cleanup',
]

const timeline = (running: number): TimelineStep[] =>
  STEPS.map((name, i) => ({
    index: i,
    name,
    startMs: Date.parse('2026-09-27T12:00:00Z'),
    endMs: Date.parse('2026-09-27T12:10:00Z'),
    state: i < running ? 'done' : i === running ? 'running' : 'waiting',
    current: 0,
    total: 0,
  }))

/**
 * Pretend the strip is this many pixels wide for one render.
 *
 * The stub is deleted rather than restored: `clientWidth` is defined on
 * `Element.prototype`, so there is nothing of `HTMLElement`'s own to put
 * back — and "restoring" what was there left the *previous* test's stub in
 * place, which is a way to make a passing suite lie.
 */
function atWidth(px: number, run: () => void) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => px,
  })
  try {
    run()
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  }
}

afterEach(cleanup)

describe('the day strip', () => {
  it('draws every cell when it has the room', () => {
    atWidth(1200, () => {
      const { container } = render(<DayStrip timeline={timeline(2)} now={Date.now()} />)
      const names = [...container.querySelectorAll('.tour__stepname')].map((n) =>
        n.textContent?.trim(),
      )
      expect(names).toEqual(['Signup open', 'Signup closed', 'Fights start', 'Results'])
    })
  })

  it('falls back to the step either side of the running one when it does not', () => {
    atWidth(260, () => {
      const { container } = render(<DayStrip timeline={timeline(3)} now={Date.now()} />)
      const names = [...container.querySelectorAll('.tour__stepname')].map((n) =>
        n.textContent?.trim(),
      )
      expect(names).toEqual(['Signup open', 'Signup closed', 'Fights start'])
    })
  })

  it('never leaves a tile to scroll off', () => {
    /* Zero width is what jsdom reports by default, and the floor is three. */
    const { container } = render(<DayStrip timeline={timeline(5)} now={Date.now()} />)
    expect(container.querySelectorAll('.tour__step')).toHaveLength(3)
  })
})

describe('dayClock', () => {
  /* A Wednesday at noon, local time. */
  const now = new Date(2026, 9, 7, 12, 0).getTime()
  const at = (days: number, h: number, m = 0) => new Date(2026, 9, 7 + days, h, m).getTime()

  it('names today and the days either side', () => {
    expect(dayClock(at(0, 22, 2), now)).toMatch(/^Today /)
    expect(dayClock(at(1, 8), now)).toMatch(/^Tomorrow /)
    expect(dayClock(at(-1, 8), now)).toMatch(/^Yesterday /)
    /* Just after midnight is still tomorrow, not "in twelve hours". */
    expect(dayClock(at(1, 0, 5), now)).toMatch(/^Tomorrow /)
  })

  it('names the rest of the week by weekday and anything further by date', () => {
    expect(dayClock(at(3, 10), now)).toMatch(/^Saturday /)
    expect(dayClock(at(6, 10), now)).toMatch(/^Tuesday /)
    expect(dayClock(at(7, 10), now)).toMatch(/^(Oct 14|14 Oct) /)
    expect(dayClock(at(20, 10), now)).toMatch(/^(Oct 27|27 Oct) /)
  })

  it('keeps the time the strip already showed', () => {
    expect(dayClock(at(3, 10), now)).toMatch(/10:00/)
    expect(dayClock(NaN, now)).toBe('—')
  })
})
