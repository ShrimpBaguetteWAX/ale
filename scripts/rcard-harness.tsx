/**
 * My Fighters' compact cards for a real roster - see rcard-harness.html.
 */
import { createRoot } from 'react-dom/client'
import { fetchRoster } from '../src/dungeon/queries'
import { fetchFighterLevels } from '../src/fighters/queries'
import { levelUpOf } from '../src/fighters/rules'
import { CompactCard, type Mode } from '../src/fighters/DeskRoster'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/fighters.css'
import '../src/styles/landstage.css'

const q = new URLSearchParams(location.search)
const wallet = q.get('as') ?? 'onabs.wam'
const phone = q.get('phone') === '1'
const mode = (q.get('mode') ?? 'inventory') as Mode

void Promise.all([fetchRoster(wallet), fetchFighterLevels()]).then(([roster, levels]) => {
  const now = Date.now()
  createRoot(document.getElementById('root')!).render(
    <div className={`drost${phone ? ' drost--phone drost--stack' : ''}`} style={{ maxWidth: phone ? 360 : 900 }}>
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
            level={levelUpOf(f, levels)}
            max={levels.length > 0 && levelUpOf(f, levels).atMax}
          />
        ))}
      </div>
    </div>,
  )
})
