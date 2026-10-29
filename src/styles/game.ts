/**
 * The game's stylesheets: everything past the door.
 *
 * main.tsx carries only what the first page needs (the landing page, the
 * wallet picker, the maintenance screen), so a phone opening the site parses
 * a fraction of the CSS before it can paint. Every lazy screen loads this
 * alongside its own code (lazyScreen in App.tsx), so no game screen ever
 * paints without it.
 *
 * Kept in the order main.tsx used to import them all in: the cascade every
 * screen was built against. The first-page sheets come ahead of these.
 */
import './guide.css'
import './map.css'
import './tavern.css'
import './shop.css'
import './market.css'
import './fighters.css'
import './quests.css'
import './tournament.css'
import './lands.css'
import './farming.css'
import './leaderboard.css'
import './candle.css'
import './account.css'
import './dungeon.css'
import './battle.css'
import './honours.css'
import './landstage.css'
import './chronicle.css'
import './briefing.css'
