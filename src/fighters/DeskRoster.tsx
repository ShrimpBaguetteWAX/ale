import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RosterFighter } from '@/dungeon/types'
import {
  ELEMENTS,
  EMPTY_FILTER,
  MARKERS,
  ROSTER_SORTS,
  SORTS,
  STATUSES,
  countActiveFilters,
  facetsOf,
  markerIcon,
  matchesStatus,
  type Element,
  type RosterFilter,
  type SortOption,
  type Status,
} from '@/dungeon/filters'
import type { FighterLevel, FightersConfig } from '@/fighters/types'
import {
  ageBand,
  ageBonus,
  ageDays,
  ageNote,
  battleFactor,
  fighterState,
  levelUpOf,
  paydayOf,
  sellable,
  useLabel,
  type PaydayScope,
} from '@/fighters/rules'
import {
  combatFigures,
  gradeCombatScore,
  gradeDamagePerSecond,
  gradeSurvival,
  meanResistance,
  ROLE_LIST,
  roleOf,
} from '@/fighters/derived'
import { listable, MAX_BULK_LISTINGS, processingFee, sellerPayout } from '@/market/rules'
import type { MarketConfig } from '@/market/queries'
import {
  ABILITY_RARITY_COLOR,
  FILTER_STATS,
  GRADE_ICON,
  GRADE_LABEL,
  abilityName,
  abilityRarity,
  elementBackground,
  fighterArt,
  fighterArtFallback,
  fighterAvatar,
  formatResistance,
  formatTarget,
  gradeAged,
  gradeOfStat,
  resolveAbilityDescription,
  statDisplay,
  statIcon,
  type ClassTemplate,
  type StatGrade,
  elementIcon,
} from '@/tavern/fighterStats'
import { QualityFilters } from '@/fight/setup'
import { BottomSheet } from '@/components/BottomSheet'
import { GameImg } from '@/components/GameImg'
import { NUM_LOCALE, formatDecimals } from '@/format'
import { canAscend, coverableSlots, SACRIFICE_COUNT } from '@/ascension/rules'
import { useLazyConfig } from '@/state/useConfig'
import { asset } from '@/assets'

/**
 * My Fighters on a desktop: the Market's rows, with payday and age.
 *
 * The roster as a list down the left — the rows the Market uses, each with
 * its age chip and a payday column — and the picked fighter in full on the
 * right: what age has taken, when the next payday falls and what it costs,
 * the stats, the resistances and every ability with what it does. A switch
 * over the list turns the rows to one kind of figure at a time. Sell and
 * Sell on market keep the same list, add a tick to each row, and turn the
 * right-hand side into what is about to happen to the ticked fighters.
 *
 * A phone gets the same screen in one column (`phone`): the rows sized for a
 * thumb, the fighter in full as a sheet from the bottom with its actions at
 * the foot, the filter and sort together in one sheet, and what is ticked in
 * a bar above the tab bar.
 */

export type Mode = 'inventory' | 'sell' | 'market'
export type View = 'default' | 'stats' | 'combat' | 'abilities'

export const VIEWS: [View, string][] = [
  ['default', 'Default'],
  ['stats', 'Stats'],
  ['combat', 'Combat'],
  ['abilities', 'Abilities'],
]
const STAT_FIELDS = ['damage', 'health', 'taunt', 'attackspeed', 'initiative'] as const
const STAT_NAMES: Record<string, string> = {
  damage: 'Damage',
  health: 'Health',
  taunt: 'Taunt',
  attackspeed: 'Cooldown',
  initiative: 'Windup',
}
/* The column heads over a desktop's default rows, where a whole word would not fit. */
const STAT_SHORT: Record<string, string> = {
  damage: 'Dmg',
  health: 'HP',
  taunt: 'Taunt',
  attackspeed: 'Cool',
  initiative: 'Wind',
}
const RES: [string, string][] = [
  ['res_gem', 'gem'],
  ['res_metal', 'metal'],
  ['res_air', 'air'],
  ['res_fire', 'fire'],
  ['res_nature', 'nature'],
  ['res_neutral', 'neutral'],
]
const STATUS_LABEL: Record<Status, string> = {
  All: 'All',
  Available: 'Available',
  'Requests Payday': 'Requests payday',
  Arena: 'Arena',
  Market: 'Market',
  Tournament: 'Tournament',
}
const SORT_GROUPS: [string, SortOption[]][] = [
  ['Roster', [...ROSTER_SORTS, ...SORTS.filter((s) => s.value === 'level')]],
  ['Combat', SORTS.filter((s) => ['combat_score', 'dps', 'survival'].includes(s.value))],
  ['Stats', SORTS.filter((s) => /_max$/.test(s.value))],
  ['Resistance', SORTS.filter((s) => s.value.startsWith('res_'))],
]
const DAY = 86_400_000
/* Room for the list and the fighter in full side by side. */
const WIDE = '(min-width: 1280px)'
const gemsOf = (n: number) => `${n.toLocaleString(NUM_LOCALE)} gem${n === 1 ? '' : 's'}`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* ---------- what a row needs, worked out once per fighter ---------- */

export interface Figures {
  factor: { level: number; age: number; total: number }
  stats: { field: string; value: number; spread: number; grade: StatGrade | null }[]
  res: { field: string; el: string; value: string; grade: StatGrade | null }[]
  combat: { dps: number; survival: number; score: number; dpsG: StatGrade | null; survG: StatGrade | null; scoreG: StatGrade | null }
  age: number
  pay: ReturnType<typeof paydayOf>
}

export function figuresOf(
  f: RosterFighter,
  template: ClassTemplate | undefined,
  config: FightersConfig | undefined,
  levelMod: number,
  ageDecay: number,
  now: number,
  atLevelOne: boolean,
): Figures {
  const raw = f.stats as unknown as Record<string, number>
  const factor = battleFactor(f, levelMod, ageDecay, now, atLevelOne ? 1 : undefined)
  const mid = (field: string) => (raw[`${field}_min`] + raw[`${field}_max`]) / 2
  const stats = STAT_FIELDS.map((field) => {
    /* Only health and damage are scaled by level and age; the rest are
       fought with exactly as rolled. Graded after age, never level. */
    const scale = field === 'health' || field === 'damage' ? factor.total : 1
    const { value, spread } = statDisplay(raw[`${field}_min`] * scale, raw[`${field}_max`] * scale)
    return { field, value, spread, grade: field === 'taunt' ? null : gradeAged(raw, field, template, factor.age) }
  })
  const res = RES.map(([field, el]) => ({
    field,
    el,
    value: formatResistance(raw[field] ?? 0),
    grade: gradeOfStat(raw, field, template),
  }))
  const { dps, survival, score } = combatFigures(raw, factor.total)
  const meanRes = meanResistance(raw)
  const combat = {
    dps,
    survival,
    score,
    dpsG: gradeDamagePerSecond(mid('damage') * factor.age, mid('attackspeed'), template),
    survG: gradeSurvival(mid('health') * factor.age, meanRes, template),
    scoreG: gradeCombatScore(mid('health') * factor.age, meanRes, mid('damage') * factor.age, mid('attackspeed'), template),
  }
  return { factor, stats, res, combat, age: ageBonus(f, ageDecay, now), pay: paydayOf(f, config, now) }
}

/* How far along its bar a grade reaches; the class's average stands at 55%. */
const GRADE_REACH: Record<StatGrade, number> = {
  'gold-up': 1,
  'green-duble-up': 0.9,
  'green-up': 0.74,
  middle: 0.55,
  'red-down': 0.36,
  'red-duble-down': 0.2,
}

/* A figure's tile tinted by its grade: green above the class, red below. */
function toneOf(grade: StatGrade | null): string | undefined {
  if (grade === 'gold-up' || grade === 'green-duble-up' || grade === 'green-up') return 'is-up'
  if (grade === 'red-down' || grade === 'red-duble-down') return 'is-down'
  return undefined
}

function Grade({ grade }: { grade: StatGrade | null }) {
  if (!grade) return null
  return <img className="drost__grade" src={GRADE_ICON[grade]} alt={GRADE_LABEL[grade]} title={GRADE_LABEL[grade]} />
}

function AgeChip({ bonus }: { bonus: number }) {
  return (
    <span className="drost__age">
      Age {bonus > 0 ? '+' : ''}
      {bonus.toFixed(0)}%
    </span>
  )
}

function rarityColor(displayname: string): string {
  const r = abilityRarity(displayname)
  return r ? ABILITY_RARITY_COLOR[r] : 'rgb(255 255 255 / 55%)'
}

function payDay(f: RosterFighter): string {
  const t = Date.parse(f.next_payday + 'Z')
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'
}

function Credits({ value }: { value: number }) {
  return (
    <span className="drost__cr">
      {value.toLocaleString(NUM_LOCALE)}
      <img src={asset('/assets/icons/credits.svg')} alt="credits" />
    </span>
  )
}

function Gems({ value }: { value: number }) {
  return (
    <span className="drost__cr">
      {value.toLocaleString(NUM_LOCALE)}
      <img src={asset('/assets/icons/gems.svg')} alt="gems" />
    </span>
  )
}

/* ---------- the screen ---------- */

export interface DeskRosterProps {
  /** One column for a phone: sheets from the bottom rather than beside or from the side. */
  phone?: boolean
  roster: RosterFighter[]
  /** The roster after the filter and its sort. */
  shown: RosterFighter[]
  filter: RosterFilter
  onFilter: (f: RosterFilter) => void
  templates: Map<string, ClassTemplate>
  levels: FighterLevel[]
  config?: FightersConfig
  levelMod: number
  ageDecay: number
  now: number
  atLevelOne: boolean
  onAtLevelOne: (on: boolean) => void
  readyToLevel: number
  lockedCount: number
  loading: boolean
  banner: React.ReactNode

  mode: Mode
  onMode: (m: Mode) => void
  checked: number[]
  onCheck: (id: number) => void
  onChecked: (ids: number[]) => void
  selectedId: number | null
  onSelect: (id: number | null) => void
  onMarker: (f: RosterFighter, marker: string) => void

  canAct: boolean
  busy: string | null
  credits: number
  gems: number

  payAll: { ids: number[]; credits: number }
  payScope: PaydayScope
  onPayScope: (s: PaydayScope) => void
  overdue: number
  levelAll: { ids: number[]; credits: number; gems: number; fighters: number; skipped?: number }
  onPayAll: () => void
  onLevelAll: () => void
  onPayOne: (f: RosterFighter) => void
  onLevelOne: (f: RosterFighter) => void

  sellValue: number
  onSell: () => void

  marketConfig?: MarketConfig
  listPlan: { ids: number[]; gems: number; gate: { ok: boolean; reason?: string } }
  startPrice: number
  onStartPrice: (n: number) => void
  minStart: number
  keepListed: boolean
  onKeepListed: (on: boolean) => void
  onList: () => void
}

export function DeskRoster(p: DeskRosterProps) {
  const [view, setView] = useState<View>('default')
  const [pop, setPop] = useState<'filters' | 'sort' | null>(null)
  const phone = !!p.phone
  /* Below this the picked fighter opens from the side rather than beside the list. */
  const [wide, setWide] = useState(() => !phone && window.matchMedia(WIDE).matches)
  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const on = () => setWide(!phone && mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [phone])
  /*
     A phone pins the list's head — the count and the view switch — under
     the top bar while the roster scrolls. Pinned, it takes the bar's glass,
     as if the bar had grown a second row; at rest it is plain.
  */
  const listHead = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    if (!phone) return
    const check = () => {
      const el = listHead.current
      if (!el) return
      const pin = parseFloat(getComputedStyle(el).top) || 0
      setStuck(el.getBoundingClientRect().top <= pin + 0.5)
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [phone])
  /*
     Whether that side sheet is open. Its own flag rather than "a fighter is
     picked": a pick made in two columns is still there after the window
     narrows, and the sheet should open when it is asked for, not because
     the window changed size.
  */
  const [sheet, setSheet] = useState(false)
  useEffect(() => setSheet(false), [wide])
  /* What the sheet holds: one fighter, or the sale or listing being put together. */
  const [sheetOf, setSheetOf] = useState<'fighter' | 'basket'>('fighter')
  /* A desktop's sale or listing folds to one bar over the fighter; this opens its terms in full. */
  const [termsOpen, setTermsOpen] = useState(false)
  useEffect(() => setTermsOpen(false), [p.mode])

  /*
     Each selling mode opens on the roster it is about. Sell puts the oldest
     first — they are usually the ones to let go — and the market starts on
     the fighters that can be listed, by their abilities, which is what a
     buyer shops for. Inventory's own sort and availability come back on the
     way out.
  */
  const kept = useRef<Pick<RosterFilter, 'sort' | 'sortAsc' | 'status'> | null>(null)
  const lastMode = useRef(p.mode)
  useEffect(() => {
    const from = lastMode.current
    lastMode.current = p.mode
    if (from === p.mode) return
    /* "Sell" from a phone's fighter sheet: the basket bar takes over from here. */
    if (phone) setSheet(false)
    const base =
      from === 'inventory'
        ? ((kept.current = { sort: p.filter.sort, sortAsc: p.filter.sortAsc, status: p.filter.status }), p.filter)
        : { ...p.filter, ...kept.current }
    if (p.mode === 'sell') p.onFilter({ ...base, sort: 'age', sortAsc: true })
    else if (p.mode === 'market') p.onFilter({ ...base, status: 'Available' })
    else p.onFilter(base)
    /* The view the player chose stays: switching to Sell or Sell on market leaves the columns as they were. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.mode])

  const list = p.shown

  const counts = useMemo(() => {
    const c = {} as Record<Status, number>
    for (const s of STATUSES) c[s] = p.roster.filter((f) => matchesStatus(f, s, p.now)).length
    return c
  }, [p.roster, p.now])

  const figures = useMemo(() => {
    const m = new Map<number, Figures>()
    for (const f of list)
      m.set(f.fighter_id, figuresOf(f, p.templates.get(f.classname), p.config, p.levelMod, p.ageDecay, p.now, p.atLevelOne))
    return m
  }, [list, p.templates, p.config, p.levelMod, p.ageDecay, p.now, p.atLevelOne])

  const selected = p.roster.find((f) => f.fighter_id === p.selectedId) ?? null
  /* Inventory always shows somebody: the picked fighter, else the first row. */
  const shownFighter = selected ?? (p.mode === 'inventory' ? (list[0] ?? null) : null)
  /* A desktop's availability is its own switch in the toolbar; a phone's sits in the filter sheet and counts there. */
  const active = countActiveFilters(p.filter) - (!phone && p.filter.status !== 'All' ? 1 : 0)
  const ticked = p.roster.filter((f) => p.checked.includes(f.fighter_id))
  const clearFilters = () => {
    p.onFilter({ ...EMPTY_FILTER, status: phone ? 'All' : p.filter.status, sort: p.filter.sort, sortAsc: p.filter.sortAsc })
    p.onAtLevelOne(false)
  }
  const sortLabel = [...ROSTER_SORTS, ...SORTS].find((s) => s.value === p.filter.sort)?.label ?? 'Level'
  const set = (patch: Partial<RosterFilter>) => p.onFilter({ ...p.filter, ...patch })

  const gateOf = (f: RosterFighter) =>
    p.mode === 'market' ? listable(f, p.now) : p.mode === 'sell' ? { ok: sellable(f), reason: useLabel(f) } : { ok: true }
  /*
     A click on a row is for looking, in every mode and on every screen: it
     opens the fighter — beside the list on a desktop, in a sheet otherwise —
     without putting it in a sale or a listing. The tick on the row, or the
     button under the fighter, does that.
  */
  const looks = p.mode === 'sell' || p.mode === 'market'
  const onRow = (f: RosterFighter) => {
    p.onSelect(f.fighter_id)
    if (!wide) {
      setSheetOf('fighter')
      setSheet(true)
    }
  }
  const openBasket = () => {
    p.onSelect(p.checked[p.checked.length - 1])
    setSheetOf('basket')
    setSheet(true)
  }

  /* A fighter the filter has hidden can still be the one picked. */
  const figOf = (f: RosterFighter) =>
    figures.get(f.fighter_id) ??
    figuresOf(f, p.templates.get(f.classname), p.config, p.levelMod, p.ageDecay, p.now, p.atLevelOne)
  const detail = shownFighter && <Detail f={shownFighter} fig={figOf(shownFighter)} {...p} />
  /*
     A desktop's side fits the screen: the sale or the listing folds to one
     bar over the fighter, its terms a click away, so nothing in it scrolls.
  */
  const basketPanel = p.mode === 'sell' ? <SellPanel {...p} /> : p.mode === 'market' ? <ListPanel {...p} /> : null
  const side = basketPanel ? (
    <div className="drost__stack">
      {termsOpen ? (
        <>
          <button type="button" className="drost__fold" onClick={() => setTermsOpen(false)}>
            Fold the {p.mode === 'sell' ? 'sale' : 'terms'} away
          </button>
          {basketPanel}
        </>
      ) : (
        <BasketBar {...p} onOpen={() => setTermsOpen(true)} />
      )}
      {detail}
    </div>
  ) : (
    detail
  )

  const basket = phone && p.mode !== 'inventory' && ticked.length > 0

  const modeSeg = (
    <span className="drost__seg" role="tablist" aria-label="Roster mode">
      {(
        [
          ['inventory', 'Inventory'],
          ['sell', 'Sell'],
          ['market', 'Sell on market'],
        ] as [Mode, string][]
      ).map(([m, label]) => (
        <button type="button" role="tab" key={m} aria-selected={p.mode === m} onClick={() => p.onMode(m)}>
          {label}
        </button>
      ))}
    </span>
  )

  return (
    <div className={`drost${phone ? ` drost--phone drost--stack is-${p.mode}` : ''}${basket ? ' has-basket' : ''}`}>
      <header className="drost__head">
        <span>
          <h1 className="drost__title">My Fighters</h1>
          <span className="drost__counts">
            <b>{p.roster.length}</b> owned · <b>{p.lockedCount}</b> locked
          </span>
        </span>
        <span className="drost__headacts">
          {p.mode === 'inventory' && (
            <>
              <span className="paysplit">
                <button
                  type="button"
                  className="btn btn--gold paysplit__go"
                  disabled={!p.canAct || p.payAll.ids.length === 0 || !!p.busy}
                  onClick={p.onPayAll}
                >
                  {p.busy === 'pay-all' && <span className="spinner" />}
                  Payday {p.payScope === 'overdue' ? 'unwilling' : 'all'} ({p.payAll.ids.length})
                  {p.payAll.credits > 0 && <Credits value={p.payAll.credits} />}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost paysplit__mode"
                  aria-pressed={p.payScope === 'overdue'}
                  disabled={!!p.busy}
                  onClick={() => p.onPayScope(p.payScope === 'overdue' ? 'all' : 'overdue')}
                  title={
                    p.payScope === 'overdue'
                      ? `Paying only the ${p.overdue} unwilling to fight. Switch to the whole roster.`
                      : `Paying all ${p.payAll.ids.length}. Switch to the ${p.overdue} unwilling to fight.`
                  }
                >
                  {p.payScope === 'overdue' ? 'Unwilling' : 'All'}
                </button>
              </span>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={
                  !p.canAct ||
                  p.levelAll.ids.length === 0 ||
                  p.levelAll.credits > p.credits ||
                  p.levelAll.gems > p.gems ||
                  !!p.busy
                }
                onClick={p.onLevelAll}
              >
                {p.busy === 'level-all' && <span className="spinner" />}
                Level all ({p.levelAll.ids.length})
                {p.levelAll.credits > 0 && <Credits value={p.levelAll.credits} />}
              </button>
            </>
          )}
          {phone && modeSeg}
        </span>
      </header>

      {p.banner}

      <div className="drost__toolbar">
        {/*
          A desktop's command bar: everything that changes what is listed, in
          reading order — the mode, then which fighters, then Filters and Sort
          at its end. The title line keeps only the roster's two chores.
        */}
        {!phone && (
          <>
            {modeSeg}
            <span className="drost__vr" aria-hidden="true" />
            <StatusSeg short filter={p.filter} counts={counts} onStatus={(s) => set({ status: s })} />
          </>
        )}
        {/* A phone's markers at hand where its search box was; a desktop has them over the rows. */}
        {phone && <MarkerSeg roster={p.roster} filter={p.filter} onFilter={p.onFilter} />}
        <span className="drost__sp" />
        {p.mode === 'market' && counts.Market > 0 && (
          <span className="drost__note">
            {counts.Market} of yours on the market now ·{' '}
            <Link to="/market?tab=mine">Market › My listings</Link>
          </span>
        )}
        <button
          type="button"
          className={`drost__tool${pop === 'filters' || active > 0 ? ' is-on' : ''}`}
          aria-expanded={pop === 'filters'}
          onClick={() => setPop(pop === 'filters' ? null : 'filters')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7z" />
          </svg>
          {phone ? <span className="sr-only">Filters</span> : 'Filters'}
          {active > 0 && <em>{active}</em>}
        </button>
        {phone ? (
          /*
            A phone's sort is a dropdown of its own: the button wears the
            current sort, and a tap opens the phone's own picker over it.
          */
          <label className="drost__tool drost__sortpick">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
            </svg>
            {sortLabel}
            <span className="drost__caret" aria-hidden="true">
              ▾
            </span>
            <select value={p.filter.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort by">
              {SORT_GROUPS.map(([group, options]) => (
                <optgroup key={group} label={group}>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ) : (
          <button
            type="button"
            className={`drost__tool${pop === 'sort' ? ' is-on' : ''}`}
            aria-expanded={pop === 'sort'}
            onClick={() => setPop(pop === 'sort' ? null : 'sort')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
            </svg>
            <small>Sort</small> {sortLabel}
          </button>
        )}
        <button
          type="button"
          className="drost__dir"
          onClick={() => set({ sortAsc: !p.filter.sortAsc })}
          title={p.filter.sortAsc ? 'Smallest first' : 'Biggest first'}
          aria-label={p.filter.sortAsc ? 'Smallest first' : 'Biggest first'}
        >
          {p.filter.sortAsc ? '↑' : '↓'}
        </button>

        {pop && !phone && <button type="button" className="drost__scrim" aria-label="Close" onClick={() => setPop(null)} />}
        {pop === 'filters' && !phone && (
          <FilterPanel
            {...p}
            matching={list.length}
            onClose={() => setPop(null)}
          />
        )}
        {pop === 'sort' && !phone && (
          <div className="drost__pop drost__pop--sort">
            <DirSeg filter={p.filter} onAsc={(sortAsc) => set({ sortAsc })} />
            <SortList
              filter={p.filter}
              onPick={(sort) => {
                set({ sort })
                setPop(null)
              }}
            />
            <p className="drost__note">Health and damage sort as fought with, after level and age.</p>
          </div>
        )}
      </div>

      {pop && phone && (
        <BottomSheet
          title="Filters"
          onClose={() => setPop(null)}
          foot={
            <>
              <button type="button" className="btn btn--ghost" onClick={clearFilters}>
                Clear all
              </button>
              <button type="button" className="btn btn--primary drost__grow" onClick={() => setPop(null)}>
                Show {list.length} fighter{list.length === 1 ? '' : 's'}
              </button>
            </>
          }
        >
          <div className="drost__fsheet">
            <div>
              <span className="drost__fhead">Show</span>
              <StatusSeg chips filter={p.filter} counts={counts} onStatus={(s) => set({ status: s })} />
            </div>
            <FilterFields {...p} />
            <p className="drost__note">Health and damage rules grade after age, like the arrows.</p>
          </div>
        </BottomSheet>
      )}

      {phone && p.mode !== 'inventory' && (
        <p className="drost__hint">
          {p.mode === 'sell'
            ? "Tick fighters to sell them back to the game for credits. Busy ones can't be ticked."
            : `Tick up to ${MAX_BULK_LISTINGS} ready fighters to put up for auction.`}
        </p>
      )}

      <ActiveChips {...p} />

      {p.loading && p.roster.length === 0 ? (
        <div className="drost__rows">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="drost__row is-loading" key={i} />
          ))}
        </div>
      ) : p.roster.length === 0 ? (
        <p className="roster__empty">
          You have no fighters yet. Recruits are hired at a tavern — stand on one on the map to reveal and hire.
        </p>
      ) : (
        <div className={`drost__main${wide ? '' : ' is-narrow'}`}>
          <section className="drost__list" aria-label="Fighters">
            <div className={`drost__listhead${stuck ? ' is-stuck' : ''}`} ref={listHead}>
              {/* A desktop's view switch stands where the count was; a phone keeps both. */}
              {phone && (
                <span className="drost__cap">
                  {list.length === p.roster.length
                    ? `${p.roster.length} fighters`
                    : `${list.length} of ${p.roster.length}`}
                </span>
              )}
              <span className="drost__seg drost__seg--sm" role="tablist" aria-label="Rows show">
                {VIEWS.map(([v, label]) => (
                  <button type="button" role="tab" key={v} aria-selected={view === v} onClick={() => setView(v)}>
                    {label}
                  </button>
                ))}
              </span>
              {/* The markers at hand beside the views on a desktop; the filter keeps them too, as a phone's does. */}
              {!phone && <MarkerSeg roster={p.roster} filter={p.filter} onFilter={p.onFilter} />}
            </div>
            {list.length === 0 ? (
              <p className="roster__empty">
                No fighter matches these filters.{' '}
                <button
                  type="button"
                  className="linklike"
                  onClick={clearFilters}
                >
                  Clear them
                </button>
                .
              </p>
            ) : (
              <div className="drost__rows">
                {list.map((f) => (
                  <Row
                    key={f.fighter_id}
                    f={f}
                    fig={figures.get(f.fighter_id)!}
                    view={view}
                    mode={p.mode}
                    now={p.now}
                    picked={f.fighter_id === (wide ? shownFighter : selected)?.fighter_id}
                    checked={p.checked.includes(f.fighter_id)}
                    gate={gateOf(f)}
                    onClick={() => onRow(f)}
                    onTick={looks && gateOf(f).ok ? () => p.onCheck(f.fighter_id) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
          {wide && <aside className="drost__side">{side}</aside>}
        </div>
      )}

      {/*
        A phone's basket: who is ticked, what it comes to, and the one
        button — above the tab bar, wherever the list has scrolled to.
        Selling goes straight to its confirmation, which lists them again;
        listing has terms to set first, so it opens them.
      */}
      {basket && (
        <div className={`drost__basketbar is-${p.mode}`}>
          <span className="drost__faces" aria-hidden="true">
            {ticked.slice(0, 3).map((f) => (
              <span className="drost__art" key={f.fighter_id} style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}>
                <GameImg src={fighterAvatar(f)} alt="" fallback={fighterArtFallback()} />
              </span>
            ))}
          </span>
          <span className="drost__what">
            <b>
              {p.mode === 'sell' ? 'Sell' : 'List'} {ticked.length} fighter{ticked.length === 1 ? '' : 's'}
            </b>
            <small>
              {p.mode === 'sell' ? (
                <>
                  Permanent · you get <Credits value={p.sellValue} />
                </>
              ) : (
                <>
                  {gemsOf(p.listPlan.gems)} to list · from {gemsOf(p.startPrice)} each
                </>
              )}
            </small>
          </span>
          {p.mode === 'sell' ? (
            <button type="button" className="btn btn--danger" disabled={!p.canAct || !!p.busy} onClick={p.onSell}>
              {p.busy === 'sell' && <span className="spinner" />}
              Sell
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={openBasket}
            >
              Review
            </button>
          )}
        </div>
      )}

      {/* Too narrow for two columns: the side opens over the page instead. */}
      {!wide && !phone && p.mode !== 'inventory' && p.checked.length > 0 && (
        <div className="drost__dock">
          <span>
            {p.checked.length} ticked ·{' '}
            {p.mode === 'sell' ? <Credits value={p.sellValue} /> : <Gems value={p.listPlan.gems} />}
          </span>
          <button
            type="button"
            className="btn btn--primary"
            onClick={openBasket}
          >
            Review
          </button>
        </div>
      )}
      {!wide && sheet && selected && (
        <BottomSheet
          side={!phone}
          title={
            sheetOf === 'fighter' || !basketPanel
              ? `${cap(selected.racename)} ${cap(selected.classname)}`
              : p.mode === 'sell'
                ? 'Sell'
                : 'List on the market'
          }
          onClose={() => setSheet(false)}
          foot={phone && (sheetOf === 'fighter' || !basketPanel) ? <Acts {...p} f={selected} fig={figOf(selected)} /> : undefined}
        >
          {sheetOf === 'fighter' || !basketPanel ? detail : basketPanel}
        </BottomSheet>
      )}
    </div>
  )
}

/* ---------- a row ---------- */

/*
 * One fighter's card. My Fighters draws its list with it, and Ascension its
 * own, so a player meets the same card wherever they pick a fighter.
 */
export function Row({
  f,
  fig,
  view,
  mode,
  now,
  picked,
  checked,
  gate,
  onClick,
  onTick,
  aside,
  note,
  dim = false,
  wideAside = false,
}: {
  f: RosterFighter
  fig: Figures
  view: View
  mode: Mode
  now: number
  picked: boolean
  checked: boolean
  gate: { ok: boolean; reason?: string }
  onClick: () => void
  /** Set where a click on the row only looks: the tick alone puts the fighter in or out. */
  onTick?: () => void
  /** At the end of the name line: Ascension's "2/3", or its choice circle. */
  aside?: React.ReactNode
  /** One line under the abilities, for what the screen needs to add. */
  note?: React.ReactNode
  /** Shown but set back, as for a fighter already placed somewhere else. */
  dim?: boolean
  /** The aside needs two columns' room: the market's price over its clock. */
  wideAside?: boolean
}) {
  const s = f.stats
  const state = fighterState(f, now)
  const ticking = mode !== 'inventory'
  const abilities = s.abilities ?? []
  /* The default row: payday as a ring round the portrait, the stats in columns. A phone stacks it. */
  const ring = view === 'default'
  const daysLeft = Math.max(0, Math.ceil(fig.pay.msLeft / DAY))
  const role = roleOf(fig.combat.dpsG, fig.combat.survG)
  /*
     The fighter down the card's whole height, in every view: the level and
     the marker on the art, the days to payday at its foot over a bar that
     fills as the day comes.
  */
  const hero = (
    <span
      className={`drost__cardart${fig.pay.overdue ? ' is-overdue' : ''}`}
      style={
        {
          backgroundImage: `url('${elementBackground(f.element)}')`,
          '--p': `${Math.max(2, fig.pay.progress * 100)}%`,
        } as React.CSSProperties
      }
      title={
        fig.pay.overdue
          ? `Payday due · ${fig.pay.cost.toLocaleString(NUM_LOCALE)} credits`
          : `Payday ${payDay(f)} · in ${daysLeft}d · ${fig.pay.cost.toLocaleString(NUM_LOCALE)} credits`
      }
    >
      <GameImg src={fighterArt(f)} alt="" loading="lazy" fallback={fighterArtFallback()} />
      {f.marker && (
        <span className="drost__mk">
          <img src={markerIcon(f.marker)} alt={f.marker} />
        </span>
      )}
      <span className="drost__cardfoot">
        <span className="drost__lv">
          L{s.level}
          {f.ascension_level > 0 && <em>✦{f.ascension_level}</em>}
        </span>
        <span className="drost__days">{fig.pay.overdue ? 'Due' : `${daysLeft}d`}</span>
      </span>
    </span>
  )
  /* The same name line as the default view's, so class, element and race stand in one place in every view. */
  const name = (
    <span className="drost__name">
      <span className="drost__l1">
        <b>{f.classname}</b>
        <img src={elementIcon(f.element)} alt={f.element} />
        <small>{f.racename}</small>
      </span>
    </span>
  )
  const status =
    state === 'busy' ? (
      <span className={`drost__status is-${f.use_type.toLowerCase() === 'market' ? 'market' : 'busy'}`}>{useLabel(f)}</span>
    ) : state === 'overdue' ? (
      <span className="drost__status is-overdue">Requests payday</span>
    ) : null

  const classes = [
    'drost__row',
    'is-card',
    ring ? 'is-overview' : 'is-view',
    ticking ? 'is-tick' : '',
    picked ? 'is-picked' : '',
    checked ? 'is-checked' : '',
    ticking && !gate.ok ? 'is-locked' : '',
    aside ? 'is-aside' : '',
    aside && wideAside ? 'is-aside-wide' : '',
    note ? 'has-note' : '',
    dim ? 'is-dim' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-pressed={ticking ? checked : picked}
      title={ticking && !gate.ok ? gate.reason : undefined}
    >
      {ticking && (
        <span
          className={`drost__tick${checked ? ' is-on' : ''}${gate.ok ? '' : ' is-off'}${onTick ? ' is-hit' : ''}`}
          aria-hidden="true"
          title={onTick ? (checked ? 'Take out of the sale' : 'Add to the sale') : undefined}
          onClick={
            onTick
              ? (e) => {
                  e.stopPropagation()
                  onTick()
                }
              : undefined
          }
        />
      )}
      {hero}
      {ring ? (
        <>
          <span className="drost__who">
            <span className="drost__l1">
              <b>{f.classname}</b>
              <img src={elementIcon(f.element)} alt={f.element} />
              <small>{f.racename}</small>
            </span>
            <span className="drost__l3">
              <AgeChip bonus={fig.age} />
              {status}
            </span>
          </span>
          {/* Each stat against its class: the tick is the class's average, the bar how far past or short of it. */}
          <span className="drost__bars">
            {fig.stats.map((x) => (
              <span className="drost__bar" key={x.field} title={`${STAT_NAMES[x.field]}${x.grade ? ` · ${GRADE_LABEL[x.grade]}` : ''}`}>
                <small>
                  <img className="drost__si" src={statIcon(x.field)} alt="" />
                  {STAT_SHORT[x.field]}
                </small>
                <span className={`drost__track is-${x.grade ?? 'none'}`}>
                  <i style={{ width: `${GRADE_REACH[x.grade ?? 'middle'] * 100}%` }} />
                </span>
                <b>
                  {x.value}
                  <Grade grade={x.grade} />
                </b>
              </span>
            ))}
          </span>
          {/* The card's end: the combat score as a rating, then what the screen adds — a sale's credits, a price. */}
          <span className="drost__end">
            <span className="drost__badge" title="Combat score: damage and survival together">
              <b>{Math.round(fig.combat.score).toLocaleString(NUM_LOCALE)}</b>
              <small>Score</small>
              <img src={elementIcon(f.element)} alt="" />
            </span>
            {mode === 'sell' && (
              <span className="drost__pay">
                {gate.ok ? <Credits value={s.credits ?? 0} /> : <small>Busy</small>}
              </span>
            )}
            {aside && <span className="drost__aside">{aside}</span>}
          </span>
          <span className="drost__abn">
            {abilities.map((a, i) => {
              const r = abilityRarity(a.displayname)
              return (
                <span
                  key={`${a.ability}-${i}`}
                  className={`drost__abp${a.locked ? ' is-locked' : ''}`}
                  style={{ '--ab': rarityColor(a.displayname) } as React.CSSProperties}
                  title={`${abilityName(a.displayname)}${r ? ` · ${r}` : ''}${a.locked ? ' · locked' : ''}`}
                >
                  {!!a.locked && <img src={asset('/assets/icons/lock.svg')} alt="" />}
                  <span>{abilityName(a.displayname)}</span>
                </span>
              )
            })}
          </span>
          {note && <span className="drost__rownote">{note}</span>}
        </>
      ) : (
        <>
          {name}
          {/* The stats and the resistances in two columns, each a bar against the class as on the default view. */}
          {view === 'stats' && (
            <span className="drost__statcols">
              <span className="drost__bars">
                {fig.stats.map((x) => (
                  <span
                    className="drost__bar"
                    key={x.field}
                    title={`${STAT_NAMES[x.field]}${x.grade ? ` · ${GRADE_LABEL[x.grade]}` : ''}`}
                  >
                    <small>
                      <img className="drost__si" src={statIcon(x.field)} alt="" />
                      <span className="drost__lname">{STAT_NAMES[x.field]}</span>
                      <span className="drost__sname">{STAT_SHORT[x.field]}</span>
                    </small>
                    <span className={`drost__track is-${x.grade ?? 'none'}`}>
                      <i style={{ width: `${GRADE_REACH[x.grade ?? 'middle'] * 100}%` }} />
                    </span>
                    <b>
                      {x.value}
                      <Grade grade={x.grade} />
                      {x.spread > 0 && <em>±{x.spread}</em>}
                    </b>
                  </span>
                ))}
              </span>
              <span className="drost__bars drost__bars--res">
                {fig.res.map((x) => (
                  <span
                    className="drost__bar"
                    key={x.field}
                    title={`${cap(x.el)} resistance${x.grade ? ` · ${GRADE_LABEL[x.grade]}` : ''}`}
                  >
                    <small>
                      <img className="drost__ei" src={elementIcon(x.el)} alt="" />
                      <span className="drost__lname">{x.el}</span>
                    </small>
                    <span className={`drost__track is-${x.grade ?? 'none'}`}>
                      <i style={{ width: `${GRADE_REACH[x.grade ?? 'middle'] * 100}%` }} />
                    </span>
                    <b>
                      {x.value}
                      <Grade grade={x.grade} />
                    </b>
                  </span>
                ))}
              </span>
            </span>
          )}
          {/*
            What the fighter is for, in a word, from its DPS and survival grades;
            both grade it against its own class, so the caption says so.
          */}
          {view === 'combat' && (
            <span className="drost__role">
              <span className="drost__rolewho">
                <small title={`Graded against other ${f.classname}s, not against other classes`}>
                  Role among {f.classname}s
                </small>
                <span className={`drost__rolename is-${role.key}`}>
                  <b>{role.name}</b>
                  <span>{role.line}</span>
                </span>
              </span>
              <span className="drost__roletiles">
                <span className={toneOf(fig.combat.dpsG)} title="Damage per second">
                  <small>DPS</small>
                  <b>
                    {formatDecimals(fig.combat.dps, 2)}
                    <Grade grade={fig.combat.dpsG} />
                  </b>
                </span>
                <span className={toneOf(fig.combat.survG)} title="Survival: how much damage it takes to bring down">
                  <small>Survival</small>
                  <b>
                    {Math.round(fig.combat.survival).toLocaleString(NUM_LOCALE)}
                    <Grade grade={fig.combat.survG} />
                  </b>
                </span>
                <span className={toneOf(fig.stats[4].grade)} title="Windup: how soon it strikes">
                  <small>Windup</small>
                  <b>
                    {fig.stats[4].value}
                    <Grade grade={fig.stats[4].grade} />
                  </b>
                </span>
                <span title="Who it strikes">
                  <small>Targets</small>
                  <b className="is-text">{s.target ? formatTarget(s.target) : 'Highest Taunt'}</b>
                </span>
              </span>
              <span className="drost__badge drost__badge--role" title="Combat score: damage and survival together">
                <b>{Math.round(fig.combat.score).toLocaleString(NUM_LOCALE)}</b>
                <small>Score</small>
              </span>
            </span>
          )}
          {aside && <span className="drost__aside">{aside}</span>}
          {/*
            Each ability with what it does: on a desktop two by two, the words
            held to two lines (all of them on hover and in the panel); a
            stacked list keeps the names alone, as pills.
          */}
          {view === 'abilities' && (
            <span className="drost__names">
              {abilities.map((a, i) => {
                const text = resolveAbilityDescription(a)
                return (
                  <span
                    key={`${a.ability}-${i}`}
                    className={a.locked ? 'is-locked' : undefined}
                    style={{ '--ab': rarityColor(a.displayname) } as React.CSSProperties}
                    title={`${abilityName(a.displayname)}${a.locked ? ' · unlocks with ascension' : ''}: ${text}`}
                  >
                    <b>
                      {a.locked ? '🔒 ' : ''}
                      {abilityName(a.displayname)}
                    </b>
                    <small>{text}</small>
                  </span>
                )
              })}
            </span>
          )}
        </>
      )}
    </button>
  )
}

/* ---------- the fighter in full ---------- */

function Detail(props: DeskRosterProps & { f: RosterFighter; fig: Figures }) {
  const { f, fig, config, levels, now, phone } = props
  const s = f.stats
  const level = levelUpOf(f, levels)
  const state = fighterState(f, now)
  const days = ageDays(f, now)
  const abilities = s.abilities ?? []
  const unlock = config?.asc_ability_unlock_lvl
    ? `Unlocks at ascension ${config.asc_ability_unlock_lvl}`
    : 'Unlocks on ascension'
  const daysLeft = Math.max(0, Math.ceil(fig.pay.msLeft / DAY))
  /*
     The card from the list, opened up: the art as a banner with the name on
     it and the score badge at its corner, the upkeep in one slim line, the
     stats as bars against the class, the resistances in a row, the abilities
     with what they do, and the actions at the foot.
  */
  return (
    <div className="drost__detail">
      <div className="drost__banner" style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}>
        <GameImg className="drost__bannerart" src={fighterArt(f)} alt="" fallback={fighterArtFallback()} />
        {f.marker && (
          <span className="drost__mk">
            <img src={markerIcon(f.marker)} alt={f.marker} />
          </span>
        )}
        <span className="drost__bannertext">
          <span className="drost__bkick">
            {state === 'busy' ? useLabel(f) : state === 'overdue' ? 'Requests payday' : 'Ready'} · sells for{' '}
            <Credits value={s.credits ?? 0} />
          </span>
          <h2 className="drost__bname">{f.classname}</h2>
          <span className="drost__bline">
            <img src={elementIcon(f.element)} alt="" />
            {f.racename} · {f.element}
          </span>
          <span className="drost__bchips">
            <span>
              Level {s.level}
              {level.atMax ? ' · max' : ''}
            </span>
            {f.ascension_level > 0 && <span>Ascended {f.ascension_level}</span>}
            <span>
              <img src={statIcon('target')} alt="" />
              {s.target ? formatTarget(s.target) : 'Highest Taunt'}
            </span>
            {/* A phone's foot has room for four buttons; the marker rides up here. */}
            {phone && <MarkerPick {...props} chip />}
          </span>
        </span>
        <span className="drost__badge drost__badge--detail" title="Combat score: damage and survival together">
          <b>{Math.round(fig.combat.score).toLocaleString(NUM_LOCALE)}</b>
          <small>Score</small>
        </span>
      </div>

      {/* The two clocks a fighter runs on and what the next payday costs, in one slim line; the long words on hover. */}
      <div className="drost__upkeep">
        <span
          title={`${ageNote(fig.age, days, fig.factor.age)} Health & damage ×${fig.factor.age.toFixed(2)} · ${days} day${days === 1 ? '' : 's'} old. It only goes down.`}
        >
          Age bonus
          <b className={`is-${ageBand(fig.age)}`}>
            {fig.age > 0 ? '+' : ''}
            {fig.age.toFixed(0)}%
          </b>
        </span>
        <span
          className={fig.pay.overdue ? 'is-overdue' : undefined}
          title={`${fig.pay.overdue ? 'Due now · benched until paid.' : `In ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`} Paying covers the time since the last payday, so paying early saves nothing. Miss it and the fighter is benched, then deleted.`}
        >
          Next payday
          <b>{fig.pay.overdue ? 'Due' : payDay(f)}</b>
        </span>
        <span>
          Pay now
          <b>
            <Credits value={fig.pay.cost} />
          </b>
        </span>
      </div>

      {/* Each stat against its class, as on the card, with the range a blow can land in. */}
      <div className="drost__bars drost__bars--detail">
        {fig.stats.map((x) => (
          <span
            className="drost__bar"
            key={x.field}
            title={`${STAT_NAMES[x.field]}${x.grade ? ` · ${GRADE_LABEL[x.grade]}` : ''}`}
          >
            <small>
              <img className="drost__si" src={statIcon(x.field)} alt="" />
              {STAT_NAMES[x.field]}
            </small>
            <span className={`drost__track is-${x.grade ?? 'none'}`}>
              <i style={{ width: `${GRADE_REACH[x.grade ?? 'middle'] * 100}%` }} />
            </span>
            <b>
              {x.value}
              <Grade grade={x.grade} />
              {x.spread > 0 && <em>±{x.spread}</em>}
            </b>
          </span>
        ))}
      </div>

      <div className="drost__resrow">
        {fig.res.map((x) => (
          <span key={x.field} title={`${cap(x.el)} resistance`}>
            <img src={elementIcon(x.el)} alt={x.el} />
            <b>
              {x.value}
              <Grade grade={x.grade} />
            </b>
          </span>
        ))}
      </div>

      <div className="drost__ablist">
        {abilities.map((a, i) => {
          const r = abilityRarity(a.displayname)
          return (
            <div
              key={`${a.ability}-${i}`}
              className={`drost__abitem${a.locked ? ' is-locked' : ''}`}
              style={{ '--ab': rarityColor(a.displayname) } as React.CSSProperties}
              title={resolveAbilityDescription(a)}
            >
              <b>
                {abilityName(a.displayname)}
                {!!a.locked && <img src={asset('/assets/icons/lock.svg')} alt="" />}
                <small>{a.locked ? unlock : (r ?? 'unique')}</small>
              </b>
              <p>{resolveAbilityDescription(a)}</p>
            </div>
          )
        })}
      </div>
      {!phone && <Acts {...props} />}
    </div>
  )
}

/*
 * A fighter's marker, picked where it is asked for: a private label kept on
 * chain that the roster filters by. Every marker in one small grid; one
 * press sets it and closes. Under the fighter on a desktop the grid opens
 * upwards, over the panel it sits in; from a phone's chip at the top, down.
 */
function MarkerPick({
  f,
  canAct,
  busy,
  onMarker,
  chip,
}: Pick<DeskRosterProps, 'canAct' | 'busy' | 'onMarker'> & { f: RosterFighter; chip?: boolean }) {
  const [open, setOpen] = useState(false)
  const saving = busy === 'marker'
  return (
    <span className="drost__markpick">
      <button
        type="button"
        className={chip ? 'drost__chipbtn' : 'btn btn--ghost btn--sm'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {saving ? <span className="spinner" /> : <img className="drost__markicon" src={markerIcon(f.marker)} alt="" />}
        <span className="drost__marktext">Marker</span>
      </button>
      {open && (
        <>
          <button type="button" className="drost__scrim drost__scrim--clear" aria-label="Close" onClick={() => setOpen(false)} />
          <div className={`drost__pop drost__pop--marker${chip ? ' is-down' : ''}`} role="group" aria-label="Marker">
            {MARKERS.map((m) => (
              <button
                type="button"
                key={m || 'none'}
                className="markbtn"
                aria-pressed={f.marker === m}
                disabled={!canAct || saving || f.marker === m}
                title={m || 'No marker'}
                onClick={() => {
                  onMarker(f, m)
                  setOpen(false)
                }}
              >
                <img src={markerIcon(m)} alt={m || 'none'} />
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  )
}

/* What can be done to one fighter: under it on a desktop, at the sheet's foot on a phone. */
function Acts({
  f,
  fig,
  levels,
  canAct,
  busy,
  credits,
  gems,
  onPayOne,
  onLevelOne,
  onMode,
  onChecked,
  onCheck,
  onSelect,
  phone,
  roster,
  ...rest
}: DeskRosterProps & { f: RosterFighter; fig: Figures }) {
  const inSale = rest.checked.includes(f.fighter_id)
  const s = f.stats
  const level = levelUpOf(f, levels)
  /* Of the three sacrifice slots, how many the roster could fill today. */
  const ascend = canAscend(f, useLazyConfig('ascension'))
  const slots = coverableSlots(roster, f)
  return (
    <div className="drost__acts">
      <button
        type="button"
        className="btn btn--primary btn--sm"
        disabled={!canAct || fig.pay.cost <= 1 || !!busy}
        onClick={() => onPayOne(f)}
      >
        {busy === 'pay-one' && <span className="spinner" />}
        Payday <Credits value={fig.pay.cost} />
      </button>
      {/* At the maximum the banner says so; a button that cannot do anything is left out. */}
      {!level.atMax && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={!canAct || !level.ready || level.cost.credits > credits || level.cost.gems > gems || !!busy}
          onClick={() => onLevelOne(f)}
          title={level.ready ? 'Spend the banked experience' : 'Not enough experience yet'}
        >
          {busy === 'level-one' && <span className="spinner" />}
          Level up
          {level.cost.credits > 0 && <Credits value={level.cost.credits} />}
        </button>
      )}
      {ascend.ok ? (
        <Link
          className="btn btn--ghost btn--sm"
          to={`/ascension?fighter=${f.fighter_id}`}
          title={
            slots === SACRIFICE_COUNT
              ? 'All three sacrifice slots can be filled'
              : `${slots} of the ${SACRIFICE_COUNT} sacrifice slots can be filled from your fighters`
          }
        >
          Ascend
          <span className={`drost__count${slots < SACRIFICE_COUNT ? ' is-short' : ''}`}>
            {slots}/{SACRIFICE_COUNT}
          </span>
        </Link>
      ) : (
        <button type="button" className="btn btn--ghost btn--sm" disabled title={ascend.reason}>
          Ascend
        </button>
      )}
      {!phone && <MarkerPick {...rest} f={f} canAct={canAct} busy={busy} />}
      {rest.mode === 'market' ? (
        /* Listing: this puts the fighter in the listing or takes it out, and leaves the rest alone. */
        (() => {
          const gate = listable(f, rest.now)
          return (
            <button
              type="button"
              className={`btn btn--sm ${inSale ? 'btn--ghost' : 'btn--primary'}`}
              disabled={!gate.ok}
              title={gate.ok ? undefined : gate.reason}
              onClick={() => onCheck(f.fighter_id)}
            >
              {inSale ? 'Remove from listing' : 'Add to listing'}
            </button>
          )
        })()
      ) : rest.mode === 'sell' ? (
        /* Already selling: this puts the fighter in the sale or takes it out, and leaves the rest alone. */
        <button
          type="button"
          className={`btn btn--sm ${inSale ? 'btn--ghost' : 'btn--primary'}`}
          disabled={!sellable(f)}
          title={sellable(f) ? undefined : `${useLabel(f)} — cannot be sold`}
          onClick={() => onCheck(f.fighter_id)}
        >
          {inSale ? 'Remove from sale' : 'Add to sale'} <Credits value={s.credits ?? 0} />
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--danger btn--sm"
          disabled={!sellable(f)}
          title={sellable(f) ? 'Sell this fighter back to the game' : `${useLabel(f)} — cannot be sold`}
          onClick={() => {
            onMode('sell')
            onChecked([f.fighter_id])
            onSelect(f.fighter_id)
          }}
        >
          Sell <Credits value={s.credits ?? 0} />
        </button>
      )}
    </div>
  )
}

/* ---------- selling ---------- */

function Ticked({ f, onDrop, right }: { f: RosterFighter; onDrop: () => void; right: React.ReactNode }) {
  return (
    <div className="drost__ticked">
      <span className="drost__art drost__art--sm" style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}>
        <GameImg src={fighterAvatar(f)} alt="" fallback={fighterArtFallback()} />
      </span>
      <span className="drost__name">
        <b>
          {f.racename} {f.classname}
        </b>
        <small>Level {f.stats.level}</small>
      </span>
      {right}
      <button type="button" className="drost__drop" aria-label={`Untick ${f.classname}`} onClick={onDrop}>
        ✕
      </button>
    </div>
  )
}

/*
 * The sale or the listing in one bar, over the fighter on a desktop: what it
 * comes to, its button, and the full terms a click away — so the side fits
 * the screen and nothing in it scrolls.
 */
function BasketBar(p: DeskRosterProps & { onOpen: () => void }) {
  const n = p.checked.length
  const sell = p.mode === 'sell'
  const net = sellerPayout(p.startPrice, p.marketConfig)
  const s = n === 1 ? '' : 's'
  return (
    <div className={`drost__bbar${sell ? ' is-sell' : ''}`}>
      <span className="drost__bbartext">
        <b>{sell ? (n ? `Sell ${n} fighter${s}` : 'Sell to the game') : n ? `List ${n} on the market` : 'List on the market'}</b>
        <small>
          {sell ? (
            n ? (
              <>
                Permanent · you get <Credits value={p.sellValue} />
              </>
            ) : (
              'Tick fighters to sell them back for credits'
            )
          ) : (
            <>
              From {gemsOf(p.startPrice)} · {p.keepListed ? 'stays listed' : 'comes back'} if nobody bids · you get{' '}
              {gemsOf(net)} each
            </>
          )}{' '}
          <button type="button" className="linklike" onClick={p.onOpen}>
            {sell ? (n ? 'Show' : 'More') : 'Change'}
          </button>
        </small>
      </span>
      {sell ? (
        <button type="button" className="btn btn--danger" disabled={!p.canAct || n === 0 || !!p.busy} onClick={p.onSell}>
          {p.busy === 'sell' && <span className="spinner" />}
          Sell {n || ''}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--primary"
          disabled={!p.canAct || !p.listPlan.gate.ok || !!p.busy}
          onClick={p.onList}
          title={p.listPlan.gate.ok ? undefined : p.listPlan.gate.reason}
        >
          {p.busy === 'list' && <span className="spinner" />}
          List {n || ''} {p.listPlan.gems > 0 && <Gems value={p.listPlan.gems} />}
        </button>
      )}
    </div>
  )
}

function SellPanel(p: DeskRosterProps) {
  const ticked = p.roster.filter((f) => p.checked.includes(f.fighter_id))
  return (
    <div className="drost__basket">
      <h2 className="drost__baskettitle">
        {ticked.length ? `Sell ${ticked.length} fighter${ticked.length === 1 ? '' : 's'}` : 'Sell to the game'}
      </h2>
      {ticked.length === 0 ? (
        <p className="drost__note">
          Tick the fighters to sell back to the game for credits. Fighters defending an arena or listed on the market
          can't be sold until they are free.
        </p>
      ) : (
        <>
          <div className="drost__tickedlist">
            {ticked.map((f) => (
              <Ticked key={f.fighter_id} f={f} onDrop={() => p.onCheck(f.fighter_id)} right={<Credits value={f.stats.credits ?? 0} />} />
            ))}
          </div>
          <div className="drost__total">
            <small>You get</small>
            <Credits value={p.sellValue} />
          </div>
          <p className="drost__warn">Selling is permanent: a sold fighter can't be bought back.</p>
        </>
      )}
      <button
        type="button"
        className="btn btn--danger drost__go"
        disabled={!p.canAct || ticked.length === 0 || !!p.busy}
        onClick={p.onSell}
      >
        {p.busy === 'sell' && <span className="spinner" />}
        Sell {ticked.length || ''} {ticked.length > 0 && <Credits value={p.sellValue} />}
      </button>
    </div>
  )
}

function ListPanel(p: DeskRosterProps) {
  const ticked = p.roster.filter((f) => p.checked.includes(f.fighter_id))
  const each = Number(p.marketConfig?.gems_listing_price ?? 0)
  const fee = processingFee(p.startPrice, p.marketConfig)
  const net = sellerPayout(p.startPrice, p.marketConfig)
  const hours = Math.round(Number(p.marketConfig?.standard_duration_minutes ?? 0) / 60)
  return (
    <div className="drost__basket">
      <h2 className="drost__baskettitle">
        {ticked.length ? `List ${ticked.length} on the market` : 'List on the market'}
      </h2>
      {ticked.length === 0 ? (
        <p className="drost__note">
          Tick up to {MAX_BULK_LISTINGS} ready fighters to put up for auction. Busy fighters, and any whose payday is
          due, can't be listed.
        </p>
      ) : (
        <div className="drost__tickedlist">
          {ticked.map((f) => (
            <Ticked
              key={f.fighter_id}
              f={f}
              onDrop={() => p.onCheck(f.fighter_id)}
              right={<AgeChip bonus={ageBonus(f, p.ageDecay, p.now)} />}
            />
          ))}
        </div>
      )}

      <div className="drost__field">
        <span>
          <b>Start at</b>
          <small>Each fighter's first bid. The market's minimum is {p.minStart} gems.</small>
        </span>
        <span className="drost__stepper">
          <button type="button" aria-label="Lower" onClick={() => p.onStartPrice(Math.max(p.minStart, p.startPrice - 1))}>
            −
          </button>
          <input
            className="mono"
            type="number"
            min={p.minStart}
            step={1}
            value={p.startPrice}
            aria-label="Starting bid in gems"
            onChange={(e) => p.onStartPrice(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
          <button type="button" aria-label="Raise" onClick={() => p.onStartPrice(p.startPrice + 1)}>
            +
          </button>
        </span>
      </div>
      <label className="drost__field drost__field--check">
        <span>
          <b>Keep listed if nobody bids</b>
          <small>It stays up as a fixed-price instant buy at your starting price instead of coming back to you.</small>
        </span>
        <input type="checkbox" className="drost__switch" checked={p.keepListed} onChange={(e) => p.onKeepListed(e.target.checked)} />
      </label>

      <div className="drost__math">
        <span>
          Listing fee · {each} gem{each === 1 ? '' : 's'} × {ticked.length}
          <b>{gemsOf(p.listPlan.gems)} now</b>
        </span>
        <span>
          Each sells for at least<b>{gemsOf(p.startPrice)}</b>
        </span>
        <span>
          Market fee on a sale · {Number(p.marketConfig?.gems_processing_fee_percent ?? 0)}%<b>−{gemsOf(fee)}</b>
        </span>
        <span className="is-sum">
          You'd get, per fighter, at the start price<b>{gemsOf(net)}</b>
        </span>
      </div>

      <button
        type="button"
        className="btn btn--primary drost__go"
        disabled={!p.canAct || !p.listPlan.gate.ok || !!p.busy}
        onClick={p.onList}
        title={p.listPlan.gate.ok ? undefined : p.listPlan.gate.reason}
      >
        {p.busy === 'list' && <span className="spinner" />}
        List {ticked.length || ''} {p.listPlan.gems > 0 && <Gems value={p.listPlan.gems} />}
      </button>
      <p className="drost__note">
        Auctions run {hours} hours, and a bid near the end pushes the end back. Listed fighters can't fight, and the
        listing fee is spent whether or not they sell.
      </p>
    </div>
  )
}

/* ---------- the filter, the sort and what is set ---------- */

function StatusSeg({
  filter,
  counts,
  onStatus,
  chips = false,
  short = false,
}: {
  filter: RosterFilter
  counts: Record<Status, number>
  onStatus: (s: Status) => void
  chips?: boolean
  /** "Payday" for "Requests payday", where the command bar has the room of one word. */
  short?: boolean
}) {
  return (
    <span className={`drost__seg${chips ? ' drost__seg--chips' : ''}`} role="group" aria-label="Availability">
      {STATUSES.map((s) => (
        <button type="button" key={s} aria-pressed={filter.status === s} onClick={() => onStatus(s)}>
          {short && s === 'Requests Payday' ? 'Payday' : STATUS_LABEL[s]}
          <small>{counts[s] ?? 0}</small>
        </button>
      ))}
    </span>
  )
}

function DirSeg({ filter, onAsc }: { filter: RosterFilter; onAsc: (asc: boolean) => void }) {
  return (
    <span className="drost__seg drost__seg--sm" role="group" aria-label="Direction">
      <button type="button" aria-pressed={!filter.sortAsc} onClick={() => onAsc(false)}>
        Biggest first
      </button>
      <button type="button" aria-pressed={!!filter.sortAsc} onClick={() => onAsc(true)}>
        Smallest first
      </button>
    </span>
  )
}

function SortList({ filter, onPick }: { filter: RosterFilter; onPick: (sort: string) => void }) {
  return (
    <div className="drost__sorts">
      {SORT_GROUPS.map(([group, options]) => (
        <div key={group}>
          <span className="drost__sorthead">{group}</span>
          {options.map((o) => (
            <button type="button" key={o.value} aria-pressed={filter.sort === o.value} onClick={() => onPick(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function FilterPanel(p: DeskRosterProps & { matching: number; onClose: () => void }) {
  return (
    <div className="drost__pop drost__pop--filters" role="dialog" aria-label="Filters">
      <FilterFields {...p} />
      <div className="drost__pfoot">
        <button
          type="button"
          className="linklike"
          onClick={() => p.onFilter({ ...EMPTY_FILTER, status: p.filter.status, sort: p.filter.sort, sortAsc: p.filter.sortAsc })}
        >
          Clear all
        </button>
        <span className="drost__note">Health and damage rules grade after age, like the arrows.</span>
        <span className="drost__sp" />
        <button type="button" className="btn btn--primary" onClick={p.onClose}>
          Show {p.matching} fighter{p.matching === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  )
}

/* Only the markers this roster carries, with how many carry each — one never pinned can never match. */
function useMarkerCounts(roster: RosterFighter[]) {
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of roster) if (f.marker) counts.set(f.marker, (counts.get(f.marker) ?? 0) + 1)
    return counts
  }, [roster])
}

/* The marker filter as a switch over the rows: each marker in or out, as in the filter, without its count. */
function MarkerSeg({ roster, filter, onFilter }: Pick<DeskRosterProps, 'roster' | 'filter' | 'onFilter'>) {
  const used = useMarkerCounts(roster)
  if (used.size === 0) return null
  return (
    <span className="drost__seg drost__seg--sm drost__markseg" role="group" aria-label="Marker">
      {MARKERS.filter((m) => m && used.has(m)).map((m) => {
        const on = filter.markers.includes(m)
        return (
          <button
            type="button"
            key={m}
            aria-pressed={on}
            onClick={() =>
              onFilter({ ...filter, markers: on ? filter.markers.filter((x) => x !== m) : [...filter.markers, m] })
            }
            title={m}
          >
            <img src={markerIcon(m)} alt={m} />
          </button>
        )
      })}
    </span>
  )
}

/* Element, class, race, ability, markers, the roster switches and the quality floors. */
function FilterFields(p: DeskRosterProps) {
  const { races } = useMemo(() => facetsOf(p.roster), [p.roster])
  const set = (patch: Partial<RosterFilter>) => p.onFilter({ ...p.filter, ...patch })
  const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  const used = useMarkerCounts(p.roster)

  return (
    <>
      <div className="drost__fcol">
        <div>
          <span className="drost__fhead">Element</span>
          <div className="filters__elements" role="group" aria-label="Element">
            {ELEMENTS.map((el) => (
              <button
                type="button"
                key={el}
                className="elembtn"
                aria-pressed={p.filter.elements.includes(el)}
                onClick={() => set({ elements: toggle(p.filter.elements, el as Element) })}
                title={el}
              >
                <img src={elementIcon(el)} alt={el} />
              </button>
            ))}
          </div>
        </div>
        <div className="drost__two">
          <label className="field">
            <span className="drost__fhead">Class</span>
            <select className="input" value={p.filter.classname} onChange={(e) => set({ classname: e.target.value })}>
              <option value="">Any</option>
              {[...p.templates.keys()].sort().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="drost__fhead">Race</span>
            <select className="input" value={p.filter.racename} onChange={(e) => set({ racename: e.target.value })}>
              <option value="">Any</option>
              {races.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="drost__fhead">Ability</span>
          <input
            className="input"
            placeholder="Search ability names"
            value={p.filter.ability}
            onChange={(e) => set({ ability: e.target.value })}
          />
        </label>
      </div>

      <div className="drost__fcol">
        {used.size > 0 && (
          <div>
            <span className="drost__fhead">Marker</span>
            <div className="filters__markers" role="group" aria-label="Marker">
              {MARKERS.filter((m) => m && used.has(m)).map((m) => (
                <button
                  type="button"
                  key={m}
                  className="markbtn"
                  aria-pressed={p.filter.markers.includes(m)}
                  onClick={() => set({ markers: toggle(p.filter.markers, m) })}
                  title={`${m} (${used.get(m)})`}
                >
                  <img src={markerIcon(m)} alt={m} />
                  <span className="markbtn__count">{used.get(m)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          {/* Each role is read against the fighter's own class, as the Combat view says. */}
          <span className="drost__fhead">Role · within its class</span>
          <div className="filters__roles" role="group" aria-label="Role">
            {ROLE_LIST.map((r) => (
              <button
                type="button"
                key={r.key}
                className={`rolebtn is-${r.key}`}
                aria-pressed={(p.filter.roles ?? []).includes(r.key)}
                onClick={() => set({ roles: toggle(p.filter.roles ?? [], r.key) })}
                title={`${r.line}, for its class`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="drost__fhead">Roster</span>
          <label className="drost__sw">
            <span>
              Ready to level
              <small>Experience banked for a level · {p.readyToLevel} now</small>
            </span>
            <input
              type="checkbox"
              className="drost__switch"
              checked={p.filter.levelReady}
              onChange={(e) => set({ levelReady: e.target.checked })}
            />
          </label>
          <label className="drost__sw">
            <span>
              Compare at level 1
              <small>Every fighter's stats as if level 1, to compare rolls</small>
            </span>
            <input
              type="checkbox"
              className="drost__switch"
              checked={p.atLevelOne}
              onChange={(e) => p.onAtLevelOne(e.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="drost__fcol">
        <span className="drost__fhead">At least · quality floors</span>
        <QualityFilters filter={p.filter} onChange={p.onFilter} />
      </div>
    </>
  )
}

function ActiveChips(p: DeskRosterProps) {
  const f = p.filter
  const set = (patch: Partial<RosterFilter>) => p.onFilter({ ...f, ...patch })
  const label = (field: string) => FILTER_STATS.find((s) => s.field === field)?.label ?? field
  const chips: { key: string; body: React.ReactNode; drop: () => void }[] = []
  if (p.phone && f.status !== 'All') chips.push({ key: 'status', body: STATUS_LABEL[f.status], drop: () => set({ status: 'All' }) })
  for (const el of f.elements)
    chips.push({
      key: `el-${el}`,
      body: (
        <>
          <img src={elementIcon(el)} alt="" />
          {cap(el)}
        </>
      ),
      drop: () => set({ elements: f.elements.filter((x) => x !== el) }),
    })
  for (const m of f.markers)
    chips.push({
      key: `mk-${m}`,
      body: (
        <>
          <img src={markerIcon(m)} alt="" />
          Marker
        </>
      ),
      drop: () => set({ markers: f.markers.filter((x) => x !== m) }),
    })
  for (const r of f.roles ?? [])
    chips.push({
      key: `role-${r}`,
      body: ROLE_LIST.find((x) => x.key === r)?.name ?? r,
      drop: () => set({ roles: (f.roles ?? []).filter((x) => x !== r) }),
    })
  if (f.classname) chips.push({ key: 'class', body: cap(f.classname), drop: () => set({ classname: '' }) })
  if (f.racename) chips.push({ key: 'race', body: cap(f.racename), drop: () => set({ racename: '' }) })
  if (f.ability) chips.push({ key: 'ability', body: `Ability “${f.ability}”`, drop: () => set({ ability: '' }) })
  if (f.levelReady) chips.push({ key: 'level', body: 'Ready to level', drop: () => set({ levelReady: false }) })
  for (const r of f.qualities ?? [])
    chips.push({
      key: `q-${r.stat}`,
      body:
        typeof r.min === 'number' ? (
          `${label(r.stat)} ≥ ${r.stat === 'age' ? `+${r.min}%` : r.min}`
        ) : (
          <>
            {label(r.stat)} ≥ <img src={GRADE_ICON[r.min]} alt={GRADE_LABEL[r.min]} />
          </>
        ),
      drop: () => set({ qualities: (f.qualities ?? []).filter((x) => x.stat !== r.stat) }),
    })
  if (p.atLevelOne) chips.push({ key: 'lvl1', body: 'Compared at level 1', drop: () => p.onAtLevelOne(false) })
  if (chips.length === 0) return null
  return (
    <div className="drost__chipsline">
      {chips.map((c) => (
        <span className="drost__chip" key={c.key}>
          {c.body}
          <button type="button" aria-label="Remove" onClick={c.drop}>
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        className="linklike"
        onClick={() => {
          p.onFilter({ ...EMPTY_FILTER, status: p.phone ? 'All' : f.status, sort: f.sort, sortAsc: f.sortAsc })
          p.onAtLevelOne(false)
        }}
      >
        Clear all
      </button>
    </div>
  )
}
