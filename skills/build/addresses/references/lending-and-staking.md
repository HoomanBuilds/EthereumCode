# Lending and Staking Cookbook

Working snippets for Aave V3, Compound V3, Lido, Rocket Pool, MakerDAO/Sky, and EigenLayer. Verify addresses against `SKILL.md` and protocol docs before each deployment — lending markets pause/migrate frequently.

## Aave V3

Aave V3 is a single `Pool` contract per chain that supports many assets. Borrow against supplied collateral; reserve params (LTV, liquidation threshold) are configurable per asset.

### Supply / withdraw / borrow

```solidity
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";

IPool constant POOL = IPool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2); // mainnet

function supplyUSDC(uint256 amount) external {
    IERC20(USDC).safeIncreaseAllowance(address(POOL), amount);
    POOL.supply(USDC, amount, msg.sender, /*referralCode*/ 0);
}

function borrowDAI(uint256 amount) external {
    // interestRateMode: 1 = stable (deprecated on most assets), 2 = variable
    POOL.borrow(DAI, amount, /*rateMode*/ 2, /*referralCode*/ 0, msg.sender);
}

function repayDAI(uint256 amount) external {
    IERC20(DAI).safeIncreaseAllowance(address(POOL), amount);
    POOL.repay(DAI, amount, /*rateMode*/ 2, msg.sender);
}

function withdrawUSDC(uint256 amount) external {
    POOL.withdraw(USDC, amount, msg.sender);   // pass type(uint256).max for full
}
```

`supply` mints aTokens (rebasing-style; balance grows with interest). `withdraw` burns them. Stable rate mode is disabled on most reserves post-Aave-V3.0.2 — pass `2` (variable) unless you know the asset still supports stable.

### Reading user data

```solidity
import {DataTypes} from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";

(uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase,
 uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)
    = POOL.getUserAccountData(user);

// healthFactor: 1e18 = exactly at liquidation. <1e18 = liquidatable.
// Values are in "base currency" (USD with 8 decimals on most markets).
```

A health factor of `1.0` (`1e18`) is the liquidation boundary. UIs typically warn below `1.5` and block borrows that would drop below `1.1`.

### Flash loans

```solidity
import {IFlashLoanReceiver} from "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanReceiver.sol";

contract FlashBorrower is IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // ... do the arbitrage / liquidation here ...
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 owed = amounts[i] + premiums[i];
            IERC20(assets[i]).safeIncreaseAllowance(msg.sender /* Pool */, owed);
        }
        return true;
    }

    function trigger(address asset, uint256 amount) external {
        address[] memory assets = new address[](1); assets[0] = asset;
        uint256[] memory amounts = new uint256[](1); amounts[0] = amount;
        uint256[] memory modes = new uint256[](1); modes[0] = 0; // 0 = repay same tx
        POOL.flashLoan(address(this), assets, amounts, modes, address(this), "", 0);
    }
}
```

Aave V3 flash loan premium is currently 5 bps (0.05%) — verify the live `_FLASHLOAN_PREMIUM_TOTAL` on the Pool, governance can change it.

## Compound V3 (Comet)

Comet is one-borrow-asset-per-market. The mainnet USDC market has cUSDCv3 — supply collateral assets (WETH, WBTC, etc.), borrow USDC.

```solidity
import {IComet} from "@compound-finance/comet/contracts/IComet.sol";

IComet constant cUSDCv3 = IComet(0xc3d688B66703497DAA19211EEdff47f25384cdc3);

// Supply collateral
IERC20(WETH).safeIncreaseAllowance(address(cUSDCv3), wethAmount);
cUSDCv3.supply(WETH, wethAmount);

// Borrow base asset (USDC) — Comet treats withdraw of base as borrow when balance is negative
cUSDCv3.withdraw(USDC, usdcAmount);

// Repay
IERC20(USDC).safeIncreaseAllowance(address(cUSDCv3), usdcAmount);
cUSDCv3.supply(USDC, usdcAmount);

// Withdraw collateral
cUSDCv3.withdraw(WETH, wethAmount);
```

Key differences from Aave:

- Single base asset per market — you cannot borrow WETH from cUSDCv3.
- Collateral does not earn interest in Comet (lives in the contract, not lent out).
- `supply(USDC, ...)` and `withdraw(USDC, ...)` flip between supplying base and repaying/borrowing — Comet computes the direction from your principal sign.
- `getBorrowRate(utilization)` and `getSupplyRate(utilization)` return rates per second, scaled by `1e18`. Annualize with `* 365 * 86400`.

User health:

```solidity
int256 baseBalance = cUSDCv3.balanceOf(user);          // positive = supplied; negative = borrowed
uint256 collateral  = cUSDCv3.collateralBalanceOf(user, WETH);

// Borrow capacity check — Comet has isBorrowCollateralized()
bool ok = cUSDCv3.isBorrowCollateralized(user);
```

## Lido — stETH / wstETH

Two share representations:

- **stETH** (`0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84`) — rebasing; balance grows daily as rewards accrue. Hostile to most DeFi (balances change without `Transfer` events).
- **wstETH** (`0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0`) — non-rebasing wrapper. 1 wstETH represents a fixed share of the pool; its stETH-equivalent value grows. Use this in lending markets and AMMs.

### Stake ETH for stETH

```solidity
ILido constant LIDO = ILido(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);

// Deposit ETH, receive stETH (1:1 at deposit time)
uint256 sharesMinted = LIDO.submit{value: msg.value}(address(0));
// referral: pass address(0) or your fee-share address
```

The `submit()` payable function pays in ETH and credits stETH to `msg.sender`. There's a daily stake limit (`getCurrentStakeLimit()`); when hit, deposits revert until the limit refills or use a market swap (Curve stETH/ETH pool) instead.

### Wrap stETH ↔ wstETH

```solidity
IWstETH constant WST = IWstETH(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);

IERC20(STETH).safeIncreaseAllowance(address(WST), stETHAmount);
uint256 wstAmount = WST.wrap(stETHAmount);

uint256 stBack = WST.unwrap(wstAmount);

// Conversion helpers (view functions)
uint256 wsteth = WST.getWstETHByStETH(stETHAmount);
uint256 steth  = WST.getStETHByWstETH(wstAmount);
uint256 rate   = WST.stEthPerToken();   // 1e18-scaled stETH per 1 wstETH
```

### Withdraw queue (unstake)

Withdrawals are not instant. Request via the `WithdrawalQueueERC721` (`0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1`) — you receive an NFT; redeem it once the request is finalized (typically 1–5 days, depending on validator queue + buffer).

```solidity
IWithdrawalQueue constant WQ = IWithdrawalQueue(0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1);

uint256[] memory amounts = new uint256[](1); amounts[0] = stETHAmount;
IERC20(STETH).safeIncreaseAllowance(address(WQ), stETHAmount);
uint256[] memory ids = WQ.requestWithdrawals(amounts, msg.sender); // mints NFT(s)

// Later, when finalized:
uint256 lastFinalized = WQ.getLastFinalizedRequestId();
require(ids[0] <= lastFinalized, "not finalized yet");
uint256[] memory hints = WQ.findCheckpointHints(ids, 1, WQ.getLastCheckpointIndex());
WQ.claimWithdrawals(ids, hints); // sends ETH to NFT owner
```

For users who want instant exit, swap stETH or wstETH on Curve / Uniswap V3 — Curve's stETH/ETH pool is the deepest. Expect a small discount (typically <0.1% in calm markets, several % in stress).

## Rocket Pool — rETH

Non-rebasing share token. 1 rETH represents a share of the staking pool; its ETH value grows as validators accrue rewards.

### Mint rETH (deposit ETH)

```solidity
IRocketDepositPool constant DEPOSIT = IRocketDepositPool(0x2cac916b2A963Bf162f076C0a8a4a8200BCFBfb4);

DEPOSIT.deposit{value: msg.value}();   // mints rETH at current exchange rate
```

The deposit pool has a max capacity (`getMaximumDepositAmount()`); when full, mints revert until validators are spun up or use the market.

### Read exchange rate

```solidity
IRocketTokenRETH constant RETH = IRocketTokenRETH(0xae78736Cd615f374D3085123A210448E74Fc6393);

uint256 ethPerRETH = RETH.getExchangeRate();           // 1e18-scaled
uint256 ethValue   = RETH.getEthValue(rethAmount);
uint256 rethValue  = RETH.getRethValue(ethAmount);
```

`getExchangeRate()` updates roughly once per day from the validator network's reported balances.

### Burn rETH (instant exit, capacity-permitting)

```solidity
RETH.burn(rethAmount); // returns ETH if the deposit pool has enough; else revert — sell on market
```

For consistent exits, use Uniswap V3 rETH/WETH or Balancer's rETH/WETH pool.

## MakerDAO / Sky — sDAI

`sDAI` (`0x83F20F44975D03b1b09e64809B757c47f942BEeA`) is an ERC-4626 vault wrapping the DAI Savings Rate (DSR). Deposit DAI, get sDAI; the redemption rate grows according to the DSR.

```solidity
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

IERC4626 constant SDAI = IERC4626(0x83F20F44975D03b1b09e64809B757c47f942BEeA);

IERC20(DAI).safeIncreaseAllowance(address(SDAI), daiAmount);
uint256 shares = SDAI.deposit(daiAmount, msg.sender);

uint256 daiBack = SDAI.redeem(shares, msg.sender, msg.sender);

// Read DSR
IPot constant POT = IPot(0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7);
uint256 dsrPerSecond = POT.dsr();   // 1e27-scaled (RAY)
// Annualize: ((dsrPerSecond / 1e27) ^ (365*86400)) - 1
```

The DSR can be 0% — Maker governance toggles it. `pot.chi()` is the cumulative rate accumulator.

Following the Sky rebrand, USDS / sUSDS are the parallel pair. sDAI keeps working; new integrations may prefer sUSDS — verify deployment status at https://docs.sky.money/.

## EigenLayer (Mainnet)

Restaking: deposit LSTs (or native ETH via EigenPods) into Strategies; delegate to Operators; AVSs slash/reward delegated stake.

```solidity
import {IStrategyManager} from "@eigenlayer/contracts/interfaces/IStrategyManager.sol";
import {IDelegationManager} from "@eigenlayer/contracts/interfaces/IDelegationManager.sol";

IStrategyManager   constant SM = IStrategyManager(0x858646372CC42E1A627fcE94aa7A7033e7CF075A);
IDelegationManager constant DM = IDelegationManager(0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A);

// 1) deposit LST shares into a Strategy
IERC20(stETH).safeIncreaseAllowance(address(SM), amount);
uint256 shares = SM.depositIntoStrategy(STETH_STRATEGY, IERC20(stETH), amount);

// 2) delegate shares to an Operator
IDelegationManager.SignatureWithExpiry memory sig;   // empty for self / direct
DM.delegateTo(operator, sig, /*approverSalt*/ bytes32(0));

// 3) queue a withdrawal (must wait ~7 days minWithdrawalDelayBlocks)
IDelegationManager.QueuedWithdrawalParams[] memory params = ...;
DM.queueWithdrawals(params);
```

Slashing went live with the Slashing Upgrade — verify exact entrypoints and the `allocationManager` interface at https://docs.eigenlayer.xyz/, since it changes per release.

## Common pitfalls

- **stETH balances change without Transfer events.** Don't cache them; always `balanceOf` at point of use. For DeFi, prefer wstETH.
- **Aave's `interestRateMode`**: stable mode is mostly disabled. Pass `2` (variable). Calling with `1` reverts on most assets.
- **Aave reserve pauses**: each asset can be paused/frozen by governance. `getReserveData(asset).configuration` exposes flags. Wrap supply/borrow in try/catch in production.
- **Comet base supply vs withdraw** is direction-aware — supplying base when you have a borrow position **repays** it; withdrawing base when balance is positive **withdraws**, when 0 it **borrows**.
- **Lido stake limit** can be 0 during high-demand periods. Check `getCurrentStakeLimit()` and either route through Curve or queue a retry.
- **Lido withdrawal NFT**: requesting a withdrawal moves stETH to the queue — you can't sell it after. If you might need optionality, swap on Curve instead.
- **Rocket Pool burn** reverts when deposit-pool capacity is low. Always have a market-swap fallback.
- **rETH and wstETH are not 1:1 with ETH.** Loops that deposit "1 ETH worth" need to read `getExchangeRate()` / `stEthPerToken()` first.
- **EigenLayer withdrawal delay**: ~7 days minimum. UI must show this clearly.

## What to read next

- `references/uniswap-cookbook.md` — swapping into and out of these positions
- `references/oracles-and-bridges.md` — pricing collateral via Chainlink, sequencer-uptime gating
- `references/safe-and-aa.md` — running these flows from a Safe or 4337 account
- Aave V3: https://docs.aave.com/developers/
- Compound V3: https://docs.compound.finance/
- Lido: https://docs.lido.fi/
- Rocket Pool: https://docs.rocketpool.net/
- EigenLayer: https://docs.eigenlayer.xyz/
