import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Player } from '@/chain/types'
import type { MiningTool } from '@/chain/atomic'
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
import { MAX_TOOLS, paymentSources } from './rules'
import { useMiningTools } from './useMiningTools'
import {
  AllToolsSheet,
  EARNED_STAT,
  LandSheet,
  PoolFacts,
  Power,
  Ring,
  TABS,
  ToolsSheet,
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
 * where they came from. On Mining, the tools in use are large over every
 * tool in the game, sorted by power, with the player's own marked; changing
 * tools and the landowner split open the phone's sheets from the side.
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
      <div className="prew__tabs drew__tabs" role="tablist" aria-label="Rewards">
        {TABS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="prew__tab"
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

function Chevron() {
  return (
    <svg className="pchev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/* ---------- mining ---------- */

type CatalogueSort = 'combined' | 'tlm_mp' | 'shrd_mp'
const CATALOGUE_SORTS: [CatalogueSort, string][] = [
  ['combined', 'Combined'],
  ['tlm_mp', 'TLM power'],
  ['shrd_mp', 'Shard power'],
]
/* The strongest tools are the ones worth a look; the rest are one click away. */
const CATALOGUE_FIRST = 24

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
  const [open, setOpen] = useState<'tools' | 'land' | 'all' | null>(null)
  const [sort, setSort] = useState<CatalogueSort>('combined')
  const [mineOnly, setMineOnly] = useState(false)
  const [everything, setEverything] = useState(false)

  const lands = useChainQuery(player.wallet && `owned-lands:${player.wallet}`, () =>
    fetchOwnedLands(player.wallet),
  )
  const ownsLand = (lands.data?.length ?? 0) > 0

  const stored = useMemo(() => (player.mine_nfts ?? []).map(String), [player.mine_nfts])
  const equipped = useMemo(() => {
    const byId = new Map(tools.map((t) => [t.asset_id, t]))
    return stored.map((id) => byId.get(id)).filter((t): t is MiningTool => !!t)
  }, [tools, stored])
  const bag = useMemo(
    () => bagPower(equipped.map((t) => powerOf(t.template_id) ?? {})),
    [equipped, powerOf],
  )
  const share = Number(player.landowner_tlm_share ?? 0)

  const held = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of tools) map.set(t.template_id, (map.get(t.template_id) ?? 0) + 1)
    return map
  }, [tools])
  const inUse = useMemo(() => new Set(equipped.map((t) => t.template_id)), [equipped])
  const catalogue = useMemo(
    () =>
      templates
        .filter((t) => !mineOnly || held.has(t.template_id))
        .sort((a, b) => powerScore(sort, b) - powerScore(sort, a) || byQuality(a, b)),
    [templates, sort, mineOnly, held],
  )
  const shown = everything ? catalogue : catalogue.slice(0, CATALOGUE_FIRST)

  return (
    <div className="drew__stage">
      <div className="drew__main">
        <section className="drew__bag" aria-label="Your mining power">
          <span className="drew__bagpower">
            <small>Your mining power</small>
            {loading ? (
              <span className="prew__power prew__power--big">—</span>
            ) : (
              <Power tlm={bag.tlm_mp} shrd={bag.shrd_mp} big />
            )}
            <small className="drew__bagnote">
              {loading ? 'Loading your tools…' : `${equipped.length} of ${MAX_TOOLS} tools equipped`}
            </small>
          </span>
          <div className="drew__slots">
            {Array.from({ length: MAX_TOOLS }, (_, i) => {
              const t = equipped[i]
              if (loading) return <span className="drew__slot is-loading" key={i} />
              return t ? (
                <button
                  type="button"
                  className="drew__slot"
                  key={t.asset_id}
                  onClick={() => setOpen('tools')}
                >
                  <GameImg
                    src={asset(`/assets/cards/${t.template_id}.webp`)}
                    alt=""
                    fallback={asset('/assets/default-card.png')}
                  />
                  <span>{t.name}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="drew__slot is-empty"
                  key={`empty-${i}`}
                  onClick={() => setOpen('tools')}
                  aria-label="Equip a tool"
                >
                  <i>+</i>
                  <span>Empty</span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="drew__cathead">
          <h2 className="drew__cap">
            Every tool · {formatNumber(catalogue.length)}
            <span>yours marked</span>
          </h2>
          <div className="alltools__chips drew__sorts">
            {CATALOGUE_SORTS.map(([key, label]) => (
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
            <button
              type="button"
              className={mineOnly ? 'is-on' : ''}
              aria-pressed={mineOnly}
              onClick={() => setMineOnly((v) => !v)}
            >
              Yours only
            </button>
          </div>
        </div>
        {loading ? (
          <p className="rsheet__hint">Loading every tool…</p>
        ) : (
          <div className="drew__catalog">
            {shown.map((t) => {
              const count = held.get(t.template_id) ?? 0
              return (
                <div
                  className={`drew__tool${count > 0 ? ' is-yours' : ''}${inUse.has(t.template_id) ? ' is-used' : ''}`}
                  key={t.template_id}
                >
                  <GameImg
                    src={asset(`/assets/cards/${t.template_id}.webp`)}
                    alt=""
                    fallback={asset('/assets/default-card.png')}
                  />
                  <span className="drew__toolname">
                    <b>{t.toolname}</b>
                    <small>
                      {t.rarity} · {t.shine}
                      {count > 0 && (
                        <em>
                          {inUse.has(t.template_id) ? 'in use' : 'yours'}
                          {count > 1 ? ` ×${formatNumber(count)}` : ''}
                        </em>
                      )}
                    </small>
                  </span>
                  <Power tlm={t.tlm_mp} shrd={t.shrd_mp} />
                </div>
              )
            })}
          </div>
        )}
        {!loading && catalogue.length > CATALOGUE_FIRST && (
          <button type="button" className="btn btn--ghost drew__more" onClick={() => setEverything((v) => !v)}>
            {everything ? 'Show the strongest only' : `Show all ${formatNumber(catalogue.length)}`}
          </button>
        )}
      </div>

      <aside className="drew__side">
        <div className="prew__rows">
          <button type="button" className="prew__row" onClick={() => setOpen('tools')}>
            <img src={asset('/assets/icons/menu/rewards.png')} alt="" />
            <span className="prew__rowtext">
              <strong>Change tools</strong>
              <small>
                {loading
                  ? 'Loading…'
                  : `${formatNumber(Math.max(0, tools.length - equipped.length))} more in your wallet`}
              </small>
            </span>
            <Chevron />
          </button>
          <button
            type="button"
            className="prew__row"
            disabled={!ownsLand}
            onClick={() => setOpen('land')}
          >
            <img src={asset('/assets/icons/menu/my-land.png')} alt="" />
            <span className="prew__rowtext">
              <strong>Landowner settings</strong>
              <small>
                {lands.data === undefined
                  ? 'Checking your land…'
                  : ownsLand
                    ? `${share}% TLM · ${100 - share}% Shards`
                    : 'You own no land — nothing to set'}
              </small>
            </span>
            {ownsLand && <Chevron />}
          </button>
          <button type="button" className="prew__row" onClick={() => setOpen('all')}>
            <img src={asset('/assets/icons/menu/card.png')} alt="" />
            <span className="prew__rowtext">
              <strong>Search all tools</strong>
              <small>By name, rarity or shine</small>
            </span>
            <Chevron />
          </button>
        </div>
        <p className="rsheet__hint drew__note">
          Mining adds the power of every equipped tool together. The tools stay in your wallet —
          the game only records which you picked.
        </p>
      </aside>

      {open === 'tools' && (
        <ToolsSheet
          side
          tools={tools}
          loading={loading}
          powerOf={powerOf}
          stored={stored}
          busy={busy}
          canAct={canAct}
          onSave={(ids) => {
            onSave(ids)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'land' && (
        <LandSheet
          side
          stored={share}
          busy={busy}
          canAct={canAct}
          onSave={(next) => {
            onShare(next)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'all' && (
        <AllToolsSheet
          side
          templates={templates}
          owned={tools}
          loading={loading}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
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
                    <img src={asset('/assets/icons/gems.png')} alt="" width={13} height={13} />{' '}
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
                sources.map((s) => (
                  <div className="prew__row" key={s.key}>
                    <img src={s.icon} alt="" />
                    <span className="prew__rowtext">
                      <strong>{s.label}</strong>
                      <small>
                        {formatNumber(s.count)} payment{s.count === 1 ? '' : 's'}
                      </small>
                    </span>
                    <span className="prew__amount mono">{short(s.total)}</span>
                  </div>
                ))
              )}
              <div className="prew__keep">
                <span>
                  {formatNumber(capacity.used)} / {formatNumber(capacity.unlocked)} kept
                </span>
                {!capacity.atMax && (
                  <>
                    <span className="prew__keepprice">
                      +{formatNumber(capacity.step)} rows ·{' '}
                      <img src={asset('/assets/icons/gems.png')} alt="" width={13} height={13} />{' '}
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
