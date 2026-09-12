import { useMemo, useState } from 'react'
import { useGame } from '@/state/useGame'
import { useChainQuery } from '@/chain/useChainQuery'
import { useAction } from '@/wharf/useAction'
import { useModal } from '@/components/useModal'
import { redeemOutpostOffer } from '@/wharf/actions'
import { ActionBanner } from '@/components/ActionBanner'
import { asset } from '@/assets'
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
  const { busy, error, notice, run } = useAction()
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

  const redeem = (entry: OutpostOffer) => {
    setConfirming(null)
    return run(
      `outpost:${entry.offer.id}`,
      () => redeemOutpostOffer(session!, entry.offer.id),
      `${entry.template?.name || 'Offer'} redeemed — the NFT is in your wallet.`,
      {
        /*
           Nothing of ours moves, so there is no table of ours to drop: the
           shards are the Outpost's row and the NFT goes straight to the
           wallet. Re-reading this screen's own query is the whole of it.
        */
        intervalMs: 700,
        onSettled: async () => {
          await board.reload()
        },
      },
    )
  }

  return (
    <div className="outpost">
      {error && <div className="alert alert--error">{error}</div>}
      <ActionBanner notice={notice} error={null} />

      {/*
        The balance sits above the prices for the same reason the WAX balance
        sits above the gem packs: it is what tells a player which rung they
        can reach. Named in full because this figure is not on the player row
        with the gems and credits — it is the Outpost's own ledger.
      */}
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
          <h2 className="outpost__heading">
            Open now
            {active.length > 0 && <span className="outpost__count">{active.length}</span>}
          </h2>

          {active.length === 0 ? (
            <p className="hint">The Outpost has no offers open at the moment.</p>
          ) : (
            <div className="packgrid">
              {active.map((entry) => {
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
          )}

          {/*
            Upcoming offers carry no button on purpose. `redeempntnft` checks
            the window, so a button here would only ever be a refusal — the
            date is the useful thing, because these are what a player saves
            shards for.
          */}
          <h2 className="outpost__heading">
            Coming soon
            {upcoming.length > 0 && (
              <span className="outpost__count">{upcoming.length}</span>
            )}
          </h2>

          {upcoming.length === 0 ? (
            <p className="hint">Nothing scheduled beyond what is open now.</p>
          ) : (
            <div className="packgrid">
              {upcoming.map((entry) => (
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
    <article className={'pack outpost__card' + (dim ? ' pack--blocked' : '')}>
      <div className="pack__art">
        {art ? (
          <img src={art} alt="" loading="lazy" decoding="async" />
        ) : (
          /* AtomicAssets is a separate service; losing it costs the picture,
             not the offer. */
          <div className="outpost__noart faint">#{offer.template_id}</div>
        )}
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
function ConfirmRedeem({
  entry,
  balance,
  onCancel,
  onConfirm,
}: {
  entry: OutpostOffer
  balance: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const panel = useModal(onCancel)
  const { offer, template } = entry
  const art = offerArt(template)
  const after = balance - offer.required

  return (
    <div
      className="confirm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm Outpost redemption"
      onClick={onCancel}
    >
      <div
        className="confirm__panel panel"
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="confirm__title">
          You are about to spend Alien Worlds shards
        </h2>

        <div className="confirm__deal">
          <div className="confirm__side">
            <span className="confirm__label">You pay</span>
            <span className="confirm__value confirm__value--cost">
              <Shards raw={offer.required} />
            </span>
            <span className="faint confirm__sub">Alien Worlds shards</span>
          </div>
          <span className="confirm__arrow" aria-hidden="true">
            →
          </span>
          <div className="confirm__side">
            <span className="confirm__label">You receive</span>
            <span className="confirm__value confirm__value--gain">
              {template?.name || `Template ${offer.template_id}`}
            </span>
            <span className="faint confirm__sub">an Alien Worlds NFT</span>
          </div>
        </div>

        {art && (
          <div className="confirm__item">
            <img src={art} alt="" width={56} height={56} />
            <div>
              <div className="confirm__name">{template?.name}</div>
              <div className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
                {[template?.rarity, template?.shine, template?.kind]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>
        )}

        <div className="confirm__balance">
          <div className="statline">
            <span className="statline__k">Your Alien Worlds shards</span>
            <span className="statline__v">
              <Shards raw={balance} />
            </span>
          </div>
          <div className="statline">
            <span className="statline__k">After this redemption</span>
            <span className="statline__v">
              <Shards raw={Math.max(0, after)} />
            </span>
          </div>
          <p className="hint">
            {/*
              Alien Worlds shards are the same currency this game's reward
              pools pay out — so the thing to be clear about is not *which*
              shards, but that they are not gems or credits, and that neither
              the payment nor the reward passes through anything of ours: the
              Outpost holds the shards and mints the NFT straight to the
              wallet, so there is nothing here we could reverse.
            */}
            This spends Alien Worlds shards — the same ones your mining pays
            out — not gems or credits. The Outpost sends the NFT to your WAX
            wallet. It cannot be undone.
          </p>
        </div>

        <div className="confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            Spend Alien Worlds shards
          </button>
        </div>
      </div>
    </div>
  )
}
