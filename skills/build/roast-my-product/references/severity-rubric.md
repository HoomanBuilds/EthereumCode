# Severity Rubric

Not every issue deserves the same volume. A roast that screams about every typo trains the user to ignore everything. This rubric is for bucketing issues so the user knows which ones to act on first.

For the funnel walk, see `references/funnel-walkthrough.md`. For crypto-specific issues, see `references/web3-roast-checklist.md`.

## The four buckets

```
CRITICAL  — Issue kills adoption or breaks trust. Fix this week.
HIGH      — Issue causes meaningful drop-off in funnel. Fix this month.
MEDIUM    — Issue degrades quality and trust. Fix this quarter.
LOW       — Polish. Fix when other things are stable.
```

Always over-call severity rather than under-call. A misplaced footer link won't kill the product, but an incomprehensible hero will. Bucket accordingly.

## CRITICAL — kills adoption

These issues mean the product fundamentally doesn't work for its stated user. They override everything else.

**Examples:**
- Hero copy that doesn't communicate what the product does in 10 seconds
- Core flow is broken (deposit fails silently, swap doesn't return tokens, mint doesn't mint)
- Wrong promise (landing page says A, product does B)
- Trust-destroying issue (visible bug in production, scary error, wallet drained in test, contract not verified)
- Unsafe contract pattern in production (tx.origin, reentrancy, unprotected admin)
- Mobile completely broken
- Wallet connection fails in major wallet (MetaMask, Rainbow, Coinbase)
- Missing or wrong tokenomics if a token is core to the pitch

**Why CRITICAL not just HIGH:** Users don't get past these. No matter what else is good, the product is dead-on-arrival until these are fixed.

## HIGH — meaningful funnel drop-off

These don't kill adoption but cause significant user loss between steps. Most products fail at the HIGH tier.

**Examples:**
- Onboarding requires 5+ clicks before showing value
- Approval-then-action flow with no inline explanation
- Numbers in wei or unformatted on display
- Loading states missing; user thinks app froze
- Errors shown as raw RPC strings
- Gas estimate not shown before transaction
- "Connect wallet" demanded before user knows what the product is
- Slow page load on 3G mobile (>5s LCP)
- No way to recover from failed transaction
- Confusing copy on action buttons ("Authorize" / "Approve" / "Permit" — user can't tell which to click)
- Account abstraction features without fallback for EOA users
- Bad chain switcher UX (silent fail, wrong chain shown)

**Why HIGH not CRITICAL:** Determined users will push through. But you'll lose 30-70% of casual users at each one. Stack two HIGHs and your funnel is single-digit conversion.

## MEDIUM — degrades trust and quality

The product works, but it feels amateur or careless. Users complete actions but lose trust over time.

**Examples:**
- Inconsistent typography (different fonts, sizes, weights with no system)
- Visible alignment issues, broken layouts at common widths
- Stock crypto imagery (golden ETH coin, generic blockchain visuals)
- Untranslated developer error messages
- Dead links, especially in footer
- "Coming soon" sections everywhere
- Outdated content (price, news, token addresses)
- Inconsistent terminology (sometimes "Vault", sometimes "Pool", same thing)
- Color contrast failures (text on background that's hard to read)
- Animations that delay action
- Missing favicon or broken OG image
- Etherscan links to unverified contracts
- Roadmap with dates that have passed

**Why MEDIUM not HIGH:** Users don't drop off here, but they downgrade their trust. Compound enough MEDIUMs and the product feels like a toy.

## LOW — polish

These are real issues but small in impact. Fix when bigger things are stable.

**Examples:**
- Slightly off-brand color
- Subtle copy improvements
- Animation timing
- Microcopy on tooltips
- Favicon resolution
- Slight margin/padding inconsistencies
- Hover states missing on minor elements
- Timing of toasts could be tighter

**Why LOW:** Visible but not impactful. Don't waste a roast on these unless everything above is solved.

## Calibration tests

For each issue, ask:

| Question | If yes → bucket |
|---|---|
| Would a typical user fail to complete the core action because of this? | CRITICAL |
| Will this make ≥30% of users drop off between two steps? | HIGH |
| Will this make a user think the product is unprofessional? | MEDIUM |
| Is this a small thing only the product team would notice? | LOW |

Don't soften — pick the higher bucket when in doubt. The point of the roast is to surface issues.

## Common miscalibrations

- **Over-weighting visual polish over functional issues.** A crooked button is LOW; a broken core flow is CRITICAL. Beginners often roast UI before UX.
- **Treating all security findings as CRITICAL.** A typo in a comment is LOW even though it's "in the contract". Real CRITICAL: exploitable bug, missing auth, reentrancy on a function that moves funds.
- **Ranking pet peeves as HIGH.** "I personally don't like flat design" is not a roast finding. Your job is to find what's blocking the user, not what offends your taste.
- **Missing the meta issue.** If the product has 30 LOW findings and 0 CRITICALs, the META issue might be: "no clear product positioning" or "too much polish on the wrong thing".

## How to write each finding

Required fields:

```
SEVERITY: <CRITICAL | HIGH | MEDIUM | LOW>
ISSUE: <one sentence; specific>
EVIDENCE: <where you saw it; line number, URL, screenshot description>
WHY IT MATTERS: <user-level impact, not "best practice violated">
FIX: <concrete action; ideally with copy or code>
EFFORT: <small | medium | large>
```

Without "evidence" you sound like you skimmed. Without "why it matters" you sound dogmatic. Without "fix" you sound complaining. All three required.

## Severity vs impact vs effort

The action priority is `impact / effort`. A CRITICAL with large effort might be deferred behind a HIGH with small effort. Map onto a quick prioritization:

```
HIGH IMPACT, LOW EFFORT      → DO TODAY
HIGH IMPACT, HIGH EFFORT     → PLAN THIS WEEK
LOW IMPACT, LOW EFFORT       → DO WHEN BORED
LOW IMPACT, HIGH EFFORT      → DON'T
```

The roast output should make this priority clear.

## What to read next

- `references/funnel-walkthrough.md` — how to walk the user journey systematically
- `references/web3-roast-checklist.md` — crypto-specific findings
- `design-taste/SKILL.md` — visual quality bar
