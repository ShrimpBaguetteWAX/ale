import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { boardText, Crowns, Field, gateCrowd } from '@/routes/Tournament'
import { crewFaces } from '@/tournament/rules'
import type { TournamentSignup } from '@/tournament/types'

/**
 * The field list, and the two things in it that only exist on screen.
 *
 * A row that opens is the kind of thing a static preview cannot show — it
 * has no click — so it is checked here instead: the line-up is not in the
 * document until the row is pressed, and pressing it again puts it away.
 */
const entrant = (over: Partial<TournamentSignup>): TournamentSignup =>
  ({
    wallet: 'someone.wam',
    playertag: 'Someone',
    avatar: 1000,
    fighter_ids: [1, 2, 3, 4, 5],
    crew_asset_id: 0,
    arms_asset_id: 0,
    score: 96,
    battles_won: 0,
    reward_points: 0,
    signup_timestamp: '2026-09-27T12:00:00',
    first_round_free_pass: false,
    ...over,
  }) as TournamentSignup

afterEach(cleanup)

describe('the field', () => {
  const field = [entrant({ wallet: 'a.wam', playertag: 'Shade' }), entrant({ wallet: 'b.wam' })]

  it('keeps the line-up shut until a row is pressed', () => {
    const { container, getByText } = render(
      <Field field={field} mineWallet={null} entryOpen freePasses={0} degenerate={false} />,
    )
    expect(container.querySelector('.tour__lineup')).toBeNull()

    fireEvent.click(getByText('Shade'))
    expect(container.querySelector('.tour__lineup')).not.toBeNull()

    fireEvent.click(getByText('Shade'))
    expect(container.querySelector('.tour__lineup')).toBeNull()
  })

  it('opens one at a time', () => {
    const { container, getByText } = render(
      <Field field={field} mineWallet={null} entryOpen freePasses={0} degenerate={false} />,
    )
    fireEvent.click(getByText('Shade'))
    fireEvent.click(getByText('Someone'))
    expect(container.querySelectorAll('.tour__lineup')).toHaveLength(1)
  })

  it('tickets the seeds that skip the opening round, once entry has closed', () => {
    const open = render(
      <Field field={field} mineWallet={null} entryOpen freePasses={1} degenerate={false} />,
    )
    /* While the field is still arriving a pass can be taken away again. */
    expect(open.container.querySelectorAll('.tour__ticket')).toHaveLength(0)
    cleanup()

    const closed = render(
      <Field
        field={field}
        mineWallet={null}
        entryOpen={false}
        freePasses={1}
        degenerate={false}
      />,
    )
    expect(closed.container.querySelectorAll('.tour__ticket')).toHaveLength(1)
  })
})

describe('titles', () => {
  it('shows a star each up to five', () => {
    const { container } = render(<Crowns wins={4} />)
    expect(container.querySelectorAll('.tour__star')).toHaveLength(4)
  })

  it('counts instead of drawing ten identical glyphs', () => {
    const { container } = render(<Crowns wins={9} />)
    expect(container.querySelectorAll('.tour__star')).toHaveLength(1)
    expect(container.textContent).toContain('9')
  })

  it('says nothing for a player who has never won', () => {
    const { container } = render(<Crowns wins={0} />)
    expect(container.querySelector('.tour__crowns')).toBeNull()
  })
})

describe('the crowd at the gates', () => {
  const roster = (...classes: string[]) =>
    classes.map((spec, i) => {
      const [classname, racename = 'human'] = spec.split('/')
      return { fighter_id: i + 1, classname, racename }
    })

  it('keeps the middle three and gives the ends to fighters held back', () => {
    const line = gateCrowd(
      roster('arcanist', 'hunter', 'juggernaut', 'mystic', 'lunatic', 'desperado', 'mindblade'),
    )
    expect(line.map((f) => f.classname)).toEqual([
      'desperado',
      'hunter',
      'juggernaut',
      'mystic',
      'mindblade',
    ])
  })

  it('saves a striking look for the right-hand end, and knows which it wants', () => {
    const line = gateCrowd(
      roster(
        'arcanist',
        'juggernaut',
        'lunatic',
        'astralknight',
        'voidwarden',
        'desperado',
        'tactician/onoros',
        'mindblade/elgem',
        'mystic/elgem',
      ),
    )
    /* An elgem over an onoros, and the class it hangs best on over the
       rest of the elgem. */
    expect(`${line[4].classname}/${line[4].racename}`).toBe('mystic/elgem')
    /* The left end is not in that race for the same shortlist: it takes
       the next fighter in reserve, whoever that is. */
    expect(line[0].classname).toBe('desperado')
  })

  it('will not put a class on an end that is already standing in the middle', () => {
    const line = gateCrowd(
      roster('arcanist', 'hunter', 'juggernaut', 'mystic', 'lunatic', 'hunter', 'mystic', 'lunatic'),
    )
    expect(line.map((f) => f.fighter_id)).toEqual([8, 2, 3, 4, 5])
  })

  it('leaves a roster with nobody in reserve exactly as it is', () => {
    const line = gateCrowd(roster('arcanist', 'hunter', 'juggernaut', 'mystic', 'lunatic'))
    expect(line.map((f) => f.fighter_id)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('the board clock', () => {
  const t = (h: number, m: number, sec: number) => boardText(((h * 60 + m) * 60 + sec) * 1000)

  it('keeps the seconds running at every range it can show', () => {
    expect(t(3, 46, 8)).toBe('3h 46m 08s')
    expect(t(0, 9, 4)).toBe('9m 04s')
    expect(t(0, 0, 44)).toBe('44s')
  })

  it('drops to days and minutes once seconds stop meaning anything', () => {
    expect(t(27, 5, 30)).toBe('1d 03h 05m')
  })

  it('says any moment rather than a row of zeroes', () => {
    expect(boardText(0)).toBe('any moment')
    expect(boardText(-5000)).toBe('any moment')
  })
})

/**
 * The crew strip, drawn off the signup row itself.
 *
 * `signup` writes each fighter down as `class:race:element` while it is
 * already reading them to score the team, so the field list needs no chain
 * read at all to show who an entrant brought. What is pinned here is that
 * the strip appears with nothing fetched, and that a row the contract wrote
 * before the field existed — or a string that does not parse — costs the
 * list nothing worse than a missing face.
 */
describe('the crew on a field row', () => {
  const crewed = (over: Partial<TournamentSignup> = {}) =>
    entrant({
      playertag: 'Crewed',
      fighter_class_race_element: [
        'hunter:elgem:nature',
        'juggernaut:khaured:metal',
        'arcanist:human:gem',
        'explosioneer:robotron:fire',
        'mindblade:altan:air',
      ],
      ...over,
    })

  it('reads the faces out of the string the contract writes', () => {
    expect(crewFaces(crewed())).toHaveLength(5)
    expect(crewFaces(crewed())[0]).toEqual({
      classname: 'hunter',
      racename: 'elgem',
      element: 'nature',
    })
  })

  it('drops what it cannot read rather than drawing a broken portrait', () => {
    expect(crewFaces(crewed({ fighter_class_race_element: ['hunter', ':elgem:nature', ''] }))).toEqual(
      [],
    )
    expect(crewFaces(entrant({}))).toEqual([])
  })

  it('draws the strip without a single fighter being fetched', () => {
    const { container } = render(
      <Field field={[crewed()]} mineWallet={null} entryOpen freePasses={0} degenerate={false} />,
    )
    const faces = container.querySelectorAll('.tour__crew img')
    expect(faces).toHaveLength(5)
    expect(faces[0].getAttribute('src')).toContain('hunter_elgem_avatar')
  })

  it('leaves the row alone when the entry predates the field', () => {
    const { container } = render(
      <Field field={[entrant({})]} mineWallet={null} entryOpen freePasses={0} degenerate={false} />,
    )
    expect(container.querySelectorAll('.tour__crew img')).toHaveLength(0)
    expect(container.querySelectorAll('.tour__entry')).toHaveLength(1)
  })
})
