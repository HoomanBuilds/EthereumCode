# Pendle and Yield Tokens

Pendle splits a yield-bearing asset into a **principal token (PT)** and a **yield token (YT)**, and trades them on its own AMM. Master this and you can build fixed-yield products, leveraged-yield strategies, and structured products that don't otherwise exist on-chain. Get it wrong and your "fixed yield" vault is unwinding into a swap with size you didn't expect.

## The mental model

For any yield-bearing asset (stETH, sUSDe, GMX GLP, Aave aUSDC, …):

```
                 SY (Standardized Yield wrapper)
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
             PT  + YT     ↔    underlying yield-bearing asset
       (principal)   (yield till maturity)
```

- **SY** wraps the yield-bearing asset to a standard interface so Pendle's contracts can talk to anything.
- **PT** redeems 1:1 for the underlying at maturity. Before maturity it trades at a discount; the discount IS the locked-in yield.
- **YT** captures all yield accrued from now to maturity. After maturity, YT is worth 0.

**Invariant**: `1 SY = 1 PT + 1 YT` (in value, before accounting for time-value).

## Use cases

### 1. Fixed yield (buy PT)

Buy PT-stETH expiring 26-Jun-2026 at $0.96. Hold to maturity, redeem for $1.00. Locked-in return: ~4.2% annualized regardless of what happens to staking yield.

This is the closest thing on-chain to a zero-coupon bond. Treasuries do it for stables. Vaults do it to pre-fund liabilities.

### 2. Leveraged yield (buy YT)

Buy YT-stETH at $0.04 (the "yield half" of an SY worth $1). If realized yield over the term is 4%, YT redeems for $0.04 of yield → break-even. If yield averages 8%, you 2x.

YT is a leveraged bet on staking yield direction. Useful in points-farming markets (sUSDe, ezETH) where the implied points-per-token can spike.

### 3. LP into the Pendle pool

Provide PT + SY to Pendle's AMM. Earn:
- Trading fees from PT/YT swappers.
- PENDLE incentives.
- Underlying yield (your SY half keeps earning).

LP impermanent loss profile: bounded, because PT converges to par at maturity. This is meaningfully different from Uniswap LP — IL "self-corrects."

### 4. Hedged yield trader

Buy PT + sell YT short. You're long the yield curve's *direction* without principal exposure. Less common, requires perp markets on YT.

## Integration: buying PT

```solidity
// Pendle Router on mainnet
IPAllAction PENDLE_ROUTER = IPAllAction(0x888888888889758F76e7103c6CbF23ABbF58F946);

// Approve underlying
IERC20(stETH).approve(address(PENDLE_ROUTER), amount);

// Swap exact stETH -> PT-stETH-26JUN26
ApproxParams memory approx = ApproxParams({
    guessMin: 0,
    guessMax: type(uint256).max,
    guessOffchain: 0,
    maxIteration: 256,
    eps: 1e14            // 0.01% precision
});
TokenInput memory input = TokenInput({
    tokenIn: stETH,
    netTokenIn: amount,
    tokenMintSy: stETH,
    pendleSwap: address(0),
    swapData: SwapData(SwapType.NONE, address(0), "", false)
});
LimitOrderData memory limit;   // empty for market

(uint256 ptOut,,) = PENDLE_ROUTER.swapExactTokenForPt(
    receiver,
    address(market),     // PT-stETH-26JUN26 market
    minPtOut,
    approx,
    input,
    limit
);
```

The `ApproxParams` encode an off-chain binary search. Use Pendle's SDK or hosted API to compute these — manual iteration is fine but slower. Set `eps` aggressively (`1e14` ≈ 0.01%); too loose and you get bad price.

## Redeeming at maturity

After expiry, PT is redeemable 1:1 via `redeemPyToToken`:

```solidity
PENDLE_ROUTER.redeemPyToToken(receiver, address(yt), ptAmount, output);
```

Don't forget that PT does not auto-redeem. Holders must call. If you've built a vault on top of PT, schedule the redeem in your roll/expiry handler.

## Pendle as collateral (Aave V3)

Aave has approved several Pendle PTs as collateral on mainnet (PT-sUSDe, PT-eETH, PT-stETH for selected expiries). The supply oracle uses a custom `PendlePYLpOracle` that prices PT at its discounted-cashflow value.

Pattern: use PT as collateral, borrow stables, leverage the fixed yield.

```
1. Buy PT-sUSDe-31DEC26 at $0.92            (locks in ~9% annualized)
2. Supply PT to Aave, borrow USDC at ~85% LTV
3. Buy more PT with the borrowed USDC
4. Loop ~3 times → ~3.5x leverage on a fixed-yield position
```

Risk: the oracle prices PT off the Pendle pool; thin liquidity → wide oracle deviation → premature liquidation. Aave caps the supply per asset for exactly this reason.

## YT decay accounting

YT's price approaches 0 as maturity approaches. Don't write a vault that "holds YT" without accounting for this — your `totalAssets()` should mark YT to its current `pendleYTOracle` price, not to face value.

```solidity
// In your vault's totalAssets()
uint256 ytValue = (ytBalance * IPYTOracle(oracle).getYtToAssetRate(market)) / 1e18;
return underlyingBalance + ytValue + ptValue;
```

Don't omit YT from totalAssets — your share price drifts as YT decays.

## Common pitfalls

- **Confusing PT discount with APY**: A PT trading at $0.96 with 6 months to maturity = ~8% annualized, not 4%. Annualize the discount.
- **Treating expired markets as live**: post-maturity markets stop trading. Your strategy must handle expiry: redeem or roll.
- **Not handling the SY layer**: you can't deposit raw stETH into PT — you go through SY-stETH first. The Router handles this for you, but if you bypass and call the SY/Market directly, you must wrap manually.
- **Borrowing against PT near maturity**: oracle volatility increases as TTM shrinks. Liquidations spike in the last 1–2 weeks. Reduce your leverage as you approach expiry.
- **Hardcoded markets**: each PT/YT pair is a distinct market with a fixed expiry. Hardcoding `PT_STETH_26JUN26` works until June 26 — then your vault breaks. Use the market factory and a maturity-rolling handler.
- **Points/airdrop markets**: YT-eETH, YT-ezETH, YT-rsETH carry implicit points. Your YT might lose value when the points campaign ends, even before maturity. Read the protocol's points policy.
- **Slippage on YT swaps**: YT pools are thinner than PT pools. A $100k YT trade can move price 1–3%. Always check off-chain quote vs realized.

## When NOT to use Pendle

- Short time horizons (<30 days). Discount math is small; gas/slippage eats it.
- Underlying with no clear yield (governance tokens, memecoins). PT/YT splits make no sense.
- Need instant exit. PT secondary liquidity is meaningful but not infinite — exiting $5M of PT on a thin market moves price.
- You don't understand the underlying yield mechanism. PT-XYZ is only as safe as XYZ.

## What to read next

- `references/aave-and-lending-flows.md` — Pendle PT as collateral
- `references/dex-mechanics.md` — Pendle's AMM is a custom curve, not constant-product
- `addresses/SKILL.md` — Pendle Router + market addresses per chain
- Pendle docs: https://docs.pendle.finance/
- Pendle SDK: https://github.com/pendle-finance/pendle-sdk-core-v2-public
