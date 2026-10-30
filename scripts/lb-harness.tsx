/**
 * The leaderboard rows, with the avatar frames, over made-up players - the
 * real board is behind a wallet. See lb-harness.html.
 */
import { createRoot } from 'react-dom/client'
import { avatarRarity } from '../src/account/rules'
import { PlayerAvatar } from '../src/components/PlayerAvatar'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/leaderboard.css'

const rows = [
  { id: 505, name: 'Nyx Harrow', rating: '9,412' },
  { id: 1304, name: 'Stormbound', rating: '9,180' },
  { id: 1203, name: 'Cinder Knox', rating: '8,966' },
  { id: 0, name: 'gh0stfarm', rating: '8,741' },
  { id: 1102, name: 'Marrow & Co', rating: '8,530' },
  { id: 601, name: 'Sable Quill', rating: '8,314', you: true },
  { id: 1900, name: 'Tin Pilgrim', rating: '8,102' },
]

createRoot(document.getElementById('root')!).render(
  <div className="lbtable" style={{ maxWidth: 760 }}>
    {rows.map((r, i) => {
      const t = avatarRarity(r.id)
      return (
        <article
          key={i}
          className={`lbrow lbrow--arena${t === undefined ? '' : ` lbrow--rar lbrow--r${t}`}${r.you ? ' lbrow--you' : ''}`}
        >
          <span className="rank">{i + 1}</span>
          <span className="lbrow__who">
            <PlayerAvatar id={r.id} name={r.name} />
            <span className="lbrow__id">
              <span className="lbrow__name">{r.name}</span>
              <span className="lbrow__wallet">{r.name.toLowerCase().replace(/\W/g, '')}.wam</span>
            </span>
          </span>
          <span className="lbrow__rating">{r.rating}</span>
          <span className="lbrow__pays">323</span>
        </article>
      )
    })}
  </div>,
)
