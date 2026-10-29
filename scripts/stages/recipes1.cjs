const path = require('path')
/*
 * Every land type as a recipe: its floor, the band under the horizon, the things standing on it.
 * `family` groups them in the sheet. `sea` marks water that takes the planet's light.
 */
const SEA_TEAL = [[0, '#a8e2da'], [0.1, '#6fc9c8'], [0.42, '#2e9fb0'], [0.75, '#1f92a6'], [1, '#35b4b6']]
const ROCK_GREY = { a: '#8a8780', b: '#4a4a48', c: '#b6b2a6' }
const PINE_GREEN = { a: '#356b3a', b: '#244d2c', c: '#78b062', d: '#4a3524' }
const BROAD_GREEN = { a: '#4a8a3c', b: '#2f6430', c: '#8ccb5f', d: '#5a4129' }

const RECIPES = [
  /* ---------------- Coast ---------------- */
  {
    name: 'Sandy Coastline',
    family: 'Coast',
    sea: true,
    floor: {
      base: '#d9c48e', mottle: [0.62, 0.5, 0.3], light: [1, 0.95, 0.8], grain: [0.45, 0.35, 0.2],
      marks: [
        { type: 'ripples', n: 46, color: '#b79e68', hi: '#f6ead0', a: 0.55 },
        { type: 'pebbles', n: 44, r: [1, 2.4], colors: ['#8d7d6a', '#a89880', '#c7b595', '#7a6c5e'] },
        { type: 'flecks', n: 50, colors: ['#ffffff', '#f3e6c4', '#d2bc8a'] },
      ],
    },
    band: {
      type: 'shore', fs: 0.075, fill: SEA_TEAL, deep: '#0a4658', glint: '#f4fffb', foam: '#ffffff',
      rim: [
        { from: -0.035, to: 0.008, color: '#bff0e8', a: 0.65 },
        { from: 0, to: 0.02, color: '#b49f74' },
        { from: 0.012, to: 0.05, color: '#e6d6a4', a: 0.85 },
      ],
      rocks: [{ n: 5, dy: 0.06, size: [8, 40], pal: ROCK_GREY }],
    },
    props: [
      { kind: 'palm', zone: 'edge', n: 6, size: [60, 200], pal: { a: '#3f8a46', b: '#245a30', d: '#7a5a3a' } },
      { kind: 'rock', zone: 'edge', n: 5, size: [10, 44], pal: ROCK_GREY },
      { kind: 'log', zone: 'edge', n: 2, size: [8, 26], pal: { a: '#9a7a52', b: '#6a4c30', c: '#c9a878' } },
      { kind: 'tuft', zone: 'fore', n: 12, size: [20, 54], pal: { cols: ['#9aa24a', '#b8b863', '#7a8a3c', '#d2c27a'] } },
    ],
  },

  /* ---------------- Meadow ---------------- */
  {
    name: 'Tree Forest',
    family: 'Meadow',
    floorFile: path.join(__dirname, 'source/forest.webp'),
    wash: ['#4a7a3a', '#1c321c'],
    band: { type: 'ridge', amp: 0.035, low: 0.015, fade: 0.1, top: '#3f7a4c', mid: '#2a5636' },
    props: [
      { kind: 'pine', zone: 'far', n: 120, size: [64, 230], pal: PINE_GREEN, bias: 1.6 },
      { kind: 'treeBroad', zone: 'far', n: 80, size: [64, 230], pal: BROAD_GREEN, bias: 1.6 },
      { kind: 'treeBroad', zone: 'edge', n: 8, size: [110, 300], pal: BROAD_GREEN },
      { kind: 'pine', zone: 'edge', n: 6, size: [120, 320], pal: PINE_GREEN },
      { kind: 'fern', zone: 'fore', n: 6, size: [40, 90], pal: { a: '#3f8a3c', b: '#2a6a30' } },
      { kind: 'log', zone: 'edge', n: 2, size: [14, 40], pal: { a: '#6a4c30', b: '#3f2c1c', c: '#8a6a44' } },
    ],
  },

  /* ---------------- Dunes ---------------- */
  {
    name: 'Dunes',
    family: 'Dunes',
    mist: 'rgb(255 226 160 / 14%)',
    floor: {
      base: '#e2b868', mottle: [0.7, 0.5, 0.25], light: [1, 0.9, 0.65], grain: [0.5, 0.35, 0.15],
      marks: [
        { type: 'ripples', n: 80, color: '#b88a44', hi: '#fbe3a8', a: 0.6 },
        { type: 'flecks', n: 70, colors: ['#fff2c8', '#c89a50', '#ffffff'] },
      ],
    },
    band: { type: 'dunes', layers: 4, from: 0.02, to: 0.17, far: '#ecd09a', near: '#d2a04e', crest: '#fff1c8', fade: 0.1 },
    props: [
      { kind: 'rock', zone: 'edge', n: 5, size: [12, 60], pal: { a: '#b08a5a', b: '#6e5030', c: '#d8b684' } },
      { kind: 'tuft', zone: 'fore', n: 12, size: [20, 60], pal: { cols: ['#a88a3c', '#c9ad5a', '#8a7030'] } },
      { kind: 'tuft', zone: 'edge', n: 8, size: [16, 46], pal: { cols: ['#a88a3c', '#c9ad5a', '#8a7030'] } },
    ],
  },
]

module.exports = { RECIPES, SEA_TEAL, ROCK_GREY, PINE_GREEN, BROAD_GREEN }
