import { useMemo, useState } from 'react'
import { useGame } from '@/state/useGame'
import { useChainQuery } from '@/chain/useChainQuery'
import { useAction } from '@/wharf/useAction'
import { redeemOutpostOffer } from '@/wharf/actions'
import { ActionBanner } from '@/components/ActionBanner'
import { asset, ipfsPreview } from '@/assets'
import { GameImg } from '@/components/GameImg'
import {
  canRedeem,
  closesIn,
  formatShards,
  offerArt,
  opensIn,
  outpostBoard,
  shardBalance,
} from './rules'
import { fetchOutpostOffers, fetchPointOffers, fetchUserPoints } from './queries'
import type { OutpostOffer } from './types'
import { usePhone } from '@/components/usePhone'
import { CardTags, rarityEdge, Showcase } from '@/shop/Showcase'

/*
   A phone shows the offers as rows, a rarity at a time, in one list that
   scrolls. Rarest last, the way Alien Worlds orders them.
*/
const RARITY_ORDER = ['Abundant', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical']
const SOON = 'Coming soon'

/**
 * The Alien Worlds Outpost, inside our shop.
 *
 * The offers are `uspts.worlds` rows and the NFT is minted by the Outpost
 * straight into the player's wallet, without any Alien Legends contract
 * seeing it. The shards, though, are the ones this game's reward pools pay
 * out: the same currency, held on Alien Worlds' own ledger, which is why a
 * balance earned by mining here can be spent there.
 *
 * So what the tab has to be clear about is not which shards these are — they
 * are the player's own — but that this is the one tab where the money and the
 * goods both sit outside the game. Nothing here spends gems, credits or
 * energy, nothing arrives on the roster, and there is no step of it we could
 * reverse.
 */

const SHARD_ICON = asset('/assets/icons/aw-shard.svg')

/** A shard figure with its icon, so a price is never a bare number. */
function Shards({ raw, className }: { raw: number; className?: string }) {
  return (
    <span className={'awshards' + (className ? ' ' + className : '')}>
      <img src={SHARD_ICON} alt="" width={14} height={14} />
      <span className="mono">{formatShards(raw)}</span>
    </span>
  )
}

export function OutpostTab() {
  const player = useGame((s) => s.player)!
  const session = useGame((s) => s.session)
  const { busy, error, run } = useAction()
  const [confirming, setConfirming] = useState<OutpostOffer | null>(null)

  /*
     One query for both halves. The offer list and the shard balance are read
     from the same contract and are useless apart: a price with no balance
     cannot say whether it is affordable, and a balance with no prices has
     nothing to be measured against.
  */
  const board = useChainQuery(
    player.wallet && `outpost:${player.wallet}`,
    async () => {
      const [offers, points] = await Promise.all([
        fetchPointOffers(),
        fetchUserPoints(player.wallet).catch(() => undefined),
      ])
      /* Split first, then fetch artwork only for what survives — the table
         keeps every expired offer and there are far more of those. */
      const live = outpostBoard(offers.map((offer) => ({ offer })))
      const withArt = await fetchOutpostOffers([
        ...live.active.map((e) => e.offer),
        ...live.upcoming.map((e) => e.offer),
      ])
      return { offers: withArt, points }
    },
  )

  const balance = shardBalance(board.data?.points)
  const registered = board.data?.points !== undefined

  const { active, upcoming } = useMemo(
    () => outpostBoard(board.data?.offers ?? []),
    [board.data],
  )

  const phone = usePhone()
  /* The rarities on offer, in order, each with how many are open. */
  const rarities = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of active) {
      const r = e.template?.rarity || 'Other'
      counts.set(r, (counts.get(r) ?? 0) + 1)
    }
    const rank = (r: string) => {
      const i = RARITY_ORDER.indexOf(r)
      return i < 0 ? RARITY_ORDER.length : i
    }
    return [...counts.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))
  }, [active])
  const [rarity, setRarity] = useState<string | null>(null)
  const shownRarity =
    rarity === SOON && upcoming.length > 0
      ? SOON
      : rarities.some(([r]) => r === rarity)
        ? rarity!
        : (rarities[0]?.[0] ?? null)
  const inRarity =
    shownRarity === SOON
      ? upcoming
      : active.filter((e) => (e.template?.rarity || 'Other') === shownRarity)
  const pickRarity = setRarity
  /* A desktop filters the one list instead, and starts on all of it. */
  const [deskRarity, setDeskRarity] = useState<string | null>(null)
  const deskShown = rarities.some(([r]) => r === deskRarity) ? deskRarity : null
  const openShown = phone
    ? shownRarity === SOON
      ? []
      : inRarity
    : deskShown
      ? active.filter((e) => (e.template?.rarity || 'Other') === deskShown)
      : active
  const soonShown = phone ? (shownRarity === SOON ? inRarity : []) : upcoming

  const redeem = (entry: OutpostOffer) => {
    setConfirming(null)
    return run(
      `outpost:${entry.offer.id}`,
      () => redeemOutpostOffer(session!, entry.offer.id),
      `${entry.template?.name || 'Offer'} redeemed — the NFT is in your wallet.`,
      {
        /*
           Nothing of ours moves: the shards are the Outpost's row and the NFT
           goes straight to the wallet. That shard row is dropped all the same,
           because the desktop's currency guide shows the balance too.
        */
        intervalMs: 700,
        onSettled: async () => {
          await board.reload()
        },
        dirties: ['outpostPoints'],
      },
    )
  }

  return (
    <div className="outpost">
      {error && <div className="alert alert--error">{error}</div>}
      <ActionBanner error={null} />

      {/*
        The balance sits above the prices for the same reason the WAX balance
        sits above the gem packs: it is what tells a player which rung they
        can reach. Named in full because this figure is not on the player row
        with the gems and credits — it is the Outpost's own ledger.
      */}
      {/* On a desktop the balance is in the currency guide beside the shop. */}
      {phone && (
      <div className="waxbar outpost__bar">
        <span className="waxbar__label">Your Alien Worlds shards</span>
        <span className="waxbar__value">
          {board.loading && !board.data ? (
            <span className="faint">Loading…</span>
          ) : registered ? (
            <Shards raw={balance} />
          ) : (
            <span className="faint">No Outpost account</span>
          )}
        </span>
      </div>
      )}

      {!registered && !board.loading && (
        <p className="hint outpost__note">
          The Outpost has no shard balance on record for this wallet, so
          nothing here can be redeemed yet. Shards are earned by mining — in
          Alien Worlds, and from this game's reward pools.
        </p>
      )}

      {board.error && <div className="alert alert--error">{board.error}</div>}

      {board.loading && !board.data ? (
        <div className="packgrid">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="skeleton pack pack--loading" key={i} />
          ))}
        </div>
      ) : (
        <>
          {phone && rarities.length > 0 && (
            <div className="outpost__rarities" role="tablist" aria-label="Rarity">
              {rarities.map(([r, n]) => (
                <button
                  type="button"
                  key={r}
                  role="tab"
                  className={`outpost__rarity outpost__rarity--${r.toLowerCase()}`}
                  aria-selected={shownRarity === r}
                  onClick={() => pickRarity(r)}
                >
                  {r}
                  <i>{n}</i>
                </button>
              ))}
              {upcoming.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  className="outpost__rarity outpost__rarity--soon"
                  aria-selected={shownRarity === SOON}
                  onClick={() => pickRarity(SOON)}
                >
                  Soon
                  <i>{upcoming.length}</i>
                </button>
              )}
            </div>
          )}

          {!phone && (
          <h2 className="outpost__heading">
            Open now
            {active.length > 0 && <span className="outpost__count">{active.length}</span>}
          </h2>
          )}

          {!phone && rarities.length > 1 && (
            <div className="outpost__rarities" role="tablist" aria-label="Rarity">
              <button
                type="button"
                role="tab"
                className="outpost__rarity outpost__rarity--all"
                aria-selected={deskShown === null}
                onClick={() => setDeskRarity(null)}
              >
                All
                <i>{active.length}</i>
              </button>
              {rarities.map(([r, n]) => (
                <button
                  type="button"
                  key={r}
                  role="tab"
                  className={`outpost__rarity outpost__rarity--${r.toLowerCase()}`}
                  aria-selected={deskShown === r}
                  onClick={() => setDeskRarity(r)}
                >
                  {r}
                  <i>{n}</i>
                </button>
              ))}
            </div>
          )}

          {active.length === 0 ? (
            <p className="hint">The Outpost has no offers open at the moment.</p>
          ) : (
            openShown.length > 0 && (
            <div className="packgrid">
              {openShown.map((entry) => {
                const gate = canRedeem(entry, balance, registered)
                const key = `outpost:${entry.offer.id}`
                return (
                  <OfferCard
                    key={entry.offer.id}
                    entry={entry}
                    foot={closesIn(entry.offer)}
                  >
                    <button
                      type="button"
                      className="btn btn--primary btn--block"
                      onClick={() => setConfirming(entry)}
                      disabled={busy !== null || !gate.ok || !session}
                      title={
                        gate.short !== undefined
                          ? `${formatShards(gate.short)} more Alien Worlds shards needed`
                          : gate.reason
                      }
                    >
                      {/*
                        The price stays on the button even when it is out of
                        reach. Replacing it with "Not enough shards" cost the
                        player the one number they came to the card for — and
                        told them something the greyed-out button and the
                        balance at the top of the tab already say between them.
                        The particular reason is on the button's title.
                      */}
                      {busy === key && <span className="spinner" />}
                      {busy === key ? (
                        'Redeeming'
                      ) : (
                        <Shards raw={entry.offer.required} />
                      )}
                    </button>
                  </OfferCard>
                )
              })}
            </div>
            )
          )}

          {/*
            Upcoming offers carry no button on purpose. `redeempntnft` checks
            the window, so a button here would only ever be a refusal — the
            date is the useful thing, because these are what a player saves
            shards for.
          */}
          {!phone && (
          <h2 className="outpost__heading">
            Coming soon
            {upcoming.length > 0 && (
              <span className="outpost__count">{upcoming.length}</span>
            )}
          </h2>
          )}

          {upcoming.length === 0 ? (
            !phone && <p className="hint">Nothing scheduled beyond what is open now.</p>
          ) : (
            soonShown.length > 0 && (
            <div className="packgrid">
              {soonShown.map((entry) => (
                <OfferCard
                  key={entry.offer.id}
                  entry={entry}
                  foot={`Opens ${opensIn(entry.offer)}`}
                  dim
                >
                  <div className="outpost__soon">
                    <Shards raw={entry.offer.required} />
                  </div>
                </OfferCard>
              ))}
            </div>
            )
          )}

        </>
      )}

      {confirming && (
        <ConfirmRedeem
          entry={confirming}
          balance={balance}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void redeem(confirming)}
        />
      )}
    </div>
  )
}

/** One offer, in the shop's own card shape. */
function OfferCard({
  entry,
  foot,
  dim,
  children,
}: {
  entry: OutpostOffer
  foot: string
  dim?: boolean
  children: React.ReactNode
}) {
  const { offer, template } = entry
  const art = offerArt(template)

  return (
    <article
      className={
        'pack outpost__card' +
        (template?.rarity ? ' outpost__card--' + template.rarity.toLowerCase() : '') +
        (dim ? ' pack--blocked' : '')
      }
    >
      <div className="pack__art">
        {/*
          The game's own small copy of the card, a few kilobytes, by its
          template — the IPFS original runs to a megabyte and more, for a tile
          this size. That original, then the blank card, if a copy is missing.
          The template id is the offer's own, so the picture survives even
          when AtomicAssets, a separate service, does not answer.
        */}
        <GameImg
          src={asset(`/assets/cards/${offer.template_id}.webp`)}
          fallback={[art, asset('/assets/default-card.png')].filter(Boolean)}
          alt=""
          loading="lazy"
          decoding="async"
        />
        {template?.rarity && <span className="pack__badge">{template.rarity}</span>}
      </div>

      <div className="pack__body">
        <h3 className="pack__title">{template?.name || `Template ${offer.template_id}`}</h3>
        <div className="outpost__meta faint">
          {[template?.kind, template?.shine].filter(Boolean).join(' · ') || 'Alien Worlds'}
        </div>
        <div className="outpost__window faint">{foot}</div>
        {children}
      </div>
    </article>
  )
}

/**
 * The confirmation, which exists to name the currency one more time.
 *
 * A player two clicks into our shop has just been spending gems and credits.
 * This spends neither — it spends Alien Worlds shards, mined in a different
 * game, and the NFT arrives in their wallet rather than on their roster. Both
 * facts are stated here because this is the last screen before a signature.
 */
type RedeemProps = {
  entry: OutpostOffer
  balance: number
  onCancel: () => void
  onConfirm: () => void
}

/* Shown as the shop's other purchases are, the card as the hero. */
function ConfirmRedeem({ entry, balance, onCancel, onConfirm }: RedeemProps) {
  const { offer, template } = entry
  const art = offerArt(template)
  const after = balance - offer.required
  return (
      <Showcase
        label="Confirm Outpost redemption"
        art={ipfsPreview(template?.img) ?? (art || undefined)}
        artFallback={art || undefined}
        edge={rarityEdge(template?.rarity)}
        name={template?.name || `Template ${offer.template_id}`}
        tags={<CardTags rarity={template?.rarity} shine={template?.shine} extra={template?.kind} />}
        line={<span className="faint">An Alien Worlds NFT, sent by the Outpost to your WAX wallet</span>}
        price={formatShards(offer.required)}
        priceIcon={SHARD_ICON}
        leaves={`${formatShards(Math.max(0, after))} Alien Worlds shards`}
        fine="Spends Alien Worlds shards — the same ones your mining pays out. It cannot be undone."
        action={{ label: 'Redeem', onClick: onConfirm }}
        onCancel={onCancel}
      />
  )
}

