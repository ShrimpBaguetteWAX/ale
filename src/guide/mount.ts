// @ts-nocheck
/*
 * The guide's behaviour, generated from mockups/guide-v2.html by
 * mockups/guide-build.cjs. Edit the mockup and run the build again rather
 * than changing this file.
 *
 * Everything runs against the shadow root the Guide screen made: the guide's
 * own helpers look things up there, window listeners and timers are undone
 * when the screen goes, and in-page links scroll instead of changing the
 * hash, which the game's router owns.
 */
export function mountGuide(shadow: ShadowRoot, A: string): () => void {
  const host = shadow.querySelector('.gx')
  const undo = []
  const timers = new Set()
  const setTimeout = (fn, ms) => { const id = window.setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id); return id }
  const setInterval = (fn, ms) => { const id = window.setInterval(fn, ms); timers.add(id); return id }
  const clearInterval = (id) => { timers.delete(id); window.clearInterval(id) }
  const addEventListener = (type, fn, opts) => { window.addEventListener(type, fn, opts); undo.push(() => window.removeEventListener(type, fn, opts)) }
  /* @property does not reach into a shadow tree: register the level-up card's running light here. */
  try { CSS.registerProperty({ name: '--run', syntax: '<angle>', inherits: false, initialValue: '0deg' }) } catch {}
  /* the shop buttons open the game's Shop on their tab; links to a chapter scroll there (under the game's top bar: scroll-margin-top) */
  host.addEventListener('click', (e) => {
    const shop = e.target.closest('[data-shop]')
    if (shop) { e.preventDefault(); window.location.hash = '#/shop?c=' + shop.dataset.shop; return }
    const a = e.target.closest('a[href^="#"]')
    if (!a) return
    e.preventDefault()
    const target = shadow.getElementById(a.getAttribute('href').slice(1))
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  const FA = (w) => `${A}/fighters/${w}.webp`
  const BG = (e) => `${A}/fighter/classes/backgrounds/full/full_background_${e}.jpeg`
  const EL = (e) => `${A}/icons/elements/${e}.svg`
  const $ = (s, r = shadow) => r.querySelector(s)
  const $$ = (s, r = shadow) => [...r.querySelectorAll(s)]
  const gc = (who, el, lv, name, cls = '') => `<span class="gc ${cls}"><span style="background-image:url('${BG(el)}')"><img class="art" src="${FA(who)}" alt=""></span><i class="lv"><b>${lv}</b></i><img class="el" src="${EL(el)}" alt=""><span class="nm">${name || who.split('_')[0]}</span></span>`
  for (const el of $$('[data-f]')) { const [w, e, l] = el.dataset.f.split(','); el.outerHTML = gc(w, e, l, el.dataset.name, el.className.replace('gc', '').trim()) }

  /* ---------- the loop ---------- */
  const LOOP = [
    ['/markers/buildings/tavern.svg', 'Recruit', 'at taverns', 'Reveal and hire alien fighters at your taverns on the map. Each has a class, a race, an element and abilities.', 'recruit'],
    [['/markers/buildings/dungeon.svg', '/markers/buildings/arena.svg'], 'Fight', 'dungeons & arenas', 'Send five fighters plus an NFT fighter into automatic fights. Wins earn XP and Reward Power.', 'dungeons'],
    ['menu/rewards.svg', 'Mine', 'TLM & Shards', 'Bank 10,000 Reward Power and mine 1% of a pool, straight to your wallet.', 'rewards'],
    ['menu/ascension.svg', 'Grow', 'level & ascend', 'Pay paydays, level fighters up to 10, ascend the best, trade the rest on the Market.', 'upkeep'],
    ['menu/tournament.svg', 'Compete', 'tournaments & boards', 'Take your strongest team into tournaments and climb the leaderboards for TLM and WAX.', 'tournament'],
  ]
  const loopIcon = (ic) => `<img src="${A}${ic[0] === '/' ? '' : '/icons/'}${ic}" alt="">`
  $('#loop').innerHTML = LOOP.map(([ic, b, s], i) => `${i ? '<span class="arrow">→</span>' : ''}<button data-i="${i}">${Array.isArray(ic) ? `<span class="ics">${ic.map(loopIcon).join('')}</span>` : loopIcon(ic)}<b>${b}</b><small>${s}</small></button>`).join('')
  const pickLoop = (i) => { $$('#loop button').forEach((b, k) => b.classList.toggle('on', k === i)); $('#loopnote').innerHTML = `${LOOP[i][3]} <a href="#${LOOP[i][4]}" style="color:var(--cyan)">Read more ↓</a>` }
  $('#loop').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pickLoop(+b.dataset.i) })
  pickLoop(0)

  /* ---------- contents ---------- */
  const toc = $('#toc')
  let part = null
  for (const node of $('#main').children) {
    if (node.classList.contains('part')) { toc.insertAdjacentHTML('beforeend', `<h4>${node.textContent}</h4>`); continue }
    if (node.tagName !== 'SECTION') continue
    const title = node.querySelector('h2').textContent
    toc.insertAdjacentHTML('beforeend', `<a href="#${node.id}" data-id="${node.id}"><img src="${A + (node.dataset.icon[0] === '/' ? '' : '/icons/') + node.dataset.icon}" alt="">${title}</a>`)
  }
  /* the chapter in view, for the contents and the phone's chapter bar */
  const CH = $$('section.ch')
  let chOn = 0
  const spy = () => {
    let i = 0
    CH.forEach((s, k) => { if (!s.classList.contains('hide') && s.getBoundingClientRect().top < 180) i = k })
    chOn = i
    const on = CH[i] && CH[i].id
    $$('.toc a').forEach((a) => a.classList.toggle('on', a.dataset.id === on))
    const sec = CH[i]
    if (!sec) return
    $('#mnavtitle').textContent = sec.querySelector('h2').textContent
    let part = sec.previousElementSibling
    while (part && !part.classList.contains('part')) part = part.previousElementSibling
    $('#mnavpart').textContent = part ? part.textContent : ''
    $('#mnavprev').disabled = i === 0
    $('#mnavnext').disabled = i === CH.length - 1
  }
  const goChapter = (k) => { const s = CH[Math.max(0, Math.min(CH.length - 1, k))]; if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  $('#mnavprev').onclick = () => goChapter(chOn - 1)
  $('#mnavnext').onclick = () => goChapter(chOn + 1)
  $('#mnavopen').onclick = () => $('#toc').classList.add('open')
  $('#tocclose').onclick = () => $('#toc').classList.remove('open')
  $('#toc').addEventListener('click', (e) => { if (e.target.closest('a')) $('#toc').classList.remove('open') })
  addEventListener('scroll', spy, { passive: true }); spy()

  /* ---------- currencies ---------- */
  const COINS = {
    Energy: ['energy.svg', '#4ee07a', 'Your action budget.', ['Daily flask', 'Legend Pass flask', 'Shop (credits)'], ['Travel', 'Recruits', 'Dungeons', 'Arenas', 'Tournaments'], 'Claim the <b>free flask</b> in the Shop once a day (resets 00:00 UTC). With a <b>Legend Pass</b> the flask is much bigger.'],
    Credits: ['credits.svg', '#f2c35a', "The game's working money.", ['Farming', 'Selling fighters back', 'Your lands', 'Shop (gems)'], ['Paydays', 'Level-ups', 'Ascension', 'Re-rolls', 'Boosts', 'Energy']],
    Gems: ['gems.svg', '#b48cff', 'Premium currency.', ['Shop (WAX)', 'Market sales'], ['Credits', 'Legend Pass', 'Market bids', 'The Candle']],
    WAX: ['wax-coin.webp', '#f7b53b', "The blockchain's own coin.", ['Tournament prizes', 'Candle prizes', 'Swapping TLM'], ['Sign-up', 'Gems', 'Alien Worlds NFTs']],
    TLM: ['tlm.svg', '#e8c26a', 'Your main reward.', ['Mining', 'Quests', 'Leaderboards', 'Tournaments', 'Candle', 'Your lands'], ['Swap for WAX', "Keep it: it's yours"]],
    Shards: ['shards.svg', '#d16bff', 'Alien Worlds shards.', ['Mining', 'Quests', 'Candle', 'Your lands'], ['AW Outpost in the Shop']],
  }
  const coinBtn = (n) => `<button class="coin" role="tab" aria-selected="false" data-c="${n}" style="--c:${COINS[n][1]}"><span><img src="${A}/icons/${COINS[n][0]}" alt=""></span><b>${n}</b></button>`
  const coinGrp = (h, sub, ns) => `<div class="coingrp"><h5>${h}<small>${sub}</small></h5><div>${ns.map(coinBtn).join('')}</div></div>`
  $('#coins').innerHTML = coinGrp('In-game', 'to play with', ['Energy', 'Credits', 'Gems']) + '<i></i>' + coinGrp('Rewards', 'paid to your wallet', ['TLM', 'Shards', 'WAX'])
  let coinOn = null
  const pickCoin = (n) => {
    coinOn = coinOn === n ? null : n
    $$('.coin').forEach((c) => { const on = c.dataset.c === coinOn; c.classList.toggle('on', on); c.setAttribute('aria-selected', on) })
    $('#coinx').classList.toggle('open', !!coinOn)
    $('#coinhint').classList.toggle('hide', !!coinOn)
    if (!coinOn) return
    const [ic, c, role, from, on, note] = COINS[coinOn]
    const chips = (xs) => `<span class="chips">${xs.map((x) => `<span>${x}</span>`).join('')}</span>`
    const box = $('#coinbox')
    box.style.setProperty('--c', c)
    box.innerHTML = `<h3><img src="${A}/icons/${ic}" alt="">${coinOn}</h3><p>${role}</p><div class="coinrow"><small>Get it</small>${chips(from)}</div><div class="coinrow"><small>Spend it</small>${chips(on)}</div>${note ? `<div class="note">${note}</div>` : ''}`
  }
  $('#coins').addEventListener('click', (e) => { const b = e.target.closest('.coin'); if (b) pickCoin(b.dataset.c) })

  /* ---------- the map ---------- */
  const PLANETS = ['eyeke', 'kavian', 'magor', 'naron', 'neri', 'veles']
  const B = (k) => `${A}/markers/buildings/${k}.svg`
  const SPOTS = [
    { k: 'tavern', x: 33, y: 24, name: 'Tavern', role: 'Tavern', say: 'Reveal and hire a recruit here.' },
    { k: 'dungeon', x: 13, y: 33, boost: '1.2x', name: 'Mossfang Dungeon', role: 'Dungeon', say: 'Fight its team at a difficulty you pick.' },
    { k: 'arena', x: 37, y: 41, boost: '1.1x', name: 'Rustpit Arena', role: 'Arena', say: 'Beat the team other trainers left here.' },
    { k: 'dungeon', x: 59, y: 36, boost: '3.8x', hot: 1, name: 'Ember Hollow', role: 'Dungeon', say: 'One of the highest boosts right now.' },
    { k: 'arena', x: 80, y: 24, boost: '5.7x', hot: 1, name: 'Sunspire Arena', role: 'Arena', say: 'The top boost on the map: the best rewards.' },
    { k: 'portal-veles', x: 22, y: 70, name: 'Portal to Veles', role: 'Portal', say: 'Warp to Veles, onto the same spot.', portal: 'veles' },
    { k: 'dungeon', x: 67, y: 77, boost: '1.3x', name: 'Tidewall Dungeon', role: 'Dungeon', say: 'Fight its team at a difficulty you pick.' },
    { k: 'tavern', x: 31, y: 82, name: 'Tavern', role: 'Tavern', say: 'Reveal and hire a recruit here.' },
  ]
  let planet = 'eyeke', me = { x: 21, y: 31 }, picked = null
  const gmap = $('#gmap')
  $('#gtabs').innerHTML = PLANETS.map((w) => `<button data-p="${w}"><img src="${A}/landing/worldcard-${w}-360.webp" alt="">${w}</button>`).join('')
  const cost = (s) => Math.round(5 + Math.hypot((s.x - me.x) * 0.4, (s.y - me.y) * 0.2))
  const drawMap = () => {
    gmap.style.backgroundImage = `url('${A}/maps/${planet}.webp')`
    $$('#gtabs button').forEach((b) => b.classList.toggle('on', b.dataset.p === planet))
    const s = picked !== null ? SPOTS[picked] : null
    const here = s && s.x === me.x && s.y === me.y
    const route = s && !here ? `<svg class="route" viewBox="0 0 100 100" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="M${me.x} ${me.y} Q${(me.x + s.x) / 2} ${Math.min(me.y, s.y) - 12} ${s.x} ${s.y}"/></svg>` : ''
    const btn = !s ? '' : here
      ? (s.portal ? '<button class="go" data-act="warp">Warp</button>' : '<button class="go" data-act="enter">Enter</button>')
      : `<button data-act="travel">Travel <img src="${A}/icons/energy.svg" alt="">${cost(s)}</button>`
    const card = s ? `<div class="landcard" style="left:${Math.min(72, Math.max(24, s.x))}%;top:${s.y}%"><div><b>${s.name}</b><small>${s.role}${s.boost ? ' · ' + s.boost : ''}</small><span>${s.say}</span></div>${btn}</div>` : ''
    gmap.innerHTML = route + SPOTS.map((sp, i) => `<button class="mk${sp.hot ? ' hot' : ''}${picked === i ? ' on' : ''}" data-i="${i}" style="left:${sp.x}%;top:${sp.y}%"><img src="${B(sp.k)}" alt="${sp.role}">${sp.boost ? `<em>${sp.boost}</em>` : ''}</button>`).join('') + `<span class="gme" style="left:${me.x}%;top:${me.y}%"><b>YOU</b><i></i></span>` + card
  }
  gmap.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')
    if (act) {
      const s = SPOTS[picked]
      if (act.dataset.act === 'travel') { me = { x: s.x, y: s.y }; drawMap(); return }
      if (act.dataset.act === 'warp') { planet = s.portal; gmap.classList.remove('warp'); void gmap.offsetWidth; gmap.classList.add('warp'); drawMap(); return }
      if (act.dataset.act === 'enter') { act.textContent = 'You\'re in!'; return }
    }
    const m = e.target.closest('.mk')
    picked = m ? (+m.dataset.i === picked ? null : +m.dataset.i) : null
    drawMap()
  })
  $('#gtabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { planet = b.dataset.p; drawMap() } })
  drawMap()

  /* ---------- the tavern ---------- */
  /* Real Alien Worlds templates and their traits; the objectives are an example. */
  const WANTS = [['rarity', 'Epic', 'An Epic card', 30], ['element', 'Fire', 'A Fire card', 25], ['race', 'Nordic', 'A Nordic card', 20], ['shine', 'Gold', 'A Gold-shine card', 15]]
  const NFTS = [
    { id: 141526, name: 'Enhanced Reptiloid', rarity: 'Epic', shine: 'Gold', element: 'Gem', race: 'Reptiloid' },
    { id: 141445, name: 'Plasma Shield', rarity: 'Common', shine: 'Gold', element: 'Fire' },
    { id: 141546, name: 'Wise Ancient One', rarity: 'Rare', shine: 'Stardust', element: 'Air', race: 'Nordic' },
    { id: 141566, name: 'Explosives Specialist', rarity: 'Rare', shine: 'Antimatter', element: 'Fire', race: 'Human' },
    { id: 19642, name: 'Storm Giant', rarity: 'Legendary', shine: 'Stone', element: 'Neutral', race: 'Nordic' },
    { id: 19582, name: 'Waxon Fire Sword', rarity: 'Mythical', shine: 'Stone', element: 'Fire' },
    { id: 48187, name: 'Basic Trilium Detector', rarity: 'Common', shine: 'Stardust' },
  ]
  let table = []
  /* As the contract counts it: card by card, each objective claimed by the first card that meets it. */
  const tally = (ids) => {
    const left = new Set(WANTS.keys()), per = []
    for (const id of ids) {
      const n = NFTS.find((c) => c.id === id), got = []
      for (const w of [...left]) if (n[WANTS[w][0]] === WANTS[w][1]) { got.push(w); left.delete(w) }
      per.push(got)
    }
    return { per, met: new Set([...WANTS.keys()].filter((w) => !left.has(w))), off: per.flat().reduce((a, w) => a + WANTS[w][3], 0) }
  }
  const tavern = (msg) => {
    const t = tally(table), cost = 100 - t.off, E = `<img src="${A}/icons/energy.svg" alt="">`
    $('#tcost').innerHTML = E + cost
    $('#tprev').classList.toggle('hide', !t.off)
    $('#tpay').style.width = cost + '%'; $('#tcut').style.width = t.off + '%'
    $('#tslots').innerHTML = [0, 1, 2].map((i) => {
      const id = table[i]
      if (!id) return `<div class="tslot empty"><i>${i + 1}</i>Pick a card below</div>`
      const n = NFTS.find((c) => c.id === id), g = t.per[i].reduce((a, w) => a + WANTS[w][3], 0)
      return `<button class="tslot${g ? ' on' : ''}" data-id="${id}"><img src="${A}/cards/${id}.webp" alt=""><b>${n.name}</b>${g ? `<em>−${g}</em>` : '<em class="no">no match</em>'}</button>`
    }).join('')
    $('#wants').innerHTML = WANTS.map(([, , label, v], w) => `<span class="want${t.met.has(w) ? ' met' : ''}">${label}<em>−${v}</em></span>`).join('')
    $('#nfts').innerHTML = NFTS.map((n) => {
      const on = table.includes(n.id)
      const g = on ? t.per[table.indexOf(n.id)].reduce((a, w) => a + WANTS[w][3], 0) : tally([...table, n.id]).off - t.off
      const traits = [n.rarity, n.shine, n.element, n.race].filter(Boolean).join(' · ')
      const fits = WANTS.some(([k, v]) => n[k] === v)
      return `<button class="nft${on ? ' picked' : ''}" data-id="${n.id}"><img src="${A}/cards/${n.id}.webp" alt=""><b>${n.name}</b><small>${traits}</small>${g ? `<em>−${g}</em>` : `<em class="no">${fits ? 'already met' : 'no match'}</em>`}</button>`
    }).join('')
    $('#thire').innerHTML = `Hire for ${E}${cost}`
    $('#hirenote').innerHTML = msg || (!table.length
      ? 'Every hire starts at <b>100 energy</b>. Each card you show takes off the objectives it meets: one card can meet several.'
      : t.off === 90 ? '<b>Every objective met.</b> The hire costs <b>10 energy</b>, and all three cards stay in your wallet.'
      : `<b>${t.off} energy off.</b> An objective counts once: a second card that meets it takes nothing more off.`)
  }
  $('#nfts').addEventListener('click', (e) => {
    const b = e.target.closest('.nft'); if (!b) return
    const id = +b.dataset.id
    if (table.includes(id)) { table = table.filter((x) => x !== id); tavern(); return }
    if (table.length >= 3) { tavern('<b>The table is full.</b> A hire takes up to 3 cards: tap one on the table to take it back.'); $(`.nft[data-id="${id}"]`).classList.add('shake'); return }
    table = [...table, id]; tavern()
  })
  $('#tslots').addEventListener('click', (e) => { const b = e.target.closest('.tslot[data-id]'); if (b) { table = table.filter((x) => x !== +b.dataset.id); tavern() } })
  $('#tbest').onclick = () => { table = [141526, 141566, 141546]; tavern('<b>Best pick:</b> the Reptiloid meets Epic and Gold at once, then Fire and Nordic. Every objective met for <b>10 energy</b>.') }
  $('#thire').onclick = () => tavern(`<b>Hired!</b> The Lunatic joins your fighters for <b>${100 - tally(table).off} energy</b>. Your cards stay in your wallet.`)
  tavern()

  /* ---------- the codex ---------- */
  const G = { 'gold-up': '#f2c35a', 'green-duble-up': '#4ee07a', 'green-up': '#4ee07a', middle: '#5d86d6', 'red-down': '#ff4d5e', 'red-duble-down': '#ff4d5e' }
  const GL = { 'gold-up': 'Exceptional for its class', 'green-duble-up': 'Very good for its class', 'green-up': 'Good for its class', middle: 'Average for its class', 'red-down': 'Below average for its class', 'red-duble-down': 'Poor for its class' }
  const CXS = [
    ['damage', 'Damage', '172', '18', 9, 'green-duble-up'],
    ['health', 'Health', '126', '11', 3, 'red-down'],
    ['taunt', 'Taunt', '22', '5', 3, null],
    ['attackspeed', 'Cooldown', '89', '17', 5, 'middle'],
    ['initiative', 'Wind-up', '41', '5', 10, 'gold-up'],
  ]
  const CXR = [['gem', 45, 'middle'], ['metal', 36, 'red-down'], ['air', 59, 'green-up'], ['fire', 71, 'green-duble-up'], ['nature', 23, 'red-duble-down'], ['neutral', 47, 'middle']]
  const EC = { gem: '#ff5fc8', metal: '#f2c35a', air: '#3fd8ff', fire: '#ff7a2e', nature: '#4ee07a', neutral: '#8f7bff' }
  const EN = (e) => e[0].toUpperCase() + e.slice(1)
  const gradeList = '<div class="grades">' + Object.keys(G).filter((k) => k !== 'green-up').map((k) => `<span><i style="--g:${G[k]}"></i><img src="${A}/icons/arrows/${k}.svg" alt="">${GL[k]}</span>`).join('') + '</div>'
  const CXT = {
    intro: ['Tap anything', 'Each part of the codex explains itself here. The coloured bars and arrows grade the fighter against others of <b>its own class</b>:' + gradeList],
    card: ['The card', 'Its picture, its <b>level</b> in the diamond and its <b>element</b> in the corner. The same card shows up across the game.'],
    kick: ['Status', 'What the fighter is doing: <b>Ready</b>, or busy on the Market, in an arena, a dungeon or a tournament. It also says what it would <b>sell back</b> for in credits.'],
    race: ['Class, race & element', 'Set when it\'s recruited and never change. The <b>element</b> is the element of its blows.'],
    level: ['Level', 'Wins give XP; level up with credits. <b>10 is the max</b>. Each level makes health and damage stronger.'],
    asc: ['Ascended', 'How many times it has been <b>ascended</b>: each time it gained an upgrade you picked.'],
    target: ['Targeting', 'Which enemy it strikes. <b>Highest Taunt</b> goes after whoever draws the most attention.'],
    score: ['Score', 'Its <b>combat score</b>: damage and survival together, a quick way to compare fighters.'],
    age: ['Age', 'A <b>bonus or penalty</b> on health and damage. It shrinks over time and with every win, and can turn into a penalty.'],
    payday: ['Payday', 'Pay it in <b>credits</b> before the date. An overdue fighter can\'t fight or be sold, and is <b>deleted</b> if it stays unpaid.'],
    ability: ['Abilities', 'Special talents that trigger on their own in a fight. The ribbon shows its <b>rarity</b>; a <b>locked</b> one opens at a higher ascension level.'],
  }
  const statText = {
    damage: 'How hard each blow lands, before the target\'s resistance.',
    health: 'How much it can take before it\'s knocked out.',
    taunt: 'Draws enemy blows; drops a little each time the fighter is hit. A role, so it isn\'t graded.',
    attackspeed: 'Time between its blows. <b>Lower is better.</b>',
    initiative: 'How soon it strikes first. <b>Lower is better.</b>',
  }
  const box = (key, html, cls = '') => `<span class="cx ${cls}" data-x="${key}">${html}</span>`
  $('#codex').innerHTML = `
    <div class="cxhead">
      ${box('card', gc('voidwarden_khaured', 'air', 10, 'Voidwarden'))}
      <div class="cxtitle">
        ${box('kick', 'Ready · sells for 888', 'cxkick')}
        <h3 class="cxname">Voidwarden</h3>
        ${box('race', `<img src="${EL('air')}" alt="">Khaured · Air`, 'cxrace')}
        <div class="cxchips">${box('level', 'Level 10 · max')}${box('asc', 'Ascended 2')}${box('target', '◎ Highest Taunt')}</div>
      </div>
      <span class="cxscore cx" data-x="score"><b>84</b><small>SCORE</small></span>
    </div>
    <div class="cxup">${box('age', 'Age <b class="neg">−1%</b>')}${box('payday', 'Next payday <b>11 Nov</b>')}${box('payday', 'Pay now <b>549</b>')}</div>
    <div class="cxsec">Stats</div>
    ${CXS.map(([ic, n, v, pm, f, g]) => `<div class="cxstat cx" data-x="stat:${ic}"><small><img src="${A}/icons/stats/${ic}.svg" alt="">${n}</small><span class="cxseg" style="--g:${g ? G[g] : '#8d9bb8'}">${Array.from({ length: 10 }, (_, k) => `<i class="${k < f ? 'f' : ''}"></i>`).join('')}</span><b>${v} <small>±${pm}</small></b>${g ? `<img src="${A}/icons/arrows/${g}.svg" alt="">` : '<i></i>'}</div>`).join('')}
    <div class="cxsec">Resistances</div>
    <div class="cxres">${CXR.map(([e, v, g]) => `<span class="cx" data-x="res:${e}"><span class="hex" style="--ec:${EC[e]}"><span><img src="${EL(e)}" alt=""></span></span><b>${v}%<img class="g" src="${A}/icons/arrows/${g}.svg" alt=""></b></span>`).join('')}</div>
    <div class="cxsec">Abilities</div>
    <div class="cxab cx" data-x="ability" style="--r:#9aa4b8"><span class="rib"><i>Common</i></span><b>Void Damage</b><p>This fighter deals void damage, ignoring 67% of resistance when striking</p></div>
    <div class="cxab cx" data-x="ability" style="--r:#c9d3e6"><span class="rib"><i>Unique</i></span><b>Sacrifice</b><p>Needed for ascension of another fighter from the same class</p></div>
    <div class="cxab cx locked" data-x="ability" style="--r:#3fd8ff"><span class="rib"><i>Rare</i><i class="lock">Locked</i></span><span class="row"><b>Group Buff: Air Damage</b><em>Unlocks at ascension 5</em></span><p>Before combat, increases allied air damage by 6%</p></div>`
  const explainCx = (key) => {
    let t, h
    if (key.startsWith('stat:')) {
      const [ic, n, v, pm, , g] = CXS.find((x) => x[0] === key.slice(5))
      t = n; h = `${statText[ic]} The fight rolls it fresh each time, within <b>${v} ±${pm}</b>.${g ? ` This one is <b>${GL[g].toLowerCase()}</b>.` : ''}`
    } else if (key.startsWith('res:')) {
      const [e, v, g] = CXR.find((x) => x[0] === key.slice(4))
      t = EN(e) + ' resistance'; h = `${EN(e)} blows on this fighter lose <b>${v}%</b> of their damage (never more than 80%). That's <b>${GL[g].toLowerCase()}</b>.`
    } else [t, h] = CXT[key]
    $('#cxwhat').innerHTML = `<small>${key === 'intro' ? 'The codex' : 'What\'s this?'}</small><h4>${t}</h4><p>${h}</p>`
    $$('#codex .cx').forEach((x) => x.classList.toggle('on', x.dataset.x === key))
  }
  $('#codex').addEventListener('click', (e) => { const x = e.target.closest('.cx'); if (x) explainCx(x.dataset.x) })
  explainCx('intro')

  /* ---------- building a team ---------- */
  const RIM = { metal: '#d9e4ff', air: '#9fe6ff', nature: '#7dffb0', gem: '#c8b4ff', fire: '#ffb070', neutral: '#dfe3ee' }
  const rc = (f, i, cls = '') => `<button class="rc ${cls}" data-i="${i}" style="--ec:${RIM[f.el]}"><span class="pic" style="background-image:url('${BG(f.el)}')"><img src="${FA(f.art)}" alt=""></span><span class="lv"><b>${f.lv}</b></span>${f.asc ? `<span class="asc">✦${f.asc}</span>` : ''}<img class="el" src="${EL(f.el)}" alt=""><span class="nm${f.art.split('_')[0].length > 10 ? ' long' : ''}">${f.art.split('_')[0]}</span><span class="xp"></span>${cls.includes('picked') ? '<span class="tag team">In team</span>' : f.busy ? `<span class="tag ${f.due ? 'payday' : 'market'}">${f.busy}</span>` : ''}</button>`
  /* Example fighters; the ability texts are the game's own. */
  const AB = {
    debuff: ['Common', '#9aa4b8', 'Group Debuff: Windup', 'Before combat, increases the windup of all opposing fighters by 3.0'],
    dmaster: ['Common', '#9aa4b8', 'Dungeon Master', 'Has 16.2 increased damage and 16.2 increased health in dungeons'],
    amaster: ['Rare', '#3fd8ff', 'Arena Master', 'Has 17.3 increased damage and 18.6 increased health in arenas', 1],
    void: ['Common', '#9aa4b8', 'Void Damage', 'This fighter deals void damage, ignoring 67% of resistance when striking'],
    sac: ['Unique', '#c9d3e6', 'Sacrifice', 'Needed for ascension of another fighter from the same class'],
    airbuff: ['Rare', '#3fd8ff', 'Group Buff: Air Damage', 'Before combat, increases allied air damage by 6%', 1],
  }
  const TEAM = [
    { art: 'voidwarden_khaured', el: 'air', lv: 10, asc: 2, race: 'Khaured', age: -1, tg: 'Highest Taunt', st: [[41, 8, 2, 'red-duble-down'], [185, 24, 2, 'red-duble-down'], [84, 5, 6], [45, 17, 7, 'green-up'], [46, 5, 7, 'green-up']], res: [[48, 'middle'], [30, 'red-down'], [59, 'green-up'], [71, 'green-duble-up'], [47, 'middle'], [45, 'green-up']], ab: ['void', 'sac', 'airbuff'] },
    { art: 'voidcaller_elgem', el: 'nature', lv: 10, asc: 1, race: 'Elgem', age: 69, tg: 'Highest Taunt', st: [[92, 20, 4, 'red-down'], [93, 45, 4, 'red-down'], [30, 6, 5], [54, 10, 5, 'middle'], [76, 15, 5, 'middle']], res: [[21, 'red-down'], [41, 'green-up'], [43, 'green-up'], [31, 'middle'], [36, 'middle'], [43, 'green-duble-up']], ab: ['debuff', 'dmaster', 'amaster'] },
    { art: 'lunatic_human', el: 'air', lv: 10, asc: 3, race: 'Human', age: 57, tg: 'Lowest Health', st: [[188, 21, 9, 'green-duble-up'], [96, 12, 4, 'red-down'], [18, 3, 2], [52, 9, 6, 'green-up'], [38, 6, 8, 'green-up']], res: [[33, 'middle'], [41, 'middle'], [62, 'green-up'], [29, 'red-down'], [38, 'middle'], [40, 'middle']], ab: ['dmaster', 'void', 'amaster'] },
    { art: 'astralknight_lopati', el: 'metal', lv: 9, asc: 0, race: 'Lopati', age: 24, tg: 'Highest Damage', st: [[121, 14, 6, 'middle'], [240, 30, 8, 'green-duble-up'], [96, 8, 8], [70, 11, 4, 'red-down'], [61, 9, 5, 'middle']], res: [[52, 'green-up'], [64, 'green-duble-up'], [35, 'middle'], [40, 'middle'], [28, 'red-down'], [44, 'middle']], ab: ['sac', 'dmaster', 'airbuff'] },
    { art: 'hunter_elgem', el: 'nature', lv: 8, asc: 0, race: 'Elgem', age: 41, tg: 'Lowest Health', st: [[150, 16, 7, 'green-up'], [118, 13, 5, 'middle'], [25, 4, 3], [48, 8, 7, 'green-up'], [44, 7, 7, 'green-up']], res: [[36, 'middle'], [31, 'red-down'], [44, 'middle'], [37, 'middle'], [58, 'green-up'], [39, 'middle']], ab: ['amaster', 'void', 'debuff'] },
    { art: 'mystic_altan', el: 'air', lv: 7, asc: 0, race: 'Altan', age: 12, tg: 'Highest Taunt', st: [[172, 18, 9, 'green-duble-up'], [126, 11, 5, 'middle'], [22, 5, 3], [89, 17, 5, 'middle'], [41, 5, 10, 'gold-up']], res: [[45, 'middle'], [36, 'red-down'], [59, 'green-up'], [71, 'green-duble-up'], [23, 'red-duble-down'], [47, 'middle']], ab: ['debuff', 'sac', 'airbuff'] },
    { art: 'tactician_elgem', el: 'gem', lv: 9, asc: 1, race: 'Elgem', age: 30, tg: 'Highest Damage', busy: 'Market', st: [[110, 12, 5, 'middle'], [150, 18, 6, 'green-up'], [40, 6, 5], [60, 10, 5, 'middle'], [55, 8, 6, 'middle']], res: [[60, 'green-up'], [35, 'middle'], [40, 'middle'], [33, 'middle'], [41, 'middle'], [38, 'middle']], ab: ['dmaster', 'sac', 'amaster'] },
    { art: 'desperado_human', el: 'neutral', lv: 6, asc: 0, race: 'Human', age: -8, tg: 'Lowest Health', busy: 'Payday', due: 1, st: [[133, 15, 6, 'green-up'], [102, 12, 4, 'red-down'], [20, 3, 2], [58, 9, 6, 'middle'], [50, 7, 6, 'middle']], res: [[30, 'red-down'], [38, 'middle'], [36, 'middle'], [42, 'middle'], [35, 'middle'], [55, 'green-up']], ab: ['amaster', 'void', 'debuff'] },
    { art: 'juggernaut_khaured', el: 'metal', lv: 8, asc: 0, race: 'Khaured', age: 35, tg: 'Highest Taunt', st: [[98, 11, 4, 'red-down'], [260, 28, 9, 'green-duble-up'], [110, 9, 9], [75, 12, 4, 'red-down'], [66, 9, 4, 'middle']], res: [[55, 'green-up'], [66, 'green-duble-up'], [33, 'middle'], [45, 'middle'], [30, 'red-down'], [40, 'middle']], ab: ['sac', 'dmaster', 'amaster'] },
  ]
  const STN = [['damage', 'Damage'], ['health', 'Health'], ['taunt', 'Taunt'], ['attackspeed', 'Cooldown'], ['initiative', 'Wind-up']]
  const REN = ['gem', 'metal', 'air', 'fire', 'nature', 'neutral']
  let team = []
  const hovc = document.createElement('div')
  hovc.className = 'hovc hide'
  host.append(hovc)
  const segs = (n, g) => `<i style="--g:${g ? G[g] : '#8d9bb8'}">${Array.from({ length: 12 }, (_, k) => `<u class="${k < Math.round(n * 1.2) ? 'f' : ''}"></u>`).join('')}</i>`
  const hoverCard = (f) => `<h4>${f.art.split('_')[0]}</h4>
    <div class="ln"><img src="${EL(f.el)}" alt="">${f.race} · ${EN(f.el)}<span>Level ${f.lv}</span><span class="${f.age >= 0 ? 'g' : ''}">Age ${f.age >= 0 ? '+' : '−'}${Math.abs(f.age)}%</span></div>
    <div class="cols"><div>${f.st.map(([v, pm, n, g], k) => `<div class="r"><em><img src="${A}/icons/stats/${STN[k][0]}.svg" alt="">${STN[k][1]}</em>${segs(n, g)}<b>${v} <small>±${pm}</small></b>${g ? `<img src="${A}/icons/arrows/${g}.svg" alt="">` : '<span></span>'}</div>`).join('')}</div>
    <div>${f.res.map(([v, g], k) => `<div class="r"><em><img src="${EL(REN[k])}" alt="">${REN[k]}</em>${segs(v / 10, g)}<b>${v}%</b><img src="${A}/icons/arrows/${g}.svg" alt=""></div>`).join('')}</div></div>
    <div class="tg">◎ Targets <b>${f.tg}</b></div>
    <div class="abs">${f.ab.map((k, j) => { const [r, c, n, d, lock] = AB[k]; return `<div class="ab${j === 2 ? ' wide' : ''}" style="--r:${c}"><span class="rib"><i>${r}</i>${lock ? '<i class="lock">Locked</i>' : ''}</span><b>${n}</b>${d}</div>` }).join('')}</div>`
  const drawTeam = (note) => {
    $('#tmgrid').innerHTML = TEAM.map((f, i) => rc(f, i, `${team.includes(i) ? 'picked' : ''} ${f.busy ? 'busy' : ''} ${f.due ? 'due' : ''}`)).join('')
    $('#tmslots').innerHTML = [0, 1, 2, 3, 4].map((k) => (team[k] !== undefined ? `<span class="tmslot full">${rc(TEAM[team[k]], team[k], 'slotted')}</span>` : `<span class="tmslot">Fighter ${k + 1}</span>`)).join('') +
      `<span class="tmslot nft"><span><img src="${A}/cards/141566.webp" alt="">Crew</span><span><img src="${A}/cards/19582.webp" alt="">Weapon</span></span>`
    $('#tmmini').innerHTML = [0, 1, 2, 3, 4].map((k) => (team[k] !== undefined ? `<i style="background-image:url('${FA(TEAM[team[k]].art)}')"></i>` : '<i></i>')).join('')
    $('#tmcount').textContent = `${team.length}/5`
    $('#tmbar').textContent = `Your team · ${team.length}/5`
    $('#tmgo').disabled = team.length < 5
    $('#tmnote').innerHTML = note || (team.length === 5 ? '<b>Ready:</b> five fighters and the NFT fighter.' : '')
  }
  const pickTeam = (i) => {
    const f = TEAM[i]
    if (team.includes(i)) { team = team.filter((x) => x !== i); drawTeam(); return }
    if (f.busy) { drawTeam(`<b>${EN(f.art.split('_')[0])} can't fight:</b> ${f.due ? 'its payday is overdue. Pay it in My Fighters first.' : 'it\'s listed on the Market.'}`); $(`#tmgrid .rc[data-i="${i}"]`).classList.add('shake'); return }
    if (team.length >= 5) { drawTeam('<b>The team is full.</b> Tap a fighter in it to take it out.'); return }
    team = [...team, i]; drawTeam()
  }
  $('#tmgrid').addEventListener('click', (e) => { const b = e.target.closest('.rc'); if (b) pickTeam(+b.dataset.i) })
  $('#tmslots').addEventListener('click', (e) => { const b = e.target.closest('.rc'); if (b) pickTeam(+b.dataset.i) })
  $('#tmgo').onclick = () => drawTeam('<b>Off they go!</b> The fight runs by itself; next, see how it plays.')
  /* The overlay: only where the pointer can rest, as in the game. */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let timer = null
    $('#tmgrid').addEventListener('pointerover', (e) => {
      const b = e.target.closest('.rc'); if (!b) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        hovc.innerHTML = hoverCard(TEAM[+b.dataset.i]); hovc.classList.remove('hide')
        const r = b.getBoundingClientRect(), w = hovc.offsetWidth, h = hovc.offsetHeight
        let top = r.bottom + 8; if (top + h > innerHeight - 16) top = Math.max(16, r.top - 8 - h)
        hovc.style.top = top + 'px'; hovc.style.left = Math.max(16, Math.min(innerWidth - 16 - w, r.left + r.width / 2 - w / 2)) + 'px'
      }, 250)
    })
    $('#tmgrid').addEventListener('pointerout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || e.relatedTarget.closest('.rc') !== e.target.closest('.rc')) { clearTimeout(timer); hovc.classList.add('hide') } })
    addEventListener('scroll', () => hovc.classList.add('hide'), { passive: true })
  }
  drawTeam()

  /* ---------- the fight: the battle and its timeline ---------- */
  /* name, art, side, wind-up, cooldown, health, damage, level, element, where it stands */
  const LANES = [['Your Hunter', 'hunter_elgem', 'me', 40, 60, 150, 30, 8, 'nature', [22, 82]], ['Your Juggernaut', 'juggernaut_khaured', 'me', 70, 110, 220, 25, 8, 'metal', [36, 68]], ['Enemy Mystic', 'mystic_altan', 'them', 55, 90, 200, 35, 9, 'air', [74, 76]]]
  const blows = []
  LANES.forEach(([n, w, s, wu, cd], k) => { for (let t = wu; t <= 400; t += cd) blows.push({ t, k }) })
  blows.sort((a, b) => a.t - b.t || (LANES[a.k][2] === 'me' ? -1 : 1))
  /* Play it out: yours strike the Mystic; the Mystic targets Highest Taunt, the Juggernaut. The fight ends at the knock-out. */
  const hp0 = LANES.map((l) => l[5])
  const states = [hp0.slice()]
  for (const b of blows) {
    const hp = states[states.length - 1].slice()
    b.target = LANES[b.k][2] === 'me' ? 2 : 1
    hp[b.target] = Math.max(0, hp[b.target] - LANES[b.k][6])
    states.push(hp)
    if (hp[2] === 0 || (hp[0] === 0 && hp[1] === 0)) break
  }
  blows.length = states.length - 1
  blows.forEach((b, i) => (b.n = i + 1))
  const TMAX = blows[blows.length - 1].t + 20
  $('#lanes').innerHTML = LANES.map(([n, w, s, wu, cd], k) => `<div class="lane"><span class="who ${s}"><img src="${FA(w)}" alt="">${n}<br><small style="color:var(--faint);font-weight:600">wind-up ${wu} · cooldown ${cd}</small></span><div class="track" data-k="${k}">${blows.filter((b) => b.k === k).map((b) => `<i class="${s}" data-n="${b.n}" style="left:${(b.t / TMAX) * 100}%">${b.n}</i>`).join('')}${k === 0 ? '<span class="clock" id="clock" style="left:0"></span>' : ''}</div></div>`).join('')
  const SIG = { hunter: 'pierce', juggernaut: 'thunderclap', mystic: 'moonbeam' }
  const FX_PARTS = { pierce: 4, thunderclap: 6, moonbeam: 4 }
  const SHAKE = { pierce: 1.8, thunderclap: 1.8, moonbeam: 1 }
  const STAGE = { back: `${A}/stages/planets/eyeke/backdrop-wide.webp`, floor: `${A}/stages/lands/grassland/floor.webp`, ground: `${A}/stages/lands/grassland/ground-wide.webp` }
  const drawBattle = () => {
    const hp = states[step], b = blows[step - 1], before = states[Math.max(0, step - 1)]
    const side = (who) => LANES.map((l, k) => [l, k]).filter(([l]) => l[2] === who)
    const total = (who) => side(who).reduce((a, [l, k]) => a + hp[k], 0) / side(who).reduce((a, [l]) => a + l[5], 0)
    const up = (who) => side(who).filter(([, k]) => hp[k] > 0).length + '/' + side(who).length
    const cls = (w) => w.split('_')[0]
    let fx = ''
    if (b) {
      const [ax, ay] = LANES[b.k][9], [tx, ty] = LANES[b.target][9], sig = SIG[cls(LANES[b.k][1])]
      fx = `<span class="bfx bfx--${sig}" style="--ax:${ax};--ay:${ay};--tx:${tx};--ty:${ty};--da:1;--dt:1;--dir:${LANES[b.k][2] === 'me' ? 1 : -1}">${'<i></i>'.repeat(FX_PARTS[sig])}</span>`
      $('#bv').style.setProperty('--shake', SHAKE[sig])
    }
    $('#bv').classList.remove('shake'); void $('#bv').offsetWidth; $('#bv').classList.toggle('shake', !!b)
    $('#bv').innerHTML = `<img class="bk" src="${STAGE.back}" alt=""><div class="fw"><i style="background-image:url('${STAGE.floor}')"></i></div><img class="gd" src="${STAGE.ground}" alt=""><div class="grade"></div>` +
      `<div class="bvtop"><span class="side me">You ${up('me')}<i><u style="width:${total('me') * 100}%"></u></i></span><span class="mid">${b ? 'Blow ' + b.n : 'Ready'}</span><span class="side them">Dungeon ${up('them')}<i><u style="width:${total('them') * 100}%"></u></i></span></div>` +
      LANES.map(([n, w, s, , , max, dmg, lv, el, [x, y]], k) => {
        const atk = b && b.k === k, def = b && b.target === k && hp[k] > 0
        const by = b ? cls(LANES[b.k][1]) : ''
        const killedNow = b && b.target === k && hp[k] === 0 && before[k] > 0
        const dead = hp[k] === 0
        const share = (v) => (v / max).toFixed(3)
        const band = (v) => (v / max > 0.5 ? 'high' : v / max > 0.25 ? 'mid' : 'low')
        const art = `<img class="art" src="${FA(w)}" alt="">`
        const figure = dead
          ? `<span class="fallen">${art}</span><span class="dust"></span>`
          : `<span class="rig"><img class="art legs" src="${FA(w)}" alt=""><span class="torso">${art}</span></span>${def ? '<span class="flash"></span>' : ''}`
        const hitThis = b && b.target === k
        const amount = hitThis ? LANES[b.k][6] : 0
        const pop = !hitThis ? '' : killedNow ? `<span class="pop kill">${amount}<small>Knocked out</small></span>` : `<span class="pop${amount >= max * 0.3 ? ' big' : ''}">${amount}</span>`
        return `<span class="bu ${s} c-${cls(w)}${atk ? ' atk' : ''}${def ? ' def t-' + by : ''}${dead ? ' dead' : ''}" style="left:${x}%;top:${y}%;--idl:${(-(k * 0.83) % 2.4).toFixed(2)}s;--kod:${killedNow ? 'var(--impact)' : '0s'}"><span class="plat"></span><span class="fig"><span class="body">${figure}</span>${hitThis && (!dead || killedNow) ? '<span class="ret"><i></i><i></i><i></i><i></i></span>' : ''}${pop}</span><span class="over"><span class="plate"><img src="${EL(el)}" alt="">Lv.${lv}</span><span class="hpbar" data-band="${band(hp[k])}" style="--from:${share(before[k])};--to:${share(hp[k])}"><i></i><u></u></span></span></span>`
      }).join('') + fx +
      (step === blows.length ? '<div class="bvend" style="animation-delay:2.2s">Victory<small>The Mystic is down: XP and Reward Power for your team.</small></div>' : '')
    $('#bvcards').innerHTML = LANES.map(([n, w, s, , , , , lv, el], k) => (k === 2 ? '<span class="vs">VS</span>' : '') + gc(w, el, lv, cls(w), `${s}${hp[k] === 0 ? ' ko' : ''}${b && b.k === k ? ' act' : ''}`).replace(/<\/span><\/span>$/, '</span>' + (b && b.k === k ? '<i class="rib a">ACTING</i>' : b && b.target === k ? '<i class="rib t">TARGET</i>' : '') + '</span>')).join('')
  }
  let step = 0, timer = null
  const showStep = () => {
    $$('.track i').forEach((i) => { const n = +i.dataset.n; i.classList.toggle('done', n < step); i.classList.toggle('now', n === step) })
    const b = blows[step - 1]
    $('#clock').style.left = b ? `${(b.t / TMAX) * 100}%` : '0'
    $('#simlog').innerHTML = !b ? 'Lower is better: a fighter with a low wind-up opens the fight, one with a low cooldown strikes often.'
      : `Blow <b>${b.n}</b>: <b>${LANES[b.k][0]}</b> has the lowest wind-up (${b.t}), strikes ${LANES[b.target][0].replace(/^(Your|Enemy) /, 'the ')} for ${LANES[b.k][6]}, and its wind-up grows by its cooldown (${LANES[b.k][4]}) to ${b.t + LANES[b.k][4]}.${step === blows.length ? ' <b>The Mystic is knocked out: you win.</b>' : ''}`
    $('#simstep').disabled = step >= blows.length
    drawBattle()
  }
  $('#simstep').onclick = () => { step = Math.min(blows.length, step + 1); showStep() }
  $('#simreset').onclick = () => { clearInterval(timer); timer = null; $('#simplay').textContent = 'Play'; step = 0; showStep() }
  $('#simplay').onclick = () => { if (timer) { clearInterval(timer); timer = null; $('#simplay').textContent = 'Play'; return } if (step >= blows.length) step = 0; $('#simplay').textContent = 'Pause'; timer = setInterval(() => { step++; showStep(); if (step >= blows.length) { clearInterval(timer); timer = null; $('#simplay').textContent = 'Play' } }, 1700) }
  showStep()

  /* ---------- resistance ---------- */
  const resUp = () => {
    const r = +$('#res').value, eff = Math.min(r, 80), dealt = 100 - eff
    $('#resv').textContent = r + '%'
    $('#hit').style.width = dealt + '%'; $('#blk').style.left = dealt + '%'; $('#blk').style.width = eff + '%'
    $('#dealt').textContent = dealt + ' dealt'; $('#blocked').textContent = eff + ' blocked'; $('#dealtbig').textContent = dealt
    $('#resnote').innerHTML = r > 80 ? `<b>Capped:</b> resistance never blocks more than 80%, so even a ${r}% resistance lets 20 of every 100 through.` : 'Every blow comes in the attacker\'s element, and the target\'s resistance to that element cuts it. There\'s no element chart: resistances decide.'
  }
  $('#res').oninput = resUp; resUp()

  /* ---------- the dungeon ---------- */
  /* Live from the chain: battle.ale level_mod 1.15 and difmod (55/70/85% at 1-3), pools.ale dungeon_difficulty_power_mod 1.07, xp_per_dungeon_difficulty 42, dungeon_nft_fighter_min_difficulty 5. */
  const DG = { first: 1, last: 20, nft: 5, held: { 1: 55, 2: 70, 3: 85 }, xp: 42 }
  const dgPower = (d) => Math.pow(1.15, d) * ((DG.held[d] ?? 100) / 100)
  const dgReward = (d) => Math.pow(1.07, d)
  const DGTEAM = [['hunter_robotron', 'metal'], ['lunatic_khaured', 'fire'], ['mindblade_onoros', 'gem'], ['voidwarden_khaured', 'nature'], ['explosioneer_lopati', 'fire']]
  let dgd = 3, dgSliding = false
  const dgChart = () => {
    const X = (d) => ((d - 1) / 19) * 300, Y = (v) => 88 - (v / dgPower(20)) * 82
    const line = (f) => Array.from({ length: 20 }, (_, i) => `${i ? 'L' : 'M'}${X(i + 1).toFixed(1)} ${Y(f(i + 1)).toFixed(1)}`).join(' ')
    $('#dgchart').innerHTML = `<line x1="0" y1="88" x2="300" y2="88" stroke="rgb(255 255 255 / 15%)"/><line x1="${X(DG.nft)}" y1="4" x2="${X(DG.nft)}" y2="88" stroke="#c9a0ff" stroke-dasharray="3 3" opacity=".6"/><path d="${line(dgPower)}" fill="none" stroke="#ff6a5c" stroke-width="2.5" vector-effect="non-scaling-stroke"/><path d="${line(dgReward)}" fill="none" stroke="#ffe9a6" stroke-width="2.5" vector-effect="non-scaling-stroke"/><line x1="${X(dgd)}" y1="0" x2="${X(dgd)}" y2="88" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity=".8"/><circle cx="${X(dgd)}" cy="${Y(dgPower(dgd))}" r="4" fill="#ff6a5c" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/><circle cx="${X(dgd)}" cy="${Y(dgReward(dgd))}" r="4" fill="#ffe9a6" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
  }
  const dgDraw = () => {
    const d = dgd
    $('#dstep').innerHTML = `<button class="dstep__arrow" data-go="-1" ${d <= DG.first ? 'disabled' : ''} aria-label="Lower difficulty">‹</button><span class="dstep__value">${d}</span><button class="dstep__arrow" data-go="1" ${d >= DG.last ? 'disabled' : ''} aria-label="Higher difficulty">›</button>
      <div class="dstep__side"><span class="dstep__tally"><span class="dstep__label">Difficulty</span>Enemy <b>×${dgPower(d).toFixed(2)}</b> · Rewards <b>×${dgReward(d).toFixed(2)}</b> · <b>${DG.xp * d} XP</b></span>
      <div class="dstep__ticks" id="dticks">${Array.from({ length: DG.last }, (_, i) => i + 1).map((t) => `<button class="dstep__tick${t <= d ? ' dstep__tick--lit' : ''}${t === d ? ' on' : ''}${t === DG.nft ? ' dstep__tick--nft' : ''}" data-d="${t}" title="${t === DG.nft ? `Difficulty ${t}: the dungeon's own NFT fighter joins from here` : `Difficulty ${t}`}" aria-label="Difficulty ${t}"></button>`).join('')}</div></div>`
    $('#dgE').textContent = '×' + dgPower(d).toFixed(2)
    $('#dgR').textContent = '×' + dgReward(d).toFixed(2)
    $('#dgX').textContent = DG.xp * d
    dgChart()
    $$('#dgrow .rc .lv b').forEach((b) => (b.textContent = d))
    $('#dgnft').classList.toggle('in', d >= DG.nft)
    $('#dgsub').textContent = d >= DG.nft ? `fields five fighters at level ${d}, and its own NFT fighter` : `fields five fighters at level ${d}; its NFT fighter joins at ${DG.nft}`
  }
  /* the row is drawn once, so the NFT fighter's card can flip in rather than appear */
  $('#dgrow').innerHTML = DGTEAM.map(([w, e], i) => rc({ art: w, el: e, lv: dgd }, i)).join('') +
    `<div class="dgnft" id="dgnft"><span class="ghost">NFT fighter<small>joins at difficulty ${DG.nft}</small></span><span class="card"><i>NFT fighter</i><span style="background-image:url('${A}/cards/19642.webp')"></span><b>NFT fighter</b></span></div>`
  const dgSet = (d) => { d = Math.max(DG.first, Math.min(DG.last, d)); if (d !== dgd) { dgd = d; dgDraw() } }
  const dgAt = (x) => { let best = dgd, gap = Infinity; $$('#dticks .dstep__tick').forEach((t) => { const r = t.getBoundingClientRect(), g = Math.abs(x - (r.left + r.width / 2)); if (g < gap) { gap = g; best = +t.dataset.d } }); return best }
  $('#dstep').addEventListener('click', (e) => { const a = e.target.closest('[data-go]'); if (a) dgSet(dgd + +a.dataset.go) })
  $('#dstep').addEventListener('pointerdown', (e) => { if (!e.target.closest('#dticks') || e.button !== 0) return; dgSliding = true; e.target.closest('#dticks').setPointerCapture?.(e.pointerId); dgSet(dgAt(e.clientX)) })
  $('#dstep').addEventListener('pointermove', (e) => { if (dgSliding) dgSet(dgAt(e.clientX)) })
  addEventListener('pointerup', () => (dgSliding = false))
  dgDraw()

  /* ---------- an arena's defence ---------- */
  /* Each winner leaves one fighter (picked at random from its five); the arena holds the last five, and the latest winner's NFT fighter. */
  const AQ0 = [['voidcaller_onoros', 'neutral', 'Nova'], ['hunter_altan', 'neutral', 'Kael'], ['astralknight_human', 'nature', 'Ivy'], ['tactician_elgem', 'gem', 'Rook'], ['mystic_altan', 'air', 'You', 1]]
  const AQX = [['lunatic_human', 'fire', 'Vex'], ['mindblade_lopati', 'air', 'Zed'], ['desperado_khaured', 'metal', 'Orin'], ['juggernaut_onoros', 'metal', 'Lyra'], ['voidwarden_human', 'gem', 'Moss']]
  const AQNFT = ['19642', '141566', '141546', '141526', '254355', '141566']
  let aq = [], wins = 0
  const aqCell = ([w, e, who, you], i, cls = '') => `<div class="acell${you ? ' you' : ''}${cls}">${rc({ art: w, el: e, lv: 10 }, i).replace('</button>', you ? '<span class="tag yours">Yours</span></button>' : '</button>')}<small>${you ? 'Your fighter' : who}</small></div>`
  const drawAQ = (move) => {
    $('#arenaq').innerHTML = aq.map((f, i) => aqCell(f, i, move === 'arrive' && i === aq.length - 1 ? ' arrive' : '')).join('') +
      `<div class="acell"><div class="dgnft in${move === 'arrive' ? ' flip' : ''}"><span class="card"><i>NFT fighter</i><span style="background-image:url('${A}/cards/${AQNFT[wins]}.webp')"></span><b>NFT fighter</b></span></div><small>${wins ? AQX[wins - 1][2] + '\'s' : 'Yours'}</small></div>`
    const mine = aq.some((f) => f[3])
    $('#arpips').innerHTML = Array.from({ length: 5 }, (_, k) => `<u class="${k < wins ? 'on' : ''}"></u>`).join('')
    $('#arcount').textContent = mine ? `${wins}/5` : 'free'
  }
  const arenaReset = () => { aq = AQ0.slice(); wins = 0; drawAQ(); $('#arenawin').disabled = false; $('#arenalog').innerHTML = '<b>You just won here:</b> one of your five (picked at random) joined the defence, ringed teal, and your NFT fighter holds the last place.' }
  $('#arenawin').onclick = () => {
    if (wins >= AQX.length) return
    $('#arenaq').firstElementChild.classList.add('leave')
    $('#arenawin').disabled = true
    setTimeout(() => {
      aq = [...aq.slice(1), AQX[wins++]]
      drawAQ('arrive')
      const still = aq.some((f) => f[3])
      $('#arenalog').innerHTML = still ? `<b>${AQX[wins - 1][2]} won.</b> The oldest defender left, one of theirs joined, and their NFT fighter took the last place. Yours is still defending.` : `<b>${wins} wins later your fighter has left the defence</b> and is free again. While it held the arena it earned you Arena Domination points.`
      $('#arenawin').disabled = wins >= AQX.length
    }, 380)
  }
  $('#arenareset').onclick = arenaReset
  arenaReset()

  /* ---------- quests ---------- */
  const QS = [['Daily', 'new each day', [['dungeons_won_day', 'Win 3 dungeons', '2 / 3', 66, '0.5 TLM', '1 day left'], ['damage_dealt_day', 'Deal 5,000 damage', 'Done: claim it', 100, '20 Shards', '18 h left']]], ['Weekly', 'new each Thursday', [['arenas_won_week', 'Win 5 arenas', '1 / 5', 20, '2 TLM', '10 days left'], ['ascensions_completed_week', 'Ascend a fighter', '0 / 1', 0, '120 Shards', '3 days left']]], ['Monthly', 'new on the 1st', [['arenas_won_month', 'Win 40 arenas', '12 / 40', 30, '10 TLM', '60 days left'], ['damage_blocked_month', 'Block 50,000 damage', '18,400 / 50,000', 37, '600 Shards', '29 days left']]]]
  $('#qscopes').innerHTML = QS.map(([s, e, items]) => `<div class="q"><h5>${s}<small>${e}</small></h5>${items.map(([img, t, p, pct, r, left]) => `<div class="qi"><img src="${A}/quests/${img}.webp" alt=""><span><b>${t}</b><small>${p} · ${r} · <em>${left}</em></small><span class="qprog"><i style="width:${pct}%"></i></span></span></div>`).join('')}</div>`).join('') + '<p style="grid-column:1/-1;margin:0;font-size:12.5px;color:var(--faint)">Example quests and rewards.</p>'

  /* ---------- the tournament ---------- */
  /* Live from tournmnt.ale: a tournament every 604,800 s; stages get_rewards 2 d, signup 288,000 s, close_signup + create_matchups ~2 h, battle 12 h, then hall_of_fame, reward_payout and cleanup ~2 d later. */
  const TW = [
    ['Preparing', '2 days', '#8d9bb8', 2, '<b>Preparing.</b> The prize pot is set aside for the week. Sign-up opens next.'],
    ['Sign-up', '3 days 8 h', '#19d3c5', 3.33, '<b>Sign-up.</b> Enter your five fighters, crew and weapon. The rest of the week runs without you lifting a finger.'],
    ['Draw', '2 h', '#a67cff', 0.6, '<b>Draw.</b> Sign-up closes, teams are ranked by team score, the top seeds get their free passes and the opening fights are paired.'],
    ['Fights', '12 h', '#ff6a5c', 1, '<b>Fights.</b> Each fight has a set time and plays itself out on the chain. Watch them live or later in the tournament screen. A fight still going after 1,000 blows goes to the higher seed.'],
    ['Prizes', 'then', '#f2c35a', 1.2, '<b>Prizes.</b> The top four go into the Hall of Fame, WAX and TLM are paid into Rewards, and the next week begins.'],
  ]
  $('#tw').innerHTML = TW.map(([n, d, c, w], i) => `<button data-i="${i}" style="--tc:${c};flex:${w} 1 0"><b>${n}</b><small>${d}</small></button>`).join('')
  const twPick = (i) => { $$('#tw button').forEach((b, k) => b.classList.toggle('on', k === i)); $('#twnote').innerHTML = TW[i][4] }
  $('#tw').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) twPick(+b.dataset.i) })
  twPick(1)

  /* to enter: five level-10 fighters */
  const TF = [['voidwarden_khaured', 'air', 2], ['lunatic_human', 'air', 3], ['mindblade_khaured', 'air', 1], ['astralknight_lopati', 'metal', 0], ['hunter_elgem', 'nature', 1]]
  $('#tfive').innerHTML = TF.map(([w, e, a], i) => rc({ art: w, el: e, lv: 10, asc: a }, i)).join('')

  /* team score: each fighter's level, plus 10 per ascension */
  let tasc = TF.map((f) => f[2])
  const tsDraw = () => {
    const pts = tasc.map((a) => 10 + 10 * a), sum = pts.reduce((x, y) => x + y, 0)
    $('#tscore').innerHTML = `<div class="five">${TF.map(([w, e], i) => `<div>${rc({ art: w, el: e, lv: 10, asc: tasc[i] }, i)}<span class="asc"><button data-i="${i}" data-d="-1" aria-label="Fewer ascensions">−</button><span>✦${tasc[i]}</span><button data-i="${i}" data-d="1" aria-label="More ascensions">+</button></span><span class="pts5">${pts[i]}</span></div>`).join('')}</div>
      <div class="sum"><span>Each fighter: its <b style="font:inherit;color:#fff">level</b> + <b style="font:inherit;color:#ffd979">10 per ascension</b>. Try the buttons.</span><b>${sum}</b></div>
      <p style="margin:0;font-size:13.5px;color:var(--dim)">The higher the score, the higher the seed: the top seeds get the free passes, and every round pairs the strongest left with the weakest left. On equal scores, whoever signed up first ranks higher.</p>`
  }
  $('#tscore').addEventListener('click', (e) => { const b = e.target.closest('button[data-d]'); if (!b) return; const i = +b.dataset.i; tasc[i] = Math.max(0, Math.min(9, tasc[i] + +b.dataset.d)); tsDraw() })
  tsDraw()

  /* the knockout: five trainers, so a bracket of four after an opening fight; three free passes */
  const AV = (n) => `${A}/avatar/${n}.webp`
  const PL = { Nova: [1101, 120], Ivy: [1105, 104], Vex: [1004, 96], Kael: [1002, 81], Rook: [1003, 62] }
  const pl = (n, cls, tag) => `<div class="pl ${cls}"><img src="${AV(PL[n][0])}" alt=""><span>${n}</span><em>${tag ?? PL[n][1]}</em></div>`
  const mt = (a, b) => `<div class="mt">${a}<span class="vs">VS</span>${b}</div>`
  $('#brk').innerHTML =
    `<div class="col"><h6>Opening</h6>${pl('Nova', 'pass', 'FREE PASS')}${pl('Ivy', 'pass', 'FREE PASS')}${pl('Vex', 'pass', 'FREE PASS')}${mt(pl('Kael', 'win'), pl('Rook', 'out'))}</div>` +
    `<div class="col"><h6>Semi-finals</h6>${mt(pl('Nova', 'win'), pl('Kael', 'out'))}${mt(pl('Ivy', 'win'), pl('Vex', 'out'))}</div>` +
    `<div class="col"><h6>Final</h6>${mt(pl('Nova', 'win'), pl('Ivy', 'out'))}</div>` +
    `<div class="col"><h6>Champion</h6><div class="champ"><img class="tr" src="${A}/icons/trophy-gold.svg" alt=""><img class="av" src="${AV(1101)}" alt=""><b>Nova</b><small>Team score 120</small></div></div>`

  /* WAX: 48 shares among the top 16 */
  const WAXG = [['1st', 16, 1], ['2nd', 8, 1], ['3rd–4th', 4, 2], ['5th–8th', 2, 4], ['9th–16th', 1, 8]]
  $('#wax').innerHTML = WAXG.map(([n, sh, k]) => `<div><b>${n}</b><i><u style="width:${(sh / 16) * 100}%"></u><s>${sh} share${sh > 1 ? 's' : ''}${k > 1 ? ' each' : ''}</s></i><em>${sh} share${sh > 1 ? 's' : ''}${k > 1 ? ' each' : ''} · <b>${((sh / 48) * 100).toFixed(1)}%</b></em></div>`).join('') +
    '<p style="margin:2px 0 0;font-size:13px;color:var(--faint)">Places are ranked by how far you went. 48 shares in all: the champion takes a third of the pot.</p>'
  /* Hall of Fame: the contract writes ranks 1, 2, 3, 3 */
  const HOF = [['Ivy', 1105, 2, 'silver', 'Runner-up', 70], ['Nova', 1101, 1, 'gold', 'Champion', 96], ['Kael', 1002, 3, 'bronze', 'Third', 46], ['Vex', 1004, 3, 'bronze', 'Third', 46]]
  $('#podium').innerHTML = HOF.map(([n, av, r, t, l, h]) => `<div><img class="tr" src="${A}/icons/trophy-${t}.svg" alt=""><img class="av" src="${AV(av)}" alt=""><small>${n}</small><u style="height:${h}px">${r}</u></div>`).join('')
  /* TLM: points per win, more for each round won */
  $('#tlmpts').innerHTML = [['Out first', 0], ['1 win', 1], ['2 wins', 2], ['3 wins', 3]].map(([l, w]) => `<div><i>${Array.from({ length: Math.max(1, w * w) }, () => '<u></u>').join('').replace(/<u><\/u>/g, w ? '<u></u>' : '')}</i><b>${['none', 'some', 'more', 'most'][w]}</b>${l}</div>`).join('') +
    ''
  $('#tlmpts').insertAdjacentHTML('afterend', '<p style="margin:8px 0 0;font-size:13px;color:var(--faint)">Every win earns points, and each round you win is worth more than the last. A free pass counts as a win. The TLM pot is shared by points.</p>')

  /* ---------- rewards & mining ---------- */
  /* pools.ale, snapshot 1 Nov 2026 (refreshed live from the chain when it answers). TLM fill is per minute; Shards have one decimal (SHARD_SCALE 10). */
  const POOLS3 = [
    { key: 'dung', name: 'Dungeon Wins', icon: '/markers/buildings/dungeon.svg', tlm: 'tlmdung', shr: 'shrddung', how: 'Win dungeons.', t: 5278.9, tf: 12.3825, s: 25768.7, sf: 1900 },
    { key: 'arena', name: 'Arena Wins', icon: '/markers/buildings/arena.svg', tlm: 'tlmarena', shr: 'shrdarena', how: 'Win arenas.', t: 3145.0, tf: 16.6032, s: 27953.9, sf: 2500 },
    { key: 'dom', name: 'Arena Domination', icon: '/icons/menu/leaderboard.svg', tlm: 'tlmarenadom', shr: null, how: 'Hold arenas.', t: 57033.0, tf: 8.9636, s: 0, sf: 0 },
  ]
  const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
  const drawPools = () => {
    $('#pools3').innerHTML = POOLS3.map((p) => `<tr><td><img src="${A}${p.icon}" alt="">${p.name}</td><td><b>${fmt(p.t / 100, 1)}</b></td><td>${p.shr ? `<b>${fmt(p.s / 100, 1)}</b>` : '<span class="no">–</span>'}</td></tr>`).join('')
    rpCalc()
  }
  /* Live: the same tables the Rewards screen reads, projected to now the way the contract does (fill per minute while the rate holds). */
  const livePools = async () => {
    const q = (table) => fetch('https://wax.greymass.com/v1/chain/get_table_rows', { method: 'POST', body: JSON.stringify({ code: 'pools.ale', scope: 'pools.ale', table, json: true, limit: 50 }) }).then((r) => r.json())
    try {
      const [tl, sh] = await Promise.all([q('tlmpools'), q('shardpools')])
      const now = Date.now()
      for (const p of POOLS3) {
        const r = tl.rows.find((x) => x.pool === p.tlm)
        if (r) {
          const mins = Math.max(0, (Math.min(now, Date.parse(r.fillrate_expiry + 'Z')) - Date.parse(r.last_current_update + 'Z')) / 60000)
          const rate = parseFloat(r.fillrate), res = parseFloat(r.tlm_reserve)
          p.t = parseFloat(r.tlm_current) + Math.min(res, rate * mins); p.tf = rate
        }
        const z = p.shr && sh.rows.find((x) => x.pool === p.shr)
        if (z) { p.s = (z.shard_current + (z.fillrate_per_hour * (now - Date.parse(z.last_current_update + 'Z'))) / 3600000) / 10; p.sf = z.fillrate_per_hour / 10 }
      }
      drawPools()
    } catch { $('#potlive').textContent = 'SNAPSHOT' }
  }
  /* What an arena win is worth (pools.cpp): tools' mining power x boost_score / 1,000,000, x2, +1. The map shows boost_score / 100,000 (formatBoost), so a building shown at x5.0 multiplies by 0.5. Trial banks a tenth (users.ale trial_rewpow_mod 0.10). Checked against live sethrewards: 3x Ether Converter (2,475) wins ~2,000-2,600 per arena win. */
  const TOOLS = [['19552', 'Standard Shovel', 10, 5], ['19557', 'Basic Explosive', 191, 10], ['19567', 'Large Explosive', 367, 122], ['19576', 'Quantum Drill', 1000, 125], ['19579', 'AI Excavator', 2037, 2037]]
  let toolPick = 2
  $('#tools').innerHTML = TOOLS.map(([id, n, t], i) => `<button data-i="${i}"><img src="${A}/cards/${id}.webp" alt=""><span><b>3× ${n}</b><small>${fmt(t * 3)} power</small></span></button>`).join('')
  const rpCalc = () => {
    if (!$('#vsrow')) return
    $$('#tools button').forEach((b, k) => b.classList.toggle('on', k === toolPick))
    const boost = +$('#bst').value / 10
    $('#bstv').textContent = '×' + boost.toFixed(1)
    const [, , tmp, smp] = TOOLS[toolPick]
    const mod = boost / 10
    const legend = Math.round(tmp * 3 * mod * 2 + 1), trial = Math.max(1, Math.round((tmp * 3 * mod * 2 + 1) * 0.1))
    const ar = POOLS3[1]
    const row = (cls, icon, title, pw) => {
      const wins = 10000 / pw
      const out = wins <= 1 ? `<b>${fmt(1 / wins, 1)} mines</b> per win` : `<b>${fmt(Math.ceil(wins))} wins</b> per mine`
      return `<div class="rw-row ${cls}"><span class="who"><img src="${A}/icons/${icon}" alt="">${title}</span><span class="pw">${fmt(pw)}<small>power a win</small></span><span class="bar"><u style="width:${Math.min(100, (pw / 10000) * 100)}%"></u></span><span class="out">${out}</span></div>`
    }
    $('#vsrow').innerHTML = row('', 'account-trial.svg', 'Trial', trial) + row('leg', 'account-legend.svg', 'Legend Pass', legend)
    $('#rwpays').innerHTML = `One mine of Arena Wins pays <b>${fmt(ar.t / 100, 1)} TLM</b> and <b>${fmt(ar.s / 100, 1)} Shards</b> right now. The bar shows how much of one mine a single win fills.`
  }
  $('#tools').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { toolPick = +b.dataset.i; rpCalc() } })
  $('#bst').oninput = rpCalc
  drawPools()
  livePools()
  /* What went in over the last day: the TLM rewards.ale sent pools.ale (hourly top-ups, from the chain's history), and the Shards every shard pool refills (fillrate_per_hour, one decimal). */
  /* The past 7 days, measured: every TLM top-up rewards.ale sent pools.ale (the chain's history), and what the shard pools refilled (fillrate_per_hour x 168 h, one decimal). */
  const inflow = async () => {
    try {
      const after = new Date(Date.now() - 7 * 86400000).toISOString()
      let sum = 0
      for (let skip = 0, page = 0; page < 5; page++, skip += 1000) {
        const j = await fetch(`https://wax.eosusa.io/v2/history/get_actions?account=pools.ale&filter=alien.worlds:transfer&transfer.from=rewards.ale&after=${after}&limit=1000&skip=${skip}&sort=asc`).then((r) => r.json())
        const acts = j.actions || []
        sum += acts.filter((x) => x.act.data.from === 'rewards.ale' && x.act.data.to === 'pools.ale').reduce((t, x) => t + parseFloat(x.act.data.quantity), 0)
        if (acts.length < 1000) break
      }
      if (sum > 0) $('#inTlm').textContent = fmt(sum)
    } catch {}
    try {
      const r = await fetch('https://wax.greymass.com/v1/chain/get_table_rows', { method: 'POST', body: JSON.stringify({ code: 'pools.ale', scope: 'pools.ale', table: 'shardpools', json: true, limit: 50 }) }).then((x) => x.json())
      const week = r.rows.reduce((t, z) => t + Number(z.fillrate_per_hour || 0), 0) * 168 / 10
      if (week > 0) $('#inShr').textContent = fmt(week)
    } catch {}
  }
  inflow()

  /* ---------- farming ---------- */
  /* farm.ale: stakeweight (rarity x shine), config power_divider 10,000,000 and max_power 100,000 (so at most 1% of a pool per claim), pools current_size (credits). claim = pool x min(weight x days / 1e7, 1%). */
  const FW = { Common: { Stone: 12, Gold: 27, Stardust: 60 }, Rare: { Stone: 90, Gold: 203, Stardust: 450, XDimension: 315, Antimatter: 1035 }, Epic: { Stone: 250, Gold: 563, Stardust: 1250, XDimension: 875, Antimatter: 2875 }, Legendary: { Stone: 675, Gold: 1519, Stardust: 3375, XDimension: 2363, Antimatter: 7763 }, Mythical: { Stone: 3975, Gold: 8944, Stardust: 19875, XDimension: 13913, Antimatter: 45713 } }
  const SHINES = ['Stone', 'Gold', 'Stardust', 'XDimension', 'Antimatter']
  const FPOOLS = { crew: ['Crew', 'crew.worlds', '141566', 5475272], tool: ['Tools', 'tool.worlds', '19576', 3823743], arms: ['Weapons', 'arms.worlds', '19582', 2373323] }
  let fmPick = ['Legendary', 'Stone'], fmPool = 'crew'
  $('#fmgrid').innerHTML = `<tr><th>Rarity</th>${SHINES.map((h) => `<th><span class="full">${h === 'XDimension' ? 'X-Dim' : h}</span><span class="abbr">${{ Stone: 'Sto', Gold: 'Gold', Stardust: 'Star', XDimension: 'X-D', Antimatter: 'Anti' }[h]}</span></th>`).join('')}</tr>` +
    Object.keys(FW).map((r) => `<tr><td class="r">${r}</td>${SHINES.map((h) => FW[r][h] ? `<td><button data-r="${r}" data-h="${h}">${fmt(FW[r][h])}</button></td>` : '<td><button disabled>–</button></td>').join('')}</tr>`).join('')
  const fmDraw = () => {
    $('#fmpools').innerHTML = Object.values(FPOOLS).map(([n, , card, bal]) => `<tr><td><img src="${A}/cards/${card}.webp" alt="" style="width:20px;height:auto;border-radius:3px">${n}</td><td><b>${fmt(bal)}</b></td></tr>`).join('')
    $$('#fmgrid button[data-r]').forEach((b) => b.classList.toggle('on', b.dataset.r === fmPick[0] && b.dataset.h === fmPick[1]))
    $$('#fmpool button').forEach((b) => b.classList.toggle('on', b.dataset.p === fmPool))
    const n = +$('#fmn').value, d = +$('#fmd').value
    $('#fmnv').textContent = n; $('#fmdv').textContent = d
    const w = FW[fmPick[0]][fmPick[1]] * n
    const raw = (w * d) / 1e7, share = Math.min(raw, 0.01), capped = raw >= 0.01
    const [pn, , , bal] = FPOOLS[fmPool]
    const capDays = Math.ceil(100000 / w)
    $('#fmout').innerHTML = `<small>This claim pays</small>
      <span class="big"><img src="${A}/icons/credits.svg" alt="">${fmt(bal * share)}</span>
      <span class="bar${capped ? ' cap' : ''}"><u style="width:${(share / 0.01) * 100}%"></u></span>
      <p>${n} × ${fmPick[0]} ${fmPick[1]} = weight <b>${fmt(w)}</b>. After ${d} day${d > 1 ? 's' : ''} that's <b>${(share * 100).toFixed(3)}%</b> of the ${pn} pool${capped ? `: <b>the 1% cap</b>. Claim now, waiting adds nothing.` : `. The 1% cap is reached after ${fmt(capDays)} days.`}</p>`
  }
  $('#fmgrid').addEventListener('click', (e) => { const b = e.target.closest('button[data-r]'); if (b) { fmPick = [b.dataset.r, b.dataset.h]; fmDraw() } })
  $('#fmpool').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { fmPool = b.dataset.p; fmDraw() } })
  $('#fmn').oninput = fmDraw; $('#fmd').oninput = fmDraw
  fmDraw()
  fetch('https://wax.greymass.com/v1/chain/get_table_rows', { method: 'POST', body: JSON.stringify({ code: 'farm.ale', scope: 'farm.ale', table: 'pools', json: true, limit: 20 }) }).then((r) => r.json()).then((j) => {
    for (const k of Object.keys(FPOOLS)) { const row = j.rows.find((x) => x.schema === FPOOLS[k][1]); if (row) FPOOLS[k][3] = row.current_size }
    fmDraw()
  }).catch(() => {})

  /* ---------- my lands ---------- */
  /* lands.ale: buildingcost 69,999 credits for each of tavern, dungeon, arena; raritydisc rare 20,000, epic 40,000, legendary 60,000. */
  const LDR = [['Common', 0], ['Rare', 20000], ['Epic', 40000], ['Legendary', 60000]]
  let ldPick = 1
  const ldDraw = () => { $('#ldcost').innerHTML = LDR.map(([r, d], i) => `<button data-i="${i}" class="${i === ldPick ? 'on' : ''}"><small>${r} land</small><b><img src="${A}/icons/credits.svg" alt="">${fmt(69999 - d)}</b><span>${d ? fmt(d) + ' off' : 'full price'}</span></button>`).join('') }
  $('#ldcost').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { ldPick = +b.dataset.i; ldDraw() } })
  ldDraw()

  /* ---------- candle ---------- */
  /* recovery.ale offers: a new candle every 700 min, each burns 1 day (expiry_days); share = reward_amount / total_gems x your gems. WAX has 8 decimals, TLM 4, Shards 1. */
  const CD = { wax: ['WAX', 'wax-coin.webp', 1e8], tlm: ['TLM', 'tlm.svg', 1e4], shards: ['Shards', 'shards.svg', 10] }
  const cdOffers = [
    { requirements: 'Distance travelled', requirement_amount: 22000, total_gems: 13080, reward_type: 'wax', prize: 5946, status: 'live', left: '7 h' },
    { requirements: 'Dungeons won', requirement_amount: 150, total_gems: 6000, reward_type: 'tlm', prize: 4200, status: 'live', left: '19 h' },
    { requirements: 'Damage resisted', requirement_amount: 25000, total_gems: 0, reward_type: 'shards', prize: 60000, status: 'soon', left: '7 h' },
  ]
  const cdDraw = () => {
    $('#cdlist').innerHTML = cdOffers.map((o) => {
      const [sym, ic, sc] = CD[o.reward_type] || CD.tlm
      const prize = o.prize
      const status = o.status === 'live' ? `<span><b>${fmt(o.total_gems)}</b> gems in</span><span>ends in ${o.left}</span>` : `<span class="soon">Starts in ${o.left}</span>`
      return `<div class="cd-row"><img src="${A}/icons/${ic}" alt=""><div><span class="pz">${fmt(prize, prize < 100 ? 2 : 0)}<small>${sym} prize</small></span><div class="rq">Needs <b>${fmt(o.requirement_amount)} ${o.requirements.toLowerCase()}</b></div></div><div class="st">${status}</div></div>`
    }).join('')
    candleUp()
  }
  const candleUp = () => {
    const o = cdOffers[0]
    const [sym, ic] = CD[o.reward_type] || CD.tlm
    const prize = o.prize
    const y = +$('#cy').value, others = +$('#co').value, share = y / (y + others)
    $('#cyv').textContent = fmt(y); $('#cov').textContent = fmt(others)
    $('#cdbar').style.width = (share * 100).toFixed(2) + '%'
    $('#cdshare').innerHTML = `<img src="${A}/icons/${ic}" alt="">${fmt(prize * share, 2)} ${sym}`
    $('#cdpct').textContent = `${(share * 100).toFixed(1)}% of the prize`
    $('#cdnote').innerHTML = `Prize <b>${fmt(prize, 0)} ${sym}</b> × your gems ÷ all gems. Each gem is worth <b>${fmt(prize / (y + others), 4)} ${sym}</b> in this example.`
  }
  $('#cy').oninput = candleUp; $('#co').oninput = candleUp
  cdDraw()

  /* ---------- keep them fighting ---------- */
  /* fighters.ale config: standard_days_payday 30, standard_pay_payday 999 (den::payday: cost = elapsed / 30 days x 999 + 1, so a full or overdue payday is 1,000), max_level 10; level-ups 999 credits; level_mod 1.15. battle.ale: a dungeon win moves the payday 10,000 s, an arena win 20,000 s. */
  const KF = { art: 'lunatic_human', el: 'fire', lv: 7, asc: 1 }
  const motes = () => [12, 30, 52, 70, 86].map((l, i) => `<span class="mote" style="left:${l}%;animation-delay:${(i * 0.42).toFixed(2)}s"></span>`).join('')
  const kfCard = (cls, tag, tagCls, lv = KF.lv) => rc({ ...KF, lv }, 0, cls).replace('</button>', (cls.includes('up') ? motes() : '') + (tag ? `<span class="tag ${tagCls}">${tag}</span>` : '') + '</button>')
  const KFS = [
    ['', '', '', 'Ready', 'nothing to do', '<b>Ready.</b> Paid, free and fighting fit: pick it for any fight.'],
    ['over', 'Payday', 'payday', 'Payday', 'red rim, pulsing', '<b>Payday overdue.</b> It can\'t fight or be listed until you pay it in My Fighters. Left unpaid for about 90 days, it\'s deleted.'],
    ['up', 'Level up', 'lvlup', 'Level up', 'green, glowing', '<b>Level waiting.</b> Its XP strip is full: level it up for credits to make it stronger.'],
    ['maxed', '', '', 'Max level', 'full green strip', '<b>Level 10, the top.</b> The strip stays full and green; it can\'t level any further, but it can ascend.'],
    ['iron', 'Market', 'market', 'Busy', 'ribbon says where', '<b>Busy.</b> The ribbon says where: Market, Arena, Dungeon or Tourney. It comes back when that\'s over.'],
  ]
  let kfOn = 1
  const kfDraw = () => {
    $('#kfstates').innerHTML = KFS.map(([c, t, tc, n, sub], i) => `<figure data-i="${i}" class="${i === kfOn ? 'on' : ''}">${kfCard(c, t, tc, c === 'maxed' ? 10 : KF.lv)}<figcaption><b>${n}</b><small>${sub}</small></figcaption></figure>`).join('')
    $('#kfwhat').innerHTML = KFS[kfOn][5]
  }
  $('#kfstates').addEventListener('click', (e) => { const f = e.target.closest('figure'); if (f) { kfOn = +f.dataset.i; kfDraw() } })
  kfDraw()
  const kfPay = () => {
    const d = +$('#kfd').value
    $('#kfdv').textContent = d
    const due = d >= 30, gone = d >= 120
    const cost = Math.floor((Math.min(d, 30) / 30) * 999 + 1)
    $('#kfpaycard').innerHTML = gone ? kfCard('gone', 'Deleted', 'payday') : due ? kfCard('over', 'Payday', 'payday') : kfCard('', '', '')
    $('#kfout').innerHTML = gone
      ? '<span class="st" style="color:#ff5a6a">Deleted</span><span>Unpaid for 90 days after its payday: the fighter is gone for good.</span>'
      : due
        ? `<span class="st" style="color:#ff5a6a">Can't fight</span><span>Pay <b>${fmt(cost)}</b> credits to bring it back. Deleted in ${120 - d} days.</span>`
        : `<span class="st" style="color:var(--green)">Fighting</span><span>Paying now costs <b>${fmt(cost)}</b> credits. Payday in ${30 - d} days.</span>`
  }
  $('#kfd').oninput = kfPay; kfPay()
  /* the level card shows its level and lights up green when one is waiting */
  const lvUp = () => { const l = +$('#lv').value, m = Math.pow(1.15, l); $('#lvv').textContent = l; $('#lvmul').textContent = '×' + m.toFixed(2); $('#lvex').textContent = `a 100-damage roll hits for ${Math.round(100 * m)}`; $('#kflvcard').innerHTML = l >= 10 ? kfCard('maxed', '', '', 10) : kfCard('up', 'Level up', 'lvlup', l) }
  $('#lv').oninput = lvUp; lvUp()

  /* ---------- ascension ---------- */
  /* ascend.ale: min_ascension_level 10, ascension_credit_fee 999, ascension_reroll_credit_cost 499, fighters.ale asc_ability_unlock_lvl 5.
     Upgrades (ascupgrades, stats in tenths as the game shows them): mainstats 4 in 5 - damage +0.5-1.5, health +1-2.5, taunt +2-5 or -0.5-2, cooldown -0.5-1.5, wind-up -1.5-5; resistances 1 in 5 - +1.5-5% to one element.
     Damage and health count x4.05 in a level-10 fight (1.15^10). */
  const ASH = { art: 'arcanist_altan', el: 'air', race: 'Altan', lv: 10, asc: 4 }
  const ASR = [
    { art: 'arcanist_altan', el: 'fire', race: 'Altan', lv: 6 },
    { art: 'arcanist_human', el: 'air', race: 'Human', lv: 4 },
    { art: 'arcanist_robotron', el: 'metal', race: 'Robotron', lv: 8, sac: 1 },
    { art: 'arcanist_elgem', el: 'nature', race: 'Elgem', lv: 5 },
    { art: 'arcanist_altan', el: 'air', race: 'Altan', lv: 7 },
    { art: 'hunter_altan', el: 'air', race: 'Altan', lv: 9, other: 1 },
  ]
  const SOCKS = [['Same race', 'Another Altan', (f) => f.race === ASH.race], ['Same element', 'Another Air fighter', (f) => f.el === ASH.el], ['Sacrifice ability', 'Has "Sacrifice"', (f) => !!f.sac]]
  let asPick = [], asStage = 'pick', asOffers = [], asTaken = null, asLast = ''
  /* fill the three sockets with three different fighters, as the contract checks */
  const asMatch = () => {
    const f = asPick.map((i) => ASR[i])
    for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) for (const c of [0, 1, 2]) {
      if (new Set([a, b, c]).size < 3 || !f[a] || !f[b] || !f[c]) continue
      if (SOCKS[0][2](f[a]) && SOCKS[1][2](f[b]) && SOCKS[2][2](f[c])) return [asPick[a], asPick[b], asPick[c]]
    }
    /* partial: show whatever sockets can be filled */
    const used = new Set(), out = [null, null, null]
    SOCKS.forEach(([, , ok], k) => { const i = asPick.find((x) => !used.has(x) && ok(ASR[x])); if (i !== undefined) { out[k] = i; used.add(i) } })
    return out
  }
  const rnd = (a, b) => a + Math.random() * (b - a)
  const OFFER_POOL = [
    () => { const v = rnd(0.5, 1.5); return ['Damage', '+' + v.toFixed(1), `≈ +${(v * 4.05).toFixed(1)} in a level-10 fight`] },
    () => { const v = rnd(1, 2.5); return ['Health', '+' + v.toFixed(1), `≈ +${(v * 4.05).toFixed(1)} in a level-10 fight`] },
    () => ['Cooldown', '−' + rnd(0.5, 1.5).toFixed(1), 'strikes more often'],
    () => ['Wind-up', '−' + rnd(1.5, 5).toFixed(1), 'strikes first sooner'],
    () => ['Taunt', '+' + rnd(2, 5).toFixed(1), 'draws more blows'],
    () => ['Taunt', '−' + rnd(0.5, 2).toFixed(1), 'draws fewer blows'],
  ]
  const RES = ['Gem', 'Metal', 'Air', 'Fire', 'Nature', 'Neutral']
  const roll = () => Array.from({ length: 3 }, () => (Math.random() < 0.8 ? OFFER_POOL[Math.floor(Math.random() * 6)]() : (() => { const e = RES[Math.floor(Math.random() * 6)]; return [e + ' resistance', '+' + rnd(1.5, 5).toFixed(1) + '%', 'takes less from ' + e] })()))
  const asDraw = () => {
    const m = asMatch(), ready = m.every((x) => x !== null)
    const card = (f, i, cls = '') => rc({ art: f.art, el: f.el, lv: f.lv, asc: f.asc }, i, cls)
    $('#ashero').className = 'as-hero' + (asStage === 'done' ? ' glow' : '')
    $('#ashero').innerHTML = card(ASH, 0) + `<small>Altan · Air · Level 10 · ✦${ASH.asc}${asStage === 'done' ? `<br><b style="color:#ffd979">${asLast}</b>` : ''}</small>`
    $('#assocks').innerHTML = SOCKS.map(([n, sub], k) => `<div class="as-sock${m[k] !== null && asStage !== 'done' ? ' ok' : ''}">${m[k] !== null && asStage !== 'done' ? card(ASR[m[k]], m[k]) : '<span class="slot">+</span>'}<div><b>${n}</b><span>${sub}</span></div></div>`).join('')
    const gone = asStage === 'done' ? new Set(m) : new Set()
    $('#asroster').innerHTML = ASR.map((f, i) => `<div>${card(f, i, (asPick.includes(i) && !gone.has(i) ? 'sacd' : '') + (gone.has(i) ? ' gone' : '')).replace('</button>', asPick.includes(i) && !gone.has(i) ? '<span class="tag payday">Sacrifice</span></button>' : '</button>')}<small>${f.art.startsWith('hunter') ? 'Hunter' : 'Arcanist'} · ${f.race} · ${f.el[0].toUpperCase() + f.el.slice(1)}${f.sac ? '<br><i>Sacrifice</i>' : ''}</small></div>`).join('')
    const C = `<img src="${A}/icons/credits.svg" alt="">`
    let msg = '', btns = ''
    if (asStage === 'pick') {
      msg = ready ? '<b>All three slots filled.</b> Ascend to see your upgrades.' : asPick.length === 3 ? '<b>These three don\'t cover all three slots.</b> Swap one out.' : `Pick ${3 - asPick.length} more. Each one has to fill a different slot.`
      btns = `<button class="btn gold" id="asgo" ${ready ? '' : 'disabled'}>Ascend · ${C} 999</button>`
    } else if (asStage === 'offers') {
      msg = '<b>Three random upgrades.</b> Take one: the other two are lost. Or re-roll all three.'
      btns = `<button class="btn" id="asroll">Re-roll · ${C} 499</button>`
    } else {
      msg = `<b>Ascended to ✦${ASH.asc}.</b> The three sacrifices are gone. ${ASH.asc >= 5 ? '<b style="color:#ffd979">Its hidden ability is now open: see below.</b>' : `${5 - ASH.asc} more to open its hidden ability.`}`
      btns = '<button class="btn" id="asagain">Try again</button>'
    }
    $('#asact').innerHTML = btns + `<span class="msg">${msg}</span>`
    const open = ASH.asc >= 5
    $('#as5').classList.toggle('open', open)
    $('#as5pips').innerHTML = [1, 2, 3, 4, 5].map((n) => `<span class="${n === 5 ? 'five ' : ''}${n <= ASH.asc ? 'on' : ''}">✦${n}</span>`).join('')
    $('#as5ab').innerHTML = `<span class="rib"><i>Rare</i><i class="lock">${open ? 'Unlocked' : 'Locked'}</i></span><span class="lockicon">${open ? '🔓' : '🔒'}</span><b>Group Buff: Air Damage</b><span>Before combat, increases allied air damage by 6%</span><span style="font-size:12.5px">${open ? 'Active in every fight from now on.' : `Opens at ✦5: this fighter is at ✦${ASH.asc}.`}</span>`
    $('#asoffers').innerHTML = asStage === 'pick' ? '' : asOffers.map(([n, v, sub], i) => `<button class="as-offer${asTaken === i ? ' taken' : asTaken !== null ? ' lost' : ''}" data-i="${i}"><small>${n}</small><b>${v}</b><span>${sub}</span></button>`).join('')
  }
  $('#asroster').addEventListener('click', (e) => {
    if (asStage !== 'pick') return
    const b = e.target.closest('.rc'); if (!b) return
    const i = +b.dataset.i
    if (ASR[i].other) { $('#asact .msg').innerHTML = '<b>That\'s a Hunter.</b> Sacrifices must be the same class as your fighter: Arcanists only.'; return }
    if (!asPick.includes(i)) {
      if (asPick.length >= 3) { $('#asact .msg').innerHTML = '<b>All three are picked.</b> Tap one of them to take it back.'; return }
      const filled = (pick) => { const keep = asPick; asPick = pick; const n = asMatch().filter((x) => x !== null).length; asPick = keep; return n }
      if (filled([...asPick, i]) <= filled(asPick)) {
        const f = ASR[i], fits = SOCKS.filter(([, , ok]) => ok(f)).map(([n]) => n.toLowerCase())
        $('#asact .msg').innerHTML = fits.length ? `<b>That slot is already filled.</b> This one only counts as ${fits.join(' or ')}.` : `<b>This one doesn't fit any slot.</b> It isn't an Altan, isn't Air and has no Sacrifice ability.`
        $(`#asroster .rc[data-i="${i}"]`).classList.add('shake')
        return
      }
    }
    asPick = asPick.includes(i) ? asPick.filter((x) => x !== i) : [...asPick, i]
    asDraw()
  })
  $('#asact').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return
    if (b.id === 'asgo') { asStage = 'offers'; asOffers = roll(); asTaken = null }
    if (b.id === 'asroll') { asOffers = roll() }
    if (b.id === 'asagain') { asStage = 'pick'; asPick = []; asTaken = null; ASH.asc = 4 }
    asDraw()
  })
  $('#asoffers').addEventListener('click', (e) => {
    const b = e.target.closest('.as-offer'); if (!b || asStage !== 'offers') return
    asTaken = +b.dataset.i; const [n, v] = asOffers[asTaken]; asLast = `${v} ${n.toLowerCase()}`; ASH.asc += 1; asStage = 'done'
    asDraw()
  })
  asDraw()

  /* ---------- market ---------- */
  /* market.ale config: standard_duration_minutes 2880 (48 h), reset_duration_below_minutes 720 (a bid with under 12 h left resets the end to now + 12 h),
     gems_min_start_bid 10, gems_listing_price 1, next bid = max(current + 2, current x 1.10), seller fee max(1, 15%). */
  const MK = { start: 20 }
  let mk = { cur: 20, bids: 0, top: null, end: 48, t: 20 }
  const mkMin = () => Math.max(mk.cur + 2, Math.trunc(mk.cur * 1.1))
  const mkReset = () => { mk = { cur: MK.start, bids: 0, top: null, end: 48, t: 20 }; $('#mkt').value = 20 }
  const mkBid = (who) => {
    if (mk.t >= mk.end) return
    const prev = mk.top
    mk.cur = mk.bids ? mkMin() : mkMin(); mk.bids++; mk.top = who
    const late = mk.end - mk.t < 12
    if (late) mk.end = mk.t + 12
    return { prev, late }
  }
  const GEM = () => `<img src="${A}/icons/gems.svg" alt="">`
  const mkDraw = (note) => {
    const over = mk.t >= mk.end, W = 72
    $('#mkcard').innerHTML = rc({ art: 'mindblade_khaured', el: 'gem', lv: 9, asc: 1 }, 0, over && mk.top ? 'picked' : '').replace(/<span class="tag team">In team<\/span>/, over && mk.top ? `<span class="tag ${mk.top === 'you' ? 'team' : 'payday'}">Sold</span>` : '')
    const left = Math.max(0, mk.end - mk.t)
    $('#mkstats').innerHTML = `<div><small>${mk.bids ? 'Top bid' : 'Starts at'}</small><b>${GEM()}${fmt(mk.cur)}</b></div><div class="${mk.top === 'you' ? 'you' : mk.top ? 'rival' : ''}"><small>Top bidder</small><b>${mk.top === 'you' ? 'You' : mk.top ? 'Rival' : '–'}</b></div><div><small>Next bid</small><b>${over ? '–' : GEM() + fmt(mkMin())}</b></div><div><small>${over ? 'Status' : 'Ends in'}</small><b>${over ? 'Ended' : left + ' h'}</b></div>`
    $('#mkzone').style.left = (Math.max(0, mk.end - 12) / W) * 100 + '%'; $('#mkzone').style.width = (12 / W) * 100 + '%'
    $('#mkend').style.left = (mk.end / W) * 100 + '%'; $('#mkend').textContent = 'Ends ' + mk.end + 'h'
    let msg = note || ''
    if (!note) {
      if (over) msg = mk.top === 'you' ? `<b>You won it</b> for ${fmt(mk.cur)} gems. The fighter joins your roster.` : mk.top ? `<b>The rival won</b> at ${fmt(mk.cur)} gems. Your gems came back when you were outbid.` : '<b>No bids.</b> With Keep listed ticked, it stays up as a Buy now at 20 gems until its payday.'
      else msg = mk.top === 'you' ? `<b>You're on top.</b> Your ${fmt(mk.cur)} gems are held until you win or get outbid.` : 'Place a bid, or drag the clock along the timeline. The red zone is the last 12 hours.'
    }
    $('#mkact').innerHTML = `<button class="btn gold" id="mkbid" ${over || mk.top === 'you' ? 'disabled' : ''}>Bid ${GEM()} ${fmt(mkMin())}</button><button class="btn" id="mkrival" ${over ? 'disabled' : ''}>A rival bids</button><button class="btn" id="mkreset">Reset</button><span class="msg">${msg}</span>`
  }
  $('#mkact').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return
    if (b.id === 'mkreset') { mkReset(); return mkDraw() }
    const who = b.id === 'mkbid' ? 'you' : 'rival'
    const r = mkBid(who); if (!r) return mkDraw()
    const ext = r.late ? ` It came in the last 12 hours, so the auction now ends at <b>${mk.end}h</b>.` : ''
    mkDraw(who === 'you' ? `<b>You bid ${fmt(mk.cur)} gems.</b> They're held while you're on top.${ext}` : r.prev === 'you' ? `<b>Outbid!</b> The rival bid ${fmt(mk.cur)} gems and yours came straight back.${ext}` : `<b>A rival bid ${fmt(mk.cur)} gems.</b>${ext}`)
  })
  $('#mkt').oninput = () => { mk.t = Math.min(+$('#mkt').value, 72); mkDraw() }
  mkDraw()
  const mkSell = () => {
    const pr = +$('#mkp').value, fee = Math.max(1, Math.trunc(pr * 0.15)), get = pr > fee ? pr - fee : pr
    $('#mkpv').textContent = fmt(pr)
    $('#mkbill').innerHTML = `<div><span>Sold for</span><b>${fmt(pr)}</b></div><div><span>Sale fee (15%)</span><b>−${fmt(fee)}</b></div><div><span>Listing fee, paid up front</span><b>−1</b></div><div class="tot"><span>You get</span><b>${GEM()} ${fmt(get)}</b></div>`
  }
  $('#mkp').oninput = mkSell; mkSell()

  /* ---------- account: auto-sign ---------- */
  /* web/src/wharf/autoSign.ts AUTO_SIGN_GROUPS: a session key under the account's own 'alienlegends' permission, linked only to the chosen groups; never transfers (WAX, TLM, NFTs). */
  $('#aschips').innerHTML = ['Travelling', 'Dungeons and arenas', 'Your fighters', 'Quests', 'Rewards', 'Market', 'Shop (gems, credits)', 'Farming (claims)', 'Ascension', 'Candle', 'Lands and buildings', 'Tournament', 'CPU', 'Account settings'].map((n) => `<span>${n}</span>`).join('')

  /* ---------- shop & legend pass ---------- */
  /* shop.ale shopitems: leg.one 999 gems / 30 d, leg.three 2,499 / 90 d, leg.six 3,999 / 180 d (time stacks).
     gem.small 100 / 49 WAX, gem.medium 1,100 / 499, gem.large 12,500 / 4,999, gem.giant 140,000 / 49,999.
     Trial: users trial_rewpow_mod 0.10, pools trial_payout_percentage 0.10 (quests), tournament /10; flask nrg.free 100 (trial), nrg.freeleg 1,000 (Legend only). */
  const LPP = [['leg.one', '1 month', 999, 1], ['leg.three', '3 months', 2499, 3], ['leg.six', '6 months', 3999, 6]]
  let lpOn = 2
  const lpDraw = () => {
    $('#lpplans').innerHTML = LPP.map(([id, n, g, m], i) => { const per = g / m, save = Math.round((1 - per / 999) * 100); return `<button class="lp-plan${i === lpOn ? ' on' : ''}" data-i="${i}">${save ? `<i>Save ${save}%</i>` : ''}<img src="${A}/shop/${id}.webp" alt=""><div><small>${n}</small><b><img src="${A}/icons/gems.svg" alt="">${fmt(g)}</b><span>${fmt(per)} gems a month</span></div></button>` }).join('')
    const [, n, g] = LPP[lpOn]
    $('#lpnote').innerHTML = `<b style="color:#fff">${n} for ${fmt(g)} gems.</b> Buying more adds to the time you have left.`
  }
  $('#lpplans').addEventListener('click', (e) => { const b = e.target.closest('.lp-plan'); if (b) { lpOn = +b.dataset.i; lpDraw() } })
  lpDraw()
  const GPK = [['gem.small', 'Pack S', 100, 49], ['gem.medium', 'Pack M', 1100, 499], ['gem.large', 'Pack L', 12500, 4999], ['gem.giant', 'Pack XL', 140000, 49999]]
  $('#gempacks').innerHTML = GPK.map(([id, n, g, w], i) => { const bonus = Math.round(((g / w) / (100 / 49) - 1) * 100); return `<div class="${i === 3 ? 'best' : ''}">${i === 3 ? `<i>Best value · +${bonus}%</i>` : bonus > 0 ? `<i>+${bonus}% gems</i>` : ''}<img class="art" src="${A}/shop/${id}.webp" alt=""><small>${n}</small><b><img src="${A}/icons/gems.svg" alt="">${fmt(g)}</b><span><img src="${A}/icons/wax-coin.webp" alt=""> ${fmt(w)} WAX</span></div>` }).join('')

  /* ---------- glossary ---------- */
  /* [term, category, icon (under assets, or guide-icons/), where it's explained, one line] */
  const GLOSS = [
    ['Age', 'Fighters', '/icons/stats/health.svg', 'upkeep', 'A bonus or penalty on health and damage that fades over time and with every win.'],
    ['Arena', 'Fighting', '/markers/buildings/arena.svg', 'arenas', 'A building where you beat the team other trainers left. Win, and one of your fighters joins its defence.'],
    ['Arena Domination', 'Rewards', '/icons/menu/leaderboard.svg', 'rewards', 'A TLM pool you fill by holding arenas with your fighters.'],
    ['Ascension', 'Fighters', '/icons/menu/ascension.svg', 'ascension', 'Sacrificing three same-class fighters to give a level-10 fighter a permanent upgrade. Shown as ✦.'],
    ['Auto-sign', 'Account', '/icons/menu/account.svg', 'account', 'Lets the everyday actions you choose sign themselves, without a wallet pop-up.'],
    ['Boost', 'World', '/markers/buildings/dungeon-r3.svg', 'lands', 'A building\'s strength, ×0 to ×10. Higher boost, bigger rewards there. It fades with time and use.'],
    ['Candle', 'Rewards', '/icons/menu/candle.svg', 'candle', 'Missions with a fixed prize, split by how many gems each trainer put in.'],
    ['Cooldown', 'Fighting', '/icons/stats/attackspeed.svg', 'fight', 'The time between a fighter\'s blows. Lower is better.'],
    ['CPU', 'Account', '/icons/menu/account.svg', 'account', 'The network power every action uses. Legend trainers get 25 free top-ups a week.'],
    ['Credits', 'Currencies', '/icons/credits.svg', 'energy', 'The game\'s working money: paydays, level-ups, ascension, boosts and energy.'],
    ['Difficulty', 'Fighting', '/markers/buildings/dungeon.svg', 'dungeons', 'How hard a dungeon fight is. Higher pays more Reward Power and XP.'],
    ['Energy', 'Currencies', '/icons/energy.svg', 'energy', 'What almost every action costs. It never refills by itself: claim the daily flask.'],
    ['Farming', 'Rewards', '/icons/menu/farming.svg', 'farming', 'Staking Alien Worlds cards to claim credits from three pools.'],
    ['Free pass', 'Fighting', '/icons/menu/tournament.svg', 'tournament', 'A top tournament seed skipping the opening round. It counts as a win.'],
    ['Gems', 'Currencies', '/icons/gems.svg', 'shop', 'The premium currency, bought with WAX.'],
    ['Hall of Fame', 'Fighting', '/icons/trophy-gold.svg', 'tournament', 'Where each tournament\'s champion, runner-up and two semi-finalists are kept for good.'],
    ['Legend Pass', 'Account', '/icons/account-legend.svg', 'shop', 'The premium pass: 10× Reward Power, full prizes, 1,000 energy a day and free CPU.'],
    ['Level', 'Fighters', '/icons/stats/damage.svg', 'upkeep', 'A fighter\'s rank, 1 to 10. Each level makes health and damage stronger.'],
    ['Locked ability', 'Fighters', '/icons/menu/ascension.svg', 'ascension', 'A fighter\'s hidden third ability. It opens at ✦5.'],
    ['Mine', 'Rewards', '/icons/tlm.svg', 'rewards', 'Spending a full Reward Power bar to take 1% of a pool, straight to your wallet.'],
    ['NFT fighter', 'Fighters', '/icons/add-fighter.svg', 'squad', 'Your sixth fighter, built from one Alien Worlds crew card and one weapon card.'],
    ['Objective', 'Fighters', '/markers/buildings/tavern.svg', 'recruit', 'A tavern\'s wish, met by showing an Alien Worlds card. Each one takes energy off the hire.'],
    ['Payday', 'Fighters', '/icons/credits.svg', 'upkeep', 'A fighter\'s wages, up to 1,000 credits every 30 days. Overdue: it can\'t fight.'],
    ['Prize pool', 'Rewards', '/icons/menu/rewards.svg', 'rewards', 'The TLM and Shards your mines are paid from. Shared by every trainer and refilled all the time.'],
    ['Resistance', 'Fighting', '/icons/elements/fire.svg', 'fight', 'Cuts the damage of one element\'s blows, up to 80%.'],
    ['Reward Power', 'Rewards', '/icons/menu/rewards.svg', 'rewards', 'What every win banks. A full bar of 10,000 is one mine.'],
    ['Sacrifice', 'Fighters', '/icons/menu/ascension.svg', 'ascension', 'An ability some fighters have. Ascension needs one sacrifice that has it.'],
    ['Shards', 'Currencies', '/icons/shards.svg', 'energy', 'Alien Worlds shards, spent at the AW Outpost.'],
    ['Taunt', 'Fighting', '/icons/stats/taunt.svg', 'fight', 'Draws enemy blows. It drops a little each time the fighter is hit.'],
    ['TLM', 'Currencies', '/icons/tlm.svg', 'rewards', 'Trilium, the main reward. It goes straight to your wallet.'],
    ['Trainer', 'Account', '/icons/menu/account.svg', 'trainer', 'You: the player who recruits fighters and sends them into fights.'],
    ['Trial', 'Account', '/icons/account-trial.svg', 'shop', 'Playing without a Legend Pass. Most rewards are a tenth.'],
    ['WAX', 'Currencies', '/icons/wax-coin.webp', 'shop', 'The blockchain\'s coin. Buys gems and Alien Worlds cards; some prizes pay it.'],
    ['Weather', 'World', '/icons/weather.png', 'map', 'A land\'s daily roll that can raise or lower stats, for both teams alike.'],
    ['Wind-up', 'Fighting', '/icons/stats/initiative.svg', 'fight', 'How soon a fighter strikes first. Lower is better.'],
  ]
  const GLCATS = ['All', 'Currencies', 'Fighters', 'Fighting', 'Rewards', 'World', 'Account']
  let glCat = 'All', glQ = ''
  const esc = (q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const drawGloss = (q = glQ) => {
    glQ = q
    const rx = q ? new RegExp('(' + esc(q) + ')', 'ig') : null
    const hit = GLOSS.filter(([t, c, , , d]) => (glCat === 'All' || c === glCat) && (!q || (t + ' ' + d).toLowerCase().includes(q.toLowerCase())))
    let last = '', html = ''
    for (const [t, c, ic, id, d] of hit) {
      const L = t[0].toUpperCase()
      const sec = shadow.getElementById(id)
      html += `<a href="#${id}"><img src="${A}${ic}" alt=""><span><b>${rx ? t.replace(rx, '<mark>$1</mark>') : t}</b>${rx ? d.replace(rx, '<mark>$1</mark>') : d}<small>${sec ? sec.querySelector('h2').textContent : c} →</small></span></a>`
    }
    $('#gloss').innerHTML = html || '<p class="gl-none">Nothing in the glossary for that. Try another word.</p>'
  }
  $('#glcats').innerHTML = GLCATS.map((c) => `<button data-c="${c}" class="${c === glCat ? 'on' : ''}">${c}</button>`).join('')
  $('#glcats').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; glCat = b.dataset.c; $$('#glcats button').forEach((x) => x.classList.toggle('on', x === b)); drawGloss() })
  $('#glq').addEventListener('input', (e) => drawGloss(e.target.value.trim()))
  drawGloss()

  /* ---------- search: filter chapters and glossary ---------- */
  $('#q').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase()
    drawGloss(q)
    for (const s of $$('section.ch')) {
      const hit = !q || s.id === 'glossary' || s.textContent.toLowerCase().includes(q)
      s.classList.toggle('hide', !hit)
      const a = $(`.toc a[data-id="${s.id}"]`); if (a) a.style.opacity = hit ? 1 : 0.35
    }
    for (const p of $$('.part')) { let n = p.nextElementSibling, any = false; while (n && !n.classList.contains('part')) { if (n.tagName === 'SECTION' && !n.classList.contains('hide')) any = true; n = n.nextElementSibling } p.classList.toggle('hide', !any) }
  })

  /* ---------- the currencies' and the Legend Pass's icons, in front of every mention ---------- */
  const IC = [
    [/Legend Pass(?:es)?/g, 'account-legend.svg'],
    [/\b[Cc]redits\b/g, 'credits.svg'],
    [/\b[Gg]ems\b|\b[Gg]em(?= fee)/g, 'gems.svg'],
    [/\b[Ee]nergy\b/g, 'energy.svg'],
  ]
  const NOIC = 'script, style, title, svg, input, textarea, .btn, #gloss, .gl-cats, .ic, .toc, .coin, .coinbox h3, .search, .legcta b, .rw-leg b, .rw-row .who, .lp-plans, .lp-perks, .gp, .sh-more li, .tv, .as-chips'
  const iconize = (root) => {
    if (!root || (root.nodeType === 1 && root.closest(NOIC))) return
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && !n.parentElement.closest(NOIC) && /Legend Pass|redits|ems|em fee|nergy/.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) })
    const nodes = []
    while (walk.nextNode()) nodes.push(walk.currentNode)
    for (const n of nodes) {
      const hits = []
      for (const [rx, ic] of IC) for (const m of n.data.matchAll(rx)) hits.push([m.index, m[0], ic])
      if (!hits.length) continue
      hits.sort((a, b) => a[0] - b[0])
      /* a mention that already has its icon right before it (a tile's heading, a chip) keeps just the one */
      let prev = n.previousSibling
      while (prev && prev.nodeType === 3 && !prev.data.trim()) prev = prev.previousSibling
      const iconBefore = prev && prev.nodeName === 'IMG' && !n.data.slice(0, hits[0][0]).trim()
      const frag = document.createDocumentFragment()
      let at = 0
      hits.forEach(([idx, word, ic], k) => {
        if (idx < at) return
        frag.append(n.data.slice(at, idx))
        if (k === 0 && iconBefore) { const sp = document.createElement('span'); sp.className = 'ic'; sp.textContent = word; frag.append(sp) }
        else { const sp = document.createElement('span'); sp.className = 'ic'; sp.innerHTML = `<img src="${A}/icons/${ic}" alt="">${word}`; frag.append(sp) }
        at = idx + word.length
      })
      frag.append(n.data.slice(at))
      n.replaceWith(frag)
    }
  }
  iconize(host)
  const mo = new MutationObserver((ms) => { for (const m of ms) for (const a of m.addedNodes) iconize(a.nodeType === 3 ? a.parentElement : a) }); mo.observe(host, { childList: true, subtree: true })

  return () => {
    for (const f of undo) f()
    for (const id of timers) { window.clearTimeout(id); window.clearInterval(id) }
    mo.disconnect()
  }
}
