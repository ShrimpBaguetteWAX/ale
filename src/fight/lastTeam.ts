/**
 * The last team a player took into a fight, remembered locally.
 *
 * Picking five fighters and two cards is most of the work of a run, and the
 * overwhelming majority of runs are the same team again — the roster barely
 * changes between one dungeon and the next. Making the player rebuild it every
 * visit is the screen asking a question it already knows the answer to.
 *
 * localStorage rather than sessionStorage, unlike `fightStore`: a team is
 * worth keeping across days, which is exactly the case where retyping it is
 * most annoying. Keyed by wallet so two accounts on one browser do not inherit
 * each other's line-up, and by kind because a dungeon team and an arena team
 * are different choices.
 *
 * What is stored is *ids*, never fighters. A stored fighter would go stale —
 * sold, aged, levelled, or busy in the arena — and restoring it would put a
 * player into a run with a team that no longer exists. Ids are resolved
 * against the live roster on every restore, which is what makes
 * `restoreTeam` below able to drop what is no longer usable.
 */

export type FightKind = 'dungeon' | 'arena'

export interface RememberedTeam {
  fighterIds: number[]
  crew: number | null
  weapon: number | null
}

const key = (kind: FightKind, wallet: string) => `al.lastteam.${kind}.${wallet}`

export function rememberTeam(
  kind: FightKind,
  wallet: string,
  team: RememberedTeam,
): void {
  try {
    localStorage.setItem(key(kind, wallet), JSON.stringify(team))
  } catch {
    // A full or blocked localStorage costs the player a convenience, nothing
    // more. It must never interrupt setting up a fight.
  }
}

export function recallTeam(kind: FightKind, wallet: string): RememberedTeam | null {
  try {
    const raw = localStorage.getItem(key(kind, wallet))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RememberedTeam>
    return {
      fighterIds: Array.isArray(parsed.fighterIds)
        ? parsed.fighterIds.filter((n) => Number.isFinite(n))
        : [],
      crew: typeof parsed.crew === 'number' ? parsed.crew : null,
      weapon: typeof parsed.weapon === 'number' ? parsed.weapon : null,
    }
  } catch {
    return null
  }
}

export interface Restored<TCard> {
  fighterIds: number[]
  crew: TCard | null
  weapon: TCard | null
  /**
   * Fighters that were on the remembered team and are not on the restored
   * one, with the reason. Shown to the player rather than swallowed: a team
   * that comes back four strong is confusing unless the screen says why.
   */
  dropped: { id: number; reason: string }[]
}

/**
 * Resolve a remembered team against what the player can actually field now.
 *
 * A fighter is dropped when it has left the roster, is busy in the arena or
 * on the market, or is waiting on a payday — the contract refuses all three,
 * so restoring one would produce a team that cannot start and a Start button
 * that will not light up for no visible reason.
 *
 * Cards are dropped when the player no longer owns them or when they have no
 * `nftvalues` row, which is the same test the pickers apply.
 */
export function restoreTeam<TCard extends { template_id: number }>(
  remembered: RememberedTeam | null,
  options: {
    teamSize: number
    /** Available fighters, by id — anything absent is dropped. */
    usable: Map<number, { available: boolean; reason?: string }>
    crewCards: TCard[]
    weaponCards: TCard[],
  },
): Restored<TCard> {
  const empty: Restored<TCard> = { fighterIds: [], crew: null, weapon: null, dropped: [] }
  if (!remembered) return empty

  const fighterIds: number[] = []
  const dropped: Restored<TCard>['dropped'] = []

  for (const id of remembered.fighterIds) {
    if (fighterIds.length >= options.teamSize) break
    const state = options.usable.get(id)
    if (!state) {
      dropped.push({ id, reason: 'no longer in this wallet' })
      continue
    }
    if (!state.available) {
      dropped.push({ id, reason: (state.reason ?? 'unavailable').toLowerCase() })
      continue
    }
    fighterIds.push(id)
  }

  const find = (cards: TCard[], id: number | null) =>
    id == null ? null : (cards.find((c) => c.template_id === id) ?? null)

  return {
    fighterIds,
    crew: find(options.crewCards, remembered.crew),
    weapon: find(options.weaponCards, remembered.weapon),
    dropped,
  }
}
