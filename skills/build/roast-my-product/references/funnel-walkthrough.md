# Funnel Walkthrough

A roast that doesn't follow the user's actual path produces feedback in the wrong order. Walk the funnel like a skeptical first-time visitor and surface issues at each step. This is the structure for the systematic part of the roast.

For severity, see `references/severity-rubric.md`. For crypto-specific findings, see `references/web3-roast-checklist.md`.

## The funnel for a typical dApp

```
1. Discovery        — How did they hear about it?
2. Landing page     — First 10 seconds. What is this? Should I care?
3. Decision         — Do I want to try it?
4. Connect wallet   — First friction. Many drop here.
5. Onboarding       — What do I do first?
6. Core action      — The one thing the product is for.
7. Confirmation     — Did it work? What now?
8. Return           — Why come back?
```

Walk each step with these questions in this order. Don't jump ahead to step 6 issues without first surfacing step 2 issues.

## Step 1: Discovery

Where did the user come from? What did they expect?

**Things to check:**
- The tweet / post / link that brought them in. Is the promise consistent with the landing page?
- The OG preview when shared. Does it render? Does the headline match the actual page?
- The search snippet (`site:yourapp.com` on Google). What does the description say?
- Referrer copy. If you're advertising, is the ad copy aligned with the landing page?

**Common failures:**
- Tweet promises X, landing page says Y
- OG image is broken or wrong domain
- Page title is the framework default ("Next.js App") because never set

## Step 2: Landing page (first 10 seconds)

The user lands. They give you 5-10 seconds before deciding to leave.

**Things to check:**
- Hero copy: H1 + subhead. Does it tell me what the product is and who it's for?
- The "what" before the "why". The value prop, then the explanation.
- Above-the-fold CTA. Is there one, and is it the right one?
- Speed. LCP under 2.5s on 3G mobile?
- No "let me think about this" required. Should be immediately graspable.

**Common failures:**
- Hero copy is buzzwords with no nouns ("the future of onchain finance")
- Hero copy is jargon for crypto people only ("permissionless bonded liquidity vaults")
- Hero copy is for everyone and therefore for no one
- Page asks me to connect a wallet before I know what the product does
- Slow load — hero image is a 4MB PNG
- Animations that block content
- Multiple competing CTAs

**Calibration question:** Show the H1 + subhead to a non-crypto friend. Ask "what does this product do?" If they can't answer, fail.

## Step 3: Decision

User reads more, scrolls. Are they convinced?

**Things to check:**
- "How it works" section: clear in 30 seconds?
- Trust signals: audit, who's behind it, who else uses it
- Price / cost: what does this cost the user (in fees, in time, in risk)?
- Examples / demos: can I see the product in action without committing?
- FAQ: addresses my obvious questions?

**Common failures:**
- "How it works" is technical mumbo-jumbo
- No social proof or trust signals
- Hidden costs surfaced only at transaction time
- No demo available — must connect wallet to see anything
- Roadmap dated 6 months ago, no updates

## Step 4: Connect wallet

The first action that costs the user something (data, attention).

**Things to check:**
- How many clicks from landing to connected? (Goal: 2 max)
- Wallet selection UI. Are the right wallets present? In the right order?
- Mobile flow: deep link works? In-wallet browser detection works?
- Failure modes: what happens if the wallet rejects?
- Network mismatch handling: does it auto-prompt to switch, or just error?

**Common failures:**
- Connect button does nothing on first click (wallet popup blocked silently)
- Wallet not detected even though it's installed
- WalletConnect QR appears on mobile (useless — needs second device)
- After connect, page just sits there with no feedback
- Wrong-network state shows raw error instead of "Switch to Base" button
- Coinbase Wallet / Phantom missing from default list

**Read also:** `wallets/SKILL.md`, `qa/references/mobile-and-pwa.md`.

## Step 5: Onboarding

User connected. Now what?

**Things to check:**
- Is there an obvious first action?
- Does the product show what to do without a popup tour?
- Empty states helpful or scary?
- Test funds / small amounts allowed? Or do I need to bring real capital first?
- Help / docs link visible from the app?

**Common failures:**
- Empty dashboard with "$0" and no instructions
- Tutorial popup that interrupts the flow
- Required setup steps before any value (sign 3 messages, approve 2 tokens, deposit minimum $X)
- "Coming soon" features that are linked but disabled

## Step 6: Core action

The thing the product is for.

**Things to check:**
- Inputs: clear what to enter, with units, with examples
- Validation: real-time, not after submit
- Quote / estimate: clear before signing
- Approval flow: explained inline, not just a button toggle
- Gas estimate: visible and accurate
- Transaction submission: visible state (pending, in mempool, confirmed)
- Failure handling: clear error, recovery path

**Common failures:**
- Numeric input with no units (is that 1 USDC or 1 USDC * 1e6?)
- Slippage default of 0.5% in a low-liquidity pool (will revert)
- "Approve" button followed by "Deposit" with no explanation of why two steps
- Pending state with no progress, no time estimate, no cancel
- Failure shows raw revert reason ("0x4e487b71...0000000000000000000000000000000000000000000000000000000000000011")
- No way to retry or escape

**Read also:** `frontend-ux/SKILL.md`, `qa/references/error-handling-and-toasts.md`.

## Step 7: Confirmation

User completed an action. Are they sure it worked?

**Things to check:**
- Confirmation toast / message appears
- The UI updates without page refresh
- Link to the explorer transaction
- Clear "what now?" — next action visible
- Email / push notification (if relevant)

**Common failures:**
- Action completes but UI shows old state (no auto-refresh)
- Confirmation that just says "success" with no detail
- No explorer link
- "Next steps" not shown — user doesn't know what's possible from here

## Step 8: Return

Why does the user come back?

**Things to check:**
- Reason to return: yield, notifications, ongoing position to manage, social, news
- Notification mechanism: email, push, browser
- Re-engagement copy: "your position has earned X" — concrete value
- Stickiness: is there a moat that brings them back?

**Common failures:**
- One-off product (claim, swap once, never return)
- No notifications, no re-engagement
- Return value not visible without a wallet connect — too much friction

## How to apply this in a roast

For each step, ask:
1. What's the user trying to do?
2. What did they actually experience?
3. What broke?
4. What's the fix?

Then bucket each finding with `references/severity-rubric.md`.

The roast output should follow the funnel order, not random order. Issues at step 2 always rank above issues at step 6, even if step 6 is more "interesting", because users never reach step 6 if step 2 fails.

## Worked example: a fictional vault dApp

```
STEP 2 — Landing page
  CRITICAL: H1 reads "Yield, reimagined." No mention of stETH, no mention of vault,
  no mention of who this is for. Replace with:
    "Auto-rebalance your stETH across Aave, Compound, and Spark.
     Earn the best yield, automatically. 0.5% fee."

STEP 4 — Connect wallet
  HIGH: WalletConnect QR shown on mobile by default (modal default).
  Filter: detect mobile, show only deep-link-capable wallets.

STEP 6 — Core action
  HIGH: "Approve" → "Deposit" two-step flow with no inline explanation.
  Add: "Approving lets the vault spend your stETH (one-time)."

  MEDIUM: Numbers shown as 1000000000000000000 in the input field default.
  Use formatEther / formatUnits.

STEP 7 — Confirmation
  HIGH: After deposit, balance shows old value for 30+ seconds.
  Subscribe to events or refetch on confirmation.

STEP 8 — Return
  CRITICAL: No notification mechanism. Once deposited, user has no reason to return
  until they think about it themselves. Add weekly email with yield earned.
```

Note that the highest-impact issue (CRITICAL hero copy) is at step 2, and the second CRITICAL is the missing-retention loop at step 8. Both are in the funnel, neither is "in the contract".

## What to read next

- `references/severity-rubric.md` — bucket each finding
- `references/web3-roast-checklist.md` — crypto-specific findings
- `frontend-ux/SKILL.md` — UX patterns
- `qa/SKILL.md` — full QA checklist
