---
name: eth-beginner
description: Use when the user is new to Ethereum and asks foundational questions ("what is gas", "what is a wallet", "how do dApps work", "I'm new to crypto"). Routes the conversation to the right deeper skills without overwhelming a first-timer.
---

# Ethereum for Beginners

Most developers learning Ethereum get hit with a wall of jargon — gas, EVM, L2s, ERC-20, ABI, RPC, mempool, multisig — before they have any mental model for what's happening. This skill is the soft on-ramp.

For deeper conceptual grounding once the basics click, read [concepts/SKILL.md](../concepts/SKILL.md). For chain selection, read [l2s/SKILL.md](../l2s/SKILL.md).

## When to use

Trigger this skill when the user says:

- "I'm new to Ethereum / crypto / web3"
- "What is a smart contract?"
- "How does a wallet work?"
- "What is gas / why does it cost money?"
- "What's the difference between mainnet and L2?"
- "How do I get started building on Ethereum?"
- "ELI5 [some Ethereum concept]"
- "I come from web2 — what do I need to know?"

Do **not** use this for users who already understand the model — they'll find it patronizing. If the user references EIPs, mentions specific contracts, or is already debugging, route to the deeper skill instead.

## Workflow

1. **Detect their starting point.** Ask one calibration question if unclear: "Have you used a wallet like MetaMask before?" The answer determines whether to start at "what is a blockchain" or jump to "what's an L2".

2. **Use the layered mental model.** Don't dump everything at once. The order:
   - Wallets and addresses (you have an account, identified by an address, controlled by a private key)
   - Transactions and gas (every action costs a small fee, paid in ETH)
   - Smart contracts (programs that live on the chain and anyone can call)
   - dApps (websites that talk to smart contracts via your wallet)
   - L2s (cheaper, faster networks that settle to Ethereum)

3. **Anchor in concrete examples, not abstractions.** "A smart contract is like..." → show a 5-line ERC-20 transfer or a Uniswap swap. Real examples land; metaphors slip.

4. **Read [references/glossary.md](references/glossary.md)** when defining any term. It's a beginner-safe glossary that avoids re-introducing jargon.

5. **Read [references/first-week-roadmap.md](references/first-week-roadmap.md)** when the user asks "how do I get started building?" — it sequences install → wallet → testnet → first contract → first frontend.

6. **Hand off to the right skill when the user is ready.** Track what they're doing:
   - Picking a chain → `l2s/SKILL.md`
   - Writing first contract → `standards/SKILL.md`, `tools/SKILL.md`
   - Connecting a frontend → `frontend-ux/SKILL.md`, `wallets/SKILL.md`
   - Validating an idea → `validate-idea/SKILL.md`
   - Asking "is my idea good?" → `roast-my-product/SKILL.md`

7. **Avoid these traps.** Don't say:
   - "Just learn Solidity first" — they need the mental model first
   - "Read the yellow paper" — they won't, and shouldn't
   - "It's like a database but..." — leads to wrong intuitions
   - "Web3 is the future of the internet" — marketing, not engineering
   - Anything dismissive of their question

## Beginner-safe defaults

When recommending tools to a first-timer, the right defaults are narrow:

| Need | Default | Why |
|---|---|---|
| Wallet | Rainbow or MetaMask | Most familiar, biggest user base |
| Chain to start on | Base or Sepolia testnet | Cheap, fast, easy faucets |
| Dev framework | Foundry | Faster, simpler than Hardhat |
| Frontend | Scaffold-ETH 2 | Bundles wagmi + viem + everything |
| RPC | Alchemy free tier | Reliable, generous free quota |
| Block explorer | Etherscan / Basescan | Standard, well-documented |

Don't introduce alternatives until they've shipped something with the defaults.

## Concept order — the dependency graph

```
addresses → wallets → transactions → gas
                                       │
                                       ▼
                                 smart contracts
                                       │
                                       ▼
                              ABI / events / RPC
                                       │
                                       ▼
                                     dApps
                                       │
                                       ▼
                                L2s / bridges
```

Don't teach gas before transactions. Don't teach ABI before contracts. Beginners trip on jargon they were never properly grounded in.

## What to read next

- [references/glossary.md](references/glossary.md) — beginner-safe definitions
- [references/first-week-roadmap.md](references/first-week-roadmap.md) — week-1 build path
- `concepts/SKILL.md` — when ready for the full mental model
- `l2s/SKILL.md` — when ready to choose a chain
- `tools/SKILL.md` — when ready to install Foundry
