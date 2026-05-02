# Typographic Numbers

How to make numbers look right in a UI. This covers fonts, alignment, and the visual details that separate professional dApps from amateur ones.

## Tabular Numbers

The single most important typographic rule for financial UIs: **use tabular-nums for any column of numbers.**

### The Problem

Proportional fonts give each character a different width. The digit `1` is narrower than `4`. In a column:

```
Without tabular-nums:    With tabular-nums:
    $12.34                   $12.34
   $123.45                  $123.45
  $1,234.56                $1,234.56
    $56.78                   $56.78
```

Without tabular-nums, the decimal points don't align. The column "wobbles" — your eye can't scan values quickly.

### The Fix

```css
/* CSS */
.amount {
  font-variant-numeric: tabular-nums;
}

/* Tailwind */
<td class="tabular-nums text-right">$123.45</td>

/* Inline style */
<span style="fontVariantNumeric: 'tabular-nums'}">$123.45</span>
```

Most modern fonts support `tabular-nums` including Inter, SF Pro, Geist, and Roboto.

### Where to Apply Tabular-Nums

- Token balance columns
- Portfolio value tables
- Transaction amount lists
- Price tickers
- APY columns
- Any list where numbers stack vertically

### Where NOT to Apply Tabular-Nums

- Single numbers in headings
- Numbers in paragraphs of text
- Buttons with a single value

## Right-Aligning Numbers

Numbers in tables should be **right-aligned** so decimal points stack.

```tsx
// WRONG (left-aligned)
<td>$12.34</td>
<td>$123.45</td>
<td>$1,234.56</td>

// RIGHT (right-aligned)
<td className="text-right tabular-nums">$12.34</td>
<td className="text-right tabular-nums">$123.45</td>
<td className="text-right tabular-nums">$1,234.56</td>
```

Exceptions: block numbers, timestamps, and other non-comparative numbers can be left-aligned.

## Font Choice for Numbers

Not all fonts are equal for financial data. Good choices:

| Font | Tabular Support | Notes |
|---|---|---|
| Inter | Yes | Default for most dApps. Clean, readable. |
| Geist | Yes | Vercel's font. Slightly more condensed than Inter. |
| SF Mono | Yes | Monospace. Great for code, OK for data. |
| JetBrains Mono | Yes | Monospace with nice numerals. |
| Roboto Mono | Yes | Good tabular support. |

Avoid:
- **System default serif fonts** — numbers look dated
- **Decorative/display fonts** — hard to read at small sizes
- **Fonts without tabular-nums support** — you can't fix the alignment

## Number Sizes and Hierarchy

In a financial UI, the most important number should be the largest. Common pattern:

```
Primary balance:        32px / 2rem / text-2xl    "1,234.56 ETH"
Secondary (USD):        16px / 1rem / text-base   "$2,468.00"
Tertiary (change):      14px / 0.875rem / text-sm  "+5.2%"
```

Color hierarchy:
- Primary: foreground color
- Secondary: muted/secondary color
- Tertiary: tertiary color, smaller

## Handling Negative Numbers

For financial loss/negative values:

- Use a **red color** (e.g., `text-red-500` or `text-destructive`)
- **Don't use parentheses** — `(123)` is accounting notation, not web
- Use the minus sign: `-123.45`
- For percentage changes: `-5.23%` in red

## Zero Values

Display zero values clearly. Don't hide them or show a dash.

```tsx
// GOOD
{balance === 0n ? "0 ETH" : formatToken(balance, 18, "ETH")}

// BAD — makes users wonder if it loaded
{balance === 0n ? "—" : formatToken(balance, 18, "ETH")}
```

Exception: In a table with mostly zeros, you can omit the zero and leave the cell empty to reduce visual noise.

## Long Numbers in Mobile

On mobile, long numbers overflow. Handle this:

```tsx
// Option 1: Truncate with tooltip
<span title={fullValue}>{shortenedValue}</span>

// Option 2: Scroll horizontally
<div className="overflow-x-auto tabular-nums">{value}</div>

// Option 3: Stack on mobile
<div className="flex flex-col">
  <span className="text-lg tabular-nums">{integerPart}</span>
  <span className="text-sm text-muted tabular-nums">.{decimalPart}</span>
</div>
```

## Spacing Around Numbers

Numbers need breathing room. Don't cram them next to labels.

```tsx
// GOOD: clear separation
<div className="flex justify-between">
  <span className="text-muted">Balance</span>
  <span className="tabular-nums">1,234.56 ETH</span>
</div>

// BAD: cramped
<div>Balance: 1,234.56 ETH</div>
```
