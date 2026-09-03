import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  PLAY_MAX_X,
  PLAY_MAX_Y,
  PLAY_MIN_X,
  PLAY_MIN_Y,
  PORTAL_EFFECTS,
} from '@/chain/config'
import type { Land } from '@/chain/types'
import {
  MARKER_SRC,
  buildingMarker,
  formatBoost,
  liveBoostPercent,
  type MarkerKey,
} from './terrain'

export interface MapCanvasProps {
  /** Planet artwork, 2000x1000 — exactly 50px per tile over the 40x20 grid. */
  mapSrc: string
  lands: Land[]
  position: { x: number; y: number } | null
  selected: { x: number; y: number } | null
  onSelect: (coords: { x: number; y: number }) => void
  /** Bumping this recentres the view on the player. */
  recenterToken?: number
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
  /** Floating UI rendered over the map: tile inspector, legend. */
  children?: React.ReactNode
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
/** Below this the labels crowd into each other; see `showLabels`. */
const LABEL_SCALE = 34

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

  ctx.fillStyle = locked ? 'rgba(5,16,30,0.86)' : 'rgba(5,16,30,0.72)'
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.62, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = rim
  ctx.lineWidth = Math.max(1, scale * (current ? 0.06 : 0.035))
  ctx.stroke()

  if (locked) ctx.globalAlpha = 0.35

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
  lowFx = false,
  boostDecayPerHour = 0,
  lockedLands,
  tavernLands,
  currentTavernLand,
  children,
}: MapCanvasProps) {
  const decayRef = useRef(boostDecayPerHour)
  decayRef.current = boostDecayPerHour
  const lockedRef = useRef(lockedLands)
  lockedRef.current = lockedLands
  const tavernsRef = useRef(tavernLands)
  tavernsRef.current = tavernLands
  const currentTavernRef = useRef(currentTavernLand)
  currentTavernRef.current = currentTavernLand
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View>({ scale: 18, tx: 0, ty: 0 })
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const frameRef = useRef(0)
  const indexRef = useRef(new Map<string, Land>())
  const imgRef = useRef<HTMLImageElement | null>(null)
  const markersRef = useRef(new Map<MarkerKey, HTMLImageElement>())
  const pinRef = useRef<HTMLDivElement>(null)

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
    if (!visible) return
    pin.style.transform = 'translate(' + cx + 'px, ' + cy + 'px)'
    pin.style.setProperty('--pin-size', Math.max(18, Math.min(scale * 0.8, 52)) + 'px')
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
    }

    // Visible tile range, so overlays never iterate off-screen lands.
    const x0 = Math.max(PLAY_MIN_X, Math.floor(-tx / scale) + PLAY_MIN_X)
    const x1 = Math.min(PLAY_MAX_X, Math.ceil((w - tx) / scale) + PLAY_MIN_X)
    const y0 = Math.max(PLAY_MIN_Y, Math.floor(-ty / scale) + PLAY_MIN_Y)
    const y1 = Math.min(PLAY_MAX_Y, Math.ceil((h - ty) / scale) + PLAY_MIN_Y)

    const showGrid = scale >= 22
    const showMarkers = scale >= 16
    /*
       Labels need room; below LABEL_SCALE they overlap into noise.

       Except that on a phone the player cannot zoom past the floor, and the
       floor can sit under that threshold — which left the multipliers
       invisible at the only zoom level a phone ever opens at. So there the
       cut-off drops to the floor: whatever the furthest-out view is, it still
       says what each building pays. A wide screen keeps the original
       threshold, because it can zoom out far enough for the labels to
       genuinely collide.
    */
    const fill = onPhone()
    const floor = floorScale(w, h, fill)
    const showLabels = scale >= (fill ? Math.min(LABEL_SCALE, floor) : LABEL_SCALE)

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
          const fromLand = buildingMarker(String(land.buildings[0].building_name))
          marker = fromLand === 'tavern' ? null : fromLand
        }

        // A dungeon the player has already run today is spent until the
        // daily reset, so it is drawn locked.
        const locked = marker === 'dungeon' && !!lockedRef.current?.has(land.land_id)
        // The tavern they are standing in right now.
        const current = marker === 'tavern' && land.land_id === currentTavernRef.current

        if (marker) {
          if (showMarkers) {
            drawMarker(
              ctx,
              markersRef.current.get(marker),
              marker,
              px,
              py,
              scale,
              locked,
              current,
            )

            if (showLabels) {
              const labelY = py + scale * 0.86
              if (marker === 'portal') {
                const dest = PORTAL_EFFECTS[land.special_effect]
                if (dest) drawLabel(ctx, dest, px + scale / 2, labelY, scale, '#ff01ff')
              } else if (current) {
                drawLabel(ctx, 'Current', px + scale / 2, labelY, scale, '#0ed4a8')
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
        }
      }
    }

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
      else pin.style.display = 'none'
    }
  }, [placePin])

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

  // Marker artwork is four small SVGs; load them once and repaint as they
  // arrive so the map is never waiting on all of them.
  useEffect(() => {
    let alive = true
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
  }, [selected, position, lowFx, lockedLands, tavernLands, currentTavernLand, drawNow])

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
  const clamp = useCallback(() => {
    const v = viewRef.current
    const { w, h } = sizeRef.current
    const gridW = GRID_W * v.scale
    const gridH = GRID_H * v.scale
    v.tx = Math.min(0, Math.max(w - gridW, v.tx))
    v.ty = Math.min(0, Math.max(h - gridH, v.ty))
    if (gridW < w) v.tx = (w - gridW) / 2
    if (gridH < h) v.ty = (h - gridH) / 2
  }, [])

  const centerOn = useCallback(
    (gx: number, gy: number) => {
      const v = viewRef.current
      const { w, h } = sizeRef.current
      v.tx = w / 2 - (gx - PLAY_MIN_X + 0.5) * v.scale
      v.ty = h / 2 - (gy - PLAY_MIN_Y + 0.5) * v.scale
      clamp()
      drawNow()
    },
    [clamp, drawNow],
  )

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = viewRef.current
      const { w, h } = sizeRef.current
      const floor = floorScale(w, h)
      const next = Math.min(MAX_SCALE, Math.max(floor, v.scale * factor))
      if (Math.abs(next - v.scale) < 0.01) return
      v.tx = cx - ((cx - v.tx) / v.scale) * next
      v.ty = cy - ((cy - v.ty) / v.scale) * next
      v.scale = next
      clamp()
      drawNow()
    },
    [clamp, drawNow],
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
      const dpr = Math.min(window.devicePixelRatio || 1, lowFx ? 1 : 2)
      const first = sizeRef.current.w === 0
      sizeRef.current = { w, h, dpr }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'

      const v = viewRef.current
      const floor = floorScale(w, h)
      /* Open on 'cover' so the art fills the panel rather than sitting in
         letterbox bars. On a phone that is also the floor, so it stays
         filled; on a desktop zooming out still reaches the whole planet. */
      if (first) v.scale = Math.max(w / GRID_W, h / GRID_H)
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
  }, [clamp, drawNow, lowFx])

  useEffect(() => {
    if (recenterToken && position) centerOn(position.x, position.y)
  }, [recenterToken, position, centerOn])

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
      onSelectRef.current({ x: gx, y: gy })
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
    },
    [centerOn],
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

      {/* "You are here". Animated in CSS so the canvas stays idle. */}
      <div ref={pinRef} className="playerpin" aria-hidden="true">
        <span className="playerpin__pulse" />
        {/* The dash of light along the direction of travel. Idle it is
            invisible; the warp class is what gives it a life. */}
        <span className="playerpin__streak" />
        <span className="playerpin__core" />
      </div>
      {children}
      <div className="mapstage__zoom">
        <button
          type="button"
          className="zoombtn"
          aria-label="Zoom in"
          onClick={() => zoomAt(1.35, sizeRef.current.w / 2, sizeRef.current.h / 2)}
        >
          +
        </button>
        <button
          type="button"
          className="zoombtn"
          aria-label="Zoom out"
          onClick={() => zoomAt(1 / 1.35, sizeRef.current.w / 2, sizeRef.current.h / 2)}
        >
          &minus;
        </button>
      </div>
    </div>
  )
}
