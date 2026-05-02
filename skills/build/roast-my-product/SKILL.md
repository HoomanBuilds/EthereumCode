---
name: roast-my-product
description: Use when the user wants brutal, no-flattery critique of a dApp, landing page, contract, or pitch. Defaults to harsh-but-actionable feedback. Surfaces what's wrong with positioning, UX, copy, and architecture in the order an actual user would notice.
---

# Roast My Product

The user is asking for the truth, not encouragement. Give it to them. Be specific. Be harsh where harsh is correct. Always be actionable — a roast that doesn't tell them what to fix is just venting.

For idea-stage validation, see [validate-idea/SKILL.md](../../idea/validate-idea/SKILL.md). For design-quality fixes, see [design-taste/SKILL.md](../design-taste/SKILL.md). For frontend implementation guidance, see [frontend-design-guidelines/SKILL.md](../frontend-design-guidelines/SKILL.md).

## When to use

Trigger this skill when the user says:

- "Roast my [product / landing page / contract / app]"
- "What's wrong with this?"
- "Be brutal"
- "Give me real feedback"
- "Why isn't this working?"
- "Tell me what sucks about this"

Do **not** soften the critique. The user explicitly asked for brutality. Soft feedback is a failure of this skill.

Do **not** use this when the user just wants a code review or a polish pass — that's `code-reviewer` or `design-taste`. This skill is product-level critique.

## Workflow

1. **Read everything they shared, completely, before reacting.** Don't roast based on a glance. Visit the URL. Read the contract. Walk the user flow. If you can't access the product, ask for screenshots and copy.

2. **Identify the one most damaging issue first.** Resist the temptation to list 20 small things. Find the one issue that, if fixed, unlocks the most. Lead with it. Make it the centerpiece.

3. **Score by severity.** Use [references/severity-rubric.md](references/severity-rubric.md) for the framework. Bucket issues into:
   - **CRITICAL** — kills adoption (broken core flow, scary copy, wrong promise)
   - **HIGH** — drops users in the funnel (bad onboarding, slow load, unclear CTA)
   - **MEDIUM** — degrades trust (ugly typography, broken layout, dead links)
   - **LOW** — polish (microcopy, animations, color accents)

4. **Walk the funnel like a real user.** Start at: how did they hear about this? What did they expect? What does the landing page promise? Does the product deliver that promise? Where do they drop off? Use [references/funnel-walkthrough.md](references/funnel-walkthrough.md) to structure this.

5. **Apply the crypto-specific filter.** Read [references/web3-roast-checklist.md](references/web3-roast-checklist.md) for the dApp-specific failure modes (wallet connect friction, gas surprises, opaque transactions, "what does this contract do?" anxiety, missing recovery paths).

6. **Be specific about each finding.** Bad: "The copy is unclear." Good: "Your hero says 'reimagine onchain finance' — I have no idea what your product does after reading that. Replace with 'Auto-rebalance your stETH across Aave, Compound, and Spark. 0.5% of yield.'"

7. **Always pair every roast with a fix.** No abstract feedback. If you say "this is bad", say what specifically to do instead, with a concrete alternative.

8. **End with the prioritization stack.** Not 50 things. 5 things, ordered by impact. The user can't fix everything; tell them what to fix first.

## How to be harsh without being useless

Harsh = specific, ruthlessly honest, no padding.
Useless = mean, vague, dismissive, unhelpful.

| Harsh + useful | Harsh + useless |
|---|---|
| "Your hero copy uses 5 buzzwords and 0 nouns. After 10 seconds I don't know what your product does. Test: paste your H1 to a non-crypto friend and ask what the product is." | "Your copy sucks." |
| "The deposit button says 'Approve' on first click and 'Deposit' on second. Users will abandon at the first click — they don't know why approval is needed. Inline-explain: 'Approving lets the vault spend your USDC. One-time per token.'" | "The UX is bad." |
| "Your contract uses `tx.origin` for auth on line 47. That's a known antipattern. Use `msg.sender` or AccessControl." | "Your contract has security issues." |

Harshness without actionability is just rudeness. Every roast must end with "do this instead".

## Output format

Use this structure:

```
THE ONE THING
-------------
<the single most damaging issue, called out clearly>

THE STACK (priority order)
--------------------------
1. CRITICAL: <issue>
   Why it matters: <user-level impact>
   Fix: <concrete action>

2. HIGH: <issue>
   Why it matters: ...
   Fix: ...

[3-5 more, descending severity]

WHAT'S ACTUALLY GOOD
--------------------
<2-3 things working — be specific, not generic praise>

NEXT STEPS
----------
This week: <one thing>
This month: <one thing>
Defer: <one thing they were going to do that should wait>
```

The "what's actually good" section isn't to soften the roast — it's to keep them from regressing on things that are working.

## Common things to roast

**Landing pages:**
- Vague hero copy ("the future of X")
- No clear "what is this" in 5 seconds
- Generic crypto stock imagery
- Missing the actual product demo
- Footer with broken links
- "Connect wallet" before any value shown

**Contracts:**
- One contract trying to do everything (kitchen sink)
- Custom ERC-20 instead of OZ
- Owner-controlled functions with no timelock
- Pause function with no sunset
- Magic numbers (no constants, no comments)
- Reentrancy vulnerabilities (see `security/SKILL.md`)
- No events on state changes

**dApps:**
- Wallet connect flow that takes 3+ clicks
- Numbers shown in wei (not formatted)
- No loading states; user thinks the app froze
- Errors shown as raw RPC errors ("execution reverted: 0x4e487b71...")
- Gas costs hidden until signing
- No way to recover from a failed transaction
- Mobile broken or untested

**Pitches:**
- "Like X but for Y" with no specific axis
- Token mechanics before user value
- TAM = "DeFi users" or "crypto"
- No competition slide ("there are no competitors") = either wrong or no market
- Vanity metrics (Discord size, Twitter followers, "TVL")

## When NOT to roast

- The product is genuinely good. Say so. Don't manufacture problems.
- The user is in a fragile state and has shared explicitly that they want validation, not critique. Re-read the request.
- You don't have enough information. Ask for more before roasting.
- The user is asking about a small implementation detail. Use the right skill (security, frontend-ux, etc.) instead of a product-level roast.

## What to read next

- [references/severity-rubric.md](references/severity-rubric.md) — how to bucket findings
- [references/funnel-walkthrough.md](references/funnel-walkthrough.md) — walking the user journey
- [references/web3-roast-checklist.md](references/web3-roast-checklist.md) — crypto-specific failure modes
- `design-taste/SKILL.md` — visual / aesthetic critique
- `frontend-design-guidelines/SKILL.md` — implementation patterns
