import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { TeamDock, useScrolledAway } from '@/fight/TeamDock'

/**
 * The team dock comes in when the matchup scrolls away and goes when it is
 * back, and each change to the chance shows for a moment as +n% or −n%.
 */
let fire: ((visible: boolean) => void) | undefined
class FakeObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    fire = (visible) => cb([{ isIntersecting: visible }])
  }
  observe() {}
  disconnect() {}
}

afterEach(() => {
  vi.unstubAllGlobals()
  fire = undefined
})

function Screen({ winRate }: { winRate: number }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const away = useScrolledAway(el)
  return (
    <>
      <section ref={setEl}>matchup</section>
      <TeamDock shown={away} slots={[null, null, null, null, null]} share={winRate} winRate={winRate} against="The dungeon" action={<button>Start Fight</button>} />
    </>
  )
}

describe('the team dock', () => {
  it('comes in when the matchup scrolls away, and goes when it is back', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const { container } = render(<Screen winRate={0.6} />)
    const dock = container.querySelector('.teamdock')!
    expect(dock.classList.contains('is-shown')).toBe(false)
    act(() => fire!(false))
    expect(dock.classList.contains('is-shown')).toBe(true)
    act(() => fire!(true))
    expect(dock.classList.contains('is-shown')).toBe(false)
  })

  it('shows the chance, and each change to it as + or −', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const { rerender } = render(<Screen winRate={0.6} />)
    expect(screen.getByText('60')).toBeTruthy()
    rerender(<Screen winRate={0.72} />)
    /* The figure counts to the new chance rather than jumping to it. */
    expect(screen.queryByText('72')).toBeNull()
    expect(await screen.findByText('72', undefined, { timeout: 2000 })).toBeTruthy()
    expect(document.querySelector('.teamdock__delta')!.textContent).toBe('+12%')
    rerender(<Screen winRate={0.65} />)
    expect(document.querySelector('.teamdock__delta')!.textContent).toBe('−7%')
  })
})
