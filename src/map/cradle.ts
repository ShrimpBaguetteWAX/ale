/**
 * The cradle under and over the player's pin: two plates carved around it.
 *
 * Geometry only, in a 300×300 box with the pin at the origin and y growing
 * downward, as SVG has it. A plate is a rectangle with a circular bite taken
 * out of the edge that faces the pin, so the halo nests into it and the
 * text on the plate stays straight.
 */

export interface PlateSpec {
  /** Full width. */
  w: number
  /** The edge away from the pin, signed y. */
  far: number
  /** The edge toward the pin, signed y; the bite is cut out of this one. */
  near: number
  /** Radius of the bite, about the pin. */
  r: number
  /** Corner radius on the far edge. */
  rc?: number
  /** Corner radius where the near edge meets the sides. */
  rn?: number
  /** Whether the plate sits above the pin. */
  top: boolean
}

const f = (n: number) => String(Number(n.toFixed(2)))

/** The plate's outline as an SVG path. */
export function platePath({ w, far, near, r, rc = 0, rn = 0, top }: PlateSpec): string {
  const x = Math.sqrt(Math.max(0, r * r - near * near))
  const L = -w / 2
  const R = w / 2
  if (top) {
    return [
      `M${f(L + rc)},${far}`,
      `H${f(R - rc)}`,
      rc ? `Q${R},${far} ${R},${f(far + rc)}` : '',
      `V${f(near - rn)}`,
      rn ? `Q${R},${near} ${f(R - rn)},${near}` : '',
      `H${f(x)}`,
      `A${r},${r} 0 0 0 ${f(-x)},${near}`,
      `H${f(L + rn)}`,
      rn ? `Q${L},${near} ${L},${f(near - rn)}` : '',
      `V${f(far + rc)}`,
      rc ? `Q${L},${far} ${f(L + rc)},${far}` : '',
      'Z',
    ]
      .filter(Boolean)
      .join(' ')
  }
  return [
    `M${f(L + rn)},${near}`,
    `H${f(-x)}`,
    `A${r},${r} 0 0 0 ${f(x)},${near}`,
    `H${f(R - rn)}`,
    rn ? `Q${R},${near} ${R},${f(near + rn)}` : '',
    `V${f(far - rc)}`,
    rc ? `Q${R},${far} ${f(R - rc)},${far}` : '',
    `H${f(L + rc)}`,
    rc ? `Q${L},${far} ${L},${f(far - rc)}` : '',
    `V${f(near + rn)}`,
    rn ? `Q${L},${near} ${f(L + rn)},${near}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * How wide the plates have to be for what is written on them.
 *
 * An estimate from the glyph count, since the SVG is built before it is
 * laid out: the name in Titillium at 13px runs about 7.2px a glyph, the
 * kind line in spaced Orbitron at 9px about 7.6px. Never narrower than the
 * bite needs to look like a cradle rather than a notch.
 */
export function plateWidth(name: string, kind: string, go: string): number {
  const need = Math.max(name.length * 7.2, kind.length * 7.6, go.length * 8.4)
  return Math.max(176, Math.ceil(need + 40))
}
