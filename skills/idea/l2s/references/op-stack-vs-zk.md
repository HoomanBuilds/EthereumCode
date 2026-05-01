# Optimistic vs ZK Rollups — Cookbook

The two production rollup architectures on Ethereum are **optimistic rollups** (Arbitrum, Base, Optimism, Unichain, Celo) and **ZK rollups** (zkSync Era, Scroll, Linea). They share a goal — execute transactions cheaply off L1, post data and proofs back to L1 — but they make different tradeoffs.

This file is the cookbook for picking between them, deploying to either, and avoiding the mistakes that come from treating them as interchangeable. Read it before you write a deployment script that targets both.

## How They Differ — One Page

| Property | Optimistic | ZK |
|---|---|---|
| Proof model | Fraud proofs (challenge after the fact) | Validity proofs (proof verified before finality) |
| Withdrawal time L2 → L1 | **7 days** (challenge window) | **15-120 minutes** (proof generation + verification) |
| EVM compatibility | Bytecode-equivalent (Arbitrum, OP Stack, Base) | Varies: zkSync needs `zksolc`; Scroll, Linea are bytecode-equivalent |
| Cost to L2 user | Cheap ($0.001-0.003) | Slightly higher ($0.003-0.008), proof costs amortized |
| Verification on L1 | Cheap (only on dispute) | Constant per batch (proof verification gas) |
| L1 → L2 deposit time | ~10-15 min | ~15-30 min |
| Compiler | Standard `solc` | `solc` (Scroll, Linea) or `zksolc` (zkSync) |
| Account abstraction | ERC-4337 (Arbitrum, Base, etc.) | Native (zkSync) or 4337 (Scroll, Linea) |
| Chains in production (2026) | Arbitrum, Base, Optimism, Unichain, Celo | zkSync Era, Scroll, Linea |

## Why Optimistic = 7 Days

Optimistic rollups assume the sequencer is honest and post results to L1 without proof. **Anyone** can challenge a result during a 7-day fraud-proof window by submitting a fraud proof. The 7-day delay is the cost of "we'll prove it only if challenged" — it is the safety margin before funds can leave L1.

Some Stage 1 optimistic rollups (Arbitrum) have permissionless fraud proofs in production. Some are still in transition. **Check L2Beat** (https://l2beat.com) for each chain's stage and current proof system.

The 7-day window only affects **L2 → L1** withdrawals. L2-internal transactions are fast (sub-second to a few seconds). The 7 days is the canonical-bridge wait — fast bridges (see `bridging.md`) front the liquidity for a fee.

## Why ZK = Minutes to Hours

ZK rollups generate a SNARK or STARK proof for each batch of transactions. The proof is verified on L1; once verified, the batch is final. There is no challenge window — math has settled it.

Proof generation has real cost (CPU time, sometimes GPU clusters), so ZK rollups batch transactions and generate one proof per batch. Cadence varies:

- **zkSync Era:** 15-60 min typical.
- **Scroll:** 30-120 min.
- **Linea:** 30-120 min.

These times are **typical**, not guaranteed. Proof generation can stall during incidents. Check chain docs for current SLAs.

## Stage 0 vs Stage 1+ (Read This Before You Trust Any Rollup)

L2Beat classifies rollups in **stages** based on how decentralized they are:

| Stage | What It Means | Should You Hold Production Funds? |
|---|---|---|
| **Stage 0** | Sequencer can censor, operator can upgrade instantly, no proof system live | No |
| **Stage 1** | Permissionless fraud/validity proofs in production, security council exists | Yes, with caution |
| **Stage 2** | Fully permissionless, no operator override | Yes |

As of early 2026, **Arbitrum, Base, Optimism, zkSync Era, Scroll, and Linea are Stage 1**. Some niche L2s and L3s remain Stage 0. **Always check L2Beat** before recommending a chain to a user holding production funds.

Stage 0 chains are fine for testing and prototypes; they are not fine for treasury or user funds.

## EVM Compatibility — The Real Differences

This is where most production bugs come from. "EVM-compatible" is a spectrum.

### Bytecode-equivalent (Arbitrum, OP Stack, Base, Optimism, Unichain, Celo, Scroll, Linea)

You compile with standard `solc`, deploy with standard tooling, expect identical behavior to mainnet. Differences are limited to a few opcodes and precompiles. **Most projects deploy here without code changes.**

### zkSync Era — Compiler Swap Required

zkSync Era requires the **`zksolc`** compiler (a fork/wrapper of `solc` with a different bytecode target). Foundry has zksync support; verify against canonical docs at https://docs.zksync.io for the latest setup. The differences that bite production:

- **No `EXTCODECOPY`.** Compile-time error. Code that introspects other contracts' bytecode will not compile.
- **65,536-instruction contract limit.** Larger contracts must be split.
- **Non-inlinable libraries must be pre-deployed.** Standard mainnet libraries that get inlined need separate deployment.
- **Native account abstraction.** Every account is a smart contract. EOAs as you know them on mainnet do not exist — accounts can have custom signature schemes, paymasters, and arbitrary validation logic.
- **`tx.origin` is reliable** in a way mainnet's is not, because all accounts are AA contracts.
- **Different gas pricing.** Pubdata posting cost is separate from execution gas.

If you are deploying Solidity on zkSync that was written for mainnet, expect a **1-3 week** porting effort, including audit re-scope.

### Arbitrum — Bytecode-Equivalent, but `block.number` Is L1

Arbitrum is bytecode-equivalent for application code, but several globals behave differently:

- **`block.number`** returns the **L1 block number**, not the Arbitrum block number. Use Arbitrum's `ArbSys` precompile (`0x0000000000000000000000000000000000000064`) for the L2 block number.
- **`block.timestamp`** is the L2 block timestamp — use this for time logic, not `block.number`.
- **`block.coinbase`** returns the L1 coinbase, not the L2 sequencer.
- **`msg.sender` from L1 → L2 transactions** is aliased — calls from L1 contracts arrive on L2 from `msg.sender + 0x1111000000000000000000000000000000001111`. Use `AddressAliasHelper.undoL1ToL2Alias` when verifying L1 callers.

### OP Stack — Generally Identical to Mainnet

Base, Optimism, Unichain, and Celo all run OP Stack, which is the closest thing to "deploy mainnet code unchanged." The main differences:

- **L1 fee separate from L2 gas.** Transactions pay L2 execution gas plus a tiny L1 calldata fee for the eventual L1 batch posting.
- **`block.number`** is L2 block number (unlike Arbitrum). `block.timestamp` is L2 block timestamp.
- **No reorg risk above 1-2 blocks.** L2 blocks finalize via L1 inclusion.

### Unichain — OP Stack, but Time-Priority Ordering

Unichain is an OP Stack chain, so the EVM compatibility is mainnet-equivalent. But block building uses **TEE-based time-priority ordering** (built with Flashbots Rollup-Boost):

- Transactions are ordered by **time received**, not by gas price.
- Mempool is encrypted — sandwich attacks are prevented.
- **Do not** waste gas on priority fee bidding — it has no effect.
- Roadmap is 250ms sub-blocks ("flashblocks"); currently 1s.

Patterns that depend on competitive priority fees (PGA-style MEV searcher bots) will not work on Unichain. Patterns that benefit from order protection (consumer swaps, NFT mints) work better there than anywhere else.

## Stylus on Arbitrum — Rust on the EVM

Stylus is **Arbitrum's** WASM-based VM that runs alongside the EVM and shares state with it. You can write contracts in Rust, C, or C++ and call them from Solidity contracts (and vice versa).

When to use Stylus:

- **Heavy math / cryptography:** 10-100x gas savings over Solidity for elliptic-curve operations, hash functions, compression.
- **Custom VMs / interpreters:** loops and bit-twiddling are vastly cheaper.
- **Code reuse from existing Rust ecosystems:** porting battle-tested Rust crypto libraries directly.

Practical notes:

- Contracts must be **"activated"** via the `ARB_WASM` precompile (`0x0000000000000000000000000000000000000071`) before first use. Activation costs gas; budget for it.
- Stylus does not replace Solidity — most contracts are still cheaper to write in Solidity. Use Stylus for hot paths.
- Verify against canonical docs at https://docs.arbitrum.io/stylus for the current Rust SDK version and tooling.

## Deployment Differences — A Concrete Walkthrough

### Deploying to OP Stack chains (Base, Optimism, Unichain, Celo)

```bash
# Same Foundry script you'd run on mainnet, with --rpc-url switched.
forge create src/MyContract.sol:MyContract \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast
```

No code changes. Verify against the chain's explorer:

```bash
forge verify-contract <address> src/MyContract.sol:MyContract \
  --chain base \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Deploying to Arbitrum

Same `forge create` flow. The chain ID is `42161`. The RPC is `https://arb1.arbitrum.io/rpc`. Verify on https://arbiscan.io.

Watch out: if your contract uses `block.number` for time logic, refactor to `block.timestamp` first. On Arbitrum, `block.number` is the L1 block number and **does not increment with each L2 block**.

### Deploying to zkSync Era

You need the zkSync Foundry fork or the official zkSync Hardhat plugin. **Verify against canonical docs at https://docs.zksync.io for the current toolchain** — the SDK and Foundry integration evolve fast.

```bash
# Illustrative. Verify against https://docs.zksync.io for current foundry-zksync flow.
forge build --zksync
forge create src/MyContract.sol:MyContract \
  --rpc-url https://mainnet.era.zksync.io \
  --private-key $PRIVATE_KEY \
  --zksync
```

Expect issues if your contracts use `EXTCODECOPY`, exceed 65K instructions, or rely on inlined libraries.

### Deploying to Scroll or Linea

Scroll and Linea are bytecode-equivalent ZK rollups — standard `solc`, standard Foundry, no compiler swap. Use the chain's RPC and chain ID, deploy, verify on the chain's explorer.

```bash
forge create src/MyContract.sol:MyContract \
  --rpc-url https://rpc.scroll.io \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Chain IDs: Scroll `534352`, Linea `59144`.

## Account Abstraction Differences

| Chain | AA Model | Notes |
|---|---|---|
| Mainnet | ERC-4337 | Bundler infrastructure required (Pimlico, Stackup, Alchemy) |
| Arbitrum | ERC-4337 | Same as mainnet; bundler ecosystem available |
| Base | ERC-4337 + Smart Wallet | Coinbase Smart Wallet is first-party (passkey-based) |
| Optimism | ERC-4337 | Same as mainnet |
| Unichain | ERC-4337 | OP Stack default |
| Celo | ERC-4337 | OP Stack default |
| **zkSync** | **Native AA** | Every account is a smart contract; no bundler needed |
| Scroll | ERC-4337 | Standard bundler |
| Linea | ERC-4337 | Standard bundler |

If you want gasless UX without bundler infrastructure, zkSync is the path of least resistance. Verify the current paymaster API against https://docs.zksync.io.

## Picking Between Them — Decision Framework

| Need | Pick | Why |
|---|---|---|
| Cheapest gas | Optimistic (Base) | $0.0008-0.002 per swap typical |
| Fast withdrawal to L1 | ZK (Scroll/Linea/zkSync) | 15-120 min vs 7 days |
| Mainnet-equivalent EVM | Optimistic (Arbitrum, OP Stack) **or** ZK (Scroll, Linea) | Both work; pick on other axes |
| Native account abstraction | ZK (zkSync) | Native AA, no bundler |
| Largest DeFi ecosystem | Optimistic (Arbitrum) | Most protocols, deepest liquidity |
| Largest consumer ecosystem | Optimistic (Base) | Coinbase, Farcaster, Smart Wallet |
| MEV-protected order flow | Optimistic (Unichain) | Time-priority TEE block builder |
| Rust contracts | Optimistic (Arbitrum Stylus) | WASM VM alongside EVM |
| Maximum decentralization story | Mainnet | Never trust an operator if you don't have to |

## Common Bugs When Porting Mainnet Code

These are the actual issues that show up in production when teams treat L2s as fungible.

**`block.number` for time logic.** Breaks on Arbitrum (where it's L1's block number). Use `block.timestamp` instead.

**`EXTCODECOPY` checks.** Some patterns introspect other contracts' bytecode to detect proxies, check ERC-165 interface ids, etc. These do not compile on zkSync. Use ERC-165 `supportsInterface` instead.

**Contract size limits.** On mainnet, the EIP-170 limit is 24,576 bytes. zkSync has a 65,536 **instruction** limit, which is different and often tighter for large contracts. Split early.

**Hardcoded gas amounts.** A `gas: 50000` hint that works on mainnet may underflow on chains with different gas pricing (zkSync's pubdata, Arbitrum's L1 calldata fee). Use `.call{gas: ...}` only when you have a calibrated value, otherwise let Solidity infer.

**Hardcoded chain assumptions.** `block.chainid` should drive any chain-specific branch. Hardcoding `1` (mainnet) or `42161` (Arbitrum) breaks deployments to other chains.

**MEV protection assuming priority fees.** On Unichain, priority fees do nothing. On other chains, they work as expected. If you ship a wallet/router that bids priority fees, branch on `chainid`.

**`tx.origin` checks.** On zkSync, `tx.origin` semantics differ because every account is an AA contract. Auth that depends on `tx.origin` is fragile across chains anyway — use `msg.sender` or signature-based auth.

**Bundler assumptions.** Code that assumes ERC-4337 bundler infrastructure exists silently breaks on zkSync (where AA is native and bundlers don't apply).

## Verify Before You Ship

For every L2 deployment, before mainnet:

1. Deploy the same code to the chain's testnet first (e.g. `Base Sepolia`, `Arbitrum Sepolia`, `zkSync Sepolia`).
2. Run the full test suite **on that chain's RPC**, not against a local fork — chain-specific bugs only appear on the real network.
3. For zkSync, run `zksolc` compilation as part of CI; do not let mainnet-only `solc` compilation be the only signal.
4. Verify the contract on the chain's explorer (Arbiscan, Basescan, Optimistic Etherscan, Era Explorer, Scrollscan, Lineascan).
5. Spot-check L2 → L1 withdrawal end-to-end on testnet, including the L1 finalization step.

The cost of porting and verifying is real. Plan for 1-3 days of integration on bytecode-equivalent chains, 1-3 weeks on zkSync. Budget audit time accordingly.
