import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { asset } from '@/assets'
import { hasLegendAccess } from '@/account/rules'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useBriefing } from '@/briefing/useBriefing'
import { usePhone } from '@/components/usePhone'
import { DeskBriefing } from '@/briefing/DeskBriefing'
import { firstSteps, stat, tileOf, type BriefItem, type BriefMeter } from '@/briefing/rules'

/**
 * The briefing — "what can I do right now, and why should I?"
 *
 * Where the logo leads. The map is one tap away in the menu; what a player
 * opening the game actually lacks is the overview: that three pools filled
 * overnight, that there are twenty dungeons still unplayed today, that the
 * empty plot they own could be earning. Everything here is read from the
 * chain and the player's own lifetime stats, and every line ends in the
 * screen where it is done.
 */
export default function Briefing() {
  const player = useGame((s) => s.player)!
  const { items, roster, pools, pending } = useBriefing(player)

  const steps = useMemo(() => firstSteps(player, roster), [player, roster])
  const stepsDone = steps.filter((s) => s.done).length
  const showSteps = stepsDone < steps.length

  const legend = hasLegendAccess(player.legend_access_expiry)
  const veteran = stat(player, 'dungeons_won') > 0

  const phone = usePhone()
  if (phone) {
    return (
      <PhoneBriefing
        items={items}
        pending={pending}
        name={player.playertag || player.wallet}
        avatar={Number(player.active_avatar) || undefined}
        veteran={veteran}
        steps={
          showSteps ? (
            <section className="brief__steps" aria-label="Your first steps">
              <div className="brief__stepshead">
                <h2 className="brief__h2">Your first steps</h2>
                <span className="faint">
                  {stepsDone} of {steps.length} done
                </span>
              </div>
              <ol className="brief__steplist">
                {steps.map((s, i) => (
                  <li key={s.key} className={s.done ? 'is-done' : ''}>
                    <span className="brief__stepnum" aria-hidden="true">
                      {s.done ? '✓' : i + 1}
                    </span>
                    <span>{s.label}</span>
                    <span className="sr-only">{s.done ? ' — done' : ' — to do'}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null
        }
      />
    )
  }

  return (
    <DeskBriefing
      player={player}
      items={items}
      roster={roster}
      pools={pools}
      pending={pending}
      steps={steps}
      legend={legend}
      veteran={veteran}
    />
  )
}

/**
 * The briefing on a phone: what is waiting first.
 *
 * The same items as the desktop's, laid out for what a player opens it for
 * on a phone. A warning is one slim bar at the top; everything that can be
 * collected is a gold tile with its amount large and its button under it;
 * what today holds, and the slower things after it, are quiet rows that go
 * straight to where each is done. The paragraphs of why are left out — on a
 * phone they made the page five screens tall.
 */
function PhoneBriefing({
  items,
  pending,
  name,
  avatar,
  veteran,
  steps,
}: {
  items: BriefItem[]
  pending: number
  name: string
  avatar?: number
  veteran: boolean
  steps: React.ReactNode
}) {
  const start = items.filter((i) => i.group === 'start')
  const warns = items.filter((i) => i.tone === 'warn')
  const claims = items.filter((i) => i.tone === 'claim')
  const today = items.filter((i) => i.group === 'play' && i.tone !== 'warn' && i.tone !== 'claim')
  const grow = items.filter((i) => i.group === 'grow' && i.tone !== 'warn' && i.tone !== 'claim')

  const line =
    pending > 0
      ? `Checking ${pending} more…`
      : [
          claims.length ? `${claims.length} waiting` : 'Nothing waiting',
          today.length ? `${today.length} for today` : '',
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <div className="pbrief">
      <header className="pbrief__hello">
        <PlayerAvatar id={avatar} name={name} className="pbrief__avatar" size={40} />
        <div className="pbrief__who">
          <h1 className="pbrief__name">
            {veteran ? 'Welcome back' : 'Welcome'}, {name}
          </h1>
          <span className="pbrief__line" role="status">
            {pending > 0 && <span className="spinner" />}
            {line}
          </span>
        </div>
      </header>

      {steps}
      {start.length > 0 && (
        <div className="brief__list">
          {start.map((item) => (
            <BriefCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {warns.map((item) => (
        <Link className="pwarn" key={item.id} to={item.cta.to}>
          <img className="pwarn__icon" src={asset(item.icon)} alt="" />
          <span className="pwarn__text">
            <strong>{item.title}</strong>
            {item.figure && <small>{item.figure}</small>}
          </span>
          <Chevron />
        </Link>
      ))}

      <section className="pbrief__part">
        <h2 className="pbrief__cap">
          Waiting
          {claims.length > 0 && <span>{claims.length}</span>}
        </h2>
        {claims.length ? (
          <div className="ptiles">
            {claims.map((item) => {
              const t = tileOf(item)
              return (
                <article className="ptile" key={item.id}>
                  <div className="ptile__top">
                    <img src={asset(item.icon)} alt="" />
                    {t.amount && (
                      <span className="ptile__amount mono">
                        {t.amount}
                        {t.unit && <small>{t.unit}</small>}
                      </span>
                    )}
                  </div>
                  <span className={`ptile__label${t.amount ? '' : ' ptile__label--only'}`}>
                    {t.label}
                  </span>
                  <Link className="btn btn--sm btn--gold ptile__go" to={item.cta.to}>
                    {item.cta.label}
                  </Link>
                </article>
              )
            })}
          </div>
        ) : (
          pending === 0 && <p className="pbrief__clear">All caught up — nothing to collect.</p>
        )}
      </section>

      {[
        ['Today', today],
        ['Grow your account', grow],
      ].map(([title, list]) =>
        (list as BriefItem[]).length ? (
          <section className="pbrief__part" key={title as string}>
            <h2 className="pbrief__cap">
              {title as string}
              <span>{(list as BriefItem[]).length}</span>
            </h2>
            <div className="prows">
              {(list as BriefItem[]).map((item) => (
                <Link className="prow" key={item.id} to={item.cta.to}>
                  <img className="prow__icon" src={asset(item.icon)} alt="" />
                  <span className="prow__text">
                    <strong>{item.title}</strong>
                    <small>{rowLine(item)}</small>
                  </span>
                  <Chevron />
                </Link>
              ))}
            </div>
          </section>
        ) : null,
      )}
    </div>
  )
}

/* What a row says under its title: its figure, and its pools where it fills any. */
function rowLine(item: BriefItem): string {
  const pools = item.meters?.length
    ? 'Pools: ' +
      item.meters.map((m) => `${m.symbol} ${m.ready ? 'ready' : `${Math.floor(m.progress * 100)}%`}`).join(' · ')
    : ''
  return [item.figure, pools].filter(Boolean).join(' · ') || item.cta.label
}

function Chevron() {
  return (
    <svg className="pchev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** A pool's bar: how full it is, and what a mine there would pay today. */
function Meter({ m }: { m: BriefMeter }) {
  const pct = Math.floor(m.progress * 100)
  return (
    <div className={`bmeter${m.ready ? ' bmeter--ready' : ''}`}>
      <img className="bmeter__icon" src={asset(m.icon)} alt="" />
      <div className="bmeter__main">
        <div className="bmeter__row">
          <span className="bmeter__name">{m.symbol}</span>
          <span className="bmeter__pct">{m.ready ? 'Ready' : `${pct}%`}</span>
        </div>
        <div
          className="bmeter__bar"
          role="progressbar"
          aria-label={`${m.symbol} pool`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span style={{ width: `${Math.max(m.progress > 0 ? 2 : 0, pct)}%` }} />
        </div>
        <div className="bmeter__row bmeter__foot">
          <span>
            {m.ready ? 'Mine now' : 'A full mine'} ≈ <strong>{m.pays}</strong> {m.symbol}
          </span>
        </div>
      </div>
    </div>
  )
}

export function BriefCard({ item }: { item: BriefItem }) {
  return (
    <article className={`bcard bcard--${item.tone}`}>
      <span className="bcard__icon" aria-hidden="true">
        <img src={asset(item.icon)} alt="" />
      </span>
      <div className="bcard__text">
        <div className="bcard__top">
          <h3 className="bcard__title">{item.title}</h3>
          {item.figure && <span className="bcard__figure">{item.figure}</span>}
        </div>
        <p className="bcard__body">{item.body}</p>
        {item.meters && item.meters.length > 0 && (
          <div className="bcard__meters">
            {item.meters.map((m) => (
              <Meter key={m.pool} m={m} />
            ))}
          </div>
        )}
      </div>
      <div className="bcard__actions">
        <Link
          className={`btn btn--sm ${item.tone === 'claim' ? 'btn--gold' : item.tone === 'warn' ? 'btn--magenta' : item.tone === 'grow' ? 'btn--ghost' : 'btn--primary'}`}
          to={item.cta.to}
        >
          {item.cta.label}
        </Link>
        {item.more && (
          <Link className="bcard__more" to={item.more.to}>
            {item.more.label}
          </Link>
        )}
      </div>
    </article>
  )
}
