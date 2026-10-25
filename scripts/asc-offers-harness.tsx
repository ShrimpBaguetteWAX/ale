/**
 * The upgrade step with React running — see asc-offers-harness.html.
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { fetchRoster } from '../src/dungeon/queries'
import type { RosterFighter } from '../src/dungeon/types'
import type { StatCaps } from '../src/ascension/queries'
import { DeskOffers } from '../src/ascension/DeskOffers'
import { PhoneAscension } from '../src/ascension/PhoneAscension'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/tavern.css'
import '../src/styles/market.css'
import '../src/styles/fighters.css'
import '../src/styles/account.css'
import '../src/styles/dungeon.css'
import '../src/styles/tournament.css'

/* The live `ascend.ale` caps. */
const CAPS: StatCaps = {
  health_min: 100,
  health_max: 32000,
  damage_min: 100,
  damage_max: 32000,
  taunt_min: 0,
  taunt_max: 32000,
  initiative_min: 0,
  initiative_max: 32000,
  attackspeed_min: 100,
  attackspeed_max: 32000,
  res_gem: 800,
  res_metal: 800,
  res_air: 800,
  res_fire: 800,
  res_nature: 800,
  res_neutral: 800,
}

const WALLET = new URLSearchParams(location.search).get('as') ?? 'onabs.wam'
const PHONE = new URLSearchParams(location.search).has('phone')

function Harness() {
  const [fighter, setFighter] = useState<RosterFighter | null>(null)
  useEffect(() => {
    void fetchRoster(WALLET).then((r) => {
      const f = r.find((x) => Number(x.stats.level) >= 10) ?? r[0]
      /* Close to the limits, so the offers below reach them. */
      const stats = { ...f.stats, res_gem: 776, initiative_min: 32, initiative_max: 46 }
      setFighter({
        ...f,
        stats,
        ascension_in_progress: 1,
        ascension_upgrades: [
          { stat_name: 'res_gem', value: 48, positive: 1 },
          { stat_name: 'initiative', value: 37, positive: 0 },
          { stat_name: 'damage', value: 45, positive: 1 },
        ],
      } as unknown as RosterFighter)
    })
  }, [])
  if (!fighter) return <p style={{ padding: 24 }}>Reading a roster…</p>

  const noop = () => {}
  if (PHONE) {
    return (
      <div className="ascension">
        <PhoneAscension
          ready={[]}
          target={null}
          onPickTarget={noop}
          byRequirement={{ race: [], element: [], ability: [] }}
          slots={{}}
          onAssign={noop}
          chosenFighters={[]}
          check={null}
          fee={999}
          credits={128192}
          busy={null}
          canAct
          onAscend={noop}
          pending={fighter}
          rerollFee={499}
          caps={CAPS}
          factor={1}
          onReroll={noop}
          onClaim={(s, v, p) => alert(`claim ${s} ${v} ${p}`)}
          odds={[]}
        />
      </div>
    )
  }
  return (
    <div className="ascension" style={{ padding: 24 }}>
      <header className="ascension__head">
        <h1 className="screen__title">Ascension</h1>
      </header>
      <DeskOffers
        fighter={fighter}
        rerollFee={499}
        credits={128192}
        busy={null}
        canAct
        caps={CAPS}
        factor={1}
        onReroll={noop}
        onClaim={(s, v, p) => alert(`claim ${s} ${v} ${p}`)}
        extra={
          /* A stand-in for the open odds table the screen puts here. */
          <details className="panel oddspanel" open>
            <summary className="oddspanel__summary">What can be rolled</summary>
            <div className="oddslist">
              {Array.from({ length: 12 }, (_, i) => (
                <div className="oddsrow" key={i}>
                  <span className="oddsrow__name">
                    <strong>Upgrade {i + 1}</strong>
                  </span>
                  <span className="oddsrow__range">+1 to +5</span>
                  <span className="oddsrow__chance">8.3%</span>
                </div>
              ))}
            </div>
          </details>
        }
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
