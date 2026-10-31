/**
 * The crew and weapon tabs over the real catalogue - see nft-harness.html.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { fetchSchemaTemplates, type CardTemplate } from '../src/chain/atomic'
import { fetchNftValues } from '../src/dungeon/queries'
import { CardGrid } from '../src/fight/setup'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/fighters.css'
import '../src/styles/landstage.css'
import '../src/styles/dungeon.css'

const q = new URLSearchParams(location.search)
const kind = q.get('kind') === 'crew' ? 'crew' : 'weapon'
/* ?n=: how many cards the wallet holds, spread across the rarities. */
const n = Number(q.get('n') ?? 16)

function Harness({ cards, values }: { cards: CardTemplate[]; values: Awaited<ReturnType<typeof fetchNftValues>> }) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<CardTemplate | null>(cards[1] ?? null)
  return (
    <div className="picker" style={{ maxWidth: q.get('phone') === '1' ? 360 : 1000 }}>
      <CardGrid
        cards={cards}
        values={values}
        query={query}
        onQuery={setQuery}
        selected={picked}
        onPick={setPicked}
        onInspect={() => {}}
        kind={kind}
      />
    </div>
  )
}

void Promise.all([fetchSchemaTemplates(kind === 'crew' ? 'crew.worlds' : 'arms.worlds'), fetchNftValues()]).then(
  ([templates, values]) => {
    const all = [...templates.values()].filter((c) => values.has(c.template_id))
    /* Every rarity in, then fill up, so the chips and the frames all show. */
    const byRarity = new Map<string, CardTemplate[]>()
    for (const c of all) {
      const r = values.get(c.template_id)!.rarity
      byRarity.set(r, [...(byRarity.get(r) ?? []), c])
    }
    const cards: CardTemplate[] = []
    for (let i = 0; cards.length < Math.min(n, all.length); i++)
      for (const list of byRarity.values()) if (list[i] && cards.length < n) cards.push({ ...list[i], owned: i % 5 === 3 ? 2 : 1 })
    createRoot(document.getElementById('root')!).render(<Harness cards={cards} values={values} />)
    if (q.get('open') === '1') setTimeout(() => (document.querySelector('.drost__tool, .sheetbar__main') as HTMLElement)?.click(), 300)
    if (q.get('view')) setTimeout(() => (document.querySelectorAll('.drost__viewseg button')[Number(q.get('view'))] as HTMLElement)?.click(), 300)
  },
)
