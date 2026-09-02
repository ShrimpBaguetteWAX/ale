/**
 * Pins the leaderboard copy and the claim button's placement.
 *
 *   npx vite build --ssr scripts/verify-leaderboard.ts --outDir .ssr
 *   node .ssr/verify-leaderboard.js
 *
 * The copy is checked against the exact sentences it was asked to carry,
 * because paraphrasing it is the easy mistake to make and nothing else would
 * catch it — a slightly-wrong explanation of how a board pays out renders
 * perfectly and reads plausibly.
 */
import { readFileSync } from 'node:fs'
import { LEDE } from '../src/routes/Leaderboard'

let pass = 0
let fail = 0
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log((ok ? '  ok   ' : '  FAIL ') + name)
  if (!ok) {
    console.log('         got  ' + JSON.stringify(got))
    console.log('         want ' + JSON.stringify(want))
  }
  ok ? pass++ : fail++
}

const src = readFileSync(new URL('../src/routes/Leaderboard.tsx', import.meta.url), 'utf8')

console.log('leaderboard\n')

/* --- the copy, word for word --- */
check(
  'the dungeon lede says how rating is earned and who can claim',
  LEDE.dungeons,
  'Dungeon rating is earned by winning dungeons. The higher the difficulty, ' +
    'the more rating you gain. The top 20 can claim rewards for their rank ' +
    'every day.',
)
check(
  'the arena lede says it pays out by itself',
  LEDE.arena,
  'The arena leaderboard automatically pays out rewards to the winners when ' +
    'they end.',
)
check('every tab has a lede', Object.keys(LEDE).sort(), ['arena', 'dungeons', 'tournament'])

/* The old sentence was wrong about where dungeon rating comes from. */
check(
  'the old, incorrect explanation is gone',
  src.includes('earned by the team defending your dungeon'),
  false,
)
check(
  'and so is the pot paragraph',
  src.includes('The pot holds') || src.includes('takes a\n        hundredth'),
  false,
)

/* --- the claim button --- */
check(
  'the claim button is gated on the dungeons tab',
  /\{tab === 'dungeons' && \(\s*<button/.test(src),
  true,
)
check(
  'and there is only one of it',
  (src.match(/Claim daily Rewards/g) ?? []).length,
  1,
)

/*
   The lede is rendered from the map rather than written inline, which is what
   makes the tab-specific copy possible at all.
*/
check('the lede is driven by the selected tab', src.includes('{LEDE[tab]}'), true)

console.log('\n' + (fail === 0 ? `all ${pass} cases passed` : `${fail} FAILED`))
if (fail) process.exitCode = 1
