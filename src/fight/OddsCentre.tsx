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

/**
 * The phone's matchup banner, above your team.
 *
 * Your damage and health on a blue blade, the opponent's on a red one, and
 * the chance to win in a crest where they meet — the matchup screen mobile
 * games open a fight with. The crest's ring carries the same verdict colour
 * as the desktop's figure: teal yours, amber anyone's, red not.
 */
export function PowerBanner({
  odds,
  mine,
  theirs,
  them,
}: {
  odds: Odds | null
  mine: { damage: string; health: string }
  theirs: { damage: string; health: string }
  /** What the other side is called: "Dungeon", "Arena". */
  them: string
}) {
  const pct = odds ? Math.round(odds.winRate * 100) : null
  const band = pct === null ? 'none' : pct >= 55 ? 'good' : pct >= 35 ? 'even' : 'poor'

  return (
    <div
      className={`powerbanner powerbanner--${band}`}
      title={odds ? oddsTitle(odds, 'mine') : undefined}
    >
      <div className="powerbanner__side powerbanner__side--mine">
        <small>You · DMG / HP</small>
        <b className="mono">
          {mine.damage} / {mine.health}
        </b>
      </div>
      <div className="powerbanner__side powerbanner__side--them">
        <small>{them} · DMG / HP</small>
        <b className="mono">
          {theirs.damage} / {theirs.health}
        </b>
      </div>
      <div className="powerbanner__crest" role="img" aria-label={odds ? oddsTitle(odds, 'mine') : 'Versus'}>
        {pct === null ? (
          <b>VS</b>
        ) : (
          <>
            <b>{pct}%</b>
            <span>to win</span>
          </>
        )}
      </div>
    </div>
  )
}
