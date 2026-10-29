import { useEffect, useState } from 'react'
import { fetchPlanetLands } from '@/chain/queries'
import { landId } from '@/chain/landId'
import { useGame } from '@/state/useGame'

/**
 * The type of the land the player stands on: `Grass Coastline`, `Dunes`,
 * `Methane Swampland`. A dungeon fight is fought on it, and the stage is drawn
 * for it.
 *
 * It comes out of the planet's lands, which the map already keeps in the
 * browser, so a returning player has it at once and a first visit pays one
 * read. `pending` is true until it is known: the stage draws nothing until
 * then, rather than the default and then the real one (which would fetch the
 * wrong pictures and show the wrong ground). With no land to find, as for a
 * fight watched from a link, or a read that fails, there is no type and the
 * stage is the default.
 */
export function useLandType(): { type: string | undefined; pending: boolean } {
  const planet = useGame((s) => s.player?.planet)
  const x = useGame((s) => s.player?.x)
  const y = useGame((s) => s.player?.y)
  const where = !!planet && x !== undefined && y !== undefined
  const [found, setFound] = useState<{ key: string; type: string | undefined }>()
  const key = where ? `${planet}:${x}:${y}` : ''

  useEffect(() => {
    if (!where) return
    let live = true
    const id = landId(x!, y!)
    fetchPlanetLands(planet!)
      .then((lands) => lands.find((l) => l.land_id === id)?.land_type)
      .catch(() => undefined)
      .then((type) => {
        if (live) setFound({ key, type })
      })
    return () => {
      live = false
    }
  }, [where, planet, x, y, key])

  return { type: found?.key === key ? found.type : undefined, pending: where && found?.key !== key }
}
