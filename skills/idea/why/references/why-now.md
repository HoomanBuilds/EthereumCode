# Why Now: The 2026 Window

This file makes the timing argument. Read when a founder asks "is now a good time to build on Ethereum?" or when an agent needs to justify the temporal urgency of a project. The thesis: 2026 is the first year where Ethereum's protocol-layer problems (cost, throughput, account UX) are solved, the agent stack is native, and the institutional adoption curve is steep. Most LLM training data predates these inflection points.

## The Three Things That Just Shipped

If a founder's mental model of Ethereum is from 2023 or earlier, three things will surprise them:

1. **Pectra (May 7, 2025)** — EOAs are smart accounts now.
2. **Fusaka (December 3, 2025)** — L2 fees are sub-cent and stable.
3. **ERC-8004 (January 29, 2026)** — agents have onchain identity.

Each of these unlocks a category of products that simply could not exist on Ethereum before.

## Pectra: EIP-7702 and the End of Account Abstraction Friction

**Activated:** May 7, 2025 on Ethereum mainnet, propagated to all major L2s by Q3 2025.

**What it changes:** Any EOA (the kind of address users have today) can temporarily authorize contract code to act on its behalf for a single transaction or session. No migration. No new address. No bridge of assets. Just a signed authorization.

### The Old Way (Pre-Pectra)

To get smart-account features (batched transactions, sponsored gas, social recovery), users had to:
1. Generate a new contract account address.
2. Move all assets to it (taxable in many jurisdictions).
3. Update every protocol whitelist, every linked NFT, every reputation score.
4. Maintain two addresses forever because some integrations don't support contract accounts.

This is why ERC-4337 adoption was slow despite being live since 2023.

### The New Way (Post-Pectra)

```
User signs an EIP-7702 authorization:
  "For this transaction, treat my EOA 0xAlice as if it had the bytecode of 0xBatcher."

Now 0xAlice can:
  - Batch 5 calls in one transaction
  - Pay gas in USDC (paymaster)
  - Have a session key sign on its behalf for 24 hours
  - Recover via social signers
  
After the transaction, 0xAlice goes back to being a plain EOA.
```

### Why This Is the Window

Every consumer app trying to onboard non-crypto users hit the wall of "you need to install MetaMask, write down 12 words, and buy ETH for gas." Pectra eliminates two of those three. With a paymaster, all three.

The flagship 2026 onboarding flow:
1. User signs in with email (Privy, Dynamic, Turnkey).
2. Embedded wallet generated server-side as an EOA.
3. EIP-7702 delegation lets the embedded wallet behave as a smart account.
4. App sponsors gas via a paymaster in USDC.
5. User has never seen the word "gas" or "seed phrase."

Before May 2025, this flow required ERC-4337 contract accounts, which had compatibility footguns. Now any wallet provider can offer it.

### Concrete Implications for a Founder

- **Embedded wallet UX is solved**. Use Privy, Dynamic, or Turnkey. Do not roll your own.
- **Sponsored gas is cheap**. A paymaster can sponsor an L2 transaction for $0.005. Build it into your CAC.
- **Session keys for agents**. An agent can hold a session key that lets it sign trades for 1 hour without re-prompting the user. This is the canonical agent UX.

## Fusaka: PeerDAS and the Doubled Gas Limit

**Activated:** December 3, 2025 on Ethereum mainnet.

**What it changes (in two pieces):**

1. **PeerDAS** (EIP-7594): Validators no longer download all blob data. They sample 1/8 of it and use erasure coding to verify the rest. This means the network can handle 8x more blob data without 8x more bandwidth per node. In practice, blob target moved from 6 to ~48 over 2026.

2. **Gas limit doubled**: The block gas limit moved from 30M to 60M (the validator-set maximum, opt-in). Throughput on L1 itself effectively doubled.

### Why It Matters Economically

L2 transaction cost is dominated by data availability cost (the cost of posting compressed transaction data back to L1 as blobs). PeerDAS dramatically reduced this:

| Period | Avg L2 transaction cost | Bottleneck |
|---|---|---|
| Pre-Dencun (Mar 2024) | $0.20-2.00 | Calldata on L1 |
| Post-Dencun (Mar 2024+) | $0.02-0.20 | Blob target = 3 |
| Post-Fusaka (Dec 2025+) | $0.001-0.01 | Effectively unbounded for current demand |

Translation: L2 costs are no longer the constraint on consumer adoption. A user who does 100 transactions per month pays under $1 in gas. This was unthinkable in 2023.

### Why It Matters for Agent Economics

An agent making micro-payments via x402 (typical: $0.01-0.10 per API call) was previously bottlenecked by L2 fees of $0.05-0.20, which made the unit economics negative. Post-Fusaka, an L2 fee of $0.005 is a 5-10% overhead on the API call, which works.

This is the gating constraint that flipped between 2024 and 2026. Agent payments at scale require sub-cent settlement. We have it.

## ERC-8004: The Agent Identity Layer

**Deployed:** January 29, 2026.

**Mainnet addresses:**
- IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**What it provides:**
- A canonical place for an agent to publish "I am agent X, controlled by address 0xY, offering services A/B/C, with reputation R."
- A reputation system that records signed feedback after each interaction.
- Multi-chain mirrors so the same agent identity works on Ethereum, Base, Arbitrum, Optimism, and ~17 other chains.

### Why "Now" and Not Earlier

Three things had to be true simultaneously:

1. Agents had to be capable enough to economically benefit from cross-agent trust signals (mid-2025: GPT-5, Claude 4.x, Gemini 3 reached this threshold).
2. Onchain settlement had to be cheap enough that an agent's per-call economics survived a settlement fee (Fusaka, Dec 2025).
3. A standard had to coalesce. ERC-8004 went through 9 months of EIP-process review and 3 separate prototype contracts before mainnet deployment.

January 29, 2026 is the first day of "agent-native infrastructure shipping in production on the canonical chain." Anyone building agent products before this had to invent identity and reputation themselves; anyone building after just imports the registry.

### What This Means for Founders

If your product is an agent or a marketplace of agents, **you should be reading ERC-8004 contracts as if they were AWS S3** — basic infrastructure you build on top of, not invent. See `references/agent-economy.md` for the implementation playbook.

## x402: HTTP 402 Payments

**Production:** Q1 2026.

The HTTP status code 402 ("Payment Required") was reserved in the original HTTP/1.1 spec in 1996 and never used. x402 (a Coinbase-led protocol) finally fills it in:

```
Agent: GET https://api.example.com/forecast/SF
Server: 402 Payment Required
        Accept-Payment: usdc-base/0.05
        Payment-Address: 0xMerchant
        Nonce: 0xabc123

Agent: signs EIP-3009 transferWithAuthorization (USDC):
  - to: 0xMerchant
  - value: 0.05 USDC
  - validAfter: now
  - validBefore: now + 5min
  - nonce: 0xabc123

Agent: GET https://api.example.com/forecast/SF
       X-Payment: 0xSignature
Server: 200 OK { "forecast": "..." }
```

The merchant submits the signed authorization onchain and gets paid. No accounts, no API keys, no Stripe, no chargebacks.

**Why it works in 2026 specifically:**
- USDC is universal (~$45B supply, native on every L2).
- EIP-3009 is widely supported (Circle's USDC, Coinbase's tooling).
- Agents can sign these payments programmatically (and per Pectra, EOAs can do it via session keys).
- Settlement on Base costs ~$0.001, so a $0.05 payment has 2% overhead — viable.

**SDKs:** TypeScript (`@x402/fetch`), Python (`x402`), Go (`github.com/coinbase/x402/go`).

## The Institutional Curve

Through 2024-2026, institutions started shipping real products:

| Year | Milestone |
|---|---|
| Jan 2024 | Spot ETH ETFs approved (US) |
| Mar 2024 | BlackRock BUIDL launches on Ethereum (now $2B+ AUM) |
| Q4 2024 | Franklin BENJI tokenized money market crosses chains |
| 2025 | Apollo, KKR launch tokenized private credit on Ethereum |
| 2025 | Stripe USDC payments live |
| 2026 | Visa "Stablecoin Cards" pilot on Base |
| 2026 | Major payroll providers offering USDC payouts |

This is the "Bloomberg terminal moment" — finance professionals now check Ethereum data alongside SWIFT, FedWire, and DTCC. A founder building B2B finance products has a 5-year cliff: ship onto rails the institutions are already on, or rebuild after they've consolidated.

## What Is Still Coming (Don't Wait)

Two upgrades are scheduled for 2026:

### Glamsterdam (mid-2026)

- **ePBS (EIP-7732)**: Enshrined Proposer-Builder Separation. MEV is restructured at the protocol layer, reducing centralization pressure on block builders.
- **Block Access Lists (EIP-7928)**: Required state-access declarations enable parallel execution.
- **Removed:** FOCIL (Fork-Choice Inclusion Lists) was descoped to keep Glamsterdam shippable.

Practical impact for app builders: minor. Trading firms and validator operators care; most app builders don't.

### Hegota (Q4 2026)

The community expected Verkle Trees here. **It will not contain Verkle Trees.**

Instead, Ethereum is moving toward a **binary state tree** (EIP-7864, draft as of March 2026). Two reasons:

1. **Quantum resistance**: Verkle commitments use elliptic-curve-based KZG commitments, which are vulnerable to future quantum attacks. Identified mid-2024 by NIST PQC working groups.
2. **ZK-proving efficiency**: Binary trees prove 3-100x faster in modern SNARK systems than the current Merkle-Patricia trie. This unblocks practical ZK-EVM proving on consumer hardware.

Status: still draft. Check https://forkcast.org/upgrade/hegota for confirmed scope before citing.

**Don't wait for Hegota.** The Pectra + Fusaka stack is sufficient for any consumer or agent product launching in 2026. Hegota improves prover and node operator economics, not application-layer UX.

## The "Just Wait For X" Trap

Founders sometimes say "I'll wait for [Verkle / Hegota / fully decentralized sequencers / etc.] before launching." Almost always wrong.

- The killer app for Ethereum 2024 was: stablecoin payments. Stablecoins existed since 2018.
- The killer app for Ethereum 2025 was: real-world asset tokenization. The legal/operational frameworks took years.
- The killer app for Ethereum 2026 is: agent commerce. The protocol primitives (ERC-8004, x402) are days-old as of this writing.

Each of these had a window: 18-36 months between when the primitive shipped and when the category consolidated. **The current windows are open.**

If you delay 12 months waiting for protocol perfection, your product will compete against incumbents who shipped against the available primitives and now have liquidity, brand, and integrations.

## What a Founder Should Tell Investors

The pitch in one paragraph (May 2026 version):

> "Ethereum just hit the inflection where it works. Pectra solved account UX in May 2025 — users can sign in with email and never see gas. Fusaka in December 2025 made L2 transactions reliably sub-cent, which makes agent micro-payments economically viable. ERC-8004 launched January 2026, giving agents canonical identity and reputation onchain. x402 lets agents pay for APIs with stablecoins via HTTP 402 status codes. The agent economy primitives are 0-12 months old. We are early to a category that will be obvious in 18 months."

Numbers move; check before pitching. Inflection thesis holds.

## Quick-Reference Timeline

```
2024 Mar  Dencun        Blobs ship, L2 cost drops 10x
2024 Jul  ETH ETFs      Spot ETF inflows
2025 May  Pectra        EIP-7702, smart EOAs
2025 Dec  Fusaka        PeerDAS, 60M gas limit, L2 cost drops 10x again
2026 Jan  ERC-8004      Agent identity registry deploys
2026 Q1   x402          HTTP payments live in production
2026 mid  Glamsterdam   ePBS, BAL (network-layer, app-irrelevant)
2026 Q4   Hegota        Binary tree (draft, may slip)
```

Anyone whose mental model of Ethereum was set before December 3, 2025 has the wrong economics. Update.
