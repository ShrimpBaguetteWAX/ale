const path = require('path')
/* Reworked lands: a recipe here replaces the one of the same name in the earlier files. */
const { SEA_TEAL, ROCK_GREY } = require('./recipes1.cjs')
const GRASS_FLOOR = path.resolve('public/assets/stages/veles/grass.webp')
const WET_ROCK = { a: '#6b6e76', b: '#2c2f36', c: '#aab0ba', wet: true }
const SEA_DEEP = [[0, '#9ccdd8'], [0.1, '#5aa0b8'], [0.45, '#2a6f90'], [0.8, '#1c5c7c'], [1, '#2b7a98']]

const RECIPES3 = [
  /* No trees. Soft wind ripples run back toward the horizon over a sand that varies from warm to pale. */
  {
    name: 'Sandy Coastline', family: 'Coast', sea: true,
    wash: ['#f4e8bf', '#c4a872'],
    decals: { type: 'ripples', n: 220, dark: '#a98e58', light: '#fff4d2', amp: 1 },
    floor: {
      base: '#dcc891', mottle: [0.66, 0.52, 0.3], light: [1, 0.96, 0.82], grain: [0.5, 0.38, 0.22], grainA: 0.75, freq: [0.007, 0.013, 0.8],
      marks: [
        { type: 'flecks', n: 320, colors: ['#fff6dc', '#c9b07a', '#ffffff', '#a98e58'] },
        { type: 'pebbles', n: 26, r: [1, 2], colors: ['#a89880', '#c7b595', '#8a7a62'] },
        { type: 'blots', n: 10, r: [20, 46], colors: ['#b79a62'], a: 0.22 },
      ],
    },
    band: {
      type: 'shore', fs: 0.075, fill: SEA_TEAL, deep: '#0a4658', glint: '#f4fffb', foam: '#ffffff',
      rim: [
        { from: -0.04, to: 0.008, color: '#bff0e8', a: 0.65 },
        { from: -0.004, to: 0.024, color: '#a89466' },
        { from: 0.01, to: 0.07, color: '#ecdcaa', a: 0.9 },
      ],
      rocks: [{ n: 6, dy: 0.06, size: [8, 36], pal: { ...ROCK_GREY, wet: true } }],
    },
    props: [
      { kind: 'rock', zone: 'edge', n: 6, size: [12, 50], pal: { a: '#9a958a', b: '#4a4842', c: '#cbc6b8', wet: false } },
      { kind: 'log', zone: 'edge', n: 3, size: [8, 26], pal: { a: '#a08060', b: '#6e5036', c: '#d0b48c' } },
      { kind: 'bush', zone: 'edge', n: 4, size: [16, 44], pal: { a: '#8c9a4a', b: '#56622c', c: '#c4d078' } },
      { kind: 'tuft', zone: 'fore', n: 12, size: [20, 54], pal: { cols: ['#9aa24a', '#b8b863', '#7a8a3c', '#d2c27a'] } },
    ],
  },

  /* Angular shingle, wet dark rock at the water, sea stacks, and stones with a lit side and a shaded side. */
  {
    name: 'Rocky Coastline', family: 'Coast', sea: true,
    wash: ['#8a8c94', '#3a3c42'],
    floor: {
      base: '#6b6d74', mottle: [0.28, 0.3, 0.34], light: [0.7, 0.72, 0.78], grain: [0.1, 0.1, 0.12],
      marks: [
        { type: 'shingle', n: 200, r: [2.4, 6], colors: ['#8a8c92', '#5e6066', '#a4a6ac', '#46484e', '#74767c'] },
        { type: 'shingle', n: 60, r: [6, 12], colors: ['#7a7c82', '#55575d', '#9a9ca2'] },
        { type: 'cracks', n: 8, color: '#26282c', w: 1.4 },
        { type: 'blots', n: 8, r: [14, 34], colors: ['#4a6a40'], a: 0.28 },
      ],
    },
    band: {
      type: 'shore', fs: 0.07, fill: SEA_DEEP, deep: '#06293a', glint: '#e8f6ff', foam: '#ffffff',
      rim: [
        { from: -0.03, to: 0.008, color: '#8ec8d0', a: 0.55 },
        { from: 0, to: 0.028, color: '#2c2f36' },
        { from: 0.012, to: 0.05, color: '#52555c', a: 0.9 },
      ],
      rocks: [{ n: 9, dy: 0.05, size: [12, 54], pal: WET_ROCK }],
    },
    props: [
      { kind: 'rock', zone: 'far', n: 7, size: [40, 140], pal: { ...WET_ROCK, narrow: true }, y: [0.012, 0.09] },
      { kind: 'rock', zone: 'edge', n: 7, size: [36, 120], pal: { a: '#70737b', b: '#30333a', c: '#b0b6c0' } },
      { kind: 'rock', zone: 'edge', n: 6, size: [14, 44], pal: { a: '#70737b', b: '#30333a', c: '#b0b6c0' } },
      { kind: 'tuft', zone: 'fore', n: 8, size: [18, 46], pal: { cols: ['#5a7a46', '#7a9a5a', '#4a6a3a'] } },
    ],
  },

  /* A small beach in a lagoon: pale coral sand, bright shallows round three sides, starfish and shells. */
  {
    name: 'Small Island', family: 'Coast', sea: true,
    wash: ['#fffaf0', '#d6c49a'],
    decals: { type: 'ripples', n: 46, dark: '#d8c9a0', light: '#ffffff', amp: 0.4, beachcomb: 14, shellsOnly: true },
    floor: {
      base: '#f0e6c8', mottle: [0.8, 0.72, 0.58], light: [1, 1, 0.95], grain: [0.6, 0.5, 0.4], grainA: 0.55, freq: [0.009, 0.016, 0.7],
      marks: [
        { type: 'flecks', n: 280, colors: ['#ffffff', '#e8d8b8', '#d8c8a8', '#fff6e8'] },
        { type: 'pebbles', n: 18, r: [1, 2], colors: ['#d8c8b0', '#c8b8a0', '#ece0cc'] },
        { type: 'blots', n: 8, r: [18, 40], colors: ['#d8c8a0'], a: 0.25 },
      ],
    },
    band: {
      type: 'shore', fs: 0.05, wrap: 0.5, pow: 6, fill: [[0, '#c6f5ee'], [0.12, '#8fe6dc'], [0.4, '#3fc4c8'], [0.8, '#1fa0b8'], [1, '#2bb4c4']], deep: '#0a5a6a', glint: '#ffffff', foam: '#ffffff',
      rim: [
        { from: -0.075, to: 0.012, color: '#d6fbf4', a: 0.55 },
        { from: -0.04, to: 0.012, color: '#a4f0e6', a: 0.6 },
        { from: -0.004, to: 0.024, color: '#cdb98a' },
        { from: 0.012, to: 0.1, color: '#f6ecd0', a: 0.95 },
      ],
      rocks: [{ n: 8, dy: 0.06, size: [8, 32], pal: { a: '#b9a79a', b: '#6a5a50', c: '#e8dcd0', wet: true } }],
    },
    props: [
      { kind: 'bush', zone: 'edge', n: 6, size: [20, 60], pal: { a: '#8aa04a', b: '#566a2c', c: '#c8d878', d: '#ffffff' }, y: [0.62, 0.92] },
      { kind: 'rock', zone: 'edge', n: 6, size: [10, 40], pal: { a: '#b9a79a', b: '#6a5a50', c: '#e8dcd0' }, y: [0.62, 0.95] },
      { kind: 'log', zone: 'edge', n: 3, size: [8, 24], pal: { a: '#b09a7a', b: '#7a6448', c: '#e0ceaa' }, y: [0.64, 0.94] },
      { kind: 'tuft', zone: 'fore', n: 12, size: [18, 50], pal: { cols: ['#9ab85a', '#c8cf70', '#7a9a46'] } },
    ],
  },

  /* Rolling green, a clean blue sky over it: no trees, no clutter, a hill that sweeps across. */
  {
    name: 'Grassland', family: 'Meadow',
    wash: ['#c2f574', '#2a8a14'],
    floor: {
      base: '#43b02a', mottle: [0.1, 0.46, 0.05], light: [0.78, 0.96, 0.36], grain: [0.05, 0.2, 0.03], grainA: 0.35,
      marks: [
        { type: 'blades', n: 900, len: [6, 14], w: [1.1, 2], colors: ['#2e9a1c', '#48b62e', '#62cc3e', '#82e050', '#a2ee66'] },
        { type: 'flowers', n: 14, colors: ['#ffffff', '#fff3a0'] },
      ],
    },
    band: {
      type: 'hills',
      layers: [
        { base: 0.004, bumps: [[0.16, 0.3, 0.014], [0.84, 0.34, 0.016], [0.5, 0.5, 0.004]], fade: 0.1, top: '#a8e870', mid: '#62bd3e', rim: '#d8ff9a' },
        { base: 0.0, bumps: [[0.58, 0.38, 0.012], [0.0, 0.2, 0.01], [1.0, 0.2, 0.009]], fade: 0.12, top: '#8ede4a', mid: '#44b02a', rim: '#c8ff7a' },
      ],
    },
    props: [
      { kind: 'tuft', zone: 'fore', n: 10, size: [20, 54], pal: { cols: ['#2e9a1c', '#48b62e', '#62cc3e', '#82e050'], flower: ['#ffffff', '#fff3a0'] } },
      { kind: 'tuft', zone: 'edge', n: 8, size: [16, 44], pal: { cols: ['#2e9a1c', '#48b62e', '#62cc3e', '#82e050'] } },
    ],
  },

  /* Distant buttes in layers with strata, a ground of cracked dry earth, desert pavement and wind-blown sand. */
  {
    name: 'Rocky Desert', family: 'Rock', mist: 'rgb(255 196 140 / 20%)',
    wash: ['#eab88e', '#6a3220'],
    decals: { type: 'ripples', n: 70, dark: '#8e4e2c', light: '#f4cca4', amp: 0.4 },
    floor: {
      base: '#b4693f', mottle: [0.52, 0.24, 0.12], light: [1, 0.74, 0.48], grain: [0.3, 0.12, 0.05], grainA: 0.55,
      marks: [
        { type: 'blots', n: 18, r: [24, 56], colors: ['#7a3c22', '#e0a272', '#c07a4c'], a: 0.24 },
        { type: 'cracks', n: 34, color: '#6a3420', w: 1.3 },
        { type: 'shingle', n: 170, r: [2, 5.5], colors: ['#8a4a2a', '#a8603a', '#c88458', '#6a3820', '#d89868'] },
        { type: 'shingle', n: 34, r: [6, 11], colors: ['#7a4024', '#98562e', '#b87848'] },
        { type: 'strata', n: 22, colors: ['#7a3c22', '#e0a272'] },
        { type: 'tufts', n: 14, h: [6, 12], colors: ['#8a7a3c', '#a89a50'] },
      ],
    },
    band: {
      type: 'peaks',
      layers: [
        { n: 6, h: 0.17, w: 0.8, cap: 0.82, steep: 2.4, foot: 0.03, fade: 0.08, top: '#eabc94', mid: '#d69c74', shade: '#9a5a3a', shadeA: 0.32, light: '#fff2e0', lightA: 0.32, strata: { a: '#b06a44', b: '#f6d0a8', o: 0.34, step: 0.0085 }, haze: '#f6d6b6', hazeA: 0.56 },
        { n: 6, h: 0.115, w: 0.85, cap: 0.85, steep: 2.6, foot: 0.06, fade: 0.1, top: '#c8805a', mid: '#a85e3a', shade: '#5a2c1a', shadeA: 0.42, light: '#f4bc94', lightA: 0.28, strata: { a: '#74381e', b: '#e0a074', o: 0.36, step: 0.0075 }, haze: '#dca078', hazeA: 0.4 },
        { n: 11, h: 0.026, w: 1.4, foot: 0.08, fade: 0.12, top: '#9c5634', mid: '#7a4024', shade: '#3a1c10', shadeA: 0, light: '#c88458', lightA: 0 },
      ],
    },
    props: [
      { kind: 'mesa', zone: 'far', n: 9, size: [8, 34], pal: { a: '#c88458', b: '#7a3c22', c: '#f0b890' }, y: [0.0, 0.06] },
      { kind: 'rock', zone: 'far', n: 54, size: [8, 30], pal: { a: '#a8603a', b: '#5a2c18', c: '#d89868' }, bias: 1.2 },
      { kind: 'deadTree', zone: 'far', n: 4, size: [24, 62], pal: { d: '#5a3a24' } },
      { kind: 'rock', zone: 'edge', n: 14, size: [12, 54], pal: { a: '#a8603a', b: '#5a2c18', c: '#d89868' } },
      { kind: 'boulders', zone: 'edge', n: 4, size: [22, 70], pal: { a: '#a8603a', b: '#5a2c18', c: '#d89868' } },
      { kind: 'cactus', zone: 'edge', n: 4, size: [30, 86], pal: { a: '#5a8a4a', b: '#35603a', c: '#9ccb82' } },
      { kind: 'tuft', zone: 'fore', n: 12, size: [16, 44], pal: { cols: ['#8a7a3c', '#a89a50', '#c8b86a'] } },
      { kind: 'rock', zone: 'fore', n: 9, size: [12, 38], pal: { a: '#a8603a', b: '#5a2c18', c: '#d89868' } },
    ],
  },

  /* Steep snow peaks in three passes of blue, rolling snow foothills, drifts and ice on a blue-shadowed snowfield. */
  {
    name: 'Icy Mountains', family: 'Rock', mist: 'rgb(235 245 255 / 24%)',
    wash: ['#ffffff', '#8fb0d4'],
    decals: { type: 'ripples', n: 90, dark: '#b6cde4', light: '#ffffff', amp: 0.6 },
    floor: {
      base: '#e4eef7', mottle: [0.52, 0.68, 0.9], light: [1, 1, 1], grain: [0.6, 0.72, 0.92], grainA: 0.5,
      marks: [
        { type: 'blots', n: 14, r: [24, 56], colors: ['#9ab8d8'], a: 0.2 },
        { type: 'flecks', n: 220, colors: ['#ffffff', '#d6e8f8', '#bcd6ee'] },
        { type: 'cracks', n: 10, color: '#9ab8d4', w: 1.2 },
        { type: 'pebbles', n: 14, r: [1, 2.2], colors: ['#6f86a4', '#8fa4c0'] },
      ],
    },
    band: {
      type: 'peaks',
      layers: [
        { n: 8, h: 0.215, w: 0.6, foot: 0.03, fade: 0.08, top: '#d2e0f0', mid: '#b0c6e0', shade: '#5a7aa4', shadeA: 0.32, light: '#ffffff', lightA: 0.4, snow: '#ffffff', snowFrom: 0.45, snowDepth: 0.46, haze: '#e8f2fb', hazeA: 0.5 },
        { n: 9, h: 0.14, w: 0.68, foot: 0.06, fade: 0.11, top: '#9db6d4', mid: '#7a98ba', shade: '#2c466c', shadeA: 0.42, light: '#e4f0fc', lightA: 0.34, snow: '#f6faff', snowFrom: 0.5, snowDepth: 0.38, haze: '#c4d6ea', hazeA: 0.42 },
        { n: 9, h: 0.045, w: 1.3, foot: 0.09, fade: 0.13, top: '#f2f7fc', mid: '#c8daee', shade: '#8aa8cc', shadeA: 0, light: '#ffffff', lightA: 0 },
      ],
    },
    props: [
      { kind: 'dune', zone: 'far', n: 22, size: [4, 12], pal: { a: '#ffffff', b: '#b4cce4' } },
      { kind: 'iceblock', zone: 'far', n: 12, size: [10, 40], pal: { a: '#a9cde8', b: '#5f86ae', c: '#e8f6ff', snow: '#ffffff' } },
      { kind: 'rock', zone: 'edge', n: 6, size: [18, 64], pal: { a: '#6f86a4', b: '#2c3c58', c: '#c4d6ec' } },
      { kind: 'spire', zone: 'edge', n: 5, size: [60, 190], pal: { a: '#a9cde8', b: '#5f86ae', c: '#e8f6ff', snow: '#ffffff' } },
      { kind: 'iceblock', zone: 'edge', n: 5, size: [22, 80], pal: { a: '#a9cde8', b: '#5f86ae', c: '#e8f6ff', snow: '#ffffff' } },
      { kind: 'dune', zone: 'edge', n: 6, size: [8, 20], pal: { a: '#ffffff', b: '#b4cce4' } },
      { kind: 'rock', zone: 'fore', n: 6, size: [12, 32], pal: { a: '#6f86a4', b: '#2c3c58', c: '#c4d6ec' } },
    ],
  },

  /* Prismatic pools on pale mineral terraces, steaming; geysers on tiered cones; the ground stained orange and cream. */
  {
    name: 'Geothermal Springs', family: 'Heat', mist: 'rgb(255 255 255 / 26%)',
    wash: ['#f8f0dc', '#a8946a'],
    floor: {
      base: '#c6baa0', mottle: [0.55, 0.5, 0.38], light: [1, 0.96, 0.72], grain: [0.35, 0.3, 0.2], grainA: 0.5,
      marks: [
        { type: 'blots', n: 14, r: [26, 60], colors: ['#e0a850', '#e8c870', '#d88a3a'], a: 0.3 },
        { type: 'blots', n: 12, r: [20, 50], colors: ['#f8f2e2'], a: 0.5 },
        { type: 'blots', n: 6, r: [16, 36], colors: ['#7ad0b8'], a: 0.18 },
        { type: 'cracks', n: 16, color: '#f8f2e0', w: 1.6 },
        { type: 'shingle', n: 80, r: [2, 4.5], colors: ['#a89878', '#cfc3a4', '#8a7e62'] },
      ],
    },
    band: {
      type: 'pools',
      terrace: ['#f4ead0', '#e6a85a'],
      rings: [[1, '#d8e87c'], [0.88, '#8fe0a8'], [0.7, '#34c8c0'], [0.5, '#1a92d0'], [0.3, '#0f56a8']],
      wide: [[0.2, 0.07, 0.1], [0.64, 0.11, 0.09], [0.9, 0.16, 0.07], [0.08, 0.8, 0.12], [0.93, 0.85, 0.1], [0.3, 0.93, 0.08], [0.45, 0.05, 0.05]],
      tall: [[0.16, 0.08, 0.13], [0.58, 0.15, 0.1], [0.88, 0.24, 0.09], [0.08, 0.34, 0.08], [0.4, 0.06, 0.06]],
    },
    props: [
      { kind: 'geyser', zone: 'far', n: 6, size: [34, 120], pal: { a: '#f6fafa', b: '#222', d: '#e8dcc0', t: '#e0904a', w: '#3fd0c8', jet: true } },
      { kind: 'geyser', zone: 'edge', n: 3, size: [90, 210], pal: { a: '#f6fafa', b: '#222', d: '#e8dcc0', t: '#e0904a', w: '#3fd0c8', jet: true } },
      { kind: 'steam', zone: 'far', n: 9, size: [30, 90], pal: { a: '#ffffff' } },
      { kind: 'steam', zone: 'edge', n: 4, size: [60, 150], pal: { a: '#ffffff' } },
      { kind: 'rock', zone: 'edge', n: 6, size: [14, 60], pal: { a: '#b8a888', b: '#5a4e38', c: '#ece0c4' } },
      { kind: 'rock', zone: 'fore', n: 5, size: [12, 32], pal: { a: '#b8a888', b: '#5a4e38', c: '#ece0c4' } },
    ],
  },

  /* A great old volcano on the horizon, mossy at the foot, old lava streaked down its flanks; dark broken ground below. */
  {
    name: 'Dormant Volcano', family: 'Heat', mist: 'rgb(214 204 194 / 20%)',
    wash: ['#7a6a60', '#1c1612'],
    floor: {
      base: '#3c3430', mottle: [0.2, 0.16, 0.14], light: [0.6, 0.5, 0.42], grain: [0.08, 0.06, 0.05], grainA: 0.55,
      marks: [
        { type: 'shingle', n: 150, r: [2, 5.5], colors: ['#5a4c44', '#3a2e2a', '#76665a', '#241c18', '#8a786a'] },
        { type: 'blots', n: 16, r: [18, 42], colors: ['#4a6a3c', '#5a7a46'], a: 0.36 },
        { type: 'blots', n: 8, r: [22, 50], colors: ['#8a7e74'], a: 0.22 },
        { type: 'tufts', n: 26, h: [8, 16], colors: ['#6a8a4a', '#8aa05a'] },
        { type: 'cracks', n: 10, color: '#14100e', w: 1.5 },
      ],
    },
    band: {
      type: 'volcano', haze: '#d6ccc0',
      cones: [
        { u: 0.62, h: 0.2, w: 0.3, lip: 0.1, top: '#8a7a70', mid: '#6a5c52', shade: '#2c221e', moss: '#5a7a46', flow: '#2a201c' },
        { u: 0.14, h: 0.1, w: 0.17, lip: 0.12, top: '#9a8c80', mid: '#7a6c62', shade: '#3a2e28', moss: '#5a7a46', flow: '#3a2e28' },
      ],
      foothills: [
        { n: 9, h: 0.045, w: 1.0, cap: 0.9, steep: 1.6, foot: 0.09, fade: 0.13, top: '#5a4e46', mid: '#463a34', shade: '#1a1410', shadeA: 0.3, light: '#8a7a6c', lightA: 0.1 },
      ],
    },
    props: [
      { kind: 'rock', zone: 'far', n: 42, size: [8, 38], pal: { a: '#6a5a50', b: '#2a201c', c: '#a08c7c' } },
      { kind: 'boulders', zone: 'edge', n: 5, size: [26, 96], pal: { a: '#6a5a50', b: '#2a201c', c: '#a08c7c' } },
      { kind: 'rock', zone: 'edge', n: 7, size: [12, 46], pal: { a: '#6a5a50', b: '#2a201c', c: '#a08c7c' } },
      { kind: 'steam', zone: 'edge', n: 4, size: [50, 130], pal: { a: '#e8e8e8' } },
      { kind: 'tuft', zone: 'fore', n: 9, size: [16, 42], pal: { cols: ['#6a8a4a', '#8aa05a', '#4a6a3a'] } },
    ],
  },
]
module.exports = { RECIPES3 }
