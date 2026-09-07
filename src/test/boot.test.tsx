import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequirePlayer } from '@/App'
import { useGame } from '@/state/useGame'

/**
 * What a refresh looks like to a player who is already signed in.
 *
 * It used to be three screens in a row: "Connecting to WAX", a flash of the
 * wallet picker, then "Loading your commander". The picker is the one that
 * mattered — it is not a loading state, it is a different destination, and
 * for a moment the game told a returning player they had no wallet.
 *
 * The cause is that boot reaches `ready` once the node pool and config are
 * in, which is *before* the wallet SDK has been imported. Restoring a stored
 * session takes a chunk load and a round trip after that, and in that window
 * `account` is legitimately null. The gate read null as "not connected".
 */

/** The gate, with somewhere to be sent and something to arrive at. */
function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/map']}>
      <Routes>
        <Route element={<RequirePlayer />}>
          <Route path="/map" element={<p>the game</p>} />
        </Route>
        <Route path="/connect" element={<p>wallet picker</p>} />
        <Route path="/signup" element={<p>signup</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useGame.setState({
    phase: 'ready',
    account: null,
    player: null,
    playerLoaded: false,
    sessionChecked: false,
  } as never)
})

describe('the boot gate', () => {
  it('waits rather than calling a returning player a visitor', () => {
    /*
       The regression this file exists for. `phase` is already `ready` and
       there is no account yet, which is exactly the state a returning player
       passes through — and the state that used to bounce them.
    */
    renderGate()

    expect(screen.queryByText('wallet picker')).toBeNull()
    expect(document.querySelector('.spinner')).not.toBeNull()
  })

  it('sends a genuine visitor to the picker once boot has decided', () => {
    /* The other half: waiting must not become hiding. Nobody who really has
       no wallet should be left looking at a spinner. */
    useGame.setState({ sessionChecked: true } as never)
    renderGate()

    expect(screen.getByText('wallet picker')).toBeInTheDocument()
  })

  it('keeps the same spinner up while the player row is still coming', () => {
    /* One continuous loading state, not a second labelled one: the account is
       known, the row is not here yet, and nothing has moved on screen. */
    useGame.setState({ sessionChecked: true, account: 'smoke.wam' } as never)
    renderGate()

    expect(document.querySelector('.spinner')).not.toBeNull()
    expect(screen.queryByText('wallet picker')).toBeNull()
  })

  it('shows the game once there is a player', () => {
    useGame.setState({
      sessionChecked: true,
      account: 'smoke.wam',
      playerLoaded: true,
      player: { wallet: 'smoke.wam' },
    } as never)
    renderGate()

    expect(screen.getByText('the game')).toBeInTheDocument()
  })

  it('sends a connected wallet with no player row to signup', () => {
    useGame.setState({
      sessionChecked: true,
      account: 'smoke.wam',
      playerLoaded: true,
      player: null,
    } as never)
    renderGate()

    expect(screen.getByText('signup')).toBeInTheDocument()
  })

  it('does not hold the spinner up when there is no node to talk to', () => {
    /*
       Offline still has to reach a screen that can say so. Waiting on a
       session that can never be restored would trade a flash for a hang,
       which is the worse of the two.
    */
    useGame.setState({ phase: 'offline', sessionChecked: true } as never)
    renderGate()

    expect(screen.getByText('wallet picker')).toBeInTheDocument()
  })
})
