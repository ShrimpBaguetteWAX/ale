import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '@/state/useGame'
import { landId } from '@/chain/landId'
import { resolveAssetIds, type CardTemplate } from '@/chain/atomic'
import { fetchPlanetLands } from '@/chain/queries'
import type { Land } from '@/chain/types'
import {
  fetchBattleConfig,
  fetchClassTemplates,
  fetchCrewCards,
  fetchFight,
  fetchNftValues,
  fetchRoster,
  randomHistoryId,
} from '@/dungeon/queries'
import { fighterAvailable } from '@/dungeon/rules'
import { EMPTY_FILTER, type RosterFilter } from '@/dungeon/filters'
import {
  battleAsFlat,
  enemyProfile,
  matchupBetween,
  matchupsFor,
  teamOutlook,
  type FlatFighter,
} from '@/fight/matchup'
import { recallTeam, rememberTeam, restoreTeam } from '@/fight/lastTeam'
import { autoPickTeam } from '@/fight/autopick'
import {
  NFT_FIGHTER_ART,
  combineNftFighter,
  nftAsPanel,
  type NftValue,
} from '@/dungeon/nftFighter'
import { rememberFight } from '@/dungeon/fightStore'
import { TEAM_SIZE, type BattleFighter, type RosterFighter } from '@/dungeon/types'
import {
  fetchArenaConfig,
  fetchArenaPower,
  fetchLiveArena,
  type LiveArenaRow,
} from '@/arena/queries'
import {
  ARENA_POWER_FULL,
  ARENA_POWER_PER_LOSS,
  NFT_FIGHTER_ID,
  alreadyDefending,
  applyArenaPower,
  arenaMaintained,
  arenaPowerPercent,
  canChallenge,
  myDefenders,
} from '@/arena/rules'
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
import { fieldedStats, levelFactor, ageFactor } from '@/fight/scaling'
import { playArena } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import { asset } from '@/assets'

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
export default function Arena() {
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
  const [arena, setArena] = useState<LiveArenaRow | undefined>(undefined)
  const [arenaLoaded, setArenaLoaded] = useState(false)
  const [arenaPower, setArenaPower] = useState(ARENA_POWER_FULL)
  const [tile, setTile] = useState<Land | undefined>(undefined)
  const [energyCost, setEnergyCost] = useState(50)
  const [xpPerWin, setXpPerWin] = useState(0)
  const [ageDecay, setAgeDecay] = useState(0)
  const [levelMod, setLevelMod] = useState(1)

  const [teamIds, setTeamIds] = useState<number[]>([])
  const [crew, setCrew] = useState<CardTemplate | null>(null)
  const [weapon, setWeapon] = useState<CardTemplate | null>(null)

  const [tab, setTab] = useState<Tab>('fighters')
  const [filter, setFilter] = useState<RosterFilter>(EMPTY_FILTER)
  const [cardQuery, setCardQuery] = useState('')
  const [detail, setDetail] = useState<Detail>(null)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([
      fetchRoster(player.wallet),
      fetchCrewCards(player.wallet),
      fetchLiveArena(planet, land, true),
      fetchArenaPower(planet, land, true),
      fetchArenaConfig(),
      fetchBattleConfig(),
      fetchNftValues(),
      fetchClassTemplates(),
      fetchPlanetLands(planet),
    ])
      .then(([r, cards, live_, power, aConfig, bConfig, nfts, temps, lands]) => {
        if (!live) return
        setRoster(r)
        setCrewCards(cards.crew)
        setWeaponCards(cards.weapons)
        setArena(live_)
        setArenaLoaded(true)
        setNftValues(nfts)
        setClasses(temps)
        setTile(lands.find((l) => l.land_id === land))
        /*
           `battle.cpp` reads the stored `arena_power` at the moment of the
           fight — it does not age it forward first. A cron decays every arena
           every few minutes, so the stored value is what the fight will use
           and what belongs on screen.
        */
        if (power) setArenaPower(Number(power.arena_power))
        if (aConfig) setEnergyCost(Number(aConfig.energy_cost))
        if (bConfig) {
          setXpPerWin(Number(bConfig.xp_per_arena_win ?? 0))
          setAgeDecay(Number(bConfig.age_decay) || 0)
          setLevelMod(Number(bConfig.level_mod) || 1)
        }
      })
      .catch((err) => live && setError(readableError(err)))
    return () => {
      live = false
    }
  }, [player.wallet, planet, land])

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
        (arena?.fighters ?? []).map((f) =>
          fieldedStats(f, f.level, f.creation_date, levelMod, ageDecay),
        ),
        arenaPower,
      ),
    [arena, arenaPower, levelMod, ageDecay],
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
  const [restoreNote, setRestoreNote] = useState<string | null>(null)

  useEffect(() => {
    if (restored.current || !roster) return
    restored.current = true

    const usable = new Map(roster.map((f) => [f.fighter_id, fighterAvailable(f)]))
    const back = restoreTeam(recallTeam('arena', player.wallet), {
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
      setRestoreNote(`Left out of your last team: ${named.join(', ')}.`)
    }
  }, [roster, usableCrew, usableWeapons, player.wallet])

  /* Kept current from here on, so leaving without fighting still saves it. */
  useEffect(() => {
    if (!restored.current) return
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
  const autoPick = useCallback(() => {
    if (!roster) return
    const pick = autoPickTeam({
      roster,
      matchups,
      enemies,
      teamSize: TEAM_SIZE,
      crewCards: usableCrew,
      weaponCards: usableWeapons,
      values: nftValues,
    })
    setTeamIds(pick.fighterIds)
    setCrew(pick.crew)
    setWeapon(pick.weapon)
  }, [roster, matchups, enemies, usableCrew, usableWeapons, nftValues])

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
          rememberFight(row, 'arena')
          void refreshPlayer({ force: true })
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
     Your own five get the same treatment, for the same reason: team 1 is also
     passed a difficulty of 0. Their stats are still a min/max band rather
     than a settled roll, so the midpoint stands in for the roll to expect.
  */
  const myFielded = useMemo(
    () =>
      picked.map((f) => {
        const factor =
          levelFactor(f.stats.level, levelMod) *
          ageFactor(f.creation_date, ageDecay)
        return {
          health: Math.trunc(mid(f.stats.health_min, f.stats.health_max) * factor),
          damage: Math.trunc(mid(f.stats.damage_min, f.stats.damage_max) * factor),
        }
      }),
    [picked, levelMod, ageDecay],
  )

  /* The same team in the shape the matchup reads, the NFT fighter included. */
  const myFlat = useMemo<FlatFighter[]>(() => {
    const out: FlatFighter[] = picked.map((f, i) => ({
      element: f.element,
      classname: f.classname,
      racename: f.racename,
      damage: myFielded[i]?.damage ?? 0,
      health: myFielded[i]?.health ?? 0,
      attackspeed: mid(f.stats.attackspeed_min, f.stats.attackspeed_max),
      taunt: mid(f.stats.taunt_min, f.stats.taunt_max),
      initiative: mid(f.stats.initiative_min, f.stats.initiative_max),
      res_gem: f.stats.res_gem, res_metal: f.stats.res_metal, res_air: f.stats.res_air,
      res_fire: f.stats.res_fire, res_nature: f.stats.res_nature,
      res_neutral: f.stats.res_neutral,
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
  }, [picked, myFielded, crew, weapon, nftValues])

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

  const myShare = outlook.share

  const counts: Record<Tab, number> = {
    fighters: roster?.length ?? 0,
    crew: usableCrew.length,
    weapon: usableWeapons.length,
  }

  const maintained = arenaMaintained(tile)

  return (
    <div className="dungeon arena">
      <img className="dungeon__art" src={asset("/assets/background/bg-arena.png")} alt="" />
      <div className="dungeon__scrim" />

      <div className="dungeon__inner">
        <header className="dungeon__head">
          <div>
            <h1 className="page__title">Arena</h1>
            <p className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
              {planet} · {land} · {player.x},{player.y}
            </p>
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
              disabled={busy || !block.ready}
              title={block.reason}
            >
              {busy && <span className="spinner" />}
              {busy ? (status ?? 'Fighting…') : 'Challenge'}
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

        <ArenaStanding
          power={arenaPower}
          xpPerWin={xpPerWin}
          lastFight={arena?.last_fight}
          defenders={arena?.fighters.length ?? 0}
        />

        <section className="versus">
          <div className="versus__side versus__side--enemy">
            <header
              className="versus__head"
              style={{ ['--share' as string]: `${(1 - myShare) * 100}%` }}
            >
              <span className="versus__team">The defenders</span>
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
                  classname={f.classname}
                  racename={f.racename}
                  level={f.level}
                  health={f.health}
                  damage={f.damage}
                  side="enemy"
                  badge={f.fighter_id === NFT_FIGHTER_ID ? 'NFT' : undefined}
                  art={f.fighter_id === NFT_FIGHTER_ID ? NFT_FIGHTER_ART : undefined}
                  owner={f.gamertag || f.owner}
                  abilities={picked.length ? enemySlots[i] : undefined}
                  onOpen={() => showEnemy(f)}
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
              <span className="versus__totals mono">
                {formatScaled(outlook.mine.health)} HP ·{' '}
                {formatScaled(outlook.mine.damage)} DMG
                <Elemental side={outlook.mine} against={outlook.theirs.bonuses} who="You" />
              </span>
            </header>

            <div className="versus__row">
              {team.map((f, i) =>
                f ? (
                  /* Fielded, like the header totals above and the picker
                     below: the line-up between them must not be the one place
                     still printing the stored roll. `myFielded` is
                     index-aligned with `picked`. */
                  <CombatCard
                    key={f.fighter_id}
                    element={f.element}
                    classname={f.classname}
                    racename={f.racename}
                    level={f.stats.level}
                    health={myFielded[i]?.health ?? 0}
                    damage={myFielded[i]?.damage ?? 0}
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

              {nftFighter ? (
                <CombatCard
                  element={nftFighter.element}
                  classname="NFT Fighter"
                  racename={nftFighter.subtitle ?? ''}
                  health={nftFighter.health.min}
                  damage={nftFighter.damage.min}
                  side="mine"
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
          </div>
        </section>

        {/*
          What a win costs, stated where the team is chosen rather than in the
          result screen where it would be a surprise. `battle.cpp` picks one of
          the five at random — not the weakest, not the survivor — and hands it
          to `fighterchg`, which marks it in use and stands it in the arena.
        */}
        <p className="hint arena__stake">
          Win and one of your five, chosen at random, stays here to defend the
          arena along with your NFT fighter. It is marked in use until somebody
          knocks it out.
        </p>

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

            <button
              type="button"
              className="btn btn--ghost btn--sm cardslots__auto"
              onClick={autoPick}
              disabled={!roster}
            >
              Auto-pick
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
              onPick={(c) => (tab === 'crew' ? setCrew(c) : setWeapon(c))}
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

/* ---------- the arena's current strength ---------- */

/**
 * What replaces the dungeon's difficulty ladder.
 *
 * There is nothing to choose here, so this reports rather than asks. The one
 * number that matters is `arena_power`: it scales every defender's health and
 * damage, it drops by a hundredth of full strength each time a challenger
 * fails, and it snaps back to full the moment somebody wins. A long-unbeaten
 * arena is a *harder* fight than one that has just turned over — the opposite
 * of the intuition a dungeon builds — so the bar is labelled with what the
 * number does rather than left to read as a score.
 */
function ArenaStanding({
  power,
  xpPerWin,
  lastFight,
  defenders,
}: {
  power: number
  xpPerWin: number
  lastFight: string | undefined
  defenders: number
}) {
  const percent = arenaPowerPercent(power)
  const band = percent >= 90 ? 'high' : percent >= 50 ? 'mid' : 'low'
  const since = useMemo(() => {
    if (!lastFight) return null
    const then = Date.parse(lastFight + 'Z')
    if (!Number.isFinite(then)) return null
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
    if (mins < 60) return `${mins} min ago`
    const hours = Math.round(mins / 60)
    if (hours < 48) return `${hours} h ago`
    return `${Math.round(hours / 24)} days ago`
  }, [lastFight])

  return (
    <section className="panel arenastanding">
      <div className="panel__title">
        Defender strength
        <span className="faint dungeon__tally">
          {defenders} defending · {xpPerWin} XP for a win
          {since ? ` · last fought ${since}` : ''}
        </span>
      </div>

      <div className={`arenabar arenabar--${band}`}>
        <span
          className="arenabar__fill"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
        <span className="arenabar__text mono">{percent.toFixed(0)}%</span>
      </div>

      <p className="hint">
        Health and damage are scaled to this. It falls{' '}
        {(ARENA_POWER_PER_LOSS / ARENA_POWER_FULL) * 100}% every time a
        challenger loses here, and returns to full the moment somebody wins.
      </p>
    </section>
  )
}
