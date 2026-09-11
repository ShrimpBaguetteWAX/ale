/**
 * The maintenance screen, without pausing the game.
 *
 * Open http://localhost:5273/harness/maintenance.html with the dev server
 * running. Not part of the build — Vite only emits the entries in its config,
 * and this directory is not one of them.
 *
 *   ?notices=live     the message on `admin.ale/maintenance` right now
 *   ?notices=one      a single notice, the shape `pausegame` alone leaves
 *   ?notices=none     paused with nothing posted yet
 *   ?notices=many     a long outage, to prove the feed scrolls inside the card
 *   ?notices=long     one very long notice with newlines in it
 *
 * The real screen only appears when an admin pauses every contract at once,
 * which is not something that can be done to look at a layout. This mounts it
 * directly with stand-in notices.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Maintenance } from '../src/routes/Maintenance'
 import { endpointPool } from '../src/chain/endpoints'

import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/landing.css'
import '../src/styles/maintenance.css'

/** Verbatim from `admin.ale/maintenance` on mainnet. */
const LIVE = ['Open Alpha has concluded, thanks for testing with us!']

const ONE = [
  'The game is down while we deploy a fix to the battle contract. We expect to be back within the hour.',
]

/**
 * What a real outage looks like by the end: `pausegame` posts the first and
 * `newmessage` appends the rest, so they arrive oldest-first and read as a
 * running account.
 */
const MANY = [
  'The game is down while we deploy a fix to the battle contract. We expect to be back within the hour.',
  'The new battle contract is deployed and we are replaying yesterday’s fights against it to confirm the numbers match.',
  'Replay looks clean. We are working through the arena standings now — no fighter has been lost, and nothing needs to be reclaimed.',
  'Standings are rebuilt. Two dungeons on Magor still need their teams restored before we can open up.',
  'Magor is done. We are running one last check across all six planets and then lifting the pause.',
  'Everything checks out. Opening the game back up now — thank you for waiting.',
]

const LONG = [
  'We have paused the game to deal with a problem in how in-fight healing was\napplied.\n\nNo fighter has been lost and no rewards have been taken. Any fight that ran\nbetween 09:00 and 11:20 UTC will be replayed once we are back, and anything\nit should have paid will be credited automatically. You do not need to do\nanything.',
]

const SETS: Record<string, string[]> = {
  live: LIVE,
  one: ONE,
  none: [],
  many: MANY,
  long: LONG,
}

const which = new URLSearchParams(location.search).get('notices') ?? 'many'

/* The real screen carries the node readout, and it reads 0/12 until something
   probes. Nothing here does, so probe for real — the numbers in a screenshot
   should be numbers a player could actually see. */
void endpointPool.probe(true)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Maintenance updates={SETS[which] ?? MANY} />
  </StrictMode>,
)
