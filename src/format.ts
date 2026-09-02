/**
 * Number formatting for the interface.
 *
 * The UI is written in English, so its numbers are grouped in English:
 * `1,000` and `0.2`, never `1.000` and `0,2`.
 *
 * `toLocaleString()` with no locale follows whatever the *machine* is set to,
 * which is not the same question. On a German-configured browser it renders a
 * thousand credits as "1.000" — which a reader of this interface parses as
 * one-point-zero — and a decimal comma sitting in copy that uses points
 * everywhere else. Pinning the locale is the fix; the alternative is
 * translating the whole game, which is a different project.
 *
 * Dates are deliberately *not* pinned. `24.09.2026` and `09/24/2026` are both
 * unambiguous with a four-digit year, and date order is a genuine reader
 * preference rather than part of the interface's language — so those keep
 * following the player's own settings.
 */
export const NUM_LOCALE = 'en-US'

/** A whole number with thousands separators. */
export function formatNumber(value: number): string {
  return value.toLocaleString(NUM_LOCALE)
}

/** A number to a fixed number of decimal places. */
export function formatDecimals(value: number, places: number): string {
  return value.toLocaleString(NUM_LOCALE, {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  })
}
