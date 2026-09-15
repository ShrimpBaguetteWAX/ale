import type { Player, Tavern } from '@/chain/types'
import { landId } from '@/chain/landId'
import { isLegend } from '@/shop/rules'

/**
 * The tavern a player without legend access is standing on, not yet revealed.
 *
 * `users::travel` only auto-reveals for legend access. Everyone else arrives
 * with the tavern still sitting in `active_taverns` and `last_tavern` pointing
 * somewhere else (or nowhere), so the "standing in `last_tavern`" test kept
 * them out of the one screen that offers the paid reveal.
 *
 * The match is `users::setreveal`'s own: same planet, same land, and not
 * already the `last_tavern`. Legend players are left out on purpose — their
 * path through the tavern is unchanged.
 */
export function unrevealedTavernHere(player: Player): Tavern | undefined {
  if (isLegend(player)) return undefined
  const here = landId(player.x, player.y)
  if (player.last_tavern?.land_id === here && player.last_tavern.planet === player.planet) {
    return undefined
  }
  return (player.active_taverns ?? []).find(
    (t) => t.planet === player.planet && t.land_id === here,
  )
}
