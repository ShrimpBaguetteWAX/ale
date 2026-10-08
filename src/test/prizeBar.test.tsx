import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PrizeBar } from '@/routes/Tournament'
import type { TournamentStage } from '@/tournament/types'

/**
 * The strip stacks when it has to, not at a width.
 *
 * `PrizeBar` measures its own frame: if its tabs and bands plus a real gap
 * are wider than the frame, it puts itself on two rows. The thing that
 * makes a breakpoint impossible is the thing this checks — the same frame
 * width stacks or not depending on how wide the parts are, and the parts
 * are as wide as the rolls' text, which changes every tournament.
 *
 * jsdom lays nothing out, so both widths are stubbed: the frame's
 * `clientWidth` and each part's `getBoundingClientRect`. The stubs are
 * deleted rather than restored, for the reason given in dayStrip.test.
 */
const stage = (): TournamentStage =>
  ({
    tournament_name: '.....2fbjyq',
    stage_index: 3000,
    stage_name: 'signup',
    weather_effects: [],
    tournament_screen: 'signup',
    allow_player_signup: true,
    allow_player_cancellation: true,
    tlm_rewards: '4.0000 TLM',
    wax_rewards: '23.00000000 WAX',
    player_count: 23,
    rounds: 5,
    free_passes: 9,
    score_id_lookup_min: '0',
    score_id_lookup_max: '0',
    battles_preliminary_round: 7,
    players_first_ko_round: 16,
    current_round: 0,
    matchups_created: 0,
    battles_in_round: 0,
    current_battle: 0,
    round_complete: false,
  }) as TournamentStage

const weather = () => [
  { planet: 'eyeke', weather: roll('-20% fire fighter taunt') },
  { planet: 'kavian', weather: roll('-20 hunter health') },
  { planet: 'naron', weather: roll('+40% gem resistance and -20 fire resistance') },
]

const roll = (displayname: string) =>
  ({
    weather_id: displayname.replace(/\W+/g, '').slice(0, 12),
    affected_class: [],
    affected_element: [],
    affected_race: [],
    weather_effects: [{ statname: 'health', percent_change: -20, flat_change: 0 }],
    displayname,
    title: displayname,
  }) as never

/** Pretend the frame is `room` wide and every part of the strip `part` wide. */
function laidOut(room: number, part: number, run: () => void) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => room,
  })
  const rect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    return { width: part, height: 54, top: 0, left: 0, right: part, bottom: 54, x: 0, y: 0, toJSON() {} } as DOMRect
  }
  try {
    run()
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
    Element.prototype.getBoundingClientRect = rect
  }
}

const stacked = (container: HTMLElement) => container.querySelector('.pot')!.classList.contains('pot--stacked')

afterEach(cleanup)

describe('the prize strip', () => {
  /* Four parts measured: rewards tab, rewards band, rolls band, conditions
     tab. The bridge is left out, since it is the gap being decided. */
  it('stays on one row while its parts and a gap fit the frame', () => {
    laidOut(1400, 300, () => {
      const { container } = render(<PrizeBar stage={stage()} weather={weather()} />)
      /* 4 × 300 + 60 = 1260 ≤ 1400 */
      expect(stacked(container)).toBe(false)
    })
  })

  it('stacks the moment they do not', () => {
    laidOut(1200, 300, () => {
      const { container } = render(<PrizeBar stage={stage()} weather={weather()} />)
      /* 4 × 300 + 60 = 1260 > 1200 */
      expect(stacked(container)).toBe(true)
    })
  })

  it('decides by the parts, not by the frame alone', () => {
    /*
       The same 1200 frame, with shorter rolls: fits on one row. This is the
       case no breakpoint could get right — the width that needs two rows
       depends on text the chain writes differently each tournament.
    */
    laidOut(1200, 250, () => {
      const { container } = render(<PrizeBar stage={stage()} weather={weather()} />)
      /* 4 × 250 + 60 = 1060 ≤ 1200 */
      expect(stacked(container)).toBe(false)
    })
  })

  it('can be told to stack, for a render with no window to measure', () => {
    laidOut(1400, 300, () => {
      const { container } = render(<PrizeBar stage={stage()} weather={weather()} stacked />)
      expect(stacked(container)).toBe(true)
    })
  })
})
