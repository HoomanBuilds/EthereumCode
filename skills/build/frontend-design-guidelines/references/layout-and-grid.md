# Layout and Grid

Most "the page feels off" complaints are layout problems. This file is the layout cookbook — container widths, section padding, column structures, and the rhythm that ties them together.

For component-level patterns see `references/component-recipes.md`. For copy see `references/copy-rules.md`.

## The base unit

Pick one: 4px or 8px. Tailwind's default is 4px. Stick to it.

```
1   = 4px       12  = 48px
2   = 8px       16  = 64px
3   = 12px      20  = 80px
4   = 16px      24  = 96px
6   = 24px      32  = 128px
8   = 32px      40  = 160px
```

Never use values not on this scale unless you can justify why. "It looked right at 13px" is not a justification.

## Container widths

```
max-w-2xl    672px      — text-only content (blogs, docs)
max-w-4xl    896px      — narrow product pages
max-w-6xl    1152px     — standard marketing pages    ← default
max-w-7xl    1280px     — dashboards with sidebars
max-w-screen-2xl 1536px — full-width landing heroes
```

Don't go wider than `max-w-7xl` for content. Wider feels uncomfortable; eyes have to track too far.

For full-bleed sections (background color spans viewport), the *content* still respects the container:

```tsx
<section className="bg-muted">
  <div className="mx-auto max-w-6xl px-4 py-16">
    {/* content */}
  </div>
</section>
```

## Page padding

```
Mobile      px-4    (16px)
Tablet      px-6    (24px)
Desktop     px-8    (32px)
```

Combined:

```tsx
<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
```

## Section padding (vertical)

The single biggest visual lever after typography. Most failed dApp landing pages are too cramped vertically.

```
Mobile      py-12   (48px)   — minimum
Standard    py-16   (64px)
Desktop     py-20   (80px)
Hero / showcase  py-24 to py-32  (96-128px)
```

Sections that touch each other (no background change) can use `py-12`. Sections with a color/background change should use `py-16` or more — the background change is doing visual work that needs space.

## Vertical rhythm

Spacing inside a section follows a repeating pattern:

```
Section padding (above)    py-16
Section eyebrow            text-sm tracking-wide uppercase    mb-3
Section heading            text-3xl / 4xl                     mb-4
Section subhead            text-lg                            mb-12
Content
Section padding (below)    py-16
```

The space between heading and content (`mb-12`) should be larger than between eyebrow and heading (`mb-3`). This creates a clear "title block → body" separation.

## Hero layouts

Three patterns work for dApp heroes:

### Pattern 1: Centered, text-only

```tsx
<section className="py-24 sm:py-32">
  <div className="mx-auto max-w-3xl px-4 text-center">
    <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
      {headline}
    </h1>
    <p className="mt-6 text-lg sm:text-xl text-muted-foreground">
      {subhead}
    </p>
    <div className="mt-10 flex justify-center gap-3">
      <Button size="lg">Primary CTA</Button>
      <Button size="lg" variant="ghost">Learn more</Button>
    </div>
  </div>
</section>
```

Works for: most dApps. Hardest to mess up.

### Pattern 2: Split (text left, product visual right)

```tsx
<section className="py-24 sm:py-32">
  <div className="mx-auto max-w-7xl px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
    <div>
      <h1>{headline}</h1>
      <p>{subhead}</p>
      <Button>{cta}</Button>
    </div>
    <div>
      <img src={productScreenshot} />
    </div>
  </div>
</section>
```

Works for: products with a clear product-screenshot story.

### Pattern 3: Stacked (text on top, large product below)

```tsx
<section className="py-24">
  <div className="mx-auto max-w-3xl px-4 text-center">
    <h1>{headline}</h1>
    <p>{subhead}</p>
    <Button>{cta}</Button>
  </div>
  <div className="mt-16 mx-auto max-w-7xl px-4">
    <img src={productScreenshot} className="rounded-xl shadow-2xl" />
  </div>
</section>
```

Works for: when the product is the proof. Most dashboards.

## Dashboard layouts

Standard dashboard structure:

```
+-----------------------------------+
| Top nav  (60-72px tall, sticky)   |
+--------+--------------------------+
|        |                          |
| Side   |   Main content           |
| nav    |   max-w-7xl              |
| 240px  |                          |
|        |                          |
+--------+--------------------------+
```

Top nav: height 60-72px, sticky, `border-b`, contains logo + nav + wallet + profile.

Side nav: 240-280px wide, contains primary navigation, collapses to icons on tablet, drawer on mobile.

Main content: `max-w-7xl` inside, `p-6` to `p-8`.

For mobile, side nav becomes a drawer behind a hamburger.

## Card grids

For position lists, vault lists, marketplaces:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map(...)}
</div>
```

Card aspect ratio: avoid forcing one. Let content drive height. If you need uniform heights, use `auto-rows-fr`.

## Form layouts

Single-column for transactional forms (deposit, swap, mint). Width 400-500px, centered.

```tsx
<div className="mx-auto max-w-md p-6 rounded-xl border bg-card">
  <h2 className="text-xl font-semibold">Deposit</h2>
  <div className="mt-6 space-y-4">
    <AmountInput />
    <Slippage />
    <Summary />
    <Button className="w-full" size="lg">Deposit</Button>
  </div>
</div>
```

Two-column only for settings or profile pages where there's lots of content.

## Whitespace rhythm cheatsheet

| Between | Space |
|---|---|
| Page top → first section | py-16 to py-24 |
| Section → section | py-16 |
| Section heading → body | mb-8 to mb-12 |
| Card → card | gap-4 |
| Form field → field | space-y-4 |
| Inline group (buttons, chips) | gap-2 to gap-3 |
| Heading → next paragraph | mb-3 to mb-4 |
| Paragraph → paragraph | mb-4 |

## Mobile responsive

Use Tailwind's mobile-first breakpoints:

```
sm:   640px   — phone landscape
md:   768px   — tablet
lg:   1024px  — small desktop
xl:   1280px  — desktop
2xl:  1536px  — large desktop
```

Default styles target mobile. Add `sm:` / `md:` / `lg:` for larger.

```tsx
<h1 className="text-3xl sm:text-5xl lg:text-6xl">
```

## Common layout sins

- **Container too narrow on desktop.** A `max-w-2xl` looks great for blog text, terrible for a dashboard.
- **No section padding.** Sections touch each other; eye can't separate them.
- **Mobile padding too tight.** `px-2` makes cards touch the edge.
- **Sticky nav doesn't account for safe-area-inset on iOS.**
- **Card grid breaks at exactly the wrong width** (3 columns becomes 2 awkwardly). Test at every breakpoint.
- **Hero too tall.** A 100vh hero with 3 lines of text is empty space, not impactful.
- **Footer too tall.** The footer doesn't need to be a second landing page.

## Visual debugging

When something feels off:

```css
* { outline: 1px solid red; }
```

Look for:
- Elements that aren't on the grid
- Spacing that's not on the scale
- Containers with no max-width
- Mobile breakpoints stacking awkwardly

## What to read next

- `references/component-recipes.md` — buttons, modals, forms
- `references/copy-rules.md` — UI copy patterns
- `design-taste/references/visual-fundamentals.md` — typography, spacing, color, hierarchy
