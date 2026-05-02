# Feature Detection: Using Protocol Features Safely Across Forks and Chains

Once a protocol feature ships, your code has to handle the fact that it's NOT live everywhere — different L2s upgrade on different schedules, testnets diverge from mainnet, and historical chain state may predate the feature. This file is the contract-side and client-side patterns for safely using fork-gated features.

For verifying what's shipping, see `references/checking-fork-status.md`. For protocol-change proposals, see `references/proposing-changes.md`.

## The problem

```
Mainnet: Pectra live (May 2025)        — has EIP-7702, BLS, validator consolidation
Sepolia: Pectra live (Mar 2025)        — same features
Holesky: Pectra live                   — same features
Base:    Pectra-equivalent live        — but check date
Arbitrum: feature subset               — Stylus, custom precompiles, but EIP-7702 timing differs
Optimism: Pectra-equivalent live       — bedrock + isthmus upgrades follow L1
zkSync ERA: NOT yet at full Pectra     — verify before assuming features
```

Hardcoding "this feature exists" leads to silent failures on chains where it doesn't. Always detect at runtime.

## Detecting features in Solidity

The EVM does not provide a "what fork are we on" opcode. You detect features by:

1. **Chain ID** — chains pick fork schedules; chain ID is a reliable lookup key
2. **Probe behavior** — call a precompile, check it succeeded with reasonable gas
3. **Block number / timestamp** — for fork transitions on a known chain

### Pattern 1: Chain ID lookup

```solidity
function _supportsP256() internal view returns (bool) {
    uint256 cid = block.chainid;
    if (cid == 1) return true;            // Mainnet: EIP-7951 (Pectra)
    if (cid == 11155111) return true;     // Sepolia
    if (cid == 8453) return true;         // Base
    if (cid == 42161) return false;       // Arbitrum: verify before flipping
    if (cid == 324) return false;         // zkSync ERA: not at full Pectra
    return false;                         // unknown chain — be conservative
}
```

This is the most common pattern. It's accurate at deploy time but doesn't auto-update if the chain forks while your contract is live. For long-lived contracts, prefer probe-based detection.

### Pattern 2: Probe a precompile

```solidity
address constant SECP256R1_VERIFY = 0x0000000000000000000000000000000000000100; // EIP-7951

function _p256Available() internal view returns (bool) {
    bytes memory input = new bytes(160); // dummy input
    (bool ok, bytes memory ret) = SECP256R1_VERIFY.staticcall{gas: 50_000}(input);
    return ok && ret.length == 32;
}
```

Probes survive chain upgrades. Cost: a `staticcall` worth of gas + the precompile's gas. Cache results in storage if the call is hot.

### Pattern 3: Block-number gate (within one chain)

Useful when a contract was deployed before a fork on the same chain:

```solidity
uint256 immutable PECTRA_BLOCK;

constructor(uint256 _pectraBlock) {
    PECTRA_BLOCK = _pectraBlock;
}

function _afterPectra() internal view returns (bool) {
    return block.number >= PECTRA_BLOCK;
}
```

Make `PECTRA_BLOCK` immutable so it can't be changed; pass the right value at deployment based on chain.

## Notable precompiles by EIP

| Precompile | Address | Introduced | Notes |
|---|---|---|---|
| ecRecover | 0x01 | Frontier | Always available |
| sha256 | 0x02 | Frontier | Always available |
| ripemd160 | 0x03 | Frontier | Always available |
| identity | 0x04 | Frontier | Always available |
| modexp | 0x05 | Byzantium | Always available |
| bn256Add / Mul / Pairing | 0x06–0x08 | Byzantium / Istanbul | Always available |
| blake2f | 0x09 | Istanbul | Always available |
| pointEvaluation (KZG) | 0x0A | Cancun (EIP-4844) | For blob verification |
| BLS12-381 ops | 0x0B–0x11 | Pectra (EIP-2537) | New in May 2025 |
| secp256r1 verify | 0x100 | Pectra (EIP-7951) | P-256 curve, useful for Passkeys |

If your contract calls one of the newer precompiles, gate the call behind a chain ID check or a probe.

## EIP-7702 detection

EIP-7702 lets EOAs delegate to contract code via type-4 transactions. Your contract can detect whether an account is delegated:

```solidity
function _isDelegated(address account) internal view returns (bool, address) {
    bytes memory code = account.code;
    // 7702 delegation designator: 0xef0100 || addr (23 bytes)
    if (code.length == 23 && bytes3(code) == 0xef0100) {
        address target;
        assembly { target := shr(96, mload(add(code, 0x23))) } // skip 3 magic bytes, read 20
        return (true, target);
    }
    return (false, address(0));
}
```

The 0xef0100 prefix is the canonical designator. If the chain is pre-Pectra, no account will have this code shape, so the function safely returns false.

## Detecting features client-side (TypeScript)

```ts
import { createPublicClient, http } from "viem";
import { mainnet, base, arbitrum, optimism } from "viem/chains";

async function chainSupports7702(chainId: number): Promise<boolean> {
  // Maintained list — update from forkcast as forks land
  const PECTRA_CHAINS = new Set([1, 11155111, 17000, 8453, 10]);
  return PECTRA_CHAINS.has(chainId);
}

// Or probe by trying a no-op authorization
async function probe7702(client) {
  try {
    // viem's signAuthorization works only on chains that support it;
    // wallets / RPCs may reject unsupported types.
    const auth = await client.signAuthorization({ contractAddress: "0x...", chainId: 0 });
    return Boolean(auth);
  } catch {
    return false;
  }
}
```

For probes, prefer try/catch around the *use* of the feature rather than testing for its existence in isolation. Some RPC nodes report "supported" but reject in practice.

## Detecting RPC capabilities

```ts
async function rpcSupports(client, method: string): Promise<boolean> {
  try {
    await client.request({ method, params: [] } as any);
    return true;
  } catch (e: any) {
    if (e.code === -32601 || /method not (found|supported)/i.test(e.message || "")) {
      return false;
    }
    // -32602 (invalid params) means the method exists but params are wrong — supported.
    if (e.code === -32602) return true;
    throw e;
  }
}

// Examples
await rpcSupports(client, "eth_getBlockReceipts");      // recent
await rpcSupports(client, "debug_traceTransaction");    // archive nodes only
await rpcSupports(client, "trace_filter");              // OpenEthereum-style
```

This also handles the chronic "this RPC says it's mainnet but doesn't have feature X" problem with cheap providers.

## Per-L2 feature support

L2s upgrade on independent schedules. Always verify against the L2's own changelog, not L1 status. Rough as-of-2026 status:

| L2 | EVM compatibility | Notes |
|---|---|---|
| Base | Cancun + Pectra-equivalent | Tracks Optimism upgrades closely |
| Optimism | Cancun + Isthmus (Pectra-equiv) | Bedrock → Granite → Holocene → Isthmus |
| Arbitrum | Cancun-compatible + Stylus | EIP-7702 timing differs from L1; verify |
| zkSync ERA | Custom EVM, not exact | Some precompiles are smart-contract reimpls; gas costs differ |
| Linea | Native BN254 + recent upgrades | Mostly mainnet-equivalent now |
| Scroll | Cancun-compatible | Standard precompiles |
| Polygon zkEVM | Being shut down | Don't target |
| Polygon PoS | Mainnet-equivalent | Heimdall + Bor |

When deploying cross-chain, run the same integration test on each target *before* assuming feature parity.

## Versioning your contracts

Embed feature flags so off-chain code can read what your contract supports:

```solidity
contract Vault {
    string public constant VERSION = "1.2.0";

    function supports7702() external view returns (bool) {
        return block.chainid == 1 || block.chainid == 8453;
    }

    function supportsP256() external view returns (bool) {
        // Same gating
        return supports7702();
    }
}
```

Frontends can `multicall` these getters to know which UI flows to show. Cheaper than asking RPC about EIP support.

## Migration patterns when a feature lands

Two strategies for using a new feature once it's live on mainnet:

**1. Two-path code with runtime selection**

```solidity
function transfer(address to, uint256 amount, bytes calldata sig) external {
    if (_supportsP256()) {
        _verifyP256(sig);   // cheaper post-Pectra
    } else {
        _verifyECDSA(sig);  // works pre-Pectra
    }
    _transfer(to, amount);
}
```

Both paths are tested. When all your target chains have the feature, you can deprecate the fallback in a future release.

**2. Deploy a new contract version on chains that have the feature**

Cleaner separation: `VaultLegacy` (pre-fork chains) and `VaultModern` (post-fork chains). Routing happens at the SDK layer based on chain ID. Best for substantial behavior differences (e.g., changing storage layout to use transient storage).

## Common mistakes

- **Hardcoding "feature X exists" without chain detection** — works on mainnet, breaks on the L2 you ship to next.
- **Trusting `block.chainid` alone for fork status within one chain** — chain IDs don't change at fork boundaries. Use block numbers or probes.
- **Probing in the hot path without caching** — if the probe is deterministic for the deployment, cache in immutable storage at construction.
- **Forgetting that testnets fork on different schedules than mainnet** — Sepolia/Holesky often get features weeks before mainnet; build accordingly.
- **Assuming "L2 is EVM-equivalent" means full feature parity** — zkSync's BN254 precompiles cost 3-5× mainnet; some L2s lag on opcode adoption.
- **Building on a feature still in `Review` status** — your code may be correct against the draft and wrong against the final spec. Wait for `Final` + first mainnet fork inclusion before depending on it.

## What to read next

- `references/checking-fork-status.md` — verifying upcoming feature status
- `references/proposing-changes.md` — formal EIP authoring path
- L2BEAT (https://l2beat.com) — for L2 upgrade history
- forkcast.org — for L1 fork content
- Each L2's release notes (Optimism, Arbitrum, Base, zkSync) — for L2 upgrade timing
