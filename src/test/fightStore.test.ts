import { describe, expect, it, beforeEach } from 'vitest'
import { rememberFight, recallXpBefore, recallVenue } from '@/dungeon/fightStore'
import type { FightRow } from '@/dungeon/types'
import won from '../../harness/fight-win.json'
import lost from '../../harness/fight-loss.json'

/**
 * What a fight paid, and why the chain cannot answer it.
 *
 * The result screen reported each fighter's whole lifetime experience as one
 * run's earnings, on a defeat, which pays none. The cause was reading
 * `experience` off the fight row: the contract declares the field on every
 * fighter and writes zero into it, so `live - row` is `live - 0`.
 *
 * The before is recorded by the screen that starts the fight instead. These
 * pin both halves — that the row is not a source, and that the store is.
 */

beforeEach(() => {
  sessionStorage.clear()
})

const row = (over: Partial<FightRow> = {}): FightRow =>
  ({
    history_id: 'h1',
    wallet: 'smoke.wam',
    team1_fighters: [],
    team2_fighters: [],
    log: '',
    turns: 1,
    reward_power_added: [],
    reward_power_total: [],
    timestamp: new Date().toISOString().replace('Z', ''),
    ...over,
  }) as FightRow

describe('the fight row', () => {
  it('carries no usable experience, in either captured fight', () => {
    /*
       Both fixtures are real rows off mainnet. If a contract change ever
       starts populating these, this is where it shows up — and the screen
       could go back to reading them.
    */
    for (const fight of [won, lost]) {
      const team = (fight as unknown as FightRow).team1_fighters
      expect(team.length).toBeGreaterThan(0)
      for (const f of team) {
        expect(f.experience ?? 0).toBe(0)
        expect(f.required_experience ?? 0).toBe(0)
      }
    }
  })
})

describe('recallXpBefore', () => {
  it('gives back what the picker recorded', () => {
    rememberFight(row(), 'dungeon', { 16: 1_200, 17: 800 })

    expect(recallXpBefore('h1')).toEqual({ 16: 1_200, 17: 800 })
    expect(recallVenue('h1')).toBe('dungeon')
  })

  it('is undefined for a fight this browser did not start', () => {
    /* A replay reached by a link: the row comes off the chain and there is no
       before to subtract, so the screen must say nothing rather than treat a
       missing record as a zero and report a lifetime as one run's gain. */
    rememberFight(row({ history_id: 'h2' }))

    expect(recallXpBefore('h2')).toBeUndefined()
    expect(recallXpBefore('never-seen')).toBeUndefined()
  })

  it('survives being read back out of storage', () => {
    /* The screen that records it and the screen that reads it are separated
       by a navigation, and a reload in between is normal. */
    rememberFight(row({ history_id: 'h3' }), 'arena', { 99: 5 })
    const raw = sessionStorage.getItem('al.fights')
    expect(raw).toContain('xpBefore')
    expect(JSON.parse(raw!).h3.xpBefore).toEqual({ 99: 5 })
  })
})
