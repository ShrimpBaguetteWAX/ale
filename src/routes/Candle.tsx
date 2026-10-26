import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/state/useGame'
import {
  fetchCandleClaim,
  fetchCandleOffers,
  fetchCandleTracking,
  fetchContributions,
} from '@/candle/queries'
import type { CandleClaim, CandleOffer, CandleTracking, Contribution } from '@/candle/types'
import { activeOffers, upcomingOffers } from '@/candle/rules'
import { claimCandle, contributeGems } from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { DIRTIES } from '@/wharf/actions'
import { readableError } from '@/wharf/errors'
import { fetchPlayerTags } from '@/chain/queries'
import { ActionBanner } from '@/components/ActionBanner'
import { asset } from '@/assets'
import { usePhone } from '@/components/usePhone'
import { PhoneCandle } from '@/candle/PhoneCandle'
import { DeskCandle } from '@/candle/DeskCandle'

/**
 * The Candle.
 *
 * A campaign puts up a fixed reward, anyone who meets its requirement can
 * throw gems at it, and when the day is up the reward is split in proportion
 * to what each contributor put in.
 *
 * Several can run at once. This screen assumed one — it asked for the running
 * campaign, singular, and got whichever the contract happened to return
 * first. The second was not shown as running and was not in "Coming up"
 * either, so a mission a player could have entered was simply missing.
 *
 * That makes it a dilution game, which is the opposite of how a "contribute"
 * screen normally reads. Adding gems raises your share and lowers what every
 * gem in the pot is worth — including the ones you already put in. So each
 * mission is drawn as the split itself: a bar of everyone's stake to scale,
 * with the player's own slice in teal and a ghost slice for what they are
 * about to add, so the dilution is seen rather than explained — alongside
 * what a gem is worth now and what it would be worth after.
 *
 * Entry is a gate, not a score. `contribute` checks the player's lifetime
 * counter against the requirement and refuses outright below it, so there is
 * nothing to show but qualified or short, and by how much.
 */


/* ---------- data ---------- */

/**
 * Everyone in one running campaign, and this player's place in it.
 *
 * Held per campaign rather than as three loose values, because there can be
 * more than one running at a time and each has its own board. Flattened, the
 * second campaign's numbers would overwrite the first's.
 */
export interface Board {
  stakes: Contribution[]
  contributors: number
  mine: number
}


interface CandleData {
  offers: CandleOffer[]
  /** Keyed by `offer_id`; missing until that campaign's board has been read. */
  boards: Map<string, Board>
  claim?: CandleClaim
  tracking?: CandleTracking
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

function useCandle(account: string | null): CandleData {
  const [offers, setOffers] = useState<CandleOffer[]>([])
  const [boards, setBoards] = useState<Map<string, Board>>(() => new Map())
  const [claim, setClaim] = useState<CandleClaim>()
  const [tracking, setTracking] = useState<CandleTracking>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(
    async (refresh: boolean) => {
      if (!account) return
      setError(null)
      try {
        const [o, c, t] = await Promise.all([
          fetchCandleOffers(refresh),
          fetchCandleClaim(account, refresh),
          fetchCandleTracking(refresh),
        ])

        /*
         * Contributions are scoped by offer id, so a board can only be read
         * once its campaign is known — and there can be more than one running,
         * so this is one request each rather than one in total. They go
         * together: two campaigns should not appear a request apart.
         */
        const running = activeOffers(o)
        const rows = await Promise.all(
          running.map((offer) => fetchContributions(offer.offer_id, refresh)),
        )

        if (!alive.current) return
        setOffers(o)
        setClaim(c)
        setTracking(t)
        setBoards(
          new Map(
            running.map((offer, i) => [
              offer.offer_id,
              {
                stakes: rows[i],
                contributors: rows[i].length,
                mine: Number(rows[i].find((r) => r.wallet === account)?.amount ?? 0),
              },
            ]),
          ),
        )
      } catch (err) {
        if (alive.current) setError(readableError(err))
      } finally {
        if (alive.current) setLoading(false)
      }
    },
    [account],
  )

  useEffect(() => {
    setLoading(true)
    void load(false)
  }, [load])

  const reload = useCallback(() => load(true), [load])

  return { offers, boards, claim, tracking, loading, error, reload }
}

/* ---------- the screen ---------- */

export default function Candle() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)

  const data = useCandle(account)
  const phone = usePhone()
  const { offers, boards, claim, tracking } = data

  /*
     One draft per campaign, keyed by offer id.

     A single string was right while there could only be one mission on
     screen. With two, typing 400 into one of them put 400 into the other as
     well — and the contribute button reads this number.
  */
  const [gems, setGems] = useState<Record<string, string>>({})
  const setGemsFor = useCallback(
    (offerId: string, value: string) =>
      setGems((g) => ({ ...g, [offerId]: value })),
    [],
  )

  /*
     `busy` is the key of whatever is being signed, straight from the hook.
     It used to be narrowed to a fixed pair, but a contribute button now has
     to name which campaign it belongs to: one signature at a time still
     disables them all, while only the one that was pressed spins.
  */
  const { busy, error, run } = useAction()

  /*
     Player tags and faces, read once for the whole screen.

     Every mission's bar names its slices and every board names its rows,
     out of the same cached page the rest of the app resolves names from —
     so this is usually no request at all. Names are a courtesy; the
     wallets underneath are the real answer, so a failure is silent.
  */
  const [names, setNames] = useState<{
    tags: Record<string, string>
    avatars: Record<string, number>
  }>({ tags: {}, avatars: {} })
  useEffect(() => {
    let live = true
    fetchPlayerTags()
      .then((r) => {
        if (live) setNames({ tags: r.tags, avatars: r.avatars })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  /* Every campaign running right now, soonest to close first. */
  const running = useMemo(() => activeOffers(offers, now), [offers, now])
  /* Everything already fetched that has not started yet. */
  const upcoming = useMemo(() => upcomingOffers(offers, now), [offers, now])

  /* A claim empties the pot, so the dot stops waiting for its own timer. */
  const opts = (action: keyof typeof DIRTIES) => ({
    after: data.reload,
    dirties: DIRTIES[action],
  })

  if (!player) return null

  const balance = player.activestats.gems

  const amountFor = (offerId: string) =>
    Math.max(0, Math.floor(Number(gems[offerId]) || 0))

  const doContribute = (offer: CandleOffer) => {
    const amount = amountFor(offer.offer_id)
    setGemsFor(offer.offer_id, '')
    return run(
      `contribute:${offer.offer_id}`,
      () => contributeGems(session!, offer.offer_id, amount),
      'Contribution registered',
      opts('contributeGems'),
    )
  }

  const doClaim = () =>
    run('claim', () => claimCandle(session!), 'Rewards claimed successfully!', opts('claimCandle'))

  if (phone) {
    return (
      <div className="candle candle--phone">
        <img className="candle__art" src={asset('/assets/background/bg-candle.png')} alt="" />
        <div className="candle__scrim" />
        <ActionBanner error={error ?? data.error} />
        <PhoneCandle
          running={running}
          upcoming={upcoming}
          boards={boards}
          player={player}
          now={now}
          balance={balance}
          draft={gems}
          onDraft={setGemsFor}
          busy={busy}
          canAct={!!session}
          onContribute={(offer) => void doContribute(offer)}
          claim={claim}
          onClaim={() => void doClaim()}
          tracking={tracking}
          loading={data.loading}
          tags={names.tags}
          avatars={names.avatars}
        />
      </div>
    )
  }

  /*
     A desktop gets the mission board: every mission down the left, the
     picked one in full in the middle, and contributing on the right.
  */
  return (
    <div className="candle candle--desk">
      <img className="candle__art" src={asset('/assets/background/bg-candle.png')} alt="" />
      <div className="candle__scrim" />
      <DeskCandle
        running={running}
        upcoming={upcoming}
        boards={boards}
        player={player}
        now={now}
        balance={balance}
        draft={gems}
        onDraft={setGemsFor}
        busy={busy}
        canAct={!!session}
        onContribute={(offer) => void doContribute(offer)}
        claim={claim}
        onClaim={() => void doClaim()}
        tracking={tracking}
        loading={data.loading}
        tags={names.tags}
        avatars={names.avatars}
        banner={<ActionBanner error={error ?? data.error} />}
      />
    </div>
  )
}
