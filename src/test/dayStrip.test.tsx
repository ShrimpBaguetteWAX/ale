import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { DayStrip } from '@/routes/Tournament'
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
  it('draws the whole day when it has the room', () => {
    atWidth(1200, () => {
      const { container } = render(<DayStrip timeline={timeline(2)} now={Date.now()} />)
      expect(container.querySelectorAll('.tour__step')).toHaveLength(7)
    })
  })

  it('falls back to the step either side of the running one when it does not', () => {
    atWidth(260, () => {
      const { container } = render(<DayStrip timeline={timeline(3)} now={Date.now()} />)
      const names = [...container.querySelectorAll('.tour__stepname')].map((n) =>
        n.textContent?.trim(),
      )
      expect(names).toEqual(['Signup open', 'Preparation', 'Bracket drawn'])
    })
  })

  it('never leaves a tile to scroll off', () => {
    /* Zero width is what jsdom reports by default, and the floor is three. */
    const { container } = render(<DayStrip timeline={timeline(5)} now={Date.now()} />)
    expect(container.querySelectorAll('.tour__step')).toHaveLength(3)
  })
})
