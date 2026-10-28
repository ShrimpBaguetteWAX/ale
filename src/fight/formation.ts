/**
 * Where each fighter stands when a fight on the ground opens: role lines,
 * ordered by taunt.
 *
 * A team stands in two lines. The melee classes hold the near line, the
 * ranged ones and the casters the far line behind it, and the NFT fighter,
 * which has no class, stands with them. Within each line the fighter with
 * the most taunt stands closest to the enemy, since that is who the other
 * side's blows go to first; and the one fighter with the most taunt on the
 * whole team takes the near line's innermost spot whatever its class — a
 * ranged tank steps forward and its line gives up the place.
 *
 * Taunt is read as the fight opens and the places do not change after: the
 * tank sheds taunt as it is hit, but nobody walks round the field for it.
 * Ties go to the fighter with more health, then to roster order.
 */

/** What the placing needs to know of a fighter. */
export interface Lineup {
  uid: string
  classname: string
  /** Taunt as the fight opens. */
  taunt: number
  /** Health as the fight opens, to break a tie in taunt. */
  health: number
}

/** [x, r]: x from the team's own edge (0) toward the middle (50); r from the far line (0) to the camera (1). */
export type Spot = [x: number, r: number]

const MELEE = new Set(['juggernaut', 'voidwarden', 'astralknight', 'lunatic', 'mindblade', 'tactician'])

/** Whether a class fights up close: "Astral Knight" and "astralknight" alike. */
export function isMelee(classname: string): boolean {
  return MELEE.has(classname.toLowerCase().replace(/[^a-z]/g, ''))
}

/* n points from a to b, evenly; one sits in the middle. */
const spread = (a: number, b: number, n: number) =>
  Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)))

/**
 * Each fighter's spot, by uid. The near line spreads from 14 to 44 and the
 * far one from 10 to 34; a line of more than three staggers, every other
 * fighter half a step back from it, so no one hides behind a neighbour.
 */
export function roleLines(team: Lineup[]): Map<string, Spot> {
  /* Most taunt first; then more health; then whoever came first. */
  const ranked = team
    .map((f, i) => ({ f, i }))
    .sort((a, b) => b.f.taunt - a.f.taunt || b.f.health - a.f.health || a.i - b.i)
    .map(({ f }) => f)
  const lead = ranked[0]
  const near = ranked.filter((f) => f === lead || isMelee(f.classname))
  const far = ranked.filter((f) => !near.includes(f))

  const out = new Map<string, Spot>()
  /* `step` is where every other fighter stands instead, in a line of more than three. */
  const place = (line: Lineup[], from: number, to: number, depth: number, step: Spot) => {
    const xs = spread(from, to, line.length)
    /* From the own edge inward: the least taunt outermost, the most innermost. */
    ;[...line].reverse().forEach((f, k) => {
      const off = line.length > 3 && k % 2 ? step : [0, 0]
      out.set(f.uid, [xs[k] + off[0], depth + off[1]])
    })
  }
  place(near, 14, 44, 0.9, [-2, -0.16])
  place(far, 10, 34, 0.04, [2, 0.14])
  return out
}
