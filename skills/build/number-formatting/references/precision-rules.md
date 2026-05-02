# Precision Rules

When to round, when to truncate, and how many decimal places to show for each type of number in a dApp.

## Precision by Number Type

### Token Amounts

Display precision depends on the magnitude, not the token's decimals.

| Magnitude | Decimal Places | Example |
|---|---|---|
| 0 | 0 (show "0") | `0 ETH` |
| 0 < x < 0.0001 | Show "<0.0001" | `<0.0001 ETH` |
| 0.0001 ≤ x < 1 | 6 decimals | `0.123456 ETH` |
| 1 ≤ x < 1,000 | 4 decimals | `1.2346 ETH` |
| 1,000 ≤ x < 1,000,000 | 2 decimals | `1,234.57 USDC` |
| x ≥ 1,000,000 | 2 decimals, comma-separated | `1,234,567.89 USDC` |

**Why tiered precision?** Users care about precision at small magnitudes (is it worth anything?) but not at large magnitudes (the difference between $1,234,567.89 and $1,234,567.891234 is meaningless to a human).

### USD Values

| Magnitude | Format | Example |
|---|---|---|
| 0 | `$0.00` | `$0.00` |
| 0 < x < $0.01 | `<$0.01` | `<$0.01` |
| $0.01 ≤ x < $1,000 | 2 decimals | `$12.34` |
| $1,000 ≤ x < $1,000,000 | Comma + 2 decimals | `$12,345.67` |
| $1,000,000 ≤ x < $1,000,000,000 | Compact (M) | `$12.34M` |
| x ≥ $1,000,000,000 | Compact (B) | `$1.23B` |

### Percentages

| Context | Decimal Places | Example |
|---|---|---|
| APY / yield | 2 | `4.72%` |
| Allocation / portfolio | 1 | `33.3%` |
| Progress / completion | 0 | `67%` |
| Very small rates | 4 | `0.0012%` |
| Very large multiples | Use "x" notation | `12x` not `1,200%` |

### Gas

| Context | Format | Example |
|---|---|---|
| Base fee | 3 decimals + gwei | `0.123 gwei` |
| Total gas cost | USD equivalent | `$0.004` |
| Gas limit | Comma-separated integer | `21,000` |
| Gas used percentage | 1 decimal | `67.3%` |

### Block Numbers

Always comma-separated integers: `18,500,234`.

### Timestamps

For onchain timestamps, show human-readable relative time:

- `< 1 minute ago`
- `5 minutes ago`
- `2 hours ago`
- `3 days ago`
- `Jan 15, 2026` (for older than 7 days)

## Input vs Display Precision

**Input precision** (what the user types) can be higher than display precision. Don't round user input — only round what you display.

```tsx
// Input: user types "1.23456789"
// Store: keep full precision as bigint via parseUnits
// Display: round according to magnitude rules above

const userInput = "1.23456789";
const contractValue = parseUnits(userInput, 18); // full precision
const displayValue = formatToken(contractValue, 18, "ETH"); // tiered precision
```

## Rounding Rules

- **Display rounding:** Round half-up (standard). `1.235` → `1.24` at 2 decimal places.
- **Input rounding:** Never round input. If a user types `1.234567891234567891`, pass the full precision to the contract.
- **Intermediate calculations:** Use full precision (bigint) for all math. Round only at the final display step.
- **Percentages:** Round at the last step. If allocation is `33.333...%`, show `33.3%`, not `33%` (loses too much precision).

## The "Dust" Convention

For amounts too small to be meaningful, show "dust" or "<min":

```ts
function formatDust(value: number, threshold: number): string {
  if (value === 0) return "0";
  if (value < threshold) return `<${threshold}`;
  return value.toString();
}

// Examples:
formatDust(0.0000001, 0.0001)  // "<0.0001"
formatDust(0.00001, 0.0001)    // "<0.0001"
formatDust(0.001, 0.0001)      // "0.001"
```

## Precision Gotchas

### USDC and 6-decimal tokens

USDC has 6 decimals, not 18. `formatEther` will give the wrong result for USDC.

```ts
// WRONG
formatEther(usdcBalance)  // treats as 18 decimals → wrong by 10^12

// RIGHT
formatUnits(usdcBalance, 6)  // treats as 6 decimals → correct
```

Always read the token's `decimals` field dynamically. Don't hardcode 18.

### BigInt division

When dividing BigInts, integer division truncates. Multiply before dividing if you need fractional results.

```ts
// WRONG: truncates to 0
const ratio = numerator / denominator;  // 5n / 10n = 0n

// RIGHT: scale up first
const ratio = (numerator * 10000n) / denominator;  // 50000n
// Then divide by scale for display
```

### Floating-point in JS

`Number` has 15-17 significant digits. For token amounts with 18 decimals, you lose precision when converting bigint to Number.

```ts
// Safe for most display cases
const num = Number(formatUnits(value, decimals));

// Unsafe for exact math
const num = Number(value) / 1e18;  // loses precision for large values
```

Always use `formatUnits` (string-based) before converting to Number for display.
