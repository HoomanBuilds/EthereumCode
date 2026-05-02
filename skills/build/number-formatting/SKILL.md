---
name: number-formatting
description: Use when displaying numbers, balances, prices, or percentages in a dApp UI. Covers token amount formatting, USD display, scientific notation suppression, and locale handling. Wei in the UI is a trust killer; this skill is the prevention.
---

# Number Formatting

## What You Probably Got Wrong

**"formatEther works for everything."** USDC has 6 decimals, not 18. `formatEther` on a USDC balance is wrong by 10^12. Always pass the token's `decimals` field to `formatUnits`.

**"I'll show the full precision."** `1.234567891234567891 ETH` is not useful to anyone. Precision needs to match magnitude — small numbers need more decimals, large numbers need fewer.

**"JavaScript handles large numbers."** It doesn't. `Number` has 15–17 significant digits. A token with 18 decimals will lose precision if you convert raw `bigint` to `Number`. Always go through `formatUnits` (string-based) first.

For component patterns see `frontend-design-guidelines/SKILL.md`. For taste and visual hierarchy see `design-taste/SKILL.md`.

## When to use

Trigger this skill when the user:

- "How do I format token amounts?"
- "Show USD value next to token balance"
- "Why is my balance showing as 1.23e+21?"
- "How do I display 0.00000123 ETH?"
- "Numbers aren't aligned in my table"

## Workflow

1. **Identify what kind of number it is.** Token amount, USD price, percentage, gas — each has different rules. Read [references/precision-rules.md](references/precision-rules.md) before formatting anything.

2. **Always use a formatter library, never raw `toString`.** `viem`'s `formatUnits` for token amounts, `Intl.NumberFormat` for locale. No exceptions.

3. **Use tabular figures for alignment.** Read [references/typographic-numbers.md](references/typographic-numbers.md). When numbers stack vertically, columns must align on the decimal.

4. **Suppress scientific notation in display.** `1.23e-9 ETH` is unintelligible. Show `<0.0001` or "dust" instead.

5. **Show the unit / symbol always.** "1.234 USDC" not "1.234". Without the unit, the number is ambiguous.

6. **Force en-US locale for dApps.** Read [references/i18n-numbers.md](references/i18n-numbers.md). Half-localizing (some numbers localized, others not) is worse than not localizing at all.

7. **Centralize formatters in one file.** `lib/format.ts`. Every page imports from there. Centralized = consistent.

## Token amounts

```ts
import { formatUnits } from 'viem';

function formatToken(value: bigint, decimals: number, symbol: string) {
  const num = Number(formatUnits(value, decimals));

  if (num === 0) return `0 ${symbol}`;
  if (num < 0.0001) return `<0.0001 ${symbol}`;
  if (num < 1) return `${num.toFixed(6)} ${symbol}`;
  if (num < 1000) return `${num.toFixed(4)} ${symbol}`;
  if (num < 1_000_000) return `${num.toFixed(2)} ${symbol}`;

  return `${num.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}`;
}
```

Output:
- `0.00012345 ETH` → `<0.0001 ETH`
- `0.123456 ETH` → `0.123456 ETH`
- `1.234567 ETH` → `1.2346 ETH`
- `1234.5678 USDC` → `1234.57 USDC`
- `1234567.89 USDC` → `1,234,567.89 USDC`

## USD prices

```ts
function formatUsd(value: number) {
  if (value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  if (value < 1000) return `$${value.toFixed(2)}`;

  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUsdCompact(value: number) {
  if (value < 1_000_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value < 1_000_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000_000_000).toFixed(2)}B`;
}
```

## Critical rules

### Never display wei

```tsx
// BAD
<span>{balance.toString()}</span>  // 1000000000000000000

// GOOD
<span>{formatToken(balance, 18, 'ETH')}</span>  // 1.0000 ETH
```

### Never use scientific notation in UI

JavaScript switches to scientific notation around `1e-7` and `1e21`. Suppress explicitly with tiered precision.

```tsx
// BAD — 0.000000001 displays as "1e-9"
<span>{Number(balance) / 1e18} ETH</span>

// GOOD
<span>{formatToken(balance, 18, 'ETH')}</span>  // "<0.0001 ETH"
```

### Always show the unit

`1.5` could be ETH, USDC, percent, hours. Without the unit, it's ambiguous.

```tsx
// GOOD
<div>{fmt.token(balance, 6, 'USDC')} <span className="text-muted">USDC</span></div>
```

### Right-align in tables, use tabular-nums

```tsx
<td className="text-right tabular-nums">{fmt.token(balance, 18, 'ETH')}</td>
```

Without `tabular-nums`, `1` and `4` have different widths in proportional fonts and the column wobbles.

### USDC has 6 decimals

```ts
// WRONG
formatEther(usdcBalance)  // treats as 18 → wrong by 10^12

// RIGHT
formatUnits(usdcBalance, 6)
```

Always read the token's `decimals` field dynamically. Don't hardcode 18.

## Common bugs

| Bug | Cause | Fix |
|---|---|---|
| Balance shows `1.23e+21` | JS scientific notation kicked in | Use `formatUnits`, tier precision by magnitude |
| Numbers misaligned in column | Proportional font numerals | `tabular-nums` |
| `0.00012345` displays as `0` | `toFixed(2)` too aggressive | Tier the precision |
| Different formats across pages | No central formatter | Build `lib/format.ts` |
| USDC shown as 18-decimal | Hardcoded `formatEther` | Pass token's `decimals` |

## The central formatter

For any nontrivial dApp, build `lib/format.ts`:

```ts
export const fmt = {
  token: (value: bigint, decimals: number, symbol: string) => { ... },
  usd: (value: number) => { ... },
  usdCompact: (value: number) => { ... },
  percent: (value: number, decimals = 2) => { ... },
  apy: (value: number) => { ... },
  address: (a: `0x${string}`) => { ... },
};
```

Then everywhere: `fmt.token(balance, 6, 'USDC')`. Centralized = consistent.

## Token amount with USD subline

A common dApp pattern:

```tsx
<div className="text-right">
  <div className="text-base tabular-nums">
    {fmt.token(balance, 6, 'USDC')}
  </div>
  <div className="text-xs text-muted-foreground tabular-nums">
    {fmt.usd(balance * priceUsd / 1e6)}
  </div>
</div>
```

## What to read next

- `frontend-design-guidelines/SKILL.md` — component recipes (amount input, balance display)
- `design-taste/SKILL.md` — typography fundamentals
- `addresses/SKILL.md` — address-specific display
