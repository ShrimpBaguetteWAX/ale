import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  PLAY_MAX_X,
  PLAY_MAX_Y,
  PLAY_MIN_X,
  PLAY_MIN_Y,
  PORTAL_EFFECTS,
} from '@/chain/config'
import type { Land } from '@/chain/types'
import { tripHops } from './tileSteps'
import {
  BUILDING_GROUND,
  BUILDING_SRC,
  BUILDING_UNIT,
  BUILDING_VIEW,
  MARKER_SRC,
  PORTAL_SRC,
  RANKED_SRC,
  buildingMarker,
  formatBoost,
  liveBoostPercent,
  boostRank,
  type MarkerKey,
  boostShown,
} from './terrain'

export interface MapCanvasProps {
  /** Planet artwork, 2000x1000 — exactly 50px per tile over the 40x20 grid. */
  mapSrc: string
  lands: Land[]
  position: { x: number; y: number } | null
  selected: { x: number; y: number } | null
  /**
   * A tile was chosen.
   *
   * `byTouch` because a touch screen synthesises a click after the gesture
   * ends and the caller has to defend against it; a mouse does not, and
   * should not pay for the defence.
   */
  onSelect: (coords: { x: number; y: number }, byTouch?: boolean) => void
  /** Bumping this recentres the view on the player. */
  recenterToken?: number
  /**
   * Bands of the map covered by something opaque, in CSS pixels.
   *
   * The map fills the frame and the controls float on top of it, so the tiles
   * under them cannot be tapped — and the pan clamp pins the grid's edges to
   * the frame's edges, which means a tile in the top or bottom row can never
   * be moved out from under one. It was permanently unreachable.
   *
   * Telling the clamp how much is covered lets the player pan those rows into
   * the open. The slack is exactly the height of what is covering them, so
   * the band it exposes sits behind that same opaque thing: the map still
   * fills every pixel the player can actually see.
   */
  insetTop?: number
  insetBottom?: number
  /*
     The same for every side can also come from the frame around the map:
     `--map-inset-top`, `-right`, `-bottom` and `-left` on any ancestor, in
     pixels, read whenever the map changes size. The larger of the prop and
     the variable wins. That way the shell that floats its menu over the map
     says how much it covers, without the map screen knowing the layout.
  */
  lowFx?: boolean
  /** From lands.ale config; used to age stored boost values forward. */
  boostDecayPerHour?: number
  /**
   * Land ids on this planet the player has already used today — dungeons
   * they have run. Drawn locked rather than hidden, so the map still shows
   * where the dungeon is.
   */
  lockedLands?: Set<string>
  /**
   * Land ids of arenas on this planet the player has won and is defending.
   *
   * `arena.ale`'s `arenacap`, not `livearena`: leaving a fighter in an arena
   * somebody else holds earns nothing, while a held arena is banking mining
   * power for as long as it stands. The map is where a player looks to see
   * what they have out in the world, so a held arena is drawn as theirs.
   */
  heldArenaLands?: Set<string>
  /**
   * Land ids of the player's own active taverns on this planet.
   *
   * Taverns are personal: the same tavern land carries a different selection
   * score and a different objective list for every player, and one that is
   * not in your list is not yours to use. So the map draws taverns from the
   * player row, not from the buildings on the land.
   */
  tavernLands?: Set<string>
  /** The tavern the player is standing in, if it is on this planet. */
  currentTavernLand?: string
  /**
   * Land ids on this planet of the buildings hottest right now across every
   * planet (see `hottestLands`). Those on this planet glow white-hot with
   * embers rising off them, played and defended ones included.
   */
  hotLands?: Set<string>
  /**
   * The way to the selected tile, start and end as tile coordinates on this
   * planet, drawn tile by tile. Travel is priced by straight-line distance,
   * so the tiles drawn are how the trip reads, not a route it pays for.
   * From the player when they are on this planet; from the portal they
   * would arrive through when they are not.
   */
  path?: { x: number; y: number }[] | null
  /** Floating UI rendered over the map: tile inspector, legend. */
  children?: React.ReactNode
  /**
   * Rendered at the selected tile and carried with it as the map pans and
   * zooms, so an action can sit beside the land it acts on rather than in a
   * corner. The anchor is the tile's centre; `--tile` on it is the tile's
   * size in CSS pixels, and `selpin--left` is set when the tile is in the
   * right part of the frame, so whatever hangs off it can flip to the side
   * that has room.
   */
  selectionSlot?: React.ReactNode
  /**
   * Rendered at the player's own tile, and unlike the pin it takes pointer
   * input: it is where the way into whatever is under the player's feet
   * lives. Kept inside the frame: `herepin--above` is set when there is no
   * room under the pin, and `--tag-dx` slides it sideways off an edge.
   */
  pinSlot?: React.ReactNode
  /**
   * Hands the zoom to controls that live outside the canvas. Filled while
   * mounted, nulled on unmount.
   */
  zoomApi?: React.MutableRefObject<ZoomApi | null>
  /**
   * The zoom, as a factor of the opening view, whenever it changes. 1 is the
   * map as it first appeared; 2 is twice as close.
   */
  onZoomLevel?: (level: number) => void
}

export interface ZoomApi {
  zoomIn: () => void
  zoomOut: () => void
  /** Back to the opening view's zoom, about the centre of the frame. */
  reset: () => void
}

interface View {
  /** Pixels per tile. */
  scale: number
  /** Canvas-space offset of the grid origin. */
  tx: number
  ty: number
}

const MIN_SCALE = 8
const MAX_SCALE = 72

/**
 * The breakpoint the map's own layout uses, asked at the moment it matters
 * rather than captured in a prop: the resize observer below already fires on
 * a rotation, so reading it there keeps the answer current for free.
 */
const PHONE = '(max-width: 719px)'
const onPhone = () => window.matchMedia(PHONE).matches

/** Movement beyond this during a press counts as a pan, not a tap. */
const DRAG_SLOP = 6
const GRID_W = PLAY_MAX_X - PLAY_MIN_X + 1 // 40
const GRID_H = PLAY_MAX_Y - PLAY_MIN_Y + 1 // 20
/** Native size of one tile inside the planet artwork. */
const SRC_TILE = 50

/**
 * The smallest scale the player may reach.
 *
 * Two different answers to "zoomed all the way out", and which one is right
 * depends on the shape of the frame. On a wide screen it is *contain* — the
 * whole planet visible, because there is enough width to show it without much
 * waste. On a phone the same rule is dreadful: the grid is 2:1 and the screen
 * is about 1:1.6, so containing it puts the map in a thin band with empty
 * space above and below, and the player is left looking at the letterbox
 * rather than at the game. There the floor is *cover*, and the map fills the
 * screen at every zoom level it can reach.
 */
function floorScale(w: number, h: number, fill = onPhone()): number {
  const contain = Math.min(w / GRID_W, h / GRID_H)
  const cover = Math.max(w / GRID_W, h / GRID_H)
  return Math.max(MIN_SCALE, fill ? cover : contain)
}

/**
 * What lies past the edge of the map, where the frame lets it be panned.
 *
 * Empty background there read as the map having run out. Instead the art
 * carries on, mirrored at each edge so it meets itself without a seam: the
 * coast runs on and the planet simply seems bigger than its grid. The grid,
 * the buildings and everything that can be selected stay on the real map.
 * Only the copies that reach the window are drawn.
 */
function drawBeyond(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  gw: number,
  gh: number,
  w: number,
  h: number,
) {
  if (x <= 0 && y <= 0 && x + gw >= w && y + gh >= h) return
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const rx = x + dx * gw
      const ry = y + dy * gh
      if (rx > w || ry > h || rx + gw < 0 || ry + gh < 0) continue
      ctx.save()
      ctx.translate(dx ? rx + gw / 2 : 0, dy ? ry + gh / 2 : 0)
      ctx.scale(dx ? -1 : 1, dy ? -1 : 1)
      ctx.drawImage(img, dx ? -gw / 2 : rx, dy ? -gh / 2 : ry, gw, gh)
      ctx.restore()
    }
  }
}

/**
 * Small pill of text under a marker. Canvas has no text shadow worth using,
 * so the pill is an explicit rounded rect — cheap, and readable over any
 * terrain colour.
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  scale: number,
  color: string,
) {
  const size = Math.max(9, Math.min(scale * 0.24, 15))
  ctx.font = '700 ' + size + 'px Orbitron, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const padX = size * 0.45
  const w = ctx.measureText(text).width + padX * 2
  const h = size * 1.6
  const x = cx - w / 2
  const y = cy - h / 2

  ctx.fillStyle = 'rgba(5,16,30,0.86)'
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = color
  ctx.fillText(text, cx, cy + 0.5)
}

/**
 * Draw one marker centred on a tile, with a dark disc behind it so the
 * artwork stays readable over bright terrain. Falls back to a coloured dot
 * while the SVG is still loading rather than leaving the tile bare.
 */
function drawMarker(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  kind: MarkerKey,
  px: number,
  py: number,
  scale: number,
  locked = false,
  current = false,
  dim = false,
  rank = 0,
) {
  const cx = px + scale / 2
  const cy = py + scale / 2
  const size = Math.min(scale * 0.68, 44)
  // Spent for today: greyed rim and faded art, with a "Played" label beneath.
  // Still drawn, because the player needs to know the dungeon is there — just
  // not available until the daily reset.
  const rim = locked
    ? '#7d879e'
    : current
      // The tavern you are standing in, set apart from the rest of your own.
      ? '#0ed4a8'
      : kind === 'portal'
        ? '#ff01ff'
        : '#f6a800'

  /*
     The boost rank, as more rim: rings and, at the top two ranks, a
     sunburst. In units of the disc, which is 21 of them across its radius,
     so the frame keeps its proportions at every zoom. Drawn in the rim's own
     colour and faded with it, so a spent dungeon keeps its rank but greys.
  */
  const discR = size * 0.62
  const u = discR / 21
  if (rank >= 4) {
    if (dim) ctx.globalAlpha = 0.45
    const k = rank === 4 ? 8 : 16
    for (let i = 0; i < k; i++) {
      const a = ((360 / k) * i * Math.PI) / 180
      const long = rank === 4 || i % 4 === 0
      const tip = (rank === 4 ? 30.5 : long ? 31.5 : 29) * u
      const half = (((rank === 4 ? 9 : long ? 7 : 5.5) * Math.PI) / 180)
      const at = (r: number, t: number) => [cx + r * Math.sin(t), cy - r * Math.cos(t)] as const
      const [x1, y1] = at(24 * u, a - half)
      const [x2, y2] = at(tip, a)
      const [x3, y3] = at(24 * u, a + half)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineTo(x3, y3)
      ctx.closePath()
      ctx.fillStyle = rim
      ctx.fill()
      ctx.lineWidth = Math.max(0.6, u)
      ctx.strokeStyle = 'rgba(5,16,30,0.9)'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  ctx.fillStyle = locked || dim ? 'rgba(5,16,30,0.86)' : 'rgba(5,16,30,0.72)'
  ctx.beginPath()
  ctx.arc(cx, cy, discR, 0, Math.PI * 2)
  ctx.fill()

  /* A ring with a dark bed under it, so it reads on bright ground. */
  const ringAt = (r: number, w: number) => {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.lineWidth = w + 1.6 * u
    ctx.strokeStyle = 'rgba(5,16,30,0.55)'
    ctx.stroke()
    ctx.lineWidth = w
    ctx.strokeStyle = rim
    ctx.stroke()
  }
  if (rank >= 2) {
    if (dim) ctx.globalAlpha = 0.45
    if (rank === 2) ringAt(discR, 3 * u)
    else {
      ringAt(discR, 2 * u)
      ringAt(24.5 * u, (rank === 5 ? 1.8 : rank === 4 ? 1.4 : 1.2) * u)
    }
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(cx, cy, discR, 0, Math.PI * 2)
  }

  ctx.strokeStyle = rim
  ctx.lineWidth = Math.max(1, scale * (current ? 0.06 : 0.035))
  if (rank >= 2) ctx.lineWidth = 0
  /*
     `dim` turns a marker down rather than repainting it.

     A marker's rim colour says what the building is. Swapping it for grey to
     mean "nothing to do here" spends that colour on a second meaning, so
     this fades the marker's own colour instead of replacing it — the same
     idea as the faded art below, applied to the ring as well.
   */
  if (dim) ctx.globalAlpha = 0.45
  if (rank < 2) ctx.stroke()

  if (locked || dim) ctx.globalAlpha = 0.35

  if (img?.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  } else {
    ctx.fillStyle = rim
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.25, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = 1
}

/** How high each building stands, in its own units, by kind and rank: where the embers start. */
const HOT_TOP = { arena: [-28, -36, -50, -58, -70], dungeon: [-48, -58, -66, -62, -66] }
/** The white-hot embers: where each starts over the building's top, its size, drift and colour. */
const HOT_EMBERS = [-30, -20, -10, 0, 10, 20, 30, -25, -5, 15, 25, -15, 5, 35].map((x, i) => ({
  x,
  y: 4 + (i % 4) * 4,
  /* Larger than on the sheet: a building unit is under half a pixel at the opening zoom. */
  r: 6.5 * [1, 0.7, 0.85, 0.6, 0.95][i % 5],
  dx: i % 2 ? 6 : -6,
  tilt: ((i % 3) - 1) * 14,
  color: ['#fff0a0', '#ffd36a', '#ffb02e', '#ff8a2a'][i % 4],
}))

/**
 * A building standing on its tile: a soft shadow on the ground, the boost
 * rank as rings lying on the ground around its foot (the back half behind
 * it, the front half in front), and the building itself.
 *
 * The ranks are the disc's: one ring, a heavy ring, a double ring, and rays
 * at the top two. `ring` is their colour, and a taverns' too when it is the
 * one you are standing in. `muted` turns the whole thing down for a spent
 * dungeon or an arena you are defending; its picture is already grey.
 */
function drawBuilding(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  px: number,
  py: number,
  scale: number,
  rank: number,
  ring: string,
  locked: boolean,
  held: boolean,
) {
  const u = scale * BUILDING_UNIT
  const x = px + scale / 2
  const y = py + scale / 2 + scale * BUILDING_GROUND

  ctx.save()
  ctx.translate(x + 3 * u, y + 5 * u)
  ctx.scale(1, 13 / 50)
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 50 * u)
  shadow.addColorStop(0, 'rgba(30,18,6,0.5)')
  shadow.addColorStop(0.65, 'rgba(30,18,6,0.22)')
  shadow.addColorStop(1, 'rgba(30,18,6,0)')
  ctx.fillStyle = shadow
  ctx.beginPath()
  ctx.arc(0, 0, 50 * u, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  drawGroundRank(ctx, x, y, u, rank, ring, held, false)
  ctx.globalAlpha = locked ? 0.7 : held ? 0.8 : 1
  const { half, above, size } = BUILDING_VIEW
  ctx.drawImage(img, x - half * u, y - above * u, size * u, size * u)
  ctx.globalAlpha = 1
  drawGroundRank(ctx, x, y, u, rank, ring, held, true)
}

/** One half of a building's rank rings: the back half, or the front. */
function drawGroundRank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  rank: number,
  color: string,
  dim: boolean,
  front: boolean,
) {
  if (!rank) return
  const cy = y + 4 * u
  const rx = 48 * u
  const ry = 14 * u
  if (dim) ctx.globalAlpha = 0.45
  if (rank >= 4) {
    const k = rank === 4 ? 8 : 16
    for (let i = 0; i < k; i++) {
      const a = ((360 / k) * i * Math.PI) / 180
      if (Math.cos(a) > 0 !== front) continue
      const long = rank === 4 || i % 4 === 0
      const tip = rank === 4 ? 1.42 : long ? 1.48 : 1.3
      const half = ((rank === 4 ? 9 : long ? 7 : 5.5) * Math.PI) / 180
      const at = (r: number, t: number) => [x + rx * r * Math.sin(t), cy + ry * r * Math.cos(t)] as const
      ctx.beginPath()
      ctx.moveTo(...at(1.12, a - half))
      ctx.lineTo(...at(tip, a))
      ctx.lineTo(...at(1.12, a + half))
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = u
      ctx.strokeStyle = 'rgba(5,16,30,0.85)'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  }
  /* A ring with a dark bed under it, so it reads on bright ground. */
  const ringAt = (k: number, w: number) => {
    ctx.beginPath()
    ctx.ellipse(x, cy, rx * k, ry * k, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2)
    ctx.lineWidth = (w + 2) * u
    ctx.strokeStyle = 'rgba(5,16,30,0.55)'
    ctx.stroke()
    ctx.lineWidth = w * u
    ctx.strokeStyle = color
    ctx.stroke()
  }
  if (rank === 1) ringAt(1, 2)
  else if (rank === 2) ringAt(1, 4)
  else {
    ringAt(1, 2.8)
    ringAt(1.14, 1.8)
  }
  ctx.globalAlpha = 1
}

/**
 * The world map.
 *
 * The original ships 4,800 separate 50x50 tile JPEGs — one per land, per
 * planet. Loading a planet that way is 800 HTTP requests. Every one of those
 * tiles is a crop of a single 2000x1000 planet image that also ships, so this
 * draws that one image instead: one request, one decode, and pan/zoom becomes
 * a single `drawImage` per frame.
 *
 * Everything the chain knows — buildings and their live boost, portals and
 * where they lead, where you stand — is drawn as an overlay on top, so the
 * art stays the original's and the data stays live.
 */
/** A journey in progress, in tile coordinates. */
interface Trip {
  fromX: number
  fromY: number
  toX: number
  toY: number
  start: number
  ms: number
}

const WARP_MIN_MS = 240
const WARP_MAX_MS = 560
/** How long the arrival ring lingers after the marker lands. */
const LAND_MS = 560

/**
 * Where a trip has got to.
 *
 * Eased with a quartic ease-out: most of the distance is covered in the first
 * third, then it settles. That is what makes it read as a zap rather than a
 * glide — a linear or ease-in-out move over the same duration looks like the
 * marker is walking.
 */
function tripAt(trip: Trip, now: number): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, (now - trip.start) / trip.ms))
  const e = 1 - Math.pow(1 - t, 4)
  return {
    x: trip.fromX + (trip.toX - trip.fromX) * e,
    y: trip.fromY + (trip.toY - trip.fromY) * e,
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function MapCanvas({
  mapSrc,
  lands,
  position,
  selected,
  onSelect,
  recenterToken = 0,
  insetTop = 0,
  insetBottom = 0,
  lowFx = false,
  boostDecayPerHour = 0,
  lockedLands,
  heldArenaLands,
  tavernLands,
  currentTavernLand,
  hotLands,
  path,
  children,
  selectionSlot,
  pinSlot,
  zoomApi,
  onZoomLevel,
}: MapCanvasProps) {
  const decayRef = useRef(boostDecayPerHour)
  decayRef.current = boostDecayPerHour
  const lockedRef = useRef(lockedLands)
  lockedRef.current = lockedLands
  const heldRef = useRef(heldArenaLands)
  heldRef.current = heldArenaLands
  const tavernsRef = useRef(tavernLands)
  tavernsRef.current = tavernLands
  const currentTavernRef = useRef(currentTavernLand)
  currentTavernRef.current = currentTavernLand
  const pathRef = useRef(path)
  pathRef.current = path
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View>({ scale: 18, tx: 0, ty: 0 })
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const frameRef = useRef(0)
  const indexRef = useRef(new Map<string, Land>())
  const imgRef = useRef<HTMLImageElement | null>(null)
  const markersRef = useRef(new Map<MarkerKey, HTMLImageElement>())
  /* The buildings' pictures, by kind, and by kind + "-muted" for the greyed ones. */
  const buildingsRef = useRef(new Map<string, HTMLImageElement>())
  const pinRef = useRef<HTMLDivElement>(null)
  /* The trip's layer: one group, moved with the map like the pin. */
  const tripRef = useRef<SVGGElement>(null)
  /* The hot buildings' layer, moved the same way. */
  const hotRef = useRef<SVGGElement>(null)
  /*
     The holes the markers by the land cut in its rings, so the rings run
     behind them. The markers are canvas paint under this layer; the canvas
     says where it drew them, and these are kept in step each frame.
  */
  const underRef = useRef<SVGGElement>(null)

  /*
     The trip as a flight over the planet: one long curve to the land, hopping
     between small landing pads lying flat on the ground along it, each hop a
     thin arc of light lifted off the surface with its shadow below. The pads glow in turn, slowly,
     from the first to the last. An SVG layer rather than canvas paint so it
     can glow without repainting the planet every frame; and because that
     layer sits over the canvas, a pad never lands on a building or a portal.
  */
  const trip = useMemo(() => {
    if (!path || path.length < 2) return null
    const from = path[0]
    const to = path[path.length - 1]
    const taken = new Set(
      lands.filter((l) => l.buildings.length > 0 || l.special_effect).map((l) => l.x + ',' + l.y),
    )
    const free = (p: { x: number; y: number }) =>
      p.x >= PLAY_MIN_X && p.x <= PLAY_MAX_X && p.y >= PLAY_MIN_Y && p.y <= PLAY_MAX_Y && !taken.has(p.x + ',' + p.y)
    const hop = tripHops(from, to, free)
    /* Drawn through tile centres; tripHops works in whole tiles. */
    const pt = (p: { x: number; y: number }) => `${p.x + 0.5},${p.y + 0.5}`
    const legs = hop.legs.map((l) => ({
      air: `M${pt(l.a)} Q${pt(l.air)} ${pt(l.b)}`,
      ground: `M${pt(l.a)} Q${pt(l.ground)} ${pt(l.b)}`,
    }))
    const stops = hop.stops.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }))
    return { legs, pads: stops.slice(1, -1), end: stops[stops.length - 1], start: from }
  }, [path, lands])
  /*
     The hot buildings on this planet: a white-hot glow round each one's
     outline and embers rising off it. An SVG layer over the canvas, like the
     trip, so it can move without repainting the planet; the glow is drawn
     only outside the building's own outline, so it never covers the
     building, its rings or its label. Laid out in the buildings' own units.
  */
  const hotMarks = useMemo(() => {
    if (!hotLands?.size) return []
    return lands
      /* Played and defended ones burn too: they are still among the hottest. */
      .filter((l) => hotLands.has(l.land_id))
      .flatMap((l) => {
        const b = l.buildings[0]
        const kind = b && buildingMarker(String(b.building_name))
        if (kind !== 'arena' && kind !== 'dungeon') return []
        const rank = boostRank(
          liveBoostPercent(Number(b.boost_score ?? 0), String(b.boost_score_update ?? ''), boostDecayPerHour ?? 0),
        )
        return [{ id: l.land_id, x: l.x, y: l.y, src: RANKED_SRC[kind][rank - 1].lit, top: HOT_TOP[kind][rank - 1] }]
      })
  }, [lands, hotLands, boostDecayPerHour])
  const tripEndRef = useRef<{ x: number; y: number } | null>(null)
  tripEndRef.current = trip?.end ?? null
  const hereRef = useRef<HTMLDivElement>(null)
  const selRef = useRef<HTMLDivElement>(null)
  /* Where the pin last sat on screen, so the tag can be re-fitted when it changes size. */
  const pinAtRef = useRef<{ cx: number; cy: number; size: number } | null>(null)

  /*
     Keep the tag by the pin on screen. It hangs under the pin; on the bottom
     rows there is no room there, so it goes above instead, and near a side
     it slides along so its arrow still points at the pin. Measured rather
     than assumed: the tag folds, and names differ in length.
  */
  const fitHereTag = useCallback(() => {
    const here = hereRef.current
    const at = pinAtRef.current
    if (!here || !at) return
    const tag = here.firstElementChild as HTMLElement | null
    if (!tag) return
    const { w, h } = sizeRef.current
    /* Inside the open area, not under the frame. */
    const { top, right, bottom, left } = insetRef.current
    const m = 8
    const tw = tag.offsetWidth
    const th = tag.offsetHeight
    const halo = Math.min(80, Math.max(44, at.size * 1.9))
    const below = at.cy + halo / 2 + 9 + th + m <= h - bottom
    const aboveRoom = at.cy - (halo / 2 + 24 + th + m) >= top
    here.classList.toggle('herepin--above', !below && aboveRoom)
    const half = tw / 2
    let dx = 0
    if (at.cx - half < left + m) dx = left + m - (at.cx - half)
    else if (at.cx + half > w - right - m) dx = w - right - m - (at.cx + half)
    const limit = Math.max(0, half - 18)
    dx = Math.max(-limit, Math.min(limit, dx))
    here.style.setProperty('--tag-dx', dx + 'px')
  }, [])
  /* The scale the map opened at, which is what the zoom readout counts from. */
  const openScaleRef = useRef(0)
  const levelRef = useRef(0)
  const onZoomLevelRef = useRef(onZoomLevel)
  onZoomLevelRef.current = onZoomLevel

  // Interaction inputs live in refs so the pointer listeners bind once.
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const positionRef = useRef(position)
  positionRef.current = position
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const lowFxRef = useRef(lowFx)
  lowFxRef.current = lowFx

  /*
     The travel animation.

     `travelRef` holds the trip in progress; while it is set, the pin is drawn
     at an interpolated tile rather than at `position`, so the canvas and the
     marker agree about where the player is mid-flight.
  */
  const travelRef = useRef<Trip | null>(null)
  const warpFrameRef = useRef(0)
  const landTimerRef = useRef(0)
  /* Plain coordinates, not the caller's object, which is a new one each render. */
  const prevPosRef = useRef<{ x: number; y: number } | null>(position)

  /**
   * Put the marker on a tile.
   *
   * Split out of `draw` so the travel animation can move it every frame
   * without repainting the canvas — which is the whole reason the marker is a
   * DOM node and not canvas paint. Reads the view from its ref, so panning
   * mid-flight still lands the pin in the right place.
   */
  const placePin = useCallback((tileX: number, tileY: number) => {
    const pin = pinRef.current
    if (!pin) return
    const { w, h } = sizeRef.current
    const { scale, tx, ty } = viewRef.current
    const cx = (tileX - PLAY_MIN_X) * scale + tx + scale / 2
    const cy = (tileY - PLAY_MIN_Y) * scale + ty + scale / 2
    const visible = cx >= -40 && cy >= -40 && cx <= w + 40 && cy <= h + 40
    pin.style.display = visible ? 'block' : 'none'
    const here = hereRef.current
    if (here) here.style.display = visible ? 'block' : 'none'
    if (!visible) return
    const transform = 'translate(' + cx + 'px, ' + cy + 'px)'
    const size = Math.max(18, Math.min(scale * 0.8, 52)) + 'px'
    pin.style.transform = transform
    pin.style.setProperty('--pin-size', size)
    /* The slot above the pin rides on the same transform, so the two can
       never drift apart mid-flight. */
    if (here) {
      here.style.transform = transform
      here.style.setProperty('--pin-size', size)
      pinAtRef.current = { cx, cy, size: parseFloat(size) }
      fitHereTag()
    }
  }, [fitHereTag])

  /* The tag changes size when it folds or names another building. */
  useLayoutEffect(() => {
    fitHereTag()
  }, [pinSlot, fitHereTag])

  /**
   * Put the selection anchor on the selected tile, or hide it.
   *
   * Same idea as the pin: one style write per frame on a node that already
   * exists, rather than anything that would make React re-render while the
   * map is being dragged.
   */
  const placeSelection = useCallback(() => {
    const el = selRef.current
    if (!el) return
    const sel = selectedRef.current
    if (!sel) {
      el.style.display = 'none'
      return
    }
    const { w, h } = sizeRef.current
    const { scale, tx, ty } = viewRef.current
    const cx = (sel.x - PLAY_MIN_X) * scale + tx + scale / 2
    const cy = (sel.y - PLAY_MIN_Y) * scale + ty + scale / 2
    const visible = cx >= -40 && cy >= -40 && cx <= w + 40 && cy <= h + 40
    el.style.display = visible ? 'block' : 'none'
    if (!visible) return
    el.style.transform = 'translate(' + cx + 'px, ' + cy + 'px)'
    el.style.setProperty('--tile', scale + 'px')
    el.classList.toggle('selpin--left', cx > w - insetRef.current.right - 230)
  }, [])

  const draw = useCallback(() => {
    frameRef.current = 0
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { w, h, dpr } = sizeRef.current
    const { scale, tx, ty } = viewRef.current
    const index = indexRef.current
    const sel = selectedRef.current
    const pos = positionRef.current
    const img = imgRef.current

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#05101e'
    ctx.fillRect(0, 0, w, h)

    // The whole planet in one draw call.
    if (img?.complete && img.naturalWidth > 0) {
      // Smoothing off when magnified past native: crisper, and cheaper.
      ctx.imageSmoothingEnabled = scale < SRC_TILE
      ctx.drawImage(img, tx, ty, GRID_W * scale, GRID_H * scale)
      drawBeyond(ctx, img, tx, ty, GRID_W * scale, GRID_H * scale, w, h)
    }

    // Visible tile range, so overlays never iterate off-screen lands.
    const x0 = Math.max(PLAY_MIN_X, Math.floor(-tx / scale) + PLAY_MIN_X)
    const x1 = Math.min(PLAY_MAX_X, Math.ceil((w - tx) / scale) + PLAY_MIN_X)
    const y0 = Math.max(PLAY_MIN_Y, Math.floor(-ty / scale) + PLAY_MIN_Y)
    const y1 = Math.min(PLAY_MAX_Y, Math.ceil((h - ty) / scale) + PLAY_MIN_Y)

    const showGrid = scale >= 22
    const showMarkers = scale >= 16
    /*
       Labels are always drawn.

       There used to be a 34px-per-tile threshold, on the grounds that below
       it they crowd into each other — with an exemption for phones, where the
       player cannot zoom past the floor and the floor sits under it.

       The exemption was keyed on `max-width: 719px`, and the map opens at
       `cover` on every device, so anything wider kept the hard threshold
       while still opening below it. Labels were therefore missing from the
       opening view of any window narrower than 1360px *and* shorter than
       680px — most laptops once browser chrome is taken off, and a phone
       turned to landscape, which at 844px wide stops being a phone by that
       query and loses the very exemption written for it.

       What a building pays is the reason to walk to it, and the map is where
       that choice is made, so it is worth more than the tidiness: a
       multiplier that is absent reads as a building with no boost rather than
       as a label that was suppressed. Crowding only bites at the furthest
       zoom out, where the map is a planet-wide overview rather than something
       being read closely.
    */

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let gx = x0; gx <= x1 + 1; gx++) {
        const px = Math.round((gx - PLAY_MIN_X) * scale + tx) + 0.5
        ctx.moveTo(px, ty)
        ctx.lineTo(px, ty + GRID_H * scale)
      }
      for (let gy = y0; gy <= y1 + 1; gy++) {
        const py = Math.round((gy - PLAY_MIN_Y) * scale + ty) + 0.5
        ctx.moveTo(tx, py)
        ctx.lineTo(tx + GRID_W * scale, py)
      }
      ctx.stroke()
    }

    /* Markers near the trip's land, as circles in tiles, for the rings' holes. */
    const under: string[] = []
    const end = tripEndRef.current
    const paints: { gx: number; gy: number; paint: () => void }[] = []

    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const land = index.get(gx + ',' + gy)
        if (!land) continue
        const px = (gx - PLAY_MIN_X) * scale + tx
        const py = (gy - PLAY_MIN_Y) * scale + ty

        /*
         * Taverns come from the player's own `active_taverns`, not from the
         * buildings on the land. The same tavern carries a different score and
         * a different objective list per player, and one that is not in your
         * list is not yours to enter — so a tavern building nobody assigned to
         * you draws nothing.
         */
        let marker: MarkerKey | null = null
        if (land.special_effect) {
          marker = 'portal'
        } else if (
          tavernsRef.current?.has(land.land_id) ||
          land.land_id === currentTavernRef.current
        ) {
          // The union matters: on reveal the contract *moves* the tavern out
          // of active_taverns and into last_tavern, so the one the player is
          // actually using is missing from the active list.
          marker = 'tavern'
        } else if (land.buildings.length > 0) {
          const b = land.buildings[0]
          const fromLand = buildingMarker(String(b.building_name))
          /*
             A building decayed below 0.1x is not drawn at all — not as an
             icon and not as a dot. See `MIN_SHOWN_BOOST`. The multiplier is
             aged forward the same way the label under the marker ages it,
             so the two can never disagree about whether it is there.
          */
          const worth = boostShown(
            liveBoostPercent(
              Number(b.boost_score ?? 0),
              String(b.boost_score_update ?? ''),
              decayRef.current,
            ),
          )
          marker = fromLand === 'tavern' || !worth ? null : fromLand
        }

        // A dungeon the player has already run today is spent until the
        // daily reset, so it is drawn locked.
        const locked = marker === 'dungeon' && !!lockedRef.current?.has(land.land_id)
        // The tavern they are standing in right now.
        const current = marker === 'tavern' && land.land_id === currentTavernRef.current
        /*
           An arena they won and are defending, earning mining power.

           Dimmed like a spent dungeon, because for the purpose of this map
           it is spent: `playarena` will not let anyone challenge an arena
           their own fighter is standing in, so there is nothing here to go
           and do. Different reason, same answer — not tonight.
         */
        const held = marker === 'arena' && !!heldRef.current?.has(land.land_id)

        if (marker) {
          /*
             Painted after the sweep, back to front, so a building lower on
             the map stands in front of one above it.
          */
          paints.push({
            gx,
            gy,
            paint: () => {
              if (showMarkers) {
                /* Taverns and portals carry no boost, and so no rank. */
                const rank =
                  marker === 'dungeon' || marker === 'arena'
                    ? boostRank(
                        liveBoostPercent(
                          Number(land.buildings[0]?.boost_score ?? 0),
                          String(land.buildings[0]?.boost_score_update ?? ''),
                          decayRef.current,
                        ),
                      )
                    : 0
                /*
                   A tavern, dungeon or arena stands on its tile as a little
                   building, and a portal as the gate to the planet it leads
                   to; a building stays a marker while its picture loads.
                 */
                const picture =
                  marker === 'portal'
                    ? buildingsRef.current.get(`portal-${PORTAL_EFFECTS[land.special_effect]}`)
                    : buildingsRef.current.get(
                        /* An arena's cloth and a hydra's heads say its rank. */
                        (marker === 'arena' || marker === 'dungeon'
                          ? `${marker}-r${Math.min(5, Math.max(1, rank))}`
                          : marker) +
                          (locked || held ? '-muted' : ''),
                      )
                const standing = !!picture?.complete && picture.naturalWidth > 0
                if (picture && standing) {
                  drawBuilding(
                    ctx,
                    picture,
                    px,
                    py,
                    scale,
                    /* The tavern you are standing in gets a ring of its own colour. */
                    current ? 1 : rank,
                    current ? '#0ed4a8' : locked ? '#7d879e' : '#f6a800',
                    locked,
                    held,
                  )
                } else {
                  drawMarker(
                    ctx,
                    markersRef.current.get(marker),
                    marker,
                    px,
                    py,
                    scale,
                    locked,
                    current,
                    held,
                    rank,
                  )
                }
                if (end && Math.abs(gx + 0.5 - end.x) < 3 && Math.abs(gy + 0.5 - end.y) < 3) {
                  if (standing) {
                    /* Roughly the building's outline: it stands up into the tile above. */
                    under.push(`<circle cx="${gx + 0.5}" cy="${gy + 0.3}" r="0.46" fill="black"/>`)
                  } else {
                    /* The disc, out to the rank's outer ring or sunburst, and a hair more. */
                    const discR = Math.min(scale * 0.68, 44) * 0.62
                    const reach = rank >= 5 ? 31.5 / 21 : rank === 4 ? 30.5 / 21 : rank === 3 ? 25.5 / 21 : 1.05
                    const r = (discR * reach + 1.5) / scale
                    under.push(`<circle cx="${gx + 0.5}" cy="${gy + 0.5}" r="${r.toFixed(3)}" fill="black"/>`)
                  }
                }

                /* Under a building the label sits on the ground in front of it. */
                const labelY = py + scale * (standing ? 0.9 : 0.86)
                if (marker === 'portal') {
                  const dest = PORTAL_EFFECTS[land.special_effect]
                  if (dest) drawLabel(ctx, dest, px + scale / 2, labelY, scale, '#ff01ff')
                } else if (current) {
                  drawLabel(ctx, 'Current', px + scale / 2, labelY, scale, '#0ed4a8')
                } else if (held) {
                  /*
                     In place of the multiplier, not beside it — there is one
                     line under a marker. Which arenas you are defending is the
                     thing you cannot work out from anywhere else on this
                     screen, and the multiplier is a glance at the tile away.
                   */
                  drawLabel(
                    ctx,
                    'Defending',
                    px + scale / 2,
                    labelY,
                    scale,
                    /* The marker's own gold, turned down with it. */
                    'rgba(246,168,0,0.55)',
                  )
                } else if (locked) {
                  drawLabel(ctx, 'Played', px + scale / 2, labelY, scale, '#7d879e')
                } else if (marker !== 'tavern') {
                  /*
                     Taverns carry no multiplier.

                     The boost score on a land scales what its building pays
                     out, and a tavern pays nothing — it offers trainers, which
                     the score has no bearing on. Printing one there was reading
                     a number off the land that means nothing for what the
                     player would actually get by walking in.
                  */
                  const b = land.buildings[0]
                  const mult = liveBoostPercent(
                    Number(b.boost_score ?? 0),
                    String(b.boost_score_update ?? ''),
                    decayRef.current,
                  )
                  drawLabel(ctx, formatBoost(mult), px + scale / 2, labelY, scale, '#f6a800')
                }
              } else {
                // Zoomed out far enough that a 10px icon is mush; a coloured dot
                // still tells the player something is on this tile.
                const r = Math.max(1.5, scale * 0.16)
                ctx.fillStyle = current
                  ? '#0ed4a8'
                  : locked
                    ? '#7d879e'
                  : marker === 'portal'
                    ? '#ff01ff'
                    : '#f6a800'
                ctx.beginPath()
                ctx.arc(px + scale / 2, py + scale / 2, r, 0, Math.PI * 2)
                ctx.fill()
              }
            },
          })
        }
      }
    }

    paints.sort((a, b) => a.gy - b.gy || a.gx - b.gx)
    for (const p of paints) p.paint()

    if (sel) {
      const px = (sel.x - PLAY_MIN_X) * scale + tx
      const py = (sel.y - PLAY_MIN_Y) * scale + ty
      ctx.strokeStyle = '#00baff'
      ctx.lineWidth = 2.5
      ctx.strokeRect(px - 1, py - 1, scale + 2, scale + 2)
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 1
      ctx.strokeRect(px - 2.5, py - 2.5, scale + 5, scale + 5)
    }

    // The player marker is a DOM element, not canvas paint: it pulses, and a
    // pulsing canvas marker would mean a full redraw every frame — 800 tiles
    // and a 2000x1000 image — just to animate one dot. Positioning a single
    // absolutely-placed node costs one style write instead.
    const pin = pinRef.current
    if (pin) {
      /*
         Mid-trip the marker belongs where the animation has got to, not at
         the destination. Without this a pan or a zoom during a journey would
         snap the pin to the far end and the flight would finish from there.
      */
      const trip = travelRef.current
      const at = trip ? tripAt(trip, performance.now()) : pos
      if (at) placePin(at.x, at.y)
      else {
        pin.style.display = 'none'
        if (hereRef.current) hereRef.current.style.display = 'none'
      }
    }
    placeSelection()

    /*
       The trip rides the map the way the pin does: its marks are laid out in
       tile units once, and each frame only the group's transform changes, so
       a pan never rebuilds them and their pulse never restarts.
    */
    /* The hot layer rides the map too; with the buildings drawn as dots it has nothing to sit on. */
    const hot = hotRef.current
    if (hot) {
      hot.setAttribute(
        'transform',
        `translate(${tx - PLAY_MIN_X * scale} ${ty - PLAY_MIN_Y * scale}) scale(${scale})`,
      )
      hot.style.display = showMarkers ? '' : 'none'
    }
    const trip = tripRef.current
    if (trip) {
      trip.setAttribute(
        'transform',
        `translate(${tx - PLAY_MIN_X * scale} ${ty - PLAY_MIN_Y * scale}) scale(${scale})`,
      )
    }
    /* Only touched when the markers by the land change: a zoom, a new land. */
    const holes = underRef.current
    const cut = under.join('')
    if (holes && holes.getAttribute('data-cut') !== cut) {
      holes.innerHTML = cut
      holes.setAttribute('data-cut', cut)
    }

    /* The readout only hears about a change it would show. */
    if (openScaleRef.current > 0) {
      const level = Math.round((scale / openScaleRef.current) * 10) / 10
      if (level !== levelRef.current) {
        levelRef.current = level
        onZoomLevelRef.current?.(level)
      }
    }
  }, [placePin, placeSelection])

  /**
   * Coalesce a repaint into the next frame. Used for pan and pinch, where
   * updates arrive faster than the display can show them.
   */
  const schedule = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(draw)
  }, [draw])

  /**
   * Paint immediately.
   *
   * One-off updates — the planet image decoding, new land data, a resize, a
   * selection change — go through here rather than `schedule`. rAF is not
   * guaranteed to run: a backgrounded tab, a throttling browser, or an
   * embedded webview that isn't compositing will all sit on the callback
   * indefinitely, and the map would stay blank until the player happened to
   * drag it. These updates are rare enough that coalescing buys nothing.
   */
  const drawNow = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
    draw()
  }, [draw])

  // Load the planet artwork; redraw once it decodes.
  useEffect(() => {
    const img = new Image()
    img.decoding = 'async'
    img.src = mapSrc
    imgRef.current = img
    let alive = true
    img
      .decode()
      .catch(() => {})
      .then(() => {
        if (alive) drawNow()
      })
    return () => {
      alive = false
    }
  }, [mapSrc, drawNow])

  // Marker artwork is four small SVGs, and the buildings six more; load them
  // once and repaint as they arrive so the map is never waiting on all of them.
  useEffect(() => {
    let alive = true
    const pictures = buildingsRef.current
    const sources: [string, { lit: string; muted: string }][] = [
      ...Object.entries(BUILDING_SRC),
      ...Object.entries(RANKED_SRC).flatMap(([kind, list]) =>
        list.map((src, i): [string, { lit: string; muted: string }] => [`${kind}-r${i + 1}`, src]),
      ),
    ]
    for (const [planet, src] of Object.entries(PORTAL_SRC)) {
      const key = `portal-${planet}`
      if (pictures.has(key)) continue
      const img = new Image()
      img.decoding = 'async'
      img.src = src
      pictures.set(key, img)
      img
        .decode()
        .catch(() => {})
        .then(() => {
          if (alive) drawNow()
        })
    }
    for (const [kind, src] of sources) {
      for (const [key, url] of [
        [kind, src.lit],
        [kind + '-muted', src.muted],
      ]) {
        if (pictures.has(key)) continue
        const img = new Image()
        img.decoding = 'async'
        img.src = url
        pictures.set(key, img)
        img
          .decode()
          .catch(() => {})
          .then(() => {
            if (alive) drawNow()
          })
      }
    }
    const store = markersRef.current
    for (const [key, src] of Object.entries(MARKER_SRC) as [MarkerKey, string][]) {
      if (store.has(key)) continue
      const img = new Image()
      img.decoding = 'async'
      img.src = src
      store.set(key, img)
      img
        .decode()
        .catch(() => {})
        .then(() => {
          if (alive) drawNow()
        })
    }
    return () => {
      alive = false
    }
  }, [drawNow])

  // A new trip's rings need their holes from a frame drawn after they exist.
  useLayoutEffect(() => {
    if (trip) drawNow()
  }, [trip, drawNow])

  // Index lands by "x,y" so draw and hit-testing are O(1) per tile.
  useLayoutEffect(() => {
    const m = new Map<string, Land>()
    for (const l of lands) m.set(l.x + ',' + l.y, l)
    indexRef.current = m
    drawNow()
  }, [lands, drawNow])

  /*
     Travel, as a flight rather than a jump.

     Declared *above* the repaint effect on purpose. Both watch the position,
     effects run in declaration order, and this one has to set `travelRef`
     before anything repaints — otherwise the first frame after arriving
     paints the marker at the destination and the flight starts from a dot
     that has already visibly moved.

     Keyed on the coordinates rather than on the `position` object, which is
     rebuilt by the caller on every render. Depending on the object meant this
     effect re-ran constantly, and its cleanup cancelled the flight almost as
     soon as it started — travelling polls the player row several times, so in
     practice the animation never survived past a frame or two.
  */
  const posX = position ? position.x : null
  const posY = position ? position.y : null
  useEffect(() => {
    const from = prevPosRef.current
    if (posX !== null && posY !== null) prevPosRef.current = { x: posX, y: posY }
    else prevPosRef.current = null

    const pin = pinRef.current
    if (!pin || posX === null || posY === null || !from) return
    if (from.x === posX && from.y === posY) return
    if (lowFxRef.current || prefersReducedMotion()) return

    const dx = posX - from.x
    const dy = posY - from.y
    /* Long hops take a little longer, but not proportionally — crossing the
       map should feel fast, not like waiting for a loading bar. */
    const ms = Math.min(WARP_MAX_MS, WARP_MIN_MS + Math.hypot(dx, dy) * 9)

    travelRef.current = {
      fromX: from.x, fromY: from.y,
      toX: posX, toY: posY,
      start: performance.now(), ms,
    }

    pin.style.setProperty('--warp-ms', ms + 'ms')
    pin.style.setProperty('--warp-angle', (Math.atan2(dy, dx) * 180) / Math.PI + 'deg')
    pin.classList.remove('is-landing')
    /* Force a reflow so a second trip restarts the animations rather than
       continuing the first one's timeline. */
    void pin.offsetWidth
    pin.classList.add('is-warping')

    const step = () => {
      const trip = travelRef.current
      if (!trip) return
      const now = performance.now()
      const at = tripAt(trip, now)
      placePin(at.x, at.y)
      if (now - trip.start < trip.ms) {
        warpFrameRef.current = requestAnimationFrame(step)
        return
      }
      travelRef.current = null
      pin.classList.remove('is-warping')
      void pin.offsetWidth
      pin.classList.add('is-landing')
      window.clearTimeout(landTimerRef.current)
      landTimerRef.current = window.setTimeout(
        () => pin.classList.remove('is-landing'),
        LAND_MS,
      )
      drawNow()
    }

    cancelAnimationFrame(warpFrameRef.current)
    warpFrameRef.current = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(warpFrameRef.current)
      window.clearTimeout(landTimerRef.current)
      travelRef.current = null
      pin.classList.remove('is-warping', 'is-landing')
    }
  }, [posX, posY, placePin, drawNow])

  useEffect(() => {
    drawNow()
  }, [
    selected,
    position,
    path,
    lowFx,
    lockedLands,
    heldArenaLands,
    tavernLands,
    currentTavernLand,
    drawNow,
  ])

  useEffect(
    () => () => {
      if (!frameRef.current) return
      cancelAnimationFrame(frameRef.current)
      // Clearing the handle matters: `schedule` treats a non-zero handle as
      // "a frame is already queued". Leaving a cancelled id there would make
      // every later schedule() a no-op, and the canvas would never paint
      // again after a remount (which StrictMode does on every mount).
      frameRef.current = 0
    },
    [],
  )

  /** Clamp the pan so the grid can't be dragged fully off screen. */
  /*
     Kept in a ref so `clamp` stays a stable callback — half the effects in
     this file list it, and giving it a changing identity would re-run them
     every time a card opened.
  */
  /* The frame's covered bands, from the CSS variables; see `insetTop`. */
  const frameInsetRef = useRef({ top: 0, right: 0, bottom: 0, left: 0, bottomLeft: 0 })
  /* A taller band in the bottom-left corner, where a phone stacks its quick buttons. */
  const cornerRef = useRef(0)
  const insetRef = useRef({ top: insetTop, right: 0, bottom: insetBottom, left: 0 })
  {
    const f = frameInsetRef.current
    insetRef.current = {
      top: Math.max(insetTop, f.top),
      right: f.right,
      bottom: Math.max(insetBottom, f.bottom),
      left: f.left,
    }
  }
  /* Read the frame's insets off the host; true when they changed. */
  const readFrameInsets = useCallback((host: HTMLElement): boolean => {
    const css = getComputedStyle(host)
    const px = (name: string) => Math.max(0, parseFloat(css.getPropertyValue(name)) || 0)
    const next = {
      top: px('--map-inset-top'),
      right: px('--map-inset-right'),
      bottom: px('--map-inset-bottom'),
      left: px('--map-inset-left'),
      bottomLeft: px('--map-inset-bottom-left'),
    }
    cornerRef.current = next.bottomLeft
    const prev = frameInsetRef.current
    frameInsetRef.current = next
    insetRef.current = {
      top: Math.max(insetRef.current.top, next.top),
      right: next.right,
      bottom: Math.max(insetRef.current.bottom, next.bottom),
      left: next.left,
    }
    return prev.top !== next.top || prev.right !== next.right || prev.bottom !== next.bottom || prev.left !== next.left
  }, [])

  const clamp = useCallback(() => {
    const v = viewRef.current
    const { w, h } = sizeRef.current
    const { top, right, bottom, left } = insetRef.current
    const gridW = GRID_W * v.scale
    const gridH = GRID_H * v.scale
    /*
       The extra room on each side is what makes the edge tiles reachable:
       pan the grid in by `left` and its first column clears whatever floats
       on the left; out by `right` and the last one clears the right; the
       same for the first and last rows. Anything on the map can be brought
       out from under the frame.
    */
    v.tx = Math.min(left, Math.max(w - gridW - right, v.tx))
    /* The bottom-left corner's taller band too, or a tile in it could never clear it. */
    v.ty = Math.min(top, Math.max(h - gridH - Math.max(bottom, cornerRef.current), v.ty))
    /* Smaller than the open area: sit in the middle of it, not of the window. */
    if (gridW + left + right < w) v.tx = left + (w - left - right - gridW) / 2
    if (gridH + top + bottom < h) v.ty = top + (h - top - bottom - gridH) / 2
  }, [])

  /** The middle of the open area: the window less what floats over its edges. */
  const openCentre = useCallback((): [number, number] => {
    const { w, h } = sizeRef.current
    const { top, right, bottom, left } = insetRef.current
    return [left + (w - left - right) / 2, top + (h - top - bottom) / 2]
  }, [])

  const centerOn = useCallback(
    (gx: number, gy: number) => {
      const v = viewRef.current
      const [cx, cy] = openCentre()
      v.tx = cx - (gx - PLAY_MIN_X + 0.5) * v.scale
      v.ty = cy - (gy - PLAY_MIN_Y + 0.5) * v.scale
      clamp()
      drawNow()
    },
    [clamp, drawNow, openCentre],
  )

  /**
   * Bring a tile out into the open area if it is under the frame, moving the
   * map no more than it takes. The margin leaves room for the tile's own
   * marker and the tag that hangs off it.
   */
  const bringIntoView = useCallback(
    (gx: number, gy: number) => {
      const v = viewRef.current
      const { w, h } = sizeRef.current
      const { top, right, bottom, left } = insetRef.current
      const m = v.scale * 0.9
      const cx = (gx - PLAY_MIN_X + 0.5) * v.scale + v.tx
      const cy = (gy - PLAY_MIN_Y + 0.5) * v.scale + v.ty
      /* In the bottom-left quarter the floor is the corner's own, where it has one. */
      const floor = cx < w / 2 ? Math.max(bottom, cornerRef.current) : bottom
      let dx = 0
      let dy = 0
      if (cx < left + m) dx = left + m - cx
      else if (cx > w - right - m) dx = w - right - m - cx
      if (cy < top + m) dy = top + m - cy
      else if (cy > h - floor - m) dy = h - floor - m - cy
      if (!dx && !dy) return
      v.tx += dx
      v.ty += dy
      clamp()
      drawNow()
    },
    [clamp, drawNow],
  )

  /*
     How far out the zoom goes. A phone fills the whole screen with the map,
     glass and all, so its floor stays "cover the window". A wide screen
     zooms out until the whole planet sits in the open area, clear of the
     frame.
  */
  const floorFor = useCallback((w: number, h: number) => {
    if (onPhone()) return floorScale(w, h)
    const { top, right, bottom, left } = insetRef.current
    return floorScale(Math.max(1, w - left - right), Math.max(1, h - top - bottom), false)
  }, [])

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = viewRef.current
      const { w, h } = sizeRef.current
      const floor = floorFor(w, h)
      const next = Math.min(MAX_SCALE, Math.max(floor, v.scale * factor))
      if (Math.abs(next - v.scale) < 0.01) return
      v.tx = cx - ((cx - v.tx) / v.scale) * next
      v.ty = cy - ((cy - v.ty) / v.scale) * next
      v.scale = next
      clamp()
      drawNow()
    },
    [clamp, drawNow, floorFor],
  )

  // Size the backing store to the element, capping DPR: a 3x buffer on a
  // budget phone burns fill rate on pixels nobody can see.
  useLayoutEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    const apply = () => {
      const w = Math.max(1, Math.floor(host.clientWidth))
      const h = Math.max(1, Math.floor(host.clientHeight))
      /*
         Always at least the device's own resolution, capped at 2.

         This used to drop to 1 whenever `lowFx` was set, and `lowFx` catches
         essentially every phone — so the one place the map is drawn on a
         3x screen was the one place it was drawn at 1x. The markers and the
         multiplier pills are vector work rasterised into this canvas, and at
         a third of the panel's real resolution they are visibly soft.

         `lowFx` is about decoration — the loops and the glows — not about
         how sharply the game is drawn. 2x is the usual ceiling: past it the
         fill rate costs more than the eye collects.
      */
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const first = sizeRef.current.w === 0
      readFrameInsets(host)
      sizeRef.current = { w, h, dpr }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'

      const v = viewRef.current
      const floor = floorFor(w, h)
      /* Open on 'cover' so the art fills the panel rather than sitting in
         letterbox bars. On a phone that is also the floor, so it stays
         filled; on a desktop zooming out still reaches the whole planet. */
      if (first) {
        v.scale = Math.max(w / GRID_W, h / GRID_H)
        openScaleRef.current = v.scale
      }
      /* A rotation or a resize can put the current scale under the new
         floor — most obviously turning a phone from portrait to landscape. */
      if (v.scale < floor) v.scale = floor
      clamp()
      drawNow()
    }

    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(host)
    return () => ro.disconnect()
  }, [clamp, drawNow, lowFx, floorFor, readFrameInsets])

  /* The zoom, for the rail outside the canvas. */
  useEffect(() => {
    if (!zoomApi) return
    /* Zoom about the middle of what can be seen, not of the window. */
    const centre = openCentre
    zoomApi.current = {
      zoomIn: () => zoomAt(1.35, ...centre()),
      zoomOut: () => zoomAt(1 / 1.35, ...centre()),
      reset: () => {
        const open = openScaleRef.current
        if (open > 0) zoomAt(open / viewRef.current.scale, ...centre())
      },
    }
    return () => {
      zoomApi.current = null
    }
  }, [zoomApi, zoomAt, openCentre])

  /*
     A band that was covered is not any more, so anything panned into its
     slack has to come back — otherwise what was panned into it leaves a
     strip of empty background where the map used to reach.
  */
  useEffect(() => {
    clamp()
    drawNow()
  }, [insetTop, insetBottom, clamp, drawNow])

  /* A newly selected tile under the frame is brought out into the open. */
  useEffect(() => {
    if (selected) bringIntoView(selected.x, selected.y)
    // Keyed on the coordinates: `selected` is a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.x, selected?.y, bringIntoView])

  /*
     Recentre when asked, and only when asked.

     `position` is rebuilt by the caller on every render, so listing it here
     meant the effect re-ran whenever anything above it changed state — and
     selecting a tile is exactly that. Tapping the map therefore threw the
     view back onto the player, which on a phone is the whole screen moving
     out from under a finger.

     The token is the request. A ref remembers which one has been honoured,
     because `centerOn` is in the dependency list and must not be able to
     trigger a jump on its own.
  */
  const honouredRecenter = useRef(recenterToken)
  useEffect(() => {
    if (!recenterToken || honouredRecenter.current === recenterToken) return
    honouredRecenter.current = recenterToken
    const p = positionRef.current
    if (p) centerOn(p.x, p.y)
  }, [recenterToken, centerOn])

  // Pointer interaction: mouse, touch and pen all share one path.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pointers = new Map<number, { x: number; y: number }>()
    let dragged = false
    let start = { x: 0, y: 0 }
    let pinchDist = 0

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size === 1) {
        dragged = false
        start = p
      } else if (pointers.size === 2) {
        const two = [...pointers.values()]
        pinchDist = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y)
      }
    }

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const p = local(e)
      pointers.set(e.pointerId, p)

      if (pointers.size === 1) {
        if (Math.hypot(p.x - start.x, p.y - start.y) > DRAG_SLOP) dragged = true
        viewRef.current.tx += p.x - prev.x
        viewRef.current.ty += p.y - prev.y
        clamp()
        schedule()
      } else if (pointers.size === 2) {
        const two = [...pointers.values()]
        const dist = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y)
        if (pinchDist > 0) {
          zoomAt(dist / pinchDist, (two[0].x + two[1].x) / 2, (two[0].y + two[1].y) / 2)
        }
        pinchDist = dist
        dragged = true
      }
    }

    const onUp = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinchDist = 0
      if (!p || dragged || pointers.size > 0) return

      const { scale, tx, ty } = viewRef.current
      const gx = Math.floor((p.x - tx) / scale) + PLAY_MIN_X
      const gy = Math.floor((p.y - ty) / scale) + PLAY_MIN_Y
      if (gx < PLAY_MIN_X || gx > PLAY_MAX_X) return
      if (gy < PLAY_MIN_Y || gy > PLAY_MAX_Y) return
      onSelectRef.current({ x: gx, y: gy }, e.pointerType === 'touch')
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top)
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [clamp, schedule, zoomAt])

  // Keyboard: arrows move the selection, so the map isn't mouse-only.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      }
      const d = deltas[e.key]
      if (!d) return
      e.preventDefault()
      const base = selectedRef.current ?? positionRef.current ?? { x: PLAY_MIN_X, y: PLAY_MIN_Y }
      const next = {
        x: Math.min(PLAY_MAX_X, Math.max(PLAY_MIN_X, base.x + d[0])),
        y: Math.min(PLAY_MAX_Y, Math.max(PLAY_MIN_Y, base.y + d[1])),
      }
      onSelectRef.current(next)
      centerOn(next.x, next.y)
      /* Centred, an edge tile still can sit under the frame: the clamp stops short. */
      bringIntoView(next.x, next.y)
    },
    [centerOn, bringIntoView],
  )

  return (
    <div
      ref={hostRef}
      className="mapstage"
      tabIndex={0}
      role="application"
      aria-label="World map. Arrow keys move the selection."
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} className="mapstage__canvas" />

      {hotMarks.length > 0 && (
        <svg className="maphot" aria-hidden="true">
          <defs>
            {/* Light only outside the outline: a tight white-hot rim, an orange halo, a deep red haze. */}
            <filter id="maphot-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="a0" />
              <feComponentTransfer in="a0" result="a">
                <feFuncA type="linear" slope="3.4" />
              </feComponentTransfer>
              <feFlood floodColor="#fff0a0" />
              <feComposite in2="a" operator="in" result="core" />
              <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="b0" />
              <feComponentTransfer in="b0" result="b">
                <feFuncA type="linear" slope="2.8" />
              </feComponentTransfer>
              <feFlood floodColor="#ff6a14" />
              <feComposite in2="b" operator="in" result="halo" />
              <feGaussianBlur in="SourceAlpha" stdDeviation="17" result="c0" />
              <feComponentTransfer in="c0" result="c">
                <feFuncA type="linear" slope="2.4" />
              </feComponentTransfer>
              <feFlood floodColor="#e03a00" floodOpacity="0.85" />
              <feComposite in2="c" operator="in" result="wide" />
              <feMerge result="all">
                <feMergeNode in="wide" />
                <feMergeNode in="halo" />
                <feMergeNode in="core" />
                <feMergeNode in="core" />
              </feMerge>
              <feComposite in="all" in2="SourceAlpha" operator="out" />
            </filter>
            <filter id="maphot-black">
              <feFlood floodColor="#000" />
              <feComposite in2="SourceAlpha" operator="in" />
            </filter>
            <radialGradient id="maphot-pool">
              <stop offset="0" stopColor="#ffb02e" stopOpacity="0.85" />
              <stop offset="0.45" stopColor="#ff6a14" stopOpacity="0.5" />
              <stop offset="1" stopColor="#e03a00" stopOpacity="0" />
            </radialGradient>
            {/* The glow fades out at the building's foot, so it never lies over the multiplier under it. */}
            <linearGradient id="maphot-fade-ramp" gradientUnits="userSpaceOnUse" x1={0} y1={-16} x2={0} y2={2}>
              <stop offset="0" stopColor="white" />
              <stop offset="1" stopColor="black" />
            </linearGradient>
            <mask id="maphot-fade" maskUnits="userSpaceOnUse" x={-150} y={-250} width={300} height={400}>
              <rect x={-150} y={-250} width={300} height={400} fill="url(#maphot-fade-ramp)" />
            </mask>
            <radialGradient id="maphot-halo">
              <stop offset="0" stopColor="#ff8a1a" stopOpacity="0.6" />
              <stop offset="1" stopColor="#ff6a14" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="maphot-tail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffb02e" stopOpacity="0.7" />
              <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g ref={hotRef}>
            {hotMarks.map((m) => (
              <g
                key={m.id}
                transform={`translate(${m.x + 0.5} ${m.y + 0.5 + BUILDING_GROUND}) scale(${BUILDING_UNIT})`}
              >
                {/* Firelight on the ground round its foot, never on the building itself. */}
                <mask id={`maphot-off-${m.id}`} maskUnits="userSpaceOnUse" x={-150} y={-250} width={300} height={400}>
                  <rect x={-150} y={-250} width={300} height={400} fill="white" />
                  <image
                    href={m.src}
                    x={-BUILDING_VIEW.half}
                    y={-BUILDING_VIEW.above}
                    width={BUILDING_VIEW.size}
                    height={BUILDING_VIEW.size}
                    filter="url(#maphot-black)"
                  />
                </mask>
                <g mask={`url(#maphot-off-${m.id})`}>
                  <ellipse className="maphot__glow" cx={0} cy={-4} rx={78} ry={30} fill="url(#maphot-pool)" mask="url(#maphot-fade)" />
                </g>
                <image
                  className="maphot__glow"
                  href={m.src}
                  x={-BUILDING_VIEW.half}
                  y={-BUILDING_VIEW.above}
                  width={BUILDING_VIEW.size}
                  height={BUILDING_VIEW.size}
                  filter="url(#maphot-glow)"
                  mask="url(#maphot-fade)"
                />
                {HOT_EMBERS.map((e, i) => (
                  <g
                    key={i}
                    className="maphot__ember"
                    style={
                      {
                        animationDelay: `${(-i * 2.2) / HOT_EMBERS.length}s`,
                        '--dx': `${e.dx}px`,
                      } as React.CSSProperties
                    }
                  >
                    <g className="maphot__sway" style={{ animationDelay: `${-i * 0.7}s` }}>
                      <ellipse cx={e.x} cy={m.top + e.y + e.r * 2.6} rx={e.r * 0.32} ry={e.r * 2.2} fill="url(#maphot-tail)" />
                      <ellipse cx={e.x} cy={m.top + e.y} rx={e.r * 1.6} ry={e.r * 2.1} fill="url(#maphot-halo)" />
                      <ellipse
                        cx={e.x}
                        cy={m.top + e.y}
                        rx={e.r * 0.48}
                        ry={e.r * 0.95}
                        fill={e.color}
                        transform={`rotate(${e.tilt} ${e.x} ${m.top + e.y})`}
                      />
                    </g>
                  </g>
                ))}
              </g>
            ))}
          </g>
        </svg>
      )}

      {trip && (
        <svg className="maptrip" aria-hidden="true">
          <defs>
            <radialGradient id="maptrip-pool">
              <stop offset="0" stopColor="#ffd27a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
            </radialGradient>
            {/* In the trip's own tiles: everything shows but the markers' holes. */}
            <mask id="maptrip-under" maskUnits="userSpaceOnUse" x={-500} y={-500} width={1000} height={1000}>
              <rect x={-500} y={-500} width={1000} height={1000} fill="white" />
              <g ref={underRef} />
            </mask>
          </defs>
          <g ref={tripRef}>
            {/* Shadows first, so every arc flies over every shadow. */}
            {trip.legs.map((l) => (
              <g key={'s' + l.ground} className="maptrip__shadow">
                <path className="maptrip__shadow-soft" d={l.ground} />
                <path d={l.ground} />
              </g>
            ))}
            {trip.pads.map((p, i) => (
              <g
                key={p.x + ',' + p.y}
                className="maptrip__pad"
                /* The glow reaches each pad in turn over one slow cycle. */
                style={{ animationDelay: `${-9 + ((i + 1) * 9) / trip.legs.length}s` }}
              >
                <ellipse className="maptrip__pad-rim" cx={p.x} cy={p.y} rx={0.46} ry={0.17} />
                <ellipse className="maptrip__pad-inner" cx={p.x} cy={p.y} rx={0.21} ry={0.077} />
                <circle className="maptrip__pad-core" cx={p.x} cy={p.y} r={0.065} />
              </g>
            ))}
            {/* The land: a wider pad, and a ring that spreads across the ground
                from it once a cycle, when the glow arrives. Both run behind
                the markers around it. */}
            <g mask="url(#maptrip-under)">
              <ellipse className="maptrip__pad-rim" cx={trip.end.x} cy={trip.end.y} rx={1.09} ry={0.52} />
              <ellipse className="maptrip__pad-inner" cx={trip.end.x} cy={trip.end.y} rx={0.52} ry={0.25} />
              <ellipse
                key={`${trip.end.x},${trip.end.y}`}
                className="maptrip__ripple"
                cx={trip.end.x}
                cy={trip.end.y}
                rx={1.19}
                ry={0.57}
              />
            </g>
            {trip.legs.map((l) => (
              <path key={'a' + l.air} className="maptrip__air" d={l.air} />
            ))}
            {(!position || trip.start.x !== position.x || trip.start.y !== position.y) && (
              <circle
                className="maptrip__start"
                cx={trip.start.x + 0.5}
                cy={trip.start.y + 0.5}
                r={0.12}
              />
            )}
          </g>
        </svg>
      )}

      {/* "You are here". Animated in CSS so the canvas stays idle. */}
      <div ref={pinRef} className="playerpin" aria-hidden="true">
        <span className="playerpin__pulse" />
        {/* A thin ring of energy that leaves the halo now and then. */}
        <span className="playerpin__ping" />
        {/* The dash of light along the direction of travel. Idle it is
            invisible; the warp class is what gives it a life. */}
        <span className="playerpin__streak" />
        <span className="playerpin__core" />
        {/* A word as well as a mark, so nothing depends on seeing colour. */}
        <span className="playerpin__tag">You</span>
      </div>
      {/* What hangs off the player: the way in to whatever is under their feet. */}
      <div ref={hereRef} className="herepin">
        {pinSlot}
      </div>
      {/* What hangs off the selected tile: the way to it. */}
      <div ref={selRef} className="selpin">
        {selectionSlot}
      </div>
      {children}
    </div>
  )
}
