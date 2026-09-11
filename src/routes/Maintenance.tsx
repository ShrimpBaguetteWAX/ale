import { useLayoutEffect, useRef, useState } from 'react'
import { GameLogo } from '@/components/GameLogo'
import { NetworkStatus } from '@/components/NetworkStatus'
import { asset } from '@/assets'

/**
 * The game, paused.
 *
 * `admin.ale/pausegame` stops every contract at once, so there is nothing a
 * player can usefully do until it is lifted — which is why this replaces the
 * app rather than sitting inside it. A menu that still offers fourteen
 * sections, all of which reject anything signed, is a worse answer than one
 * screen that says what is happening.
 *
 * The notices are the reason it exists. `pausegame` posts the first, and
 * `newmessage` appends as the work goes on, so the list is a running account
 * of an outage rather than a single fixed apology. Newest first here: the last
 * thing posted is the current state of play, and it is what somebody who has
 * been staring at this screen for twenty minutes came back to read.
 */
export function Maintenance({ updates }: { updates: string[] }) {
  /* The contract appends, so the row is oldest-first. */
  const newest = [...updates].reverse()

  /*
     Whether the feed actually has more than it can show.

     The fade at its foot is a scroll affordance, and painting one over a list
     that fits dims the last notice for nothing — on the common outage, which
     is a single sentence, that is most of the only thing on the screen. So it
     is measured rather than assumed.

     A layout effect, before the browser paints, so the fade never flashes on
     and off. No ResizeObserver: the content is fixed for a given set of
     notices, and re-measuring on `updates` catches every way it can change.
  */
  const list = useRef<HTMLOListElement>(null)
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [updates])

  return (
    <div className="auth maint">
      <img
        className="auth__art"
        src={asset('/assets/background/bg-maintenance.png')}
        alt=""
      />
      <div className="auth__scrim" />

      <div className="auth__card panel maint__card">
        <GameLogo className="auth__logo" />

        <span className="tag maint__tag">
          <span className="maint__pulse" aria-hidden="true" />
          Under maintenance
        </span>

        <h1 className="auth__title">The game is paused</h1>
        <p className="auth__lead">
          Alien Legends is down for work on the contracts. Nothing can be
          signed until it is back, and nothing you own is affected.
        </p>

        {newest.length > 0 && (
          /*
             `role="log"` rather than a plain list: entries arrive while the
             player is looking at the screen, and this is what tells a reader
             using a screen reader that the region updates on its own.
          */
          <div
            className={'maint__feed' + (overflows ? ' maint__feed--more' : '')}
            role="log"
            aria-live="polite"
          >
            <h2 className="maint__feedhead">Updates</h2>
            <ol className="maint__list" ref={list}>
              {newest.map((text, i) => {
                /*
                   Singling out the newest is only meaningful when there is
                   something for it to be newer than. On the usual outage —
                   one notice, posted by `pausegame` and never added to — both
                   the badge and the highlight would be decorating the only
                   thing on the screen.
                */
                const latest = i === 0 && newest.length > 1
                return (
                  <li
                    className={'maint__item' + (latest ? ' maint__item--latest' : '')}
                    key={`${i}-${text}`}
                  >
                    {latest && <span className="maint__latest">Latest</span>}
                    <p className="maint__text">{text}</p>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        <p className="maint__foot">
          {/*
             No reload button and no countdown.

             The screen re-reads the row on its own every twenty seconds and
             puts itself away the moment the pause lifts, so a button would be
             offering to do what is already happening. A countdown would be
             worse: the contract stores no end time, so any number here would
             be invented.
          */}
          This page checks for itself and will return to the game as soon as
          the pause is lifted.
        </p>

        <NetworkStatus />
      </div>
    </div>
  )
}
