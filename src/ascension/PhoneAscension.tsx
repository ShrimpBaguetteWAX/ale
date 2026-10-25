import { useMemo, useState } from 'react'
import type { RosterFighter } from '@/dungeon/types'
import type { StatCaps, UpgradeOdds } from '@/ascension/queries'
import {
  REQUIREMENTS,
  SACRIFICE_COUNT,
  appliedValue,
  isAmbiguous,
  isBenefit,
  requirementsMet,
  statLabel,
  upgradeIcon,
  upgradeLabel,
  upgradeRange,
  type Requirement,
  type SacrificeCheck,
} from '@/ascension/rules'
import { fighterArt, fighterArtFallback } from '@/tavern/fighterStats'
import { BottomSheet } from '@/components/BottomSheet'
import { FighterRow, ListingBody } from '@/market/FighterRows'
import { DetailSheet, rosterPanel } from '@/fight/setup'
import { useConfig } from '@/state/useConfig'
import { GameImg } from '@/components/GameImg'
import { formatNumber } from '@/format'
import { asset } from '@/assets'

type Busy = 'ascend' | 'reroll' | 'claim' | null

const CREDITS = asset('/assets/icons/credits.png')
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const levelOf = (f: RosterFighter) => Number(f.stats?.level ?? 0)

/* Where each requirement sits on the altar, and how it reads for this fighter. */
const SOCKETS: { key: Requirement; pos: 'top' | 'left' | 'right' }[] = [
  { key: 'race', pos: 'top' },
  { key: 'element', pos: 'left' },
  { key: 'ability', pos: 'right' },
]

function needOf(key: Requirement, target: RosterFighter): { name: string; sub: string } {
  if (key === 'race') return { name: cap(target.racename), sub: 'same race' }
  if (key === 'element') return { name: cap(target.element), sub: 'same element' }
  return { name: 'Sacrifice', sub: 'the ability' }
}

/**
 * Ascension on a phone: the altar.
 *
 * The fighter that ascends sits in the middle, and the three it costs sit in
 * sockets around it — one per requirement, each named in this fighter's own
 * terms (its race, its element, the Sacrifice ability) with how many of the
 * player's fighters fit. A socket opens its candidates in a sheet. Once
 * ascended, the three rolled upgrades are dealt as cards, with Re-roll kept
 * well apart from the Take buttons.
 */
export function PhoneAscension({
  ready,
  target,
  onPickTarget,
  byRequirement,
  slots,
  onAssign,
  chosenFighters,
  check,
  fee,
  credits,
  busy,
  canAct,
  onAscend,
  pending,
  rerollFee,
  caps,
  factor,
  onReroll,
  onClaim,
  odds,
}: {
  ready: RosterFighter[]
  target: RosterFighter | null
  onPickTarget: (id: number) => void
  byRequirement: Record<Requirement, RosterFighter[]>
  slots: Partial<Record<Requirement, number>>
  onAssign: (key: Requirement, id: number) => void
  chosenFighters: RosterFighter[]
  check: SacrificeCheck | null
  fee: number
  credits: number
  busy: Busy
  canAct: boolean
  onAscend: () => void
  pending?: RosterFighter
  rerollFee: number
  caps?: StatCaps
  /** The level × age multiplier the offers and the odds are quoted at. */
  factor: number
  onReroll: () => void
  onClaim: (stat: string, value: number, positive: boolean) => void
  odds: UpgradeOdds[]
}) {
  const [sheet, setSheet] = useState<'target' | Requirement | null>(null)

  if (pending) {
    return (
      <Offers
        fighter={pending}
        rerollFee={rerollFee}
        credits={credits}
        busy={busy}
        canAct={canAct}
        caps={caps}
        factor={factor}
        onReroll={onReroll}
        onClaim={onClaim}
        odds={odds}
      />
    )
  }

  const filled = chosenFighters.length === SACRIFICE_COUNT
  const complete = filled && !!check?.ok
  const short = credits < fee
  const plural = target ? `${cap(target.classname)}s` : ''
  const chosen = (key: Requirement) =>
    chosenFighters.find((f) => f.fighter_id === slots[key]) ?? null

  return (
    <div className="prew pasc">
      <h1 className="pasc__title">Ascension</h1>

      {!target ? (
        <p className="pasc__hint">
          Put a fighter at the level cap in the middle. It is the one that ascends.
        </p>
      ) : complete ? (
        <div className="pasc__needs is-done">
          <b>Ready — these three are sacrificed:</b>
          {SOCKETS.map(({ key }) => {
            const f = chosen(key)!
            const need = needOf(key, target)
            return (
              <span key={key}>
                <i>✓</i>
                {key === 'ability' ? 'Sacrifice ability' : `${need.name}, ${need.sub}`} · level {levelOf(f)}
              </span>
            )
          })}
        </div>
      ) : (
        <div className="pasc__needs">
          <b>To ascend this fighter, sacrifice three other {plural}:</b>
          <span>
            <i>1</i>one <em>{cap(target.racename)}</em> — the same race
          </span>
          <span>
            <i>2</i>one <em>{cap(target.element)}</em> — the same element
          </span>
          <span>
            <i>3</i>one with the <em>Sacrifice</em> ability
          </span>
          <small>Three different fighters. All three are gone after ascending.</small>
          {filled && check && !check.ok && (
            <small>These three do not cover all three between them.</small>
          )}
        </div>
      )}

      <div className="pasc__stage">
        <div className="pasc__altar">
          <svg className="pasc__lines" viewBox="0 0 330 330" aria-hidden="true">
            <path d="M165 165 L62 262 M165 165 L268 262 M165 165 L165 62" />
          </svg>

          <button
            type="button"
            className={`pasc__core${target ? ' is-full' : ''}`}
            onClick={() => setSheet('target')}
            aria-label={target ? 'Choose a different fighter to ascend' : 'Choose a fighter to ascend'}
          >
            {target ? (
              <GameImg src={fighterArt(target)} fallback={fighterArtFallback()} alt="" />
            ) : (
              <i aria-hidden="true">+</i>
            )}
            <b>{target ? cap(target.classname) : 'Choose a fighter'}</b>
            <small>
              {target
                ? `${cap(target.racename)} · ${cap(target.element)} · L${levelOf(target)}`
                : `${formatNumber(ready.length)} at the level cap`}
            </small>
          </button>

          {SOCKETS.map(({ key, pos }) => {
            const f = chosen(key)
            const need = target ? needOf(key, target) : null
            const fit = byRequirement[key].length
            return (
              <button
                type="button"
                key={key}
                className={`pasc__sock pasc__sock--${pos}${f ? ' is-full' : ''}`}
                disabled={!target}
                onClick={() => setSheet(key)}
              >
                {f ? (
                  <GameImg src={fighterArt(f)} fallback={fighterArtFallback()} alt="" />
                ) : (
                  <i aria-hidden="true">+</i>
                )}
                <b>{need?.name ?? REQUIREMENTS.find((r) => r.key === key)?.label}</b>
                <small>
                  {f
                    ? `${cap(f.racename)} · L${levelOf(f)}`
                    : need
                      ? `${need.sub} · ${fit} fit`
                      : 'choose a fighter first'}
                </small>
              </button>
            )
          })}
        </div>
      </div>

      <div className="pasc__dock">
        {!target ? (
          <>
            <button type="button" className="btn btn--primary" onClick={() => setSheet('target')}>
              Choose a fighter
            </button>
            <small>{formatNumber(ready.length)} are at the level cap</small>
          </>
        ) : complete ? (
          <>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canAct || busy !== null || short}
              onClick={onAscend}
            >
              {busy === 'ascend' && <span className="spinner" />}
              Ascend · {formatNumber(fee)}
              <img className="pasc__coin" src={CREDITS} alt="credits" />
            </button>
            <small className={short ? 'is-short' : undefined}>
              {short
                ? `You have ${formatNumber(credits)} — not enough`
                : `You have ${formatNumber(credits)}`}
            </small>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--primary" disabled>
              Fill the three sockets
            </button>
            <small>Tap a socket to choose</small>
          </>
        )}
      </div>

      {sheet === 'target' && (
        <TargetSheet
          ready={ready}
          picked={target?.fighter_id ?? null}
          onPick={(id) => {
            onPickTarget(id)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheet !== 'target' && target && (
        <SocketSheet
          requirement={sheet}
          target={target}
          candidates={byRequirement[sheet]}
          slots={slots}
          onPick={(id) => {
            onAssign(sheet, id)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}

/* ---------- choosing ---------- */

/**
 * A fighter to choose, as the market draws it: portrait with level, the
 * Sacrifice skull and the player's own marker, then the graded stats and a
 * tag an ability. Nineteen Tacticians at the cap were nineteen identical
 * lines of "Tactician · Human · Nature · L10"; this is how they are told
 * apart.
 *
 * Tapping opens it in place on the full readouts, Details for everything,
 * and Choose — so looking is never the same tap as choosing.
 */
function PickRow({
  fighter: f,
  on,
  open,
  note,
  dim,
  onToggle,
  onDetails,
  onChoose,
}: {
  fighter: RosterFighter
  on: boolean
  open: boolean
  note?: string
  dim?: boolean
  onToggle: () => void
  onDetails: () => void
  onChoose: () => void
}) {
  const { classes, fighters } = useConfig()
  const template = classes.get(f.classname)
  return (
    <FighterRow
      stats={f.stats}
      ascension={f.ascension_level}
      template={template}
      marker={f.marker}
      dim={dim}
      open={open}
      onToggle={onToggle}
      below={note ? <span className="mrow__line">{note}</span> : undefined}
      right={<span className={`pasc__radio${on ? ' is-on' : ''}`} aria-hidden="true" />}
    >
      <ListingBody stats={f.stats} template={template} readout="stats" unlockLevel={fighters?.asc_ability_unlock_lvl} />
      <div className="mrow__acts">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onDetails}>
          Details
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={onChoose}>
          {on ? 'Chosen' : 'Choose'}
        </button>
      </div>
    </FighterRow>
  )
}

/** The whole fighter, over the sheet, from a row's Details. */
function PickDetails({ fighter, onClose }: { fighter: RosterFighter; onClose: () => void }) {
  const { classes, levelMod, ageDecay } = useConfig()
  return (
    <DetailSheet
      panel={rosterPanel(fighter, levelMod, ageDecay)}
      template={classes.get(fighter.classname)}
      onClose={onClose}
    />
  )
}


function TargetSheet({
  ready,
  picked,
  onPick,
  onClose,
}: {
  ready: RosterFighter[]
  picked: number | null
  onPick: (id: number) => void
  onClose: () => void
}) {
  const [cls, setCls] = useState<string | null>(null)
  const classes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of ready) counts.set(f.classname, (counts.get(f.classname) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [ready])
  const shown = cls ? ready.filter((f) => f.classname === cls) : ready
  const [open, setOpen] = useState<number | null>(null)
  const [details, setDetails] = useState<RosterFighter | null>(null)

  return (
    <BottomSheet title="Fighter to ascend" onClose={onClose}>
      {ready.length === 0 ? (
        <p className="rsheet__hint">
          No fighter is at the level cap yet. Level one up on My Fighters first.
        </p>
      ) : (
        <>
          <div className="pasc__chips">
            <button type="button" aria-pressed={cls === null} onClick={() => setCls(null)}>
              All {formatNumber(ready.length)}
            </button>
            {classes.map(([c, n]) => (
              <button type="button" key={c} aria-pressed={cls === c} onClick={() => setCls(c)}>
                {cap(c)} {n}
              </button>
            ))}
          </div>
          <div className="mrows">
            {shown.map((f) => (
              <PickRow
                key={f.fighter_id}
                fighter={f}
                on={f.fighter_id === picked}
                open={f.fighter_id === open}
                onToggle={() => setOpen((o) => (o === f.fighter_id ? null : f.fighter_id))}
                onDetails={() => setDetails(f)}
                onChoose={() => onPick(f.fighter_id)}
              />
            ))}
          </div>
        </>
      )}
      {details && <PickDetails fighter={details} onClose={() => setDetails(null)} />}
    </BottomSheet>
  )
}

function SocketSheet({
  requirement,
  target,
  candidates,
  slots,
  onPick,
  onClose,
}: {
  requirement: Requirement
  target: RosterFighter
  candidates: RosterFighter[]
  slots: Partial<Record<Requirement, number>>
  onPick: (id: number) => void
  onClose: () => void
}) {
  const need = needOf(requirement, target)
  /* Lowest level first: the cheapest fighter to give up is the one to offer. */
  const rows = useMemo(
    () => [...candidates].sort((a, b) => levelOf(a) - levelOf(b) || a.fighter_id - b.fighter_id),
    [candidates],
  )
  const [open, setOpen] = useState<number | null>(null)
  const [details, setDetails] = useState<RosterFighter | null>(null)
  const title =
    requirement === 'ability' ? 'Sacrifice ability' : `${cap(need.sub)} · ${need.name}`
  const what =
    requirement === 'race'
      ? `Another ${need.name} ${cap(target.classname)}.`
      : requirement === 'element'
        ? `Another ${cap(target.classname)} with the ${need.name} element.`
        : `A ${cap(target.classname)} that carries the Sacrifice ability.`

  return (
    <BottomSheet title={title} onClose={onClose}>
      <p className="rsheet__hint">{what} Lowest level first — the cheapest to give up.</p>
      {rows.length === 0 ? (
        <p className="rsheet__hint">
          Nothing in your roster fits. A sacrifice has to be another {cap(target.classname)} that
          is not busy or mid-ascension.
        </p>
      ) : (
        <div className="mrows">
          {rows.map((f) => {
            const met = requirementsMet(f, target)
            const elsewhere = REQUIREMENTS.find(
              (r) => r.key !== requirement && slots[r.key] === f.fighter_id,
            )
            const also = REQUIREMENTS.filter((r) => r.key !== requirement && met.has(r.key))
            return (
              <PickRow
                key={f.fighter_id}
                fighter={f}
                on={slots[requirement] === f.fighter_id}
                open={f.fighter_id === open}
                onToggle={() => setOpen((o) => (o === f.fighter_id ? null : f.fighter_id))}
                onDetails={() => setDetails(f)}
                dim={!!elsewhere}
                note={
                  elsewhere
                    ? `In the ${elsewhere.label.toLowerCase()} socket — picking it moves it here`
                    : also.length > 0
                      ? `Also fits ${also.map((r) => r.label.toLowerCase()).join(' and ')}`
                      : undefined
                }
                onChoose={() => onPick(f.fighter_id)}
              />
            )
          })}
        </div>
      )}
      {details && <PickDetails fighter={details} onClose={() => setDetails(null)} />}
    </BottomSheet>
  )
}

/* ---------- the three offers ---------- */

function Offers({
  fighter,
  rerollFee,
  credits,
  busy,
  canAct,
  caps,
  factor,
  onReroll,
  onClaim,
  odds,
}: {
  fighter: RosterFighter
  rerollFee: number
  credits: number
  busy: Busy
  canAct: boolean
  caps?: StatCaps
  factor: number
  onReroll: () => void
  onClaim: (stat: string, value: number, positive: boolean) => void
  odds: UpgradeOdds[]
}) {
  const offers = fighter.ascension_upgrades ?? []
  const [taking, setTaking] = useState<number | null>(null)
  const sorted = useMemo(() => [...odds].sort((a, b) => b.chance - a.chance), [odds])

  return (
    <div className="prew pasc">
      <h1 className="pasc__title">Ascension</h1>
      <div className="pasc__who">
        <GameImg src={fighterArt(fighter)} fallback={fighterArtFallback()} alt="" />
        <span>
          <b>
            {cap(fighter.classname)}
          </b>
          <small>Three upgrades were rolled. Take one — the other two are gone.</small>
        </span>
      </div>

      {offers.length === 0 ? (
        <p className="pasc__hint">No offers on this fighter yet.</p>
      ) : (
        <div className="pasc__cards">
          {offers.map((o, i) => {
            const positive = !!o.positive
            const good = isBenefit(o.stat_name, positive)
            const mixed = isAmbiguous(o.stat_name)
            const applied = appliedValue(o.stat_name, o.value, positive, fighter, caps)
            const capped = applied < o.value
            return (
              <div
                className={`pasc__card is-${mixed ? 'mixed' : good ? 'good' : 'bad'}`}
                key={`${o.stat_name}-${o.value}-${i}`}
              >
                <img src={upgradeIcon(o.stat_name)} alt="" />
                <b>{upgradeLabel(o.stat_name, applied, positive, factor)}</b>
                <small>
                  {capped
                    ? `Capped — ${statLabel(o.stat_name).toLowerCase()} cannot go lower`
                    : mixed
                      ? positive
                        ? 'Draws more attacks'
                        : 'Draws fewer attacks'
                      : good
                        ? 'Improvement'
                        : 'Penalty'}
                </small>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={!canAct || busy !== null}
                  onClick={() => {
                    setTaking(i)
                    onClaim(o.stat_name, o.value, positive)
                  }}
                >
                  {busy === 'claim' && taking === i && <span className="spinner" />}
                  Take
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Kept well away from the Take buttons: its own card, after a gap. */}
      <div className="pasc__reroll">
        <span>
          <b>None of these?</b>
          <small>Roll three new upgrades. These three are lost.</small>
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={!canAct || busy !== null || credits < rerollFee}
          onClick={onReroll}
        >
          {busy === 'reroll' && <span className="spinner" />}
          Re-roll · {formatNumber(rerollFee)}
          <img className="pasc__coin" src={CREDITS} alt="credits" />
        </button>
      </div>

      {sorted.length > 0 && (
        <>
          <div className="rsheet__cap">
            What can be rolled<span>{sorted.length} upgrades</span>
          </div>
          <div className="pasc__list">
            {sorted.map((u) => {
              const positive = !!u.positive_min_max
              const good = isBenefit(u.stat_name, positive)
              const mixed = isAmbiguous(u.stat_name)
              return (
                <div className="pasc__odds" key={`${u.category}-${u.upgrade_name}`}>
                  <img src={upgradeIcon(u.stat_name)} alt="" />
                  <span>{statLabel(u.stat_name)}</span>
                  <em className={mixed ? undefined : good ? 'is-good' : 'is-bad'}>
                    {upgradeRange(u.stat_name, u.min, u.max, positive, factor)}
                  </em>
                  <b className="mono">{(u.chance * 100).toFixed(1)}%</b>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
