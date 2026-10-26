import { useEffect, useMemo, useState } from 'react'
import { useGame } from '@/state/useGame'
import {
  fetchAssetIdsForTemplates,
  fetchOwnedTemplates,
  fetchSchemaTemplates,
  forgetOwnedTemplates,
} from '@/chain/atomic'
import {
  FARM_SCHEMAS,
  fetchFarmPools,
  fetchFarmUser,
  fetchStakedCards,
  type FarmSchema,
} from '@/farming/queries'
import type {
  OwnedCard,
  FarmConfig,
  FarmPool,
  FarmUser,
  StakeWeight,
  StakedCard,
} from '@/farming/types'
import {
  clampCount,
  ownedStacks,
  selectedIds,
  selectedTemplates,
  stakedStacks,
  totalPicked,
} from '@/farming/stacks'
import { farmBoard, stakeable, stakedByWeight } from '@/farming/rules'
import { claimFarming, stakeCards, unstakeCards } from '@/wharf/actions'
import { useAction } from '@/wharf/useAction'
import { useChainQuery } from '@/chain/useChainQuery'
import { useLazyConfig } from '@/state/useConfig'
import { DIRTIES } from '@/wharf/actions'
import { ActionBanner } from '@/components/ActionBanner'
import { usePhone } from '@/components/usePhone'
import { PhoneFarming, type FarmMode } from '@/farming/PhoneFarming'
import { DeskFarming } from '@/farming/DeskFarming'

/**
 * Farming.
 *
 * Alien Worlds cards are staked into `farm.ale` and earn **credits** — not
 * Trilium, which is what the name suggests and what every other pool in the
 * game pays. The contract books the result under `alf_credits_claimed`.
 *
 * The mechanic has one trap and one surprise, and the screen is built around
 * both:
 *
 *   • **Power is capped.** A claim is worth `weight × days since your last
 *     claim`, ceilinged at `config.max_power`. Past that ceiling the position
 *     earns nothing at all until it is claimed — a heavy staker hits it in
 *     under a day. Nothing on the chain row says so, so the screen counts
 *     down to it and says plainly when it has been reached.
 *
 *   • **Unstaking claims first.** `unstake` calls `claim` before returning the
 *     cards, so pulling out never forfeits what has accrued. Players expect
 *     the opposite, so the button says it.
 *
 * Staking itself is not an action but an AtomicAssets transfer carrying the
 * memo `nftstake`; the contract charges `gem_fee` gems per card on receipt.
 */

type Mode = 'inventory' | 'staked'
type Busy = 'stake' | 'unstake' | 'claim' | null

/* ---------- data ---------- */

interface FarmData {
  config?: FarmConfig
  pools: FarmPool[]
  weights: StakeWeight[]
  user?: FarmUser
  staked: StakedCard[]
  /** This schema's designs and how many of each, not every schema's. */
  inventory: OwnedCard[]
  /** This schema's design names, for the staked cards, which come without. */
  names: ReadonlyMap<number, string>
  loading: boolean
  loadingInventory: boolean
  error: string | null
  reload: () => Promise<void>
}

function useFarm(account: string | null, schema: FarmSchema): FarmData {
  /* The pool settings and the rarity weights are the same for everybody. */
  const config = useLazyConfig('farm')
  const weights = useLazyConfig('stakeWeights') ?? EMPTY_WEIGHTS

  const farm = useChainQuery(
    account && `farm:${account}`,
    async () => {
      const [p, u, s] = await Promise.all([
        fetchFarmPools(),
        fetchFarmUser(account!),
        fetchStakedCards(account!),
      ])
      return { pools: p, user: u, staked: s }
    },
    /* Staking, unstaking and claiming all move the accrued power and the
       cards behind it. */
    { deps: ['farmUser', 'farmStaked'] },
  )

  /*
     The wallet's own cards, counted rather than listed.

     This used to page through every asset and stopped at a thousand — a
     wallet of 15,000 tools saw its newest thousand and nothing to say there
     were more. The account summary counts every template in one request,
     whatever the wallet holds, and the design catalogue (the same one the
     fight pickers read, cached for hours) says which of those belong to this
     tab and what they are. Asset ids are only looked up for what is staked.
  */
  const inventory = useChainQuery(
    account && `farm-inv:${account}:${schema}`,
    async () => {
      const [owned, catalogue] = await Promise.all([
        fetchOwnedTemplates(account!),
        fetchSchemaTemplates(schema),
      ])
      const rows: OwnedCard[] = []
      const names = new Map<number, string>()
      for (const [id, t] of catalogue) names.set(id, t.name)
      for (const [templateId, count] of owned) {
        const t = catalogue.get(templateId)
        if (!t || count <= 0) continue
        rows.push({
          template_id: templateId,
          name: t.name,
          rarity: t.rarity,
          shine: t.shine || 'Stone',
          img: t.img,
          count,
        })
      }
      return { rows, names }
    },
    { deps: ['farmStaked'] },
  )

  return {
    config,
    pools: farm.data?.pools ?? EMPTY_POOLS,
    weights,
    user: farm.data?.user,
    staked: farm.data?.staked ?? EMPTY_STAKED,
    inventory: inventory.data?.rows ?? EMPTY_CARDS,
    names: inventory.data?.names ?? EMPTY_NAMES,
    loading: farm.loading,
    loadingInventory: inventory.loading,
    error: farm.error ?? inventory.error,
    reload: async () => {
      await Promise.all([farm.reload(), inventory.reload()])
    },
  }
}

const EMPTY_POOLS: FarmPool[] = []
const EMPTY_WEIGHTS: StakeWeight[] = []
const EMPTY_STAKED: StakedCard[] = []
const EMPTY_CARDS: OwnedCard[] = []
const EMPTY_NAMES: ReadonlyMap<number, string> = new Map()

/* ---------- the screen ---------- */

export default function Farming() {
  const account = useGame((s) => s.account)
  const player = useGame((s) => s.player)
  const session = useGame((s) => s.session)

  const [tab, setTab] = useState<FarmSchema>('tool.worlds')
  const [mode, setMode] = useState<Mode>('inventory')
  /* A phone starts on the claim and the pools, and opens one pool at a time. */
  const phone = usePhone()
  const [phonePool, setPhonePool] = useState<FarmSchema | null>(null)
  /*
     How many of each stack the player is taking, by stack key.

     Amounts rather than a list of asset ids: every copy of a design is worth
     the same, so which copies go is not a choice worth making a player make.
     `selectedIds` turns the amounts back into the ids the chain wants at the
     moment of signing.
  */
  const [counts, setCounts] = useState<Record<string, number>>({})
  /* Narrowed where it enters the screen, so every comparison below still has
     to name one of this screen's three buttons. */
  const { busy: busyKey, error, run } = useAction()
  const busy = busyKey as Busy

  const schema: FarmSchema = tab
  const data = useFarm(account, schema)
  const { config, pools, weights, user, staked } = data

  /* Power accrues by the second; a minute is fine for a number in credits. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const board = useMemo(
    () => farmBoard(FARM_SCHEMAS, user, pools, config, staked, now),
    [user, pools, config, staked, now],
  )

  /*
   * Only cards the farm will actually take.
   *
   * `stakeweight` has no row for Abundant, and the transfer handler rejects
   * anything missing from it — so those are not choices, they are noise. A
   * wallet holds hundreds of Abundant shovels for every card worth staking,
   * and showing them greyed out buries the ones that matter.
   */
  const inventory = useMemo(
    () => data.inventory.filter((c) => stakeable(c, weights)),
    [data.inventory, weights],
  )

  /* One tile per design, with what the player holds of it. */
  const invStacks = useMemo(() => ownedStacks(inventory, weights), [inventory, weights])

  const held = (cards: OwnedCard[]) => cards.reduce((n, c) => n + c.count, 0)
  const heldHere = held(inventory)
  /* Held but unstakeable, so an empty grid can explain itself. */
  const hiddenCount = held(data.inventory) - heldHere

  const stakedHere = useMemo(
    () => staked.filter((c) => c.schema === schema).sort(stakedByWeight),
    [staked, schema],
  )

  const outStacks = useMemo(() => stakedStacks(stakedHere, data.names), [stakedHere, data.names])

  /* Whichever side is on screen is the side the amounts belong to. Only
     staked cards have their ids to hand; the wallet's are looked up when
     the stake is signed. */
  const stacks = mode === 'inventory' ? invStacks : outStacks
  const picked = useMemo(() => selectedIds(outStacks, counts), [outStacks, counts])
  const pickedCount = useMemo(() => totalPicked(stacks, counts), [stacks, counts])

  /* Leaving a tab drops a selection that no longer has anything to act on. */
  useEffect(() => setCounts({}), [tab, mode])

  const setCount = (key: string, value: number, max: number) =>
    setCounts((prev) => ({ ...prev, [key]: clampCount(value, max) }))

  /* Every card on this side, or none of them — the two amounts a player
     picking a whole pool actually wants. */
  const takeAll = () =>
    setCounts(Object.fromEntries(stacks.map((s) => [s.key, s.count])))
  const takeNone = () => setCounts({})

  const gemFee = Number(config?.gem_fee ?? 0)
  const gems = player?.activestats.gems ?? 0
  const stakeCost = pickedCount * gemFee

  /* Whatever was staked or claimed is no longer a pending selection, and
     claiming resets the power that had capped. */
  const opts = (action: keyof typeof DIRTIES) => ({
    /* The wallet's counts are cached; a stake or unstake has just changed
       them, so they are read again rather than remembered. */
    after: async () => {
      if (account) forgetOwnedTemplates(account)
      await data.reload()
    },
    onSettled: () => setCounts({}),
    dirties: DIRTIES[action],
  })

  const doStake = () =>
    run(
      'stake',
      /* The ids are found now, for exactly the designs and amounts chosen. */
      async () =>
        stakeCards(
          session!,
          await fetchAssetIdsForTemplates(account!, selectedTemplates(invStacks, counts)),
        ),
      `Staked ${pickedCount} card${pickedCount === 1 ? '' : 's'}.`,
      opts('stakeCards'),
    )

  const doUnstake = () =>
    run(
      'unstake',
      () => unstakeCards(session!, picked),
      `Unstaked ${pickedCount} card${pickedCount === 1 ? '' : 's'}, and claimed what they had earned.`,
      opts('unstakeCards'),
    )

  const doClaim = () =>
    run('claim', () => claimFarming(session!), 'Credits claimed.', opts('claimFarming'))

  if (!player) return null

  if (phone) {
    return (
      <div className="farming">
        <ActionBanner error={error ?? data.error} />
        <PhoneFarming
          schema={phonePool}
          onOpen={(s, m?: FarmMode) => {
            setPhonePool(s)
            if (s) setTab(s)
            if (m) setMode(m)
          }}
          mode={mode}
          onMode={setMode}
          board={board}
          user={user}
          config={config}
          invStacks={invStacks}
          outStacks={outStacks}
          counts={counts}
          onCount={setCount}
          onAll={takeAll}
          onNone={takeNone}
          loadingInventory={data.loadingInventory}
          hiddenCount={hiddenCount}
          pickedCount={pickedCount}
          stakeCost={stakeCost}
          gems={gems}
          busy={busy}
          canAct={!!session}
          onStake={() => void doStake()}
          onUnstake={() => void doUnstake()}
          onClaim={() => void doClaim()}
          now={now}
        />
      </div>
    )
  }

  /* A desktop gets the card table: the pools along the top, the cards on shelves, a hand to stake. */
  return (
    <div className="farming">
      <DeskFarming
        schema={schema}
        onSchema={setTab}
        mode={mode}
        onMode={setMode}
        board={board}
        user={user}
        pools={pools}
        config={config}
        invStacks={invStacks}
        outStacks={outStacks}
        counts={counts}
        onCount={setCount}
        onAll={takeAll}
        onNone={takeNone}
        loadingInventory={data.loadingInventory}
        hiddenCount={hiddenCount}
        pickedCount={pickedCount}
        stakeCost={stakeCost}
        gems={gems}
        busy={busy}
        canAct={!!session}
        onStake={() => void doStake()}
        onUnstake={() => void doUnstake()}
        onClaim={() => void doClaim()}
        now={now}
        banner={<ActionBanner error={error ?? data.error} />}
      />
    </div>
  )
}
