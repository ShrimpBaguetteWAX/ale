import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { fetchRoster } from '@/dungeon/queries'
import { battleFactor } from '@/fighters/rules'
import { levelFactor } from '@/fight/scaling'
import { usePhone } from '@/components/usePhone'
import type { RosterFighter } from '@/dungeon/types'
import type { UpgradeOdds } from '@/ascension/queries'
import {
  REQUIREMENTS,
  canAscend,
  checkSacrifices,
  eligibleSacrifice,
  hasSacrificeAbility,
  isAmbiguous,
  isBenefit,
  requirementsMet,
  statLabel,
  upgradeIcon,
  upgradeRange,
  type Requirement,
} from '@/ascension/rules'
import {
  ascendFighter,
  claimAscensionUpgrade,
  rerollAscension,
} from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { DIRTIES } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import { useConfig, useLazyConfig } from '@/state/useConfig'
import { PhoneAscension } from '@/ascension/PhoneAscension'
import { DeskAscension } from '@/ascension/DeskAscension'
import { DeskOffers } from '@/ascension/DeskOffers'

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

/* One empty list, so the odds panel's sort is not redone every render while
   the table is still on its way. */
const EMPTY_ODDS: UpgradeOdds[] = []

export default function Ascension() {
  const account = useGame((s) => s.account)
  const session = useGame((s) => s.session)
  const player = useGame((s) => s.player)

  const [roster, setRoster] = useState<RosterFighter[]>([])
  const [loading, setLoading] = useState(true)

  /*
     The level and age figures the screen quotes health and damage with, from
     the same store My Fighters reads, so the two never disagree about a
     fighter's damage while the config is in flight.
  */
  const {
    levelMod,
    ageDecay,
    loaded: configLoaded,
  } = useConfig()
  const config = useLazyConfig('ascension')
  const odds = useLazyConfig('upgrades') ?? EMPTY_ODDS
  /* Narrowed where it enters the screen, so the offer panel keeps taking
     `Busy` and every comparison still has to name a real button. */
  const { busy: busyKey, error, run, setError } = useAction()
  const busy = busyKey as Busy

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
  const phone = usePhone()

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
      const r = await fetchRoster(account, true)
      if (!alive.current) return
      setRoster(r)
    } catch (err) {
      if (alive.current) setError(readableError(err))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [account])

  useEffect(() => {
    void load()
  }, [load])

  /* The fighter row is rewritten by an inline action, so the roster is
     re-read a few times rather than once. */
  const opts = (action: keyof typeof DIRTIES) => ({ after: load, dirties: DIRTIES[action] })

  /* A fighter mid-ascension takes over the screen: it has offers waiting. */
  const pending = useMemo(
    () => roster.find((f) => !!f.ascension_in_progress),
    [roster],
  )

  const ready = useMemo(
    () => roster.filter((f) => canAscend(f, config).ok),
    [roster, config],
  )

  /* The level every ascending fighter is at — `check(level == min_ascension
     _level)` is equality, so it is the one level the odds table ever
     describes. 10 while the config is still loading. */
  const ascendLevel = Number(config?.min_ascension_level) || 10

  /*
     Arriving from a fighter's Ascend button (`?fighter=<id>`), that fighter
     is the one picked — once, when the roster first arrives, so a reload of
     the roster after an action does not take back a different pick.
  */
  const [params] = useSearchParams()
  const asked = Number(params.get('fighter')) || null
  const applied = useRef(false)
  useEffect(() => {
    if (applied.current || !asked || loading) return
    applied.current = true
    if (ready.some((f) => f.fighter_id === asked)) {
      setSlots({})
      setTargetId(asked)
    }
  }, [asked, loading, ready])

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

  if (loading || !configLoaded) {
    return (
      <div className="ascension">
        <div className="panel">
          <span className="spinner" /> Reading your roster…
        </div>
      </div>
    )
  }

  /* What the offers and the odds are quoted at: the fighter on screen, or the level cap. */
  const factor =
    pending ?? target
      ? battleFactor((pending ?? target)!, levelMod, ageDecay).total
      : levelFactor(ascendLevel, levelMod)

  if (phone) {
    return (
      <div className="ascension">
        {error && <div className="alert alert--error">{error}</div>}
        <PhoneAscension
          ready={ready}
          target={target}
          onPickTarget={(id) => {
            if (id !== targetId) setSlots({})
            setTargetId(id)
          }}
          byRequirement={byRequirement}
          slots={slots}
          onAssign={assign}
          chosenFighters={chosenFighters}
          check={check}
          fee={fee}
          credits={credits}
          busy={busy}
          canAct={!!session}
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
              opts('ascendFighter'),
            )
          }
          pending={pending}
          rerollFee={rerollFee}
          caps={config?.battle_stat_caps}
          factor={factor}
          onReroll={() =>
            pending &&
            void run(
              'reroll',
              () => rerollAscension(session!, pending.fighter_id, rerollFee),
              'Offers re-rolled.',
              opts('rerollAscension'),
            )
          }
          onClaim={(stat, value, positive) =>
            pending &&
            void run(
              'claim',
              () => claimAscensionUpgrade(session!, pending.fighter_id, stat, value, positive),
              'Ascension complete.',
              opts('claimAscensionUpgrade'),
            )
          }
          odds={odds}
        />
      </div>
    )
  }

  /*
    Quoted for the fighter on screen: the one mid-ascension if there is
    one, otherwise the one picked to ascend.

    With neither, the level cap rather than the bare stored values. Only
    a fighter at the cap can be ascended at all, so every fighter this
    table will ever apply to is at that level — quoting health and damage
    at level 1 until somebody is picked showed a quarter of the real
    figure, and showed it to exactly the player still deciding whether
    the errand is worth doing.
  */
  const oddsPanel = (
    <OddsPanel
      odds={odds}
      open
      factor={
        pending ?? target
          ? battleFactor((pending ?? target)!, levelMod, ageDecay).total
          : levelFactor(ascendLevel, levelMod)
      }
    />
  )

  return (
    <div className="ascension">
      <header className="ascension__head">
        <h1 className="screen__title">Ascension</h1>
      </header>

      {error && <div className="alert alert--error">{error}</div>}

      {pending ? (
        <DeskOffers
          fighter={pending}
          rerollFee={rerollFee}
          credits={credits}
          busy={busy}
          canAct={!!session}
          caps={config?.battle_stat_caps}
          factor={battleFactor(pending, levelMod, ageDecay).total}
          extra={oddsPanel}
          onReroll={() =>
            void run(
              'reroll',
              () => rerollAscension(session!, pending.fighter_id, rerollFee),
              'Offers re-rolled.',
              opts('rerollAscension'),
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
              opts('claimAscensionUpgrade'),
            )
          }
        />
      ) : (
        <DeskAscension
          roster={roster}
          ready={ready}
          target={target}
          onPlace={(id) => {
            setTargetId(id)
            setSlots({})
          }}
          onClear={() => {
            setTargetId(null)
            setSlots({})
          }}
          byRequirement={byRequirement}
          slots={slots}
          onAssign={assign}
          chosenFighters={chosenFighters}
          check={check}
          fee={fee}
          credits={credits}
          busy={busy}
          canAct={!!session}
          extra={oddsPanel}
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
              opts('ascendFighter'),
            )
          }
        />
      )}

    </div>
  )
}

/* ---------- what can be rolled ---------- */

/**
 * Every roll in the game, at the size it would be for this fighter.
 *
 * The table was printing the contract's stored min and max, so a damage roll
 * that sits on chain as "5 to 15" was shown as "+5 to +15" — ten times its
 * displayed size, before the level factor that makes it worth four times
 * again. It matched nothing on the offers directly above it. Same arithmetic
 * as an offer now: ten to one, then the fighter's level and age on the two
 * stats the contract grows.
 */
function OddsPanel({
  odds,
  factor,
  open = false,
}: {
  odds: UpgradeOdds[]
  /** The fighter's level × age multiplier, applied to health and damage. */
  factor: number
  /** Open from the start, where it has a box of its own to fill. */
  open?: boolean
}) {
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
    <details className="panel oddspanel" open={open}>
      <summary className="oddspanel__summary">
        What can be rolled
        <span className="oddspanel__count faint">{sorted.length} upgrades</span>
      </summary>
      <div className="oddslist">
        {sorted.map((u) => {
          const positive = !!u.positive_min_max
          const good = isBenefit(u.stat_name, positive)
          const mixed = isAmbiguous(u.stat_name)
          return (
            <div className="oddsrow" key={`${u.category}-${u.upgrade_name}`}>
              <span className="oddsrow__name">
                {/* The same mark the offer rows and the stat rows carry. */}
                <img
                  className="oddsrow__icon"
                  src={upgradeIcon(u.stat_name)}
                  alt=""
                  width={16}
                  height={16}
                />
                <strong>{statLabel(u.stat_name)}</strong>
                <em>{u.category}</em>
              </span>
              <span
                className={`oddsrow__range ${
                  mixed ? '' : good ? 'is-good' : 'is-bad'
                }`}
              >
                {upgradeRange(u.stat_name, u.min, u.max, positive, factor)}
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
