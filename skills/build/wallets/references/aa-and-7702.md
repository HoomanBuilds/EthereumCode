# Account Abstraction and EIP-7702

ERC-4337 and EIP-7702 are the two production paths to "smart" account UX on Ethereum. They are not the same thing. This file is when to pick which, and the call shapes that actually work.

For Safe-specific operational mechanics, see `references/safe-multisig.md`. For verified addresses (EntryPoint, common factories), see `addresses/references/safe-and-aa.md`.

## ERC-4337 vs EIP-7702 in one paragraph

**ERC-4337** is a parallel mempool for `UserOperation`s, executed by a contract called the `EntryPoint`. The user's "account" is a deployed smart contract. It supports arbitrary verification logic, paymasters (gas sponsorship), and bundling. Heavyweight; full smart-account UX. **EIP-7702** lets a regular EOA *temporarily delegate* its code to a smart-contract implementation for the duration of one transaction (or until revoked). No account migration; the same EOA address keeps working everywhere. Lightweight; smart UX without a new account.

If you need the user to keep their existing address and the bag of tokens already at it: 7702. If you're building a brand-new agent or onboarding flow where the account itself is the contract: 4337 (or 4337 + 7702 hybrid).

## ERC-4337 anatomy

```
UserOperation (off-chain)
        │
        ▼
Bundler RPC (eth_sendUserOperation)
        │  bundles 1..n UserOps into a single tx
        ▼
EntryPoint v0.7  (0x0000000071727De22E5E9d8BAf0edAc6f37da032)
        │
        ├── validateUserOp on each Account contract
        ├── (optional) validatePaymasterUserOp
        └── execute: Account.execute(target, value, data)
```

`PackedUserOperation` (v0.7) fields:

| Field | Notes |
|---|---|
| sender | The smart account address |
| nonce | EntryPoint nonce, with 192-bit "key" (parallel nonces) |
| initCode | Factory + calldata to deploy account if not yet deployed |
| callData | What account.execute should run |
| accountGasLimits | Packed: verificationGasLimit + callGasLimit |
| preVerificationGas | Pays bundler for off-chain work |
| gasFees | Packed: maxPriorityFeePerGas + maxFeePerGas |
| paymasterAndData | Empty = user pays; populated = paymaster sponsors |
| signature | Whatever the account contract's validateUserOp expects |

## Sending a UserOp with viem

```ts
import { createBundlerClient, toSimpleSmartAccount } from "viem/account-abstraction";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const account = await toSimpleSmartAccount({
  client: publicClient,
  owner: ownerEoa,                      // a viem Account
  factoryAddress: SIMPLE_ACCOUNT_FACTORY,
});

const bundler = createBundlerClient({
  client: publicClient,
  transport: http("https://api.pimlico.io/v2/base/rpc?apikey=..."),
});

const hash = await bundler.sendUserOperation({
  account,
  calls: [
    { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, 1_000_000n] }) },
    { to: target, value: 0n, data: actionCalldata },
  ],
});

const receipt = await bundler.waitForUserOperationReceipt({ hash });
```

Key points:
- `calls: [...]` is automatically batched into a single account `executeBatch`.
- Bundlers are infrastructure (Pimlico, Alchemy, Stackup, Biconomy). They charge a fee, often paid in the user's gas token via the EntryPoint flow.
- `hash` is a UserOp hash, not an Ethereum tx hash. The receipt has `transactionHash` for the bundled tx.

## Smart-account flavors

| Implementation | Notes |
|---|---|
| SimpleAccount (reference) | Bare bones, single owner. Use for demos, not production. |
| Safe (4337 module) | Safe with 4337 module enabled — gives multisig + 4337 in one. |
| Kernel (ZeroDev) | Modular plugins: passkeys, session keys, recovery. |
| Biconomy Modular SA | Similar modular system, audit-emphasized. |
| Alchemy LightAccount | Alchemy's improved SimpleAccount with admin/owner separation. |
| Coinbase Smart Wallet | Passkey-first, used by Coinbase wallet apps. |

For an AI-agent product, Kernel + Safe + LightAccount are the credible choices. `toSafeSmartAccount` from viem creates a Safe-with-4337-module account in one call.

## Paymasters

A paymaster sponsors gas. Two flows:

### Verifying paymaster (most common)

Off-chain service signs an approval ("user X can spend up to Y gwei"). Account submits with signature in `paymasterAndData`. Paymaster verifies on-chain.

```ts
const userOp = await bundler.prepareUserOperation({ account, calls });
const sponsored = await pimlicoSponsor.sponsorUserOperation({ userOperation: userOp });
const hash = await bundler.sendUserOperation(sponsored);
```

### Token paymaster

User pays in USDC/etc. Paymaster takes the token, pays gas in ETH. Useful for users with stablecoins but no ETH. Pimlico, Biconomy, and Alchemy all offer hosted token paymasters.

**Cost model:** paymaster + bundler each take a cut. Typical overhead: 5–25% on top of base gas. Free tier paymasters exist but rate-limit aggressively.

## Session keys (ERC-4337)

A session key is a temporary signer with a scoped permission set. Examples:
- "Trade USDC for ETH on Uniswap V3 swap router only, max 100 USDC per call, expires in 24h."
- "Mint NFTs from this collection only, max 10 mints, max 0.05 ETH each."

Implementation: the smart account contract has a session-key validator module. The user signs (with their main key) a message granting the session key. The session key's UserOps are validated by the module, which checks the scope.

Kernel's "Modular Account Abstraction" and Biconomy's session module both ship this. Roll your own only if you understand the validation pipeline cold — getting it wrong = full account drain.

## EIP-7702 anatomy

EOA signs a separate **authorization tuple** (chainId, address, nonce, signature). Authorization is included in a type-4 transaction. Once executed, the EOA has the code at `address` for purposes of CALL/DELEGATECALL — visible via `EXTCODECOPY`.

A 23-byte "delegation designator" `0xef0100 || implementation` is what lives at the EOA after a 7702 tx. To revoke: send a new auth pointing at `address(0)`.

```ts
import { createWalletClient, http } from "viem";
import { mainnet } from "viem/chains";
import { eip7702Actions } from "viem/experimental";

const wallet = createWalletClient({ chain: mainnet, transport: http(RPC), account })
  .extend(eip7702Actions());

const auth = await wallet.signAuthorization({
  contractAddress: BATCH_EXECUTOR,    // implementation contract
});

const hash = await wallet.sendTransaction({
  authorizationList: [auth],
  to: account.address,                // self-call
  data: encodeFunctionData({
    abi: batchAbi,
    functionName: "execute",
    args: [calls],
  }),
});
```

After this tx, `account.address` runs `BATCH_EXECUTOR`'s code on subsequent calls — until replaced or cleared.

## EIP-7702 use cases

| Use case | Pattern |
|---|---|
| Atomic batching | EOA → BatchExecutor: approve+swap in one tx |
| Gas sponsorship | Relay submits 7702 tx with sponsor's `from`; user authorizes |
| Session keys on EOA | Implementation adds nonce-scoped, expiry-bound permission slots |
| Sub-account isolation | Implementation routes calls based on `msg.sender` policies |
| Pre-Safe migration | EOA gets multisig-like behavior without changing addresses |

## Choosing 4337 vs 7702 vs both

```
Need keep-existing-address + batching?           → 7702
Need full smart-account UX with brand-new flow?  → 4337
Need passkey login on existing EOA?              → 7702 with passkey-validator implementation
Need paymaster + arbitrary policy?               → 4337 (paymaster ecosystem is mature)
Multi-chain consistent address?                  → 4337 with cross-chain factory
Quickest production path in Q2 2026?             → 7702 (live since May 2025, simpler ops)
```

Hybrid: a 7702-delegated EOA can call into 4337 EntryPoint as a sender. Some smart-account implementations support both modes simultaneously.

## Pitfalls

- **Forgot the bundler API key**: UserOp submits but never lands. Bundler RPCs require keys; "permissionless" public bundlers are rate-limited.
- **EntryPoint version mismatch**: v0.6 and v0.7 use different `UserOperation` shapes (struct vs PackedUserOperation). Check the bundler's supported version.
- **Paymaster postOp revert**: account ran the call but paymaster fails to settle → tx reverts. Test sponsored flows on testnet first.
- **7702 delegation persists**: a 7702 auth doesn't auto-expire. If user expects "this is one-time," they're wrong. Document clearly or set a self-revoking flow.
- **7702 + ETH transfers**: a contract `receive()` runs on plain ETH transfer. Make sure the implementation handles bare ETH sanely.
- **Replay across chains**: a 7702 auth with `chainId = 0` is replayable on every chain that supports the tx type. Always set `chainId` to the target unless you want cross-chain delegation.
- **Account not deployed**: a 4337 account at a counterfactual address can receive funds but can't sign EIP-191 messages until deployed. Use ERC-1271 + factory for messages.
- **Session key with no expiry**: bug; treat any non-expiring session key as a full-account compromise risk. Default 24h, max 30d.
- **`msg.sender` confusion in 7702**: when an EOA delegates, `msg.sender` inside the implementation is the EOA itself. Code that compares `msg.sender == address(this)` for self-calls works; `tx.origin == msg.sender` does NOT (tx.origin is the original caller, msg.sender is the delegated EOA).

## What to read next

- `references/safe-multisig.md` — multisig the AA way
- `references/key-management.md` — protecting the keys that sign UserOps and authorizations
- `addresses/references/safe-and-aa.md` — verified EntryPoint, factories, common implementations
- ERC-4337 spec: https://eips.ethereum.org/EIPS/eip-4337
- EIP-7702 spec: https://eips.ethereum.org/EIPS/eip-7702
- Pimlico docs (good 4337 reference): https://docs.pimlico.io/
