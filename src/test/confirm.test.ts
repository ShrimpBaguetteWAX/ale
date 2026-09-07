import { describe, expect, it } from 'vitest'
import { confirmThen } from '@/chain/confirm'

/**
 * Waiting for the chain, and the ways that can go wrong.
 *
 * No timers: `wait` is replaced with something that resolves at once, so the
 * shape of the loop is tested rather than the clock.
 */

const now = async () => {}

describe('confirmThen', () => {
  it('stops on the first read that shows the change', async () => {
    let reads = 0
    const result = await confirmThen(
      async () => ++reads,
      () => true,
      { wait: now },
    )

    expect(result.confirmed).toBe(true)
    expect(result.rounds).toBe(1)
    expect(reads, 'a chain that answered at once should cost one read').toBe(1)
  })

  it('keeps going until it does', async () => {
    let reads = 0
    const result = await confirmThen(
      async () => ++reads,
      (n) => n >= 3,
      { wait: now },
    )

    expect(result.confirmed).toBe(true)
    expect(result.rounds).toBe(3)
  })

  it('gives up after the attempt budget rather than hanging', async () => {
    let reads = 0
    const result = await confirmThen(
      async () => ++reads,
      () => false,
      { attempts: 4, wait: now },
    )

    expect(result.confirmed).toBe(false)
    expect(result.rounds).toBe(4)
    expect(result.value, 'the last read is still worth having').toBe(4)
  })

  it('treats an empty answer as not yet, never as gone', async () => {
    /*
       The failure this file is written around. Under load a WAX node answers
       a table read with an empty result rather than an error — so a
       predicate that reads "the row is not there any more" as success would
       confirm a claim that had not happened, on a node that was simply busy.

       Here the chain answers empty twice before the real row arrives, and
       the wait has to survive both.
    */
    const answers = [[], [], [{ id: 1 }]]
    let i = 0
    const result = await confirmThen(
      async () => answers[i++],
      (rows) => rows.length > 0,
      { wait: now },
    )

    expect(result.confirmed).toBe(true)
    expect(result.rounds).toBe(3)
  })

  it('counts a read that threw as a round that did not happen', async () => {
    /*
       A failed read says nothing about whether the transaction landed. It
       must not end the wait, and — the part that matters to the player — it
       must not surface as an error for an action that was accepted.
    */
    let reads = 0
    const result = await confirmThen(
      async () => {
        reads++
        if (reads < 3) throw new Error('HTTP 500')
        return 'row'
      },
      (v) => v === 'row',
      { wait: now },
    )

    expect(result.confirmed).toBe(true)
    expect(reads).toBe(3)
  })

  it('survives a read that never succeeds', async () => {
    const result = await confirmThen(
      async () => {
        throw new Error('every node is down')
      },
      () => true,
      { attempts: 3, wait: now },
    )

    expect(result.confirmed).toBe(false)
    expect(result.value).toBeUndefined()
    expect(result.rounds).toBe(3)
  })

  it('waits between rounds rather than hammering', async () => {
    const waits: number[] = []
    await confirmThen(
      async () => 0,
      () => false,
      {
        attempts: 3,
        intervalMs: 750,
        wait: async (ms) => {
          waits.push(ms)
        },
      },
    )

    expect(waits).toEqual([750, 750, 750])
  })
})
