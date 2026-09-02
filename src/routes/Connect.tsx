import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { GameLogo } from '@/components/GameLogo'
import { readableError } from '@/wharf/errors'

/**
 * Wallet connect.
 *
 * There is no password and no account to create: the WAX account *is* the
 * identity, and WharfKit's own picker handles the wallet choice. So this
 * screen exists to set expectations — what is about to be asked, and that it
 * costs nothing — and to report failures in plain language.
 */
export function Connect() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const playerLoaded = useGame((s) => s.playerLoaded)
  const connect = useGame((s) => s.connect)
  const phase = useGame((s) => s.phase)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation() as { state?: { from?: string } }

  if (account && playerLoaded) {
    const dest = player ? (location.state?.from ?? '/map') : '/signup'
    return <Navigate to={dest} replace />
  }

  const onConnect = async () => {
    setBusy(true)
    setError(null)
    try {
      await connect()
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <img className="auth__art" src="/assets/background/bg-sign.jpeg" alt="" />
      <div className="auth__scrim" />

      <div className="auth__card panel">
        <Link to="/">
          <GameLogo className="auth__logo" />
        </Link>

        <h1 className="auth__title">Connect your wallet</h1>
        <p className="auth__lead">
          Alien Legends signs every action with your WAX account. Nothing is
          stored on our side and there is no separate password.
        </p>

        <div className="steps">
          <div className="step step--active">
            <span className="step__num">1</span>
            <div>
              <div className="step__title">Pick a wallet</div>
              <p className="step__body">
                Anchor, on desktop or mobile, or MyCloudWallet in the browser.
              </p>
            </div>
          </div>
          <div className="step">
            <span className="step__num">2</span>
            <div>
              <div className="step__title">Approve the login</div>
              <p className="step__body">
                A signature proves you own the account. It is free and moves no
                funds.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: 'var(--sp-4)' }}>
            {error}
          </div>
        )}

        {phase === 'offline' && (
          <div className="alert alert--warn" style={{ marginBottom: 'var(--sp-4)' }}>
            No WAX node is responding right now. Connecting may fail.
          </div>
        )}

        <button
          type="button"
          className="btn btn--primary btn--block btn--lg"
          onClick={() => void onConnect()}
          disabled={busy || phase === 'probing'}
        >
          {busy && <span className="spinner" />}
          {busy ? 'Waiting for wallet' : 'Connect wallet'}
        </button>

        <p className="hint" style={{ textAlign: 'center' }}>
          <Link to="/">Back to the home page</Link>
        </p>
      </div>
    </div>
  )
}
