import { Link } from 'react-router-dom'
import type { Player } from '@/chain/types'
import { hasLegendAccess, LEGEND_REMIND_MS } from '@/account/rules'
import { legendLeft } from '@/shop/rules'
import { asset } from '@/assets'

const DAY = 86_400_000
const HOUR = 3_600_000

/** "3D", "7H": the time left, small enough for the phone's title line. */
function shortLeft(ms: number): string {
  return ms >= DAY ? `${Math.floor(ms / DAY)}D` : `${Math.max(1, Math.floor(ms / HOUR))}H`
}

/**
 * The player's name with their title under it, always on screen: the menu
 * on a desktop, the top bar on a phone.
 *
 * The title is the account's standing. A Legend Pass reads LEGEND in gold,
 * with the time it has left; inside the last five days it turns orange, the
 * same moment the Briefing starts reminding. Without one it reads Trial
 * Trainer. Either way it is a way into the Legend tab of the Shop.
 */
export function AccountPlate({ player, bar = false }: { player: Player; bar?: boolean }) {
  const now = Date.now()
  const legend = hasLegendAccess(player.legend_access_expiry, now)
  const left = legend ? Date.parse(player.legend_access_expiry + 'Z') - now : 0
  const state = !legend ? 'trial' : left < LEGEND_REMIND_MS ? 'soon' : 'legend'
  const name = player.playertag || player.wallet
  const label = legend
    ? `${name}, Legend Pass, ${legendLeft(left)}`
    : `${name}, Trial Trainer. Get the Legend Pass`

  if (bar) {
    return (
      <Link className={`plate plate--bar plate--${state}`} to="/shop?c=account" aria-label={label}>
        <b className="plate__name">{name}</b>
        <span className="plate__title">
          {state === 'trial' ? 'Trial' : state === 'soon' ? `${shortLeft(left)} left` : 'Legend'}
        </span>
      </Link>
    )
  }

  return (
    <Link className={`plate plate--${state}`} to="/shop?c=account" aria-label={label}>
      <span className="plate__name">
        <img
          src={asset(legend ? '/assets/icons/account-legend.svg' : '/assets/icons/account-trial.svg')}
          alt=""
          width={22}
          height={22}
        />
        <b>{name}</b>
      </span>
      <span className="plate__row">
        <span className="plate__title">{legend ? 'Legend' : 'Trial'}</span>
        <span className="plate__left">{legend ? legendLeft(left) : 'Get the Legend Pass ›'}</span>
      </span>
    </Link>
  )
}
