/*
 * What a planet brings to a fight on any land: its sky, its sun, its weather
 * and the colour of its light. The sky, the sun and the country on the horizon
 * are baked into one picture per planet and shape (scripts/build-lands.cjs);
 * the clouds, and the snow or dust on a planet that has it, stay live.
 */
const PLANETS = {
  /* A tropical blue, a low sun on the left. */
  veles: { side: 'l', stops: [['#2b7aa6', 0], ['#4fa4c6', 34], ['#8fd2da', 68], ['#d4f1e6', 92], ['#f2ecd0', 100]], sun: [16, 56, 5.5, '#fff3c4'], clouds: 'puff', tint: '255 240 210', ta: 0.16, shade: 0, cloud: '255 255 255' },
  /* A golden evening, a big sun low on the right. */
  neri: { side: 'r', stops: [['#34507a', 0], ['#7d6f8a', 30], ['#d59a62', 66], ['#f3c47e', 88], ['#f7e2ae', 100]], sun: [80, 58, 7, '#ffe6a6'], clouds: 'streak', tint: '255 214 150', ta: 0.24, shade: 0, cloud: '255 226 170' },
  /* Rust and dust, a smothered sun. */
  magor: { side: 'r', stops: [['#3e1a14', 0], ['#7a2f1c', 30], ['#b8572a', 62], ['#de8a46', 86], ['#ecb070', 100]], sun: [66, 52, 4, '#ffe8c8'], clouds: 'dust', motes: 'dust', tint: '255 168 110', ta: 0.3, shade: 0.05, cloud: '196 112 62' },
  /* Cold and clear, a white sun, mist and snow. */
  naron: { side: 'l', stops: [['#4f6f98', 0], ['#7f9cbf', 32], ['#b9cfe2', 66], ['#e2ecf3', 90], ['#f4f8fa', 100]], sun: [28, 54, 4.6, '#ffffff'], clouds: 'mist', motes: 'snow', tint: '220 236 255', ta: 0.2, shade: 0, cloud: '245 250 255' },
  /* Overcast olive-grey, a weak sun. */
  kavian: { side: 'l', stops: [['#262b27', 0], ['#3e4539', 30], ['#666c56', 62], ['#9a9a7c', 88], ['#b9b597', 100]], sun: [34, 56, 4, '#ece6c4'], clouds: 'overcast', tint: '200 210 170', ta: 0.22, shade: 0.12, cloud: '118 126 108' },
  /* Humid teal and green under a hazy sun. */
  eyeke: { side: 'l', stops: [['#0f3842', 0], ['#25666a', 30], ['#58a288', 62], ['#b4d9a4', 88], ['#dceec0', 100]], sun: [20, 54, 5, '#fff6cc'], clouds: 'puff', tint: '214 255 204', ta: 0.18, shade: 0, cloud: '236 255 236' },
}

/* How a planet's light changes water, as the CSS filter list it replaces; baked into the water pictures. */
const WATER = {
  veles: [],
  neri: [['hue', -14], ['sat', 0.85], ['bright', 0.96], ['sepia', 0.18]],
  magor: [['hue', -34], ['sat', 0.55], ['bright', 0.78], ['sepia', 0.5]],
  naron: [['hue', 8], ['sat', 0.7], ['bright', 1.08]],
  kavian: [['hue', 24], ['sat', 0.32], ['bright', 0.68]],
  eyeke: [['hue', 18], ['sat', 1.05], ['bright', 0.92]],
}

/* The backdrop is drawn at this much of its natural size: the camera pulled back. */
const ZOOM = 0.78
/* The horizon, as % of the field's height, per shape. */
const HZ = { wide: 37, tall: 34 }
const FIELD = { wide: { W: 1600, H: 900 }, tall: { W: 1000, H: 1000 } }

const mul = (a, b) => a.map((row, i) => b[0].map((_, j) => row.reduce((s, _v, k) => s + a[i][k] * b[k][j], 0)))
/* The same maths a CSS filter does, as one 3x3 matrix (applied in the order written). */
function waterMatrix(spec) {
  let M = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  for (const [kind, v] of spec) {
    let F
    if (kind === 'hue') {
      const c = Math.cos((v * Math.PI) / 180)
      const s = Math.sin((v * Math.PI) / 180)
      F = [
        [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
        [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
        [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
      ]
    } else if (kind === 'sat') {
      F = [
        [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v],
        [0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v],
        [0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v],
      ]
    } else if (kind === 'sepia') {
      const k = 1 - v
      F = [
        [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k],
        [0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k],
        [0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k],
      ]
    } else {
      F = [[v, 0, 0], [0, v, 0], [0, 0, v]]
    }
    M = mul(F, M)
  }
  return M
}

module.exports = { PLANETS, WATER, ZOOM, HZ, FIELD, waterMatrix }
