# i18n Numbers

Handling number formatting across locales, currencies, and languages. Global dApps need to respect local conventions without introducing ambiguity.

## Thousands Separators and Decimal Points

Different locales use different separators:

| Locale | Thousands | Decimal | Example |
|---|---|---|---|
| en-US | comma | period | `1,234,567.89` |
| de-DE | period | comma | `1.234.567,89` |
| fr-FR | space | comma | `1 234 567,89` |
| hi-IN | comma (irregular) | period | `12,34,567.89` |
| ja-JP | comma | period | `1,234,567.89` |
| zh-CN | comma | period | `1,234,567.89` |

## Using `Intl.NumberFormat`

JavaScript's `Intl.NumberFormat` handles locale-aware formatting:

```ts
// User's browser locale (recommended for most cases)
new Intl.NumberFormat().format(1234567.89)
// en-US: "1,234,567.89"
// de-DE: "1.234.567,89"

// Specific locale
new Intl.NumberFormat('de-DE').format(1234567.89)
// "1.234.567,89"

// With options
new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(1234.56)
// "$1,234.56"
```

## To Localize or Not

**Option A: Force en-US (simplest)**

Every user sees the same format. No locale bugs, no confusion.

```ts
num.toLocaleString('en-US', { maximumFractionDigits: 4 })
```

**Pros:** Consistent across all users. No locale-specific bugs.
**Cons:** Non-US users see unfamiliar separators.

**Option B: Respect browser locale**

Each user sees numbers in their local format.

```ts
num.toLocaleString(undefined, { maximumFractionDigits: 4 })
```

**Pros:** Feels native to each user.
**Cons:** Harder to debug. Mixed formats if some parts use locale and others don't.

**Recommendation:** For dApps, **force en-US** unless you have a specific reason to localize. Crypto users are global and accustomed to en-US number formats. Half-localizing (some numbers localized, others not) is worse than not localizing at all.

## Currency Formatting

### USD (most common in dApps)

```ts
function formatUsd(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01 && value > 0) return '<$0.01';
  if (value < 0) return `-$${Math.abs(value).toFixed(2)}`;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
```

### Multi-Currency Support

If your dApp supports multiple fiat currencies:

```ts
const CURRENCY_LOCALES: Record<string, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  INR: 'en-IN',
};

function formatFiat(value: number, currency: string): string {
  const locale = CURRENCY_LOCALES[currency] ?? 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}
```

### JPY and Zero-Decimals Currencies

Some currencies have no decimal places (JPY, KRW, INR in some contexts):

```ts
new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
}).format(1234.56)
// "￥1,235" (rounded to integer)
```

`Intl.NumberFormat` handles this automatically based on the currency code.

## RTL Languages

For Arabic and Hebrew, numbers are read left-to-right even in RTL text. This can cause layout issues.

```tsx
// Wrap numbers in a LTR span within RTL text
<div dir="rtl">
  الرصيد: <span dir="ltr" className="tabular-nums">1,234.56</span> ETH
</div>
```

## Percentage Localization

```ts
// Localized percentage
new Intl.NumberFormat('de-DE', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(0.0472)
// "4,72%" (note the comma)

// For dApps, simpler to format manually with en-US
`${(0.0472 * 100).toFixed(2)}%`
// "4.72%"
```

## Common i18n Bugs

| Bug | Cause | Fix |
|---|---|---|
| `1.234,56` in one place, `1,234.56` in another | Mixed locale usage | Pick one approach (force en-US or full locale) |
| Currency symbol missing | `Intl.NumberFormat` not used consistently | Centralize formatting in a single utility |
| Negative currency shows as `-$123` | Some locales expect `($123)` | Use `Intl.NumberFormat` for currency, not manual formatting |
| JPY shows `￥1,234.56` | Didn't let `Intl` handle currency decimals | Trust `Intl.NumberFormat` — it knows JPY has 0 decimals |

## The Central i18n Formatter

For any dApp targeting global users:

```ts
// lib/format.ts
export const i18n = {
  number: (n: number, decimals = 4) =>
    n.toLocaleString('en-US', { maximumFractionDigits: decimals }),

  currency: (n: number, code: 'USD' | 'EUR' | 'GBP' = 'USD') =>
    new Intl.NumberFormat(CURRENCY_LOCALES[code], {
      style: 'currency',
      currency: code,
    }).format(n),

  percent: (n: number, decimals = 2) =>
    `${(n * 100).toFixed(decimals)}%`,

  compact: (n: number) =>
    new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(n),
};
```

Use `i18n.number()`, `i18n.currency()`, etc. everywhere. Centralized = consistent.
