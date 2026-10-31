/**
 * My Fighters for a real roster, without a wallet - see roster-harness.html.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { fetchClassTemplates, fetchRoster } from '../src/dungeon/queries'
import { fetchFighterLevels, fetchFightersConfig } from '../src/fighters/queries'
import { EMPTY_FILTER, type RosterFilter } from '../src/dungeon/filters'
import { DeskRoster, type Mode } from '../src/fighters/DeskRoster'
import type { RosterFighter } from '../src/dungeon/types'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/game'

const q = new URLSearchParams(location.search)
const wallet = q.get('as') ?? 'onabs.wam'
const phone = q.get('phone') === '1'
try {
  if (q.has('compact')) localStorage.setItem(`ale.roster.density.${phone ? 'phone' : 'desk'}`, q.get('compact') === '1' ? 'compact' : 'cards')
} catch {
  /* no storage: the default layout */
}

function Harness({ roster, ...rest }: { roster: RosterFighter[] } & Record<string, unknown>) {
  const [filter, setFilter] = useState<RosterFilter>(EMPTY_FILTER)
  const [mode, setMode] = useState<Mode>('inventory')
  const [selectedId, setSelectedId] = useState<number | null>(roster[Number(q.get('pick') ?? 0)]?.fighter_id ?? null)
  const nop = () => {}
  return (
    <DeskRoster
      phone={phone}
      roster={roster}
      shown={roster}
      filter={filter}
      onFilter={setFilter}
      templates={rest.templates as never}
      levels={rest.levels as never}
      config={rest.config as never}
      levelMod={1}
      ageDecay={0.995}
      now={Date.now()}
      atLevelOne={false}
      onAtLevelOne={nop}
      readyToLevel={0}
      lockedCount={roster.filter((f) => f.in_use).length}
      loading={false}
      banner={null}
      mode={mode}
      onMode={setMode}
      checked={[]}
      onCheck={nop}
      onChecked={nop}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onMarker={nop}
      canAct
      busy={null}
      credits={1_000_000}
      gems={100_000}
      payAll={{ ids: [], credits: 0 }}
      payAllCount={0}
      payScope="overdue"
      onPayScope={nop}
      overdue={0}
      levelAll={{ ids: [], credits: 0, gems: 0, fighters: 0 }}
      onPayAll={nop}
      onLevelAll={nop}
      onPayOne={nop}
      onLevelOne={nop}
      sellValue={0}
      onSell={nop}
      listPlan={{ ids: [], gems: 0, gate: { ok: false } }}
      startPrice={0}
      onStartPrice={nop}
      minStart={0}
      keepListed={false}
      onKeepListed={nop}
      onList={nop}
    />
  )
}

void Promise.all([fetchRoster(wallet), fetchFighterLevels(), fetchFightersConfig(), fetchClassTemplates()]).then(
  ([roster, levels, config, templates]) => {
    createRoot(document.getElementById('root')!).render(
      <MemoryRouter>
        <Harness roster={roster} levels={levels} config={config} templates={templates} />
      </MemoryRouter>,
    )
  },
)
