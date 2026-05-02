# Checking Fork Status: A Verification Playbook

The protocol moves. AI agents and humans alike confidently cite features that were deprioritized 18 months ago. This file is the workflow for verifying — *with primary sources* — what's actually shipping, when, and to which clients.

For lifecycle terminology (CFI/SFI/DFI), see `SKILL.md`. For proposing changes, see `references/proposing-changes.md`. For application-level feature detection, see `references/feature-detection.md`.

## The fundamental rule

**Old answers go stale, primary sources don't.** Anything older than the last All Core Devs (ACD) call may be wrong. ACD calls happen every ~2 weeks; treat any blog post, talk, or tutorial older than 4 weeks as a starting hypothesis, not a fact.

## The verification workflow

```
Question: "Is X live / coming?"
   │
   ▼
1. forkcast.org — search for feature or EIP number
   ├─ SFI for fork F           → it's actually shipping in F (verify devnet status)
   ├─ CFI for fork F           → being evaluated, not confirmed
   ├─ DFI for fork F           → declined; don't expect it
   ├─ no fork relationship     → not scheduled
   └─ not found                → may not exist or may have been renamed
   │
   ▼
2. EIPs repo — open EIPS/eip-XXXX.md
   ├─ status: Final + Core type → spec done; check fork inclusion separately
   ├─ status: Last Call         → spec frozen, final objections
   ├─ status: Review/Draft      → spec not done
   ├─ status: Stagnant (>6mo)   → probably abandoned
   └─ status: Withdrawn         → dead
   │
   ▼
3. eth-rnd-archive (Discord mirror) — search last 30 days for keyword
   ├─ active discussion        → live concern, read it for nuance
   ├─ no recent mentions       → likely on the back burner
   └─ implementation issues raised → schedule may slip
   │
   ▼
4. Devnet status (forkcast matrix) — only meaningful if SFI
   ├─ all clients green        → on track
   ├─ 1-2 clients red          → at risk; named devnets blocked
   └─ many clients red         → schedule will slip
```

Stop at step 1 if forkcast gives a definitive answer. Steps 2-4 are only needed when forkcast is ambiguous.

## Recent and upcoming forks

These dates change. Treat them as "current best guess as of when this file was written."

| Fork | Date / Target | Notable EIPs |
|---|---|---|
| Shapella | 2023-04-12 | EIP-4895 (withdrawals) |
| Dencun | 2024-03-13 | EIP-4844 (blobs) |
| Pectra | 2025-05-07 | EIP-7702, EIP-7251, EIP-2537 |
| Fusaka | 2025-12-03 | EIP-7594 (PeerDAS), EIP-7892 |
| Glamsterdam | ~Q3-Q4 2026 (target) | EIP-7732 (ePBS), EIP-7928 (BAL) |

For the latest scope of any fork, check the meta-EIP (e.g., EIP-7600 for Pectra) on the EIPs repo, then cross-check against forkcast.

## Reading a forkcast page

For a given EIP, forkcast shows:

- **Inclusion stage**: Proposed → CFI → SFI (or DFI for declined)
- **Devnet implementations**: matrix of (devnet × client) showing pass/fail
- **Recent discussions**: extracted from ACD call summaries with dates
- **Spec links**: the EIP file, plus any execution-specs or consensus-specs PRs

If devnet has 5 clients but only 2 are passing, the feature is not on track even if it's marked SFI.

## When forkcast disagrees with a blog post

forkcast wins. Roadmap diagrams and conference talks are aspirational. Even Vitalik's posts are not commitments — they reflect his thinking *at the time of writing*. The ACD process is the authoritative source for what ships.

## Verifying client implementation

If you want to know whether a feature *actually works* on a client:

```bash
# Check client release notes
gh release list --repo paradigmxyz/reth
gh release list --repo ethereum/go-ethereum
gh release list --repo NethermindEth/nethermind
gh release list --repo hyperledger/besu
gh release list --repo erigontech/erigon

# Check execution-specs for spec finality
gh pr list --repo ethereum/execution-specs --search "EIP-XXXX"
```

Search release notes for the EIP number. If the EIP is in a published release, it's deployed somewhere (testnet, mainnet, or just shipped to nightly).

## "Why was X deprioritized?"

When something was widely expected but didn't ship, the answer is usually in the call summaries. Pattern:

1. Open forkcast.org, navigate to recent ACDE/ACDC calls
2. Search summaries for the EIP number
3. Look for phrases like "moved to next fork", "more research needed", "client concerns"

Examples (so the workflow makes sense):

| Feature | Status as of 2026 | Why deprioritized |
|---|---|---|
| Verkle trees | Replaced | Binary trees + ZK better fit; quantum concerns about Verkle |
| EOF (full) | Partially shipped | Repeatedly de-scoped; only parts in Pectra |
| Sharding (64 shards) | Cancelled | Replaced by rollup-centric roadmap; danksharding instead |

## When to use eth-rnd-archive vs ethresear.ch vs EthMagicians

| Source | What it is | When to use |
|---|---|---|
| eth-rnd-archive | Public mirror of Eth R&D Discord | "What are client teams saying right now about X?" |
| EthMagicians | Long-form forum | "Why was X designed this way?", historical rationale |
| ethresear.ch | Research blog | Early-stage ideas; if X is *only* here, it's not "planned" |

## Common verification mistakes

- **Trusting "Vitalik said"**: even Vitalik's posts are aspirational unless they reference a specific fork scope.
- **Reading old EIP drafts**: drafts can be substantially modified during review. Always check the latest commit.
- **Conflating EIP-Final with shipped**: a Final Core EIP still needs fork inclusion. Final means *spec is frozen*, not *deployed*.
- **Ignoring devnet matrices**: an SFI EIP can still slip if devnet implementations stall.
- **Asking only one source**: forkcast is the best primary, but cross-checking the EIPs repo and recent client releases catches edge cases.

## Hedge language for unverified facts

When you can't fully verify, say so:

- "As of [date], forkcast shows EIP-XXXX is SFI for Pectra" (concrete + dated)
- "EIP-XXXX is CFI for Glamsterdam — being evaluated, not confirmed"
- "I don't see EIP-XXXX in the current Pectra scope; check forkcast for latest"
- "This EIP shows Stagnant in the EIPs repo — may not be progressing"

Avoid:

- "X is coming soon"
- "X is on the roadmap"
- "X will ship in [year]"

## What to read next

- `references/proposing-changes.md` — the EIP authoring process
- `references/feature-detection.md` — runtime feature detection in your dApp
- forkcast.org — the canonical fork-status tracker
- ethereum/EIPs repo — canonical EIP specs
- ethereum/pm repo — ACD call agendas and notes
