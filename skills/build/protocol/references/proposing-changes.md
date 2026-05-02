# Proposing Protocol Changes: From Idea to EIP to Fork

Most EIPs never ship. Coordination across 10+ client teams is slow and the cost of bugs is catastrophic. If your founder wants a new precompile, opcode, gas adjustment, or protocol-level feature, this is the workflow — and the realistic odds.

For checking what's already shipping, see `references/checking-fork-status.md`. For application-layer alternatives that don't require protocol changes, see `references/feature-detection.md`.

## First: do you actually need a protocol change?

Most "I need a new precompile" requests can be solved at higher layers. Walk this tree before drafting an EIP:

```
What you want to do
   │
   ▼
1. Can it be done as a normal contract?
   ├─ yes → just deploy it. No EIP needed.
   └─ no ↓
2. Can it be done on an L2 with custom features?
   ├─ yes → Arbitrum Stylus, Optimism's custom precompiles via deployment, ZK rollups → no L1 EIP needed.
   └─ no ↓
3. Does an existing precompile cover it?
   ├─ yes → use it. (BLS via EIP-2537, secp256r1 via EIP-7951, modexp, etc.)
   └─ no ↓
4. Is it cryptographic / mathematical and gas-prohibitive?
   ├─ yes → strong EIP candidate (e.g., new pairing curve)
   └─ no → probably doesn't need to be at L1
```

The vast majority of features founders want are application-layer. Don't draft an EIP for something that can be a smart contract or a wallet/SDK feature.

## EIP types

Different EIP types follow different paths:

| Type | What it covers | Approval bar |
|---|---|---|
| Core | Consensus changes (forks) | Highest — requires client implementations + fork inclusion |
| Networking | p2p protocol changes | High — coordinated client rollout |
| Interface | Client APIs (JSON-RPC, etc.) | Medium — clients agree to support |
| ERC | Application-level standards (tokens, signing, etc.) | Lowest — anyone can adopt |

**ERCs do NOT require fork inclusion.** ERC-20, ERC-721, ERC-4337, ERC-7677 — all shipped without protocol changes. If your "EIP" is really an application standard, it's an ERC, and you can ship it on day 1.

## The Core EIP path

For consensus-layer changes, this is the realistic timeline:

```
Month 0:   Idea + post on EthMagicians
Month 1-2: Draft EIP (status: Draft)
Month 2-6: Iteration with researchers + client teams (status: Review)
Month 6+:  Request inclusion in a fork via ACD calls
               ↓
           CFI (Considered for Inclusion) for fork F
               ↓
           Implementation in 5+ clients on devnet
               ↓
           SFI (Scheduled for Inclusion)
               ↓
           Fork ships
```

Realistic minimum: **18 months from idea to mainnet** for a Core EIP. Most take 2-4 years. EIP-1559 took 4. EIP-4844 took 3.5.

## EIP-1: how to write one

The canonical guide is [EIP-1](https://eips.ethereum.org/EIPS/eip-1). Required sections:

```markdown
---
eip: <number to be assigned>
title: <title>
description: <short description>
author: <list>
discussions-to: <URL of EthMagicians thread>
status: Draft
type: Standards Track
category: Core | Networking | Interface | ERC
created: YYYY-MM-DD
requires: <comma-separated EIP numbers>
---

## Abstract
## Motivation
## Specification
## Rationale
## Backwards Compatibility
## Test Cases (required for Core)
## Reference Implementation (optional but expected for Core)
## Security Considerations
## Copyright
```

Pitfalls when authoring:

- **Specification must be implementable.** Vague specs get rejected. If it's not clear what every byte does, it's not done.
- **Test cases come from you, not the editors.** No tests, no merge.
- **Security considerations are not optional.** Editors will block on a thin section.
- **Backwards compatibility for Core EIPs is hard.** Anything that changes consensus rules breaks history if not carefully designed.

## Steps in order

```bash
# 1. Open an EthMagicians thread first.
# Discuss the idea before writing the EIP. Editors prefer EIPs that arrive with prior discussion.
# https://ethereum-magicians.org

# 2. Fork the EIPs repo
git clone https://github.com/ethereum/EIPs && cd EIPs

# 3. Use a temporary number; editors assign the real one.
cp EIPS/eip-template.md EIPS/eip-XXXX.md
# Edit. Fill every required section. Run the linter:
npm install && npm test

# 4. Open a PR.
# Editors check formatting, completeness, conflicts. They are NOT a technical review.

# 5. After merge as Draft, move to Review:
# - Address feedback in EthMagicians
# - Iterate the spec
# - Add test cases

# 6. Request ACD agenda time:
# https://github.com/ethereum/pm/issues/new
# Title: "[EIP-XXXX] Request for inclusion in <fork>"
# Body: 1-paragraph summary, link to spec, motivation for fork inclusion
```

## What client teams care about

Without client team support, your EIP doesn't ship. They evaluate:

| Concern | What they look for |
|---|---|
| Implementation complexity | Hours of dev work × 5+ clients. A 2-week feature × 5 clients = 10 weeks of senior dev time. |
| State growth | Does it bloat state? Storage rent debate is unresolved; new state-bloating features face scrutiny. |
| MEV impact | Can this be abused for MEV extraction? |
| Network bandwidth | Does it increase block size or propagation cost? |
| Validator / staking impact | Anything that affects consensus has high bar. |
| Existing alternatives | If it can be done at L2, why L1? |

The strongest case: you've already prototyped it in one client (often go-ethereum or reth) before the EIP review.

## Common reasons EIPs die

- **No champion in client teams.** Even good ideas die without someone willing to merge code.
- **Better alternative emerges mid-review.** EIP-1559 outcompeted earlier fee-market proposals. EIP-4844 outcompeted danksharding precursors.
- **Fork scope tightens.** Late in fork prep, scope often narrows. "We'll move it to next fork" often means "indefinitely."
- **Security concerns surface.** A surprising attack vector found late stage = automatic rejection or major redesign.
- **Author abandonment.** EIPs need active stewardship for years. Fall silent for 6 months → Stagnant.

## Faster alternatives

If your founder needs the feature *soon* (months, not years), Core EIP is wrong. Consider:

| Goal | Faster path |
|---|---|
| Custom cryptography | Pre-deploy on Stylus (Arbitrum) or stylus-like VMs |
| Account-level features | Use ERC-4337 or ERC-7702 |
| Gas optimizations | L2 (op-stack, arbitrum, zk-stack) |
| New token semantics | ERC standard (no fork needed) |
| RPC capability | Geth/Reth namespaced RPCs (e.g., `debug_*`, `trace_*`) |
| Privacy primitives | Application-layer ZK (see Noir, Circom) |

## Engaging the ACD process

ACD (All Core Devs) calls happen ~biweekly:

- **ACDE** — Execution layer
- **ACDC** — Consensus layer
- **ACDT** — Testing

To get on an agenda:

1. Open issue in [ethereum/pm](https://github.com/ethereum/pm)
2. Be concrete: which fork, what's the ask, what's blocked
3. Wait — agendas are often booked weeks ahead
4. Watch the call live or read the forkcast summary after

Calls are public; anyone can dial in. Speak only if invited.

## ERCs: a different game

If your "EIP" is an application standard (token, wallet interface, signing scheme):

- Type: `Standards Track`, Category: `ERC`
- No fork inclusion needed
- Ship a reference implementation on mainnet immediately
- Adoption (not editor approval) determines success
- Editors merge ERCs to Final once stable; this is largely cosmetic

Examples that took the ERC path: ERC-20, ERC-721, ERC-1155, ERC-4337 (Account Abstraction), ERC-6492, ERC-7677. These shipped to mainnet without any protocol change.

## Common pitfalls

- **Treating an EIP as approval to start building.** Build first, validate the design, then formalize as EIP.
- **Confusing ERC with Core EIP.** Many "I need an EIP" requests are actually ERC-shaped — no fork needed.
- **Writing a vague specification.** Editors merge by formatting completeness; client teams reject by spec rigor. You need both.
- **No reference implementation.** Strong EIPs come with a working prototype.
- **Ignoring backwards compatibility.** A Core change that breaks existing contracts is dead on arrival.
- **No test cases.** Editors require this; without it, the PR sits.
- **Skipping EthMagicians.** The forum signals community interest. EIPs that arrive cold have lower odds.

## What to read next

- EIP-1: https://eips.ethereum.org/EIPS/eip-1
- EthMagicians: https://ethereum-magicians.org
- ethereum/pm: https://github.com/ethereum/pm
- `references/checking-fork-status.md` — verifying what's actually shipping
- `references/feature-detection.md` — using new features safely once they ship
