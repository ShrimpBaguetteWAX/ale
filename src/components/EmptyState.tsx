import type { ReactNode } from 'react'

/**
 * The one empty state: a line saying why there is nothing here and, where
 * there is one, the next step (a link or a button) under it. Lists that are
 * still loading show their skeleton rows instead; a whole page loading shows
 * the bar (`Loading`).
 */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="emptystate">
      <p>{children}</p>
      {action && <div className="emptystate__acts">{action}</div>}
    </div>
  )
}
