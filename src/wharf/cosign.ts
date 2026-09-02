import { PrivateKey } from '@wharfkit/antelope'
import {
  AbstractTransactPlugin,
  prependAction,
  type SigningRequest,
  type TransactContext,
  TransactHookTypes,
  type TransactHookResponse,
} from '@wharfkit/session'

/**
 * The game pays the network cost of a player's transactions.
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
 */
const NOOP = {
  account: 'greymassnoop',
  name: 'noop',
  authorization: [{ actor: COSIGNER_ACTOR, permission: COSIGNER_PERMISSION }],
  data: {},
}

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
