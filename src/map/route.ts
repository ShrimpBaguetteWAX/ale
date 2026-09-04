import { PORTAL_EFFECTS, type Planet } from '@/chain/config'
import { travelCost, travelDistance } from '@/chain/landId'
import type { Land } from '@/chain/types'

/**
 * Getting to a tile on a planet you are not standing on.
 *
 * `users::travel` only ever moves you within your current planet. What
 * changes planet is landing on a tile whose `special_effect` is a teleporter:
 * the contract writes the *portal tile's own coordinates* onto the player row
 * and swaps the planet, so you arrive on the far side at the same x,y you
 * stepped onto. That is the whole trick — a cross-planet trip is two ordinary
 * travels, and the second one starts from wherever the portal was.
 *
 * Both go in one transaction. Antelope finishes a top-level action and all of
 * its inline actions before starting the next, so by the time the second
 * `travel` reads the player row the first has already moved it and spent its
 * action points. The second leg's own check therefore runs against the
 * balance the first leg left behind, which is why the gate here has to be the
 * sum rather than either half.
 */

export interface TravelLeg {
  x: number
  y: number
  cost: number
  /** The planet this leg lands on, which is what makes it worth drawing. */
  planet: Planet
}

export interface PlanetRoute {
  /** The portal tile on the player's own planet that this route goes through. */
  portal: { x: number; y: number }
  legs: TravelLeg[]
  /** Action points for the whole trip, which is what the player must hold. */
  cost: number
}

interface CostConfig {
  travel_base_cost: number
  travel_distance_cost: number
  travel_portal_cost: number
}

/** Every tile on `lands` that teleports to `to`. */
export function portalsTo(lands: Land[] | undefined, to: Planet): Land[] {
  return (lands ?? []).filter(
    (l) => !!l.special_effect && PORTAL_EFFECTS[l.special_effect] === to,
  )
}

/**
 * The cheapest two-leg route from where the player stands to a tile on
 * another planet, or null if their planet has no portal to it.
 *
 * Cheapest by action points rather than by distance: the portal surcharge is
 * flat, so the two orders agree today, but the config owns that and a route
 * chosen on distance would quietly stop being the cheapest one if it changed.
 *
 * Ties break on the shorter first leg. A player watching their pin cross the
 * map has an opinion about which portal was "the near one", and picking
 * arbitrarily among equal-priced routes makes the same tap behave differently
 * on different days.
 */
export function planetRoute(
  player: { x: number; y: number; planet: Planet },
  target: { x: number; y: number },
  targetPlanet: Planet,
  /** Lands of the planet the player is standing on, for its portals. */
  homeLands: Land[] | undefined,
  /** The tile being travelled to, so a portal target is priced as one. */
  targetLand: Land | undefined,
  config: CostConfig | undefined | null,
): PlanetRoute | null {
  if (!config) return null
  if (targetPlanet === player.planet) return null

  const gates = portalsTo(homeLands, targetPlanet)
  if (gates.length === 0) return null

  const targetIsPortal = !!targetLand?.special_effect

  let best: PlanetRoute | null = null
  for (const gate of gates) {
    /* The hop itself always carries the portal surcharge. */
    const first = travelCost(player, gate, config, true)

    /*
       Landing on the portal *is* landing on the target, when they share
       coordinates. A second action would be rejected — `travel` refuses the
       tile you are already on — so the route is one leg and one action.
    */
    const same = gate.x === target.x && gate.y === target.y
    const second = same ? 0 : travelCost(gate, target, config, targetIsPortal)

    const legs: TravelLeg[] = [
      { x: gate.x, y: gate.y, cost: first, planet: targetPlanet },
    ]
    if (!same) {
      legs.push({ x: target.x, y: target.y, cost: second, planet: targetPlanet })
    }

    const route: PlanetRoute = {
      portal: { x: gate.x, y: gate.y },
      legs,
      cost: first + second,
    }

    if (
      !best ||
      route.cost < best.cost ||
      (route.cost === best.cost &&
        travelDistance(player, gate) < travelDistance(player, best.portal))
    ) {
      best = route
    }
  }

  return best
}
