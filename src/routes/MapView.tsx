import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PLANETS, PORTAL_EFFECTS, type Planet } from '@/chain/config'
import { fetchAssetOwners } from '@/chain/atomic'
import {
  fetchLandsConfig,
  fetchLiveArenas,
  fetchPlanetLands,
  fetchPlayer,
  fetchPlayerTag,
  fetchPlayerTags,
} from '@/chain/queries'
import { landId, travelCost, travelDistance } from '@/chain/landId'
import { unrevealedTavernHere } from '@/tavern/rules'
import type { Land, LandsConfig } from '@/chain/types'
import { MapCanvas, type ZoomApi } from '@/map/MapCanvas'
import { QuestClaims, useClaimableQuests } from '@/map/MapQuests'
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
  liveBoostPercent,
  planetMapSrc,
  type MarkerKey,
} from '@/map/terrain'
import { dungeonMaintained } from '@/dungeon/rules'
import { arenaMaintained } from '@/arena/rules'
import { fetchCapturedArenas, type CapturedArena } from '@/arena/queries'
import { useGame } from '@/state/useGame'
import { DIRTIES, travelVia } from '@/wharf/actions'
import { settle } from '@/wharf/settle'
import { PortalWarp, WARP_TOTAL_MS } from '@/map/PortalWarp'
import { planetRoute } from '@/map/route'
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

/*
 * How long the overlay waits, once it is up, before the planet is swapped
 * underneath it.
 *
 * The overlay fades in over the first 7% of its run; this is comfortably past
 * that, so the old grid is never seen being replaced.
 */
const WARP_COVERED_MS = 600

/** What a planet offers, as three counts. Teal when there is something to do. */
function PlanetStats({ status, icons = false }: { status: PlanetStatus; icons?: boolean }) {
  const { taverns, dungeonsOpen, arenasOpen, loaded } = status
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
    <>
      {stats.map(([key, value, title]) => (
        <span
          className={`pstat${loaded && value > 0 ? ' pstat--open' : ''}`}
          key={key}
          title={loaded ? title : 'Loading…'}
        >
          {icons && <img src={MARKER_SRC[key]} alt="" />}
          {loaded ? value : <span className="pstat__skeleton skeleton" />}
        </span>
      ))}
    </>
  )
}

/**
 * The planets: one pill for the planet in view, which opens into all of them.
 *
 * A table rather than a strip of cards. Six cards across the top of the map
 * either scrolled sideways or covered a third of a phone; six rows with the
 * counts in columns can be read in one look and cost the map nothing until
 * they are asked for. The pill keeps the counts for the planet on screen,
 * which is the reason the control exists at all.
 */
export function PlanetMenu({
  summaries,
  viewing,
  current,
  open,
  onToggle,
  onPick,
}: {
  summaries: PlanetStatus[]
  viewing: Planet
  current: Planet
  open: boolean
  onToggle: () => void
  onPick: (planet: Planet) => void
}) {
  const shown = summaries.find((s) => s.planet === viewing)
  const heads: MarkerKey[] = ['tavern', 'dungeon', 'arena']
  return (
    <div className="planetmenu">
      <button
        type="button"
        className="planetpill"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={onToggle}
        title={open ? 'Close the planets' : 'Every planet'}
      >
        <span className="planetpill__name">
          {viewing}
          {current === viewing && <span className="planethere" title="You are here" />}
        </span>
        <span className="planetpill__sep" />
        {shown && (
          <span className="pstats">
            <PlanetStats status={shown} icons />
          </span>
        )}
        <svg className="planetpill__chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="mapoverlay planetlist" role="listbox" aria-label="Planet">
          <div className="planetlist__head">
            <span>Planet</span>
            {heads.map((k) => (
              <img key={k} src={MARKER_SRC[k]} alt={k} title={k} />
            ))}
          </div>
          {summaries.map((s) => (
            <button
              type="button"
              role="option"
              aria-selected={s.planet === viewing}
              className="planetrow"
              key={s.planet}
              onClick={() => onPick(s.planet)}
            >
              <span className="planetrow__name">
                {s.planet}
                {s.planet === current && <span className="planethere" title="You are here" />}
              </span>
              <PlanetStats status={s} />
            </button>
          ))}
          <div className="planetlist__foot">
            <span className="planethere" /> you are here ·{' '}
            <span className="pstat pstat--open">teal</span> = something you can still do
          </div>
        </div>
      )}
    </div>
  )
}

/* The rail's glyphs. */
const ICON_EYE = (open: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    {!open && <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
  </svg>
)
const ICON_LEGEND = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="5" cy="7" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="5" cy="17" r="1.6" fill="currentColor" stroke="none" />
    <path d="M10 7h9M10 12h9M10 17h9" />
  </svg>
)
const ICON_FIND = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="6" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
)
const ICON_QUESTS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7" />
    <path d="M7 4a2 2 0 0 0-2 2v2h4V6a2 2 0 0 0-2-2ZM7 20a2 2 0 0 1-2-2v-2h4v2a2 2 0 0 1-2 2Z" />
    <path d="M11 9h5M11 13h5" />
  </svg>
)

/** What is open on the rail or the pill: one at a time. */
type Panel = 'planets' | 'legend' | 'quests'

export default function MapView() {
  const player = useGame((s) => s.player)!
  const config = useGame((s) => s.config)
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [planet, setPlanet] = useState<Planet>(player.planet)
  const [landsByPlanet, setLandsByPlanet] = useState<Partial<Record<Planet, Land[]>>>({})
  const [arenasByPlanet, setArenasByPlanet] = useState<Partial<Record<Planet, LiveArena[]>>>({})
  /* Arenas the player has won and is now defending — one read, all planets. */
  const [held, setHeld] = useState<CapturedArena[]>([])
  const [landsConfig, setLandsConfig] = useState<LandsConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null)
  /*
     Whether the Travel tag is old enough to be pressed.

     Selection happens on `pointerup`, and on a touch screen the browser then
     synthesises a click at the same coordinates. The tag appears beside the
     tile that was tapped — a thumb's width from the finger, but a large tile
     at a close zoom can put it under the finger — and that synthesised click
     would land on the Travel button that has just appeared. One tap on the
     map, and the player is signing a transaction they never asked for.

     A mouse does not do this: when press and release land on different
     elements the click is dispatched to their common ancestor, so it goes to
     the map rather than the button. The compatibility click from a touch has
     no such rule and simply hits whatever is under the point.

     So the tag ignores pointer input until the tap that opened it is over —
     and only when it was a tap. A mouse never needs the delay and should not
     have a click of its own swallowed by it.
  */
  const [armed, setArmed] = useState(true)
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
  const [panel, setPanel] = useState<Panel | null>(null)
  const togglePanel = useCallback(
    (p: Panel) => setPanel((open) => (open === p ? null : p)),
    [],
  )
  const zoomApi = useRef<ZoomApi | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const { claimable, reload: reloadQuests } = useClaimableQuests()
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

  /*
   * Which arenas the player is defending.
   *
   * Read fresh rather than from cache: the way onto this screen is usually
   * straight out of an arena fight, and a minute-old answer would be the one
   * from before the win. Bounded to the wallet's own rows, so it is a small
   * request to make on every visit.
   */
  useEffect(() => {
    let cancelled = false
    void fetchCapturedArenas(player.wallet, true)
      .then((rows) => {
        if (!cancelled) setHeld(rows)
      })
      /* A missing answer just leaves the arenas unmarked. */
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [player.wallet])

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

  /*
    Switching to a planet the warmup hasn't reached yet: pull it now.

    Both the planet being looked at and the one the player is standing on. The
    second is what holds the portals — a route off this planet is chosen from
    its teleporter tiles — so while you are looking at somewhere else, the
    map you are *not* looking at is the one that decides whether the Travel
    button can be offered at all.
  */
  useEffect(() => {
    let cancelled = false
    for (const p of new Set<Planet>([planet, player.planet])) {
      if (landsByPlanet[p]) continue
      fetchPlanetLands(p)
        .then((rows) => {
          if (!cancelled) setLandsByPlanet((prev) => ({ ...prev, [p]: rows }))
        })
        .catch((err) => {
          if (!cancelled) setLoadError(readableError(err))
        })
    }
    return () => {
      cancelled = true
    }
  }, [planet, player.planet, landsByPlanet])

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

  /** The arenas being defended, narrowed to the planet on screen. */
  const heldArenaLands = useMemo(
    () => new Set(held.filter((a) => a.planet === planet).map((a) => a.land_id)),
    [held, planet],
  )

  /** The one they are standing in, if it is on the planet being viewed. */
  const currentTavernLand =
    player.last_tavern?.planet === planet ? player.last_tavern.land_id || undefined : undefined

  const summaries = useMemo(
    () =>
      PLANETS.map((p) =>
        summarisePlanet(
          p,
          landsByPlanet[p],
          player,
          playedToday,
          arenasByPlanet[p],
          landsConfig?.boost_decay_per_hour ?? 0,
        ),
      ),
    [landsByPlanet, arenasByPlanet, player, playedToday, landsConfig],
  )

  const byCoord = useMemo(() => {
    const m = new Map<string, Land>()
    for (const l of lands ?? []) m.set(l.x + ',' + l.y, l)
    return m
  }, [lands])

  const land = selected ? byCoord.get(selected.x + ',' + selected.y) : undefined
  const onPlanet = planet === player.planet
  /* Coordinates repeat on every planet, so "here" is a planet as well. */
  const isHere =
    !!selected && onPlanet && selected.x === player.x && selected.y === player.y
  const portalTo = land?.special_effect ? PORTAL_EFFECTS[land.special_effect] : undefined

  /*
     Getting there from another planet, when that is what this is.

     Built off the player's own planet's lands rather than the ones on screen:
     the portal that starts the trip is a tile where the player is standing
     now, not one on the map they are looking at.
  */
  const route = useMemo(
    () =>
      !onPlanet && selected && land
        ? planetRoute(
            player,
            selected,
            planet,
            landsByPlanet[player.planet],
            land,
            config,
          )
        : null,
    [onPlanet, selected, land, player, planet, landsByPlanet, config],
  )

  const cost = selected && config
    ? onPlanet
      ? travelCost(player, selected, config, !!portalTo)
      : (route?.cost ?? null)
    : null
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
    setTravelError(null)
    /* A tap on the map is also how a menu is put away. */
    setPanel(null)
    window.clearTimeout(settleTimer.current)
    if (!byTouch) {
      setArmed(true)
      return
    }
    setArmed(false)
    settleTimer.current = window.setTimeout(() => setArmed(true), SETTLE_MS)
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

       A cross-planet trip is a jump by definition — its first leg is the
       portal — so it takes the wormhole whether or not the tile it finishes
       on happens to be a teleporter too.
    */
    const gate = route ? planet : portalTo

    try {
      /*
         Nothing is drawn until the chain has both taken the transaction and
         confirmed the move.

         The overlay is not a spinner — it is the trip happening — and it runs
         one fixed timeline rather than looping to fill an unknown wait. That
         means the wait has to happen first. The button keeps its spinner
         throughout, which is what a pending transaction should look like.
      */
      /*
         One signature either way. A cross-planet trip sends both legs in the
         same transaction: the portal hop, then the walk from where it drops
         you. All-or-nothing, so a failed second leg cannot leave the player
         stranded on a portal tile on the wrong side of the map.
      */
      await travelVia(
        session,
        route ? route.legs.map((l) => ({ x: l.x, y: l.y })) : [selected],
      )

      /*
         Polled without writing to the store, on a jump.

         `refreshPlayer` publishes the new row to everything reading it, and
         the pin is one of those — so confirming the arrival that way moved
         the player to the far side of the galaxy and *then* played the
         wormhole they had already come through. Read it here and hold it;
         the overlay commits it below, once the screen is covered.

         A step across the same planet keeps publishing as it goes: there is
         no overlay to wait for, and the pin flying to its new tile is the
         animation.
      */
      let arrived: typeof player | null = null
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 700))
        const p = gate
          ? ((await fetchPlayer(player.wallet, true)) ?? null)
          : (await refreshPlayer({ force: true }),
            useGame.getState().player ?? null)
        /*
           The planet is part of "arrived" on a cross-planet trip, and only
           there. Two planets share every coordinate, so waiting on x and y
           alone would call it done the moment the row happened to read back
           mid-flight — after the portal hop, which lands on the same x,y the
           second leg starts from.
        */
        if (p && p.x === selected.x && p.y === selected.y &&
            (!route || p.planet === planet)) {
          arrived = p
          break
        }
      }

      /*
         The trip is on chain, so everything built on the player row is stale.

         This screen does its own waiting — the wormhole has to be timed
         against it — so it never went through `useAction` and none of this
         happened. Quest progress is a lifetime counter on that row, so
         finishing a quest by walking somewhere left the dot dark until the
         chore's own three-minute timer came round.

         Only the player row is dropped, which is all a travel changes, so
         nothing here disturbs the trip that is still playing out below.
      */
      settle(DIRTIES.travelVia)

      if (gate && arrived) {
        setJump(gate)
        /*
           Everything that moves the player happens behind the overlay.

           The grid changing was already waiting for this; the player's own
           position is now too. Publishing the row here rather than while
           polling is what makes the wormhole the moment they travel instead
           of a flourish after the fact.
        */
        await new Promise((r) => setTimeout(r, WARP_COVERED_MS))
        await refreshPlayer({ force: true })
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
    (!!player.last_tavern?.land_id &&
      player.last_tavern.land_id === landId(player.x, player.y)) ||
    /* Without legend access travel does not reveal, so the tavern is still
       in `active_taverns`; the player enters to pay for the reveal. */
    !!unrevealedTavernHere(player)

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
    /* An empty arena stays enterable: a new arena starts with nobody in it,
       and the first challenger wins it without a blow. */
    if (!standing) return null
    if (standing.fighters.some((f) => f.owner === player.wallet)) return null
    return here
  }, [lands, planet, player.planet, player.x, player.y, player.wallet, arenasByPlanet])

  /* The selected tile is an arena this player took and is now defending. */
  const heldHere = land
    ? held.find((a) => a.planet === planet && a.land_id === land.land_id)
    : undefined

  const arenaOccupiedHere =
    !!land &&
    land.buildings.some((b) => String(b.building_name) === 'arena') &&
    !!arenasByPlanet[planet]?.some(
      (a) => a.land_id === land.land_id && a.fighters?.some((f) => f.owner === player.wallet),
    )

  /*
     Once everything is claimed the tile goes, so what hung off it goes too.
  */
  useEffect(() => {
    if (claimable.length === 0) setPanel((open) => (open === 'quests' ? null : open))
  }, [claimable.length])

  /*
     One way in at a time. A tavern and a dungeon can share a land, and two
     tags on one pin would make neither read as the thing to do; the tavern
     wins because it is the cheaper, reversible action.
  */
  const enterTo: 'tavern' | 'dungeon' | 'arena' | null = inTavern
    ? 'tavern'
    : dungeonHere
      ? 'dungeon'
      : arenaHere
        ? 'arena'
        : null

  /*
     What the player is standing on, as a plaque under the dot.

     The land under the player rather than the selected one: the card that
     used to describe a selected land is gone, and the one land whose owner
     and boost are worth a line is the one you are about to walk into. The
     plate names it; when there is a way in, the gold Enter is the plate's
     bottom edge, so the name and the door are one piece.
  */
  const hereLand = useMemo(
    () => (onPlanet ? (lands ?? []).find((l) => l.x === player.x && l.y === player.y) : undefined),
    [onPlanet, lands, player.x, player.y],
  )
  const here = useMemo(() => {
    if (!hereLand) return null
    const building = hereLand.buildings[0]
    if (!building) {
      const to = hereLand.special_effect ? PORTAL_EFFECTS[hereLand.special_effect] : undefined
      return to ? { kind: 'portal', icon: MARKER_SRC.portal, name: `Portal to ${to}`, sub: 'Portal' } : null
    }
    const raw = String(building.building_name)
    const name = raw.replace(/-/g, ' ')
    const kind = name === 'tavern' || name === 'dungeon' || name === 'arena' ? name : 'other'
    const who = owners[String(hereLand.asset_id)]
    const whose = who === player.wallet ? 'Your' : who ? `${tags[who] || who}’s` : ''
    const boost =
      name === 'tavern'
        ? ''
        : formatBoost(
            liveBoostPercent(
              Number(building.boost_score ?? 0),
              String(building.boost_score_update ?? ''),
              landsConfig?.boost_decay_per_hour ?? 0,
            ),
          )
    return {
      kind,
      icon: kind === 'other' ? buildingIcon(raw) : MARKER_SRC[kind],
      name: `${whose} ${name}`.trim(),
      sub: `${name}${boost ? ` · ${boost}` : ''}`,
    }
  }, [hereLand, owners, tags, player.wallet, landsConfig])

  /*
     Hangs off the pin. Nothing while a trip is playing out: the pin is in
     flight, and an offer to enter what was under it belongs to where it was.
  */
  const pinSlot: ReactNode =
    travelling || !here ? null : (
      <div className={`plaque plaque--${here.kind}${enterTo ? ' plaque--door' : ''}`}>
        <div className="plaque__plate">
          <img className="plaque__icon" src={here.icon} alt="" />
          <div>
            <span className="plaque__name">{here.name}</span>
            <span className="plaque__sub">{here.sub}</span>
          </div>
        </div>
        {enterTo && (
          <Link className="plaque__go" to={`/${enterTo}`}>
            Enter {enterTo === 'tavern' ? 'Tavern' : enterTo === 'dungeon' ? 'Dungeon' : 'Arena'}
          </Link>
        )}
      </div>
    )

  /*
     Hangs off the selected tile: the way there, with the cost, or the one
     line that says why there is no way there. Nothing on the tile the
     player is standing on — the pin already carries what can be done here.
  */
  const notes: { text: string; error?: boolean }[] = []
  if (dungeonLockedHere) notes.push({ text: 'Already run today' })
  if (heldHere) {
    notes.push({
      text: `You are defending this arena · ${heldHere.stored_mining_power.toLocaleString(NUM_LOCALE)} banked`,
    })
  } else if (arenaOccupiedHere) {
    notes.push({ text: 'Your fighter is in here' })
  }
  if (selected && land && !canAfford) {
    notes.push({
      text: `You have ${player.activestats.action_points.toLocaleString(NUM_LOCALE)} energy`,
      error: true,
    })
  }
  const travelTitle = !selected
    ? undefined
    : route
      ? `Via the ${player.planet} portal at ${route.portal.x},${route.portal.y}` +
        (route.legs.length > 1
          ? `: ${route.legs[0].cost} to the portal, ${route.legs[1].cost} across ${planet}`
          : '')
      : `${travelDistance(player, selected).toFixed(1)} away`

  /*
     The trip, drawn: from the pin to the land when both are on this planet;
     from where a portal would drop the player when they are not. The portal
     tile's own coordinates, because that is what the contract writes onto
     the player row when they go through.
  */
  const path = useMemo(() => {
    if (!selected || isHere || !land) return null
    if (onPlanet) return [{ x: player.x, y: player.y }, selected]
    if (route) return [route.portal, selected]
    return null
  }, [selected, isHere, land, onPlanet, player.x, player.y, route])

  const travelTag: ReactNode =
    selected && !isHere ? (
      <div className={`traveltag${armed ? '' : ' traveltag--settling'}`}>
        {!onPlanet && !route ? (
          <span className="traveltag__none">No portal from {player.planet}</span>
        ) : !land ? (
          <span className="traveltag__none">
            No land at {selected.x} : {selected.y}
          </span>
        ) : (
          <span className={`traveltag__pair${canAfford ? '' : ' traveltag__pair--short'}`}>
            <button
              type="button"
              className={`traveltag__go${canAfford ? '' : ' traveltag__go--short'}`}
              onClick={() => void doTravel()}
              disabled={travelling || !canAfford}
              title={travelTitle}
            >
              {travelling && <span className="spinner" />}
              {travelling ? 'Travelling' : canAfford ? 'Travel' : 'Need'}
              {cost !== null && (
                <span className="traveltag__cost">
                  <img src={asset('/assets/icons/energy.png')} alt="energy" />
                  {cost}
                </span>
              )}
            </button>
            {/* Where it goes, on the tag's dark end: the one thing a tile is called by. */}
            <span className="traveltag__xy" title="The land's coordinates">
              {selected.x} : {selected.y}
            </span>
          </span>
        )}
        {notes.map((n) => (
          <span
            key={n.text}
            className={`traveltag__note${n.error ? ' traveltag__note--error' : ''}`}
          >
            {n.text}
          </span>
        ))}
      </div>
    ) : null

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
          lowFx={lowFx}
          boostDecayPerHour={landsConfig?.boost_decay_per_hour ?? 0}
          lockedLands={lockedLands}
          heldArenaLands={heldArenaLands}
          tavernLands={tavernLands}
          currentTavernLand={currentTavernLand}
          path={path}
          selectionSlot={travelTag}
          pinSlot={pinSlot}
          zoomApi={zoomApi}
          onZoomLevel={setZoomLevel}
        >
          {/* Everything below floats over the map so none of it costs the
              map any height. */}
          <PlanetMenu
            summaries={summaries}
            viewing={planet}
            current={player.planet}
            open={panel === 'planets'}
            onToggle={() => togglePanel('planets')}
            onPick={(p) => {
              setPlanet(p)
              setPanel(null)
            }}
          />

          {/*
            One rail for every control. The eye heads it at every width and
            is all that is left of it when the furniture is put away, because
            it is the way to bring the furniture back.
          */}
          <div className="maprail">
            {claimable.length > 0 && (
              <div className="maprail__slot">
                <button
                  type="button"
                  className="maprail__btn maprail__btn--quests"
                  aria-expanded={panel === 'quests'}
                  onClick={() => togglePanel('quests')}
                  data-tip="Quests to claim"
                  aria-label={`${claimable.length} quests to claim`}
                >
                  {ICON_QUESTS}
                  <span className="maprail__badge">{claimable.length}</span>
                </button>
                {panel === 'quests' && (
                  <div className="mapoverlay railpop railpop--quests">
                    <QuestClaims quests={claimable} reload={reloadQuests} />
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="maprail__btn"
              aria-pressed={bare}
              onClick={() => {
                setBare((v) => !v)
                /* A panel left open off a hidden tile is a panel with nothing to close it. */
                setPanel(null)
              }}
              data-tip={bare ? 'Show the map controls' : 'Hide the map controls'}
              aria-label={bare ? 'Show the map controls' : 'Hide the map controls'}
            >
              {ICON_EYE(!bare)}
            </button>
            {!bare && (
              <>
                <div className="maprail__slot">
                  <button
                    type="button"
                    className="maprail__btn"
                    aria-expanded={panel === 'legend'}
                    onClick={() => togglePanel('legend')}
                    data-tip="Legend"
                    aria-label="Legend"
                  >
                    {ICON_LEGEND}
                  </button>
                  {panel === 'legend' && (
                    <div className="mapoverlay railpop">
                      <Legend />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="maprail__btn"
                  onClick={() => {
                    setPlanet(player.planet)
                    setRecenter((n) => n + 1)
                  }}
                  data-tip="Find me"
                  aria-label="Find me"
                >
                  {ICON_FIND}
                </button>
                <span className="maprail__gap" aria-hidden="true" />
                <button
                  type="button"
                  className="maprail__btn"
                  onClick={() => zoomApi.current?.zoomIn()}
                  data-tip="Zoom in"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  className="maprail__level"
                  onClick={() => zoomApi.current?.reset()}
                  title="Back to the opening zoom"
                  aria-label={`Zoom ${zoomLevel.toFixed(1)} times, back to the opening zoom`}
                >
                  {zoomLevel.toFixed(1)}×
                </button>
                <button
                  type="button"
                  className="maprail__btn"
                  onClick={() => zoomApi.current?.zoomOut()}
                  data-tip="Zoom out"
                  aria-label="Zoom out"
                >
                  &minus;
                </button>
              </>
            )}
          </div>

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
          {travelError && (
            <div className="mapoverlay maptoast maptoast--error" role="alert">
              {travelError}
            </div>
          )}
        </MapCanvas>
      </div>

      {/*
        At the top level, deliberately.

        This used to sit inside the tile card, which was `selected && (...)` —
        and the effect on [planet, player.planet] clears the selection the
        instant the jump confirms. So the overlay unmounted at exactly the
        moment the arrival was due to play, and the whole transition was
        however long one poll took. A full-screen transition must not depend
        on a detail panel being open.
      */}
      {jump && <PortalWarp to={jump} lowFx={lowFx} />}
    </div>
  )
}
