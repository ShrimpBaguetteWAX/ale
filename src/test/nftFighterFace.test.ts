import { describe, expect, it } from 'vitest'
import { fighterFace, fighterName, isNftFighter } from '@/tavern/fighterStats'

/**
 * The line-up a run records always ends with the NFT fighter, and it has
 * neither a class nor a race — these are real values off `battle.ale`.
 */
const NFT = { fighter_id: '99999999999', classname: '', racename: '' }
const ROSTER = { fighter_id: 3438, classname: 'voidwarden', racename: 'lopati' }

describe('the NFT fighter', () => {
  it('is recognised whether its id arrives as a string or a number', () => {
    expect(isNftFighter('99999999999')).toBe(true)
    expect(isNftFighter(99999999999)).toBe(true)
    expect(isNftFighter(3438)).toBe(false)
  })

  it('is drawn with its own art, not a portrait that does not exist', () => {
    /* `__avatar.webp` was the 404 this replaces. */
    expect(fighterFace(NFT)).toContain('bonus_fighter_avatar.webp')
    expect(fighterFace(NFT)).not.toContain('__avatar')
  })

  it('is named, rather than left blank', () => {
    expect(fighterName(NFT)).toBe('NFT Fighter')
  })

  it('leaves an ordinary fighter alone', () => {
    expect(fighterFace(ROSTER)).toContain('voidwarden_lopati_avatar.webp')
    expect(fighterName(ROSTER)).toBe('voidwarden lopati')
  })
})
