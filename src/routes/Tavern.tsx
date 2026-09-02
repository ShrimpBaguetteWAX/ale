import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { fetchOwnedTemplates, resolveAssetIds } from '@/chain/atomic'
import { landId } from '@/chain/landId'
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
import { hireFighter, revealFighter } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'

/**
 * Card art, keyed by template id.
 *
 * These are local thumbnails built by scripts/make-card-thumbs.mjs from the
 * original artwork — the source images average 587KB, which is absurd for a
 * 96px tile. A handful of whitelisted templates (mostly land) have no
 * artwork, so the tile falls back to the generic card.
 */
function cardArt(t: TavernTemplate): string {
  return '/assets/cards/' + t.templateid + '.webp'
}

function onArtError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  img.src = '/assets/default-card.png'
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
  const [busy, setBusy] = useState<'reveal' | 'hire' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [classTemplate, setClassTemplate] = useState<ClassTemplate | undefined>()

  const tavern = player.last_tavern
  const fighter = player.last_tavern_fighter
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

  if (!onTavernLand) return <Navigate to="/map" replace />

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
    try {
      // The contract wants asset ids; the player picked templates. Resolve
      // one copy of each, in the same order, so the cost the contract
      // recomputes matches the one shown.
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

      /*
       * Clear the tavern locally, straight away.
       *
       * `users::hire` always empties `last_tavern` and `last_tavern_fighter`,
       * so once the transaction is accepted this is certain — and waiting for
       * a read to confirm it is a race the UI can lose. Reads rotate across
       * nodes, and one that is a block or two behind still returns the
       * pre-hire row, which left the map still offering "Enter Tavern" for a
       * tavern the player had just used.
       */
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

      // Then confirm from chain, which also picks up the spent energy.
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 700))
        await refreshPlayer({ force: true })
        if (!useGame.getState().player?.last_tavern?.land_id) break
      }
      setPicked([])
      setNotice('Recruit hired. They have joined your roster.')
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="tavern">
      <img className="tavern__art" src="/assets/background/bg-tavern.png" alt="" />
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
                  <img src="/assets/icons/energy.png" alt="" />
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

              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void doHire()}
                disabled={busy !== null || !canAfford}
              >
                {busy === 'hire' && <span className="spinner" />}
                {busy === 'hire' ? 'Hiring' : 'Hire recruit'}
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
                <img src="/assets/fighter/unknown-fighter.jpeg" alt="" />
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

                <div style={{ marginTop: 'var(--sp-3)' }}>
                  <StatRow
                    field="health"
                    min={fighter.health_min}
                    max={fighter.health_max}
                    template={classTemplate}
                  />
                  <StatRow
                    field="damage"
                    min={fighter.damage_min}
                    max={fighter.damage_max}
                    template={classTemplate}
                  />
                  <StatRow
                    field="taunt"
                    min={fighter.taunt_min}
                    max={fighter.taunt_max}
                    template={classTemplate}
                  />
                  {/*
                    Cooldown and wind-up, not "attack speed" and "initiative":
                    the contract's numbers are delays, so lower is better and
                    the old labels told the player the opposite.
                  */}
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
                  <div className="statline">
                    <span className="statline__k">Targets</span>
                    <span className="statline__v">{formatTarget(fighter.target)}</span>
                  </div>
                  <div className="statline">
                    <span className="statline__k">Credits</span>
                    <span className="statline__v mono">{fighter.credits}</span>
                  </div>
                </div>

                <div className="resgrid">
                  {RESISTANCES.map(([key, label]) => {
                    const raw = (fighter as unknown as Record<string, number>)[key]
                    return (
                      <div className="resgrid__cell" key={key}>
                        <img
                          src={`/assets/icons/elements/${label.toLowerCase()}.png`}
                          alt=""
                        />
                        <span className="resgrid__label">{label}</span>
                        <span className="resgrid__value mono">
                          {formatResistance(raw)}
                          <Grade field={key} raw={raw} template={classTemplate} />
                        </span>
                      </div>
                    )
                  })}
                </div>

                {fighter.abilities.length > 0 && (
                  <div className="abilities">
                    {fighter.abilities.map((a, i) => {
                      const rarity = abilityRarity(a.displayname)
                      return (
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
                            {rarity && <span className="ability__rarity">{rarity}</span>}
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
                <div
                  className={`objective${breakdown.matched.has(i) ? ' objective--done' : ''}`}
                  key={`${o.objective_type}-${o.objective_string}-${o.objective_value}-${i}`}
                >
                  <span className="objective__label">{objectiveLabel(o)}</span>
                  <span className="objective__mod">−{o.mod_value}</span>
                </div>
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
