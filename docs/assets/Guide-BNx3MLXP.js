import{r as ne,j as C}from"./react-BnBjmWcX.js";import{L as re}from"./router-YOXIOte-.js";import{u as Je,b as Ze}from"./index-CKyPWIM6.js";const Bt=`:host {
    --bg: #05070f; --panel: #0b1120; --panel2: #0f172b; --line: rgb(255 255 255 / 10%); --line2: rgb(255 255 255 / 18%);
    --text: #dfe6f3; --dim: #b8c2d6; --faint: #8a96ad;
    --gold: #f2c35a; --gold2: #ffe9a6; --cyan: #00baff; --mine: #19d3c5; --enemy: #ff4d5e; --green: #4ee07a; --violet: #8f7bff;
    --gem: #ff5fc8; --metal: #f2c35a; --air: #3fd8ff; --fire: #ff7a2e; --nature: #4ee07a; --neutral: #8f7bff;
  }
  * { box-sizing: border-box; }
  .gx { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 'Titillium Web', 'Segoe UI', system-ui, sans-serif; }
  b, strong { color: #fff; }
  img { max-width: 100%; }
  button { font: inherit; color: inherit; }

  /* ---------- the frame ---------- */
  .hero { position: relative; padding: 70px 24px 60px; text-align: center; overflow: hidden; background: radial-gradient(70% 90% at 50% 0%, rgb(0 186 255 / 18%), transparent 70%), linear-gradient(180deg, #0a1030, var(--bg)); }
  .hero::before { content: ''; position: absolute; inset: 0; background: url('%A%/background/bg-catch-and-conquer.webp') center/cover; opacity: 0.18; mask: linear-gradient(180deg, #000 40%, transparent); }
  .hero > * { position: relative; }
  .kick { font: 800 13px Orbitron; letter-spacing: 0.32em; color: var(--mine); text-transform: uppercase; }
  .hero h1 { margin: 12px 0 10px; font: 900 clamp(30px, 5vw, 52px)/1.05 Orbitron; text-transform: uppercase; letter-spacing: 0.04em; }
  .hero h1 em { font-style: normal; color: var(--gold); }
  .hero p { margin: 0 auto; max-width: 62ch; color: var(--dim); }
  .hero .loop { margin: 36px auto 0; }

  .wrap { max-width: 1240px; margin: 0 auto; padding: 0 20px 100px; display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 40px; }
  .toc { position: sticky; top: 16px; align-self: start; max-height: calc(100vh - 32px); overflow: auto; padding: 16px 12px; border-radius: 16px; background: var(--panel); box-shadow: inset 0 0 0 1px var(--line); }
  .toc h4 { margin: 14px 8px 6px; font: 800 11px Orbitron; letter-spacing: 0.2em; color: var(--faint); text-transform: uppercase; }
  .toc h4:first-child { margin-top: 2px; }
  .toc a { display: flex; align-items: center; gap: 9px; padding: 6px 8px; border-radius: 8px; color: var(--dim); text-decoration: none; font-size: 14px; }
  .toc a img { width: 18px; height: 18px; opacity: 0.8; }
  .toc a:hover { background: rgb(255 255 255 / 5%); color: #fff; }
  .toc a.on { background: rgb(0 186 255 / 14%); color: #fff; box-shadow: inset 2px 0 0 var(--cyan); }
  .search { position: relative; margin: 2px 0 8px; }
  .search input { width: 100%; height: 38px; padding: 0 12px 0 34px; border: 0; border-radius: 10px; background: rgb(0 0 0 / 35%); box-shadow: inset 0 0 0 1px var(--line2); color: #fff; font: 600 14px 'Titillium Web'; }
  .search svg { position: absolute; left: 11px; top: 11px; width: 16px; height: 16px; stroke: var(--faint); fill: none; stroke-width: 2; }

  main { min-width: 0; }
  .part { margin: 56px 0 6px; display: flex; align-items: center; gap: 14px; font: 900 14px Orbitron; letter-spacing: 0.3em; color: var(--gold); text-transform: uppercase; }
  .part::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgb(242 195 90 / 50%), transparent); }
  section.ch { margin: 26px 0 0; padding: 26px 28px 28px; border-radius: 20px; background: linear-gradient(180deg, var(--panel2), var(--panel)); box-shadow: inset 0 0 0 1px var(--line); scroll-margin-top: calc(var(--topbar-h, 0px) + 16px); }
  .chhead { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
  .chhead img.ic { width: 40px; height: 40px; padding: 7px; border-radius: 12px; background: rgb(255 255 255 / 5%); box-shadow: inset 0 0 0 1px var(--line); }
  .chhead h2 { margin: 0; font: 900 24px/1.1 Orbitron; text-transform: uppercase; letter-spacing: 0.03em; }
  .chhead h2 em { font-style: normal; color: var(--mine); }
  .chhead .n { margin-left: auto; font: 900 13px Orbitron; color: var(--faint); }
  .lead { margin: 0 0 16px; font-size: 17px; color: var(--dim); max-width: 75ch; }
  .lead b { color: #fff; }
  ul.pts { margin: 14px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
  ul.pts li { position: relative; padding-left: 22px; color: var(--dim); }
  ul.pts li::before { content: ''; position: absolute; left: 4px; top: 10px; width: 7px; height: 7px; border-radius: 2px; transform: rotate(45deg); background: var(--mine); }
  .tip, .warn { position: relative; margin-top: 16px; padding: 12px 14px 12px 48px; border-radius: 12px; font-size: 15px; color: var(--dim); }
  .tip { background: rgb(0 186 255 / 8%); box-shadow: inset 0 0 0 1px rgb(0 186 255 / 30%); }
  .warn { background: rgb(255 77 94 / 8%); box-shadow: inset 0 0 0 1px rgb(255 77 94 / 35%); }
  .tip::before, .warn::before { position: absolute; left: 14px; top: 12px; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; font: 900 13px Orbitron; }
  .tip::before { content: 'i'; background: rgb(0 186 255 / 25%); color: #bfeaff; }
  .warn::before { content: '!'; background: rgb(255 77 94 / 25%); color: #ffc0c7; }
  .today { display: inline-block; padding: 0 6px; border-radius: 5px; background: rgb(255 255 255 / 7%); font-size: 12px; color: var(--faint); vertical-align: 1px; }
  .ex { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 6px; background: rgb(242 195 90 / 14%); color: var(--gold2); font: 800 10px Orbitron; letter-spacing: 0.12em; text-transform: uppercase; vertical-align: 2px; }
  .card { margin-top: 18px; padding: 18px; border-radius: 16px; background: rgb(0 0 0 / 28%); box-shadow: inset 0 0 0 1px var(--line); }
  .cap { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font: 800 12px Orbitron; letter-spacing: 0.16em; color: var(--faint); text-transform: uppercase; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
  .tile { padding: 14px; border-radius: 14px; background: rgb(255 255 255 / 3%); box-shadow: inset 0 0 0 1px var(--line); }
  .tile h4 { display: flex; align-items: center; gap: 9px; margin: 0 0 6px; font: 800 15px Orbitron; letter-spacing: 0.03em; }
  .tile h4 img { width: 24px; height: 24px; }
  .tile p { margin: 0; font-size: 14.5px; color: var(--dim); }
  .seg { display: inline-flex; padding: 3px; border-radius: 10px; background: rgb(0 0 0 / 35%); box-shadow: inset 0 0 0 1px var(--line2); }
  .seg button { min-height: 34px; padding: 0 14px; border: 0; border-radius: 8px; background: none; color: var(--dim); font: 800 13px Orbitron; cursor: pointer; }
  .seg button.on { background: rgb(0 186 255 / 18%); color: #fff; box-shadow: inset 0 0 0 1px rgb(0 186 255 / 60%); }
  .btn { min-height: 38px; padding: 0 16px; border: 0; border-radius: 10px; background: rgb(255 255 255 / 7%); box-shadow: inset 0 0 0 1px var(--line2); color: #fff; font: 800 13px Orbitron; letter-spacing: 0.04em; cursor: pointer; }
  .btn.gold { background: linear-gradient(180deg, #ffe7a0, #e0a83c 60%, #b47a1e); color: #2a1a04; box-shadow: none; }
  .btn.cyan { background: rgb(0 186 255 / 16%); box-shadow: inset 0 0 0 1px rgb(0 186 255 / 70%); }
  .btn:disabled { opacity: 0.4; cursor: default; }
  input[type=range] { width: 100%; accent-color: var(--cyan); }
  .hide { display: none !important; }
  .ic { white-space: nowrap; }
  .ic > img { display: inline-block; width: 1.1em; height: 1.1em; margin-right: 0.22em; vertical-align: -0.2em; object-fit: contain; }

  /* gilded cards, as in the game */
  .gc { position: relative; display: inline-block; width: 92px; aspect-ratio: 3 / 4.25; padding: 3px; border-radius: 8px; background: linear-gradient(160deg, #fff4cf, #e9b54c 30%, #7c5418 60%, #d9a640 85%, #fff0bd); box-shadow: 0 6px 14px rgb(0 0 0 / 50%); vertical-align: top; }
  .gc > span { position: absolute; inset: 3px; overflow: hidden; border-radius: 6px; background-size: cover; background-position: center; }
  .gc img.art { position: absolute; left: -32%; top: -4%; width: 164%; max-width: none; }
  .gc .lv { position: absolute; left: 5px; top: 5px; z-index: 2; display: grid; place-items: center; width: 22px; height: 22px; transform: rotate(45deg); border-radius: 4px; background: #0d1630; box-shadow: inset 0 0 0 1.5px var(--gold); }
  .gc .lv b { transform: rotate(-45deg); font: 900 10px Orbitron; }
  .gc .el { position: absolute; right: 5px; top: 5px; z-index: 2; width: 22px; height: 22px; padding: 3px; border-radius: 50%; background: rgb(6 10 22 / 80%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 30%); }
  .gc .nm { position: absolute; left: 0; right: 0; bottom: 6px; z-index: 2; text-align: center; font: 800 9.5px Orbitron; text-transform: uppercase; color: #fff; text-shadow: 0 0 4px #000, 0 0 4px #000; }
  .gc.big { width: 170px; padding: 5px; border-radius: 13px; }
  .gc.big > span { inset: 5px; border-radius: 9px; }
  .gc.big .lv { width: 32px; height: 32px; left: 9px; top: 9px; } .gc.big .lv b { font-size: 14px; }
  .gc.big .el { width: 32px; height: 32px; right: 9px; top: 9px; padding: 5px; }
  .gc.big .nm { font-size: 14px; bottom: 10px; }
  .enemyrow .gc .nm, .arenaq .gc .nm, .sock .gc .nm { display: none; }
  .enemyrow .gc .lv, .sock .gc .lv { width: 16px; height: 16px; left: 4px; top: 4px; } .enemyrow .gc .lv b, .sock .gc .lv b { font-size: 8px; }
  .enemyrow .gc .el, .sock .gc .el { width: 16px; height: 16px; padding: 2px; }
  .gc.sel { box-shadow: 0 0 0 3px var(--cyan), 0 6px 14px rgb(0 0 0 / 50%); }
  .gc.ko > span { filter: grayscale(1) brightness(0.45); }
  .gc.slot { background: rgb(255 255 255 / 5%); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 22%); }
  .gc.slot::after { content: '+'; position: absolute; inset: 0; display: grid; place-items: center; font: 900 26px Orbitron; color: rgb(255 255 255 / 30%); }

  /* ---------- chapter pieces ---------- */
  /* getting started */
  .starts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .starts div { position: relative; display: grid; justify-items: center; align-content: start; gap: 6px; padding: 22px 14px 18px; border-radius: 16px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); text-align: center; }
  .starts i { position: absolute; left: 12px; top: 12px; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: rgb(25 211 197 / 18%); box-shadow: inset 0 0 0 1px var(--mine); font: 900 12px Orbitron; font-style: normal; color: var(--mine); }
  .starts img { width: 44px; height: 44px; object-fit: contain; }
  .starts b { font: 800 15px Orbitron; }
  .starts span { font-size: 14.5px; color: var(--dim); }
  @media (max-width: 1200px) { .starts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) { .starts { grid-template-columns: 1fr; } }
  /* the loop */
  .loop { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-width: 900px; }
  .loop button { display: grid; justify-items: center; gap: 4px; width: 132px; padding: 14px 8px; border: 0; border-radius: 14px; background: rgb(255 255 255 / 5%); box-shadow: inset 0 0 0 1px var(--line2); cursor: pointer; transition: transform .15s; }
  .loop button img { width: 34px; height: 34px; }
  .loop button b { font: 800 12.5px Orbitron; letter-spacing: 0.04em; }
  .loop button small { font-size: 12px; color: var(--faint); }
  .loop button.on { background: rgb(0 186 255 / 14%); box-shadow: inset 0 0 0 1.5px var(--cyan); transform: translateY(-3px); }
  .loop button .ics { display: flex; gap: 2px; } .loop button .ics img { width: 30px; height: 34px; object-fit: contain; }
  .hero .loopnote { margin: 30px auto 0; max-width: 640px; min-height: 52px; color: var(--dim); }
  .arrow { align-self: center; color: var(--faint); font-weight: 900; }

  /* currencies */
  .coins { display: grid; grid-template-columns: 1fr auto 1fr; gap: 18px; align-items: start; }
  .coins > i { align-self: stretch; width: 1px; margin-top: 26px; background: linear-gradient(180deg, transparent, var(--line2) 20%, var(--line2) 80%, transparent); }
  .coingrp h5 { display: flex; justify-content: center; align-items: baseline; gap: 8px; margin: 0 0 4px; font: 800 11px Orbitron; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); }
  .coingrp h5 small { font: 600 12px 'Titillium Web'; letter-spacing: 0; text-transform: none; color: var(--faint); }
  .coingrp > div { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .coin { display: grid; justify-items: center; gap: 8px; padding: 14px 4px 12px; border: 0; border-radius: 16px; background: none; cursor: pointer; transition: background .2s; }
  .coin span { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--c) 30%, transparent), rgb(255 255 255 / 3%) 70%); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--c) 45%, transparent); transition: transform .2s, box-shadow .2s; }
  .coin img { width: 34px; height: 34px; object-fit: contain; }
  .coin b { font: 800 13px Orbitron; color: var(--dim); }
  .coin:hover span { transform: translateY(-3px); }
  .coin.on { background: rgb(255 255 255 / 4%); }
  .coin.on span { transform: translateY(-3px) scale(1.06); box-shadow: inset 0 0 0 2px var(--c), 0 0 22px color-mix(in srgb, var(--c) 45%, transparent); }
  .coin.on b { color: #fff; }
  .coinx { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .3s ease; }
  .coinx.open { grid-template-rows: 1fr; }
  .coinx > div { overflow: hidden; }
  .coinbox { margin-top: 12px; padding: 16px 18px; border-radius: 16px; background: rgb(0 0 0 / 28%); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent); }
  .coinbox h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 4px; font: 900 18px Orbitron; color: var(--c); }
  .coinbox h3 img { width: 26px; height: 26px; object-fit: contain; }
  .coinbox > p { margin: 0 0 14px; color: var(--dim); }
  .coinrow { display: grid; grid-template-columns: 96px 1fr; gap: 10px; align-items: start; margin-top: 8px; }
  .coinrow small { padding-top: 5px; font: 800 10.5px Orbitron; letter-spacing: 0.16em; text-transform: uppercase; color: var(--faint); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips span { padding: 4px 10px; border-radius: 999px; background: rgb(255 255 255 / 6%); box-shadow: inset 0 0 0 1px var(--line); font-size: 13.5px; color: var(--text); }
  .coinbox .note { margin-top: 14px; padding: 9px 12px; border-radius: 10px; background: color-mix(in srgb, var(--c) 10%, transparent); font-size: 14px; color: var(--dim); }
  .coinhint { margin: 8px 0 0; text-align: center; font-size: 13.5px; color: var(--faint); }

  /* map */
  .gmap { position: relative; aspect-ratio: 2 / 1; border-radius: 16px; overflow: hidden; background: #0d2a2c center / cover; box-shadow: inset 0 0 0 1px var(--line2), 0 10px 30px rgb(0 0 0 / 40%); transition: background-image .2s; }
  .gmap::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(120% 90% at 50% 50%, transparent 60%, rgb(0 0 0 / 45%)); }
  .gmap.warp { animation: warp .9s ease both; }
  @keyframes warp { 40% { filter: brightness(2.2) saturate(0) blur(6px); transform: scale(1.04); } }
  .gmap svg.route { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
  .gmap svg.route path { fill: none; stroke: #ffe9a6; stroke-width: 2.5; stroke-dasharray: 7 6; filter: drop-shadow(0 0 3px rgb(0 0 0 / 80%)); animation: march 1s linear infinite; }
  @keyframes march { to { stroke-dashoffset: -26; } }
  .mk { position: absolute; z-index: 2; translate: -50% -88%; display: grid; justify-items: center; padding: 0; border: 0; background: none; cursor: pointer; }
  .mk img { width: clamp(30px, 5vw, 54px); filter: drop-shadow(0 3px 3px rgb(0 0 0 / 55%)); transition: transform .15s; }
  .mk:hover img, .mk.on img { transform: translateY(-3px) scale(1.08); }
  .mk em { margin-top: -4px; padding: 0 6px; border-radius: 6px; background: #1a1206; box-shadow: inset 0 0 0 1px #c9973a; font: 800 10.5px Orbitron; font-style: normal; color: #ffd98a; }
  .mk.hot img { filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #ffb347) drop-shadow(0 0 14px #ff5a1f); animation: hot 2.4s ease-in-out infinite; }
  .mk.hot em { background: linear-gradient(180deg, #ffe7a0, #e0a83c); color: #2a1a04; box-shadow: 0 0 10px rgb(255 160 60 / 70%); }
  @keyframes hot { 50% { filter: drop-shadow(0 0 3px #fff) drop-shadow(0 0 10px #ffc266) drop-shadow(0 0 20px #ff5a1f); } }
  .gme { position: absolute; z-index: 3; translate: -50% -100%; display: grid; justify-items: center; pointer-events: none; transition: left .9s cubic-bezier(.5,0,.3,1), top .9s cubic-bezier(.5,0,.3,1); }
  .gme b { padding: 1px 7px; border-radius: 6px; background: #fff; color: #0a0d18; font: 900 9.5px Orbitron; }
  .gme i { width: clamp(26px, 3.4vw, 36px); aspect-ratio: 1; margin-top: 2px; border-radius: 50%; background: radial-gradient(circle, #ff3b3b 30%, #fff 33% 45%, #ff3b3b 48%); box-shadow: 0 0 0 3px #fff, 0 4px 10px rgb(0 0 0 / 60%); }
  .landcard { position: absolute; z-index: 4; display: flex; align-items: stretch; min-width: 240px; border-radius: 10px; overflow: hidden; background: #0c1426; box-shadow: 0 0 0 1px rgb(255 255 255 / 14%), 0 10px 24px rgb(0 0 0 / 60%); translate: -50% 14px; animation: pop .18s ease both; }
  @keyframes pop { from { opacity: 0; transform: translateY(6px); } }
  .landcard > div { display: grid; align-content: center; gap: 1px; padding: 8px 12px; }
  .landcard b { font: 800 13.5px Orbitron; color: #fff; white-space: nowrap; }
  .landcard small { font: 800 10px Orbitron; letter-spacing: 0.1em; color: var(--cyan); text-transform: uppercase; white-space: nowrap; }
  .landcard span { font-size: 12.5px; color: var(--dim); max-width: 220px; }
  .landcard button { display: flex; align-items: center; gap: 6px; padding: 0 16px; border: 0; background: linear-gradient(180deg, #ffd45a, #f0a81e); color: #2a1a04; font: 800 13px Orbitron; cursor: pointer; white-space: nowrap; }
  .landcard button.go { background: linear-gradient(180deg, #4fd6ff, #0096e0); color: #04121c; }
  .landcard button img { width: 16px; }
  .gmaphint { display: none; margin: 6px 0 0; font-size: 12.5px; color: var(--faint); text-align: center; }
  .gtabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
  .gtabs button { display: flex; align-items: center; gap: 7px; padding: 4px 12px 4px 4px; border: 0; border-radius: 999px; background: rgb(255 255 255 / 5%); box-shadow: inset 0 0 0 1px var(--line); color: var(--dim); font: 800 11.5px Orbitron; text-transform: uppercase; cursor: pointer; }
  .gtabs button img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
  .gtabs button.on { background: rgb(0 186 255 / 14%); box-shadow: inset 0 0 0 1.5px var(--cyan); color: #fff; }
  .gkeys { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-top: 14px; }
  .gkeys div { display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); font-size: 14px; color: var(--dim); }
  .gkeys img { flex: none; width: 40px; height: 40px; object-fit: contain; }
  .gkeys .hotkey img { filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #ffb347) drop-shadow(0 0 12px #ff5a1f); }
  .gkeys b { display: block; font: 800 13.5px Orbitron; color: #fff; }

  /* the tavern */
  .tav { padding: 0; overflow: hidden; }
  .tavtop { display: grid; grid-template-columns: 230px minmax(0, 1fr); }
  .tavrec { position: relative; display: grid; justify-items: center; align-content: center; gap: 10px; padding: 22px 16px; background: radial-gradient(90% 70% at 50% 40%, rgb(255 122 46 / 22%), transparent 70%), linear-gradient(180deg, #1a0f12, #0b0a14); border-right: 1px solid var(--line); }
  .tavrec .gc.big { width: 150px; }
  .tavrec b { font: 800 12px Orbitron; letter-spacing: 0.18em; color: var(--gold); text-transform: uppercase; }
  .tavrec small { font-size: 12.5px; color: var(--faint); text-align: center; }
  .tavdeal { display: grid; gap: 12px; align-content: start; padding: 18px 20px; }
  .tavcap { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .tavcap b { font: 800 12px Orbitron; letter-spacing: 0.18em; text-transform: uppercase; color: #fff; }
  .tavcap span { font-size: 12.5px; color: var(--faint); }
  .price { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .price s { font: 800 18px Orbitron; color: var(--faint); }
  .price strong { display: flex; align-items: center; gap: 6px; font: 900 30px Orbitron; color: var(--green); transition: color .2s; }
  .price strong img { width: 24px; }
  .price small { color: var(--faint); font-size: 13px; }
  .tmeter { position: relative; display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: rgb(255 255 255 / 6%); }
  .tmeter i { background: linear-gradient(90deg, #1e8f5a, #4ee07a); transition: width .35s; }
  .tmeter u { background: repeating-linear-gradient(45deg, rgb(0 186 255 / 55%) 0 5px, rgb(0 186 255 / 25%) 5px 10px); transition: width .35s; }
  .tslots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .tslot { display: grid; grid-template-columns: 46px 1fr; grid-template-rows: auto auto; column-gap: 10px; align-items: center; min-height: 72px; padding: 8px; border: 0; border-radius: 12px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); text-align: left; color: inherit; cursor: pointer; animation: pop .2s ease both; }
  .tslot.empty { display: flex; align-items: center; justify-content: center; gap: 8px; cursor: default; box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 14%); background: repeating-linear-gradient(45deg, rgb(255 255 255 / 2%) 0 8px, transparent 8px 16px); color: var(--faint); font-size: 12.5px; animation: none; }
  .tslot.empty i { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--line2); font: 900 11px Orbitron; font-style: normal; }
  .tslot img { grid-row: 1 / 3; width: 46px; border-radius: 5px; }
  .tslot b { font: 700 12.5px 'Titillium Web'; line-height: 1.2; }
  .tslot em { font: 800 12px Orbitron; font-style: normal; color: var(--air); }
  .tslot em.no { color: var(--faint); font-family: 'Titillium Web'; font-weight: 600; }
  .tslot.on { box-shadow: inset 0 0 0 1.5px rgb(63 216 255 / 60%); background: rgb(0 186 255 / 8%); }
  .wants { display: flex; flex-wrap: wrap; gap: 8px; }
  .want { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 999px; background: rgb(255 255 255 / 5%); box-shadow: inset 0 0 0 1px var(--line2); font-size: 13.5px; color: var(--dim); transition: all .25s; }
  .want em { padding: 1px 8px; border-radius: 999px; background: rgb(0 186 255 / 16%); font: 800 11.5px Orbitron; font-style: normal; color: #bfeaff; }
  .want.met { background: rgb(78 224 122 / 12%); box-shadow: inset 0 0 0 1.5px var(--green); color: #fff; }
  .want.met::before { content: '✓'; font-weight: 900; color: var(--green); }
  .want.met em { background: var(--green); color: #062016; }
  .tacts { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .tacts .btn.gold { display: flex; align-items: center; gap: 6px; }
  .tacts .btn.gold img { width: 15px; }
  .twallet { padding: 16px 20px 20px; border-top: 1px solid var(--line); background: rgb(0 0 0 / 18%); }
  .twallet .tavcap { margin-bottom: 12px; }
  .nfts { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
  .nft { position: relative; display: grid; gap: 6px; padding: 6px 6px 8px; border: 0; border-radius: 12px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); color: inherit; text-align: center; cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .nft:hover { transform: translateY(-3px); }
  .nft img { width: 100%; border-radius: 7px; }
  .nft b { font: 700 12px 'Titillium Web'; line-height: 1.2; min-height: 2.4em; }
  .nft small { font-size: 11px; color: var(--faint); line-height: 1.3; }
  .nft em { position: absolute; top: 10px; right: 10px; padding: 1px 7px; border-radius: 999px; background: #0a2a3a; box-shadow: inset 0 0 0 1px var(--air); font: 800 11px Orbitron; font-style: normal; color: #bfeaff; }
  .nft em.no { background: rgb(0 0 0 / 70%); box-shadow: none; color: var(--faint); font: 600 10.5px 'Titillium Web'; }
  .nft.picked { box-shadow: inset 0 0 0 2px var(--cyan), 0 0 16px rgb(0 186 255 / 30%); }
  .nft.picked::after { content: 'On the table'; position: absolute; left: 6px; right: 6px; top: 46%; padding: 3px 0; border-radius: 5px; background: rgb(0 186 255 / 92%); font: 800 9.5px Orbitron; color: #04121c; text-transform: uppercase; }
  .nft.shake { animation: shake .35s; }
  @keyframes shake { 25% { translate: -4px 0; } 75% { translate: 4px 0; } }

  /* the codex */
  .cdx { display: grid; grid-template-columns: minmax(0, 520px) minmax(0, 1fr); gap: 22px; align-items: start; }
  .codex { padding: 3px; border-radius: 18px; background: linear-gradient(160deg, #ffe7a0, #b47a1e 30%, #5a3d10 55%, #d9a640 80%, #fff0bd); box-shadow: 0 14px 34px rgb(0 0 0 / 50%); }
  .codex > div { display: grid; gap: 10px; padding: 16px; border-radius: 15px; background: linear-gradient(180deg, #0f1a3a, #0a1128); }
  .cx { border-radius: 10px; cursor: pointer; transition: box-shadow .15s, background .15s; }
  .cx:hover { box-shadow: 0 0 0 1.5px rgb(0 186 255 / 50%); }
  .cx.on { box-shadow: 0 0 0 2px var(--cyan), 0 0 18px rgb(0 186 255 / 35%); background: rgb(0 186 255 / 8%); }
  .cxhead { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: start; }
  .cxhead .gc { width: 96px; }
  .cxhead .gc .nm { font-size: 8px; bottom: 4px; } .cxhead .gc .lv { width: 18px; height: 18px; } .cxhead .gc .lv b { font-size: 8px; } .cxhead .gc .el { width: 18px; height: 18px; padding: 2px; }
  .cxtitle { display: grid; gap: 4px; justify-items: start; min-width: 0; }
  .cxkick { padding: 0 4px; font: 800 10.5px Orbitron; letter-spacing: 0.12em; color: var(--mine); text-transform: uppercase; }
  .cxname { padding: 0 4px; margin: 0; font: 900 26px/1 Orbitron; text-transform: uppercase; color: #fff; }
  .cxrace { display: flex; align-items: center; gap: 6px; padding: 2px 4px; font-size: 13.5px; color: var(--dim); }
  .cxrace img { width: 16px; }
  .cxchips { display: flex; flex-wrap: wrap; gap: 5px; }
  .cxchips span { display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; background: rgb(255 255 255 / 5%); box-shadow: inset 0 0 0 1px var(--line2); font-size: 12.5px; color: #fff; }
  .cxchips span.cx:hover { box-shadow: inset 0 0 0 1px var(--line2), 0 0 0 1.5px rgb(0 186 255 / 50%); }
  .cxscore { display: grid; place-items: center; align-content: center; width: 70px; height: 78px; clip-path: polygon(50% 0, 100% 22%, 100% 78%, 50% 100%, 0 78%, 0 22%); background: linear-gradient(180deg, #ffe7a0, #d39a33); color: #2a1a04; }
  .cxscore b { font: 900 24px/1 Orbitron; } .cxscore small { font: 800 9px Orbitron; letter-spacing: 0.14em; }
  .cxscore.on { filter: drop-shadow(0 0 8px var(--cyan)); }
  .cxup { display: flex; justify-content: space-between; gap: 6px; padding: 8px 12px; border-radius: 10px; box-shadow: inset 0 0 0 1px var(--line); font-size: 12.5px; color: var(--faint); }
  .cxup b { font: 800 13px Orbitron; color: #fff; } .cxup b.neg { color: var(--enemy); }
  .cxup .cx { padding: 2px 4px; }
  .cxsec { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; font: 800 11px Orbitron; letter-spacing: 0.24em; color: var(--gold); text-transform: uppercase; }
  .cxsec::before, .cxsec::after { content: '◆'; font-size: 8px; }
  .cxstat { display: grid; grid-template-columns: 112px 1fr 76px 16px; align-items: center; gap: 10px; padding: 3px 6px; }
  .cxstat small { display: flex; align-items: center; gap: 7px; font: 800 11.5px Orbitron; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
  .cxstat small img { width: 14px; }
  .cxseg { display: flex; gap: 3px; } .cxseg i { flex: 1; height: 7px; border-radius: 2px; background: rgb(255 255 255 / 9%); }
  .cxseg i.f { background: var(--g); }
  .cxstat b { font: 800 14px Orbitron; text-align: right; white-space: nowrap; } .cxstat b small { display: inline; font: 600 11px 'Titillium Web'; color: var(--faint); letter-spacing: 0; }
  .cxstat > img, .cxres img.g { width: 14px; }
  .cxres { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
  .cxres > span { display: grid; justify-items: center; gap: 4px; padding: 6px 0; }
  .cxres .hex { display: grid; place-items: center; width: 34px; height: 38px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); background: var(--ec); }
  .cxres .hex::before { content: ''; position: absolute; }
  .cxres .hex span { display: grid; place-items: center; width: 30px; height: 34px; clip-path: inherit; background: #0d1530; }
  .cxres .hex img { width: 16px; }
  .cxres b { display: flex; align-items: center; gap: 3px; font: 800 12.5px Orbitron; }
  .cxab { display: grid; gap: 4px; padding: 0 12px 10px; border-radius: 10px; box-shadow: inset 0 0 0 1px var(--line); }
  .cxab .rib { justify-self: start; display: flex; margin: -1px 0 2px; }
  .cxab .rib i { padding: 1px 12px; background: var(--r); clip-path: polygon(0 0, 100% 0, 92% 100%, 8% 100%); font: 800 9.5px Orbitron; font-style: normal; letter-spacing: 0.16em; color: #0a0d18; text-transform: uppercase; }
  .cxab .rib i.lock { background: #2b3550; color: #9fb0d6; margin-left: -4px; }
  .cxab b { font-size: 13.5px; color: #fff; } .cxab p { margin: 0; font-size: 12.5px; color: var(--dim); }
  .cxab .row { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; } .cxab .row em { font: 800 10.5px Orbitron; font-style: normal; color: var(--faint); white-space: nowrap; }
  .cxab.locked b { color: var(--dim); }
  .cxwhat { position: sticky; top: 16px; display: grid; gap: 10px; padding: 18px; border-radius: 16px; background: rgb(0 186 255 / 7%); box-shadow: inset 0 0 0 1px rgb(0 186 255 / 30%); }
  .cxwhat h4 { margin: 0; font: 900 17px Orbitron; color: #fff; text-transform: uppercase; }
  .cxwhat p { margin: 0; color: var(--dim); font-size: 15px; }
  .cxwhat small { font: 800 10.5px Orbitron; letter-spacing: 0.2em; color: var(--cyan); text-transform: uppercase; }
  .grades { display: grid; gap: 5px; margin-top: 4px; }
  .grades span { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--dim); }
  .grades img { width: 15px; } .grades i { width: 28px; height: 7px; border-radius: 2px; background: var(--g); }
  .explain { margin-top: 14px; min-height: 76px; padding: 12px 14px; border-radius: 12px; background: rgb(0 186 255 / 8%); box-shadow: inset 0 0 0 1px rgb(0 186 255 / 30%); font-size: 15px; color: var(--dim); }
  .explain b { color: #fff; }

  /* building a team: the dungeon's picker */
  .tm { padding: 0; overflow: visible; }
  .tmhead { display: flex; align-items: baseline; gap: 10px; padding: 16px 18px 0; }
  .tmhead b { font: 900 15px Orbitron; letter-spacing: 0.1em; color: var(--cyan); text-transform: uppercase; }
  .tmhead span { font: 800 13px Orbitron; color: var(--faint); }
  .tmslots { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)) minmax(0, 1.25fr); gap: 10px; padding: 12px 18px 18px; }
  .tmslot { display: grid; place-items: center; align-content: center; gap: 2px; aspect-ratio: 3 / 4.1; border-radius: 10px; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 12%); background: rgb(0 0 0 / 22%); color: var(--faint); font-size: 12px; text-align: center; }
  .tmslot::before { content: '+'; font: 400 22px 'Titillium Web'; color: var(--dim); }
  .tmslot.full { padding: 0; box-shadow: none; background: none; cursor: pointer; }
  .tmslot.full::before { display: none; }
  .tmslot.nft { aspect-ratio: auto; display: flex; gap: 6px; padding: 8px; box-shadow: inset 0 0 0 1px rgb(143 123 255 / 55%); background: rgb(143 123 255 / 8%); }
  .tmslot.nft::before { display: none; }
  .tmslot.nft span { display: grid; gap: 3px; justify-items: center; font: 800 9.5px Orbitron; color: #cfc6ff; text-transform: uppercase; }
  .tmslot.nft img { width: 100%; max-width: 70px; border-radius: 6px; }
  .tmgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; padding: 18px; border-top: 1px solid var(--line); background: rgb(0 0 0 / 16%); }
  .tmbar { display: flex; align-items: center; gap: 14px; padding: 12px 18px; border-top: 1px solid var(--line); border-radius: 0 0 16px 16px; background: rgb(6 10 22 / 70%); }
  .tmbar .mini { display: flex; gap: 6px; }
  .tmbar .mini i { width: 30px; height: 40px; border-radius: 5px; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 16%); background: center / cover; }
  .tmbar small { color: var(--dim); font-size: 13.5px; }
  .tmbar .btn { margin-left: auto; }
  .tmnote { padding: 0 18px 14px; min-height: 22px; font-size: 13.5px; color: var(--faint); }
  .tmnote b { color: #fff; }

  /* the game's compact card */
  .rc { position: relative; display: block; width: 100%; aspect-ratio: 3 / 4.1; padding: 0; border: 0; border-radius: 10px; background: linear-gradient(165deg, #a9bbdc, #56688d 38%, #2e3a57 68%, #7d91b6); box-shadow: 0 5px 12px rgb(0 0 0 / 50%); cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .rc:hover { transform: translateY(-3px); }
  .rc .pic { position: absolute; inset: 4px; overflow: hidden; border-radius: 7px; background: center / cover; box-shadow: inset 0 0 0 2px var(--ec); }
  .rc .pic img { position: absolute; left: -38%; top: -2%; width: 176%; max-width: none; }
  .rc .pic::after { content: ''; position: absolute; inset: auto 0 0; height: 42%; background: linear-gradient(transparent, rgb(3 7 18 / 88%)); }
  .rc .lv { position: absolute; left: -2px; top: -2px; z-index: 2; display: grid; place-items: center; width: 28%; aspect-ratio: 1; }
  .rc .lv::before { content: ''; position: absolute; inset: 14%; transform: rotate(45deg); border-radius: 3px; background: #0b1426; box-shadow: 0 0 0 1.5px rgb(255 255 255 / 55%); }
  .rc .lv b { position: relative; font: 900 clamp(9px, 1.05vw, 12px) Orbitron; color: #fff; }
  .rc .asc { position: absolute; left: 9%; top: 27%; z-index: 2; font: 800 clamp(8px, 0.9vw, 10.5px) Orbitron; color: #ffd979; text-shadow: 0 0 4px #000; }
  .rc .el { position: absolute; right: 7px; top: 7px; z-index: 2; width: 24%; aspect-ratio: 1; padding: 4%; border-radius: 50%; background: #0b1426; box-shadow: 0 0 0 1.5px var(--ec); }
  .rc .nm { position: absolute; left: 4px; right: 4px; bottom: 13%; z-index: 2; text-align: center; font: 800 clamp(8px, 0.95vw, 11.5px) Orbitron; text-transform: uppercase; color: #fff; text-shadow: 0 0 4px #000, 0 0 4px #000; white-space: nowrap; overflow: hidden; }
  .rc .nm.long { font-size: clamp(7px, 0.8vw, 9.5px); }
  .rc .xp { position: absolute; left: 18%; right: 18%; bottom: 7%; z-index: 2; height: 3px; background: repeating-linear-gradient(90deg, #f2c35a 0 17%, transparent 17% 20%); }
  .rc.picked { box-shadow: 0 0 0 2.5px var(--cyan), 0 0 18px rgb(0 186 255 / 55%); }
  .rc.busy .pic { filter: grayscale(0.85) brightness(0.55); }
  .rc .tag { position: absolute; left: 50%; top: -8px; z-index: 4; transform: translateX(-50%); padding: 1px 10px; clip-path: polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%); white-space: nowrap; font: 900 clamp(7px, 0.75vw, 9px) Orbitron; letter-spacing: 0.14em; text-transform: uppercase; pointer-events: none; }
  .rc .tag.team, .rc .tag.market { color: #062033; background: linear-gradient(180deg, #a8ecff, #00baff); }
  .rc .tag.payday { color: #fff; background: linear-gradient(180deg, #ff7a88, #c3203a); }
  .rc.due { animation: due 1.6s ease-in-out infinite; }
  @keyframes due { 50% { box-shadow: 0 0 0 2.5px var(--enemy), 0 0 16px rgb(255 77 94 / 60%); } }
  .rc.shake { animation: shake .35s; }

  /* the overlay on a resting pointer, as the game's pickers open it */
  .hovc { position: fixed; z-index: 50; width: 560px; padding: 16px; border-radius: 14px; background: #0c1430; box-shadow: 0 0 0 1px rgb(120 160 255 / 45%), 0 18px 40px rgb(0 0 0 / 65%); pointer-events: none; animation: pop .14s ease both; }
  .hovc h4 { margin: 0 0 4px; font: 900 21px Orbitron; text-transform: uppercase; color: #fff; }
  .hovc .ln { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 13px; color: var(--dim); }
  .hovc .ln img { width: 15px; }
  .hovc .ln span { padding: 0 7px; border-radius: 5px; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 30%); font: 800 10.5px Orbitron; color: #fff; text-transform: uppercase; }
  .hovc .ln span.g { background: rgb(78 224 122 / 14%); box-shadow: inset 0 0 0 1px var(--green); color: var(--green); }
  .hovc .cols { display: grid; grid-template-columns: 1.15fr 1fr; gap: 6px 18px; }
  .hovc .r { display: grid; grid-template-columns: 94px 1fr 58px 12px; align-items: center; gap: 6px; font: 800 10.5px Orbitron; color: var(--dim); text-transform: uppercase; }
  .hovc .cols > div:last-child .r { grid-template-columns: 80px 1fr 40px 12px; }
  .hovc .r em { display: flex; align-items: center; gap: 5px; font-style: normal; }
  .hovc .r em img, .hovc .r > img { width: 12px; }
  .hovc .r i { display: flex; gap: 1.5px; } .hovc .r i u { flex: 1; height: 5px; background: rgb(255 255 255 / 10%); text-decoration: none; transform: skewX(-20deg); } .hovc .r i u.f { background: var(--g); }
  .hovc .r b { font-size: 12.5px; color: #fff; text-align: right; white-space: nowrap; } .hovc .r b small { font: 600 10px 'Titillium Web'; color: var(--faint); }
  .hovc .tg { margin: 10px 0 8px; font-size: 13px; color: var(--dim); } .hovc .tg b { color: #fff; }
  .hovc .abs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .hovc .ab { padding: 0 10px 8px; border-radius: 8px; box-shadow: inset 0 0 0 1px var(--line2); font-size: 12px; color: var(--dim); }
  .hovc .ab.wide { grid-column: 1 / -1; }
  .hovc .ab .rib { display: flex; margin: -1px 0 3px; }
  .hovc .ab .rib i { padding: 0 10px; background: var(--r); clip-path: polygon(0 0, 100% 0, 92% 100%, 8% 100%); font: 800 9px Orbitron; font-style: normal; letter-spacing: 0.14em; color: #0a0d18; text-transform: uppercase; }
  .hovc .ab .rib i.lock { background: #2b3550; color: #9fb0d6; margin-left: -3px; }
  .hovc .ab b { display: block; font-size: 12.5px; color: #fff; }

  /* fight sim */
  .sim { display: grid; gap: 12px; }
  .lanes { display: grid; gap: 8px; }
  .lane { display: grid; grid-template-columns: 210px 1fr; align-items: center; gap: 12px; }
  .lane .who { display: flex; align-items: center; gap: 8px; font: 800 12.5px Orbitron; }
  .lane .who img { width: 30px; height: 30px; border-radius: 8px; object-fit: cover; object-position: top; background: #111; }
  .lane .who.me { color: var(--mine); } .lane .who.them { color: var(--enemy); }
  .track { position: relative; height: 30px; border-radius: 8px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); }
  .track i { position: absolute; top: 4px; width: 22px; height: 22px; margin-left: -11px; display: grid; place-items: center; border-radius: 50%; font: 900 10.5px Orbitron; font-style: normal; color: #041318; opacity: .35; transition: opacity .2s, transform .2s; }
  .track i.me { background: var(--mine); } .track i.them { background: var(--enemy); color: #fff; }
  .track i.done { opacity: 1; } .track i.now { opacity: 1; transform: scale(1.35); box-shadow: 0 0 0 3px #fff; }
  .clock { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--gold); box-shadow: 0 0 8px var(--gold); transition: left .3s; }
  .simctl { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .simlog { min-height: 48px; font-size: 14.5px; color: var(--dim); }
  .dmg { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: center; }
  .dmgbar { position: relative; height: 34px; border-radius: 9px; overflow: hidden; background: rgb(255 255 255 / 5%); box-shadow: inset 0 0 0 1px var(--line); }
  .dmgbar .hit { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #ff7a2e, #ffb35a); transition: width .2s; }
  .dmgbar .blk { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, rgb(63 216 255 / 30%) 0 6px, rgb(63 216 255 / 14%) 6px 12px); transition: left .2s, width .2s; }
  .dmgbar span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font: 800 12.5px Orbitron; text-shadow: 0 0 4px #000; }
  .big { font: 900 30px Orbitron; color: var(--gold2); }

  /* the battle view: the game's land stage, its fighters and their swings */
  .bvw { width: 100%; max-width: 720px; margin: 0 auto; border-radius: 14px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--line2); background: #05101e; }
  .bv { position: relative; aspect-ratio: 16 / 9; overflow: hidden; container-type: size; --impact: 580ms; --cyc: 1450ms; --unit: 17cqw; --ratio: 0.5625; }
  .bv > .bk, .bv > .gd { position: absolute; left: 0; width: 100%; pointer-events: none; }
  .bv > .bk { top: 0; height: 37.9%; }
  .bv > .gd { top: 34.3%; height: 65.7%; }
  .bv > .fw { position: absolute; left: 0; right: 0; top: 37%; bottom: 0; overflow: hidden; perspective: 80cqw; perspective-origin: 50% 0; }
  .bv > .fw i { position: absolute; left: -150%; width: 400%; top: 0; height: 150%; transform-origin: 50% 0; transform: rotateX(74deg); background-repeat: repeat; background-size: 1.7% auto; }
  .bv > .fw::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgb(10 30 30 / 45%), transparent 40%); }
  .bv > .grade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgb(4 8 20 / 55%), transparent 26%, transparent 70%, rgb(4 8 20 / 55%)); }
  .bvtop { position: absolute; left: 3%; right: 3%; top: 4%; z-index: 6; display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; }
  .bvtop .side { display: grid; gap: 4px; font: 900 clamp(10px, 1.6cqw, 15px) Orbitron; text-transform: uppercase; text-shadow: 0 0 6px #000; }
  .bvtop .side.them { text-align: right; }
  .bvtop .side i { display: block; height: 7px; border-radius: 4px; background: rgb(0 0 0 / 45%); overflow: hidden; }
  .bvtop .side i u { display: block; height: 100%; background: linear-gradient(90deg, #19d3c5, #00baff); transition: width .4s var(--impact); }
  .bvtop .side.them i u { margin-left: auto; background: linear-gradient(90deg, #ff4d5e, #ff8a5a); }
  .bvtop .me { color: var(--mine); } .bvtop .them { color: var(--enemy); }
  .bvtop .mid { padding: 3px 12px; border-radius: 6px; background: rgb(0 0 0 / 60%); font: 800 clamp(9px, 1.3cqw, 12px) Orbitron; color: #fff; }

  /* a fighter on the field, as the game's land stage draws it: the disc, the puppet, and over it the plate, the bar, the brackets and the numbers */
  .bu { position: absolute; z-index: 3; width: 17cqw; translate: -50% -100%; --su: calc(17cqw / 22); --away: -1; --lean: -1; }
  .bu.them { --away: 1; --lean: 1; }
  .bu .plat { position: absolute; left: 50%; bottom: -5%; width: 112%; height: 15%; translate: -50% 0; border: 2px solid var(--pr); border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--pr) 45%, transparent), rgb(0 0 0 / 0%)); box-shadow: 0 0 14px rgb(0 0 0 / 55%); }
  .bu.me { --pr: rgb(25 211 197 / 80%); } .bu.them { --pr: rgb(255 77 94 / 75%); }
  .bu.atk .plat { border-color: rgb(255 196 90); box-shadow: 0 0 22px rgb(255 150 30 / 70%); }
  .bu.def .plat { border-color: rgb(255 90 110); box-shadow: 0 0 22px rgb(255 50 70 / 65%); }
  .bu .fig { position: relative; display: block; aspect-ratio: 357 / 512; }
  .bu .body, .bu .rig, .bu .torso, .bu .fallen { position: absolute; inset: 0; }
  .bu .body { transform-origin: 50% 100%; }
  .bu .art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: bottom; filter: drop-shadow(0 6px 8px rgb(0 0 0 / 60%)); }
  .bu.them .art { transform: scaleX(-1); }
  /* the puppet: the legs stand, the upper half breathes, each fighter on its own beat */
  .bu .legs { clip-path: inset(56% 0 0 0); }
  .bu .torso > .art { clip-path: inset(0 0 41% 0); }
  .bu .torso { transform-origin: 50% 56%; animation: lunit-idle 2.4s ease-in-out var(--idl, 0s) infinite; }
  @keyframes lunit-idle { 50% { transform: translateY(-1.2%) rotate(calc(var(--lean) * -1.4deg)); } }
  /* hit: the upper half snaps back from the blow as it lands */
  .bu.def .torso { animation: lunit-hit 380ms ease-out var(--impact); }
  @keyframes lunit-hit { 0% { transform: rotate(calc(var(--lean) * 14deg)) translateX(calc(var(--lean) * 3%)); } 60% { transform: rotate(calc(var(--lean) * -4deg)); } }
  .bu .flash { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(50% 40% at 50% 55%, rgb(255 255 255 / 90%), rgb(255 255 255 / 0%) 70%); animation: flash 320ms ease-out var(--impact) both; }
  @keyframes flash { from { opacity: 1; transform: scale(0.8); } to { opacity: 0; transform: scale(1.3); } }
  /* down: a white flash, the knees give, it tips back around its feet, bounces once and lies greyed in a puff of dust */
  .bu .fallen { transform-origin: 50% 96%; transform: rotate(calc(var(--lean) * 90deg)); filter: grayscale(0.8) brightness(0.55); animation: land-ko 1400ms cubic-bezier(0.5, 0, 0.7, 1) var(--kod, 0s) both; }
  @keyframes land-ko { 0% { transform: none; filter: brightness(1); } 7% { transform: none; filter: brightness(2.4); } 16% { transform: translateY(2%) scaleY(0.93) rotate(calc(var(--lean) * -5deg)); filter: brightness(1.1); animation-timing-function: cubic-bezier(0.55, 0, 0.85, 0.4); } 58% { transform: rotate(calc(var(--lean) * 93deg)); filter: brightness(1); animation-timing-function: ease-out; } 67% { transform: translateY(-3%) rotate(calc(var(--lean) * 84deg)); } 76% { transform: rotate(calc(var(--lean) * 90deg)); filter: brightness(1); } }
  .bu .dust { position: absolute; left: 50%; bottom: -6%; width: 150%; height: 26%; translate: calc(-50% + var(--lean) * 30%) 0; border-radius: 50%; background: radial-gradient(closest-side, rgb(196 178 132 / 80%), rgb(150 132 92 / 35%) 55%, rgb(150 132 92 / 0%)); opacity: 0; pointer-events: none; animation: land-ko-dust 1400ms ease-out var(--kod, 0s) both; }
  @keyframes land-ko-dust { 0%, 56% { opacity: 0; transform: scale(0.3); } 64% { opacity: 0.9; transform: scale(1); } 100% { opacity: 0; transform: scale(1.5) translateY(-20%); } }
  .bu.dead .plat { animation: plat-down .4s ease-out var(--kod, 0s) both; }
  @keyframes plat-down { to { width: 150%; translate: calc(-50% + var(--lean) * 26%) 0; opacity: 0.45; } }
  .bu.dead .over { animation: over-out .4s var(--kod, 0s) forwards; }
  @keyframes over-out { to { opacity: 0; } }
  .bu.dead .ret { animation: over-out .2s var(--kod, 0s) forwards; }
  /* the plate and health bar over the head */
  .bu .over { position: absolute; left: 50%; bottom: 100%; translate: -50% -4px; display: grid; justify-items: center; gap: 3px; width: 100%; }
  .bu .plate { display: flex; align-items: center; gap: 5px; white-space: nowrap; font: 800 clamp(8px, 1.15cqw, 11px) Orbitron; color: #fff; text-shadow: 0 0 3px #000; }
  .bu .plate img { width: clamp(10px, 1.5cqw, 14px); }
  .bu .hpbar { position: relative; display: block; width: 62%; height: clamp(5px, 0.7cqw, 8px); background: #10151f; border: 1px solid #2b3547; border-radius: 2px; overflow: hidden; }
  .bu .hpbar i, .bu .hpbar u { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform-origin: left; scale: var(--from) 1; animation: hpdrain 170ms cubic-bezier(0.4, 0, 1, 1) var(--impact) forwards; }
  .bu .hpbar i { background: rgb(255 255 255 / 70%); animation: hpdrain 520ms cubic-bezier(0.4, 0, 0.2, 1) calc(var(--impact) + 260ms) forwards; }
  .bu .hpbar u { background: linear-gradient(180deg, #7ce85a, #35a814); text-decoration: none; }
  .bu .hpbar[data-band='mid'] u { background: linear-gradient(180deg, #ffd44d, #e09b12); }
  .bu .hpbar[data-band='low'] u { background: linear-gradient(180deg, #ff7a7a, #d81f3c); }
  @keyframes hpdrain { to { scale: var(--to) 1; } }
  /* the brackets round the target, snapping in as the attacker winds up */
  .bu .ret { position: absolute; inset: -6% -14% 0; z-index: 3; pointer-events: none; animation: lunit-ret-in 320ms cubic-bezier(0.2, 0.9, 0.3, 1.35) both, lunit-ret-breathe 900ms ease-in-out 320ms infinite; }
  .bu .ret i { position: absolute; width: 24%; height: 24%; border: 0.22cqw solid #ff5a6a; filter: drop-shadow(0 0 3px #ff5a6a); }
  .bu .ret i:nth-child(1) { top: 0; left: 0; border-right: 0; border-bottom: 0; }
  .bu .ret i:nth-child(2) { top: 0; right: 0; border-left: 0; border-bottom: 0; }
  .bu .ret i:nth-child(3) { bottom: 0; left: 0; border-right: 0; border-top: 0; }
  .bu .ret i:nth-child(4) { bottom: 0; right: 0; border-left: 0; border-top: 0; }
  @keyframes lunit-ret-in { from { opacity: 0; transform: scale(1.4) rotate(45deg); } }
  @keyframes lunit-ret-breathe { 50% { transform: scale(1.06); } }
  /* the number the blow throws up: swollen, settled to be read, lifted away */
  .bu .pop { position: absolute; left: 50%; top: 22%; z-index: 26; font: 900 3.4cqw/1 Orbitron; text-align: center; white-space: nowrap; color: #fff; text-shadow: 0 0 2px #000, 0 2px 0 #000, 0 0 14px rgb(0 0 0 / 80%); opacity: 0; pointer-events: none; animation: lunit-pop 1000ms ease-out var(--impact) forwards; --pop-min: -4.5cqw; }
  .bu .pop small { display: block; margin-top: 2px; font-size: 1.4cqw; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #c4cde0; }
  .bu .pop.big { font-size: 4.6cqw; color: #ffd979; }
  .bu .pop.kill { font-size: 5cqw; color: #ff5a6a; }
  @keyframes lunit-pop { 0% { transform: translate(-50%, min(-20%, calc(var(--pop-min) * 0.13))) scale(0.4); opacity: 0; } 18% { transform: translate(-50%, min(-60%, calc(var(--pop-min) * 0.4))) scale(1.25); opacity: 1; } 32% { transform: translate(-50%, min(-70%, calc(var(--pop-min) * 0.47))) scale(1); } 80% { opacity: 1; } 100% { transform: translate(-50%, min(-150%, var(--pop-min))) scale(1); opacity: 0; } }

  /* the swings, each class its own (Hunter: Piercing Shot; Juggernaut: Thunder Clap; Mystic: Moonbeam) */
  .bu.atk.c-hunter .body { animation: atk-draw var(--cyc) cubic-bezier(.35,.1,.3,1) both; }
  .bu.atk.c-juggernaut .body { animation: atk-slam var(--cyc) cubic-bezier(.35,.1,.3,1) both; }
  .bu.atk.c-mystic .body { animation: atk-lift var(--cyc) cubic-bezier(.35,.1,.3,1) both; }
  .bu.atk.c-mystic .rig { animation: atk-glow var(--cyc) ease-in-out calc(var(--cyc) * 0.1) both; --gc: #4ee6c2; }
  .bu.atk.c-hunter .rig { animation: atk-glow var(--cyc) ease-in-out calc(var(--cyc) * 0.12) both; --gc: #ffd979; }
  @keyframes atk-draw { 0%, 10% { transform: none; } 32% { transform: translateX(calc(var(--away) * 2 * var(--su))) scale(0.98); } 35% { transform: translateX(calc(var(--away) * 3.5 * var(--su))); } 38%, 100% { transform: none; } }
  @keyframes atk-slam { 0%, 14% { transform: none; } 26% { transform: translateY(calc(-7 * var(--su))) scale(1.04); } 31% { transform: translateY(calc(0.4 * var(--su))) scale(1.1, 0.9); } 38%, 100% { transform: none; } }
  @keyframes atk-lift { 0%, 10% { transform: none; } 24%, 40% { transform: translateY(calc(-3 * var(--su))) scale(1.03); } 52%, 100% { transform: none; } }
  @keyframes atk-glow { 0%, 24%, 100% { filter: drop-shadow(0 0 6px rgb(255 190 90 / 70%)) brightness(1); } 2% { filter: drop-shadow(0 0 8px var(--gc)) brightness(1.1); } 20% { filter: drop-shadow(0 0 22px var(--gc)) brightness(1.35); } }
  .bu.def.t-hunter .body { animation: took-big var(--cyc) cubic-bezier(.2,.9,.3,1) var(--impact) both; }
  .bu.def.t-juggernaut .body { animation: took-up var(--cyc) cubic-bezier(.2,.9,.3,1) var(--impact) both; }
  .bu.def.t-mystic .body { animation: took-crush var(--cyc) cubic-bezier(.2,.9,.3,1) var(--impact) both; }
  .bu.dead .body { animation: none; }
  @keyframes took-up { 0% { transform: none; } 2% { transform: translateY(calc(-6 * var(--su))) rotate(calc(var(--away) * -6deg)); } 8% { transform: translateY(calc(-9 * var(--su))) rotate(calc(var(--away) * -10deg)); } 14% { transform: translateY(0) scale(1.05, 0.93); } 18%, 100% { transform: none; } }
  @keyframes took-crush { 0% { transform: none; } 2% { transform: scale(1.08, 0.8); } 6% { transform: scale(0.94, 1.06); } 12%, 100% { transform: none; } }
  @keyframes took-big { 0% { transform: none; } 2% { transform: translateX(calc(var(--away) * 7 * var(--su))) rotate(calc(var(--away) * 9deg)) scale(0.92); } 9% { transform: translateX(calc(var(--away) * 5 * var(--su))) rotate(calc(var(--away) * 6deg)); } 24%, 100% { transform: none; } }

  /* ---- from the game's battle.css: the blow's effect on the field ---- */
  .bv > .bfx { z-index: 5; }
  .bv.shake > :is(.bu, .bfx) { animation: field-shake-0 calc(var(--cyc) * 0.05) linear var(--impact) both; }
  @keyframes field-shake-0 {
    0%, 100% { transform: none; }
    20% { transform: translate(calc(-3px * var(--shake)), calc(2px * var(--shake))); }
    40% { transform: translate(calc(2.6px * var(--shake)), calc(-1.5px * var(--shake))); }
    60% { transform: translate(calc(-1.8px * var(--shake)), calc(0.9px * var(--shake))); }
    80% { transform: translate(calc(0.9px * var(--shake)), 0); }
  }
  @keyframes field-shake-1 {
    0%, 100% { transform: none; }
    20% { transform: translate(calc(-3px * var(--shake)), calc(2px * var(--shake))); }
    40% { transform: translate(calc(2.6px * var(--shake)), calc(-1.5px * var(--shake))); }
    60% { transform: translate(calc(-1.8px * var(--shake)), calc(0.9px * var(--shake))); }
    80% { transform: translate(calc(0.9px * var(--shake)), 0); }
  }
  @keyframes field-flurry-0 {
    0%, 20%, 40%, 60%, 80%, 100% { transform: none; }
    7%, 47%, 87% { transform: translate(calc(-2.4px * var(--shake)), calc(1.5px * var(--shake))); }
    13%, 53%, 93% { transform: translate(calc(2.1px * var(--shake)), calc(-1.2px * var(--shake))); }
  }
  @keyframes field-flurry-1 {
    0%, 20%, 40%, 60%, 80%, 100% { transform: none; }
    7%, 47%, 87% { transform: translate(calc(-2.4px * var(--shake)), calc(1.5px * var(--shake))); }
    13%, 53%, 93% { transform: translate(calc(2.1px * var(--shake)), calc(-1.2px * var(--shake))); }
  }
  
  
  /* ---- the effect layer ---- */
  .bfx {
    /* Where things are, from the two fighters' feet and depth. */
    --axp: calc(var(--ax) * 1%);
    --txp: calc(var(--tx) * 1%);
    --ach: calc(var(--ay) * 1% - var(--unit) * 0.79 * var(--da));
    --tch: calc(var(--ty) * 1% - var(--unit) * 0.79 * var(--dt));
    --tft: calc(var(--ty) * 1%);
    --aft: calc(var(--ay) * 1%);
    /* Chest to chest, and feet to feet. */
    --mx: calc((var(--tx) - var(--ax)) * 1cqw);
    --my: calc((var(--ty) - var(--ay)) * var(--ratio) * 1cqw - (var(--dt) - var(--da)) * var(--unit) * 0.79);
    --fx: calc((var(--tx) - var(--ax)) * 1cqw);
    --fy: calc((var(--ty) - var(--ay)) * var(--ratio) * 1cqw);
    /* One unit of the drawing, at the target and at the attacker. */
    --st: calc(var(--unit) / 22 * var(--dt));
    --sa: calc(var(--unit) / 22 * var(--da));
    position: absolute;
    inset: 0;
    z-index: 320;
    pointer-events: none;
  }
  
  /*
   * A piece, by default centred on a point near the target: --x drawing units
   * on past it (away from the attacker), --y below its feet, --w by --h in
   * size, starting --t of the way through the cycle. Pieces that start at the
   * attacker or fly across set their own place.
   */
  .bfx > i {
    --x: 0;
    --y: 0;
    --w: 10;
    --h: 10;
    --t: 0.4;
    --c: #fff;
    position: absolute;
    display: block;
    left: calc(var(--txp) + var(--dir) * var(--x) * var(--st));
    top: calc(var(--tft) + var(--y) * var(--st));
    width: calc(var(--w) * var(--st));
    height: calc(var(--h) * var(--st));
    margin: calc(var(--h) * var(--st) / -2) 0 0 calc(var(--w) * var(--st) / -2);
    opacity: 0;
    animation: sig-pop var(--cyc) ease-out calc(var(--cyc) * var(--t)) both;
  }
  /* Pieces drawn in layers: an inner shape with a motion of its own. */
  .bfx--consecration > i:nth-child(1)::before,
  .bfx--nether > i:nth-child(3)::before,
  .bfx--bombs > i:nth-child(-n + 3)::before,
  .bfx--bombs > i:nth-child(6)::before,
  .bfx--cluster > i:nth-child(1)::before {
    content: '';
    position: absolute;
    inset: 0;
  }
  
  /* Flying from the attacker's chest to the target's, over --span of the cycle. */
  @keyframes sig-go {
    0% { translate: 0 0; opacity: 0; }
    3%, 97% { opacity: 1; }
    100% { translate: calc(var(--mx) * var(--reach, 1)) calc(var(--my) * var(--reach, 1)); opacity: 0; }
  }
  @keyframes sig-arc {
    0% { transform: translateY(0); animation-timing-function: cubic-bezier(0.3, 0.6, 0.6, 1); }
    50% { transform: translateY(calc(var(--ah) * -1 * var(--sa))); animation-timing-function: cubic-bezier(0.4, 0, 0.7, 0.4); }
    100% { transform: translateY(0); }
  }
  
  /* One-shot shapes, placed in the cycle by their delay; each starts unseen.
     Percentages are of the whole cycle, so 1% is about 15 ms at full speed.
     Only transform, opacity and the transform properties move. */
  @keyframes sig-pop { 0% { opacity: 0; transform: scale(0.2); } 0.3% { opacity: 1; transform: scale(0.25); } 16%, 100% { opacity: 0; transform: scale(1.6); } }
  @keyframes sig-slash { 0% { opacity: 0; transform: scaleX(0); } 0.3% { opacity: 1; transform: scaleX(0); } 4% { opacity: 1; transform: scaleX(1); } 12%, 100% { opacity: 0; transform: scaleX(1.08); } }
  @keyframes sig-inhold { 0% { opacity: 0; transform: scale(0); } 0.3% { opacity: 1; transform: scale(0); } 8% { transform: scale(1); } 18% { opacity: 1; transform: scale(1); } 24%, 100% { opacity: 0; transform: scale(0.6); } }
  @keyframes sig-out { 0% { opacity: 0; transform: translate(0, 0) rotate(0) scale(1); } 0.3% { opacity: 1; } 14%, 100% { opacity: 0; transform: translate(var(--rx), var(--ry)) rotate(220deg) scale(0.5); } }
  @keyframes fx-pop { 0% { opacity: 0; transform: scale(var(--s0, 0.2)); } 0.5% { opacity: 1; } 12% { opacity: 0.85; } 26%, 100% { opacity: 0; transform: scale(var(--s1, 1.4)); } }
  @keyframes fx-ripple { 0% { opacity: 0; transform: scale(0.15); } 0.5% { opacity: 1; } 16% { opacity: 0.8; } 28%, 100% { opacity: 0; transform: scale(var(--s1, 3)); } }
  @keyframes fx-dome { 0% { opacity: 0; transform: scale(0.15, 0.1); } 1% { opacity: 1; } 13% { opacity: 0.85; transform: scale(1, 1); } 27%, 100% { opacity: 0; transform: scale(1.18, 1.1); } }
  @keyframes fx-dim { 0% { opacity: 0; } 0.5% { opacity: var(--o, 0.6); } 13%, 100% { opacity: 0; } }
  @keyframes fx-mark { 0% { opacity: 0; transform: scale(0.5); } 6% { opacity: 1; transform: scale(1.04); } 10% { transform: scale(1); } 26% { opacity: 1; transform: scale(1); } 32%, 100% { opacity: 0; transform: scale(1.08); } }
  @keyframes fx-rise { 0% { opacity: 0; transform: scale(1, 0); } 0.5% { opacity: 1; } 6% { transform: scale(1, 1); } 20% { opacity: 0.9; } 32%, 100% { opacity: 0; transform: scale(var(--sx1, 0.2), 1.05); } }
  @keyframes fx-hover { 0% { opacity: 0; transform: scale(0.6); } 6% { opacity: 1; transform: scale(1); } 25% { opacity: 1; } 35%, 100% { opacity: 0; transform: scale(1.15); } }
  @keyframes fx-fall { 0% { opacity: 0; translate: var(--fx) var(--fy); } 2% { opacity: 1; } 12% { opacity: 1; translate: 0 0; } 14%, 100% { opacity: 0; translate: 0 0; } }
  @keyframes fx-float { 0% { opacity: 0; transform: translate(0, 0) scale(0.4); } 4% { opacity: 1; transform: translate(0, calc(-4 * var(--st))) scale(1.15); } 22% { opacity: 1; } 34%, 100% { opacity: 0; transform: translate(0, calc(-14 * var(--st))) scale(1); } }
  @keyframes fx-scatter { 0% { opacity: 0; transform: scale(0.15); } 2% { opacity: 1; } 18% { opacity: 1; } 30%, 100% { opacity: 0; transform: scale(var(--s1, 1.6)); } }
  @keyframes fx-implode { 0% { opacity: 0; transform: scale(2) rotate(0deg); } 4% { opacity: 1; } 22% { opacity: 1; transform: scale(0.25) rotate(260deg); } 25%, 100% { opacity: 0; transform: scale(0.1) rotate(280deg); } }
  @keyframes fx-vortex { 0% { opacity: 0; transform: scale(0.15) rotate(0deg); } 7% { opacity: 1; transform: scale(1) rotate(200deg); } 26% { opacity: 1; transform: scale(1) rotate(560deg); } 34%, 100% { opacity: 0; transform: scale(0.1) rotate(760deg); } }
  @keyframes fx-sigil { 0% { opacity: 0; transform: scale(0) rotate(0deg); } 8% { opacity: 1; transform: scale(1) rotate(80deg); } 34% { opacity: 1; transform: scale(1) rotate(260deg); } 44%, 100% { opacity: 0; transform: scale(1.25) rotate(320deg); } }
  @keyframes fx-muzzle { 0% { opacity: 0; transform: scale(0.4); } 0.5% { opacity: 1; transform: scale(1); } 2% { opacity: 0; } 3.5% { opacity: 1; transform: scale(0.85) rotate(25deg); } 5% { opacity: 0; } 6.5% { opacity: 1; transform: scale(1.05) rotate(-15deg); } 8%, 100% { opacity: 0; transform: scale(1) rotate(-15deg); } }
  @keyframes fx-bolt { 0% { opacity: 0; transform: scaleX(0); } 0.5% { opacity: 1; transform: scaleX(1); } 2% { opacity: 0.15; } 3.5% { opacity: 1; } 4.5% { opacity: 0.3; } 6% { opacity: 1; } 14% { opacity: 0.8; transform: scaleX(1); } 20%, 100% { opacity: 0; transform: scale(1, 0.3); } }
  @keyframes fx-grow { from { scale: var(--g0, 0.3); } to { scale: var(--g1, 1.6); } }
  @keyframes fx-spin { to { rotate: var(--spin, 540deg); } }
  
  /* ---- the shapes the pieces are drawn with ---- */
  .bfx--pierce > i:nth-child(4) {
    /* A burst of light. */
    border-radius: 50%;
    background: radial-gradient(circle, #fff 0 12%, var(--c) 34%, color-mix(in srgb, var(--c) 40%, transparent) 55%, transparent 72%);
  }
  .bfx--pierce > i:nth-child(2),
  .bfx--lotus > i:nth-child(4),
  .bfx--lotus > i:nth-child(5) {
    /* A slash, or a streak of light. */
    height: max(2px, calc(var(--h) * var(--st)));
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, #fff 45%, var(--c) 70%, transparent);
    box-shadow: 0 0 calc(1.2 * var(--st)) var(--c);
    rotate: calc(var(--dir) * var(--r, 0) * 1deg);
  }
  .bfx--wall > i:nth-child(n + 2) {
    /* A shard. */
    background: linear-gradient(135deg, #fff, var(--c));
    clip-path: polygon(50% 0, 100% 100%, 0 70%);
    animation-name: sig-out;
  }
  .bfx--thunderclap > i:nth-child(6),
  .bfx--bombs > i:nth-child(4),
  .bfx--bullettime > i:nth-child(6),
  .bfx--cluster > i:nth-child(n + 2):nth-child(-n + 4) {
    /* A blast: white core, the move's colours round it. */
    border-radius: 50%;
    background: radial-gradient(circle, #fff 0 10%, var(--c2, #fff) 20%, var(--c) 36%, color-mix(in srgb, var(--c) 30%, transparent) 56%, transparent 70%);
    animation-name: fx-pop;
  }
  .bfx--thunderclap > i:nth-child(3),
  .bfx--cluster > i:nth-child(5),
  .bfx--moonbeam > i:nth-child(3) {
    /* A ring rolling out over the ground. */
    border: max(1px, calc(0.3 * var(--st))) solid var(--c);
    border-radius: 50%;
    box-shadow: 0 0 calc(1.4 * var(--st)) var(--c), inset 0 0 calc(1.2 * var(--st)) var(--c);
    animation-name: fx-ripple;
  }
  .bfx--shadowfury > i:nth-child(1),
  .bfx--blizzard > i:nth-child(1),
  .bfx--nether > i:nth-child(2) {
    /* A warning circle on the ground where the blow will land, up before it does. */
    --t: 0.14;
    border: max(2px, calc(0.45 * var(--st))) solid var(--c);
    border-radius: 50%;
    background: radial-gradient(ellipse, color-mix(in srgb, var(--c) 8%, transparent) 0 52%, color-mix(in srgb, var(--c) 42%, transparent) 70%, color-mix(in srgb, var(--c) 12%, transparent));
    box-shadow: 0 0 calc(1.2 * var(--st)) var(--c);
    animation-name: fx-mark;
  }
  .bfx--thunderclap > i:nth-child(2),
  .bfx--shadowfury > i:nth-child(3) {
    /* A dome rising over the target. */
    --t: 0.39;
    top: calc(var(--tft) - var(--h) * var(--st));
    margin: 0 0 0 calc(var(--w) * var(--st) / -2);
    transform-origin: 50% 100%;
    border-radius: 50% 50% 0 0 / 100% 100% 0 0;
    background: radial-gradient(ellipse 50% 100% at 50% 100%, color-mix(in srgb, var(--c) 18%, transparent) 0 60%, color-mix(in srgb, var(--c) 55%, transparent) 84%, #fff 93%, transparent 100%);
    animation-name: fx-dome;
  }
  .bfx--consecration > i:nth-child(n + 2):nth-child(-n + 4),
  .bfx--moonbeam > i:nth-child(2),
  .bfx--nether > i:nth-child(4) {
    /* A column of light standing up out of the ground. */
    top: calc(var(--tft) - var(--h) * var(--st));
    margin: 0 0 0 calc(var(--w) * var(--st) / -2);
    transform-origin: 50% 100%;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--c) 55%, transparent) 22%, #fff 50%, color-mix(in srgb, var(--c) 55%, transparent) 78%, transparent);
    animation-name: fx-rise;
  }
  .bfx--thunderclap > i:nth-child(1),
  .bfx--shadowfury > i:nth-child(2),
  .bfx--nether > i:nth-child(1),
  .bfx--consecration > i:nth-child(6) {
    /* The whole field: the light drops away round the blow, or a flash of it. */
    --t: 0.39;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    background: radial-gradient(ellipse at var(--txp) var(--tch), transparent 16%, rgb(8 4 22 / 62%) 78%);
    animation-name: fx-dim;
  }
  .bfx--lotus > i:nth-child(6),
  .bfx--shadowfury > i:nth-child(5),
  .bfx--bombs > i:nth-child(5),
  .bfx--bullettime > i:nth-child(5),
  .bfx--cluster > i:nth-child(6),
  .bfx--blizzard > i:nth-child(8),
  .bfx--consecration > i:nth-child(5),
  .bfx--moonbeam > i:nth-child(4),
  .bfx--nether > i:nth-child(5) {
    /* A spray of sparks: one dot, a dozen more as its shadows. */
    --y: -20;
    --w: 2;
    --h: 2;
    border-radius: 50%;
    background: var(--c2, #fff);
    box-shadow:
      calc(8 * var(--st)) calc(-3 * var(--st)) 0 0 var(--c), calc(-6.5 * var(--st)) calc(-4.3 * var(--st)) 0 0 var(--c2, #fff),
      calc(10.4 * var(--st)) calc(1.4 * var(--st)) 0 calc(-0.3 * var(--st)) var(--c), calc(-10.4 * var(--st)) calc(0.7 * var(--st)) 0 0 var(--c),
      calc(2.6 * var(--st)) calc(-6.5 * var(--st)) 0 0 var(--c2, #fff), calc(-2.6 * var(--st)) calc(4.3 * var(--st)) 0 0 var(--c),
      calc(5.2 * var(--st)) calc(5 * var(--st)) 0 0 var(--c2, #fff), calc(-9 * var(--st)) calc(-1.4 * var(--st)) 0 0 var(--c2, #fff),
      calc(11.7 * var(--st)) calc(-5 * var(--st)) 0 0 var(--c), calc(-3.9 * var(--st)) calc(-8 * var(--st)) 0 0 var(--c),
      calc(7.8 * var(--st)) calc(-8 * var(--st)) 0 0 var(--c2, #fff), calc(-11.7 * var(--st)) calc(-5.8 * var(--st)) 0 0 var(--c);
    animation-name: fx-scatter;
  }
  .bfx--consecration > i:nth-child(1),
  .bfx--nether > i:nth-child(3) {
    /* A rune circle lying on the ground, turning: the circle squashed flat, the rune spinning inside it. */
    --t: 0.08;
    opacity: 1;
    transform: scaleY(0.32);
    animation: none;
  }
  .bfx--consecration > i:nth-child(1)::before,
  .bfx--nether > i:nth-child(3)::before {
    border-radius: 50%;
    background:
      radial-gradient(circle, transparent 0 28%, var(--c) 29% 31%, transparent 32% 42%, #fff 43% 45%, transparent 46% 58%, var(--c) 59% 62%, transparent 63%),
      repeating-conic-gradient(var(--c2) 0 5deg, transparent 5deg 30deg);
    -webkit-mask: radial-gradient(circle, #000 0 66%, transparent 67%);
    mask: radial-gradient(circle, #000 0 66%, transparent 67%);
    opacity: 0;
    animation: fx-sigil var(--cyc) linear calc(var(--cyc) * var(--t)) both;
  }
  
  /* Pieces that fly: placed on the attacker's chest, carried by sig-go. */
  .bfx--wall > i:nth-child(1),
  .bfx--pierce > i:nth-child(3),
  .bfx--bombs > i:nth-child(-n + 3),
  .bfx--bullettime > i:nth-child(n + 2):nth-child(-n + 4),
  .bfx--cluster > i:nth-child(1) {
    left: var(--axp);
    top: var(--ach);
    animation: sig-go calc(var(--cyc) * var(--span)) linear calc(var(--cyc) * var(--t)) both;
  }
  
  /* Juggernaut, Thunder Clap: the light drops away, a dome of thunder goes up
     over the target with lightning cracking off it, and a ring rolls out. */
  .bfx--thunderclap > i { --c: #9fd8ff; --c2: #fff; }
  .bfx--thunderclap > i:nth-child(1) { --o: 0.9; }
  .bfx--thunderclap > i:nth-child(2) { --w: 64; --h: 24.5; }
  .bfx--thunderclap > i:nth-child(3) { --w: 21; --h: 3.6; --t: 0.39; --s1: 5; --c: #eaf7ff; }
  .bfx--thunderclap > i:nth-child(4),
  .bfx--thunderclap > i:nth-child(5) {
    --y: -20;
    --w: 28;
    --h: 4;
    --t: 0.39;
    left: var(--txp);
    margin: calc(var(--h) * var(--st) / -2) 0 0;
    transform-origin: 0 50%;
    rotate: -115deg;
    background: linear-gradient(180deg, transparent, var(--c) 28%, #fff 50%, var(--c) 72%, transparent);
    clip-path: polygon(0 48%, 10% 20%, 22% 62%, 35% 12%, 47% 58%, 60% 8%, 72% 60%, 85% 22%, 100% 50%, 86% 36%, 73% 82%, 60% 32%, 48% 84%, 35% 36%, 23% 88%, 10% 44%, 0 56%);
    animation-name: fx-bolt;
  }
  .bfx--thunderclap > i:nth-child(5) { --t: 0.41; rotate: -60deg; }
  .bfx--thunderclap > i:nth-child(6) { --y: -20; --w: 39; --h: 39; --t: 0.4; --s1: 1.3; --c: #bfe8ff; }
  
  /* Astral Knight, Consecration: a golden rune circle burns into the ground
     under the target, and three shafts of light stand up out of it. */
  .bfx--consecration > i { --c: #ffc93c; --c2: #fff6c8; }
  .bfx--consecration > i:nth-child(1) { --w: 57; --h: 57; }
  .bfx--consecration > i:nth-child(2) { --x: -11.7; --w: 6.5; --h: 42; --t: 0.376; }
  .bfx--consecration > i:nth-child(3) { --w: 11.7; --h: 61; --t: 0.4; }
  .bfx--consecration > i:nth-child(4) { --x: 11.7; --w: 6.5; --h: 37; --t: 0.424; }
  .bfx--consecration > i:nth-child(5) { --w: 1.6; --h: 1.6; --t: 0.41; --c: #ffe08a; --c2: #fff; animation-name: fx-float; }
  .bfx--consecration > i:nth-child(6) {
    --t: 0.4;
    --o: 0.35;
    background: radial-gradient(circle at var(--txp) var(--tch), #fff, color-mix(in srgb, var(--c) 55%, #fff) 22%, transparent 70%);
  }
  
  /* Mindblade, Death Lotus: darts in beside the target inside a whirling
     flower of blades, and cuts twice on the way out. */
  .bfx--lotus > i { --c: #ff4fd8; --c2: #fff; }
  .bfx--lotus > i:nth-child(1) {
    --y: -20;
    --w: 47;
    --h: 47;
    --t: 0.4;
    --s0: 0.7;
    --s1: 1.1;
    border-radius: 50%;
    background: radial-gradient(circle, rgb(10 6 24 / 60%), rgb(10 6 24 / 28%) 45%, transparent 70%);
    animation-name: fx-pop;
  }
  .bfx--lotus > i:nth-child(2),
  .bfx--lotus > i:nth-child(3) {
    --y: -20;
    --w: 52;
    --h: 52;
    --t: 0.3;
    border-radius: 50%;
    background: repeating-conic-gradient(transparent 0 8deg, color-mix(in srgb, var(--c) 75%, #fff) 8deg 13deg, #fff 13deg 15deg, transparent 15deg 45deg);
    -webkit-mask: radial-gradient(circle, transparent 0 18%, #000 24% 64%, transparent 70%);
    mask: radial-gradient(circle, transparent 0 18%, #000 24% 64%, transparent 70%);
    animation-name: fx-vortex;
  }
  .bfx--lotus > i:nth-child(3) { --w: 31; --h: 31; --t: 0.33; }
  .bfx--lotus > i:nth-child(4) { --y: -20; --w: 57; --h: 2; --r: 20; --t: 0.4; animation-name: sig-slash; }
  .bfx--lotus > i:nth-child(5) { --y: -20; --w: 57; --h: 2; --r: -50; --t: 0.45; animation-name: sig-slash; }
  .bfx--lotus > i:nth-child(6) { --t: 0.4; --s1: 2; }
  
  /* Voidwarden, Shadowfury: the ground is marked, the light drops away, and a
     dome of void bursts over the target. */
  .bfx--shadowfury > i { --c: #8a5cff; --c2: #e2d4ff; }
  .bfx--shadowfury > i:nth-child(1) { --w: 47; --h: 7; }
  .bfx--shadowfury > i:nth-child(2) { --o: 0.8; }
  .bfx--shadowfury > i:nth-child(3) { --w: 62; --h: 24.5; --c: #b48cff; }
  .bfx--shadowfury > i:nth-child(4) {
    --y: -20;
    --w: 26;
    --h: 26;
    --t: 0.4;
    --s1: 1.8;
    border-radius: 50%;
    background: radial-gradient(circle, #000 0 44%, #3a1580 52%, var(--c) 62%, transparent 72%);
    animation-name: fx-pop;
  }
  .bfx--shadowfury > i:nth-child(5) { --w: 2.3; --h: 2.3; --t: 0.4; --s1: 2.2; }
  
  /* Lunatic, Cackle Bombs: three grinning bombs lobbed on crazy arcs; they go
     off in a burst of confetti and a HA! */
  .bfx--bombs > i { --c: #8ff03a; --c2: #ff4fa0; }
  .bfx--bombs > i:nth-child(-n + 3) { --w: 6; --h: 6; --span: 0.14; }
  .bfx--bombs > i:nth-child(-n + 3)::before {
    border-radius: 50%;
    background: radial-gradient(ellipse 34% 16% at 50% 64%, #1b2a10 70%, transparent 74%), radial-gradient(circle at 34% 30%, #fff 0 9%, var(--c) 32%, #3b7d12 78%, transparent 80%);
    animation:
      sig-arc calc(var(--cyc) * var(--span)) linear calc(var(--cyc) * var(--t)) both,
      fx-spin calc(var(--cyc) * var(--span)) linear calc(var(--cyc) * var(--t)) both;
  }
  .bfx--bombs > i:nth-child(1) { --t: 0.19; --ah: 22; --spin: 540deg; }
  .bfx--bombs > i:nth-child(2) { --t: 0.23; --ah: 13; --spin: -420deg; }
  .bfx--bombs > i:nth-child(3) { --t: 0.28; --ah: 29; --spin: 620deg; }
  .bfx--bombs > i:nth-child(4) { --y: -20; --w: 26; --h: 26; --t: 0.4; }
  .bfx--bombs > i:nth-child(5) {
    --t: 0.4;
    --s1: 2.2;
    border-radius: 2px;
    background: #ffd84f;
    box-shadow:
      calc(8 * var(--st)) calc(-3 * var(--st)) 0 0 #ff4fa0, calc(-6.5 * var(--st)) calc(-4.3 * var(--st)) 0 0 #9dff4a,
      calc(10.4 * var(--st)) calc(1.4 * var(--st)) 0 0 #ffd84f, calc(-10.4 * var(--st)) calc(0.7 * var(--st)) 0 0 #4fd8ff,
      calc(2.6 * var(--st)) calc(-6.5 * var(--st)) 0 0 #ff4fa0, calc(-2.6 * var(--st)) calc(4.3 * var(--st)) 0 0 #b98cff,
      calc(5.2 * var(--st)) calc(5 * var(--st)) 0 0 #9dff4a, calc(-9 * var(--st)) calc(-1.4 * var(--st)) 0 0 #ffd84f,
      calc(11.7 * var(--st)) calc(-5 * var(--st)) 0 0 #4fd8ff, calc(-3.9 * var(--st)) calc(-8 * var(--st)) 0 0 #ff4fa0,
      calc(7.8 * var(--st)) calc(-8 * var(--st)) 0 0 #9dff4a, calc(-11.7 * var(--st)) calc(-5.8 * var(--st)) 0 0 #b98cff;
  }
  .bfx--bombs > i:nth-child(6) {
    --y: -38;
    --w: 13;
    --h: 6.5;
    --t: 0.42;
    display: grid;
    place-items: center;
    animation-name: fx-float;
  }
  .bfx--bombs > i:nth-child(6)::before {
    content: 'HA!';
    position: static;
    font: 900 calc(var(--h) * var(--st) * 0.8) / 1 var(--font-display);
    color: #fff;
    -webkit-text-stroke: calc(0.4 * var(--st)) var(--c2);
    paint-order: stroke;
    text-shadow: 0 0 calc(1 * var(--st)) var(--c);
  }
  
  /* Desperado, Bullet Time: both guns emptied in three waves of bullets
     that spread into a cone on the way over. */
  .bfx--bullettime > i { --c: #ffa53c; --c2: #fff6d0; }
  .bfx--bullettime > i:nth-child(1) {
    --x: 7.8;
    --y: -20;
    --w: 18;
    --h: 18;
    --t: 0.27;
    left: calc(var(--axp) + var(--dir) * var(--x) * var(--sa));
    top: calc(var(--aft) + var(--y) * var(--sa));
    width: calc(var(--w) * var(--sa));
    height: calc(var(--h) * var(--sa));
    margin: calc(var(--h) * var(--sa) / -2) 0 0 calc(var(--w) * var(--sa) / -2);
    background: radial-gradient(circle, #fff 0 14%, var(--c) 32%, color-mix(in srgb, var(--c) 40%, transparent) 50%, transparent 62%);
    clip-path: polygon(50% 0, 57% 43%, 100% 50%, 57% 57%, 50% 100%, 43% 57%, 0 50%, 43% 43%);
    animation-name: fx-muzzle;
  }
  .bfx--bullettime > i:nth-child(n + 2):nth-child(-n + 4) {
    --w: 2.6;
    --h: 1.2;
    --span: 0.1;
    rotate: atan2(var(--my), var(--mx));
    border-radius: 99px;
    background: var(--c2);
    box-shadow:
      calc(3.9 * var(--st)) calc(-2.2 * var(--st)) 0 0 var(--c), calc(7.8 * var(--st)) calc(1.4 * var(--st)) 0 0 var(--c2),
      calc(-2.6 * var(--st)) calc(2.9 * var(--st)) 0 0 var(--c), calc(10.4 * var(--st)) calc(-3.6 * var(--st)) 0 0 var(--c2),
      calc(5.2 * var(--st)) calc(4.3 * var(--st)) 0 0 var(--c), calc(-5.2 * var(--st)) calc(-4.3 * var(--st)) 0 0 var(--c2),
      calc(13 * var(--st)) 0 0 0 var(--c), calc(1.3 * var(--st)) calc(-5.8 * var(--st)) 0 0 var(--c),
      calc(9.1 * var(--st)) calc(5.8 * var(--st)) 0 0 var(--c2), calc(-7.8 * var(--st)) calc(0.7 * var(--st)) 0 0 var(--c),
      calc(15.6 * var(--st)) calc(-2.2 * var(--st)) 0 0 var(--c2), calc(14.3 * var(--st)) calc(3.6 * var(--st)) 0 0 var(--c);
    animation:
      sig-go calc(var(--cyc) * var(--span)) linear calc(var(--cyc) * var(--t)) both,
      fx-grow calc(var(--cyc) * var(--span)) linear calc(var(--cyc) * var(--t)) both;
  }
  .bfx--bullettime > i:nth-child(2) { --t: 0.27; }
  .bfx--bullettime > i:nth-child(3) { --t: 0.31; }
  .bfx--bullettime > i:nth-child(4) { --t: 0.35; }
  .bfx--bullettime > i:nth-child(5) { --t: 0.42; --s1: 2.2; }
  .bfx--bullettime > i:nth-child(6) { --y: -20; --w: 26; --h: 26; --t: 0.42; }
  
  /* Explosioneer, Cluster Bomb: one bomb lobbed high, that goes off as three
     blasts walking across the target. */
  .bfx--cluster > i { --c: #ff5a2a; --c2: #ffd13a; }
  .bfx--cluster > i:nth-child(1) { --w: 7.8; --h: 7.8; --t: 0.26; --span: 0.14; --ah: 24; }
  .bfx--cluster > i:nth-child(1)::before {
    border-radius: 50%;
    background: radial-gradient(circle, #fff 0 14%, #ff7a3a 38%, color-mix(in srgb, #ff7a3a 35%, transparent) 58%, transparent 70%);
    animation: sig-arc calc(var(--cyc) * var(--span)) linear calc(var(--cyc) * var(--t)) both;
  }
  .bfx--cluster > i:nth-child(2) { --x: -7.8; --y: -15.7; --w: 21; --h: 21; --t: 0.4; }
  .bfx--cluster > i:nth-child(3) { --y: -20; --w: 26; --h: 26; --t: 0.447; }
  .bfx--cluster > i:nth-child(4) { --x: 7.8; --y: -17.1; --w: 21; --h: 21; --t: 0.494; }
  .bfx--cluster > i:nth-child(5) { --w: 16; --h: 3; --t: 0.565; }
  .bfx--cluster > i:nth-child(6) { --t: 0.447; }
  
  /* Arcanist, Blizzard: a ring of frost on the ground, a freezing mist, and a
     storm of icicles driving down into it from the caster's side. */
  .bfx--blizzard > i { --c: #8fe6ff; --c2: #e9fdff; }
  .bfx--blizzard > i:nth-child(1) { --w: 52; --h: 8; }
  .bfx--blizzard > i:nth-child(2) {
    --y: -5.8;
    --w: 62;
    --h: 16;
    --t: 0.27;
    border-radius: 50%;
    background: radial-gradient(ellipse closest-side, rgb(236 252 255 / 85%), rgb(200 238 255 / 45%) 55%, transparent);
    animation-name: fx-hover;
  }
  .bfx--blizzard > i:nth-child(n + 3):nth-child(-n + 7) {
    --w: 5.4;
    --h: 13;
    --fx: calc(var(--dir) * -13 * var(--st));
    --fy: calc(-62 * var(--st));
    rotate: calc(var(--dir) * -12deg);
    background: linear-gradient(180deg, #f2feff, #8fe6ff 60%, #3fb8e8);
    clip-path: polygon(28% 0, 72% 0, 50% 100%);
    animation-name: fx-fall;
    animation-timing-function: cubic-bezier(0.6, 0, 1, 0.6);
  }
  .bfx--blizzard > i:nth-child(3) { --x: -15.6; --y: -4.3; --t: 0.186; }
  .bfx--blizzard > i:nth-child(4) { --x: -5.2; --y: -1.4; --t: 0.221; }
  .bfx--blizzard > i:nth-child(5) { --x: 6.5; --y: -5.8; --t: 0.256; }
  .bfx--blizzard > i:nth-child(6) { --x: 15.6; --y: -2.2; --t: 0.292; }
  .bfx--blizzard > i:nth-child(7) { --y: -8.6; --t: 0.327; }
  .bfx--blizzard > i:nth-child(8) { --y: -5.8; --w: 1.8; --h: 1.8; --t: 0.4; }
  
  /* Mystic, Moonbeam: a crescent moon rises over the target and pours a soft
     column of light down on it. */
  .bfx--moonbeam > i { --c: #4ee6c2; --c2: #ffe08a; }
  .bfx--moonbeam > i:nth-child(1) {
    --y: -41.6;
    --w: 15.6;
    --h: 15.6;
    --t: 0.27;
    rotate: calc(var(--dir) * -20deg);
    border-radius: 50%;
    background: radial-gradient(circle, #fffbe8 0 52%, var(--c2) 60%, transparent 70%);
    -webkit-mask: radial-gradient(circle at 72% 36%, transparent 0 44%, #000 47%);
    mask: radial-gradient(circle at 72% 36%, transparent 0 44%, #000 47%);
    animation-name: fx-hover;
  }
  .bfx--moonbeam > i:nth-child(2) { --w: 15.6; --h: 50; --t: 0.38; --sx1: 0.3; --c: #9df6e0; }
  .bfx--moonbeam > i:nth-child(3) { --w: 15.6; --h: 2.9; --t: 0.39; --s1: 2.2; }
  .bfx--moonbeam > i:nth-child(4) { --w: 1.6; --h: 1.6; --t: 0.41; --c: #fff8d0; --c2: #fff; animation-name: fx-float; }
  
  /* Voidcaller, Nether Grasp: the light drops away, a rune turns under the
     target, and a column of void lifts it off the ground and holds it. */
  .bfx--nether > i { --c: #b04bff; --c2: #e2c4ff; }
  .bfx--nether > i:nth-child(1) { --o: 0.7; }
  .bfx--nether > i:nth-child(2) { --w: 42; --h: 6.5; }
  .bfx--nether > i:nth-child(3) { --w: 49; --h: 49; }
  .bfx--nether > i:nth-child(4) { --w: 21; --h: 58; --t: 0.38; --sx1: 0.3; }
  .bfx--nether > i:nth-child(5) { --w: 1.8; --h: 1.8; --t: 0.3; animation-name: fx-implode; }
  .bfx--nether > i:nth-child(6) {
    --y: -20;
    --w: 21;
    --h: 21;
    --t: 0.576;
    --s1: 1.6;
    border-radius: 50%;
    background: radial-gradient(circle, #000 0 44%, #3a0a5e 52%, var(--c) 62%, transparent 72%);
    animation-name: fx-pop;
  }
  
  /* Tactician, Shield Wall Break: a wide crescent wave swept out from the
     blade crashes through the target and throws off sparks. */
  .bfx--wall > i:nth-child(1) {
    --w: 10;
    --h: 30;
    --t: 0.33;
    --span: 0.07;
    border-radius: 50%;
    border-right: max(3px, calc(1 * var(--st))) solid #fff;
    filter: drop-shadow(0 0 calc(0.6 * var(--st)) #ffd979) drop-shadow(0 0 calc(1.4 * var(--st)) #ffd979);
    scale: var(--dir) 1;
  }
  .bfx--wall > i:nth-child(2) { --y: -21.4; --w: 2.4; --h: 3; --c: #ffd979; --rx: calc(var(--dir) * 8 * var(--st)); --ry: calc(-8 * var(--st)); }
  .bfx--wall > i:nth-child(3) { --y: -16.9; --w: 2.4; --h: 3; --c: #ffd979; --rx: calc(var(--dir) * 9 * var(--st)); --ry: calc(6 * var(--st)); }
  
  /* Hunter, Piercing Shot: the bow gathers light, one streak, an arrow that
     tears straight through and on past the target. */
  .bfx--pierce > i:nth-child(1) {
    --x: 6;
    --y: -21.4;
    --w: 8;
    --h: 8;
    --t: 0.14;
    left: calc(var(--axp) + var(--dir) * var(--x) * var(--sa));
    top: calc(var(--aft) + var(--y) * var(--sa));
    background:
      linear-gradient(0deg, transparent 46%, #fff 50%, transparent 54%),
      linear-gradient(90deg, transparent 46%, #fff 50%, transparent 54%),
      radial-gradient(circle, #fff 0 8%, #ffd979 18%, transparent 42%);
    filter: drop-shadow(0 0 calc(0.8 * var(--st)) #ffd979);
    animation-name: sig-inhold;
  }
  .bfx--pierce > i:nth-child(2) {
    --h: 1.2;
    --t: 0.35;
    --c: #ffd979;
    left: var(--axp);
    top: var(--ach);
    width: calc(hypot(var(--mx), var(--my)) * 1.44);
    margin: calc(var(--h) * var(--st) / -2) 0 0;
    transform-origin: 0 50%;
    rotate: atan2(var(--my), var(--mx));
    animation-name: sig-slash;
  }
  .bfx--pierce > i:nth-child(3) {
    --w: 7;
    --h: 1.6;
    --t: 0.35;
    --span: 0.04;
    --reach: 1.44;
    rotate: atan2(var(--my), var(--mx));
    background: linear-gradient(90deg, transparent, #ffe9a8 30%, #fff 85%);
    clip-path: polygon(0 38%, 80% 38%, 80% 0, 100% 50%, 80% 100%, 80% 62%, 0 62%);
  }
  .bfx--pierce > i:nth-child(4) { --y: -21.4; --w: 16; --h: 16; --c: #ffd979; }
  
  
  .bvcards { display: flex; justify-content: center; gap: 10px; padding: 14px 10px 10px; background: linear-gradient(180deg, #0a1128, #070c1c); }
  .bvcards .gc { width: 64px; }
  .bvcards .gc.me { box-shadow: 0 0 0 2px rgb(25 211 197 / 60%), 0 6px 14px rgb(0 0 0 / 50%); }
  .bvcards .gc.them { box-shadow: 0 0 0 2px rgb(255 77 94 / 60%), 0 6px 14px rgb(0 0 0 / 50%); }
  .bvcards .gc.act { transform: translateY(-4px) scale(1.06); transition: transform .2s; }
  .bvcards .vs { align-self: center; margin: 0 8px; font: 900 14px Orbitron; color: var(--enemy); }
  .bvcards .gc .nm { font-size: 8px; }
  .bvcards .gc.ko > span { filter: grayscale(1) brightness(0.4); }
  .bvcards .rib { position: absolute; left: 50%; top: -9px; z-index: 4; translate: -50% 0; padding: 0 6px; border-radius: 3px; font: 800 8px Orbitron; font-style: normal; letter-spacing: 0.08em; white-space: nowrap; }
  .bvcards .rib.a { background: linear-gradient(180deg, #ffe7a0, #d39a33); color: #2a1a04; }
  .bvcards .rib.t { background: var(--enemy); color: #fff; }
  .bvend { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; align-content: center; gap: 4px; background: rgb(3 2 10 / 55%); font: 900 clamp(22px, 7cqw, 52px) Orbitron; color: var(--gold2); text-transform: uppercase; animation: pop .4s 1s ease both; }
  .bvend small { font: 700 clamp(11px, 1.8cqw, 15px) 'Titillium Web'; color: var(--dim); text-transform: none; }

  /* the dungeon, as its screen looks: the vault, the difficulty stepper, the figures and the team it fields */
  .dg { padding: 0; overflow: hidden; }
  .dghead { position: relative; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 24px; padding: 20px; background: radial-gradient(70% 140% at 0% 100%, rgb(255 80 50 / 18%), transparent 60%), linear-gradient(180deg, #1a0c12, #10080e); border-bottom: 1px solid rgb(255 110 80 / 25%); }
  .dghead::after { content: ''; position: absolute; inset: auto 0 0; height: 2px; background: linear-gradient(90deg, transparent, #ff6a3d, transparent); opacity: .6; }
  .dgname { font: 900 26px Orbitron; text-transform: uppercase; color: #fff; text-shadow: 0 0 18px rgb(255 90 60 / 45%); }

  /* the game's stepper: the number between two steps, the figures over twenty ticks */
  .dstep { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; background: rgb(0 0 0 / 55%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%); }
  .dstep__arrow { width: 28px; height: 28px; display: grid; place-items: center; font: 400 20px Orbitron; line-height: 1; color: var(--dim); background: rgb(255 255 255 / 6%); border: 0; border-radius: 6px; cursor: pointer; }
  .dstep__arrow:hover:not(:disabled) { color: #fff; background: rgb(255 255 255 / 12%); }
  .dstep__arrow:disabled { opacity: 0.35; cursor: default; }
  .dstep__value { min-width: 46px; height: 38px; display: grid; place-items: center; padding: 0 8px; font: 700 20px Orbitron; font-variant-numeric: tabular-nums; color: #2a0910; background: linear-gradient(180deg, #ff8a5c, #e0344f); border-radius: 8px; box-shadow: 0 0 14px rgb(255 80 80 / 35%); }
  .dstep__side { display: grid; gap: 2px; margin-left: 4px; }
  .dstep__tally { font-size: 13px; color: var(--dim); white-space: nowrap; }
  .dstep__tally b { color: #fff; }
  .dstep__label { margin-right: 8px; font: 700 10px Orbitron; letter-spacing: 0.16em; text-transform: uppercase; color: var(--faint); }
  .dstep__ticks { display: flex; align-items: center; margin-left: -2px; touch-action: pan-y; cursor: pointer; }
  .dstep__tick { position: relative; width: 11px; height: 24px; padding: 0; background: none; border: 0; cursor: pointer; }
  .dstep__tick::before { content: ''; position: absolute; left: 2px; right: 2px; top: 6px; bottom: 6px; border-radius: 2px; background: rgb(255 255 255 / 16%); transition: background .12s, top .12s, bottom .12s; }
  .dstep__tick--lit::before { background: #ff7a5c; }
  .dstep__tick:hover::before { top: 4px; bottom: 4px; background: rgb(255 255 255 / 45%); }
  .dstep__tick--lit:hover::before { background: #ffa185; }
  .dstep__tick.on::before { top: 3px; bottom: 3px; background: #ff9d78; box-shadow: 0 0 6px rgb(255 120 90 / 70%); }
  .dstep__tick--nft::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; border-radius: 1px; background: #c9a0ff; }
  /* what the choice means */
  .dgfig { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.6fr); gap: 12px; padding: 16px 20px; background: rgb(0 0 0 / 22%); }
  .dgtile { display: grid; align-content: start; gap: 2px; padding: 12px 14px; border-radius: 12px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); }
  .dgtile small { font: 800 10.5px Orbitron; letter-spacing: 0.16em; text-transform: uppercase; color: var(--faint); }
  .dgtile b { font: 900 28px Orbitron; font-variant-numeric: tabular-nums; transition: color .2s; }
  .dgtile span { font-size: 12.5px; color: var(--dim); }
  .dgtile.e b { color: #ff6a5c; } .dgtile.r b { color: var(--gold2); } .dgtile.x b { color: var(--green); }
  .dgchart { position: relative; padding: 10px 12px 6px; border-radius: 12px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); }
  .dgchart svg { display: block; width: 100%; height: 92px; overflow: visible; }
  .dgchart p { margin: 4px 0 0; font-size: 12px; color: var(--faint); }
  .dgchart p b { color: #ff6a5c; } .dgchart p em { font-style: normal; font-weight: 700; color: var(--gold2); }
  /* the team it fields */
  .dgteam { padding: 16px 20px 20px; background: radial-gradient(80% 120% at 50% 100%, rgb(255 70 40 / 14%), transparent 70%); }
  .dgteam h5 { display: flex; align-items: baseline; gap: 10px; margin: 0 0 12px; font: 900 13px Orbitron; letter-spacing: 0.14em; color: #ff6a5c; text-transform: uppercase; }
  .dgteam h5 span { font: 600 12.5px 'Titillium Web'; letter-spacing: 0; text-transform: none; color: var(--faint); }
  .dgrow { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; max-width: 640px; }
  .dgnft { position: relative; min-height: 100%; border-radius: 10px; perspective: 600px; }
  .dgnft .ghost { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 4px; padding: 6px; border-radius: 10px; box-shadow: inset 0 0 0 1.5px rgb(201 160 255 / 40%); background: repeating-linear-gradient(45deg, rgb(201 160 255 / 5%) 0 8px, transparent 8px 16px); text-align: center; font: 800 10px Orbitron; color: #c9a0ff; text-transform: uppercase; transition: opacity .3s; }
  .dgnft .ghost small { font: 600 11px 'Titillium Web'; text-transform: none; color: var(--faint); }
  .dgnft .card { position: absolute; inset: 0; margin: 0; padding: 4px; border-radius: 10px; background: linear-gradient(165deg, #e3d2ff, #7c5bd6 38%, #3a2766 68%, #b89cff); box-shadow: 0 5px 12px rgb(0 0 0 / 50%), 0 0 18px rgb(166 124 255 / 45%); transform: rotateY(90deg); opacity: 0; transition: transform .45s cubic-bezier(.3,1.4,.5,1), opacity .2s; }
  .dgnft .card > span { position: absolute; inset: 4px; overflow: hidden; border-radius: 7px; background: center 18% / cover; }
  .dgnft .card > span::after { content: ''; position: absolute; inset: auto 0 0; height: 40%; background: linear-gradient(transparent, rgb(3 7 18 / 90%)); }
  .dgnft .card b { position: absolute; left: 0; right: 0; bottom: 9%; z-index: 2; text-align: center; font: 800 clamp(8px, 0.95vw, 11px) Orbitron; color: #fff; text-transform: uppercase; text-shadow: 0 0 4px #000; }
  .dgnft .card i { position: absolute; left: 50%; top: -8px; z-index: 3; transform: translateX(-50%); padding: 1px 10px; clip-path: polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%); white-space: nowrap; font: 900 8.5px Orbitron; font-style: normal; letter-spacing: 0.14em; color: #1b0b3a; background: linear-gradient(180deg, #e3d2ff, #a67cff); text-transform: uppercase; }
  .dgnft.in .card { transform: none; opacity: 1; }
  .dgnft.in .ghost { opacity: 0; }
  .dgrow .rc { cursor: default; }
  .dgrow .rc:hover { transform: none; }
  .nftf { display: flex; gap: 6px; align-items: center; padding: 6px; border-radius: 10px; background: rgb(143 123 255 / 12%); box-shadow: inset 0 0 0 1px rgb(143 123 255 / 50%); }
  .nftf img { width: 54px; border-radius: 6px; }
  .nftf small { display: block; font: 800 10px Orbitron; color: #cfc6ff; text-align: center; }
  .ar { padding: 0; overflow: hidden; }
  .arhead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px 24px; padding: 20px; background: radial-gradient(70% 140% at 0% 100%, rgb(242 195 90 / 16%), transparent 60%), linear-gradient(180deg, #19140b, #0f0c08); border-bottom: 1px solid rgb(242 195 90 / 25%); }
  .arname { font: 900 26px Orbitron; text-transform: uppercase; color: #fff; text-shadow: 0 0 18px rgb(242 195 90 / 40%); }
  .arwins { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; background: rgb(0 0 0 / 55%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%); font-size: 13px; color: var(--dim); }
  .arwins b { color: #fff; }
  .arwins i { display: flex; gap: 4px; }
  .arwins i u { width: 18px; height: 6px; border-radius: 2px; background: rgb(255 255 255 / 14%); transition: background .3s; }
  .arwins i u.on { background: linear-gradient(90deg, #ffe7a0, #e0a83c); box-shadow: 0 0 6px rgb(242 195 90 / 60%); }
  .arteam { padding: 16px 20px 18px; background: radial-gradient(80% 120% at 50% 100%, rgb(242 195 90 / 10%), transparent 70%); }
  .arteam h5 { display: flex; align-items: baseline; gap: 10px; margin: 0 0 14px; font: 900 13px Orbitron; letter-spacing: 0.14em; color: var(--gold); text-transform: uppercase; }
  .arteam h5 span { font: 600 12.5px 'Titillium Web'; letter-spacing: 0; text-transform: none; color: var(--faint); }
  .arow { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; max-width: 640px; }
  .acell { display: grid; gap: 7px; justify-items: center; min-width: 0; }
  .acell > small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 11.5px 'Titillium Web'; color: var(--faint); }
  .acell.you > small { color: var(--mine); font-weight: 800; }
  .acell .rc { cursor: default; }
  .acell .rc:hover { transform: none; }
  .acell.you .rc { box-shadow: 0 0 0 2.5px var(--mine), 0 0 18px rgb(25 211 197 / 45%); }
  .rc .tag.yours { color: #062033; background: linear-gradient(180deg, #a8fff4, #19d3c5); }
  .acell.leave { animation: a-leave .38s ease-in both; }
  .acell.arrive { animation: a-arrive .45s cubic-bezier(.2,.9,.3,1.2) both; }
  @keyframes a-leave { to { opacity: 0; transform: translateX(-40%) scale(0.85); } }
  @keyframes a-arrive { from { opacity: 0; transform: translateX(40%) scale(0.9); } }
  .acell .dgnft { width: 100%; aspect-ratio: 3 / 4.1; min-height: 0; }
  .acell .dgnft.flip .card { animation: nft-flip .5s cubic-bezier(.3,1.4,.5,1) both; }
  @keyframes nft-flip { from { transform: rotateY(90deg); opacity: 0; } }
  .arctl { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0 20px 18px; }
  .arctl .simlog { flex: 1; min-width: 240px; min-height: 0; }


  /* quests */
  .qscopes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .q { padding: 14px; border-radius: 14px; background: rgb(255 255 255 / 3%); box-shadow: inset 0 0 0 1px var(--line); }
  .q h5 { margin: 0 0 10px; display: flex; justify-content: space-between; font: 800 12px Orbitron; letter-spacing: 0.18em; color: var(--gold); text-transform: uppercase; }
  .q h5 small { color: var(--faint); letter-spacing: 0.04em; }
  .qi { display: grid; grid-template-columns: 40px 1fr; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); }
  .qi:first-of-type { border-top: 0; }
  .qi img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
  .qi small em { font-style: normal; color: var(--dim); }
  .qi b { display: block; font-size: 14px; } .qi small { color: var(--faint); font-size: 12.5px; }
  .qprog { height: 6px; margin-top: 4px; border-radius: 3px; background: rgb(255 255 255 / 10%); overflow: hidden; }
  .qprog i { display: block; height: 100%; background: var(--mine); }

  /* the tournament */
  .tw { display: flex; gap: 4px; margin-top: 4px; }
  .tw button { position: relative; display: grid; align-content: start; gap: 2px; min-width: 0; padding: 12px 12px 10px; border: 0; border-radius: 10px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); color: inherit; text-align: left; cursor: pointer; transition: background .15s; }
  .tw button::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 4px; border-radius: 10px 10px 0 0; background: var(--tc); }
  .tw button b { font: 800 12.5px Orbitron; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tw button small { font-size: 12px; color: var(--faint); white-space: nowrap; }
  .tw button.on { background: color-mix(in srgb, var(--tc) 14%, transparent); box-shadow: inset 0 0 0 1.5px var(--tc); }
  .tw button.you b::after { content: ' ●'; color: var(--tc); }
  .twnote { margin-top: 12px; min-height: 46px; padding: 12px 14px; border-radius: 12px; background: rgb(0 0 0 / 25%); box-shadow: inset 0 0 0 1px var(--line); font-size: 14.5px; color: var(--dim); }
  .twnote b { color: #fff; }
  .tgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
  .tgrid > .card { margin-top: 0; }
  .need { display: grid; gap: 10px; }
  .need > div { display: grid; grid-template-columns: 26px 1fr; gap: 12px; align-items: start; }
  .need .five .rc .nm, .tscore .rc .nm { display: none; }
  .need > div > i { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: rgb(78 224 122 / 16%); box-shadow: inset 0 0 0 1px var(--green); color: var(--green); font: 900 12px Orbitron; font-style: normal; }
  .need b { display: block; font-size: 14.5px; } .need small { font-size: 13px; color: var(--faint); }
  .need .five { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 8px; max-width: 320px; }
  .need .five .rc { cursor: default; } .need .five .rc:hover { transform: none; }
  .need .pair { display: flex; gap: 6px; margin-top: 6px; } .need .pair img { width: 46px; border-radius: 5px; }
  .tscore { display: grid; gap: 10px; }
  .tscore .five { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
  .tscore .five > div { display: grid; gap: 6px; justify-items: center; }
  .tscore .rc { cursor: default; } .tscore .rc:hover { transform: none; }
  .tscore .pts5 { font: 800 12px Orbitron; color: var(--gold2); }
  .tscore .asc { display: flex; align-items: center; gap: 4px; }
  .tscore .asc button { width: 22px; height: 22px; padding: 0; border: 0; border-radius: 6px; background: rgb(255 255 255 / 8%); color: #fff; font: 800 13px Orbitron; cursor: pointer; }
  .tscore .asc span { font: 800 11px Orbitron; color: #ffd979; min-width: 22px; text-align: center; }
  .tscore .sum { display: flex; align-items: baseline; justify-content: space-between; padding: 10px 14px; border-radius: 12px; background: rgb(242 195 90 / 8%); box-shadow: inset 0 0 0 1px rgb(242 195 90 / 30%); font-size: 13.5px; color: var(--dim); }
  .tscore .sum b { font: 900 26px Orbitron; color: var(--gold2); }
  .brk { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; position: relative; }
  .brk .col { display: grid; align-content: space-around; gap: 10px; padding: 0 14px; }
  .brk .col + .col { border-left: 1px dashed rgb(255 255 255 / 10%); }
  .brk h6 { margin: 0 0 6px; font: 800 10.5px Orbitron; letter-spacing: 0.2em; color: var(--faint); text-transform: uppercase; text-align: center; }
  .brk .col > div:first-child { align-self: start; }
  .mt { display: grid; gap: 2px; padding: 4px; border-radius: 12px; background: rgb(0 0 0 / 25%); box-shadow: inset 0 0 0 1px var(--line); }
  .pl { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 9px; font: 700 13.5px 'Titillium Web'; color: var(--dim); }
  .pl img { width: 30px; height: 30px; border-radius: 8px; object-fit: cover; }
  .pl em { font: 800 11px Orbitron; font-style: normal; color: var(--faint); }
  .pl.win { background: rgb(25 211 197 / 12%); color: #fff; box-shadow: inset 0 0 0 1px rgb(25 211 197 / 50%); }
  .pl.win em { color: var(--mine); }
  .pl.out { opacity: 0.45; text-decoration: line-through; text-decoration-color: rgb(255 255 255 / 30%); }
  .pl.pass { background: rgb(242 195 90 / 10%); box-shadow: inset 0 0 0 1px rgb(242 195 90 / 45%); color: #fff; }
  .pl.pass em { color: var(--gold); }
  .mt .vs { justify-self: center; font: 800 9px Orbitron; color: var(--enemy); letter-spacing: 0.1em; }
  .champ { display: grid; justify-items: center; gap: 8px; padding: 16px 10px; border-radius: 14px; background: radial-gradient(80% 80% at 50% 30%, rgb(242 195 90 / 22%), transparent 70%); text-align: center; }
  .champ img.av { width: 64px; height: 64px; border-radius: 16px; box-shadow: 0 0 0 3px var(--gold), 0 0 24px rgb(242 195 90 / 55%); }
  .champ img.tr { width: 34px; }
  .champ b { font: 900 16px Orbitron; color: var(--gold2); text-transform: uppercase; }
  .champ small { font-size: 12.5px; color: var(--faint); }
  .brkrule { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; font-size: 13px; color: var(--dim); }
  .brkrule span { display: flex; align-items: center; gap: 7px; }
  .brkrule i { width: 14px; height: 14px; border-radius: 4px; }
  .prz { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-top: 18px; }
  .prz > .card { margin-top: 0; }
  .wax { display: grid; gap: 8px; }
  .wax > div { display: grid; grid-template-columns: 76px 1fr 150px; align-items: center; gap: 10px; font-size: 13.5px; color: var(--dim); cursor: default; }
  .wax > div b { font: 800 12.5px Orbitron; color: #fff; }
  .wax > div i { position: relative; height: 22px; border-radius: 6px; background: rgb(255 255 255 / 5%); overflow: hidden; }
  .wax > div i u { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; background: linear-gradient(90deg, #b47a1e, #ffe7a0); text-decoration: none; }
  .wax > div i s { display: none; position: absolute; left: 8px; top: 50%; translate: 0 -50%; font: 800 10.5px Orbitron; text-decoration: none; color: #2a1a04; white-space: nowrap; }
  .wax > div em { font: 600 13px 'Titillium Web'; font-style: normal; color: var(--faint); text-align: right; white-space: nowrap; } .wax > div em b { font: 800 13px Orbitron; color: var(--gold2); }
  .podium { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: end; gap: 8px; }
  .podium > div { display: grid; justify-items: center; gap: 5px; text-align: center; }
  .podium img.av { width: 44px; height: 44px; border-radius: 12px; }
  .podium img.tr { width: 22px; }
  .podium u { display: grid; place-items: center; width: 100%; border-radius: 8px 8px 0 0; background: linear-gradient(180deg, rgb(242 195 90 / 35%), rgb(242 195 90 / 6%)); font: 900 16px Orbitron; color: var(--gold2); text-decoration: none; }
  .podium small { font-size: 12px; color: var(--dim); }
  .tlm { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
  .tlm > div { display: grid; justify-items: center; gap: 4px; padding: 8px 4px; border-radius: 10px; background: rgb(255 255 255 / 4%); font-size: 12px; color: var(--faint); text-align: center; }
  .tlm > div b { font: 900 18px Orbitron; color: #fff; }
  .tlm > div i { display: flex; gap: 2px; } .tlm > div i u { width: 6px; height: 6px; border-radius: 50%; background: var(--mine); text-decoration: none; }

  /* rewards & mining: few boxes, one accent each */
  .rw-panel { margin-top: 4px; border-radius: 16px; background: rgb(255 255 255 / 3%); box-shadow: inset 0 0 0 1px var(--line); }
  .rw-pool { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px 32px; padding: 20px 22px 18px; }
  .rw-label { display: flex; align-items: center; gap: 8px; font: 700 12px Orbitron; letter-spacing: 0.18em; color: var(--faint); text-transform: uppercase; }
  .rw-label .live { display: inline-flex; align-items: center; gap: 5px; font: 700 10px Orbitron; letter-spacing: 0.12em; color: var(--faint); }
  .rw-label .live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--green); }
  .rw-big { display: flex; flex-wrap: wrap; gap: 4px 30px; margin-top: 8px; }
  .rw-big span { display: flex; align-items: baseline; gap: 8px; font: 900 clamp(26px, 3.2vw, 36px) Orbitron; color: #fff; }
  .rw-big span img { align-self: center; width: 30px; height: 30px; object-fit: contain; }
  .rw-big span em { font: 600 13px 'Titillium Web'; font-style: normal; color: var(--faint); }
  .rw-mine { border-top: 1px solid var(--line); padding: 14px 22px 16px; }
  .rw-mine table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .rw-mine th { padding: 6px 0; font: 700 11px Orbitron; letter-spacing: 0.14em; color: var(--faint); text-transform: uppercase; text-align: right; }
  .rw-mine th:first-child { text-align: left; }
  .rw-mine td { padding: 9px 0; border-top: 1px solid rgb(255 255 255 / 6%); font-size: 14.5px; color: var(--dim); text-align: right; white-space: nowrap; }
  .rw-mine td:first-child { text-align: left; color: #fff; font-weight: 600; }
  .rw-mine td:first-child img { width: 22px; height: 22px; margin-right: 10px; vertical-align: -6px; }
  .rw-mine td b { font: 800 16px Orbitron; color: #fff; font-variant-numeric: tabular-nums; }
  .rw-mine td small { margin-left: 5px; font-size: 12px; color: var(--faint); }
  .rw-mine td .no { color: var(--faint); }
  .rw-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin: 26px 0 0; padding: 0; list-style: none; counter-reset: st; }
  .rw-steps li { counter-increment: st; padding-left: 0; }
  .rw-steps li b { display: flex; align-items: center; gap: 8px; font: 800 14px Orbitron; color: #fff; }
  .rw-steps li b::before { content: counter(st); display: grid; place-items: center; flex: none; width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--line2); font: 800 11px Orbitron; color: var(--dim); }
  .rw-steps li > span { display: block; margin: 6px 0 0 30px; font-size: 13.5px; color: var(--dim); }
  .rw-calc { margin-top: 26px; padding: 20px 22px 22px; }
  .rw-calc h4 { margin: 0; font: 800 15px Orbitron; color: #fff; }
  .rw-calc > p { margin: 4px 0 16px; font-size: 14px; color: var(--dim); }
  .rw-tools { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
  .rw-tools button { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 6px 8px 6px 6px; border: 0; border-radius: 10px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); color: var(--dim); text-align: left; cursor: pointer; }
  .rw-tools button img { width: 30px; border-radius: 4px; }
  .rw-tools button b { display: block; font-size: 12.5px; line-height: 1.25; color: #fff; }
  .rw-tools button small { font-size: 11.5px; color: var(--faint); }
  .rw-tools button.on { background: rgb(0 186 255 / 10%); box-shadow: inset 0 0 0 1.5px var(--cyan); }
  .rw-boost { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; margin-top: 16px; font-size: 13.5px; color: var(--dim); }
  .rw-boost b { font: 800 14px Orbitron; color: #fff; min-width: 52px; text-align: right; }
  .rw-res { margin-top: 18px; border-top: 1px solid var(--line); }
  .rw-row { display: grid; grid-template-columns: 150px 120px minmax(0, 1fr) 190px; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid rgb(255 255 255 / 6%); }
  .rw-row .who { display: flex; align-items: center; gap: 9px; font: 800 13px Orbitron; color: var(--dim); text-transform: uppercase; letter-spacing: 0.06em; }
  .rw-row .who img { width: 20px; }
  .rw-row.leg .who { color: var(--gold2); }
  .rw-row.leg .pw { color: var(--gold2); }
  .rw-row.leg .out b { color: var(--gold2); }
  .rw-row.leg .bar { background: rgb(0 0 0 / 30%); }
  .rw-row .pw { font: 900 20px Orbitron; color: #fff; font-variant-numeric: tabular-nums; }
  .rw-row .pw small { display: block; font: 600 11.5px 'Titillium Web'; color: var(--faint); }
  .rw-row .bar { height: 6px; border-radius: 3px; background: rgb(255 255 255 / 8%); overflow: hidden; }
  .rw-row .bar u { display: block; height: 100%; border-radius: 3px; background: rgb(255 255 255 / 45%); text-decoration: none; transition: width .3s; }
  .rw-row.leg .bar u { background: linear-gradient(90deg, #c99a3e, #ffe7a0); }
  .rw-row .out { font-size: 13.5px; color: var(--dim); text-align: right; }
  .rw-row .out b { color: #fff; }
  .rw-pays { margin: 10px 0 0; font-size: 13px; color: var(--faint); }
  .rw-pays b { color: var(--dim); }
  .rw-leg { position: relative; display: grid; grid-template-columns: auto 1fr auto; gap: 18px; align-items: center; margin-top: 26px; padding: 22px 20px 18px; border: 2px solid transparent; border-radius: 14px; background: radial-gradient(80% 140% at 0% 50%, rgb(242 195 90 / 16%), transparent 60%) padding-box, linear-gradient(180deg, #1d1a10, #12110d) padding-box, linear-gradient(160deg, #fff4cf, #e9b54c 30%, #7c5418 60%, #d9a640 85%, #fff0bd) border-box; box-shadow: 0 0 28px rgb(242 195 90 / 35%), 0 12px 26px rgb(0 0 0 / 45%); }
  .rw-leg::before { content: 'Legend Pass'; position: absolute; left: 50%; top: -11px; transform: translateX(-50%); padding: 2px 18px; clip-path: polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%); background: linear-gradient(180deg, #ffe7a0, #d39a33); font: 900 10.5px Orbitron; letter-spacing: 0.18em; color: #2a1a04; text-transform: uppercase; white-space: nowrap; }
  .rw-leg img { width: 48px; filter: drop-shadow(0 0 12px rgb(242 195 90 / 55%)); }
  .rw-leg b { display: block; margin-bottom: 4px; font: 900 18px Orbitron; color: var(--gold2); text-transform: uppercase; text-shadow: 0 0 14px rgb(242 195 90 / 40%); }
  .rw-leg span { font-size: 14px; color: var(--dim); }
  .rw-leg .btn { white-space: nowrap; }
  .rw-notes { margin: 22px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 14px; color: var(--dim); }
  .rw-notes li { padding-left: 16px; position: relative; }
  .rw-notes li::before { content: ''; position: absolute; left: 0; top: 9px; width: 5px; height: 5px; border-radius: 50%; background: var(--faint); }

  /* farming */
  .fm-grid { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 4px; }
  .fm-grid th:first-child, .fm-grid td.r { width: 82px; }
  .fm-grid th { padding: 4px 2px; font: 700 10.5px Orbitron; letter-spacing: 0.1em; color: var(--faint); text-transform: uppercase; text-align: center; }
  .fm-grid th:first-child { text-align: left; }
  .fm-grid td button { width: 100%; min-height: 34px; border: 0; border-radius: 8px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); color: #fff; font: 800 12.5px Orbitron; cursor: pointer; font-variant-numeric: tabular-nums; }
  .fm-grid td button:hover { background: rgb(255 255 255 / 8%); }
  .fm-grid td button.on { background: rgb(0 186 255 / 14%); box-shadow: inset 0 0 0 1.5px var(--cyan); }
  .fm-grid td button:disabled { background: none; box-shadow: none; color: var(--faint); cursor: default; }
  .fm-grid td.r { font-size: 13px; color: var(--dim); white-space: nowrap; padding-right: 6px; }
  .fm-calc { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 24px; align-items: start; }
  .fm-ctl { display: grid; gap: 14px; }
  .fm-ctl .rw-boost { margin: 0; grid-template-columns: 130px 1fr 60px; }
  .fm-out { display: grid; gap: 12px; padding: 18px; border-radius: 14px; background: rgb(0 0 0 / 22%); box-shadow: inset 0 0 0 1px var(--line); }
  .fm-out small { font: 700 11px Orbitron; letter-spacing: 0.14em; color: var(--faint); text-transform: uppercase; }
  .fm-out .big { display: flex; align-items: center; gap: 10px; font: 900 32px Orbitron; color: #fff; }
  .fm-out .big img { width: 30px; height: 30px; }
  .fm-out .bar { height: 8px; border-radius: 4px; background: rgb(255 255 255 / 8%); overflow: hidden; }
  .fm-out .bar u { display: block; height: 100%; background: rgb(255 255 255 / 55%); text-decoration: none; transition: width .3s; }
  .fm-out .bar.cap u { background: var(--gold); }
  .fm-out p { margin: 0; font-size: 13.5px; color: var(--dim); }
  .fm-out p b { color: #fff; }

  /* my lands */
  .ld-ranks { display: grid; grid-template-columns: 110px repeat(5, minmax(0, 1fr)); gap: 6px 10px; align-items: end; padding: 16px 22px 18px; }
  .ld-ranks > span { font: 700 11px Orbitron; letter-spacing: 0.12em; color: var(--faint); text-transform: uppercase; align-self: center; }
  .ld-ranks figure { margin: 0; display: grid; justify-items: center; gap: 4px; }
  .ld-ranks figure img { width: 64px; height: 64px; object-fit: contain; }
  .ld-ranks figure.hot img { filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #ffb347) drop-shadow(0 0 12px #ff5a1f); }
  .ld-ranks .ld-lvl { text-align: center; white-space: nowrap; font: 800 12px Orbitron; color: #fff; }
  .ld-ranks .ld-lvl small { display: block; font: 600 11.5px 'Titillium Web'; color: var(--faint); }
  .ld-keys { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; border-top: 1px solid var(--line); }
  .ld-keys > div { display: grid; grid-template-columns: 44px 1fr; gap: 12px; align-items: center; padding: 14px 22px; font-size: 13.5px; color: var(--dim); }
  .ld-keys > div + div { border-left: 1px solid rgb(255 255 255 / 6%); }
  .ld-keys img { width: 44px; height: 44px; object-fit: contain; }
  .ld-keys img.hot { filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #ffb347) drop-shadow(0 0 12px #ff5a1f); }
  .ld-keys b { display: block; color: #fff; font-size: 13.5px; }
  .ld-cost { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 4px; }
  .ld-cost button { display: grid; gap: 2px; padding: 12px; border: 0; border-radius: 12px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); color: var(--dim); text-align: left; cursor: pointer; }
  .ld-cost button small { font: 700 11px Orbitron; letter-spacing: 0.1em; text-transform: uppercase; }
  .ld-cost button b { display: flex; align-items: center; gap: 6px; font: 900 18px Orbitron; color: #fff; }
  .ld-cost button b img { width: 18px; }
  .ld-cost button span { font-size: 12px; color: var(--faint); }
  .ld-cost button.on { background: rgb(0 186 255 / 10%); box-shadow: inset 0 0 0 1.5px var(--cyan); }

  /* candle */
  .cd-list { display: grid; gap: 0; }
  .cd-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 14px 22px; border-top: 1px solid rgb(255 255 255 / 6%); }
  .cd-row:first-child { border-top: 0; }
  .cd-row > img { width: 40px; height: 40px; object-fit: contain; }
  .cd-row .pz { display: flex; align-items: baseline; gap: 8px; font: 900 22px Orbitron; color: #fff; }
  .cd-row .pz small { font: 600 13px 'Titillium Web'; color: var(--faint); }
  .cd-row .rq { margin-top: 2px; font-size: 13px; color: var(--dim); }
  .cd-row .rq b { color: #fff; }
  .cd-row .st { display: block; text-align: right; font-size: 12.5px; line-height: 1.6; color: var(--faint); white-space: nowrap; }
  .cd-row .st > span { display: block; }
  .cd-row .st b { font: 800 15px Orbitron; color: #fff; }
  .cd-row .st .soon { color: var(--dim); }
  .cd-calc { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 26px; align-items: center; }
  .cd-calc .rw-boost { margin: 0 0 14px; grid-template-columns: 170px 1fr 70px; }
  .cd-split { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: rgb(255 255 255 / 8%); }
  .cd-split u { background: var(--gold); text-decoration: none; transition: width .25s; }
  .cd-out { display: grid; gap: 4px; justify-items: center; padding: 20px; border-radius: 14px; background: rgb(0 0 0 / 22%); box-shadow: inset 0 0 0 1px var(--line); text-align: center; }
  .cd-out small { font: 700 11px Orbitron; letter-spacing: 0.14em; color: var(--faint); text-transform: uppercase; }
  .cd-out b { display: flex; align-items: center; gap: 8px; font: 900 26px Orbitron; color: #fff; white-space: nowrap; }
  .cd-out b img { width: 28px; height: 28px; }
  .cd-out span { font-size: 13px; color: var(--dim); }
  .slider { display: grid; gap: 4px; margin-bottom: 12px; font-size: 14px; color: var(--dim); }
  .slider label { display: flex; justify-content: space-between; } .slider label b { font: 800 13px Orbitron; }

  /* keep them fighting: the card's states */
  .rc .tag.lvlup { color: #04210f; background: linear-gradient(180deg, #b9ffe0, #2bd28a); }
  .rc .tag.arena { color: #1a1205; background: linear-gradient(180deg, #ffe39a, #f6a800); }
  .rc .tag.dungeon { color: #1b0b3a; background: linear-gradient(180deg, #e3d2ff, #a67cff); }
  .rc .tag.tourney { color: #2a1204; background: linear-gradient(180deg, #ffd0a8, #ff8a3d); }
  @property --run { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
  @keyframes run { to { --run: 360deg; } }
  .rc.up { background: conic-gradient(from var(--run), #0e6a45 0deg, #2bd28a 40deg, #eafff5 70deg, #2bd28a 100deg, #0e6a45 140deg, #1d3d33 220deg, #0e6a45 360deg); box-shadow: 0 5px 12px rgb(0 0 0 / 50%), 0 0 16px rgb(95 242 176 / 55%); animation: run 2.4s linear infinite; }
  .rc.up .lv::before { background: linear-gradient(135deg, #2bd28a, #0b6a44); box-shadow: 0 0 0 1.5px #b9ffe0; }
  .rc.up .xp, .rc.maxed .xp { background: #5ff2b0; box-shadow: 0 0 6px #5ff2b0; }
  .rc .mote { position: absolute; z-index: 5; bottom: 14%; width: 5px; height: 5px; border-radius: 50%; background: #b9ffe0; box-shadow: 0 0 6px #5ff2b0; opacity: 0; animation: mote 2.1s ease-out infinite; }
  @keyframes mote { 0% { transform: translateY(0) scale(1); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-70px) scale(.4); opacity: 0; } }
  .rc.over { background: linear-gradient(165deg, #ff9aa5, #c3203a 40%, #5a0d1c 70%, #ff7a88); box-shadow: 0 5px 12px rgb(0 0 0 / 50%), 0 0 16px rgb(255 60 80 / 55%); }
  .rc.over .pic { box-shadow: inset 0 0 0 2px #ff5a6a, inset 0 0 22px rgb(255 60 80 / 55%); animation: overdue 1.1s ease-in-out infinite; }
  @keyframes overdue { 50% { box-shadow: inset 0 0 0 2px #ff5a6a, inset 0 0 6px rgb(255 60 80 / 20%); } }
  .rc.iron { filter: saturate(0.6) brightness(0.85); }
  .rc.gone { filter: grayscale(1) brightness(0.35); }
  .kf-states { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; padding: 22px 22px 6px; }
  .kf-states figure { margin: 0; display: grid; gap: 10px; justify-items: center; cursor: pointer; }
  .kf-states figure .rc { width: 100%; max-width: 120px; cursor: pointer; }
  .kf-states figcaption { text-align: center; }
  .kf-states figcaption b { display: block; font: 800 12.5px Orbitron; color: #fff; text-transform: uppercase; letter-spacing: 0.06em; }
  .kf-states figcaption small { font-size: 12.5px; color: var(--faint); }
  .kf-states figure.on figcaption b { color: var(--cyan); }
  .kf-what { margin: 8px 22px 20px; padding: 12px 16px; border-radius: 12px; background: rgb(0 0 0 / 22%); box-shadow: inset 0 0 0 1px var(--line); font-size: 14px; color: var(--dim); min-height: 48px; }
  .kf-what b { color: #fff; }
  .kf-pay { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 26px; align-items: center; }
  .kf-pay .rc { width: 130px; }
  .kf-line { position: relative; height: 10px; margin: 30px 0 34px; border-radius: 5px; background: linear-gradient(90deg, #4ee07a 0 25%, #ff5a6a 25% 100%); }
  .kf-line i:first-child { translate: 0 0; } .kf-line i:first-child::after { margin-left: 0; }
  .kf-line i:nth-child(3) { translate: -100% 0; } .kf-line i:nth-child(3)::after { margin-right: 0; }
  .kf-line i { position: absolute; top: -26px; translate: -50% 0; font: 700 11px Orbitron; color: var(--dim); white-space: nowrap; font-style: normal; }
  .kf-line i::after { content: ''; display: block; width: 2px; height: 14px; margin: 3px auto 0; background: rgb(255 255 255 / 50%); }
  .kf-line input { position: absolute; left: -10px; right: -10px; top: -9px; width: calc(100% + 20px); height: 28px; margin: 0; background: none; cursor: grab; -webkit-appearance: none; appearance: none; }
  .kf-line input::-webkit-slider-runnable-track { height: 28px; background: none; }
  .kf-line input::-moz-range-track { height: 28px; background: none; }
  .kf-line input::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; margin-top: 3px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 4px rgb(0 186 255 / 50%), 0 2px 6px rgb(0 0 0 / 50%); }
  .kf-line input::-moz-range-thumb { width: 22px; height: 22px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 0 0 4px rgb(0 186 255 / 50%), 0 2px 6px rgb(0 0 0 / 50%); }
  .kf-line input:active { cursor: grabbing; }
  .kf-days { margin: -18px 0 12px; font-size: 13.5px; color: var(--faint); } .kf-days b { font: 800 14px Orbitron; color: #fff; }
  .kf-out { display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: baseline; font-size: 14px; color: var(--dim); }
  .kf-out b { font: 900 22px Orbitron; color: #fff; }
  .kf-out .st { font: 800 14px Orbitron; }
  .kf-lvl { display: grid; grid-template-columns: 140px minmax(0, 1fr) 200px; gap: 26px; align-items: center; }
  .kf-lvl .rc { width: 130px; }
  .kf-lvl .kf-big { display: grid; justify-items: center; text-align: center; }
  .kf-lvl .kf-big b { font: 900 34px Orbitron; color: #fff; }
  .kf-lvl .kf-big small { font-size: 12.5px; color: var(--faint); }

  /* payday timeline */
  .payline { position: relative; height: 70px; margin: 10px 10px 0; }
  .payline .bar { position: absolute; left: 0; right: 0; top: 30px; height: 10px; border-radius: 5px; background: linear-gradient(90deg, var(--green) 0 34%, #f2c35a 34% 40%, var(--enemy) 40% 100%); }
  .payline .pin { position: absolute; top: 0; translate: -50% 0; display: grid; justify-items: center; gap: 2px; font: 800 11px Orbitron; text-align: center; white-space: nowrap; }
  .payline .pin::after { content: ''; width: 2px; height: 22px; background: #fff; }
  .payline .pin span { order: -1; }
  .lvl { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 20px; align-items: center; }
  .lvlout { display: grid; gap: 6px; text-align: center; }
  .lvlout b { font: 900 34px Orbitron; color: var(--gold2); }

  /* ascension: the altar */
  .as-top { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 26px; align-items: center; padding: 20px 22px; }
  .as-hero { display: grid; gap: 8px; justify-items: center; text-align: center; }
  .as-hero .rc { width: 140px; }
  .as-hero small { font-size: 12.5px; color: var(--faint); }
  .as-hero.glow .rc { box-shadow: 0 0 0 2px #ffd979, 0 0 30px rgb(255 217 121 / 60%); }
  .as-socks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .as-sock { display: grid; grid-template-columns: 56px 1fr; gap: 12px; align-items: center; min-height: 92px; padding: 10px; border-radius: 12px; background: rgb(255 255 255 / 3%); box-shadow: inset 0 0 0 1px var(--line); }
  .as-sock .slot { display: grid; place-items: center; width: 56px; aspect-ratio: 3 / 4.1; border-radius: 8px; box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 14%); background: repeating-linear-gradient(45deg, rgb(255 255 255 / 2%) 0 6px, transparent 6px 12px); font: 400 20px 'Titillium Web'; color: var(--faint); }
  .as-sock .rc { width: 56px; cursor: pointer; }
  .as-sock .rc .nm, .as-sock .rc .asc { display: none; } .as-sock .rc .lv { width: 42%; left: -4px; top: -4px; } .as-sock .rc .lv b { font-size: 9px; } .as-sock .rc .el { width: 30%; right: 4px; top: 4px; }
  .as-sock > div > b { display: block; font: 800 12.5px Orbitron; color: #fff; text-transform: uppercase; letter-spacing: 0.04em; }
  .as-sock span { font-size: 12.5px; color: var(--faint); }
  .as-sock.ok { box-shadow: inset 0 0 0 1.5px var(--green); background: rgb(78 224 122 / 6%); }
  .as-sock.ok > div > b::after { content: ' ✓'; color: var(--green); }
  .as-roster { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; padding: 16px 22px 18px; border-top: 1px solid var(--line); }
  .as-roster > div { display: grid; gap: 6px; justify-items: center; text-align: center; }
  .as-roster .rc { width: 100%; max-width: 96px; }
  .as-roster small { font-size: 11.5px; line-height: 1.3; color: var(--faint); }
  .as-roster small i { display: inline-block; margin-top: 2px; padding: 0 6px; border-radius: 999px; background: rgb(255 90 106 / 16%); color: #ffb3bc; font-style: normal; font-weight: 700; }
  .as-roster .rc.sacd { box-shadow: 0 0 0 2.5px #ff5a6a, 0 0 16px rgb(255 90 106 / 45%); }
  .as-roster .rc.gone { opacity: 0.18; filter: grayscale(1); cursor: default; }
  .as-act { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 14px 22px 18px; border-top: 1px solid var(--line); }
  .as-act .msg { flex: 1; min-width: 240px; font-size: 14px; color: var(--dim); }
  .as-act .msg b { color: #fff; }
  .as-act .btn img { width: 15px; vertical-align: -2px; }
  .as-offers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 0 22px 20px; }
  .as-offer { display: grid; gap: 4px; padding: 16px; border: 0; border-radius: 14px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line2); color: var(--dim); text-align: left; cursor: pointer; animation: pop .25s ease both; }
  .as-offer small { font: 700 10.5px Orbitron; letter-spacing: 0.14em; color: var(--faint); text-transform: uppercase; }
  .as-offer b { font: 900 20px Orbitron; color: #fff; }
  .as-offer span { font-size: 12.5px; }
  .as-offer:hover { box-shadow: inset 0 0 0 1.5px #ffd979; }
  .as-offer.taken { box-shadow: inset 0 0 0 2px #ffd979, 0 0 18px rgb(255 217 121 / 35%); background: rgb(255 217 121 / 8%); }
  .as-offer.lost { opacity: 0.3; text-decoration: line-through; cursor: default; }

  /* account */
  .ac-card { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; padding: 20px 22px; }
  .ac-card img.av { width: 76px; height: 76px; border-radius: 18px; box-shadow: 0 0 0 2px #ffd979, 0 0 18px rgb(255 217 121 / 35%); }
  .ac-card b { display: block; font: 900 22px Orbitron; color: #fff; text-transform: uppercase; }
  .ac-card .badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; padding: 2px 10px 2px 4px; border-radius: 999px; background: rgb(242 195 90 / 14%); box-shadow: inset 0 0 0 1px rgb(242 195 90 / 45%); font: 800 11px Orbitron; color: var(--gold2); }
  .ac-card .badge img { width: 18px; }
  .ac-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--line); }
  .ac-tabs > div { padding: 14px 18px; font-size: 13.5px; color: var(--dim); }
  .ac-tabs > div + div { border-left: 1px solid rgb(255 255 255 / 6%); }
  .ac-tabs b { display: block; margin-bottom: 2px; font: 800 13px Orbitron; color: #fff; }
  .as-panel { margin-top: 22px; }
  .as-two { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; }
  .as-two > div { padding: 16px 18px; border-radius: 14px; background: rgb(78 224 122 / 5%); box-shadow: inset 0 0 0 1px rgb(78 224 122 / 30%); }
  .as-two > div.ask { background: rgb(255 90 106 / 5%); box-shadow: inset 0 0 0 1px rgb(255 90 106 / 30%); }
  .as-two h5 { margin: 0 0 12px; font: 800 12px Orbitron; letter-spacing: 0.12em; color: var(--green); text-transform: uppercase; }
  .as-two .ask h5 { color: #ff8a96; }
  .as-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .as-chips span { padding: 4px 11px; border-radius: 999px; background: rgb(255 255 255 / 6%); box-shadow: inset 0 0 0 1px var(--line); font-size: 13px; color: #fff; }
  .as-two ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 13.5px; color: var(--dim); }
  .as-two ul li::before { content: '🔒 '; }
  .as-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 22px; align-items: start; }
  .as-list { display: grid; gap: 6px; max-height: 420px; overflow: auto; padding-right: 4px; }
  .as-item { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 10px; background: rgb(255 255 255 / 3%); box-shadow: inset 0 0 0 1px var(--line); cursor: pointer; }
  .as-item b { display: block; font-size: 13.5px; color: #fff; }
  .as-item small { font-size: 12px; color: var(--faint); }
  .as-item small i { display: block; font-style: normal; color: #ffb3bc; }
  .tg { position: relative; width: 40px; height: 22px; border-radius: 11px; background: rgb(255 255 255 / 12%); transition: background .2s; }
  .tg::after { content: ''; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .2s; }
  .as-item.on { box-shadow: inset 0 0 0 1px rgb(78 224 122 / 45%); background: rgb(78 224 122 / 6%); }
  .as-item.on .tg { background: var(--green); } .as-item.on .tg::after { transform: translateX(18px); }
  .as-try { display: grid; gap: 12px; }
  .as-try .acts { display: flex; flex-wrap: wrap; gap: 8px; }
  .as-screen { position: relative; min-height: 190px; display: grid; place-items: center; padding: 18px; border-radius: 14px; background: rgb(0 0 0 / 28%); box-shadow: inset 0 0 0 1px var(--line); text-align: center; }
  .as-screen .ok { display: grid; justify-items: center; gap: 6px; font-size: 14px; color: var(--dim); animation: pop .25s ease both; }
  .as-screen .ok b { font: 900 18px Orbitron; color: var(--green); }
  .as-screen .ok i { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%; background: rgb(78 224 122 / 16%); box-shadow: inset 0 0 0 2px var(--green); font: 900 22px 'Titillium Web'; font-style: normal; color: var(--green); }
  .wallet { width: min(100%, 290px); padding: 14px; border-radius: 14px; background: #f4f6fb; color: #1b2233; text-align: left; box-shadow: 0 16px 34px rgb(0 0 0 / 55%); animation: pop .25s ease both; }
  .wallet small { display: block; font: 700 11px 'Titillium Web'; letter-spacing: 0.08em; color: #6b7690; text-transform: uppercase; }
  .wallet b { display: block; margin: 4px 0 10px; font: 800 15px 'Titillium Web'; color: #1b2233; }
  .wallet code { display: block; padding: 8px 10px; border-radius: 8px; background: #e4e8f2; font-size: 12px; color: #33405e; }
  .wallet .row { display: flex; gap: 8px; margin-top: 12px; }
  .wallet .row span { flex: 1; padding: 8px 0; border-radius: 8px; text-align: center; font: 800 13px 'Titillium Web'; }
  .wallet .row span:first-child { background: #e4e8f2; color: #33405e; } .wallet .row span:last-child { background: #3b6cf6; color: #fff; }
  .as-safe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; margin-top: 18px; border-top: 1px solid var(--line); }
  .as-safe > div { padding: 14px 16px 2px 0; font-size: 13.5px; color: var(--dim); }
  .as-safe > div + div { padding-left: 16px; border-left: 1px solid rgb(255 255 255 / 6%); }
  .as-safe b { display: block; margin-bottom: 2px; font: 800 13px Orbitron; color: #fff; }
  .cpu { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 22px; align-items: center; }
  .ring { position: relative; width: 112px; aspect-ratio: 1; border-radius: 50%; background: conic-gradient(var(--green) 0 calc(var(--p) * 1%), rgb(255 255 255 / 10%) 0); display: grid; place-items: center; }
  .ring::before { content: ''; position: absolute; inset: 10px; border-radius: 50%; background: var(--panel); }
  .ring span { position: relative; display: grid; justify-items: center; }
  .ring b { font: 900 24px Orbitron; color: #fff; } .ring small { font-size: 11.5px; color: var(--faint); }
  .avs { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .avs span { position: relative; }
  .avs img { width: 54px; height: 54px; border-radius: 14px; box-shadow: inset 0 0 0 1px var(--line); }
  .avs span.lock img { filter: grayscale(1) brightness(0.35); }
  .avs span.lock::after { content: '🔒'; position: absolute; inset: 0; display: grid; place-items: center; font-size: 16px; }
  .avs span.wear img { box-shadow: 0 0 0 2px #ffd979; }

  /* shop & legend pass */
  .lp { position: relative; margin-top: 8px; padding: 26px 24px 22px; border: 2px solid transparent; border-radius: 18px; background: radial-gradient(60% 120% at 100% 0%, rgb(242 195 90 / 18%), transparent 60%) padding-box, radial-gradient(60% 120% at 0% 100%, rgb(143 123 255 / 18%), transparent 60%) padding-box, linear-gradient(180deg, #1b1810, #100f14) padding-box, linear-gradient(160deg, #fff4cf, #e9b54c 30%, #7c5418 60%, #d9a640 85%, #fff0bd) border-box; box-shadow: 0 0 36px rgb(242 195 90 / 25%), 0 14px 30px rgb(0 0 0 / 45%); }
  .lp::before { content: 'Legend Pass'; position: absolute; left: 50%; top: -12px; transform: translateX(-50%); padding: 3px 22px; clip-path: polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%); background: linear-gradient(180deg, #ffe7a0, #d39a33); font: 900 11px Orbitron; letter-spacing: 0.2em; color: #2a1a04; text-transform: uppercase; white-space: nowrap; }
  .lp-head { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; }
  .lp-head img { width: 64px; filter: drop-shadow(0 0 14px rgb(242 195 90 / 55%)); }
  .lp-head h3 { margin: 0; font: 900 24px Orbitron; color: var(--gold2); text-transform: uppercase; }
  .lp-head p { margin: 4px 0 0; font-size: 15px; color: var(--dim); }
  .lp-perks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 20px 0; }
  .lp-perks > div { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: center; padding: 12px; border-radius: 12px; background: rgb(0 0 0 / 28%); box-shadow: inset 0 0 0 1px rgb(242 195 90 / 18%); }
  .lp-perks img { width: 30px; height: 30px; object-fit: contain; }
  .lp-perks b { display: block; font: 800 14px Orbitron; color: #fff; }
  .lp-perks span { font-size: 12.5px; color: var(--faint); }
  .lp-perks em { font-style: normal; color: var(--gold2); font-weight: 700; }
  .lp-plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .lp-plan { position: relative; display: grid; grid-template-columns: 64px 1fr; gap: 14px; align-items: center; padding: 12px; border: 0; border-radius: 14px; background: rgb(0 0 0 / 30%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 12%); color: var(--dim); text-align: left; cursor: pointer; transition: box-shadow .15s, transform .15s; }
  .lp-plan:hover { transform: translateY(-2px); }
  .lp-plan img { width: 64px; border-radius: 8px; }
  .lp-plan small { font: 700 11px Orbitron; letter-spacing: 0.12em; color: var(--faint); text-transform: uppercase; }
  .lp-plan b { display: flex; align-items: center; gap: 6px; margin: 2px 0; font: 900 22px Orbitron; color: #fff; }
  .lp-plan b img { width: 18px; border-radius: 0; }
  .lp-plan span { font-size: 12.5px; }
  .lp-plan i { position: absolute; right: 10px; top: -9px; padding: 1px 10px; border-radius: 999px; background: linear-gradient(180deg, #b9ffe0, #2bd28a); font: 800 10px Orbitron; font-style: normal; color: #04210f; letter-spacing: 0.06em; }
  .lp-plan.on { box-shadow: inset 0 0 0 2px #ffd979, 0 0 18px rgb(242 195 90 / 35%); }
  .lp-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-top: 16px; font-size: 13.5px; color: var(--dim); }
  .lp-foot .btn { margin-left: auto; }
  .tv { width: 100%; border-collapse: collapse; }
  .tv th { padding: 0 14px 10px; font: 700 11px Orbitron; letter-spacing: 0.14em; color: var(--faint); text-transform: uppercase; text-align: left; }
  .tv th.l { color: var(--gold2); }
  .tv td { padding: 11px 14px; border-top: 1px solid rgb(255 255 255 / 6%); font-size: 14px; color: var(--dim); }
  .tv td:first-child { color: #fff; font-weight: 600; }
  .tv td.l { color: #fff; font-weight: 700; background: rgb(242 195 90 / 6%); }
  .tv td.l::before { content: '✓ '; color: var(--gold2); }
  .gp { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .gp > div { position: relative; display: grid; gap: 8px; padding: 10px 10px 14px; border-radius: 14px; background: rgb(255 255 255 / 3%); box-shadow: inset 0 0 0 1px var(--line); text-align: center; }
  .gp > div.best { box-shadow: inset 0 0 0 1.5px #b48cff, 0 0 20px rgb(180 140 255 / 25%); }
  .gp img.art { width: 100%; aspect-ratio: 386 / 512; object-fit: cover; border-radius: 10px; }
  .gp small { font: 700 11px Orbitron; letter-spacing: 0.12em; color: var(--faint); text-transform: uppercase; }
  .gp b { display: flex; align-items: center; justify-content: center; gap: 6px; font: 900 22px Orbitron; color: #fff; }
  .gp b img { width: 20px; }
  .gp span { font-size: 13px; color: var(--dim); }
  .gp span img { width: 15px; vertical-align: -3px; }
  .gp i { position: absolute; left: 50%; top: -9px; transform: translateX(-50%); padding: 1px 10px; border-radius: 999px; background: linear-gradient(180deg, #e3d2ff, #a67cff); font: 800 10px Orbitron; font-style: normal; color: #1b0b3a; white-space: nowrap; }
  .sh-more { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
  .sh-more > div { padding: 14px 16px; border-radius: 14px; background: rgb(255 255 255 / 3%); box-shadow: inset 0 0 0 1px var(--line); font-size: 13.5px; color: var(--dim); }
  .sh-more h5 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font: 800 14px Orbitron; color: #fff; }
  .sh-more h5 img { width: 22px; }
  .sh-more ul { margin: 6px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .sh-more li { display: flex; justify-content: space-between; gap: 8px; } .sh-more li b { text-align: right; }
  .sh-more li b { color: #fff; font-weight: 700; }

  /* market: the auction */
  .mk-auc { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 26px; align-items: center; padding: 22px; }
  .mk-auc .rc { width: 140px; cursor: default; } .mk-auc .rc:hover { transform: none; }
  .mk-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .mk-stats > div { padding: 10px 12px; border-radius: 12px; background: rgb(0 0 0 / 22%); box-shadow: inset 0 0 0 1px var(--line); }
  .mk-stats small { display: block; font: 700 10.5px Orbitron; letter-spacing: 0.12em; color: var(--faint); text-transform: uppercase; }
  .mk-stats b { display: flex; align-items: center; gap: 6px; margin-top: 4px; font: 900 19px Orbitron; color: #fff; font-variant-numeric: tabular-nums; }
  .mk-stats b img { width: 18px; }
  .mk-stats .you b { color: var(--mine); } .mk-stats .rival b { color: var(--enemy); }
  .mk-line { position: relative; height: 10px; margin: 34px 0 10px; border-radius: 5px; background: rgb(255 255 255 / 10%); }
  .mk-line .zone { position: absolute; top: 0; bottom: 0; border-radius: 5px; background: repeating-linear-gradient(45deg, rgb(255 90 106 / 55%) 0 6px, rgb(255 90 106 / 25%) 6px 12px); transition: left .3s, width .3s; }
  .mk-line .end { position: absolute; top: -28px; translate: -50% 0; font: 800 11px Orbitron; color: #fff; white-space: nowrap; transition: left .3s; }
  .mk-line .end::after { content: ''; display: block; width: 2px; height: 30px; margin: 3px auto 0; background: #fff; }
  .mk-line .lbl { position: absolute; top: 18px; font-size: 11.5px; color: var(--faint); white-space: nowrap; }
  .mk-line input { position: absolute; left: -10px; right: -10px; top: -9px; width: calc(100% + 20px); height: 28px; margin: 0; background: none; cursor: grab; -webkit-appearance: none; appearance: none; }
  .mk-line input::-webkit-slider-runnable-track { height: 28px; background: none; }
  .mk-line input::-moz-range-track { height: 28px; background: none; }
  .mk-line input::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; margin-top: 3px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 4px rgb(0 186 255 / 50%), 0 2px 6px rgb(0 0 0 / 50%); }
  .mk-line input::-moz-range-thumb { width: 22px; height: 22px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 0 0 4px rgb(0 186 255 / 50%); }
  .mk-act { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 14px 22px 18px; border-top: 1px solid var(--line); }
  .mk-act .msg { flex: 1; min-width: 260px; font-size: 14px; color: var(--dim); }
  .mk-act .msg b { color: #fff; }
  .mk-act .btn img { width: 15px; vertical-align: -2px; }
  .mk-sell { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 26px; align-items: center; }
  .mk-sell .rw-boost { margin: 0; grid-template-columns: 120px 1fr 70px; }
  .mk-bill { display: grid; gap: 8px; padding: 16px 18px; border-radius: 14px; background: rgb(0 0 0 / 22%); box-shadow: inset 0 0 0 1px var(--line); font-size: 14px; color: var(--dim); }
  .mk-bill div { display: flex; justify-content: space-between; gap: 10px; }
  .mk-bill b { font: 800 14px Orbitron; color: #fff; }
  .mk-bill .tot { padding-top: 8px; border-top: 1px solid var(--line); }
  .mk-bill .tot b { display: flex; align-items: center; gap: 6px; font-size: 20px; color: var(--gold2); }
  .mk-bill img { width: 18px; height: 18px; }

  /* ascension: the ✦5 unlock */
  .as5 { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 28px; align-items: center; margin-top: 22px; padding: 24px 24px 22px; border-radius: 16px; overflow: hidden; background: radial-gradient(70% 120% at 100% 50%, rgb(143 123 255 / 18%), transparent 65%), rgb(255 255 255 / 3%); box-shadow: inset 0 0 0 1px rgb(143 123 255 / 35%); }
  .as5 h4 { margin: 0 0 6px; font: 900 22px Orbitron; color: #fff; text-transform: uppercase; }
  .as5 h4 em { font-style: normal; color: #ffd979; }
  .as5 > div > p { margin: 0 0 16px; font-size: 14.5px; color: var(--dim); }
  .as5 > div > p b { color: #fff; }
  .as5-pips { display: flex; gap: 10px; }
  .as5-pips span { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 16%); font: 900 13px Orbitron; color: var(--faint); transition: all .3s; }
  .as5-pips span.on { background: radial-gradient(circle, rgb(255 217 121 / 30%), rgb(255 217 121 / 6%)); box-shadow: inset 0 0 0 1.5px #ffd979; color: #ffd979; }
  .as5-pips span.five { width: 54px; height: 54px; font-size: 15px; box-shadow: inset 0 0 0 2px rgb(143 123 255 / 70%); color: #cfc6ff; }
  .as5-pips span.five.on { background: radial-gradient(circle, rgb(255 217 121 / 45%), rgb(143 123 255 / 20%)); box-shadow: inset 0 0 0 2px #ffd979, 0 0 22px rgb(255 217 121 / 55%); color: #fff; }
  .as5-pips { align-items: center; }
  .as5-ab { position: relative; display: grid; gap: 6px; padding: 18px 18px 16px; border-radius: 14px; background: #0d1530; box-shadow: inset 0 0 0 1px var(--line2); transition: all .4s; }
  .as5-ab .rib { display: flex; position: absolute; top: -1px; left: 16px; }
  .as5-ab .rib i { padding: 2px 12px; background: #3fd8ff; clip-path: polygon(0 0, 100% 0, 92% 100%, 8% 100%); font: 800 10px Orbitron; font-style: normal; letter-spacing: 0.16em; color: #0a0d18; text-transform: uppercase; }
  .as5-ab .rib i.lock { background: #2b3550; color: #9fb0d6; margin-left: -4px; }
  .as5-ab b { margin-top: 8px; font: 800 17px Orbitron; color: var(--dim); }
  .as5-ab span { font-size: 14px; color: var(--faint); }
  .as5-ab .lockicon { position: absolute; right: 16px; top: 16px; font-size: 22px; filter: grayscale(1); opacity: .7; }
  .as5.open .as5-ab { background: linear-gradient(180deg, #11204a, #0d1530); box-shadow: inset 0 0 0 1.5px #3fd8ff, 0 0 30px rgb(63 216 255 / 30%); animation: as5pop .6s cubic-bezier(.2,1.4,.4,1) both; }
  .as5.open .as5-ab b { color: #fff; } .as5.open .as5-ab span { color: var(--dim); }
  .as5.open .as5-ab .rib i.lock { background: linear-gradient(180deg, #ffe7a0, #d39a33); color: #2a1a04; }
  .as5.open .as5-ab .lockicon { filter: none; opacity: 1; }
  @keyframes as5pop { 0% { transform: scale(.94); } 60% { transform: scale(1.03); } }

  /* ascension altar */
  .altar { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; gap: 22px; align-items: center; justify-items: center; }
  .socks { display: grid; gap: 10px; }
  .sock { display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 8px; border-radius: 12px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); font-size: 13.5px; color: var(--dim); }
  .sock .gc { width: 50px; }
  .sock b { display: block; font: 800 12.5px Orbitron; color: #fff; }
  .sock.ok { box-shadow: inset 0 0 0 1.5px var(--green); }
  .offers { display: grid; gap: 8px; }
  .offer { padding: 10px 14px; border: 0; border-radius: 12px; background: rgb(255 255 255 / 4%); box-shadow: inset 0 0 0 1px var(--line); text-align: left; cursor: pointer; font-size: 14px; color: var(--dim); }
  .offer b { font: 800 14px Orbitron; color: var(--green); }
  .offer.on { box-shadow: inset 0 0 0 1.5px var(--gold); background: rgb(242 195 90 / 10%); }
  .offer.lost { opacity: 0.35; text-decoration: line-through; }

  /* market auction timeline */
  .auct { position: relative; height: 92px; margin: 8px 6px 0; }
  .auct .tl { position: absolute; left: 0; right: 0; top: 40px; height: 12px; border-radius: 6px; background: rgb(255 255 255 / 8%); }
  .auct .snipe { position: absolute; top: 40px; height: 12px; border-radius: 6px; background: repeating-linear-gradient(45deg, rgb(255 77 94 / 45%) 0 6px, rgb(255 77 94 / 20%) 6px 12px); }
  .auct .now { position: absolute; top: 26px; width: 4px; height: 40px; margin-left: -2px; border-radius: 2px; background: var(--gold); box-shadow: 0 0 10px var(--gold); }
  .auct .endmark { position: absolute; top: 18px; translate: -50% 0; font: 800 11px Orbitron; color: #fff; text-align: center; white-space: nowrap; transition: left .3s; }
  .auct .endmark::after { content: ''; display: block; width: 2px; height: 34px; margin: 2px auto 0; background: #fff; }
  .auct .lbl { position: absolute; bottom: 0; font-size: 12px; color: var(--faint); }

  /* trial vs legend */
  .tvl { width: 100%; border-collapse: collapse; font-size: 14.5px; }
  .tvl th, .tvl td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  .tvl th { font: 800 12px Orbitron; letter-spacing: 0.14em; color: var(--faint); text-transform: uppercase; }
  .tvl td:first-child { color: #fff; font-weight: 700; }
  .tvl td.l { color: var(--gold2); } .tvl td.t { color: var(--dim); }
  .tvl tr.hl td { background: rgb(242 195 90 / 6%); }

  /* glossary */
  .gl-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; margin-bottom: 16px; }
  .gl-bar .search { flex: 1; min-width: 220px; margin: 0; }
  .gl-cats { display: flex; flex-wrap: wrap; gap: 6px; }
  .gl-cats button { padding: 6px 12px; border: 0; border-radius: 999px; background: rgb(255 255 255 / 5%); box-shadow: inset 0 0 0 1px var(--line); color: var(--dim); font: 700 12.5px 'Titillium Web'; cursor: pointer; }
  .gl-cats button.on { background: rgb(0 186 255 / 14%); box-shadow: inset 0 0 0 1.5px var(--cyan); color: #fff; }
  .gl-letter { grid-column: 1 / -1; margin: 10px 0 0; font: 900 13px Orbitron; color: var(--gold); letter-spacing: 0.1em; }
  .gl-letter:first-child { margin-top: 0; }
  .gloss { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
  .gloss > a { display: grid; grid-template-columns: 34px 1fr; gap: 12px; align-items: start; padding: 12px 14px; border-radius: 12px; background: rgb(255 255 255 / 3%); box-shadow: inset 0 0 0 1px var(--line); font-size: 13.5px; color: var(--dim); text-decoration: none; transition: background .15s, box-shadow .15s; }
  .gloss > a:hover { background: rgb(255 255 255 / 6%); box-shadow: inset 0 0 0 1px var(--line2); }
  .gloss > a img { width: 30px; height: 30px; object-fit: contain; }
  .gloss > a b { display: block; margin-bottom: 2px; font: 800 13.5px Orbitron; color: #fff; }
  .gloss > a small { display: block; margin-top: 5px; font: 600 12px 'Titillium Web'; color: rgb(0 186 255 / 80%); }
  .gl-none { grid-column: 1 / -1; color: var(--faint); }
  mark { background: rgb(242 195 90 / 35%); color: #fff; border-radius: 3px; }

  @media (max-width: 900px) {
    .coins { grid-template-columns: 1fr; gap: 10px; } .coins > i { display: none; }
    .coinrow { grid-template-columns: 1fr; gap: 6px; }
    .wrap { grid-template-columns: 1fr; }
    .toc { position: static; max-height: none; }
    .nfts { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } .nft small { display: none; } .nft b { font-size: 11px; }
    .tavtop { grid-template-columns: 1fr; } .tavrec { border-right: 0; border-bottom: 1px solid var(--line); } .tslots { grid-template-columns: 1fr; } .tslot.empty { min-height: 44px; }
    .lane { grid-template-columns: 1fr; gap: 4px; } .lane .who br { display: none; } .lane .who small { margin-left: 6px; }
    .bvcards .gc { width: 52px; } .bvcards { gap: 6px; }
    .dgfig { grid-template-columns: repeat(3, minmax(0, 1fr)); } .dgchart { grid-column: 1 / -1; } .dgtile b { font-size: 20px; } .dgtile span { display: none; }
    .dstep { flex-wrap: wrap; } .dstep__tally { white-space: normal; }
    .dgrow, .arow { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ld-ranks { grid-template-columns: 64px repeat(5, minmax(0, 1fr)); padding: 14px; gap: 6px; } .ld-ranks figure img { width: 44px; height: 44px; } .ld-keys { grid-template-columns: 1fr; } .ld-keys > div + div { border-left: 0; border-top: 1px solid rgb(255 255 255 / 6%); } .ld-cost { grid-template-columns: 1fr 1fr; }
    .kf-states { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 16px 14px 4px; } .kf-what { margin: 6px 14px 16px; } .kf-pay, .kf-lvl { grid-template-columns: 1fr; justify-items: center; } .kf-pay > div:last-child, .kf-lvl .rw-boost { width: 100%; }
    .ac-tabs, .as-safe { grid-template-columns: 1fr 1fr; } .as-grid, .as-two, .cpu { grid-template-columns: 1fr; } .as-safe > div + div { border-left: 0; padding-left: 0; }
    .tgrid, .prz { grid-template-columns: 1fr; } .tw { flex-wrap: wrap; } .tw button { flex: 1 1 30% !important; } .brk { grid-template-columns: 1fr 1fr; row-gap: 14px; } .brk .col:nth-child(3) { border-left: 0; }
    .lp { padding: 22px 14px 16px; } .lp-perks, .lp-plans { grid-template-columns: 1fr; } .gp, .sh-more { grid-template-columns: 1fr 1fr; } .tv td, .tv th { padding-left: 8px; padding-right: 8px; }
    .mk-auc, .mk-sell { grid-template-columns: 1fr; justify-items: center; } .mk-auc > div:last-child, .mk-sell > * { width: 100%; } .mk-stats { grid-template-columns: 1fr 1fr; } .mk-act { padding: 12px 14px 16px; }
    .as5 { grid-template-columns: 1fr; padding: 18px 14px; } .as5-pips span { width: 36px; height: 36px; } .as5-pips span.five { width: 44px; height: 44px; }
    .as-top { grid-template-columns: 1fr; justify-items: center; padding: 16px 14px; } .as-socks { grid-template-columns: 1fr; width: 100%; } .as-roster { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 14px; } .as-offers { grid-template-columns: 1fr; padding: 0 14px 16px; } .as-act { padding: 12px 14px 16px; }
    .cd-calc { grid-template-columns: 1fr; } .cd-calc .rw-boost { grid-template-columns: 1fr 60px; } .cd-calc .rw-boost span { grid-column: 1 / -1; } .cd-row { padding: 12px 14px; grid-template-columns: 34px 1fr; } .cd-row .st { grid-column: 2; justify-items: start; text-align: left; }
    .fm-calc { grid-template-columns: 1fr; } .rw-tools { grid-template-columns: 1fr 1fr; } .rw-steps { grid-template-columns: 1fr 1fr; } .rw-row { grid-template-columns: 1fr auto; } .rw-row .bar { grid-column: 1 / -1; } .rw-row .out { grid-column: 1 / -1; text-align: left; } .rw-pool, .rw-mine, .rw-calc { padding-left: 14px; padding-right: 14px; }
    .cdx, .diff, .candle, .lvl, .dmg { grid-template-columns: 1fr; }
    .cxwhat { position: static; } .cxname { font-size: 20px; } .cxhead .gc { width: 72px; } .cxscore { width: 54px; height: 62px; } .cxscore b { font-size: 18px; }
    .cxstat { grid-template-columns: 86px 1fr auto 14px; gap: 7px; } .cxup { flex-wrap: wrap; }
    .qscopes { grid-template-columns: 1fr; }
    .bracket { grid-template-columns: 1fr 1fr; }
    .altar { grid-template-columns: 1fr; }
    .gmapwrap { overflow-x: auto; border-radius: 16px; overscroll-behavior-x: contain; }
    .gmap { width: 700px; }
    .gmaphint { display: block !important; }
    .flow { grid-template-columns: 1fr; } .flow div { max-width: none; } .flow span { transform: rotate(90deg); justify-self: center; }
    .pool b { font-size: 18px; }
    .tmslots { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; padding: 10px 12px 14px; } .tmslot { font-size: 0; } .tmslot.nft { grid-column: 1 / -1; justify-content: center; } .tmslot.nft img { max-width: 48px; }
    .tmgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 12px; gap: 10px; } .tmbar .mini { display: none; }
    section.ch { padding: 20px 16px; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }

  /* ---------- phone ---------- */
  a.btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
  .mnav, .toc-head { display: none; }
  .fm-grid .abbr { display: none; }
  .rw-mine th + th, .rw-mine td + td { padding-left: 14px; }
  @media (max-width: 900px) {
    body { font-size: 15px; }
    .wrap { padding: 0 14px 90px; gap: 0; }
    section.ch { padding: 20px 16px 22px; scroll-margin-top: calc(var(--topbar-h, 0px) + 74px); }
    .chhead h2 { font-size: 20px; }
    .lead { font-size: 15.5px; }
    .part { margin: 36px 0 4px; }
    /* the chapter bar: where you are, a step either way, and every chapter one tap away */
    .mnav { position: sticky; top: var(--topbar-h, 0px); z-index: 40; display: grid; grid-template-columns: 44px minmax(0, 1fr) 40px 40px; gap: 6px; align-items: center; margin: 0 -14px; padding: 8px 14px; background: rgb(5 7 15 / 94%); backdrop-filter: blur(10px); box-shadow: 0 1px 0 var(--line); }
    .mnav button { display: grid; place-items: center; height: 40px; padding: 0; border: 0; border-radius: 10px; background: rgb(255 255 255 / 6%); box-shadow: inset 0 0 0 1px var(--line2); color: #fff; cursor: pointer; }
    .mnav button:disabled { opacity: 0.35; }
    .mnav svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .mnav-t { display: grid; min-width: 0; line-height: 1.2; }
    .mnav-t small { font: 700 10px Orbitron; letter-spacing: 0.18em; color: var(--gold); text-transform: uppercase; }
    .mnav-t b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 800 14px Orbitron; color: #fff; }
    .toc { display: none; position: fixed; z-index: 60; top: var(--topbar-h, 0px); left: 0; right: 0; bottom: 0; width: auto; height: auto; align-self: stretch; justify-self: stretch; max-height: none; margin: 0; padding: 14px 16px 110px; overflow: auto; border-radius: 0; background: var(--panel); }
    .toc.open { display: block; animation: pop .2s ease both; }
    .toc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .toc-head b { font: 900 16px Orbitron; text-transform: uppercase; color: #fff; }
    .toc-head button { width: 40px; height: 40px; border: 0; border-radius: 10px; background: rgb(255 255 255 / 6%); color: #fff; font-size: 16px; cursor: pointer; }
    .toc a { padding: 10px 8px; font-size: 15px; }
    /* the hero's five steps: one row of five */
    .hero { padding: 44px 14px 30px; }
    .hero h1 { font-size: 26px; }
    .loop { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-top: 22px; }
    .loop .arrow { display: none; }
    .loop button { width: auto; padding: 10px 2px 8px; gap: 3px; }
    .loop button img { width: 26px; height: 26px; }
    .loop button .ics img { width: 18px; height: 22px; }
    .loop button b { font-size: 9.5px; letter-spacing: 0; }
    .loop button small { display: none; }
    .hero .loopnote { margin-top: 16px; font-size: 14px; }
    /* the codex */
    .cxhead { grid-template-columns: 64px minmax(0, 1fr) auto; gap: 10px; }
    .cxhead .gc { width: 64px; }
    .cxname { font-size: 15px; overflow-wrap: anywhere; }
    .cxscore { width: 46px; height: 52px; } .cxscore b { font-size: 16px; } .cxscore small { font-size: 7px; }
    .cxstat { grid-template-columns: 84px minmax(0, 1fr) auto 14px; gap: 6px; }
    .cxstat small { font-size: 9.5px; letter-spacing: 0; gap: 5px; }
    .cxstat b { font-size: 12.5px; }
    .cxres { gap: 3px; } .cxres .hex { width: 28px; height: 32px; } .cxres .hex span { width: 24px; height: 28px; } .cxres b { font-size: 10.5px; }
    /* the tournament's team score */
    .tscore .five { gap: 5px; }
    .tscore .asc { gap: 1px; } .tscore .asc button { width: 18px; height: 18px; font-size: 11px; } .tscore .asc span { min-width: 16px; font-size: 9.5px; }
    /* the farm's weights */
    .fm-grid { border-spacing: 3px; }
    .fm-grid .full { display: none; } .fm-grid .abbr { display: inline; }
    .fm-grid th { font-size: 9px; letter-spacing: 0; }
    .fm-grid th:first-child, .fm-grid td.r { width: 64px; font-size: 11.5px; }
    .fm-grid td button { min-height: 30px; padding: 0; font-size: 9.5px; }
    /* my lands: the boost ranks without their side labels */
    .ld-ranks { grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 14px 12px; gap: 6px 4px; }
    .ld-ranks > span { display: none; }
    .ld-ranks .ld-lvl { font-size: 9.5px; }
    .ld-ranks figure img { width: 46px; height: 46px; }
    /* rewards: the Legend strip stacks, its button full width */
    .rw-leg { grid-template-columns: auto minmax(0, 1fr); padding: 20px 14px 14px; }
    .rw-leg .btn { grid-column: 1 / -1; }
    .rw-leg b { font-size: 15px; }
    .rw-mine th { font-size: 10px; letter-spacing: 0.08em; }
    .sh-more { grid-template-columns: 1fr; }
    .lp-foot .btn { width: 100%; margin-left: 0; }
  }

  /* in the game: no backdrop of its own, the hero a rounded panel, the contents under the game's top bar */
  /* in the game the chapters run from the very top, beside the header */
  .gx.ingame { display: grid; grid-template-columns: 250px minmax(0, 1fr); column-gap: 40px; padding-bottom: 80px; }
  .gx.ingame .wrap { display: contents; }
  .gx.ingame .toc { grid-column: 1; grid-row: 1 / span 2; }
  .gx.ingame .hero { grid-column: 2; grid-row: 1; }
  .gx.ingame .hero { padding: 54px 24px 46px; } .gx.ingame .hero h1 { font-size: clamp(26px, 2.6vw, 40px); }
  .gx.ingame main { grid-column: 2; grid-row: 2; }
  @media (max-width: 900px) { .gx.ingame { display: block; } .gx.ingame .wrap { display: grid; padding: 20px 0 60px; } .gx.ingame :is(.toc, .hero, main) { grid-column: auto; grid-row: auto; } }
  .gx.ingame .hero { border-radius: 18px; }
  @media (min-width: 901px) { .toc { top: calc(var(--topbar-h, 0px) + 16px); max-height: calc(100vh - 32px - var(--topbar-h, 0px)); } }
`,Gt=`<div class="gx">
<header class="hero">
  <div class="kick">Trainer's guide</div>
  <h1>A quick guide to <em>Alien Legends</em></h1>
  <div class="loop" id="loop"></div>
  <p class="loopnote" id="loopnote"></p>
</header>

<div class="wrap">
  <nav class="toc" id="toc">
    <div class="toc-head"><b>Chapters</b><button id="tocclose" aria-label="Close the chapters">✕</button></div>
    <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="q" type="search" placeholder="Search the guide…" aria-label="Search the guide"></div>
  </nav>

  <main id="main">
    <div class="mnav" id="mnav"><button class="mnav-all" id="mnavopen" aria-label="All chapters"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><span class="mnav-t"><small id="mnavpart"></small><b id="mnavtitle"></b></span><button class="mnav-step" id="mnavprev" aria-label="Previous chapter"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button class="mnav-step" id="mnavnext" aria-label="Next chapter"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>

    <!-- ======================= START ======================= -->
    <div class="part">Start</div>

    <section class="ch" id="trainer" data-icon="menu/account.svg">
      <div class="chhead"><h2>Become a <em>trainer</em></h2></div>
      <p class="lead">You're a <b>trainer</b>: you recruit alien fighters, send them into fights, and turn wins into <b>TLM</b> and <b>Shards</b>. Getting started takes four steps.</p>
      <div class="starts">
        <div><i>1</i><img src="%A%/icons/wax-coin.webp" alt=""><b>Connect your wallet</b><span>Log in with your WAX wallet.</span></div>
        <div><i>2</i><img src="%A%/icons/menu/account.svg" alt=""><b>Pick a trainer name</b><span>Register once and choose the name other players see.</span></div>
        <div><i>3</i><img src="%A%/icons/menu/rewards.svg" alt=""><b>Equip your tools</b><span>In Rewards, equip up to 3 Alien Worlds tools. Without them, wins earn almost nothing.</span></div>
        <div><i>4</i><img src="%A%/icons/menu/briefing.svg" alt=""><b>Follow the Briefing</b><span>It shows your next step, starting with recruiting five fighters.</span></div>
      </div>
    </section>

    <section class="ch" id="energy" data-icon="energy.svg">
      <div class="chhead"><h2><em>Currencies</em></h2></div>
      <p class="lead">Three currencies to play with, three you earn. <b>Energy</b> matters most: almost every action costs some, and it never refills by itself.</p>
      <div class="coins" id="coins" role="tablist"></div>
      <p class="coinhint" id="coinhint">Tap a currency to see where it comes from and what it's for.</p>
      <div class="coinx" id="coinx"><div><div class="coinbox" id="coinbox"></div></div></div>
    </section>

    <section class="ch" id="map" data-icon="menu/world.svg">
      <div class="chhead"><h2>The <em>map</em></h2></div>
      <p class="lead">Your fighters live on a map of <b>six planets</b>. Travel to a building to use it: the farther you go, the more <b>energy</b> it costs. Try it: tap a building.</p>
      <div class="gtabs" id="gtabs"></div>
      <div class="gmapwrap"><div class="gmap" id="gmap"></div></div>
      <p class="gmaphint">Swipe the map to see the rest.</p>
      <div class="gkeys">
        <div class="hotkey"><img src="%A%/markers/buildings/arena.svg" alt=""><span><b>Glowing = best rewards</b>The arenas and dungeons with the highest boost light up.</span></div>
        <div><img src="%A%/markers/buildings/dungeon.svg" alt=""><span><b>The number is the boost</b>Higher boost, more Reward Power for a win there.</span></div>
        <div><img src="%A%/markers/buildings/portal-veles.svg" alt=""><span><b>Portals</b>Step on one to warp to the planet it leads to.</span></div>
        <div><img src="%A%/icons/weather.png" alt=""><span><b>Weather</b>A land's weather can change fighters' stats in a fight there.</span></div>
      </div>
    </section>

    <!-- ======================= FIGHTERS ======================= -->
    <div class="part">Fighters</div>

    <section class="ch" id="recruit" data-icon="/markers/buildings/tavern.svg">
      <div class="chhead"><h2>Recruit <em>fighters</em></h2></div>
      <p class="lead">You have your own list of taverns on the map. Travel to one, <b>reveal</b> its recruit (energy), and <b>hire</b> it. Revealing uses that tavern up, and a new one joins your list.</p>
      <div class="card tav">
        <div class="tavtop">
          <div class="tavrec"><b>A recruit is waiting</b><span class="gc big" data-f="lunatic_khaured,fire,1" data-name="Lunatic"></span><small>Khaured · Fire · Level 1</small><span class="ex">example</span></div>
          <div class="tavdeal">
            <div class="tavcap"><b>The deal</b><span>show up to 3 NFTs · they are not spent</span></div>
            <div class="price"><s id="tprev" class="hide">100</s><strong id="tcost"><img src="%A%/icons/energy.svg" alt="">100</strong><small>energy to hire</small></div>
            <div class="tmeter"><i id="tpay"></i><u id="tcut"></u></div>
            <div class="tslots" id="tslots"></div>
            <div class="tavcap"><b>The tavern wants</b><span>each objective is met once</span></div>
            <div class="wants" id="wants"></div>
            <div class="tacts"><button class="btn" id="tbest">Best pick</button><button class="btn gold" id="thire">Hire</button></div>
          </div>
        </div>
        <div class="twallet">
          <div class="tavcap"><b>Your NFTs</b><span>tap a card to put it on the table, tap again to take it back</span></div>
          <div class="nfts" id="nfts"></div>
          <div class="explain" id="hirenote"></div>
        </div>
      </div>
      <ul class="pts">
        <li><b>Objectives</b> are met by showing Alien Worlds NFTs from your own wallet (by rarity, shine, element, race…). Each objective counts once, up to <b>3 cards</b> per hire, and the cards are <b>not spent</b>.</li>
        <li>You must be <b>standing on the tavern</b> to hire. Revealing at another tavern first replaces a recruit you haven't hired.</li>
        <li>With a <b>Legend Pass</b>, the recruit is revealed for free when you arrive at one of your taverns.</li>
      </ul>
    </section>

    <section class="ch" id="fighter" data-icon="stats/damage.svg">
      <div class="chhead"><h2>Understanding <em>fighters</em></h2></div>
      <p class="lead">Every fighter has a <b>codex</b> page: open one from My Fighters, the Market or a fight. Here's one, tap anything on it to see what it means.</p>
      <div class="cdx">
        <div class="codex"><div id="codex"></div></div>
        <div class="cxwhat" id="cxwhat"></div>
      </div>
    </section>

    <section class="ch" id="squad" data-icon="/guide/team.svg">
      <div class="chhead"><h2>Building your <em>team</em></h2></div>
      <p class="lead">Every fight takes <b>exactly five</b> fighters plus a sixth: the <b>NFT fighter</b>, built from one Alien Worlds <b>crew</b> card and one <b>weapon</b> card. Tap fighters to put them in your team; rest the pointer on one to read it first.</p>
      <div class="card tm">
        <div class="tmhead"><b>Your team</b><span id="tmcount">0/5</span></div>
        <div class="tmslots" id="tmslots"></div>
        <div class="tmnote" id="tmnote"></div>
        <div class="tmgrid" id="tmgrid"></div>
        <div class="tmbar"><span class="mini" id="tmmini"></span><small id="tmbar">Your team · 0/5</small><button class="btn gold" id="tmgo" disabled>Start Fight</button></div>
      </div>
      <ul class="pts">
        <li>The <b>crew</b> card sets the NFT fighter's class, race and targeting; the <b>weapon</b> sets its element. Their stats and abilities add up.</li>
        <li>Order only matters on a tie: among equals, the fighter placed earlier acts first.</li>
        <li>A fighter can't join while it's <b>busy</b> (on the Market, defending an arena, in a tournament) or while its <b>payday is overdue</b>.</li>
      </ul>
    </section>

    <section class="ch" id="fight" data-icon="swords.svg">
      <div class="chhead"><h2>How a <em>fight plays</em></h2></div>
      <p class="lead">Fights are <b>automatic</b> and settled on the chain; the battle screen is a replay. Whoever has the <b>lowest wind-up</b> acts next; after striking, its wind-up grows by its <b>cooldown</b>. Step through it:</p>
      <div class="card sim">
        <div class="cap">The battle <span class="ex">example</span></div>
        <div class="bvw"><div class="bv" id="bv"></div><div class="bvcards" id="bvcards"></div></div>
        <div class="cap" style="margin:6px 0 0">Who acts when: the same fight as a timeline</div>
        <div class="lanes" id="lanes"></div>
        <div class="simctl"><button class="btn cyan" id="simstep">Next blow</button><button class="btn" id="simplay">Play</button><button class="btn" id="simreset">Reset</button></div>
        <div class="simlog" id="simlog">Lower is better: a fighter with a low wind-up opens the fight, one with a low cooldown strikes often.</div>
      </div>
      <div class="card">
        <div class="cap">Element vs resistance</div>
        <div class="dmg">
          <div>
            <div class="slider"><label>Target's resistance to the blow's element <b id="resv">40%</b></label><input type="range" id="res" min="0" max="100" value="40"></div>
            <div class="dmgbar"><i class="hit" id="hit"></i><i class="blk" id="blk"></i><span><b id="dealt">60 dealt</b><b id="blocked">40 blocked</b></span></div>
          </div>
          <div style="text-align:center"><div class="big" id="dealtbig">60</div><small style="color:var(--faint)">of a 100 blow lands</small></div>
        </div>
        <div class="explain" id="resnote">Every blow comes in the attacker's element, and the target's resistance to that element cuts it. There's no element chart: resistances decide.</div>
      </div>
      <ul class="pts">
        <li>Each fighter picks targets by its own <b>targeting rule</b> (for example Highest Taunt or Lowest Health). <b>Taunt</b> draws enemy blows and drops each time the fighter is hit.</li>
        <li>On a tie in dungeons and arenas, <b>your side acts first</b>. The last team standing wins; a fight still going after 1,000 blows is a draw.</li>
        <li>Health and damage grow with <b>level</b> and fade with <b>age</b>. The land's <b>weather</b> can change stats for both teams.</li>
      </ul>
    </section>

    <!-- ======================= PLAY ======================= -->
    <div class="part">Play</div>

    <section class="ch" id="dungeons" data-icon="/markers/buildings/dungeon.svg">
      <div class="chhead"><h2><em>Dungeons</em></h2></div>
      <p class="lead">Pick a <b>difficulty</b>. Each dungeon can be <b>won once a day</b> (resets 00:00 UTC). A win gives XP and Reward Power; a loss gives nothing, and the energy is still spent.</p>
      <div class="card dg">
        <div class="dghead">
          <div class="dgname">Dungeon</div>
          <div class="dstep" id="dstep"></div>
        </div>
        <div class="dgfig">
          <div class="dgtile e"><small>Enemy strength</small><b id="dgE">×0.97</b><span>of their full health and damage</span></div>
          <div class="dgtile r"><small>Rewards</small><b id="dgR">×1.23</b><span>Reward Power for a win</span></div>
          <div class="dgtile x"><small>XP</small><b id="dgX">126</b><span>for a win <span class="today">today</span></span></div>
          <div class="dgchart"><svg id="dgchart" viewBox="0 0 300 92" preserveAspectRatio="none"></svg><p>Enemies grow <b>×1.15</b> a level, rewards only <em>×1.07</em>: climb as far as your team still wins.</p></div>
        </div>
        <div class="dgteam">
          <h5>The dungeon <span id="dgsub">fields five fighters at level 3</span></h5>
          <div class="dgrow" id="dgrow"></div>
        </div>
      </div>
      <div class="tip">Start with low difficulties: XP only comes from wins (and draws), and a loss still costs energy. From difficulty 5 a dungeon fields its own NFT fighter too.</div>
    </section>

    <section class="ch" id="arenas" data-icon="/markers/buildings/arena.svg">
      <div class="chhead"><h2><em>Arenas</em></h2></div>
      <p class="lead">Challenge the defenders other trainers left. You can't challenge an arena that holds any of your fighters. Win, and one of your five (picked at random) and your NFT fighter join its defence.</p>
      <div class="card ar">
        <div class="arhead">
          <div class="arname">Arena</div>
          <div class="arwins">Wins since yours joined <i id="arpips"></i><b id="arcount">0/5</b></div>
        </div>
        <div class="arteam">
          <h5>Defenders <span>the last five winners' fighters, and the latest winner's NFT fighter <span class="ex">example</span></span></h5>
          <div class="arow" id="arenaq"></div>
        </div>
        <div class="arctl"><button class="btn cyan" id="arenawin">Another trainer wins</button><button class="btn" id="arenareset">Reset</button><div class="simlog" id="arenalog"></div></div>
      </div>
    </section>

    <section class="ch" id="quests" data-icon="menu/quests.svg">
      <div class="chhead"><h2><em>Quests</em></h2></div>
      <p class="lead">Three <b>daily</b>, three <b>weekly</b> and three <b>monthly</b> quests. Finish one, claim it, and its <b>TLM</b> or <b>Shards</b> go straight to your wallet.</p>
      <div class="qscopes" id="qscopes"></div>
      <ul class="pts">
        <li>A claimed quest is replaced by a new one straight away.</li>
        <li>Don't like a quest? <b>Re-roll</b> it for credits.</li>
        <li>Each quest has its own deadline: it stays open until the end of the <b>next</b> day, week or month. If it runs out unfinished, it's gone.</li>
        <li>Without a Legend Pass, quest rewards are reduced.</li>
      </ul>
    </section>

    <section class="ch" id="tournament" data-icon="menu/tournament.svg">
      <div class="chhead"><h2>The <em>tournament</em></h2></div>
      <p class="lead">Once a week, trainers' best teams meet in a <b>knockout</b>. Enter once; the fights then play out by themselves while you watch.</p>
      <div class="card">
        <div class="cap">A tournament week <span class="today">today</span></div>
        <div class="tw" id="tw"></div>
        <div class="twnote" id="twnote"></div>
      </div>

      <div class="tgrid">
        <div class="card">
          <div class="cap">To enter</div>
          <div class="need">
            <div><i>1</i><span><b>Five fighters at level 10</b><small>Not busy anywhere else.</small><span class="five" id="tfive"></span></span></div>
            <div><i>2</i><span><b>A crew card and a weapon card</b><small>In your wallet: they make your NFT fighter.</small><span class="pair"><img src="%A%/cards/141566.webp" alt=""><img src="%A%/cards/19582.webp" alt=""></span></span></div>
            <div><i>3</i><span><b>100 energy</b> <span class="today">today</span><small>Paid when you sign up.</small></span></div>
          </div>
          <div class="warn">Entered fighters are <b>busy</b> until you're out, and an entry <b>can't be withdrawn</b>.</div>
        </div>
        <div class="card">
          <div class="cap">Your team score decides your seed</div>
          <div class="tscore" id="tscore"></div>
        </div>
      </div>

      <div class="card">
        <div class="cap">How the knockout runs <span class="ex">example</span></div>
        <div class="brk" id="brk"></div>
        <div class="brkrule">
          <span><i style="background:rgb(242 195 90 / 45%)"></i>Free pass: a top seed skips the opening round, and it counts as a win</span>
          <span><i style="background:rgb(25 211 197 / 50%)"></i>Winner, on to the next round</span>
          <span>Every round, the strongest left meets the weakest left</span>
        </div>
      </div>

      <div class="prz">
        <div class="card">
          <div class="cap"><img src="%A%/icons/wax-coin.webp" alt="" style="width:18px">WAX: the top 16 share the pot</div>
          <div class="wax" id="wax"></div>
          <div class="cap" style="margin:20px 0 0"><img src="%A%/icons/tlm.svg" alt="" style="width:18px">TLM: shared by points</div>
          <div class="tlm" id="tlmpts"></div>
        </div>
        <div class="card">
          <div class="cap"><img src="%A%/icons/trophy-gold.svg" alt="" style="width:18px">Hall of Fame</div>
          <div class="podium" id="podium"></div>
          <p style="margin:14px 0 0;font-size:13.5px;color:var(--dim)">The champion, the runner-up and the two beaten semi-finalists, who <b>share third</b>, are written into the Hall of Fame on the chain, for good.</p>
        </div>
      </div>
      <ul class="pts">
        <li>Prizes arrive in <b>Rewards</b>: claim them there.</li>
        <li>Without a Legend Pass, both prizes are <b>a tenth</b>.</li>
        <li>With fewer than two trainers signed up, the tournament is called off.</li>
      </ul>
    </section>

    <section class="ch" id="leaderboards" data-icon="menu/leaderboard.svg">
      <div class="chhead"><h2><em>Leaderboards</em></h2></div>
      <div class="grid2">
        <div class="tile"><h4><img src="%A%/markers/buildings/dungeon.svg" alt="">Dungeons</h4><p>A rating built by winning dungeons that fades a little each day. The top places can <b>claim a reward once a day</b> (UTC), paid in TLM and Shards; higher places get more.</p></div>
        <div class="tile"><h4><img src="%A%/markers/buildings/arena.svg" alt="">Arena</h4><p>Runs in <b>seasons</b>. You earn points while your fighters hold arenas, more for higher-rated arenas and for holding several. When a season ends the top places share its pot, credited to Rewards, and the board starts over.</p></div>
      </div>
      <div class="tip">Your profile also ranks every lifetime stat against other trainers, just for bragging rights.</div>
    </section>

    <!-- ======================= EARN ======================= -->
    <div class="part">Earn</div>

    <section class="ch" id="rewards" data-icon="menu/rewards.svg">
      <div class="chhead"><h2>Rewards &amp; <em>mining</em></h2></div>
      <p class="lead">Win fights to fill your <b>Reward Power</b> bar. Every full bar is one <b>mine</b>, and each mine pays you <b>TLM</b> and <b>Shards</b> from the prize pool, straight to your wallet.</p>

      <div class="rw-panel">
        <div class="rw-pool">
          <div>
            <div class="rw-label">Prize pool, past 7 days <span class="live" id="potlive">live</span></div>
            <div class="rw-big"><span><img src="%A%/icons/tlm.svg" alt=""><b id="inTlm">835,479</b><em>TLM</em></span><span><img src="%A%/icons/shards.svg" alt=""><b id="inShr">1,848,000</b><em>Shards</em></span></div>
          </div>
        </div>
        <div class="rw-mine">
          <table><thead><tr><th>One mine pays right now</th><th>TLM</th><th>Shards</th></tr></thead><tbody id="pools3"></tbody></table>
        </div>
      </div>

      <ol class="rw-steps">
        <li><b>Equip tools</b><span>Up to 3 Alien Worlds tools, in Rewards.</span></li>
        <li><b>Win fights</b><span>Each win fills your bar with Reward Power.</span></li>
        <li><b>Reach 100%</b><span>A full bar is one mine. Extra power carries over.</span></li>
        <li><b>Mine</b><span>Each mine pays 1% of that pool, to your wallet.</span></li>
      </ol>

      <div class="rw-panel rw-calc">
        <h4>How fast you fill the bar <span class="ex">example</span></h4>
        <p>A win is worth your three tools' mining power times the building's boost. Pick a set of Stone tools and a boost:</p>
        <div class="rw-tools" id="tools"></div>
        <div class="rw-boost"><span>Building boost</span><input type="range" id="bst" min="5" max="100" value="50"><b id="bstv">×5.0</b></div>
        <div class="rw-res" id="vsrow"></div>
        <p class="rw-pays" id="rwpays"></p>
        <div class="rw-leg"><img src="%A%/icons/account-legend.svg" alt=""><div><b>10× the Reward Power</b><span>Every win counts ten times as much, so you mine ten times as often. It also brings full quest and tournament prizes, free recruit reveals and a bigger daily flask.</span></div><a class="btn gold" href="#shop" data-shop="account">Get it in the Shop</a></div>
      </div>

      <ul class="rw-notes">
        <li>These are <b>arena</b> wins. A <b>dungeon</b> win starts lower and grows 7% with every difficulty level: around difficulty 10 it's worth about the same, and more above that.</li>
        <li><b>Arena Domination</b> fills from holding arenas: the longer your fighters defend, the more you earn.</li>
        <li>The pools are shared and refill every minute. Prizes from tournaments, leaderboards and your lands also collect in Rewards to claim.</li>
      </ul>
    </section>

    <section class="ch" id="farming" data-icon="menu/farming.svg">
      <div class="chhead"><h2><em>Farming</em></h2></div>
      <p class="lead">Put the Alien Worlds cards you're not using to work. Stake <b>tools</b>, <b>crew</b> and <b>weapons</b> in the farm, and claim <b>credits</b> from its three pools.</p>

      <div class="rw-panel">
        <div class="rw-mine" style="border-top:0">
          <table><thead><tr><th>Farming pools right now <span class="live" style="margin-left:6px;font:700 10px Orbitron;color:var(--faint)">● live</span></th><th>Credits</th></tr></thead><tbody id="fmpools"></tbody></table>
          <p class="rw-pays" style="margin-top:12px"><b>15% of every credit</b> anyone spends in the game flows into these pools, on top of a daily top-up.</p>
        </div>
      </div>

      <ol class="rw-steps">
        <li><b>Stake cards</b><span>Send tools, crew or weapons to the farm: 1 gem per card.</span></li>
        <li><b>Let it grow</b><span>Every day, your cards' weight adds to your share of each pool.</span></li>
        <li><b>Claim</b><span>One claim pays credits from all three pools at once.</span></li>
        <li><b>Unstake any time</b><span>Your cards come back to your wallet, no fee.</span></li>
      </ol>

      <div class="rw-panel rw-calc">
        <h4>What a claim pays <span class="ex">example</span></h4>
        <p>Rarity and shine decide a card's weight. Tap your card, then set how many and how long since your last claim:</p>
        <div class="fm-calc">
          <table class="fm-grid" id="fmgrid"></table>
          <div class="fm-ctl">
            <div class="seg" id="fmpool"><button data-p="crew" class="on">Crew</button><button data-p="tool">Tools</button><button data-p="arms">Weapons</button></div>
            <div class="rw-boost"><span>Cards</span><input type="range" id="fmn" min="1" max="30" value="5"><b id="fmnv">5</b></div>
            <div class="rw-boost"><span>Days since claim</span><input type="range" id="fmd" min="1" max="60" value="7"><b id="fmdv">7</b></div>
            <div class="fm-out" id="fmout"></div>
          </div>
        </div>
      </div>

      <ul class="rw-notes">
        <li>Your share grows with weight × days, up to <b>1% of a pool per claim</b>. Once you reach it, waiting longer adds nothing: claim and start again.</li>
        <li>Staking or unstaking claims what you've earned first, then starts your clock again.</li>
        <li><b>Abundant</b> cards can't be staked. The pools are shared, so a claim takes from the same balance everyone draws on.</li>
      </ul>
    </section>

    <section class="ch" id="candle" data-icon="menu/candle.svg">
      <div class="chhead"><h2><em>Candle</em></h2></div>
      <p class="lead">The Candle runs <b>missions</b>, each with a fixed prize in <b>WAX</b>, <b>TLM</b> or <b>Shards</b>. Put gems into a mission, and when it ends the prize is split by how many gems each trainer put in.</p>

      <div class="rw-panel">
        <div class="rw-mine" style="border-top:0;padding-bottom:6px"><div class="rw-label">Missions <span class="ex">example</span></div></div>
        <div class="cd-list" id="cdlist"></div>
      </div>

      <ol class="rw-steps">
        <li><b>Meet the requirement</b><span>Each mission asks for a lifetime stat, like distance travelled.</span></li>
        <li><b>Put gems in</b><span>As many as you like while it runs. Gems you put in are spent.</span></li>
        <li><b>Wait for it to end</b><span>A mission runs for one day.</span></li>
        <li><b>Collect</b><span>Shards arrive by themselves. WAX and TLM: claim them in the Candle.</span></li>
      </ol>

      <div class="rw-panel rw-calc">
        <h4>Your share <span class="ex">example</span></h4>
        <p>The prize never grows: every gem anyone adds makes each gem worth a little less.</p>
        <div class="cd-calc">
          <div>
            <div class="rw-boost"><span>Your gems</span><input type="range" id="cy" min="10" max="5000" step="10" value="500"><b id="cyv">500</b></div>
            <div class="rw-boost"><span>Everyone else's gems</span><input type="range" id="co" min="0" max="30000" step="100" value="12000"><b id="cov">12,000</b></div>
            <div class="cd-split"><u id="cdbar"></u></div>
            <p class="rw-pays" id="cdnote"></p>
          </div>
          <div class="cd-out"><small>You get</small><b id="cdshare"></b><span id="cdpct"></span></div>
        </div>
      </div>
    </section>

    <section class="ch" id="lands" data-icon="menu/lands.svg">
      <div class="chhead"><h2>My <em>Lands</em></h2></div>
      <p class="lead">Own an Alien Worlds <b>land</b>? Build a tavern, dungeon or arena on it. Every win other trainers get there mines <b>TLM</b> and <b>Shards</b> for you too.</p>

      <div class="rw-panel">
        <div class="rw-mine" style="border-top:0;padding-bottom:0"><div class="rw-label">On the map: the higher the boost, the grander the building</div></div>
        <div class="ld-ranks">
          <span>Boost</span>
          <div class="ld-lvl">up to ×2</div><div class="ld-lvl">up to ×4</div><div class="ld-lvl">up to ×6</div><div class="ld-lvl">up to ×8</div><div class="ld-lvl">over ×8</div>
          <span>Dungeon</span>
          <figure><img src="%A%/markers/buildings/dungeon-r1.svg" alt=""></figure><figure><img src="%A%/markers/buildings/dungeon-r2.svg" alt=""></figure><figure><img src="%A%/markers/buildings/dungeon-r3.svg" alt=""></figure><figure><img src="%A%/markers/buildings/dungeon-r4.svg" alt=""></figure><figure><img src="%A%/markers/buildings/dungeon-r5.svg" alt=""></figure>
          <span>Arena</span>
          <figure><img src="%A%/markers/buildings/arena-r1.svg" alt=""></figure><figure><img src="%A%/markers/buildings/arena-r2.svg" alt=""></figure><figure><img src="%A%/markers/buildings/arena-r3.svg" alt=""></figure><figure><img src="%A%/markers/buildings/arena-r4.svg" alt=""></figure><figure><img src="%A%/markers/buildings/arena-r5.svg" alt=""></figure>
        </div>
        <div class="ld-keys">
          <div><img class="hot" src="%A%/markers/buildings/arena-r5.svg" alt=""><span><b>Glowing</b>The arenas and dungeons with the highest boost right now.</span></div>
          <div><img src="%A%/markers/buildings/dungeon-r3-muted.svg" alt=""><span><b>Greyed out</b>A dungeon you already won today, or an arena your fighters hold.</span></div>
          <div><img src="%A%/markers/buildings/tavern.svg" alt=""><span><b>Taverns</b>Have no boost, so they always look the same.</span></div>
        </div>
      </div>

      <ol class="rw-steps">
        <li><b>Own a land</b><span>Any Alien Worlds land NFT in your wallet.</span></li>
        <li><b>Build</b><span>One tavern, dungeon or arena, paid in credits.</span></li>
        <li><b>Keep it boosted</b><span>Boost draws trainers and raises every reward there.</span></li>
        <li><b>Claim</b><span>Shards arrive by themselves; claim the TLM in My Lands.</span></li>
      </ol>

      <div class="rw-panel rw-calc">
        <h4>Building costs</h4>
        <p>Every building costs the same; rarer land takes a discount off it. Tap your land's rarity:</p>
        <div class="ld-cost" id="ldcost"></div>
      </div>

      <ul class="rw-notes">
        <li><b>Boost</b> runs from ×0 to ×10. A new building starts at <b>×3.5</b>. It fades a little every hour and with every reward mined there; at ×0 the building closes. Top it up with credits: each step up costs a bit more than the last.</li>
        <li>You choose how your share is split between <b>TLM and Shards</b>.</li>
        <li>Pulling a building down costs <b>1,000 gems</b> and pays out what it was holding.</li>
      </ul>
    </section>

    <!-- ======================= GROW & TRADE ======================= -->
    <div class="part">Grow &amp; trade</div>

    <section class="ch" id="upkeep" data-icon="credits.svg">
      <div class="chhead"><h2>Keep them <em>fighting</em></h2></div>
      <p class="lead">Fighters need a little care: pay them, level them up, and watch their age. Their card always shows what each one needs.</p>

      <div class="rw-panel">
        <div class="rw-mine" style="border-top:0;padding-bottom:0"><div class="rw-label">What a card tells you · tap one</div></div>
        <div class="kf-states" id="kfstates"></div>
        <div class="kf-what" id="kfwhat"></div>
      </div>

      <ol class="rw-steps">
        <li><b>Pay paydays</b><span>Every 30 days, up to 1,000 credits a fighter.</span></li>
        <li><b>Level up</b><span>When the XP strip is full: 999 credits, up to level 10.</span></li>
        <li><b>Watch their age</b><span>Strength fades as a fighter gets older.</span></li>
        <li><b>Sell back</b><span>Fighters you don't need, for credits.</span></li>
      </ol>

      <div class="rw-panel rw-calc">
        <h4>Payday</h4>
        <p>Paid in credits from My Fighters. Drag the dot along the timeline to see what happens as time passes:</p>
        <div class="kf-pay">
          <div id="kfpaycard"></div>
          <div>
            <div class="kf-line"><i style="left:0%">Paid</i><i style="left:25%">Payday due</i><i style="left:100%">Deleted</i><input type="range" id="kfd" min="0" max="120" value="12" aria-label="Days since the last payday"></div>
            <div class="kf-days"><b id="kfdv">12</b> days since the last payday</div>
            <div class="kf-out" id="kfout"></div>
          </div>
        </div>
      </div>

      <div class="rw-panel rw-calc">
        <h4>Level up</h4>
        <p>Wins and draws give XP. When the strip under the name is full, the card lights up green: level up in My Fighters.</p>
        <div class="kf-lvl">
          <div id="kflvcard"></div>
          <div class="rw-boost" style="margin:0"><span>Level</span><input type="range" id="lv" min="1" max="10" value="5"><b id="lvv">5</b></div>
          <div class="kf-big"><small>Health &amp; damage</small><b id="lvmul">×2.01</b><small id="lvex">a 100-damage roll hits for 201</small></div>
        </div>
      </div>

      <ul class="rw-notes">
        <li>Every win also brings the payday a little closer: about <b>3 hours</b> for a dungeon win, <b>6 hours</b> for an arena win.</li>
        <li>Paying early costs less, but only because less time has passed: the next payday is always 30 days later.</li>
        <li>A fighter that's <b>busy</b> (on the Market, defending an arena, in a tournament) can't be levelled, sold or picked for a fight until it's free.</li>
      </ul>
    </section>

    <section class="ch" id="ascension" data-icon="menu/ascension.svg">
      <div class="chhead"><h2><em>Ascension</em></h2></div>
      <p class="lead">Level 10 is the top, but your best fighters can still grow. Give up three fighters of the <b>same class</b> and your fighter gains an upgrade, for good. There's no limit: ascend it again and again.</p>

      <div class="rw-panel">
        <div class="as-top">
          <div class="as-hero" id="ashero"></div>
          <div class="as-socks" id="assocks"></div>
        </div>
        <div class="rw-mine" style="padding-bottom:0"><div class="rw-label">Your Arcanists · tap three to sacrifice <span class="ex">try it</span></div></div>
        <div class="as-roster" id="asroster"></div>
        <div class="as-act" id="asact"></div>
        <div class="as-offers" id="asoffers"></div>
      </div>

      <div class="as5" id="as5">
        <div>
          <h4>✦5 opens a <em>hidden ability</em></h4>
          <p>Every fighter carries a third ability it can't use yet. It stays <b>locked until its fifth ascension</b>, then fights alongside the other two in every battle, for good. This is the big reason to keep ascending.</p>
          <div class="as5-pips" id="as5pips"></div>
        </div>
        <div class="as5-ab" id="as5ab"></div>
      </div>

      <ol class="rw-steps">
        <li><b>Reach level 10</b><span>Only a fighter at the top level can ascend.</span></li>
        <li><b>Pick three sacrifices</b><span>Same class: one same race, one same element, one with the Sacrifice ability.</span></li>
        <li><b>Ascend</b><span>999 credits. The three are gone for good.</span></li>
        <li><b>Choose an upgrade</b><span>One of three random offers, or re-roll them for 499 credits.</span></li>
      </ol>

      <ul class="rw-notes">
        <li>Upgrades are small but permanent, and they stack: usually a main stat (damage, health, cooldown, wind-up or taunt), sometimes a resistance.</li>
        <li>Each ascension adds a <b>✦</b> to the card and <b>10 points</b> to your tournament team score.</li>
      </ul>
    </section>

    <section class="ch" id="market" data-icon="menu/market.svg">
      <div class="chhead"><h2><em>Market</em></h2></div>
      <p class="lead">Buy and sell fighters with other trainers, for <b>gems</b>. Every sale is a <b>48-hour auction</b>: the highest bid when the clock runs out wins.</p>

      <div class="rw-panel">
        <div class="rw-mine" style="border-top:0;padding-bottom:0"><div class="rw-label">An auction · bid, get outbid, drag the clock <span class="ex">try it</span></div></div>
        <div class="mk-auc">
          <div id="mkcard"></div>
          <div>
            <div class="mk-stats" id="mkstats"></div>
            <div class="mk-line" id="mkline"><span class="zone" id="mkzone"></span><span class="end" id="mkend"></span><span class="lbl" style="left:0">Listed</span><input type="range" id="mkt" min="0" max="72" value="20" aria-label="Hours since listing"></div>
          </div>
        </div>
        <div class="mk-act" id="mkact"></div>
      </div>

      <ol class="rw-steps">
        <li><b>List</b><span>An idle, paid-up fighter, from 10 gems. Listing costs 1 gem.</span></li>
        <li><b>Bids come in</b><span>Each bid beats the last by at least 10%.</span></li>
        <li><b>No sniping</b><span>A bid in the last 12 hours pushes the end to 12 hours later.</span></li>
        <li><b>Sold</b><span>The fighter goes to the top bidder; the seller gets the price minus 15%.</span></li>
      </ol>

      <div class="rw-panel rw-calc">
        <h4>Selling: what you get</h4>
        <p>Drag to the price your fighter sells for:</p>
        <div class="mk-sell">
          <div><div class="rw-boost"><span>Sells for</span><input type="range" id="mkp" min="10" max="1000" step="10" value="200"><b id="mkpv">200</b></div><p class="rw-pays" style="margin-top:14px">The 1-gem listing fee is paid when you list, sold or not. The 15% sale fee only comes off when it sells.</p></div>
          <div class="mk-bill" id="mkbill"></div>
        </div>
      </div>

      <ul class="rw-notes">
        <li>Your bid's gems are held while you're on top, and come straight back the moment someone outbids you. <b>My listings</b> shows the auctions you've been outbid on.</li>
        <li>A listing can be withdrawn until the first bid. The 1-gem listing fee isn't returned.</li>
        <li>No bids? Tick <b>Keep listed</b> and it stays up as a <b>Buy now</b> at your start price until the fighter's next payday.</li>
        <li>List up to 10 fighters at once.</li>
      </ul>
    </section>

    <section class="ch" id="shop" data-icon="menu/shop.svg">
      <div class="chhead"><h2>Shop &amp; <em>Legend Pass</em></h2></div>
      <p class="lead"><b>Gems</b> unlock everything premium: the Legend Pass, credits, Market bids and Candle missions. Buy them with <b>WAX</b>, then make every win count ten times as much with the <b>Legend Pass</b>.</p>

      <div class="lp" id="lp">
        <div class="lp-head"><img src="%A%/icons/account-legend.svg" alt=""><div><h3>Play as a Legend</h3><p>Every reward in the game, at full size. Without it you play as a Trial trainer, and most rewards are cut to a tenth.</p></div></div>
        <div class="lp-perks">
          <div><img src="%A%/icons/menu/rewards.svg" alt=""><div><b><em>10×</em> Reward Power</b><span>Every win mines ten times as much.</span></div></div>
          <div><img src="%A%/icons/menu/quests.svg" alt=""><div><b>Full quest rewards</b><span>Trial trainers get a tenth.</span></div></div>
          <div><img src="%A%/icons/menu/tournament.svg" alt=""><div><b>Full tournament prizes</b><span>WAX and TLM, not a tenth.</span></div></div>
          <div><img src="%A%/icons/energy.svg" alt=""><div><b><em>1,000</em> energy a day</b><span>The Legend flask, instead of 100.</span></div></div>
          <div><img src="%A%/markers/buildings/tavern.svg" alt=""><div><b>Free recruit reveals</b><span>When you arrive at your tavern.</span></div></div>
          <div><img src="%A%/icons/menu/account.svg" alt=""><div><b>Weekly CPU boost</b><span>So your actions don't fail.</span></div></div>
        </div>
        <div class="lp-plans" id="lpplans"></div>
        <div class="lp-foot"><span id="lpnote"></span><a class="btn gold" href="#shop" data-shop="account">Get it in the Shop</a></div>
      </div>

      <div class="rw-panel rw-calc">
        <h4>Trial or Legend</h4>
        <p>The same game, the same fights. What changes is how much you take home:</p>
        <table class="tv"><thead><tr><th></th><th>Trial</th><th class="l">Legend Pass</th></tr></thead><tbody>
          <tr><td>Reward Power per win</td><td>10%</td><td class="l">100%</td></tr>
          <tr><td>Quest rewards</td><td>10%</td><td class="l">100%</td></tr>
          <tr><td>Tournament prizes</td><td>10%</td><td class="l">100%</td></tr>
          <tr><td>Daily energy flask</td><td>100, only while under 2,000</td><td class="l">1,000</td></tr>
          <tr><td>Recruit reveal</td><td>Costs energy</td><td class="l">Free on arrival</td></tr>
          <tr><td>Weekly CPU boost</td><td>–</td><td class="l">Included</td></tr>
        </tbody></table>
      </div>

      <div class="rw-panel rw-calc">
        <h4>Gem packs</h4>
        <p>Paid in WAX. The bigger the pack, the more gems you get for each WAX:</p>
        <div class="gp" id="gempacks"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:14px"><a class="btn gold" href="#shop" data-shop="gems">Buy gems in the Shop</a></div>
      </div>

      <div class="sh-more">
        <div><h5><img src="%A%/icons/credits.svg" alt="">Credits</h5>Bought with gems, up to 69% more per gem in the big packs.<ul><li>3,500 credits <b>59 gems</b></li><li>40,000 credits <b>599 gems</b></li><li>500,000 credits <b>5,999 gems</b></li></ul></div>
        <div><h5><img src="%A%/icons/energy.svg" alt="">Energy</h5>Bought with credits, plus the free daily flask.<ul><li>300 energy <b>1,999 credits</b></li><li>1,500 energy <b>8,999 credits</b></li><li>10,000 energy <b>49,999 credits</b></li></ul></div>
        <div><h5><img src="%A%/icons/shards.svg" alt="">More in the Shop</h5><ul><li>AW Outpost <b>pay in Shards</b></li><li>NFT Market <b>Alien Worlds cards for WAX</b></li><li>Swap <b>TLM to WAX</b></li></ul></div>
      </div>
    </section>

    <!-- ======================= ACCOUNT ======================= -->
    <div class="part">Account</div>

    <section class="ch" id="account" data-icon="menu/account.svg">
      <div class="chhead"><h2>Your <em>account</em></h2></div>
      <p class="lead">Your trainer's home: how you look to others, how you sign, and the network power your actions need. Open it from your avatar.</p>

      <div class="rw-panel">
        <div class="ac-card"><img class="av" src="%A%/avatar/1101.webp" alt=""><div><b>Nova</b><span class="badge"><img src="%A%/icons/account-legend.svg" alt="">Legend</span></div></div>
        <div class="ac-tabs">
          <div><b>Avatar</b>Your look and trainer name.</div>
          <div><b>CPU</b>Free network power for your actions.</div>
          <div><b>Auto-sign</b>Play without wallet pop-ups.</div>
          <div><b>Stats</b>Every lifetime stat, and where you rank.</div>
        </div>
      </div>

      <div class="rw-panel rw-calc as-panel">
        <h4>Auto-sign: play without pop-ups</h4>
        <p>Normally your wallet asks you to approve every action. Turn on auto-sign once, and the everyday actions you choose sign themselves.</p>
        <div class="as-two">
          <div><h5>Can sign itself, if you choose</h5><div class="as-chips" id="aschips"></div></div>
          <div class="ask"><h5>Always asks your wallet</h5><ul><li>Sending WAX, TLM or NFTs</li><li>Buying gems or NFTs with WAX</li><li>Staking cards in the farm</li><li>Paying the sign-up fee</li></ul></div>
        </div>
        <div class="as-safe">
          <div><b>Your wallet stays safe</b>Auto-sign can never send WAX, TLM or NFTs. Buying with WAX or staking cards always asks.</div>
          <div><b>One approval to set up</b>Pick what to sign in Account › Auto-sign, then approve it once in your wallet.</div>
          <div><b>Yours to switch off</b>Change or remove it any time. Each browser or device sets up its own.</div>
        </div>
      </div>

      <div class="grid2" style="margin-top:22px">
        <div class="rw-panel rw-calc" style="margin-top:0">
          <h4>CPU: free with the Legend Pass</h4>
          <p>Every action uses a little of your wallet's network power (CPU). Run out and actions fail.</p>
          <div class="cpu"><div class="ring" style="--p:72"><span><b>18</b><small>of 25 left</small></span></div><div style="font-size:14px;color:var(--dim)">Legend trainers get <b style="color:#fff">25 free CPU top-ups a week</b>, paid by the game. They reset every <b style="color:#fff">Monday 00:00 UTC</b>.</div></div>
        </div>
        <div class="rw-panel rw-calc" style="margin-top:0">
          <h4>Avatars and your name</h4>
          <p>Unlock avatars by reaching milestones in your lifetime stats, like dungeons won, then wear any you've unlocked. Your trainer name is 4 to 12 characters.</p>
          <div class="avs"><span class="wear"><img src="%A%/avatar/1101.webp" alt=""></span><span><img src="%A%/avatar/1105.webp" alt=""></span><span><img src="%A%/avatar/1002.webp" alt=""></span><span class="lock"><img src="%A%/avatar/1004.webp" alt=""></span><span class="lock"><img src="%A%/avatar/1003.webp" alt=""></span></div>
        </div>
      </div>
    </section>

    <section class="ch" id="glossary" data-icon="question.svg">
      <div class="chhead"><h2><em>Glossary</em></h2></div>
      <p class="lead">Every word the game uses, in one line each. Tap one to jump to where the guide explains it.</p>
      <div class="gl-bar">
        <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="glq" type="search" placeholder="Find a word…" aria-label="Find a word"></div>
        <div class="gl-cats" id="glcats"></div>
      </div>
      <div class="gloss" id="gloss"></div>
    </section>
  </main>
</div>

</div>
`;function It(P,c){const X=P.querySelector(".gx"),B=[],G=new Set,aa=(a,e)=>{const t=window.setTimeout(()=>{G.delete(t),a()},e);return G.add(t),t},H=(a,e)=>{const t=window.setInterval(a,e);return G.add(t),t},N=a=>{G.delete(a),window.clearInterval(a)},I=(a,e,t)=>{window.addEventListener(a,e,t),B.push(()=>window.removeEventListener(a,e,t))};try{CSS.registerProperty({name:"--run",syntax:"<angle>",inherits:!1,initialValue:"0deg"})}catch{}X.addEventListener("click",a=>{const e=a.target.closest("[data-shop]");if(e){a.preventDefault(),window.location.hash="#/shop?c="+e.dataset.shop;return}const t=a.target.closest('a[href^="#"]');if(!t)return;a.preventDefault();const r=P.getElementById(t.getAttribute("href").slice(1));r&&r.scrollIntoView({behavior:"smooth",block:"start"})});const D=a=>`${c}/fighters/${a}.webp`,ie=a=>`${c}/fighter/classes/backgrounds/full/full_background_${a}.jpeg`,U=a=>`${c}/icons/elements/${a}.svg`,n=(a,e=P)=>e.querySelector(a),u=(a,e=P)=>[...e.querySelectorAll(a)],Ea=(a,e,t,r,i="")=>`<span class="gc ${i}"><span style="background-image:url('${ie(e)}')"><img class="art" src="${D(a)}" alt=""></span><i class="lv"><b>${t}</b></i><img class="el" src="${U(e)}" alt=""><span class="nm">${r||a.split("_")[0]}</span></span>`;for(const a of u("[data-f]")){const[e,t,r]=a.dataset.f.split(",");a.outerHTML=Ea(e,t,r,a.dataset.name,a.className.replace("gc","").trim())}const _a=[["/markers/buildings/tavern.svg","Recruit","at taverns","Reveal and hire alien fighters at your taverns on the map. Each has a class, a race, an element and abilities.","recruit"],[["/markers/buildings/dungeon.svg","/markers/buildings/arena.svg"],"Fight","dungeons & arenas","Send five fighters plus an NFT fighter into automatic fights. Wins earn XP and Reward Power.","dungeons"],["menu/rewards.svg","Mine","TLM & Shards","Bank 10,000 Reward Power and mine 1% of a pool, straight to your wallet.","rewards"],["menu/ascension.svg","Grow","level & ascend","Pay paydays, level fighters up to 10, ascend the best, trade the rest on the Market.","upkeep"],["menu/tournament.svg","Compete","tournaments & boards","Take your strongest team into tournaments and climb the leaderboards for TLM and WAX.","tournament"]],se=a=>`<img src="${c}${a[0]==="/"?"":"/icons/"}${a}" alt="">`;n("#loop").innerHTML=_a.map(([a,e,t],r)=>`${r?'<span class="arrow">→</span>':""}<button data-i="${r}">${Array.isArray(a)?`<span class="ics">${a.map(se).join("")}</span>`:se(a)}<b>${e}</b><small>${t}</small></button>`).join("");const oe=a=>{u("#loop button").forEach((e,t)=>e.classList.toggle("on",t===a)),n("#loopnote").innerHTML=`${_a[a][3]} <a href="#${_a[a][4]}" style="color:var(--cyan)">Read more ↓</a>`};n("#loop").addEventListener("click",a=>{const e=a.target.closest("button");e&&oe(+e.dataset.i)}),oe(0);const le=n("#toc");for(const a of n("#main").children){if(a.classList.contains("part")){le.insertAdjacentHTML("beforeend",`<h4>${a.textContent}</h4>`);continue}if(a.tagName!=="SECTION")continue;const e=a.querySelector("h2").textContent;le.insertAdjacentHTML("beforeend",`<a href="#${a.id}" data-id="${a.id}"><img src="${c+(a.dataset.icon[0]==="/"?"":"/icons/")+a.dataset.icon}" alt="">${e}</a>`)}const K=u("section.ch");let Ca=0;const de=()=>{let a=0;K.forEach((i,s)=>{!i.classList.contains("hide")&&i.getBoundingClientRect().top<180&&(a=s)}),Ca=a;const e=K[a]&&K[a].id;u(".toc a").forEach(i=>i.classList.toggle("on",i.dataset.id===e));const t=K[a];if(!t)return;n("#mnavtitle").textContent=t.querySelector("h2").textContent;let r=t.previousElementSibling;for(;r&&!r.classList.contains("part");)r=r.previousElementSibling;n("#mnavpart").textContent=r?r.textContent:"",n("#mnavprev").disabled=a===0,n("#mnavnext").disabled=a===K.length-1},pe=a=>{const e=K[Math.max(0,Math.min(K.length-1,a))];e&&e.scrollIntoView({behavior:"smooth",block:"start"})};n("#mnavprev").onclick=()=>pe(Ca-1),n("#mnavnext").onclick=()=>pe(Ca+1),n("#mnavopen").onclick=()=>n("#toc").classList.add("open"),n("#tocclose").onclick=()=>n("#toc").classList.remove("open"),n("#toc").addEventListener("click",a=>{a.target.closest("a")&&n("#toc").classList.remove("open")}),I("scroll",de,{passive:!0}),de();const Pa={Energy:["energy.svg","#4ee07a","Your action budget.",["Daily flask","Legend Pass flask","Shop (credits)"],["Travel","Recruits","Dungeons","Arenas","Tournaments"],"Claim the <b>free flask</b> in the Shop once a day (resets 00:00 UTC). With a <b>Legend Pass</b> the flask is much bigger."],Credits:["credits.svg","#f2c35a","The game's working money.",["Farming","Selling fighters back","Your lands","Shop (gems)"],["Paydays","Level-ups","Ascension","Re-rolls","Boosts","Energy"]],Gems:["gems.svg","#b48cff","Premium currency.",["Shop (WAX)","Market sales"],["Credits","Legend Pass","Market bids","The Candle"]],WAX:["wax-coin.webp","#f7b53b","The blockchain's own coin.",["Tournament prizes","Candle prizes","Swapping TLM"],["Sign-up","Gems","Alien Worlds NFTs"]],TLM:["tlm.svg","#e8c26a","Your main reward.",["Mining","Quests","Leaderboards","Tournaments","Candle","Your lands"],["Swap for WAX","Keep it: it's yours"]],Shards:["shards.svg","#d16bff","Alien Worlds shards.",["Mining","Quests","Candle","Your lands"],["AW Outpost in the Shop"]]},at=a=>`<button class="coin" role="tab" aria-selected="false" data-c="${a}" style="--c:${Pa[a][1]}"><span><img src="${c}/icons/${Pa[a][0]}" alt=""></span><b>${a}</b></button>`,ce=(a,e,t)=>`<div class="coingrp"><h5>${a}<small>${e}</small></h5><div>${t.map(at).join("")}</div></div>`;n("#coins").innerHTML=ce("In-game","to play with",["Energy","Credits","Gems"])+"<i></i>"+ce("Rewards","paid to your wallet",["TLM","Shards","WAX"]);let q=null;const et=a=>{if(q=q===a?null:a,u(".coin").forEach(l=>{const b=l.dataset.c===q;l.classList.toggle("on",b),l.setAttribute("aria-selected",b)}),n("#coinx").classList.toggle("open",!!q),n("#coinhint").classList.toggle("hide",!!q),!q)return;const[e,t,r,i,s,o]=Pa[q],p=l=>`<span class="chips">${l.map(b=>`<span>${b}</span>`).join("")}</span>`,d=n("#coinbox");d.style.setProperty("--c",t),d.innerHTML=`<h3><img src="${c}/icons/${e}" alt="">${q}</h3><p>${r}</p><div class="coinrow"><small>Get it</small>${p(i)}</div><div class="coinrow"><small>Spend it</small>${p(s)}</div>${o?`<div class="note">${o}</div>`:""}`};n("#coins").addEventListener("click",a=>{const e=a.target.closest(".coin");e&&et(e.dataset.c)});const tt=["eyeke","kavian","magor","naron","neri","veles"],nt=a=>`${c}/markers/buildings/${a}.svg`,Ha=[{k:"tavern",x:33,y:24,name:"Tavern",role:"Tavern",say:"Reveal and hire a recruit here."},{k:"dungeon",x:13,y:33,boost:"1.2x",name:"Mossfang Dungeon",role:"Dungeon",say:"Fight its team at a difficulty you pick."},{k:"arena",x:37,y:41,boost:"1.1x",name:"Rustpit Arena",role:"Arena",say:"Beat the team other trainers left here."},{k:"dungeon",x:59,y:36,boost:"3.8x",hot:1,name:"Ember Hollow",role:"Dungeon",say:"One of the highest boosts right now."},{k:"arena",x:80,y:24,boost:"5.7x",hot:1,name:"Sunspire Arena",role:"Arena",say:"The top boost on the map: the best rewards."},{k:"portal-veles",x:22,y:70,name:"Portal to Veles",role:"Portal",say:"Warp to Veles, onto the same spot.",portal:"veles"},{k:"dungeon",x:67,y:77,boost:"1.3x",name:"Tidewall Dungeon",role:"Dungeon",say:"Fight its team at a difficulty you pick."},{k:"tavern",x:31,y:82,name:"Tavern",role:"Tavern",say:"Reveal and hire a recruit here."}];let xa="eyeke",S={x:21,y:31},ea=null;const ta=n("#gmap");n("#gtabs").innerHTML=tt.map(a=>`<button data-p="${a}"><img src="${c}/landing/worldcard-${a}-360.webp" alt="">${a}</button>`).join("");const rt=a=>Math.round(5+Math.hypot((a.x-S.x)*.4,(a.y-S.y)*.2)),pa=()=>{ta.style.backgroundImage=`url('${c}/maps/${xa}.webp')`,u("#gtabs button").forEach(s=>s.classList.toggle("on",s.dataset.p===xa));const a=ea!==null?Ha[ea]:null,e=a&&a.x===S.x&&a.y===S.y,t=a&&!e?`<svg class="route" viewBox="0 0 100 100" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="M${S.x} ${S.y} Q${(S.x+a.x)/2} ${Math.min(S.y,a.y)-12} ${a.x} ${a.y}"/></svg>`:"",r=a?e?a.portal?'<button class="go" data-act="warp">Warp</button>':'<button class="go" data-act="enter">Enter</button>':`<button data-act="travel">Travel <img src="${c}/icons/energy.svg" alt="">${rt(a)}</button>`:"",i=a?`<div class="landcard" style="left:${Math.min(72,Math.max(24,a.x))}%;top:${a.y}%"><div><b>${a.name}</b><small>${a.role}${a.boost?" · "+a.boost:""}</small><span>${a.say}</span></div>${r}</div>`:"";ta.innerHTML=t+Ha.map((s,o)=>`<button class="mk${s.hot?" hot":""}${ea===o?" on":""}" data-i="${o}" style="left:${s.x}%;top:${s.y}%"><img src="${nt(s.k)}" alt="${s.role}">${s.boost?`<em>${s.boost}</em>`:""}</button>`).join("")+`<span class="gme" style="left:${S.x}%;top:${S.y}%"><b>YOU</b><i></i></span>`+i};ta.addEventListener("click",a=>{const e=a.target.closest("[data-act]");if(e){const r=Ha[ea];if(e.dataset.act==="travel"){S={x:r.x,y:r.y},pa();return}if(e.dataset.act==="warp"){xa=r.portal,ta.classList.remove("warp"),ta.offsetWidth,ta.classList.add("warp"),pa();return}if(e.dataset.act==="enter"){e.textContent="You're in!";return}}const t=a.target.closest(".mk");ea=t?+t.dataset.i===ea?null:+t.dataset.i:null,pa()}),n("#gtabs").addEventListener("click",a=>{const e=a.target.closest("button");e&&(xa=e.dataset.p,pa())}),pa();const W=[["rarity","Epic","An Epic card",30],["element","Fire","A Fire card",25],["race","Nordic","A Nordic card",20],["shine","Gold","A Gold-shine card",15]],Wa=[{id:141526,name:"Enhanced Reptiloid",rarity:"Epic",shine:"Gold",element:"Gem",race:"Reptiloid"},{id:141445,name:"Plasma Shield",rarity:"Common",shine:"Gold",element:"Fire"},{id:141546,name:"Wise Ancient One",rarity:"Rare",shine:"Stardust",element:"Air",race:"Nordic"},{id:141566,name:"Explosives Specialist",rarity:"Rare",shine:"Antimatter",element:"Fire",race:"Human"},{id:19642,name:"Storm Giant",rarity:"Legendary",shine:"Stone",element:"Neutral",race:"Nordic"},{id:19582,name:"Waxon Fire Sword",rarity:"Mythical",shine:"Stone",element:"Fire"},{id:48187,name:"Basic Trilium Detector",rarity:"Common",shine:"Stardust"}];let w=[];const Fa=a=>{const e=new Set(W.keys()),t=[];for(const r of a){const i=Wa.find(o=>o.id===r),s=[];for(const o of[...e])i[W[o][0]]===W[o][1]&&(s.push(o),e.delete(o));t.push(s)}return{per:t,met:new Set([...W.keys()].filter(r=>!e.has(r))),off:t.flat().reduce((r,i)=>r+W[i][3],0)}},V=a=>{const e=Fa(w),t=100-e.off,r=`<img src="${c}/icons/energy.svg" alt="">`;n("#tcost").innerHTML=r+t,n("#tprev").classList.toggle("hide",!e.off),n("#tpay").style.width=t+"%",n("#tcut").style.width=e.off+"%",n("#tslots").innerHTML=[0,1,2].map(i=>{const s=w[i];if(!s)return`<div class="tslot empty"><i>${i+1}</i>Pick a card below</div>`;const o=Wa.find(d=>d.id===s),p=e.per[i].reduce((d,l)=>d+W[l][3],0);return`<button class="tslot${p?" on":""}" data-id="${s}"><img src="${c}/cards/${s}.webp" alt=""><b>${o.name}</b>${p?`<em>−${p}</em>`:'<em class="no">no match</em>'}</button>`}).join(""),n("#wants").innerHTML=W.map(([,,i,s],o)=>`<span class="want${e.met.has(o)?" met":""}">${i}<em>−${s}</em></span>`).join(""),n("#nfts").innerHTML=Wa.map(i=>{const s=w.includes(i.id),o=s?e.per[w.indexOf(i.id)].reduce((l,b)=>l+W[b][3],0):Fa([...w,i.id]).off-e.off,p=[i.rarity,i.shine,i.element,i.race].filter(Boolean).join(" · "),d=W.some(([l,b])=>i[l]===b);return`<button class="nft${s?" picked":""}" data-id="${i.id}"><img src="${c}/cards/${i.id}.webp" alt=""><b>${i.name}</b><small>${p}</small>${o?`<em>−${o}</em>`:`<em class="no">${d?"already met":"no match"}</em>`}</button>`}).join(""),n("#thire").innerHTML=`Hire for ${r}${t}`,n("#hirenote").innerHTML=a||(w.length?e.off===90?"<b>Every objective met.</b> The hire costs <b>10 energy</b>, and all three cards stay in your wallet.":`<b>${e.off} energy off.</b> An objective counts once: a second card that meets it takes nothing more off.`:"Every hire starts at <b>100 energy</b>. Each card you show takes off the objectives it meets: one card can meet several.")};n("#nfts").addEventListener("click",a=>{const e=a.target.closest(".nft");if(!e)return;const t=+e.dataset.id;if(w.includes(t)){w=w.filter(r=>r!==t),V();return}if(w.length>=3){V("<b>The table is full.</b> A hire takes up to 3 cards: tap one on the table to take it back."),n(`.nft[data-id="${t}"]`).classList.add("shake");return}w=[...w,t],V()}),n("#tslots").addEventListener("click",a=>{const e=a.target.closest(".tslot[data-id]");e&&(w=w.filter(t=>t!==+e.dataset.id),V())}),n("#tbest").onclick=()=>{w=[141526,141566,141546],V("<b>Best pick:</b> the Reptiloid meets Epic and Gold at once, then Fire and Nordic. Every objective met for <b>10 energy</b>.")},n("#thire").onclick=()=>V(`<b>Hired!</b> The Lunatic joins your fighters for <b>${100-Fa(w).off} energy</b>. Your cards stay in your wallet.`),V();const ua={"gold-up":"#f2c35a","green-duble-up":"#4ee07a","green-up":"#4ee07a",middle:"#5d86d6","red-down":"#ff4d5e","red-duble-down":"#ff4d5e"},Ra={"gold-up":"Exceptional for its class","green-duble-up":"Very good for its class","green-up":"Good for its class",middle:"Average for its class","red-down":"Below average for its class","red-duble-down":"Poor for its class"},ge=[["damage","Damage","172","18",9,"green-duble-up"],["health","Health","126","11",3,"red-down"],["taunt","Taunt","22","5",3,null],["attackspeed","Cooldown","89","17",5,"middle"],["initiative","Wind-up","41","5",10,"gold-up"]],fe=[["gem",45,"middle"],["metal",36,"red-down"],["air",59,"green-up"],["fire",71,"green-duble-up"],["nature",23,"red-duble-down"],["neutral",47,"middle"]],it={gem:"#ff5fc8",metal:"#f2c35a",air:"#3fd8ff",fire:"#ff7a2e",nature:"#4ee07a",neutral:"#8f7bff"},va=a=>a[0].toUpperCase()+a.slice(1),st={intro:["Tap anything","Each part of the codex explains itself here. The coloured bars and arrows grade the fighter against others of <b>its own class</b>:"+('<div class="grades">'+Object.keys(ua).filter(a=>a!=="green-up").map(a=>`<span><i style="--g:${ua[a]}"></i><img src="${c}/icons/arrows/${a}.svg" alt="">${Ra[a]}</span>`).join("")+"</div>")],card:["The card","Its picture, its <b>level</b> in the diamond and its <b>element</b> in the corner. The same card shows up across the game."],kick:["Status","What the fighter is doing: <b>Ready</b>, or busy on the Market, in an arena, a dungeon or a tournament. It also says what it would <b>sell back</b> for in credits."],race:["Class, race & element","Set when it's recruited and never change. The <b>element</b> is the element of its blows."],level:["Level","Wins give XP; level up with credits. <b>10 is the max</b>. Each level makes health and damage stronger."],asc:["Ascended","How many times it has been <b>ascended</b>: each time it gained an upgrade you picked."],target:["Targeting","Which enemy it strikes. <b>Highest Taunt</b> goes after whoever draws the most attention."],score:["Score","Its <b>combat score</b>: damage and survival together, a quick way to compare fighters."],age:["Age","A <b>bonus or penalty</b> on health and damage. It shrinks over time and with every win, and can turn into a penalty."],payday:["Payday","Pay it in <b>credits</b> before the date. An overdue fighter can't fight or be sold, and is <b>deleted</b> if it stays unpaid."],ability:["Abilities","Special talents that trigger on their own in a fight. The ribbon shows its <b>rarity</b>; a <b>locked</b> one opens at a higher ascension level."]},ot={damage:"How hard each blow lands, before the target's resistance.",health:"How much it can take before it's knocked out.",taunt:"Draws enemy blows; drops a little each time the fighter is hit. A role, so it isn't graded.",attackspeed:"Time between its blows. <b>Lower is better.</b>",initiative:"How soon it strikes first. <b>Lower is better.</b>"},F=(a,e,t="")=>`<span class="cx ${t}" data-x="${a}">${e}</span>`;n("#codex").innerHTML=`
    <div class="cxhead">
      ${F("card",Ea("voidwarden_khaured","air",10,"Voidwarden"))}
      <div class="cxtitle">
        ${F("kick","Ready · sells for 888","cxkick")}
        <h3 class="cxname">Voidwarden</h3>
        ${F("race",`<img src="${U("air")}" alt="">Khaured · Air`,"cxrace")}
        <div class="cxchips">${F("level","Level 10 · max")}${F("asc","Ascended 2")}${F("target","◎ Highest Taunt")}</div>
      </div>
      <span class="cxscore cx" data-x="score"><b>84</b><small>SCORE</small></span>
    </div>
    <div class="cxup">${F("age",'Age <b class="neg">−1%</b>')}${F("payday","Next payday <b>11 Nov</b>")}${F("payday","Pay now <b>549</b>")}</div>
    <div class="cxsec">Stats</div>
    ${ge.map(([a,e,t,r,i,s])=>`<div class="cxstat cx" data-x="stat:${a}"><small><img src="${c}/icons/stats/${a}.svg" alt="">${e}</small><span class="cxseg" style="--g:${s?ua[s]:"#8d9bb8"}">${Array.from({length:10},(o,p)=>`<i class="${p<i?"f":""}"></i>`).join("")}</span><b>${t} <small>±${r}</small></b>${s?`<img src="${c}/icons/arrows/${s}.svg" alt="">`:"<i></i>"}</div>`).join("")}
    <div class="cxsec">Resistances</div>
    <div class="cxres">${fe.map(([a,e,t])=>`<span class="cx" data-x="res:${a}"><span class="hex" style="--ec:${it[a]}"><span><img src="${U(a)}" alt=""></span></span><b>${e}%<img class="g" src="${c}/icons/arrows/${t}.svg" alt=""></b></span>`).join("")}</div>
    <div class="cxsec">Abilities</div>
    <div class="cxab cx" data-x="ability" style="--r:#9aa4b8"><span class="rib"><i>Common</i></span><b>Void Damage</b><p>This fighter deals void damage, ignoring 67% of resistance when striking</p></div>
    <div class="cxab cx" data-x="ability" style="--r:#c9d3e6"><span class="rib"><i>Unique</i></span><b>Sacrifice</b><p>Needed for ascension of another fighter from the same class</p></div>
    <div class="cxab cx locked" data-x="ability" style="--r:#3fd8ff"><span class="rib"><i>Rare</i><i class="lock">Locked</i></span><span class="row"><b>Group Buff: Air Damage</b><em>Unlocks at ascension 5</em></span><p>Before combat, increases allied air damage by 6%</p></div>`;const be=a=>{let e,t;if(a.startsWith("stat:")){const[r,i,s,o,,p]=ge.find(d=>d[0]===a.slice(5));e=i,t=`${ot[r]} The fight rolls it fresh each time, within <b>${s} ±${o}</b>.${p?` This one is <b>${Ra[p].toLowerCase()}</b>.`:""}`}else if(a.startsWith("res:")){const[r,i,s]=fe.find(o=>o[0]===a.slice(4));e=va(r)+" resistance",t=`${va(r)} blows on this fighter lose <b>${i}%</b> of their damage (never more than 80%). That's <b>${Ra[s].toLowerCase()}</b>.`}else[e,t]=st[a];n("#cxwhat").innerHTML=`<small>${a==="intro"?"The codex":"What's this?"}</small><h4>${e}</h4><p>${t}</p>`,u("#codex .cx").forEach(r=>r.classList.toggle("on",r.dataset.x===a))};n("#codex").addEventListener("click",a=>{const e=a.target.closest(".cx");e&&be(e.dataset.x)}),be("intro");const lt={metal:"#d9e4ff",air:"#9fe6ff",nature:"#7dffb0",gem:"#c8b4ff",fire:"#ffb070",neutral:"#dfe3ee"},R=(a,e,t="")=>`<button class="rc ${t}" data-i="${e}" style="--ec:${lt[a.el]}"><span class="pic" style="background-image:url('${ie(a.el)}')"><img src="${D(a.art)}" alt=""></span><span class="lv"><b>${a.lv}</b></span>${a.asc?`<span class="asc">✦${a.asc}</span>`:""}<img class="el" src="${U(a.el)}" alt=""><span class="nm${a.art.split("_")[0].length>10?" long":""}">${a.art.split("_")[0]}</span><span class="xp"></span>${t.includes("picked")?'<span class="tag team">In team</span>':a.busy?`<span class="tag ${a.due?"payday":"market"}">${a.busy}</span>`:""}</button>`,dt={debuff:["Common","#9aa4b8","Group Debuff: Windup","Before combat, increases the windup of all opposing fighters by 3.0"],dmaster:["Common","#9aa4b8","Dungeon Master","Has 16.2 increased damage and 16.2 increased health in dungeons"],amaster:["Rare","#3fd8ff","Arena Master","Has 17.3 increased damage and 18.6 increased health in arenas",1],void:["Common","#9aa4b8","Void Damage","This fighter deals void damage, ignoring 67% of resistance when striking"],sac:["Unique","#c9d3e6","Sacrifice","Needed for ascension of another fighter from the same class"],airbuff:["Rare","#3fd8ff","Group Buff: Air Damage","Before combat, increases allied air damage by 6%",1]},ca=[{art:"voidwarden_khaured",el:"air",lv:10,asc:2,race:"Khaured",age:-1,tg:"Highest Taunt",st:[[41,8,2,"red-duble-down"],[185,24,2,"red-duble-down"],[84,5,6],[45,17,7,"green-up"],[46,5,7,"green-up"]],res:[[48,"middle"],[30,"red-down"],[59,"green-up"],[71,"green-duble-up"],[47,"middle"],[45,"green-up"]],ab:["void","sac","airbuff"]},{art:"voidcaller_elgem",el:"nature",lv:10,asc:1,race:"Elgem",age:69,tg:"Highest Taunt",st:[[92,20,4,"red-down"],[93,45,4,"red-down"],[30,6,5],[54,10,5,"middle"],[76,15,5,"middle"]],res:[[21,"red-down"],[41,"green-up"],[43,"green-up"],[31,"middle"],[36,"middle"],[43,"green-duble-up"]],ab:["debuff","dmaster","amaster"]},{art:"lunatic_human",el:"air",lv:10,asc:3,race:"Human",age:57,tg:"Lowest Health",st:[[188,21,9,"green-duble-up"],[96,12,4,"red-down"],[18,3,2],[52,9,6,"green-up"],[38,6,8,"green-up"]],res:[[33,"middle"],[41,"middle"],[62,"green-up"],[29,"red-down"],[38,"middle"],[40,"middle"]],ab:["dmaster","void","amaster"]},{art:"astralknight_lopati",el:"metal",lv:9,asc:0,race:"Lopati",age:24,tg:"Highest Damage",st:[[121,14,6,"middle"],[240,30,8,"green-duble-up"],[96,8,8],[70,11,4,"red-down"],[61,9,5,"middle"]],res:[[52,"green-up"],[64,"green-duble-up"],[35,"middle"],[40,"middle"],[28,"red-down"],[44,"middle"]],ab:["sac","dmaster","airbuff"]},{art:"hunter_elgem",el:"nature",lv:8,asc:0,race:"Elgem",age:41,tg:"Lowest Health",st:[[150,16,7,"green-up"],[118,13,5,"middle"],[25,4,3],[48,8,7,"green-up"],[44,7,7,"green-up"]],res:[[36,"middle"],[31,"red-down"],[44,"middle"],[37,"middle"],[58,"green-up"],[39,"middle"]],ab:["amaster","void","debuff"]},{art:"mystic_altan",el:"air",lv:7,asc:0,race:"Altan",age:12,tg:"Highest Taunt",st:[[172,18,9,"green-duble-up"],[126,11,5,"middle"],[22,5,3],[89,17,5,"middle"],[41,5,10,"gold-up"]],res:[[45,"middle"],[36,"red-down"],[59,"green-up"],[71,"green-duble-up"],[23,"red-duble-down"],[47,"middle"]],ab:["debuff","sac","airbuff"]},{art:"tactician_elgem",el:"gem",lv:9,asc:1,race:"Elgem",age:30,tg:"Highest Damage",busy:"Market",st:[[110,12,5,"middle"],[150,18,6,"green-up"],[40,6,5],[60,10,5,"middle"],[55,8,6,"middle"]],res:[[60,"green-up"],[35,"middle"],[40,"middle"],[33,"middle"],[41,"middle"],[38,"middle"]],ab:["dmaster","sac","amaster"]},{art:"desperado_human",el:"neutral",lv:6,asc:0,race:"Human",age:-8,tg:"Lowest Health",busy:"Payday",due:1,st:[[133,15,6,"green-up"],[102,12,4,"red-down"],[20,3,2],[58,9,6,"middle"],[50,7,6,"middle"]],res:[[30,"red-down"],[38,"middle"],[36,"middle"],[42,"middle"],[35,"middle"],[55,"green-up"]],ab:["amaster","void","debuff"]},{art:"juggernaut_khaured",el:"metal",lv:8,asc:0,race:"Khaured",age:35,tg:"Highest Taunt",st:[[98,11,4,"red-down"],[260,28,9,"green-duble-up"],[110,9,9],[75,12,4,"red-down"],[66,9,4,"middle"]],res:[[55,"green-up"],[66,"green-duble-up"],[33,"middle"],[45,"middle"],[30,"red-down"],[40,"middle"]],ab:["sac","dmaster","amaster"]}],me=[["damage","Damage"],["health","Health"],["taunt","Taunt"],["attackspeed","Cooldown"],["initiative","Wind-up"]],he=["gem","metal","air","fire","nature","neutral"];let y=[];const _=document.createElement("div");_.className="hovc hide",X.append(_);const xe=(a,e)=>`<i style="--g:${e?ua[e]:"#8d9bb8"}">${Array.from({length:12},(t,r)=>`<u class="${r<Math.round(a*1.2)?"f":""}"></u>`).join("")}</i>`,pt=a=>`<h4>${a.art.split("_")[0]}</h4>
    <div class="ln"><img src="${U(a.el)}" alt="">${a.race} · ${va(a.el)}<span>Level ${a.lv}</span><span class="${a.age>=0?"g":""}">Age ${a.age>=0?"+":"−"}${Math.abs(a.age)}%</span></div>
    <div class="cols"><div>${a.st.map(([e,t,r,i],s)=>`<div class="r"><em><img src="${c}/icons/stats/${me[s][0]}.svg" alt="">${me[s][1]}</em>${xe(r,i)}<b>${e} <small>±${t}</small></b>${i?`<img src="${c}/icons/arrows/${i}.svg" alt="">`:"<span></span>"}</div>`).join("")}</div>
    <div>${a.res.map(([e,t],r)=>`<div class="r"><em><img src="${U(he[r])}" alt="">${he[r]}</em>${xe(e/10,t)}<b>${e}%</b><img src="${c}/icons/arrows/${t}.svg" alt=""></div>`).join("")}</div></div>
    <div class="tg">◎ Targets <b>${a.tg}</b></div>
    <div class="abs">${a.ab.map((e,t)=>{const[r,i,s,o,p]=dt[e];return`<div class="ab${t===2?" wide":""}" style="--r:${i}"><span class="rib"><i>${r}</i>${p?'<i class="lock">Locked</i>':""}</span><b>${s}</b>${o}</div>`}).join("")}</div>`,na=a=>{n("#tmgrid").innerHTML=ca.map((e,t)=>R(e,t,`${y.includes(t)?"picked":""} ${e.busy?"busy":""} ${e.due?"due":""}`)).join(""),n("#tmslots").innerHTML=[0,1,2,3,4].map(e=>y[e]!==void 0?`<span class="tmslot full">${R(ca[y[e]],y[e],"slotted")}</span>`:`<span class="tmslot">Fighter ${e+1}</span>`).join("")+`<span class="tmslot nft"><span><img src="${c}/cards/141566.webp" alt="">Crew</span><span><img src="${c}/cards/19582.webp" alt="">Weapon</span></span>`,n("#tmmini").innerHTML=[0,1,2,3,4].map(e=>y[e]!==void 0?`<i style="background-image:url('${D(ca[y[e]].art)}')"></i>`:"<i></i>").join(""),n("#tmcount").textContent=`${y.length}/5`,n("#tmbar").textContent=`Your team · ${y.length}/5`,n("#tmgo").disabled=y.length<5,n("#tmnote").innerHTML=a||(y.length===5?"<b>Ready:</b> five fighters and the NFT fighter.":"")},ue=a=>{const e=ca[a];if(y.includes(a)){y=y.filter(t=>t!==a),na();return}if(e.busy){na(`<b>${va(e.art.split("_")[0])} can't fight:</b> ${e.due?"its payday is overdue. Pay it in My Fighters first.":"it's listed on the Market."}`),n(`#tmgrid .rc[data-i="${a}"]`).classList.add("shake");return}if(y.length>=5){na("<b>The team is full.</b> Tap a fighter in it to take it out.");return}y=[...y,a],na()};if(n("#tmgrid").addEventListener("click",a=>{const e=a.target.closest(".rc");e&&ue(+e.dataset.i)}),n("#tmslots").addEventListener("click",a=>{const e=a.target.closest(".rc");e&&ue(+e.dataset.i)}),n("#tmgo").onclick=()=>na("<b>Off they go!</b> The fight runs by itself; next, see how it plays."),matchMedia("(hover: hover) and (pointer: fine)").matches){let a=null;n("#tmgrid").addEventListener("pointerover",e=>{const t=e.target.closest(".rc");t&&(clearTimeout(a),a=aa(()=>{_.innerHTML=pt(ca[+t.dataset.i]),_.classList.remove("hide");const r=t.getBoundingClientRect(),i=_.offsetWidth,s=_.offsetHeight;let o=r.bottom+8;o+s>innerHeight-16&&(o=Math.max(16,r.top-8-s)),_.style.top=o+"px",_.style.left=Math.max(16,Math.min(innerWidth-16-i,r.left+r.width/2-i/2))+"px"},250))}),n("#tmgrid").addEventListener("pointerout",e=>{(!e.relatedTarget||!e.relatedTarget.closest||e.relatedTarget.closest(".rc")!==e.target.closest(".rc"))&&(clearTimeout(a),_.classList.add("hide"))}),I("scroll",()=>_.classList.add("hide"),{passive:!0})}na();const x=[["Your Hunter","hunter_elgem","me",40,60,150,30,8,"nature",[22,82]],["Your Juggernaut","juggernaut_khaured","me",70,110,220,25,8,"metal",[36,68]],["Enemy Mystic","mystic_altan","them",55,90,200,35,9,"air",[74,76]]],k=[];x.forEach(([a,e,t,r,i],s)=>{for(let o=r;o<=400;o+=i)k.push({t:o,k:s})}),k.sort((a,e)=>a.t-e.t||(x[a.k][2]==="me"?-1:1));const ra=[x.map(a=>a[5]).slice()];for(const a of k){const e=ra[ra.length-1].slice();if(a.target=x[a.k][2]==="me"?2:1,e[a.target]=Math.max(0,e[a.target]-x[a.k][6]),ra.push(e),e[2]===0||e[0]===0&&e[1]===0)break}k.length=ra.length-1,k.forEach((a,e)=>a.n=e+1);const ve=k[k.length-1].t+20;n("#lanes").innerHTML=x.map(([a,e,t,r,i],s)=>`<div class="lane"><span class="who ${t}"><img src="${D(e)}" alt="">${a}<br><small style="color:var(--faint);font-weight:600">wind-up ${r} · cooldown ${i}</small></span><div class="track" data-k="${s}">${k.filter(o=>o.k===s).map(o=>`<i class="${t}" data-n="${o.n}" style="left:${o.t/ve*100}%">${o.n}</i>`).join("")}${s===0?'<span class="clock" id="clock" style="left:0"></span>':""}</div></div>`).join("");const ct={hunter:"pierce",juggernaut:"thunderclap",mystic:"moonbeam"},gt={pierce:4,thunderclap:6,moonbeam:4},ft={pierce:1.8,thunderclap:1.8,moonbeam:1},Na={back:`${c}/stages/planets/eyeke/backdrop-wide.webp`,floor:`${c}/stages/lands/grassland/floor.webp`,ground:`${c}/stages/lands/grassland/ground-wide.webp`},bt=()=>{const a=ra[$],e=k[$-1],t=ra[Math.max(0,$-1)],r=d=>x.map((l,b)=>[l,b]).filter(([l])=>l[2]===d),i=d=>r(d).reduce((l,[b,m])=>l+a[m],0)/r(d).reduce((l,[b])=>l+b[5],0),s=d=>r(d).filter(([,l])=>a[l]>0).length+"/"+r(d).length,o=d=>d.split("_")[0];let p="";if(e){const[d,l]=x[e.k][9],[b,m]=x[e.target][9],O=ct[o(x[e.k][1])];p=`<span class="bfx bfx--${O}" style="--ax:${d};--ay:${l};--tx:${b};--ty:${m};--da:1;--dt:1;--dir:${x[e.k][2]==="me"?1:-1}">${"<i></i>".repeat(gt[O])}</span>`,n("#bv").style.setProperty("--shake",ft[O])}n("#bv").classList.remove("shake"),n("#bv").offsetWidth,n("#bv").classList.toggle("shake",!!e),n("#bv").innerHTML=`<img class="bk" src="${Na.back}" alt=""><div class="fw"><i style="background-image:url('${Na.floor}')"></i></div><img class="gd" src="${Na.ground}" alt=""><div class="grade"></div><div class="bvtop"><span class="side me">You ${s("me")}<i><u style="width:${i("me")*100}%"></u></i></span><span class="mid">${e?"Blow "+e.n:"Ready"}</span><span class="side them">Dungeon ${s("them")}<i><u style="width:${i("them")*100}%"></u></i></span></div>`+x.map(([d,l,b,,,m,O,v,Wt,[Ft,Rt]],M)=>{const Nt=e&&e.k===M,Ke=e&&e.target===M&&a[M]>0,Dt=e?o(x[e.k][1]):"",Za=e&&e.target===M&&a[M]===0&&t[M]>0,ae=a[M]===0,Ve=ja=>(ja/m).toFixed(3),qt=ja=>ja/m>.5?"high":ja/m>.25?"mid":"low",Qe=`<img class="art" src="${D(l)}" alt="">`,Yt=ae?`<span class="fallen">${Qe}</span><span class="dust"></span>`:`<span class="rig"><img class="art legs" src="${D(l)}" alt=""><span class="torso">${Qe}</span></span>${Ke?'<span class="flash"></span>':""}`,ee=e&&e.target===M,te=ee?x[e.k][6]:0,Xt=ee?Za?`<span class="pop kill">${te}<small>Knocked out</small></span>`:`<span class="pop${te>=m*.3?" big":""}">${te}</span>`:"";return`<span class="bu ${b} c-${o(l)}${Nt?" atk":""}${Ke?" def t-"+Dt:""}${ae?" dead":""}" style="left:${Ft}%;top:${Rt}%;--idl:${(-(M*.83)%2.4).toFixed(2)}s;--kod:${Za?"var(--impact)":"0s"}"><span class="plat"></span><span class="fig"><span class="body">${Yt}</span>${ee&&(!ae||Za)?'<span class="ret"><i></i><i></i><i></i><i></i></span>':""}${Xt}</span><span class="over"><span class="plate"><img src="${U(Wt)}" alt="">Lv.${v}</span><span class="hpbar" data-band="${qt(a[M])}" style="--from:${Ve(t[M])};--to:${Ve(a[M])}"><i></i><u></u></span></span></span>`}).join("")+p+($===k.length?'<div class="bvend" style="animation-delay:2.2s">Victory<small>The Mystic is down: XP and Reward Power for your team.</small></div>':""),n("#bvcards").innerHTML=x.map(([d,l,b,,,,,m,O],v)=>(v===2?'<span class="vs">VS</span>':"")+Ea(l,O,m,o(l),`${b}${a[v]===0?" ko":""}${e&&e.k===v?" act":""}`).replace(/<\/span><\/span>$/,"</span>"+(e&&e.k===v?'<i class="rib a">ACTING</i>':e&&e.target===v?'<i class="rib t">TARGET</i>':"")+"</span>")).join("")};let $=0,Y=null;const wa=()=>{u(".track i").forEach(e=>{const t=+e.dataset.n;e.classList.toggle("done",t<$),e.classList.toggle("now",t===$)});const a=k[$-1];n("#clock").style.left=a?`${a.t/ve*100}%`:"0",n("#simlog").innerHTML=a?`Blow <b>${a.n}</b>: <b>${x[a.k][0]}</b> has the lowest wind-up (${a.t}), strikes ${x[a.target][0].replace(/^(Your|Enemy) /,"the ")} for ${x[a.k][6]}, and its wind-up grows by its cooldown (${x[a.k][4]}) to ${a.t+x[a.k][4]}.${$===k.length?" <b>The Mystic is knocked out: you win.</b>":""}`:"Lower is better: a fighter with a low wind-up opens the fight, one with a low cooldown strikes often.",n("#simstep").disabled=$>=k.length,bt()};n("#simstep").onclick=()=>{$=Math.min(k.length,$+1),wa()},n("#simreset").onclick=()=>{N(Y),Y=null,n("#simplay").textContent="Play",$=0,wa()},n("#simplay").onclick=()=>{if(Y){N(Y),Y=null,n("#simplay").textContent="Play";return}$>=k.length&&($=0),n("#simplay").textContent="Pause",Y=H(()=>{$++,wa(),$>=k.length&&(N(Y),Y=null,n("#simplay").textContent="Play")},1700)},wa();const we=()=>{const a=+n("#res").value,e=Math.min(a,80),t=100-e;n("#resv").textContent=a+"%",n("#hit").style.width=t+"%",n("#blk").style.left=t+"%",n("#blk").style.width=e+"%",n("#dealt").textContent=t+" dealt",n("#blocked").textContent=e+" blocked",n("#dealtbig").textContent=t,n("#resnote").innerHTML=a>80?`<b>Capped:</b> resistance never blocks more than 80%, so even a ${a}% resistance lets 20 of every 100 through.`:"Every blow comes in the attacker's element, and the target's resistance to that element cuts it. There's no element chart: resistances decide."};n("#res").oninput=we,we();const T={first:1,last:20,nft:5,held:{1:55,2:70,3:85},xp:42},ga=a=>Math.pow(1.15,a)*((T.held[a]??100)/100),ya=a=>Math.pow(1.07,a),mt=[["hunter_robotron","metal"],["lunatic_khaured","fire"],["mindblade_onoros","gem"],["voidwarden_khaured","nature"],["explosioneer_lopati","fire"]];let z=3,Da=!1;const ht=()=>{const a=r=>(r-1)/19*300,e=r=>88-r/ga(20)*82,t=r=>Array.from({length:20},(i,s)=>`${s?"L":"M"}${a(s+1).toFixed(1)} ${e(r(s+1)).toFixed(1)}`).join(" ");n("#dgchart").innerHTML=`<line x1="0" y1="88" x2="300" y2="88" stroke="rgb(255 255 255 / 15%)"/><line x1="${a(T.nft)}" y1="4" x2="${a(T.nft)}" y2="88" stroke="#c9a0ff" stroke-dasharray="3 3" opacity=".6"/><path d="${t(ga)}" fill="none" stroke="#ff6a5c" stroke-width="2.5" vector-effect="non-scaling-stroke"/><path d="${t(ya)}" fill="none" stroke="#ffe9a6" stroke-width="2.5" vector-effect="non-scaling-stroke"/><line x1="${a(z)}" y1="0" x2="${a(z)}" y2="88" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity=".8"/><circle cx="${a(z)}" cy="${e(ga(z))}" r="4" fill="#ff6a5c" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/><circle cx="${a(z)}" cy="${e(ya(z))}" r="4" fill="#ffe9a6" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`},ye=()=>{const a=z;n("#dstep").innerHTML=`<button class="dstep__arrow" data-go="-1" ${a<=T.first?"disabled":""} aria-label="Lower difficulty">‹</button><span class="dstep__value">${a}</span><button class="dstep__arrow" data-go="1" ${a>=T.last?"disabled":""} aria-label="Higher difficulty">›</button>
      <div class="dstep__side"><span class="dstep__tally"><span class="dstep__label">Difficulty</span>Enemy <b>×${ga(a).toFixed(2)}</b> · Rewards <b>×${ya(a).toFixed(2)}</b> · <b>${T.xp*a} XP</b></span>
      <div class="dstep__ticks" id="dticks">${Array.from({length:T.last},(e,t)=>t+1).map(e=>`<button class="dstep__tick${e<=a?" dstep__tick--lit":""}${e===a?" on":""}${e===T.nft?" dstep__tick--nft":""}" data-d="${e}" title="${e===T.nft?`Difficulty ${e}: the dungeon's own NFT fighter joins from here`:`Difficulty ${e}`}" aria-label="Difficulty ${e}"></button>`).join("")}</div></div>`,n("#dgE").textContent="×"+ga(a).toFixed(2),n("#dgR").textContent="×"+ya(a).toFixed(2),n("#dgX").textContent=T.xp*a,ht(),u("#dgrow .rc .lv b").forEach(e=>e.textContent=a),n("#dgnft").classList.toggle("in",a>=T.nft),n("#dgsub").textContent=a>=T.nft?`fields five fighters at level ${a}, and its own NFT fighter`:`fields five fighters at level ${a}; its NFT fighter joins at ${T.nft}`};n("#dgrow").innerHTML=mt.map(([a,e],t)=>R({art:a,el:e,lv:z},t)).join("")+`<div class="dgnft" id="dgnft"><span class="ghost">NFT fighter<small>joins at difficulty ${T.nft}</small></span><span class="card"><i>NFT fighter</i><span style="background-image:url('${c}/cards/19642.webp')"></span><b>NFT fighter</b></span></div>`;const qa=a=>{a=Math.max(T.first,Math.min(T.last,a)),a!==z&&(z=a,ye())},ke=a=>{let e=z,t=1/0;return u("#dticks .dstep__tick").forEach(r=>{const i=r.getBoundingClientRect(),s=Math.abs(a-(i.left+i.width/2));s<t&&(t=s,e=+r.dataset.d)}),e};n("#dstep").addEventListener("click",a=>{const e=a.target.closest("[data-go]");e&&qa(z+ +e.dataset.go)}),n("#dstep").addEventListener("pointerdown",a=>{!a.target.closest("#dticks")||a.button!==0||(Da=!0,a.target.closest("#dticks").setPointerCapture?.(a.pointerId),qa(ke(a.clientX)))}),n("#dstep").addEventListener("pointermove",a=>{Da&&qa(ke(a.clientX))}),I("pointerup",()=>Da=!1),ye();const xt=[["voidcaller_onoros","neutral","Nova"],["hunter_altan","neutral","Kael"],["astralknight_human","nature","Ivy"],["tactician_elgem","gem","Rook"],["mystic_altan","air","You",1]],fa=[["lunatic_human","fire","Vex"],["mindblade_lopati","air","Zed"],["desperado_khaured","metal","Orin"],["juggernaut_onoros","metal","Lyra"],["voidwarden_human","gem","Moss"]],ut=["19642","141566","141546","141526","254355","141566"];let Q=[],j=0;const vt=([a,e,t,r],i,s="")=>`<div class="acell${r?" you":""}${s}">${R({art:a,el:e,lv:10},i).replace("</button>",r?'<span class="tag yours">Yours</span></button>':"</button>")}<small>${r?"Your fighter":t}</small></div>`,$e=a=>{n("#arenaq").innerHTML=Q.map((t,r)=>vt(t,r,a==="arrive"&&r===Q.length-1?" arrive":"")).join("")+`<div class="acell"><div class="dgnft in${a==="arrive"?" flip":""}"><span class="card"><i>NFT fighter</i><span style="background-image:url('${c}/cards/${ut[j]}.webp')"></span><b>NFT fighter</b></span></div><small>${j?fa[j-1][2]+"'s":"Yours"}</small></div>`;const e=Q.some(t=>t[3]);n("#arpips").innerHTML=Array.from({length:5},(t,r)=>`<u class="${r<j?"on":""}"></u>`).join(""),n("#arcount").textContent=e?`${j}/5`:"free"},Te=()=>{Q=xt.slice(),j=0,$e(),n("#arenawin").disabled=!1,n("#arenalog").innerHTML="<b>You just won here:</b> one of your five (picked at random) joined the defence, ringed teal, and your NFT fighter holds the last place."};n("#arenawin").onclick=()=>{j>=fa.length||(n("#arenaq").firstElementChild.classList.add("leave"),n("#arenawin").disabled=!0,aa(()=>{Q=[...Q.slice(1),fa[j++]],$e("arrive");const a=Q.some(e=>e[3]);n("#arenalog").innerHTML=a?`<b>${fa[j-1][2]} won.</b> The oldest defender left, one of theirs joined, and their NFT fighter took the last place. Yours is still defending.`:`<b>${j} wins later your fighter has left the defence</b> and is free again. While it held the arena it earned you Arena Domination points.`,n("#arenawin").disabled=j>=fa.length},380))},n("#arenareset").onclick=Te,Te();const wt=[["Daily","new each day",[["dungeons_won_day","Win 3 dungeons","2 / 3",66,"0.5 TLM","1 day left"],["damage_dealt_day","Deal 5,000 damage","Done: claim it",100,"20 Shards","18 h left"]]],["Weekly","new each Thursday",[["arenas_won_week","Win 5 arenas","1 / 5",20,"2 TLM","10 days left"],["ascensions_completed_week","Ascend a fighter","0 / 1",0,"120 Shards","3 days left"]]],["Monthly","new on the 1st",[["arenas_won_month","Win 40 arenas","12 / 40",30,"10 TLM","60 days left"],["damage_blocked_month","Block 50,000 damage","18,400 / 50,000",37,"600 Shards","29 days left"]]]];n("#qscopes").innerHTML=wt.map(([a,e,t])=>`<div class="q"><h5>${a}<small>${e}</small></h5>${t.map(([r,i,s,o,p,d])=>`<div class="qi"><img src="${c}/quests/${r}.webp" alt=""><span><b>${i}</b><small>${s} · ${p} · <em>${d}</em></small><span class="qprog"><i style="width:${o}%"></i></span></span></div>`).join("")}</div>`).join("")+'<p style="grid-column:1/-1;margin:0;font-size:12.5px;color:var(--faint)">Example quests and rewards.</p>';const Le=[["Preparing","2 days","#8d9bb8",2,"<b>Preparing.</b> The prize pot is set aside for the week. Sign-up opens next."],["Sign-up","3 days 8 h","#19d3c5",3.33,"<b>Sign-up.</b> Enter your five fighters, crew and weapon. The rest of the week runs without you lifting a finger."],["Draw","2 h","#a67cff",.6,"<b>Draw.</b> Sign-up closes, teams are ranked by team score, the top seeds get their free passes and the opening fights are paired."],["Fights","12 h","#ff6a5c",1,"<b>Fights.</b> Each fight has a set time and plays itself out on the chain. Watch them live or later in the tournament screen. A fight still going after 1,000 blows goes to the higher seed."],["Prizes","then","#f2c35a",1.2,"<b>Prizes.</b> The top four go into the Hall of Fame, WAX and TLM are paid into Rewards, and the next week begins."]];n("#tw").innerHTML=Le.map(([a,e,t,r],i)=>`<button data-i="${i}" style="--tc:${t};flex:${r} 1 0"><b>${a}</b><small>${e}</small></button>`).join("");const ze=a=>{u("#tw button").forEach((e,t)=>e.classList.toggle("on",t===a)),n("#twnote").innerHTML=Le[a][4]};n("#tw").addEventListener("click",a=>{const e=a.target.closest("button");e&&ze(+e.dataset.i)}),ze(1);const Ya=[["voidwarden_khaured","air",2],["lunatic_human","air",3],["mindblade_khaured","air",1],["astralknight_lopati","metal",0],["hunter_elgem","nature",1]];n("#tfive").innerHTML=Ya.map(([a,e,t],r)=>R({art:a,el:e,lv:10,asc:t},r)).join("");let ba=Ya.map(a=>a[2]);const Ae=()=>{const a=ba.map(t=>10+10*t),e=a.reduce((t,r)=>t+r,0);n("#tscore").innerHTML=`<div class="five">${Ya.map(([t,r],i)=>`<div>${R({art:t,el:r,lv:10,asc:ba[i]},i)}<span class="asc"><button data-i="${i}" data-d="-1" aria-label="Fewer ascensions">−</button><span>✦${ba[i]}</span><button data-i="${i}" data-d="1" aria-label="More ascensions">+</button></span><span class="pts5">${a[i]}</span></div>`).join("")}</div>
      <div class="sum"><span>Each fighter: its <b style="font:inherit;color:#fff">level</b> + <b style="font:inherit;color:#ffd979">10 per ascension</b>. Try the buttons.</span><b>${e}</b></div>
      <p style="margin:0;font-size:13.5px;color:var(--dim)">The higher the score, the higher the seed: the top seeds get the free passes, and every round pairs the strongest left with the weakest left. On equal scores, whoever signed up first ranks higher.</p>`};n("#tscore").addEventListener("click",a=>{const e=a.target.closest("button[data-d]");if(!e)return;const t=+e.dataset.i;ba[t]=Math.max(0,Math.min(9,ba[t]+ +e.dataset.d)),Ae()}),Ae();const Xa=a=>`${c}/avatar/${a}.webp`,Oe={Nova:[1101,120],Ivy:[1105,104],Vex:[1004,96],Kael:[1002,81],Rook:[1003,62]},E=(a,e,t)=>`<div class="pl ${e}"><img src="${Xa(Oe[a][0])}" alt=""><span>${a}</span><em>${t??Oe[a][1]}</em></div>`,ka=(a,e)=>`<div class="mt">${a}<span class="vs">VS</span>${e}</div>`;n("#brk").innerHTML=`<div class="col"><h6>Opening</h6>${E("Nova","pass","FREE PASS")}${E("Ivy","pass","FREE PASS")}${E("Vex","pass","FREE PASS")}${ka(E("Kael","win"),E("Rook","out"))}</div><div class="col"><h6>Semi-finals</h6>${ka(E("Nova","win"),E("Kael","out"))}${ka(E("Ivy","win"),E("Vex","out"))}</div><div class="col"><h6>Final</h6>${ka(E("Nova","win"),E("Ivy","out"))}</div><div class="col"><h6>Champion</h6><div class="champ"><img class="tr" src="${c}/icons/trophy-gold.svg" alt=""><img class="av" src="${Xa(1101)}" alt=""><b>Nova</b><small>Team score 120</small></div></div>`;const yt=[["1st",16,1],["2nd",8,1],["3rd–4th",4,2],["5th–8th",2,4],["9th–16th",1,8]];n("#wax").innerHTML=yt.map(([a,e,t])=>`<div><b>${a}</b><i><u style="width:${e/16*100}%"></u><s>${e} share${e>1?"s":""}${t>1?" each":""}</s></i><em>${e} share${e>1?"s":""}${t>1?" each":""} · <b>${(e/48*100).toFixed(1)}%</b></em></div>`).join("")+'<p style="margin:2px 0 0;font-size:13px;color:var(--faint)">Places are ranked by how far you went. 48 shares in all: the champion takes a third of the pot.</p>';const kt=[["Ivy",1105,2,"silver","Runner-up",70],["Nova",1101,1,"gold","Champion",96],["Kael",1002,3,"bronze","Third",46],["Vex",1004,3,"bronze","Third",46]];n("#podium").innerHTML=kt.map(([a,e,t,r,i,s])=>`<div><img class="tr" src="${c}/icons/trophy-${r}.svg" alt=""><img class="av" src="${Xa(e)}" alt=""><small>${a}</small><u style="height:${s}px">${t}</u></div>`).join(""),n("#tlmpts").innerHTML=[["Out first",0],["1 win",1],["2 wins",2],["3 wins",3]].map(([a,e])=>`<div><i>${Array.from({length:Math.max(1,e*e)},()=>"<u></u>").join("").replace(/<u><\/u>/g,e?"<u></u>":"")}</i><b>${["none","some","more","most"][e]}</b>${a}</div>`).join("")+"",n("#tlmpts").insertAdjacentHTML("afterend",'<p style="margin:8px 0 0;font-size:13px;color:var(--faint)">Every win earns points, and each round you win is worth more than the last. A free pass counts as a win. The TLM pot is shared by points.</p>');const Ba=[{key:"dung",name:"Dungeon Wins",icon:"/markers/buildings/dungeon.svg",tlm:"tlmdung",shr:"shrddung",how:"Win dungeons.",t:5278.9,tf:12.3825,s:25768.7,sf:1900},{key:"arena",name:"Arena Wins",icon:"/markers/buildings/arena.svg",tlm:"tlmarena",shr:"shrdarena",how:"Win arenas.",t:3145,tf:16.6032,s:27953.9,sf:2500},{key:"dom",name:"Arena Domination",icon:"/icons/menu/leaderboard.svg",tlm:"tlmarenadom",shr:null,how:"Hold arenas.",t:57033,tf:8.9636,s:0,sf:0}],g=(a,e=0)=>a.toLocaleString("en-US",{maximumFractionDigits:e,minimumFractionDigits:e}),Me=()=>{n("#pools3").innerHTML=Ba.map(a=>`<tr><td><img src="${c}${a.icon}" alt="">${a.name}</td><td><b>${g(a.t/100,1)}</b></td><td>${a.shr?`<b>${g(a.s/100,1)}</b>`:'<span class="no">–</span>'}</td></tr>`).join(""),Ia()},$t=async()=>{const a=e=>fetch("https://wax.greymass.com/v1/chain/get_table_rows",{method:"POST",body:JSON.stringify({code:"pools.ale",scope:"pools.ale",table:e,json:!0,limit:50})}).then(t=>t.json());try{const[e,t]=await Promise.all([a("tlmpools"),a("shardpools")]),r=Date.now();for(const i of Ba){const s=e.rows.find(p=>p.pool===i.tlm);if(s){const p=Math.max(0,(Math.min(r,Date.parse(s.fillrate_expiry+"Z"))-Date.parse(s.last_current_update+"Z"))/6e4),d=parseFloat(s.fillrate),l=parseFloat(s.tlm_reserve);i.t=parseFloat(s.tlm_current)+Math.min(l,d*p),i.tf=d}const o=i.shr&&t.rows.find(p=>p.pool===i.shr);o&&(i.s=(o.shard_current+o.fillrate_per_hour*(r-Date.parse(o.last_current_update+"Z"))/36e5)/10,i.sf=o.fillrate_per_hour/10)}Me()}catch{n("#potlive").textContent="SNAPSHOT"}},Se=[["19552","Standard Shovel",10,5],["19557","Basic Explosive",191,10],["19567","Large Explosive",367,122],["19576","Quantum Drill",1e3,125],["19579","AI Excavator",2037,2037]];let Ga=2;n("#tools").innerHTML=Se.map(([a,e,t],r)=>`<button data-i="${r}"><img src="${c}/cards/${a}.webp" alt=""><span><b>3× ${e}</b><small>${g(t*3)} power</small></span></button>`).join("");const Ia=()=>{if(!n("#vsrow"))return;u("#tools button").forEach((d,l)=>d.classList.toggle("on",l===Ga));const a=+n("#bst").value/10;n("#bstv").textContent="×"+a.toFixed(1);const[,,e,t]=Se[Ga],r=a/10,i=Math.round(e*3*r*2+1),s=Math.max(1,Math.round((e*3*r*2+1)*.1)),o=Ba[1],p=(d,l,b,m)=>{const O=1e4/m,v=O<=1?`<b>${g(1/O,1)} mines</b> per win`:`<b>${g(Math.ceil(O))} wins</b> per mine`;return`<div class="rw-row ${d}"><span class="who"><img src="${c}/icons/${l}" alt="">${b}</span><span class="pw">${g(m)}<small>power a win</small></span><span class="bar"><u style="width:${Math.min(100,m/1e4*100)}%"></u></span><span class="out">${v}</span></div>`};n("#vsrow").innerHTML=p("","account-trial.svg","Trial",s)+p("leg","account-legend.svg","Legend Pass",i),n("#rwpays").innerHTML=`One mine of Arena Wins pays <b>${g(o.t/100,1)} TLM</b> and <b>${g(o.s/100,1)} Shards</b> right now. The bar shows how much of one mine a single win fills.`};n("#tools").addEventListener("click",a=>{const e=a.target.closest("button");e&&(Ga=+e.dataset.i,Ia())}),n("#bst").oninput=Ia,Me(),$t(),(async()=>{try{const a=new Date(Date.now()-6048e5).toISOString();let e=0;for(let t=0,r=0;r<5;r++,t+=1e3){const s=(await fetch(`https://wax.eosusa.io/v2/history/get_actions?account=pools.ale&filter=alien.worlds:transfer&transfer.from=rewards.ale&after=${a}&limit=1000&skip=${t}&sort=asc`).then(o=>o.json())).actions||[];if(e+=s.filter(o=>o.act.data.from==="rewards.ale"&&o.act.data.to==="pools.ale").reduce((o,p)=>o+parseFloat(p.act.data.quantity),0),s.length<1e3)break}e>0&&(n("#inTlm").textContent=g(e))}catch{}try{const e=(await fetch("https://wax.greymass.com/v1/chain/get_table_rows",{method:"POST",body:JSON.stringify({code:"pools.ale",scope:"pools.ale",table:"shardpools",json:!0,limit:50})}).then(t=>t.json())).rows.reduce((t,r)=>t+Number(r.fillrate_per_hour||0),0)*168/10;e>0&&(n("#inShr").textContent=g(e))}catch{}})();const $a={Common:{Stone:12,Gold:27,Stardust:60},Rare:{Stone:90,Gold:203,Stardust:450,XDimension:315,Antimatter:1035},Epic:{Stone:250,Gold:563,Stardust:1250,XDimension:875,Antimatter:2875},Legendary:{Stone:675,Gold:1519,Stardust:3375,XDimension:2363,Antimatter:7763},Mythical:{Stone:3975,Gold:8944,Stardust:19875,XDimension:13913,Antimatter:45713}},je=["Stone","Gold","Stardust","XDimension","Antimatter"],ma={crew:["Crew","crew.worlds","141566",5475272],tool:["Tools","tool.worlds","19576",3823743],arms:["Weapons","arms.worlds","19582",2373323]};let J=["Legendary","Stone"],Ua="crew";n("#fmgrid").innerHTML=`<tr><th>Rarity</th>${je.map(a=>`<th><span class="full">${a==="XDimension"?"X-Dim":a}</span><span class="abbr">${{Stone:"Sto",Gold:"Gold",Stardust:"Star",XDimension:"X-D",Antimatter:"Anti"}[a]}</span></th>`).join("")}</tr>`+Object.keys($a).map(a=>`<tr><td class="r">${a}</td>${je.map(e=>$a[a][e]?`<td><button data-r="${a}" data-h="${e}">${g($a[a][e])}</button></td>`:"<td><button disabled>–</button></td>").join("")}</tr>`).join("");const ia=()=>{n("#fmpools").innerHTML=Object.values(ma).map(([l,,b,m])=>`<tr><td><img src="${c}/cards/${b}.webp" alt="" style="width:20px;height:auto;border-radius:3px">${l}</td><td><b>${g(m)}</b></td></tr>`).join(""),u("#fmgrid button[data-r]").forEach(l=>l.classList.toggle("on",l.dataset.r===J[0]&&l.dataset.h===J[1])),u("#fmpool button").forEach(l=>l.classList.toggle("on",l.dataset.p===Ua));const a=+n("#fmn").value,e=+n("#fmd").value;n("#fmnv").textContent=a,n("#fmdv").textContent=e;const t=$a[J[0]][J[1]]*a,r=t*e/1e7,i=Math.min(r,.01),s=r>=.01,[o,,,p]=ma[Ua],d=Math.ceil(1e5/t);n("#fmout").innerHTML=`<small>This claim pays</small>
      <span class="big"><img src="${c}/icons/credits.svg" alt="">${g(p*i)}</span>
      <span class="bar${s?" cap":""}"><u style="width:${i/.01*100}%"></u></span>
      <p>${a} × ${J[0]} ${J[1]} = weight <b>${g(t)}</b>. After ${e} day${e>1?"s":""} that's <b>${(i*100).toFixed(3)}%</b> of the ${o} pool${s?": <b>the 1% cap</b>. Claim now, waiting adds nothing.":`. The 1% cap is reached after ${g(d)} days.`}</p>`};n("#fmgrid").addEventListener("click",a=>{const e=a.target.closest("button[data-r]");e&&(J=[e.dataset.r,e.dataset.h],ia())}),n("#fmpool").addEventListener("click",a=>{const e=a.target.closest("button");e&&(Ua=e.dataset.p,ia())}),n("#fmn").oninput=ia,n("#fmd").oninput=ia,ia(),fetch("https://wax.greymass.com/v1/chain/get_table_rows",{method:"POST",body:JSON.stringify({code:"farm.ale",scope:"farm.ale",table:"pools",json:!0,limit:20})}).then(a=>a.json()).then(a=>{for(const e of Object.keys(ma)){const t=a.rows.find(r=>r.schema===ma[e][1]);t&&(ma[e][3]=t.current_size)}ia()}).catch(()=>{});const Tt=[["Common",0],["Rare",2e4],["Epic",4e4],["Legendary",6e4]];let Ee=1;const _e=()=>{n("#ldcost").innerHTML=Tt.map(([a,e],t)=>`<button data-i="${t}" class="${t===Ee?"on":""}"><small>${a} land</small><b><img src="${c}/icons/credits.svg" alt="">${g(69999-e)}</b><span>${e?g(e)+" off":"full price"}</span></button>`).join("")};n("#ldcost").addEventListener("click",a=>{const e=a.target.closest("button");e&&(Ee=+e.dataset.i,_e())}),_e();const Ta={wax:["WAX","wax-coin.webp",1e8],tlm:["TLM","tlm.svg",1e4],shards:["Shards","shards.svg",10]},Ce=[{requirements:"Distance travelled",requirement_amount:22e3,total_gems:13080,reward_type:"wax",prize:5946,status:"live",left:"7 h"},{requirements:"Dungeons won",requirement_amount:150,total_gems:6e3,reward_type:"tlm",prize:4200,status:"live",left:"19 h"},{requirements:"Damage resisted",requirement_amount:25e3,total_gems:0,reward_type:"shards",prize:6e4,status:"soon",left:"7 h"}],Lt=()=>{n("#cdlist").innerHTML=Ce.map(a=>{const[e,t,r]=Ta[a.reward_type]||Ta.tlm,i=a.prize,s=a.status==="live"?`<span><b>${g(a.total_gems)}</b> gems in</span><span>ends in ${a.left}</span>`:`<span class="soon">Starts in ${a.left}</span>`;return`<div class="cd-row"><img src="${c}/icons/${t}" alt=""><div><span class="pz">${g(i,i<100?2:0)}<small>${e} prize</small></span><div class="rq">Needs <b>${g(a.requirement_amount)} ${a.requirements.toLowerCase()}</b></div></div><div class="st">${s}</div></div>`}).join(""),Ka()},Ka=()=>{const a=Ce[0],[e,t]=Ta[a.reward_type]||Ta.tlm,r=a.prize,i=+n("#cy").value,s=+n("#co").value,o=i/(i+s);n("#cyv").textContent=g(i),n("#cov").textContent=g(s),n("#cdbar").style.width=(o*100).toFixed(2)+"%",n("#cdshare").innerHTML=`<img src="${c}/icons/${t}" alt="">${g(r*o,2)} ${e}`,n("#cdpct").textContent=`${(o*100).toFixed(1)}% of the prize`,n("#cdnote").innerHTML=`Prize <b>${g(r,0)} ${e}</b> × your gems ÷ all gems. Each gem is worth <b>${g(r/(i+s),4)} ${e}</b> in this example.`};n("#cy").oninput=Ka,n("#co").oninput=Ka,Lt();const Va={art:"lunatic_human",el:"fire",lv:7,asc:1},zt=()=>[12,30,52,70,86].map((a,e)=>`<span class="mote" style="left:${a}%;animation-delay:${(e*.42).toFixed(2)}s"></span>`).join(""),sa=(a,e,t,r=Va.lv)=>R({...Va,lv:r},0,a).replace("</button>",(a.includes("up")?zt():"")+(e?`<span class="tag ${t}">${e}</span>`:"")+"</button>"),Pe=[["","","","Ready","nothing to do","<b>Ready.</b> Paid, free and fighting fit: pick it for any fight."],["over","Payday","payday","Payday","red rim, pulsing","<b>Payday overdue.</b> It can't fight or be listed until you pay it in My Fighters. Left unpaid for about 90 days, it's deleted."],["up","Level up","lvlup","Level up","green, glowing","<b>Level waiting.</b> Its XP strip is full: level it up for credits to make it stronger."],["maxed","","","Max level","full green strip","<b>Level 10, the top.</b> The strip stays full and green; it can't level any further, but it can ascend."],["iron","Market","market","Busy","ribbon says where","<b>Busy.</b> The ribbon says where: Market, Arena, Dungeon or Tourney. It comes back when that's over."]];let Qa=1;const He=()=>{n("#kfstates").innerHTML=Pe.map(([a,e,t,r,i],s)=>`<figure data-i="${s}" class="${s===Qa?"on":""}">${sa(a,e,t,a==="maxed"?10:Va.lv)}<figcaption><b>${r}</b><small>${i}</small></figcaption></figure>`).join(""),n("#kfwhat").innerHTML=Pe[Qa][5]};n("#kfstates").addEventListener("click",a=>{const e=a.target.closest("figure");e&&(Qa=+e.dataset.i,He())}),He();const We=()=>{const a=+n("#kfd").value;n("#kfdv").textContent=a;const e=a>=30,t=a>=120,r=Math.floor(Math.min(a,30)/30*999+1);n("#kfpaycard").innerHTML=t?sa("gone","Deleted","payday"):e?sa("over","Payday","payday"):sa("","",""),n("#kfout").innerHTML=t?'<span class="st" style="color:#ff5a6a">Deleted</span><span>Unpaid for 90 days after its payday: the fighter is gone for good.</span>':e?`<span class="st" style="color:#ff5a6a">Can't fight</span><span>Pay <b>${g(r)}</b> credits to bring it back. Deleted in ${120-a} days.</span>`:`<span class="st" style="color:var(--green)">Fighting</span><span>Paying now costs <b>${g(r)}</b> credits. Payday in ${30-a} days.</span>`};n("#kfd").oninput=We,We();const Fe=()=>{const a=+n("#lv").value,e=Math.pow(1.15,a);n("#lvv").textContent=a,n("#lvmul").textContent="×"+e.toFixed(2),n("#lvex").textContent=`a 100-damage roll hits for ${Math.round(100*e)}`,n("#kflvcard").innerHTML=a>=10?sa("maxed","","",10):sa("up","Level up","lvlup",a)};n("#lv").oninput=Fe,Fe();const A={art:"arcanist_altan",el:"air",race:"Altan",lv:10,asc:4},oa=[{art:"arcanist_altan",el:"fire",race:"Altan",lv:6},{art:"arcanist_human",el:"air",race:"Human",lv:4},{art:"arcanist_robotron",el:"metal",race:"Robotron",lv:8,sac:1},{art:"arcanist_elgem",el:"nature",race:"Elgem",lv:5},{art:"arcanist_altan",el:"air",race:"Altan",lv:7},{art:"hunter_altan",el:"air",race:"Altan",lv:9,other:1}],la=[["Same race","Another Altan",a=>a.race===A.race],["Same element","Another Air fighter",a=>a.el===A.el],["Sacrifice ability",'Has "Sacrifice"',a=>!!a.sac]];let h=[],L="pick",La=[],da=null,Re="";const Ne=()=>{const a=h.map(r=>oa[r]);for(const r of[0,1,2])for(const i of[0,1,2])for(const s of[0,1,2])if(!(new Set([r,i,s]).size<3||!a[r]||!a[i]||!a[s])&&la[0][2](a[r])&&la[1][2](a[i])&&la[2][2](a[s]))return[h[r],h[i],h[s]];const e=new Set,t=[null,null,null];return la.forEach(([,,r],i)=>{const s=h.find(o=>!e.has(o)&&r(oa[o]));s!==void 0&&(t[i]=s,e.add(s))}),t},Z=(a,e)=>a+Math.random()*(e-a),At=[()=>{const a=Z(.5,1.5);return["Damage","+"+a.toFixed(1),`≈ +${(a*4.05).toFixed(1)} in a level-10 fight`]},()=>{const a=Z(1,2.5);return["Health","+"+a.toFixed(1),`≈ +${(a*4.05).toFixed(1)} in a level-10 fight`]},()=>["Cooldown","−"+Z(.5,1.5).toFixed(1),"strikes more often"],()=>["Wind-up","−"+Z(1.5,5).toFixed(1),"strikes first sooner"],()=>["Taunt","+"+Z(2,5).toFixed(1),"draws more blows"],()=>["Taunt","−"+Z(.5,2).toFixed(1),"draws fewer blows"]],Ot=["Gem","Metal","Air","Fire","Nature","Neutral"],De=()=>Array.from({length:3},()=>Math.random()<.8?At[Math.floor(Math.random()*6)]():(()=>{const a=Ot[Math.floor(Math.random()*6)];return[a+" resistance","+"+Z(1.5,5).toFixed(1)+"%","takes less from "+a]})()),za=()=>{const a=Ne(),e=a.every(d=>d!==null),t=(d,l,b="")=>R({art:d.art,el:d.el,lv:d.lv,asc:d.asc},l,b);n("#ashero").className="as-hero"+(L==="done"?" glow":""),n("#ashero").innerHTML=t(A,0)+`<small>Altan · Air · Level 10 · ✦${A.asc}${L==="done"?`<br><b style="color:#ffd979">${Re}</b>`:""}</small>`,n("#assocks").innerHTML=la.map(([d,l],b)=>`<div class="as-sock${a[b]!==null&&L!=="done"?" ok":""}">${a[b]!==null&&L!=="done"?t(oa[a[b]],a[b]):'<span class="slot">+</span>'}<div><b>${d}</b><span>${l}</span></div></div>`).join("");const r=L==="done"?new Set(a):new Set;n("#asroster").innerHTML=oa.map((d,l)=>`<div>${t(d,l,(h.includes(l)&&!r.has(l)?"sacd":"")+(r.has(l)?" gone":"")).replace("</button>",h.includes(l)&&!r.has(l)?'<span class="tag payday">Sacrifice</span></button>':"</button>")}<small>${d.art.startsWith("hunter")?"Hunter":"Arcanist"} · ${d.race} · ${d.el[0].toUpperCase()+d.el.slice(1)}${d.sac?"<br><i>Sacrifice</i>":""}</small></div>`).join("");const i=`<img src="${c}/icons/credits.svg" alt="">`;let s="",o="";L==="pick"?(s=e?"<b>All three slots filled.</b> Ascend to see your upgrades.":h.length===3?"<b>These three don't cover all three slots.</b> Swap one out.":`Pick ${3-h.length} more. Each one has to fill a different slot.`,o=`<button class="btn gold" id="asgo" ${e?"":"disabled"}>Ascend · ${i} 999</button>`):L==="offers"?(s="<b>Three random upgrades.</b> Take one: the other two are lost. Or re-roll all three.",o=`<button class="btn" id="asroll">Re-roll · ${i} 499</button>`):(s=`<b>Ascended to ✦${A.asc}.</b> The three sacrifices are gone. ${A.asc>=5?'<b style="color:#ffd979">Its hidden ability is now open: see below.</b>':`${5-A.asc} more to open its hidden ability.`}`,o='<button class="btn" id="asagain">Try again</button>'),n("#asact").innerHTML=o+`<span class="msg">${s}</span>`;const p=A.asc>=5;n("#as5").classList.toggle("open",p),n("#as5pips").innerHTML=[1,2,3,4,5].map(d=>`<span class="${d===5?"five ":""}${d<=A.asc?"on":""}">✦${d}</span>`).join(""),n("#as5ab").innerHTML=`<span class="rib"><i>Rare</i><i class="lock">${p?"Unlocked":"Locked"}</i></span><span class="lockicon">${p?"🔓":"🔒"}</span><b>Group Buff: Air Damage</b><span>Before combat, increases allied air damage by 6%</span><span style="font-size:12.5px">${p?"Active in every fight from now on.":`Opens at ✦5: this fighter is at ✦${A.asc}.`}</span>`,n("#asoffers").innerHTML=L==="pick"?"":La.map(([d,l,b],m)=>`<button class="as-offer${da===m?" taken":da!==null?" lost":""}" data-i="${m}"><small>${d}</small><b>${l}</b><span>${b}</span></button>`).join("")};n("#asroster").addEventListener("click",a=>{if(L!=="pick")return;const e=a.target.closest(".rc");if(!e)return;const t=+e.dataset.i;if(oa[t].other){n("#asact .msg").innerHTML="<b>That's a Hunter.</b> Sacrifices must be the same class as your fighter: Arcanists only.";return}if(!h.includes(t)){if(h.length>=3){n("#asact .msg").innerHTML="<b>All three are picked.</b> Tap one of them to take it back.";return}const r=i=>{const s=h;h=i;const o=Ne().filter(p=>p!==null).length;return h=s,o};if(r([...h,t])<=r(h)){const i=oa[t],s=la.filter(([,,o])=>o(i)).map(([o])=>o.toLowerCase());n("#asact .msg").innerHTML=s.length?`<b>That slot is already filled.</b> This one only counts as ${s.join(" or ")}.`:"<b>This one doesn't fit any slot.</b> It isn't an Altan, isn't Air and has no Sacrifice ability.",n(`#asroster .rc[data-i="${t}"]`).classList.add("shake");return}}h=h.includes(t)?h.filter(r=>r!==t):[...h,t],za()}),n("#asact").addEventListener("click",a=>{const e=a.target.closest("button");!e||e.disabled||(e.id==="asgo"&&(L="offers",La=De(),da=null),e.id==="asroll"&&(La=De()),e.id==="asagain"&&(L="pick",h=[],da=null,A.asc=4),za())}),n("#asoffers").addEventListener("click",a=>{const e=a.target.closest(".as-offer");if(!e||L!=="offers")return;da=+e.dataset.i;const[t,r]=La[da];Re=`${r} ${t.toLowerCase()}`,A.asc+=1,L="done",za()}),za();const Mt={start:20};let f={cur:20,bids:0,top:null,end:48,t:20};const Aa=()=>Math.max(f.cur+2,Math.trunc(f.cur*1.1)),St=()=>{f={cur:Mt.start,bids:0,top:null,end:48,t:20},n("#mkt").value=20},jt=a=>{if(f.t>=f.end)return;const e=f.top;f.cur=(f.bids,Aa()),f.bids++,f.top=a;const t=f.end-f.t<12;return t&&(f.end=f.t+12),{prev:e,late:t}},Oa=()=>`<img src="${c}/icons/gems.svg" alt="">`,ha=a=>{const e=f.t>=f.end,t=72;n("#mkcard").innerHTML=R({art:"mindblade_khaured",el:"gem",lv:9,asc:1},0,e&&f.top?"picked":"").replace(/<span class="tag team">In team<\/span>/,e&&f.top?`<span class="tag ${f.top==="you"?"team":"payday"}">Sold</span>`:"");const r=Math.max(0,f.end-f.t);n("#mkstats").innerHTML=`<div><small>${f.bids?"Top bid":"Starts at"}</small><b>${Oa()}${g(f.cur)}</b></div><div class="${f.top==="you"?"you":f.top?"rival":""}"><small>Top bidder</small><b>${f.top==="you"?"You":f.top?"Rival":"–"}</b></div><div><small>Next bid</small><b>${e?"–":Oa()+g(Aa())}</b></div><div><small>${e?"Status":"Ends in"}</small><b>${e?"Ended":r+" h"}</b></div>`,n("#mkzone").style.left=Math.max(0,f.end-12)/t*100+"%",n("#mkzone").style.width=12/t*100+"%",n("#mkend").style.left=f.end/t*100+"%",n("#mkend").textContent="Ends "+f.end+"h";let i=a||"";a||(e?i=f.top==="you"?`<b>You won it</b> for ${g(f.cur)} gems. The fighter joins your roster.`:f.top?`<b>The rival won</b> at ${g(f.cur)} gems. Your gems came back when you were outbid.`:"<b>No bids.</b> With Keep listed ticked, it stays up as a Buy now at 20 gems until its payday.":i=f.top==="you"?`<b>You're on top.</b> Your ${g(f.cur)} gems are held until you win or get outbid.`:"Place a bid, or drag the clock along the timeline. The red zone is the last 12 hours."),n("#mkact").innerHTML=`<button class="btn gold" id="mkbid" ${e||f.top==="you"?"disabled":""}>Bid ${Oa()} ${g(Aa())}</button><button class="btn" id="mkrival" ${e?"disabled":""}>A rival bids</button><button class="btn" id="mkreset">Reset</button><span class="msg">${i}</span>`};n("#mkact").addEventListener("click",a=>{const e=a.target.closest("button");if(!e||e.disabled)return;if(e.id==="mkreset")return St(),ha();const t=e.id==="mkbid"?"you":"rival",r=jt(t);if(!r)return ha();const i=r.late?` It came in the last 12 hours, so the auction now ends at <b>${f.end}h</b>.`:"";ha(t==="you"?`<b>You bid ${g(f.cur)} gems.</b> They're held while you're on top.${i}`:r.prev==="you"?`<b>Outbid!</b> The rival bid ${g(f.cur)} gems and yours came straight back.${i}`:`<b>A rival bid ${g(f.cur)} gems.</b>${i}`)}),n("#mkt").oninput=()=>{f.t=Math.min(+n("#mkt").value,72),ha()},ha();const qe=()=>{const a=+n("#mkp").value,e=Math.max(1,Math.trunc(a*.15)),t=a>e?a-e:a;n("#mkpv").textContent=g(a),n("#mkbill").innerHTML=`<div><span>Sold for</span><b>${g(a)}</b></div><div><span>Sale fee (15%)</span><b>−${g(e)}</b></div><div><span>Listing fee, paid up front</span><b>−1</b></div><div class="tot"><span>You get</span><b>${Oa()} ${g(t)}</b></div>`};n("#mkp").oninput=qe,qe(),n("#aschips").innerHTML=["Travelling","Dungeons and arenas","Your fighters","Quests","Rewards","Market","Shop (gems, credits)","Farming (claims)","Ascension","Candle","Lands and buildings","Tournament","CPU","Account settings"].map(a=>`<span>${a}</span>`).join("");const Ye=[["leg.one","1 month",999,1],["leg.three","3 months",2499,3],["leg.six","6 months",3999,6]];let Ja=2;const Xe=()=>{n("#lpplans").innerHTML=Ye.map(([t,r,i,s],o)=>{const p=i/s,d=Math.round((1-p/999)*100);return`<button class="lp-plan${o===Ja?" on":""}" data-i="${o}">${d?`<i>Save ${d}%</i>`:""}<img src="${c}/shop/${t}.webp" alt=""><div><small>${r}</small><b><img src="${c}/icons/gems.svg" alt="">${g(i)}</b><span>${g(p)} gems a month</span></div></button>`}).join("");const[,a,e]=Ye[Ja];n("#lpnote").innerHTML=`<b style="color:#fff">${a} for ${g(e)} gems.</b> Buying more adds to the time you have left.`};n("#lpplans").addEventListener("click",a=>{const e=a.target.closest(".lp-plan");e&&(Ja=+e.dataset.i,Xe())}),Xe();const Et=[["gem.small","Pack S",100,49],["gem.medium","Pack M",1100,499],["gem.large","Pack L",12500,4999],["gem.giant","Pack XL",14e4,49999]];n("#gempacks").innerHTML=Et.map(([a,e,t,r],i)=>{const s=Math.round((t/r/2.0408163265306123-1)*100);return`<div class="${i===3?"best":""}">${i===3?`<i>Best value · +${s}%</i>`:s>0?`<i>+${s}% gems</i>`:""}<img class="art" src="${c}/shop/${a}.webp" alt=""><small>${e}</small><b><img src="${c}/icons/gems.svg" alt="">${g(t)}</b><span><img src="${c}/icons/wax-coin.webp" alt=""> ${g(r)} WAX</span></div>`}).join("");const _t=[["Age","Fighters","/icons/stats/health.svg","upkeep","A bonus or penalty on health and damage that fades over time and with every win."],["Arena","Fighting","/markers/buildings/arena.svg","arenas","A building where you beat the team other trainers left. Win, and one of your fighters joins its defence."],["Arena Domination","Rewards","/icons/menu/leaderboard.svg","rewards","A TLM pool you fill by holding arenas with your fighters."],["Ascension","Fighters","/icons/menu/ascension.svg","ascension","Sacrificing three same-class fighters to give a level-10 fighter a permanent upgrade. Shown as ✦."],["Auto-sign","Account","/icons/menu/account.svg","account","Lets the everyday actions you choose sign themselves, without a wallet pop-up."],["Boost","World","/markers/buildings/dungeon-r3.svg","lands","A building's strength, ×0 to ×10. Higher boost, bigger rewards there. It fades with time and use."],["Candle","Rewards","/icons/menu/candle.svg","candle","Missions with a fixed prize, split by how many gems each trainer put in."],["Cooldown","Fighting","/icons/stats/attackspeed.svg","fight","The time between a fighter's blows. Lower is better."],["CPU","Account","/icons/menu/account.svg","account","The network power every action uses. Legend trainers get 25 free top-ups a week."],["Credits","Currencies","/icons/credits.svg","energy","The game's working money: paydays, level-ups, ascension, boosts and energy."],["Difficulty","Fighting","/markers/buildings/dungeon.svg","dungeons","How hard a dungeon fight is. Higher pays more Reward Power and XP."],["Energy","Currencies","/icons/energy.svg","energy","What almost every action costs. It never refills by itself: claim the daily flask."],["Farming","Rewards","/icons/menu/farming.svg","farming","Staking Alien Worlds cards to claim credits from three pools."],["Free pass","Fighting","/icons/menu/tournament.svg","tournament","A top tournament seed skipping the opening round. It counts as a win."],["Gems","Currencies","/icons/gems.svg","shop","The premium currency, bought with WAX."],["Hall of Fame","Fighting","/icons/trophy-gold.svg","tournament","Where each tournament's champion, runner-up and two semi-finalists are kept for good."],["Legend Pass","Account","/icons/account-legend.svg","shop","The premium pass: 10× Reward Power, full prizes, 1,000 energy a day and free CPU."],["Level","Fighters","/icons/stats/damage.svg","upkeep","A fighter's rank, 1 to 10. Each level makes health and damage stronger."],["Locked ability","Fighters","/icons/menu/ascension.svg","ascension","A fighter's hidden third ability. It opens at ✦5."],["Mine","Rewards","/icons/tlm.svg","rewards","Spending a full Reward Power bar to take 1% of a pool, straight to your wallet."],["NFT fighter","Fighters","/icons/add-fighter.svg","squad","Your sixth fighter, built from one Alien Worlds crew card and one weapon card."],["Objective","Fighters","/markers/buildings/tavern.svg","recruit","A tavern's wish, met by showing an Alien Worlds card. Each one takes energy off the hire."],["Payday","Fighters","/icons/credits.svg","upkeep","A fighter's wages, up to 1,000 credits every 30 days. Overdue: it can't fight."],["Prize pool","Rewards","/icons/menu/rewards.svg","rewards","The TLM and Shards your mines are paid from. Shared by every trainer and refilled all the time."],["Resistance","Fighting","/icons/elements/fire.svg","fight","Cuts the damage of one element's blows, up to 80%."],["Reward Power","Rewards","/icons/menu/rewards.svg","rewards","What every win banks. A full bar of 10,000 is one mine."],["Sacrifice","Fighters","/icons/menu/ascension.svg","ascension","An ability some fighters have. Ascension needs one sacrifice that has it."],["Shards","Currencies","/icons/shards.svg","energy","Alien Worlds shards, spent at the AW Outpost."],["Taunt","Fighting","/icons/stats/taunt.svg","fight","Draws enemy blows. It drops a little each time the fighter is hit."],["TLM","Currencies","/icons/tlm.svg","rewards","Trilium, the main reward. It goes straight to your wallet."],["Trainer","Account","/icons/menu/account.svg","trainer","You: the player who recruits fighters and sends them into fights."],["Trial","Account","/icons/account-trial.svg","shop","Playing without a Legend Pass. Most rewards are a tenth."],["WAX","Currencies","/icons/wax-coin.webp","shop","The blockchain's coin. Buys gems and Alien Worlds cards; some prizes pay it."],["Weather","World","/icons/weather.png","map","A land's daily roll that can raise or lower stats, for both teams alike."],["Wind-up","Fighting","/icons/stats/initiative.svg","fight","How soon a fighter strikes first. Lower is better."]],Ct=["All","Currencies","Fighters","Fighting","Rewards","World","Account"];let Ma="All",Be="";const Pt=a=>a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),Sa=(a=Be)=>{Be=a;const e=a?new RegExp("("+Pt(a)+")","ig"):null,t=_t.filter(([i,s,,,o])=>(Ma==="All"||s===Ma)&&(!a||(i+" "+o).toLowerCase().includes(a.toLowerCase())));let r="";for(const[i,s,o,p,d]of t){i[0].toUpperCase();const l=P.getElementById(p);r+=`<a href="#${p}"><img src="${c}${o}" alt=""><span><b>${e?i.replace(e,"<mark>$1</mark>"):i}</b>${e?d.replace(e,"<mark>$1</mark>"):d}<small>${l?l.querySelector("h2").textContent:s} →</small></span></a>`}n("#gloss").innerHTML=r||'<p class="gl-none">Nothing in the glossary for that. Try another word.</p>'};n("#glcats").innerHTML=Ct.map(a=>`<button data-c="${a}" class="${a===Ma?"on":""}">${a}</button>`).join(""),n("#glcats").addEventListener("click",a=>{const e=a.target.closest("button");e&&(Ma=e.dataset.c,u("#glcats button").forEach(t=>t.classList.toggle("on",t===e)),Sa())}),n("#glq").addEventListener("input",a=>Sa(a.target.value.trim())),Sa(),n("#q").addEventListener("input",a=>{const e=a.target.value.trim().toLowerCase();Sa(e);for(const t of u("section.ch")){const r=!e||t.id==="glossary"||t.textContent.toLowerCase().includes(e);t.classList.toggle("hide",!r);const i=n(`.toc a[data-id="${t.id}"]`);i&&(i.style.opacity=r?1:.35)}for(const t of u(".part")){let r=t.nextElementSibling,i=!1;for(;r&&!r.classList.contains("part");)r.tagName==="SECTION"&&!r.classList.contains("hide")&&(i=!0),r=r.nextElementSibling;t.classList.toggle("hide",!i)}});const Ht=[[/Legend Pass(?:es)?/g,"account-legend.svg"],[/\b[Cc]redits\b/g,"credits.svg"],[/\b[Gg]ems\b|\b[Gg]em(?= fee)/g,"gems.svg"],[/\b[Ee]nergy\b/g,"energy.svg"]],Ge="script, style, title, svg, input, textarea, .btn, #gloss, .gl-cats, .ic, .toc, .coin, .coinbox h3, .search, .legcta b, .rw-leg b, .rw-row .who, .lp-plans, .lp-perks, .gp, .sh-more li, .tv, .as-chips",Ie=a=>{if(!a||a.nodeType===1&&a.closest(Ge))return;const e=document.createTreeWalker(a,NodeFilter.SHOW_TEXT,{acceptNode:r=>r.parentElement&&!r.parentElement.closest(Ge)&&/Legend Pass|redits|ems|em fee|nergy/.test(r.data)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}),t=[];for(;e.nextNode();)t.push(e.currentNode);for(const r of t){const i=[];for(const[l,b]of Ht)for(const m of r.data.matchAll(l))i.push([m.index,m[0],b]);if(!i.length)continue;i.sort((l,b)=>l[0]-b[0]);let s=r.previousSibling;for(;s&&s.nodeType===3&&!s.data.trim();)s=s.previousSibling;const o=s&&s.nodeName==="IMG"&&!r.data.slice(0,i[0][0]).trim(),p=document.createDocumentFragment();let d=0;i.forEach(([l,b,m],O)=>{if(!(l<d)){if(p.append(r.data.slice(d,l)),O===0&&o){const v=document.createElement("span");v.className="ic",v.textContent=b,p.append(v)}else{const v=document.createElement("span");v.className="ic",v.innerHTML=`<img src="${c}/icons/${m}" alt="">${b}`,p.append(v)}d=l+b.length}}),p.append(r.data.slice(d)),r.replaceWith(p)}};Ie(X);const Ue=new MutationObserver(a=>{for(const e of a)for(const t of e.addedNodes)Ie(t.nodeType===3?t.parentElement:t)});return Ue.observe(X,{childList:!0,subtree:!0}),()=>{for(const a of B)a();for(const a of G)window.clearTimeout(a),window.clearInterval(a);Ue.disconnect()}}function an(){const P=Je(H=>H.player),c=Je(H=>H.account),X=ne.useRef(null),B=!!P,G=P?"/map":c?"/signup":"/connect",aa=P?{to:"/map",label:"Back to game"}:{to:"/",label:"Home"};return ne.useEffect(()=>{document.title="Trainer's guide | Alien Legends",window.scrollTo(0,0)},[]),ne.useEffect(()=>{const H=X.current;if(!H)return;const N=H.shadowRoot??H.attachShadow({mode:"open"}),I=Ze("/assets").replace(/\/$/,"");N.innerHTML=`<style>${Bt.split("%A%").join(I)}</style>${Gt.split("%A%").join(I)}`,N.querySelector(".gx")?.classList.toggle("ingame",B);const D=It(N,I);return()=>{D(),N.innerHTML=""}},[B]),C.jsxs("div",{className:`guide${B?" guide--ingame":""}`,children:[!B&&C.jsxs("header",{className:"guide__bar",children:[C.jsxs(re,{to:aa.to,className:"guide__back","aria-label":aa.label,children:[C.jsx("svg",{viewBox:"0 0 24 24","aria-hidden":"true",children:C.jsx("path",{d:"M15 5l-7 7 7 7"})}),C.jsx("span",{children:aa.label})]}),C.jsx(re,{to:"/",className:"guide__logo","aria-label":"Alien Legends home",children:C.jsx("img",{src:Ze("/assets/logo.webp"),alt:"Alien Legends",width:337,height:152,decoding:"async"})}),C.jsx(re,{to:G,className:"btn btn--primary guide__play",children:"Play"})]}),C.jsx("div",{ref:X})]})}export{an as default};
