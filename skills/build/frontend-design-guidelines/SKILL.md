---
name: frontend-design-guidelines
description: Use when building or polishing a dApp frontend and need concrete component patterns, copy rules, and layout primitives. Implementation-level guidance — what classes to use, what padding values, what loading states. For taste / visual quality see design-taste; for full UX flows see frontend-ux.
---

# Frontend Design Guidelines

Concrete patterns for shipping a dApp frontend that doesn't feel slapped together. Component-level decisions: button heights, modal anatomy, input affordances, copy rules, loading states. The opinions are pre-made — apply them and ship.

For visual taste / aesthetic quality see `design-taste/SKILL.md`. For end-to-end UX flow design see `frontend-ux/SKILL.md`. For product-level critique see `roast-my-product/SKILL.md`.

## When to use

Trigger this skill when the user:

- "How should I build this button / modal / form?"
- "Pick a CSS framework"
- "What loading state should I use?"
- "Toast vs modal for errors?"
- "What padding for a card?"
- "Copy review my CTA"

Do **not** use this for visual taste critique (`design-taste`). Do **not** use this for choosing a chain or contract architecture (`why`, `protocol`).

## Workflow

1. **Confirm the stack.** Default: Next.js (App Router) + Tailwind + shadcn/ui + wagmi/viem + RainbowKit or ConnectKit. If they're using something else, adapt — don't fight.

2. **Apply layout primitives first.** Read [references/layout-and-grid.md](references/layout-and-grid.md). Most "the page feels off" is a layout problem, not a component problem.

3. **Use component recipes.** Read [references/component-recipes.md](references/component-recipes.md) for buttons, modals, forms, tables, cards. Copy-paste, don't reinvent.

4. **Apply copy rules.** Read [references/copy-rules.md](references/copy-rules.md). UI copy is design — bad copy ruins good components.

5. **Design the loading and error states explicitly.** Default skeletons are not enough. Empty / loading / error / success states all need explicit treatment.

6. **Mobile-first, always.** Test in actual mobile wallets (MetaMask Mobile, Rainbow, Coinbase Wallet). Many dApps ship completely broken in-wallet browsers.

7. **Measure, don't guess.** Use Lighthouse and real-device tests. LCP under 2.5s, CLS under 0.1. Run on 3G mobile.

## Stack defaults

```
Framework        Next.js 14+ (App Router)
Styling          Tailwind v3+
Components       shadcn/ui (copy-paste, no runtime)
Forms            react-hook-form + zod
Wallet           wagmi v2 + viem
Wallet UI        RainbowKit or ConnectKit
Icons            lucide-react
Animation        framer-motion (sparingly)
Charts           Recharts or visx
Tables           @tanstack/react-table
Toasts           sonner
Fonts            Inter or Geist (free)
```

These are defaults, not mandates. Justify deviations.

## Layout primitives

```
Container width      max-w-6xl (1152px) for content; max-w-7xl (1280px) for dashboards
Section padding      py-16 desktop, py-10 mobile
Page padding         px-4 mobile, px-6 desktop
Card padding         p-6 (or p-4 for dense lists)
Stack (vertical)     gap-4 default, gap-6 for sections
Cluster (horizontal) gap-2 for inline, gap-3 for buttons
```

## Component bar

Every component should have:

- **Default state** — the resting state
- **Hover state** — on desktop only, subtle
- **Focus state** — visible focus ring (accessibility)
- **Active / pressed state** — tactile feedback
- **Disabled state** — visibly different, with cursor-not-allowed
- **Loading state** — spinner or skeleton, never empty
- **Error state** — clear message, recoverable

If you ship a component with only a default state, it's incomplete.

## Buttons

```
Primary    bg-brand text-white hover:bg-brand-600     used 1-2 per screen
Secondary  bg-white border text-fg hover:bg-muted    used for non-primary actions
Ghost      bg-transparent hover:bg-muted              used for tertiary
Destructive bg-red-600 text-white                     used for delete / disconnect
```

Sizes:

```
sm    h-8 px-3 text-sm
md    h-10 px-4 text-sm     (default)
lg    h-12 px-6 text-base   (heroes, primary actions)
```

Border radius: pick `rounded-md`, `rounded-lg`, or `rounded-full` — and use it everywhere. Don't mix.

For wallet actions specifically:

- "Connect Wallet" — primary, hero placement, single CTA visible
- "Approve" — primary, with inline explanation of why
- "Deposit" / "Swap" / "Mint" — primary, with gas estimate visible
- "Cancel" — ghost or secondary, never destructive

## Inputs

```
Height          h-10 (md), h-12 (lg, for primary action inputs)
Padding         px-3
Border          border border-input
Focus           focus-visible:ring-2 ring-brand
Placeholder     text-muted-foreground
```

For numeric inputs (amounts):

- `inputmode="decimal"` (mobile keyboard)
- Right-align the number
- Show the token symbol in a fixed-position suffix
- Show "MAX" button for balance shortcuts
- Show "≈ $X" USD equivalent below

## Modals

A modal has:

- Title (one line, no question marks)
- Optional subtitle (one line)
- Body (the actual content)
- Footer (primary CTA right, cancel left or absent)
- Close button (top right, always)
- Backdrop click closes by default; disable for transactions in flight

Sizes:

```
sm    max-w-md       confirmations
md    max-w-lg       most flows
lg    max-w-2xl      complex flows (multi-step)
```

Don't use modals for things that should be pages (long forms). Don't use them for trivial confirmations on non-destructive actions.

## Toasts

Sonner defaults are good. Use:

- **Success** — green, 3s auto-dismiss, e.g. "Deposited 100 USDC"
- **Error** — red, persistent until dismissed, with action button if recoverable
- **Loading** — neutral, replaced by success/error on resolve
- **Info** — neutral, 4s auto-dismiss

Don't:

- Stack 4 toasts at once (queue them)
- Auto-dismiss errors (user might miss)
- Use toasts for things that should be modals (multi-step flows)

## Tables

For position lists, transaction history, leaderboards:

- Sticky header
- Tabular numbers (`font-variant-numeric: tabular-nums`)
- Right-align numbers, left-align text
- Sortable columns marked with caret
- Loading: 5-10 skeleton rows, not a spinner
- Empty: "No positions yet" + CTA to deposit
- Mobile: convert to cards (each row becomes a card), don't squish

## States that aren't an afterthought

Loading, empty, error, and success states are 80% of the trust your dApp earns.

- **Loading:** show a skeleton with the same shape as the loaded content. Don't use a generic centered spinner.
- **Empty:** explain what should be here and how to get it. "No positions. Deposit to start earning."
- **Error:** translate the error. "Slippage too high — try increasing tolerance" not "execution reverted: 0x...".
- **Success:** confirm the action and offer a next step. "Deposit confirmed. View on explorer | Add another."

## Accessibility floor

- Color contrast 4.5:1 for body, 3:1 for large text (WCAG AA)
- Focus visible on every interactive element
- Form labels (not just placeholders)
- Image alt text
- Keyboard navigation works
- Don't lock zoom on mobile (`viewport user-scalable=yes`)
- Test with VoiceOver / TalkBack at least once

## Performance floor

- LCP < 2.5s on 3G mobile
- CLS < 0.1
- Images lazy-loaded
- Hero image preloaded (if there is one)
- Fonts: `font-display: swap`, preload critical weights only
- No 4MB hero PNG
- Code-split routes; defer wallet provider until interaction
- Cache static assets aggressively

## Crypto-specific UI rules

- Never show wei. Always format with `formatEther` / `formatUnits`.
- Always show the token symbol next to a number.
- Truncate addresses as `0x1234…abcd`, click-to-copy on hover.
- Show chain badge when multi-chain.
- Show network mismatch as an inline banner with a "Switch to X" button — don't error.
- Distinguish "approve" from "confirm" in copy.
- Show gas in user's currency, with chain context.
- Failed transactions still cost gas — warn before signing.

## What NOT to do

- Don't use Material Design in a consumer crypto product
- Don't bundle 8 wallet options in a small dropdown
- Don't auto-prompt wallet connection on page load
- Don't use raw web3-modal v1 styling — it screams 2021
- Don't ship without a 404 page
- Don't ship without favicon and OG image
- Don't ship animated SVGs that block content

## Resources

- [references/layout-and-grid.md](references/layout-and-grid.md) — layout primitives, container widths
- [references/component-recipes.md](references/component-recipes.md) — buttons, forms, modals, tables
- [references/copy-rules.md](references/copy-rules.md) — UI copy patterns

## What to read next

- `design-taste/SKILL.md` — visual quality bar
- `frontend-ux/SKILL.md` — UX flow design
- `wallets/SKILL.md` — wallet connection patterns
- `roast-my-product/SKILL.md` — critique what you shipped
