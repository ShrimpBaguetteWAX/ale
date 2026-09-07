import { describe, expect, it, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useModal } from '@/components/useModal'

/**
 * What an overlay owes the player, asserted rather than assumed.
 *
 * Written by hand nine times before this, and differently nine times: four
 * overlays never locked the page behind them, two could not be closed with
 * Escape at all, and none of the nine kept focus inside. A hook is only worth
 * having if it is the same every time, which is what these check.
 */

function Dialog({ onClose }: { onClose: () => void }) {
  const panel = useModal(onClose)
  return (
    <div>
      <div ref={panel}>
        <button type="button">first</button>
        <button type="button" disabled>
          disabled
        </button>
        <button type="button">last</button>
      </div>
    </div>
  )
}

beforeEach(() => {
  document.body.style.overflow = ''
})

describe('useModal', () => {
  it('closes on Escape', () => {
    let closed = 0
    render(<Dialog onClose={() => closed++} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closed).toBe(1)
  })

  it('holds the page still while it is open', () => {
    const { unmount } = render(<Dialog onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('restores whatever the page was already doing, rather than clearing it', () => {
    /* A screen with its own reason to stop the page scrolling should still
       be doing so once an overlay above it closes. */
    document.body.style.overflow = 'clip'

    const { unmount } = render(<Dialog onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('clip')
  })

  it('moves focus to the first thing that can take it', () => {
    const { getByText } = render(<Dialog onClose={() => {}} />)
    expect(document.activeElement).toBe(getByText('first'))
  })

  it('gives focus back to whatever opened it', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const { unmount } = render(<Dialog onClose={() => {}} />)
    unmount()

    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('keeps Tab inside, wrapping at the end', () => {
    const { getByText } = render(<Dialog onClose={() => {}} />)
    const last = getByText('last')
    last.focus()

    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(getByText('first'))
  })

  it('wraps backwards too', () => {
    const { getByText } = render(<Dialog onClose={() => {}} />)
    getByText('first').focus()

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(getByText('last'))
  })

  it('never traps focus onto a control that cannot be used', () => {
    /*
       A confirm dialog's action button is disabled until the box is ticked.
       Wrapping onto it would leave the player pressing Enter on nothing.
    */
    const { getByText } = render(<Dialog onClose={() => {}} />)
    getByText('last').focus()
    fireEvent.keyDown(window, { key: 'Tab' })

    expect(document.activeElement).not.toBe(getByText('disabled'))
  })
})
