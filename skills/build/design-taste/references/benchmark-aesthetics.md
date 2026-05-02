# Benchmark Aesthetics

Taste develops by studying products that nailed it. This file is a curated list with what to look at and what to learn from each. When the user asks "make this look better," reference these — never "make it look like a SaaS."

For fundamentals see `references/visual-fundamentals.md`. For ambition setting see `references/taste-calibration.md`.

## How to study a benchmark

Don't just look at the homepage. For each:

1. **Take screenshots** of homepage, sign-up, dashboard, settings
2. **Identify the type system** — count fonts, weights, sizes
3. **Identify the color system** — count colors, find the brand color
4. **Note the spacing rhythm** — is everything on a 4 or 8 grid?
5. **Note the hierarchy** — where does your eye land first?
6. **Note one thing they do that you don't** — and copy it

## SaaS benchmarks

### Linear (linear.app)

What to learn: hierarchy, motion, restraint.

- **Type:** Inter, 2-3 weights
- **Color:** purple brand + cool grays. Almost monochrome.
- **Spacing:** generous, especially in the hero
- **Hierarchy:** the H1 is huge and tight; everything else is calm
- **Motion:** subtle parallax, text fade-ins, no looping animations

The takeaway: you can have a beautiful product with one font, two colors, and no illustrations. Linear proves it.

### Vercel (vercel.com)

What to learn: type, dark mode, technical credibility.

- **Type:** Geist (their own typeface) — clean, distinct
- **Color:** mostly black, white, and a single brand color per product
- **Spacing:** wide, deliberate
- **Hierarchy:** uses Geist Mono as a counterpoint to Geist Sans for code/technical accents

The takeaway: a custom typeface signals craft. If you can't afford that, use Geist — it's free.

### Stripe (stripe.com)

What to learn: gradients done right, density, illustration as utility.

- **Type:** Söhne — premium, neutral
- **Color:** blue brand + a meticulous gradient system
- **Density:** more information per screen than most, but never feels cluttered — because hierarchy is rigorous
- **Illustration:** custom isometric scenes that explain product concepts

The takeaway: gradients aren't bad — undisciplined gradients are bad. Stripe's gradients always serve a purpose.

### Notion (notion.so)

What to learn: warm minimalism.

- **Type:** Inter
- **Color:** off-white / cream backgrounds, soft accent colors
- **Spacing:** comfortable, not cramped
- **Voice:** friendly without being childish

The takeaway: minimalism doesn't have to be cold. Warm neutrals (cream, taupe) feel inviting where pure white feels clinical.

### Arc (arc.net)

What to learn: motion, color used as identity.

- **Type:** custom display + body
- **Color:** rainbow used intentionally — Arc is "the browser with personality"
- **Motion:** delightful, never gratuitous

The takeaway: if your brand wants character, design has to deliver it consistently — not just one logo + bland UI.

## Crypto-native benchmarks

### Rainbow (rainbow.me)

What to learn: warm crypto, character without being childish.

- **Type:** custom display (SF Pro variant)
- **Color:** the rainbow is the brand, but used sparingly inside the app
- **Spacing:** mobile-first, generous touch targets
- **Voice:** friendly, no jargon

The takeaway: a wallet doesn't have to feel like a Bloomberg terminal. Rainbow proves crypto can be warm.

### Uniswap (app.uniswap.org, post-2023 redesign)

What to learn: pink as a brand color, restraint in a complex product.

- **Type:** Basel — clean, geometric
- **Color:** Uniswap pink + neutrals. Pink only on primary CTAs and brand elements.
- **Hierarchy:** the swap card is the entire screen — nothing fights it

The takeaway: even a complex product (multi-route swaps, portfolios, NFTs) can feel calm if hierarchy is enforced.

### Coinbase Wallet / Coinbase Smart Wallet (wallet.coinbase.com)

What to learn: enterprise-grade trust signals.

- **Type:** sans-serif, conservative
- **Color:** Coinbase blue, minimal accents
- **Voice:** trustworthy, regulated, not crypto-bro

The takeaway: if your audience values trust over edge, dial down the crypto aesthetics.

### Farcaster / Warpcast (warpcast.com)

What to learn: small UI, large product surface.

- **Type:** Inter
- **Color:** purple accent + neutrals
- **Density:** social-feed density, but typography keeps it readable

### Across (across.to)

What to learn: bridge UX, trust through clarity.

- **Type:** Inter / clean sans
- **Color:** restrained — no rainbow tokens
- **Density:** the bridge form is the focus; everything else is decor

### Lido (lido.fi) — post-redesign

What to learn: institutional crypto.

- **Type:** Inter
- **Color:** soft blue + neutrals
- **Voice:** mature, financial, not edgy

### Para (para.to / wallet.paraswap.io style)

What to learn: tasteful onboarding.

- Generally clean, on-brand, well-typed.

## What NOT to copy

Counterexamples — products with high traffic that nonetheless have weak design:

- Dashboard-style yield aggregators with neon-green-everything
- Most NFT marketplaces (visual chaos, four fonts, gradient soup)
- Hackathon-deployed dApps with default Tailwind everything
- Sites that use stock 3D crypto coin renders
- Sites with a "matrix code" background

If your dApp looks like one of those, you've taken the path of least resistance.

## How to actually use a benchmark

The wrong way:
> "Make my app look like Linear."

The right way:
> "Linear's hierarchy on the homepage works because:
> - H1 is 60px / 700 / -2% letter spacing / line-height 1.05
> - Subhead is 20px / 400 / line-height 1.4 / muted color
> - There's 96px of vertical space between hero and the next section
> - The CTA is a single solid pill button in the brand color
>
> Adapt this for our hero: replace your current 32px / 600 H1 with 56px / 700, increase line-height-tight, double the section padding."

Specificity is the entire game. "Like Linear" is meaningless; the type scale, spacing, and rhythm are what's copyable.

## A taste-building exercise

1. Pick three benchmark products from above.
2. Take a screenshot of each homepage hero.
3. For each, write down:
   - The H1 font, weight, size, and line-height (estimate)
   - The exact brand color (use a color picker)
   - The CTA shape (radius, padding, height)
   - The vertical space between hero and the next section
4. Compare to your own product.
5. Pick the one most-different attribute and align yours.

Repeating this five times will build more taste than reading any article.

## What to read next

- `references/visual-fundamentals.md` — type, spacing, color, hierarchy
- `references/taste-calibration.md` — calibrating ambition
- `frontend-design-guidelines/SKILL.md` — implementation
