import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Player } from '@/chain/types'
import { fetchOwnedLands } from '@/chain/atomic'
import {
  bagPower,
  claimPays,
  powerScore,
  CURRENCY_ICON,
  CURRENCY_LABEL,
  CURRENCY_PRECISION,
  type Currency,
} from '@/account/rules'
import {
  batchableMines,
  mineQueue,
  poolAmount,
  poolPayout,
  MINE_POWER,
  type PoolEntry,
} from '@/pools/rules'
import { byQuality } from '@/dungeon/nftFighter'
import { useChainQuery } from '@/chain/useChainQuery'
import { GameImg } from '@/components/GameImg'
import { formatDecimals, formatNumber, formatStat } from '@/format'
import { asset } from '@/assets'
import { ABILITY_RARITY_COLOR, GRADE_ICON, type StatGrade } from '@/tavern/fighterStats'
import { MAX_TOOLS, paymentSources } from './rules'
import { SourceRows } from './SourceRows'
import { useMiningTools } from './useMiningTools'
import {
  EARNED_STAT,
  PoolFacts,
  Power,
  Ring,
  TABS,
  earnLink,
  earned,
  poolIcon,
  unclaimed,
  type PhoneCurrencyData,
  type RewardsTab,
} from './PhoneRewards'

/**
 * Rewards on a desktop: the pools as the stage.
 *
 * The phone's Rewards, given room. On a currency, the pools are large rings
 * across the page and the one picked is open beside them — what it holds,
 * what a mine pays, how far along it is — so nothing hides in a sheet. Every
 * ready mine is one gold bar under the rings, and the payments are rows by
 * where they came from. On Mining, the three slots lead and every tool shows
 * what it would add to the one being filled; the landowner split sits under
 * them. Nothing on Mining opens a sheet.
 */
export function DeskRewards({
  tab,
  onTab,
  player,
  account,
  busy,
  canAct,
  onSaveTools,
  onShare,
  currency,
  mineReady,
}: {
  tab: RewardsTab
  onTab: (tab: RewardsTab) => void
  player: Player
  account: string
  busy: string | null
  canAct: boolean
  onSaveTools: (ids: string[]) => void
  onShare: (share: number) => void
  currency: PhoneCurrencyData | null
  mineReady: Partial<Record<Currency, boolean>>
}) {
  const hasNews = (key: Currency) =>
    !!mineReady[key] || (claimPays(key) && unclaimed(player, key) > 0)
  return (
    <div className="drew">
      {/* The shop's tabs, as on every desktop screen. */}
      <div className="tabs drew__tabs" role="tablist" aria-label="Rewards">
        {TABS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="tabs__tab"
            onClick={() => onTab(key)}
          >
            {label}
            {key !== 'mining' && hasNews(key) && (
              <span
                className="prew__tabdot"
                aria-label={mineReady[key] ? 'Ready to mine' : 'Something to claim'}
              />
            )}
          </button>
        ))}
      </div>

      {tab === 'mining' ? (
        <DeskMining
          player={player}
          account={account}
          busy={busy}
          canAct={canAct}
          onSave={onSaveTools}
          onShare={onShare}
        />
      ) : (
        currency && <DeskCurrency player={player} busy={busy} canAct={canAct} data={currency} />
      )}
    </div>
  )
}

/* ---------- mining ---------- */

type ToolFilter = 'yours' | 'all'
type GainSort = 'combined' | 'tlm_mp' | 'shrd_mp'
const GAIN_SORTS: [GainSort, string][] = [
  ['combined', 'Biggest gain'],
  ['tlm_mp', 'TLM'],
  ['shrd_mp', 'Shards'],
]
/* The strongest tools are the ones worth a look; the rest are one click away. */
const CATALOGUE_FIRST = 24
const SHARE_PRESETS: [number, string][] = [
  [100, 'All TLM'],
  [50, '50 / 50'],
  [0, 'All Shards'],
]

/**
 * Mining on a desktop: pick a slot, see the gain.
 *
 * The three slots lead. One of them is always the slot being filled — the
 * first empty one, else the weakest, unless the player clicks another — and
 * every tool below says what it would add or take away against it. Tools the
 * wallet holds equip straight into that slot; the rest link to the NFT
 * Market. Changes wait in the slots until one Save signs them, and the
 * landowner split sits on the page under them.
 */
function DeskMining({
  player,
  account,
  busy,
  canAct,
  onSave,
  onShare,
}: {
  player: Player
  account: string
  busy: string | null
  canAct: boolean
  onSave: (ids: string[]) => void
  onShare: (share: number) => void
}) {
  const { tools, templates, loading, powerOf } = useMiningTools(account)
  const [filter, setFilter] = useState<ToolFilter>('yours')
  const [sort, setSort] = useState<GainSort>('combined')
  const [query, setQuery] = useState('')
  const [everything, setEverything] = useState(false)

  const byId = useMemo(() => new Map(tools.map((t) => [t.asset_id, t])), [tools])
  const stored = useMemo(() => (player.mine_nfts ?? []).map(String), [player.mine_nfts])
  /*
     What is saved, less anything the wallet no longer holds: `setminenfts`
     aborts on an id it cannot find, so a tool that left the wallet is dropped
     here and said out loud under the slots.
  */
  const saved = useMemo(
    () => [...new Set(stored)].filter((id) => byId.has(id)).slice(0, MAX_TOOLS),
    [stored, byId],
  )
  const missing = loading ? [] : stored.filter((id) => !byId.has(id))
  const [draft, setDraft] = useState<string[] | null>(null)
  /* A save that lands changes what is stored; the draft it came from is done. */
  const storedKey = stored.join(',')
  useEffect(() => setDraft(null), [storedKey])
  const picked = draft ?? saved
  const changed =
    picked.length !== stored.length || picked.some((id) => !stored.includes(id))

  const powerOfId = (id: string) => {
    const t = byId.get(id)
    return t ? powerOf(t.template_id) : undefined
  }
  const now = bagPower(picked.map((id) => powerOfId(id) ?? {}))
  const before = bagPower(saved.map((id) => powerOfId(id) ?? {}))

  /* The slot a tool goes into: the one clicked, else the first empty, else the weakest. */
  const [slotPick, setSlotPick] = useState<number | null>(null)
  const weakest = picked.reduce((w, id, i) => {
    const a = powerOfId(picked[w])
    const b = powerOfId(id)
    const sa = powerScore('combined', a)
    const sb = powerScore('combined', b)
    return sb < sa || (sb === sa && Number(b?.tlm_mp ?? 0) < Number(a?.tlm_mp ?? 0)) ? i : w
  }, 0)
  const target =
    slotPick !== null && slotPick <= picked.length
      ? slotPick
      : picked.length < MAX_TOOLS
        ? picked.length
        : weakest
  const targetTool = byId.get(picked[target])
  const targetPower = targetTool ? powerOf(targetTool.template_id) : undefined

  const held = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const t of tools) map.set(t.template_id, [...(map.get(t.template_id) ?? []), t.asset_id])
    return map
  }, [tools])

  const equip = (templateId: number) => {
    const spare = (held.get(templateId) ?? []).find((id) => !picked.includes(id))
    if (!spare) return
    setDraft(
      target >= picked.length ? [...picked, spare] : picked.map((x, i) => (i === target ? spare : x)),
    )
    setSlotPick(null)
  }
  const takeOff = (index: number) => {
    setDraft(picked.filter((_, i) => i !== index))
    setSlotPick(null)
  }

  const catalogue = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return templates
      .filter((t) => filter === 'all' || held.has(t.template_id))
      .filter(
        (t) =>
          !needle ||
          t.toolname.toLowerCase().includes(needle) ||
          t.rarity.toLowerCase().includes(needle) ||
          t.shine.toLowerCase().includes(needle),
      )
      .sort((a, b) => powerScore(sort, b) - powerScore(sort, a) || byQuality(a, b))
  }, [templates, filter, query, sort, held])
  const shown = everything ? catalogue : catalogue.slice(0, CATALOGUE_FIRST)

  const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + formatNumber(Math.abs(n))
  const targetTemplate = targetTool ? templates.find((t) => t.template_id === targetTool.template_id) : undefined
  /*
     A tool against the one in the slot, once a currency: the change, and the
     fighter cards' grade chevrons for how big it is — two chevrons from a
     ±40% swing, gold from +50%. Against an empty slot every tool only adds.
  */
  const vs = (d: number, base: number) => {
    const p = base > 0 ? d / base : d > 0 ? 1 : 0
    const g: StatGrade =
      p >= 0.5 ? 'gold-up' : p >= 0.15 ? 'green-duble-up' : p > 0 ? 'green-up' : p === 0 ? 'middle' : p > -0.4 ? 'red-down' : 'red-duble-down'
    return (
      <span className={`drew__vs${d > 0 ? ' is-up' : d < 0 ? ' is-down' : ''}`}>
        <img src={GRADE_ICON[g]} alt="" />
        {signed(d)}
      </span>
    )
  }
  const power = (cur: 'tlm' | 'shrds', n: number) => (
    <span className="drew__pw">
      <img src={CURRENCY_ICON[cur]} alt={cur === 'tlm' ? 'TLM' : 'Shards'} />
      {formatNumber(n)}
    </span>
  )
  const toolCell = (templateId: number, name: string, rarity?: string, shine?: string) => (
    <span className="drew__who">
      <GameImg
        src={asset(`/assets/cards/${templateId}.webp`)}
        alt=""
        loading="lazy"
        fallback={asset('/assets/default-card.png')}
      />
      <span>
        <b>{name}</b>
        {rarity && (
          <small style={{ '--r': ABILITY_RARITY_COLOR[rarity.toLowerCase()] ?? '#939393' } as React.CSSProperties}>
            {rarity} · {shine}
          </small>
        )}
      </span>
    </span>
  )
  const delta = (n: number) =>
    n === 0 ? null : <em className={n > 0 ? 'up' : 'down'}>{signed(n)}</em>

  return (
    <div className="drew__mining">
      <section className="drew__bag" aria-label="Your mining power">
        <span className="drew__bagpower">
          <small>{changed ? 'If you save' : 'Your mining power'}</small>
          {loading ? (
            <span className="prew__power prew__power--big">—</span>
          ) : (
            <Power tlm={now.tlm_mp} shrd={now.shrd_mp} big />
          )}
          <small className="drew__bagnote">
            {loading ? 'Loading your tools…' : 'Click a slot to fill or swap it'}
          </small>
        </span>
        <div className="drew__slots">
          {Array.from({ length: MAX_TOOLS }, (_, i) => {
            if (loading) return <span className="drew__slot is-loading" key={i} />
            const t = byId.get(picked[i])
            const p = t && powerOf(t.template_id)
            const on = i === target
            const fresh = t && !saved.includes(t.asset_id)
            return t ? (
              <div
                className={`drew__slot${on ? ' is-target' : ''}${fresh ? ' is-new' : ''}`}
                key={t.asset_id}
              >
                <button
                  type="button"
                  className="drew__slotpick"
                  aria-pressed={on}
                  onClick={() => setSlotPick(i)}
                >
                  <GameImg
                    src={asset(`/assets/cards/${t.template_id}.webp`)}
                    alt=""
                    fallback={asset('/assets/default-card.png')}
                  />
                  <span>{t.name}</span>
                  <small>
                    {formatNumber(Number(p?.tlm_mp ?? 0))} · {formatNumber(Number(p?.shrd_mp ?? 0))}
                  </small>
                </button>
                <button
                  type="button"
                  className="drew__slotoff"
                  aria-label={`Take off ${t.name}`}
                  onClick={() => takeOff(i)}
                >
                  ×
                </button>
                {on && <em className="drew__slottag">Replacing</em>}
              </div>
            ) : (
              <button
                type="button"
                className={`drew__slot is-empty${on ? ' is-target' : ''}`}
                key={`empty-${i}`}
                aria-pressed={on}
                onClick={() => setSlotPick(picked.length)}
              >
                <i>+</i>
                <span>Empty</span>
                {on && <em className="drew__slottag">Filling</em>}
              </button>
            )
          })}
        </div>
        <div className="drew__save">
          {changed && !loading ? (
            <>
              <span className="toolsheet__delta">
                {delta(now.tlm_mp - before.tlm_mp)}
                {delta(now.shrd_mp - before.shrd_mp)}
              </span>
              {draft && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setDraft(null)
                    setSlotPick(null)
                  }}
                >
                  Undo
                </button>
              )}
            </>
          ) : (
            <small>{loading ? '' : 'No change yet'}</small>
          )}
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAct || busy !== null || loading || !changed}
            onClick={() => onSave(picked)}
          >
            {busy === 'mining' && <span className="spinner" />}
            Save tools
          </button>
        </div>
        {missing.length > 0 && (
          <p className="rsheet__hint rsheet__hint--error drew__missing">
            {missing.length === 1 ? 'One equipped tool is' : `${missing.length} equipped tools are`}{' '}
            no longer in this wallet. Saving takes {missing.length === 1 ? 'it' : 'them'} off on chain
            too.
          </p>
        )}
      </section>

      <LandCut player={player} busy={busy} canAct={canAct} onShare={onShare} />

      <div className="drew__cathead">
        <h2 className="drew__cap">
          {loading
            ? 'Tools'
            : targetTool
              ? `Slot ${target + 1} · gain over ${targetTool.name}`
              : `Slot ${target + 1} · what each tool adds`}
        </h2>
        <div className="drew__catcontrols">
          <div className="drew__seg" role="tablist" aria-label="Which tools">
            {(
              [
                ['yours', `Yours · ${formatNumber(held.size)}`],
                ['all', `Every tool · ${formatNumber(templates.length)}`],
              ] as [ToolFilter, string][]
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="input drew__search"
            placeholder="Search tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="alltools__chips drew__sorts">
            {GAIN_SORTS.map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={sort === key ? 'is-on' : ''}
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="rsheet__hint">Loading your tools…</p>
      ) : catalogue.length === 0 ? (
        <p className="rsheet__hint">
          {query.trim()
            ? 'No tool matches that.'
            : 'No Alien Worlds tools in this wallet yet. Every tool in the game is under Every tool.'}
        </p>
      ) : (
        /*
           A table, the slot's own tool pinned on top: each tool's power, and
           against the one in the slot once for TLM and once for Shards — a
           grid of cards with two red numbers each said nothing at a glance.
        */
        <table className="drew__table">
          <thead>
            <tr>
              <th>Tool</th>
              <th className="is-num">TLM power</th>
              <th className="is-num">vs current</th>
              <th className="is-num">Shard power</th>
              <th className="is-num">vs current</th>
              <th className="is-end" />
            </tr>
          </thead>
          <tbody>
            {targetTool && (
              <tr className="is-current">
                <td>{toolCell(targetTool.template_id, targetTool.name, targetTemplate?.rarity, targetTemplate?.shine)}</td>
                <td className="is-num">{power('tlm', Number(targetPower?.tlm_mp ?? 0))}</td>
                <td className="is-num" />
                <td className="is-num">{power('shrds', Number(targetPower?.shrd_mp ?? 0))}</td>
                <td className="is-num" />
                <td className="is-end">
                  <em>In slot {target + 1}</em>
                </td>
              </tr>
            )}
            {shown
              .filter((t) => targetTool?.template_id !== t.template_id)
              .map((t) => {
                const ids = held.get(t.template_id) ?? []
                const spare = ids.filter((id) => !picked.includes(id)).length
                const baseT = Number(targetPower?.tlm_mp ?? 0)
                const baseS = Number(targetPower?.shrd_mp ?? 0)
                const dt = t.tlm_mp - baseT
                const ds = t.shrd_mp - baseS
                return (
                  <tr key={t.template_id} className={spare > 0 ? 'is-yours' : undefined}>
                    <td>{toolCell(t.template_id, t.toolname, t.rarity, t.shine)}</td>
                    <td className="is-num">{power('tlm', t.tlm_mp)}</td>
                    <td className="is-num">{vs(dt, baseT)}</td>
                    <td className="is-num">{power('shrds', t.shrd_mp)}</td>
                    <td className="is-num">{vs(ds, baseS)}</td>
                    <td className="is-end">
                      {spare > 0 ? (
                        <span className="drew__act">
                          <small>{formatNumber(spare)} spare</small>
                          <button
                            type="button"
                            className={`btn btn--sm ${dt + ds > 0 ? 'btn--primary' : 'btn--ghost'}`}
                            disabled={busy !== null}
                            onClick={() => equip(t.template_id)}
                          >
                            Equip
                          </button>
                        </span>
                      ) : ids.length > 0 ? (
                        <small>{ids.length === 1 ? 'Equipped' : `All ${formatNumber(ids.length)} equipped`}</small>
                      ) : (
                        <span className="drew__act">
                          <small>Not owned</small>
                          <Link to="/shop?c=market">NFT Market ›</Link>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      )}
      {!loading && catalogue.length > CATALOGUE_FIRST && (
        <button type="button" className="btn btn--ghost drew__more" onClick={() => setEverything((v) => !v)}>
          {everything ? 'Show the strongest only' : `Show all ${formatNumber(catalogue.length)}`}
        </button>
      )}
    </div>
  )
}

/**
 * Landowner rewards, on the page: the split bar, which is also the slider,
 * three presets and a Save. When a player gains reward power or recruits a fighter on someone's
 * land, the landowner gets rewards too; `pools.cpp` reads the owner's
 * `landowner_tlm_share` to decide how much of that is TLM and how much
 * Shards. Without land it stays dimmed with a way to get some.
 */
function LandCut({
  player,
  busy,
  canAct,
  onShare,
}: {
  player: Player
  busy: string | null
  canAct: boolean
  onShare: (share: number) => void
}) {
  const lands = useChainQuery(player.wallet && `owned-lands:${player.wallet}`, () =>
    fetchOwnedLands(player.wallet),
  )
  const count = lands.data?.length ?? 0
  const owns = count > 0
  const stored = Number(player.landowner_tlm_share ?? 0)
  const [share, setShare] = useState(stored)
  useEffect(() => setShare(stored), [stored])
  const off = !owns || !canAct || busy !== null

  return (
    <section className={`drew__land${owns ? '' : ' is-off'}`} aria-label="Landowner rewards">
      <span className="drew__landtext">
        <b>Landowner rewards</b>
        <small>
          {lands.data === undefined
            ? 'Checking your land…'
            : owns
              ? `When players gain reward power or recruit a fighter on your ${count === 1 ? 'land' : `${formatNumber(count)} lands`}, you get rewards too`
              : 'Landowners get rewards too when players gain reward power or recruit a fighter on their land'}
        </small>
      </span>
      <span className="drew__landbar">
        {/* The bar is the slider: its handle sits where TLM ends and Shards begin. */}
        <span className="drew__split">
          <span className="splitbar">
            <span className="splitbar__tlm" style={{ width: `${share}%` }} />
            <span className="splitbar__shards" style={{ width: `${100 - share}%` }} />
          </span>
          <input
            type="range"
            className="drew__splitrange"
            min={0}
            max={100}
            step={1}
            value={share}
            aria-label="Share paid as TLM"
            onChange={(e) => setShare(Number(e.target.value))}
            disabled={off}
          />
        </span>
        <span className="splitlabels">
          <span>
            <img src={CURRENCY_ICON.tlm} alt="" width={14} height={14} />
            {share}% TLM
          </span>
          <span>
            {100 - share}% Shards
            <img src={CURRENCY_ICON.shrds} alt="" width={14} height={14} />
          </span>
        </span>
      </span>
      <span className="landsheet__presets drew__landpresets">
        {SHARE_PRESETS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={share === value ? 'is-on' : ''}
            aria-pressed={share === value}
            onClick={() => setShare(value)}
            disabled={off}
          >
            {label}
          </button>
        ))}
      </span>
      {owns ? (
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={off || share === stored}
          onClick={() => onShare(share)}
        >
          {busy === 'share' && <span className="spinner" />}
          Save
        </button>
      ) : (
        <Link className="drew__landlink" to="/lands">
          Go to My Lands ›
        </Link>
      )}
    </section>
  )
}

/* ---------- a currency ---------- */

function DeskCurrency({
  player,
  busy,
  canAct,
  data,
}: {
  player: Player
  busy: string | null
  canAct: boolean
  data: PhoneCurrencyData
}) {
  const { currency, log, capacity, board, trial, minedPool, onMine, onMineAll, onClaim, onUnlock } =
    data
  const places = CURRENCY_PRECISION[currency]
  const symbol = CURRENCY_LABEL[currency]
  const pending = unclaimed(player, currency)
  const pays = claimPays(currency)
  const [picked, setPicked] = useState<string | null>(null)
  /* The pool open beside the rings: the one clicked, else the first ready, else the first. */
  const pool =
    board.find((e) => e.pool === picked) ?? board.find((e) => e.ready) ?? board[0] ?? null

  const short = (value: number) => formatDecimals(value, currency === 'tlm' ? 2 : 1)
  const heroAmount = (value: number) => {
    const p = Math.min(2, currency === 'wax' ? 1 : places)
    return formatDecimals(Math.trunc(value * 10 ** p) / 10 ** p, p)
  }

  const queue = useMemo(() => mineQueue(board), [board])
  const ready = queue.claims.length > 0
  const later = queue.banked - queue.claims.length
  const next = board.filter((e) => !e.anyAmount).sort((a, b) => b.progress - a.progress)[0]
  const nextLink = next ? earnLink(next.pool) : null

  const rows = log ?? []
  const total = rows.reduce((sum, r) => sum + Number(String(r.reward).split(' ')[0] || 0), 0)
  const sources = useMemo(() => paymentSources(rows, CURRENCY_ICON[currency]), [rows, currency])
  const earnedSoFar = formatStat(EARNED_STAT[currency], earned(player, currency))

  return (
    <div className="drew__stage">
      <div className="drew__main">
        {board.length > 0 ? (
          <>
            <div className="drew__rings">
              {board.map((entry) => (
                <Ring
                  key={entry.pool}
                  entry={entry}
                  symbol={symbol}
                  selected={pool?.pool === entry.pool}
                  onOpen={() => setPicked(entry.pool)}
                />
              ))}
            </div>

            {/* Every ready mine in one signature, as the phone's Mine card offers it. */}
            {ready ? (
              <div className="drew__minebar">
                <img src={CURRENCY_ICON[currency]} alt="" />
                <span className="drew__minetext">
                  <b>
                    {formatNumber(queue.claims.length)} mine{queue.claims.length === 1 ? '' : 's'} ready
                    · ~{poolAmount(queue.total, places)} {symbol}
                  </b>
                  <small>
                    {queue.byPool
                      .map((q) => `${q.entry.label} ×${q.times} ~${poolAmount(q.estimate, places)}`)
                      .join(' · ')}
                    {later > 0 && ` · ${formatNumber(later)} more after this`}
                  </small>
                </span>
                <button
                  type="button"
                  className="btn btn--gold"
                  disabled={!canAct || busy !== null}
                  onClick={() =>
                    onMineAll(queue.claims, queue.byPool.map((q) => q.entry.label).join(' · '))
                  }
                >
                  {busy === 'mine' && <span className="spinner" />}
                  Mine {queue.claims.length} · ~{poolAmount(queue.total, places)} {symbol}
                </button>
              </div>
            ) : next ? (
              <div className="drew__minebar is-waiting">
                <img src={poolIcon(next.pool, currency)} alt="" />
                <span className="drew__minetext">
                  <b>
                    Next mine: {next.label} · {Math.floor(next.progress * 100)}%
                  </b>
                  <small>{formatNumber(Math.max(0, MINE_POWER - next.power))} power to go</small>
                </span>
                {nextLink && (
                  <Link className="btn" to={nextLink.to}>
                    {nextLink.label}
                  </Link>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <div className="prew__hero drew__hero">
            <img src={CURRENCY_ICON[currency]} alt="" className="prew__heroicon" />
            <span className="prew__herolabel">{pays ? 'Waiting to claim' : 'Earned so far'}</span>
            <strong className={`prew__heronum mono${pays && pending > 0 ? ' is-gold' : ''}`}>
              {pays ? heroAmount(pending) : earnedSoFar}
            </strong>
            {pays ? (
              pending > 0 ? (
                <button
                  type="button"
                  className="btn btn--gold prew__claim"
                  disabled={!canAct || busy !== null}
                  onClick={onClaim}
                >
                  {busy === 'claim' && <span className="spinner" />}
                  Claim {heroAmount(pending)} {symbol}
                </button>
              ) : (
                <small className="prew__heronote">Nothing to claim right now</small>
              )
            ) : (
              <small className="prew__heronote">Paid straight to your wallet</small>
            )}
          </div>
        )}

        {/* The history as rows, by where each payment came from. */}
        {capacity.unlocked === 0 ? (
          <>
            <h2 className="drew__cap">
              Payments<span>not recorded</span>
            </h2>
            <div className="prew__card prew__norecord">
              <strong>{symbol} payments aren't being recorded</strong>
              <p>
                The game only keeps a history for rows you unlock. Start recording and everything you
                earn from now on is listed here — what was paid before can't be shown.
              </p>
              {!capacity.atMax && (
                <div className="prew__unlock">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={!canAct || busy !== null}
                    onClick={() => onUnlock(capacity.step)}
                  >
                    {busy === 'rows' && <span className="spinner" />}
                    Start recording
                  </button>
                  <span>
                    {formatNumber(capacity.step)} rows ·{' '}
                    <img src={asset('/assets/icons/gems.svg')} alt="" width={13} height={13} />{' '}
                    {formatNumber(capacity.price)} gems
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="drew__cap">
              {rows.length ? `Last ${formatNumber(rows.length)} payments` : 'Payments'}
              {rows.length > 0 && (
                <span>
                  {short(total)} {symbol}
                </span>
              )}
            </h2>
            <div className="prew__rows">
              {log === undefined ? (
                <p className="prew__empty">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="prew__empty">Nothing recorded yet. The next {symbol} you earn appears here.</p>
              ) : (
                <SourceRows sources={sources} places={places} symbol={symbol} short={short} />
              )}
              <div className="prew__keep">
                <span>
                  {formatNumber(capacity.used)} / {formatNumber(capacity.unlocked)} kept
                </span>
                {!capacity.atMax && (
                  <>
                    <span className="prew__keepprice">
                      +{formatNumber(capacity.step)} rows ·{' '}
                      <img src={asset('/assets/icons/gems.svg')} alt="" width={13} height={13} />{' '}
                      {formatNumber(capacity.price)}
                    </span>
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={!canAct || busy !== null}
                      onClick={() => onUnlock(capacity.step)}
                    >
                      {busy === 'rows' && <span className="spinner" />}
                      Keep more
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <aside className="drew__side">
        {pool ? (
          <DeskPool
            entry={pool}
            places={places}
            symbol={symbol}
            trial={trial}
            busy={busy === 'mine' && minedPool === pool.pool}
            disabled={!canAct || busy !== null}
            onMine={(times) => onMine(pool.pool, times)}
          />
        ) : currency === 'wax' ? (
          <section className="drew__pool">
            <h2 className="drew__pooltitle">Where WAX comes from</h2>
            <p className="rsheet__hint">
              Tournament prizes wait here until you claim them. Candle missions pay WAX when you claim
              them at the Candle. There is no pool to mine.
            </p>
            <Link className="btn btn--primary" to="/candle">
              Go to the Candle
            </Link>
          </section>
        ) : null}

        {/* Only TLM waits to be claimed; the others say what they have earned. */}
        <div className="prew__rows">
          {pays && board.length > 0 ? (
            <div className="prew__row">
              <img src={CURRENCY_ICON[currency]} alt="" />
              <span className="prew__rowtext">
                <strong>Waiting to claim</strong>
                <small>
                  {pending > 0 ? `${heroAmount(pending)} ${symbol}` : 'Nothing waiting right now'}
                </small>
              </span>
              <button
                type="button"
                className="btn btn--sm btn--gold"
                disabled={!canAct || busy !== null || pending <= 0}
                onClick={onClaim}
              >
                {busy === 'claim' && <span className="spinner" />}
                Claim
              </button>
            </div>
          ) : (
            board.length > 0 && (
              <div className="prew__row">
                <img src={CURRENCY_ICON[currency]} alt="" />
                <span className="prew__rowtext">
                  <strong>Earned so far</strong>
                  <small>Paid straight to your wallet</small>
                </span>
                <span className="prew__amount mono">{earnedSoFar}</span>
              </div>
            )
          )}
        </div>
        {/*
          \`claimcur\` zeroes unclaimed shards and WAX without sending them, so a
          balance there is named rather than offered a button that would
          destroy it.
        */}
        {!pays && pending > 0 && (
          <p className="rsheet__hint rsheet__hint--error">
            The game holds {formatDecimals(pending, places)} {symbol} against your account, but the
            claim action clears it without paying it out. Nothing here can release it.
          </p>
        )}
      </aside>
    </div>
  )
}

/**
 * The pool open beside the rings: the phone's pool sheet, kept open — what it
 * holds, what a mine pays, how far along it is, and Mine. Mine ×N appears
 * once more than one mine is banked, capped at what one signature takes.
 */
export function DeskPool({
  entry,
  places,
  symbol,
  trial,
  busy,
  disabled,
  onMine,
}: {
  entry: PoolEntry
  places: number
  symbol: string
  trial: number | null
  busy: boolean
  disabled: boolean
  onMine: (times: number) => void
}) {
  const batch = batchableMines(entry)
  const link = earnLink(entry.pool)
  return (
    <section className="drew__pool" aria-label={`${entry.label} pool`}>
      <h2 className="drew__pooltitle">
        {entry.label} · {symbol}
      </h2>
      <PoolFacts
        entry={entry}
        places={places}
        symbol={symbol}
        pays={entry.anyAmount ? entry.payout : poolPayout(entry.balance, MINE_POWER)}
        trial={trial}
      />
      <div className="rsheet__actions">
        {entry.ready ? (
          <>
            <button type="button" className="btn btn--gold" disabled={disabled} onClick={() => onMine(1)}>
              {busy && <span className="spinner" />}
              Mine
            </button>
            {batch > 1 && (
              <button type="button" className="btn" disabled={disabled} onClick={() => onMine(batch)}>
                Mine ×{batch}
              </button>
            )}
          </>
        ) : (
          <>
            {link && (
              <Link className="btn btn--primary" to={link.to}>
                {link.label}
              </Link>
            )}
            <button type="button" className="btn" disabled>
              Mine
            </button>
          </>
        )}
      </div>
    </section>
  )
}
