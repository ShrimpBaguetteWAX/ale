import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, Navigate } from 'react-router-dom'
import { fetchOwnedTemplates, resolveAssetIds } from '@/chain/atomic'
import { landId } from '@/chain/landId'
import { byQuality } from '@/dungeon/nftFighter'
import { useGame } from '@/state/useGame'
import {
  fetchClassTemplate,
  fetchTavernConfig,
  fetchTavernTemplates,
} from '@/tavern/queries'
import {
  HIRE_BASE_AP,
  MAX_HIRE_CARDS,
  calculateHire,
  objectiveLabel,
  suggestCards,
} from '@/tavern/hireCost'
import {
  SCHEMA_TABS,
  type OwnedTemplate,
  type TavernConfig,
  type TavernTemplate,
} from '@/tavern/types'
import {
  GRADE_ICON,
  GRADE_LABEL,
  STAT_LABEL,
  abilityColor,
  abilityName,
  abilityRarity,
  elementBackground,
  fighterArt,
  fighterArtFallback,
  formatResistance,
  formatStat,
  formatTarget,
  gradeStat,
  resolveAbilityDescription,
  statIcon,
  midpoint,
  type ClassTemplate,
} from '@/tavern/fighterStats'
import { fetchFightersConfig } from '@/fighters/queries'
import { fetchRoster } from '@/dungeon/queries'
import { MARKERS, markerIcon } from '@/dungeon/filters'
import { hireFighter, revealFighter, setFighterMarker } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import { asset } from '@/assets'

/**
 * Card art, keyed by template id.
 *
 * These are local thumbnails built by scripts/make-card-thumbs.mjs from the
 * original artwork — the source images average 587KB, which is absurd for a
 * 96px tile. A handful of whitelisted templates (mostly land) have no
 * artwork, so the tile falls back to the generic card.
 */
function cardArt(t: TavernTemplate): string {
  return asset('/assets/cards/') + t.templateid + '.webp'
}

function onArtError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  img.src = asset('/assets/default-card.png')
}

/** The good/bad arrow for one stat, or nothing where it has no meaning. */
function Grade({
  field,
  raw,
  template,
}: {
  field: string
  raw: number
  template: ClassTemplate | undefined
}) {
  const grade = gradeStat(field, raw, template)
  if (!grade) return null
  return (
    <img
      className="grade"
      src={GRADE_ICON[grade]}
      alt={GRADE_LABEL[grade]}
      title={GRADE_LABEL[grade]}
      width={16}
      height={16}
    />
  )
}

/**
 * A marker to put on the recruit, chosen before the hire.
 *
 * Thirty-one of them, so a button that opens the grid rather than the grid
 * itself: the header already carries the cost, Hire and Leave, and a row of
 * swatches six hundred pixels wide would push all three off a laptop.
 */
function MarkerPick({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (marker: string) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  /*
     Nudged back inside the viewport after opening.

     Anchoring to the button's right edge is correct while the header is one
     line and the button sits near the right of the screen. On a phone the
     header wraps and the hire row starts at the left margin, which put a
     232px panel 110px off the left edge. Rather than pick a breakpoint and
     hope, this measures where it actually landed and shifts it back.
  */
  const [shift, setShift] = useState(0)

  useLayoutEffect(() => {
    if (!open) {
      setShift(0)
      return
    }
    const el = pop.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const pad = 8
    if (r.left < pad) setShift(pad - r.left)
    else if (r.right > window.innerWidth - pad) {
      setShift(window.innerWidth - pad - r.right)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div className="markpick" ref={box}>
      <button
        type="button"
        className="markbtn markpick__toggle"
        aria-pressed={!!value}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={value ? `Marker: ${value}` : 'Give this recruit a marker'}
      >
        <img src={markerIcon(value)} alt={value || 'no marker'} />
      </button>

      {open && (
        <div
          className="markpick__pop panel"
          ref={pop}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        >
          <p className="hint" style={{ marginTop: 0 }}>
            {/*
              The second signature is stated up front rather than sprung on
              the player afterwards. `users::hire` takes the cards and the
              cost and nothing else, and the fighter's id is handed out by
              `crtfighter` while the hire is running — so there is nothing to
              mark until it has finished.
            */}
            A label for the roster. The fighter does not exist until the hire
            goes through, so this is set straight after it — one more
            signature.
          </p>
          <div className="markpick__grid">
            {MARKERS.map((m) => (
              <button
                type="button"
                key={m || 'none'}
                className="markbtn"
                aria-pressed={value === m}
                onClick={() => {
                  onChange(m)
                  setOpen(false)
                }}
                title={m || 'No marker'}
              >
                <img src={markerIcon(m)} alt={m || 'none'} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One discount, which turns over when a card claims or releases it.
 *
 * Picking an NFT can change several of these at once — "Best pick" routinely
 * does — and the discount they buy is the whole reason the inventory below is
 * on the screen. Without something to mark it, a row two panels away changed
 * colour and the player found out by looking at the total.
 *
 * The flip goes out to edge-on and back rather than a full turn: the content
 * is the same on both sides, so what a half turn buys is a moment where the
 * row cannot be seen, which is when the new colours arrive. A full 360 would
 * show the text mirrored on the way round to say the same thing.
 *
 * It fires on change only, never on mount — a screen that flipped every
 * satisfied objective on arrival would be noise, not feedback. `flip` counts
 * changes rather than naming a direction so that it can key the element:
 * re-adding the same class does not restart a CSS animation, and a row with
 * no state of its own is free to remount.
 */
function Objective({
  label,
  mod,
  done,
  index,
}: {
  label: string
  mod: number
  done: boolean
  /** Its place in the list, for the cascade when several change together. */
  index: number
}) {
  /*
     The last value seen, not a "have I mounted yet" flag.

     StrictMode runs a mount effect, tears it down and runs it again, so a
     flag set on the first pass is already true on the second and every
     objective the tavern had satisfied flipped the moment the screen opened.
     Comparing the value cannot be fooled by being run twice.
  */
  const seen = useRef(done)
  /** The turn in progress, if any: which way it went and how many have run. */
  const [turn, setTurn] = useState<{ n: number; dir: 'claimed' | 'dropped' } | null>(
    null,
  )

  useEffect(() => {
    if (seen.current === done) return
    seen.current = done
    setTurn((t) => ({ n: (t?.n ?? 0) + 1, dir: done ? 'claimed' : 'dropped' }))
  }, [done])

  return (
    <div
      /*
         Counting turns rather than naming one, because re-adding a class does
         not restart a CSS animation — a player toggling the same card twice
         inside half a second would see the second flip skipped. A changed key
         remounts the row, and a row with no state of its own can afford that.
      */
      key={turn?.n ?? 0}
      className={[
        'objective',
        done ? 'objective--done' : '',
        turn ? `objective--${turn.dir}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--i' as string]: index }}
      onAnimationEnd={(e) => {
        /*
           Dropped off once it has played, so the class is a thing happening
           rather than a mark left behind. The halo outlasts the turn, so a
           claim waits for that one; the child's pop bubbles up here and is
           not ours to act on.
        */
        if (e.target !== e.currentTarget) return
        const last = turn?.dir === 'claimed' ? 'objective-halo' : 'objective-turn'
        if (e.animationName === last) setTurn(null)
      }}
    >
      <span className="objective__label">{label}</span>
      <span className="objective__mod">−{mod}</span>
    </div>
  )
}

/**
 * One stat of a revealed recruit.
 *
 * Values arrive at ten times their displayed size, and stats come as min/max
 * ranges because the roll only happens on hire. The arrow grades the
 * *midpoint* of that range against the class band — the roll to expect.
 */
function StatRow({
  field,
  min,
  max,
  template,
}: {
  field: string
  min: number
  max: number
  template: ClassTemplate | undefined
}) {
  return (
    <div className="statline">
      <span className="statline__k">
        <img className="statline__icon" src={statIcon(field)} alt="" />
        {STAT_LABEL[field] ?? field}
      </span>
      <span className="statline__v mono">
        {formatStat(min, max)}
        <Grade field={field} raw={midpoint(min, max)} template={template} />
      </span>
    </div>
  )
}

const RESISTANCES: [string, string][] = [
  ['res_gem', 'Gem'],
  ['res_metal', 'Metal'],
  ['res_air', 'Air'],
  ['res_fire', 'Fire'],
  ['res_nature', 'Nature'],
  ['res_neutral', 'Neutral'],
]

export default function Tavern() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)
  const refreshPlayer = useGame((s) => s.refreshPlayer)

  const [config, setConfig] = useState<TavernConfig | null>(null)
  const [templates, setTemplates] = useState<TavernTemplate[] | null>(null)
  const [owned, setOwned] = useState<Map<number, number> | null>(null)
  const [tab, setTab] = useState(SCHEMA_TABS[0].key)
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState<'reveal' | 'hire' | 'marker' | null>(null)
  /*
     A marker to put on the recruit, chosen before the hire runs.

     Held here rather than sent with the hire because it cannot be sent with
     it: `users::hire` takes the cards and the cost, and the fighter's id is
     handed out by `crtfighter` while the hire is executing. So the choice is
     remembered and applied to whatever the roster gained.
  */
  const [marker, setMarker] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [classTemplate, setClassTemplate] = useState<ClassTemplate | undefined>()
  /*
     The ascension level that clears a locked ability.

     The recruit on offer arrives with its last ability already flagged
     `locked` — `.p.um.wam`'s Onoros buff, `5thba.wam`'s neutral group buff,
     every revealed recruit on chain — and this screen was the one place
     showing it exactly like the ones that work. The level itself lives on
     `fighters.ale` config, the same read My Fighters and the market make.
  */
  const [unlockLevel, setUnlockLevel] = useState<number | undefined>()

  /*
     The tavern as it was when the hire started, held for as long as the hire
     is still going on.

     `users::hire` empties `last_tavern` and `last_tavern_fighter` on the
     player's row, and the poll that confirms the hire reads that row back —
     so the recruit, the discounts and the land the screen stands on all
     vanished the moment the first transaction landed. With a marker chosen
     that is the middle of the errand, and the player spent the wait between
     two signatures looking at "nobody has stepped forward yet" and a Reveal
     button.

     Not the same thing as not clearing it: the row really has emptied, and
     everything else reading it should see that. This is only what this screen
     draws until it is finished with it.
  */
  const [frozen, setFrozen] = useState<{
    tavern: typeof player.last_tavern
    fighter: typeof player.last_tavern_fighter
  } | null>(null)

  const tavern = frozen?.tavern ?? player.last_tavern
  const fighter = frozen?.fighter ?? player.last_tavern_fighter
  // The contract requires the player to still be standing on the tavern's
  // land, so the screen is only valid while that holds.
  const onTavernLand = !!tavern?.land_id && tavern.land_id === landId(player.x, player.y)
  const revealed = !!fighter && fighter.level > 0

  useEffect(() => {
    fetchTavernConfig()
      .then((c) => setConfig(c ?? null))
      .catch(() => {})
    fetchTavernTemplates()
      .then(setTemplates)
      .catch((err) => setError(readableError(err)))
    fetchFightersConfig()
      .then((c) => setUnlockLevel(c?.asc_ability_unlock_lvl))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!player.wallet) return
    let cancelled = false
    fetchOwnedTemplates(player.wallet)
      .then((m) => !cancelled && setOwned(m))
      .catch(() => !cancelled && setOwned(new Map()))
    return () => {
      cancelled = true
    }
  }, [player.wallet])

  /**
   * Stat bands for the class on offer, so the arrows can say whether this
   * particular roll is good. Keyed by class name, cached hard.
   */
  useEffect(() => {
    const cls = player.last_tavern_fighter?.classname
    if (!cls) return
    let cancelled = false
    fetchClassTemplate(cls)
      .then((t) => !cancelled && setClassTemplate(t))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [player.last_tavern_fighter?.classname])

  /** Whitelisted templates the player actually holds. */
  const inventory: OwnedTemplate[] = useMemo(() => {
    if (!templates || !owned) return []
    return templates
      .filter((t) => owned.has(t.templateid))
      .map((t) => ({ ...t, count: owned.get(t.templateid) ?? 0 }))
      /* Best first, the same order the fight pickers use. */
      .sort(byQuality)
  }, [templates, owned])

  const byId = useMemo(
    () => new Map(inventory.map((t) => [t.templateid, t])),
    [inventory],
  )

  const objectives = useMemo(() => tavern?.objectives ?? [], [tavern])

  const pickedCards = useMemo(
    () => picked.map((id) => byId.get(id)).filter((t): t is OwnedTemplate => !!t),
    [picked, byId],
  )

  const breakdown = useMemo(
    () => calculateHire(objectives, pickedCards),
    [objectives, pickedCards],
  )

  const maxSaving = useMemo(
    () => objectives.reduce((sum, o) => sum + o.mod_value, 0),
    [objectives],
  )

  const canAfford = player.activestats.action_points >= breakdown.cost
  const revealCost = config?.cost_reveal_ap ?? 0
  const canAffordReveal = player.activestats.action_points >= revealCost

  const tabbed = useMemo(() => {
    const known = new Set(SCHEMA_TABS.map((s) => s.key))
    return inventory.filter((t) =>
      tab === 'other' ? !known.has(t.schema) : t.schema === tab,
    )
  }, [inventory, tab])

  const toggle = useCallback((templateId: number) => {
    setPicked((prev) => {
      if (prev.includes(templateId)) return prev.filter((id) => id !== templateId)
      // A hire takes at most three cards. Rather than refusing the click,
      // drop the oldest pick so the tile the player just tapped always
      // ends up selected.
      const next = [...prev, templateId]
      return next.slice(-MAX_HIRE_CARDS)
    })
  }, [])

  const autoPick = useCallback(() => {
    setPicked(suggestCards(objectives, inventory).map((t) => t.templateid))
  }, [objectives, inventory])

  /*
     Held open while a transaction is still running.

     `hire` empties the tavern on the player's row, so the moment it confirms
     this screen has no tavern to be standing on and sends the player back to
     the map. With a marker chosen that happens between the two transactions
     — the wallet's second prompt would arrive over the map, for a screen the
     player had already been thrown out of. The redirect waits for the whole
     errand instead.
  */
  if (!onTavernLand && busy === null) return <Navigate to="/map" replace />

  const doReveal = async () => {
    if (!session) return
    setBusy('reveal')
    setError(null)
    setNotice(null)
    try {
      await revealFighter(session)
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 700))
        await refreshPlayer({ force: true })
        const f = useGame.getState().player?.last_tavern_fighter
        if (f && f.level > 0) break
      }
      setNotice('A new recruit steps forward.')
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(null)
    }
  }

  const doHire = async () => {
    if (!session) return
    setBusy('hire')
    setError(null)
    setNotice(null)
    /* Snapshot before anything can empty the row underneath the screen. */
    setFrozen({ tavern: player.last_tavern, fighter: player.last_tavern_fighter })
    /* Whether the hire itself went through, which decides the cleanup below. */
    let hired = false
    try {
      // The contract wants asset ids; the player picked templates. Resolve
      // one copy of each, in the same order, so the cost the contract
      // recomputes matches the one shown.
      /*
         What the roster already holds, so the fighter this hire adds can be
         told apart afterwards.

         Read before the transaction and only when there is a marker to put
         on: the roster is a per-owner index and the new row is simply the id
         that was not there before. Guessing it instead — `available_primary
         _key` is the next one — would be a race with every other player
         recruiting, and a wrong id in the same transaction would take the
         hire down with it.
      */
      let before: Set<number> | null = null
      if (marker) {
        try {
          const roster = await fetchRoster(player.wallet, true)
          before = new Set(roster.map((f) => f.fighter_id))
        } catch {
          /* Marked afterwards by hand instead; the hire is what matters. */
        }
      }

      const resolved = await resolveAssetIds(player.wallet, picked)
      const assetIds = picked
        .map((id) => resolved.get(id))
        .filter((id): id is string => !!id)

      if (assetIds.length !== picked.length) {
        throw new Error(
          'Could not find one of the selected NFTs in your wallet. Refresh and try again.',
        )
      }

      await hireFighter(session, assetIds, breakdown.cost)
      hired = true

      // Then confirm from chain, which also picks up the spent energy.
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 700))
        await refreshPlayer({ force: true })
        if (!useGame.getState().player?.last_tavern?.land_id) break
      }

      if (!marker || !before) {
        setNotice('Recruit hired. They have joined your roster.')
        return
      }

      /*
         The marker, once there is a fighter to put it on.

         A separate transaction, so the hire is already done and safe by the
         time this is asked for — if the player declines it or it fails, they
         have their recruit and an unmarked row, which they can label from My
         Fighters like any other.
      */
      setBusy('marker')
      try {
        let hired: number | undefined
        for (let i = 0; i < 8 && hired === undefined; i++) {
          const roster = await fetchRoster(player.wallet, true)
          hired = roster.map((f) => f.fighter_id).find((id) => !before!.has(id))
          if (hired === undefined) await new Promise((r) => setTimeout(r, 900))
        }

        if (hired === undefined) {
          throw new Error('the roster has not caught up yet')
        }

        await setFighterMarker(session, hired, marker)
        setMarker('')
        setNotice(`Recruit hired and marked ${marker}.`)
      } catch (err) {
        /*
           Reported as a notice, not an error.

           The hire went through — that is the transaction that cost energy
           and the one the player came for. A red alert here would say the
           recruit had not been taken on, which is the opposite of what
           happened.
        */
        setNotice(
          `Recruit hired. The marker did not go on (${readableError(err)}) — ` +
            'you can set it from My Fighters.',
        )
      }
    } catch (err) {
      setError(readableError(err))
    } finally {
      /*
       * Clear the tavern locally, at the end of the errand rather than the
       * moment the hire confirms.
       *
       * `users::hire` always empties `last_tavern` and `last_tavern_fighter`,
       * so once the transaction is accepted this is certain — and waiting for
       * a read to confirm it is a race the UI can lose. Reads rotate across
       * nodes, and one that is a block or two behind still returns the
       * pre-hire row, which left the map still offering "Enter Tavern" for a
       * tavern the player had just used.
       *
       * Doing it here rather than straight after the hire is what keeps the
       * recruit on screen while the marker is being set: emptied early, this
       * screen has nothing to stand on, falls back to "nobody has stepped
       * forward yet", and offers a Reveal button in the middle of a second
       * signature.
       */
      if (hired) {
        useGame.setState((state) =>
          state.player
            ? {
                player: {
                  ...state.player,
                  last_tavern: {
                    planet: '',
                    x: 0,
                    y: 0,
                    land_id: '',
                    selection_score: 0,
                    boost_score: 0,
                    displayname: '',
                    required_maintenance: '1970-01-01T00:00:00',
                    objectives: [],
                  },
                  last_tavern_fighter: {
                    ...state.player.last_tavern_fighter,
                    level: 0,
                    abilities: [],
                  },
                },
              }
            : state,
        )
        /* The cards go back with the recruit they paid for, not before it. */
        setPicked([])
      }
      /*
         Both last, because both hold the screen: `frozen` is what it draws
         and `busy` is what keeps the redirect from firing. Dropping either
         earlier is what emptied the panel between the two signatures.
      */
      setFrozen(null)
      setBusy(null)
    }
  }

  return (
    <div className="tavern">
      <img className="tavern__art" src={asset("/assets/background/bg-tavern.png")} alt="" />
      <div className="tavern__scrim" />

      <div className="tavern__inner">
        <header className="tavern__head">
          <div>
            <h1 className="tavern__title">{tavern.displayname || 'Tavern'}</h1>
            <p className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
              <span style={{ textTransform: 'capitalize' }}>{tavern.planet}</span>{' '}
              <span className="mono">
                {tavern.x}:{tavern.y}
              </span>{' '}
              · <span className="mono">{tavern.land_id}</span>
            </p>
          </div>
          <span className="spacer" />

          {/*
            Hire lives up here with Leave rather than in a bar pinned to the
            bottom: it is the same decision as leaving, and the cost belongs
            next to the button that spends it.
          */}
          {revealed && (
            <div className="hire">
              <div className="hire__cost">
                <span
                  className={`hire__value${canAfford ? '' : ' hire__value--short'}`}
                >
                  <img src={asset("/assets/icons/energy.png")} alt="" />
                  {breakdown.cost}
                </span>
                <span className="hire__detail">
                  {breakdown.saved > 0 ? (
                    <>
                      <s className="faint">{HIRE_BASE_AP}</s> saved {breakdown.saved}
                    </>
                  ) : (
                    <>from {HIRE_BASE_AP}</>
                  )}
                  {' · '}
                  {picked.length}/{MAX_HIRE_CARDS} cards
                </span>
              </div>

              {/*
                Beside Hire, because it is a decision about the fighter being
                hired even though it cannot travel in the same transaction.
                Choosing it here rather than hunting the new row down in My
                Fighters is the whole point.
              */}
              <MarkerPick
                value={marker}
                onChange={setMarker}
                disabled={busy !== null}
              />

              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void doHire()}
                disabled={busy !== null || !canAfford}
              >
                {(busy === 'hire' || busy === 'marker') && (
                  <span className="spinner" />
                )}
                {busy === 'hire'
                  ? 'Hiring'
                  : busy === 'marker'
                    ? 'Marking'
                    : 'Hire recruit'}
              </button>
            </div>
          )}

          <Link className="btn btn--ghost" to="/map">
            Leave
          </Link>
        </header>

        {error && <div className="alert alert--error">{error}</div>}
        {notice && <div className="alert alert--ok">{notice}</div>}

        <div className="tavern__grid">
          {/* ---- The recruit ---- */}
          <section className="panel tavern__fighter">
            <div className="panel__title">The recruit</div>

            {!revealed ? (
              <div className="tavern__empty">
                <img src={asset("/assets/fighter/unknown-fighter.jpeg")} alt="" />
                <p className="muted">
                  Nobody has stepped forward yet. Reveal to see who this tavern
                  has on offer.
                </p>
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  onClick={() => void doReveal()}
                  disabled={busy !== null || !canAffordReveal}
                >
                  {busy === 'reveal' && <span className="spinner" />}
                  {busy === 'reveal' ? 'Revealing' : `Reveal — ${revealCost} energy`}
                </button>
                {!canAffordReveal && (
                  <p className="hint hint--error">Not enough energy.</p>
                )}
              </div>
            ) : (
              <>
                {/* Class art over its elemental backdrop, as the original. */}
                <div
                  className="portrait"
                  style={{
                    backgroundImage: `url('${elementBackground(fighter.element)}')`,
                  }}
                >
                  <img
                    className="portrait__art"
                    src={fighterArt(fighter)}
                    alt={`${fighter.classname} ${fighter.racename}`}
                    onError={(e) => {
                      const img = e.currentTarget
                      if (img.dataset.fallback) return
                      img.dataset.fallback = '1'
                      img.src = fighterArtFallback()
                    }}
                  />
                  <span className="portrait__level tag">Level {fighter.level}</span>
                </div>

                <div className="recruit__head">
                  <div>
                    <div className="recruit__class">{fighter.classname}</div>
                    <div className="recruit__meta">
                      {fighter.racename} · {fighter.element}
                    </div>
                  </div>
                </div>

                {/*
                  Stats and resistances side by side where there is room.

                  They are two lists of numbers about the same fighter, and
                  stacked they pushed the abilities — the thing that actually
                  separates one recruit from another — a screen and a half
                  down. Beside each other they cost the height of the taller
                  one instead of the sum. One column on anything narrower,
                  where side-by-side would just be two cramped columns.
                */}
                <div className="recruit__cols">
                <div className="recruit__stats">
                  {/*
                     Damage, then health, then the two timings together, then
                     taunt and who it goes for.

                     Damage leads because it is what a recruit is bought for;
                     health says how long it keeps doing it. Cooldown and
                     wind-up are one question in two halves - how often it
                     swings and how long before the first one - so they sit
                     together rather than either side of taunt.

                     Cooldown and wind-up, not "attack speed" and "initiative":
                     the contract's numbers are delays, so lower is better and
                     the old labels told the player the opposite.
                  */}
                  <StatRow
                    field="damage"
                    min={fighter.damage_min}
                    max={fighter.damage_max}
                    template={classTemplate}
                  />
                  <StatRow
                    field="health"
                    min={fighter.health_min}
                    max={fighter.health_max}
                    template={classTemplate}
                  />
                  <StatRow
                    field="attackspeed"
                    min={fighter.attackspeed_min}
                    max={fighter.attackspeed_max}
                    template={classTemplate}
                  />
                  <StatRow
                    field="initiative"
                    min={fighter.initiative_min}
                    max={fighter.initiative_max}
                    template={classTemplate}
                  />
                  <StatRow
                    field="taunt"
                    min={fighter.taunt_min}
                    max={fighter.taunt_max}
                    template={classTemplate}
                  />
                  <div className="statline">
                    <span className="statline__k">
                      <img
                        className="statline__icon"
                        src={statIcon('target')}
                        alt=""
                      />
                      Targets
                    </span>
                    <span className="statline__v">{formatTarget(fighter.target)}</span>
                  </div>
                  <div className="statline">
                    <span className="statline__k">Credits</span>
                    <span className="statline__v mono">{fighter.credits}</span>
                  </div>
                </div>

                {/*
                  Resistances as stat rows, not tiles.

                  Beside the main stats they are the same kind of thing —
                  a named figure with a grade against it — and two different
                  presentations of that, a column of rows next to a block of
                  cells, read as two unrelated panels rather than one fighter.

                  Its own container rather than the shared `.resgrid`, which
                  FighterPanel uses in the dungeon, the arena and the market
                  and which the loadout restyles again.
                */}
                <div className="recruit__res">
                  {RESISTANCES.map(([key, label]) => {
                    const raw = (fighter as unknown as Record<string, number>)[key]
                    return (
                      <div className="statline" key={key}>
                        <span className="statline__k">
                          <img
                            className="statline__icon"
                            src={asset(`/assets/icons/elements/${label.toLowerCase()}.png`)}
                            alt=""
                          />
                          {label}
                        </span>
                        <span className="statline__v mono">
                          {formatResistance(raw)}
                          <Grade field={key} raw={raw} template={classTemplate} />
                        </span>
                      </div>
                    )
                  })}
                </div>
                </div>

                {fighter.abilities.length > 0 && (
                  <div className="abilities">
                    {fighter.abilities.map((a, i) => {
                      const rarity = abilityRarity(a.displayname)
                      /*
                         The recruit's last ability does not work yet.

                         This is the screen where a player decides whether the
                         roll is worth the energy, and an ability they cannot
                         use for several ascensions was reading as one of the
                         reasons to hire — which is the most expensive place
                         in the game to overstate a fighter.
                      */
                      const locked = !!a.locked
                      return (
                        <div
                          className={`ability${locked ? ' ability--locked' : ''}`}
                          key={`${a.ability}-${i}`}
                          style={{ borderLeftColor: abilityColor(a.displayname) }}
                        >
                          <div
                            className="ability__name"
                            style={{ color: abilityColor(a.displayname) }}
                          >
                            {abilityName(a.displayname)}
                            {rarity && <span className="ability__rarity">{rarity}</span>}
                            {locked && (
                              <span className="ability__locked">
                                <img
                                  src={asset('/assets/icons/lock.svg')}
                                  alt=""
                                  width={11}
                                  height={11}
                                />
                                {unlockLevel
                                  ? `Unlocks at ascension ${unlockLevel}`
                                  : 'Unlocks on ascension'}
                              </span>
                            )}
                          </div>
                          <div className="ability__desc">
                            {resolveAbilityDescription(a)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

              </>
            )}
          </section>

          {/* ---- Objectives ---- */}
          <section className="panel tavern__objectives">
            <div className="row" style={{ marginBottom: 'var(--sp-2)' }}>
              <span className="panel__title">Discounts</span>
              <span className="spacer" />
              <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                {breakdown.saved} / {maxSaving} claimed
              </span>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
              Show this tavern Alien Worlds NFTs matching what it wants and it
              takes energy off the hire. Your NFTs are not spent — they only
              need to be in your wallet.
            </p>

            <div className="objectives">
              {objectives.map((o, i) => (
                <Objective
                  key={`${o.objective_type}-${o.objective_string}-${o.objective_value}-${i}`}
                  label={objectiveLabel(o)}
                  mod={o.mod_value}
                  done={breakdown.matched.has(i)}
                  index={i}
                />
              ))}
              {objectives.length === 0 && (
                <p className="muted">This tavern is asking for nothing today.</p>
              )}
            </div>
          </section>

          {/* ---- Inventory ---- */}
          <section className="panel tavern__inventory">
            <div className="row row--wrap" style={{ marginBottom: 'var(--sp-3)' }}>
              <span className="panel__title">Your NFTs</span>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={autoPick}
                disabled={inventory.length === 0 || objectives.length === 0}
                title="Pick the cards that take the most energy off"
              >
                Best pick
              </button>
              {picked.length > 0 && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setPicked([])}
                >
                  Clear
                </button>
              )}
            </div>

            {/*
              Selected cards live above the tabs, not inside them: "Best pick"
              routinely chooses cards from three different schemas, and
              without this the player sees the price drop with nothing to
              show for it.
            */}
            {pickedCards.length > 0 && (
              <div className="picked">
                <span className="picked__label">Selected</span>
                <div className="picked__row">
                  {pickedCards.map((t, i) => {
                    const gain = (breakdown.matchedByCard[i] ?? []).reduce(
                      (sum, oi) => sum + (objectives[oi]?.mod_value ?? 0),
                      0,
                    )
                    return (
                      <button
                        type="button"
                        key={t.templateid}
                        className="pickedcard"
                        onClick={() => toggle(t.templateid)}
                        title={`${t.cardname} — click to remove`}
                      >
                        <img src={cardArt(t)} alt="" onError={onArtError} />
                        <span
                          className={
                            'pickedcard__gain' +
                            (gain > 0 ? '' : ' pickedcard__gain--none')
                          }
                        >
                          {gain > 0 ? '-' + gain : '0'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="tabs" role="tablist">
              {SCHEMA_TABS.map((s) => {
                const count = inventory.filter((t) => t.schema === s.key).length
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="tab"
                    className="tabs__tab"
                    aria-selected={tab === s.key}
                    onClick={() => setTab(s.key)}
                  >
                    {s.label}
                    <span className="tabs__count">{count}</span>
                  </button>
                )
              })}
            </div>

            {!templates || !owned ? (
              <div className="cardgrid">
                {Array.from({ length: 8 }, (_, i) => (
                  <div className="skeleton cardtile cardtile--loading" key={i} />
                ))}
              </div>
            ) : tabbed.length === 0 ? (
              <p className="muted" style={{ padding: 'var(--sp-5) 0' }}>
                No eligible NFTs of this type in your wallet.
              </p>
            ) : (
              <div className="cardgrid">
                {tabbed.map((t) => {
                  const index = picked.indexOf(t.templateid)
                  const claims = index >= 0 ? breakdown.matchedByCard[index] ?? [] : []
                  const gain = claims.reduce(
                    (sum, oi) => sum + (objectives[oi]?.mod_value ?? 0),
                    0,
                  )
                  return (
                    <button
                      type="button"
                      key={t.templateid}
                      className={`cardtile${index >= 0 ? ' cardtile--picked' : ''}`}
                      onClick={() => toggle(t.templateid)}
                      title={`${t.cardname} · ${t.rarity} ${t.schema}`}
                    >
                      <img
                        src={cardArt(t)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={onArtError}
                      />
                      <span className="cardtile__name">{t.cardname}</span>
                      {t.count > 1 && <span className="cardtile__count">×{t.count}</span>}
                      {index >= 0 && (
                        <span className="cardtile__gain">
                          {gain > 0 ? `−${gain}` : 'no match'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
