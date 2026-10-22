import { useEffect, useState } from 'react'

/** The two slots of the loadout, as a unit. */
export interface CardPair<TCard> {
  crew: TCard | null
  weapon: TCard | null
}

const UNDO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h11a5 5 0 0 1 0 10H8" />
    <path d="m7 4-4 4 4 4" />
  </svg>
)

const same = <TCard extends { template_id: number }>(a: CardPair<TCard>, b: CardPair<TCard>) =>
  a.crew?.template_id === b.crew?.template_id && a.weapon?.template_id === b.weapon?.template_id

/**
 * Auto-pick for the crew and weapon pair, with Undo.
 *
 * The fighters' auto-pick could be undone and this one could not, and a
 * pair chosen by the screen is at least as easy to disagree with as five
 * fighters are. The press remembers the pair it replaced; Undo puts it
 * back. It stands until it is used, or until the pair is changed by hand —
 * after that, putting the old pair back would be a surprise rather than a
 * correction. A press that changes nothing leaves nothing to undo.
 */
export function AutoPickCards<TCard extends { template_id: number }>({
  crew,
  weapon,
  disabled,
  onPick,
  onRestore,
}: {
  crew: TCard | null
  weapon: TCard | null
  disabled?: boolean
  /** Picks the pair and returns what it chose. */
  onPick: () => CardPair<TCard>
  onRestore: (pair: CardPair<TCard>) => void
}) {
  const [done, setDone] = useState<{ before: CardPair<TCard>; after: CardPair<TCard> } | null>(null)
  useEffect(() => {
    if (!done) return
    if (!same({ crew, weapon }, done.after)) setDone(null)
  }, [crew, weapon, done])

  const pick = () => {
    const before = { crew, weapon }
    const after = onPick()
    setDone(same(before, after) ? null : { before, after })
  }

  const undo = () => {
    if (!done) return
    onRestore(done.before)
    setDone(null)
  }

  return (
    <span className="cardsauto">
      <button
        type="button"
        className="btn btn--ghost btn--sm cardslots__auto cardsauto__go"
        onClick={pick}
        disabled={disabled}
        title="Choose the crew and weapon pair that suits this opponent"
      >
        Auto-pick cards
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm cardsauto__undo"
        onClick={undo}
        /* Always in its place, so the pair never changes width under the hand. */
        disabled={!done}
        title={done ? 'Undo — put the cards back as they were' : 'Nothing to undo'}
        aria-label={done ? 'Undo — put the cards back as they were' : 'Undo — nothing to undo'}
      >
        {UNDO_ICON}
      </button>
    </span>
  )
}
