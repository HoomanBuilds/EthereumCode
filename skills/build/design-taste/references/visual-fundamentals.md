# Visual Fundamentals

Almost every visual problem in a dApp is one of four things: typography, spacing, color, or hierarchy. Diagnose against these in this order before reaching for animations or illustrations.

## Typography

Typography is the single highest-leverage visual fix. Most dApps fail here.

### Picking a typeface

Pick **one** sans-serif for the whole product. A second display face is optional but rarely earns its keep. Avoid:

- System fonts on a brand product (looks lazy)
- Two competing display faces
- Decorative or "crypto-themed" fonts (Web3 sci-fi-mono, blocky pixel fonts)
- Excessive weights — pick 2-3 at most (e.g. 400 / 500 / 700)

Defaults that always work:

- **Inter** (free, Google) — the de facto SaaS workhorse
- **Geist** (free, Vercel) — modern, slightly more character
- **General Sans** (free, Indian Type Foundry) — friendly, distinct
- **Söhne** / **Söhne Mono** (paid) — what Stripe / Vercel use
- **Aeonik** (paid) — what many crypto-native sites use
- **JetBrains Mono** / **Geist Mono** for monospace blocks (addresses, code, numbers)

### Type scale

Use a clear scale, not arbitrary numbers. A common one:

```
Display    44 / 56 / 72 px    700 weight    1.0 line-height
H1         32 px              700           1.1
H2         24 px              600           1.2
H3         20 px              600           1.3
Body       15-16 px           400           1.5-1.65
Small      13-14 px           400           1.45
Caption    11-12 px           500           1.3
```

Use `clamp()` for responsive display sizes:

```css
font-size: clamp(2.25rem, 1.5rem + 3vw, 4.5rem);
```

### Line height

- Display / headlines: tight, 1.0 to 1.15
- Body: loose, 1.5 to 1.65
- Tabular data: tight, 1.2 to 1.3

The most common typography sin is **headline line-height of 1.5** — looks like body text. Tighten it.

### Letter spacing (tracking)

- Display / headlines: -1% to -3% (slightly tighter than default)
- Body: 0
- All caps small text: +5% to +8%
- Tabular numbers: 0, with `font-feature-settings: 'tnum'`

### Numbers in dApps

Numbers are everywhere in crypto. Treat them with care:

- Use `font-variant-numeric: tabular-nums` on any column or row of numbers, or addresses, so they align
- Use a monospace font for full addresses, hashes, code
- Right-align decimal numbers in tables
- See `frontend-design-guidelines/SKILL.md` for code-level patterns

## Spacing

Spacing is the second highest-leverage fix. Cramped UIs feel anxious; spacious UIs feel premium.

### Use a base scale

Pick 4px or 8px as your base. Tailwind defaults to 4px. Common scale:

```
0     — 0
1     — 4 px
2     — 8 px
3     — 12 px
4     — 16 px
6     — 24 px
8     — 32 px
12    — 48 px
16    — 64 px
24    — 96 px
```

Don't pick `13px` because it "looks right." If you can't justify the deviation from the scale, snap to it.

### Where to add space

- **Section padding** — minimum 64px top/bottom on desktop, 32-48px on mobile
- **Card / surface padding** — 24-32px
- **Button padding** — 12-16px vertical, 16-24px horizontal
- **Form field gap** — 16-24px between fields
- **Text block max-width** — 60-75 characters (about 600-720px)

If everything feels cramped, increase the section padding. If it then looks empty, that's correct — the previous version was over-stuffed.

### White space is content

White space is not "wasted." It tells the eye where to look. A single H1 with 200px of breathing room above and below earns its prominence. The same H1 squeezed between elements disappears.

## Color

Restraint is the entire game.

### Brand color

Pick **one** brand color. Just one. It's used:

- On primary CTAs only (1-2 per screen max)
- On focus rings
- On a single accent (badge, highlight, link hover)

That's it. The rest of the UI is neutrals.

### Neutrals

Build a 9-step neutral scale:

```
Background     50    98% lightness   cool or warm tinted
Surface       100    96%
Border        200    92%
Border strong 300    85%
Muted text    500    60%
Body text     700    25%
Heading       900    10%
Black          —     0%
```

Use Tailwind's `slate`, `zinc`, `gray`, or `stone` as a starting point and tune.

### Semantic colors

Reserve color for meaning:

- **Success** (positive) — green, used on confirmations
- **Warning** — amber, used on slippage / risk
- **Danger** — red, used on destructive actions and errors
- **Info** — blue, used for neutral notices

Don't use these for decoration. A green "Connect Wallet" button doesn't mean success — it just means the design has no system.

### Dark mode

If you ship dark mode, do it properly:

- Don't invert (white → black). Invert to a tinted near-black like `#0A0A0B` or `#0E1014`
- Reduce saturation in dark mode by ~10-20%
- Soften brand color slightly so it's not retina-burning
- Test contrast ratios both modes (WCAG AA: 4.5:1 for body)

### Common color sins in dApps

- "Crypto green" everywhere (#00FF88) — looks like a 2020 yield farm
- Purple gradient on every surface — hides lack of structure
- Three accent colors trying to be primary
- Light grey body text on white background (fails contrast)
- Neon-on-black "crypto" themes that fail accessibility and feel dated

## Hierarchy

If the eye doesn't know where to look, hierarchy has failed.

### The 3-tier rule

Every screen has at most three levels of visual prominence:

1. **Primary** — the one thing the user should do (1 element)
2. **Secondary** — supporting context (2-4 elements)
3. **Tertiary** — labels, captions, metadata (everything else)

Most failed dApp UIs have 5 things screaming at the same volume.

### Tools for hierarchy

You have only a few levers:

- **Size** — the H1 is bigger than the H2 is bigger than the body
- **Weight** — bold for emphasis, regular for body
- **Color contrast** — heading is darker than body is darker than muted
- **Position** — top-left and center are higher in hierarchy than bottom-right
- **White space** — isolated elements draw the eye

Use one or two of these per element, not all of them. A bold + colored + uppercase + larger label is shouting.

### Above the fold

On the landing page hero:

- **One** H1 (the headline)
- **One** subhead
- **One** primary CTA, optionally one secondary
- **One** supporting visual (or zero — text-only is fine)

Not three CTAs. Not seven feature bullets. Not a video, an animation, AND a hero image.

### In a dApp

For a transaction or action flow:

- One primary action visible (Connect / Approve / Deposit / Confirm)
- Inputs and read-only data clearly distinguished (different background / border)
- Errors and warnings adjacent to the trigger, not in a top toast 200px away

## Composition checklist

Before shipping a screen, ask:

- [ ] Does the eye land on the right element first?
- [ ] Is there a clear scale relationship between headings and body?
- [ ] Is spacing consistent (only on the scale)?
- [ ] Is color used for meaning, not decoration?
- [ ] Is there generous white space around important elements?
- [ ] Is contrast above 4.5:1 for body, 3:1 for large text?
- [ ] Could you describe the "primary action" in one word?
- [ ] If you blurred the screen, could you still tell what's important?

If any answer is no, fix that before adding new features.

## What to read next

- `references/benchmark-aesthetics.md` — products to study
- `references/taste-calibration.md` — calibrating ambition
- `frontend-design-guidelines/SKILL.md` — implementation
