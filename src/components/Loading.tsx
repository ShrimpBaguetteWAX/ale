/**
 * The one loading state: a thin cyan bar sweeping along the top of the page.
 *
 * Lifted out of `App` so a screen can keep it up past the point the route
 * chunk arrives. A route that renders its frame the moment its code loads
 * puts an empty version of itself on screen — zero fighters, blank cards,
 * "0 DMG · 0 HP" — and then fills it in, which reads as the screen having
 * loaded wrongly rather than as it still loading.
 *
 * The page underneath stays empty and calm; the bar alone says something is
 * on its way. It runs along the top of the page area — under the phone's top
 * bar or beside the desktop's menu. Before the game has a frame at all, boot
 * shows the BootScreen instead. What is being loaded ("Entering the dungeon") is said
 * to assistive technology rather than printed.
 */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="pageload" role="status" aria-live="polite" aria-label={label}>
      <i aria-hidden="true" />
    </div>
  )
}
