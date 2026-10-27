import type { ReactNode } from 'react'
import { useModal } from '@/components/useModal'
import { useSwipeToClose } from '@/components/useSwipeToClose'
import { usePhone } from '@/components/usePhone'

/** The edge each rarity lights a card in, as the market rows colour it. */
const RARITY_EDGE: Record<string, string> = {
  abundant: '#c8d2e0',
  common: '#7fd0a0',
  rare: '#4aa8ff',
  epic: '#b06bff',
  legendary: '#ffb23e',
  mythical: '#ff4f8b',
}

export function rarityEdge(rarity: string | undefined): string | undefined {
  return rarity ? RARITY_EDGE[rarity.toLowerCase()] : undefined
}

/** A rarity, a shine and how many are owned, as the showcase's chips. */
export function CardTags({ rarity, shine, owned, extra }: { rarity?: string; shine?: string; owned?: number; extra?: string }) {
  const s = shine?.toLowerCase()
  return (
    <>
      {rarity && <span className="bshow__tag bshow__tag--rarity">{rarity}</span>}
      {shine && (
        <span className={`bshow__tag bshow__tag--shine${s === 'stone' ? ' is-stone' : s === 'gold' ? ' is-gold' : ' is-fx'}`}>
          {shine}
        </span>
      )}
      {extra && <span className="bshow__tag">{extra}</span>}
      {owned ? <span className="bshow__tag bshow__tag--owned">Owned{owned > 1 ? ` ×${owned}` : ''}</span> : null}
    </>
  )
}

export interface ShowcaseTile {
  label: string
  icon?: string
  value: ReactNode
  good?: boolean
}

const SHIELD = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
)

/**
 * The shop's purchase dialog: the thing bought is the hero — large, lit in
 * its rarity — with what it does as tiles, then the price and the button on
 * one bar. Shared by the packs, the NFT Market and the Outpost, so every
 * purchase reads the same way.
 *
 * Centred over the shop on a desktop; on a phone it rises as a bottom sheet,
 * which a swipe down on its head closes, as the game's other sheets do.
 */
export function Showcase({
  label,
  art,
  pack,
  edge,
  name,
  tags,
  tiles,
  line,
  price,
  priceIcon,
  leaves,
  fine,
  alert,
  action,
  onCancel,
}: {
  label: string
  art?: string
  /** A pack's art is a square scene, not a card: no frame. */
  pack?: boolean
  edge?: string
  name: string
  tags?: ReactNode
  tiles?: ShowcaseTile[]
  /** One line under the tiles: what this adds, or what a bonus is measured against. */
  line?: ReactNode
  price: ReactNode
  priceIcon?: string
  leaves?: string
  fine: ReactNode
  alert?: ReactNode
  action: { label: ReactNode; onClick: () => void; disabled?: boolean; gold?: boolean }
  onCancel: () => void
}) {
  const phone = usePhone()
  const panel = useModal(onCancel)
  const { grip } = useSwipeToClose(onCancel, panel)

  return (
    <div
      className={phone ? 'rsheet bshow-sheet' : 'confirm'}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onCancel}
    >
      <div
        className={phone ? 'rsheet__panel bshow' : 'confirm__panel bshow'}
        ref={panel}
        style={edge ? ({ '--edge': edge } as React.CSSProperties) : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bshow__hero" {...(phone ? grip : {})}>
          {phone && <span className="rsheet__grip" aria-hidden="true" />}
          <button type="button" className="bshow__x" aria-label="Close" onClick={onCancel}>
            ✕
          </button>
          {art && <img className={`bshow__art${pack ? ' is-pack' : ''}`} src={art} alt="" />}
          <h2 className="bshow__name">{name}</h2>
          {tags && <div className="bshow__tags">{tags}</div>}
        </div>
        <div className="bshow__body">
          {tiles && tiles.length > 0 && (
            <div className="bshow__tiles">
              {tiles.map((t) => (
                <span className="bshow__tile" key={t.label}>
                  <small>
                    {t.icon && <img src={t.icon} alt="" />}
                    {t.label}
                  </small>
                  <b className={t.good ? 'is-good' : undefined}>{t.value}</b>
                </span>
              ))}
            </div>
          )}
          {line && <div className="bshow__line">{line}</div>}
          {alert}
          <div className="bshow__pay">
            <div>
              <div className="bshow__price mono">
                {priceIcon && <img src={priceIcon} alt="" />}
                {price}
              </div>
              {leaves && (
                <div className="bshow__leaves">
                  Leaves <b className="mono">{leaves}</b>
                </div>
              )}
            </div>
            <button
              type="button"
              className={`btn ${action.gold ? 'btn--gold' : 'btn--primary'} bshow__buy`}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          </div>
          <div className="bshow__fine">
            {SHIELD}
            <span>{fine}</span>
          </div>
          <button type="button" className="bshow__cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
