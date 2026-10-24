import { assetAmount } from '@/leaderboard/rules'
import { bracketOf, chainTime, winnerSide } from './rules'
import type { TournamentMatchup, TournamentStage } from './types'

/**
 * Where everyone stands, worked out the way `tournmnt.ale` works it out.
 *
 * Three things the phone screen needs that the chain does not hand over in
 * one piece: how the fights are spread across the day, how many points each
 * player holds, and what those points pay. All three are fixed by the
 * contract's own arithmetic, so they are rebuilt here from it rather than
 * estimated.
 */

/**
 * How many fights each round holds, opening round first.
 *
 * The same shape `close_signup` gives the bracket: the opening round cuts
 * the field to a power of two, and every round after it halves that.
 * Twelve entrants: four opening fights, then four, two and the final.
 */
export function roundSizes(players: number): number[] {
  const b = bracketOf(players)
  if (b.degenerate) return []
  const sizes = [b.preliminaryBattles]
  let left = b.targetPlayers
  while (left > 1) {
    sizes.push(left / 2)
    left /= 2
  }
  return sizes
}

/**
 * A round's name, counted back from the final.
 *
 * The opening round is only called that when it is one — when seeds skip
 * it. A field that is already a power of two starts straight in at the
 * last sixteen, or wherever its size puts it.
 */
export function roundName(round: number, rounds: number, opening: boolean, short = false): string {
  const fromEnd = rounds - round
  if (fromEnd === 1) return 'Final'
  /* The opening round is the cut, whatever its distance from the final. */
  if (round === 0 && opening) return short ? 'Opening' : 'Opening round'
  if (fromEnd === 2) return short ? 'Semis' : 'Semi-finals'
  if (fromEnd === 3) return short ? 'Quarters' : 'Quarter-finals'
  return `Last ${2 ** fromEnd}`
}

/** One round's fight in the singular: "Quarter-final", "Final". */
export function fightName(round: number, rounds: number, opening: boolean): string {
  const name = roundName(round, rounds, opening)
  if (name === 'Opening round') return 'Opening fight'
  if (name.startsWith('Last')) return `${name} fight`
  return name.replace(/s$/, '')
}

/**
 * When every fight of the tournament is due, round by round.
 *
 * Known from the moment signup closes. `create_matchups` and the battle step
 * split the fighting window into one equal slot a fight — players less one
 * of them — and stamp each pairing with its slot as they draw it. So a round
 * that has not been drawn yet still has its times; only who fights in them
 * is open.
 */
export function fightSlots(players: number, battleStartMs: number, battleSec: number): number[][] {
  const sizes = roundSizes(players)
  const total = sizes.reduce((a, b) => a + b, 0)
  if (!total || !Number.isFinite(battleStartMs)) return sizes.map((n) => Array(n).fill(NaN))
  const step = Math.floor(battleSec / total) * 1000
  let k = 0
  return sizes.map((n) => Array.from({ length: n }, () => battleStartMs + step * k++))
}

/** A player as the fight rows name them. */
export interface Entrant {
  wallet: string
  tag: string
  avatar: number
}

/** One player's tournament: where it ended, who they beat and who beat them. */
export interface Run extends Entrant {
  points: number
  /** Through the opening round on seed. */
  pass: boolean
  /** The round they went out in, or null while they are still in. */
  outIn: number | null
  lostTo: Entrant | null
  beat: { round: number; who: Entrant }[]
}

const sideOf = (m: TournamentMatchup, side: 1 | 2): Entrant =>
  side === 1
    ? { wallet: m.wallet_player1, tag: m.gamertag_player1, avatar: m.avatar_player1 }
    : { wallet: m.wallet_player2, tag: m.gamertag_player2, avatar: m.avatar_player2 }

/**
 * Who went through the opening round on seed.
 *
 * Read off the fights where they exist — anyone in the second round who did
 * not win a fight in the first — because the signup rows of everyone who
 * has since gone out are erased. Before the second round is drawn the
 * caller's list (the top of the seeding) is the only source.
 */
export function passesFrom(history: TournamentMatchup[][], fallback: Entrant[]): Entrant[] {
  const second = history[1] ?? []
  if (!second.length || !(history[0] ?? []).length) return fallback
  const winners = new Set(
    history[0].map((m) => {
      const w = winnerSide(m)
      return w ? sideOf(m, w).wallet : ''
    }),
  )
  return second
    .flatMap((m) => [sideOf(m, 1), sideOf(m, 2)])
    .filter((e) => e.wallet && !winners.has(e.wallet))
}

/**
 * Every player's run, replayed from the fights.
 *
 * Points as `reportmatch` keeps them: a free pass is worth 10, and a win
 * doubles what the winner holds and adds the round counter. The counter
 * moves on *before* the last fight of a round is scored, so that fight adds
 * one more than the others in its round — the first real tournament shows
 * it, 21 and 22 points for two semi-final wins from the same 10.
 *
 * `sizes` is how many fights each round holds, which is what decides the
 * last one; the rows of a round still being drawn are not all there yet.
 */
export function replay(history: TournamentMatchup[][], passes: Entrant[], sizes: number[]): Map<string, Run> {
  const runs = new Map<string, Run>()
  const get = (e: Entrant): Run => {
    let r = runs.get(e.wallet)
    if (!r) {
      r = { ...e, points: 0, pass: false, outIn: null, lostTo: null, beat: [] }
      runs.set(e.wallet, r)
    } else if (!r.tag && e.tag) {
      r.tag = e.tag
    }
    return r
  }
  for (const p of passes) {
    const r = get(p)
    r.pass = true
    r.points = 10
  }
  history.forEach((round, r) => {
    const size = sizes[r] ?? round.length
    ;[...round]
      .sort((a, b) => a.index - b.index)
      .forEach((m) => {
        const one = get(sideOf(m, 1))
        const two = m.wallet_player2 ? get(sideOf(m, 2)) : null
        const w = winnerSide(m)
        if (!w || !two) return
        const [win, lose] = w === 1 ? [one, two] : [two, one]
        win.points = 2 * win.points + r + (m.index === size - 1 ? 1 : 0)
        win.beat.push({ round: r, who: { wallet: lose.wallet, tag: lose.tag, avatar: lose.avatar } })
        lose.outIn = r
        lose.lostTo = { wallet: win.wallet, tag: win.tag, avatar: win.avatar }
      })
  })
  return runs
}

/**
 * The payout table's order: most points first.
 *
 * `payout` is read through an index on `UINT64_MAX - reward_points`, so ties
 * fall back to the primary key — the wallet name's value, which orders the
 * way the names themselves sort.
 */
export function payoutOrder<T extends { wallet: string; points: number }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => b.points - a.points || (a.wallet < b.wallet ? -1 : a.wallet > b.wallet ? 1 : 0),
  )
}

/** WAX shares of 48 by place: 16, 8, 4 and 4, 2 each to 8th, 1 each to 16th. */
export function waxShares(rank: number): number {
  if (rank < 1) return 0
  if (rank === 1) return 16
  if (rank === 2) return 8
  if (rank <= 4) return 4
  if (rank <= 8) return 2
  if (rank <= 16) return 1
  return 0
}

/** The WAX places as bands, cut to the size of the field. */
export function waxBands(players: number): { from: number; to: number; shares: number }[] {
  const bands = [
    { from: 1, to: 1, shares: 16 },
    { from: 2, to: 2, shares: 8 },
    { from: 3, to: 4, shares: 4 },
    { from: 5, to: 8, shares: 2 },
    { from: 9, to: 16, shares: 1 },
  ]
  return bands
    .filter((b) => b.from <= players)
    .map((b) => ({ ...b, to: Math.min(b.to, players) }))
}

export interface Prizes {
  wax: number
  tlm: number
  /** TLM a reward point pays, once the number of rounds is known. */
  perPoint: number
  /** WAX for one share of 48. */
  perShare: number
}

/**
 * What the pot pays out, as `reward_payout` divides it.
 *
 * WAX in shares of 48 by place. TLM by points: the pot over Σ r²·2^(R−r)
 * for the R rounds, floored in the token's own units, times the points a
 * player holds. Both are cut to a tenth for a player without Legend Access.
 */
export function prizesOf(stage: TournamentStage | undefined): Prizes {
  const wax = assetAmount(stage?.wax_rewards ?? '')
  const tlm = assetAmount(stage?.tlm_rewards ?? '')
  const rounds = Number(stage?.rounds ?? 0)
  let total = 0
  for (let r = 1; r <= rounds; r++) total += r * r * 2 ** (rounds - r)
  const perPoint = total > 0 ? Math.floor(Math.round(tlm * 1e4) / total) / 1e4 : 0
  return { wax, tlm, perPoint, perShare: wax / 48 }
}

/** WAX paid to a place, before any Legend cut. */
export function waxFor(prizes: Prizes, rank: number): number {
  return Math.floor(Math.round(prizes.wax * 1e8) * waxShares(rank) / 48) / 1e8
}

/**
 * The points each win from here would bring.
 *
 * Doubled and the round added, as `reportmatch` does — without the extra
 * point the last fight of a round happens to get, which nobody can count on.
 */
export function winsAhead(points: number, fromRound: number, rounds: number): { round: number; points: number }[] {
  const out: { round: number; points: number }[] = []
  let p = points
  for (let r = fromRound; r < rounds; r++) {
    p = 2 * p + r
    out.push({ round: r, points: p })
  }
  return out
}

/**
 * The fight on now: the one whose slot the clock is in.
 *
 * Fights run in order, each at its own slot, so this is the latest one that
 * is due — fought already or about to be — and the screen leads with it
 * until the next slot comes round.
 */
export function liveFight(round: TournamentMatchup[], now: number): TournamentMatchup | null {
  let live: TournamentMatchup | null = null
  for (const m of [...round].sort((a, b) => a.index - b.index)) {
    const at = chainTime(m.play_time)
    if (Number.isFinite(at) && at <= now && m.wallet_player2) live = m
  }
  return live
}

export interface StripCell<T> {
  item: T | null
  /** Set on a cell standing in for several: how many it hides, and which way. */
  more?: { count: number; side: 'before' | 'after'; first: number }
  at: number
}

/**
 * At most `room` cells around the one in focus.
 *
 * A field of sixty-five players has eight rounds and a strip of ten — too
 * many for a phone. The cells either side of the window fold into one each,
 * "+3", which a tap opens; the strip never grows past its six columns and
 * never scrolls.
 */
export function stripCells<T>(items: T[], focus: number, room = 6): StripCell<T>[] {
  if (items.length <= room) return items.map((item, at) => ({ item, at }))
  const at = Math.max(0, Math.min(items.length - 1, focus))
  /* One cell of lead-in, the rest ahead — you are walking forwards. */
  const start = Math.max(0, Math.min(at - 2, items.length - room))
  const end = start + room
  const cells: StripCell<T>[] = items.slice(start, end).map((item, i) => ({ item, at: start + i }))
  if (start > 0) {
    cells[0] = { item: null, at: 0, more: { count: start + 1, side: 'before', first: start } }
  }
  if (end < items.length) {
    cells[room - 1] = {
      item: null,
      at: end - 1,
      more: { count: items.length - end + 1, side: 'after', first: end - 1 },
    }
  }
  return cells
}
