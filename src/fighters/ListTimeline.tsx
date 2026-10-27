import type { RosterFighter } from '@/dungeon/types'
import { useModal } from '@/components/useModal'
import { useSwipeToClose } from '@/components/useSwipeToClose'
import { usePhone } from '@/components/usePhone'
import { GameImg } from '@/components/GameImg'
import { elementBackground, fighterArtFallback, fighterAvatar } from '@/tavern/fighterStats'
import { NUM_LOCALE } from '@/format'
import { asset } from '@/assets'

/* The faces at the head: a few side by side, the rest counted. */
const FACES = 5

function Gems({ value }: { value: number }) {
  return (
    <span className="lstep__gems">
      {value.toLocaleString(NUM_LOCALE)}
      <img src={asset('/assets/icons/gems.png')} alt="gems" />
    </span>
  )
}

/* "Arcanist, tactician and hunter, from 120 gems each" for a few; the price alone for more, the title has the count. */
function subOf(fighters: RosterFighter[], startPrice: number): string {
  const from = `from ${startPrice.toLocaleString(NUM_LOCALE)} gems${fighters.length === 1 ? '' : ' each'}.`
  if (fighters.length > 3) return from.charAt(0).toUpperCase() + from.slice(1)
  const names = fighters.map((f) => f.classname)
  const said = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}, ${from}`
}

/**
 * Listing on the market, told as what happens next: now (the fee is paid, the
 * fighters cannot fight), the auction's hours (bids raise the price), then
 * (sold: the gems after the market's cut; unsold: up as instant buy, or back).
 * The fee and the button share one bar at the foot.
 *
 * Centred over the roster on a desktop; on a phone it rises as a bottom sheet
 * that a swipe down on its head closes, as the shop's showcase does.
 */
export function ListTimeline({
  fighters,
  startPrice,
  hours,
  feeTotal,
  cutPercent,
  keepListed,
  onConfirm,
  onCancel,
}: {
  fighters: RosterFighter[]
  startPrice: number
  hours: number
  feeTotal: number
  /** The market's share of a sale, in percent. */
  cutPercent: number
  /** Unsold fighters stay up as instant buy at the start price; otherwise they come back. */
  keepListed: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const phone = usePhone()
  const panel = useModal(onCancel)
  const { grip } = useSwipeToClose(onCancel, panel)
  const n = fighters.length
  const they = n === 1 ? 'it' : 'they'
  const title = `List ${n} fighter${n === 1 ? '' : 's'}`

  return (
    <div
      className={phone ? 'rsheet lstep-sheet' : 'confirm'}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} on the market`}
      onClick={onCancel}
    >
      <div
        className={phone ? 'rsheet__panel lstep' : 'confirm__panel lstep'}
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lstep__head" {...(phone ? grip : {})}>
          {phone && <span className="rsheet__grip" aria-hidden="true" />}
          <button type="button" className="lstep__x" aria-label="Close" onClick={onCancel}>
            ✕
          </button>
          <span className="lstep__faces">
            {fighters.slice(0, FACES).map((f) => (
              <span
                key={f.fighter_id}
                className="lstep__face"
                style={{ backgroundImage: `url('${elementBackground(f.element)}')` }}
              >
                <GameImg src={fighterAvatar(f)} alt="" fallback={fighterArtFallback()} />
                <i>L{f.stats.level}</i>
              </span>
            ))}
            {n > FACES && <span className="lstep__more">+{n - FACES}</span>}
          </span>
          <h2 className="lstep__title">{title}</h2>
          <p className="lstep__sub">{subOf(fighters, startPrice)}</p>
        </div>

        <ol className="lstep__line">
          <li className="is-now">
            <span className="lstep__dot">1</span>
            <div>
              <b>Now</b>
              {/*
                The fee is the part worth stating twice: it is charged per
                fighter, whether or not anybody bids, and cancelling does not
                give it back.
              */}
              <p>
                The fee is paid, and kept whether or not {n === 1 ? 'it sells' : 'they sell'}. While listed, {they} cannot
                fight.
              </p>
            </div>
            <span className="lstep__v">
              <Gems value={feeTotal} />
            </span>
          </li>
          <li>
            <span className="lstep__dot">2</span>
            <div>
              <b>For {hours} hours</b>
              <p>Trainers bid; each bid raises the price from {startPrice.toLocaleString(NUM_LOCALE)} gems.</p>
            </div>
            <span className="lstep__v">{hours}h</span>
          </li>
          <li>
            <span className="lstep__dot">3</span>
            <div>
              <b>Then</b>
              <div className="lstep__split">
                <span>
                  <b>Sold</b>
                  The gems are yours, after the market's {cutPercent}%.
                </span>
                <span>
                  <b>Unsold</b>
                  {keepListed
                    ? `Up as instant buy at ${startPrice.toLocaleString(NUM_LOCALE)} gems.`
                    : `${n === 1 ? 'Comes' : 'Come'} back to you.`}
                </span>
              </div>
            </div>
          </li>
        </ol>

        <div className="lstep__pay">
          <div className="lstep__fee">
            <small>Fee now</small>
            <b>
              <Gems value={feeTotal} />
            </b>
          </div>
          <button type="button" className="btn btn--danger lstep__go" onClick={onConfirm}>
            List {n === 1 ? 'it' : 'them'}
          </button>
        </div>
        <button type="button" className="lstep__cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
