---
name: ethereum-code
description: Take a founder from raw idea to deployed Ethereum dApp. Grounded in ethskills.
version: 0.1.0
---

# ethereum-code

AI-native framework for shipping on Ethereum and its L2s (Base, Arbitrum, Optimism, zkSync, mainnet). Five engines: **Idea → Build → Ship → Audit → Raise**.

Every agent invocation is grounded in a **bundled** snapshot of the [ethskills](https://github.com/ethskills/ethskills) knowledge base at `./skills/`. Contract addresses, gas costs, security patterns, L2 selection, and QA checklists are loaded from disk and injected into every Claude call — no network fetch, no URL references, no stale model memory.

## when to invoke

Invoke `eth` when the task is any of:

- Generating a fundable Ethereum-native idea
- Scaffolding smart contracts + Foundry tests + Scaffold-ETH 2 frontend
- Selecting the right L2 for a given use case
- Running a security audit (Slither + ethskills audit checklist)
- Pre-ship QA and deployment with verification
- Writing an investor-grade seed deck and matching to eth-native funds

Do not invoke for: non-EVM chains, backend-only apps, or projects that don't touch Ethereum.

## commands

```
eth new         guided: idea → build → ship
eth idea        generate a fundable ethereum idea
eth build       contracts + frontend from a brief
eth audit       security pass before you ship
eth ship        deploy + verify + launch pack
eth raise       deck + investor map for your round
eth doctor      verify your toolchain
```

## grounding contract

Every agent call loads the relevant bundled skills (`./skills/<slug>.md`) into system context before the task prompt. The routing table lives at `cli/skills/registry.ts`:

| task              | skills                                                          |
| ----------------- | --------------------------------------------------------------- |
| architect         | ship, concepts, l2s, standards, why                             |
| build.contracts   | security, tools, addresses, standards, gas, testing, building-blocks |
| build.frontend    | frontend-ux, frontend-playbook, wallets, orchestration          |
| audit             | audit, security                                                 |
| ship              | qa, ship, l2s                                                   |
| idea              | why, concepts, l2s                                              |

Three hard rules enforced at runtime:

1. **No hallucinated addresses** — addresses come from the bundled `skills/addresses.md` only.
2. **Live gas checks** — `cast base-fee` before citing any cost.
3. **No secrets in diffs** — every file write passes a secret scanner before disk.

## stack

- Node 20+ TypeScript CLI, published as `npm i -g ethereum-code`, binary `eth`.
- Foundry for contracts (Forge, Cast, Anvil). No Hardhat.
- Scaffold-ETH 2 for frontends (Next.js + wagmi + viem).
- Claude (Opus 4.6 for architecture, Sonnet for iteration) via `@anthropic-ai/sdk`.
- Noir for zero-knowledge templates.

## install

```bash
curl -fsSL https://ethereum-code/setup.sh | bash
eth doctor
eth new
```
