const path = require('path')
/* The rest of the land types. Same shape as lands-recipes.cjs. */
const { SEA_TEAL, ROCK_GREY } = require('./recipes1.cjs')
const SEA_DEEP = [[0, '#9ccdd8'], [0.1, '#5aa0b8'], [0.45, '#2a6f90'], [0.8, '#1c5c7c'], [1, '#2b7a98']]
const BASALT = { a: '#3a2c28', b: '#140c0a', c: '#6a5048' }
const GREENS = { a: '#4a8a3c', b: '#2f6430', c: '#8ccb5f', d: '#5a4129' }
const SAND_ROCK = { a: '#b08a5a', b: '#6e5030', c: '#d8b684' }
const ICE = { a: '#a9cde8', b: '#5f86ae', c: '#e8f6ff', snow: '#ffffff' }

const RECIPES = [
  /* ---------------- Coast ---------------- */
  {
    name: 'Rocky Coastline', family: 'Coast', sea: true,
    floor: {
      base: '#6f7078', mottle: [0.3, 0.32, 0.36], light: [0.7, 0.72, 0.76], grain: [0.1, 0.1, 0.12],
      marks: [
        { type: 'pebbles', n: 130, r: [1, 3.4], colors: ['#8a8c92', '#5e6066', '#a4a6ac', '#46484e'] },
        { type: 'cracks', n: 10, color: '#2a2c30', w: 1.4 },
        { type: 'blots', n: 8, r: [14, 34], colors: ['#4a6a40'], a: 0.3 },
      ],
    },
    band: {
      type: 'shore', fs: 0.07, fill: SEA_DEEP, deep: '#06293a', glint: '#e8f6ff', foam: '#ffffff',
      rim: [
        { from: -0.03, to: 0.008, color: '#8ec8d0', a: 0.55 },
        { from: 0, to: 0.025, color: '#4a4d52' },
        { from: 0.01, to: 0.04, color: '#6a6c70', a: 0.9 },
      ],
      rocks: [{ n: 16, dy: 0.06, size: [10, 62], pal: { a: '#6f7078', b: '#34363a', c: '#a4a6ac' } }],
    },
    props: [
      { kind: 'spire', zone: 'far', n: 6, size: [24, 90], pal: { a: '#5e6066', b: '#2e3034', c: '#9a9ca2' }, y: [0.01, 0.1] },
      { kind: 'boulders', zone: 'edge', n: 6, size: [30, 110], pal: { a: '#6f7078', b: '#34363a', c: '#a4a6ac' } },
      { kind: 'tuft', zone: 'fore', n: 8, size: [20, 50], pal: { cols: ['#5a7a46', '#7a9a5a', '#4a6a3a'] } },
    ],
  },
  {
    name: 'Small Island', family: 'Coast', sea: true,
    floor: {
      base: '#d4c48c', mottle: [0.6, 0.5, 0.3], light: [1, 0.95, 0.8], grain: [0.45, 0.35, 0.2],
      marks: [
        { type: 'ripples', n: 30, color: '#b79e68', hi: '#f6ead0', a: 0.5 },
        { type: 'tufts', n: 40, h: [8, 16], colors: ['#7a9a46', '#9ab85a', '#5a7a36'] },
        { type: 'flecks', n: 40, colors: ['#ffffff', '#f3e6c4'] },
      ],
    },
    band: {
      type: 'shore', fs: 0.06, wrap: 0.58, fill: SEA_TEAL, deep: '#0a4658', glint: '#f4fffb', foam: '#ffffff',
      rim: [
        { from: -0.035, to: 0.01, color: '#bff0e8', a: 0.65 },
        { from: 0, to: 0.02, color: '#b49f74' },
        { from: 0.012, to: 0.05, color: '#e6d6a4', a: 0.85 },
      ],
      rocks: [{ n: 8, dy: 0.05, size: [8, 38], pal: ROCK_GREY }],
    },
    props: [
      { kind: 'palm', zone: 'edge', n: 6, size: [80, 220], pal: { a: '#3f8a46', b: '#245a30', d: '#7a5a3a' }, y: [0.7, 0.9] },
      { kind: 'bush', zone: 'edge', n: 4, size: [24, 60], pal: { a: '#4a8a3c', b: '#2f6430', c: '#8ccb5f' }, y: [0.7, 0.92] },
      { kind: 'tuft', zone: 'fore', n: 10, size: [20, 52], pal: { cols: ['#9aa24a', '#b8b863', '#7a8a3c'] } },
    ],
  },

  /* ---------------- Meadow ---------------- */
  {
    name: 'Grassland', family: 'Meadow',
    floor: {
      base: '#6fae3c', mottle: [0.2, 0.4, 0.1], light: [0.8, 0.9, 0.4], grain: [0.1, 0.2, 0.05],
      marks: [
        { type: 'blades', n: 1500, len: [7, 19], w: [1.3, 2.6], colors: ['#4a8a2a', '#5fa535', '#7ac043', '#94d052', '#b4dc6a'] },
        { type: 'flowers', n: 110, colors: ['#ffffff', '#ffe35a', '#ff9ac2', '#a9c9ff', '#ff7a5a'] },
      ],
    },
    band: { type: 'ridge', amp: 0.03, low: 0.012, fade: 0.13, top: '#86c85e', mid: '#4f9a3c' },
    props: [
      { kind: 'treeBroad', zone: 'far', n: 16, size: [48, 150], pal: GREENS, bias: 1.3 },
      { kind: 'bush', zone: 'edge', n: 8, size: [26, 80], pal: { a: '#58a040', b: '#357a30', c: '#9ad46a', d: '#ffd0e0' } },
      { kind: 'tuft', zone: 'fore', n: 16, size: [24, 62], pal: { cols: ['#4a8a2a', '#7ac043', '#94d052'], flower: ['#ffffff', '#ffe35a', '#ff9ac2'] } },
    ],
  },
  {
    name: 'Plains', family: 'Meadow',
    floor: {
      base: '#a9a24a', mottle: [0.4, 0.38, 0.12], light: [0.9, 0.85, 0.45], grain: [0.2, 0.2, 0.05],
      marks: [
        { type: 'blades', n: 1300, len: [8, 20], w: [1.2, 2.2], colors: ['#8a8a3c', '#b5a850', '#c9bf6a', '#7a7a30', '#d6cc86'] },
        { type: 'pebbles', n: 24, r: [1, 2.4], colors: ['#8a7a5a', '#a89a78'] },
        { type: 'tufts', n: 30, h: [10, 20], colors: ['#8a8a3c', '#c9bf6a'] },
      ],
    },
    band: { type: 'ridge', amp: 0.02, low: 0.01, fade: 0.12, top: '#c0bc78', mid: '#8f8d4a' },
    props: [
      { kind: 'bush', zone: 'far', n: 60, size: [16, 46], pal: { a: '#8a9a3c', b: '#5e7a2c', c: '#c4d070' }, bias: 1.2 },
      { kind: 'bush', zone: 'edge', n: 12, size: [22, 56], pal: { a: '#8a9a3c', b: '#5e7a2c', c: '#c4d070', d: '#e8d870' } },
      { kind: 'bush', zone: 'fore', n: 6, size: [22, 44], pal: { a: '#8a9a3c', b: '#5e7a2c', c: '#c4d070' } },
      { kind: 'rock', zone: 'edge', n: 4, size: [12, 44], pal: { a: '#9a9078', b: '#5a5444', c: '#c8bea0' } },
      { kind: 'tuft', zone: 'fore', n: 14, size: [24, 60], pal: { cols: ['#8a8a3c', '#b5a850', '#c9bf6a'] } },
    ],
  },
  {
    name: 'Mushroom Forest', family: 'Meadow', mist: 'rgb(190 120 255 / 22%)',
    floor: {
      base: '#2a2347', mottle: [0.2, 0.14, 0.36], light: [0.3, 0.75, 0.65], grain: [0.08, 0.05, 0.18],
      marks: [
        { type: 'blots', n: 14, r: [20, 50], colors: ['#3ac8b0', '#a05ae0'], a: 0.18 },
        { type: 'tufts', n: 60, h: [8, 18], colors: ['#4ad8b8', '#7a58c8', '#9a78e8'] },
        { type: 'spores', n: 40, color: '#5affd8', hi: '#e8fff8' },
        { type: 'pebbles', n: 20, r: [1, 2.2], colors: ['#3a3058', '#4a3e6a'] },
      ],
    },
    band: { type: 'ridge', amp: 0.035, low: 0.015, fade: 0.12, top: '#4a3a82', mid: '#2a1f55' },
    props: [
      { kind: 'mush', zone: 'far', n: 50, size: [20, 100], pal: { a: '#c24bd6', b: '#7a2a9a', c: '#ffe9ff', d: '#e8dcf0', glow: '#d46aff' } },
      { kind: 'mush', zone: 'far', n: 40, size: [20, 100], pal: { a: '#2fd0b4', b: '#177e78', c: '#e6fff8', d: '#d8f0e8', glow: '#3affd0' } },
      { kind: 'mushCluster', zone: 'edge', n: 6, size: [90, 250], pal: { a: '#c24bd6', b: '#7a2a9a', c: '#ffe9ff', d: '#e8dcf0', glow: '#d46aff' } },
      { kind: 'mushCluster', zone: 'edge', n: 4, size: [90, 230], pal: { a: '#2fd0b4', b: '#177e78', c: '#e6fff8', d: '#d8f0e8', glow: '#3affd0' } },
      { kind: 'mush', zone: 'fore', n: 8, size: [30, 80], pal: { a: '#c24bd6', b: '#7a2a9a', c: '#ffe9ff', d: '#e8dcf0', glow: '#d46aff' } },
    ],
  },
  {
    name: 'Inland River', family: 'Meadow', sea: true,
    floorFile: path.resolve('public/assets/stages/veles/grass.webp'),
    band: {
      type: 'river', at: 0.13, width: 0.075, fill: [[0, '#7cd0d6'], [0.5, '#2f98b4'], [1, '#3aaabb']], edge: '#e8fbff', glint: '#f4fffb',
      banks: [{ out: 0.022, color: '#3a7a30' }, { out: 0.012, color: '#b9a878' }],
    },
    props: [
      { kind: 'treeBroad', zone: 'far', n: 22, size: [40, 120], pal: GREENS, y: [0.0, 0.12] },
      { kind: 'reeds', zone: 'far', n: 16, size: [14, 44], pal: { a: '#6a8a3a', b: '#3f5a28', d: '#6a4a2a' }, y: [0.12, 0.23] },
      { kind: 'treeBroad', zone: 'edge', n: 5, size: [100, 280], pal: GREENS },
      { kind: 'bush', zone: 'edge', n: 4, size: [24, 70], pal: { a: '#58a040', b: '#357a30', c: '#9ad46a' } },
      { kind: 'tuft', zone: 'fore', n: 10, size: [24, 58], pal: { cols: ['#3f8636', '#57a043', '#7cc25a'], flower: ['#ffffff', '#fff1a0'] } },
    ],
  },

  /* ---------------- Rock ---------------- */
  {
    name: 'Mountains', family: 'Rock',
    floor: {
      base: '#7a7466', mottle: [0.35, 0.33, 0.28], light: [0.8, 0.78, 0.7], grain: [0.15, 0.14, 0.1],
      marks: [
        { type: 'pebbles', n: 130, r: [1, 3], colors: ['#8e8878', '#6a6456', '#a8a290', '#54503f'] },
        { type: 'tufts', n: 30, h: [8, 16], colors: ['#6a8a4a', '#8aa05a'] },
        { type: 'cracks', n: 8, color: '#3a362e', w: 1.4 },
      ],
    },
    band: {
      type: 'peaks',
      layers: [
        { n: 8, h: 0.19, w: 0.62, foot: 0.03, fade: 0.08, top: '#c6cfdf', mid: '#a9b3c8', shade: '#5f6a84', shadeA: 0.3, light: '#ffffff', lightA: 0.35, snow: '#fafcff', snowFrom: 0.7, snowDepth: 0.26, haze: '#dce4f0', hazeA: 0.5 },
        { n: 9, h: 0.125, w: 0.7, foot: 0.06, fade: 0.11, top: '#8d97ad', mid: '#6f7992', shade: '#2e3548', shadeA: 0.38, light: '#d8deea', lightA: 0.3, snow: '#eef2f8', snowFrom: 0.8, snowDepth: 0.16, haze: '#b6c0d4', hazeA: 0.4 },
        { n: 9, h: 0.04, w: 1.3, foot: 0.09, fade: 0.13, top: '#74767c', mid: '#585a62', shade: '#1a2020', shadeA: 0, light: '#8a9a96', lightA: 0 },
      ],
    },
    props: [
      { kind: 'rock', zone: 'far', n: 44, size: [10, 44], pal: { a: '#8a8780', b: '#4a4a48', c: '#b6b2a6' } },
      { kind: 'boulders', zone: 'edge', n: 6, size: [34, 130], pal: { a: '#8a8780', b: '#4a4a48', c: '#b6b2a6' } },
      { kind: 'tuft', zone: 'fore', n: 8, size: [20, 50], pal: { cols: ['#6a8a4a', '#8aa05a'] } },
    ],
  },
  {
    name: 'Icy Mountains', family: 'Rock', mist: 'rgb(235 245 255 / 24%)',
    floor: {
      base: '#e1ecf5', mottle: [0.55, 0.7, 0.88], light: [1, 1, 1], grain: [0.6, 0.72, 0.9],
      marks: [
        { type: 'ripples', n: 40, color: '#bcd2e6', hi: '#ffffff', a: 0.55 },
        { type: 'flecks', n: 160, colors: ['#ffffff', '#d6e8f8'] },
        { type: 'cracks', n: 14, color: '#9ab8d4', w: 1.2 },
      ],
    },
    band: {
      type: 'peaks',
      layers: [
        { n: 8, h: 0.17, w: 1.15, foot: 0.05, fade: 0.1, top: '#c4d6ea', mid: '#a0b8d4', shade: '#4a6a92', shadeA: 0.38, light: '#ffffff', lightA: 0.3, snow: '#ffffff', snowFrom: 0.5, snowDepth: 0.4 },
        { n: 6, h: 0.11, w: 1.2, foot: 0.09, fade: 0.14, top: '#8fa8c6', mid: '#6a88aa', shade: '#243a58', shadeA: 0.5, light: '#d8e8f8', lightA: 0.25, snow: '#f2f8ff', snowFrom: 0.55, snowDepth: 0.34 },
      ],
    },
    props: [
      { kind: 'pine', zone: 'far', n: 26, size: [24, 80], pal: { a: '#2f5a48', b: '#1f4034', c: '#6a9a7c', d: '#4a3524', snow: '#f4fbff' } },
      { kind: 'iceblock', zone: 'far', n: 14, size: [12, 50], pal: ICE },
      { kind: 'spire', zone: 'edge', n: 6, size: [70, 220], pal: ICE },
      { kind: 'iceblock', zone: 'edge', n: 5, size: [24, 90], pal: ICE },
    ],
  },
  {
    name: 'Rocky Desert', family: 'Rock', mist: 'rgb(255 190 130 / 16%)',
    floor: {
      base: '#b2683f', mottle: [0.5, 0.24, 0.12], light: [1, 0.7, 0.45], grain: [0.3, 0.12, 0.05],
      marks: [
        { type: 'pebbles', n: 110, r: [1, 3], colors: ['#8a4a2a', '#a8603a', '#c88458', '#6a3820'] },
        { type: 'strata', n: 30, colors: ['#7a3c22', '#d89868'] },
        { type: 'cracks', n: 16, color: '#5a2c18', w: 1.5 },
      ],
    },
    band: { type: 'ridge', amp: 0.035, low: 0.012, fade: 0.12, top: '#cf9066', mid: '#a45a3a' },
    props: [
      { kind: 'mesa', zone: 'far', n: 12, size: [30, 160], pal: { a: '#b8643a', b: '#703a22', c: '#e29a6a' } },
      { kind: 'mesa', zone: 'edge', n: 3, size: [140, 340], pal: { a: '#b8643a', b: '#703a22', c: '#e29a6a' } },
      { kind: 'cactus', zone: 'edge', n: 5, size: [44, 130], pal: { a: '#4e8a4a', b: '#2f5a30', c: '#8acb7a' } },
      { kind: 'rock', zone: 'fore', n: 6, size: [20, 60], pal: { a: '#a8603a', b: '#5a2c18', c: '#d89868' } },
    ],
  },
  {
    name: 'Rocky Crater', family: 'Rock', mist: 'rgb(200 170 150 / 14%)',
    floor: {
      base: '#4a4744', mottle: [0.2, 0.19, 0.18], light: [0.55, 0.52, 0.5], grain: [0.07, 0.06, 0.06],
      marks: [
        { type: 'pebbles', n: 150, r: [1, 3.2], colors: ['#5a5652', '#3a3835', '#76706a', '#2a2826'] },
        { type: 'cracks', n: 12, color: '#1c1a18', w: 1.5 },
        { type: 'blots', n: 10, r: [18, 40], colors: ['#6a625a'], a: 0.3 },
      ],
    },
    band: {
      type: 'peaks',
      layers: [
        { n: 11, h: 0.115, w: 0.62, cap: 0.97, steep: 1.5, foot: 0.03, fade: 0.08, top: '#a89c90', mid: '#8a7e74', shade: '#4a4038', shadeA: 0.36, light: '#f0e4d6', lightA: 0.3, strata: { a: '#6a5e54', b: '#c4b8aa', o: 0.26, step: 0.009 }, haze: '#d4c8bc', hazeA: 0.5 },
        { n: 9, h: 0.075, w: 0.8, cap: 0.92, steep: 1.45, foot: 0.06, fade: 0.11, top: '#6c625a', mid: '#544a44', shade: '#201a16', shadeA: 0.46, light: '#b0a498', lightA: 0.22, strata: { a: '#3e3630', b: '#8a7e72', o: 0.28, step: 0.008 }, haze: '#9a8e82', hazeA: 0.35 },
        { n: 13, h: 0.03, w: 1.1, foot: 0.09, fade: 0.13, top: '#4a423c', mid: '#362f2a', shade: '#14100e', shadeA: 0, light: '#7a6e64', lightA: 0 },
      ],
    },
    props: [
      { kind: 'rock', zone: 'far', n: 50, size: [10, 50], pal: { a: '#6a625a', b: '#2e2a26', c: '#9a9288' } },
      { kind: 'boulders', zone: 'edge', n: 6, size: [40, 140], pal: { a: '#6a625a', b: '#2e2a26', c: '#9a9288' } },
      { kind: 'crystal', zone: 'edge', n: 3, size: [34, 100], pal: { a: '#7aa8c8', b: '#3a6a8e', c: '#d8f0ff', glow: '#6ac8ff' } },
    ],
  },

  /* ---------------- Dunes ---------------- */
  {
    name: 'Icy Desert', family: 'Dunes', mist: 'rgb(230 244 255 / 22%)',
    floor: {
      base: '#d3e6f0', mottle: [0.6, 0.75, 0.88], light: [1, 1, 1], grain: [0.55, 0.7, 0.85],
      marks: [
        { type: 'ripples', n: 80, color: '#aecbe0', hi: '#ffffff', a: 0.6 },
        { type: 'flecks', n: 90, colors: ['#ffffff', '#e2f1fb'] },
        { type: 'cracks', n: 8, color: '#8fb0cc', w: 1.2 },
      ],
    },
    band: { type: 'dunes', layers: 4, from: 0.02, to: 0.17, far: '#eaf4fa', near: '#bcd6e8', crest: '#ffffff', fade: 0.1 },
    props: [
      { kind: 'iceblock', zone: 'edge', n: 6, size: [20, 90], pal: ICE },
      { kind: 'spire', zone: 'edge', n: 3, size: [60, 170], pal: ICE },
      { kind: 'iceblock', zone: 'far', n: 10, size: [8, 36], pal: ICE },
    ],
  },
  {
    name: 'Sandy Desert', family: 'Dunes', mist: 'rgb(255 220 150 / 16%)',
    floor: {
      base: '#cfa566', mottle: [0.65, 0.45, 0.2], light: [1, 0.85, 0.55], grain: [0.45, 0.3, 0.12],
      marks: [
        { type: 'ripples', n: 40, color: '#a47a40', hi: '#f6e2b2', a: 0.5 },
        { type: 'pebbles', n: 50, r: [1, 2.6], colors: ['#8a6a40', '#a8845a', '#c8a478'] },
        { type: 'tufts', n: 22, h: [8, 16], colors: ['#a88a3c', '#c9ad5a'] },
        { type: 'cracks', n: 6, color: '#a47a40', w: 1.3 },
      ],
    },
    band: { type: 'dunes', layers: 3, from: 0.01, to: 0.1, far: '#e6c68c', near: '#c89b5a', crest: '#f6e2b2', fade: 0.08, amp: 0.7 },
    props: [
      { kind: 'cactus', zone: 'edge', n: 6, size: [50, 150], pal: { a: '#5a8a4a', b: '#35603a', c: '#9ccb82' } },
      { kind: 'deadTree', zone: 'far', n: 6, size: [20, 70], pal: { d: '#6a4c30' } },
      { kind: 'rock', zone: 'edge', n: 5, size: [16, 70], pal: SAND_ROCK },
      { kind: 'tuft', zone: 'fore', n: 10, size: [20, 54], pal: { cols: ['#a88a3c', '#c9ad5a', '#8a7030'] } },
    ],
  },

  /* ---------------- Heat ---------------- */
  {
    name: 'Active Volcano', family: 'Heat', mist: 'rgb(255 110 40 / 20%)',
    floor: {
      base: '#1c1514', mottle: [0.12, 0.09, 0.08], light: [0.35, 0.2, 0.15], grain: [0.05, 0.03, 0.03],
      marks: [
        { type: 'cracks', n: 24, color: '#ff8a2a', glow: '#ff5a14', w: 2 },
        { type: 'pebbles', n: 70, r: [1, 3], colors: ['#2a2220', '#3a2e2a', '#18100e'] },
        { type: 'spores', n: 30, color: '#ff5a14', hi: '#ffd070' },
      ],
    },
    band: {
      type: 'shore', fs: 0.09, fill: [[0, '#ffd36a'], [0.12, '#ff9a2a'], [0.4, '#e8531a'], [0.8, '#b52a10'], [1, '#d8421a']], deep: '#5a0a00', glint: '#ffe9a0', foam: '#ffb040',
      rim: [
        { from: -0.02, to: 0.012, color: '#ff7a20', a: 0.55 },
        { from: 0, to: 0.03, color: '#2a1814' },
        { from: 0.015, to: 0.05, color: '#1c1210', a: 0.9 },
      ],
      rocks: [{ n: 9, dy: 0.05, size: [8, 44], pal: BASALT }],
    },
    props: [
      { kind: 'vent', zone: 'edge', n: 4, size: [50, 150], pal: { d: '#2a1c18', c: '#ff8a2a' } },
      { kind: 'rock', zone: 'edge', n: 6, size: [24, 90], pal: BASALT },
      { kind: 'spire', zone: 'far', n: 10, size: [14, 60], pal: BASALT, y: [0.1, 0.19] },
      { kind: 'rock', zone: 'fore', n: 5, size: [20, 60], pal: BASALT },
    ],
  },
  {
    name: 'Dormant Volcano', family: 'Heat', mist: 'rgb(210 200 190 / 16%)',
    floor: {
      base: '#3a322e', mottle: [0.2, 0.16, 0.14], light: [0.6, 0.5, 0.42], grain: [0.08, 0.06, 0.05],
      marks: [
        { type: 'pebbles', n: 110, r: [1, 3], colors: ['#5a4c44', '#3a2e2a', '#76665a', '#241c18'] },
        { type: 'blots', n: 14, r: [16, 36], colors: ['#4a6a3c'], a: 0.4 },
        { type: 'tufts', n: 24, h: [8, 16], colors: ['#6a8a4a', '#8aa05a'] },
        { type: 'cracks', n: 8, color: '#1c1614', w: 1.4 },
      ],
    },
    band: { type: 'ridge', amp: 0.065, low: 0.03, fade: 0.13, top: '#6a5a52', mid: '#3a2e2a' },
    props: [
      { kind: 'rock', zone: 'far', n: 40, size: [10, 50], pal: { a: '#6a5a50', b: '#2e2420', c: '#9a8a7c' } },
      { kind: 'pine', zone: 'far', n: 16, size: [24, 70], pal: { a: '#2f5a48', b: '#1f4034', c: '#6a9a7c', d: '#4a3524' } },
      { kind: 'boulders', zone: 'edge', n: 5, size: [34, 120], pal: { a: '#6a5a50', b: '#2e2420', c: '#9a8a7c' } },
      { kind: 'geyser', zone: 'edge', n: 2, size: [60, 130], pal: { a: '#d8dcdc', b: '#1c1c1c', d: '#4a403a' } },
    ],
  },
  {
    name: 'Geothermal Springs', family: 'Heat', mist: 'rgb(255 255 255 / 22%)',
    floor: {
      base: '#b9b19a', mottle: [0.55, 0.5, 0.38], light: [1, 0.95, 0.7], grain: [0.35, 0.3, 0.2],
      marks: [
        { type: 'blots', n: 12, r: [20, 50], colors: ['#d8b04a', '#e8d070'], a: 0.35 },
        { type: 'blots', n: 10, r: [16, 40], colors: ['#f4efe0'], a: 0.5 },
        { type: 'pebbles', n: 50, r: [1, 2.6], colors: ['#8a826a', '#a8a088', '#cfc7aa'] },
        { type: 'cracks', n: 6, color: '#8a826a', w: 1.2 },
      ],
    },
    band: {
      type: 'pools', centre: '#8ff4e6', water: '#2ac4c0', edge: '#1a8a9a', lip: '#efe8cf', ring: '#ffffff',
      wide: [[0.2, 0.07, 0.1], [0.64, 0.11, 0.09], [0.9, 0.16, 0.07], [0.08, 0.8, 0.12], [0.93, 0.85, 0.1], [0.3, 0.93, 0.08]],
      tall: [[0.16, 0.08, 0.13], [0.58, 0.15, 0.1], [0.88, 0.24, 0.09], [0.08, 0.34, 0.08]],
    },
    props: [
      { kind: 'geyser', zone: 'far', n: 7, size: [30, 120], pal: { a: '#f0f4f4', b: '#222', d: '#cfc7aa' } },
      { kind: 'geyser', zone: 'edge', n: 3, size: [90, 210], pal: { a: '#f0f4f4', b: '#222', d: '#cfc7aa' } },
      { kind: 'rock', zone: 'edge', n: 5, size: [16, 70], pal: { a: '#a8a088', b: '#5a5444', c: '#d8d0b4' } },
    ],
  },

  /* ---------------- Swamp ---------------- */
  {
    name: 'Methane Swampland', family: 'Swamp', mist: 'rgb(170 255 90 / 20%)',
    floor: {
      base: '#3b4630', mottle: [0.18, 0.22, 0.1], light: [0.55, 0.6, 0.3], grain: [0.06, 0.08, 0.03],
      marks: [
        { type: 'blots', n: 16, r: [20, 50], colors: ['#1f2a20'], a: 0.6 },
        { type: 'blots', n: 10, r: [18, 40], colors: ['#6a7a3a'], a: 0.3 },
        { type: 'tufts', n: 40, h: [8, 18], colors: ['#5a7a3a', '#7a9a4a', '#3f5a28'] },
        { type: 'spores', n: 34, color: '#b8ff5a', hi: '#eaffb0' },
      ],
    },
    band: {
      type: 'shore', fs: 0.1, fill: [[0, '#b4c88a'], [0.12, '#7a9462'], [0.45, '#33482a'], [1, '#2a3a20']], deep: '#101a0a', glint: '#cfe28a', foam: '#9ab05a',
      rim: [
        { from: -0.02, to: 0.015, color: '#556a36', a: 0.8 },
        { from: 0, to: 0.03, color: '#2c3822' },
      ],
      fringe: { at: 0.03, colors: ['#5a7a3a', '#3f5a28', '#7a9a4a'] },
      rocks: [{ n: 5, dy: 0.05, size: [8, 30], pal: { a: '#4a5238', b: '#262c1c', c: '#7a8458' } }],
    },
    props: [
      { kind: 'twigs', zone: 'far', n: 56, size: [18, 78], pal: { d: '#4a3e32' }, bias: 1.1 },
      { kind: 'twigs', zone: 'edge', n: 14, size: [50, 170], pal: { d: '#4a3e32' } },
      { kind: 'twigs', zone: 'fore', n: 8, size: [24, 60], pal: { d: '#4a3e32' } },
      { kind: 'reeds', zone: 'edge', n: 6, size: [40, 120], pal: { a: '#6a8a3a', b: '#3f5a28', d: '#6a4a2a' } },
      { kind: 'reeds', zone: 'far', n: 18, size: [12, 40], pal: { a: '#6a8a3a', b: '#3f5a28', d: '#6a4a2a' } },
    ],
  },
]
module.exports = { RECIPES2: RECIPES }
