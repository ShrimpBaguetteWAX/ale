# Alien Legends — web client (rebuild)

A rebuild of the Alien Legends front end: landing, wallet connect, signup, the
game shell with its menu, and the world map. Vite + React + TypeScript +
WharfKit, reading straight from the WAX contracts in
`../monstergame`.

Nothing here touches the existing repos. This is a standalone folder.

```bash
npm install
npm run dev        # http://localhost:5273
npm run build      # -> docs/
npm run typecheck
```

## What talks to what

Contract accounts were read out of `../monstergame` and verified against WAX
mainnet.

| What | Where |
| --- | --- |
| Players, config, avatars, signup | `players.ale` (the `users` contract) |
| Lands, buildings | `lands.ale` (the `maps` contract), **scope = planet** |
| Signup fee | 15 WAX to `players.ale`, forwarded to `ram.ale` |
| Fighters / arena / dungeons / pools | `fighters.ale`, `arena.ale`, `dungeons.ale`, `pools.ale` |

### Signup is two transactions, because the contract is

1. `eosio.token::transfer` of exactly `config.signup_fee` to `players.ale`.
   The contract's notify handler checks the amount, refuses duplicates, writes
   a `signupstat` row and forwards the WAX on. The memo may be anything except
   `"gift"`.
2. `players.ale::signup(wallet, playertag)` consumes that row and creates the
   player. Playertag must be 4–12 characters.

Because step 1 leaves a durable marker, a player who pays and then closes the
tab is resumed into step 2 rather than charged twice.

Note `config.allowlist_active` is currently **true** on mainnet, so signup is
gated on the `whitelist` table. The signup screen checks and says so up front
instead of letting the transaction fail.

### Taverns are per-player

A tavern on the map does **not** come from the `tavern` building on the land —
it comes from the player row. The same tavern land appears in different
players' `active_taverns` with a different `selection_score` and a different
objective list each, and a tavern missing from your list is not yours to enter.
Drawing them from the lands table would show players taverns they cannot use.

`last_tavern` is drawn as well, in its own colour, because `users::setreveal`
**moves** the matched tavern out of `active_taverns` and into `last_tavern`.
The tavern a player is actually standing in is therefore absent from the active
list, and anything counting or drawing only that list loses it.

So the set is `active_taverns ∪ last_tavern`, for both the map and the planet
switcher's count.

### What "locked" means

The planet switcher shows, per planet, the player's active taverns and how many
dungeons and arenas are open to them. Neither lock is a property of the
building:

- A **dungeon** is locked for a player who already ran it today.
  `users::dungeonplay` appends `<planet>.<land_id>` to the player's
  `played_dungeons` and rejects a repeat with "Dungeon already played today".
  The list only counts while `last_dungeon_reset` falls on the current UTC day.
  On the map such a dungeon is drawn greyed and faded with a "Played" tag in
  place of its multiplier — still drawn, because the player needs to know it is
  there, just not available until the reset.
- An **arena** is locked while the player still has a fighter standing in it —
  a row in `arena.ale`'s `livearena` (scoped by planet, keyed by land) with
  their wallet in `fighters[].owner`.

### The shop

Sixteen items in four categories, read live from `shop.ale`'s `shopitems`. The
economy is a ladder: **WAX buys gems → gems buy credits and Legend passes →
credits buy energy**, plus two free daily energy flasks.

Two different purchase paths, because the contract has two:

- In-game currencies go through `shop::buyshopitem(wallet, item)`.
- WAX-priced items *cannot* — `buyshopitem` asserts `cost_wax.amount == 0`
  ("This item needs to be purchased with WAX"). They are bought by
  transferring the exact amount to `shop.ale` with the memo
  `purchase,<item>`, which its `eosio.token::transfer` handler parses.

`src/shop/rules.ts` mirrors every gate in the contract so the UI never offers a
purchase the chain will refuse:

- `trial_availability: false` means Legend accounts only (the bigger daily
  flask).
- A non-Legend player holding **more than 1999 energy** cannot claim a free
  flask at all — an anti-hoarding rule that is easy to miss and confusing when
  it fires with no explanation.
- Cooldowns come from `cdclaimshp`. A 24h cooldown is **snapped to the UTC day
  boundary** by the contract (`.../86400*86400`), so the daily flask resets at
  midnight UTC, not 24 hours after you claimed it. A rolling countdown would be
  wrong by up to a day.

Nothing is signed until a confirmation dialog has shown exactly what leaves and
what arrives, with the WAX balance before and after — these are irreversible
and some of them cost real money. Balances are floored rather than rounded, so
the figure can never overstate what a player can spend.

Pack artwork is the original's, resized by the thumbnail script: 8.9MB to
0.5MB.

### Landowners

Land is an `alien.worlds` NFT, so the owner of a building is the owner of the
land asset — which lives in AtomicAssets, not in the game contracts. Owners are
shown by gamertag where they have one ("Shrimp's Tavern"), resolved from
`players.ale`; plenty of Alien Worlds landowners never signed up to this game,
so the wallet stays the fallback rather than the primary label.
`src/chain/atomic.ts` is a small sibling of the chain client (same rotation and
failover, plain GETs so there is no preflight). Owners are fetched in one
batched request per planet covering only the built land — fewer than ten ids
per planet — rather than a lookup per tile click.

### The tavern

Standing on a tavern tile puts an "Enter Tavern" prompt on the map. The gate is
the contract's own precondition: `users::hire` refuses unless
`last_tavern.land_id` still matches the land you are on, and `users::travel`
is what sets it.

Two on-chain steps:

1. **Reveal** — `tavern.ale::reveal(wallet)` spends `cost_reveal_ap` (10 today)
   and writes a recruit into `last_tavern_fighter`. Stats come back as min/max
   ranges; the roll happens on hire. Note the deployed ABI takes only `wallet`
   — the live site still sends a `use_gems` flag the contract no longer has.
2. **Hire** — `players.ale::hire(wallet, asset_ids, cost_action_points)`.

The hire price starts at 100 action points (hardcoded in `users::hire`, not the
`cost_hire_ap` config field, which the contract never reads). Showing the
tavern Alien Worlds NFTs that match its objectives takes energy off. **The NFTs
are not spent** — `nfts.ale` only records the use, capping how often one asset
can be shared between *different* accounts (twice per 24h). They just have to
be in your wallet.

A hire takes **at most three cards**. That is a game rule, not a contract one —
`users::hire` loops over whatever `asset_ids` it is given without a length
check — so it is enforced in the UI and nowhere else.

`src/tavern/hireCost.ts` mirrors the contract's matching exactly, because the
contract asserts the client's arithmetic — `check(cost_action_points ==
ap_cost)` — and a mismatch fails in the player's wallet. Two details that are
easy to get wrong: an objective is *consumed* by the first card that matches
it, and one card can claim several at once.

"Best pick" is **exact, not greedy**. A card only matters here for *which*
objectives it claims, so cards collapse onto a small set of claim-patterns — a
wallet with 164 eligible templates has 37. Deduplicating on that turns "choose
3 of 164" into "choose 3 of 37" and an exhaustive search runs in about 3ms,
which matters once the three-card cap makes greedy able to strand value.

### Reading a recruit

Stats are stored at **ten times** their displayed value — the original's own
indicator confirms it, multiplying the shown number by 10 before comparing it
to the raw class bands. So `damage_min: 178` is 17.8, and a resistance of 800
is 80%.

A recruit's stats are ranges, shown the way the original shows them: the
midpoint, then how far the roll can swing — `29 (+-12)` — both floored. A bare
range is honest but harder to compare between recruits.

Two stats are also mislabelled by their contract names: `attackspeed` and
`initiative` are a **cooldown** and a **wind-up**, so lower is better. They are
shown under those names.

The arrows grade a roll against `creation.ale`'s `classtemps` band for that
class, using the original's six-bucket formula. A recruit has a *range* rather
than a settled stat, so the midpoint is graded — the roll to expect. Taunt gets
no arrow: it is a role, not a quality. Resistances have their own scale in the
original — fractions of the class ceiling rather than a floor-to-ceiling band —
and that is what's used here.

The recruit is shown with its class artwork over its elemental backdrop, both
from the original set. The class SVGs average 867KB (one is 5MB), so they are
rasterised by the same thumbnail script: 80MB down to 2.2MB.

Ability rarity is parsed from the display name — "Strong [rare]" — and coloured
with the original's palette.

Ability descriptions carry placeholders for their own numbers, in the form
`[<group>:<index>:<field>]` — `[if:0:value]` means `if_effects[0].value`, with
`bf` and `eof` pointing at the other two effect arrays. The live site never
substitutes these and prints the raw token at the player. They are resolved
here, and shown **unsigned**: the contract stores a debuff as a negative, and
"reduces attacker health by -44" reads as a double negative.

Targeting is stored as `enemy_<stat>_<min|max>` and rendered through the
original's label map — `enemy_taunt_max` is "Highest Taunt".

Inventory is resolved in two AtomicAssets requests, not thousands: one
`accounts/{wallet}/alien.worlds` call returns every template owned with counts
(~160 rows for a wallet holding ~4,800 assets), and asset ids are only looked
up for the cards actually chosen, at hire time.

Card art is local. The original serves the full-size images — 587KB on average,
up to 1.5MB — into a 96px tile; a single screen was over 10MB.
`scripts/make-card-thumbs.mjs` resizes the set once, 285MB to 3MB.

### Building multipliers

The chain stores `boost_score` on a 0–1,000,000 scale and the game shows it as
a multiplier where 100,000 reads 1.0x. The stored value is almost always stale:
`maps.cpp` only rewrites it when someone touches the land, and decays it by
`boost_decay_per_hour` for every whole hour since `boost_score_update`. The UI
ages it forward so the number matches what the contract would use right now.

### Land IDs

`users::getlandname` maps each decimal digit to a letter (`0→a … 9→j`) and
joins the coordinates with an `x`: `(19,10)` → `bjxba`. Implemented in
`src/chain/landId.ts`, verified against live rows.

The playable grid is **40×20** (x and y from 1). The contract's bounds allow 0,
but no land row exists at x=0 or y=0 on any planet — every planet holds exactly
800 lands, and travelling into row/column 0 would fail the contract's
`require_find`.

### The dungeon and the battle

A dungeon sits on a land as `buildings[0]`. `dungeons.ale`/`dungeons` is scoped
by planet and keyed by land id, and holds the team that land fields. One run
per dungeon per day, tracked in the player's `played_dungeons` — which is only
meaningful read alongside `last_dungeon_reset`, since a stale list keeps
yesterday's land ids until the next run overwrites it.

`playdungeon` takes five fighters, one `crew.worlds` card, one `arms.worlds`
card and a difficulty, then calls `battle.ale::fight` inline and spends 40
energy. It refuses if the player is not standing on the land, and `fight`
refuses again if the building's `boost_score` has decayed to zero — "has not
been maintained for a while by the land owner".

A fighter is only usable while `next_payday` is still in the *future*. That
reads backwards, but the contract's check is
`next_payday >= now`: once the date passes, the fighter is asking to be paid
and cannot be sent out.

**Difficulty is unbounded in the contract but self-limiting in practice.**
Enemy health and damage scale by `level_mod` (1.15) to the power of the
difficulty, then by a `difmod` percentage that holds the first three levels
back to 55/70/85% — level 4 and up run at full strength. Rewards scale by
`dungeon_difficulty_power_mod` (1.07) to the same power. So the enemy compounds
faster than the payout and the ladder has a ceiling the contract never names.
From difficulty 5 the dungeon also fields its own NFT fighter. The screen
offers 1–20 and shows both multipliers side by side rather than picking a
limit for the player.

#### Crew and weapon cards are chosen by design, not by asset

`playdungeon` is signed with concrete asset ids, but any copy of a card does
equally. Real wallets make that distinction matter: one player holds 1,267
`crew.worlds` assets across just **34 designs**, and 1,272 `arms.worlds`
assets across 54. Listing assets means paging thousands of rows to show the
same card hundreds of times.

So the picker lists designs. Three cached requests — the two schema
catalogues (114 crew and 170 weapon templates, identical for everyone and
effectively static) plus one inventory call — intersected to give the
player's distinct cards with a count each. An asset id is resolved with one
further request at the moment the run is signed.

#### Crew and weapon are not equipment — they are a sixth fighter

`battle::getFighterFromNFT` fuses the two cards into a combatant that fights
alongside your five, and the split is not symmetric:

- every stat is the plain **sum** of the two cards
- the **element comes from the weapon** alone, which decides what the
  fighter's damage gets resisted by
- class, race and target come from the crew
- abilities are the crew's followed by the weapon's, both kept

Two things about the live data make that less tidy than it sounds. **No crew
row on chain carries a class or a race** — all 108 are blank — so the fighter
is always nameless and uses its own `bonus_fighter_avatar` art rather than
class art. And only 16 crew cards set a target at all; the rest fall through
to highest taunt.

The screen therefore shows the combined fighter as a sixth slot in your
line-up, not as a pair of equipment slots, with its summed stats and both
cards' abilities.

`fighters.ale`/`nftvalues` is where those values live: 272 rows, 108 crew and
164 weapons, read whole in one cached request. It is also a gate rather than
just a lookup — `getFighterFromNFT` does a `require_find` there, so a card
with no row makes `playdungeon` revert. Cards without one are left out of the
picker entirely, since a player cannot tell from the artwork which those are
and the only alternative is a wallet signature for a transaction that fails.

#### Filtering follows the live site, not a search box

A player picking a team asks structured questions — "which of my fire
fighters are free right now, sorted by damage" — and a free-text box answers
none of them. The original's controls are the right ones and are what the
picker uses:

- **element** as a multi-select of icons, since that is the one axis players
  think in sets about
- **class**, **race** and **status** as single-choice pickers, where status is
  the original's own wording: All / Available / Requests Payday / Arena /
  Market
- **sort** by level, health, damage, windup, cooldown or any of the six
  resistances
- **ability** as text, because ability names genuinely are free text

Two details are inherited from the original's implementation. Health and
damage are sorted **after age decay** — `age_decay ^ (days²)`, the same curve
`apply_weather_and_age` applies — because the undecayed range is not the
number the fighter will bring. And windup and cooldown sort ascending while
everything else sorts descending, because they are delays: the best fighter
is the one with the smallest.

#### The battle is replayed, not recorded

This is the part worth knowing. `battle.ale`/`fights` stores the opening
line-ups, the winner as a bare string, and the number of blows. It does *not*
store a turn-by-turn log — `team1_end_fighters` and `team2_end_fighters` are
declared on the table and never written, so they always come back empty. The
only thing the row adds after the fact is each of your fighters' closing
`battlestats`, merged back onto the opening record with the four damage tallies
divided by ten.

Every frame of the animation is therefore recomputed on the client. That is
possible because **the combat loop contains no randomness at all**. Every roll
happens before the first blow, when stats are drawn from each fighter's min/max
ranges, and those rolled values are exactly what the row stores. From there the
loop is deterministic:

- lowest `initiative` in each team steps forward; ties go to team 1
- the attacker's `target` picks a defender — only `enemy_<stat>_<min|max>` names
  a stat, everything else falls through to highest taunt
- damage is `floor(attacker.damage × max(0, 100 − floor(resistance/10)) / 100)`,
  clamped to the defender's remaining health
- a surviving defender loses `taunt_deduction` (100) taunt; a defender that
  drops keeps its taunt. The attacker adds its `attackspeed` to its own
  initiative
- ties in every min/max lookup keep the *first* fighter, matching
  `std::min_element`, so stored team order is load-bearing
- a thousand blows with both sides standing is a draw

`src/dungeon/sim.ts` mirrors this exactly, including the `uint16` truncation
and the stat caps. Verified two ways: replaying a live `fights` row reproduced
the recorded turn count, the recorded winner, and every fighter's closing
`battlestats` exactly; and cross-checking against an independent implementation
over 90 pairings of real dungeon teams matched on every single turn — attacker,
defender, raw damage, blocked, effectiveness and turn count.

The per-attack ability pass (`ifeffect`) is implemented too, though no dungeon
team on chain currently carries an ability that fires during combat: of 170
abilities across all 10 live dungeon teams, none combine `on_fight_start` with
`on_attack`/`on_defense` and a non-empty `if_effects`. That is why the simpler
reference implementation agreed with the chain in the first place.

#### Fight rows expire in 60 seconds

`deloldfights` erases any row older than a minute, and a bot calls it
regularly. So the client picks the `history_id` itself before signing (a random
account name), polls hard for the row straight after the transaction, and
copies it into sessionStorage the moment it lands. After that the replay no
longer touches the chain, and can be paused, sped up, restarted or survived
across a reload. A replay opened later than that is reported as gone rather
than faked.

## Keeping chain reads down

`src/chain/` is a small client built around not making requests.

- **Health-probed endpoint pool.** All 12 candidate nodes are probed in
  parallel at boot; ones that are down or lagging >120s behind head are
  dropped. Reads round-robin across the fastest four and fail over on error,
  benching a node for 60s when it fails. Visible in the top bar, with a
  re-check button.
- **No CORS preflight.** Requests go out as `text/plain;charset=UTF-8`, which
  is CORS-safelisted. `application/json` is not, so every read would otherwise
  cost an extra OPTIONS round trip — and `wax.greymass.com` answers preflights
  with HTTP 400, which Chrome treats as a hard rejection. eosio never inspects
  the content type.
- **Two-tier cache** (memory + localStorage) with per-table TTLs: config and
  avatars ~12h, land grid ~10min, player row 15s.
- **Request coalescing** — identical in-flight reads share one promise. A
  *forced refresh* coalesces only with other forced refreshes: letting it
  piggyback on a read that started before the change it is trying to observe
  defeats the point of forcing it.
- **State the contract guarantees is applied locally**, not waited for. After a
  hire the contract always clears `last_tavern`, so the UI clears it too and
  treats the follow-up read as confirmation. Reads rotate across nodes and one
  a block behind still returns the old row — which is what left the map
  offering "Enter Tavern" for a tavern that had just been used.
- **A planet costs one request.** 800 rows fit in a single `limit: 1000` page.
  The planet on screen loads first; the other five are warmed one at a time in
  the background, because the planet switcher needs all six to show its counts.
  `livearena` is only fetched for planets that actually contain an arena.

## Performance

Initial load is **~64KB gzipped** (app + React + router + CSS). WharfKit is
184KB gzipped and lives behind a dynamic import, so a visitor reading the
landing page never downloads a wallet SDK. On boot the app checks
`localStorage` for WharfKit's session key directly and only pulls the SDK in if
a session could actually be restored.

The map is a single canvas and takes the whole frame — no page gutter, no
reading-width cap, no stacked bars. The planet switcher, legend, zoom, "find
me" and the tile inspector all float over it, so none of them costs the map any
height. It opens at "cover" zoom so the art fills the panel; zooming out still
reaches the whole planet.

Its height is `100%` of the shell's main grid row rather than a `calc()`
against the viewport — the row is already sized to whatever the top bar and tab
bar leave over, so it can't drift when their real heights differ from the
tokens by a border or a safe-area inset.

The original ships 4,800 separate 50×50 tile JPEGs — 800 HTTP requests to open
one planet. Every one of those tiles is a crop of a 2000×1000 planet image that
also ships, so the map draws that instead: one request, one decode, and
pan/zoom is one `drawImage` per frame. The land inspector's thumbnail is the same
image offset behind a 64px window, so it costs nothing extra.

Over the artwork it draws the original vector markers for taverns, dungeons,
arenas and portals, each labelled at close zoom with the building's current
multiplier or the portal's destination planet. Below a zoom threshold markers
drop to coloured dots and labels disappear, because a 10px icon is just noise.

Other things aimed at low-end devices:

- Device-pixel-ratio capped at 2 (1 in reduced-effects mode).
- One-off repaints draw synchronously rather than via `requestAnimationFrame`.
  rAF is not guaranteed to run — a backgrounded tab or a webview that isn't
  compositing will sit on the callback, and the map would stay blank until the
  player dragged it.
- No `backdrop-filter` anywhere; flat tinted fills instead.
- A **reduced effects** toggle in Profile (auto-enabled from `deviceMemory` /
  `hardwareConcurrency`) that drops background art, glows and the high-DPI
  buffer without changing a single colour.

## Design

The tokens in `src/styles/tokens.css` are the game's real ones, lifted from the
live site's Stitches theme — the magenta-to-cyan primary gradient, the violet
panels, yellow Orbitron headings, Titillium Web body. Icons, key art, menu
artwork and planet maps in `public/assets/` are the originals.

Changes are execution, not identity:

- The landing page's sections used to render as dark cards on an unstyled white
  page. The artwork now carries through behind them.
- The original had a desktop menu only. Mobile now gets a bottom tab bar for
  the five most-used screens plus a "More" sheet — the standard mobile-game
  pattern.
- The map takes the full width; the tile inspector and legend float over it.
- The planet switcher carries live counts, so the choice of where to go next is
  made from the switcher rather than by visiting each planet.
- Travel cost is computed client-side from `config` and shown before you
  commit, instead of failing in the wallet.
- Currency values flash briefly when they change.
- The "you are here" marker is red with a white collar, not blue: cyan already
  means "selected tile" and is the UI's general accent, so the player was
  competing with it.
  It is a DOM node rather than canvas paint so its pulse animates on the
  compositor — animating it on canvas would mean redrawing 800 tiles and a
  2000×1000 image every frame to move one dot.
- Land rarity and terrain type are not surfaced — neither affects play.
- Building level is not shown either: every building on chain is level 1.

## Not built yet

The menu lists every system whose contracts are live. My Land, Fighters, Arena,
Dungeons, Ascension, Quests, Tournament, Leaderboard and Market are routed and
labelled but render a placeholder.

The **Dungeons** menu entry is still one of those placeholders, and means
something different from what is built: it would be a directory of every
dungeon across the planets plus the rating leaderboard. What exists is the run
itself — you enter the dungeon you are standing on, from the map.

Built so far: landing, wallet connect, signup, the game shell, the world map,
the tavern, the shop, and the dungeon run with its animated battle.
