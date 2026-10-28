import { oddsTitle, type Odds } from './odds'

/**
 * What stands between the two line-ups: the chance of winning the fight.
 *
 * It used to be a red `VS` badge, with the odds drawn as an underline under
 * each team's header — a length you compared against the length opposite.
 * Now that the figure is a real proportion rather than a share of an
 * abstract power score, it can simply be said: the number is the thing, and
 * a shape drawn around it would only be a second way of reading the same
 * two digits.
 *
 * Colour carries the verdict so the middle can be read without stopping on
 * it — cyan when the fight is yours, amber when it is anyone's, red when it
 * is not. The thresholds are deliberately wide: a fight at 45% is not one a
 * player should be warned off, and 34% is.
 *
 * `VS` comes back when there is nothing to say — no team picked yet, or the
 * fight config still loading — because an empty gap between two rows of
 * fighters reads as something missing.
 */
export function OddsCentre({ odds }: { odds: Odds | null }) {
  if (!odds) {
    return (
      <span className="versus__vs" aria-hidden="true">
        VS
      </span>
    )
  }

  const pct = Math.round(odds.winRate * 100)
  const band = pct >= 55 ? 'good' : pct >= 35 ? 'even' : 'poor'

  return (
    <span
      className={`oddscentre oddscentre--${band}`}
      role="img"
      aria-label={oddsTitle(odds, 'mine')}
      title={oddsTitle(odds, 'mine')}
    >
      <span className="oddscentre__pct">
        {pct}
        <i>%</i>
      </span>
      <span className="oddscentre__cap">chance to win</span>
    </span>
  )
}

type Side = { landShare: number; blockShare: number; bonuses: number }

/**
 * The HUD look's centre (see matchupStyle): the chance to win on a
 * half-circle gauge, and under it the head-to-head, yours on the left and
 * theirs on the right, so the two lines' readouts stand in one place.
 * `VS` while there is nothing to say yet, as in the cards look.
 */
export function HudCentre({ odds, mine, theirs }: { odds: Odds | null; mine: Side; theirs: Side }) {
  if (!odds) {
    return (
      <span className="versus__vs" aria-hidden="true">
        VS
      </span>
    )
  }
  const pct = Math.round(odds.winRate * 100)
  const band = pct >= 55 ? 'good' : pct >= 35 ? 'even' : 'poor'
  const arc = Math.PI * 70
  const row = (label: string, a: string, b: string, title: string) => (
    <span className="hudcentre__row" title={title}>
      <b className="hudcentre__a">{a}</b>
      <span>{label}</span>
      <b className="hudcentre__z">{b}</b>
    </span>
  )
  return (
    <div className={`hudcentre hudcentre--${band}`} title={oddsTitle(odds, 'mine')}>
      <span className="hudcentre__gauge" role="img" aria-label={oddsTitle(odds, 'mine')}>
        <svg viewBox="0 0 170 96" aria-hidden="true">
          <path className="hudcentre__track" d="M15 88 A70 70 0 0 1 155 88" />
          <path className="hudcentre__fill" d="M15 88 A70 70 0 0 1 155 88" strokeDasharray={`${(arc * pct) / 100} ${arc}`} />
        </svg>
        <b>
          {pct}
          <i>%</i>
        </b>
      </span>
      <span className="hudcentre__cap">
        Chance to win · {verdictOf(pct)}
      </span>
      <span className="hudcentre__tape">
        {row('Lands', `${Math.round(mine.landShare * 100)}%`, `${Math.round(theirs.landShare * 100)}%`, 'How much of each side’s damage lands once the other side’s resistances are applied')}
        {row('Blocks', `${Math.round(mine.blockShare * 100)}%`, `${Math.round(theirs.blockShare * 100)}%`, 'How much of the damage coming the other way each side turns away')}
        {row('Bonus', `+${mine.bonuses}`, `+${theirs.bonuses}`, 'Ability firings that only this matchup allows, across each line-up')}
      </span>
      {/*
         The same figures as two mirrored columns, either side of the gauge,
         for the stacked board's band: yours on the left, theirs on the
         right, each figure nearest the gauge. The CSS shows one or the other.
      */}
      <MirrorSide side={mine} who="mine" />
      <MirrorSide side={theirs} who="theirs" />
    </div>
  )
}

function MirrorSide({ side, who }: { side: Side; who: 'mine' | 'theirs' }) {
  const lines: [string, string][] = [
    ['Lands', `${Math.round(side.landShare * 100)}%`],
    ['Blocks', `${Math.round(side.blockShare * 100)}%`],
    ['Bonus', `+${side.bonuses}`],
  ]
  return (
    <span className={`hudcentre__side hudcentre__side--${who}`} aria-hidden="true">
      {lines.map(([label, value]) => (
        <span className="hudcentre__line" key={label}>
          {who === 'mine' ? (
            <>
              <span>{label}</span>
              <b>{value}</b>
            </>
          ) : (
            <>
              <b>{value}</b>
              <span>{label}</span>
            </>
          )}
        </span>
      ))}
    </span>
  )
}

/** The odds in one word, on the same thresholds as the colour. */
export function verdictOf(pct: number): string {
  if (pct >= 85) return 'Easy'
  if (pct >= 55) return 'Favoured'
  if (pct >= 35) return 'Even'
  if (pct >= 20) return 'Risky'
  return 'Deadly'
}

/**
 * The phone's chance to win, above your team.
 *
 * Centred and large, because it is the one number the screen exists to move:
 * the label and a one-word verdict under it, and a hairline that fills to
 * the percentage. No box around it — the screen is busy enough. The verdict
 * and the hairline take the colour (teal yours, amber anyone's, red not);
 * the number stays white so it reads first.
 */
export function WinChance({ odds }: { odds: Odds | null }) {
  const pct = odds ? Math.round(odds.winRate * 100) : null
  const band = pct === null ? 'none' : pct >= 55 ? 'good' : pct >= 35 ? 'even' : 'poor'

  return (
    <div
      className={`winchance winchance--${band}`}
      role="img"
      aria-label={odds ? oddsTitle(odds, 'mine') : 'No chance to show yet'}
      title={odds ? oddsTitle(odds, 'mine') : undefined}
    >
      <span className="winchance__pct">
        {pct === null ? '–' : pct}
        <i>%</i>
      </span>
      <span className="winchance__line">
        <span className="winchance__cap">Chance to win</span>
        {pct !== null && <span className="winchance__word">· {verdictOf(pct)}</span>}
      </span>
      <span className="winchance__rule" aria-hidden="true">
        <i style={{ width: `${pct ?? 0}%` }} />
      </span>
    </div>
  )
}
