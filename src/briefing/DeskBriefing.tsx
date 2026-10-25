import { Link } from 'react-router-dom'
import type { Player } from '@/chain/types'
import type { PoolEntry } from '@/pools/rules'
import { asset } from '@/assets'
import { formatNumber } from '@/format'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { Loading } from '@/components/Loading'
import {
  metersFor,
  tileOf,
  type BriefItem,
  type BriefMeter,
  type FirstStep,
  type RosterSummary,
} from '@/briefing/rules'

/**
 * The briefing on a desktop: three lanes, read left to right from "take it
 * now" to "worth doing someday".
 *
 * The phone's page, given width. What can be collected is gold, one tile a
 * row with its amount large and its button at the end; what today holds and
 * the slower things are quiet cards with one way in. Warnings are not
 * waiting — they run as slim bars across all three lanes, above them. A
 * player with no team yet gets "Start here" across the top instead, with the
 * first steps beside it.
 *
 * An empty Waiting lane does not just say so: it shows the reward pools
 * filling, which is what will be waiting next and why today's fights
 * matter. An empty Grow lane is simply not there.
 */
export function DeskBriefing({
  player,
  items,
  roster,
  pools,
  pending,
  steps,
  legend,
  veteran,
}: {
  player: Player
  items: BriefItem[]
  roster?: RosterSummary
  pools?: { tlm: PoolEntry[]; shards: PoolEntry[] }
  pending: number
  steps: FirstStep[]
  legend: boolean
  veteran: boolean
}) {
  const start = items.filter((i) => i.group === 'start')
  const warns = items.filter((i) => i.tone === 'warn')
  const claims = items.filter((i) => i.tone === 'claim')
  const today = items.filter((i) => i.group === 'play' && i.tone !== 'warn' && i.tone !== 'claim')
  const grow = items.filter((i) => i.group === 'grow' && i.tone !== 'warn' && i.tone !== 'claim')

  /* Every pool, ready or not — Arena Domination with the rest. */
  const allMeters = pools ? metersFor([...pools.tlm, ...pools.shards]) : []

  const stepsDone = steps.filter((s) => s.done).length
  const showSteps = stepsDone < steps.length
  const name = player.playertag || player.wallet

  const line =
    pending > 0
      ? `Checking ${pending} more…`
      : [
          claims.length ? `${claims.length} waiting` : 'Nothing waiting',
          warns.length ? `${warns.length} need${warns.length === 1 ? 's' : ''} a look` : '',
          today.length ? `${today.length} for today` : '',
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <div className="dbrief">
      {pending > 0 && <Loading label="Reading your account" />}

      {/* The page's title like every other screen's, the greeting under it. */}
      <header className="dbrief__head">
        <div className="dbrief__who">
          <h1 className="dbrief__title">Briefing</h1>
          <p className="dbrief__hello">
            <PlayerAvatar
              id={Number(player.active_avatar) || undefined}
              name={name}
              className="dbrief__avatar"
              size={28}
            />
            <span className="dbrief__name">
              {veteran ? 'Welcome back' : 'Welcome'}, {name}
            </span>
            <span className="dbrief__line" role="status">
              {pending > 0 && <span className="spinner" />}
              {line}
            </span>
          </p>
        </div>
        <div className="dbrief__chips">
          <Link className={`dbrief__chip${legend ? ' is-legend' : ''}`} to="/shop?c=account">
            <img src={asset('/assets/icons/account-legend.svg')} alt="" />
            {legend ? 'Legend' : 'Trial account'}
          </Link>
          {roster && (
            <Link className="dbrief__chip" to="/fighters">
              <img src={asset('/assets/icons/menu/sword.png')} alt="" />
              {formatNumber(roster.total)} fighter{roster.total === 1 ? '' : 's'}
            </Link>
          )}
          {!!roster?.defending && (
            <Link className="dbrief__chip" to="/fighters">
              <img src={asset('/assets/icons/arena.svg')} alt="" />
              {formatNumber(roster.defending)} defending
            </Link>
          )}
        </div>
      </header>

      {/* ---------- start here, or the first steps as one line ---------- */}
      {start.map((item, i) => (
        <section className="dbrief__start" key={item.id} aria-label="Start here">
          <div className="dbrief__startmain">
            <span className="dbrief__kick">Start here</span>
            <h2 className="dbrief__starttitle">{item.title}</h2>
            <p className="dbrief__startbody">{item.body}</p>
            <div className="dbrief__startacts">
              <Link className="btn btn--primary" to={item.cta.to}>
                {item.cta.label}
              </Link>
              {item.more && (
                <Link className="dbrief__more" to={item.more.to}>
                  {item.more.label}
                </Link>
              )}
            </div>
          </div>
          {i === 0 && showSteps && <Steps steps={steps} done={stepsDone} />}
        </section>
      ))}
      {start.length === 0 && showSteps && <Steps steps={steps} done={stepsDone} line />}

      {/* ---------- warnings, across the board ---------- */}
      {warns.length > 0 && (
        <div className="dbrief__warns">
          {warns.map((item) => (
            <div className="dbrief__warn" key={item.id}>
              <img src={asset(item.icon)} alt="" />
              <span className="dbrief__warntext">
                <b>{item.title}</b>
                {item.figure && <small>{item.figure}</small>}
                <span>{firstSentence(item.body)}</span>
              </span>
              <Link className="btn btn--sm dbrief__warngo" to={item.cta.to}>
                {item.cta.label}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ---------- the three lanes ---------- */}
      <div className="dbrief__lanes">
        <section className="dbrief__lane dbrief__lane--wait" aria-label="Waiting">
          <LaneCap title="Waiting" count={pending > 0 && !claims.length ? undefined : claims.length} />
          {claims.map((item) => (
            <WaitTile key={item.id} item={item} meters={item.id === 'mine' && allMeters.length ? allMeters : item.meters} />
          ))}
          {pending > 0 ? (
            <div className="dbrief__sk dbrief__sk--tile" aria-hidden="true" />
          ) : (
            claims.length === 0 && (
              <div className="dbrief__calm">
                <b>All caught up</b>
                <small>
                  {allMeters.length ? "Your pools are filling from today's wins." : 'Nothing to collect right now.'}
                </small>
                {allMeters.map((m) => (
                  <PoolMeter key={m.pool} m={m} />
                ))}
              </div>
            )
          )}
        </section>

        <section className="dbrief__lane dbrief__lane--today" aria-label="Today">
          <LaneCap title="Today" count={pending > 0 && !today.length ? undefined : today.length} />
          {today.map((item) => (
            <LaneCard key={item.id} item={item} />
          ))}
          {pending > 0 ? (
            <div className="dbrief__sk dbrief__sk--card" aria-hidden="true" />
          ) : (
            today.length === 0 && (
              <p className="dbrief__empty">
                {roster && roster.total < 5
                  ? 'Dungeons and arenas open once you have a team of five.'
                  : 'Nothing more to play today.'}
              </p>
            )
          )}
        </section>

        {grow.length > 0 && (
          <section className="dbrief__lane dbrief__lane--grow" aria-label="Grow your account">
            <LaneCap title="Grow" count={grow.length} />
            {grow.map((item) => (
              <LaneCard key={item.id} item={item} quiet />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

function LaneCap({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="dbrief__cap">
      {title}
      <span>{count ?? '…'}</span>
    </h2>
  )
}

/** A thing to collect: icon, the amount large, its button at the end. */
function WaitTile({ item, meters }: { item: BriefItem; meters?: BriefMeter[] }) {
  const t = tileOf(item)
  return (
    <article className="dbrief__tile">
      <img className="dbrief__tileicon" src={asset(item.id === 'mine' ? '/assets/icons/menu/rewards.png' : item.icon)} alt="" />
      <span className="dbrief__tiletext">
        {t.amount && (
          <span className="dbrief__amount mono">
            {t.amount}
            {t.unit && <small>{t.unit}</small>}
          </span>
        )}
        <span className={t.amount ? 'dbrief__tilelabel' : 'dbrief__tilelabel is-only'}>{t.label}</span>
      </span>
      <Link className="btn btn--sm btn--gold" to={item.cta.to}>
        {item.cta.label}
      </Link>
      {meters && meters.length > 0 && <PoolTable meters={meters} />}
    </article>
  )
}

/**
 * The pools as a small table: one row a pool, a column a currency. A ready
 * pool shows what a mine pays now; one still filling shows how far along it
 * is; a pool with no side in that currency (Arena Domination's shards) a dash.
 */
function PoolTable({ meters }: { meters: BriefMeter[] }) {
  const rows = new Map<string, { tlm?: BriefMeter; shards?: BriefMeter }>()
  for (const m of meters) {
    const row = rows.get(m.label) ?? {}
    row[m.symbol === 'TLM' ? 'tlm' : 'shards'] = m
    rows.set(m.label, row)
  }
  const cell = (m?: BriefMeter) =>
    !m ? (
      <span className="dbrief__pcell is-none">–</span>
    ) : m.ready ? (
      <span className="dbrief__pcell is-ready mono">~{m.pays}</span>
    ) : (
      <span className="dbrief__pcell mono">{percent(m.progress)}%</span>
    )
  return (
    <div className="dbrief__pools" role="table" aria-label="Reward pools">
      <span role="columnheader" />
      <span className="dbrief__phead" role="columnheader">
        <img src={asset('/assets/icons/tlm.svg')} alt="" />
        TLM
      </span>
      <span className="dbrief__phead" role="columnheader">
        <img src={asset('/assets/icons/shards.svg')} alt="" />
        Shards
      </span>
      {[...rows].map(([label, row]) => (
        <div className="dbrief__prow" role="row" key={label}>
          <span className="dbrief__pname">{poolName(label)}</span>
          {cell(row.tlm)}
          {cell(row.shards)}
        </div>
      ))}
    </div>
  )
}

/** A pool still filling: its bar, and what a mine would pay. */
function PoolMeter({ m }: { m: BriefMeter }) {
  const pct = percent(m.progress)
  return (
    <div className={`dbrief__meter${m.ready ? ' is-ready' : ''}`}>
      <img src={asset(m.icon)} alt="" />
      <span>{poolName(m.label)}</span>
      <b className="mono">
        {m.ready ? 'Ready' : `${pct}%`} · ~{m.pays} {m.symbol}
      </b>
      <span
        className="dbrief__meterbar"
        role="progressbar"
        aria-label={`${m.label} ${m.symbol} pool`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <i style={{ width: `${Math.max(m.progress > 0 ? 2 : 0, pct)}%` }} />
      </span>
    </div>
  )
}

/** Something to play, or to grow towards: what it is, one figure, one way in. */
function LaneCard({ item, quiet }: { item: BriefItem; quiet?: boolean }) {
  const done = item.id === 'dungeons-done'
  const note = cardLine(item)
  return (
    <article className={`dbrief__card${done ? ' is-done' : ''}`}>
      <img src={asset(item.icon)} alt="" />
      <b>{item.title}</b>
      <div className="dbrief__cardfoot">
        <small className={item.figure?.endsWith(' left') ? 'is-hot' : undefined}>{note}</small>
        <Link className={`btn btn--sm ${quiet || done ? 'btn--ghost' : 'btn--primary'}`} to={item.cta.to}>
          {item.cta.label}
        </Link>
      </div>
    </article>
  )
}

function Steps({ steps, done, line }: { steps: FirstStep[]; done: number; line?: boolean }) {
  const next = steps.findIndex((s) => !s.done)
  return (
    <section className={`dbrief__steps${line ? ' is-line' : ''}`} aria-label="Your first steps">
      <span className="dbrief__stepshead">
        {line ? 'First steps' : 'Your first steps'}
        <em>
          {done} of {steps.length}
          {line ? '' : ' done'}
        </em>
      </span>
      <ol>
        {steps.map((s, i) => (
          <li key={s.key} className={s.done ? 'is-done' : i === next ? 'is-next' : undefined}>
            <span className="dbrief__stepnum" aria-hidden="true">
              {s.done ? '✓' : i + 1}
            </span>
            {s.label}
            <span className="sr-only">{s.done ? ' — done' : ' — to do'}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* Whole percent, rounded down — but 0.58 is 58, not the 57.99… floating point makes of it. */
function percent(progress: number): number {
  return Math.floor(progress * 100 + 1e-9)
}

/* "Dungeon Wins" → "Dungeon wins": a name in a table, not a title. */
function poolName(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase()
}

/* The card's one line: its figure, and its pools where it fills any. */
function cardLine(item: BriefItem): string {
  const pools = item.meters?.length
    ? 'Pools: ' + item.meters.map((m) => `${m.symbol} ${m.ready ? 'ready' : `${percent(m.progress)}%`}`).join(' · ')
    : ''
  return [item.figure, pools].filter(Boolean).join(' · ')
}

/* A warning's reason in one line: the first sentence of its explanation. */
function firstSentence(body: string): string {
  const m = body.match(/^.*?[.!?](?=\s|$)/)
  return m ? m[0] : body
}
