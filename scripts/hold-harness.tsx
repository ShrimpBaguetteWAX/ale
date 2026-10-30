/**
 * The fight pickers' full view for a real roster - see hold-harness.html.
 */
import { createRoot } from 'react-dom/client'
import { fetchClassTemplates, fetchRoster } from '../src/dungeon/queries'
import { fetchFightersConfig } from '../src/fighters/queries'
import { HolderRow, figuresOf, type View } from '../src/fighters/DeskRoster'
import { fighterAvailable } from '../src/dungeon/rules'
import { TeamDock } from '../src/fight/TeamDock'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/game'

const q = new URLSearchParams(location.search)
const wallet = q.get('as') ?? 'onabs.wam'
const phone = q.get('phone') === '1'
const view = (q.get('view') ?? 'default') as View
/* ?dock=1: the team dock with the first four fighters picked. */
const dock = q.get('dock') === '1'

void Promise.all([fetchRoster(wallet), fetchFightersConfig(), fetchClassTemplates()]).then(([roster, config, templates]) => {
  const now = Date.now()
  createRoot(document.getElementById('root')!).render(
    <div className={`drost pickdrost${phone ? ' drost--phone drost--stack' : ''}`} style={{ maxWidth: phone ? 360 : 1200 }}>
      {dock && (
        <TeamDock
          slots={[...roster.slice(0, 4), null]}
          share={0.6}
          winRate={0.58}
          against="the dungeon"
          action={<button className="btn btn--primary">Start Fight</button>}
          sheet={phone}
        />
      )}
      <div className="drost__holders">
        {roster.slice(0, 8).map((f, i) => {
          const state = fighterAvailable(f)
          return (
            <HolderRow
              key={f.fighter_id}
              f={f}
              fig={figuresOf(f, templates.get(f.classname), config, 1, 0.995, now, false)}
              view={view}
              now={now}
              inTeam={i === 0}
              blocked={!state.available}
              reason={state.available ? undefined : state.reason}
              onClick={() => {}}
            />
          )
        })}
      </div>
    </div>,
  )
})
