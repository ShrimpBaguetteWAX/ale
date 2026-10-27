/**
 * The market listing dialog with a real roster's fighters — see
 * list-harness.html.
 */
import { createRoot } from 'react-dom/client'
import { fetchRoster } from '../src/dungeon/queries'
import { ListTimeline } from '../src/fighters/ListTimeline'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/shop.css'
import '../src/styles/account.css'
import '../src/styles/fighters.css'

const q = new URLSearchParams(location.search)
const wallet = q.get('as') ?? 'onabs.wam'
const n = Number(q.get('n') ?? 3)
const keep = q.get('keep') !== '0'

void fetchRoster(wallet).then((roster) => {
  const fighters = roster.slice(0, n)
  createRoot(document.getElementById('root')!).render(
    <ListTimeline
      fighters={fighters}
      startPrice={120}
      hours={48}
      feeTotal={fighters.length}
      cutPercent={15}
      keepListed={keep}
      onConfirm={() => console.log('confirm')}
      onCancel={() => console.log('cancel')}
    />,
  )
})
