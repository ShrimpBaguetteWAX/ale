import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import { fetchOwnedLands, type LandAsset } from '@/chain/atomic'
import { fetchPlanetLands } from '@/chain/queries'
import type { Building, Land, LandsConfig } from '@/chain/types'
import type { Planet } from '@/chain/config'
import {
  BOOST_MAX,
  BUILDING_SRC,
  RANKED_SRC,
  buildingIcon,
  boostRank,
  formatBoost,
  landThumbStyle,
  liveBoostScore,
  PLANET_MAP_H,
  PLANET_MAP_W,
  PLANET_TILE,
  planetMapSrc,
  rarityColor,
} from '@/map/terrain'
import { BUILDINGS, type BuildingName } from '@/lands/queries'
import type { BuildingCost, OwnedLand } from '@/lands/types'
import {
  boostCost,
  boostState,
  buildOptions,
  buildingLabel,
  claimAllTargets,
  formatSpan,
  hoursToSmallerLook,
  type BoostState,
  hasClaimable,
  incomeOf,
  totalIncome,
} from '@/lands/rules'
import {
  boostBuilding,
  buildBuilding,
  claimAllLandRewards,
  claimLandRewards,
  destroyBuilding,
} from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { useChainQuery } from '@/chain/useChainQuery'
import { useConfig, useLazyConfig } from '@/state/useConfig'
import { DIRTIES } from '@/wharf/actions'
import { formatNumber, formatDecimals } from '@/format'
import { ActionBanner } from '@/components/ActionBanner'
import { asset } from '@/assets'
import { usePhone } from '@/components/usePhone'
import { BottomSheet } from '@/components/BottomSheet'

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

/*
 * This screen identifies a working button by what it does *and* which land it
 * does it to; the hook keys one by a single string. Encoded going in, parsed
 * coming back, so every comparison below and both child components keep the
 * shape they were written for.
 */
type LandBusy = 'claim' | 'build' | 'boost' | 'destroy'

const busyKey = (kind: LandBusy, key: string) => `${kind}:${key}`

function parseBusy(raw: string | null): Busy {
  if (!raw) return null
  const at = raw.indexOf(':')
  if (at < 0) return { kind: 'claim-all' }
  return { kind: raw.slice(0, at) as LandBusy, key: raw.slice(at + 1) }
}

function tlm(raw: number): string {
  return formatDecimals(raw / 10_000, 1)
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
  reload: () => Promise<unknown>
}

/**
 * Join the wallet's land NFTs to their chain rows.
 *
 * `lands.ale/lands` is scoped by planet, so this reads only the planets the
 * player actually holds land on — usually one or two of the six, and each is
 * a single request the map screen has very likely already cached.
 */
function useLands(account: string | null): LandData {
  /*
     Three of the four reads this used to make were config — the same build
     costs, rarity discounts and land settings for every player. They come
     from the store now, so what is left is the one read that is actually
     about this wallet.
  */
  const { lands: config } = useConfig()
  const costs = useLazyConfig('buildingCosts') ?? EMPTY_COSTS
  const discounts = useLazyConfig('rarityDiscounts') ?? EMPTY_DISCOUNTS

  const query = useChainQuery(
    account && `lands:${account}`,
    async () => {
      const assets = await fetchOwnedLands(account!)

      /* Only the planets this wallet actually holds land on — usually one or
         two of the six, and each is a read the map has very likely cached. */
      const planets = [...new Set(assets.map((a) => a.planet))] as Planet[]
      const rows = await Promise.all(planets.map((p) => fetchPlanetLands(p)))
      const byPlanet = new Map<string, Map<string, Land>>()
      planets.forEach((p, i) => {
        byPlanet.set(p, new Map(rows[i].map((l) => [`${l.x}:${l.y}`, l])))
      })

      return assets.map((a: LandAsset) => {
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
      }) as OwnedLand[]
    },
    /* Building, boosting and destroying all rewrite the land row this screen
       is drawn from. */
    { deps: ['lands'] },
  )

  return {
    lands: query.data ?? EMPTY_LANDS,
    costs,
    discounts,
    config,
    loading: query.loading,
    error: query.error,
    reload: query.reload,
  }
}

const EMPTY_LANDS: OwnedLand[] = []
const EMPTY_COSTS = new Map<string, BuildingCost[]>()
const EMPTY_DISCOUNTS = new Map<string, number>()

/* ---------- the screen ---------- */

export default function Lands() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)

  const data = useLands(account)
  const { lands, costs, discounts, config } = data

  const { busy: rawBusy, error, run } = useAction()
  const busy = parseBusy(rawBusy)

  /* Boost decays by the hour, so a minute is plenty and costs nothing. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const totals = useMemo(() => totalIncome(lands), [lands])
  const claimable = useMemo(() => claimAllTargets(lands), [lands])

  /* Boosting lifts a building back over the mark. */
  const opts = (action: keyof typeof DIRTIES) => ({
    after: data.reload,
    dirties: DIRTIES[action],
  })

  const doClaim = (land: OwnedLand) =>
    run(
      busyKey('claim', landKey(land)),
      () => claimLandRewards(session!, { planet: land.planet, x: land.x, y: land.y }),
      'Land rewards claimed.',
      opts('claimLandRewards'),
    )

  /*
     One transaction with a claim per land that holds TLM — one signature,
     and nothing half done if the wallet or the chain says no.

     Which lands hold TLM is read again from the chain first, not taken from
     the screen. The rows on screen are cached, and survive a reload: a land
     claimed a moment ago — elsewhere, or by an earlier attempt that failed
     part way, which never clears the cache — still shows its TLM there. One
     such land in the batch sends a zero transfer, and `alien.worlds`
     refuses the whole transaction with "must transfer positive quantity".
  */
  const doClaimAll = () =>
    run(
      'claim-all',
      async () => {
        const planets = [...new Set(lands.map((l) => l.planet))]
        const fresh = await Promise.all(planets.map((p) => fetchPlanetLands(p, true)))
        const rows = new Map<string, Land>()
        planets.forEach((p, i) => {
          for (const row of fresh[i]) rows.set(`${p}:${row.x}:${row.y}`, row)
        })
        /* The screen catches up with what was just read, claim or no claim. */
        void data.reload()

        /* A land missing from the fresh read is left out rather than guessed. */
        const targets = claimAllTargets(
          lands.flatMap((l) => {
            const row = rows.get(landKey(l))
            return row ? [{ ...l, buildings: row.buildings }] : []
          }),
        )
        if (targets.length === 0) {
          throw new Error('None of your lands has any TLM to claim right now.')
        }
        return claimAllLandRewards(
          session!,
          targets.map((land) => ({ planet: land.planet, x: land.x, y: land.y })),
        )
      },
      'Land rewards claimed.',
      opts('claimLandRewards'),
    )

  /* Build, boost and destroy, for whichever land asks: the desktop's panel
     and the phone's sheet both call these. */
  const doBuild = (land: OwnedLand, opt: ReturnType<typeof buildOptions>[number]) =>
    void run(
      busyKey('build', landKey(land)),
      () =>
        buildBuilding(session!, {
          planet: land.planet,
          x: land.x,
          y: land.y,
          building: opt.building,
          level: opt.level,
          costGem: opt.gems,
          costCredits: opt.credits,
        }),
      `${buildingLabel(opt.building, costs)} built.`,
      opts('buildBuilding'),
    )
  const doBoost = (land: OwnedLand, building: Building, target: number, cost: number) =>
    void run(
      busyKey('boost', landKey(land)),
      () =>
        boostBuilding(session!, {
          planet: land.planet,
          building: String(building.building_name),
          x: land.x,
          y: land.y,
          costCredits: cost,
          target,
        }),
      'Boost raised.',
      opts('boostBuilding'),
    )
  const doDestroy = (land: OwnedLand, building: Building) =>
    void run(
      busyKey('destroy', landKey(land)),
      () =>
        destroyBuilding(session!, {
          planet: land.planet,
          x: land.x,
          y: land.y,
          building: String(building.building_name),
          costGems: Number(config?.delete_building_gems_cost ?? 0),
        }),
      'Building destroyed successfully!',
      opts('destroyBuilding'),
    )

  const phone = usePhone()

  if (!player) return null

  return (
    <div className="lands">
      <header className="lands__head">
        <h1 className="lands__title">My Lands</h1>

      </header>

      <ActionBanner error={error ?? data.error} />

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
      ) : phone ? (
        <PhoneLands
          lands={lands}
          costs={costs}
          discounts={discounts}
          config={config}
          now={now}
          busy={busy}
          credits={player.activestats.credits}
          gems={player.activestats.gems}
          canAct={!!session}
          claimableCount={claimable.length}
          totalTlm={totals.tlm}
          onClaimAll={() => void doClaimAll()}
          onClaim={(land) => void doClaim(land)}
          onBuild={doBuild}
          onBoost={doBoost}
          onDestroy={doDestroy}
        />
      ) : (
        <DeskLands
          lands={lands}
          costs={costs}
          discounts={discounts}
          config={config}
          now={now}
          busy={busy}
          credits={player.activestats.credits}
          gems={player.activestats.gems}
          canAct={!!session}
          claimableCount={claimable.length}
          totalTlm={totals.tlm}
          onClaimAll={() => void doClaimAll()}
          onClaim={(land) => void doClaim(land)}
          onBuild={doBuild}
          onBoost={doBoost}
          onDestroy={doDestroy}
        />
      )}
    </div>
  )
}

/* ---------- small pieces ---------- */

/** The original's own descriptions, kept word for word. */
const BUILDING_BLURB: Record<string, string> = {
  tavern:
    'Allows players to recruit fighters on your land - and you earn for every fighter recruited on your land. A higher tavern rating means your tavern is suggested to players more often.',
  dungeon:
    'Allows players to fight in the dungeon on your land - and you earn whenever a player wins this battle. A higher dungeon rating means higher rewards.',
  arena:
    'Allows players to fight in the arena on your land - and you earn whenever a player wins this battle. A higher arena rating means higher rewards.',
}

/* ---------- the lands by building: tiles on a desktop, rows on a phone ---------- */

type PhoneTab = 'all' | BuildingName

/* "Methane Swampland on Eyeke" reads as "Methane Swampland": the planet has its own line. */
function shortName(name: string): string {
  return name.split(' on ')[0] || name
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

function landBuilding(land: OwnedLand): string {
  return String(land.buildings[0]?.building_name ?? '').toLowerCase()
}

/* The multiplier the player reads, with a proper times sign. */
function boostLabel(percent: number): string {
  return formatBoost(percent).replace('x', '×')
}

/*
   The building as the world map draws it at this boost: the hydra grows
   heads and the arena its walls, rank by rank. A tavern has one look.
*/
function buildingArt(name: string, score: number, muted = false): string {
  const tone = muted ? 'muted' : 'lit'
  if (name === 'arena' || name === 'dungeon') {
    return RANKED_SRC[name][boostRank(score / 10_000) - 1][tone]
  }
  if (name === 'tavern') return BUILDING_SRC.tavern[tone]
  return buildingIcon(name)
}

/* Where the look changes, one step past each rank's top: 2.1x, 4.1x, 6.1x, 8.1x. */
const LOOK_STEPS = [210_000, 410_000, 610_000, 810_000]

/* How far ahead a drop to a smaller look is worth showing. */
const LOOK_WARNING_HOURS = 14 * 24

/* Off the map is under 0.1x, which rounds up to "0.1x" — say so instead. */
function stateLabel(score: number, state: BoostState): string {
  return state === 'hidden' ? '<0.1×' : boostLabel(score / 10_000)
}

const BOOST_LINE: Record<Exclude<BoostState, 'ok'>, string> = {
  low: 'Running low — boost soon',
  hidden: 'Off the map — boost it',
  /* Closed reads as off the map: to a player they are the same thing. */
  closed: 'Off the map — boost it',
}

function TlmIcon() {
  return <img className="plands__tlm" src={asset('/assets/icons/tlm.svg')} alt="TLM" />
}

function CreditIcon() {
  return <img className="plands__coin" src={asset('/assets/icons/credits.png')} alt="Credits" />
}

function GemIcon() {
  return <img className="plands__coin" src={asset('/assets/icons/gems.png')} alt="Gems" />
}

type BuildOption = ReturnType<typeof buildOptions>[number]

/**
 * My Lands on a desktop: the lands as the map draws them.
 *
 * The phone's page, given room: the ready-to-claim strip and the building
 * switch across the top, then every land as its own map tile with its
 * building on it and its boost in the corner. What needs a boost comes first —
 * a building off the map or closed is earning nothing — then the empty lands
 * waiting for a building, then the ones running fine. A tile opens the
 * phone's land sheet from the right, over the tiles rather than in place of
 * them, to claim, boost, destroy or build.
 */
function DeskLands({
  lands,
  costs,
  discounts,
  config,
  now,
  busy,
  credits: playerCredits,
  gems,
  canAct,
  claimableCount,
  totalTlm,
  onClaimAll,
  onClaim,
  onBuild,
  onBoost,
  onDestroy,
}: Parameters<typeof PhoneLands>[0]) {
  const [tab, setTab] = useState<PhoneTab>('all')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const decay = Number(config?.boost_decay_per_hour ?? 0)
  /*
     The column only where it fits beside four tiles; a narrower page opens
     the land as a drawer, as before. Measured on the page, not the window —
     the menu takes its share, and a column squeezed into what is left
     wrapped the claim strip and cut the building tabs off.
  */
  const [roomy, setRoomy] = useState(true)
  const watcher = useRef<ResizeObserver | null>(null)
  /* A callback ref, so the watch follows the element rather than the first one mounted. */
  const root = useCallback((el: HTMLDivElement | null) => {
    watcher.current?.disconnect()
    watcher.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setRoomy(entry.contentRect.width >= COLUMN_MIN_WIDTH))
    ro.observe(el)
    watcher.current = ro
  }, [])

  const scoreOf = (land: OwnedLand) => {
    const b = land.buildings[0]
    return b
      ? liveBoostScore(Number(b.boost_score ?? 0), String(b.boost_score_update ?? ''), decay, now)
      : 0
  }
  const stateOf = (land: OwnedLand) => (land.buildings[0] ? boostState(scoreOf(land), config) : 'ok')
  const count = (name: BuildingName) => lands.filter((l) => landBuilding(l) === name).length
  const inTab = tab === 'all' ? lands : lands.filter((l) => landBuilding(l) === tab)
  /* Lowest boost first in each group: the one closest to dropping off is the one to see. */
  const byBoost = (a: OwnedLand, b: OwnedLand) => scoreOf(a) - scoreOf(b)
  const needs = inTab.filter((l) => l.buildings[0] && stateOf(l) !== 'ok').sort(byBoost)
  const empty = tab === 'all' ? inTab.filter((l) => !l.buildings[0]) : []
  const fine = inTab.filter((l) => l.buildings[0] && stateOf(l) === 'ok').sort(byBoost)
  /* The column always shows a land: the one clicked, else the first on the page. */
  const clicked = inTab.find((l) => landKey(l) === openKey) ?? null
  const open = roomy ? (clicked ?? needs[0] ?? empty[0] ?? fine[0] ?? null) : clicked
  const tabs: [PhoneTab, string][] = [
    ['all', `All ${lands.length}`],
    ...(['dungeon', 'arena', 'tavern'] as BuildingName[]).map(
      (b) => [b, `${buildingLabel(b, costs)}s ${count(b)}`] as [PhoneTab, string],
    ),
  ]

  const tile = (land: OwnedLand) => {
    const building = land.buildings[0]
    const name = landBuilding(land)
    const score = scoreOf(land)
    const state = stateOf(land)
    const income = incomeOf(land.buildings)
    return (
      <button
        type="button"
        className={`dlands__tile${open === land ? ' is-open' : ''}`}
        key={landKey(land)}
        onClick={() => setOpenKey(landKey(land))}
      >
        <span
          className="dlands__map"
          style={{ ...landTileStyle(land.planet, land.x, land.y), borderColor: rarityColor(land.rarity) }}
        >
          {building ? (
            <img
              src={buildingArt(name, score, state === 'hidden' || state === 'closed')}
              alt={buildingLabel(name, costs)}
            />
          ) : (
            <span className="dlands__plot">Empty land</span>
          )}
          {building && state !== 'ok' && (
            <span className={`dlands__badge is-${state}`}>{BOOST_BADGE[state]}</span>
          )}
          {building && (
            <span className={`dlands__boost mono is-${state}`}>{stateLabel(score, state)}</span>
          )}
        </span>
        <span className="dlands__name">{shortName(land.name)}</span>
        <small className="dlands__where">
          {building ? buildingLabel(name, costs) : 'No building'} · {cap(land.planet)} {land.x}:
          {land.y}
        </small>
        {building ? (
          <span className="dlands__tlm mono">
            {tlm(income.tlm)}
            <TlmIcon />
          </span>
        ) : (
          <span className="btn btn--primary btn--sm dlands__build">Build</span>
        )}
      </button>
    )
  }

  const group = (title: string, hint: string, list: OwnedLand[]) =>
    list.length > 0 && (
      <section className="dlands__group" aria-label={title}>
        <h2 className="dlands__cap">
          {title} · {list.length}
          <span>{hint}</span>
        </h2>
        <div className="dlands__tiles">{list.map(tile)}</div>
      </section>
    )

  return (
    <div className={`dlands${roomy && open ? ' has-open' : ''}`} ref={root}>
      {/* Across the page; the land's column starts beside the first row of tiles. */}
      <div className="dlands__top">
        <div className="plands__claim">
          <TlmIcon />
          <span className="plands__claimtext">
            <small>Ready to claim</small>
            <b className="mono">{tlm(totalTlm)} TLM</b>
          </span>
          <button
            type="button"
            className="btn btn--gold btn--sm"
            disabled={!canAct || busy !== null || claimableCount === 0}
            onClick={onClaimAll}
          >
            {busy?.kind === 'claim-all' && <span className="spinner" />}
            Claim all
          </button>
        </div>
        {/* The shop's tabs, as on every desktop screen. */}
        <div className="tabs dlands__tabs" role="tablist" aria-label="Buildings">
          {tabs.map(([key, label]) => (
            <button
              type="button"
              key={key}
              role="tab"
              className="tabs__tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
              {lands.some(
                (l) => (key === 'all' || landBuilding(l) === key) && l.buildings[0] && stateOf(l) !== 'ok',
              ) && <i className="plands__dot" aria-label="needs a boost" />}
            </button>
          ))}
        </div>
      </div>

      <div className="dlands__main">
        {group('Needs a boost', 'players cannot see or use these, or soon will not', needs)}
        {group('Empty land', 'build a tavern, dungeon or arena and earn from every use', empty)}
        {/*
          Open, but never finished: a higher boost is more players and bigger
          rewards, so the heading says so rather than that there is nothing to do.
        */}
        {group(
          'Open for players',
          'boost higher for bigger rewards and more players',
          fine,
        )}
        {inTab.length === 0 && (
          <p className="plands__sum">
            <small>No {tab === 'all' ? 'lands' : buildingLabel(tab, costs).toLowerCase() + 's'} yet.</small>
          </p>
        )}
      </div>

      {open && (
        <LandSheet
          frame={roomy ? 'inline' : 'drawer'}
          key={landKey(open)}
          land={open}
          costs={costs}
          discounts={discounts}
          config={config}
          now={now}
          busy={busy}
          credits={playerCredits}
          gems={gems}
          canAct={canAct}
          onClose={() => setOpenKey(null)}
          onClaim={() => onClaim(open)}
          onBuild={(opt) => onBuild(open, opt)}
          onBoost={(b, target, cost) => onBoost(open, b, target, cost)}
          onDestroy={(b) => onDestroy(open, b)}
        />
      )}
    </div>
  )
}

/** Room for the land's column beside four tiles, as the page measures it. */
const COLUMN_MIN_WIDTH = 1000

/* A tile's corner badge: the phone's flag, in two words. */
const BOOST_BADGE: Record<Exclude<BoostState, 'ok'>, string> = {
  low: 'Running low',
  hidden: 'Off the map',
  closed: 'Off the map',
}

/**
 * A land's square of its planet's map at any size: the map is a grid of
 * 40 × 20 squares, so a percentage size and position pick out one square
 * however wide the tile turns out.
 */
function landTileStyle(planet: string, x: number, y: number): React.CSSProperties {
  return {
    backgroundImage: `url('${planetMapSrc(planet)}')`,
    backgroundSize: `${MAP_COLS * 100}% ${MAP_ROWS * 100}%`,
    backgroundPosition: `${((x - 1) / (MAP_COLS - 1)) * 100}% ${((y - 1) / (MAP_ROWS - 1)) * 100}%`,
  }
}
const MAP_COLS = PLANET_MAP_W / PLANET_TILE
const MAP_ROWS = PLANET_MAP_H / PLANET_TILE

/**
 * My Lands on a phone.
 *
 * What is ready to claim across every land first, with one Claim all, then
 * the lands themselves behind a switch — all of them, or one kind of
 * building at a time — each a quiet row with its boost and its TLM. A land
 * opens as a bottom sheet rather than as a panel under the whole list: to
 * build on it when it is empty, or to claim, boost or destroy what stands
 * on it.
 */
export function PhoneLands({
  lands,
  costs,
  discounts,
  config,
  now,
  busy,
  credits: playerCredits,
  gems,
  canAct,
  claimableCount,
  totalTlm,
  onClaimAll,
  onClaim,
  onBuild,
  onBoost,
  onDestroy,
}: {
  lands: OwnedLand[]
  costs: Map<string, BuildingCost[]>
  discounts: Map<string, number>
  config?: LandsConfig
  now: number
  busy: Busy
  credits: number
  gems: number
  canAct: boolean
  claimableCount: number
  totalTlm: number
  onClaimAll: () => void
  onClaim: (land: OwnedLand) => void
  onBuild: (land: OwnedLand, opt: BuildOption) => void
  onBoost: (land: OwnedLand, building: Building, target: number, cost: number) => void
  onDestroy: (land: OwnedLand, building: Building) => void
}) {
  const [tab, setTab] = useState<PhoneTab>('all')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const open = lands.find((l) => landKey(l) === openKey) ?? null
  const decay = Number(config?.boost_decay_per_hour ?? 0)

  const scoreOf = (land: OwnedLand) => {
    const b = land.buildings[0]
    return b
      ? liveBoostScore(Number(b.boost_score ?? 0), String(b.boost_score_update ?? ''), decay, now)
      : 0
  }
  const due = (land: OwnedLand) =>
    !!land.buildings[0] && boostState(scoreOf(land), config) !== 'ok'
  const count = (name: BuildingName) => lands.filter((l) => landBuilding(l) === name).length
  const shown = tab === 'all' ? lands : lands.filter((l) => landBuilding(l) === tab)
  const tabTlm = shown.reduce((sum, l) => sum + incomeOf(l.buildings).tlm, 0)
  const tabs: [PhoneTab, string][] = [
    ['all', `All ${lands.length}`],
    /* Fights first, then recruiting. */
    ...(['dungeon', 'arena', 'tavern'] as BuildingName[]).map(
      (b) => [b, `${buildingLabel(b, costs)}s ${count(b)}`] as [PhoneTab, string],
    ),
  ]

  return (
    <div className="plands">
      <div className="plands__claim">
        <TlmIcon />
        <span className="plands__claimtext">
          <small>Ready to claim</small>
          <b className="mono">{tlm(totalTlm)} TLM</b>
        </span>
        <button
          type="button"
          className="btn btn--gold btn--sm"
          disabled={!canAct || busy !== null || claimableCount === 0}
          onClick={onClaimAll}
        >
          {busy?.kind === 'claim-all' && <span className="spinner" />}
          Claim all
        </button>
      </div>

      <div className="plands__tabs" role="tablist" aria-label="Buildings">
        {tabs.map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
            {lands.some((l) => (key === 'all' || landBuilding(l) === key) && due(l)) && (
              <i className="plands__dot" aria-label="needs a boost" />
            )}
          </button>
        ))}
      </div>

      <div className="plands__list">
        {shown.map((land) => {
          const building = land.buildings[0]
          const name = landBuilding(land)
          const score = scoreOf(land)
          const percent = score / 10_000
          const income = incomeOf(land.buildings)
          const state = building ? boostState(score, config) : 'ok'
          const drop =
            building && state === 'ok' && name !== 'tavern'
              ? hoursToSmallerLook(score, decay)
              : null
          return (
            <button
              type="button"
              className={`plands__row${building ? '' : ' plands__row--empty'}`}
              key={landKey(land)}
              onClick={() => setOpenKey(landKey(land))}
            >
              <span
                className="plands__thumb"
                style={{
                  ...landThumbStyle(land.planet, land.x, land.y, 44),
                  borderColor: rarityColor(land.rarity),
                }}
              >
                {building && (
                  <img
                    src={buildingArt(name, score, state === 'hidden' || state === 'closed')}
                    alt={buildingLabel(name, costs)}
                  />
                )}
              </span>
              <span className="plands__text">
                <strong>{shortName(land.name)}</strong>
                <small>
                  {state !== 'ok' ? (
                    <span className={`plands__flag is-${state}`}>{BOOST_LINE[state]}</span>
                  ) : drop !== null && drop < LOOK_WARNING_HOURS ? (
                    <span
                      className="plands__drop"
                      aria-label={`Drops to a smaller look in about ${formatSpan(drop * 3_600_000)}`}
                    >
                      <img src={buildingArt(name, score)} alt="" />→
                      <img src={buildingArt(name, score - 200_000)} alt="" />
                      in ~{formatSpan(drop * 3_600_000)}
                    </span>
                  ) : (
                    <>
                      {cap(land.planet)} {land.x}:{land.y} ·{' '}
                      <em style={{ color: rarityColor(land.rarity) }}>
                        {cap(land.rarity || 'common')}
                      </em>
                      {!building && ' · no building'}
                    </>
                  )}
                </small>
                {building && (
                  <span className={`plands__bar is-${state}`}>
                    <i style={{ width: `${Math.max(1.5, Math.min(100, percent))}%` }} />
                  </span>
                )}
              </span>
              {building ? (
                <>
                  <span className={`plands__boost mono is-${state}`}>
                    {stateLabel(score, state)}
                  </span>
                  <span className="plands__amount mono">
                    {tlm(income.tlm)}
                    <TlmIcon />
                  </span>
                </>
              ) : (
                <span className="btn btn--primary btn--sm plands__build">Build</span>
              )}
            </button>
          )
        })}
      </div>

      {tab !== 'all' && shown.length > 0 && (
        <p className="plands__sum">
          <b>
            {shown.length} {buildingLabel(tab, costs).toLowerCase()}
            {shown.length === 1 ? '' : 's'} · {tlm(tabTlm)} <TlmIcon /> ready
          </b>
          <small>{tlm(tabTlm / shown.length)} TLM each on average</small>
        </p>
      )}
      {tab !== 'all' && shown.length === 0 && (
        <p className="plands__sum">
          <small>No {buildingLabel(tab, costs).toLowerCase()} on your lands yet.</small>
        </p>
      )}

      {open && (
        <LandSheet
          key={landKey(open)}
          land={open}
          costs={costs}
          discounts={discounts}
          config={config}
          now={now}
          busy={busy}
          credits={playerCredits}
          gems={gems}
          canAct={canAct}
          onClose={() => setOpenKey(null)}
          onClaim={() => onClaim(open)}
          onBuild={(opt) => onBuild(open, opt)}
          onBoost={(b, target, cost) => onBoost(open, b, target, cost)}
          onDestroy={(b) => onDestroy(open, b)}
        />
      )}
    </div>
  )
}

/**
 * The land's frame: the phone's bottom sheet, or on a desktop the same head,
 * body and foot as a column beside the tiles.
 *
 * Market, My Fighters and Ascension all show what was picked beside the list;
 * a drawer over the page was the one screen that did not, half of it empty
 * with Boost pinned to the window's foot. The classes stay the sheet's, so
 * everything drawn inside it looks the same either way.
 */
/** Up from the bottom on a phone; in from the right, or in the page, on a desktop. */
type LandFrame = 'sheet' | 'drawer' | 'inline'

function SheetFrame({
  frame,
  title,
  onClose,
  foot,
  children,
}: {
  frame: LandFrame
  title: string
  onClose: () => void
  foot?: React.ReactNode
  children: React.ReactNode
}) {
  if (frame !== 'inline') {
    return (
      <BottomSheet side={frame === 'drawer'} title={title} onClose={onClose} foot={foot}>
        {children}
      </BottomSheet>
    )
  }
  return (
    <aside className="rsheet rsheet--inline" aria-label={title}>
      <div className="rsheet__panel">
        <div className="rsheet__head">
          <h2 className="rsheet__title">{title}</h2>
        </div>
        <div className="rsheet__body">{children}</div>
        {foot && <div className="rsheet__foot">{foot}</div>}
      </div>
    </aside>
  )
}

function LandSheet({
  land,
  costs,
  discounts,
  config,
  now,
  busy,
  credits: playerCredits,
  gems,
  canAct,
  onClose,
  onClaim,
  onBuild,
  onBoost,
  onDestroy,
  frame = 'sheet',
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
  /** A desktop's: a column beside the tiles, or a drawer where there is no room for one. */
  frame?: LandFrame
  onClose: () => void
  onClaim: () => void
  onBuild: (opt: BuildOption) => void
  onBoost: (building: Building, target: number, cost: number) => void
  onDestroy: (building: Building) => void
}) {
  const building = land.buildings[0]
  const name = String(building?.building_name ?? '').toLowerCase()
  const working = busy !== null && 'key' in busy && busy.key === landKey(land)
  const decay = Number(config?.boost_decay_per_hour ?? 0)
  const current = building
    ? liveBoostScore(
        Number(building.boost_score ?? 0),
        String(building.boost_score_update ?? ''),
        decay,
        now,
      )
    : 0
  /* One shown step above where it is, so the target never reads as the boost it already has. */
  const floor = Math.min(BOOST_MAX, (Math.round(current / 10_000) + 1) * 10_000)
  const [target, setTarget] = useState(floor)
  const [confirm, setConfirm] = useState(false)
  const options = useMemo(
    () => buildOptions(land, costs, discounts, BUILDINGS as readonly BuildingName[]),
    [land, costs, discounts],
  )
  const [pick, setPick] = useState<string | null>(
    () => options.find((o) => !o.blocked)?.building ?? null,
  )
  const chosen = options.find((o) => o.building === pick)
  const discount = discounts.get(land.rarity) ?? 0
  const income = incomeOf(land.buildings)
  const cost = boostCost(current, target, config)
  const destroyCost = Number(config?.delete_building_gems_cost ?? 0)
  const state = building ? boostState(current, config) : 'ok'
  const muted = state === 'hidden' || state === 'closed'
  const tavern = name === 'tavern'
  const newLook = !tavern && boostRank(target / 10_000) !== boostRank(current / 10_000)

  const head = (
    <div className="lsheet__head">
      <span
        className="lsheet__thumb"
        style={{
          ...landThumbStyle(land.planet, land.x, land.y, 84),
          borderColor: rarityColor(land.rarity),
        }}
      >
        {building && <img src={buildingArt(name, current, muted)} alt="" />}
      </span>
      <span className="lsheet__text">
        <small>
          {cap(land.planet)} {land.x}:{land.y} ·{' '}
          <em style={{ color: rarityColor(land.rarity) }}>{cap(land.rarity || 'common')}</em>
        </small>
        {building ? (
          <>
            <b>
              {buildingLabel(name, costs)} ·{' '}
              <span className={`lsheet__now is-${state}`}>{stateLabel(current, state)}</span>
            </b>
            <span className={`plands__bar is-${state}`}>
              <i style={{ width: `${Math.max(1.5, Math.min(100, current / 10_000))}%` }} />
            </span>
            <small>Boost decays over time, faster the more it is used.</small>
          </>
        ) : (
          <>
            <b>No building yet</b>
            <small>One building per land. Players use it, and you earn from every use.</small>
          </>
        )}
      </span>
    </div>
  )

  /* ---- an empty land: build ---- */
  if (!building) {
    return (
      <SheetFrame
        frame={frame}
        title={shortName(land.name)}
        onClose={onClose}
        foot={
          <div className="rsheet__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={
                !canAct ||
                busy !== null ||
                !chosen ||
                !!chosen.blocked ||
                chosen.credits > playerCredits ||
                chosen.gems > gems
              }
              onClick={() => chosen && onBuild(chosen)}
            >
              {working && busy?.kind === 'build' && <span className="spinner" />}
              {chosen ? `Build ${buildingLabel(chosen.building, costs)}` : 'Build'}
              {chosen && (
                <span className="lsheet__cost mono">
                  {formatNumber(chosen.credits)}
                  <CreditIcon />
                </span>
              )}
            </button>
          </div>
        }
      >
        {head}
        <div className="rsheet__cap">
          Build
          {discount > 0 && (
            <span>
              {cap(land.rarity)} land: {formatNumber(discount)} off
            </span>
          )}
        </div>
        {options.map((opt) => {
          const tooPoor = opt.credits > playerCredits || opt.gems > gems
          return (
            <button
              type="button"
              key={opt.building}
              className={`bopt${pick === opt.building ? ' is-on' : ''}`}
              disabled={!!opt.blocked}
              aria-pressed={pick === opt.building}
              onClick={() => setPick(opt.building)}
            >
              <img src={buildingIcon(opt.building)} alt="" />
              <span className="bopt__text">
                <b>{buildingLabel(opt.building, costs)}</b>
                <small>{opt.blocked ?? BUILDING_BLURB[opt.building]}</small>
              </span>
              <span className="bopt__price">
                {discount > 0 && opt.cost && (
                  <s className="mono">{formatNumber(opt.cost.cost_credits)}</s>
                )}
                <b className={`mono${tooPoor ? ' is-short' : ''}`}>
                  {formatNumber(opt.credits)}
                  <CreditIcon />
                </b>
              </span>
            </button>
          )
        })}
      </SheetFrame>
    )
  }

  /* ---- a building: destroy, after asking ---- */
  if (confirm) {
    return (
      <SheetFrame
        frame={frame}
        title={`Destroy the ${buildingLabel(name, costs).toLowerCase()}?`}
        onClose={onClose}
        foot={
          <div className="rsheet__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={!canAct || busy !== null || destroyCost > gems}
              onClick={() => onDestroy(building)}
            >
              {working && busy?.kind === 'destroy' && <span className="spinner" />}
              Destroy
              <span className="lsheet__cost mono">
                {formatNumber(destroyCost)}
                <GemIcon />
              </span>
            </button>
          </div>
        }
      >
        <div className="lsheet__warn">
          <img src={buildingIcon(name)} alt="" />
          <span>
            <b>
              {shortName(land.name)} · {cap(land.planet)} {land.x}:{land.y}
            </b>
            <small>
              This cannot be undone. The {buildingLabel(name, costs).toLowerCase()} and its{' '}
              {boostLabel(current / 10_000)} boost are gone for good, and the land is empty again.
            </small>
          </span>
        </div>
        {/* `delbuilding` pays out what the building holds before it removes it. */}
        <div className="lsheet__lines">
          <div>
            <span>Its ready TLM is paid out to you</span>
            <b className="mono">
              {tlm(income.tlm)}
              <TlmIcon />
            </b>
          </div>
          <div>
            <span>Destroying costs</span>
            <b className={`mono${destroyCost > gems ? ' is-short' : ''}`}>
              {formatNumber(destroyCost)}
              <GemIcon />
            </b>
          </div>
        </div>
      </SheetFrame>
    )
  }

  /* ---- a building: claim and boost ---- */
  return (
    <SheetFrame
      frame={frame}
      title={shortName(land.name)}
      onClose={onClose}
      foot={
        <>
          <div className="rsheet__actions">
            <button
              type="button"
              className="btn btn--primary"
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
              Boost to {boostLabel(target / 10_000)}
              <span className={`lsheet__cost mono${cost > playerCredits ? ' is-short' : ''}`}>
                {credits(cost)}
                <CreditIcon />
              </span>
            </button>
          </div>
          <button type="button" className="lsheet__destroy" onClick={() => setConfirm(true)}>
            Destroy building
          </button>
        </>
      }
    >
      {head}
      {state !== 'ok' && (
        <div className={`lsheet__alert is-${state}`}>
          {/* Closed and off the map are one thing to a player: both say Off the map. */}
          <b>{state === 'low' ? 'Running low' : 'Off the map'}</b>
          <small>
            {state === 'low'
              ? 'Under 0.1× players stop seeing it on the map.'
              : 'Players cannot see it on the map any more. Boost it to bring it back.'}
          </small>
        </div>
      )}
      <div className="lsheet__income">
        <span>
          <small>Ready</small>
          <b className="mono is-gold">
            {tlm(income.tlm)}
            <TlmIcon />
          </b>
        </span>
        {/* A claim pays these too, but no building has ever earned any: only when there are some. */}
        {income.credits > 0 && (
          <span>
            <small>Credits</small>
            <b className="mono">{formatNumber(income.credits)}</b>
          </span>
        )}
        {income.gems > 0 && (
          <span>
            <small>Gems</small>
            <b className="mono">{formatNumber(income.gems)}</b>
          </span>
        )}
        <button
          type="button"
          className="btn btn--gold btn--sm"
          disabled={!canAct || busy !== null || !hasClaimable(income)}
          onClick={onClaim}
        >
          {working && busy?.kind === 'claim' && <span className="spinner" />}
          Claim
        </button>
      </div>
      <div className="rsheet__cap">
        Boost<span>now {stateLabel(current, state)}</span>
      </div>
      <div className="lsheet__boost">
        {current >= BOOST_MAX ? (
          <p className="rsheet__hint">This building is at the highest boost there is.</p>
        ) : (
          <>
            <div className="lsheet__looks">
              <span className="lsheet__look">
                <img src={buildingArt(name, current, muted)} alt="" />
                <b className="mono">{stateLabel(current, state)}</b>
                <small>Now</small>
              </span>
              <em aria-hidden="true">→</em>
              <span className={`lsheet__look is-to${newLook ? ' is-new' : ''}`}>
                {/* Keyed by the art, so a new look pops in rather than just swapping. */}
                <img key={buildingArt(name, target)} src={buildingArt(name, target)} alt="" />
                <b className="mono">{boostLabel(target / 10_000)}</b>
                <small>{newLook ? 'New look' : 'Same look'}</small>
              </span>
            </div>
            <input
              type="range"
              className="landsheet__range"
              min={floor}
              max={BOOST_MAX}
              step={10_000}
              value={target}
              aria-label="Boost to"
              onChange={(e) => setTarget(Number(e.target.value))}
            />
            {tavern ? (
              <p className="lsheet__onelook">
                A tavern has one look at any boost. Taverns with a higher boost are available to
                players more often.
              </p>
            ) : (
              <div className="lsheet__ticks" aria-hidden="true">
                {LOOK_STEPS.filter((t) => t >= floor && floor < BOOST_MAX).map((t) => (
                  <span key={t} style={{ left: `${((t - floor) / (BOOST_MAX - floor)) * 100}%` }}>
                    <img src={buildingArt(name, t)} alt="" />
                    <em>{boostLabel(t / 10_000)}</em>
                  </span>
                ))}
              </div>
            )}
            <div className="lsheet__line">
              <span>Each 0.1× costs a little more than the last</span>
            </div>
            <div className="lsheet__line">
              <span>Total</span>
              <b className="mono">
                {credits(cost)}
                <CreditIcon />
              </b>
            </div>
          </>
        )}
      </div>
    </SheetFrame>
  )
}
