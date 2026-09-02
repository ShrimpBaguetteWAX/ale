import { Link } from 'react-router-dom'
import { NAV_ITEMS, SECTION_BLURBS } from '@/components/layout/nav'

/**
 * Placeholder for a system whose contracts are already deployed but whose
 * screen isn't built yet. Named explicitly rather than hidden from the menu,
 * so the shape of the finished game stays visible.
 */
export default function ComingSoon({ title }: { title: string }) {
  const item = NAV_ITEMS.find((i) => i.label === title)

  return (
    <section
      className="panel"
      style={{ textAlign: 'center', padding: 'var(--sp-16) var(--sp-6)' }}
    >
      {item && (
        <img
          src={item.icon}
          alt=""
          width={64}
          height={64}
          style={{ margin: '0 auto var(--sp-4)', opacity: 0.55 }}
        />
      )}
      <span className="tag" style={{ marginBottom: 'var(--sp-4)' }}>
        In development
      </span>
      <h1 style={{ fontSize: 'var(--fs-2xl)' }}>{title}</h1>
      <p className="muted" style={{ maxWidth: '46ch', margin: 'var(--sp-3) auto 0' }}>
        {SECTION_BLURBS[title] ?? 'This part of the game is still being built.'}
      </p>
      <div style={{ marginTop: 'var(--sp-6)' }}>
        <Link className="btn btn--ghost" to="/map">
          Back to the map
        </Link>
      </div>
    </section>
  )
}
