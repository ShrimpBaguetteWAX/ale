import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PLANETS, PORTAL_EFFECTS, type Planet } from '@/chain/config'
import { fetchAssetOwners } from '@/chain/atomic'
import {
  fetchLandsConfig,
  fetchLiveArenas,
  fetchPlanetLands,
  fetchPlayerTag,
  fetchPlayerTags,
} from '@/chain/queries'
import { landId, travelCost, travelDistance } from '@/chain/landId'
import type { Land, LandsConfig } from '@/chain/types'
import { MapCanvas } from '@/map/MapCanvas'
import {
  playedDungeonsToday,
  summarisePlanet,
  type LiveArena,
  type PlanetStatus,
} from '@/map/planetStatus'
import {
  MARKER_SRC,
  buildingIcon,
  formatBoost,
  landThumbStyle,
  liveBoostPercent,
  planetMapSrc,
  type MarkerKey,
} from '@/map/terrain'
import { dungeonMaintained } from '@/dungeon/rules'
import { arenaMaintained } from '@/arena/rules'
import { useGame } from '@/state/useGame'
import { travel } from '@/wharf/actions'
import { PortalWarp, WARP_TOTAL_MS } from '@/map/PortalWarp'
import { readableError } from '@/wharf/errors'
import { NUM_LOCALE } from '@/format'
import { asset } from '@/assets'

/**
 * What the markers mean, and the one rule the map cannot show.
 *
 * Pared back to the five symbols actually on the grid plus a single sentence.
 * It had grown to three paragraphs covering tavern ownership, greyed
 * dungeons, the multiplier, taverns not having one, and the pan/zoom
 * controls — none of which a player opens a legend to read, and all of which
 * pushed the symbols themselves off the top of a phone.
 */
export function Legend() {
  const rows: [MarkerKey | 'you', string][] = [
    ['you', 'You are here'],
    ['tavern', 'Tavern'],
    ['dungeon', 'Dungeon'],
    ['arena', 'Arena'],
    ['portal', 'Portal to another planet'],
  ]
  return (
    <div className="legend">
      {rows.map(([key, label]) => (
        <div className="legend__row" key={key}>
          {key === 'you' ? (
            <span className="legend__dot legend__dot--you" />
          ) : (
            <img className="legend__marker" src={MARKER_SRC[key]} alt="" />
          )}
          {label}
        </div>
      ))}
      <p className="hint">
        Modifiers in dungeons and arenas influence the rewards earned from
        victories.
      </p>
    </div>
  )
}

const PLANETBAR_KEY = 'al.map.planetbar'

/*
 * How long the overlay waits, once it is up, before the planet is swapped
 * underneath it.
 *
 * The overlay fades in over the first 7% of its run; this is comfortably past
 * that, so the old grid is never seen being replaced.
 */
const WARP_COVERED_MS = 600

/** One planet in the switcher, with what the player can actually do there. */
export function PlanetCard({
  status,
  isCurrent,
  isViewing,
  onSelect,
}: {
  status: PlanetStatus
  isCurrent: boolean
  isViewing: boolean
  onSelect: () => void
}) {
  const { planet, taverns, dungeonsOpen, arenasOpen, loaded } = status

  const stats: [MarkerKey, number, string][] = [
    ['tavern', taverns, `${taverns} active tavern${taverns === 1 ? '' : 's'}`],
    [
      'dungeon',
      dungeonsOpen,
      `${dungeonsOpen} dungeon${dungeonsOpen === 1 ? '' : 's'} you can still run today`,
    ],
    [
      'arena',
      arenasOpen,
      `${arenasOpen} arena${arenasOpen === 1 ? '' : 's'} you have no fighter in`,
    ],
  ]

  return (
    <button type="button" className="planetcard" aria-pressed={isViewing} onClick={onSelect}>
      <span className="planetcard__name">
        {planet}
        {isCurrent && <span className="planetcard__here" title="You are here" />}
      </span>
      <span className="planetcard__stats">
        {stats.map(([key, value, title]) => (
          <span
            className={`pstat${loaded && value > 0 ? ' pstat--open' : ''}`}
            key={key}
            title={loaded ? title : 'Loading…'}
          >
            <img src={MARKER_SRC[key]} alt="" />
            {loaded ? value : <span className="pstat__skeleton skeleton" />}
          </span>
        ))}
      </span>
    </button>
  )
}

export default function MapView() {
  const player = useGame((s) => s.player)!
  const config = useGame((s) => s.config)
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [planet, setPlanet] = useState<Planet>(player.planet)
  const [landsByPlanet, setLandsByPlanet] = useState<Partial<Record<Planet, Land[]>>>({})
  const [arenasByPlanet, setArenasByPlanet] = useState<Partial<Record<Planet, LiveArena[]>>>({})
  const [landsConfig, setLandsConfig] = useState<LandsConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null)
  /*
     Whether the tile card is old enough to be pressed.

     Selection happens on `pointerup`, and on a touch screen the browser then
     synthesises a click at the same coordinates. The card opens along the
     bottom edge — which is where a thumb tends to be — so it renders under
     the finger and that synthesised click lands on the Travel button that
     has just appeared there. One tap on the map, and the player is signing a
     transaction they never asked for.

     A mouse does not do this: when press and release land on different
     elements the click is dispatched to their common ancestor, so it goes to
     the map rather than the button. The compatibility click from a touch has
     no such rule and simply hits whatever is under the point.

     So the card ignores pointer input until the tap that opened it is over —
     and only when it was a tap. A mouse never needs the delay and should not
     have a click of its own swallowed by it.
  */
  const [cardArmed, setCardArmed] = useState(true)
  const [recenter, setRecenter] = useState(1)
  const [travelling, setTravelling] = useState(false)
  /*
     The gate, when this trip is a portal jump.

     Held as a phase rather than a timer: the transaction and the polling that
     follows it take anywhere from one to six seconds, so a fixed-length clip
     would either end while the player was still waiting or hold on well after
     they had arrived.
  */
  const [jump, setJump] = useState<Planet | null>(null)
  const [travelError, setTravelError] = useState<string | null>(null)
  const [legendOpen, setLegendOpen] = useState(false)
  /*
     Everything over the map, out of the way.

     A phone gives the map about 390 by 640, and the controls sit in three of
     its four corners. They are all worth having and none of them is worth
     having while a player is trying to read the terrain, so this puts the lot
     away — the planet panel, the legend, Find me and the zoom pair — and
     leaves the map, the tile they tapped, and the way back.

     Not persisted, and not offered on desktop: it answers "let me look at
     this for a second", which is a thing you do rather than a preference you
     hold, and a wide screen has room for both.
  */
  const [bare, setBare] = useState(false)
  /*
     The planet strip, collapsed to the planet being viewed until asked.

     Six cards across the top is a lot of map to cover for a control used a
     few times a session, and the map is what the player came to look at — so
     closed is the default on every size, not just on a phone. Collapsed is
     not empty: it keeps the card for the planet you are on, which is where
     the counts that make the bar worth having already are.

     The choice is still remembered, and remembered the way round that makes
     the stored value mean something: only an explicit open writes '1'. A
     player who has never touched it gets the collapsed default, and one who
     opened it yesterday still finds it open today.
  */
  const [barOpen, setBarOpen] = useState(() => {
    try {
      return localStorage.getItem(PLANETBAR_KEY) === '1'
    } catch {
      return false
    }
  })
  const togglePlanetBar = useCallback(() => {
    setBarOpen((open) => {
      try {
        localStorage.setItem(PLANETBAR_KEY, open ? '0' : '1')
      } catch {
        // A blocked localStorage costs the player the memory, nothing else.
      }
      return !open
    })
  }, [])
  const [owners, setOwners] = useState<Record<string, string>>({})
  const [tags, setTags] = useState<Record<string, string>>({})

  const lowFx = document.documentElement.dataset.fx === 'low'
  const lands = landsByPlanet[planet]
  const loading = !lands

  // Cached hard (12h) — these parameters change about never.
  useEffect(() => {
    fetchLandsConfig()
      .then((c) => setLandsConfig(c ?? null))
      .catch(() => {})
  }, [])

  /**
   * Load the planet on screen first, then the rest one at a time in the
   * background.
   *
   * The switcher needs every planet's lands to show its counts, but nothing
   * should compete with the map the player is looking at — and six parallel
   * requests aimed at one node is exactly what the endpoint pool exists to
   * avoid. Reads are cached, so revisits cost nothing.
   */
  useEffect(() => {
    let cancelled = false
    const startPlanet = planet

    const loadLands = async (p: Planet) => {
      try {
        const rows = await fetchPlanetLands(p)
        if (!cancelled) setLandsByPlanet((prev) => (prev[p] ? prev : { ...prev, [p]: rows }))
        return rows
      } catch (err) {
        if (!cancelled && p === startPlanet) setLoadError(readableError(err))
        return undefined
      }
    }

    // `livearena` rows are heavy — each fighter carries its full ability
    // list — so only ask for planets that actually have an arena.
    const loadArenas = async (p: Planet, rows: Land[] | undefined) => {
      const hasArena = rows?.some((l) =>
        l.buildings.some((b) => String(b.building_name) === 'arena'),
      )
      if (!hasArena) {
        if (!cancelled) setArenasByPlanet((prev) => ({ ...prev, [p]: [] }))
        return
      }
      try {
        const arenas = await fetchLiveArenas(p)
        if (!cancelled) setArenasByPlanet((prev) => ({ ...prev, [p]: arenas }))
      } catch {
        // Leave it unset; the count then reads as "all open" rather than
        // blocking the switcher.
      }
    }

    void (async () => {
      const first = await loadLands(startPlanet)
      if (cancelled) return
      await loadArenas(startPlanet, first)

      // Give the visible map room to settle before warming the rest.
      await new Promise((r) => setTimeout(r, 1200))
      for (const p of PLANETS) {
        if (cancelled) return
        if (p === startPlanet) continue
        const rows = await loadLands(p)
        if (cancelled) return
        await loadArenas(p, rows)
        await new Promise((r) => setTimeout(r, 250))
      }
    })()

    return () => {
      cancelled = true
    }
    // Runs once. Switching planets reads from the cache this fills.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Land is an alien.worlds NFT, so the owner lives in AtomicAssets, not in
   * the game contracts. Only built land needs a name shown, and there are
   * fewer than ten such lands per planet, so the whole set is one batched
   * request per planet rather than a lookup per tile click.
   */
  useEffect(() => {
    const ids = Object.values(landsByPlanet)
      .flat()
      .filter((l): l is Land => !!l && l.buildings.length > 0)
      .map((l) => String(l.asset_id))
      .filter((id) => id && id !== '0' && !(id in owners))

    if (ids.length === 0) return
    let cancelled = false
    fetchAssetOwners(ids)
      .then((found) => {
        if (cancelled || found.size === 0) return
        setOwners((prev) => ({ ...prev, ...Object.fromEntries(found) }))
      })
      .catch(() => {
        // A missing owner just hides the line; it is not worth an error.
      })
    return () => {
      cancelled = true
    }
  }, [landsByPlanet, owners])

  // Switching to a planet the warmup hasn't reached yet: pull it now.
  useEffect(() => {
    if (landsByPlanet[planet]) return
    let cancelled = false
    fetchPlanetLands(planet)
      .then((rows) => {
        if (!cancelled) setLandsByPlanet((prev) => ({ ...prev, [planet]: rows }))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(readableError(err))
      })
    return () => {
      cancelled = true
    }
  }, [planet, landsByPlanet])

  /**
   * Landowners are shown by gamertag where they have one. The wallet is a
   * poor label — players know each other by tag — but plenty of Alien Worlds
   * landowners never signed up to this game, so the wallet stays the
   * fallback rather than the primary.
   */
  useEffect(() => {
    const wallets = [...new Set(Object.values(owners))].filter((w) => !(w in tags))
    if (wallets.length === 0) return

    let cancelled = false
    void (async () => {
      const { tags: found, complete } = await fetchPlayerTags().catch(() => ({
        tags: {} as Record<string, string>,
        complete: false,
      }))
      if (cancelled) return

      // Mark every wallet as resolved, tag or not, so this never loops.
      const next: Record<string, string> = {}
      for (const w of wallets) next[w] = found[w] ?? ''

      // If the bounded scan could not see everyone, fill the gaps one by one.
      if (!complete) {
        for (const w of wallets.filter((w) => !found[w])) {
          const tag = await fetchPlayerTag(w).catch(() => undefined)
          if (cancelled) return
          if (tag) next[w] = tag
        }
      }

      setTags((prev) => ({ ...prev, ...next }))
    })()

    return () => {
      cancelled = true
    }
  }, [owners, tags])

  useEffect(() => {
    setSelected(null)
    setTravelError(null)
    setLoadError(null)
    if (planet === player.planet) setRecenter((n) => n + 1)
  }, [planet, player.planet])

  const playedToday = useMemo(() => playedDungeonsToday(player), [player])

  /**
   * Land ids on the planet being viewed that the player has already run
   * today. `playedDungeonsToday` keys by `planet.land_id`; the canvas only
   * knows land ids, so narrow it to the planet on screen.
   */
  const lockedLands = useMemo(() => {
    const prefix = planet + '.'
    const ids = new Set<string>()
    for (const key of playedToday) {
      if (key.startsWith(prefix)) ids.add(key.slice(prefix.length))
    }
    return ids
  }, [playedToday, planet])

  /**
   * The player's own taverns on this planet.
   *
   * Taverns are per-player: the same land appears in different players' lists
   * with different selection scores and different objectives, and the ones
   * missing from your list are not yours to enter. So the map takes them from
   * the player row rather than from tavern buildings on the land.
   *
   * `last_tavern` is drawn too, and in its own colour, because
   * `users::setreveal` *moves* a tavern out of `active_taverns` and into
   * `last_tavern` — so the one the player is actually using is missing from
   * the active list, and would otherwise vanish from the map.
   */
  const tavernLands = useMemo(
    () =>
      new Set(
        player.active_taverns
          .filter((t) => t.planet === planet && t.land_id)
          .map((t) => t.land_id),
      ),
    [player.active_taverns, planet],
  )

  /** The one they are standing in, if it is on the planet being viewed. */
  const currentTavernLand =
    player.last_tavern?.planet === planet ? player.last_tavern.land_id || undefined : undefined

  const summaries = useMemo(
    () =>
      PLANETS.map((p) =>
        summarisePlanet(p, landsByPlanet[p], player, playedToday, arenasByPlanet[p]),
      ),
    [landsByPlanet, arenasByPlanet, player, playedToday],
  )

  const byCoord = useMemo(() => {
    const m = new Map<string, Land>()
    for (const l of lands ?? []) m.set(l.x + ',' + l.y, l)
    return m
  }, [lands])

  const land = selected ? byCoord.get(selected.x + ',' + selected.y) : undefined
  const onPlanet = planet === player.planet
  const isHere = !!selected && selected.x === player.x && selected.y === player.y
  const portalTo = land?.special_effect ? PORTAL_EFFECTS[land.special_effect] : undefined

  const cost = selected && config ? travelCost(player, selected, config, !!portalTo) : null
  const canAfford = cost === null || player.activestats.action_points >= cost

  /*
     Long enough to outlast the synthesised click, which browsers fire up to
     about 300ms after the touch ends, and short enough that a player who
     deliberately taps twice is not fighting it.
  */
  const SETTLE_MS = 400
  const settleTimer = useRef<number | undefined>(undefined)

  const handleSelect = useCallback((c: { x: number; y: number }, byTouch?: boolean) => {
    setSelected(c)
    window.clearTimeout(settleTimer.current)
    if (!byTouch) {
      setCardArmed(true)
      return
    }
    setCardArmed(false)
    settleTimer.current = window.setTimeout(() => setCardArmed(true), SETTLE_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  const doTravel = async () => {
    if (!session || !selected) return
    setTravelling(true)
    setTravelError(null)

    /*
       A portal jump gets the wormhole; a step across the same planet does not.
       Stepping is already animated by the pin flying to its new tile, and the
       map underneath stays the map you were looking at. A jump replaces the
       whole grid, which is the thing worth covering.
    */
    const gate = portalTo

    try {
      /*
         Nothing is drawn until the chain has both taken the transaction and
         confirmed the move.

         The overlay is not a spinner — it is the trip happening — and it runs
         one fixed timeline rather than looping to fill an unknown wait. That
         means the wait has to happen first. The button keeps its spinner
         throughout, which is what a pending transaction should look like.
      */
      await travel(session, selected.x, selected.y)

      let arrived: typeof player | null = null
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 700))
        await refreshPlayer({ force: true })
        const p = useGame.getState().player
        if (p && p.x === selected.x && p.y === selected.y) {
          arrived = p
          break
        }
      }

      if (gate && arrived) {
        setJump(gate)
        /* Let it cover the screen before the grid underneath changes. */
        await new Promise((r) => setTimeout(r, WARP_COVERED_MS))
        if (arrived.planet !== planet) setPlanet(arrived.planet)
        setRecenter((n) => n + 1)
        await new Promise((r) => setTimeout(r, WARP_TOTAL_MS - WARP_COVERED_MS))
        setJump(null)
      } else {
        if (arrived && arrived.planet !== planet) setPlanet(arrived.planet)
        setRecenter((n) => n + 1)
      }
    } catch (err) {
      setJump(null)
      setTravelError(readableError(err))
    } finally {
      setTravelling(false)
    }
  }

  const dungeonLockedHere =
    !!land &&
    land.buildings.some((b) => String(b.building_name) === 'dungeon') &&
    playedToday.has(`${planet}.${land.land_id}`)

  /**
   * Standing in a tavern. This is the contract's own precondition for
   * hiring — users::hire checks last_tavern.land_id against the land the
   * player is on — so it is the honest test for whether the door is open.
   */
  const inTavern =
    !!player.last_tavern?.land_id &&
    player.last_tavern.land_id === landId(player.x, player.y)

  /**
   * Standing on a dungeon that is still worth entering.
   *
   * Three things have to hold, and all three are the contract's own
   * conditions rather than presentational ones: the player is on the land,
   * the building is still maintained — `playdungeon` refuses once the
   * landowner has let its boost score decay to nothing — and today's run has
   * not been used up.
   */
  const dungeonHere = useMemo(() => {
    const here = (lands ?? []).find((l) => l.x === player.x && l.y === player.y)
    if (!here || planet !== player.planet) return null
    if (!dungeonMaintained(here)) return null
    if (playedToday.has(`${player.planet}.${here.land_id}`)) return null
    return here
  }, [lands, planet, player.planet, player.x, player.y, playedToday])

  /*
     An arena on the tile the player is standing on, and open to them.

     `buildings[0]` decides what a land is for both checks, so a dungeon and
     an arena can never be offered on the same tile. What can rule an arena
     out is already holding it: `playarena` refuses to let anyone fight their
     own fighters, so the button is withheld rather than left to fail on
     signing.
  */
  const arenaHere = useMemo(() => {
    const here = (lands ?? []).find((l) => l.x === player.x && l.y === player.y)
    if (!here || planet !== player.planet) return null
    if (!arenaMaintained(here)) return null
    const standing = arenasByPlanet[player.planet]?.find(
      (a) => a.land_id === here.land_id,
    )
    if (!standing || standing.fighters.length === 0) return null
    if (standing.fighters.some((f) => f.owner === player.wallet)) return null
    return here
  }, [lands, planet, player.planet, player.x, player.y, player.wallet, arenasByPlanet])

  /*
     How much of the map is under something opaque right now.

     Only the bottom, and only what the docked action bar actually occupies.
     That bar is the full width of the screen, so the slack it buys is
     invisible — the strip it exposes is exactly the strip the bar sits on.
     The controls at the top are not full width, so slack there would show
     background beside them; the way to reach the tiles under those is the
     clear button.

     On a wide screen the bar is `display: contents` and measures zero, which
     is the right answer there: nothing covers the map that the player cannot
     pan around.

     Measured rather than assumed: the bar holds one button or two, and on a
     narrow screen they can wrap onto a second line. A constant would be wrong
     for two of those three cases.
  */
  const [barHeight, setBarHeight] = useState(0)
  const actionBar = useRef<HTMLDivElement>(null)

  /* A ref callback that returns a cleanup is a React 19 feature; on 18 the
     return value is ignored and the observer would leak. */
  useEffect(() => {
    const node = actionBar.current
    if (!node) return
    const read = () => setBarHeight(node.getBoundingClientRect().height)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const insets = useMemo(
    () => ({ top: 0, bottom: Math.round(barHeight) }),
    [barHeight],
  )
  /** Landowner of the selected tile — undefined until the batch resolves. */
  const owner = land ? owners[String(land.asset_id)] : undefined
  /** Gamertag if the landowner plays; empty string once we know they do not. */
  const ownerTag = owner ? tags[owner] : undefined
  const ownerResolved = owner !== undefined && ownerTag !== undefined

  const arenaOccupiedHere =
    !!land &&
    land.buildings.some((b) => String(b.building_name) === 'arena') &&
    !!arenasByPlanet[planet]?.some(
      (a) => a.land_id === land.land_id && a.fighters?.some((f) => f.owner === player.wallet),
    )

  /*
     One call to action at a time. A tavern and a dungeon can share a land,
     and stacking two glowing buttons in the same spot would make neither read
     as the thing to do; the tavern wins because it is the cheaper, reversible
     action.
  */
  const enterLink = inTavern ? (
    <Link className="btn btn--charged entertavern" to="/tavern">
      <img src={asset('/assets/markers/tavern.svg')} alt="" />
      <span className="entertavern__verb">Enter </span>Tavern
    </Link>
  ) : dungeonHere ? (
    <Link className="btn btn--charged entertavern enterdungeon" to="/dungeon">
      <img src={asset('/assets/markers/dungeons.svg')} alt="" />
      <span className="entertavern__verb">Enter </span>Dungeon
    </Link>
  ) : arenaHere ? (
    <Link className="btn btn--charged entertavern enterarena" to="/arena">
      <img src={asset('/assets/markers/arena.svg')} alt="" />
      <span className="entertavern__verb">Enter </span>Arena
    </Link>
  ) : null

  const tileCard = selected && (
    <div className="mapoverlay tilecard">
      <div className="tilecard__top">
        <div
          className="tile__thumb"
          style={landThumbStyle(planet, selected.x, selected.y, 56)}
          aria-hidden="true"
        />
        <div style={{ minWidth: 0 }}>
          <div className="tilecard__coords mono">
            {selected.x} : {selected.y}
          </div>
          <div className="tilecard__id">{landId(selected.x, selected.y)}</div>
          {portalTo && (
            <div style={{ color: 'var(--magenta)', fontSize: 'var(--fs-sm)' }}>
              Portal to <span style={{ textTransform: 'capitalize' }}>{portalTo}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="tilecard__close"
          onClick={() => setSelected(null)}
          aria-label="Close tile details"
        >
          ×
        </button>
      </div>

      {land && land.buildings.length > 0 && (
        <div className="buildings">
          {land.buildings.map((b, i) => (
            <div className="building" key={`${b.building_name}-${i}`}>
              <img src={buildingIcon(String(b.building_name))} alt="" />
              <span className="building__text">
                <span className="building__name">
                  {ownerResolved ? (
                    <>
                      {ownerTag || owner}&rsquo;s{' '}
                      {String(b.building_name).replace(/-/g, ' ')}
                    </>
                  ) : (
                    String(b.building_name).replace(/-/g, ' ')
                  )}
                </span>
                {!ownerResolved && (
                  <span className="building__owner">
                    <span className="skeleton building__owner-skeleton" />
                  </span>
                )}
                {ownerResolved && owner === player.wallet && (
                  <span className="building__owner">Yours</span>
                )}
              </span>
              <span className="building__mult">
                {formatBoost(
                  liveBoostPercent(
                    Number(b.boost_score ?? 0),
                    String(b.boost_score_update ?? ''),
                    landsConfig?.boost_decay_per_hour ?? 0,
                  ),
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {dungeonLockedHere && (
        <p className="hint">You have already run this dungeon today.</p>
      )}
      {arenaOccupiedHere && (
        <p className="hint">You already have a fighter in this arena.</p>
      )}

      {travelError && (
        <div className="alert alert--error" style={{ marginTop: 'var(--sp-3)' }}>
          {travelError}
        </div>
      )}

      {!onPlanet ? (
        <p className="hint">
          You are on <strong>{player.planet}</strong>. Travel moves you within your
          current planet — step onto a portal to change planet.
        </p>
      ) : !land ? (
        <p className="hint">No land exists at these coordinates.</p>
      ) : isHere ? (
        <p className="hint">You are standing here.</p>
      ) : (
        <>
          <div className={`travelcost${canAfford ? '' : ' travelcost--short'}`}>
            <span className="statline__k">
              {travelDistance(player, selected).toFixed(1)} away
            </span>
            <span className="travelcost__value">
              <img src={asset("/assets/icons/energy.png")} alt="" />
              {cost}
            </span>
          </div>

          <button
            type="button"
            className="btn btn--primary btn--block"
            style={{ marginTop: 'var(--sp-2)' }}
            onClick={() => void doTravel()}
            disabled={travelling || !canAfford}
          >
            {travelling && <span className="spinner" />}
            {travelling ? (
              'Travelling'
            ) : (
              <>
                Travel<span className="travelhere__where"> here</span>
              </>
            )}
            {/*
              Shown only on a phone, where the cost row above is hidden. Until
              the config lands there is no cost to state, and an energy icon
              with nothing beside it is worse than no chip.
            */}
            {cost !== null && (
              <span className="btn__cost">
                <img src={asset('/assets/icons/energy.png')} alt="energy" />
                {cost}
              </span>
            )}
          </button>

          {!canAfford && (
            <p className="hint hint--error">
              You have {player.activestats.action_points.toLocaleString(NUM_LOCALE)} energy.
            </p>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className={`mapview${bare ? ' mapview--bare' : ''}`}>
      <div className="mapwrap">
        <MapCanvas
          mapSrc={planetMapSrc(planet)}
          lands={lands ?? []}
          position={onPlanet ? { x: player.x, y: player.y } : null}
          selected={selected}
          onSelect={handleSelect}
          recenterToken={recenter}
          insetTop={insets.top}
          insetBottom={insets.bottom}
          lowFx={lowFx}
          boostDecayPerHour={landsConfig?.boost_decay_per_hour ?? 0}
          lockedLands={lockedLands}
          tavernLands={tavernLands}
          currentTavernLand={currentTavernLand}
        >
          {/* Everything below floats over the map so none of it costs the
              map any height. */}
          <div className="planetbar">
            <div className="planetpick" role="group" aria-label="Planet">
              {(barOpen ? summaries : summaries.filter((x) => x.planet === planet)).map(
                (status) => (
                  <PlanetCard
                    key={status.planet}
                    status={status}
                    isCurrent={status.planet === player.planet}
                    isViewing={status.planet === planet}
                    onSelect={() => {
                      setPlanet(status.planet)
                      /*
                        On a phone the open grid covers a third of the map and
                        the prompt under it, so choosing is also dismissing.
                        On desktop the strip is one row that costs nothing to
                        leave open, and closing it after every click would
                        stop a player comparing planets at all.

                        Deliberately not persisted: the player did not choose
                        to collapse it, so it must not overwrite the choice
                        the toggle remembers for them.
                      */
                      if (window.matchMedia(`(max-width: 719px)`).matches) {
                        setBarOpen(false)
                      }
                    }}
                  />
                ),
              )}
              {/*
                Collapsed, the strip keeps the planet you are looking at rather
                than becoming a bare arrow: the counts on that one card are the
                reason the bar exists, and hiding them entirely would make the
                control something you have to open to learn anything from.
              */}
              <button
                type="button"
                className="planetpick__toggle"
                aria-expanded={barOpen}
                onClick={togglePlanetBar}
                title={barOpen ? 'Collapse the planet bar' : 'Show every planet'}
                aria-label={barOpen ? 'Collapse the planet bar' : 'Show every planet'}
              >
                <img src={asset("/assets/icons/arrow-right.svg")} alt="" width={14} height={14} />
              </button>
            </div>
          </div>

          {/*
            Stays put when everything else goes, because it is the only way
            back. Head of the column rather than the foot of it: it governs
            the controls below it, and when they are gone this is where a
            player looks for them.
          */}
          <button
            type="button"
            className="mapbare"
            aria-pressed={bare}
            onClick={() => {
              setBare((v) => !v)
              /* A popover left open over a hidden legend button is a panel
                 with nothing to close it. */
              setLegendOpen(false)
            }}
            title={bare ? 'Show the map controls' : 'Hide the map controls'}
            aria-label={bare ? 'Show the map controls' : 'Hide the map controls'}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
              {bare && (
                <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>

          <button
            type="button"
            className="legendbtn"
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((v) => !v)}
          >
            Legend
          </button>
          {legendOpen && (
            <div className="mapoverlay legendpop">
              <Legend />
            </div>
          )}

          <button
            type="button"
            className="zoombtn zoombtn--wide findme"
            onClick={() => {
              setPlanet(player.planet)
              setRecenter((n) => n + 1)
            }}
          >
            Find me
          </button>

          {loading && (
            <div className="mapoverlay maptoast">
              <span className="spinner" />
              Loading {planet}…
            </div>
          )}
          {loadError && (
            <div className="mapoverlay maptoast maptoast--error">
              Could not load {planet}: {loadError}
            </div>
          )}
        </MapCanvas>

        {/*
          The two things a player can act on, in one place.

          On a phone they are a docked bar along the bottom: the way in to
          whatever is under your feet, and the way to somewhere else. Grouping
          them is what lets the Enter prompt stop covering the map without
          having to disappear — it was the only reason it needed hiding.

          On a wide screen the wrapper is `display: contents`, so both keep
          the absolute positions they have always had and nothing about that
          layout changes. `.mapwrap` and `.mapstage` are the same box, so
          moving the link out of the canvas costs it nothing.
        */}
        <div
          ref={actionBar}
          className={`mapactions${cardArmed ? '' : ' mapactions--settling'}`}
        >
          {enterLink}
          {tileCard}
        </div>
      </div>

      {/*
        At the top level, deliberately.

        This used to sit inside `tileCard`, which is `selected && (...)` — and
        the effect on [planet, player.planet] clears the selection the instant
        the jump confirms. So the overlay unmounted at exactly the moment the
        arrival was due to play, and the whole transition was however long one
        poll took. Lengthening the animation did nothing, because nothing was
        on screen to run it. A full-screen transition must not depend on a
        detail panel being open.
      */}
      {jump && <PortalWarp to={jump} lowFx={lowFx} />}
    </div>
  )
}
