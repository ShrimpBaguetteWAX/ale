import { ABI, Action, PrivateKey } from '@wharfkit/antelope'
import {
  AbstractTransactPlugin,
  prependAction,
  type SigningRequest,
  type TransactContext,
  TransactHookTypes,
  type TransactHookResponse,
} from '@wharfkit/session'

/**
 * The game pays the network cost of the CPU claim.
 *
 * Applied to that one action rather than registered on the session: a
 * `beforeSign` plugin on the kit runs on everything, which would put the
 * game's account on the hook for every fight, quest and step a player takes.
 * The claim is the one transaction where the player genuinely cannot pay —
 * they are asking precisely because they have no CPU left.
 *
 * `cpu.ale` has a `cpu` permission whose only purpose is to co-authorise a
 * `greymassnoop::noop` action placed ahead of the player's own. A transaction
 * whose *first* authorisation belongs to `cpu.ale` is billed to `cpu.ale`, so
 * the player spends none of their own CPU or NET.
 *
 * The permission is deliberately narrow. On chain it is linked to exactly two
 * actions:
 *
 *     cpu -> greymassnoop::noop
 *     cpu -> cpu.ale::maxpowerup
 *
 * and it sits below `active`, so it cannot move funds — the transfers and the
 * powerup purchase run under `legends`, which is `cpu.ale@eosio.code` and
 * therefore reachable only by the contract itself.
 *
 * ---
 *
 * The key below is in the shipped bundle, and there is no way to sign in a
 * browser without it being. Splitting or encoding it would change nothing: it
 * has to be in memory to produce a signature, so a breakpoint recovers it
 * whatever shape it is stored in. It is here rather than hidden because
 * pretending otherwise is worse than saying so.
 *
 * What that means in practice: anyone can call `noop` and `maxpowerup` as
 * `cpu.ale`, which costs the game CPU and the WAX that `maxpowerup` spends.
 * It does not put the account's balance at risk. If that trade stops being
 * worth it, the fix is a cosigning service that keeps the key on a server —
 * not obfuscation here.
 */
const COSIGNER_ACTOR = 'cpu.ale'
const COSIGNER_PERMISSION = 'cpu'
const COSIGNER_KEY = '5J2Gm886uvFrr4WrMzEtGhT2HRAhdxM4dHqKZMfe8X3oG8u8p5x'

/**
 * `greymassnoop::noop` does nothing at all, which is the point.
 *
 * It exists purely to carry an authorisation. Putting it first makes its
 * signer the transaction's first authoriser, and the first authoriser is who
 * the chain bills.
 *
 * The ABI is written out here rather than fetched. `Action.from` needs to
 * know how to serialise `data`, and with a plain object and no ABI it throws
 * "Missing ABI definition when creating action with untyped action data" —
 * which, from inside a `beforeSign` hook, lands on every transaction the game
 * makes. Copied verbatim from `greymassnoop` on chain: one struct, no
 * fields, because the action takes no arguments and never will.
 */
const NOOP_ABI = ABI.from({
  version: 'eosio::abi/1.1',
  structs: [{ name: 'noop', base: '', fields: [] }],
  actions: [{ name: 'noop', type: 'noop', ricardian_contract: '' }],
})

/*
   Built once, at load. If this ever stops being constructible the module
   fails to import, which is a great deal easier to find than a wallet dialog
   that refuses every action.
*/
const NOOP = Action.from(
  {
    account: 'greymassnoop',
    name: 'noop',
    authorization: [{ actor: COSIGNER_ACTOR, permission: COSIGNER_PERMISSION }],
    data: {},
  },
  NOOP_ABI,
)

export class CosignPlugin extends AbstractTransactPlugin {
  id = 'alien-legends-cosign'

  register(context: TransactContext): void {
    context.addHook(TransactHookTypes.beforeSign, async (
      request: SigningRequest,
      ctx: TransactContext,
    ): Promise<TransactHookResponse> => {
      /*
         Both halves happen here rather than across beforeSign/afterSign: the
         noop has to be part of the transaction the *player* signs, so it must
         be prepended before their wallet sees it, and the cosignature must be
         over that same modified transaction. Signing it here and handing back
         both the request and the signature keeps the two in step — an
         afterSign signature would be over a transaction the wallet had
         already committed to, and any mismatch would only surface as an
         `unsatisfied_authorization` on chain.
      */
      const modified = prependAction(request, NOOP)
      const resolved = await ctx.resolve(modified)
      const signature = PrivateKey.from(COSIGNER_KEY).signDigest(
        resolved.signingDigest,
      )
      return { request: modified, signatures: [signature] }
    })
  }
}
