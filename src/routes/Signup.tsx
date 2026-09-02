import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { GameLogo } from '@/components/GameLogo'
import { SwitchWallet } from '@/components/SwitchWallet'
import { readableError } from '@/wharf/errors'
import {
  PLAYERTAG_MAX,
  PLAYERTAG_MIN,
  paySignupFee,
  signup,
  validatePlayertag,
} from '@/wharf/actions'
import { fetchSignupStat } from '@/chain/queries'
import { NUM_LOCALE } from '@/format'
import { asset } from '@/assets'

/**
 * Signup is two on-chain steps, because that is how the contract works:
 *
 *  1. Transfer the WAX fee to `players.ale`. Its `eosio.token::transfer`
 *     handler checks the amount, refuses duplicates, writes a `signupstat`
 *     row and forwards the WAX to the fee wallet.
 *  2. Call `signup(wallet, playertag)`, which consumes that row and creates
 *     the player.
 *
 * Because step 1 leaves a durable marker, a player who pays and then closes
 * the tab is resumed straight into step 2 rather than charged twice.
 */
export default function Signup() {
  const account = useGame((s) => s.account)
  const config = useGame((s) => s.config)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)
  const signupPending = useGame((s) => s.signupPending)
  const whitelisted = useGame((s) => s.whitelisted)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [tag, setTag] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState<'fee' | 'signup' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Create your commander | Alien Legends'
  }, [])

  if (!account) return <Navigate to="/connect" replace />
  if (player) return <Navigate to="/map" replace />

  const allowlistActive = !!config?.allowlist_active
  const blocked = allowlistActive && !whitelisted
  const tagError = touched ? validatePlayertag(tag) : null

  const payFee = async () => {
    if (!session || !config) return
    setBusy('fee')
    setError(null)
    setNotice(null)
    try {
      await paySignupFee(session, config)
      setNotice('Fee received. Now pick your commander name.')
      // The transfer's side effects need a block to land before the
      // signupstat row is readable, so poll briefly instead of guessing.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 700))
        const stat = await fetchSignupStat(account, true)
        if (stat) break
      }
      await refreshPlayer({ force: true })
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(null)
    }
  }

  const claim = async () => {
    if (!session) return
    setTouched(true)
    const invalid = validatePlayertag(tag)
    if (invalid) return

    setBusy('signup')
    setError(null)
    try {
      await signup(session, tag.trim())
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 700))
        await refreshPlayer({ force: true })
        if (useGame.getState().player) break
      }
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="auth">
      <img className="auth__art" src={asset("/assets/background/bg-sign.jpeg")} alt="" />
      <div className="auth__scrim" />

      <div className="auth__card panel">
        <Link to="/">
          <GameLogo className="auth__logo" />
        </Link>

        <h1 className="auth__title">Create your commander</h1>
        <p className="auth__lead">
          You will be dropped onto a random planet with{' '}
          {config ? config.start_action_points.toLocaleString(NUM_LOCALE) : '—'} action points.
        </p>

        {/* The fee is paid from this account, so it is worth a second look. */}
        <p className="auth__wallet">
          <SwitchWallet label="Signing up as" />
        </p>

        {blocked && (
          <div className="alert alert--warn" style={{ margin: 'var(--sp-5) 0' }}>
            The allowlist is currently active and this account is not on it.
            Signup will be rejected until it is added.
          </div>
        )}

        <div className="steps">
          <div className={`step ${signupPending ? 'step--done' : 'step--active'}`}>
            <span className="step__num">{signupPending ? '✓' : '1'}</span>
            <div>
              <div className="step__title">Pay the signup fee</div>
              <p className="step__body">
                {signupPending
                  ? 'Already paid. Nothing more to send.'
                  : `A one-off ${config?.signup_fee ?? '—'} transfer that covers the
                     RAM your commander occupies on chain.`}
              </p>
            </div>
          </div>

          <div className={`step ${signupPending ? 'step--active' : ''}`}>
            <span className="step__num">2</span>
            <div>
              <div className="step__title">Choose a name</div>
              <p className="step__body">
                {PLAYERTAG_MIN}–{PLAYERTAG_MAX} characters. This is how other
                players see you.
              </p>
            </div>
          </div>
        </div>

        {notice && (
          <div className="alert alert--ok" style={{ marginBottom: 'var(--sp-4)' }}>
            {notice}
          </div>
        )}
        {error && (
          <div className="alert alert--error" style={{ marginBottom: 'var(--sp-4)' }}>
            {error}
          </div>
        )}

        {!signupPending ? (
          <button
            type="button"
            className="btn btn--gold btn--block"
            onClick={() => void payFee()}
            disabled={busy !== null || !config || blocked}
          >
            {busy === 'fee' && <span className="spinner" />}
            {busy === 'fee' ? 'Confirm in wallet' : `Pay ${config?.signup_fee ?? ''}`}
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void claim()
            }}
          >
            <label className="field" style={{ marginBottom: 'var(--sp-4)' }}>
              <span className="field__label">Commander name</span>
              <input
                className="input"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="e.g. Shade"
                maxLength={PLAYERTAG_MAX}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={!!tagError}
                disabled={busy !== null}
              />
              <span className={`hint${tagError ? ' hint--error' : ''}`}>
                {tagError ?? `${tag.trim().length}/${PLAYERTAG_MAX} characters`}
              </span>
            </label>

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={busy !== null || blocked}
            >
              {busy === 'signup' && <span className="spinner" />}
              {busy === 'signup' ? 'Creating' : 'Enter the frontier'}
            </button>
          </form>
        )}

        <p className="hint" style={{ textAlign: 'center' }}>
          <Link to="/">Back to the home page</Link>
        </p>
      </div>
    </div>
  )
}
