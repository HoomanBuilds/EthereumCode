# Bridging — Cookbook

Moving value between Ethereum L1 and L2s, or between L2s, is one of the most exploited surfaces in crypto. **Over $3B has been stolen from cross-chain bridges since 2021** (Ronin, Nomad, Wormhole, Multichain, Harmony, and others). Most of those losses came from trusted multisigs or off-chain validator sets, not from official optimistic/ZK bridges.

This file is the cookbook for bridging without making the same mistakes. Read it before integrating a bridge in your app, before quoting bridge times to a user, and before recommending a bridge for a transfer.

## Two Categories of Bridge

There are exactly two categories of bridge. Mixing them up is the most common mistake.

| Category | Examples | Trust Model | Withdrawal Time | When to Use |
|---|---|---|---|---|
| **Official (canonical)** | Arbitrum Bridge, Base Bridge, OP Bridge, zkSync Bridge, Scroll Bridge | Inherited from the rollup itself (fraud or validity proofs) | Optimistic: 7 days. ZK: 15-120 min | Large amounts (>$100K), ETH/canonical assets, when you can wait |
| **Fast (third-party)** | Across, Hop, Stargate, Synapse, cBridge | Liquidity providers + (sometimes) external validator set | Seconds to minutes | Small-to-medium amounts, when speed matters, UX flows |

**Rule:** the canonical bridge has the same security as the rollup. A fast bridge does not. If the rollup is Stage 1+, the canonical bridge is as secure as Ethereum itself. If you bridge through Across or Stargate, you have **added** trust assumptions on top of the rollup.

## Official Bridges Per Chain

| L2 | Official Bridge URL | L1 → L2 | L2 → L1 | Notes |
|---|---|---|---|---|
| Arbitrum One | https://bridge.arbitrum.io | ~10-15 min | ~7 days | Optimistic; fraud-proof window |
| Base | https://bridge.base.org | ~10-15 min | ~7 days | OP Stack |
| Optimism | https://app.optimism.io/bridge | ~10-15 min | ~7 days | OP Stack |
| Unichain | https://app.uniswap.org/swap (built into Uniswap UI) | ~10-15 min | ~7 days | OP Stack; Superchain member |
| Celo | https://bridge.celo.org or via Optimism's Superchain bridge | ~10-15 min | ~7 days | OP Stack since March 26, 2025 |
| zkSync Era | https://bridge.zksync.io | ~15-30 min | ~15-60 min | ZK; finality-bound |
| Scroll | https://scroll.io/bridge | ~15-30 min | ~30-120 min | ZK |
| Linea | https://bridge.linea.build | ~15-30 min | ~30-120 min | ZK |
| Polygon PoS | https://portal.polygon.technology | ~10-15 min | ~30-60 min (Plasma) or instant (PoS) | Not a rollup; different security model |

> Verify each URL and chain configuration against the canonical docs (https://docs.arbitrum.io, https://docs.base.org, https://docs.optimism.io, https://docs.zksync.io, etc.) before integrating into a frontend. Bridge UIs occasionally move.

### Why optimistic = 7 days

Optimistic rollups assume the sequencer is honest and let anyone challenge a withdrawal during a fraud-proof window. The window is **7 days** on Arbitrum, Base, Optimism, Unichain, and Celo. During this window, the canonical bridge cannot release funds to L1 — anyone who claims they want their L2 → L1 funds faster has to use a fast bridge that fronts the liquidity.

### Why ZK = minutes-to-hours

ZK rollups generate a validity proof for each batch. Once the proof is verified on L1, the withdrawal is final. There is no challenge window. Times vary by chain and by proof cadence:

- **zkSync Era:** ~15-60 minutes typical, sometimes longer.
- **Scroll:** ~30-120 minutes.
- **Linea:** ~30-120 minutes.

These are the **canonical bridge** times. Do not quote them as guarantees — proof generation can stall during incidents. Check chain docs for current SLAs.

## Fast Bridges — Tradeoffs

Fast bridges work by having liquidity providers on the destination chain. When you deposit on the source chain, the LP fronts you the funds on the destination. The LP later claims the source-chain deposit — which is where the trust model lives.

| Bridge | Model | Typical Fee | Speed | Trust Assumption | Notable Limit |
|---|---|---|---|---|---|
| **Across** | Optimistic + UMA dispute | 0.05-0.3% | 30s-2min | UMA optimistic oracle, dispute window | Caps per route; check live limits |
| **Hop** | AMM + bonders | 0.1-0.5% | 1-5 min | Bonder network, AMM slippage | |
| **Stargate** | LayerZero + unified liquidity | 0.04-0.2% | 1-10 min | LayerZero validator set | LayerZero has off-chain dependencies |
| **Synapse** | AMM + cross-chain messaging | 0.05-0.4% | 1-5 min | Synapse validator set | |
| **Celer cBridge** | LP + state guardian network | 0.04-0.5% | 1-15 min | SGN validator set | |

**Across** is generally the cheapest and fastest for ETH and major stablecoins between major L2s in 2026. It has been audited multiple times and uses UMA's optimistic oracle for dispute resolution rather than a bespoke validator set, which is a meaningfully thinner trust model than competitors.

**Stargate** is built on LayerZero. LayerZero has historically had configurable trust assumptions (which DVNs you trust) — this is power and footgun in equal measure. Use Stargate when you need 10+ chain support out of the box.

**Hop** is the most established fast bridge, with the longest track record. Slightly more expensive but a known quantity.

## When to Wait 7 Days vs. Pay 0.05% to Across

Decision rule:

- **Amount > $100K and not time-sensitive:** wait. The canonical bridge has rollup-level security; 7 days is cheap insurance.
- **Amount $10-100K, time-sensitive:** Across or Hop. Pay 0.05-0.3% for speed.
- **Amount < $10K:** Across or Hop. The 7-day wait is rarely worth the user friction.
- **Power user moving funds across many chains:** Across. The fees are flat enough to be a rounding error.
- **Treasury operations:** canonical bridge, no exceptions. Boards do not like reading "fast bridge exploit" headlines.

## Common Pitfalls

### Pitfall: Bridging to the wrong address

Send to the wrong chain ID, lose the funds. There is no recovery. Most bridges check, but custom integrations skip the check.

**Do this:** in your bridge integration, hardcode the destination chain ID and verify the user's wallet is connected to the source chain before signing.

### Pitfall: Bridging tokens that don't exist on the destination

Most fast bridges only handle a curated list of tokens (ETH, USDC, USDT, WBTC, DAI). If you try to bridge a project token, the bridge either rejects it or wraps it as a "native" version that is unbridgeable back. Check the supported-token list **per route** before quoting a transfer.

**Do this:** before integrating, query each bridge's supported-token API for the exact source/destination pair you care about.

### Pitfall: USDC ≠ USDC across chains

Not every "USDC" on every chain is Circle-issued native USDC. Some chains have **USDC.e** (bridged via the canonical bridge from L1, not Circle-issued) and **native USDC** side by side. Mixing them up costs time and slippage.

**Bridged vs Native USDC** as of early 2026:

- **Mainnet:** native USDC.
- **Arbitrum:** native USDC (`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`) AND bridged USDC.e (`0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`). Always prefer native.
- **Base:** native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
- **Optimism:** native USDC (`0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85`) AND bridged USDC.e (`0x7F5c764cBc14f9669B88837ca1490cCa17c31607`).
- **zkSync, Scroll, Linea:** native USDC support — verify per chain via Circle's documentation (https://www.circle.com/multi-chain-usdc).

Always quote and prefer the **native** version. Bridged versions can be deprecated when Circle launches native, leaving liquidity stranded.

### Pitfall: Treating LayerZero as "trustless"

LayerZero is a messaging protocol with **configurable** trust assumptions. The default DVN configuration is reasonable, but it is not "trustless" in the rollup sense. Treat any LayerZero-based bridge as having an additional validator-set trust assumption beyond the rollup itself.

### Pitfall: Stuck withdrawals

L2 → L1 withdrawals on optimistic rollups require **two transactions** after the 7-day window:

1. The initial L2 withdrawal (sent during the L2 session).
2. The L1 "prove" + "finalize" call (or just "finalize" depending on the chain and on whether your wallet UI auto-proves).

Users often forget step 2 and think their funds are stuck. **Do this:** in your app's UX, surface a "pending withdrawal" panel that reminds users to claim after 7 days. The Optimism, Base, and Arbitrum bridge UIs do this; custom integrations should too.

### Pitfall: Reverts on the destination chain

If your bridge transfer triggers a destination-chain function call (e.g. "deposit then stake") and the destination call reverts, the funds may be stuck in a relayer contract until you contact the bridge team. Across recovers gracefully; Stargate's behavior depends on the integration. **Do this:** if you must combine bridge + action, use a bridge that has documented recovery semantics, and test the failure path on testnet.

### Pitfall: Sequencer downtime breaks bridges

If the L2 sequencer is offline (rare but real — Arbitrum had multi-hour outages in 2024), L1 → L2 deposits can be delayed by hours. Surface "sequencer status" in your UI for production apps that live or die on prompt deposits.

## Code: ETH Bridge L1 → Base via Canonical Bridge

The example below is **illustrative** and uses Optimism's `L1StandardBridge` ABI, which Base shares. Verify against the canonical docs at https://docs.base.org/builders/contracts/bridge-contracts before deploying.

```solidity
// Illustrative. Verify against https://docs.base.org canonical bridge docs.
interface IL1StandardBridge {
    function depositETHTo(
        address _to,
        uint32 _minGasLimit,
        bytes calldata _extraData
    ) external payable;
}

contract BaseDepositor {
    // Base L1StandardBridge on mainnet:
    // 0x3154Cf16ccdb4C6d922629664174b904d80F2C35
    // Verify the address against https://docs.base.org before mainnet deploy.
    IL1StandardBridge public constant BRIDGE =
        IL1StandardBridge(0x3154Cf16ccdb4C6d922629664174b904d80F2C35);

    function bridgeToBase(address recipient) external payable {
        BRIDGE.depositETHTo{value: msg.value}(
            recipient,
            200_000, // minGasLimit on Base; tune per call
            ""
        );
    }
}
```

The deposit will appear on Base in ~10-15 minutes. The user does not pay Base gas for the deposit; the bridge prepays.

## Code: viem Across Quote (Off-Chain)

Across exposes a REST API (https://docs.across.to/reference/api-reference) for quotes and submission. The pattern below is **illustrative** — verify the endpoint and field names against the canonical docs at https://docs.across.to before integrating.

```ts
// Illustrative. Verify against https://docs.across.to/reference/api-reference.
import { parseUnits } from "viem";

async function getAcrossQuote(opts: {
  originChainId: number;       // e.g. 1 (mainnet)
  destinationChainId: number;  // e.g. 8453 (Base)
  inputToken: `0x${string}`;   // L1 USDC
  outputToken: `0x${string}`;  // Base native USDC
  amount: bigint;              // amount in input-token decimals
  recipient: `0x${string}`;
}) {
  const url = new URL("https://app.across.to/api/suggested-fees");
  url.searchParams.set("originChainId", String(opts.originChainId));
  url.searchParams.set("destinationChainId", String(opts.destinationChainId));
  url.searchParams.set("inputToken", opts.inputToken);
  url.searchParams.set("outputToken", opts.outputToken);
  url.searchParams.set("amount", String(opts.amount));
  url.searchParams.set("recipient", opts.recipient);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Across quote failed: ${res.status}`);
  return res.json();
}
```

The quote includes the relayer fee, the LP fee, and the expected fill time. Display these to the user before they sign.

## Testnet Bridge URLs

For testing bridge flows in development:

| Chain | Testnet Bridge |
|---|---|
| Arbitrum Sepolia | https://bridge.arbitrum.io (toggle to testnet) |
| Base Sepolia | https://bridge.base.org (toggle to testnet) |
| Optimism Sepolia | https://app.optimism.io/bridge (toggle to testnet) |
| Unichain Sepolia | https://app.uniswap.org/swap (testnet mode) |
| zkSync Sepolia | https://bridge.zksync.io (toggle to testnet) |
| Scroll Sepolia | https://scroll.io/bridge (toggle to testnet) |
| Linea Sepolia | https://bridge.linea.build (toggle to testnet) |

Across has a testnet UI at https://testnet.across.to.

## Bridge Security Checklist

Before integrating a bridge, verify:

- [ ] Has it been **audited**? (Across, Hop, Stargate all have multiple audits — check Code4rena, Spearbit, Trail of Bits reports.)
- [ ] What is the **trust assumption**? (Canonical = rollup security. Across = UMA optimistic oracle. Stargate = LayerZero validator set. Hop = bonder network.)
- [ ] What is the **historical track record**? (Years live, total value bridged, any incidents and resolutions.)
- [ ] What is the **emergency response**? (Can the team pause? How fast? Who has admin keys?)
- [ ] Does the bridge **support the exact token pair** you need? (Many bridges support only a curated subset.)
- [ ] Does the bridge **support the exact chain pair** you need?
- [ ] What is the **per-route liquidity cap**? (You can quote a $10M transfer but only $500K of liquidity exists — your transfer will partial-fill or revert.)
- [ ] Does the bridge **expose a fee SLA** or surge-priced under load?

If any of these are unanswered, you are not ready to integrate.

## Quick Reference: Default Choices

For most apps in 2026:

- **Treasury moves:** canonical bridge.
- **User-funded deposits, ETH/USDC, < $50K:** Across.
- **User-funded deposits, > $50K, time-sensitive:** Across or canonical depending on user patience.
- **Project token bridge:** canonical (you control the bridge contract on the destination chain) — fast bridges rarely support new tokens.
- **Cross-L2 swaps as a UX flow:** Across with auto-quote in your frontend.

When in doubt: canonical bridge for security, Across for speed. Avoid anything that requires you to trust a custom multisig — that is the failure mode that has cost the industry $3B.
