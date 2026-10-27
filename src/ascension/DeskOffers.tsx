import { useState } from 'react'
import type { RosterFighter } from '@/dungeon/types'
import type { StatCaps } from '@/ascension/queries'
import {
  isAmbiguous,
  isBenefit,
  upgradeIcon,
  upgradeOutcome,
  upgradeText,
  type UpgradeOutcome,
} from '@/ascension/rules'
import {
  elementBackground,
  fighterArt,
  fighterArtFallback,
  formatResistance,
  formatStat,
} from '@/tavern/fighterStats'
import { FighterAbilities, FighterStats, type StatHighlight } from '@/components/FighterPanel'
import { GameImg } from '@/components/GameImg'
import { rosterPanel } from '@/fight/setup'
import { useConfig } from '@/state/useConfig'
import { formatNumber } from '@/format'
import { asset } from '@/assets'

type Busy = 'ascend' | 'reroll' | 'claim' | null

const CREDITS = asset('/assets/icons/credits.svg')
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const levelOf = (f: RosterFighter) => Number(f.stats?.level ?? 0)

/** The figure the fighter panel would print for this stat after the upgrade. */
function panelFigure(stat: string, o: UpgradeOutcome, factor: number): string {
  if (stat.startsWith('res_')) return formatResistance(o.after)
  const [lo, hi] = o.range!.after
  /* Health and damage are printed as fought with, like the panel does. */
  const f = stat === 'health' || stat === 'damage' ? factor : 1
  return formatStat(lo * f, hi * f)
}

/**
 * The reward on a desktop: the same board the ascension was built on, so the
 * screen does not jump when Ascend lands.
 *
 * The fighter in full where the list was, the altar in the middle with only
 * the fighter on it now, and the three rolled upgrades on the right — each
 * saying what it does to this fighter. Hovering one lights the stat it
 * changes on the left with the figure it would become.
 *
 * Where a roll would run into one of the contract's limits, the row says so:
 * what really applies, where it stops, and what is lost; and taking it asks
 * once more, because taking it is final and the other two are gone.
 */
export function DeskOffers({
  fighter,
  rerollFee,
  credits,
  busy,
  canAct,
  caps,
  factor,
  onReroll,
  onClaim,
  extra,
}: {
  fighter: RosterFighter
  rerollFee: number
  credits: number
  busy: Busy
  canAct: boolean
  caps?: StatCaps
  /** The fighter's level × age multiplier, as health and damage are printed. */
  factor: number
  onReroll: () => void
  onClaim: (stat: string, value: number, positive: boolean) => void
  /** What goes under the re-roll: the table of what can be rolled. */
  extra?: React.ReactNode
}) {
  const { classes, levelMod, ageDecay, fighters } = useConfig()
  const offers = fighter.ascension_upgrades ?? []
  const panel = rosterPanel(fighter, levelMod, ageDecay)
  const [taking, setTaking] = useState<number | null>(null)
  const [asking, setAsking] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const read = offers.map((o) => {
    const positive = !!o.positive
    const outcome = upgradeOutcome(o.stat_name, o.value, positive, fighter, caps)
    const text = upgradeText(o.stat_name, o.value, positive, outcome, factor)
    const tone = text.tag
      ? 'cap'
      : isAmbiguous(o.stat_name)
        ? 'mixed'
        : isBenefit(o.stat_name, positive)
          ? 'good'
          : 'bad'
    return { o, positive, outcome, text, tone: tone as StatHighlight['tone'] }
  })

  const lit = hover ?? asking
  const highlight: StatHighlight | undefined =
    lit !== null && read[lit]
      ? {
          field: read[lit].o.stat_name,
          to: panelFigure(read[lit].o.stat_name, read[lit].outcome, factor),
          tone: read[lit].tone,
          note: read[lit].text.tag ? read[lit].text.note : undefined,
        }
      : undefined

  const take = (i: number) => {
    const r = read[i]
    setAsking(null)
    setTaking(i)
    onClaim(r.o.stat_name, r.o.value, r.positive)
  }

  return (
    <div className="dasc dasc--offers">
      {/* ---------- the fighter, in full ---------- */}
      <div className="dasc__list">
        <div className="dasc__scroll">
          {/* Compact, the way the board's other columns are: the face and
              name in a line, then every stat, the six resistances in a row,
              and the abilities. */}
          <section className="dasc__fighter" aria-label={`${cap(fighter.classname)}, in full`}>
            <div className="dasc__fhero">
              <span
                className="dasc__fart"
                style={{ backgroundImage: `url('${elementBackground(fighter.element)}')` }}
              >
                <GameImg src={fighterArt(fighter)} fallback={fighterArtFallback()} alt="" />
              </span>
              <span className="dasc__fwho">
                <small>Ascending to ✦{fighter.ascension_level + 1}</small>
                <b>{cap(fighter.classname)}</b>
                <span>
                  {cap(fighter.racename)} · {cap(fighter.element)} · level {levelOf(fighter)}
                </span>
              </span>
            </div>
            <FighterStats fighter={panel} template={classes.get(fighter.classname)} highlight={highlight} />
            {panel.abilities.length > 0 && (
              <>
                <h3 className="dasc__fcap">Abilities · {panel.abilities.length}</h3>
                <FighterAbilities abilities={panel.abilities} abilityUnlockLevel={fighters?.asc_ability_unlock_lvl} />
              </>
            )}
          </section>
        </div>
      </div>

      {/* ---------- the altar, the fighter alone on it ---------- */}
      <div className="dasc__middle">
        <div className="dasc__risen">
          <span className="dasc__risenglow" aria-hidden="true" />
          <GameImg src={fighterArt(fighter)} fallback={fighterArtFallback()} alt="" />
          <span className="dasc__ascbadge">✦{fighter.ascension_level + 1}</span>
          <b>{cap(fighter.classname)}</b>
          <small>
            {cap(fighter.racename)} · {cap(fighter.element)} · L{levelOf(fighter)} · ascending to ✦
            {fighter.ascension_level + 1}
          </small>
        </div>
      </div>

      {/* ---------- the three, the re-roll, the odds ---------- */}
      <div className="dasc__right">
        <p className="dasc__hint dasc__intro">Three upgrades were rolled. Take one — the other two are gone.</p>
        {offers.length === 0 && <p className="faint">No offers on this fighter yet.</p>}
        {read.map(({ o, text, tone }, i) =>
          asking === i ? (
            <div className="dasc__offer is-cap is-asking" key={`${o.stat_name}-${o.value}-${i}`}>
              <img src={upgradeIcon(o.stat_name)} alt="" />
              <span className="dasc__offertext">
                <b>Take {text.applied}?</b>
                <small>{text.confirm}</small>
                <span className="dasc__offerasks">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={!canAct || busy !== null}
                    onClick={() => take(i)}
                  >
                    {busy === 'claim' && taking === i && <span className="spinner" />}
                    Take it
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(null)}>
                    Back
                  </button>
                </span>
              </span>
            </div>
          ) : (
            <div
              className={`dasc__offer is-${tone}`}
              key={`${o.stat_name}-${o.value}-${i}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <img src={upgradeIcon(o.stat_name)} alt="" />
              <span className="dasc__offertext">
                <b>
                  {text.tag && text.applied !== text.rolled && <s>{text.rolled}</s>}
                  {text.applied}
                  {text.tag && <em className="dasc__captag">{text.tag}</em>}
                </b>
                <small>{text.tag ? text.note : `${text.kind} · ${text.note}`}</small>
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!canAct || busy !== null}
                onClick={() => (text.confirm ? setAsking(i) : take(i))}
              >
                {busy === 'claim' && taking === i && <span className="spinner" />}
                Take
              </button>
            </div>
          ),
        )}

        {/* Kept well away from the Take buttons: its own card, after a gap. */}
        <div className="pasc__reroll dasc__reroll">
          <span>
            <b>None of these?</b>
            <small>Roll three new upgrades. These three are lost.</small>
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={!canAct || busy !== null || credits < rerollFee}
            onClick={onReroll}
            title={credits < rerollFee ? `Needs ${formatNumber(rerollFee)} credits` : undefined}
          >
            {busy === 'reroll' && <span className="spinner" />}
            Re-roll · {formatNumber(rerollFee)}
            <img className="pasc__coin" src={CREDITS} alt="credits" />
          </button>
        </div>
        {extra}
      </div>
    </div>
  )
}
