import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FoldingPanel } from '@/fight/setup'

/**
 * A control that has to outlive the fold.
 *
 * The Loadout panel is shut by default, and its auto-pick lived inside it — so
 * reaching the thing that fills the slots meant first opening the panel to
 * look at the empty slots. On a phone it was lifted out above the panel; on a
 * desktop there is room for it on the heading itself, which is the one part of
 * a shut panel still on the screen.
 *
 * The heading is a button, and a button cannot contain another one, so this is
 * a real change of shape rather than one more child. What has to keep working
 * is what these pin: the control does not fold the panel out from under the
 * press, and both halves of the heading still do.
 */

const Panel = ({ aside, open = false, onToggle = () => {} }: {
  aside?: React.ReactNode
  open?: boolean
  onToggle?: () => void
}) => (
  <FoldingPanel title="Loadout" summary="no crew or weapon chosen" open={open} onToggle={onToggle} aside={aside}>
    <p>the slots</p>
  </FoldingPanel>
)

describe('FoldingPanel with a control on its heading', () => {
  it('shows the control whether the panel is open or shut', () => {
    /* The entire point: shut is the state it has to survive. */
    const shut = render(<Panel aside={<button type="button">Auto-pick cards</button>} />)
    expect(screen.getByText('Auto-pick cards')).toBeTruthy()
    expect(screen.queryByText('the slots')).toBeNull()
    shut.unmount()

    render(<Panel aside={<button type="button">Auto-pick cards</button>} open />)
    expect(screen.getByText('Auto-pick cards')).toBeTruthy()
    expect(screen.getByText('the slots')).toBeTruthy()
  })

  it('does not fold the panel when the control is pressed', () => {
    /*
       The failure this shape exists to avoid. Nested inside the heading the
       press would toggle on the way out, so the panel would shut itself the
       moment you used the thing on it.
    */
    const onToggle = vi.fn()
    render(
      <Panel
        aside={<button type="button">Auto-pick cards</button>}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByText('Auto-pick cards'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('still folds from the title and from the chevron', () => {
    const onToggle = vi.fn()
    render(
      <Panel aside={<button type="button">Auto-pick cards</button>} onToggle={onToggle} />,
    )

    fireEvent.click(screen.getByText('Loadout'))
    expect(onToggle).toHaveBeenCalledTimes(1)

    /* The chevron is the other half, and it is the only control on the row
       with no text — so it has to carry a name of its own. */
    fireEvent.click(screen.getByRole('button', { name: /expand loadout/i }))
    expect(onToggle).toHaveBeenCalledTimes(2)
  })

  it('leaves a panel with no control exactly as it was', () => {
    /*
       Every other folding panel passes no aside, and must keep the single
       full-width heading where the whole bar is the target.
    */
    const { container } = render(<Panel />)

    expect(container.querySelector('.panel__foldrow')).toBeNull()
    const folds = container.querySelectorAll('.panel__fold')
    expect(folds).toHaveLength(1)
    expect(folds[0].classList.contains('panel__title')).toBe(true)
    expect(folds[0].querySelector('.panel__chev')).toBeTruthy()
  })
})
