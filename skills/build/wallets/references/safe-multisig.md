# Safe Multisig Operations

Safe is the default smart-contract wallet for treasuries, DAO ops, and any AI-agent setup that needs human-in-the-loop. This file is what to actually call: ownership changes, module/guard install, and the patterns that don't show up in the marketing pages.

For raw addresses and Solidity-level call shapes, see `addresses/references/safe-and-aa.md`. This is the operational layer above that.

## Anatomy of a Safe

```
ProxyFactory(0x4e1DC...)  ← deploys clones of the singleton
        │
        ▼
SafeProxy (per-user)
        │  delegatecall to
        ▼
Safe Singleton(0x41675...)  ← all the logic lives here
        │
        ├── owners (1..n addresses)
        ├── threshold (k)
        ├── nonce (per-Safe replay protection)
        ├── modules (whitelisted contract callers)
        ├── guard (transaction-level policy contract, optional)
        └── fallback handler (handles non-Safe-defined calls)
```

Each Safe is a proxy at a deterministic address (CREATE2 with salt = `keccak256(initializer, saltNonce)`). Same address across all chains is achievable with the same factory + initializer + saltNonce. Useful for cross-chain treasuries — see `Safe{Wallet}` UI's "Multi-chain Safe" feature.

## Threshold and owner choice

| Setup | Owners | Threshold | Use |
|---|---|---|---|
| Personal cold | 2 | 2 | Hardware + phone, no recovery |
| Personal recoverable | 3 | 2 | Hardware + phone + trusted contact |
| AI-agent ops | 3 | 2 | Agent hot key + human hot + human cold |
| DAO multisig | 5–9 | 3–5 | M-of-N social-trust setup |
| Treasury | 7+ | 4+ | Geographically distributed signers |

Threshold rules:
- 1-of-N is just an EOA with extra steps. Don't.
- N-of-N is brittle (one signer offline → frozen). Use M-of-N with M < N.
- For AI-agent setups, the agent owner is one signer, not the only one. Threshold ≥ 2 means agent compromise alone can't drain.

## Owner management

```solidity
// addOwnerWithThreshold
safe.addOwnerWithThreshold(newOwner, newThreshold);

// removeOwner — needs the previous owner in the linked list
safe.removeOwner(prevOwner, ownerToRemove, newThreshold);

// swapOwner — replace one for another, keep threshold
safe.swapOwner(prevOwner, oldOwner, newOwner);

// changeThreshold — change just k
safe.changeThreshold(newThreshold);
```

The owner list is a singly-linked list with a sentinel `0x...01`. To remove or swap, you need the address that points to the target — call `getOwners()` and pass the predecessor.

These calls only succeed when invoked from the Safe itself (via `execTransaction`), i.e., they must be approved by ≥threshold owners.

## execTransaction lifecycle

```
1. Operator builds a SafeTx struct (to, value, data, operation, nonce, ...)
2. Each owner signs the EIP-712 hash off-chain
3. Operator concatenates signatures (sorted ascending by signer address)
4. Operator submits execTransaction(...)
5. Safe verifies threshold, executes, increments nonce
```

The signature format is the most-broken-by-newcomers detail. For each signer:
- 65 bytes: `r ‖ s ‖ v` — standard ECDSA, with `v ∈ {27, 28}`.
- For contract signers (a Safe owns another Safe), use `v = 0` and a "dynamic part" appended after fixed signatures. Tooling handles this; bare-handed encoding does not.
- Concatenate signatures in **ascending owner address order**. Reverts otherwise.

## Modules: bypass threshold

Modules are contracts that can call the Safe with no signature check. The Safe owner whitelists them via `enableModule(address)`. Modules execute via `execTransactionFromModule`.

Typical modules:
- **Allowance Module**: gives an address a spending allowance per token, refilling on a schedule. Use case: ops team gets $5k/week without DAO vote.
- **Roles Module v2 (Zodiac)**: fine-grained allowlist of which functions on which contracts a role can call.
- **Recovery Module**: trusted parties can replace a lost key after a delay.
- **Spending Limit Module**: per-token caps + cooldown.
- **Custom AI-agent module**: agent address can call only `swap` on a specific Uniswap router, no other functions.

```solidity
// One-time setup (requires threshold approval as a SafeTx)
safe.enableModule(allowanceModule);

// Now allowanceModule can call:
allowanceModule.executeAllowanceTransfer(safe, USDC, recipient, amount, ...);
```

Removing a module: `disableModule(prevModule, moduleToRemove)` — same linked-list mechanic as owners.

**Module risk**: a module is a privileged backdoor. Treat module installs like contract upgrades — review, test on Sepolia, time-lock if possible.

## Guards: transaction-level policy

A guard is a single contract called BEFORE every `execTransaction`. It can revert. Use it to enforce:
- Whitelist of destination contracts.
- Per-tx value caps.
- Time-of-day restrictions ("no large transfers between midnight and 6am UTC").
- Velocity controls ("no more than 3 large txs per day").

```solidity
interface IGuard {
  function checkTransaction(
    address to, uint256 value, bytes calldata data,
    Enum.Operation operation, uint256 safeTxGas, uint256 baseGas,
    uint256 gasPrice, address gasToken, address payable refundReceiver,
    bytes memory signatures, address msgSender
  ) external;
  function checkAfterExecution(bytes32 txHash, bool success) external;
}

safe.setGuard(guardAddress);
```

A bricked guard (always reverts) freezes the Safe — `setGuard(address(0))` to remove, but only via execTransaction with guard approval. Test extensively before installing.

## Recovery patterns

Lost a signer key. Options:

1. **Threshold lets you continue**: if you have ≥ threshold remaining keys, just `removeOwner` the lost one and `addOwner` a replacement. One Safe transaction.
2. **Threshold not met**: install a Recovery Module *before* losing the key. Common ones:
   - **Sygma SafeNet / Recovery Module by Safe team**: trusted party (or set of parties) can initiate recovery after a delay. The lost owner can cancel during the delay if it was a false alarm.
   - **Social recovery via Argent-style guardians**: separate contract; integrate before you need it.
3. **No recovery installed, threshold not met**: funds are stuck. There is no escape hatch. Plan for this with module install on day 1.

Recovery module install is non-trivial — it's the meta-question of "who can override our threshold?" Choose intentionally.

## Cross-chain Safe

To have the SAME Safe address on multiple chains:

1. Use the same `Safe Proxy Factory` on each chain (deterministic addresses across the major EVM chains).
2. Pass the same `setupParams` (owners, threshold, fallback handler, etc.).
3. Use the same `saltNonce`.

```solidity
bytes memory init = abi.encodeWithSelector(
  Safe.setup.selector,
  owners, threshold, /*to*/ address(0), /*data*/ "",
  /*fallbackHandler*/ COMPATIBILITY_FALLBACK_HANDLER,
  /*paymentToken*/ address(0), /*payment*/ 0, /*paymentReceiver*/ address(0)
);
factory.createProxyWithNonce(SINGLETON, init, saltNonce);
// Same on every chain → same address
```

`Safe{Wallet}` UI's "Add network" feature does this automatically. Beware: the Safe is independent on each chain — owners can be different (if changed post-deploy on one chain), nonce is per-chain.

## Safe in your app

To let your dApp work with Safe users:

1. Use `@safe-global/safe-apps-sdk` to detect when running inside Safe{Wallet}.
2. Standard wagmi/viem still works — Safe{Wallet} injects an EIP-1193 provider that batches actions into a SafeTx instead of submitting directly.
3. Tx hash returned to your dApp is a `safeTxHash`, not an Ethereum tx hash. Don't show it as a block-explorer link until execution.

```ts
import { useSafeAppsSDK } from "@safe-global/safe-apps-react-sdk";

const { sdk, safe } = useSafeAppsSDK();
// safe.safeAddress, safe.chainId, etc.

await sdk.txs.send({ txs: [{ to, value, data }] });
// Multi-sig flow: queues the tx, owners sign in Safe{Wallet}
```

For a vault product specifically, support reading `safe.safeAddress` as the owner of positions (so the user sees their Safe's positions, not their EOA's).

## Operational tips

- **Always test new modules / guards on Sepolia first** with the same configuration. Production-only mistakes are unreversible.
- **Document threshold changes** in the DAO forum or governance log. Future you won't remember why threshold went from 4 to 3.
- **Backup your owner list**: export `getOwners()` periodically; if a guard locks you out at the read level (it shouldn't, but) you want offline truth.
- **Don't use Safe as a non-custodial vault holding user funds**: it's not designed for thousands of distinct beneficiaries. Use it for ops, governance, treasury, ai-agent oversight.
- **Use Safe{Wallet} or Den** as your UI; integrating execTransaction by hand for ad-hoc transfers is unnecessary work.

## Common pitfalls

- **Concatenating signatures in wrong order** → revert with `GS026`. Always sort by signer address.
- **Forgetting `prevOwner` in `removeOwner`** → revert. Walk the linked list first.
- **Setting threshold > owner count** → revert.
- **Installing a guard that reverts on internal Safe operations** (like `swapOwner`) → bricked Safe. Always test the guard against the full Safe ABI in sim.
- **Running EIP-1271 contract signatures with a stale Safe nonce** → off-chain signature is invalid by the time it executes. Sign with `nonce = currentNonce + offset`.
- **Recovery module installed but never tested** → finding out it's broken when you need it. Run a recovery drill yearly.
- **Same Safe address on multiple chains, different owners on each** → operations confusion. Lock down ownership flow to "always change on every chain together" or document explicitly.

## What to read next

- `references/aa-and-7702.md` — ERC-4337 and EIP-7702 patterns
- `references/key-management.md` — protecting the keys that own this Safe
- `addresses/references/safe-and-aa.md` — verified addresses + raw call shapes
- Safe docs: https://docs.safe.global/
- Zodiac modules: https://zodiac.wiki/
