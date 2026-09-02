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

/**
 * How a raw `permstats` figure becomes the number a player recognises.
 *
 * The contract counts tokens in their smallest unit, so `tlm_earned` arrives
 * as 104762718 for what the game calls 10,476 TLM, `shards_earned` as 594563
 * for 59,456 shards, and `wax_earned` as 16776725695 for 167.76 WAX. Every
 * other tracked stat is already a plain count, and anything missing from this
 * table is left alone.
 *
 * Totals are shown whole, because the fraction at the end of a lifetime
 * figure is noise that only makes the column harder to scan. WAX is the
 * exception: at eight decimal places the amounts these stats reach are small
 * enough that dropping the fraction would print most of them as nothing at
 * all.
 */
const STAT_FORMAT: Record<string, { scale: number; decimals: number }> = {
  shards_earned: { scale: 10, decimals: 0 },
  tlm_earned: { scale: 10_000, decimals: 0 },
  wax_earned: { scale: 100_000_000, decimals: 2 },
}

/** A tracked stat written the way a player reads it. */
export function formatStat(key: string, raw: number): string {
  const { scale, decimals } = STAT_FORMAT[key] ?? { scale: 1, decimals: 0 }
  /*
     Truncated rather than rounded, and truncated on the integer the chain
     actually gave us rather than on a float derived from it: a total should
     never credit a token nobody earned, and 0.1 + 0.2 is why the arithmetic
     stays in whole units until the last step.
  */
  const places = 10 ** decimals
  const value = Math.trunc(Number(raw) / (scale / places)) / places
  return value.toLocaleString(NUM_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
