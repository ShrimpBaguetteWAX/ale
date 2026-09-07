/**
 * What the last action said, above the screen it happened on.
 *
 * Nine screens wrote the same two lines, and drifted: some put the error
 * above the notice and some below, and a screen that reads its own data as
 * well as signing had to remember to fold that error in too.
 *
 * The order barely matters in practice — `useAction` clears both before it
 * signs and sets exactly one when it is done, so the two are almost never on
 * screen together — which is precisely why it should not have been a decision
 * made nine times.
 *
 * `error` takes whatever expression the screen wants, including its loader's
 * own error, because "the action failed" and "the page could not be read" are
 * the same thing to a player looking at an empty panel.
 */
export function ActionBanner({
  notice,
  error,
}: {
  notice?: string | null
  error?: string | null
}) {
  if (!notice && !error) return null
  return (
    <>
      {notice && <div className="alert alert--ok">{notice}</div>}
      {error && <div className="alert alert--error">{error}</div>}
    </>
  )
}
