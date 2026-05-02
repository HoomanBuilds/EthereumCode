---
name: create-pitch-deck
description: Use when building a pitch deck for a crypto project — fundraising, hackathon submission, partner intro, or community update. Covers slide-by-slide structure, what investors and judges actually want to see, and the crypto-specific traps that kill decks. For grant applications see apply-grant; for hackathons see submit-to-hackathon.
---

# Create a Pitch Deck

## What You Probably Got Wrong

**"The deck is the product."** The deck is a tool for getting a meeting, a yes, or a wire transfer. Your product is the product. The deck's job is to get the audience to look at the product.

**"More slides = more thorough."** More slides = less attention. VCs skim. Judges have 3 minutes. Every slide costs you their focus. 10–12 slides max. If it doesn't advance the story, cut it.

**"Tokenomics is the lead."** Leading with tokenomics signals "fundraising disguised as product." Move it to the appendix or don't include it until asked.

For grant narratives see `apply-grant/SKILL.md`. For hackathon submissions see `submit-to-hackathon/SKILL.md`. For idea validation before pitching see `validate-idea/SKILL.md`.

## When to use

Trigger this skill when the user says:

- "Help me build a pitch deck"
- "Investor deck"
- "Demo day deck"
- "Review my deck"
- "What slides do I need?"

Do **not** use this skill if:

- The user has no idea yet (use `validate-idea`)
- The user wants a written one-pager (different format)
- The user is writing a grant application (use `apply-grant`)

## Workflow

1. **Identify the audience.** A VC deck is different from a hackathon deck is different from a partner deck. Read [references/audience-types.md](references/audience-types.md) before choosing structure.

2. **Identify the goal.** What's the next step you want? Funding? Meeting? Integration? The deck is built backwards from the call-to-action.

3. **Use the canonical structure.** Read [references/slide-structure.md](references/slide-structure.md) for the 10–12 slides and what goes on each.

4. **Avoid crypto-deck traps.** Read [references/crypto-deck-traps.md](references/crypto-deck-traps.md) — token-first, governance theater, "TVL by Q4," vague tech claims, multi-chain theater.

5. **One idea per slide.** Two takeaways = split it. Zero takeaways = cut it.

6. **Show the demo, don't describe it.** A screenshot of the product is worth more than three slides of explanation.

7. **Iterate against rejection.** A deck improves only by being shown to people who don't have to be polite.

## The standard deck (10–12 slides)

```
1.  Cover               — Product name, one-line tagline, presenter
2.  Problem             — Who hurts, how much, today
3.  Solution            — What you built, in plain language
4.  Demo / product      — Screenshot + 1-2 line caption
5.  How it works        — Just enough mechanism (avoid jargon walls)
6.  Why now / why crypto — What changed; why this requires onchain
7.  Traction            — Real numbers; real users
8.  Market              — Specific, defensible TAM with a path
9.  Business model      — How you make money (or how the protocol does)
10. Competition         — Who else; how you differ
11. Team                — Why you, specifically, will win
12. Ask                 — How much, what for, what's the next milestone
```

This works for fundraising decks. Hackathon decks adapt to 6–8 slides. Partner decks to 5–7.

## Problem slide

Specific. Concrete. With a named person.

Bad: "DeFi is fragmented and complex."

Good: "Sarah holds $50K in stETH. To earn the best yield, she has to manually rebalance across Aave, Compound, and Spark — every month, watching gas fees and slippage. Today she earns 3.1%; if she rebalanced perfectly, she'd earn 4.7%. She doesn't have time."

The good version names the user, the action, the cost, and the gap. The bad version says nothing.

## Solution slide

What you built, in one screenshot and one sentence.

Bad: "We've built a decentralized, permissionless, capital-efficient protocol."

Good: "AutoVault auto-rebalances stETH across Aave, Compound, and Spark every 12 hours. Users deposit once. We charge 0.5% of yield."

## Traction slide

Specific numbers, dated, sourced:

```
6,000 users since launch (Apr 2026)
$8.4M deposited (live, on-chain — link)
$420K in fees collected
+18% MoM user growth in last 3 months
```

Don't use Discord/Twitter follower counts. Don't show TVL without fees. Don't cite "10,000 wallets" without retention.

## Market slide

Bad: "TAM: $1T DeFi market by 2030."

Good: "Today there are ~50K wallets holding >$10K of stETH on mainnet (source: dune). At 0.5% fee on the rebalanced portion, our SAM is $25M ARR. Penetration of 10% in 18 months = $2.5M ARR."

Even if rough, the good version shows you counted.

## Ask slide

Specific. Funded by milestones:

```
Raising $1.5M Seed
Use of funds:
  60% — engineering (3 hires)
  20% — security audits
  15% — go-to-market
  5%  — operations

This funds 18 months runway, target metrics:
  $50M TVL · 10K active users · $1M ARR
```

Don't skip the ask ("we'll talk later" = no). Don't ask without a milestone.

## Visual standards

- One typeface (Inter or Geist), 2–3 weights
- One brand color
- Clean grid; generous spacing
- Charts: real, dated, sourced
- No stock crypto imagery (gold ETH, hooded hacker, blockchain blob)
- One screenshot per product slide, not five

Use Figma, Pitch.com, or Slidev. Avoid PowerPoint defaults.

## Common deck failures

| Failure | Fix |
|---|---|
| 30 slides | Cut to 12. Move detail to appendix. |
| No demo screenshot | Take one. The demo IS the deck. |
| Lead with tokenomics | Move to appendix or cut until v2. |
| Generic problem ("DeFi is hard") | Named user + quantified pain. |
| TAM = "all of crypto" | Specific count with a path. |
| Buzzword soup | Re-write so a non-crypto founder explains it back. |
| "We'll be on every chain" | Pick one. Show deep integration. |

## Length and timing

- 10–12 slides for a 15–30 min meeting
- 6–8 slides for a 5–10 min hackathon pitch
- 3–5 slides for a partner intro

Don't pad. A short, dense deck respects the reader.

## What to read next

- `submit-to-hackathon/SKILL.md` — hackathon submission packaging
- `apply-grant/SKILL.md` — grant proposal structure
- `validate-idea/SKILL.md` — make sure the idea is real before pitching
