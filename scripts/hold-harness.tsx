/**
 * The fight pickers' full view for a real roster - see hold-harness.html.
 */
import { createRoot } from 'react-dom/client'
import { fetchClassTemplates, fetchRoster } from '../src/dungeon/queries'
import { fetchFightersConfig } from '../src/fighters/queries'
import { HolderRow, figuresOf, type View } from '../src/fighters/DeskRoster'
import { fighterAvailable } from '../src/dungeon/rules'
import { TeamDock } from '../src/fight/TeamDock'
import { CombatCard, rosterPanel } from '../src/fight/setup'
import { MatchupHud } from '../src/fight/matchupStyle'
import { CodexReadout, FighterHoverCard } from '../src/components/FighterPanel'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/game'

const q = new URLSearchParams(location.search)
const wallet = q.get('as') ?? 'onabs.wam'
const phone = q.get('phone') === '1'
const view = (q.get('view') ?? 'default') as View
/* ?dock=1: the team dock with the first four fighters picked. */
const dock = q.get('dock') === '1'
/* ?hover=1: the hover read of the first three fighters, laid out flat. */
const hover = q.get('hover') === '1'
const market = q.get('market') === '1'
/* ?readout=1: the codex readout the tavern draws its recruit with. */
const readout = q.get('readout') === '1'
/* ?medal=1: three team cards in the matchup's medallion look, with their remove buttons. */
const medal = q.get('medal') === '1'

void Promise.all([fetchRoster(wallet), fetchFightersConfig(), fetchClassTemplates()]).then(([roster, config, templates]) => {
  const now = Date.now()
  createRoot(document.getElementById('root')!).render(
    <div className={`drost pickdrost${phone ? ' drost--phone drost--stack' : ''}`} style={{ maxWidth: phone ? 360 : 1200 }}>
      {medal && (
        <MatchupHud.Provider value>
          <div className="versus--hud" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 120px)', gap: 12, marginBottom: 20 }}>
            {roster.slice(0, 3).map((f) => (
              <CombatCard
                key={f.fighter_id}
                element={f.element}
                classname={f.classname}
                racename={f.racename}
                level={f.stats.level}
                health={100}
                damage={50}
                side="mine"
                marker={f.marker}
                preview={() => ({ panel: rosterPanel(f, 1, 0.995), template: templates.get(f.classname) })}
                onRemove={() => ((window as unknown as { removed: number }).removed = f.fighter_id)}
                onOpen={() => ((window as unknown as { opened: number }).opened = f.fighter_id)}
              />
            ))}
          </div>
        </MatchupHud.Provider>
      )}
      {readout && (
        <div className="hall__stage" style={{ maxWidth: 560, padding: 16, marginBottom: 20 }}>
          <CodexReadout fighter={rosterPanel(roster[0], 1, 0.995)} template={templates.get(roster[0].classname)} />
        </div>
      )}
      {hover && (
        <div style={{ display: 'grid', gap: 24 }}>
          {roster.slice(0, 3).map((f) => (
            <FighterHoverCard key={f.fighter_id} fighter={rosterPanel(f, 1, 0.995)} template={templates.get(f.classname)} />
          ))}
        </div>
      )}
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
        {roster.slice(0, Number(q.get("n") ?? 8)).map((f, i) => {
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
              /* ?market=1: the Market's price on each, the second picked, a sale tick on the third. */
              picked={market && i === 1}
              aside={market ? <span className="mcard__price"><b className="mono">{(1200 + i * 75).toLocaleString()}</b><small>2d 4h</small></span> : undefined}
              tick={market && i === 2 ? <span className="drost__tick hold__tick is-on" /> : undefined}
            />
          )
        })}
      </div>
    </div>,
  )
})
