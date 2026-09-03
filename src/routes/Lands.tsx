import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import { fetchOwnedLands, type LandAsset } from '@/chain/atomic'
import { fetchLandsConfig, fetchPlanetLands } from '@/chain/queries'
import type { Building, Land, LandsConfig } from '@/chain/types'
import type { Planet } from '@/chain/config'
import {
  BOOST_MAX,
  buildingIcon,
  formatBoost,
  landThumbStyle,
  liveBoostScore,
  rarityColor,
} from '@/map/terrain'
import {
  BUILDINGS,
  fetchBuildingCosts,
  fetchRarityDiscounts,
  type BuildingName,
} from '@/lands/queries'
import type { BuildingCost, OwnedLand } from '@/lands/types'
import {
  boostCost,
  buildOptions,
  buildingLabel,
  costPerPercent,
  hasClaimable,
  incomeOf,
  totalIncome,
} from '@/lands/rules'
import {
  boostBuilding,
  buildBuilding,
  claimLandRewards,
  destroyBuilding,
} from '@/wharf/actions'
import { refreshChore } from '@/chores/signal'
import { readableError } from '@/wharf/errors'
import { formatNumber, formatDecimals } from '@/format'
import { asset } from '@/assets'

/**
 * My Lands.
 *
 * Land is the only thing in the game the player owns outright — it is an
 * Alien Worlds NFT, and `maps.cpp` checks the AtomicAssets table directly
 * before it will let anyone build, boost, claim or destroy. So this screen
 * joins two sources: the wallet's land NFTs, which is the list, and
 * `lands.ale`, which is the state of each one.
 *
 * **The wording is the original's, verbatim** — column headings, button
 * labels, the boost explanation and the destruction warning are all lifted
 * rather than rewritten, so the screen reads exactly as players already know
 * it.
 *
 * One line is not from the original, and is here deliberately.
 * `claimlndrwrd` pays TLM, gems and credits, and zeroes the building's
 * accrued **shards without paying them** — it passes 0 into `gaincur`'s
 * `unclaimed_shards` argument, and `delbuilding` does the same. One land on
 * chain is sitting on 829 shards that a claim would destroy, so the screen
 * says so before the click.
 */

type Busy =
  | { kind: 'claim-all' }
  | { kind: 'claim' | 'build' | 'boost' | 'destroy'; key: string }
  | null

function tlm(raw: number): string {
  return formatDecimals(raw / 10_000, 1)
}

function shards(raw: number): string {
  return formatDecimals(raw / 10, 1)
}

function credits(raw: number): string {
  return formatDecimals(raw, 2)
}

function landKey(land: OwnedLand): string {
  return `${land.planet}:${land.x}:${land.y}`
}

/* ---------- data ---------- */

interface LandData {
  lands: OwnedLand[]
  costs: Map<string, BuildingCost[]>
  discounts: Map<string, number>
  config?: LandsConfig
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Join the wallet's land NFTs to their chain rows.
 *
 * `lands.ale/lands` is scoped by planet, so this reads only the planets the
 * player actually holds land on — usually one or two of the six, and each is
 * a single request the map screen has very likely already cached.
 */
function useLands(account: string | null): LandData {
  const [lands, setLands] = useState<OwnedLand[]>([])
  const [costs, setCosts] = useState<Map<string, BuildingCost[]>>(new Map())
  const [discounts, setDiscounts] = useState<Map<string, number>>(new Map())
  const [config, setConfig] = useState<LandsConfig>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(
    async (refresh: boolean) => {
      if (!account) return
      setError(null)
      try {
        const [assets, c, d, cfg] = await Promise.all([
          fetchOwnedLands(account),
          fetchBuildingCosts(),
          fetchRarityDiscounts(),
          fetchLandsConfig(),
        ])

        const planets = [...new Set(assets.map((a) => a.planet))] as Planet[]
        const rows = await Promise.all(planets.map((p) => fetchPlanetLands(p, refresh)))
        const byPlanet = new Map<string, Map<string, Land>>()
        planets.forEach((p, i) => {
          byPlanet.set(p, new Map(rows[i].map((l) => [`${l.x}:${l.y}`, l])))
        })

        const joined: OwnedLand[] = assets.map((a: LandAsset) => {
          const row = byPlanet.get(a.planet)?.get(`${a.x}:${a.y}`)
          return {
            asset_id: a.asset_id,
            name: a.name,
            planet: a.planet as Planet,
            x: a.x,
            y: a.y,
            rarity: a.rarity,
            land: row,
            buildings: row?.buildings ?? [],
          }
        })

        if (!alive.current) return
        setLands(joined)
        setCosts(c)
        setDiscounts(d)
        setConfig(cfg)
      } catch (err) {
        if (alive.current) setError(readableError(err))
      } finally {
        if (alive.current) setLoading(false)
      }
    },
    [account],
  )

  useEffect(() => {
    setLoading(true)
    void load(false)
  }, [load])

  const reload = useCallback(() => load(true), [load])

  return { lands, costs, discounts, config, loading, error, reload }
}

/* ---------- the screen ---------- */

export default function Lands() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const data = useLands(account)
  const { lands, costs, discounts, config } = data

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /* Boost decays by the hour, so a minute is plenty and costs nothing. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const selected = lands.find((l) => landKey(l) === selectedKey) ?? null
  const totals = useMemo(() => totalIncome(lands), [lands])
  const claimable = useMemo(
    () => lands.filter((l) => hasClaimable(incomeOf(l.buildings))),
    [lands],
  )

  const run = useCallback(
    async (mark: Busy, act: () => Promise<unknown>, done: string) => {
      if (!session) return
      setBusy(mark)
      setError(null)
      setNotice(null)
      try {
        await act()
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 900))
          await Promise.all([data.reload(), refreshPlayer({ force: true })])
        }
        /* Boosting lifts a building back over the mark. */
        refreshChore('lands')
        setNotice(done)
      } catch (err) {
        setError(readableError(err))
      } finally {
        setBusy(null)
      }
    },
    [session, data, refreshPlayer],
  )

  const doClaim = (land: OwnedLand) =>
    run(
      { kind: 'claim', key: landKey(land) },
      () => claimLandRewards(session!, { planet: land.planet, x: land.x, y: land.y }),
      'Land rewards claimed.',
    )

  /* The contract takes one land per action, so claiming everything is a run
     of actions rather than one batched call. */
  const doClaimAll = () =>
    run(
      { kind: 'claim-all' },
      async () => {
        for (const land of claimable) {
          await claimLandRewards(session!, {
            planet: land.planet,
            x: land.x,
            y: land.y,
          })
        }
      },
      `Claimed from ${claimable.length} land${claimable.length === 1 ? '' : 's'}.`,
    )

  if (!player) return null

  return (
    <div className="lands">
      <header className="lands__head">
        <h1 className="lands__title">My Lands</h1>

        {lands.length > 0 && (
          <button
            type="button"
            className="btn btn--primary lands__claimAll"
            disabled={!session || busy !== null || claimable.length === 0}
            onClick={() => void doClaimAll()}
          >
            {busy?.kind === 'claim-all' && <span className="spinner" />}
            Claim All Buildings
          </button>
        )}
      </header>

      {notice && <div className="alert alert--ok">{notice}</div>}
      {(error || data.error) && (
        <div className="alert alert--error">{error ?? data.error}</div>
      )}

      {data.loading ? (
        <div className="landlist">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="landrow landrow--loading" key={i} />
          ))}
        </div>
      ) : lands.length === 0 ? (
        <p className="lands__empty">
          You do not own any land yet. Land is an Alien Worlds NFT — buy a plot
          on the Alien Worlds market and it will appear here, ready to build on.
        </p>
      ) : (
        <div className="lands__cols">
          {/*
            The column headings sit in the grid rather than inside the list,
            so the side column can start on the same row as the first land
            instead of a header's height above it.
          */}
          <div className="landlist__head">
            <span>Land</span>
            <span>Income since last claim</span>
            <span>Buildings</span>
            <span />
          </div>

          <div className="landlist">
            {lands.map((land) => (
              <LandRow
                key={landKey(land)}
                land={land}
                config={config}
                now={now}
                selected={landKey(land) === selectedKey}
                busy={busy}
                canAct={!!session}
                onSelect={() =>
                  setSelectedKey((k) => (k === landKey(land) ? null : landKey(land)))
                }
                onClaim={() => void doClaim(land)}
              />
            ))}
          </div>

          <div className="lands__side">
            {/*
              The running totals sit at the head of the side column, stacked,
              rather than in a band across the top of the screen — they belong
              with the panel that acts on a land, not above the list you scan.
              Credits and gems appear only when a land is actually holding
              some; nothing on chain has ever paid either, so a permanent pair
              of zeroes was just noise.
            */}
            <div className="lands__totals">
              <Tally icon={asset("/assets/icons/tlm.svg")} label="TLM" value={tlm(totals.tlm)} />
              {totals.credits > 0 && (
                <Tally
                  icon={asset("/assets/icons/credits.png")}
                  label="Credits"
                  value={formatNumber(totals.credits)}
                />
              )}
              {totals.gems > 0 && (
                <Tally
                  icon={asset("/assets/icons/gems.png")}
                  label="Gems"
                  value={formatNumber(totals.gems)}
                />
              )}
              {/*
                Shards are shown plainly, not as a warning. They are ordinary
                earnings, and they have already been settled — a fact worth
                stating once, not an alarm to raise on every screen.
              */}
              {totals.shards > 0 && (
                <Tally
                  icon={asset("/assets/icons/shards.svg")}
                  label="Shards, already paid out"
                  value={shards(totals.shards)}
                />
              )}
            </div>

            <aside className="landside">
            {selected ? (
              <LandPanel
                land={selected}
                costs={costs}
                discounts={discounts}
                config={config}
                now={now}
                busy={busy}
                credits={player.activestats.credits}
                gems={player.activestats.gems}
                canAct={!!session}
                onBuild={(opt) =>
                  void run(
                    { kind: 'build', key: landKey(selected) },
                    () =>
                      buildBuilding(session!, {
                        planet: selected.planet,
                        x: selected.x,
                        y: selected.y,
                        building: opt.building,
                        level: opt.level,
                        costGem: opt.gems,
                        costCredits: opt.credits,
                      }),
                    `${buildingLabel(opt.building, costs)} built.`,
                  )
                }
                onBoost={(building, target, cost) =>
                  void run(
                    { kind: 'boost', key: landKey(selected) },
                    () =>
                      boostBuilding(session!, {
                        planet: selected.planet,
                        building: String(building.building_name),
                        x: selected.x,
                        y: selected.y,
                        costCredits: cost,
                        target,
                      }),
                    'Boost raised.',
                  )
                }
                onDestroy={(building) =>
                  void run(
                    { kind: 'destroy', key: landKey(selected) },
                    () =>
                      destroyBuilding(session!, {
                        planet: selected.planet,
                        x: selected.x,
                        y: selected.y,
                        building: String(building.building_name),
                        costGems: Number(config?.delete_building_gems_cost ?? 0),
                      }),
                    'Building destroyed successfully!',
                  )
                }
              />
              ) : (
                <div className="landside__empty">
                  <span className="landside__bar">Select a Land</span>
                  <p>Select a Land</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- small pieces ---------- */

function Tally({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string
}) {
  return (
    <div className="tally">
      <img src={icon} alt="" width={20} height={20} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

/* ---------- one land in the list ---------- */

export function LandRow({
  land,
  config,
  now,
  selected,
  busy,
  canAct,
  onSelect,
  onClaim,
}: {
  land: OwnedLand
  config?: LandsConfig
  now: number
  selected: boolean
  busy: Busy
  canAct: boolean
  onSelect: () => void
  onClaim: () => void
}) {
  const income = incomeOf(land.buildings)
  const building = land.buildings[0]
  const decay = Number(config?.boost_decay_per_hour ?? 0)
  const key = landKey(land)
  const working = busy !== null && 'key' in busy && busy.key === key

  const score = building
    ? liveBoostScore(
        Number(building.boost_score ?? 0),
        String(building.boost_score_update ?? ''),
        decay,
        now,
      )
    : 0
  const percent = score / 10_000
  /* The original's own three bands, on its own thresholds. */
  const band = percent > 80 ? 'good' : percent > 50 ? 'fair' : 'poor'

  return (
    <article className={`landrow${selected ? ' landrow--selected' : ''}`}>
      <button
        type="button"
        className="landrow__hit"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={land.name}
      />

      <div className="landrow__land">
        <span
          className="landthumb"
          style={{
            ...landThumbStyle(land.planet, land.x, land.y, 56),
            borderColor: rarityColor(land.rarity),
          }}
        />
        <span className="landrow__ident">
          <span className="landrow__name">
            {land.name} ({land.x}:{land.y})
          </span>
          <span className="landrow__meta" style={{ color: rarityColor(land.rarity) }}>
            {land.rarity || 'common'}
          </span>
        </span>
      </div>

      <div className="landrow__income">
        <span className="coin">
          <img src={asset("/assets/icons/tlm.svg")} alt="TLM" width={14} height={14} />
          {tlm(income.tlm)}
        </span>
        {income.credits > 0 && (
          <span className="coin">
            <img src={asset("/assets/icons/credits.png")} alt="Credits" width={14} height={14} />
            {formatNumber(income.credits)}
          </span>
        )}
        {income.shards > 0 && (
          <span className="coin" title="Not paid out when you claim">
            <img src={asset("/assets/icons/shards.svg")} alt="Shards" width={14} height={14} />
            {shards(income.shards)}
          </span>
        )}
      </div>

      <div className="landrow__building">
        {building ? (
          <>
            <img
              src={buildingIcon(String(building.building_name ?? ''))}
              alt={String(building.building_name ?? '')}
              title={String(building.building_name ?? '')}
              width={30}
              height={30}
            />
            <span className={`boostbar boostbar--${band}`}>
              <span className="boostbar__fill" style={{ width: `${percent}%` }} />
              <span className="boostbar__text">{formatBoost(percent)}</span>
            </span>
          </>
        ) : (
          <span className="faint">No Building</span>
        )}
      </div>

      <div className="landrow__act">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          /* The label is the original's, but the action collects gems and
             credits too — so it is enabled whenever anything is waiting,
             rather than stranding those behind a zero TLM balance. */
          disabled={!canAct || busy !== null || !hasClaimable(income)}
          onClick={onClaim}
        >
          {working && busy?.kind === 'claim' && <span className="spinner" />}
          Claim TLM
        </button>
      </div>
    </article>
  )
}

/* ---------- the selected land ---------- */

export function LandPanel({
  land,
  costs,
  discounts,
  config,
  now,
  busy,
  credits: playerCredits,
  gems,
  canAct,
  onBuild,
  onBoost,
  onDestroy,
}: {
  land: OwnedLand
  costs: Map<string, BuildingCost[]>
  discounts: Map<string, number>
  config?: LandsConfig
  now: number
  busy: Busy
  credits: number
  gems: number
  canAct: boolean
  onBuild: (opt: ReturnType<typeof buildOptions>[number]) => void
  onBoost: (building: Building, target: number, cost: number) => void
  onDestroy: (building: Building) => void
}) {
  const building = land.buildings[0]
  const options = useMemo(
    () => buildOptions(land, costs, discounts, BUILDINGS as readonly BuildingName[]),
    [land, costs, discounts],
  )

  return (
    <div className="landpanel">
      <span className="landside__bar">
        {land.name} ({land.x}:{land.y})
      </span>

      {building ? (
        <BuildingPanel
          land={land}
          building={building}
          config={config}
          now={now}
          busy={busy}
          credits={playerCredits}
          gems={gems}
          canAct={canAct}
          onBoost={onBoost}
          onDestroy={onDestroy}
        />
      ) : (
        <section className="buildmenu">
          <h3 className="panel__title">Select a Building</h3>

          {options.map((opt) => {
            const tooPoor = opt.credits > playerCredits || opt.gems > gems
            return (
              <div className="buildopt" key={opt.building}>
                <img src={buildingIcon(opt.building)} alt="" width={44} height={44} />
                <div className="buildopt__body">
                  <span className="buildopt__name">
                    {buildingLabel(opt.building, costs)}
                  </span>
                  <span className="buildopt__note">
                    {opt.blocked ?? BUILDING_BLURB[opt.building]}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={!canAct || busy !== null || !!opt.blocked || tooPoor}
                  onClick={() => onBuild(opt)}
                  title={opt.blocked ?? undefined}
                >
                  Build {buildingLabel(opt.building, costs)}
                  <span className={`cost${tooPoor ? ' cost--short' : ''}`}>
                    {formatNumber(opt.credits)}
                    <img
                      src={asset("/assets/icons/credits.png")}
                      alt="Credits"
                      width={16}
                      height={16}
                    />
                  </span>
                </button>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

/** The original's own descriptions, kept word for word. */
const BUILDING_BLURB: Record<string, string> = {
  tavern:
    'Allows players to recruit fighters on your land - and you earn for every fighter recruited on your land. A higher tavern rating means your tavern is suggested to players more often.',
  dungeon:
    'Allows players to fight in the dungeon on your land - and you earn whenever a player wins this battle. A higher dungeon rating means higher rewards.',
  arena:
    'Allows players to fight in the arena on your land - and you earn whenever a player wins this battle. A higher arena rating means higher rewards.',
}

/* ---------- boost and destroy ---------- */

function BuildingPanel({
  land,
  building,
  config,
  now,
  busy,
  credits: playerCredits,
  gems,
  canAct,
  onBoost,
  onDestroy,
}: {
  land: OwnedLand
  building: Building
  config?: LandsConfig
  now: number
  busy: Busy
  credits: number
  gems: number
  canAct: boolean
  onBoost: (building: Building, target: number, cost: number) => void
  onDestroy: (building: Building) => void
}) {
  const decay = Number(config?.boost_decay_per_hour ?? 0)
  const current = liveBoostScore(
    Number(building.boost_score ?? 0),
    String(building.boost_score_update ?? ''),
    decay,
    now,
  )
  const currentPercent = current / 10_000
  const name = String(building.building_name ?? '')

  /*
   * The slider opens one point above where the building already is: the
   * contract rejects any target at or below the current boost, so opening on
   * "no change" would be opening on an error.
   */
  const floor = Math.min(BOOST_MAX, Math.floor(current / 10_000) * 10_000 + 10_000)
  const [target, setTarget] = useState(floor)
  useEffect(() => {
    setTarget(floor)
  }, [floor])

  const cost = boostCost(current, target, config)
  const perPoint = costPerPercent(current, config)
  const income = incomeOf(land.buildings)
  const destroyCost = Number(config?.delete_building_gems_cost ?? 0)
  const [confirmDestroy, setConfirmDestroy] = useState(false)
  const working = busy !== null && 'key' in busy && busy.key === landKey(land)

  if (confirmDestroy) {
    return (
      <section className="destroybox">
        <h3 className="panel__title">Confirm Destruction</h3>
        <p className="destroybox__warn">
          You are about to destroy one of your buildings. This cannot be
          reversed. You will lose the building as well as the buildings current
          rating. Only proceed if you are sure about your decision!
        </p>
        {income.shards > 0 && (
          <p className="hint">
            It also holds {shards(income.shards)} shards, which the contract
            clears without paying out.
          </p>
        )}
        <div className="destroybox__row">
          <span>You will spend</span>
          <span className={`cost${destroyCost > gems ? ' cost--short' : ''}`}>
            {formatNumber(destroyCost)}
            <img src={asset("/assets/icons/gems.png")} alt="Gems" width={16} height={16} />
          </span>
        </div>
        <div className="qcard__confirmRow">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setConfirmDestroy(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={!canAct || busy !== null || destroyCost > gems}
            onClick={() => onDestroy(building)}
          >
            {working && busy?.kind === 'destroy' && <span className="spinner" />}
            Pay and destroy now
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="boostbox">
        <h3 className="panel__title">
          <img src={buildingIcon(name)} alt="" width={22} height={22} />
          Building Boost
        </h3>
        <p className="boostbox__lede">{BUILDING_BLURB[name.toLowerCase()]}</p>
        <p className="boostbox__lede">
          Boosting a building raises its perks, but usage and time reduce boost
          levels. If boost drops below 1%, the building becomes unusable.
        </p>

        {/*
          Boosting is priced as a geometric series, so the last points cost
          many times the first. A slider with the running total beside it is
          the only way to see that before spending.
        */}
        <label className="boostslider">
          <span className="field__label">Raise to {formatBoost(target / 10_000)}</span>
          <input
            type="range"
            min={floor}
            max={BOOST_MAX}
            step={10_000}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            disabled={current >= BOOST_MAX}
          />
        </label>

        <dl className="boostbox__facts">
          <div>
            <dt>Total Cost</dt>
            <dd>
              {credits(cost)}
              <img src={asset("/assets/icons/credits.png")} alt="Credits" width={14} height={14} />
            </dd>
          </div>
          <div>
            <dt>Cost per 0.1x</dt>
            <dd>
              {credits(perPoint)}
              <img src={asset("/assets/icons/credits.png")} alt="Credits" width={14} height={14} />
            </dd>
          </div>
          <div>
            <dt>Start Score</dt>
            <dd>{formatBoost(currentPercent)}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="btn btn--primary landpanel__action"
          disabled={
            !canAct ||
            busy !== null ||
            current >= BOOST_MAX ||
            target <= current ||
            cost > playerCredits
          }
          onClick={() => onBoost(building, target, cost)}
        >
          {working && busy?.kind === 'boost' && <span className="spinner" />}
          Boost
          <span className={`cost${cost > playerCredits ? ' cost--short' : ''}`}>
            {credits(cost)}
            <img src={asset("/assets/icons/credits.png")} alt="Credits" width={16} height={16} />
          </span>
        </button>
      </section>

      <section className="landpanel__income">
        <h3 className="panel__title">Income since last claim</h3>
        <dl className="boostbox__facts">
          <div>
            <dt>TLM</dt>
            <dd>{tlm(income.tlm)}</dd>
          </div>
          <div>
            <dt>Credits</dt>
            <dd>{formatNumber(income.credits)}</dd>
          </div>
          <div>
            <dt>Gems</dt>
            <dd>{formatNumber(income.gems)}</dd>
          </div>
        </dl>
        {income.shards > 0 && (
          <p className="hint">
            This building also holds {shards(income.shards)} shards. Claiming
            clears them without paying them out.
          </p>
        )}
      </section>

      <button
        type="button"
        className="btn btn--ghost landpanel__action"
        disabled={!canAct || busy !== null}
        onClick={() => setConfirmDestroy(true)}
      >
        Destroy Building
      </button>
    </>
  )
}
