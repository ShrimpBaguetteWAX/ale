import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { FighterPanel, type PanelFighter } from '@/components/FighterPanel'
import { fetchRoster } from '@/dungeon/queries'
import type { RosterFighter } from '@/dungeon/types'
import {
  EMPTY_FILTER,
  MARKERS,
  applyFilter,
  markerIcon,
  type RosterFilter,
} from '@/dungeon/filters'
import { useConfig, useLazyConfig } from '@/state/useConfig'
import type { FighterLevel, FightersConfig } from '@/fighters/types'
import {
  ageDays,
  battleFactor,
  formatDate,
  formatDateTime,
  levelAllPlan,
  levelUpOf,
  paydayAllPlan,
  type PaydayScope,
  paydayOf,
  useLabel,
  wantsPayday,
} from '@/fighters/rules'
import {
  addAuctions,
  levelUpFighters,
  payFighters,
  sellFighters,
  setFighterMarker,
} from '@/wharf/actions'

import { MAX_BULK_LISTINGS, bulkListPlan } from '@/market/rules'
import { useAction } from '@/wharf/useAction'
import { useChainQuery } from '@/chain/useChainQuery'
import { useModal } from '@/components/useModal'
import { DIRTIES } from '@/wharf/actions'
import type { ClassTemplate } from '@/tavern/fighterStats'
import { NUM_LOCALE } from '@/format'
import { ActionBanner } from '@/components/ActionBanner'
import { asset } from '@/assets'
import { recallPayScope, rememberPayScope } from '@/fighters/payScope'
import { usePhone } from '@/components/usePhone'
import { DeskRoster } from '@/fighters/DeskRoster'

/**
 * My Fighters — the roster screen.
 *
 * Everything a player can do to a fighter outside a fight happens here, and
 * all four of those things cost or earn something, so the screen is built
 * around making the price visible before the click:
 *
 *   • **Payday** — upkeep. `den::payday` *spends* credits; the fighter is
 *     benched the moment it lapses and deleted ninety days later. The live
 *     site prints the number next to a credits coin with no direction, which
 *     reads as income; here it is a cost and says so.
 *   • **Level up** — spends credits, raises health and damage by the level
 *     factor and the fighter's own sell value by 10%.
 *   • **Sell** — irreversible. The row's owner becomes `sold`, which takes it
 *     out of the owner index for good.
 *   • **Marker** — a free label, and the only organising tool a roster of a
 *     hundred fighters has.
 *
 * The reading half matters as much: a fighter's stored roll is not what it
 * fights with. The contract scales health and damage by `level_mod ^ level`
 * and `age_decay ^ (days²)` before the first blow, so those two are shown
 * scaled. Their grade arrows measure the roll after age against the class
 * band; level is left out, since it lifts every fighter of a level alike.
 */

type Mode = 'inventory' | 'sell' | 'market'

/*
 * The listing fee is one gem today, and "1 gems each" is what a config value
 * printed straight into a sentence reads like the day somebody sets it to 1.
 */
function gemsWord(n: number): string {
  return `${n.toLocaleString(NUM_LOCALE)} gem${n === 1 ? '' : 's'}`
}

/* ---------- data ---------- */

interface RosterData {
  roster: RosterFighter[]
  levels: FighterLevel[]
  config?: FightersConfig
  templates: Map<string, ClassTemplate>
  levelMod: number
  ageDecay: number
  loading: boolean
  error: string | null
  /* The roster it re-read, so an action can say for itself when its change
     has landed rather than waiting out the default six rounds. */
  reload: () => Promise<RosterFighter[] | undefined>
}

function useRoster(account: string | null): RosterData {

  /*
     The level table, the payday rules, the class art and the two scaling
     floats are the same for every player and were four of the five reads
     this screen used to make. They are loaded once at boot now.

     `loaded` joins the screen's own loading flag rather than adding a second
     gate: `levelMod` is 1 until the battle config lands, and 1 is not a
     smaller version of the real multiplier — it is a level 10 fighter drawn
     at a quarter of its damage. The screen waits for both or shows neither.
  */
  const {
    levels,
    fighters: config,
    classes: templates,
    levelMod,
    ageDecay,
    loaded,
  } = useConfig()

  /*
     Opening the screen asks the chain, rather than reading the cache.

     XP arrives from fights on other screens, so the roster is stale by
     definition every time a player comes here from one - and this is the
     screen where the staleness shows: a fighter with enough XP to level
     looks like a fighter without, and the only way to find out was to
     reload the page. One extra read on a screen the player has just
     deliberately opened is the right trade.

     Kept forced even though a fight now drops `fighters` on the way out: the
     drop only covers fights this browser watched, and the reason this line
     exists is the fighter that levelled somewhere this screen never saw.
  */
  const query = useChainQuery(
    account && `roster:${account}`,
    () => fetchRoster(account!, true),
    { deps: ['fighters'] },
  )

  return {
    roster: query.data ?? EMPTY_ROSTER,
    levels,
    config,
    templates,
    levelMod,
    ageDecay,
    loading: query.loading || !loaded,
    error: query.error,
    reload: query.reload,
  }
}

const EMPTY_ROSTER: RosterFighter[] = []

/* ---------- the screen ---------- */

export default function Fighters() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)

  const data = useRoster(account)
  const { roster, levels, config, templates, levelMod, ageDecay } = data
  const phone = usePhone()

  const [mode, setMode] = useState<Mode>('inventory')
  /*
     A lens on the roster rather than part of the filter.

     `EMPTY_FILTER` is what Clear restores and what `isFilterActive` counts,
     and this hides nothing — turning it off with Clear, or having it show as
     a filter in force, would both be wrong.
  */
  const [atLevelOne, setAtLevelOne] = useState(false)
  const [filter, setFilter] = useState<RosterFilter>({ ...EMPTY_FILTER })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [checked, setChecked] = useState<number[]>([])
  const [openedId, setOpenedId] = useState<number | null>(null)

  const { busy, error, run, setError } = useAction()
  const [confirmSell, setConfirmSell] = useState(false)
  const [confirmList, setConfirmList] = useState(false)

  /*
     The market's own config, for the listing tab.

     Read here rather than passed down because it is what decides the numbers
     in the bar — the fee, the minimum bid, what an unsold fighter is relisted
     at — and quoting any of them from a constant is how a screen ends up
     disagreeing with the contract after a config change.
  */
  const marketConfig = useLazyConfig('market')

  /* The starting bid every fighter in the batch is listed at. */
  const [startPrice, setStartPrice] = useState(0)
  /*
     Ticked by default, as on the market's own sell tab.

     It turns an auction nobody bid on into a fixed-price instant buy offer
     rather than handing the fighter back, and it does so at the starting
     price the seller already set — so it carries on asking for what they
     asked for rather than making a fresh decision for them.
  */
  const [keepListed, setKeepListed] = useState(true)
  const minStart = Number(marketConfig?.gems_min_start_bid ?? 0)
  useEffect(() => setStartPrice(minStart), [minStart])

  /*
   * Every derived figure is a function of "now", and a payday cost creeps up
   * by the second. Recomputing on a slow tick keeps the quoted numbers from
   * drifting away from what the contract will charge, without re-rendering
   * a hundred rows every frame.
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  /*
     The class bands go in, because the roll-quality rules are graded against
     them: a grade is a comparison with what the class can produce, and
     without the bands `applyFilter` filters nothing rather than everything.
     So the quality bar would have rendered, accepted rules, and quietly
     changed no result at all.
  */
  const shown = useMemo(() => {
    const matched = applyFilter(
      roster,
      filter,
      ageDecay,
      now,
      templates,
      undefined,
      levelMod,
      atLevelOne,
    )
    /*
       ANDed here rather than inside `applyFilter`, which has no `levels` and
       so cannot tell a fighter that can level from one sitting at the ceiling
       — a maxed fighter keeps a requirement on its row and would read as
       ready forever. `levelUpOf` checks for a rung above before saying yes.
    */
    if (!filter.levelReady) return matched
    return matched.filter((f) => levelUpOf(f, levels).ready)
  }, [roster, filter, ageDecay, now, templates, levels, levelMod, atLevelOne])

  const opened = roster.find((f) => f.fighter_id === openedId) ?? null

  const lockedCount = useMemo(
    () => roster.filter((f) => f.in_use || wantsPayday(f, now)).length,
    [roster, now],
  )

  /* Benched until paid: the ones the contract will not let into a fight. */
  const overdue = useMemo(() => roster.filter((f) => wantsPayday(f, now)).length, [roster, now])

  /*
     How many fighters have a level waiting, for the filter to put on itself.

     Counted off the whole roster rather than what is on screen, because it is
     what the toggle is offering to narrow *to* — a count of the filtered list
     would read zero next to a button whose job is to stop it being zero.
  */
  const readyToLevel = useMemo(
    () => roster.filter((f) => levelUpOf(f, levels).ready).length,
    [roster, levels],
  )

  const levelAll = useMemo(() => levelAllPlan(roster, levels), [roster, levels])
  /*
     Who the blanket payday pays. A hundred and fifty fighters is a large
     bill to settle for the handful the contract is actually refusing, so
     the button can be narrowed to those — and remembers which it was.
  */
  const [params, setParams] = useSearchParams()
  const [payScope, setPayScope] = useState<PaydayScope>(() =>
    params.get('pay') === 'unwilling' ? 'overdue' : recallPayScope(),
  )
  /*
     The briefing links here as ?pay=unwilling when it is talking about the
     benched fighters, so the button already offers what that card offered.
     Read on the first render rather than in an effect, so the button never
     flashes the wrong scope, and then dropped from the URL: arriving that
     way is one errand, not a change of habit, so it neither overwrites the
     remembered choice nor survives a reload.
  */
  useEffect(() => {
    if (!params.has('pay')) return
    const next = new URLSearchParams(params)
    next.delete('pay')
    setParams(next, { replace: true })
  }, [params, setParams])
  const payAll = useMemo(
    () => paydayAllPlan(roster, config, now, payScope),
    [roster, config, now, payScope],
  )

  const checkedFighters = useMemo(
    () => roster.filter((f) => checked.includes(f.fighter_id)),
    [roster, checked],
  )
  const sellValue = useMemo(
    () => checkedFighters.reduce((sum, f) => sum + (f.stats.credits ?? 0), 0),
    [checkedFighters],
  )

  /* What the checked fighters would cost to list, and whether they can be. */
  const listPlan = useMemo(
    () => bulkListPlan(checkedFighters, startPrice, player!, marketConfig, now),
    [checkedFighters, startPrice, player, marketConfig, now],
  )

  const credits = player?.activestats.credits ?? 0
  const gems = player?.activestats.gems ?? 0

  /**
   * Run a chain action, then re-read both the roster and the player row.
   *
   * The fighters table is written inside the same transaction, but the API
   * node that answers the next read is rarely the one that just applied it,
   * so a single immediate re-read very often returns the old rows. Polling a
   * few times is the honest fix; the alternative — patching the local copy
   * optimistically — would show numbers the chain has not agreed to.
   */
  /*
     A levelled fighter is no longer waiting, and each action says for itself
     what it left stale — listing one touches the market, marking one touches
     nothing but the fighter row.
  */
  const opts = (action: keyof typeof DIRTIES) => ({
    after: data.reload,
    dirties: DIRTIES[action],
  })

  const doPayAll = () =>
    run(
      'pay-all',
      () => payFighters(session!, payAll.ids),
      `Paid ${payAll.ids.length} fighter${payAll.ids.length === 1 ? '' : 's'}.`,
      opts('payFighters'),
    )

  const doPayOne = (f: RosterFighter) =>
    run('pay-one', () => payFighters(session!, [f.fighter_id]), 'Fighter paid.', opts('payFighters'))

  const doLevelAll = () =>
    run(
      'level-all',
      () =>
        levelUpFighters(session!, levelAll.ids, {
          credits: levelAll.credits,
          gems: levelAll.gems,
        }),
      `Gained ${levelAll.ids.length} level${levelAll.ids.length === 1 ? '' : 's'} ` +
        `across ${levelAll.fighters} fighter${levelAll.fighters === 1 ? '' : 's'}.`,
      opts('levelUpFighters'),
    )

  const doLevelOne = (f: RosterFighter) => {
    const plan = levelUpOf(f, levels)
    return run(
      'level-one',
      () => levelUpFighters(session!, [f.fighter_id], plan.cost),
      'Fighter levelled up.',
      opts('levelUpFighters'),
    )
  }

  const doSell = async () => {
    setConfirmSell(false)
    await run(
      'sell',
      () => sellFighters(session!, checked),
      `Sold ${checked.length} fighter${checked.length === 1 ? '' : 's'} for ${sellValue.toLocaleString(NUM_LOCALE)} credits.`,
      opts('sellFighters'),
    )
    setChecked([])
    setSelectedId(null)
  }

  const doList = async () => {
    setConfirmList(false)
    await run(
      'list',
      () =>
        addAuctions(session!, {
          fighterIds: listPlan.ids,
          startPrice,
          keepAfterAuction: keepListed,
        }),
      `Listed ${listPlan.ids.length} fighter${listPlan.ids.length === 1 ? '' : 's'} ` +
        `at ${startPrice} gems.`,
      opts('addAuctions'),
    )
    setChecked([])
    setSelectedId(null)
  }

  const doMarker = (f: RosterFighter, marker: string) =>
    run(
      'marker',
      () => setFighterMarker(session!, f.fighter_id, marker),
      marker ? 'Marker set.' : 'Marker cleared.',
      {
        ...opts('setFighterMarker'),
        /*
           The roster says when this has landed; the player row never will.

           Without a `settled` the wait falls back to watching the player's
           own figures move, and a marker is free — nothing it can see ever
           changes, so the loop ran all six rounds and re-read the roster
           six times for a write that had already landed on the first.
        */
        settled: (fresh: RosterFighter[] | undefined) =>
          !!fresh?.some((x) => x.fighter_id === f.fighter_id && x.marker === marker),
      },
    )

  const toggleChecked = useCallback(
    (id: number) => {
      setChecked((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id)
        /*
           The market caps a batch; selling to the game does not.

           Refused at the tick rather than at the button, so the eleventh
           tick simply does not go on — a player who can select fifteen and
           then reads "10 at a time" has to work out which five to undo.
        */
        if (mode === 'market' && prev.length >= MAX_BULK_LISTINGS) {
          setError(`The market takes ${MAX_BULK_LISTINGS} fighters at a time.`)
          return prev
        }
        return [...prev, id]
      })
    },
    [mode],
  )

  /*
     Changing mode drops the selection rather than keeping a hidden one armed.

     Between the two selling modes as well as on the way back to Inventory:
     five fighters ticked to sell for credits are not five fighters you meant
     to put on the market for gems, and carrying the ticks across would mean
     one click on a differently-labelled button did the other thing.
  */
  const switchMode = (next: Mode) => {
    setMode(next)
    if (next !== mode) setChecked([])
  }

  const dialogs = (
    <>
      {opened && (
        <FighterDialog
          fighter={opened}
          levels={levels}
          config={config}
          template={templates.get(opened.classname)}
          levelMod={levelMod}
          ageDecay={ageDecay}
          now={now}
          busy={busy === 'marker'}
          canEdit={!!session}
          onMarker={(m) => void doMarker(opened, m)}
          onClose={() => setOpenedId(null)}
        />
      )}

      {confirmSell && (
        <Confirm
          title={`Sell ${checked.length} fighter${checked.length === 1 ? '' : 's'}?`}
          body={
            <>
              <p>
                This cannot be undone. You will receive{' '}
                <strong>{sellValue.toLocaleString(NUM_LOCALE)} credits</strong>.
              </p>
              <ul className="confirm__list">
                {checkedFighters.map((f) => (
                  <li key={f.fighter_id}>
                    {f.racename} {f.classname} · level {f.stats.level} ·{' '}
                    {f.stats.credits.toLocaleString(NUM_LOCALE)} credits
                  </li>
                ))}
              </ul>
            </>
          }
          confirmLabel="Sell them"
          onConfirm={() => void doSell()}
          onCancel={() => setConfirmSell(false)}
        />
      )}

      {confirmList && (
        <Confirm
          title={`List ${listPlan.ids.length} fighter${listPlan.ids.length === 1 ? '' : 's'} on the market?`}
          body={
            <>
              <p>
                Each starts at <strong>{gemsWord(startPrice)}</strong> and runs
                for{' '}
                {Math.round(
                  Number(marketConfig?.standard_duration_minutes ?? 0) / 60,
                )}
                h.
              </p>
              {/*
                The fee is the part worth stating twice. It is charged per
                fighter, it is charged whether or not anybody bids, and it is
                the one number a player cannot get back by cancelling.
              */}
              <p>
                The listing fee is{' '}
                <strong>
                  {gemsWord(Number(marketConfig?.gems_listing_price ?? 0))} each
                  — {listPlan.gems.toLocaleString(NUM_LOCALE)} in total
                </strong>
                , spent whether or not they sell. They cannot fight while
                listed.
              </p>
              <p className="faint">
                {keepListed
                  ? 'Unsold fighters stay up as fixed-price instant buy offers at your starting price.'
                  : 'Unsold fighters come back to you.'}
              </p>
              <ul className="confirm__list">
                {checkedFighters.map((f) => (
                  <li key={f.fighter_id}>
                    {f.racename} {f.classname} · level {f.stats.level}
                    {f.ascension_level > 0 ? ` · asc ${f.ascension_level}` : ''}
                  </li>
                ))}
              </ul>
            </>
          }
          confirmLabel="List them"
          onConfirm={() => void doList()}
          onCancel={() => setConfirmList(false)}
        />
      )}
    </>
  )

  /*
     The Market's rows: the roster as a list, with the picked fighter in
     full beside it on a desktop and as a sheet from the bottom on a phone.
     Same data, same actions and the same dialogs on both.
  */
  return (
    <>
      <DeskRoster
        phone={phone}
        roster={roster}
        shown={shown}
        filter={filter}
        onFilter={setFilter}
        templates={templates}
        levels={levels}
        config={config}
        levelMod={levelMod}
        ageDecay={ageDecay}
        now={now}
        atLevelOne={atLevelOne}
        onAtLevelOne={setAtLevelOne}
        readyToLevel={readyToLevel}
        lockedCount={lockedCount}
        loading={data.loading}
        banner={<ActionBanner error={error ?? data.error} />}
        mode={mode}
        onMode={switchMode}
        checked={checked}
        onCheck={toggleChecked}
        onChecked={setChecked}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onOpen={setOpenedId}
        canAct={!!session}
        busy={busy}
        credits={credits}
        gems={gems}
        payAll={payAll}
        payScope={payScope}
        onPayScope={(next) => {
          setPayScope(next)
          rememberPayScope(next)
        }}
        overdue={overdue}
        levelAll={levelAll}
        onPayAll={() => void doPayAll()}
        onLevelAll={() => void doLevelAll()}
        onPayOne={(f) => void doPayOne(f)}
        onLevelOne={(f) => void doLevelOne(f)}
        sellValue={sellValue}
        onSell={() => setConfirmSell(true)}
        marketConfig={marketConfig}
        listPlan={listPlan}
        startPrice={startPrice}
        onStartPrice={setStartPrice}
        minStart={minStart}
        keepListed={keepListed}
        onKeepListed={setKeepListed}
        onList={() => setConfirmList(true)}
      />
      {dialogs}
    </>
  )
}

/* ---------- small pieces ---------- */

/**
 * A price tag.
 *
 * The sign is not decoration: the live site prints a bare number beside a
 * credits coin for both the payday charge and the sell payout, and those are
 * opposite directions. Anything the player cannot currently afford is marked
 * here rather than only by a disabled button, so the reason is visible.
 */
/**
 * A figure with its currency icon.
 *
 * Prices are printed bare, the way every other screen prints them — the shop,
 * the market, boosting a building. A minus in front of a cost was saying
 * something the icon and the button already say, and saying it in a way
 * nowhere else in the game does.
 *
 * `gain` is the exception, and the reason a sign survives at all: a sell
 * value is money coming *in*, sitting in a column of money going out, and
 * that is worth a mark.
 */
export function Cost({
  value,
  icon,
  gain,
  short,
}: {
  value: number
  icon: 'credits' | 'gems'
  /** Marks the figure as a payout rather than a price. */
  gain?: boolean
  /** Balance to check against; omit when the figure is a payout. */
  short?: number
}) {
  /* Nothing to charge means nothing to say: "Payday all (0) 0" is noise on
     a button that is already disabled for the same reason. */
  if (!value) return null
  const cannot = short !== undefined && value > short
  return (
    <span className={`cost${cannot ? ' cost--short' : ''}`}>
      {gain ? '+' : null}
      {value.toLocaleString(NUM_LOCALE)}
      <img src={asset(`/assets/icons/${icon}.png`)} alt={icon} width={16} height={16} />
    </span>
  )
}

/**
 * How good this roll is for its class.
 *
 * Grades the roll, never the level figure shown beside it: the class bands
 * describe what the tavern can produce, so a levelled fighter graded on its
 * scaled health would show gold on every row and say nothing about the
 * fighter. Health and damage are passed in after age, though — that loss is
 * the fighter's own, and an old fighter should not grade like a fresh one.
 * Omitted entirely when the class band has not loaded — an arrow that always
 * means "average" is worse than none.
 */


/**
 * What the fighter does, rather than what it rolled.
 *
 * Damage and cooldown only mean something together, and so do health and the
 * resistances — 90 damage every 8 seconds is worse than 60 every 4, and the
 * stat rows say the opposite at a glance. Two numbers a side, in the shape
 * the choice is actually made in.
 *
 * Midpoints only. The spreads are on the Stats tab, and a derived figure
 * built from two of them has no honest spread of its own to print.
 *
 * The score at the foot is the two halves multiplied, and it is the row to
 * read if you only read one: a fighter that hits hard and dies immediately
 * and one that survives everything and does nothing are both bad in a way
 * neither half shows on its own.
 */

function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  body: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const box = useModal(onCancel)

  return (
    <div className="sheet" role="dialog" aria-modal="true" onClick={onCancel}>
      <div
        className="sheet__panel panel"
        ref={box}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="panel__title">{title}</h2>
        {body}
        <div className="confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- filters ---------- */


/* ---------- one fighter ---------- */


/* ---------- the detail dialog ---------- */

function rosterPanel(
  f: RosterFighter,
  factor: number,
  /** `age_decay ^ (days²)`: health and damage are graded after it. */
  age: number,
): PanelFighter {
  const s = f.stats
  return {
    classname: f.classname,
    racename: f.racename,
    element: f.element,
    target: s.target,
    level: s.level,
    /* Displayed as fought with; graded against the roll — see PanelStat. */
    health: {
      min: s.health_min * factor,
      max: s.health_max * factor,
      grade: ((s.health_min + s.health_max) / 2) * age,
    },
    damage: {
      min: s.damage_min * factor,
      max: s.damage_max * factor,
      grade: ((s.damage_min + s.damage_max) / 2) * age,
    },
    taunt: { min: s.taunt_min, max: s.taunt_max },
    attackspeed: { min: s.attackspeed_min, max: s.attackspeed_max },
    initiative: { min: s.initiative_min, max: s.initiative_max },
    res_gem: s.res_gem,
    res_metal: s.res_metal,
    res_air: s.res_air,
    res_fire: s.res_fire,
    res_nature: s.res_nature,
    res_neutral: s.res_neutral,
    abilities: s.abilities ?? [],
  }
}

export function FighterDialog({
  fighter,
  levels,
  config,
  template,
  levelMod,
  ageDecay,
  now,
  busy,
  canEdit,
  onMarker,
  onClose,
}: {
  fighter: RosterFighter
  levels: FighterLevel[]
  config?: FightersConfig
  template?: ClassTemplate
  levelMod: number
  ageDecay: number
  now: number
  busy: boolean
  canEdit: boolean
  onMarker: (marker: string) => void
  onClose: () => void
}) {
  const box = useModal(onClose)

  const s = fighter.stats
  const factor = battleFactor(fighter, levelMod, ageDecay, now)
  const pay = paydayOf(fighter, config, now)
  const level = levelUpOf(fighter, levels)
  const days = ageDays(fighter, now)
  const panel = rosterPanel(fighter, factor.total, factor.age)

  return (
    <div className="sheet" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="sheet__panel panel fdialog"
        ref={box}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fdialog__cols">
          <FighterPanel
            fighter={panel}
            template={template}
            abilityUnlockLevel={config?.asc_ability_unlock_lvl}
          />

          <div className="fdialog__side">
            <section>
              <h3 className="panel__title">Information</h3>
              <dl className="fstats">
                <Row k="Level" v={`${s.level}${level.atMax ? ' (max)' : ''}`} />
                <Row
                  k="Experience"
                  v={
                    level.atMax
                      ? 'Maxed'
                      : `${s.experience.toLocaleString(NUM_LOCALE)} / ${s.required_experience.toLocaleString(NUM_LOCALE)}`
                  }
                />
                <Row k="Ascension" v={String(fighter.ascension_level)} />
                <Row k="Damage type" v={fighter.element} />
                <Row k="Sell value" v={`${s.credits.toLocaleString(NUM_LOCALE)} credits`} />
                <Row k="Recruited" v={`${formatDate(fighter.creation_date)} (${days}d ago)`} />
                <Row
                  k="Next payday"
                  v={`${formatDate(fighter.next_payday)} · ${pay.cost.toLocaleString(NUM_LOCALE)} credits`}
                />
                <Row k="Deleted on" v={formatDateTime(fighter.final_deletion_date)} />
                {!!fighter.in_use && (
                  <Row k="Status" v={useLabel(fighter) + (fighter.use_details ? ` · ${fighter.use_details}` : '')} />
                )}
              </dl>

              {/*
                The two multipliers behind the health and damage figures. A
                player comparing a fresh level-1 roll against a levelled
                veteran is otherwise comparing two different scales without
                being told.
              */}
              <p className="fdialog__factor">
                Health and damage above are shown as fought with: ×
                {factor.level.toFixed(2)} for level {s.level}, ×
                {factor.age.toFixed(4)} for {days} days of age.
              </p>
            </section>

            {template?.description && (
              <section>
                <h3 className="panel__title">{fighter.classname}</h3>
                <p className="fdialog__class">{template.description}</p>
              </section>
            )}

            <section>
              <h3 className="panel__title">Marker</h3>
              <p className="hint">
                A private label, stored on chain. Filter the roster by it.
              </p>
              <div className="fdialog__markers">
                {MARKERS.map((m) => (
                  <button
                    type="button"
                    key={m || 'none'}
                    className="markbtn"
                    aria-pressed={fighter.marker === m}
                    disabled={busy || !canEdit || fighter.marker === m}
                    onClick={() => onMarker(m)}
                    title={m || 'Clear marker'}
                  >
                    <img src={markerIcon(m)} alt={m || 'none'} />
                  </button>
                ))}
              </div>
              {busy && (
                <p className="hint">
                  <span className="spinner" /> Saving the marker…
                </p>
              )}
            </section>
          </div>
        </div>

        <div className="confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="fstats__row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

