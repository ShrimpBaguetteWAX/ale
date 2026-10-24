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
  const { session, chosen, live, active, elsewhere, loading, saving, error, changed, toggle, save } =
    useAutoSign()

  const row = (group: AutoSignGroup) => (
    <AutoSignRow
      key={group.id}
      group={group}
      on={chosen.includes(group.id)}
      disabled={!session || loading || saving}
      onToggle={(on) => toggle(group.id, on)}
    />
  )

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

type Mode = 'off' | 'all' | 'custom'

/**
 * Auto-signing on a phone: three choices instead of fourteen switches up
 * front. Off, Everything — every group, which still never sends WAX, Trilium
 * or NFTs — or Custom, which opens the switches.
 */
export function PhoneAutoSign() {
  const { session, chosen, setChosen, live, active, elsewhere, loading, saving, error, changed, toggle, save } =
    useAutoSign()
  const all = AUTO_SIGN_GROUPS.map((g) => g.id)
  const picked: Mode =
    chosen.length === 0 ? 'off' : all.every((id) => chosen.includes(id)) ? 'all' : 'custom'
  /* Custom stays open once chosen, even while its switches happen to match Off or Everything. */
  const [custom, setCustom] = useState(false)
  useEffect(() => {
    if (!loading && picked === 'custom') setCustom(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])
  const mode: Mode = custom ? 'custom' : picked
  const locked = !session || loading || saving

  const choose = (next: Mode) => {
    setCustom(next === 'custom')
    if (next === 'off') setChosen([])
    if (next === 'all') setChosen(all)
  }

  const options: [Mode, string, string][] = [
    ['off', 'Off', 'Your wallet asks every time.'],
    ['all', 'Everything', `All ${all.length} — still never WAX, Trilium or NFTs.`],
    ['custom', 'Custom', 'Choose each one yourself.'],
  ]

  return (
    <div className="pauto">
      <div className="rsheet__cap">
        Sign by itself
        {active && <span className="pauto__on">ON</span>}
      </div>
      {options.map(([key, label, note]) => (
        <button
          type="button"
          key={key}
          className={`pauto__opt${mode === key ? ' is-on' : ''}`}
          aria-pressed={mode === key}
          disabled={locked}
          onClick={() => choose(key)}
        >
          <span className="pauto__radio" aria-hidden="true" />
          <span className="pauto__text">
            <b>{label}</b>
            <small>{note}</small>
          </span>
          {key === 'custom' && mode === 'custom' && (
            <em className="mono">
              {chosen.length} of {all.length}
            </em>
          )}
        </button>
      ))}

      {mode === 'custom' && (
        <div className="pauto__groups">
          {AUTO_SIGN_GROUPS.map((group) => (
            <AutoSignRow
              key={group.id}
              group={group}
              on={chosen.includes(group.id)}
              disabled={locked}
              onToggle={(on) => toggle(group.id, on)}
            />
          ))}
        </div>
      )}

      <p className="pauto__never">Sending WAX, Trilium or NFTs always needs your wallet.</p>
      {elsewhere && (
        <p className="pauto__hint pauto__hint--warn">
          A key is on your account but not in this browser. Applying here replaces it.
        </p>
      )}

      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={locked || !changed}
        onClick={() => void save()}
      >
        {saving && <span className="spinner" />}
        {chosen.length === 0 && live.length > 0 ? 'Turn auto-signing off' : 'Apply'}
      </button>
      {changed && !saving && session && (
        <p className="pauto__hint">Your wallet asks once to confirm.</p>
      )}
      {!loading && !session && <p className="pauto__hint">Connect your wallet to set this up.</p>}
      {error && <p className="pauto__hint pauto__hint--warn">{error}</p>}
    </div>
  )
}

function AutoSignRow({
  group,
  on,
  disabled,
  onToggle,
}: {
  group: AutoSignGroup
  on: boolean
  disabled: boolean
  onToggle: (on: boolean) => void
}) {
  return (
    <label className={`autosign__group${on ? ' autosign__group--on' : ''}`}>
      <span className="toggle">
        <input
          type="checkbox"
          checked={on}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
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

/** What is set, what is being chosen, and saving it — shared by both layouts. */
function useAutoSign() {
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

  return {
    session,
    chosen,
    setChosen,
    live,
    active,
    elsewhere,
    loading,
    saving,
    error,
    changed,
    toggle,
    save,
  }
}
