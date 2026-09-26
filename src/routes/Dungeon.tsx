import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { landId } from '@/chain/landId'
import { fetchSchemaTemplates, resolveAssetIds, type CardTemplate } from '@/chain/atomic'
import {
  fetchCrewCards,
  fetchDungeon,
  fetchFight,
  fetchRoster,
  randomHistoryId,
} from '@/dungeon/queries'
import {
  DIFFICULTIES,
  MAX_DIFFICULTY,
  NFT_FIGHTER_ID,
  withNumericIds,
  canRun,
  enemiesAt,
  fighterAvailable,
  playedHere,
  powerAt,
  rewardAt,
  scaleEnemies,
  xpFor,
} from '@/dungeon/rules'
import { EMPTY_FILTER, type RosterFilter } from '@/dungeon/filters'
import {
  NFT_FIGHTER_ART,
  combineNftFighter,
  combineNftFlat,
  nftAsPanel,
} from '@/dungeon/nftFighter'
import { rememberFight } from '@/dungeon/fightStore'
import {
  enemyProfile,
  matchupsFor,
  teamOutlook,
  battleAsFlat,
  matchupBetween,
  type FlatFighter,
} from '@/fight/matchup'
import { ageFactor, levelFactor } from '@/fight/scaling'
import { oddsTitle, teamOdds } from '@/fight/odds'
import { OddsCentre } from '@/fight/OddsCentre'
import { recallTeam, rememberTeam, restoreTeam } from '@/fight/lastTeam'
import { applyWeather, fetchWeather } from '@/fight/weather'
import { autoPickCards, autoPickCardsByOdds, autoPickFighters } from '@/fight/autopick'
import { AutoPickSplit } from '@/fight/AutoPickSplit'
import { TEAM_SIZE, type BattleFighter, type RosterFighter } from '@/dungeon/types'
import {
  abilityColor,
  abilityName,
  elementBackground,
  fighterArt,
  formatScaled,
  resolveAbilityDescription,
} from '@/tavern/fighterStats'
import { useImagesReady } from '@/components/useImagesReady'
import { Loading } from '@/components/Loading'
import {
  CardGrid,
  CardSlot,
  FoldingPanel,
  CombatCard,
  DetailSheet,
  enemyNftPanel,
  nftCards,
  Elemental,
  FighterGrid,
  WeatherPanel,
  POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
  RosterFilters,
  battlePanel,
  elementIcon,
  loadoutSummary,
  mid,
  rosterPanel,
  type Detail,
  type Tab,
} from '@/fight/setup'
import { DIRTIES, playDungeon } from '@/wharf/actions'
import { settle } from '@/wharf/settle'
import { readableError } from '@/wharf/errors'
import { asset } from '@/assets'
import { FighterStats } from '@/components/FighterPanel'
import { usePhone } from '@/components/usePhone'
import { useConfig, useLazyConfig } from '@/state/useConfig'
import { useChainQuery } from '@/chain/useChainQuery'
import { confirmThen } from '@/chain/confirm'

/*
   One empty map, not a new one each render.

   `useLazyConfig` returns undefined until the table lands, and a fresh
   `new Map()` as the fallback is a new identity every render — which would
   re-run every `useMemo` that depends on it, on every keystroke.
*/
const EMPTY_DIFMODS = new Map<number, number>()
const EMPTY_CARDS: CardTemplate[] = []

export default function Dungeon() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)
  const navigate = useNavigate()

  const land = landId(player.x, player.y)
  const planet = player.planet

  /*
     Everything the fight is set up from, in one read: this wallet's roster,
     the crew and weapon cards it could bring, and the team standing in the
     dungeon. Together because the screen cannot draw a line-up without all
     three, so three loading states only meant three ways to be half-ready.
  */
  const setup = useChainQuery(
    `dungeon:${player.wallet}:${planet}:${land}`,
    async () => {
      const [r, cards, dungeon] = await Promise.all([
        fetchRoster(player.wallet),
        fetchCrewCards(player.wallet),
        fetchDungeon(planet, land),
      ])
      return {
        roster: r,
        crewCards: cards.crew,
        weaponCards: cards.weapons,
        enemyTeam: withNumericIds(dungeon?.fighters ?? []),
        /* The crew and weapon the dungeon's own NFT fighter is made of. */
        enemyTemplates: dungeon?.template_ids ?? [],
      }
    },
    { deps: ['fighters'] },
  )
  const roster = setup.data?.roster ?? null
  const crewCards = setup.data?.crewCards ?? EMPTY_CARDS
  const weaponCards = setup.data?.weaponCards ?? EMPTY_CARDS
  /* Whether the card lists have been read at all, as against being empty. */
  const cardsLoaded = !!setup.data
  const enemyTeam = setup.data?.enemyTeam ?? null

  /*
     The defending team's stored health and damage, by fighter.

     `enemyLine` below has the difficulty multiplier and the weather in it,
     which is right for what the cards show and wrong for what the grade
     arrows compare — so the figures the row actually holds are kept here.
  */
  const enemyBase = useMemo(
    () =>
      new Map(
        (enemyTeam ?? []).map((f) => [
          f.fighter_id,
          { health: f.health, damage: f.damage },
        ]),
      ),
    [enemyTeam],
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

  /*
     Everything this screen scales its numbers by, from the store rather than
     from five of its own reads. `caps` is here because weather is capped as
     it is applied, so the caps are part of that answer.
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
  const xpPerDifficulty = battle?.xp_per_dungeon_difficulty ?? 0
  const nftMinDifficulty = battle?.dungeon_nft_fighter_min_difficulty ?? 5
  /* One screen each, so both are fetched the first time somebody opens one. */
  const difMods = useLazyConfig('difMods') ?? EMPTY_DIFMODS
  const energyCost = useLazyConfig('dungeon')?.energy_cost ?? 40
  /* Taunt lost per blow taken: the one knob the simulated fight needs. */
  const tauntDeduction = useLazyConfig('fightCost')

  /*
     The land's weather, which this dungeon is fought in exactly as an arena
     is. `rndweather` re-rolls on travel and the player is standing here, so
     the row is already the one the fight will use.
  */
  const weatherQuery = useChainQuery(`weather:${planet}:${land}`, () =>
    fetchWeather(planet, land),
  )
  /* Weather is context, not a blocker: a failed read leaves it off. */
  const weather = weatherQuery.data ?? null

  const [teamIds, setTeamIds] = useState<number[]>([])
  const [crew, setCrew] = useState<CardTemplate | null>(null)
  const [weapon, setWeapon] = useState<CardTemplate | null>(null)
  const [difficulty, setDifficulty] = useState(1)

  const [tab, setTab] = useState<Tab>('fighters')
  /* Scrolled to from the empty sixth slot, which is two panels above it. */
  const loadout = useRef<HTMLElement>(null)
  /* And from the empty fighter slots, which are three panels above this. */
  const picker = useRef<HTMLElement>(null)
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
  /* Folded by default: the pair is usually already chosen, and the slots
     pushed the fighter picker below the fold on every screen size. */
  const [loadoutOpen, setLoadoutOpen] = useState(false)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const alreadyPlayed = playedHere(player, planet, land)

  /*
   * A card the player owns but that has no `nftvalues` row cannot be used:
   * `getFighterFromNFT` does a `require_find` on that table, so offering it
   * would put the player through a wallet signature for a transaction that
   * reverts. They are filtered out rather than shown as blocked, because the
   * distinction is invisible from the card itself.
   */
  const usableCrew = useMemo(
    () => crewCards.filter((c) => nftValues.has(c.template_id)),
    [crewCards, nftValues],
  )
  const usableWeapons = useMemo(
    () => weaponCards.filter((c) => nftValues.has(c.template_id)),
    [weaponCards, nftValues],
  )

  /*
     The whole defending team, including the NFT fighter that has not
     joined yet. Drawn, not fought: `enemies` below is the line that
     actually fights, and everything that compares the two sides reads
     that one.
  */
  const enemyLine = useMemo(() => {
    if (!enemyTeam) return []
    return scaleEnemies(
      /* Weather first, then the difficulty scaling — `apply_weather_and_age`
         runs before the level curve and the two do not commute. */
      enemyTeam.map((f) => applyWeather(f, weather, caps)),
      difficulty,
      difMods,
    )
  }, [enemyTeam, difficulty, difMods, weather, caps])

  /*
     The artwork the defending line will paint, so the skeleton can wait for
     it rather than handing over to a row of empty cards.

     Portrait and elemental backdrop for each: the two that cover the card,
     and the two the player watched arrive a second after the loading
     animation had already said it was done. The element mark beside them is
     a 22px icon out of the same six files on every screen, so it is in cache
     by the time this screen opens.
  */
  const enemyArt = useMemo(
    () =>
      (enemyTeam ?? []).flatMap((f) => [
        f.fighter_id === NFT_FIGHTER_ID
          ? NFT_FIGHTER_ART
          : fighterArt({ classname: f.classname, racename: f.racename }),
        elementBackground(f.element),
      ]),
    [enemyTeam],
  )
  const enemyArtReady = useImagesReady(enemyArt)

  /*
     Who is actually in the fight at this difficulty.

     The strength bar, the matchup table, the ability counts and auto-pick
     all read this rather than the line above, because a fighter that will
     not swing is not part of what the player is up against.
  */
  const enemies = useMemo(
    () => enemiesAt(enemyLine, difficulty, nftMinDifficulty),
    [enemyLine, difficulty, nftMinDifficulty],
  )

  /*
     How every fighter in the roster stands against this particular line-up.

     One table, read by four things: the badges on the cards, the matchup
     filters, the matchup sorts and auto-pick. Recomputed when the difficulty
     changes, because that is what decides whether the dungeon's own NFT
     fighter joins — and it usually attacks with a different element to the
     rest of the team.
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

  /** The sixth fighter the two cards combine into. */
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

  const block = canRun(team, !!crew, !!weapon, player, energyCost)

  /*
     Bring back the last team, minus whoever cannot fight now.

     Runs once, when the roster and both card lists have arrived. A fighter
     that has since been listed on the market, sent to the arena or fallen due
     for a payday is dropped rather than restored: the contract refuses all
     three, so putting one back would leave the Start button dark with no
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
    const remembered = recallTeam('dungeon', player.wallet)
    const back = restoreTeam(remembered, {
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
    if (
      back.fighterIds.length ||
      back.crew ||
      back.weapon ||
      remembered?.difficulty
    ) {
      skipSave.current = true
    }

    if (back.fighterIds.length) setTeamIds(back.fighterIds)
    if (back.crew) setCrew(back.crew)
    if (back.weapon) setWeapon(back.weapon)
    /*
       The rung last fought on. Clamped to what this screen offers rather
       than trusted: the range is a presented one, not a contract limit, and
       a stored 20 must not survive the day the ladder is shortened.
    */
    if (remembered?.difficulty) {
      setDifficulty(Math.min(remembered.difficulty, MAX_DIFFICULTY))
    }

    if (back.dropped.length) {
      const named = back.dropped.map((d) => {
        const f = roster.find((r) => r.fighter_id === d.id)
        return `${f ? f.classname : `#${d.id}`} (${d.reason})`
      })
      setRestoreNote(
        `Left out of your last team: ${named.join(', ')}.`,
      )
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
    rememberTeam('dungeon', player.wallet, {
      fighterIds: teamIds,
      crew: crew?.template_id ?? null,
      weapon: weapon?.template_id ?? null,
      difficulty,
    })
  }, [teamIds, crew, weapon, difficulty, player.wallet])

  const toggleFighter = useCallback((f: RosterFighter) => {
    setTeamIds((ids) => {
      if (ids.includes(f.fighter_id)) return ids.filter((id) => id !== f.fighter_id)
      if (ids.length >= TEAM_SIZE) return ids
      return [...ids, f.fighter_id]
    })
  }, [])

  /* Ranked on the matchup, and the cards chosen as a pair. */
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
  const phone = usePhone()

  /*
     Auto-pick with a choice of pool: Suggested, Levels, or by marker, and a
     switch for what happens to a team that already has fighters in it. The
     ranking is unchanged — the fighters that suit this opponent best, among
     the ones the mode allows. `keep` are the ones to leave where they are:
     they are taken out of the pool so none is placed twice, and the picks
     fill the slots left over.
  */
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
    const raw = enemyTeam ? enemiesAt(enemyTeam, difficulty, nftMinDifficulty) : []
    const pick =
      tauntDeduction !== undefined && !!enemyTeam && raw.length
        ? autoPickCardsByOdds({
            enemies: raw,
            crewCards: usableCrew,
            weaponCards: usableWeapons,
            values: nftValues,
            rate: (crewValue, weaponValue, runs) =>
              teamOdds({
                picked,
                nft: combineNftFlat(crewValue, weaponValue),
                enemies: raw,
                scaling: { venue: 'dungeon', difficulty, percentPower: difMods.get(difficulty) ?? 100 },
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
  }, [enemies, usableCrew, usableWeapons, nftValues, picked, enemyTeam, difficulty, nftMinDifficulty, difMods, tauntDeduction, weather, caps, levelMod, ageDecay])

  /*
     One button, rendered in one of two places — like the fighters one.

     It belongs beside the slots it fills, which is inside the Loadout
     panel. That panel is shut by default, so on a phone the button was
     behind a fold: to auto-pick the pair you first had to open the thing
     that would have picked it for you. A phone gets it above the panel
     instead, where it is on screen whether the fold is open or not.
  */
  const autoPickCardsButton = (
    <button
      type="button"
      className="btn btn--ghost btn--sm cardslots__auto"
      onClick={autoPickCardsOnly}
      disabled={!usableCrew.length && !usableWeapons.length}
      title="Choose the crew and weapon pair that suits this opponent"
    >
      Auto-pick cards
    </button>
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
      await playDungeon(session, {
        planet,
        landId: land,
        x: player.x,
        y: player.y,
        crewAssetId,
        weaponAssetId,
        fighterIds: picked.map((f) => f.fighter_id),
        difficulty,
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
          rememberFight(row, 'dungeon', xpBefore)
          /*
             The player row, re-read until it actually shows the run.

             The map draws "played today" from `played_dungeons` on this row
             and nothing else re-reads it — a table drop refreshes screens
             built on `useChainQuery`, and the player lives in the store. So
             one forced read was the only chance this had, taken at the
             earliest possible moment, which is exactly when a node is most
             likely to still be serving the row from before the transaction.
             It usually won that race. When it lost, the dungeon stayed
             unmarked on the map until something else happened to refresh.

             Not awaited: the replay starts now, and this settles long before
             the player has watched it and gone back.
          */
          void confirmThen(
            async () => {
              await refreshPlayer({ force: true })
              return useGame.getState().player
            },
            (p) => !!p && playedHere(p, planet, land),
          )
          /*
             The fight is on chain: XP, cooldowns and quest progress all
             moved. This screen waits on the fight row rather than through
             `useAction`, so nothing was dropping what the run changed and no
             indicator heard about it.
          */
          settle(DIRTIES.playDungeon)
          navigate(`/battle/${historyId}`)
          return
        }
      }
      setError(
        'The fight went through but its record could not be read back in time. ' +
          'Your energy was spent and the rewards are yours; only the replay is lost.',
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

  /*
     My team as it will enter the ring, not as it is stored.

     `apply_weather_and_age` runs on both sides before the first blow, and for
     the player's team `dungeon_difficulty` is 0 — which does not mean "no
     scaling", it means "use the fighter's own level". So a level 10 fighter
     arrives at roughly four times its stored numbers, and an old one at a
     fraction. The enemy line on this screen has already been through the
     equivalent step in `scaleEnemies`; showing my side unscaled next to it
     was comparing two different things.
  */
  /*
     Mid roll, then weather, then level and age — the contract's order, and
     the same pipeline the arena uses.
  */
  const weathered = useMemo(
    () =>
      new Map(
        picked.map((f) => [
          f.fighter_id,
          applyWeather(
            {
              element: f.element,
              classname: f.classname,
              racename: f.racename,
              health: mid(f.stats.health_min, f.stats.health_max),
              damage: mid(f.stats.damage_min, f.stats.damage_max),
              attackspeed: mid(f.stats.attackspeed_min, f.stats.attackspeed_max),
              taunt: mid(f.stats.taunt_min, f.stats.taunt_max),
              initiative: mid(f.stats.initiative_min, f.stats.initiative_max),
              res_gem: f.stats.res_gem, res_metal: f.stats.res_metal,
              res_air: f.stats.res_air, res_fire: f.stats.res_fire,
              res_nature: f.stats.res_nature, res_neutral: f.stats.res_neutral,
            },
            weather,
            caps,
          ),
        ]),
      ),
    [picked, weather, caps],
  )

  const fielded = useMemo(() => {
    const byFighter = new Map<number, { health: number; damage: number }>()
    for (const f of picked) {
      const factor =
        levelFactor(f.stats.level, levelMod) * ageFactor(f.creation_date, ageDecay)
      const base = weathered.get(f.fighter_id)!
      byFighter.set(f.fighter_id, {
        health: Math.trunc(base.health * factor),
        damage: Math.trunc(base.damage * factor),
      })
    }
    return byFighter
  }, [picked, levelMod, ageDecay, weathered])

  /* The same team in the shape the matchup reads, the NFT fighter included. */
  const myFlat = useMemo<FlatFighter[]>(() => {
    /* From the weathered bag, so the bar reads what the fight will use. */
    const out: FlatFighter[] = picked.map((f) => ({
      ...weathered.get(f.fighter_id)!,
      damage: fielded.get(f.fighter_id)?.damage ?? 0,
      health: fielded.get(f.fighter_id)?.health ?? 0,
      abilities: f.stats.abilities ?? [],
    }))

    /* `getFighterFromNFT`: stats add, the element comes from the weapon. */
    const cv = crew ? nftValues.get(crew.template_id) : undefined
    const wv = weapon ? nftValues.get(weapon.template_id) : undefined
    if (cv || wv) {
      const add = (pick: (v: typeof cv) => number) => (cv ? pick(cv) : 0) + (wv ? pick(wv) : 0)
      out.push({
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
        abilities: [...(cv?.ability ?? []), ...(wv?.ability ?? [])],
      })
    }
    return out
  }, [picked, fielded, weathered, crew, weapon, nftValues, weather, caps])

  const outlook = useMemo(() => teamOutlook(myFlat, enemies), [myFlat, enemies])

  /*
     Every combatant on the screen against the line opposite it.

     The same computation both ways round — an enemy's abilities read against
     my team is my team's abilities read against theirs with the arguments
     swapped — which is what lets the two rows be labelled honestly instead of
     one of them being "bonuses" and the other silence.

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
     way the contract does, and counts the wins. The sixth fighter comes
     from `myFlat`, which is where the screen assembled it — the same object
     the totals above the bar are adding up, so the two cannot disagree.

     `outlook.share` stays as the fallback for the moment before the fight
     config lands, and for a read that fails outright. It is the old
     estimate, drawn in the same bar, rather than an empty one.
  */
  const odds = useMemo(() => {
    if (tauntDeduction === undefined || !enemyTeam) return null
    return teamOdds({
      picked,
      /* The sixth fighter, unscaled: `teamOdds` levels it itself. */
      nft: nftFlat,
      /* The line as stored, because the scaling belongs after the buffs. */
      enemies: enemiesAt(enemyTeam, difficulty, nftMinDifficulty),
      scaling: {
        venue: 'dungeon',
        difficulty,
        percentPower: difMods.get(difficulty) ?? 100,
      },
      tauntDeduction,
      fielding: { weather, caps, levelMod, ageDecay },
    })
  }, [
    picked, nftFlat, enemyTeam, difficulty, nftMinDifficulty, difMods,
    tauntDeduction, weather, caps, levelMod, ageDecay,
  ])

  const myShare = odds ? odds.winRate : outlook.share

  const counts: Record<Tab, number> = {
    fighters: roster?.length ?? 0,
    crew: usableCrew.length,
    weapon: usableWeapons.length,
  }

  /*
     Nothing is shown until there is something to show.

     Everything this screen needs arrives in one `Promise.all`, but the frame
     around it does not wait: the difficulty ladder, the empty slots, the
     picker tabs reading "Fighters 0 · Crew 0 · Weapons 0" and both teams at
     "0 DMG · 0 HP" were all on screen while the roster was still in flight.
     That reads as a screen that has loaded wrongly rather than one still
     loading. The spinner the route arrives behind simply stays up until the
     data and the defenders' artwork are both in.

     An error is its own answer and comes out from behind it.
  */
  /* The setup read's own failure counts: without it the gate below would
     wait for a roster that is never coming. */
  const fault = error ?? setup.error

  if (!fault && !(configLoaded && roster && cardsLoaded && enemyTeam && enemyArtReady)) {
    return <Loading label="Entering the dungeon" />
  }

  return (
    <div className="dungeon">
      <img className="dungeon__art" src={asset("/assets/background/bg-dungeon.png")} alt="" />
      <div className="dungeon__scrim" />

      <div className="dungeon__inner">
        <header className="dungeon__head">
          <div>
            <h1 className="page__title">Dungeon</h1>
            {/*
              Where the coordinates used to be, as on the arena screen. A
              player standing on a tile does not need to be told which tile;
              the roll they are about to fight under decides what team they
              should bring.
            */}
            <WeatherPanel weather={weather} />
          </div>
          <span className="spacer" />
          <div className="dungeon__actions">
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
              className="btn btn--danger"
              onClick={() => void start()}
              disabled={busy || !block.ready || alreadyPlayed}
              title={block.reason}
            >
              {busy && <span className="spinner" />}
              {busy ? (status ?? 'Fighting…') : 'Start Fight'}
              {!busy && (
                <span className="dungeon__cost">
                  −{energyCost}
                  <img
                    src={asset("/assets/icons/energy.png")}
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
        {restoreNote && (
          <div className="alert alert--note" role="status">
            {restoreNote}
          </div>
        )}
        {alreadyPlayed && (
          <div className="alert">
            You have already run this dungeon today. It resets at midnight UTC.
          </div>
        )}

        <DifficultyPicker
          value={difficulty}
          onChange={setDifficulty}
          difMods={difMods}
          xpPerDifficulty={xpPerDifficulty}
          nftMinDifficulty={nftMinDifficulty}
        />

        {/*
          The matchup, as a versus screen.

          Two facing rows with the totals squared off across a divider: the
          decision here is "can my five beat those six", and that reads far
          better as a confrontation than as two lists. The opposing row is
          flipped horizontally so both teams face the centre, which is the
          convention every fighting game uses and costs nothing to honour.
        */}
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
                <Elemental side={outlook.mine} against={outlook.theirs.bonuses} who="You" />
              </span>
            </header>

            {/*
               Under the header on a desktop: the header names the team and
               totals it, and the control that changes the line-up sits on its
               own line between that and the fighters it fills. A phone puts it
               under the row instead, where the thumb is.
            */}
            {!phone && <div className="versus__pick">{autoPickButton}</div>}

            <div className="versus__row">
              {team.map((f, i) =>
                f ? (
                  <CombatCard
                    key={f.fighter_id}
                    element={f.element}
                    classname={f.classname}
                    racename={f.racename}
                    level={f.stats.level}
                    health={fielded.get(f.fighter_id)?.health ?? 0}
                    damage={fielded.get(f.fighter_id)?.damage ?? 0}
                    side="mine"
                    abilities={enemies.length ? mySlots[i] : undefined}
                    onOpen={() => showFighter(f)}
                    marker={f.marker}
                    preview={() => ({
                      panel: rosterPanel(f, levelMod, ageDecay),
                      template: classes.get(f.classname),
                    })}
                    onRemove={() => toggleFighter(f)}
                  />
                ) : (
                  /*
                     An empty slot takes you to where it gets filled, the way
                     the sixth one does. A plus sign on a card-shaped hole is
                     read as a control whether or not it is one, and the grid
                     that fills it is three panels down the page.
                  */
                  <button
                    type="button"
                    className="combatcard combatcard--empty"
                    key={`empty-${i}`}
                    onClick={() => {
                      setTab('fighters')
                      picker.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    title="Choose a fighter for this slot"
                  >
                    <span className="combatcard__plus" aria-hidden="true">
                      +
                    </span>
                    <span className="combatcard__hint">Fighter {i + 1}</span>
                  </button>
                ),
              )}

              {/*
                The sixth combatant. A crew card and a weapon card do not sit
                on the sidelines — the contract fuses them into a fighter that
                joins your five, so it stands in the line-up rather than in a
                separate row of equipment.
              */}
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
                  onOpen={() => setDetail({ kind: 'panel', panel: nftFighter })}
                  preview={() => ({
                    panel: nftFighter,
                    cards: [crew, weapon].filter((c): c is CardTemplate => !!c),
                  })}
                  /*
                     The sixth comes out the way it went in: it is not a
                     roster fighter, it is the crew and the weapon fused, so
                     removing it puts both cards back. Without this the one
                     card in the line with no bar under it would be the one
                     card whose portrait sat 23px lower than the other five.
                  */
                  onRemove={() => {
                    setCrew(null)
                    setWeapon(null)
                  }}
                />
              ) : (
                /*
                   The empty sixth slot takes you to where it gets filled.

                   Crew and weapon are chosen two panels down, and the slot
                   that wants them is up here — so a player who presses the
                   only thing on screen labelled "crew + weapon" was pressing
                   nothing. It opens the crew tab and scrolls the loadout up,
                   which puts the slots and the cards that fill them together.
                */
                <button
                  type="button"
                  className="combatcard combatcard--empty combatcard--nft"
                  onClick={() => {
                    setTab('crew')
                    /* Opened as well as scrolled to. The panel is folded by
                       default, and landing on a shut one would answer the
                       press with less than was there before it. */
                    setLoadoutOpen(true)
                    loadout.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
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

            {phone && autoPickButton}

          </div>

        <div className="versus__divider">
            <OddsCentre odds={odds} />
          </div>

          <div className="versus__side versus__side--enemy">
            {/*
              The header is the balance bar. Each side's share of the matchup
              is drawn as an underline beneath its own name and totals, which
              says the same thing a separate bar did while costing no height
              and leaving no doubt about which side a length belongs to.
            */}
            <header
              className="versus__head"
              style={{ ['--share' as string]: `${(1 - myShare) * 100}%` }}
              title={oddsTitle(odds, 'theirs')}
            >
              <span className="versus__team">The dungeon</span>
              <span className="versus__totals mono">
                {formatScaled(outlook.theirs.damage)} DMG ·{' '}
                {formatScaled(outlook.theirs.health)} HP
                <Elemental side={outlook.theirs} against={outlook.mine.bonuses} who="They" />
              </span>
            </header>

            <div className="versus__row">
              {/*
                The skeleton stands until the artwork is decoded, not until
                the row arrives. Handing over on the data put six empty cards
                on the screen and painted the portraits into them a second
                later, so the screen finished twice.
              */}
              {enemyArtReady &&
                enemyLine.map((f, i) => (
                <CombatCard
                  key={`${f.fighter_id}-${i}`}
                  element={f.element}
                  /* The dungeon's sixth is the same fused card fighter yours
                     is, and arrives just as nameless. Label it the same way
                     rather than leaving a blank card in their line. */
                  classname={f.fighter_id === NFT_FIGHTER_ID ? 'NFT Fighter' : f.classname}
                  racename={f.fighter_id === NFT_FIGHTER_ID ? '' : f.racename}
                  art={f.fighter_id === NFT_FIGHTER_ID ? NFT_FIGHTER_ART : undefined}
                  badge={f.fighter_id === NFT_FIGHTER_ID ? 'NFT' : undefined}
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
                  /*
                     `enemySlots` is index-aligned with the fighting line,
                     and the dormant one is always last — so an index past
                     the end simply has no counts, which is what it should
                     have: it is not in this fight to have a matchup with.
                  */
                  abilities={picked.length ? enemySlots[i] : undefined}
                  dormant={
                    f.fighter_id === NFT_FIGHTER_ID && difficulty < nftMinDifficulty
                      ? `Joins at difficulty ${nftMinDifficulty}`
                      : undefined
                  }
                  onOpen={() => showEnemy(f)}
                  preview={() =>
                    f.fighter_id === NFT_FIGHTER_ID
                      ? {
                          panel: enemyNftPanel(f, enemyBase.get(f.fighter_id)),
                          cards: nftCards(setup.data?.enemyTemplates ?? [], catalogue.data),
                        }
                      : {
                          panel: battlePanel(f, enemyBase.get(f.fighter_id)),
                          template: classes.get(f.classname),
                        }
                  }
                />
              ))}
              {(!enemyTeam || !enemyArtReady) &&
                Array.from({ length: 5 }, (_, i) => (
                  <div className="skeleton combatcard combatcard--loading" key={i} />
                ))}
              {enemyTeam?.length === 0 && enemyArtReady && (
                <p className="faint">This dungeon has no team standing.</p>
              )}
            </div>
          </div>

          </section>

        {/*
          Crew and weapon sit outside the versus panel. They are equipment
          chosen once, not combatants being compared, and keeping them in the
          line-up crowded the cards the screen is actually about.
        */}
        {phone && <div className="loadoutauto">{autoPickCardsButton}</div>}

        <FoldingPanel
          className="loadout"
          panelRef={loadout}
          title="Loadout"
          summary={loadoutSummary(crew, weapon, loadoutOpen)}
          open={loadoutOpen}
          onToggle={() => setLoadoutOpen((v) => !v)}
          /*
             On the heading, so a shut panel still offers it. A phone gets
             the full-width one above the panel instead: this row is the
             title, the pair of card names and a chevron already, and a
             fourth thing on it there would wrap the heading in two.
          */
          aside={!phone ? autoPickCardsButton : undefined}
        >
          <div className="cardslots">
            <CardSlot
              label="Crew"
              card={crew}
              onClear={() => setCrew(null)}
              onOpen={() => crew && showCard(crew)}
            />
            <CardSlot
              label="Weapon"
              card={weapon}
              onClear={() => setWeapon(null)}
              onOpen={() => weapon && showCard(weapon)}
            />

            {/*
              What the pair actually produces, spelled out where the row would
              otherwise be empty. The split is not obvious — the stats add up,
              but the element comes from the weapon alone and decides what your
              damage gets resisted by — so it is worth stating rather than
              leaving the player to infer it from the line-up.
            */}
            <div className="loadout__result">
              {nftFighter ? (
                <>
                  {/*
                     The same stat presentation as everywhere else a fighter
                     is shown: labelled rows with the stat’s own icon, and
                     the six resistances under them. This was six bordered
                     chips carrying an icon and a figure and no label, so
                     which number was which lived in a tooltip — and the
                     resistances, which decide how much of the damage on the
                     other side actually lands, were not shown at all.
                  */}
                  <FighterStats fighter={nftFighter} />

                  {/*
                     The element is the loadout’s own line rather than the
                     panel’s, because here it is a consequence of a choice
                     still being made: the weapon sets it, and until one is
                     picked there is nothing to attack as.
                  */}
                  <div className="statline loadout__element">
                    <span className="statline__k">
                      <img
                        className="statline__icon"
                        src={elementIcon(nftFighter.element)}
                        alt=""
                      />
                      Attacks as
                    </span>
                    <span className="statline__v loadout__v--element">
                      {weapon ? nftFighter.element : 'pick a weapon'}
                    </span>
                  </div>

                  {/*
                    Both cards' abilities carry over to the combined fighter,
                    and they are frequently the reason to prefer one card over
                    a statistically better one — so they are named here in
                    their rarity colours rather than counted.
                  */}
                  {/*
                     What the abilities do, not just what they are called.

                     They were chips with the description on a `title`, which
                     is a tooltip no phone shows and nobody hovers while
                     deciding. Two abilities is two lines of text, and they are
                     the reason a particular pair of cards is worth fielding, so
                     they go on the screen — in the shape the detail panel
                     already uses: name over description, rarity colour on the
                     left edge.
                  */}
                  {nftFighter.abilities.length > 0 && (
                    <div className="abilities loadout__abilities">
                      {nftFighter.abilities.map((a, i) => (
                        <div
                          className="ability"
                          key={`${a.ability}-${i}`}
                          style={{ borderLeftColor: abilityColor(a.displayname) }}
                        >
                          <div
                            className="ability__name"
                            style={{ color: abilityColor(a.displayname) }}
                          >
                            {abilityName(a.displayname)}
                          </div>
                          <div className="ability__desc">
                            {resolveAbilityDescription(a)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setDetail({ kind: 'panel', panel: nftFighter })}
                  >
                    View fighter
                  </button>
                </>
              ) : (
                <p className="faint loadout__empty">
                  Pick a crew card and a weapon card. Their stats add together,
                  both sets of abilities carry over, and the weapon decides the
                  element your sixth fighter attacks with.
                </p>
              )}
            </div>


          </div>
        </FoldingPanel>

        <section className="panel picker" ref={picker}>
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
          </div>

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

/* ---------- difficulty ---------- */

/**
 * Twenty difficulties as a wheel rather than twenty buttons.
 *
 * As buttons they are a 44px grid, and on a phone that is four rows and
 * 200px of panel spent on one number - more room than the line-up it is
 * setting the difficulty for. They are also a poor fit for buttons: this is
 * one ordinal value, not twenty independent choices, and a player moves
 * through it by degrees rather than jumping to 17.
 *
 * So it scrolls, snaps, and reads whatever is under the marker. A flick
 * covers the range, a tap still picks an exact step for anyone who knows
 * which one they want, and the whole control is one row.
 */
function DifficultyWheel({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const track = useRef<HTMLDivElement | null>(null)
  const settling = useRef<number | null>(null)

  /*
     Bring the selected step under the marker.

     `scrollIntoView` would do this in one line and would also scroll the
     page to reach it, which on a phone means the panel jumps up the screen
     every time the difficulty changes. Setting `scrollLeft` moves only the
     strip.
  */
  useEffect(() => {
    const el = track.current
    if (!el) return
    const step = el.children[value - 1] as HTMLElement | undefined
    if (!step) return
    const target = step.offsetLeft + step.offsetWidth / 2 - el.clientWidth / 2
    /* Already there: a scroll started by the finger must not be fought. */
    if (Math.abs(el.scrollLeft - target) < 2) return
    /*
       Assigned rather than `scrollTo({ behavior: ‘smooth’ })`, which is
       animated on a frame timer and therefore does nothing at all when
       frames are not being served — a background tab, a hidden pane, a
       phone that has throttled the page. It ended at 0 every time in the
       harness. The flick has the browser’s own snap animation; this is the
       correction after a tap, and instant is the right answer for that
       anyway.
    */
    el.scrollLeft = target
  }, [value])

  useEffect(
    () => () => {
      if (settling.current) window.clearTimeout(settling.current)
    },
    [],
  )

  /* Whichever step is nearest the middle when the strip stops moving. */
  const settle = () => {
    const el = track.current
    if (!el) return
    const centre = el.scrollLeft + el.clientWidth / 2
    let best = value
    let bestGap = Infinity
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i] as HTMLElement
      const gap = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre)
      if (gap < bestGap) {
        bestGap = gap
        best = i + 1
      }
    }
    if (best !== value) onChange(best)
  }

  return (
    <div className="difficulty__wheel">
      <div
        className="difficulty__track"
        ref={track}
        role="radiogroup"
        aria-label="Difficulty"
        onScroll={() => {
          if (settling.current) window.clearTimeout(settling.current)
          settling.current = window.setTimeout(settle, 110)
        }}
      >
        {DIFFICULTIES.map((d) => (
          <button
            type="button"
            key={d}
            role="radio"
            aria-checked={d === value}
            className="difficulty__notch"
            onClick={() => onChange(d)}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Where the value is read, so the strip has a place to stop. */}
      <span className="difficulty__marker" aria-hidden="true" />
    </div>
  )
}

function DifficultyPicker({
  value,
  onChange,
  difMods,
  xpPerDifficulty,
  nftMinDifficulty,
}: {
  value: number
  onChange: (n: number) => void
  difMods: Map<number, number>
  xpPerDifficulty: number
  nftMinDifficulty: number
}) {
  const phone = usePhone()
  const row = useRef<HTMLDivElement | null>(null)
  /*
     Whether the ladder runs past its box, and which end it is resting on.
     The arrows are drawn from this: none at all when all twenty fit, and a
     dead one at each end rather than a live one that does nothing.
  */
  const [reach, setReach] = useState({ over: false, start: true, end: false })

  const readReach = useCallback(() => {
    const el = row.current
    if (!el) return
    const slack = el.scrollWidth - el.clientWidth
    setReach({
      over: slack > 1,
      start: el.scrollLeft <= 1,
      end: el.scrollLeft >= slack - 1,
    })
  }, [])

  useEffect(() => {
    const el = row.current
    if (!el) return
    readReach()
    const ro = new ResizeObserver(readReach)
    ro.observe(el)
    el.addEventListener('scroll', readReach, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', readReach)
    }
  }, [readReach, phone])

  /*
     Keep the chosen rung in sight.

     It matters most on arrival: the difficulty is restored from the last run,
     and a remembered 17 would otherwise open scrolled to 1 with the selection
     off the right-hand end. Only moved when it is actually out of view, so a
     click near the edge does not yank the strip.
  */
  useEffect(() => {
    const el = row.current
    if (!el) return
    const step = el.children[value - 1] as HTMLElement | undefined
    if (!step) return
    const pad = 8

    /*
       Instantly, not smoothly — the same lesson `DifficultyWheel` records
       above. A smooth scroll is animated on a frame timer and does nothing
       at all where frames are not being served, and this runs on arrival,
       which is exactly when the tab may not have been painted yet. The
       arrows keep the smooth scroll; they are only ever pressed by somebody
       watching.
    */
    const smooth = el.style.scrollBehavior
    el.style.scrollBehavior = 'auto'
    if (step.offsetLeft < el.scrollLeft) {
      el.scrollLeft = step.offsetLeft - pad
    } else if (
      step.offsetLeft + step.offsetWidth >
      el.scrollLeft + el.clientWidth
    ) {
      el.scrollLeft = step.offsetLeft + step.offsetWidth - el.clientWidth + pad
    }
    el.style.scrollBehavior = smooth
  }, [value, phone])

  /* Most of a box at a time, so the step you were reading stays on screen. */
  const page = (dir: -1 | 1) => {
    const el = row.current
    if (!el) return
    el.scrollLeft += dir * Math.max(120, el.clientWidth * 0.8)
    readReach()
  }

  return (
    <section className="panel difficulty">
      <div className="panel__title">
        Difficulty
        <span className="faint dungeon__tally">
          Enemy ×{powerAt(value, difMods).toFixed(2)} · Rewards ×
          {rewardAt(value).toFixed(2)} · {xpFor(value, xpPerDifficulty)} XP
        </span>
      </div>
      {phone ? (
        <DifficultyWheel value={value} onChange={onChange} />
      ) : (
        <div className="difficulty__scroller">
          {reach.over && (
            <button
              type="button"
              className="difficulty__arrow"
              onClick={() => page(-1)}
              disabled={reach.start}
              aria-label="Show lower difficulties"
              tabIndex={-1}
            >
              ‹
            </button>
          )}
          <div
            className="difficulty__row"
            role="radiogroup"
            aria-label="Difficulty"
            ref={row}
          >
            {DIFFICULTIES.map((d) => (
              <button
                type="button"
                key={d}
                role="radio"
                aria-checked={d === value}
                className="difficulty__step"
                onClick={() => onChange(d)}
              >
                {d}
              </button>
            ))}
          </div>
          {reach.over && (
            <button
              type="button"
              className="difficulty__arrow"
              onClick={() => page(1)}
              disabled={reach.end}
              aria-label="Show higher difficulties"
              tabIndex={-1}
            >
              ›
            </button>
          )}
        </div>
      )}
      {/*
         Desktop only. On a phone the panel is the ladder and the line above
         it, and a two-line footnote about a threshold you have already
         crossed is the largest thing in it. Removed rather than hidden, so
         it is out of the reading order too and not just out of sight.
      */}
      {!phone && value >= nftMinDifficulty && (
        <p className="hint">
          From difficulty {nftMinDifficulty} the dungeon fields its own NFT fighter
          as well.
        </p>
      )}
    </section>
  )
}
