/**
 * The one loading state.
 *
 * Lifted out of `App` so a screen can keep it up past the point the route
 * chunk arrives. A route that renders its frame the moment its code loads
 * puts an empty version of itself on screen — zero fighters, blank cards,
 * "0 DMG · 0 HP" — and then fills it in, which reads as the screen having
 * loaded wrongly rather than as it still loading.
 */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="row"
      style={{ justifyContent: 'center', padding: 'var(--sp-20)', gap: 'var(--sp-3)' }}
    >
      <span className="spinner" />
      <span className="muted">{label}…</span>
    </div>
  )
}
