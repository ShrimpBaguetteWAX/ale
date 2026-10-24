import { create } from 'zustand'

/** One message: something that just went through. */
export interface Toast {
  id: number
  message: string
}

interface ToastState {
  toasts: Toast[]
  dismiss: (id: number) => void
}

let next = 1

/**
 * What the game just did for the player, as toasts at the top of the screen.
 *
 * These used to be a green banner each screen drew above its own content —
 * "Rewards claimed.", "Recruit hired." — which pushed the page down while it
 * was there and stayed until the next action cleared it. A toast says the
 * same thing over the page, and goes by itself.
 *
 * Errors are not toasts: something that went wrong stays on the screen it
 * went wrong on until the player has read it.
 */
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Say something went through. The same message twice in a row is one toast. */
export function showToast(message: string) {
  if (!message) return
  useToasts.setState((s) => {
    const rest = s.toasts.filter((t) => t.message !== message)
    /* Three at most: the oldest goes first. */
    return { toasts: [...rest, { id: next++, message }].slice(-3) }
  })
}
