# Account Abstraction Cookbook

EIP-7702 (smart EOAs) and ERC-4337 (smart accounts) in depth. Pectra activated EIP-7702 on Ethereum mainnet on May 7, 2025. Verify all addresses and current details against the canonical sources cited inline — AA tooling moves fast.

## When To Use Which

| Scenario                                                | Use                       |
| ------------------------------------------------------- | ------------------------- |
| Existing EOA, want batch txs / gas sponsorship          | EIP-7702                  |
| Brand-new account, want full programmability + recovery | ERC-4337                  |
| Multi-signer treasury / DAO multi-sig                   | Safe (gnosis-safe)        |
| Session keys for a game (bounded session, EOA holds funds) | EIP-7702 + session-key contract |
| App that pays its users' gas, all chains, no EOA migration | EIP-7702 with paymaster wrapper |
| Sponsored signup with social recovery for non-crypto users | ERC-4337 smart account    |

## EIP-7702: Smart EOAs

Adds transaction type `0x04` (`SET_CODE_TX_TYPE`). The transaction includes a list of authorizations; each authorization tells the protocol "this EOA delegates its code to this contract address". After inclusion, calls to the EOA execute the delegated contract's code in the EOA's storage context.

### Authorization Tuple

```
authorization = (chain_id, address, nonce, y_parity, r, s)
```

| Field      | Meaning                                                                          |
| ---------- | -------------------------------------------------------------------------------- |
| `chain_id` | Chain where authorization is valid. `0` means valid on all chains (replay risk). |
| `address`  | The contract whose code the EOA delegates to. `0x00..00` clears delegation.       |
| `nonce`    | Authorization nonce of the EOA at signing time.                                   |
| `y_parity, r, s` | Secp256k1 signature over the RLP-encoded `(chain_id, address, nonce)` with magic byte `0x05`. |

The EOA whose private key signed the authorization is the one being delegated. The transaction sender (who pays gas) can be a different account.

### Lifecycle

1. EOA signs an authorization off-chain.
2. Anyone (the EOA itself, a relayer, an app) submits a tx of type `0x04` carrying the authorization.
3. After inclusion, the EOA's code field is set to a 23-byte indicator: `0xef0100 || delegate_address`.
4. **Delegation persists.** Subsequent calls to the EOA execute the delegated code until the EOA signs a new authorization (to a different address, or to `0x0` to clear).

This is the most-misunderstood point: 7702 delegation is *not* one-shot. The EOA stays "smart" forever unless and until it explicitly revokes.

### Revoking Delegation

```text
sign authorization with address = 0x0000000000000000000000000000000000000000
broadcast as part of any 0x04 tx
```

After inclusion, the EOA's code field is wiped. The EOA returns to behaving like a vanilla EOA.

### Cross-Chain Replay Risk

If `chain_id = 0`, the same signature is valid on every chain. An attacker who sees the authorization on Base can replay it on Arbitrum, Optimism, mainnet, etc. — pinning the EOA to the same delegate everywhere.

**Rules of thumb:**
- For a single-chain delegation, sign with the actual `chain_id`.
- For a multi-chain delegation (intentional), sign separately per chain; do not use `chain_id = 0` unless you have *audited* the delegate contract for cross-chain safety.
- Wallets should default to chain-pinned auth and surface a clear warning before signing chain-id-0.

### Critical Security Implications

The delegate contract executes in the EOA's storage and with the EOA's authority. **A malicious or buggy delegate can drain the EOA at any time, in any future tx.** Treat delegate selection like installing kernel modules.

| Risk                                | Mitigation                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Drain via re-entrancy in delegate   | Audit delegate; prefer well-known contracts (Safe7702, BiconomyAA, etc.)     |
| Storage collision with future use   | Use namespaced storage (ERC-7201 or unstructured slots)                      |
| Delegate self-destruct (impossible post-Cancun, but legacy code may have legacy assumptions) | Avoid delegates that depend on `selfdestruct` semantics |
| Signature malleability              | Use canonical low-`s` ECDSA; OZ `ECDSA.recover` enforces                     |
| User signs blind authorization      | Wallet UI must show: "this delegates control of your account to X"           |

### Delegated EOA Can Still Send Normal Txs

Subtlety: delegation does not lock the EOA. The EOA's private key still works for legacy/EIP-1559 transactions. So `tx.origin == msg.sender` checks still hold for self-sent txs, but the delegate's code can also move the EOA's funds without the EOA signing each tx (the delegate is the one running, with `msg.sender == EOA`). Auth logic must be inside the delegate contract.

### Realistic Use Cases

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Minimal "batch executor" delegate for an EOA.
// After 7702 delegation, the EOA can run multi-call batches in one tx.
contract BatchExecutor {
    error Unauthorized();
    error CallFailed(uint256 index, bytes data);

    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    function execute(Call[] calldata calls) external payable {
        // Self-call only: when the EOA invokes its own delegated code via 7702,
        // msg.sender == EOA == address(this). External callers are rejected.
        if (msg.sender != address(this)) revert Unauthorized();
        for (uint256 i; i < calls.length; ++i) {
            (bool ok, bytes memory ret) =
                calls[i].to.call{value: calls[i].value}(calls[i].data);
            if (!ok) revert CallFailed(i, ret);
        }
    }
}
```

**Use-case patterns:**
- Batch txs in one signature (approve + swap + deposit).
- Ephemeral session keys (delegate for an hour, then revoke).
- Gas sponsorship (a relayer submits the 0x04 tx; EOA pays nothing).
- Per-app permission contracts (delegate enforces "only spend up to X USDC per day").

### Session Keys via EIP-7702

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ILLUSTRATIVE — DO NOT DEPLOY. Sig verification, nonce/replay protection, and key-expiry checks omitted for brevity.
contract SessionKeyDelegate {
    // session-key contracts MUST be audited; this is illustrative
    struct Session {
        address key;       // session pubkey
        uint64 expires;    // unix seconds
        uint128 maxValue;  // wei budget
    }

    Session public session;

    error Expired();
    error OverBudget();

    function startSession(address key, uint64 expires, uint128 maxValue) external {
        if (msg.sender != address(this)) revert(); // EOA only
        session = Session(key, expires, maxValue);
    }

    function executeAsSession(address to, uint256 value, bytes calldata data, bytes calldata sig) external {
        Session memory s = session;
        if (block.timestamp >= s.expires) revert Expired();
        if (value > s.maxValue) revert OverBudget();
        // verify sig over (to, value, data, nonce) with s.key — left as exercise
        (bool ok, ) = to.call{value: value}(data);
        require(ok, "call failed");
    }
}
```

The EOA delegates to this contract for the session window, then revokes (or lets `expires` lapse if the contract self-checks).

## ERC-4337: Smart Accounts via Bundler + EntryPoint

ERC-4337 doesn't change the protocol. It builds a parallel mempool:

```
User        Bundler         EntryPoint        Smart Account     Target
 │            │                │                   │              │
 ├ UserOp ──> │                │                   │              │
 │            ├ handleOps ───> │                   │              │
 │            │                ├ validateUserOp ─> │              │
 │            │                │ <── valid ────────┤              │
 │            │                ├ execute ────────> │              │
 │            │                │                   ├ call ──────> │
```

### EntryPoint Singleton (v0.7)

`0x0000000071727De22E5E9d8BAf0edAc6f37da032`

Verify against https://github.com/eth-infinitism/account-abstraction. The EntryPoint is the only contract every 4337 wallet calls into. Newer versions (v0.8+) deploy at different addresses; pin the version your stack supports. Bundlers, paymasters, factories all reference this address.

v0.8 is the Pectra-era default released in 2025; v0.7 is still common for legacy bundlers. Verify your bundler's supported EntryPoint at https://github.com/eth-infinitism/account-abstraction/releases.

### UserOperation (v0.7)

```solidity
struct PackedUserOperation {
    address sender;            // smart account address
    uint256 nonce;             // EntryPoint-managed nonce
    bytes initCode;            // factory + factory calldata for first-time deploy
    bytes callData;            // what the smart account should execute
    bytes32 accountGasLimits;  // packed: verificationGasLimit (uint128) | callGasLimit (uint128)
    uint256 preVerificationGas;
    bytes32 gasFees;           // packed: maxPriorityFeePerGas (uint128) | maxFeePerGas (uint128)
    bytes paymasterAndData;    // empty if user pays gas
    bytes signature;           // smart account validates this
}
```

v0.7 packs gas limits into `bytes32` to fit more userops per bundle. v0.6 used a flatter struct. Pick one and stay.

### Bundlers

A bundler is a node that:
1. Accepts UserOps over JSON-RPC (`eth_sendUserOperation`).
2. Validates each (`eth_estimateUserOperationGas`, `simulateValidation`).
3. Bundles N valid ops into a single tx that calls `EntryPoint.handleOps`.
4. Earns the priority fee.

Public bundlers: Pimlico, Alchemy AA, Stackup, Biconomy. Some chains restrict the canonical bundler set (zkSync had its own AA model pre-7702/4337 unification). Verify chain support before you ship.

### Paymasters

A paymaster contract that pays gas for the UserOp. The EntryPoint refunds the bundler from the paymaster's deposited stake. Paymasters can:
- Sponsor users freely (welcome paymaster — first 5 txs free).
- Charge in ERC-20 (user pays USDC, paymaster swaps to ETH for gas).
- Run policy logic (whitelist contracts, rate-limit).

`paymasterAndData` packs `address (20 bytes) | verificationGasLimit (uint128) | postOpGasLimit (uint128) | data`.

### SimpleAccount Factory

The reference 4337 wallet from the spec authors. Single-owner, ECDSA signature. Useful as a baseline — most production wallets fork from it and add modules (recovery, session keys, multi-sig).

### Safe-as-AA

The Safe team ships a 4337 module that turns any Safe (multi-sig) into a 4337-compatible account. UserOps are signed by the Safe's owners; the module enforces the threshold inside `validateUserOp`. Verify against https://github.com/safe-global/safe-modules/tree/main/modules/4337.

### Sending a UserOp (viem v2 + permissionless.js)

```typescript
// viem AA support evolves; verify against https://viem.sh/docs/account-abstraction
import { createBundlerClient, toCoinbaseSmartAccount } from "viem/account-abstraction";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const publicClient = createPublicClient({ chain: base, transport: http() });

const owner = privateKeyToAccount(process.env.OWNER_PK as `0x${string}`);

const account = await toCoinbaseSmartAccount({
  client: publicClient,
  owners: [owner],
});

const bundler = createBundlerClient({
  account,
  client: publicClient,
  transport: http("https://api.pimlico.io/v2/8453/rpc?apikey=YOUR_KEY"),
});

const hash = await bundler.sendUserOperation({
  calls: [
    { to: "0xRecipient", value: parseEther("0.001"), data: "0x" },
  ],
});

const receipt = await bundler.waitForUserOperationReceipt({ hash });
```

The exact API names (`toCoinbaseSmartAccount`, `createBundlerClient`) are stable as of viem v2 minor releases but may shift; check the changelog when you upgrade. Alchemy's `aa-sdk` and `permissionless.js` are alternative high-level wrappers.

## 7702 vs 4337 vs Safe

| Property                | EIP-7702                          | ERC-4337                                 | Safe (multisig)                          |
| ----------------------- | --------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Account type            | Existing EOA                      | New contract                             | New contract                             |
| Address                 | Same as the EOA                   | Counterfactual or deployed               | Deployed                                 |
| Nonce model             | EOA nonce + auth nonce            | EntryPoint nonce (2D)                    | Safe nonce                               |
| Gas payer               | Anyone (sponsor)                  | Anyone via paymaster                     | Multisig executor                        |
| Recovery                | Via delegate logic                | Via account modules                      | Via owner change (threshold sig)         |
| Bundler needed          | No                                | Yes                                      | No                                       |
| Session keys            | Via delegate                      | Via module                               | Via guard / module                       |
| Full programmability    | Yes (delegate)                    | Yes                                      | Limited (executor pattern)               |
| Migration cost for EOA  | Zero (same address)               | Move funds                               | Move funds                               |
| Audit surface           | Delegate contract                 | Account + EntryPoint + paymaster + bundler | Safe core + modules                      |

**Default rule:** if you have an EOA and want batch/sponsorship, use 7702. If you're onboarding a new user and want recovery + session keys + full programmability from day 1, use 4337. If you need M-of-N approvals for a treasury, use Safe.

## Combining 7702 + 4337

Modern wallets (Coinbase, Ambire, Biconomy, Alchemy) support both — the user's EOA delegates to a contract that *also* acts as a 4337-compatible smart account. UserOps are signed by the EOA, validated by the delegated code, executed via the EntryPoint. This unifies the dev story: one mental model, works for both new and existing users.

## Pre-Flight Checklist

- [ ] Delegate contract audited (or comes from a known wallet vendor).
- [ ] Authorization signed with explicit `chain_id`, never 0 unless intentional.
- [ ] Wallet UI displays "delegating to X" before user signs.
- [ ] Replay protection: nonce in delegate's auth scheme, plus chain id in domain separator.
- [ ] EntryPoint version (v0.7 vs v0.8) pinned across bundler, paymaster, account.
- [ ] Paymaster has enough deposited stake for expected throughput.
- [ ] Tested on a public testnet (Sepolia, Base Sepolia) before mainnet.

## Further Reading

- EIP-7702 spec: https://eips.ethereum.org/EIPS/eip-7702
- ERC-4337 spec: https://eips.ethereum.org/EIPS/eip-4337
- Reference impl: https://github.com/eth-infinitism/account-abstraction
- viem AA: https://viem.sh/docs/account-abstraction
- Pimlico bundler: https://docs.pimlico.io
- Safe 4337 module: https://github.com/safe-global/safe-modules
