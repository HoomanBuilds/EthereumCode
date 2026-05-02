# Copy Rules

UI copy is design. Bad copy ruins good components. This file is the cookbook for writing copy that doesn't make users hesitate.

For components see `references/component-recipes.md`. For layout see `references/layout-and-grid.md`.

## Voice

Pick a voice. Stick to it. The most common dApp voices are:

- **Plain / direct** — Coinbase, Stripe. "Send money. Get a receipt."
- **Friendly / warm** — Rainbow, Notion. "Welcome back. Your stETH earned $4 this week."
- **Technical / dry** — Etherscan, Foundry. "TX 0xabc... mined in block 18,234,567"
- **Edgy / crypto-native** — Frame, Friend.tech. "gm anon. Stake or get rekt."

Most dApps should pick **plain/direct** by default. It ages well, doesn't alienate, and works across audiences.

Whichever you pick, **do not mix**. A landing page that's edgy ("send it") and an in-app flow that's enterprise ("Please confirm the transaction at your earliest convenience") feels schizophrenic.

## Headlines

Rules:

- **Specific over abstract.** Bad: "Reimagine yield." Good: "Earn 4.2% on stETH, auto-rebalanced."
- **Nouns and verbs.** Bad: "The future of decentralized finance." Good: "Lend USDC. Borrow against stETH."
- **One promise.** Don't list three benefits in the H1.
- **Short.** Headlines under 8 words read better than 12.
- **Active voice.** "We rebalance your stETH" not "Your stETH is rebalanced."

Test: paste your H1 to a non-crypto friend. Ask "what does this product do?" If they can't answer, fail.

### Examples

| Bad | Better |
|---|---|
| "The future of onchain lending" | "Borrow USDC against your ETH. 4.5% APY." |
| "Reimagine your portfolio" | "Track every wallet you own in one place." |
| "DeFi, simplified" | "One-click access to Aave, Compound, Spark." |
| "Web3 for everyone" | "Buy crypto with Apple Pay. Self-custody from day one." |

## Subheads

The subhead does what the headline can't fit. Two lines max. Plain sentences.

```
H1:    Earn 4.2% on your stETH.
Sub:   Auto-rebalanced across Aave, Compound, and Spark.
       0.5% of yield. Withdraw any time.
```

Don't restate the headline. Don't add buzzwords. Add concrete details: numbers, mechanisms, timelines, costs.

## CTAs

Rules:

- **Verb + object.** "Deposit USDC" not "Deposit" alone.
- **First person if onboarding.** "Get started" → "Start earning"
- **Avoid "Submit" / "OK" / "Click here."** They mean nothing.
- **Match the action.** Don't say "Continue" if the next click signs a transaction.

### Crypto-specific CTA copy

| Action | Bad | Good |
|---|---|---|
| Connect wallet | "Connect" | "Connect Wallet" or specific wallet name |
| Approve token | "Approve" | "Approve USDC for vault" (with one-time note) |
| Submit tx | "Submit" | "Deposit 100 USDC" |
| Sign message | "Sign" | "Sign to log in" or "Sign to verify" |
| Wait state | "Loading..." | "Confirming on-chain..." |
| Done | "Success" | "Deposited 100 USDC" |

The CTA should restate what's about to happen so the user doesn't have to re-read the form.

## Errors

Translate, don't repeat. Never show raw RPC errors to users.

```
Raw:        "execution reverted: 0x4e487b71..."
Translated: "Slippage too high. Try increasing tolerance."

Raw:        "user rejected the request"
Translated: "Transaction cancelled in wallet."

Raw:        "insufficient funds for gas * price + value"
Translated: "Not enough ETH for gas. You need at least 0.002 ETH on Base."

Raw:        "network changed"
Translated: "Network switched mid-transaction. Please retry."
```

Map common revert reasons to plain language. Maintain a small table:

| Revert | User-facing message |
|---|---|
| `slippage` | "Price moved too much. Increase slippage tolerance and retry." |
| `paused` | "Vault is paused. Try again later." |
| `insufficient balance` | "Not enough USDC to deposit." |
| `deadline` | "Transaction took too long. Refresh and retry." |
| `0xe450d38c` (ERC20InsufficientBalance) | "Not enough USDC." |

Always include a recovery action. "Retry" / "Increase slippage" / "Refresh" — never just "Error."

## Empty states

Bad: "No data."

Good: "No positions yet. Deposit USDC to start earning."

Pattern: **Status + Reason + Next step.**

| Status | Reason | Next step |
|---|---|---|
| No positions | (implicit: you haven't deposited) | Deposit |
| No transactions | (no activity) | Make your first deposit |
| No notifications | (nothing happened) | (no CTA needed) |
| 0 USDC balance | (haven't bridged) | Bridge USDC to Base |

## Loading states

Tell the user what's happening. Don't just spin.

| Stage | Copy |
|---|---|
| Awaiting wallet signature | "Confirm in your wallet" |
| Tx in mempool | "Submitting to Base..." |
| Tx awaiting confirmation | "Confirming on-chain..." |
| Tx mined, waiting for indexer | "Just a moment..." |
| Done | "Deposited 100 USDC" |

The user should always know which step they're on.

## Confirmations

When something succeeds, state it specifically:

| Bad | Good |
|---|---|
| "Success" | "Deposited 100 USDC" |
| "Done!" | "You earned 0.42 USDC this week" |
| "Transaction sent" | "Sent 0.5 ETH to 0x1234…abcd" |

Pair the confirmation with what's next: "View on Explorer | Deposit more | Done."

## Numbers in copy

- Use thousands separators: `1,234,567` not `1234567`
- Use commas in EU/Latin contexts: `1.234,56` (locale-aware via `toLocaleString`)
- Currency: `$1,234.56` for USD, `$1.23K` only in dashboards
- Percentages: `4.20%` with 2 decimals max in marketing, `4.2%` in app
- Token amounts: 4-6 decimals usually enough; tooltip with full precision

## Crypto jargon

Default to plain. Add jargon only when the audience is technical.

| Jargon | Plain |
|---|---|
| "Wallet address" | "Wallet" |
| "Onchain" | "Recorded on Ethereum / Base / etc." |
| "Sign a transaction" | "Confirm in your wallet" |
| "Approve a token" | "Allow [app] to use your USDC" |
| "Slippage tolerance" | "Slippage" (and explain inline first time) |
| "Liquidity provider" | If audience is non-technical, replace entirely |
| "Yield" | "Interest" (depending on audience) |
| "Bridge" | "Move tokens to Base" |
| "Permissionless" | (avoid in user copy unless contrasting) |
| "Decentralized" | (don't lead with) |

If you must use jargon, explain it inline the first time and never again.

## Microcopy

Small details, big impact.

- **Placeholder text:** show example, not instruction. "0.0" not "Enter amount."
- **Hint text:** below input, explains constraint. "Min 10 USDC."
- **Tooltips:** on icons, not on text. Keep under 100 characters.
- **Form errors:** below the field, red, specific. "Amount exceeds your balance" not "Invalid input."

## Buttons in flight

The button label should change with state:

| State | Label |
|---|---|
| Default | "Deposit 100 USDC" |
| User clicked, awaiting wallet | "Confirm in wallet" |
| Wallet signed, submitted | "Submitting…" |
| Mempool, waiting for block | "Confirming…" |
| Mined | "Deposited" (then revert to default after 2s) |
| Failed | "Try again" (with toast explaining) |

## Onboarding copy

The first 30 seconds after connecting:

```
Welcome.
Your wallet 0x1234…abcd is connected to Base.

What would you like to do?

  → Deposit USDC and start earning
  → Bridge from Ethereum (takes ~2 min)
  → Just look around
```

Three choices is the sweet spot — too few feels limiting, too many feels overwhelming.

## Footer copy

Short. Don't write a manifesto.

```
Built on Base. Audited by [Trail of Bits, link]. Open source on [GitHub, link].
```

Or:

```
[Logo]  Vault   Docs   Blog   Discord   Twitter
        © 2026 ProtocolX
```

That's it. Don't add 40 links.

## Voice traps

- **Don't say "we'd love to..."** ("we'd love your feedback") — sounds like marketing fluff
- **Don't say "join the revolution"** — empty
- **Don't say "leverage"** as a verb when you mean "use"
- **Don't say "seamless"** — claims the user can verify with one click
- **Don't say "world-class"** — ditto
- **Don't say "innovative"** — show, don't tell

## Test your copy

Run these checks:

1. **The grandma test.** Could someone non-technical understand the H1?
2. **The skim test.** Read only the headlines and CTAs. Does the user know what to do?
3. **The pronoun test.** Replace "we" with the company name. Does it still read well?
4. **The shorter test.** Cut every sentence by 30%. Is it still clear? Then keep it short.

## What to read next

- `references/component-recipes.md` — component patterns
- `references/layout-and-grid.md` — layout primitives
- `frontend-ux/SKILL.md` — flow-level UX
- `roast-my-product/references/severity-rubric.md` — what bad copy costs
