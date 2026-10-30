/**
 * The dungeon board's rows, with the avatar frames and the team as battle
 * cards, over made-up players - the real board is behind a wallet. See
 * lb-harness.html.
 */
import { createRoot } from 'react-dom/client'
import { avatarRarity } from '../src/account/rules'
import { PlayerAvatar } from '../src/components/PlayerAvatar'
import { elementBackground, elementIcon } from '../src/tavern/fighterStats'
import '../src/styles/global.css'
import '../src/styles/app.css'
import '../src/styles/leaderboard.css'

const EL: Record<string, string> = {
  arcanist: 'air', astralknight: 'metal', desperado: 'fire', explosioneer: 'fire', hunter: 'nature',
  juggernaut: 'metal', lunatic: 'neutral', mindblade: 'gem', mystic: 'gem', tactician: 'neutral',
  voidcaller: 'air', voidwarden: 'nature',
}
const T = (c: string, r: string, lv: number) => ({ c, r, lv, el: EL[c], nft: false })
const NFT = (lv: number) => ({ c: 'bonus', r: '', lv, el: 'neutral', nft: true })

const rows = [
  { id: 505, name: 'Nyx Harrow', rating: '14,812', team: [T('juggernaut', 'human', 71), T('mindblade', 'altan', 69), T('voidcaller', 'onoros', 68), T('hunter', 'elgem', 66), T('desperado', 'khaured', 64), NFT(60)] },
  { id: 1304, name: 'Stormbound', rating: '14,590', team: [T('astralknight', 'lopati', 67), T('arcanist', 'human', 66), T('explosioneer', 'elgem', 64), T('tactician', 'nordic', 63), T('mystic', 'altan', 61), T('lunatic', 'onoros', 60)] },
  { id: 0, name: 'gh0stfarm', rating: '14,102', team: [T('voidwarden', 'human', 58), T('tactician', 'human', 57), T('hunter', 'robotron', 55), T('arcanist', 'robotron', 54), T('mystic', 'lopati', 52), T('lunatic', 'human', 50)] },
  { id: 601, name: 'Sable Quill', rating: '13,844', you: true, team: [T('arcanist', 'altan', 52), T('tactician', 'elgem', 51), T('explosioneer', 'robotron', 49), T('voidwarden', 'lopati', 48), T('mystic', 'elgem', 46), NFT(44)] },
]

const cardsOf = (team: typeof rows[number]['team']) => (
  <span className="lbrow__team lbrow__team--cards">
    {team.map((f, n) => (
      <span key={n} className={`lbrow__face lbcard${f.nft ? ' lbcard--nft' : ''}`} style={{ backgroundImage: `url('${elementBackground(f.el)}')` }}>
        <img className="lbcard__art" src={f.nft ? '/assets/fighters/bonus_fighter_avatar.webp' : `/assets/fighters/${f.c}_${f.r}_avatar.webp`} alt="" />
        <span className="lbcard__el"><img src={elementIcon(f.el)} alt="" /></span>
        <span className="lbcard__lv"><s>L</s>{f.lv}</span>
      </span>
    ))}
  </span>
)

createRoot(document.getElementById('root')!).render(
  <>
  <div className="dpodium__side" style={{ maxWidth: 360, marginBottom: 20 }}>
    {[1, 2].map((i) => (
      <div key={i} className={`dpodium__card dpodium__card--${i + 1}`}>
        <PlayerAvatar id={rows[i].id} name={rows[i].name} className={`dpodium__avatar lbrow--r${avatarRarity(rows[i].id) ?? 9}`} size={54} />
        <span className="dpodium__cardtext">
          <b className="dpodium__name">{rows[i].name}</b>
          <span className="dpodium__line"><span className="mono">{rows[i].rating}</span> rating</span>
        </span>
        <span className="dpodium__num">{i + 1}</span>
        {cardsOf(rows[i].team)}
      </div>
    ))}
  </div>
  <div className="lbtable" style={{ maxWidth: 1000 }}>
    {rows.map((r, i) => {
      const t = avatarRarity(r.id)
      return (
        <article
          key={i}
          className={`lbrow lbrow--dungeon${t === undefined ? '' : ` lbrow--rar lbrow--r${t}`}${r.you ? ' lbrow--you' : ''}`}
        >
          <span className="rank">{i + 1}</span>
          <span className="lbrow__who">
            <PlayerAvatar id={r.id} name={r.name} />
            <span className="lbrow__id">
              <span className="lbrow__name">{r.name}</span>
              <span className="lbrow__wallet">{r.name.toLowerCase().replace(/\W/g, '')}.wam</span>
            </span>
          </span>
          <span className="lbrow__team lbrow__team--cards">
            {r.team.map((f, n) => (
              <span
                key={n}
                className={`lbrow__face lbcard${f.nft ? ' lbcard--nft' : ''}`}
                style={{ backgroundImage: `url('${elementBackground(f.el)}')` }}
              >
                <img className="lbcard__art" src={f.nft ? '/assets/fighters/bonus_fighter_avatar.webp' : `/assets/fighters/${f.c}_${f.r}_avatar.webp`} alt="" />
                <span className="lbcard__el"><img src={elementIcon(f.el)} alt="" /></span>
                <span className="lbcard__lv"><s>L</s>{f.lv}</span>
              </span>
            ))}
          </span>
          <span className="lbrow__rating">{r.rating}</span>
          <span className="lbrow__pays">323</span>
        </article>
      )
    })}
    <article className={`lbrow lbrow--arena${avatarRarity(rows[0].id) === undefined ? '' : ` lbrow--rar lbrow--r${avatarRarity(rows[0].id)}`}`}>
      <span className="rank">5</span>
      <span className="lbrow__who">
        <PlayerAvatar id={rows[0].id} name={rows[0].name} />
        <span className="lbrow__id">
          <span className="lbrow__name">{rows[0].name}</span>
          <span className="lbrow__wallet">arena.wam</span>
        </span>
      </span>
      <span className="lbrow__rating">1,204</span>
      <span className="lbrow__pays">323</span>
    </article>
  </div>
  <pre id="m" />
  </>,
)

setTimeout(() => {
  const h = (s: string) => [...document.querySelectorAll(s)].map((e) => Math.round(e.getBoundingClientRect().height)).join(',')
  document.getElementById('m')!.textContent = `dungeon ${h('.lbrow--dungeon')} arena ${h('.lbrow--arena')}`
}, 2500)
