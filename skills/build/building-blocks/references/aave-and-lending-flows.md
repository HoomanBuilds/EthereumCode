# Aave and Lending Flows

How to compose Aave V3, Compound III (Comet), and Morpho into the DeFi patterns founders actually ask for: leverage loops, refinance, liquidation, delta-neutral vaults. Function signatures and address details live in `addresses/references/lending-and-staking.md`; this file is about *what to call when and why*.

## Pick a market

| Need | Use |
|---|---|
| Multi-asset, isolated assets, e-modes | **Aave V3** (mainnet, Base, Arbitrum, Optimism, Polygon) |
| Single base asset per market, simpler model | **Compound III (Comet)** — one base asset, many collaterals |
| Curated/permissioned markets, MetaMorpho vaults | **Morpho Blue** (mainnet, Base) |
| Capital efficiency on a known pair (ETH ↔ wstETH) | **Morpho Blue** isolated market |
| Pendle PT collateral | **Aave V3** (selected markets) or **Morpho Blue** |

Aave V3 is the safe default. Comet wins when you only borrow one asset against many collaterals (e.g. ETH-only borrows). Morpho Blue wins when you need bespoke risk parameters or curated markets.

## Pattern: leverage loop (Aave V3)

Goal: long ETH with stablecoin debt, looped to ~5x.

```
1. supply 1 ETH         → aETH minted
2. borrow X USDC         → debt position opens
3. swap USDC → ETH      via Uniswap/aggregator
4. supply ETH back      → more aETH
5. goto 2 with reduced X
```

Leverage cap = `1 / (1 - LTV)`. ETH at 80% LTV → max 5x. In practice stay 1–2 ticks below max so a small price move doesn't liquidate you.

```solidity
// loop with flash loan (1 tx, no manual iteration)
function lever(uint256 ethIn, uint256 targetLeverage) external {
    uint256 borrowAmount = _computeBorrowFor(ethIn, targetLeverage);
    bytes memory data = abi.encode(msg.sender, ethIn);
    POOL.flashLoanSimple(address(this), USDC, borrowAmount, data, 0);
}

function executeOperation(
    address asset, uint256 amount, uint256 premium,
    address /*initiator*/, bytes calldata params
) external override returns (bool) {
    (address user, uint256 ethIn) = abi.decode(params, (address, uint256));

    // 1. Swap flash USDC -> ETH on Uniswap
    uint256 ethOut = _swapUSDCtoETH(amount);

    // 2. Supply (ethIn + ethOut) on user's behalf
    IERC20(WETH).approve(address(POOL), ethIn + ethOut);
    POOL.supply(WETH, ethIn + ethOut, user, 0);

    // 3. Borrow on user's behalf to repay flash loan + premium
    POOL.borrow(USDC, amount + premium, 2 /*variable*/, 0, user);

    // 4. Approve repayment
    IERC20(USDC).approve(address(POOL), amount + premium);
    return true;
}
```

Pre-2026 versions used `interestRateMode=1` (stable) — that's deprecated. Always use `2` (variable).

For the user to borrow on your contract's behalf in step 3, they must have `approveDelegation` granted on the variable debt token to your contract. Without it, step 3 reverts.

## Pattern: refinance (Aave → Comet via flash loan)

User has $1M ETH supplied + $500k USDC debt on Aave; wants to migrate to Comet (lower rate).

```
flash 500k USDC from Aave
repay user's USDC debt on Aave
withdraw user's ETH from Aave        # collateralization OK now
supply ETH to Comet on user's behalf
withdraw 500k USDC from Comet (it's a borrow against their ETH)
repay flash loan
```

- User must approve your contract to manage their Aave aTokens (`aETH.approve(refinancer, max)`) and to borrow on Comet (`Comet.allow(refinancer, true)`).
- Done in one tx — user is never under-collateralized.
- Free if your contract is the flash-loan receiver and final repayer (no premium charged when the `final` step is itself a Comet borrow at the new rate).

## Pattern: liquidation (Aave V3)

When a position's health factor < 1, anyone can liquidate up to 50% of the debt and receive the corresponding collateral + a bonus (5–10%, market-dependent).

```solidity
// Repay USDC debt on user, receive WETH + bonus
POOL.liquidationCall(
    address(WETH),     // collateralAsset
    address(USDC),     // debtAsset
    user,              // user being liquidated
    debtToCover,       // debt amount you repay (in USDC)
    false              // false = receive underlying, true = aTokens
);
```

Liquidator profit = `bonus * collateralValue` − `swap_slippage` − `gas`. With L2 gas at sub-dollar, even tiny liquidations are profitable; competition is fierce. Production liquidator infra:
- Chainlink price feeds + your own oracle redundancy to detect underwater positions before others.
- Flash loan to fund `debtToCover` — you never need your own capital.
- Atomic swap of seized collateral back to debt asset via aggregator.
- Mempool monitoring (or block builder) to land before competitors.

For a founder building a lending market: implement your own keeper if you can't rely on the existing keeper ecosystem; otherwise positions stay underwater and bad debt accumulates.

## Pattern: delta-neutral yield (looped LST + perp short)

Combine LST yield (~3%) with perp funding rate (~5–15% on bull markets) for a delta-neutral position:

```
1. supply wstETH on Aave            (earn ~3% staking yield)
2. borrow ETH against wstETH         (e-mode: 95% LTV, 0.1% borrow cost)
3. short equivalent ETH on GMX/Hyperliquid  (collect funding rate)
```

Net: long ETH (from step 1) + short ETH (step 3) = delta-zero. Yield = staking yield − borrow rate + funding rate.

Risks people miss:
- **wstETH/ETH peg** can drift to 0.95 in stress; e-mode liquidation triggers.
- **Funding rate flips negative** in bear markets — you pay shorts.
- **Perp DEX downtime** during peak volatility — your hedge fails when you most need it.
- **LST slashing** — small probability, large loss.

## Pattern: collateral swap

Swap one collateral type for another without going below the LTV.

```
flash X USDC
withdraw old collateral via Aave
swap old → new collateral
supply new collateral
borrow X USDC to repay flash
```

Same as refinance pattern but stays within Aave. Useful for "I have stETH but want to pivot to wBTC without closing my borrow."

## Aave e-mode (efficiency mode)

E-mode lets you borrow at higher LTV when collateral and debt are correlated:

| E-mode | LTV | Pairs |
|---|---|---|
| Stablecoins | 93% | USDC/USDT/DAI/sDAI |
| ETH-correlated | 95% | ETH/wstETH/cbETH/rETH |
| BTC-correlated | 80–90% | wBTC/tBTC |

Trade-off: in e-mode you can ONLY borrow correlated assets. Want to borrow USDC against stETH? Disable e-mode (drops LTV to ~75%).

```solidity
POOL.setUserEMode(1);  // 1 = stables, 2 = ETH-correlated (per market)
```

Check `POOL.getEModeCategoryData(id)` for the current category's parameters — Aave governance changes them.

## Comet vs Aave for borrowers

Comet (Compound III) markets are organized **by base asset**. The mainnet ETH market lets you borrow ETH only, against ETH-correlated collateral. The USDC market lets you borrow USDC only, against any approved collateral.

```solidity
IComet ETH_MARKET = IComet(0xA17581A9E3356d9A858b789D68B4d866e593aE94);

// Supply ETH-correlated collateral
ETH_MARKET.supply(wstETH, amount);

// Borrow ETH (the base asset) — Comet's API: withdraw the base asset
ETH_MARKET.withdraw(WETH, borrowAmount);   // creates debt

// Repay
ETH_MARKET.supply(WETH, repayAmount);      // reduces debt
```

The `supply`/`withdraw` API is direction-aware: supplying the base asset reduces debt; supplying collateral increases collateral. Catch new devs every time.

## Morpho Blue: isolated markets

Each market is a 4-tuple `(loanToken, collateralToken, oracle, IRM, LLTV)` — completely isolated. No e-mode, no shared risk.

```solidity
MarketParams memory p = MarketParams({
    loanToken: USDC,
    collateralToken: wstETH,
    oracle: 0x...,        // Chainlink-based or custom
    irm: ADAPTIVE_IRM,
    lltv: 0.945e18        // 94.5% liquidation LTV
});
MORPHO.supply(p, amount, 0, address(this), "");
MORPHO.supplyCollateral(p, collateralAmt, address(this), "");
MORPHO.borrow(p, borrowAmt, 0, address(this), address(this));
```

MetaMorpho vaults sit on top: they're ERC-4626 vaults that allocate across multiple Morpho Blue markets per a curator's risk policy. Integrate the MetaMorpho vault if you want a one-token interface; integrate Blue directly if you need a specific market.

## Common pitfalls

- **Forgetting `approveDelegation`** for borrow-on-behalf — the inner borrow reverts even though the call shape looks right.
- **Mixing interest rate modes** — passing `1` (stable) in 2026 reverts; only `2` (variable) is supported.
- **Liquidating with `receiveAToken=true`** unintentionally — you receive the aToken (still earning interest), not the underlying. Fine if intentional, surprising if not.
- **Health factor in 1e18**: 1.0 = liquidatable. 0.95 means already insolvent. Don't compare to 1.
- **Using Comet `supply(base, amount)` to mean borrow** — supplying base reduces debt. To borrow, call `withdraw(base, amount)`.
- **Hardcoding e-mode IDs across chains** — IDs differ per market deployment. Read `getEModeCategoryData` per chain.
- **No oracle redundancy in your own lending product** — Aave got Mango'd by relying on a single CEX oracle. Always have a fallback or a TWAP secondary.

## What to read next

- `addresses/references/lending-and-staking.md` — verified addresses + raw call shapes
- `references/dex-mechanics.md` — swap legs of leverage / refinance flows
- `references/pendle-and-yield-tokens.md` — using PT as Aave/Morpho collateral
- Aave V3 docs: https://docs.aave.com/developers/getting-started/readme
- Morpho Blue docs: https://docs.morpho.org/morpho-blue/
