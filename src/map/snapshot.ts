import { useSyncExternalStore } from 'react'

/**
 * The map as the player left it.
 *
 * On a desktop every other screen opens on glass in front of the map. The
 * map itself does not stay mounted behind them — it would keep polling and
 * keep animating under a blur nobody can see through — so when it goes, it
 * leaves a picture of itself: one copy of its canvas, made in the same
 * frame, which the shell paints behind the page. Nothing is encoded or
 * fetched; it is a canvas-to-canvas copy, and the next visit replaces it.
 *
 * Phones show it as well, under glass that runs to the screen's edges (see
 * app.css); the copy is the same, only the glass differs.
 */

let picture: HTMLCanvasElement | null = null
const listeners = new Set<() => void>()

/* Under a 7px blur nobody can tell a half-size copy from the real thing. */
const MAX_W = 1600

export function keepMapPicture(from: HTMLCanvasElement | null): void {
  if (!from || !from.width || !from.height) return
  const scale = Math.min(1, MAX_W / from.width)
  const copy = document.createElement('canvas')
  copy.width = Math.round(from.width * scale)
  copy.height = Math.round(from.height * scale)
  const ctx = copy.getContext('2d')
  if (!ctx) return
  ctx.drawImage(from, 0, 0, copy.width, copy.height)
  picture = copy
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useMapPicture(): HTMLCanvasElement | null {
  return useSyncExternalStore(subscribe, () => picture)
}
