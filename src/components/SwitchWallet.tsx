import { useState } from 'react'
import { useGame } from '@/state/useGame'
import { readableError } from '@/wharf/errors'

/**
 * "Connected as X — switch".
 *
 * Wallets remember the last session, so a player who picked the wrong account
 * lands back on it every visit with nothing on screen offering a way out.
 * This drops the session and reopens the picker in one step, because the
 * point is to end up on a *different* wallet, not merely signed out.
 *
 * If the picker is dismissed the account simply stays disconnected, which is
 * the state the screen already knows how to show.
 */
export function SwitchWallet({ label = 'Connected as' }: { label?: string }) {
  const account = useGame((s) => s.account)
  const connect = useGame((s) => s.connect)
  const disconnect = useGame((s) => s.disconnect)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!account) return null

  const onSwitch = async () => {
    setBusy(true)
    setError(null)
    try {
      await disconnect()
      await connect()
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  /*
     The control gets its own line. Sitting it directly after the account name
     ran the two together as one string — for a screen reader literally, and
     to the eye near enough that the wallet looked like part of the label.
   */
  return (
    <span className="switchwallet">
      <span className="switchwallet__who">
        {label} <strong className="mono">{account}</strong>
      </span>
      <button type="button" onClick={onSwitch} disabled={busy}>
        {busy && <span className="spinner" />}
        {busy ? 'Switching…' : 'Use a different wallet'}
      </button>
      {error && <span className="switchwallet__error">{error}</span>}
    </span>
  )
}
