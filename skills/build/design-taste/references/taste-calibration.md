# Taste Calibration

Most teams aim too low. They ask "does it work?" instead of "would I be proud of this?" Calibration is the practice of pushing the ambition up until the answer to the second question is yes.

For fundamentals see `references/visual-fundamentals.md`. For benchmarks see `references/benchmark-aesthetics.md`.

## The taste ladder

```
Level 1: Functional        — works, no broken state
Level 2: Conventional      — uses a UI kit, doesn't embarrass
Level 3: Tasteful          — restrained, intentional, on a system
Level 4: Distinctive       — has a recognizable visual voice
Level 5: Iconic            — sets the bar for the category
```

Most dApps stop at Level 2. The marginal jump to Level 3 is where credibility comes from. Level 4 is where products become memorable.

## How to know which level you're at

### Level 1: Functional

- Buttons work, forms submit
- Layout doesn't break at common widths
- No console errors
- User can complete the core action

This is table stakes. Level 1 alone is not enough — many projects ship Level 1 and wonder why no one uses them.

### Level 2: Conventional

- Uses Tailwind defaults or a popular UI kit (shadcn/ui, Chakra, MUI)
- Looks "clean" but has no opinion
- Indistinguishable from 100 other dApps
- No specific brand identity

Most hackathon projects and weekend MVPs land here. Acceptable for testing assumptions; insufficient for retaining users.

**How to know:** show your screenshot to a friend without context. If they say "looks like a typical SaaS / dApp" — you're at Level 2.

### Level 3: Tasteful

- Custom (or carefully tuned) typography scale
- One brand color, used sparingly and consistently
- Spacing rhythm visible — every gap is on a 4 or 8 grid
- Hierarchy is intentional — eye knows where to look
- Errors and loading states are designed, not afterthoughts

Most production apps should aim for at least Level 3. It's reachable without a designer if you follow the fundamentals strictly.

**How to know:** if you remove the logo, can a regular user still tell the screens belong to the same product? Yes → Level 3.

### Level 4: Distinctive

- Has a visual voice — illustration style, motion language, or signature element
- Memorable on second sight — you'd recognize a screenshot
- The product feels like a brand, not just an app

Examples: Linear's hierarchy + motion, Stripe's gradients, Rainbow's warmth, Arc's color personality.

**How to know:** show a screenshot to someone who has used the product once before. Can they identify it without seeing the logo?

### Level 5: Iconic

- Sets the visual standard for an entire category
- Imitated by competitors
- Has a shipped, refined design language

Few products reach this. Don't aim for it on V1 — aim for Level 4, ship, iterate.

## How to push up the ladder

### From Level 1 to 2

Easiest jump. Adopt a UI kit:

- shadcn/ui (radix + Tailwind, copy-paste components)
- Chakra UI
- Mantine

This eliminates the "looks broken" problem.

### From Level 2 to 3 (the most important jump)

This is where most teams fail. They install Tailwind and call it done. The actual work:

1. **Pick a typography scale and stick to it.** Don't use random sizes.
2. **Pick a brand color and don't add others.** Hard rule: no second brand color until V2.
3. **Audit every gap.** Replace any spacing not on the 4 or 8 grid.
4. **Cull the palette.** Reduce non-neutrals to the minimum.
5. **Design empty / loading / error states.** Don't ship default skeletons or `null`.
6. **Replace stock imagery.** No generic crypto coins, no 3D blob heroes.

Each step is a few hours of work. The cumulative effect is enormous.

### From Level 3 to 4

This requires either a designer or significant taste investment from the team.

- Develop a signature visual element (illustration style, gradient, motion)
- Custom typography (paid typeface or carefully tuned free one)
- A/B against benchmark products until indistinguishable in quality
- Care about details: cursor states, focus rings, micro-animations

### From Level 4 to 5

Generally requires sustained design investment over years and a design-led culture. Don't optimize for this at V1.

## Calibration questions

Run these on your current screen:

| Question | If no |
|---|---|
| Could I print this and put it on a wall? | Below Level 3 |
| If I removed the logo, would users know it's our product? | Below Level 4 |
| Does the design make a specific choice (not "default")? | Below Level 3 |
| Do the spacing values fall on a clear grid? | Below Level 3 |
| Is there a visible hierarchy in 2 seconds? | Below Level 3 |
| Are loading and error states designed? | Below Level 3 |
| Are mobile and desktop both polished? | Below Level 3 |

Each "no" pulls you down a level.

## Common rationalizations

| Rationalization | Reality |
|---|---|
| "We're early, design comes later" | Users decide trust in 5 seconds. Late = never. |
| "Our users are technical, they don't care" | They do. They just don't say it; they leave. |
| "We can't afford a designer" | You can afford to read benchmarks. Spending taste is free. |
| "The product is the differentiator" | The product is invisible until design lets users see it. |
| "We'll polish before launch" | Polish is not appended; it's woven in. |
| "Tailwind defaults are good enough" | Defaults make you look like everyone else. Differentiation requires choice. |

## A weekly calibration ritual

Once a week:

1. Open three benchmark products (from `references/benchmark-aesthetics.md`)
2. Open your own product
3. List three things they do that you don't
4. Pick one and ship it this week

Repeat until your "things they do that we don't" list is empty. Then the bar moves up — pick new benchmarks.

## Specific upgrades by surface

### Landing page

- Hero typography is the biggest lever. 95% of dApp heroes use 32-40px H1 with 16px subhead. Try 56-72px H1 with 20-24px subhead and tighter leading.
- Replace any "abstract crypto blob" with either nothing (text-only is fine) or a real product screenshot.
- Cut the headline word count by 50%. "Reimagine the future of decentralized yield" → "Earn 4.2% on stETH. Auto-rebalanced."

### Dashboard

- Numbers in tabular monospace, right-aligned in columns
- Sparklines instead of full charts where possible
- One primary action visible (Deposit / Stake / Vote)
- Empty state designed: "Connect to see your positions" with a clear CTA

### Transaction modal

- The number being acted on is the visual anchor (largest element)
- Gas estimate visible, not hidden behind a wallet popup
- Approval explained inline, not as a button toggle

### Mobile

- Touch targets ≥ 44px
- Form inputs use correct keyboards (`inputmode="decimal"`)
- Sticky bottom CTAs respect safe-area insets

## What to read next

- `references/visual-fundamentals.md` — the four diagnostic axes
- `references/benchmark-aesthetics.md` — products to study
- `frontend-design-guidelines/SKILL.md` — implementation patterns
- `roast-my-product/SKILL.md` — product-level critique
