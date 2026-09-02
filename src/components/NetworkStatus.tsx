import { useEffect, useRef, useState } from 'react'
import { reprobe, useNetwork } from '@/state/useNetwork'

function host(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

/**
 * Which WAX nodes answered when the app booted, and how fast.
 *
 * Reads rotate across the healthy ones, so this doubles as the honest answer
 * to "why is the game slow right now" — a player can see the node list and
 * force a re-check instead of guessing.
 */
export function NetworkStatus() {
  const net = useNetwork()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const best = net.healthy[0]
  const label =
    net.state === 'probing'
      ? 'Checking'
      : net.state === 'offline'
        ? 'Offline'
        : `${net.healthy.length}/${net.all.length} · ${Math.round(best?.latency ?? 0)}ms`

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        className={`netdot netdot--${net.state}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="WAX node status"
      >
        <span className="netdot__led" />
        <span className="mono">{label}</span>
      </button>

      {open && (
        <div className="panel netpop">
          <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
            <span className="panel__title">WAX nodes</span>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => void reprobe()}
              disabled={net.state === 'probing'}
            >
              {net.state === 'probing' ? 'Checking…' : 'Re-check'}
            </button>
          </div>

          <div className="netlist">
            {[...net.all]
              .sort((a, b) => a.latency - b.latency)
              .map((e) => (
                <div className="netlist__row" key={e.url}>
                  <span
                    className="netlist__led"
                    style={{ background: e.ok ? 'var(--teal)' : 'var(--red)' }}
                  />
                  <span className="netlist__host">{host(e.url)}</span>
                  <span className="faint">
                    {e.ok ? `${Math.round(e.latency)}ms` : (e.error ?? 'down')}
                  </span>
                </div>
              ))}
          </div>

          <p className="hint">
            Reads rotate across the fastest nodes and fail over automatically.
          </p>
        </div>
      )}
    </div>
  )
}
