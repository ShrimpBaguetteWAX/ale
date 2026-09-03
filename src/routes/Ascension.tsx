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
import { fighterArt, fighterArtFallback } from '@/tavern/fighterStats'
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
  const [chosen, setChosen] = useState<number[]>([])

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

  const chosenFighters = useMemo(
    () =>
      chosen
        .map((id) => roster.find((f) => f.fighter_id === id))
        .filter((f): f is RosterFighter => !!f),
    [chosen, roster],
  )

  const check = useMemo(
    () => (target ? checkSacrifices(chosenFighters, target) : null),
    [chosenFighters, target],
  )

  const credits = Number(player?.activestats?.credits ?? 0)
  const fee = Number(config?.ascension_credit_fee ?? 0)
  const rerollFee = Number(config?.ascension_reroll_credit_cost ?? 0)

  const toggle = (id: number) =>
    setChosen((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= SACRIFICE_COUNT
          ? prev
          : [...prev, id],
    )

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
          candidates={candidates}
          chosen={chosen}
          check={check}
          fee={fee}
          credits={credits}
          busy={busy}
          canAct={!!session}
          onPickTarget={(id) => {
            setTargetId(id)
            setChosen([])
          }}
          onToggle={toggle}
          onAscend={() =>
            void run(
              'ascend',
              () => ascendFighter(session!, target!.fighter_id, chosen, fee),
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

function Builder({
  ready,
  target,
  candidates,
  chosen,
  check,
  fee,
  credits,
  busy,
  canAct,
  onPickTarget,
  onToggle,
  onAscend,
}: {
  ready: RosterFighter[]
  target: RosterFighter | null
  candidates: RosterFighter[]
  chosen: number[]
  check: ReturnType<typeof checkSacrifices> | null
  fee: number
  credits: number
  busy: Busy
  canAct: boolean
  onPickTarget: (id: number) => void
  onToggle: (id: number) => void
  onAscend: () => void
}) {
  const short = credits < fee
  const complete = chosen.length === SACRIFICE_COUNT && !!check?.ok

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">Choose a fighter to ascend</h2>
        {ready.length === 0 ? (
          <p className="muted">
            No fighter is ready. They have to be at the level cap first — level
            them up on the My Fighters screen.
          </p>
        ) : (
          <div className="ascgrid">
            {ready.map((f) => (
              <FighterTile
                key={f.fighter_id}
                fighter={f}
                picked={target?.fighter_id === f.fighter_id}
                onClick={() => onPickTarget(f.fighter_id)}
              />
            ))}
          </div>
        )}
      </section>

      {target && (
        <section className="panel">
          <div className="row row--wrap">
            <div className="miningintro">
              <h2 className="panel__title">
                Sacrifices ({chosen.length}/{SACRIFICE_COUNT})
              </h2>
              <p className="hint">
                All three must share {target.classname}'s class. Between them
                they must cover every requirement below.
              </p>
            </div>
            <span className="spacer" />
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

          {/*
            Shown while the pick is being built rather than reported as a
            failure afterwards: the contract's own message is "one or more
            sacrifices do not match the required criteria", which does not
            say which, and the rule is easy to trip on by accident.
          */}
          <div className="reqs">
            {REQUIREMENTS.map((r) => {
              const filledBy = check?.assignment.get(r.key)
              const anyMatch = chosen.some((id) => {
                const f = candidates.find((c) => c.fighter_id === id)
                return f ? requirementsMet(f, target).has(r.key) : false
              })
              const state = filledBy ? 'ok' : anyMatch ? 'clash' : 'todo'
              return (
                <span className={`req req--${state}`} key={r.key} title={r.hint}>
                  <b>{state === 'ok' ? '✓' : state === 'clash' ? '!' : '·'}</b>
                  {r.label}
                  {state === 'clash' && (
                    <em> — covered, but by a fighter already counted</em>
                  )}
                </span>
              )
            })}
          </div>

          {short && (
            <p className="hint hint--error">
              You have {formatNumber(credits)} credits; this costs{' '}
              {formatNumber(fee)}.
            </p>
          )}

          {candidates.length === 0 ? (
            <p className="muted">
              No other {target.classname} in your roster to sacrifice.
            </p>
          ) : (
            <div className="ascgrid">
              {candidates.map((f) => (
                <FighterTile
                  key={f.fighter_id}
                  fighter={f}
                  picked={chosen.includes(f.fighter_id)}
                  meets={requirementsMet(f, target)}
                  disabled={
                    !chosen.includes(f.fighter_id) &&
                    chosen.length >= SACRIFICE_COUNT
                  }
                  onClick={() => onToggle(f.fighter_id)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}

function FighterTile({
  fighter,
  picked,
  meets,
  disabled = false,
  onClick,
}: {
  fighter: RosterFighter
  picked: boolean
  meets?: Set<Requirement>
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={
        'asctile' +
        (picked ? ' asctile--picked' : '') +
        (disabled ? ' asctile--off' : '')
      }
      aria-pressed={picked}
      disabled={disabled}
      onClick={onClick}
    >
      <img
        src={fighterArt(fighter)}
        alt=""
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget
          if (img.dataset.fallback) return
          img.dataset.fallback = '1'
          img.src = fighterArtFallback()
        }}
      />
      <span className="asctile__body">
        <strong>{fighter.classname}</strong>
        <em>
          {fighter.racename} · {fighter.element} · lvl{' '}
          {formatNumber(Number(fighter.stats?.level ?? 0))}
        </em>
        {meets && (
          <span className="asctile__tags">
            {meets.has('element') && <i className="tag tag--el">Element</i>}
            {meets.has('race') && <i className="tag tag--race">Race</i>}
            {meets.has('ability') && <i className="tag tag--abil">Ability</i>}
            {meets.size === 0 && <i className="tag tag--none">No match</i>}
          </span>
        )}
        {fighter.ascension_level > 0 && (
          <span className="asctile__asc">Asc {fighter.ascension_level}</span>
        )}
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
