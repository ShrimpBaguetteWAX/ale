import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import { fetchRoster } from '@/dungeon/queries'
import type { RosterFighter } from '@/dungeon/types'
import {
  fetchAllUpgrades,
  fetchAscensionConfig,
  type AscensionConfig,
  type UpgradeOdds,
} from '@/ascension/queries'
import {
  REQUIREMENTS,
  SACRIFICE_COUNT,
  canAscend,
  checkSacrifices,
  eligibleSacrifice,
  hasSacrificeAbility,
  isAmbiguous,
  isBenefit,
  requirementsMet,
  statLabel,
  upgradeLabel,
  type Requirement,
} from '@/ascension/rules'
import {
  ascendFighter,
  claimAscensionUpgrade,
  rerollAscension,
} from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import {
  elementBackground,
  fighterArtFallback,
  fighterAvatar,
  formatScaled,
} from '@/tavern/fighterStats'
import { formatNumber } from '@/format'

/**
 * Ascension.
 *
 * Three fighters are spent to push a fourth past the level cap. The screen is
 * built around the two things that actually stop a player: the sacrifices are
 * not interchangeable — between them they must cover element, race and the
 * Sacrifice ability, with no fighter counted twice — and the reward is a
 * choice of three rolled upgrades where taking one discards the other two.
 *
 * So the requirement check is shown as it is being built rather than reported
 * as a failure afterwards, and a fighter mid-ascension is picked up wherever
 * the player left it.
 */

type Busy = 'ascend' | 'reroll' | 'claim' | null

/**
 * Which list is on screen.
 *
 * Four, because there are four separate choices to make and they have
 * different candidates: the fighter to push past the cap, and then one
 * sacrifice for each requirement the contract checks. Shown as tabs rather
 * than one roster with badges on it because a player working through this is
 * answering one question at a time, and a list that mixes "could cover race"
 * with "covers nothing" makes them do the filtering by eye.
 */
type Tab = 'target' | Requirement

const TABS: { key: Tab; label: string }[] = [
  { key: 'target', label: 'Fighter to ascend' },
  ...REQUIREMENTS.map((r) => ({ key: r.key as Tab, label: r.label })),
]

export default function Ascension() {
  const account = useGame((s) => s.account)
  const session = useGame((s) => s.session)
  const player = useGame((s) => s.player)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [roster, setRoster] = useState<RosterFighter[]>([])
  const [config, setConfig] = useState<AscensionConfig>()
  const [odds, setOdds] = useState<UpgradeOdds[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)

  const [targetId, setTargetId] = useState<number | null>(null)
  /*
     One sacrifice per requirement, rather than three picked from one pile.

     The contract wants the three requirements covered by three *different*
     fighters, and the old screen let a player pick any three and then told
     them it did not work — "covered, but by a fighter already counted" was a
     sentence it had to have. A slot per requirement makes that arrangement
     the thing being built rather than something to be solved afterwards, and
     it is the same shape as the tabs the player picks from.
  */
  const [slots, setSlots] = useState<Partial<Record<Requirement, number>>>({})
  const [tab, setTab] = useState<Tab>('target')

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!account) return
    try {
      const [r, c, u] = await Promise.all([
        fetchRoster(account, true),
        fetchAscensionConfig(),
        fetchAllUpgrades(),
      ])
      if (!alive.current) return
      setRoster(r)
      setConfig(c)
      setOdds(u)
    } catch (err) {
      if (alive.current) setError(readableError(err))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [account])

  useEffect(() => {
    void load()
  }, [load])

  const run = useCallback(
    async (mark: Busy, act: () => Promise<unknown>, done: string) => {
      if (!session) return
      setBusy(mark)
      setError(null)
      setNotice(null)
      try {
        await act()
        /* The fighter row is rewritten by an inline action, so give the
           chain a moment and re-read a few times rather than once. */
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 900))
          await Promise.all([refreshPlayer({ force: true }), load()])
        }
        setNotice(done)
      } catch (err) {
        setError(readableError(err))
      } finally {
        setBusy(null)
      }
    },
    [session, refreshPlayer, load],
  )

  /* A fighter mid-ascension takes over the screen: it has offers waiting. */
  const pending = useMemo(
    () => roster.find((f) => !!f.ascension_in_progress),
    [roster],
  )

  const ready = useMemo(
    () => roster.filter((f) => canAscend(f, config).ok),
    [roster, config],
  )

  const target = useMemo(
    () => roster.find((f) => f.fighter_id === targetId) ?? null,
    [roster, targetId],
  )

  const candidates = useMemo(
    () => (target ? roster.filter((f) => eligibleSacrifice(f, target)) : []),
    [roster, target],
  )

  /*
     The candidates for each requirement, which is what each tab lists.

     A fighter can appear under more than one — one that shares the element
     and carries the ability is offered in both places — and choosing it in
     one takes it out of the other, because the contract will not count it
     twice.
  */
  const byRequirement = useMemo(() => {
    const out = {} as Record<Requirement, RosterFighter[]>
    for (const r of REQUIREMENTS) {
      out[r.key] = target
        ? candidates.filter((f) => requirementsMet(f, target).has(r.key))
        : []
    }
    return out
  }, [candidates, target])

  const chosenFighters = useMemo(
    () =>
      REQUIREMENTS.map((r) => slots[r.key])
        .map((id) => roster.find((f) => f.fighter_id === id))
        .filter((f): f is RosterFighter => !!f),
    [slots, roster],
  )

  const check = useMemo(
    () => (target ? checkSacrifices(chosenFighters, target) : null),
    [chosenFighters, target],
  )

  const credits = Number(player?.activestats?.credits ?? 0)
  const fee = Number(config?.ascension_credit_fee ?? 0)
  const rerollFee = Number(config?.ascension_reroll_credit_cost ?? 0)

  /*
     Assign to a slot, and take the fighter out of whichever slot it was in.

     No fighter can cover two requirements, so moving one is what picking it
     somewhere else means — rather than a silent refusal, or two slots holding
     the same fighter for the contract to reject.
  */
  const assign = (key: Requirement, id: number) =>
    setSlots((prev) => {
      const next: Partial<Record<Requirement, number>> = {}
      for (const r of REQUIREMENTS) {
        if (prev[r.key] !== undefined && prev[r.key] !== id) next[r.key] = prev[r.key]
      }
      /* Picking the one already in this slot clears it. */
      if (prev[key] !== id) next[key] = id
      return next
    })

  if (loading) {
    return (
      <div className="ascension">
        <div className="panel">
          <span className="spinner" /> Reading your roster…
        </div>
      </div>
    )
  }

  return (
    <div className="ascension">
      <header className="ascension__head">
        <div>
          <h1 className="screen__title">Ascension</h1>
          <p className="hint">
            Spend three fighters to push a maxed one past its cap. The three
            are not interchangeable — between them they have to cover element,
            race and the Sacrifice ability, and no fighter can cover two.
          </p>
        </div>
      </header>

      {error && <div className="alert alert--error">{error}</div>}
      {notice && <div className="alert alert--ok">{notice}</div>}

      {pending ? (
        <OfferPanel
          fighter={pending}
          rerollFee={rerollFee}
          credits={credits}
          busy={busy}
          canAct={!!session}
          onReroll={() =>
            void run(
              'reroll',
              () => rerollAscension(session!, pending.fighter_id, rerollFee),
              'Offers re-rolled.',
            )
          }
          onClaim={(stat, value, positive) =>
            void run(
              'claim',
              () =>
                claimAscensionUpgrade(
                  session!,
                  pending.fighter_id,
                  stat,
                  value,
                  positive,
                ),
              'Ascension complete.',
            )
          }
        />
      ) : (
        <Builder
          ready={ready}
          target={target}
          byRequirement={byRequirement}
          slots={slots}
          chosenFighters={chosenFighters}
          check={check}
          fee={fee}
          credits={credits}
          busy={busy}
          canAct={!!session}
          tab={tab}
          onTab={setTab}
          onPickTarget={(id) => {
            setTargetId((prev) => (prev === id ? null : id))
            setSlots({})
            /* Straight on to the first sacrifice, which is the next thing to
               decide — and back to the roster if the pick was undone. */
            setTab(targetId === id ? 'target' : 'element')
          }}
          onAssign={assign}
          onAscend={() =>
            void run(
              'ascend',
              () =>
                ascendFighter(
                  session!,
                  target!.fighter_id,
                  chosenFighters.map((f) => f.fighter_id),
                  fee,
                ),
              'Ascended. Choose your upgrade.',
            )
          }
        />
      )}

      <OddsPanel odds={odds} />
    </div>
  )
}

/* ---------- picking ---------- */

/**
 * The four choices, one tab each, with what is already chosen kept in view.
 *
 * The old screen put every eligible fighter in one grid and tagged each with
 * what it could cover, which left the player scanning sixty tiles for the one
 * that says "Ability" while remembering which two they had already taken. A
 * tab per requirement asks one question at a time, and answers "how many can
 * I even use here" in the tab itself.
 */
function Builder({
  ready,
  target,
  byRequirement,
  slots,
  chosenFighters,
  check,
  fee,
  credits,
  busy,
  canAct,
  tab,
  onTab,
  onPickTarget,
  onAssign,
  onAscend,
}: {
  ready: RosterFighter[]
  target: RosterFighter | null
  byRequirement: Record<Requirement, RosterFighter[]>
  slots: Partial<Record<Requirement, number>>
  chosenFighters: RosterFighter[]
  check: ReturnType<typeof checkSacrifices> | null
  fee: number
  credits: number
  busy: Busy
  canAct: boolean
  tab: Tab
  onTab: (t: Tab) => void
  onPickTarget: (id: number) => void
  onAssign: (key: Requirement, id: number) => void
  onAscend: () => void
}) {
  const short = credits < fee
  const complete = chosenFighters.length === SACRIFICE_COUNT && !!check?.ok

  const count = (t: Tab) =>
    t === 'target' ? ready.length : byRequirement[t].length

  const list = tab === 'target' ? ready : byRequirement[tab]
  const requirement = REQUIREMENTS.find((r) => r.key === tab)

  return (
    <>
      {/*
        What has been chosen so far, above the list it is chosen from.

        Four slots that are always on screen: the fighter being ascended and
        one per requirement. The empty ones say what belongs in them, so the
        shape of the whole errand is visible from the first click rather than
        emerging as tags accumulate across a grid.
      */}
      <section className="panel ascpick">
        <div className="ascpick__slots">
          <AscSlot
            label="Ascending"
            hint="A fighter at the level cap"
            fighter={target}
            active={tab === 'target'}
            onClick={() => onTab('target')}
          />
          {REQUIREMENTS.map((r) => (
            <AscSlot
              key={r.key}
              label={r.label}
              hint={r.hint}
              fighter={
                chosenFighters.find((f) => f.fighter_id === slots[r.key]) ?? null
              }
              active={tab === r.key}
              disabled={!target}
              onClick={() => target && onTab(r.key)}
            />
          ))}
        </div>

        <div className="ascpick__go">
          {short && (
            <p className="hint hint--error">
              You have {formatNumber(credits)} credits; this costs{' '}
              {formatNumber(fee)}.
            </p>
          )}
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAct || busy !== null || !complete || short}
            onClick={onAscend}
          >
            {busy === 'ascend' && <span className="spinner" />}
            Ascend for {formatNumber(fee)} credits
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="asctabs" role="tablist">
          {TABS.map((t) => (
            <button
              type="button"
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className="asctabs__tab"
              disabled={t.key !== 'target' && !target}
              onClick={() => onTab(t.key)}
            >
              {t.key === 'target' ? 'Ascend' : t.label}
              {/*
                The count is the useful half of the label. "Sacrifice ability
                0" is the answer to why a plan will not work, and it is worth
                seeing without opening the tab to find out.
              */}
              <span className="asctabs__n">{count(t.key)}</span>
            </button>
          ))}
        </div>

        {tab === 'target' ? (
          <>
            <p className="hint">
              Only a fighter at the level cap can be ascended. Level the others
              up on My Fighters first.
            </p>
            {ready.length === 0 ? (
              <p className="muted">
                No fighter is ready. They have to be at the level cap first.
              </p>
            ) : (
              <div className="ascgrid">
                {ready.map((f) => (
                  <AscCard
                    key={f.fighter_id}
                    fighter={f}
                    picked={target?.fighter_id === f.fighter_id}
                    onClick={() => onPickTarget(f.fighter_id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="hint">
              {requirement?.hint}. Every sacrifice also has to share the
              {' '}
              {target?.classname} class, and no fighter can cover two
              requirements.
            </p>
            {list.length === 0 ? (
              <p className="muted">
                Nothing in your roster covers this. A sacrifice has to be
                another {target?.classname} that is not already mid-ascension.
              </p>
            ) : (
              <div className="ascgrid">
                {list.map((f) => {
                  /* Already standing in for one of the other two. */
                  const usedElsewhere = REQUIREMENTS.some(
                    (r) => r.key !== tab && slots[r.key] === f.fighter_id,
                  )
                  return (
                    <AscCard
                      key={f.fighter_id}
                      fighter={f}
                      picked={slots[tab as Requirement] === f.fighter_id}
                      note={usedElsewhere ? 'Covering another' : undefined}
                      onClick={() => onAssign(tab as Requirement, f.fighter_id)}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}

/** One of the four things being chosen, filled or still waiting. */
function AscSlot({
  label,
  hint,
  fighter,
  active,
  disabled = false,
  onClick,
}: {
  label: string
  hint: string
  fighter: RosterFighter | null
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={
        'ascslot' +
        (fighter ? ' ascslot--filled' : '') +
        (active ? ' ascslot--active' : '')
      }
      disabled={disabled}
      onClick={onClick}
      title={hint}
    >
      <span className="ascslot__label">{label}</span>
      {fighter ? (
        <span className="ascslot__who">
          <img
            className="ascslot__art"
            src={fighterAvatar(fighter)}
            alt=""
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget
              if (img.dataset.fallback) return
              img.dataset.fallback = '1'
              img.src = fighterArtFallback()
            }}
          />
          <span className="ascslot__name">
            {fighter.racename} {fighter.classname}
          </span>
        </span>
      ) : (
        <span className="ascslot__empty">
          {disabled ? 'Pick a fighter first' : 'Not chosen'}
        </span>
      )}
    </button>
  )
}

/**
 * A fighter, shown the way the roster shows one.
 *
 * The old tile was a 56px thumbnail and one line of grey text, which is not
 * enough to tell two Tacticians apart — and telling them apart is the whole
 * of what this screen asks. Same portrait, name, level and the damage/health
 * pair My Fighters leads with.
 */
function AscCard({
  fighter,
  picked,
  note,
  onClick,
}: {
  fighter: RosterFighter
  picked: boolean
  note?: string
  onClick: () => void
}) {
  const s = fighter.stats
  return (
    <button
      type="button"
      className={'asccard' + (picked ? ' asccard--picked' : '')}
      aria-pressed={picked}
      onClick={onClick}
    >
      <span
        className="asccard__art"
        style={{ backgroundImage: `url('${elementBackground(fighter.element)}')` }}
      >
        <img
          src={fighterAvatar(fighter)}
          alt=""
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget
            if (img.dataset.fallback) return
            img.dataset.fallback = '1'
            img.src = fighterArtFallback()
          }}
        />
      </span>

      <span className="asccard__body">
        <span className="asccard__name">
          {fighter.racename} {fighter.classname}
        </span>
        <span className="asccard__chips">
          <i className="chip chip--level">Lv {Number(s?.level ?? 0)}</i>
          <i className="chip">{fighter.element}</i>
          {fighter.ascension_level > 0 && (
            <i className="chip chip--asc">Asc {fighter.ascension_level}</i>
          )}
        </span>
        <span className="asccard__stats mono">
          <span className="asccard__dmg">
            {formatScaled(Number(s?.damage_min ?? 0))}
          </span>
          <span className="asccard__hp">
            {formatScaled(Number(s?.health_min ?? 0))}
          </span>
        </span>
        {note && <span className="asccard__note">{note}</span>}
      </span>
    </button>
  )
}

/* ---------- the three offers ---------- */

function OfferPanel({
  fighter,
  rerollFee,
  credits,
  busy,
  canAct,
  onReroll,
  onClaim,
}: {
  fighter: RosterFighter
  rerollFee: number
  credits: number
  busy: Busy
  canAct: boolean
  onReroll: () => void
  onClaim: (stat: string, value: number, positive: boolean) => void
}) {
  const offers = fighter.ascension_upgrades ?? []

  return (
    <section className="panel">
      <div className="row row--wrap">
        <div className="miningintro">
          <h2 className="panel__title">
            {fighter.classname} is ascending
          </h2>
          <p className="hint">
            Three upgrades were rolled. Taking one applies it and ends the
            ascension — the other two are gone.
          </p>
        </div>
        <span className="spacer" />
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canAct || busy !== null || credits < rerollFee}
          onClick={onReroll}
          title={
            credits < rerollFee
              ? `Needs ${formatNumber(rerollFee)} credits`
              : 'Roll three new offers'
          }
        >
          {busy === 'reroll' && <span className="spinner" />}
          Re-roll for {formatNumber(rerollFee)}
        </button>
      </div>

      {offers.length === 0 ? (
        <p className="muted">No offers on this fighter yet.</p>
      ) : (
        <div className="offergrid">
          {offers.map((o, i) => {
            const positive = !!o.positive
            const good = isBenefit(o.stat_name, positive)
            const mixed = isAmbiguous(o.stat_name)
            return (
              <div
                className={`offer offer--${mixed ? 'mixed' : good ? 'good' : 'bad'}`}
                key={`${o.stat_name}-${o.value}-${i}`}
              >
                <span className="offer__stat">{statLabel(o.stat_name)}</span>
                <span className="offer__value">
                  {upgradeLabel(o.stat_name, o.value, positive)}
                </span>
                {/*
                  Direction is not the same as benefit. Cooldown and wind-up
                  are timers, so a subtraction is an improvement; taunt is
                  genuinely two-sided and depends on the squad.
                */}
                <span className="offer__note">
                  {mixed
                    ? positive
                      ? 'Draws more attacks'
                      : 'Draws fewer attacks'
                    : good
                      ? 'Improvement'
                      : 'Penalty'}
                </span>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={!canAct || busy !== null}
                  onClick={() => onClaim(o.stat_name, o.value, positive)}
                >
                  {busy === 'claim' && <span className="spinner" />}
                  Take this
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ---------- what can be rolled ---------- */

function OddsPanel({ odds }: { odds: UpgradeOdds[] }) {
  const sorted = useMemo(
    () => [...odds].sort((a, b) => b.chance - a.chance),
    [odds],
  )
  if (!sorted.length) return null

  return (
    /*
       Folded shut.

       It is a table of every upgrade in the game with a range and a
       percentage against each, which is worth having and is not worth the
       bottom half of the screen every visit: the page is for choosing a
       fighter and taking an offer, and both of those were below a wall of
       reference material. A summary that says how many there are, and
       opens.
    */
    <details className="panel oddspanel">
      <summary className="oddspanel__summary">
        What can be rolled
        <span className="oddspanel__count faint">{sorted.length} upgrades</span>
      </summary>
      <p className="hint">
        Every offer is drawn by weight: a category first, then an upgrade
        inside it. Each of the three offers is rolled independently.
      </p>
      <div className="oddslist">
        {sorted.map((u) => {
          const positive = !!u.positive_min_max
          const good = isBenefit(u.stat_name, positive)
          const mixed = isAmbiguous(u.stat_name)
          return (
            <div className="oddsrow" key={`${u.category}-${u.upgrade_name}`}>
              <span className="oddsrow__name">
                <strong>{statLabel(u.stat_name)}</strong>
                <em>{u.category}</em>
              </span>
              <span
                className={`oddsrow__range ${
                  mixed ? '' : good ? 'is-good' : 'is-bad'
                }`}
              >
                {positive ? '+' : '−'}
                {formatNumber(u.min)} to {positive ? '+' : '−'}
                {formatNumber(u.max)}
              </span>
              <span className="oddsrow__chance">
                {(u.chance * 100).toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </details>
  )
}

export { hasSacrificeAbility }
