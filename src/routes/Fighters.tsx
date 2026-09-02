import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import { FighterPanel, type PanelFighter } from '@/components/FighterPanel'
import {
  fetchBattleConfig,
  fetchClassTemplates,
  fetchRoster,
} from '@/dungeon/queries'
import type { RosterFighter } from '@/dungeon/types'
import {
  ELEMENTS,
  EMPTY_FILTER,
  MARKERS,
  SORTS,
  STATUSES,
  applyFilter,
  facetsOf,
  isFilterActive,
  markerIcon,
  type Element,
  type RosterFilter,
  type Status,
} from '@/dungeon/filters'
import { fetchFighterLevels, fetchFightersConfig } from '@/fighters/queries'
import type { FighterLevel, FightersConfig } from '@/fighters/types'
import {
  ageBand,
  ageBonus,
  ageDays,
  battleFactor,
  fighterState,
  formatDate,
  formatDateTime,
  formatRelativeDays,
  ageNote,
  levelAllPlan,
  levelUpOf,
  msUntilDeletion,
  paydayAllPlan,
  paydayOf,
  sellable,
  useLabel,
  wantsPayday,
} from '@/fighters/rules'
import {
  levelUpFighters,
  payFighters,
  sellFighters,
  setFighterMarker,
} from '@/wharf/actions'
import { refreshChore } from '@/chores/signal'
import { readableError } from '@/wharf/errors'
import type { ClassTemplate } from '@/tavern/fighterStats'
import {
  abilityColor,
  abilityName,
  abilityRarity,
  elementBackground,
  fighterArt,
  fighterArtFallback,
  formatResistance,
  formatStat,
  formatTarget,
  gradeStat,
  GRADE_ICON,
  GRADE_LABEL,
  resolveAbilityDescription,
  statIcon,
  STAT_LABEL,
} from '@/tavern/fighterStats'
import { NUM_LOCALE } from '@/format'
import { asset } from '@/assets'

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
 * scaled, with the grade arrows still measuring the underlying roll against
 * the class band.
 */

type Mode = 'inventory' | 'sell'
type CardTab = 'primary' | 'resistance' | 'abilities'

const PRIMARY_FIELDS = ['damage', 'health', 'taunt', 'attackspeed', 'initiative'] as const

const RESISTANCES: [string, string][] = [
  ['res_gem', 'Gem'],
  ['res_metal', 'Metal'],
  ['res_air', 'Air'],
  ['res_fire', 'Fire'],
  ['res_nature', 'Nature'],
  ['res_neutral', 'Neutral'],
]

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
  reload: () => Promise<void>
}

function useRoster(account: string | null): RosterData {
  const [roster, setRoster] = useState<RosterFighter[]>([])
  const [levels, setLevels] = useState<FighterLevel[]>([])
  const [config, setConfig] = useState<FightersConfig>()
  const [templates, setTemplates] = useState<Map<string, ClassTemplate>>(new Map())
  const [levelMod, setLevelMod] = useState(1.15)
  const [ageDecay, setAgeDecay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(
    async (refresh: boolean) => {
      if (!account) return
      setError(null)
      try {
        const [r, l, c, t, bc] = await Promise.all([
          fetchRoster(account, refresh),
          fetchFighterLevels(),
          fetchFightersConfig(),
          fetchClassTemplates(),
          fetchBattleConfig(),
        ])
        if (!alive.current) return
        setRoster(r)
        setLevels(l)
        setConfig(c)
        setTemplates(t)
        if (bc) {
          setLevelMod(Number(bc.level_mod) || 1.15)
          setAgeDecay(Number(bc.age_decay) || 1)
        }
      } catch (err) {
        if (alive.current) setError(readableError(err))
      } finally {
        if (alive.current) setLoading(false)
      }
    },
    [account],
  )

  useEffect(() => {
    setLoading(true)
    void load(false)
  }, [load])

  const reload = useCallback(() => load(true), [load])

  return { roster, levels, config, templates, levelMod, ageDecay, loading, error, reload }
}

/* ---------- the screen ---------- */

export default function Fighters() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const data = useRoster(account)
  const { roster, levels, config, templates, levelMod, ageDecay } = data

  const [mode, setMode] = useState<Mode>('inventory')
  const [tab, setTab] = useState<CardTab>('primary')
  const [filter, setFilter] = useState<RosterFilter>({ ...EMPTY_FILTER })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [checked, setChecked] = useState<number[]>([])
  const [openedId, setOpenedId] = useState<number | null>(null)

  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmSell, setConfirmSell] = useState(false)

  /*
   * Every derived figure is a function of "now", and a payday cost creeps up
   * by the second. Recomputing on a slow tick keeps the quoted numbers from
   * drifting away from what the contract will charge, without re-rendering
   * a hundred cards every frame.
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const shown = useMemo(
    () => applyFilter(roster, filter, ageDecay, now),
    [roster, filter, ageDecay, now],
  )

  const selected = roster.find((f) => f.fighter_id === selectedId) ?? null
  const opened = roster.find((f) => f.fighter_id === openedId) ?? null

  const lockedCount = useMemo(
    () => roster.filter((f) => f.in_use || wantsPayday(f, now)).length,
    [roster, now],
  )

  const levelAll = useMemo(() => levelAllPlan(roster, levels), [roster, levels])
  const payAll = useMemo(() => paydayAllPlan(roster, config, now), [roster, config, now])

  const checkedFighters = useMemo(
    () => roster.filter((f) => checked.includes(f.fighter_id)),
    [roster, checked],
  )
  const sellValue = useMemo(
    () => checkedFighters.reduce((sum, f) => sum + (f.stats.credits ?? 0), 0),
    [checkedFighters],
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
  const run = useCallback(
    async (label: string, act: () => Promise<unknown>, done: string) => {
      if (!session) return
      setBusy(label)
      setError(null)
      setNotice(null)
      try {
        await act()
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 900))
          await Promise.all([data.reload(), refreshPlayer({ force: true })])
        }
        /* A levelled fighter is no longer waiting. */
        refreshChore('fighters')
        setNotice(done)
      } catch (err) {
        setError(readableError(err))
      } finally {
        setBusy(null)
      }
    },
    [session, data, refreshPlayer],
  )

  const doPayAll = () =>
    run(
      'pay-all',
      () => payFighters(session!, payAll.ids),
      `Paid ${payAll.ids.length} fighter${payAll.ids.length === 1 ? '' : 's'}.`,
    )

  const doPayOne = (f: RosterFighter) =>
    run('pay-one', () => payFighters(session!, [f.fighter_id]), 'Fighter paid.')

  const doLevelAll = () =>
    run(
      'level-all',
      () =>
        levelUpFighters(session!, levelAll.ids, {
          credits: levelAll.credits,
          gems: levelAll.gems,
        }),
      `Levelled ${levelAll.ids.length} fighter${levelAll.ids.length === 1 ? '' : 's'}.`,
    )

  const doLevelOne = (f: RosterFighter) => {
    const plan = levelUpOf(f, levels)
    return run(
      'level-one',
      () => levelUpFighters(session!, [f.fighter_id], plan.cost),
      'Fighter levelled up.',
    )
  }

  const doSell = async () => {
    setConfirmSell(false)
    await run(
      'sell',
      () => sellFighters(session!, checked),
      `Sold ${checked.length} fighter${checked.length === 1 ? '' : 's'} for ${sellValue.toLocaleString(NUM_LOCALE)} credits.`,
    )
    setChecked([])
    setSelectedId(null)
  }

  const doMarker = (f: RosterFighter, marker: string) =>
    run(
      'marker',
      () => setFighterMarker(session!, f.fighter_id, marker),
      marker ? 'Marker set.' : 'Marker cleared.',
    )

  const toggleChecked = useCallback((id: number) => {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  /* Leaving sell mode drops the selection rather than keeping a hidden one
     armed for the next visit. */
  const switchMode = (next: Mode) => {
    setMode(next)
    if (next === 'inventory') setChecked([])
  }

  const selectedPay = selected ? paydayOf(selected, config, now) : null
  const selectedLevel = selected ? levelUpOf(selected, levels) : null

  return (
    <div className="roster">
      <header className="roster__head">
        <div>
          <h1 className="roster__title">My Fighters</h1>
          <p className="roster__counts">
            <span>
              <strong>{roster.length}</strong> owned
            </span>
            <span>
              <strong>{lockedCount}</strong> locked
            </span>
            {shown.length !== roster.length && (
              <span>
                <strong>{shown.length}</strong> shown
              </span>
            )}
          </p>
        </div>

        <div className="roster__modes" role="tablist" aria-label="Roster mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'inventory'}
            className="roster__mode"
            onClick={() => switchMode('inventory')}
          >
            Inventory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sell'}
            className="roster__mode"
            onClick={() => switchMode('sell')}
          >
            Sell
          </button>
        </div>
      </header>

      <div className="roster__bar">
        {mode === 'sell' ? (
          <>
            <p className="roster__hint">
              Selling is permanent — a sold fighter cannot be bought back.
              Fighters in use cannot be sold.
            </p>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--danger"
              disabled={!session || checked.length === 0 || !!busy}
              onClick={() => setConfirmSell(true)}
            >
              {busy === 'sell' && <span className="spinner" />}
              Sell {checked.length || ''}
              <Cost value={sellValue} icon="credits" gain />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!session || payAll.ids.length === 0 || !!busy}
              onClick={() => void doPayAll()}
              title="Upkeep for every fighter with time on the clock"
            >
              {busy === 'pay-all' && <span className="spinner" />}
              Payday all ({payAll.ids.length})
              <Cost value={payAll.credits} icon="credits" short={credits} />
            </button>

            <button
              type="button"
              className="btn btn--ghost"
              disabled={
                !session ||
                levelAll.ids.length === 0 ||
                levelAll.credits > credits ||
                levelAll.gems > gems ||
                !!busy
              }
              onClick={() => void doLevelAll()}
              title={
                levelAll.skipped
                  ? `${levelAll.skipped} more can level, but one transaction cannot spend over 65,535 credits — press again afterwards`
                  : 'Every fighter with enough experience banked'
              }
            >
              {busy === 'level-all' && <span className="spinner" />}
              Level all ({levelAll.ids.length}
              {levelAll.skipped ? ` of ${levelAll.ids.length + levelAll.skipped}` : ''})
              <Cost value={levelAll.credits} icon="credits" short={credits} />
            </button>

            <span className="spacer" />

            {selected && (
              <div className="roster__selected">
                <span className="roster__selectedName">
                  {selected.racename} {selected.classname}
                </span>

                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={!session || !selectedPay || selectedPay.cost <= 1 || !!busy}
                  onClick={() => void doPayOne(selected)}
                >
                  {busy === 'pay-one' && <span className="spinner" />}
                  Payday
                  <Cost
                    value={selectedPay?.cost ?? 0}
                    icon="credits"
                    short={credits}
                  />
                </button>

                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={
                    !session ||
                    !selectedLevel?.ready ||
                    (selectedLevel?.cost.credits ?? 0) > credits ||
                    (selectedLevel?.cost.gems ?? 0) > gems ||
                    !!busy
                  }
                  onClick={() => void doLevelOne(selected)}
                  title={
                    selectedLevel?.atMax
                      ? 'Already at the maximum level'
                      : selectedLevel?.ready
                        ? 'Spend the banked experience'
                        : 'Not enough experience yet'
                  }
                >
                  {busy === 'level-one' && <span className="spinner" />}
                  {selectedLevel?.atMax ? 'Max level' : 'Level up'}
                  {!selectedLevel?.atMax && (
                    <Cost
                      value={selectedLevel?.cost.credits ?? 0}
                      icon="credits"
                      short={credits}
                    />
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSelectedId(null)}
                  aria-label="Clear selection"
                >
                  ×
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {notice && <div className="alert alert--ok">{notice}</div>}
      {(error || data.error) && (
        <div className="alert alert--error">{error ?? data.error}</div>
      )}

      <RosterFilters
        filter={filter}
        onChange={setFilter}
        roster={roster}
        classes={templates}
        tab={tab}
        onTab={setTab}
      />

      {data.loading ? (
        <div className="rostergrid">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="fcard fcard--loading" key={i} />
          ))}
        </div>
      ) : roster.length === 0 ? (
        <p className="roster__empty">
          You have no fighters yet. Recruits are hired at a tavern — stand on
          one on the map to reveal and hire.
        </p>
      ) : shown.length === 0 ? (
        <p className="roster__empty">
          No fighter matches these filters.{' '}
          <button
            type="button"
            className="linklike"
            onClick={() => setFilter({ ...EMPTY_FILTER, sort: filter.sort })}
          >
            Clear them
          </button>
          .
        </p>
      ) : (
        <div className="rostergrid">
          {shown.map((f) => (
            <FighterCard
              key={f.fighter_id}
              fighter={f}
              levels={levels}
              config={config}
              template={templates.get(f.classname)}
              levelMod={levelMod}
              ageDecay={ageDecay}
              now={now}
              mode={mode}
              tab={tab}
              selected={f.fighter_id === selectedId}
              checked={checked.includes(f.fighter_id)}
              onSelect={() =>
                setSelectedId((cur) => (cur === f.fighter_id ? null : f.fighter_id))
              }
              onCheck={() => toggleChecked(f.fighter_id)}
              onOpen={() => setOpenedId(f.fighter_id)}
            />
          ))}
        </div>
      )}

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
    </div>
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
function Cost({
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
 * Always grades the *stored* roll, never the level-and-age figure shown
 * beside it: the class bands describe what the tavern can produce, so a
 * levelled fighter graded on its scaled health would show gold on every row
 * and say nothing about the fighter. Omitted entirely when the class band
 * has not loaded — an arrow that always means "average" is worse than none.
 */
function GradeArrow({
  field,
  raw,
  template,
}: {
  field: string
  raw: number
  template?: ClassTemplate
}) {
  if (!template) return null
  const grade = gradeStat(field, raw, template)
  if (!grade) return null
  return (
    <img
      className="grade"
      src={GRADE_ICON[grade]}
      alt={GRADE_LABEL[grade]}
      title={GRADE_LABEL[grade]}
      width={13}
      height={13}
    />
  )
}

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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="sheet" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="sheet__panel panel" onClick={(e) => e.stopPropagation()}>
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

function RosterFilters({
  filter,
  onChange,
  roster,
  classes,
  tab,
  onTab,
}: {
  filter: RosterFilter
  onChange: (f: RosterFilter) => void
  roster: RosterFighter[]
  classes: Map<string, ClassTemplate>
  tab: CardTab
  onTab: (t: CardTab) => void
}) {
  const { races } = useMemo(() => facetsOf(roster), [roster])
  const set = (patch: Partial<RosterFilter>) => onChange({ ...filter, ...patch })

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value]

  /*
   * Only markers this roster actually carries are offered.
   *
   * The vocabulary is thirty icons, and one a player has never pinned can
   * never match anything — so offering all thirty is a wall of dead controls
   * on a fresh account and a haystack on an organised one. The full set is
   * still in the detail dialog, which is where markers are pinned.
   */
  const used = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of roster) {
      if (f.marker) counts.set(f.marker, (counts.get(f.marker) ?? 0) + 1)
    }
    return counts
  }, [roster])

  return (
    <div className="filters">
      <div className="filters__facets">
        <div className="facet">
          <span className="field__label">Element</span>
          <div className="filters__elements" role="group" aria-label="Element">
            {ELEMENTS.map((el) => (
              <button
                type="button"
                key={el}
                className="elembtn"
                aria-pressed={filter.elements.includes(el)}
                onClick={() => set({ elements: toggle(filter.elements, el as Element) })}
                title={el}
              >
                <img src={asset(`/assets/icons/elements/${el}.png`)} alt={el} />
              </button>
            ))}
          </div>
        </div>

        {used.size > 0 && (
          <div className="facet facet--grow">
            <span className="field__label">Marker</span>
            <div className="filters__markers" role="group" aria-label="Marker">
              {MARKERS.filter((m) => m && used.has(m)).map((m) => (
                <button
                  type="button"
                  key={m}
                  className="markbtn"
                  aria-pressed={filter.markers.includes(m)}
                  onClick={() => set({ markers: toggle(filter.markers, m) })}
                  title={`${m} (${used.get(m)})`}
                >
                  <img src={markerIcon(m)} alt={m} />
                  <span className="markbtn__count">{used.get(m)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="filters__row">
        <label className="field">
          <span className="field__label">Class</span>
          <select
            className="input"
            value={filter.classname}
            onChange={(e) => set({ classname: e.target.value })}
          >
            <option value="">Any</option>
            {[...classes.keys()].sort().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Race</span>
          <select
            className="input"
            value={filter.racename}
            onChange={(e) => set({ racename: e.target.value })}
          >
            <option value="">Any</option>
            {races.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Availability</span>
          <select
            className="input"
            value={filter.status}
            onChange={(e) => set({ status: e.target.value as Status })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Sort by</span>
          <select
            className="input"
            value={filter.sort}
            onChange={(e) => set({ sort: e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--grow">
          <span className="field__label">Ability</span>
          <input
            className="input"
            placeholder="Search ability names"
            value={filter.ability}
            onChange={(e) => set({ ability: e.target.value })}
          />
        </label>

        {/*
          One readout for every card at once. Comparing forty fighters on
          fire resistance is the roster's whole job, and per-card tabs turn
          that into forty clicks — a card can still be flipped on its own,
          and changing this brings them all back into step.
        */}
        <div className="field">
          <span className="field__label">Show</span>
          <div className="showtabs" role="group" aria-label="Readout">
            {(['primary', 'resistance', 'abilities'] as CardTab[]).map((t) => (
              <button
                type="button"
                key={t}
                className="showtabs__btn"
                aria-pressed={tab === t}
                onClick={() => onTab(t)}
              >
                {t === 'primary'
                  ? 'Stats'
                  : t === 'resistance'
                    ? 'Resist'
                    : 'Abilities'}
              </button>
            ))}
          </div>
        </div>

        {isFilterActive(filter) && (
          <button
            type="button"
            className="btn btn--ghost btn--sm filters__clear"
            onClick={() => onChange({ ...EMPTY_FILTER, sort: filter.sort })}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- one fighter ---------- */

export function FighterCard({
  fighter,
  levels,
  config,
  template,
  levelMod,
  ageDecay,
  now,
  mode,
  tab: sharedTab,
  selected,
  checked,
  onSelect,
  onCheck,
  onOpen,
}: {
  fighter: RosterFighter
  levels: FighterLevel[]
  config?: FightersConfig
  template?: ClassTemplate
  levelMod: number
  ageDecay: number
  now: number
  mode: Mode
  /**
   * Which readout every card is showing.
   *
   * Held by the screen rather than the card because the question a roster
   * answers is comparative — "which of these has the best fire resistance" —
   * and per-card tabs make that a sixty-click job. A card can still be
   * switched on its own, which is what the local override below is for; the
   * next change to the shared tab takes every card back in step.
   */
  tab: CardTab
  selected: boolean
  checked: boolean
  onSelect: () => void
  onCheck: () => void
  onOpen: () => void
}) {
  const [override, setOverride] = useState<CardTab | null>(null)
  const [ability, setAbility] = useState(0)

  useEffect(() => setOverride(null), [sharedTab])
  const tab = override ?? sharedTab

  const s = fighter.stats
  const state = fighterState(fighter, now)
  const pay = paydayOf(fighter, config, now)
  const level = levelUpOf(fighter, levels)
  const factor = battleFactor(fighter, levelMod, ageDecay, now)
  const bonus = ageBonus(fighter, ageDecay, now)
  const abilities = s.abilities ?? []
  const shownAbility = abilities[Math.min(ability, Math.max(0, abilities.length - 1))]
  const canSell = sellable(fighter)
  /* Every fighter rolls with its last ability locked, so this note is on
     every card in the game rather than an edge case. */
  const unlockNote = config?.asc_ability_unlock_lvl
    ? `Locked until ascension ${config.asc_ability_unlock_lvl}`
    : 'Locked until ascension'

  const classes = [
    'fcard',
    `fcard--${state}`,
    selected ? 'fcard--selected' : '',
    checked ? 'fcard--checked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={classes}>
      {/* The whole card selects, but the tab strip, the marker and the sell
          checkbox all sit inside it — so the hit area is an explicit layer
          underneath rather than a click handler on the container that every
          control would then have to stop. */}
      <button
        type="button"
        className="fcard__hit"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${fighter.racename} ${fighter.classname}, level ${s.level}`}
      />

      <div
        className="fcard__xp"
        title={
          level.atMax
            ? 'Maximum level'
            : `${s.experience.toLocaleString(NUM_LOCALE)} / ${s.required_experience.toLocaleString(NUM_LOCALE)} XP`
        }
      >
        <span
          className={`fcard__xpFill${level.ready ? ' fcard__xpFill--full' : ''}`}
          style={{ height: `${level.atMax ? 100 : level.xpPercent}%` }}
        />
      </div>

      <div
        className="fcard__art"
        style={{ backgroundImage: `url('${elementBackground(fighter.element)}')` }}
      >
        <img
          className="fcard__fighter"
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
        <img
          className="fcard__element"
          src={asset(`/assets/icons/elements/${fighter.element}.png`)}
          alt={fighter.element}
          title={`${fighter.element} damage`}
          width={22}
          height={22}
        />
        <span className="fcard__value" title="Sell value">
          {s.credits.toLocaleString(NUM_LOCALE)}
          <img src={asset("/assets/icons/credits.png")} alt="credits" width={14} height={14} />
        </span>
      </div>

      <div className="fcard__body">
        <div className="fcard__head">
          <div className="fcard__ident">
            <span className="fcard__name">
              {fighter.racename} {fighter.classname}
            </span>
            <span className="fcard__chips">
              <span className="chip chip--level">Lv {s.level}</span>
              {level.atMax ? (
                <span className="chip chip--max">MAX</span>
              ) : (
                <span className={`chip${level.ready ? ' chip--ready' : ''}`}>
                  {s.experience.toLocaleString(NUM_LOCALE)} / {s.required_experience.toLocaleString(NUM_LOCALE)} XP
                </span>
              )}
              {fighter.ascension_level > 0 && (
                <span className="chip chip--asc">Asc {fighter.ascension_level}</span>
              )}
              {state === 'busy' && (
                <span className="chip chip--busy">{useLabel(fighter)}</span>
              )}
              {state === 'overdue' && (
                <span className="chip chip--overdue">Requests payday</span>
              )}
            </span>
          </div>

          <div className="fcard__tools">
            {mode === 'sell' && (
              <label
                className={`fcard__check${canSell ? '' : ' fcard__check--off'}`}
                title={canSell ? 'Select for selling' : 'In use — cannot be sold'}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canSell}
                  onChange={onCheck}
                />
                <span />
              </label>
            )}
            <button
              type="button"
              className="fcard__marker"
              onClick={onOpen}
              title={fighter.marker ? `Marked ${fighter.marker}` : 'Details and marker'}
              aria-label="Open details"
            >
              <img src={markerIcon(fighter.marker)} alt="" width={18} height={18} />
            </button>
          </div>
        </div>

        {/*
          The age bonus rides the tab strip rather than taking a row of its own.

          `.fcard__body` is a three-row grid — head, tabs, panel — with the
          panel on the `minmax(0, 1fr)` track that makes the card a fixed
          height. A fourth child pushed the panel into an implicit row and the
          whole card lost its shape, which is exactly what happened when this
          was added as its own block.
        */}
        <div className="fcard__tabs" role="tablist">
          {(['primary', 'resistance', 'abilities'] as CardTab[]).map((t) => (
            <button
              type="button"
              key={t}
              role="tab"
              aria-selected={tab === t}
              className="fcard__tab"
              onClick={() => setOverride(t)}
            >
              {t === 'primary' ? 'Primary' : t === 'resistance' ? 'Resistance' : 'Abilities'}
            </button>
          ))}

          <span
            className={`fcard__age fcard__age--${ageBand(bonus)}`}
            title={ageNote(bonus, ageDays(fighter, now), factor.age)}
          >
            {bonus > 0 ? '+' : ''}
            {bonus.toFixed(0)}%
          </span>
        </div>

        <div className="fcard__panel">
          {tab === 'primary' && (
            <dl className="fstats">
              {PRIMARY_FIELDS.map((field) => {
                const min = s[`${field}_min` as keyof typeof s] as number
                const max = s[`${field}_max` as keyof typeof s] as number
                /* Only health and damage are scaled by level and age; the
                   rest are fought with exactly as rolled. */
                const scale = field === 'health' || field === 'damage' ? factor.total : 1
                return (
                  <div className="fstats__row" key={field}>
                    <dt>
                      <img src={statIcon(field)} alt="" width={13} height={13} />
                      {STAT_LABEL[field] ?? field}
                    </dt>
                    <dd className="mono">
                      {formatStat(min * scale, max * scale)}
                      <GradeArrow
                        field={field}
                        raw={(min + max) / 2}
                        template={template}
                      />
                    </dd>
                  </div>
                )
              })}
              <div className="fstats__row">
                <dt>
                  <img src={statIcon('target')} alt="" width={13} height={13} />
                  Targets
                </dt>
                <dd>{s.target ? formatTarget(s.target) : 'Highest Taunt'}</dd>
              </div>
            </dl>
          )}

          {tab === 'resistance' && (
            <dl className="fstats">
              {RESISTANCES.map(([key, label]) => (
                <div className="fstats__row" key={key}>
                  <dt>
                    <img
                      src={asset(`/assets/icons/elements/${label.toLowerCase()}.png`)}
                      alt=""
                      width={13}
                      height={13}
                    />
                    {label}
                  </dt>
                  <dd className="mono">
                    {formatResistance((s as unknown as Record<string, number>)[key])}
                    <GradeArrow
                      field={key}
                      raw={(s as unknown as Record<string, number>)[key]}
                      template={template}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {tab === 'abilities' && (
            <div className="fability">
              {abilities.length === 0 ? (
                <p className="faint">No abilities.</p>
              ) : (
                <>
                  {/*
                    The names, not a row of numbers.

                    Abilities are what distinguishes two fighters of the same
                    class, and a player scanning the roster is looking for a
                    particular one. Numbered pips made them open every fighter
                    to find out what it had; the names answer that from the
                    grid. The description belongs to whichever is selected, so
                    it is the one thing the row below has to say.
                  */}
                  <div className="fability__list">
                    {abilities.map((a, i) => (
                      <button
                        type="button"
                        key={`${a.ability}-${i}`}
                        className={`fability__pick${a.locked ? ' fability__pick--locked' : ''}`}
                        aria-pressed={i === ability}
                        style={{ '--pip': abilityColor(a.displayname) } as React.CSSProperties}
                        onClick={() => setAbility(i)}
                        title={abilityName(a.displayname)}
                      >
                        <span className="fability__pickName">
                          {abilityName(a.displayname)}
                        </span>
                        {abilityRarity(a.displayname) && (
                          <span className="fability__rarity">
                            {abilityRarity(a.displayname)}
                          </span>
                        )}
                        {!!a.locked && (
                          <img
                            className="fability__lock"
                            src={asset("/assets/icons/lock.svg")}
                            alt="Locked"
                            title={unlockNote}
                            width={11}
                            height={11}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  <div
                    className={`fability__body${shownAbility.locked ? ' fability__body--locked' : ''}`}
                    style={{ borderLeftColor: abilityColor(shownAbility.displayname) }}
                  >
                    <span className="fability__desc">
                      {resolveAbilityDescription(shownAbility)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/*
        Upkeep, along the foot of the card.

        The bar fills as the paid interval runs down, so a roster reads at a
        glance: full bars are about to cost money, and a red one is already
        costing the fighter their place.
      */}
      <div className={`fcard__pay${pay.overdue ? ' fcard__pay--overdue' : ''}`}>
        <span
          className="fcard__payFill"
          style={{ width: `${Math.round(pay.progress * 100)}%` }}
        />
        <span className="fcard__payText">
          {pay.overdue ? (
            <>
              Deleted {formatRelativeDays(msUntilDeletion(fighter, now))} ·{' '}
              {formatDate(fighter.final_deletion_date)}
            </>
          ) : (
            <>Payday {formatDate(fighter.next_payday)}</>
          )}
        </span>
        <span className="fcard__payCost mono">
          {pay.cost.toLocaleString(NUM_LOCALE)}
          <img src={asset("/assets/icons/credits.png")} alt="credits" width={12} height={12} />
        </span>
      </div>
    </article>
  )
}

/* ---------- the detail dialog ---------- */

function rosterPanel(
  f: RosterFighter,
  factor: number,
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
      grade: (s.health_min + s.health_max) / 2,
    },
    damage: {
      min: s.damage_min * factor,
      max: s.damage_max * factor,
      grade: (s.damage_min + s.damage_max) / 2,
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const s = fighter.stats
  const factor = battleFactor(fighter, levelMod, ageDecay, now)
  const pay = paydayOf(fighter, config, now)
  const level = levelUpOf(fighter, levels)
  const days = ageDays(fighter, now)
  const panel = rosterPanel(fighter, factor.total)

  return (
    <div className="sheet" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="sheet__panel panel fdialog"
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

