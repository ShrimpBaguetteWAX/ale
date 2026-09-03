import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { NetworkStatus } from '../NetworkStatus'
import { useChores } from '@/chores/useChores'
import { CHORE_CHECKS } from '@/chores/checks'
import { ResourceStrip } from '../ResourceStrip'
import { NAV_ITEMS, TABBAR_ORDER, type NavItem } from './nav'
import { asset } from '@/assets'

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

/** Bottom-sheet menu holding everything that doesn't fit the tab bar. */
function MoreSheet({ items, onClose }: { items: NavItem[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Stop the page behind the sheet from scrolling with it.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="More sections"
      onClick={onClose}
    >
      <div className="sheet__panel" onClick={(e) => e.stopPropagation()}>
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
  const isMap = location.pathname === '/map'

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
      className="shell"
      style={{ '--shell-art': `url('${asset('/assets/background/bg-menu.jpeg')}')` } as React.CSSProperties}
    >
      <div className="shell__bg" aria-hidden="true" />

      <nav className="rail" aria-label="Game menu">
        <div className="rail__brand">
          <NavLink to="/map">
            <img src={asset("/assets/logo.png")} alt="Alien Legends" width={337} height={152} />
          </NavLink>
        </div>

        {/*
          The rail leans like the rest of the game, which means the contents
          have to lean back — and a bare text node cannot be counter-skewed.
          Hence the inner wrapper: it is load-bearing, not decoration.
        */}
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
            <NavLink className="navlink" key={item.to} to={item.to}>
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
      <main className={isMap ? 'main main--flush' : 'main'}>
        {isMap ? (
          <Outlet />
        ) : (
          <div className="main__inner">
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

      {sheetOpen && <MoreSheet items={secondary} onClose={closeSheet} />}

      <span className="sr-only">Signed in as {account}</span>
    </div>
  )
}
