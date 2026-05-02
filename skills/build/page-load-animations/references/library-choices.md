# Animation Library Choices

The decision is rarely "should I animate?" — it's "with what?" Picking wrong adds 50KB to your bundle and locks you into patterns you outgrow. This file is the comparison.

For animation patterns see `references/animation-patterns.md`. For performance budgets see `references/motion-budget.md`.

## The default: Framer Motion (now `motion`)

Best for: most React-based dApps.

```bash
npm install motion
```

```tsx
import { motion } from 'motion/react';

<motion.h1
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
>
  Hero text
</motion.h1>
```

Pros:
- Declarative React API
- Excellent docs and ecosystem
- Reduced-motion support built in (`useReducedMotion`)
- `AnimatePresence` for exit animations
- Layout animations (FLIP) for free
- 30-50KB gzipped (variable, tree-shakeable)

Cons:
- Bundle cost
- Slight overkill for static landing pages

When to use: any React product where animation is part of the design vocabulary, especially for component state transitions.

## CSS animations / transitions

Best for: simple fade-ins, button hovers, anything that doesn't need orchestration.

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.hero-title {
  animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

Pros:
- Zero JS bundle
- Hardware-accelerated by default
- Works without hydration (best for LCP)

Cons:
- No easy orchestration / sequencing
- No reduced-motion handling without explicit media query
- No exit animations

When to use: above-the-fold content, button hover/focus states, anything you'd otherwise do with `transition: all`.

## View Transitions API

Best for: page-to-page transitions, single-element morphs.

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.2s;
}
```

```ts
if ('startViewTransition' in document) {
  document.startViewTransition(() => {
    updateDOM();
  });
}
```

Pros:
- Native browser, zero bundle
- Automatic morph / crossfade
- Excellent for SPA route transitions

Cons:
- Browser support: Chromium-based as of 2025; Firefox/Safari catching up
- Newer API, fewer examples

When to use: dApp with route transitions, especially on Next.js 14+ App Router. Use as progressive enhancement.

## GSAP

Best for: complex orchestrated timelines, scroll-driven storytelling.

```ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

gsap.timeline({
  scrollTrigger: { trigger: '.section', start: 'top 80%' },
})
  .from('.title', { y: 40, opacity: 0, duration: 0.6 })
  .from('.body', { y: 20, opacity: 0, duration: 0.4 }, '-=0.2');
```

Pros:
- The most powerful timeline tool in JS
- ScrollTrigger is industry-standard for scroll-driven animation
- Can do things other libraries can't (path morphing, complex sequencing)

Cons:
- Heavier bundle (~30-40KB core, more with plugins)
- Imperative API, less React-idiomatic
- Some plugins are Club-GreenSock-only (paid)

When to use: marketing sites with scroll-driven storytelling. Overkill for typical dApps.

## Lottie

Best for: pre-made vector animations exported from After Effects.

```tsx
import Lottie from 'lottie-react';
import animation from './data.json';

<Lottie animationData={animation} loop />
```

Pros:
- Designer hands you a JSON, you render it
- Vector — sharp at any size
- Lightweight per-animation (~10-50KB JSON)

Cons:
- ~50KB runtime in addition to data
- Harder to interrupt / control programmatically
- Easy to over-use

When to use: you have an actual designer making vector animations. Avoid if you're choosing animations from Lottiefiles to fill space.

## Auto-Animate

Best for: list reorder / add / remove without writing animation code.

```tsx
import { useAutoAnimate } from '@formkit/auto-animate/react';

function List() {
  const [parent] = useAutoAnimate();
  return <ul ref={parent}>{items.map(...)}</ul>;
}
```

Pros:
- Zero-config list animations
- Tiny (~3KB)

Cons:
- Limited to add/remove/reorder
- Not a full animation library

When to use: you want list animations and don't want to think about it.

## What to pick

| Use case | Library |
|---|---|
| dApp UI with stateful animations (modals, accordions) | Framer Motion |
| Pure landing page with fade-ins | CSS animations |
| Page-to-page transitions in Next.js | View Transitions API + Framer for components |
| Scroll-driven marketing site | GSAP + ScrollTrigger |
| Designer-made vector animations | Lottie |
| List add/remove/reorder | Auto-Animate or Framer Motion |
| Micro-interactions on buttons | CSS transitions |

## What NOT to pick

- **react-spring** — was great in 2020, less actively maintained vs Framer Motion. Consider only if you've used it before.
- **anime.js** — fine but smaller community in 2025; Framer Motion does most of what it does for React.
- **Three.js for 2D animation** — massive overkill; use only for 3D.
- **Custom requestAnimationFrame loops** — only if you have a very specific need; you'll reinvent libraries badly.

## Mixing libraries

Don't.

If you have Framer Motion, use it for everything component-level. Adding GSAP for one fancy section doubles your bundle. Adding Lottie for one icon adds 50KB.

Pick one library, exhaust its features, swap only if the constraint is real.

## Bundle size benchmarks

Approximate gzipped sizes:

```
CSS / @keyframes              0 KB
View Transitions API          0 KB (native)
Auto-Animate                  3 KB
Framer Motion (motion)       30-50 KB (tree-shakeable)
GSAP core                    30 KB
GSAP + ScrollTrigger         50 KB
Lottie + animation data      60 KB+
```

For a dApp where every KB matters (mobile wallet in-app browsers), CSS + View Transitions is the lowest-cost path.

## What to read next

- `references/animation-patterns.md` — recipes for common patterns
- `references/motion-budget.md` — performance and accessibility
- `frontend-design-guidelines/SKILL.md` — implementation
