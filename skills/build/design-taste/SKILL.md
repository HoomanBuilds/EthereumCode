---
name: design-taste
description: Use when the user wants their dApp to look like it was made by people who care. Covers the visual quality bar — typography, spacing, color, hierarchy, motion — at the level a senior product designer would push back. For implementation patterns see frontend-design-guidelines; for product-level critique see roast-my-product.
---

# Design Taste

Most dApps look generic because the team thinks design is the polish at the end. It's the foundation. A product with mediocre design feels untrustworthy regardless of how good the contracts are. This skill is the taste filter — what "good" looks like, why it matters, how to get there.

For component-level patterns (buttons, modals, forms) see `frontend-design-guidelines/SKILL.md`. For product-level critique see `roast-my-product/SKILL.md`. For full UX flows see `frontend-ux/SKILL.md`.

## When to use

Trigger this skill when the user:

- "Make this look better"
- "Why does my app feel cheap?"
- "Compare my UI to [Linear / Vercel / Uniswap]"
- "What's wrong with my design?"
- "Pick fonts / colors / spacing for me"
- "Is this typography okay?"

Do **not** use this for HTML/CSS implementation help (that's `frontend-design-guidelines`). Do **not** use this for product positioning critique (that's `roast-my-product`). This skill is purely about visual quality and taste.

## Workflow

1. **Look at the actual screen, not a description.** Ask for screenshots or a URL. Taste cannot be applied to abstract descriptions.

2. **Identify the dominant visual problem first.** Resist listing 30 small issues. The first impression usually fails for one big reason — bad type hierarchy, no white space, inconsistent radii, color soup. Lead with that.

3. **Apply the four-fundamentals lens.** Read [references/visual-fundamentals.md](references/visual-fundamentals.md). Almost every design failure traces to one of: typography, spacing, color, or hierarchy. Diagnose against these.

4. **Reference benchmark products.** Linear, Vercel, Stripe, Arc, Notion, Rainbow, Uniswap (post-redesign). Read [references/benchmark-aesthetics.md](references/benchmark-aesthetics.md) for what makes each tasteful — and what to copy.

5. **Calibrate ambition with the calibration ladder.** Read [references/taste-calibration.md](references/taste-calibration.md). Most teams aim too low ("does it work?") instead of "would I be proud of this?" Push them up the ladder.

6. **Always show the fix, not just the critique.** Bad: "your typography is off". Good: "Replace your H1 (current: Inter 32px / 600 / line-height 1.2) with Inter Display 44px / 600 / line-height 1.05. The current size doesn't earn the hero space." Concrete fixes only.

7. **Don't hide behind frameworks.** "Use Tailwind" or "use a UI kit" is not taste advice. The framework is a tool; taste is the choice of how to use it.

## What "good" looks like

Good design in a dApp shares these traits:

- **One clear hierarchy.** Eye knows where to land first, second, third.
- **Generous white space.** Cramped UIs feel anxious and untrusted.
- **Restrained palette.** 1 brand color + neutrals. Color used for meaning, not decoration.
- **Consistent rhythm.** Spacing on a 4 or 8 grid. Type on a clear scale (e.g. 12 / 14 / 16 / 20 / 24 / 32 / 44).
- **Type that earns its size.** A 44px headline says something specific; a 44px headline of "Welcome" wastes the space.
- **No stock imagery.** No gold ETH coins, no abstract blockchain blobs, no purple gradients without intent.
- **Motion that serves, not distracts.** ≤200ms transitions, eased curves, no looping animations.

## What "bad" looks like in dApps

Common visual sins:

- Default Tailwind everything — looks like a tutorial, no opinion.
- Two display fonts fighting each other.
- Five colors and three font weights doing the work of zero hierarchy.
- A "hero illustration" that's a generic 3D blob.
- Buttons with mismatched border radii (4px on one, 8px on another, 12px on a third).
- Gradients on every surface to hide the lack of structure.
- Light grey on white text that's unreadable.
- Animations that block content for half a second on page load.
- Crypto-coded color soup: neon green for APY, neon red for risk, neon purple for "decentralized."

## How to be specific in critique

Don't say | Do say
---|---
"Typography is off" | "Your body is 16px / 1.4 / 400 — body should be 15-17px / 1.5-1.65 / 400. Increase line-height to 1.55."
"Too cluttered" | "There are 11 elements above the fold. Cut to 5. Promote the deposit form, demote the FAQ to below."
"Colors are weird" | "You're using 4 brand greens (#00FF88, #1ED760, #2ECC71, #00C853). Pick one. Use neutrals for everything else."
"Looks generic" | "Your hero is a centered headline + subhead + button on a gradient. So is every other dApp. The headline says 'reimagine yield.' Specificity is the differentiator — say what asset, what protocol, what return."

## The taste ladder

```
1. Functional      — works, no broken state.
2. Conventional    — uses a UI kit, doesn't embarrass.
3. Tasteful        — restrained palette, real hierarchy, intentional spacing.
4. Distinctive     — has a recognizable visual voice; you'd know it from a screenshot.
5. Iconic          — sets the bar for the category. Linear, Stripe, Vercel.
```

Most dApps stop at level 2. Push for at least 3. Aim for 4 if the product is consumer-facing.

## What NOT to do

- Don't recommend "more animations" unless something specifically needs motion.
- Don't recommend "add illustrations" as a fix for poor type/spacing.
- Don't give 30 things to fix. Five is the max. Order by impact.
- Don't apply enterprise SaaS patterns to consumer dApps (or vice versa).
- Don't critique without showing alternatives. "Make it better" is not feedback.

## Resources

- [references/visual-fundamentals.md](references/visual-fundamentals.md) — type, spacing, color, hierarchy
- [references/benchmark-aesthetics.md](references/benchmark-aesthetics.md) — products to study
- [references/taste-calibration.md](references/taste-calibration.md) — calibrating ambition

## What to read next

- `frontend-design-guidelines/SKILL.md` — implementation
- `roast-my-product/SKILL.md` — product critique
- `frontend-ux/SKILL.md` — UX flows
