import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { asset } from '@/assets'
import { formatNumber, formatStat } from '@/format'
import { hasLegendAccess } from '@/account/rules'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useBriefing } from '@/briefing/useBriefing'
import { usePhone } from '@/components/usePhone'
import {
  firstSteps,
  GROUP_ORDER,
  JOURNEY_STATS,
  stat,
  tileOf,
  type BriefGroup,
  type BriefItem,
  type BriefMeter,
} from '@/briefing/rules'

export const GROUP_TITLE: Record<BriefGroup, string> = {
  start: 'Start here',
  now: 'Ready for you',
  play: 'What today holds',
  grow: 'Grow your account',
}

const GROUP_HINT: Record<BriefGroup, string> = {
  start: 'The one thing that unlocks everything else.',
  now: 'Waiting to be claimed or looked after.',
  play: 'Where the Reward Power and XP come from.',
  grow: 'Slower wins that will help for the days to come.',
}

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
  const { items, roster, pending } = useBriefing(player)

  const steps = useMemo(() => firstSteps(player, roster), [player, roster])
  const stepsDone = steps.filter((s) => s.done).length
  const showSteps = stepsDone < steps.length

  const legend = hasLegendAccess(player.legend_access_expiry)
  const veteran = stat(player, 'dungeons_won') > 0

  const groups = GROUP_ORDER.map((g) => ({ group: g, list: items.filter((i) => i.group === g) }))
  /* Only what can actually be taken counts as "ready"; a warning is not a gift. */
  const ready = items.filter((i) => i.tone === 'claim').length
  const warnings = items.filter((i) => i.tone === 'warn').length

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
    <div className="brief">
      <header className="brief__hero">
        <PlayerAvatar
          id={Number(player.active_avatar) || undefined}
          name={player.playertag}
          className="brief__avatar"
          size={72}
        />
        <div className="brief__who">
          <span className="brief__kicker">Briefing</span>
          <h1 className="brief__title">
            {veteran ? 'Welcome back' : 'Welcome'}, {player.playertag || player.wallet}
          </h1>
          <p className="brief__lead">
            {ready > 0
              ? `${ready === 1 ? 'One thing is' : `${ready} things are`} ready for you, and here's what else you can do today.`
              : pending > 0
                ? 'Looking at your account…'
                : warnings > 0
                  ? `Nothing is waiting to be claimed, but ${warnings === 1 ? 'one thing needs' : `${warnings} things need`} a look.`
                  : "Nothing is waiting to be claimed. Here's what you can do today."}
          </p>
          <div className="brief__chips">
            <Link className={`brief__chip${legend ? ' brief__chip--legend' : ''}`} to="/shop?c=account">
              <img src={asset('/assets/icons/account-legend.svg')} alt="" />
              {legend ? 'Legend' : 'Trial account'}
            </Link>
            {roster && (
              <Link className="brief__chip" to="/fighters">
                <img src={asset('/assets/icons/menu/sword.png')} alt="" />
                {formatNumber(roster.total)} fighter{roster.total === 1 ? '' : 's'}
              </Link>
            )}
            {/*
              Energy used to sit here, which the top bar already carries on
              every screen. What it has instead is the one part of the roster
              that is off doing something: fighters holding arenas, which
              earn while they stand there and cannot be picked for a fight.
            */}
            {!!roster?.defending && (
              <Link className="brief__chip" to="/fighters">
                <img src={asset('/assets/icons/arena.svg')} alt="" />
                {formatNumber(roster.defending)} defending
              </Link>
            )}
            {pending > 0 && (
              <span className="brief__chip brief__chip--busy" role="status">
                <span className="spinner" /> Checking {pending} more
              </span>
            )}
          </div>
        </div>
      </header>

      {showSteps && (
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
      )}

      {groups.map(({ group, list }) =>
        list.length === 0 ? (
          group === 'now' && pending === 0 ? (
            <section key={group} className="brief__group">
              <GroupHead group={group} />
              <p className="brief__clear">All caught up — nothing is waiting to be claimed.</p>
            </section>
          ) : null
        ) : (
          <section key={group} className={`brief__group brief__group--${group}`}>
            <GroupHead group={group} />
            <div className="brief__list">
              {list.map((item) => (
                <BriefCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ),
      )}

      <section className="brief__group">
        <div className="brief__grouphead">
          <h2 className="brief__h2">Your journey so far</h2>
          <Link className="brief__morelink" to="/profile?tab=stats">
            All stats
          </Link>
        </div>
        <div className="brief__journey">
          {JOURNEY_STATS.map((s) => (
            <div className="brief__stat" key={s.key}>
              <img src={asset(s.icon)} alt="" />
              <strong className="mono">{formatStat(s.key, stat(player, s.key))}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/**
 * The briefing on a phone: what is waiting first.
 *
 * The same items as the desktop's, laid out for what a player opens it for
 * on a phone. A warning is one slim bar at the top; everything that can be
 * collected is a gold tile with its amount large and its button under it;
 * what today holds, and the slower things after it, are quiet rows that go
 * straight to where each is done. The paragraphs of why stay on the desktop
 * — on a phone they made the page five screens tall — and so does the
 * journey, which is a look back rather than a thing to do.
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

export function GroupHead({ group }: { group: BriefGroup }) {
  return (
    <div className="brief__grouphead">
      <h2 className="brief__h2">{GROUP_TITLE[group]}</h2>
      <span className="brief__grouphint">{GROUP_HINT[group]}</span>
    </div>
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
