# Web3-Specific Roast Checklist

Crypto products fail in crypto-specific ways. This checklist surfaces them. Use alongside the funnel walkthrough — these issues lurk between the user steps.

For severity bucketing, see `references/severity-rubric.md`. For the funnel structure, see `references/funnel-walkthrough.md`.

## Wallet connect anxiety

The wallet prompt is the most fragile moment in any dApp. A surprising amount of products fail here.

- [ ] **Connect button visible above the fold?** Or do I scroll to find it?
- [ ] **Connect prompt explains why I'm signing?** Not just "Sign to verify ownership" — explain what gets signed.
- [ ] **Wallets I'd expect are listed?** MetaMask, Rainbow, Coinbase, Phantom, WalletConnect, Trust.
- [ ] **Mobile detection works?** No QR shown when I'm on phone (I have no second device).
- [ ] **Auto-prompt to switch network?** If wrong network, app suggests the right one with one click.
- [ ] **Disconnect actually disconnects?** Including in mobile in-wallet browsers (often broken).
- [ ] **Reconnect on page reload?** Or do I have to connect every time.
- [ ] **Connector branding consistent?** Or does the modal show 8 random Web3 wallets I've never heard of.

## Transaction flow

The moment the user signs, the moment they confirm, and the moment after.

- [ ] **Inline explanation of approval-then-action?** "Approving lets [contract] spend your USDC. One-time per token."
- [ ] **Gas estimate shown before signing?** With chain context (Base gas ~$0.001, mainnet ~$2).
- [ ] **Slippage protection sane?** Not 0.5% on a 5% liquidity pool — will revert.
- [ ] **Pending state visible?** Spinner, time estimate, link to explorer.
- [ ] **Resubmit / speed-up option?** For stuck transactions.
- [ ] **Cancel / replace UX?** If user wants to bail.
- [ ] **Confirmation toast persistent?** Not auto-dismissed in 2s before user sees it.
- [ ] **Failure messages translated?** Not raw RPC strings.
- [ ] **Common revert reasons mapped?** "Slippage too high" not "execution reverted".

Read also: `qa/references/error-handling-and-toasts.md`.

## Number formatting

If users see `1000000000000000000` in your UI, you've already lost trust.

- [ ] **Token amounts formatted with decimals?** `formatEther`, `formatUnits(value, decimals)`.
- [ ] **Right number of decimal places shown?** 4-6 for token amounts; 2 for USD.
- [ ] **Token symbol shown alongside?** "1.234 USDC" not "1.234".
- [ ] **Tooltips with full precision?** Hover shows full value if rounded.
- [ ] **Address truncation consistent?** `0x1234…abcd` everywhere, with click-to-copy.
- [ ] **Big numbers use thousands separators?** `1,234,567` not `1234567`.
- [ ] **Scientific notation suppressed?** Never `1.23e-9` in user-facing display.

Read also: `frontend-ux/SKILL.md`, `frontend-design-guidelines/SKILL.md`.

## Gas / cost surprises

Hidden costs destroy trust in one click.

- [ ] **Cost shown before signing?** Total gas in user's currency.
- [ ] **Network fee separate from protocol fee?** Don't bundle "network gas + 0.5% vault fee" into one opaque number.
- [ ] **L2 gas costs shown realistically?** Base swap is $0.01, not "free".
- [ ] **Failed-tx cost warned?** "Even failed transactions cost gas. Estimated max: $X."
- [ ] **Approve gas separate from action gas?** Two-step flow has two costs.

## Trust / safety signaling

Every dApp must answer: "should I trust this enough to give it access to my funds?"

- [ ] **Audit visible / linked?** From the landing page, not buried in docs.
- [ ] **Contract addresses linked to verified Etherscan/Basescan?** Verified, not unverified.
- [ ] **Multisig owner shown if applicable?** "Owned by [Safe] with 3/5 signers."
- [ ] **Pause / emergency mechanism documented?** Including who can call it and timelock.
- [ ] **Bug bounty linked?** Immunefi or Cantina if available.
- [ ] **Last update / activity visible?** Stale-looking sites destroy trust.
- [ ] **Team or sponsor identifiable?** Even pseudonymous — at least a Twitter handle.

## "What does this contract actually do?" anxiety

Power users want to verify before signing. Make this easy.

- [ ] **Contract source visible from app?** One-click link to verified source.
- [ ] **Plain-English description of what's signed?** EIP-712 typed data is great, but explain in copy.
- [ ] **Permit vs approve clarity?** Both are real; user should know which they're signing.
- [ ] **Permission scope?** Single token amount vs unlimited approval — don't default to unlimited.
- [ ] **Signature replay prevention?** Domain separator, deadline.

## Recovery paths

What happens when something fails?

- [ ] **Failed transaction → clear next step?** "Increase slippage and retry" / "Wait for network congestion to clear".
- [ ] **Stuck transaction → cancel/speed-up UI?** Or at least instructions.
- [ ] **Wrong network → switch with one click?** Don't make user do this in MetaMask manually.
- [ ] **Expired signature / deadline → regenerate?** Don't show a stale "Sign" button forever.
- [ ] **Lost session → reconnect without losing progress?** Form state preserved.

Read also: `qa/references/mobile-and-pwa.md`.

## Mobile-specific

Most users come from mobile. Most products are tested on desktop.

- [ ] **Page loads in MetaMask Mobile / Rainbow / Coinbase Wallet in-app browser?** Test all three.
- [ ] **Touch targets ≥ 44px?** Tiny buttons fail on thumbs.
- [ ] **Numeric input uses `inputmode="decimal"`?** Or iOS shows alphabet keyboard.
- [ ] **Deep link pattern correct?** Fire TX first, wait, then deep-link to wallet.
- [ ] **Safe-area insets handled?** Bottom nav doesn't hide behind home indicator.
- [ ] **Pull-to-refresh disabled mid-transaction?** Or user accidentally refreshes.
- [ ] **State persists across wallet app switch?** User shouldn't lose form data.

Read also: `qa/references/mobile-and-pwa.md`.

## Token / yield mechanics

If your product has a token or yield, mechanics often confuse users.

- [ ] **Yield source disclosed?** Where does the APY come from?
- [ ] **APY vs APR distinguished?** They're not the same; pick one and explain.
- [ ] **Lockup / withdrawal delays surfaced?** Before user deposits, not after.
- [ ] **Token lockup / vesting explained?** Especially "we give you tokens but you can't sell" cases.
- [ ] **Variable APY clearly labeled?** Not shown as fixed.
- [ ] **Past returns marked clearly as past?** Not as forecasts.

## Indexing / freshness

Many dApps show stale data because the indexer fell behind.

- [ ] **Subgraph status visible somewhere?** "Synced X blocks ago".
- [ ] **Stale-data warning shown?** If indexer is more than 1-2 minutes behind.
- [ ] **Data refreshes after a transaction?** Or shows "your action will appear shortly".
- [ ] **Time-sensitive data has timestamps?** "Last updated 2 min ago".

Read also: `indexing/SKILL.md`.

## Onboarding / first-touch

The user just connected. What's their first 30 seconds?

- [ ] **Clear first action?** Even with $0 balance, what should they do?
- [ ] **Test mode / faucet link?** Lower the barrier to first try.
- [ ] **Tour or guided flow optional?** Don't force it; some users hate tours.
- [ ] **Empty state has a CTA?** Not just "$0" with no path forward.
- [ ] **Help / docs link discoverable?** From every screen.

## Pricing transparency

If you charge fees, surface them honestly.

- [ ] **Fee disclosed before action?** Not buried in docs.
- [ ] **Fee broken down?** Protocol fee, performance fee, gas, slippage — separately.
- [ ] **Fee comparison with alternative?** "Compare to manually rebalancing: X hours saved."
- [ ] **Free tier or trial?** If applicable.

## "Decentralization" honesty

If you claim decentralization, it should be real.

- [ ] **Admin powers documented?** "We can pause; we can upgrade; we can change parameters."
- [ ] **Multisig vs single-key?** If single-key, say so.
- [ ] **Timelock present?** If admin can change things, how fast?
- [ ] **Sunset path documented?** "Pause sunsets in 6 months."
- [ ] **Upgradeable? Documented?** UUPS / transparent / immutable — say which.

## Branding / messaging consistency

Crypto products often have inconsistent narratives.

- [ ] **Same name / terminology everywhere?** Not "Vault" sometimes and "Pool" elsewhere.
- [ ] **Tone consistent?** Don't be edgy on Twitter and corporate on the landing page.
- [ ] **Twitter / Discord / app match?** All point to the same product, with the same promise.
- [ ] **Press kit / brand assets if needed?** Logos, colors, screenshots.

## Retention / loop

Why does the user come back?

- [ ] **Reason to return?** Yield to check, governance to participate in, position to manage.
- [ ] **Notification mechanism?** Email, push, browser, mobile.
- [ ] **Re-engagement copy?** "Your position earned $X this week."
- [ ] **Streak / habit hook?** If applicable to the product type.

## Documentation

Docs are part of the product.

- [ ] **Docs exist?** Even a one-pager.
- [ ] **Up to date?** Or last updated 2 years ago?
- [ ] **Searchable?** Not just a giant README.
- [ ] **Code examples?** With actual addresses, not `0x...`.
- [ ] **API / SDK reference?** If you have one.

## Composability story

If you claim composability, prove it.

- [ ] **ERC-20 / ERC-721 / ERC-4626 standards followed?** Not custom variants.
- [ ] **Events emitted on every state change?** Indexers depend on this.
- [ ] **Read-only methods well-named?** External integrators shouldn't have to guess.
- [ ] **Permit support?** Saves users gas; signals modernity.

## Output of the roast

The roast should reference specific items from this checklist, not say "your wallet UX is bad". Quote the line, point at the screenshot, suggest the fix.

## What to read next

- `references/severity-rubric.md` — bucket findings
- `references/funnel-walkthrough.md` — order findings by user step
- `frontend-ux/SKILL.md` — patterns to fix what you found
- `qa/SKILL.md` — full QA checklist
