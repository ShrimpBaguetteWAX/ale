import { avatarArt } from '@/account/rules'
import { asset } from '@/assets'

/**
 * The player, as the player chose to be seen.
 *
 * The leaderboard tables already carried an avatar on every row and neither
 * drew it, so a board of the best players in the game was a list of wallet
 * addresses. The avatars are unlocked by playing — each one has a permstat it
 * is earned against — which makes them worth showing precisely on the screens
 * that are about who has played the most.
 *
 * Shared rather than owned by the leaderboard, because the stat boards on the
 * Account screen rank the same people off the same avatar field, and two
 * copies of this would be two fallbacks to keep in step. It lives here rather
 * than being exported from the route so that reading it does not pull the
 * whole leaderboard chunk into whatever else wants a face.
 *
 * `unknown.webp` covers both a player who has never set one — four in five
 * have not — and an id this build has no art for, which is what a new avatar
 * shipped on chain before a client update looks like.
 */
export function PlayerAvatar({
  id,
  name,
  className = 'lbrow__avatar',
  size = 34,
}: {
  id: number | undefined
  name: string
  className?: string
  size?: number
}) {
  const unknown = asset('/assets/avatar/unknown.webp')
  return (
    <img
      className={className}
      src={id ? avatarArt(id) : unknown}
      alt=""
      title={name}
      loading="lazy"
      width={size}
      height={size}
      onError={(e) => {
        const img = e.currentTarget
        if (img.dataset.fallback) return
        img.dataset.fallback = '1'
        img.src = unknown
      }}
    />
  )
}
