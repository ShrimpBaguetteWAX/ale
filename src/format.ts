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
 * What a raw `permstats` figure has to be divided by to become the number a
 * player recognises.
 *
 * The contract counts tokens in their smallest unit, so `tlm_earned` arrives
 * as 104762718 for what the game calls 10,476 TLM and `shards_earned` as
 * 594563 for 59,456 shards. Every other tracked stat is already a plain
 * count, and anything missing from this table is left alone.
 */
const STAT_SCALE: Record<string, number> = {
  shards_earned: 10,
  tlm_earned: 10000,
}

/** A tracked stat written the way a player reads it. */
export function formatStat(key: string, raw: number): string {
  const value = Number(raw) / (STAT_SCALE[key] ?? 1)
  /*
     Truncated rather than rounded, and shown whole: these are lifetime
     totals, and the fraction of a token at the end of one is noise that only
     makes the column harder to scan.
  */
  return Math.trunc(value).toLocaleString(NUM_LOCALE)
}
