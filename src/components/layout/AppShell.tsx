import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useModal } from '@/components/useModal'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { NetworkStatus } from '../NetworkStatus'
import { useChores } from '@/chores/useChores'
import { CHORE_CHECKS } from '@/chores/checks'
import { ResourceStrip } from '../ResourceStrip'
import { NAV_ITEMS, TABBAR_ORDER, type NavItem } from './nav'
import { asset } from '@/assets'
import { planetMapSrc } from '@/map/terrain'
import { useMapPicture } from '@/map/snapshot'

/**
 * A menu entry’s picture, or the space where one will go.
 *
 * An entry the artwork does not cover yet keeps the column rather than
 * losing it: without the placeholder that row's label starts where every
 * other row's icon does, and the rail stops looking like a list.
 */
function Icon({ item }: { item: NavItem }) {
  if (!item.icon) return <span className="navlink__icon navlink__icon--none" aria-hidden="true" />
  return (
    <img
      className="navlink__icon"
      src={item.icon}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      decoding="async"
    />
  )
}

/** The same, for the sheet and the tab bar, which size their own. */
function MenuArt({ item, size }: { item: NavItem; size: number }) {
  if (!item.icon) {
    return (
      <span
        className="navlink__icon--none"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    )
  }
  return <img src={item.icon} alt="" width={size} height={size} loading="lazy" />
}

/**
 * What every other screen sits in front of on a desktop: the map as the
 * player left it, or — straight into a page, before the map was ever open —
 * the planet's own artwork. Hidden on phones, which keep the game's backdrop.
 */
function MapBackdrop({ planet }: { planet?: string }) {
  const picture = useMapPicture()
  const ref = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas || !picture) return
    canvas.width = picture.width
    canvas.height = picture.height
    canvas.getContext('2d')?.drawImage(picture, 0, 0)
  }, [picture])

  return (
    <div
      className="shell__map"
      style={planet ? { backgroundImage: `url('${planetMapSrc(planet)}')` } : undefined}
    >
      {picture && <canvas ref={ref} />}
    </div>
  )
}

/* Desktop only, and never for a player who asked for less motion. */
function calm(): boolean {
  return (
    !window.matchMedia('(min-width: 1024px)').matches ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.fx === 'low'
  )
}

const SHEET_IN = { duration: 460, easing: 'cubic-bezier(.16, 1, .3, 1)' }
const SHEET_OUT = { duration: 320, easing: 'cubic-bezier(.4, 0, 1, 1)' }

/** Bottom-sheet menu holding everything that doesn't fit the tab bar. */
function MoreSheet({ items, onClose }: { items: NavItem[]; onClose: () => void }) {
  const panel = useModal(onClose)

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="More sections"
      onClick={onClose}
    >
      <div
        className="sheet__panel"
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row">
          <span className="panel__title">All sections</span>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="sheet__grid">
          {items.map((item) =>
            item.soon ? (
              <span className="sheet__item sheet__item--soon" key={item.to}>
                <MenuArt item={item} size={34} />
                {item.label}
              </span>
            ) : (
              <NavLink className="sheet__item" key={item.to} to={item.to} onClick={onClose}>
                <MenuArt item={item} size={34} />
                {item.label}
              </NavLink>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  const player = useGame((s) => s.player)
  const account = useGame((s) => s.account)
  const [sheetOpen, setSheetOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isMap = location.pathname === '/map'

  /*
     The page's glass, and how pages come and go on a desktop.

     From the map, the page and its glass arrive from the right as one sheet
     and stop against the menu. Between two pages the glass stays where it is
     and only the page changes, fading in. Back to the map, the sheet leaves
     the way it came: React has already taken the page out by then, but the
     node it took out still holds the page, so it goes into a layer of its own
     for the slide and is dropped at the end. Only ever a few hundred
     milliseconds of motion, and no transform is left behind on the page, so
     its own dialogs still cover the window.
  */
  const glassRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const leavingRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const pageBox = useRef({ left: 0, top: 0, width: 0 })
  const scrollY = useRef(0)
  const lastPath = useRef(location.pathname)
  const leaving = useRef<Animation | null>(null)

  useEffect(() => {
    const onScroll = () => {
      scrollY.current = window.scrollY
    }
    const measure = () => {
      const page = pageRef.current
      if (!page?.isConnected) return
      const r = page.getBoundingClientRect()
      pageBox.current = { left: r.left, top: r.top + window.scrollY, width: r.width }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [])

  useLayoutEffect(() => {
    const from = lastPath.current
    const to = location.pathname
    lastPath.current = to

    const page = pageRef.current
    if (to !== '/map' && page?.isConnected) {
      const r = page.getBoundingClientRect()
      pageBox.current = { left: r.left, top: r.top + window.scrollY, width: r.width }
    }
    if (from === to || calm()) return

    leaving.current?.finish()

    if (from === '/map') {
      const enter = [{ transform: 'translateX(100%)' }, { transform: 'none' }]
      glassRef.current?.animate(enter, SHEET_IN)
      mainRef.current?.animate(enter, SHEET_IN)
    } else if (to === '/map') {
      const host = leavingRef.current
      if (!host || !page || page.isConnected) return
      const box = pageBox.current
      Object.assign(page.style, {
        position: 'absolute',
        margin: '0',
        left: `${box.left - host.getBoundingClientRect().left}px`,
        top: `${box.top - scrollY.current}px`,
        width: `${box.width}px`,
      })
      host.replaceChildren(page)
      host.classList.add('shell__leaving--on')
      const out = host.animate([{ transform: 'none' }, { transform: 'translateX(100%)' }], SHEET_OUT)
      leaving.current = out
      out.onfinish = () => {
        host.classList.remove('shell__leaving--on')
        host.replaceChildren()
        if (leaving.current === out) leaving.current = null
      }
    } else {
      page?.animate(
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 240, delay: 40, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' },
      )
    }
  }, [location.pathname])

  // Any navigation closes the sheet, including the browser back button.
  useEffect(() => setSheetOpen(false), [location.pathname])

  const closeSheet = useCallback(() => setSheetOpen(false), [])

  /* Ordered for the thumb, not for the rail. See TABBAR_ORDER. */
  const primary = NAV_ITEMS.filter((i) => i.primary).sort(
    (x, y) => TABBAR_ORDER.indexOf(x.to) - TABBAR_ORDER.indexOf(y.to),
  )
  const secondary = NAV_ITEMS.filter((i) => !i.primary)

  /*
     One dot per section with something waiting in it. The scheduler behind
     this runs at most one request every few seconds across all of them — see
     useChores.
  */
  const chores = useChores(player, location.pathname)
  const choreFor = (to: string) => CHORE_CHECKS.find((c) => c.to === to)

  return (
    <div
      className={isMap ? 'shell shell--flush' : 'shell'}
      style={{ '--shell-art': `url('${asset('/assets/background/bg-menu.jpeg')}')` } as React.CSSProperties}
    >
      <div className="shell__bg" aria-hidden="true">
        <MapBackdrop planet={player?.planet} />
      </div>
      <div className="shell__glass" ref={glassRef} aria-hidden="true" />

      <nav className="rail" aria-label="Game menu">
        {/*
          The logo goes home, which on this game means the map. It used to
          open the briefing, which is a screen rather than a destination and
          now has its own entry at the head of the menu below.
        */}
        <div className="rail__brand">
          <NavLink to="/map" aria-label="World map">
            <img src={asset("/assets/logo.png")} alt="Alien Legends" width={337} height={152} />
          </NavLink>
        </div>

        {/*
          The balances, in the menu: desktop has no top bar, and they belong
          on every screen. The phone keeps them in its top bar.
        */}
        {player && (
          <div className="rail__wallet">
            <ResourceStrip player={player} />
          </div>
        )}

        {NAV_ITEMS.map((item) =>
          item.soon ? (
            <span className="navlink navlink--soon" key={item.to} aria-disabled="true">
              <span className="navlink__inner">
                <span className="navlink__socket">
                  <Icon item={item} />
                </span>
                <span className="navlink__label">{item.label}</span>
                <span className="navlink__badge">SOON</span>
              </span>
            </span>
          ) : (
            <NavLink
              className="navlink"
              key={item.to}
              to={item.to}
              onClick={(e) => {
                /* The open screen's entry closes it: back to the map. */
                if (item.to !== '/map' && location.pathname === item.to) {
                  e.preventDefault()
                  navigate('/map')
                }
              }}
            >
              <span className="navlink__inner">
                <span className="navlink__socket">
                  <Icon item={item} />
                </span>
                <span className="navlink__label">{item.label}</span>
                {chores[choreFor(item.to)?.key as never] && (
                  <span
                    className="navlink__dot"
                    title={choreFor(item.to)?.hint}
                    aria-label={choreFor(item.to)?.hint}
                  />
                )}
              </span>
            </NavLink>
          ),
        )}
      </nav>

      <header className="topbar">
        {/*
          A way home from the top-left corner, which is where a phone player
          reaches for one. Desktop hides the wordmark entirely and navigates
          from the rail, so this only ever matters on a narrow screen.
        */}
        <NavLink className="topbar__home" to="/map" aria-label="World map">
          <img className="topbar__logo" src={asset("/assets/logo.png")} alt="Alien Legends" />
        </NavLink>
        {player && <ResourceStrip player={player} />}
        <span className="spacer" />
        <NetworkStatus />
      </header>

      {/*
        The map is the one screen that should reach the edges of the frame,
        so it opts out of the page gutter and the reading-width cap.
      */}
      <main className={isMap ? 'main main--flush' : 'main'} ref={mainRef}>
        {isMap ? (
          <Outlet />
        ) : (
          <div
            className="main__inner"
            ref={(node) => {
              /* Kept after React lets go of it: see the note on leaving. */
              if (node) pageRef.current = node
            }}
          >
            <Outlet />
          </div>
        )}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {primary.map((item) =>
          item.soon ? (
            <span className="tab" key={item.to} aria-disabled="true" style={{ opacity: 0.4 }}>
              <MenuArt item={item} size={26} />
              {item.label}
            </span>
          ) : (
            <NavLink className="tab" key={item.to} to={item.to}>
              <MenuArt item={item} size={26} />
              {item.label}
              {chores[choreFor(item.to)?.key as never] && (
                <span className="tab__dot" aria-label={choreFor(item.to)?.hint} />
              )}
            </NavLink>
          ),
        )}

        <button
          type="button"
          className="tab"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
          More
        </button>
      </nav>

      <div className="shell__leaving" ref={leavingRef} aria-hidden="true" />

      {sheetOpen && <MoreSheet items={secondary} onClose={closeSheet} />}

      <span className="sr-only">Signed in as {account}</span>
    </div>
  )
}
