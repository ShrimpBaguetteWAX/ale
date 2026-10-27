import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { EmblemRing } from '@/components/BootScreen'
import { readableError } from '@/wharf/errors'

/**
 * Wallet connect.
 *
 * There is no password and no account to create: the WAX account *is* the
 * identity, and WharfKit's own picker handles the wallet choice. So this
 * screen is the game's emblem, one button and one line that it costs
 * nothing — the boot screen's ring at rest, so loading, connecting and the
 * game read as one scene — plus a failure, in plain language, when there is
 * one. The picker that opens next explains the rest.
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
    <div className="connect">
      <Link className="connect__back" to="/">
        ← Back
      </Link>

      <EmblemRing className="connect__ring" />

      {(error || phase === 'offline') && (
        <div className="connect__note" role="alert">
          {error ?? 'No WAX node is responding right now. Connecting may fail.'}
        </div>
      )}

      <button
        type="button"
        className="btn btn--primary btn--lg connect__go"
        onClick={() => void onConnect()}
        disabled={busy || phase === 'probing'}
      >
        {busy && <span className="spinner" />}
        {busy ? 'Waiting for wallet' : error ? 'Try again' : 'Connect wallet'}
      </button>
      <span className="connect__fine">Anchor or MyCloudWallet · free, moves no funds</span>
    </div>
  )
}
