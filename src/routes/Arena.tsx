import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { landId } from '@/chain/landId'
import { fetchSchemaTemplates, resolveAssetIds, type CardTemplate } from '@/chain/atomic'
import { fetchPlanetLands } from '@/chain/queries'
import {
  fetchCrewCards,
  fetchFight,
  fetchRoster,
  randomHistoryId,
} from '@/dungeon/queries'
import { fighterAvailable, nftFighterLast, withNumericIds } from '@/dungeon/rules'
import { EMPTY_FILTER, type RosterFilter } from '@/dungeon/filters'
import { FilterDrop } from '@/fighters/DeskRoster'
import {
  battleAsFlat,
  enemyProfile,
  matchupBetween,
  matchupsFor,
  teamOutlook,
  type FlatFighter,
} from '@/fight/matchup'
import { recallTeam, rememberTeam, restoreTeam } from '@/fight/lastTeam'
import { autoPickCards, autoPickCardsByOdds, autoPickFighters } from '@/fight/autopick'
import { AutoPickSplit } from '@/fight/AutoPickSplit'
import { AutoPickCards } from '@/fight/AutoPickCards'
import { applyWeather, fetchWeather } from '@/fight/weather'
import {
  NFT_FIGHTER_ART,
  combineNftFighter,
  combineNftFlat,
  nftAsPanel,
} from '@/dungeon/nftFighter'
import { rememberFight } from '@/dungeon/fightStore'
import { TEAM_SIZE, type BattleFighter, type RosterFighter } from '@/dungeon/types'
import { fetchArenaPower, fetchLiveArena } from '@/arena/queries'
import {
  ARENA_POWER_FULL,
  NFT_FIGHTER_ID,

  alreadyDefending,
  applyArenaPower,
  arenaMaintained,
  arenaPowerPercent,
  canChallenge,
  myDefenders,
} from '@/arena/rules'
import {
  formatScaled,
} from '@/tavern/fighterStats'
import {
  CardGrid,
  CombatCard,
  DetailSheet,
  enemyNftPanel,
  nftCards,
  MatchupReadout,
  CardsToolbar,
  FighterGrid,
  WeatherPanel,
  POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
  MarkerLine,
  RosterFilters,
  VersusFloors,
  battlePanel,
  mid,
  rosterPanel,
  recallDensity,
  rememberDensity,
  PickDensitySwitch,
  PickViewSwitch,
  type Detail,
  type PickDensity,
  type PickView,
  type Tab,
} from '@/fight/setup'
import { fieldedStats, levelFactor, ageFactor } from '@/fight/scaling'
import { oddsTitle, teamOdds } from '@/fight/odds'
import { OddsCentre, WinChance } from '@/fight/OddsCentre'
import { DIRTIES, playArena } from '@/wharf/actions'
import { settle } from '@/wharf/settle'
import { readableError } from '@/wharf/errors'
import { asset } from '@/assets'
import { Loading } from '@/components/Loading'
import { usePhone } from '@/components/usePhone'
import { useSwipeToClose } from '@/components/useSwipeToClose'
import { useConfig, useLazyConfig } from '@/state/useConfig'
import { useChainQuery } from '@/chain/useChainQuery'

/**
 * Challenging an arena.
 *
 * The same setup as a dungeon — five fighters plus a crew/weapon pair — but a
 * different opponent and a different price. An arena holds one standing team
 * of *other players'* fighters. There is no difficulty ladder and no daily
 * limit; what varies is `arena_power`, which scales the defenders and falls
 * every time somebody fails to beat them.
 *
 * Two things a dungeon never asks of the player, both surfaced before they
 * commit: you cannot challenge an arena you already hold a place in, and
 * winning leaves one of your five behind to defend it.
 */
const EMPTY_CARDS: CardTemplate[] = []

export default function Arena() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)
  const navigate = useNavigate()

  const land = landId(player.x, player.y)
  const planet = player.planet

  /*
     One read for the whole setup: this wallet's roster and cards, who is
     standing in the arena, how far its power has decayed, and the tile the
     arena sits on. The five were fetched together already — they are now
     answered together as well, so there is one loading state rather than
     three flags that could disagree.
  */
  const setup = useChainQuery(
    `arena:${player.wallet}:${planet}:${land}`,
    async () => {
      const [r, cards, live, power, lands] = await Promise.all([
        fetchRoster(player.wallet),
        fetchCrewCards(player.wallet),
        fetchLiveArena(planet, land, true),
        fetchArenaPower(planet, land, true),
        fetchPlanetLands(planet),
      ])
      return {
        roster: r,
        crewCards: cards.crew,
        weaponCards: cards.weapons,
        arena: live,
        /*
           `battle.cpp` reads the stored `arena_power` at the moment of the
           fight — it does not age it forward first. A cron decays every arena
           every few minutes, so the stored value is what the fight will use
           and what belongs on screen.
        */
        arenaPower: power ? Number(power.arena_power) : ARENA_POWER_FULL,
        tile: lands.find((l) => l.land_id === land),
      }
    },
    { deps: ['fighters', 'arena'] },
  )
  const roster = setup.data?.roster ?? null
  const crewCards = setup.data?.crewCards ?? EMPTY_CARDS
  const weaponCards = setup.data?.weaponCards ?? EMPTY_CARDS
  /* Whether the card lists have been read at all, as against being empty. */
  const cardsLoaded = !!setup.data
  const arena = setup.data?.arena

  /*
     The defenders' stored health and damage, by fighter.

     What the cards show is those figures put through the defender's own level
     and age and then the arena's power, which is four times the stored number
     on a level 10 fighter — so the grade arrows are given the stored one.
  */
  const enemyBase = useMemo(
    () =>
      new Map(
        withNumericIds(arena?.fighters ?? []).map((f) => [
          f.fighter_id,
          { health: f.health, damage: f.damage },
        ]),
      ),
    [arena],
  )

  /*
     The whole crew and weapon catalogue, to name the cards behind the
     opposing NFT fighter. The player's own cards are read through the same
     two catalogues, so this is a cache hit.
  */
  const catalogue = useChainQuery('card-catalogue', async () => {
    const [crewTemplates, weaponTemplates] = await Promise.all([
      fetchSchemaTemplates('crew.worlds'),
      fetchSchemaTemplates('arms.worlds'),
    ])
    return new Map([...crewTemplates, ...weaponTemplates])
  })
  const arenaLoaded = !!setup.data
  const arenaPower = setup.data?.arenaPower ?? ARENA_POWER_FULL
  const tile = setup.data?.tile

  /*
     What the fight is scaled by, from the store. The dungeon reads the same
     five and used to fetch them separately — an arena and a dungeon are the
     same fight with a different opponent, and they disagreed about nothing
     except how many round trips it took to find out.
  */
  const {
    classes,
    nftValues,
    levelMod,
    ageDecay,
    caps,
    battle,
    loaded: configLoaded,
  } = useConfig()
  const xpPerWin = Number(battle?.xp_per_arena_win ?? 0)
  const energyCost = Number(useLazyConfig('arena')?.energy_cost ?? 50)
  /* Taunt lost per blow taken: the one knob the simulated fight needs. */
  const tauntDeduction = useLazyConfig('fightCost')

  const [teamIds, setTeamIds] = useState<number[]>([])
  const [crew, setCrew] = useState<CardTemplate | null>(null)
  const [weapon, setWeapon] = useState<CardTemplate | null>(null)

  const [tab, setTab] = useState<Tab>('fighters')
  /* A phone keeps the roster in a sheet over the fight, as the dungeon does. */
  const [sheet, setSheet] = useState(false)
  /* The sheet's card size: the same setting as the dungeon's sheet. */
  const [sheetDensity, setSheetDensity] = useState<PickDensity>(() => recallDensity(true))
  /* A desktop's card size and readout, held here for the toolbar that switches them. */
  const [deskDensity, setDeskDensity] = useState<PickDensity>(() => recallDensity())
  const chooseDeskDensity = (next: PickDensity) => {
    setDeskDensity(next)
    rememberDensity(next)
  }
  const [pickView, setPickView] = useState<PickView>('combat')
  const chooseSheetDensity = (next: PickDensity) => {
    setSheetDensity(next)
    rememberDensity(next, true)
  }
  /*
     A phone has no hover and no room for a remove bar under every card, so
     a tap picks a fighter out and the toolbar under the line becomes that
     fighter's: details, change, remove. A number is a roster fighter;
     'nft' is the crew-and-weapon sixth.
  */
  const [focus, setFocus] = useState<number | 'nft' | null>(null)
  /* Scrolled to from the empty fighter slots, three panels above it. */
  const picker = useRef<HTMLElement>(null)
  /* The phone's sheet closes on a swipe down from its head, too. */
  const { grip: sheetGrip } = useSwipeToClose(() => setSheet(false), picker)
  const [filter, setFilter] = useState<RosterFilter>(EMPTY_FILTER)
  /* A lens on the roster rather than a filter: it hides nothing, and Clear
     restores `EMPTY_FILTER`, which this is deliberately not part of. */
  const [atLevelOne, setAtLevelOne] = useState(false)
  const [cardQuery, setCardQuery] = useState('')
  const [detail, setDetail] = useState<Detail>(null)
  /* Reported by the grid, shown by the filters that decide it. */
  const [shownCount, setShownCount] = useState<{ shown: number; total: number } | null>(null)
  const countFighters = useCallback(
    (shown: number, total: number) =>
      setShownCount((c) => (c && c.shown === shown && c.total === total ? c : { shown, total })),
    [],
  )

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /*
     The land's weather, which every fight here is fought in.

     Read from `landtracking` rather than guessed: `rndweather` re-rolls on
     travel, and the player is standing on this land, so the row is already
     the one the fight will use.
  */
  const weatherQuery = useChainQuery(`weather:${planet}:${land}`, () =>
    fetchWeather(planet, land),
  )
  /* Weather is context, not a blocker: a failed read leaves it off. */
  const weather = weatherQuery.data ?? null

  const usableCrew = useMemo(
    () => crewCards.filter((c) => nftValues.has(c.template_id)),
    [crewCards, nftValues],
  )
  const usableWeapons = useMemo(
    () => weaponCards.filter((c) => nftValues.has(c.template_id)),
    [weaponCards, nftValues],
  )

  /*
     The defenders as they will actually be fielded, in the contract's own
     order: level and age first, then `apply_arenapow`.

     The level step is the one that matters. `fight()` passes 0 as the
     difficulty for an arena, and `apply_weather_and_age` reads 0 as "use the
     fighter's own level" rather than "no scaling" — so a level 10 defender
     enters at four times its stored health. Showing the stored numbers here
     would understate the whole enemy team by that factor.
  */
  const enemies = useMemo(
    () =>
      applyArenaPower(
        /* Sixth on the row, wherever the chain happens to keep it. */
        nftFighterLast(withNumericIds(arena?.fighters ?? [])).map((f) =>
          /* Weather, then level and age, then the arena's own power — the
             order `fight()` runs them in, and not interchangeable: the
             weather percentage compounds with the level curve rather than
             landing on top of it. */
          fieldedStats(
            applyWeather(f, weather, caps),
            f.level,
            f.creation_date,
            levelMod,
            ageDecay,
          ),
        ),
        arenaPower,
      ),
    [arena, arenaPower, levelMod, ageDecay, weather, caps],
  )

  /*
     How every fighter in the roster stands against these particular
     defenders.

     One table, read by four things: the badges on the cards, the matchup
     filters, the matchup sorts and auto-pick. Recomputed when the arena's
     power changes, because that is what decides how large the defenders
     actually are.
  */
  const matchups = useMemo(
    () => matchupsFor(roster ?? [], enemies, levelMod, ageDecay),
    [roster, enemies, levelMod, ageDecay],
  )

  const profile = useMemo(() => enemyProfile(enemies), [enemies])

  const byId = useMemo(() => {
    const m = new Map<number, RosterFighter>()
    for (const f of roster ?? []) m.set(f.fighter_id, f)
    return m
  }, [roster])

  const picked = useMemo(
    () => teamIds.map((id) => byId.get(id)).filter(Boolean) as RosterFighter[],
    [teamIds, byId],
  )

  const team = useMemo(() => {
    const slots: (RosterFighter | null)[] = Array(TEAM_SIZE).fill(null)
    picked.forEach((f, i) => {
      if (i < TEAM_SIZE) slots[i] = f
    })
    return slots
  }, [picked])

  /* The same two cards unscaled, for the simulated fight. */
  const nftFlat = useMemo(
    () =>
      combineNftFlat(
        crew ? (nftValues.get(crew.template_id) ?? null) : null,
        weapon ? (nftValues.get(weapon.template_id) ?? null) : null,
      ),
    [crew, weapon, nftValues],
  )

  const nftFighter = useMemo(
    () =>
      combineNftFighter(
        crew ? (nftValues.get(crew.template_id) ?? null) : null,
        weapon ? (nftValues.get(weapon.template_id) ?? null) : null,
      ),
    [crew, weapon, nftValues],
  )

  const holding = alreadyDefending(arena, player.wallet)
  const mine = myDefenders(arena, player.wallet)
  const block = canChallenge(
    team,
    !!crew,
    !!weapon,
    player,
    energyCost,
    arena,
    tile,
  )

  /*
     The last team the player challenged with, put back.

     Kept separately from the dungeon team: they are different choices, and a
     fighter defending an arena cannot challenge one. A remembered fighter
     that has since been listed on the market, sent to defend or fallen due
     for a payday is dropped rather than restored — the contract refuses all
     three, so putting one back would leave the Challenge button dark with no
     visible cause. What was dropped is said out loud for the same reason.
  */
  const restored = useRef(false)
  /** Set by the restore, so its own state change is not saved back. */
  const skipSave = useRef(false)
  const [restoreNote, setRestoreNote] = useState<string | null>(null)

  /*
     Nothing is restored until the cards have loaded, not just the roster.

     `restoreTeam` resolves a remembered card by looking it up in the
     usable lists, and an empty list is indistinguishable from "you no
     longer own this" — so running early dropped the crew and the weapon,
     and `restored.current` meant it never tried again.
  */
  useEffect(() => {
    if (restored.current || !roster || !cardsLoaded) return
    restored.current = true

    const usable = new Map(roster.map((f) => [f.fighter_id, fighterAvailable(f)]))
    const back = restoreTeam(recallTeam('arena', player.wallet), {
      teamSize: TEAM_SIZE,
      usable,
      crewCards: usableCrew,
      weaponCards: usableWeapons,
    })

    /*
       Putting the team back is not a choice the player made, so it must
       not be written back over the one they did make. Without this the
       save below fired on the restore itself — and a restore that could
       not resolve a card wrote null over it, which is how a weapon left
       the stored team for good rather than just for this visit.
    */
    if (back.fighterIds.length || back.crew || back.weapon) skipSave.current = true

    if (back.fighterIds.length) setTeamIds(back.fighterIds)
    if (back.crew) setCrew(back.crew)
    if (back.weapon) setWeapon(back.weapon)

    if (back.dropped.length) {
      const named = back.dropped.map((d) => {
        const f = roster.find((r) => r.fighter_id === d.id)
        return `${f ? f.classname : `#${d.id}`} (${d.reason})`
      })
      setRestoreNote(`Left out of your last team: ${named.join(', ')}.`)
    }
  }, [roster, cardsLoaded, usableCrew, usableWeapons, player.wallet])

  /* Kept current from here on, so leaving without fighting still saves it. */
  useEffect(() => {
    if (!restored.current) return
    /* Exactly one save is skipped: the one the restore itself caused. */
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    rememberTeam('arena', player.wallet, {
      fighterIds: teamIds,
      crew: crew?.template_id ?? null,
      weapon: weapon?.template_id ?? null,
    })
  }, [teamIds, crew, weapon, player.wallet])

  const toggleFighter = useCallback((f: RosterFighter) => {
    setTeamIds((ids) => {
      if (ids.includes(f.fighter_id)) return ids.filter((id) => id !== f.fighter_id)
      if (ids.length >= TEAM_SIZE) return ids
      return [...ids, f.fighter_id]
    })
  }, [])

  /*
     Ranked on the matchup rather than on raw damage, and the cards chosen as
     a pair — the same reasoning as the dungeon, against a different line.

     Unlike the old version this overwrites the cards already in the slots
     instead of only filling empty ones. Auto-pick is asking the screen what
     it would field here; leaving a card the player chose for some other
     opponent in place made the answer half theirs and half its own.
  */
  /*
     Two suggestions, not one.

     They answer different questions and a player usually has an opinion about
     one of them already: replacing a line-up somebody chose by hand because
     they wanted a view on the cards is the kind of help nobody asks for
     twice.
  */

  /*
     One button, rendered in one of two places.

     On a desktop it belongs on the "Your team" line: there is a gap there
     between the name and the totals, and a control that replaces the
     line-up reads best on the line that names it. A phone header has no
     spare width — the totals already wrap — so there it goes under the row.
  */

  /*
     Auto-pick with a choice of pool: Suggested, Levels, or by marker, and a
     switch for what happens to a team that already has fighters in it. The
     ranking is unchanged — the fighters that suit this opponent best, among
     the ones the mode allows. `keep` are the ones to leave where they are:
     they are taken out of the pool so none is placed twice, and the picks
     fill the slots left over.
  */
  const phone = usePhone()

  /*
     Where a fighter or a card gets chosen. A phone has the fight on one
     screen and slides the roster up over it; a wider screen scrolls down to
     where the roster stands under the line-up.
  */
  const openPicker = (next: Tab) => {
    setTab(next)
    if (phone) setSheet(true)
    else picker.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const autoPickButton = (
    <AutoPickSplit
      roster={roster}
      teamIds={teamIds}
      teamSize={TEAM_SIZE}
      onRestore={setTeamIds}
      onPick={(eligible, keep) => {
        const held = new Set(keep)
        const pool = eligible.filter((f) => !held.has(f.fighter_id))
        const ids = autoPickFighters(pool, matchups, TEAM_SIZE - keep.length)
        setTeamIds([...keep, ...ids])
        return ids.length
      }}
    />
  )

  /*
     The pair is chosen by fighting with it, the same measure the bar in the
     middle reports. Ranking the fused fighter on its own reads well and
     picks badly: against a real line-up it gave 76% where the best pair gave
     86%. Falls back to that ranking only when there is no fight to simulate
     — no opponent yet, or the fight config still loading.
  */
  const autoPickCardsOnly = useCallback(() => {
    /* Stored order, as the simulated fight needs it — see the bar below. */
    const raw = withNumericIds(arena?.fighters ?? [])
    const pick =
      tauntDeduction !== undefined && raw.length
        ? autoPickCardsByOdds({
            enemies: raw,
            crewCards: usableCrew,
            weaponCards: usableWeapons,
            values: nftValues,
            current: { crew, weapon },
            rate: (crewValue, weaponValue, runs) =>
              teamOdds({
                picked,
                nft: combineNftFlat(crewValue, weaponValue),
                enemies: raw,
                scaling: { venue: 'arena', power: arenaPower, fullPower: ARENA_POWER_FULL },
                tauntDeduction: tauntDeduction!,
                fielding: { weather, caps, levelMod, ageDecay },
                runs,
              })?.winRate ?? 0,
          })
        : autoPickCards({
            enemies,
            crewCards: usableCrew,
            weaponCards: usableWeapons,
            values: nftValues,
          })
    setCrew(pick.crew)
    setWeapon(pick.weapon)
    return pick
  }, [enemies, usableCrew, usableWeapons, nftValues, picked, crew, weapon, arena, arenaPower, tauntDeduction, weather, caps, levelMod, ageDecay])

  /*
     One button, rendered in one of two places — like the fighters one.

     It belongs beside the slots it fills, which is inside the Loadout
     panel. That panel is shut by default, so on a phone the button was
     behind a fold: to auto-pick the pair you first had to open the thing
     that would have picked it for you. A phone gets it above the panel
     instead, where it is on screen whether the fold is open or not.
  */
  const autoPickCardsButton = (
    <AutoPickCards
      crew={crew}
      weapon={weapon}
      disabled={!usableCrew.length && !usableWeapons.length}
      onPick={autoPickCardsOnly}
      onRestore={(pair) => {
        setCrew(pair.crew)
        setWeapon(pair.weapon)
      }}
    />
  )

  const start = async () => {
    if (!session || !block.ready || !crew || !weapon) return
    setBusy(true)
    setError(null)
    setStatus('Finding your cards…')

    /* What the five have banked right now. The result screen subtracts this
       from the live roster to say what the run paid: the chain row carries
       experience fields on every fighter but writes zero into them, so there
       is no before on chain to subtract from. */
    const xpBefore = Object.fromEntries(
      picked.map((f) => [f.fighter_id, f.stats.experience]),
    )
    const historyId = randomHistoryId()
    try {
      const assets = await resolveAssetIds(player.wallet, [
        crew.template_id,
        weapon.template_id,
      ])
      const crewAssetId = assets.get(crew.template_id)
      const weaponAssetId = assets.get(weapon.template_id)
      if (!crewAssetId || !weaponAssetId) {
        throw new Error(
          'Could not find those cards in your wallet any more. Reload and pick again.',
        )
      }

      setStatus('Waiting for your signature…')
      await playArena(session, {
        planet,
        landId: land,
        x: player.x,
        y: player.y,
        crewAssetId,
        weaponAssetId,
        fighterIds: picked.map((f) => f.fighter_id),
        historyId,
      })

      setStatus('Fighting…')
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        const row = await fetchFight(historyId).catch(() => undefined)
        if (row) {
          /* With what the team had banked going in: the chain row's own
             experience fields are written as zero, so this is the only
             record of the before. */
          rememberFight(row, 'arena', xpBefore)
          void refreshPlayer({ force: true })
          /* As the dungeon: the fight is on chain, and this screen waits on
             the fight row rather than through `useAction`. */
          settle(DIRTIES.playArena)
          navigate(`/battle/${historyId}`)
          return
        }
      }
      setError(
        'The fight went through but its record could not be read back in time. ' +
          'Your energy was spent and the result stands; only the replay is lost.',
      )
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  const showFighter = useCallback(
    (f: RosterFighter) =>
      setDetail({
        kind: 'panel',
        panel: rosterPanel(f, levelMod, ageDecay),
        template: classes.get(f.classname),
      }),
    [classes, levelMod, ageDecay],
  )

  const showEnemy = useCallback(
    (f: BattleFighter) =>
      setDetail({
        kind: 'panel',
        panel: battlePanel(f, enemyBase.get(f.fighter_id)),
        template: classes.get(f.classname),
      }),
    [classes, enemyBase],
  )

  const showCard = useCallback(
    (c: CardTemplate) => {
      const value = nftValues.get(c.template_id)
      if (!value) return
      setDetail({ kind: 'panel', panel: nftAsPanel(value, c.name) })
    },
    [nftValues],
  )

  /* The phone's toolbar for a tapped card in the line-up — as the dungeon's. */
  const focused =
    focus === 'nft'
      ? nftFighter
        ? { name: 'NFT Fighter' }
        : null
      : (() => {
          const f = team.find((x) => x && x.fighter_id === focus)
          return f ? { name: f.classname, fighter: f } : null
        })()
  const focusBar =
    phone && focused ? (
      <div className="lineupfocus">
        <span className="lineupfocus__name">{focused.name}</span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() =>
            'fighter' in focused && focused.fighter
              ? showFighter(focused.fighter)
              : nftFighter && setDetail({ kind: 'panel', panel: nftFighter })
          }
        >
          Details
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setFocus(null)
            openPicker(focus === 'nft' ? 'crew' : 'fighters')
          }}
        >
          Change
        </button>
        <button
          type="button"
          className="btn btn--sm lineupfocus__remove"
          onClick={() => {
            if ('fighter' in focused && focused.fighter) toggleFighter(focused.fighter)
            else {
              setCrew(null)
              setWeapon(null)
            }
            setFocus(null)
          }}
        >
          Remove
        </button>
        <button
          type="button"
          className="lineupfocus__close"
          onClick={() => setFocus(null)}
          aria-label="Done"
        >
          ×
        </button>
      </div>
    ) : null

  /*
     Your own five, in the shape the matchup reads and the cards print.

     Team 1 is passed a difficulty of 0 as well, so it gets the same level and
     age treatment as the defenders. Their stats are still a min/max band
     rather than a settled roll, so the midpoint stands in for the roll to
     expect.

     One bag rather than two. This used to compute health and damage for the
     cards and then read attackspeed, taunt and the resistances straight off
     the fighter for the matchup — which was fine while nothing touched them,
     and stopped being fine the moment weather did. A roll that drops your
     air resistance has to reach the balance bar, and it only does if the
     numbers the bar reads come through the same pipe as the ones on screen.
  */
  const myFlat = useMemo<FlatFighter[]>(() => {
    const out: FlatFighter[] = picked.map((f) => {
      /* Mid roll, then weather, then level and age. The contract's order. */
      const base = applyWeather(
        {
          element: f.element,
          classname: f.classname,
          racename: f.racename,
          health: mid(f.stats.health_min, f.stats.health_max),
          damage: mid(f.stats.damage_min, f.stats.damage_max),
          attackspeed: mid(f.stats.attackspeed_min, f.stats.attackspeed_max),
          taunt: mid(f.stats.taunt_min, f.stats.taunt_max),
          initiative: mid(f.stats.initiative_min, f.stats.initiative_max),
          res_gem: f.stats.res_gem, res_metal: f.stats.res_metal, res_air: f.stats.res_air,
          res_fire: f.stats.res_fire, res_nature: f.stats.res_nature,
          res_neutral: f.stats.res_neutral,
        },
        weather,
        caps,
      )
      const factor =
        levelFactor(f.stats.level, levelMod) * ageFactor(f.creation_date, ageDecay)
      return {
        ...base,
        health: Math.trunc(base.health * factor),
        damage: Math.trunc(base.damage * factor),
        abilities: f.stats.abilities ?? [],
      }
    })

    /* `getFighterFromNFT`: stats add, the element comes from the weapon. */
    const cv = crew ? nftValues.get(crew.template_id) : undefined
    const wv = weapon ? nftValues.get(weapon.template_id) : undefined
    if (cv || wv) {
      const add = (pick: (v: typeof cv) => number) => (cv ? pick(cv) : 0) + (wv ? pick(wv) : 0)
      /* The sixth fighter stands on the same ground as the other five, so
         the weather reaches it too — by the crew card's class and race and
         the weapon's element, which is what it fights as. */
      out.push({
        ...applyWeather(
          {
            element: wv?.element ?? cv?.element ?? 'neutral',
            classname: cv?.classname ?? '',
            racename: cv?.racename ?? '',
            damage: add((v) => v!.stats.damage),
            health: add((v) => v!.stats.health),
            attackspeed: add((v) => v!.stats.attackspeed),
            taunt: add((v) => v!.stats.taunt),
            initiative: add((v) => v!.stats.initiative),
            res_gem: add((v) => v!.stats.res_gem),
            res_metal: add((v) => v!.stats.res_metal),
            res_air: add((v) => v!.stats.res_air),
            res_fire: add((v) => v!.stats.res_fire),
            res_nature: add((v) => v!.stats.res_nature),
            res_neutral: add((v) => v!.stats.res_neutral),
          },
          weather,
          caps,
        ),
        abilities: [...(cv?.ability ?? []), ...(wv?.ability ?? [])],
      })
    }
    return out
  }, [picked, crew, weapon, nftValues, weather, caps, levelMod, ageDecay])

  /*
     The balance bar, and the figures beside it.

     It used to be health times damage on both sides, which says a team of
     six is stronger than a team of five and nothing else. The defenders'
     resistances decide how much of your damage arrives, yours decide how
     much of theirs does, and abilities that only fire against a particular
     element or class swing fights the raw sums call even.
  */
  const outlook = useMemo(() => teamOutlook(myFlat, enemies), [myFlat, enemies])

  /*
     Every combatant on the screen against the line opposite it.

     The same computation both ways round — a defender's abilities read
     against my team is my team's abilities read against theirs with the
     arguments swapped — which is what lets the two rows be labelled honestly
     instead of one of them being "bonuses" and the other silence.

     `myFlat` is the picked fighters in order followed by the NFT fighter, so
     index i lines up with `picked[i]` and the last entry is the sixth.
  */
  const enemyFlat = useMemo(() => enemies.map(battleAsFlat), [enemies])
  const mySlots = useMemo(
    () => myFlat.map((f) => matchupBetween(f, enemyFlat)),
    [myFlat, enemyFlat],
  )
  const enemySlots = useMemo(
    () => enemyFlat.map((e) => matchupBetween(e, myFlat)),
    [enemyFlat, myFlat],
  )

  /*
     The balance bar: how often this team actually wins this fight.

     `teamOdds` fights it forty-nine times, rolling the stats each time the
     way the contract does, and counts the wins. The sixth fighter comes from
     `myFlat`, which is where the screen assembled it — the same object the
     totals above the bar are adding up, so the two cannot disagree.

     `outlook.share` stays as the fallback for the moment before the fight
     config lands, and for a read that fails outright. It is the old estimate,
     drawn in the same bar, rather than an empty one.
  */
  const odds = useMemo(() => {
    if (tauntDeduction === undefined) return null
    return teamOdds({
      picked,
      nft: nftFlat,
      /* The defenders as stored: levelling, weather and the arena's own
         power all belong after the buffs, which is where teamOdds puts them. */
      /*
         Stored order, not the display order.

         `nftFighterLast` moves the crew fighter to the end so the row reads
         as a team; the chain keeps it where the winner left it, fifth of six
         in every live arena. Team order is not cosmetic to a fight — it
         breaks ties on initiative and decides which fighter "lowest health"
         or "highest damage" finds first — so the simulated fight has to take
         the line in the order the contract will.
      */
      enemies: withNumericIds(arena?.fighters ?? []),
      scaling: { venue: 'arena', power: arenaPower, fullPower: ARENA_POWER_FULL },
      tauntDeduction,
      fielding: { weather, caps, levelMod, ageDecay },
    })
  }, [
    picked, nftFlat, arena, arenaPower, tauntDeduction, weather, caps, levelMod, ageDecay,
  ])

  const myShare = odds ? odds.winRate : outlook.share

  const counts: Record<Tab, number> = {
    fighters: roster?.length ?? 0,
    crew: usableCrew.length,
    weapon: usableWeapons.length,
  }

  const maintained = arenaMaintained(tile)

  /*
     Not until the screen knows what it is scaling by.

     The stats on this page are the roll multiplied by level and age, and
     before the battle config lands that multiplier is 1 — a level 10 fighter
     drawn at a quarter of its damage, for as long as it takes the config to
     answer. The dungeon already waits for exactly this; an arena is the same
     fight with a different opponent and should not behave differently.

     An error is its own answer and comes out from behind it, as it does
     there.
  */
  /* The setup read's own failure counts too, or a screen that cannot read
     the arena waits on a spinner with nothing to say. */
  const fault = error ?? setup.error

  if (!fault && !configLoaded) {
    return <Loading label="Entering the arena" />
  }

  /* My Fighters' filter panel, with what only a fight asks under "Against this team". */
  const filterPanel = (close: () => void, className: string) => (
    <FilterDrop
      className={className}
      fields={{
        roster: roster ?? [],
        filter,
        onFilter: setFilter,
        atLevelOne,
        onAtLevelOne: setAtLevelOne,
        versus: enemies.length > 0 && <VersusFloors filter={filter} onChange={setFilter} labelClass="drost__fhead" />,
      }}
      matching={shownCount?.shown ?? 0}
      onClear={() => setFilter({ ...EMPTY_FILTER, sort: filter.sort })}
      onClose={close}
    />
  )

  return (
    <div className="dungeon arena">
      <img className="dungeon__art" src={asset("/assets/background/bg-arena.png")} alt="" />
      <div className="dungeon__scrim" />

      <div className="dungeon__inner">
        <header className="dungeon__head">
          <div>
            <h1 className="page__title">Arena</h1>
            {/*
              The weather, where the coordinates used to be. A player standing
              on a tile does not need to be told which tile — the map put them
              here — but the roll they are about to fight under changes what
              team they should bring, and it belongs where they read the
              heading rather than further down the page. A phone has it beside
              the title, as the dungeon does, and the defenders' strength on
              the line under it, where the dungeon has its difficulty.
            */}
            {phone && <WeatherPanel weather={weather} />}
          </div>

          {!phone && (
            <>
              <span className="spacer" />
              {/*
                The dungeon's line, in the dungeon's shape: the day's weather,
                then the defenders' strength where the dungeon has the
                difficulty — two labels over their readings, not two boxes.
              */}
              <div className="dungeon__conditions">
                <WeatherPanel weather={weather} twin />
                {weather && <span className="dungeon__rule" aria-hidden="true" />}
                <ArenaStanding power={arenaPower} />
              </div>
            </>
          )}
          <span className="spacer" />
          <div className={`dungeon__actions${phone ? ' dungeon__actions--dock' : ''}`}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigate('/map')}
              disabled={busy}
            >
              Leave
            </button>
            <button
              type="button"
              className="btn btn--primary dungeon__go"
              onClick={() => void start()}
              disabled={busy || !block.ready}
              title={block.reason}
            >
              {busy && <span className="spinner" />}
              {busy ? (status ?? 'Fighting…') : 'Challenge'}
              {!busy && (
                <span className="dungeon__cost">
                  −{energyCost}
                  <img
                    src={asset("/assets/icons/energy.svg")}
                    alt="energy"
                    width={16}
                    height={16}
                  />
                </span>
              )}
            </button>
          </div>
        </header>

        {fault && <div className="alert alert--error">{fault}</div>}

        {/*
          The two refusals the contract makes are stated before the player
          spends any time picking a team, because neither is recoverable from
          this screen: one needs a win elsewhere, the other needs the
          landowner.
        */}
        {holding && (
          <div className="alert">
            You already hold this arena with{' '}
            {mine.length === 1 ? 'a fighter' : `${mine.length} fighters`}
            {mine.some((f) => f.fighter_id === NFT_FIGHTER_ID) && ' and your NFT fighter'}.
            The contract will not let you fight your own team — challenge a
            different arena, or wait to be knocked out of this one.
          </div>
        )}
        {arenaLoaded && !maintained && (
          <div className="alert alert--error">
            The landowner has let this arena decay, so it can no longer be
            challenged.
          </div>
        )}
        {arenaLoaded && maintained && !arena?.fighters.length && (
          <div className="alert">Nobody is holding this arena yet.</div>
        )}
        {restoreNote && (
          <div className="alert alert--note" role="status">
            {restoreNote}
          </div>
        )}

        {phone && (
          <div className="dungeon__phonestep">
            <ArenaReadout power={arenaPower} />
          </div>
        )}

        {/* A phone opens the matchup with the odds, above your team. */}
        {phone && <WinChance odds={odds} />}

        <section className="versus">
          <div className="versus__side versus__side--mine">
            <header
              className="versus__head"
              style={{ ['--share' as string]: `${myShare * 100}%` }}
              title={oddsTitle(odds, 'mine')}
            >
              <span className="versus__team">
                Your team
                <span className="versus__count">
                  {picked.length}/{TEAM_SIZE}
                </span>
              </span>
              <span className="versus__totals mono">
                {formatScaled(outlook.mine.damage)} DMG ·{' '}
                {formatScaled(outlook.mine.health)} HP
                
              </span>
            </header>

            {/*
               The matchup under the name, as plain text.
            */}
            <MatchupReadout side={outlook.mine} who="You" />

            <div className="versus__row">
              {team.map((f, i) =>
                f ? (
                  /* Fielded, like the header totals above and the picker
                     below: the line-up between them must not be the one place
                     still printing the stored roll. `myFlat` is
                     index-aligned with `picked`, the NFT fighter last. */
                  <CombatCard
                    key={f.fighter_id}
                    element={f.element}
                    classname={f.classname}
                    racename={f.racename}
                    level={f.stats.level}
                    health={myFlat[i]?.health ?? 0}
                    damage={myFlat[i]?.damage ?? 0}
                    side="mine"
                    abilities={enemies.length ? mySlots[i] : undefined}
                    onOpen={() =>
                      phone
                        ? setFocus((v) => (v === f.fighter_id ? null : f.fighter_id))
                        : showFighter(f)
                    }
                    selected={phone && focus === f.fighter_id}
                    marker={f.marker}
                    preview={() => ({
                      panel: rosterPanel(f, levelMod, ageDecay),
                      template: classes.get(f.classname),
                    })}
                    onRemove={phone ? undefined : () => toggleFighter(f)}
                  />
                ) : (
                  /* An empty slot takes you to where it gets filled: a plus
                     sign on a card-shaped hole is read as a control whether
                     or not it is one, and the grid that fills it is three
                     panels down the page. */
                  <button
                    type="button"
                    className="combatcard combatcard--empty"
                    key={`empty-${i}`}
                    onClick={() => openPicker('fighters')}
                    title="Choose a fighter for this slot"
                  >
                    <span className="combatcard__plus" aria-hidden="true">
                      +
                    </span>
                    <span className="combatcard__hint">Fighter {i + 1}</span>
                  </button>
                ),
              )}

              {nftFighter ? (
                <CombatCard
                  element={nftFighter.element}
                  classname="NFT Fighter"
                  racename={nftFighter.subtitle ?? ''}
                  health={nftFighter.health.min}
                  damage={nftFighter.damage.min}
                  side="mine"
                  abilities={
                    enemies.length && mySlots.length > picked.length
                      ? mySlots[mySlots.length - 1]
                      : undefined
                  }
                  art={NFT_FIGHTER_ART}
                  badge="NFT"
                  onOpen={() =>
                    phone
                      ? setFocus((v) => (v === 'nft' ? null : 'nft'))
                      : setDetail({ kind: 'panel', panel: nftFighter })
                  }
                  selected={phone && focus === 'nft'}
                  preview={() => ({
                    panel: nftFighter,
                    cards: [crew, weapon].filter((c): c is CardTemplate => !!c),
                  })}
                  /*
                     The sixth comes out the way it went in: it is not a
                     roster fighter, it is the crew and the weapon fused, so
                     removing it puts both cards back.
                  */
                  onRemove={
                    phone
                      ? undefined
                      : () => {
                          setCrew(null)
                          setWeapon(null)
                        }
                  }
                />
              ) : (
                /* The empty sixth opens the crew cards, which fill it. */
                <button
                  type="button"
                  className="combatcard combatcard--empty combatcard--nft"
                  onClick={() => openPicker('crew')}
                  title="Pick a crew card and a weapon card"
                >
                  <span className="combatcard__plus" aria-hidden="true">
                    +
                  </span>
                  <span className="combatcard__hint">
                    NFT Fighter
                    <em>crew + weapon</em>
                  </span>
                </button>
              )}
            </div>

            {/*
               Under the line-up it fills, as a toolbar.
            */}
            <div className="versus__pick">{focusBar ?? autoPickButton}</div>
            {!phone && (
              <div className="versus__cards">
                <CardsToolbar
                  crew={crew}
                  weapon={weapon}
                  autoPick={autoPickCardsButton}
                  onOpen={showCard}
                  onClear={(kind) => (kind === 'crew' ? setCrew(null) : setWeapon(null))}
                  onChoose={(kind) => openPicker(kind)}
                />
              </div>
            )}
          </div>
        {!phone && (
        <div className="versus__divider">
            <OddsCentre odds={odds} />
            {/*
               Each side's share of the matchup as one bar under the odds,
               where wider screens used to draw an underline under each name.
            */}
            <div className="versus__tug" aria-hidden="true">
              <i style={{ width: `${myShare * 100}%` }} />
            </div>
          </div>
        )}

          <div className="versus__side versus__side--enemy">
            <header
              className="versus__head"
              style={{ ['--share' as string]: `${(1 - myShare) * 100}%` }}
              title={oddsTitle(odds, 'theirs')}
            >
              <span className="versus__team">The defenders</span>
              <span className="versus__totals mono">
                {formatScaled(outlook.theirs.damage)} DMG ·{' '}
                {formatScaled(outlook.theirs.health)} HP
                
              </span>
            </header>
            <MatchupReadout side={outlook.theirs} who="They" />

            <div className="versus__row">
              {enemies.map((f, i) => (
                <CombatCard
                  key={`${f.fighter_id}-${i}`}
                  element={f.element}
                  classname={f.classname}
                  racename={f.racename}
                  /*
                     No level on the NFT fighter. It is a fused crew and
                     weapon rather than a levelled fighter, and the badge and
                     the level share the same corner — so passing both put an
                     L5 over the tag that says what the card is. Your own side
                     never passed one; the defenders’ side did.
                  */
                  level={f.fighter_id === NFT_FIGHTER_ID ? undefined : f.level}
                  health={f.health}
                  damage={f.damage}
                  side="enemy"
                  badge={f.fighter_id === NFT_FIGHTER_ID ? 'NFT' : undefined}
                  art={f.fighter_id === NFT_FIGHTER_ID ? NFT_FIGHTER_ART : undefined}
                  owner={f.gamertag || f.owner}
                  abilities={picked.length ? enemySlots[i] : undefined}
                  onOpen={() => showEnemy(f)}
                  preview={() =>
                    f.fighter_id === NFT_FIGHTER_ID
                      ? {
                          panel: enemyNftPanel(f, enemyBase.get(f.fighter_id)),
                          cards: nftCards(arena?.template_ids ?? [], catalogue.data),
                        }
                      : {
                          panel: battlePanel(f, enemyBase.get(f.fighter_id)),
                          template: classes.get(f.classname),
                        }
                  }
                />
              ))}
              {!arenaLoaded &&
                Array.from({ length: 6 }, (_, i) => (
                  <div className="skeleton combatcard combatcard--loading" key={i} />
                ))}
              {arenaLoaded && enemies.length === 0 && (
                <p className="faint">This arena has no team standing.</p>
              )}
            </div>
          </div>

          </section>

        {/* Crew and weapon, under the matchup on a phone, as in the dungeon. */}
        {phone && (
          <div className="versus__cards versus__cards--phone">
            <CardsToolbar
              crew={crew}
              weapon={weapon}
              autoPick={autoPickCardsButton}
              onOpen={showCard}
              onClear={(kind) => (kind === 'crew' ? setCrew(null) : setWeapon(null))}
              onChoose={(kind) => openPicker(kind)}
            />
          </div>
        )}

        {/*
          What a win costs, stated where the team is chosen rather than in the
          result screen where it would be a surprise. `battle.cpp` picks one of
          the five at random — not the weakest, not the survivor — and hands it
          to `fighterchg`, which marks it in use and stands it in the arena.
        */}
        {phone ? (
          <p className="hint arena__stake">
            Win and one of your five, picked at random, stays to defend this
            arena{xpPerWin ? `. +${xpPerWin} XP` : ''}.
          </p>
        ) : (
          <p className="hint arena__stake">
            Win and one of your five, chosen at random, stays here to defend the
            arena along with your NFT fighter. It is marked in use until somebody
            knocks it out{xpPerWin ? `, and the win pays ${xpPerWin} XP` : ''}.
          </p>
        )}


        {phone && sheet && (
          <div className="picker__scrim" onClick={() => setSheet(false)} aria-hidden="true" />
        )}
        <section
          className={`panel picker${phone ? ' picker--sheet' : ''}${phone && sheet ? ' picker--open' : ''}`}
          ref={picker}
          aria-hidden={phone && !sheet ? true : undefined}
        >
          {phone && (
            <div className="picker__sheethead" {...sheetGrip}>
              {/* The tabs are the title: they already say what is being chosen. */}
              <div className="picker__sheettabs" role="tablist">
                {(
                  [
                    ['fighters', 'Fighters'],
                    ['crew', 'Crew'],
                    ['weapon', 'Weapons'],
                  ] as [Tab, string][]
                ).map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    role="tab"
                    className="picker__sheettab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                  >
                    {label}
                    {key === 'fighters' && (
                      <i>
                        {picked.length}/{TEAM_SIZE}
                      </i>
                    )}
                  </button>
                ))}
              </div>
              <span className="picker__sheetcount">
                {tab === 'fighters' && shownCount
                  ? shownCount.shown < shownCount.total
                    ? `${shownCount.shown}/${shownCount.total}`
                    : shownCount.total
                  : null}
              </span>
              <button
                type="button"
                className="picker__sheetclose"
                onClick={() => setSheet(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          )}
          {!phone && (
          <div className="tabs" role="tablist">
            {(
              [
                ['fighters', 'Fighters'],
                ['crew', 'Crew'],
                ['weapon', 'Weapons'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                role="tab"
                className="tabs__tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
                <span className="tabs__count">{counts[key]}</span>
              </button>
            ))}
            {/* The markers at hand beside the tabs, as over My Fighters' rows. */}
            {tab === 'fighters' && <MarkerLine roster={roster ?? []} filter={filter} onChange={setFilter} />}
          </div>
          )}

          {tab === 'fighters' ? (
            <>
              <RosterFilters
                filter={filter}
                onChange={setFilter}
                roster={roster ?? []}
                versus={enemies.length ? profile : undefined}
                atLevelOne={atLevelOne}
                onAtLevelOne={setAtLevelOne}
                count={shownCount}
                sheet={
                  phone
                    ? {
                        density: sheetDensity,
                        onDensity: chooseSheetDensity,
                        filters: (close) => filterPanel(close, 'drost__fsheet pickfilters pickfilters--sheet'),
                      }
                    : undefined
                }
                bar={
                  phone
                    ? undefined
                    : {
                        lead: deskDensity === 'full' && <PickViewSwitch view={pickView} onChange={setPickView} />,
                        tail: <PickDensitySwitch density={deskDensity} onChange={chooseDeskDensity} />,
                        filters: (close) => filterPanel(close, 'drost__pop--filters pickfilters'),
                      }
                }
              />
              <FighterGrid
                roster={roster}
                filter={filter}
                ageDecay={ageDecay}
                levelMod={levelMod}
                atLevelOne={atLevelOne}
                teamIds={teamIds}
                full={picked.length >= TEAM_SIZE}
                matchups={enemies.length ? matchups : undefined}
                onToggle={toggleFighter}
                onCount={countFighters}
                onInspect={showFighter}
                density={phone ? sheetDensity : deskDensity}
                onDensity={phone ? chooseSheetDensity : chooseDeskDensity}
                view={phone ? undefined : pickView}
              />
            </>
          ) : (
            <CardGrid
              cards={tab === 'crew' ? usableCrew : usableWeapons}
              values={nftValues}
              query={cardQuery}
              onQuery={setCardQuery}
              selected={tab === 'crew' ? crew : weapon}
              onPick={(c) => {
                if (tab !== 'crew') {
                  setWeapon(c)
                  return
                }
                setCrew(c)
                /*
                   Straight on to weapons. The pair is one choice made in two
                   halves — the stats add and the weapon sets the element — so
                   picking a crew card is never the end of the task, and
                   leaving the player on a list they have finished with makes
                   them find the next tab themselves.
                */
                setTab('weapon')
                setCardQuery('')
              }}
              onInspect={showCard}
              kind={tab}
            />
          )}
          {phone && (
            <button type="button" className="btn btn--primary picker__done" onClick={() => setSheet(false)}>
              Done
            </button>
          )}
        </section>
      </div>

      {detail && (
        <DetailSheet
          panel={detail.panel}
          template={detail.template}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

/* ---------- the arena's current strength ---------- */

/**
 * What replaces the dungeon's difficulty ladder.
 *
 * There is nothing to choose here, so this reports rather than asks. The one
 * number that matters is `arena_power`: it scales every defender's health and
 * damage, it drops by a hundredth of full strength each time a challenger
 * fails, and it snaps back to full the moment somebody wins. A long-unbeaten
 * arena is a *harder* fight than one that has just turned over — the opposite
 * of the intuition a dungeon builds — so it is labelled with what the number
 * does rather than left to read as a score.
 *
 * A full-width panel with a 22px bar in it for a single percentage was more
 * presence than one number is worth, and it sat between the heading and the
 * matchup pushing both apart. It sits beside the weather now, in the same
 * label-over-reading shape the dungeon gives its weather and difficulty —
 * the two are the same kind of fact, conditions this fight happens under that
 * the player did not choose and cannot change. The colour of the figure keeps
 * what the bands said: red at full strength, gold part worn, teal once
 * challengers have worn it down.
 */
function ArenaStanding({ power }: { power: number }) {
  const percent = arenaPowerPercent(power)
  const band = percent >= 90 ? 'high' : percent >= 50 ? 'mid' : 'low'

  /* In the weather's colours: full strength is the bad news. */
  const lean = band === 'high' ? 'bad' : band === 'mid' ? 'mixed' : 'good'

  return (
    <div
      className={`weathertwin weathertwin--${lean}`}
      title="Arena power scales every defender’s health and damage. It falls each time a challenger fails and snaps back to full the moment somebody wins, so a high figure is the harder fight."
    >
      <span className="weathertwin__label">Defenders</span>
      <span className="weathertwin__line">
        <img className="weathertwin__stat" src={asset('/assets/icons/shield.svg')} alt="" width={18} height={18} />
        <span className="weathertwin__name">
          <span className="weathertwin__lead mono">{percent.toFixed(0)}%</span>
          strength
        </span>
      </span>
    </div>
  )
}

/**
 * The same figure on a phone, in the place and the voice of the dungeon's
 * difficulty: a quiet label, the number, and a white hairline for how much of
 * full strength is left — a reading rather than a coloured badge.
 */
function ArenaReadout({ power }: { power: number }) {
  const percent = arenaPowerPercent(power)
  return (
    <div className="arenaread" title="Arena power scales every defender’s health and damage. It falls each time a challenger fails and snaps back to full the moment somebody wins.">
      <span className="dstep__label">Defender strength</span>
      <span className="arenaread__value mono">{percent.toFixed(0)}%</span>
      <span className="arenaread__note">Falls with every failed challenge</span>
      <span className="arenaread__track" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </span>
    </div>
  )
}
