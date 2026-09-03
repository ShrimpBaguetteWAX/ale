import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { landId } from '@/chain/landId'
import { resolveAssetIds, type CardTemplate } from '@/chain/atomic'
import {
  fetchBattleConfig,
  fetchClassTemplates,
  fetchCrewCards,
  fetchDifMods,
  fetchDungeon,
  fetchDungeonConfig,
  fetchFight,
  fetchNftValues,
  fetchRoster,
  randomHistoryId,
} from '@/dungeon/queries'
import {
  DIFFICULTIES,
  NFT_FIGHTER_ID,
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
  nftAsPanel,
  type NftValue,
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
import { recallTeam, rememberTeam, restoreTeam } from '@/fight/lastTeam'
import { applyWeather, fetchWeather, type Weather } from '@/fight/weather'
import { DEFAULT_CAPS, type StatCaps } from '@/dungeon/sim'
import { autoPickCards, autoPickFighters } from '@/fight/autopick'
import { TEAM_SIZE, type BattleFighter, type RosterFighter } from '@/dungeon/types'
import {
  STAT_LABEL,
  abilityColor,
  abilityName,
  formatScaled,
  resolveAbilityDescription,
  statIcon,
  type ClassTemplate,
} from '@/tavern/fighterStats'
import {
  CardGrid,
  CardSlot,
  CombatCard,
  DetailSheet,
  Elemental,
  FighterGrid,
  WeatherPanel,
  POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
  RosterFilters,
  battlePanel,
  elementIcon,
  mid,
  rosterPanel,
  type Detail,
  type Tab,
} from '@/fight/setup'
import { playDungeon } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import { asset } from '@/assets'
import { usePhone } from '@/components/usePhone'

export default function Dungeon() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)
  const navigate = useNavigate()

  const land = landId(player.x, player.y)
  const planet = player.planet

  const [roster, setRoster] = useState<RosterFighter[] | null>(null)
  const [crewCards, setCrewCards] = useState<CardTemplate[]>([])
  const [weaponCards, setWeaponCards] = useState<CardTemplate[]>([])
  const [nftValues, setNftValues] = useState<Map<number, NftValue>>(new Map())
  const [classes, setClasses] = useState<Map<string, ClassTemplate>>(new Map())
  const [enemyTeam, setEnemyTeam] = useState<BattleFighter[] | null>(null)
  const [difMods, setDifMods] = useState<Map<number, number>>(new Map())
  const [energyCost, setEnergyCost] = useState(40)
  const [xpPerDifficulty, setXpPerDifficulty] = useState(0)
  const [nftMinDifficulty, setNftMinDifficulty] = useState(5)
  const [ageDecay, setAgeDecay] = useState(0)
  /* Weather is capped as it is applied, so the caps are part of the answer. */
  const [caps, setCaps] = useState<StatCaps>(DEFAULT_CAPS)

  /*
     The land's weather, which this dungeon is fought in exactly as an arena
     is. `rndweather` re-rolls on travel and the player is standing here, so
     the row is already the one the fight will use.
  */
  const [weather, setWeather] = useState<Weather | null>(null)
  /* Ranking a roster without it puts a level 1 fighter above a level 10 one. */
  const [levelMod, setLevelMod] = useState(1)

  const [teamIds, setTeamIds] = useState<number[]>([])
  const [crew, setCrew] = useState<CardTemplate | null>(null)
  const [weapon, setWeapon] = useState<CardTemplate | null>(null)
  const [difficulty, setDifficulty] = useState(1)

  const [tab, setTab] = useState<Tab>('fighters')
  const [filter, setFilter] = useState<RosterFilter>(EMPTY_FILTER)
  const [cardQuery, setCardQuery] = useState('')
  const [detail, setDetail] = useState<Detail>(null)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const alreadyPlayed = playedHere(player, planet, land)

  useEffect(() => {
    let live = true
    Promise.all([
      fetchRoster(player.wallet),
      fetchCrewCards(player.wallet),
      fetchDungeon(planet, land),
      fetchDifMods(),
      fetchDungeonConfig(),
      fetchBattleConfig(),
      fetchNftValues(),
      fetchClassTemplates(),
    ])
      .then(([r, cards, dungeon, mods, dConfig, bConfig, nfts, temps]) => {
        if (!live) return
        setRoster(r)
        setCrewCards(cards.crew)
        setWeaponCards(cards.weapons)
        setEnemyTeam(dungeon?.fighters ?? [])
        setDifMods(mods)
        setNftValues(nfts)
        setClasses(temps)
        if (dConfig) setEnergyCost(dConfig.energy_cost)
        if (bConfig) {
          setXpPerDifficulty(bConfig.xp_per_dungeon_difficulty)
          setNftMinDifficulty(bConfig.dungeon_nft_fighter_min_difficulty)
          setAgeDecay(Number(bConfig.age_decay) || 0)
          if (bConfig.battle_stat_caps) setCaps(bConfig.battle_stat_caps)
          setLevelMod(Number(bConfig.level_mod) || 1)
        }
      })
      .catch((err) => live && setError(readableError(err)))
    return () => {
      live = false
    }
  }, [player.wallet, planet, land])

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

  useEffect(() => {
    let live = true
    fetchWeather(planet, land)
      .then((w) => live && setWeather(w ?? null))
      /* Weather is context, not a blocker: a failed read leaves it off. */
      .catch(() => live && setWeather(null))
    return () => {
      live = false
    }
  }, [planet, land])

  const enemies = useMemo(() => {
    if (!enemyTeam) return []
    return scaleEnemies(
      /* Weather first, then the difficulty scaling — `apply_weather_and_age`
         runs before the level curve and the two do not commute. */
      enemiesAt(enemyTeam, difficulty, nftMinDifficulty).map((f) =>
        applyWeather(f, weather, caps),
      ),
      difficulty,
      difMods,
    )
  }, [enemyTeam, difficulty, difMods, nftMinDifficulty, weather, caps])

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
  const [restoreNote, setRestoreNote] = useState<string | null>(null)

  useEffect(() => {
    if (restored.current || !roster) return
    restored.current = true

    const usable = new Map(roster.map((f) => [f.fighter_id, fighterAvailable(f)]))
    const back = restoreTeam(recallTeam('dungeon', player.wallet), {
      teamSize: TEAM_SIZE,
      usable,
      crewCards: usableCrew,
      weaponCards: usableWeapons,
    })

    if (back.fighterIds.length) setTeamIds(back.fighterIds)
    if (back.crew) setCrew(back.crew)
    if (back.weapon) setWeapon(back.weapon)

    if (back.dropped.length) {
      const named = back.dropped.map((d) => {
        const f = roster.find((r) => r.fighter_id === d.id)
        return `${f ? f.classname : `#${d.id}`} (${d.reason})`
      })
      setRestoreNote(
        `Left out of your last team: ${named.join(', ')}.`,
      )
    }
  }, [roster, usableCrew, usableWeapons, player.wallet])

  /* Kept current from here on, so leaving without fighting still saves it. */
  useEffect(() => {
    if (!restored.current) return
    rememberTeam('dungeon', player.wallet, {
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

  const autoPickTeamOnly = useCallback(() => {
    if (!roster) return
    setTeamIds(autoPickFighters(roster, matchups, TEAM_SIZE))
  }, [roster, matchups])
  const autoPickButton = (
    <button
      type="button"
      className="btn btn--ghost btn--sm teamauto"
      onClick={autoPickTeamOnly}
      disabled={!roster}
      title="Choose the five fighters that suit this opponent"
    >
      Auto-pick fighters
    </button>
  )

  const autoPickCardsOnly = useCallback(() => {
    const pick = autoPickCards({
      enemies,
      crewCards: usableCrew,
      weaponCards: usableWeapons,
      values: nftValues,
    })
    setCrew(pick.crew)
    setWeapon(pick.weapon)
  }, [enemies, usableCrew, usableWeapons, nftValues])

  const start = async () => {
    if (!session || !block.ready || !crew || !weapon) return
    setBusy(true)
    setError(null)
    setStatus('Finding your cards…')

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
          rememberFight(row, 'dungeon')
          void refreshPlayer({ force: true })
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
        panel: rosterPanel(f),
        template: classes.get(f.classname),
      }),
    [classes],
  )

  const showEnemy = useCallback(
    (f: BattleFighter) =>
      setDetail({
        kind: 'panel',
        panel: battlePanel(f),
        template: classes.get(f.classname),
      }),
    [classes],
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

  const myShare = outlook.share

  const counts: Record<Tab, number> = {
    fighters: roster?.length ?? 0,
    crew: usableCrew.length,
    weapon: usableWeapons.length,
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

        {error && <div className="alert alert--error">{error}</div>}
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
            >
              <span className="versus__team">The dungeon</span>
              <span className="versus__totals mono">
                {formatScaled(outlook.theirs.health)} HP ·{' '}
                {formatScaled(outlook.theirs.damage)} DMG
                <Elemental side={outlook.theirs} against={outlook.mine.bonuses} who="They" />
              </span>
            </header>

            <div className="versus__row">
              {enemies.map((f, i) => (
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
                  level={f.level}
                  health={f.health}
                  damage={f.damage}
                  side="enemy"
                  abilities={picked.length ? enemySlots[i] : undefined}
                  onOpen={() => showEnemy(f)}
                />
              ))}
              {!enemyTeam &&
                Array.from({ length: 5 }, (_, i) => (
                  <div className="skeleton combatcard combatcard--loading" key={i} />
                ))}
              {enemyTeam?.length === 0 && (
                <p className="faint">This dungeon has no team standing.</p>
              )}
            </div>
          </div>

          <div className="versus__divider">
            <span className="versus__vs" aria-hidden="true">
              VS
            </span>
          </div>

          <div className="versus__side versus__side--mine">
            <header
              className="versus__head"
              style={{ ['--share' as string]: `${myShare * 100}%` }}
            >
              <span className="versus__team">
                Your team
                <span className="versus__count">
                  {picked.length}/{TEAM_SIZE}
                </span>
              </span>
              {/*
                 In the header on a desktop, where there is a gap between the
                 team name and the totals doing nothing, and the button is on
                 the line that names what it replaces. A phone has no such gap
                 — the header is already two lines there — so it goes under
                 the row instead.
              */}
              {!phone && autoPickButton}
              <span className="versus__totals mono">
                {formatScaled(outlook.mine.health)} HP ·{' '}
                {formatScaled(outlook.mine.damage)} DMG
                <Elemental side={outlook.mine} against={outlook.theirs.bonuses} who="You" />
              </span>
            </header>

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
                    onRemove={() => toggleFighter(f)}
                  />
                ) : (
                  <div className="combatcard combatcard--empty" key={`empty-${i}`}>
                    <span className="combatcard__plus" aria-hidden="true">
                      +
                    </span>
                    <span className="combatcard__hint">Fighter {i + 1}</span>
                  </div>
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
                />
              ) : (
                <div className="combatcard combatcard--empty combatcard--nft">
                  <span className="combatcard__plus" aria-hidden="true">
                    +
                  </span>
                  <span className="combatcard__hint">
                    NFT Fighter
                    <em>crew + weapon</em>
                  </span>
                </div>
              )}
            </div>

            {phone && autoPickButton}

          </div>

        </section>

        {/*
          Crew and weapon sit outside the versus panel. They are equipment
          chosen once, not combatants being compared, and keeping them in the
          line-up crowded the cards the screen is actually about.
        */}
        <section className="panel loadout">
          <div className="panel__title">
            Loadout
            <span className="faint dungeon__tally">
              crew and weapon combine into your sixth fighter
            </span>
          </div>
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
                  <div className="loadout__figures">
                    {(
                      [
                        ['health', nftFighter.health.min],
                        ['damage', nftFighter.damage.min],
                        ['taunt', nftFighter.taunt.min],
                        ['attackspeed', nftFighter.attackspeed.min],
                        ['initiative', nftFighter.initiative.min],
                      ] as [string, number][]
                    ).map(([field, value]) => (
                      <span
                        className="loadout__figure"
                        key={field}
                        title={STAT_LABEL[field] ?? field}
                      >
                        <img
                          className="loadout__icon"
                          src={statIcon(field)}
                          alt={STAT_LABEL[field] ?? field}
                        />
                        <span className="loadout__v mono">{formatScaled(value)}</span>
                      </span>
                    ))}
                    <span
                      className="loadout__figure"
                      title={`Attacks as ${nftFighter.element} — the weapon decides this`}
                    >
                      <img
                        className="loadout__icon"
                        src={elementIcon(nftFighter.element)}
                        alt=""
                      />
                      <span className="loadout__v loadout__v--element">
                        {weapon ? nftFighter.element : '—'}
                      </span>
                    </span>
                  </div>

                  {/*
                    Both cards' abilities carry over to the combined fighter,
                    and they are frequently the reason to prefer one card over
                    a statistically better one — so they are named here in
                    their rarity colours rather than counted.
                  */}
                  {nftFighter.abilities.length > 0 && (
                    <div className="loadout__abilities">
                      {nftFighter.abilities.map((a, i) => (
                        <span
                          className="loadout__ability"
                          key={`${a.ability}-${i}`}
                          style={{
                            color: abilityColor(a.displayname),
                            borderColor: abilityColor(a.displayname),
                          }}
                          title={resolveAbilityDescription(a)}
                        >
                          {abilityName(a.displayname)}
                        </span>
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

            {/* Beside the slots it fills, and only those. */}
            <button
              type="button"
              className="btn btn--ghost btn--sm cardslots__auto"
              onClick={autoPickCardsOnly}
              disabled={!usableCrew.length && !usableWeapons.length}
              title="Choose the crew and weapon pair that suits this opponent"
            >
              Auto-pick cards
            </button>
          </div>
        </section>

        <section className="panel picker">
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
              />
              <FighterGrid
                roster={roster}
                filter={filter}
                ageDecay={ageDecay}
                levelMod={levelMod}
                teamIds={teamIds}
                full={picked.length >= TEAM_SIZE}
                matchups={enemies.length ? matchups : undefined}
                onToggle={toggleFighter}
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
  return (
    <section className="panel difficulty">
      <div className="panel__title">
        Difficulty
        <span className="faint dungeon__tally">
          Enemy ×{powerAt(value, difMods).toFixed(2)} · Rewards ×
          {rewardAt(value).toFixed(2)} · {xpFor(value, xpPerDifficulty)} XP
        </span>
      </div>
      <div className="difficulty__row" role="radiogroup" aria-label="Difficulty">
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
      {value >= nftMinDifficulty && (
        <p className="hint">
          From difficulty {nftMinDifficulty} the dungeon fields its own NFT fighter
          as well.
        </p>
      )}
    </section>
  )
}
