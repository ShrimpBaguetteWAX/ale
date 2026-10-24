import { describe, expect, it } from 'vitest'
import { avatarTracks, type AvatarEntry, type AvatarState } from '@/account/rules'
import { statGroup } from '@/account/stats'
import type { Avatar } from '@/chain/types'

/* One tier of a track, as `avatarBoard` hands it over. */
const tier = (id: number, stat: string, name: string, state: AvatarState, have: number, need: number): AvatarEntry => ({
  avatar: {
    avatar_id: id,
    avatar_prereq_id: 0,
    avatar_category: 'arena',
    avatar_name: name,
    avatar_description: '',
    permstats_requirement: stat,
    permstats_requirement_min_value: need,
  } as Avatar,
  state,
  have,
  need,
})

describe('avatarTracks', () => {
  /* MjaM's arena wins, out of order the way the board sorts them. */
  const board = [
    tier(503, 'arenas_won', 'Arenas Won', 'ready', 1510, 1500),
    tier(500, 'arenas_won', 'Arenas Won', 'unlocked', 1510, 40),
    tier(505, 'arenas_won', 'Arenas Won', 'locked', 1510, 6000),
    tier(504, 'arenas_won', 'Arenas Won', 'locked', 1510, 3000),
    tier(1802, 'nfts_staked', 'NFTs Staked', 'locked', 225, 250),
    tier(1800, 'nfts_staked', 'NFTs Staked', 'unlocked', 225, 25),
    tier(1500, 'fighters_sold', 'Fighters Sold', 'locked', 0, 100),
    tier(1302, 'travel', 'Travel', 'unlocked', 900, 500),
  ]
  const tracks = avatarTracks(board)

  it('folds the tiers of one counter into one track, cheapest first', () => {
    const arena = tracks.find((t) => t.stat === 'arenas_won')!
    expect(arena.tiers.map((t) => t.need)).toEqual([40, 1500, 3000, 6000])
    expect(arena.ready).toBe(1)
    expect(arena.next?.need).toBe(3000)
    expect(arena.label).toBe('Arenas Won')
  })

  it('puts something to claim first, then the closest next, finished last', () => {
    expect(tracks.map((t) => t.stat)).toEqual(['arenas_won', 'nfts_staked', 'fighters_sold', 'travel'])
  })
})

describe('statGroup', () => {
  it('sorts the counters by what they are about', () => {
    expect(statGroup('tlm_earned')).toBe('Earnings')
    expect(statGroup('credits_gained')).toBe('Earnings')
    expect(statGroup('alf_credits_claimed')).toBe('Earnings')
    expect(statGroup('dungeons_won')).toBe('Fighting')
    expect(statGroup('damage_blocked_by_enemy')).toBe('Fighting')
    expect(statGroup('energy_saved_recruiting')).toBe('Fighters')
    expect(statGroup('level_ups')).toBe('Fighters')
    expect(statGroup('dungeons_constructed')).toBe('World')
    expect(statGroup('total_travel_distance')).toBe('World')
    expect(statGroup('something_new')).toBe('Other')
  })
})
