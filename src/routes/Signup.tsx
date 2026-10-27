import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { showToast } from '@/components/toasts'
import { GameLogo } from '@/components/GameLogo'
import { SwitchWallet } from '@/components/SwitchWallet'
import { readableError } from '@/wharf/errors'
import {
  DIRTIES,
  PLAYERTAG_MAX,
  PLAYERTAG_MIN,
  paySignupFee,
  signup,
  validatePlayertag,
} from '@/wharf/actions'
import { settle } from '@/wharf/settle'
import { fetchSignupStat } from '@/chain/queries'
import { NUM_LOCALE } from '@/format'
import { asset, artSet } from '@/assets'

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
  /* The world behind the greeting: one of the six, a different one each visit. */
  const [world] = useState(() => WORLDS[Math.floor(Math.random() * WORLDS.length)])

  useEffect(() => {
    document.title = 'Become a trainer | Alien Legends'
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
    try {
      await paySignupFee(session, config)
      showToast('Fee received. Now pick your trainer name.')
      // The transfer's side effects need a block to land before the
      // signupstat row is readable, so poll briefly instead of guessing.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 700))
        const stat = await fetchSignupStat(account, true)
        if (stat) break
      }
      await refreshPlayer({ force: true })
      settle(DIRTIES.paySignupFee)
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
      settle(DIRTIES.signup)
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(null)
    }
  }

  const fee = feeLabel(config?.signup_fee)
  const paid = signupPending

  return (
    <div className="arrive">
      <img className="arrive__bg" {...artSet('bg-menu')} alt="" />
      <div className="arrive__stars" />
      <div className="arrive__planet" style={{ backgroundImage: `url(${asset(`/assets/maps/${world}.webp`)})` }} />
      <div className="arrive__fade" />
      <div className="arrive__drop" aria-hidden="true">
        <small>Drop zone</small>
        <b>???</b>
        <span>One of six worlds — revealed on landing</span>
      </div>

      <div className="arrive__col">
        <Link to="/" className="arrive__logo">
          <GameLogo />
        </Link>

        <div className="arrive__kicker">{paid ? 'Registered · one step left' : 'Welcome, trainer'}</div>
        <h1 className="arrive__title">
          {paid ? (
            <>
              Now, what do they <em>call you?</em>
            </>
          ) : (
            <>
              Your legend <em>starts here</em>
            </>
          )}
        </h1>
        <p className="arrive__lead">
          {paid
            ? "Pick the name the frontier will know you by — it's how every other player sees you."
            : 'Recruit fighters, raid dungeons, rise through the arenas.'}
        </p>

        {!paid && (
          <div className="arrive__perks">
            <span className="arrive__perk">
              <img src={asset('/assets/icons/energy.svg')} alt="" />
              <b>{config ? config.start_action_points.toLocaleString(NUM_LOCALE) : '—'}</b> energy to start
            </span>
            <span className="arrive__perk">A random planet</span>
          </div>
        )}

        <ol className="arrive__rail" aria-label="Steps">
          <li className={paid ? 'is-done' : 'is-now'}>
            <span>{paid ? '✓' : '1'}</span>
            <b>Register</b>
          </li>
          <li className={`arrive__bar${paid ? ' is-done' : ''}`} aria-hidden="true" />
          <li className={paid ? 'is-now' : undefined}>
            <span>2</span>
            <b>Name</b>
          </li>
          <li className="arrive__bar" aria-hidden="true" />
          <li>
            <span>3</span>
            <b>Land</b>
          </li>
        </ol>

        {blocked && (
          <div className="alert alert--warn">
            The allowlist is currently active and this account is not on it. Signup will be rejected until it is
            added.
          </div>
        )}
        {error && <div className="alert alert--error">{error}</div>}

        {!paid ? (
          <div className="arrive__act">
            <button
              type="button"
              className="btn btn--gold btn--block arrive__btn"
              onClick={() => void payFee()}
              disabled={busy !== null || !config || blocked}
            >
              {busy === 'fee' ? <span className="spinner" /> : <img src={asset('/assets/icons/wax-coin.webp')} alt="" />}
              {busy === 'fee' ? 'Confirm in wallet' : `Register for ${fee}`}
            </button>
            <p className="arrive__fee">
              A one-off fee that pays for your trainer's storage on the WAX chain. <b>Never charged again.</b>
            </p>
          </div>
        ) : (
          <form
            className="arrive__act"
            onSubmit={(e) => {
              e.preventDefault()
              void claim()
            }}
          >
            <label className="arrive__field">
              <span>Trainer name</span>
              <input
                className="arrive__input"
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
              <span className={`arrive__count${tagError ? ' is-error' : ''}`}>
                <span>
                  {tagError ?? `${PLAYERTAG_MIN}–${PLAYERTAG_MAX} characters · how other players see you`}
                </span>
                <b>
                  {tag.trim().length}/{PLAYERTAG_MAX}
                </b>
              </span>
            </label>
            <button type="submit" className="btn btn--primary btn--block arrive__btn" disabled={busy !== null || blocked}>
              {busy === 'signup' && <span className="spinner" />}
              {busy === 'signup' ? 'Landing' : 'Land on your planet'}
            </button>
          </form>
        )}

        <div className="arrive__foot">
          <SwitchWallet label="Signed in as" />
          <Link to="/" className="arrive__back">
            Back to the home page
          </Link>
        </div>
      </div>
    </div>
  )
}

/* The six worlds a new trainer can land on, as the map's own artwork names them. */
const WORLDS = ['eyeke', 'kavian', 'magor', 'naron', 'neri', 'veles']

/* "15.00000000 WAX" as a player reads it: "15 WAX". */
function feeLabel(fee: string | undefined): string {
  if (!fee) return ''
  const [amount, symbol] = fee.split(' ')
  return `${Number(amount).toLocaleString(NUM_LOCALE, { maximumFractionDigits: 2 })} ${symbol ?? ''}`.trim()
}
