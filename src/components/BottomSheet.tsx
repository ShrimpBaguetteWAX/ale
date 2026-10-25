import type { ReactNode } from 'react'
import { useModal } from '@/components/useModal'
import { useSwipeToClose } from '@/components/useSwipeToClose'

/**
 * A phone's bottom sheet: rises over the screen, a grip and × on its head,
 * a body that scrolls on its own, and an optional foot that stays put.
 * Escape, a tap on the shade, × or a swipe down close it.
 *
 * Styled by the `.rsheet` rules, in the quiet palette the phone screens use.
 *
 * `side` slides the same sheet in from the right instead, full height —
 * a desktop's version of it, over a board that stays in view beside it.
 */
export function BottomSheet({
  title,
  onClose,
  children,
  foot,
  side = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  foot?: ReactNode
  side?: boolean
}) {
  const panel = useModal(onClose)
  const { grip } = useSwipeToClose(onClose, panel)
  return (
    <div className={side ? 'rsheet rsheet--side' : 'rsheet'} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="rsheet__panel" ref={panel} onClick={(e) => e.stopPropagation()}>
        <div className="rsheet__head" {...grip}>
          <span className="rsheet__grip" aria-hidden="true" />
          <h2 className="rsheet__title">{title}</h2>
          <button type="button" className="rsheet__x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="rsheet__body">{children}</div>
        {foot && <div className="rsheet__foot">{foot}</div>}
      </div>
    </div>
  )
}
