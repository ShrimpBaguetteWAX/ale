import { useEffect, useMemo, useState } from 'react'
import type { EffectEvent, Replay } from './sim'
import { NFT_FIGHTER_ID } from './rules'
import { formatScaled, STAT_LABEL } from '@/tavern/fighterStats'

/**
 * The whole fight, laid out to be read.
 *
 * The log that runs during playback only ever shows what has happened so far,
 * and the result screen's one offer was the CSV — a compatibility export meant
 * for arguing with the chain, not for following a fight. A player who wanted
 * to know why they lost had to open a spreadsheet.
 *
 * Same events, spelled out: every blow with what it hit for, what the
 * defender's resistance took off it, the health it left behind, and the
 * abilities that fired around it. The CSV is still here, one button along,
 * because the two answer different questions.
 */

const TRIGGER_LABEL: Record<string, string> = {
  on_attack: 'attacking',
  on_defense: 'defending',
  on_fight_start: 'fight start',
}

function Effect({
  effect,
  nameOf,
}: {
  effect: EffectEvent
  nameOf: (uid: string) => string
}) {
  const delta = effect.after - effect.before
  const stat = STAT_LABEL[effect.stat] ?? effect.stat
  const trigger = TRIGGER_LABEL[effect.trigger] ?? effect.trigger
  const self = effect.sourceUid === effect.targetUid

  return (
    <p className={`clog__effect clog__effect--${delta > 0 ? 'up' : 'down'}`}>
      <span className="clog__arrow" aria-hidden="true">
        ↳
      </span>
      <span>
        <strong>{effect.ability}</strong>{' '}
        <span className="clog__trigger">({trigger})</span>{' '}
        {delta > 0 ? 'raised' : 'lowered'}{' '}
        {self ? (
          'its own'
        ) : (
          <strong className="clog__name">{nameOf(effect.targetUid)}’s</strong>
        )}{' '}
        {stat} by{' '}
        <strong>{formatScaled(Math.abs(delta))}</strong>
      </span>
    </p>
  )
}

export function CombatLogSheet({
  replay,
  playertag,
  onClose,
  onDownload,
}: {
  replay: Replay
  playertag?: string
  onClose: () => void
  onDownload: () => void
}) {
  /* Escape closes it, like every other overlay in the game. */
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

  const byUid = useMemo(
    () => new Map(replay.fighters.map((f) => [f.uid, f])),
    [replay],
  )

  /*
     The sixth fighter has no class and no race — getFighterFromNFT builds it
     from a crew card and a weapon, and no crew row carries either — so it
     came through as "Unknown hit Unknown", which is the least readable line
     in the log about the fighter players ask the most questions about.
     Coerced, because its id is over 2^32 and arrives as a string.
  */
  const nameOf = (uid: string) => {
    const f = byUid.get(uid)
    if (!f) return 'Unknown'
    if (Number(f.fighter_id) === NFT_FIGHTER_ID) return 'NFT Fighter'
    return f.classname || 'Unknown'
  }
  const sideOf = (uid: string) => (byUid.get(uid)?.team === 1 ? 'mine' : 'theirs')
  const ownerOf = (uid: string) => {
    const f = byUid.get(uid)
    if (!f) return ''
    return f.team === 1 ? f.gamertag || playertag || 'You' : f.gamertag || 'AI'
  }

  /*
     Blows only, or blows that did something besides damage.

     A long fight is a hundred lines of "hit for 41", and the turns worth
     re-reading are almost always the ones where an ability fired or somebody
     went down. This is the one control the sheet needs.
  */
  const [notableOnly, setNotableOnly] = useState(false)
  const notable = (i: number) =>
    replay.turns[i].effects.length > 0 || replay.turns[i].killed

  const shown = replay.turns
    .map((t, i) => ({ t, i }))
    .filter(({ i }) => !notableOnly || notable(i))

  return (
    <div className="sheet" role="dialog" aria-label="Combat log" onClick={onClose}>
      <div
        className="sheet__panel panel clog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="clog__head">
          <div className="clog__heading">
            <span className="panel__title">Combat log</span>
            <p className="clog__sub">
              {replay.turns.length} blow{replay.turns.length === 1 ? '' : 's'}
              {replay.winner === 1
                ? ' · you won'
                : replay.winner === 2
                  ? ' · you lost'
                  : ' · a draw'}
            </p>
          </div>

          <div className="clog__tools">
            <button
              type="button"
              className={`btn btn--sm ${notableOnly ? 'btn--primary' : 'btn--ghost'}`}
              aria-pressed={notableOnly}
              onClick={() => setNotableOnly((v) => !v)}
              title="Only the blows where an ability fired or a fighter went down"
            >
              Key moments
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onDownload}
              title="The raw per-turn figures, as the original exports them"
            >
              Download CSV
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <div className="clog__body">
          {/*
            Abilities that fired before anybody swung. The chain snapshots the
            line-ups before `prepare_buff` runs, so these changes are visible
            nowhere else at all.
          */}
          {replay.openingEffects.length > 0 && (
            <article className="clog__turn clog__turn--opening">
              <span className="clog__n">—</span>
              <div className="clog__what">
                <p className="clog__line">
                  <strong>Before the first blow</strong>
                </p>
                {replay.openingEffects.map((e, j) => (
                  <Effect key={j} effect={e} nameOf={nameOf} />
                ))}
              </div>
            </article>
          )}

          {shown.map(({ t, i }) => (
            <article
              className={`clog__turn${t.killed ? ' clog__turn--ko' : ''}`}
              key={i}
            >
              <span className="clog__n">{i + 1}</span>

              <div className="clog__what">
                <p className="clog__line">
                  <span className={`clog__who clog__who--${sideOf(t.attackerUid)}`}>
                    {nameOf(t.attackerUid)}
                  </span>
                  <span className="clog__owner clog__wide">{ownerOf(t.attackerUid)}</span>
                  <span className="clog__verb">hit</span>
                  <span className={`clog__who clog__who--${sideOf(t.defenderUid)}`}>
                    {nameOf(t.defenderUid)}
                  </span>
                  <span className="clog__owner clog__wide">{ownerOf(t.defenderUid)}</span>
                  <span className="clog__for">for</span>
                  <strong className="clog__dmg mono">
                    {formatScaled(t.damage)}
                  </strong>
                </p>

                {/*
                  What the number was made of. Damage on its own says nothing
                  about why it was small: an elemental resistance eating half
                  the blow reads identically to a weak attacker until the
                  blocked figure is next to it.
                */}
                <p className="clog__meta mono">
                  {/*
                    The two a phone keeps. How much of the swing got through
                    and what it left standing are the whole of "was that blow
                    a problem"; everything after them is why.
                  */}
                  <span title="Share of the attacker's damage that got through">
                    {Math.round(t.effectiveness)}% landed
                  </span>
                  <span title="The defender's health before and after the blow">
                    {formatScaled(t.defenderHealthBefore)} →{' '}
                    {formatScaled(t.defenderHealthAfter)} HP
                  </span>

                  {t.blocked > 0 && (
                    <span
                      className="clog__wide"
                      title="Absorbed by resistance to the attacker's element"
                    >
                      {formatScaled(t.blocked)} blocked
                    </span>
                  )}
                  {t.element && (
                    <span className="clog__wide clog__element">{t.element}</span>
                  )}
                  {/*
                    Damage past the defender's last point of health. The
                    contract clamps it, so a 300 hit on a fighter with 40 left
                    is recorded as 40 — and a player reading a log to work out
                    whether a swap would have saved somebody cannot see how
                    far past dead the blow went unless it is said.
                  */}
                  {t.raw > t.damage && (
                    <span
                      className="clog__wide"
                      title="Damage past the defender's remaining health, which the contract discards"
                    >
                      {formatScaled(t.raw - t.damage)} overkill
                    </span>
                  )}
                  <span
                    className="clog__wide"
                    title="The attacker's own health as it swung"
                  >
                    attacker on {formatScaled(t.attackerHealth)} HP
                  </span>
                </p>

                {t.effects.map((e, j) => (
                  <Effect key={j} effect={e} nameOf={nameOf} />
                ))}

                {t.killed && (
                  <p className="clog__ko">
                    {nameOf(t.defenderUid)} is knocked out
                  </p>
                )}
              </div>
            </article>
          ))}

          {shown.length === 0 && (
            <p className="muted">
              No abilities fired and nobody went down — every blow in this
              fight was plain damage.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
