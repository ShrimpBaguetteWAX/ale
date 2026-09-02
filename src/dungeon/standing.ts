import type { FighterSnapshot, Replay } from './sim'

/**
 * Two questions the screen answers, each the way a game normally answers it.
 *
 * **Who acts next** comes from the log, not from a stat: the fight is fully
 * simulated before a frame is drawn, so the order of the next several
 * attackers is already known exactly. That is a turn queue, and showing it as
 * one is both simpler and more honest than inferring it from initiative.
 *
 * **Who draws the next blow** is taunt. `pick_defender` falls back to the
 * highest `taunt` on the defending team for every target it does not
 * recognise, and 24 of the 32 fighters across the stored fights ask for
 * `enemy_taunt_max` outright. Taunt also *drops* by `taunt_deduction` each
 * time a fighter survives a hit, so the tank sheds aggro as it is worn down
 * and the mark moves. It is not the whole story — a few attackers hunt lowest
 * taunt or highest health instead — so this marks who is drawing fire, not
 * who is certain to be hit.
 */

export interface Standing {
  /** Raw taunt, for the tooltip. */
  taunt: number
  /** 0–1 against the team's highest taunt. */
  share: number
  /** Tops its team's taunt — the fighter `pick_defender` would return. */
  drawsFire: boolean
}

const EMPTY: Standing = { taunt: 0, share: 0, drawsFire: false }

/**
 * Threat standing for one team.
 *
 * Ties go to the fighter that appears first, which is what `find_max_by`
 * does — so the flagged fighter is the one the contract would actually pick,
 * not merely one of several that could be.
 */
export function teamStanding(team: FighterSnapshot[]): Map<string, Standing> {
  const out = new Map<string, Standing>()
  const living = team.filter((f) => f.health > 0)
  for (const f of team) out.set(f.uid, EMPTY)
  if (!living.length) return out

  let topTaunt = living[0]
  let maxTaunt = living[0].taunt

  for (const f of living) {
    if (f.taunt > topTaunt.taunt) topTaunt = f
    if (f.taunt > maxTaunt) maxTaunt = f.taunt
  }

  for (const f of living) {
    out.set(f.uid, {
      taunt: f.taunt,
      share: maxTaunt > 0 ? f.taunt / maxTaunt : 0,
      drawsFire: f.uid === topTaunt.uid,
    })
  }

  return out
}

/** Every fighter as of a step — step 0 being the opening line-up. */
export function stateAt(replay: Replay, step: number): FighterSnapshot[] {
  if (step <= 0) return replay.opening
  const i = Math.min(step, replay.turns.length)
  return replay.turns[i - 1].snapshot
}

/** Threat standing for both teams at one step, keyed by fighter. */
export function standingAt(replay: Replay, step: number): Map<string, Standing> {
  const state = stateAt(replay, step)
  const byTeam = new Map<number, FighterSnapshot[]>()

  for (const f of state) {
    /* The uid is `team-slot-id`, so the team is its first segment. */
    const team = Number(f.uid.split('-')[0])
    const list = byTeam.get(team)
    if (list) list.push(f)
    else byTeam.set(team, [f])
  }

  const out = new Map<string, Standing>()
  for (const list of byTeam.values()) {
    for (const [uid, standing] of teamStanding(list)) out.set(uid, standing)
  }
  return out
}

/** One entry in the turn queue. */
export interface QueuedTurn {
  uid: string
  /** 1-based attack number in the log. */
  turn: number
  /** True for the blow being played right now. */
  current: boolean
}

/**
 * The next few fighters to act, straight from the log.
 *
 * No inference and no ordering rule reimplemented here: the simulation
 * already produced the exact sequence, so the queue simply reads it. The
 * fighter mid-swing sits at the head, marked, the way a turn-order strip in a
 * turn-based game shows the current actor before the ones waiting.
 */
export function turnQueue(
  replay: Replay,
  step: number,
  count = 7,
): QueuedTurn[] {
  const from = Math.max(0, step - 1)
  const out: QueuedTurn[] = []

  for (let i = from; i < replay.turns.length && out.length < count; i++) {
    out.push({
      uid: replay.turns[i].attackerUid,
      turn: replay.turns[i].turn,
      current: step > 0 && i === from,
    })
  }

  return out
}
