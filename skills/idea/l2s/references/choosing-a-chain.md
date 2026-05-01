# Choosing a Chain — Cookbook

This file is the decision tree for picking an Ethereum chain for a new project. Read it before you commit to a chain. The wrong chain wastes 3-6 months of engineering work, splits liquidity, and is painful to migrate from.

The shortcut version: most projects should start on **one** chain, prove product-market fit, then expand. The hard part is choosing which one.

## Start With the Right Question

Founders ask "which L2 should I use?" The better question is "what does my app actually need that mainnet does not give me?"

If the answer is "nothing concrete, but L2s are cheaper" — you may be picking too early. Run the four-question filter first:

1. **What is the per-user cost ceiling?** If a user does 10-50 actions a month and you can absorb $0.05-0.50 per action, mainnet at low gas works. If you need sub-cent, you need an L2.
2. **What ecosystem do users come from?** Coinbase users → Base. Long-tail DeFi users → Arbitrum. Mobile / emerging markets → Celo. Crypto-native L1 holders → mainnet.
3. **What protocols do you compose with?** If you need Pendle, GMX, or Camelot, you go where they live (Arbitrum). If you need Aero, you go to Base or Optimism. Composability is gravity.
4. **What is your finality requirement?** A perp or a payments app cannot wait 7 days for L2 → L1 withdrawals. A long-term staking app does not care. ZK rollups (zkSync, Scroll, Linea) finalize in 15-120 minutes; optimistic rollups (Arbitrum, Base, Optimism, Unichain, Celo) take 7 days.

After the filter, the matrix below should narrow you to 1-2 candidates.

## App Type → Chain Matrix

The columns name the chains; the rows name the app type. The cell names a single chain because **multi-chain is a later problem**, not a launch problem.

| App Type | Chain | Why |
|---|---|---|
| Consumer / social | **Base** | Coinbase Smart Wallet, Farcaster, on-ramp, fastest-growing user base |
| AI agents | **Base** | ERC-8004 deployment, x402 stablecoin payments, AgentKit SDK, agent-friendly culture |
| Deep DeFi liquidity | **Arbitrum** | GMX, Pendle, Camelot, Radiant, Jones — most DeFi-native chain |
| Yield strategies | **Arbitrum** | Pendle for tokenized yield, GMX for hedging, Aave/Morpho for lending |
| Perps / derivatives | **Arbitrum** | GMX v2 + Hyperliquid neighbors; established perp culture |
| Gasless UX | **zkSync Era** | Native account abstraction — every account is a smart contract, paymasters are first-class, no bundlers |
| MEV-protected trading | **Unichain** | TEE-based block building, time-priority ordering, encrypted mempool |
| Rust / compute-heavy | **Arbitrum (Stylus)** | WASM VM alongside EVM, 10-100x gas savings on heavy math/crypto |
| Mobile / payments / emerging markets | **Celo** | MiniPay, USDm/EURm/BRLm stablecoins, sub-cent fees, Africa/LatAm |
| Stablecoin rails / RWA / B2B payments | **Polygon PoS** | $500M+ monthly payment volume, 410M+ wallets, AggLayer roadmap |
| L3 / appchain | **Arbitrum Orbit** | Mature framework, 47+ live Orbit chains |
| Maximum censorship resistance | **Mainnet** | Final settlement, no operator |
| High-value settlement (>$1M) | **Mainnet or Arbitrum** | Stage 1+ rollups inherit L1 security; mainnet is final settlement |

### Why these specific defaults

**Base for consumer.** The chain is run by Coinbase, has the only first-party fiat on-ramp on an L2, ships Smart Wallet (passkey + WebAuthn), and hosts the largest decentralized social graph (Farcaster). User acquisition cost on Base is structurally lower than other chains because the ramp is integrated.

**Arbitrum for DeFi.** GMX, Pendle, Camelot, Aave, Morpho, Radiant, Jones, Dolomite, and the long tail are deployed and capitalized. Switching costs for liquidity providers are real. New DeFi primitives launch here first more often than not.

**zkSync for gasless UX.** Native account abstraction means a user's account is itself a smart contract — no separate EOA + wallet contract abstraction. Paymasters are a first-class concept; you sponsor gas with one config line, not a 4337 bundler stack. This matters for onboarding flows where the user must not see "approve" twice or hold ETH at all.

**Unichain for MEV-sensitive trading.** Unichain's sequencer is built on Flashbots Rollup-Boost. Transactions are ordered by **time received**, not by gas price. The mempool is encrypted. This kills sandwich attacks and front-running for plain swaps. Note: gas-bidding strategies (priority fee races) are pointless on Unichain — do not port mainnet MEV protection patterns directly.

**Arbitrum Stylus for Rust.** Stylus runs WASM contracts that share state with EVM contracts on the same chain. You can call a Rust contract from a Solidity contract and vice versa. Gas savings are 10-100x on hash-heavy or arithmetic-heavy code (cryptography, compression, custom VM logic). Contracts must be "activated" via the `ARB_WASM` precompile (`0x0000000000000000000000000000000000000071`) before first use.

**Celo for mobile payments.** Celo migrated from L1 to OP Stack L2 on March 26, 2025 (block 31056500). Sub-cent fees plus integration with MiniPay (Opera Mini wallet) make it the only chain optimized end-to-end for low-income mobile users. USDm, EURm, and BRLm (rebranded from cUSD/cEUR/cREAL by Mento Protocol in December 2025) keep their original contract addresses.

**Polygon PoS for stablecoin rails.** Polygon PoS is not a rollup, but it has product-market fit for low-stakes payment flows. Stripe, Revolut, and a number of fintechs settle on it. The MATIC → POL migration is roughly 85% complete. Polygon zkEVM is being shut down (announced June 2025) — do not start new projects there.

## What About Optimism?

Optimism is a viable launch chain, but in 2026 the typical reason to pick OP Mainnet over Base is **values fit and grants** (RetroPGF, the Collective), not user reach. DeFi TVL on OP Mainnet is surprisingly low compared to Base or Arbitrum despite Superchain adoption. If you are not specifically targeting OP-native users or grants, Base is the higher-conviction choice within the OP Stack family.

If you want both, Base + Optimism with shared deployments via OP Stack interop is a viable path — but Base is leaving the Superchain (announced February 2026, finalized in a future hardfork), so the "shared infra" argument is weakening.

## What About Linea / Scroll?

Both are EVM-equivalent ZK rollups. Pick them when:

- You want **fast L2 → L1 withdrawals** (15-120 minutes) without giving up bytecode compatibility.
- You want **mainnet-grade EVM** (no `EXTCODECOPY` issues, no compiler swap, all opcodes work).
- You are doing **proof-heavy or trust-minimized bridging** between L1 and L2.

Pick **Scroll** for the most conservative EVM-equivalence story (community-aligned, Ethereum-Foundation-adjacent). Pick **Linea** for ConsenSys ecosystem integration (MetaMask, Infura) and the LINEA token incentive program. Neither has the DeFi liquidity of Arbitrum or the consumer reach of Base — pick them for finality-time reasons or for ecosystem fit, not for app-layer ecosystem.

## Cost Model — Don't Overweight Gas

L2 gas costs are within a 5-10x band of each other in 2026 ($0.001-$0.008 per swap). At realistic user volumes (10-100 actions/month), the difference between Base and zkSync is **single-digit dollars per user per year**. Do not pick a chain solely on gas.

The dominant costs are:

- **User acquisition cost.** A wrong-chain choice can multiply CAC 5-10x because users have to bridge in.
- **Liquidity bootstrapping.** Wrong chain → you pay LP incentives for 12+ months.
- **Audit cost.** Each new chain adds ~$30-100K of audit per deployment (gas profile, precompile differences, opcode quirks).

Optimize for these, not for $0.001 vs $0.003.

## Testnet → Mainnet Path

Pick the chain whose testnet your team will actually use. Most testnets are reliable; some are flaky.

| Mainnet Chain | Testnet | Faucet | Notes |
|---|---|---|---|
| Mainnet | Sepolia | https://sepoliafaucet.com, https://www.alchemy.com/faucets/ethereum-sepolia | Default L1 testnet. Holesky is being deprecated; Hoodi is its successor for staking-focused testing. |
| Arbitrum | Arbitrum Sepolia | https://faucet.quicknode.com/arbitrum/sepolia | Bridge from Sepolia ETH |
| Base | Base Sepolia | https://www.alchemy.com/faucets/base-sepolia | Free Coinbase Smart Wallet on testnet |
| Optimism | OP Sepolia | https://app.optimism.io/faucet | OP Stack — same flow as Base Sepolia |
| Unichain | Unichain Sepolia | https://faucet.unichain.org | RPC: `https://sepolia.unichain.org` |
| Celo | Alfajores | https://faucet.celo.org | Pre-existing testnet, kept after L2 migration |
| zkSync | zkSync Sepolia | https://docs.zksync.io/build/tooling/network-faucets | Verify against canonical docs at https://docs.zksync.io |
| Scroll | Scroll Sepolia | https://docs.scroll.io/en/user-guide/faucet | |
| Linea | Linea Sepolia | https://www.infura.io/faucet/linea | ConsenSys faucet |
| Polygon PoS | Amoy | https://faucet.polygon.technology | Mumbai is deprecated. Use Amoy. |

**Do this:** deploy to one testnet, run integration tests, run a closed alpha for 1-2 weeks with real users, then deploy to mainnet on the same chain. **Do not** deploy to multiple testnets in parallel — you will discover chain-specific bugs only on mainnet, and your audit scope will balloon.

## Switching Cost (Why Picking Right Matters)

| Cost | Approximate effort |
|---|---|
| Re-deploy contracts on new chain | 1-3 days if EVM-equivalent, 1-3 weeks if zkSync (zksolc, AA quirks) |
| Migrate liquidity | 4-12 weeks (incentive design, bridge UX, communication) |
| Re-audit | $30-100K, 4-6 weeks |
| Indexer rework (subgraph / Ponder) | 1-2 weeks per chain |
| Frontend chain-switching UX | 3-5 days |
| Total to fully migrate one product | **3-6 months and 6-figures** |

Migrating chains after launch is rarely catastrophic, but it is always expensive. Pick once, prove product-market fit, then expand intentionally with CREATE2 (see `cross-chain-deployment.md`).

## Decision Tree (Top-Down)

```
START
 │
 ├── Per-user cost ceiling > $0.20/action?
 │     └── YES → Mainnet is fine. Pick L2 only if other reasons apply.
 │
 ├── App needs sub-15-minute withdrawal to L1?
 │     └── YES → ZK rollup (zkSync, Scroll, Linea)
 │           └── Need bytecode-equivalent EVM? → Scroll or Linea
 │           └── Want native account abstraction? → zkSync
 │
 ├── App is consumer / social / AI agents?
 │     └── YES → Base
 │
 ├── App is DeFi (perps, yield, lending, AMM)?
 │     └── YES → Arbitrum (most liquidity + Stylus for Rust)
 │
 ├── App is mobile / emerging-market payments?
 │     └── YES → Celo
 │
 ├── App is MEV-sensitive trading?
 │     └── YES → Unichain
 │
 ├── App is stablecoin rails / RWA / B2B?
 │     └── YES → Polygon PoS (NOT zkEVM)
 │
 └── DEFAULT → Base (cheapest major L2, best on-ramp, healthiest 2025-2026 growth)
```

## Common Mistakes

**Picking a brand-new L2 for grant money.** A chain that pays you to deploy is a chain whose token chart is supporting marketing budgets. When the budget runs out, your liquidity walks. Take Optimism RetroPGF, Arbitrum DAO, Base, or EF grants instead — same money, no chain risk.

**Multi-chain on day one.** Liquidity splits 1/N, audit cost multiplies 1.3-1.5N, ops burden multiplies linearly. Deploy on one chain, hit 1000 DAU, then add a second chain when you can name a specific user request you cannot fulfill.

**Picking based on gas cost alone.** Per-tx delta is single-digit dollars per user per year between major L2s. Ecosystem fit is 10-100x more valuable.

**Treating Polygon zkEVM as alive.** It was announced for shutdown in June 2025. Use Polygon PoS (different chain, different scaling story) if you want the Polygon ecosystem.

**Calling Celo an L1.** It migrated to OP Stack L2 on March 26, 2025. Anyone calling it an L1 is using stale data.

**Defaulting to Uniswap on every chain.** Aero (the merged Aerodrome + Velodrome, November 2025) dominates Base and Optimism. Camelot dominates Arbitrum spot. SyncSwap dominates zkSync. Check the dominant DEX before quoting routing examples — it affects integration code.

## Per-Chain Ecosystem Snapshot

Quick reference for what lives where. Verify protocol availability against the chain's docs and against L2Beat / DeFi Llama — protocols come and go.

### Base (chain ID 8453)
- **DEX:** Aero (was Aerodrome) is the dominant DEX with the deepest liquidity for most pairs.
- **Lending:** Aave v3, Morpho, Moonwell.
- **Consumer:** Farcaster (Warpcast), Coinbase Smart Wallet, AgentKit, Friend.tech-class apps.
- **Stables:** native USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- **Why builders pick it:** lowest CAC for US/Coinbase users, on-ramp is one tap, AI agent tooling lives here.

### Arbitrum One (chain ID 42161)
- **DEX:** Camelot for spot, Uniswap v3 also strong; **GMX** for perps.
- **Yield:** Pendle (yield tokenization), Jones DAO, Dolomite, Radiant.
- **Lending:** Aave v3, Morpho, Compound.
- **Stables:** prefer **native USDC** at `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` over bridged USDC.e.
- **Stylus:** Rust/C/C++ contracts via WASM VM, activated through `ARB_WASM` precompile (`0x0000000000000000000000000000000000000071`).
- **Why builders pick it:** deepest DeFi liquidity, mature audit ecosystem, Stylus for compute-heavy code.

### Optimism (chain ID 10)
- **DEX:** Aero (was Velodrome) — merged with Aerodrome in November 2025.
- **Lending:** Aave v3, Sonne, Granary.
- **Why builders pick it:** RetroPGF grants, OP Collective alignment, Superchain interop story (caveat: Base announced departure February 2026).

### Unichain (chain ID 130)
- **DEX:** Uniswap v4 (the chain is Uniswap-built; v4 hooks are first-class).
- **Block builder:** TEE-based, time-priority ordering. Encrypted mempool.
- **Why builders pick it:** MEV protection out of the box, ideal for consumer swap UX where sandwiches kill conversion.

### Celo (chain ID 42220)
- **Wallet:** MiniPay, integrated into Opera Mini.
- **Stables (rebranded by Mento Protocol, December 2025):** USDm (was cUSD) at `0x765de816845861e75a25fca122bb6898b8b1282a`, EURm (was cEUR) at `0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73`, BRLm (was cREAL) at `0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787`. Same contracts, new symbols.
- **Why builders pick it:** sub-cent fees, mobile-first UX, Africa/LatAm distribution.

### zkSync Era (chain ID 324)
- **DEX:** SyncSwap dominates; ZKswap and Mute also present.
- **AA:** native — every account is a smart contract; paymasters are first-class.
- **Compiler:** **`zksolc`** required. No `EXTCODECOPY`. 65,536-instruction contract limit.
- **Why builders pick it:** gasless UX without bundler infrastructure, fast finality.

### Scroll (chain ID 534352) and Linea (chain ID 59144)
- **EVM:** bytecode-equivalent — standard `solc`, standard Foundry.
- **Finality:** 30-120 minutes (ZK validity proofs).
- **Why builders pick them:** mainnet-grade EVM with fast L2 → L1 withdrawals. Linea has the LINEA token and ConsenSys/MetaMask integration; Scroll is more conservative and EF-aligned.

### Polygon PoS (chain ID 137)
- **Not a rollup.** Sidechain with its own validator set; security model is weaker than rollups.
- **Use for:** stablecoin payments, RWA settlement, B2B rails — places where traditional fintechs already integrate.
- **Avoid:** holding large user funds without understanding the validator security model.

> **Polygon zkEVM is being shut down** (announced June 2025). Do not start new projects there.

## Verify Before You Commit

Before you ship:

1. Check **L2Beat** (https://l2beat.com) for the chain's stage (1+ for production), TVS, and risk analysis.
2. Check **DeFi Llama** (https://defillama.com/chains) for current DeFi TVL and protocol coverage.
3. Check **Dune dashboards** for the chain's daily active addresses and transaction count.
4. Check **chain documentation** for the canonical RPC, chain ID, explorer, and bridge.
5. If a key dependency (oracle, AA bundler, indexer) is missing on the chain, that is a hard blocker — not a "we'll figure it out" item.

The chain is the foundation. Pick deliberately, verify against canonical sources, and keep the project on one chain until you have proof you need another.
