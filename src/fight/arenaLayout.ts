/*
 * Where the arena's live pieces stand, as % of the field: written by
 * scripts/build-stages.cjs from the same geometry that painted the bowl, so
 * the flags and the flames sit on it exactly. Do not edit by hand.
 *
 *   sky   — the height of the sky band
 *   far   — [top, height] of the strip of the planet's country over the rim
 *   haze  — [top, height] of the air over the far wall and stands
 *   flags — [x, y, size, delay, team]: team 0 gold round the rim, 1 and 2 the gates' pennants
 *   fires — [x, y, size, delay] in the braziers
 */
export const ARENA_LAYOUT = {
  "wide": {
    "sky": 38,
    "far": [14.6, 10],
    "haze": [22, 18],
    "flags": [
      [4, 25.28, 4.29, 0, 0],
      [17, 24.15, 3.89, 0.37, 0],
      [30, 23.42, 3.63, 0.74, 0],
      [43, 23.05, 3.51, 1.11, 0],
      [57, 23.05, 3.51, 1.48, 0],
      [70, 23.42, 3.63, 1.85, 0],
      [83, 24.15, 3.89, 2.22, 0],
      [96, 25.28, 4.29, 2.59, 0],
      [18, 28.6, 3.12, 0, 1],
      [82, 28.6, 3.12, 0.9, 2]
    ],
    "fires": [
      [10, 31.69, 1.98, 0],
      [28, 29.8, 1.77, 0.23],
      [72, 29.8, 1.77, 0.46],
      [90, 31.69, 1.98, 0.69]
    ]
  },
  "tall": {
    "sky": 36,
    "far": [23.14, 9],
    "haze": [29.7, 8.3],
    "flags": [
      [6, 32.76, 2.38, 0, 0],
      [24, 31.4, 1.83, 0.37, 0],
      [42, 30.77, 1.58, 0.74, 0],
      [58, 30.77, 1.58, 1.11, 0],
      [76, 31.4, 1.83, 1.48, 0],
      [94, 32.76, 2.38, 1.85, 0],
      [15, 34.57, 1.67, 0, 1],
      [85, 34.57, 1.67, 0.9, 2]
    ],
    "fires": [
      [6, 36.74, 1.15, 0],
      [27, 34.54, 0.86, 0.23],
      [73, 34.54, 0.86, 0.46],
      [94, 36.74, 1.15, 0.69]
    ]
  }
} as const
