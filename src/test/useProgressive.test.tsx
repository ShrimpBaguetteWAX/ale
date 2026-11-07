import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useProgressive } from '@/components/useProgressive'

/**
 * Long lists drawn as they are scrolled.
 *
 * A wallet of a thousand fighters drew a thousand cards before the arena's
 * picker would move — five seconds of a blocked phone. These pin the three
 * promises the lists rely on: a first step only, the next step when the end
 * comes near, and the row that has to be seen always drawn.
 */

let observers: { cb: IntersectionObserverCallback; el?: Element }[] = []

class FakeObserver {
  cb: IntersectionObserverCallback
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
    observers.push(this)
  }
  observe(el: Element) {
    ;(this as { el?: Element }).el = el
  }
  disconnect() {
    observers = observers.filter((o) => o !== this)
  }
  unobserve() {}
  takeRecords() {
    return []
  }
}

/* The end of the list coming into reach. */
function reachEnd() {
  const o = observers[observers.length - 1]
  act(() => {
    o.cb([{ isIntersecting: true } as IntersectionObserverEntry], o as unknown as IntersectionObserver)
  })
}

const items = Array.from({ length: 1000 }, (_, i) => i)

function List({ atLeast, id }: { atLeast?: number; id?: string }) {
  const { shown, more } = useProgressive(items, { atLeast, id })
  return (
    <ul>
      {shown.map((n) => (
        <li key={n}>{n}</li>
      ))}
      {more}
    </ul>
  )
}

describe('useProgressive', () => {
  beforeEach(() => {
    observers = []
    vi.stubGlobal('IntersectionObserver', FakeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws the first step only, and the next when the end comes near', () => {
    const { container } = render(<List />)
    expect(container.querySelectorAll('li')).toHaveLength(48)
    reachEnd()
    expect(container.querySelectorAll('li')).toHaveLength(96)
  })

  it('stops adding, and drops the marker, once everything is drawn', () => {
    const { container } = render(<List />)
    for (let i = 0; i < 30; i++) if (container.querySelector('.progressive__more')) reachEnd()
    expect(container.querySelectorAll('li')).toHaveLength(1000)
    expect(container.querySelector('.progressive__more')).toBeNull()
  })

  it('always draws the row that has to be seen', () => {
    const { container } = render(<List atLeast={300} />)
    expect(container.querySelectorAll('li')).toHaveLength(301)
  })

  it('keeps how far a list had grown when it comes back', () => {
    const first = render(<List id="back" />)
    reachEnd()
    first.unmount()
    const again = render(<List id="back" />)
    expect(again.container.querySelectorAll('li')).toHaveLength(96)
  })

  it('draws everything where there is no observer to watch the scroll', () => {
    vi.unstubAllGlobals()
    const saved = globalThis.IntersectionObserver
    // @ts-expect-error the tests' DOM and the SSR harness have none
    delete globalThis.IntersectionObserver
    try {
      const { container } = render(<List />)
      expect(container.querySelectorAll('li')).toHaveLength(1000)
    } finally {
      if (saved) globalThis.IntersectionObserver = saved
    }
  })
})
