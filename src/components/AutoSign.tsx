import { useEffect, useState } from 'react'
import { showToast } from '@/components/toasts'
import { useGame } from '@/state/useGame'
import { AUTO_SIGN_GROUPS, savedGroups, type AutoSignGroup } from '@/wharf/autoSign'
import { applyAutoSign, autoSignState } from '@/wharf/autoSignSetup'
import { isUserCancel, readableError } from '@/wharf/errors'

/**
 * Auto-signing, on the Account screen.
 *
 * The player picks what the game may sign by itself, and one wallet
 * approval puts a key for exactly those actions on their account. Sending
 * WAX, Trilium or NFTs is never on the list — see `autoSign.ts` — so the
 * worst a key in this browser can do is play the game.
 */
export function AutoSign() {
  const session = useGame((s) => s.session)
  const [chosen, setChosen] = useState<string[]>(savedGroups)
  const [live, setLive] = useState<string[]>([])
  const [active, setActive] = useState(false)
  const [elsewhere, setElsewhere] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    if (!session) {
      setLoading(false)
      return
    }
    void autoSignState(session).then((state) => {
      if (!current) return
      setChosen(state.groups)
      setLive(state.groups)
      setActive(state.active)
      setElsewhere(state.elsewhere)
      setLoading(false)
    })
    return () => {
      current = false
    }
  }, [session])

  const changed = chosen.length !== live.length || chosen.some((id) => !live.includes(id))

  function toggle(id: string, on: boolean) {
    setChosen((ids) => (on ? [...ids, id] : ids.filter((other) => other !== id)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await applyAutoSign(session, chosen)
      setLive(chosen)
      setActive(chosen.length > 0)
      setElsewhere(false)
      showToast(chosen.length ? 'Auto-signing updated.' : 'Auto-signing turned off.')
    } catch (err) {
      if (!isUserCancel(err)) setError(readableError(err))
    } finally {
      setSaving(false)
    }
  }

  const row = (group: AutoSignGroup) => {
    const on = chosen.includes(group.id)
    return (
      <label key={group.id} className={`autosign__group${on ? ' autosign__group--on' : ''}`}>
        <span className="toggle">
          <input
            type="checkbox"
            checked={on}
            disabled={!session || loading || saving}
            onChange={(e) => toggle(group.id, e.target.checked)}
          />
          <span className="toggle__track" aria-hidden="true">
            <span className="toggle__thumb" />
          </span>
        </span>
        <span className="autosign__text">
          <strong>{group.label}</strong>
          <span>{group.note}</span>
          {group.asks && <small>{group.asks}</small>}
        </span>
      </label>
    )
  }

  return (
    <section className="panel autosign">
      <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
        <h2 className="panel__title">Sign by itself</h2>
        {active && <span className="autosign__on">ON</span>}
      </div>

      <p className="autosign__lead">
        Pick what the game may sign without opening your wallet. A key for exactly those actions is
        kept in this browser and added to your account; everything else still asks, and you can
        turn it off here at any time.
      </p>
      <p className="autosign__never">
        Sending WAX, Trilium or NFTs always needs manual confirmation.
      </p>

      {elsewhere && (
        <p className="autosign__hint autosign__hint--warn">
          A key is on your account but not in this browser. Applying here replaces it.
        </p>
      )}

      <div className="autosign__groups">{AUTO_SIGN_GROUPS.map(row)}</div>

      <div className="autosign__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!session || loading || saving || !changed}
          onClick={() => void save()}
        >
          {saving && <span className="spinner" />}
          {chosen.length === 0 && live.length > 0 ? 'Turn auto-signing off' : 'Apply'}
        </button>
        {changed && !saving && session && (
          <span className="autosign__hint">Your wallet asks once to confirm.</span>
        )}
        {!loading && !session && (
          <span className="autosign__hint">Connect your wallet to set this up.</span>
        )}
        {error && <span className="autosign__hint autosign__hint--warn">{error}</span>}
      </div>
    </section>
  )
}
