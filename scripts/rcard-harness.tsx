/**
 * My Fighters' compact cards for a real roster - see rcard-harness.html.
 */
import { createRoot } from 'react-dom/client'
import { fetchRoster } from '../src/dungeon/queries'
import { fetchFighterLevels } from '../src/fighters/queries'
import { levelUpOf } from '../src/fighters/rules'
import { CompactCard, type Mode } from '../src/fighters/DeskRoster'
import { PickCard } from '../src/fight/setup'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/fighters.css'
import '../src/styles/landstage.css'
import '../src/styles/dungeon.css'

const q = new URLSearchParams(location.search)
const wallet = q.get('as') ?? 'onabs.wam'
const phone = q.get('phone') === '1'
const mode = (q.get('mode') ?? 'inventory') as Mode
/* ?pick=1: the fight screens' picker grid instead of My Fighters. */
const pick = q.get('pick') === '1'
/* ?up=1: every fifth fighter with a level waiting, to see the shine. */
const fakeUp = q.get('up') === '1'

void Promise.all([fetchRoster(wallet), fetchFighterLevels()]).then(([roster, levels]) => {
  const now = Date.now()
  createRoot(document.getElementById('root')!).render(
    <div className={`drost${phone ? ' drost--phone drost--stack' : ''}`} style={{ maxWidth: phone ? 360 : 900 }}>
      {pick ? (
        <div className="fightergrid fightergrid--compact">
          {roster.map((f, i) => (
            <PickCard
              key={f.fighter_id}
              fighter={f}
              ageDecay={0}
              density="compact"
              picked={i < 3}
              tick="In team"
              blocked={f.in_use}
              blockedNote={f.in_use ? 'In Arena' : undefined}
              onClick={() => {}}
            />
          ))}
        </div>
      ) : (
      <div className="drost__grid">
        {roster.map((f, i) => (
          <CompactCard
            key={f.fighter_id}
            f={f}
            mode={mode}
            now={now}
            picked={i === 0}
            checked={i === 1}
            gate={{ ok: !f.in_use }}
            onClick={() => {}}
            onTick={() => {}}
            level={fakeUp && i % 5 === 2 ? { ...levelUpOf(f, levels), ready: true } : levelUpOf(f, levels)}
            max={!(fakeUp && i % 5 === 2) && levels.length > 0 && levelUpOf(f, levels).atMax}
          />
        ))}
      </div>
      )}
    </div>,
  )
})

/* ?check=1: scroll the grid a screen at a time and count the portraits loaded in view, for a headless run. */
if (q.get('check') === '1') {
  setTimeout(async () => {
    const out: string[] = []
    for (let step = 0; step < 6; step++) {
      window.scrollTo(0, step * window.innerHeight)
      await new Promise((r) => setTimeout(r, 2500))
      const vis = [...document.querySelectorAll<HTMLImageElement>('.rocard__art')].filter((i) => {
        const r = i.closest('.rocard')!.getBoundingClientRect()
        return r.bottom > 0 && r.top < window.innerHeight
      })
      out.push(`${step}:${vis.filter((i) => i.complete && i.naturalWidth > 0).length}/${vis.length}`)
    }
    const pre = document.createElement('pre')
    pre.id = 'check'
    pre.textContent = 'RESULT ' + out.join(' ')
    document.body.appendChild(pre)
  }, 9000)
}
