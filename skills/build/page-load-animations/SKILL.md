---
name: page-load-animations
description: Use when the user wants polished page-load animations and transitions for a dApp without making the site feel slow or gimmicky. Covers entrance animations, scroll-driven motion, page transitions, and the performance budget that keeps animations from killing LCP. For implementation primitives see frontend-design-guidelines; for visual taste see design-taste.
---

# Page Load Animations

Animation is a tool, not a goal. A dApp with no animation feels stiff; a dApp with too much feels gimmicky and slow. This skill is the cookbook for tasteful, performance-respecting motion — when to use it, what to use, how to keep it from breaking LCP.

For implementation patterns see `frontend-design-guidelines/SKILL.md`. For visual taste see `design-taste/SKILL.md`. For UX flow design see `frontend-ux/SKILL.md`.

## When to use

Trigger this skill when the user:

- "How do I add page-load animations?"
- "My site feels static / dead"
- "What's a good way to fade in the hero?"
- "Should I use Framer Motion?"
- "How do I do scroll animations without killing performance?"
- "Page transition between routes?"

Do **not** use this for component-level micro-interactions (those are part of `frontend-design-guidelines`). Do **not** add animation as a polish-pass on a product that has bigger UX problems — fix those first via `roast-my-product`.

## Workflow

1. **Default to less.** Most production dApps use almost no animation. Linear, Stripe, Vercel use ≤200ms transitions and a few subtle fade-ins. Aim for that bar before adding more.

2. **Pick a single motion library.** Read [references/library-choices.md](references/library-choices.md). Default: Framer Motion (now `motion`). Don't mix Framer with GSAP with Lottie — pick one.

3. **Set the motion budget.** Read [references/motion-budget.md](references/motion-budget.md). Animations cost LCP, CPU, and trust. Stay under the budget.

4. **Use the right pattern for the right job.** Hero entrance, scroll reveal, page transition, micro-interaction — each has a canonical pattern. Read [references/animation-patterns.md](references/animation-patterns.md).

5. **Respect `prefers-reduced-motion`.** Always. Some users have vestibular conditions; ignoring this is an accessibility failure, not a preference.

6. **Test on a real mobile device.** Animations that look smooth on a desktop M1 may stutter on a 3-year-old Android. Profile with Chrome DevTools Performance panel.

7. **Cap initial-load animations.** Hero animation should not delay LCP. If LCP is gated on an animation finishing, you've broken the page.

## What "good" looks like

- **Fade-in on hero:** 300-500ms ease-out, opacity + 8-16px y-translate, fired on mount.
- **Stagger:** 50-80ms between sibling elements. Not 200ms — that feels slow.
- **Scroll reveal:** trigger at 20-30% viewport intersection, 300ms ease-out, no parallax unless intentional.
- **Page transitions:** if you have them, keep under 200ms. Don't make the user wait to navigate.
- **Loading state:** skeleton with subtle shimmer (1.5s loop, low contrast). No spinning balls.
- **Hover:** ≤150ms, opacity or scale (1.02 max), restrained.

## What "bad" looks like

- **Hero blocks LCP:** big animation must complete before user can interact.
- **All-at-once stagger:** 30 elements fade in, eyes don't know where to look.
- **Long durations:** 800ms+ feels lethargic.
- **Bouncy easing on serious products:** spring physics belong on consumer apps, not on a financial dApp.
- **Looping animations on hero:** infinite ambient motion = battery drain + distraction.
- **Parallax on every section:** seasickness.
- **Auto-playing video hero with no controls.**
- **Animations that fire on every scroll (not "once").**

## The motion budget (rule of thumb)

For a typical landing page:

```
Total motion-frame budget       ≤ 1.0s of screen time per page load
Hero entrance                   300-500ms
Scroll-revealed sections        300ms each (3-5 sections × 300ms = 1.5s but staggered as user scrolls)
Page transitions                ≤ 200ms
Continuous animations           none on critical path
```

If you exceed this, the page feels like a slideshow.

## Critical: don't block LCP

LCP (Largest Contentful Paint) measures when the largest visible element is rendered. If your hero image / heading is hidden behind an animation that fires after JS hydration, your LCP gets pushed to 1-2s+ depending on device.

Mitigations:

- Render content visible by default in HTML; animate from there
- Use CSS animations for first paint (no JS dependency)
- Defer Framer Motion until after first paint
- Set `initial={false}` for above-the-fold content already in DOM

```tsx
<motion.h1 initial={false} animate={{ opacity: 1 }}>
```

## Reduced motion

Always wrap animations in a check:

```tsx
import { useReducedMotion } from 'framer-motion';

function Hero() {
  const reduce = useReducedMotion();
  return (
    <motion.h1
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      ...
    </motion.h1>
  );
}
```

Or globally, with a CSS media query:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## When NOT to animate

- Critical path (LCP, FCP)
- Inputs being typed in
- Anything that distracts from a transaction in flight
- Error messages — they should appear instantly
- Number changes during a live update — pulse, don't animate
- Modals on serious flows (deposit confirmations) — appear, don't dance

## A minimal default setup

If the user has zero animation and asks "what should I add?":

1. **Hero fade-up on mount** (400ms ease-out, opacity + 12px y)
2. **Scroll reveal on each section** (300ms, 20% threshold, once)
3. **Page transition** (only if multi-route landing) — 150ms fade
4. **Hover on cards** (150ms shadow + 1px y-translate)
5. **Tab/route changes** (100ms opacity)

That's it. Anything else needs a specific reason.

## Resources

- [references/library-choices.md](references/library-choices.md) — Framer Motion, GSAP, View Transitions, CSS
- [references/animation-patterns.md](references/animation-patterns.md) — recipes for common patterns
- [references/motion-budget.md](references/motion-budget.md) — performance budget and accessibility

## What to read next

- `frontend-design-guidelines/SKILL.md` — components and primitives
- `design-taste/SKILL.md` — visual taste
- `roast-my-product/SKILL.md` — when to fix UX before adding polish
