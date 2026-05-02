---
name: validate-idea
description: Use when the user has a dApp idea and is asking whether to build it, how to test it, or which version to ship first. Surfaces the riskiest assumption and forces a falsifiable test before any code is written.
---

# Validate the Idea

Most failed crypto projects didn't fail because the contracts were buggy. They failed because nobody wanted what got built. This skill exists to prevent that. Before you write Solidity, you need to know: who's the user, what's their alternative, and what's the cheapest experiment that could prove this is real.

For deeper market thesis work, see [why/SKILL.md](../why/SKILL.md). For the conceptual model, see [concepts/SKILL.md](../concepts/SKILL.md). For building once validated, see [ship/SKILL.md](../../ship/ship/SKILL.md). To get a brutal critique of an existing prototype, see [roast-my-product/SKILL.md](../../build/roast-my-product/SKILL.md).

## When to use

Trigger this skill when the user says:

- "I have an idea for..."
- "Should I build X?"
- "Is this a good idea?"
- "I want to ship..."
- "What should my MVP be?"
- "How do I know if anyone wants this?"
- "Should I bother building this?"

Do **not** use this for users who have already validated and are now executing — they need `ship/SKILL.md`, not more questioning.

## Workflow

1. **Refuse to engage with the contract design until the idea is validated.** A common failure mode: the user describes a feature, you start designing the contract, the conversation becomes "how to build" instead of "should we build". Pull the conversation back to the user and the alternative.

2. **Ask the four questions** (from [references/four-questions.md](references/four-questions.md)):
   - Who, exactly, is the user? (Job title or wallet behavior)
   - What are they doing today instead?
   - Why would they switch?
   - What's the cheapest test that could prove this?

3. **Identify the riskiest assumption.** Every idea has one assumption that, if false, the whole thing fails. Find it. Write it down. Force the user to acknowledge it.

4. **Read [references/cheap-experiments.md](references/cheap-experiments.md)** before recommending an MVP. Most "MVPs" are too big. The right test is often a landing page, a Discord poll, or a manual concierge service before a single contract.

5. **Read [references/web3-specific-traps.md](references/web3-specific-traps.md)** to filter out the common crypto-flavored failure modes (token-as-product, "decentralization" as a feature, governance theater, etc.).

6. **Sanity-check chain choice with the idea.** Many ideas don't need a token. Many don't need a chain. If the only justification for being on chain is "we want a token," push back hard.

7. **Convert validation outcomes into a one-page brief** that the next phase (`build`) can act on. Required fields:
   - User (specific)
   - Alternative they use today
   - Why this is better (in their words, ideally)
   - Riskiest assumption
   - First experiment + success criterion
   - Chain (with rationale, not "Base because it's cheap")

## The validation hierarchy

Use the cheapest test that could falsify the idea. In order:

```
1. Talk to 5 potential users.       (1 day, free)
2. Landing page + waitlist.         (3 days, $20)
3. Manual concierge service.        (1 week, your time)
4. No-code prototype + paid ad.     (1 week, $200-500)
5. Single-contract MVP on testnet.  (2 weeks, your time)
6. Mainnet MVP.                     (3+ weeks, +audit cost)
```

Don't skip steps. A landing page that nobody signs up for is a clearer "no" than a $50K MVP that 12 friends use.

## What "validated" actually means

Validation isn't "people said it sounds cool". It's a behavior commitment with cost:

- **Weak signal:** retweets, "I'd use this", upvotes, sign-ups with no email confirmation
- **Medium signal:** waitlist signups with real email, joining a Discord and posting, completing a survey
- **Strong signal:** paying real money, depositing testnet funds in a fork, taking the time to integrate
- **Confirmed:** repeated use after initial novelty

A healthy MVP launch has at least medium signal before contracts ship. Strong signal before mainnet.

## Web3 ideas that don't need to be onchain

Push back on these — usually a regular SaaS works fine:

| Idea | Better as |
|---|---|
| "A platform for X" with no value transfer | Regular web app |
| "A community for crypto people who like Y" | Discord + a static site |
| "A directory of Z" | Notion or a spreadsheet, then a static site |
| "Like Facebook but on chain" | Don't |
| "A DAO for [thing that doesn't need decentralized funds]" | A multisig + Snapshot, or just a Slack |
| "A token that represents [vague concept]" | Almost always: don't |

Onchain pays for itself when value transfer is the core action — payments, ownership, proofs, settlement, governance over real funds. Otherwise the chain is overhead.

## Ideas that should be onchain

These have a clear onchain reason:

- Programmable money (lending, swaps, vaults, payments)
- Provable ownership (NFTs, attestations, credentials)
- Censorship resistance (publishing, donations, identity in hostile jurisdictions)
- Composable building blocks (DeFi primitives that other contracts compose)
- Global, permissionless settlement (cross-border value transfer)
- Trust-minimized coordination (DAOs over real treasuries)

If the idea fits one of these, it earns the chain.

## Red flags in idea pitches

Watch for these phrases — they almost always signal trouble:

- "We'll add the token later" → the token is the product, just say so
- "Once we have users, we'll figure out monetization" → you don't have a business model
- "We'll bootstrap liquidity with rewards" → you're paying mercenaries
- "Web3 [existing web2 thing]" → the existing thing is probably better
- "We're a community-first project" → no one is building this
- "We'll be the [X] for [Y]" → unclear positioning, no real differentiation
- "It'll be like [Aave / Uniswap / etc.] but for [niche]" → without proof of demand in that niche, this is a bigger version of nothing

## What to read next

- [references/four-questions.md](references/four-questions.md) — the validation interview script
- [references/cheap-experiments.md](references/cheap-experiments.md) — what to test before building
- [references/web3-specific-traps.md](references/web3-specific-traps.md) — crypto-flavored failure modes
- `why/SKILL.md` — market thesis grounding
- `roast-my-product/SKILL.md` — once a prototype exists, get it brutally critiqued
- `ship/SKILL.md` — once validated, execute
