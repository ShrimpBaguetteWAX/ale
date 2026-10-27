import { useCallback, useMemo, useState } from 'react'
import type { RosterFighter } from '@/dungeon/types'
import {
  REQUIREMENTS,
  SACRIFICE_COUNT,
  eligibleSacrifice,
  requirementsMet,
  type Requirement,
  type SacrificeCheck,
} from '@/ascension/rules'
import { markerIcon } from '@/dungeon/filters'
import { fighterArt, fighterArtFallback } from '@/tavern/fighterStats'
import { Row, figuresOf, type Figures } from '@/fighters/DeskRoster'
import { GameImg } from '@/components/GameImg'
import { HoverPopover, useHoverCard } from '@/components/HoverPopover'
import { FighterHoverCard } from '@/components/FighterPanel'
import { rosterPanel } from '@/fight/setup'
import { useConfig } from '@/state/useConfig'
import { formatNumber } from '@/format'
import { asset } from '@/assets'

type Busy = 'ascend' | 'reroll' | 'claim' | null
type List = 'target' | Requirement

const CREDITS = asset('/assets/icons/credits.png')
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const levelOf = (f: RosterFighter) => Number(f.stats?.level ?? 0)

/* Where each requirement sits on the altar, as on the phone. */
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

/** The fighters in the roster that could fill each socket for this one. */
function fitsFor(target: RosterFighter, roster: RosterFighter[]): Record<Requirement, RosterFighter[]> {
  const pool = roster.filter((f) => eligibleSacrifice(f, target))
  const out = {} as Record<Requirement, RosterFighter[]>
  for (const r of REQUIREMENTS) out[r.key] = pool.filter((f) => requirementsMet(f, target).has(r.key))
  return out
}

/**
 * Ascension on a desktop: the phone's altar in the middle, the list it is
 * filled from beside it, and what this ascension does and costs on the right.
 *
 * The phone puts each choice in a sheet over the altar; a desktop has the
 * width to keep the list open beside it, so the altar is always in view and
 * a socket clicked there is the list shown here. The list is the market's
 * rows — markers, grades, ability tags — because the hard part was always
 * telling forty Tacticians apart, and it carries the tools a long list
 * needs: the player's markers to narrow by, and an order.
 *
 * Choosing the fighter that ascends puts it on the altar at once and opens
 * its sockets; the list beside it says how many sockets each one already has
 * a fighter for. Clicking it on the altar takes it off again, and its
 * sacrifices with it.
 */
export function DeskAscension({
  roster,
  ready,
  target,
  onPlace,
  onClear,
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
  extra,
}: {
  roster: RosterFighter[]
  ready: RosterFighter[]
  target: RosterFighter | null
  onPlace: (id: number) => void
  /** Takes the fighter off the altar, and its sacrifices with it. */
  onClear: () => void
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
  /** What goes under the deal: the table of what can be rolled. */
  extra?: React.ReactNode
}) {
  const { classes, fighters, levelMod, ageDecay } = useConfig()
  const unlockAt = Number(fighters?.asc_ability_unlock_lvl ?? 0)

  /*
     The list on show: the fighters at the cap until one is on the altar,
     then the candidates for one socket.
  */
  const [sock, setSock] = useState<Requirement>('race')
  const list: List = target ? sock : 'target'
  const [cls, setCls] = useState<string | null>(null)
  const [marker, setMarker] = useState<string | null>(null)
  const [order, setOrder] = useState<'first' | 'last'>('first')

  const show = (next: Requirement) => {
    setSock(next)
    setMarker(null)
    setOrder('first')
  }

  const chosen = (key: Requirement) => chosenFighters.find((f) => f.fighter_id === slots[key]) ?? null

  /* How many sockets each fighter at the cap already has a fighter for. */
  const covered = useMemo(() => {
    const m = new Map<number, number>()
    if (list !== 'target') return m
    for (const f of ready) {
      const fits = fitsFor(f, roster)
      m.set(f.fighter_id, REQUIREMENTS.filter((r) => fits[r.key].length > 0).length)
    }
    return m
  }, [list, ready, roster])

  /* The rows, through the class chips, the marker chips and the order. */
  const base = list === 'target' ? ready : byRequirement[list]
  const classCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of ready) m.set(f.classname, (m.get(f.classname) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [ready])
  const inClass = list === 'target' && cls ? base.filter((f) => f.classname === cls) : base
  const markerCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of inClass) m.set(f.marker || '', (m.get(f.marker || '') ?? 0) + 1)
    return [...m.entries()].filter(([k]) => k).sort((a, b) => b[1] - a[1])
  }, [inClass])
  const unmarked = inClass.filter((f) => !f.marker).length
  const rows = useMemo(() => {
    const out = inClass
      .filter((f) => marker === null || (f.marker || '') === marker)
    if (list === 'target') {
      /* Those whose three sacrifices the player already owns first. */
      return [...out].sort(
        (a, b) =>
          (order === 'first' ? 1 : -1) * ((covered.get(b.fighter_id) ?? 0) - (covered.get(a.fighter_id) ?? 0)) ||
          a.fighter_id - b.fighter_id,
      )
    }
    /* The phone's order: lowest level first, the cheapest to give up. */
    return [...out].sort(
      (a, b) => (order === 'first' ? 1 : -1) * (levelOf(a) - levelOf(b)) || a.fighter_id - b.fighter_id,
    )
  }, [inClass, marker, list, order, covered])

  /*
     My Fighters' own card, figures and all, so a fighter looks the same on
     both screens. The list is a phone's width, so it takes the stacked card.
  */
  const [now] = useState(() => Date.now())
  const figures = useMemo(() => {
    const m = new Map<number, Figures>()
    for (const f of rows) m.set(f.fighter_id, figuresOf(f, classes.get(f.classname), fighters, levelMod, ageDecay, now, false))
    return m
  }, [rows, classes, fighters, levelMod, ageDecay, now])
  const card = (f: RosterFighter, extra: Partial<React.ComponentProps<typeof Row>>) => (
    <Row
      f={f}
      fig={figures.get(f.fighter_id)!}
      view="default"
      mode="inventory"
      now={now}
      picked={false}
      checked={false}
      gate={{ ok: true }}
      onClick={() => {}}
      {...extra}
    />
  )

  const filled = chosenFighters.length === SACRIFICE_COUNT
  const complete = filled && !!check?.ok
  const short = credits < fee
  const plural = target ? `${cap(target.classname)}s` : ''
  const orderPick = (
    <select
      className="dasc__order"
      value={order}
      onChange={(e) => setOrder(e.target.value as 'first' | 'last')}
      aria-label="Order"
    >
      {list === 'target' ? (
        <>
          <option value="first">Most sockets ready</option>
          <option value="last">Fewest sockets ready</option>
        </>
      ) : (
        <>
          <option value="first">Lowest level first</option>
          <option value="last">Highest level first</option>
        </>
      )}
    </select>
  )

  return (
    <div className="dasc">
      {/* ---------- the list ---------- */}
      <div className="dasc__list">
        {/* With a fighter on the altar: its three sockets, three chips on a line. */}
        {target && (
          <div className="dasc__chips">
            {SOCKETS.map(({ key }) => {
              const need = needOf(key, target)
              return (
                <button type="button" key={key} aria-pressed={list === key} onClick={() => show(key)}>
                  {key === 'ability' ? 'Sacrifice ability' : `${cap(need.sub)} · ${need.name}`}
                  <em>{byRequirement[key].length}</em>
                </button>
              )
            })}
          </div>
        )}

        {/*
          The filters in two lines rather than six. Thirteen class pills
          wrapped into four rows and pushed the list a hand's width down; as a
          dropdown beside the order the class takes one control's room, and
          the markers share their line with the count.
        */}
        {!target && (
          <div className="dasc__filterrow">
            <select
              className="dasc__order dasc__class"
              value={cls ?? ''}
              onChange={(e) => setCls(e.target.value || null)}
              aria-label="Class"
            >
              <option value="">All classes · {ready.length}</option>
              {classCounts.map(([c, n]) => (
                <option key={c} value={c}>
                  {cap(c)} · {n}
                </option>
              ))}
            </select>
            {orderPick}
          </div>
        )}

        <div className="dasc__tools">
          {(markerCounts.length > 0 || unmarked > 0) && (
            <div className="dasc__markers" role="group" aria-label="Your markers">
              {markerCounts.map(([m, n]) => (
                <button
                  type="button"
                  key={m}
                  aria-pressed={marker === m}
                  title={`Marked ${m}`}
                  onClick={() => setMarker((x) => (x === m ? null : m))}
                >
                  <img src={markerIcon(m)} alt={m} />
                  <em>{n}</em>
                </button>
              ))}
              {markerCounts.length > 0 && unmarked > 0 && (
                <button type="button" aria-pressed={marker === ''} onClick={() => setMarker((x) => (x === '' ? null : ''))}>
                  None <em>{unmarked}</em>
                </button>
              )}
            </div>
          )}
          <span className="dasc__count">
            <b className="mono">{rows.length}</b>
            {rows.length !== base.length && <> of {base.length}</>}{' '}
            {list === 'target'
              ? 'at the cap'
              : target
                ? `${list === 'ability' ? `${plural} with Sacrifice` : `${needOf(list, target).name} ${plural}`} fit`
                : ''}
          </span>
          {target && orderPick}
        </div>

        {rows.length === 0 ? (
          <p className="faint dasc__empty">
            {base.length === 0
              ? list === 'target'
                ? 'No fighter is at the level cap yet. Level one up on My Fighters first.'
                : `Nothing in your roster fits. A sacrifice has to be another ${target ? cap(target.classname) : ''} that is not busy or mid-ascension.`
              : 'Nothing matches.'}
          </p>
        ) : (
          <div className="drost--stack drost__rows dasc__rows">
            {rows.map((f) => {
              if (list === 'target') {
                const n = covered.get(f.fighter_id) ?? 0
                return (
                  <Peek key={f.fighter_id} fighter={f}>
                    {card(f, {
                      onClick: () => {
                        onPlace(f.fighter_id)
                        show('race')
                      },
                      aside: (
                        <span className={`dasc__fit${n === 3 ? ' is-all' : ''}`} title="Sockets you have a fighter for">
                          {n}/3
                        </span>
                      ),
                    })}
                  </Peek>
                )
              }
              const key = list
              const elsewhere = REQUIREMENTS.find((r) => r.key !== key && slots[r.key] === f.fighter_id)
              const also = target
                ? REQUIREMENTS.filter((r) => r.key !== key && !slots[r.key] && requirementsMet(f, target).has(r.key))
                : []
              const on = slots[key] === f.fighter_id
              return (
                <Peek key={f.fighter_id} fighter={f}>
                  {card(f, {
                    picked: on,
                    dim: !!elsewhere,
                    onClick: () => onAssign(key, f.fighter_id),
                    note: elsewhere
                      ? `In the ${elsewhere.label.toLowerCase()} socket — choosing it moves it here`
                      : also.length > 0
                        ? `Also fits ${also.map((r) => r.label.toLowerCase()).join(' and ')}`
                        : undefined,
                    aside: <span className={`pasc__radio${on ? ' is-on' : ''}`} aria-hidden="true" />,
                  })}
                </Peek>
              )
            })}
          </div>
        )}
      </div>

      {/* ---------- the altar, alone in the middle ---------- */}
      <div className="dasc__middle">
        <div className="pasc__stage dasc__stage">
          <div className="pasc__altar">
            <svg className="pasc__lines" viewBox="0 0 330 330" aria-hidden="true">
              <path d="M165 165 L62 262 M165 165 L268 262 M165 165 L165 62" />
            </svg>
            <button
              type="button"
              className={`pasc__core${target ? ' is-full is-removable' : ' is-active'}`}
              onClick={() => target && onClear()}
              aria-label={target ? 'Take this fighter off the altar' : 'Choose the fighter to ascend from the list'}
              title={target ? 'Take it off the altar — its sacrifices come off too' : undefined}
            >
              {target ? (
                <GameImg src={fighterArt(target)} fallback={fighterArtFallback()} alt="" />
              ) : (
                <i aria-hidden="true">+</i>
              )}
              {target?.marker && (
                <span className="dasc__coremark">
                  <img src={markerIcon(target.marker)} alt="" />
                </span>
              )}
              <b>{target ? cap(target.classname) : 'Choose the fighter'}</b>
              <small>
                {target
                  ? `${cap(target.racename)} · ${cap(target.element)} · L${levelOf(target)}`
                  : `${formatNumber(ready.length)} at the level cap`}
              </small>
            </button>

            {SOCKETS.map(({ key, pos }) => {
              const f = target ? chosen(key) : null
              const need = target ? needOf(key, target) : null
              return (
                <button
                  type="button"
                  key={key}
                  className={`pasc__sock pasc__sock--${pos}${f ? ' is-full' : ''}${list === key ? ' is-active' : ''}`}
                  disabled={!target}
                  onClick={() => show(key)}
                >
                  {f ? <GameImg src={fighterArt(f)} fallback={fighterArtFallback()} alt="" /> : <i aria-hidden="true">+</i>}
                  <b>{need?.name ?? REQUIREMENTS.find((r) => r.key === key)?.label}</b>
                  <small>
                    {f
                      ? `${cap(f.racename)} · L${levelOf(f)}`
                      : need
                        ? `${need.sub} · ${byRequirement[key].length} fit`
                        : 'choose a fighter first'}
                  </small>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ---------- what it needs, does and costs, and what it can roll ---------- */}
      <div className="dasc__right">
        {!target ? (
          <div className="pasc__needs">
            <b>Put a fighter at the level cap in the middle. It is the one that ascends.</b>
            <small className="dasc__soft">Choose one on the left to put it on the altar.</small>
          </div>
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
            {/* Each need with where it stands: how many of the roster fit it,
                or the level of the one in its socket. */}
            {SOCKETS.map(({ key }, i) => {
              const placed = chosen(key)
              const fits = byRequirement[key].length
              return (
                <span key={key} className={placed ? 'is-placed' : fits === 0 ? 'is-none' : undefined}>
                  <i>{placed ? '✓' : i + 1}</i>
                  {key === 'race' ? (
                    <>
                      one <em>{cap(target.racename)}</em> — the same race
                    </>
                  ) : key === 'element' ? (
                    <>
                      one <em>{cap(target.element)}</em> — the same element
                    </>
                  ) : (
                    <>
                      one with the <em>Sacrifice</em> ability
                    </>
                  )}
                  <small className="dasc__fitn">
                    {placed ? `level ${levelOf(placed)}` : fits === 0 ? 'none fit' : fits === 1 ? '1 fits' : `${fits} fit`}
                  </small>
                </span>
              )
            })}
            <small>Three different fighters. All three are gone after ascending.</small>
            {filled && check && !check.ok && <small>These three do not cover all three between them.</small>}
          </div>
        )}

        <aside className="dasc__side">
          {!target ? (
            <>
              <span className="dasc__cap">Ascension</span>
              <p className="dasc__hint">
                Three fighters of the same class are spent to push a fourth past the level cap: one of its race, one of
                its element, one with the Sacrifice ability.
              </p>
              <dl className="mfacts">
                <div>
                  <dt>At the level cap</dt>
                  <dd className="mono">{formatNumber(ready.length)}</dd>
                </div>
                <div>
                  <dt>Your credits</dt>
                  <dd className="mono">{formatNumber(credits)}</dd>
                </div>
              </dl>
              <button type="button" className="btn btn--primary dasc__go" disabled>
                Choose a fighter
              </button>
            </>
          ) : (
            <>
              <span className="dasc__cap">This ascension</span>
              <dl className="mfacts">
                <div>
                  <dt>Ascension</dt>
                  <dd className="mono">
                    ✦{target.ascension_level} → ✦{target.ascension_level + 1}
                  </dd>
                </div>
                {unlockAt > 0 && (target.stats?.abilities ?? []).some((a) => a.locked) && (
                  <div>
                    <dt>Locked ability</dt>
                    <dd className="mono">
                      {target.ascension_level + 1 >= unlockAt ? 'starts working' : `works from ✦${unlockAt}`}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Fee</dt>
                  <dd className="mono">
                    {formatNumber(fee)}
                    <img className="pasc__coin" src={CREDITS} alt="credits" />
                  </dd>
                </div>
              </dl>

              {complete ? (
                <>
                  <button
                    type="button"
                    className="btn btn--primary dasc__go"
                    disabled={!canAct || busy !== null || short}
                    onClick={onAscend}
                  >
                    {busy === 'ascend' && <span className="spinner" />}
                    Ascend · {formatNumber(fee)}
                    <img className="pasc__coin" src={CREDITS} alt="credits" />
                  </button>
                  <p className="dasc__hint">
                    {short
                      ? `You have ${formatNumber(credits)} — not enough.`
                      : 'The three sacrifices are gone after ascending. Then three upgrades are rolled and you take one.'}
                  </p>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn--primary dasc__go" disabled>
                    Fill the three sockets
                  </button>
                  <p className="dasc__hint">
                    Click a socket on the altar, or a tab above the list. Click the fighter on the altar to take it
                    off — its sacrifices come off with it.
                  </p>
                </>
              )}
            </>
          )}
        </aside>
        {extra}
      </div>
    </div>
  )
}

/**
 * A row that shows its fighter in full on a resting pointer — the same card
 * the desktop pickers open — so a fighter can be looked at before it is
 * chosen, while a click still chooses it at once.
 */
function Peek({ fighter, children }: { fighter: RosterFighter; children: React.ReactNode }) {
  const { classes, levelMod, ageDecay } = useConfig()
  const make = useCallback(
    () => ({ panel: rosterPanel(fighter, levelMod, ageDecay), template: classes.get(fighter.classname) }),
    [fighter, levelMod, ageDecay, classes],
  )
  const { ref, shown, close, handlers } = useHoverCard(make, true)
  return (
    <div className="dasc__peek" ref={ref} {...handlers} onClick={close}>
      {children}
      {shown && (
        <HoverPopover anchor={shown.rect}>
          <FighterHoverCard fighter={shown.value.panel} template={shown.value.template} />
        </HoverPopover>
      )}
    </div>
  )
}
