/**
 * Land IDs are eosio names, so they can't contain digits 0-9 (a `name` only
 * allows `.12345abcdefghijklmnopqrstuvwxyz`). The contract works around this
 * in `users::getlandname` by mapping each decimal digit to a letter and
 * joining the two coordinates with an `x`:
 *
 *   0->a 1->b 2->c 3->d 4->e 5->f 6->g 7->h 8->i 9->j
 *
 *   (10, 1)  -> "ba"  + "x" + "b"  -> "baxb"
 *   (10, 10) -> "ba"  + "x" + "ba" -> "baxba"
 *   (33, 6)  -> "dd"  + "x" + "g"  -> "ddxg"
 *
 * Note this is ambiguous in principle ("baxba" could be (10,10)) but the
 * contract's own bounds (x<=40, y<=20) keep it unique in practice, and we
 * always carry x/y alongside anyway.
 */

const DIGITS = 'abcdefghij'

function encode(n: number): string {
  return String(n)
    .split('')
    .map((d) => DIGITS[Number(d)])
    .join('')
}

function decode(s: string): number {
  let out = ''
  for (const ch of s) {
    const i = DIGITS.indexOf(ch)
    if (i === -1) return NaN
    out += String(i)
  }
  return out.length ? Number(out) : NaN
}

/** Coordinates to the contract's land_id, matching `users::getlandname`. */
export function landId(x: number, y: number): string {
  return `${encode(x)}x${encode(y)}`
}

/** Inverse of `landId`. Returns null if the id isn't well formed. */
export function landCoords(id: string): { x: number; y: number } | null {
  const at = id.indexOf('x')
  if (at <= 0) return null
  const x = decode(id.slice(0, at))
  const y = decode(id.slice(at + 1))
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

/** Travel distance, matching the contract's euclidean `std::sqrt` cost basis. */
export function travelDistance(
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  return Math.sqrt((from.x - to.x) ** 2 + (from.y - to.y) ** 2)
}

/**
 * Action-point cost of a move, mirroring `users::travel`:
 *   cost = base + ceil(distance * distance_cost)   [+ portal_cost on a portal]
 */
export function travelCost(
  from: { x: number; y: number },
  to: { x: number; y: number },
  cfg: { travel_base_cost: number; travel_distance_cost: number; travel_portal_cost: number },
  isPortal = false,
): number {
  const distance = travelDistance(from, to)
  let cost = Math.ceil(distance * cfg.travel_distance_cost) + cfg.travel_base_cost
  if (isPortal) cost += cfg.travel_portal_cost
  return cost
}
