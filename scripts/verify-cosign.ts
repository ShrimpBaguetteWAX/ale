/**
 * Pins the cosigner against the chain it has to satisfy.
 *
 *   npx vite build --ssr scripts/verify-cosign.ts --outDir .ssr
 *   node .ssr/verify-cosign.js
 *
 * The cosign plugin sits in `beforeSign`, which means anything it throws
 * lands on *every* transaction the game makes — and it throws before the
 * wallet ever opens, so the player sees a raw library error with no clue
 * which feature is at fault. That is exactly what shipping an untyped `data:
 * {}` did: "Missing ABI definition when creating action with untyped action
 * data" on travel, on claims, on fights, on everything.
 *
 * So this walks the whole path outside a browser: build the action, prepend
 * it to a real request, resolve it against live chain state, sign the digest
 * with the cosigner key, and check the signature recovers to the key the
 * chain actually has on `cpu.ale@cpu`. Nothing is broadcast.
 */
import { ABI, Action, PrivateKey } from '@wharfkit/antelope'
import { SigningRequest } from '@wharfkit/signing-request'
import { APIClient } from '@wharfkit/antelope'
import zlib from 'pako'

let pass = 0
let fail = 0
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log((ok ? '  ok   ' : '  FAIL ') + name)
  if (!ok) {
    console.log('         got  ' + JSON.stringify(got))
    console.log('         want ' + JSON.stringify(want))
  }
  ok ? pass++ : fail++
}

const COSIGNER_ACTOR = 'cpu.ale'
const COSIGNER_PERMISSION = 'cpu'
const COSIGNER_KEY = '5J2Gm886uvFrr4WrMzEtGhT2HRAhdxM4dHqKZMfe8X3oG8u8p5x'

const NOOP_ABI = ABI.from({
  version: 'eosio::abi/1.1',
  structs: [{ name: 'noop', base: '', fields: [] }],
  actions: [{ name: 'noop', type: 'noop', ricardian_contract: '' }],
})

async function main(): Promise<void> {
  const client = new APIClient({ url: 'https://wax.greymass.com' })

  console.log('\nthe action itself')
  /*
     The failure mode this whole script exists for. With no ABI and a plain
     object, `Action.from` cannot serialise `data` and throws — inside a
     beforeSign hook, on every action in the game.
  */
  let threwWithoutAbi = false
  try {
    Action.from({
      account: 'greymassnoop',
      name: 'noop',
      authorization: [{ actor: COSIGNER_ACTOR, permission: COSIGNER_PERMISSION }],
      data: {},
    })
  } catch {
    threwWithoutAbi = true
  }
  check('an untyped noop still cannot be built', threwWithoutAbi, true)

  const noop = Action.from(
    {
      account: 'greymassnoop',
      name: 'noop',
      authorization: [{ actor: COSIGNER_ACTOR, permission: COSIGNER_PERMISSION }],
      data: {},
    },
    NOOP_ABI,
  )
  check('with the ABI it builds', String(noop.account), 'greymassnoop')
  /* No fields, so no bytes. Anything else here means the ABI is wrong. */
  check('and serialises to nothing', String(noop.data), '')
  check('carrying the cosigner authorisation', String(noop.authorization[0].actor), COSIGNER_ACTOR)
  check('under the narrow permission', String(noop.authorization[0].permission), COSIGNER_PERMISSION)

  console.log('\nthe ABI matches the deployed contract')
  const live = await client.v1.chain.get_abi('greymassnoop')
  const liveNoop = live.abi?.structs.find((s) => s.name === 'noop')
  check('the contract still has a noop struct', !!liveNoop, true)
  check('and it still takes no arguments', liveNoop?.fields.length, 0)

  console.log('\nprepended to a real request')
  /*
     A real game action, built the way the app builds one. What matters is
     that the noop lands first: the chain bills the transaction to whoever
     authorises it first, and that is the entire point of the plugin.
  */
  const travelAbi = await client.v1.chain.get_abi('players.ale')
  const travel = Action.from(
    {
      account: 'players.ale',
      name: 'travel',
      authorization: [{ actor: 'someplayer.wam', permission: 'active' }],
      data: { wallet: 'someplayer.wam', x: 21, y: 16 },
    },
    travelAbi.abi!,
  )

  const request = await SigningRequest.create(
    { action: travel, chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4' },
    { zlib },
  )

  /* The same call the plugin makes. */
  const cloned = request.clone()
  const req = cloned.data.req
  check('the request holds one action to begin with', req.variantName, 'action')

  /* `prependAction` in one line, so the shape is checked rather than assumed. */
  cloned.data.req.value = [noop, req.value]
  cloned.data.req.variantIdx = 1

  const actions = cloned.data.req.value as Action[]
  check('now two actions', actions.length, 2)
  check('the noop is first', String(actions[0].account), 'greymassnoop')
  check('the game action follows', String(actions[1].name), 'travel')

  console.log('\nresolved and cosigned')
  const info = await client.v1.chain.get_info()
  const header = info.getTransactionHeader(120)
  const abis = await cloned.fetchAbis({
    getAbi: async (account) => (await client.v1.chain.get_abi(String(account))).abi!,
  })
  const resolved = cloned.resolve(
    abis,
    { actor: 'someplayer.wam', permission: 'active' },
    { chainId: info.chain_id, ...header },
  )

  check('the resolved transaction keeps both actions', resolved.transaction.actions.length, 2)
  check(
    'and the first authorisation is the cosigner',
    String(resolved.transaction.actions[0].authorization[0].actor),
    COSIGNER_ACTOR,
  )

  const key = PrivateKey.from(COSIGNER_KEY)
  const signature = key.signDigest(resolved.signingDigest)
  check('the signature verifies against the digest', signature.verifyDigest(resolved.signingDigest, key.toPublic()), true)

  /*
     The one that would have caught a wrong key: the chain has to already
     know this public key on cpu.ale@cpu, or every cosigned transaction comes
     back as `unsatisfied_authorization` after the player has signed it.
  */
  console.log('\nagainst the permission on chain')
  const account = await client.v1.chain.get_account(COSIGNER_ACTOR)
  const perm = account.permissions.find((p) => String(p.perm_name) === COSIGNER_PERMISSION)
  check('cpu.ale has a cpu permission', !!perm, true)
  const onChain = perm!.required_auth.keys.map((k) => String(k.key))
  const recovered = String(signature.recoverDigest(resolved.signingDigest))
  check('and the recovered signer is one of its keys', onChain.includes(recovered), true)
  console.log(`  (${recovered})`)
  check('which sits below active', String(perm!.parent), 'active')

  /*
     Blast radius. The permission is only useful to an attacker for the
     actions it is linked to, so the link table is worth pinning: anything
     new appearing here is a change nobody made on purpose.
  */
  console.log('\nwhat that permission can do')
  const links = await fetch('https://wax.eosusa.io/v2/state/get_links?account=' + COSIGNER_ACTOR)
    .then((r) => r.json() as Promise<{ links: { permission: string; code: string; action: string }[] }>)
    .catch(() => null)
  if (links) {
    const cpuLinks = links.links
      .filter((l) => l.permission === COSIGNER_PERMISSION)
      .map((l) => `${l.code}::${l.action}`)
      .sort()
    check('linked to noop and the powerup, nothing else', cpuLinks, [
      'cpu.ale::maxpowerup',
      'greymassnoop::noop',
    ])
  } else {
    console.log('  (skipped: the history node did not answer)')
  }

  console.log('\n' + (fail === 0 ? `all ${pass} cases passed` : `${fail} FAILED`))
  if (fail) process.exitCode = 1
}

void main()
