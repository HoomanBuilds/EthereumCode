# Uniswap V4 Hooks Cookbook

Hooks are V4's headline feature: arbitrary contract logic that PoolManager calls at specific points in a pool's lifecycle. They open up dynamic fees, custom oracles, limit orders, and MEV-resistant designs without forking the AMM. They're also the easiest place to footgun a pool — a buggy hook can lock LPs' funds or drain them. Treat hooks like you'd treat custom Vault strategies: high blast radius, mandatory invariant testing.

V4 went live Jan 31, 2025. PoolManager addresses are NOT deterministic across chains — fetch from `addresses/SKILL.md` or https://docs.uniswap.org/contracts/v4/deployments.

## What a hook can do

Eight hook points, four pairs:

| Point | Fires | Common uses |
|---|---|---|
| `beforeInitialize` / `afterInitialize` | Pool creation | Validate args, store per-pool config |
| `beforeAddLiquidity` / `afterAddLiquidity` | LP deposit | Whitelist LPs, charge entry fee, redirect rewards |
| `beforeRemoveLiquidity` / `afterRemoveLiquidity` | LP withdraw | Cooldown, exit fee |
| `beforeSwap` / `afterSwap` | Each swap | Dynamic fees, TWAP, limit orders, MEV auctions |
| `beforeDonate` / `afterDonate` | Donate flow | Track external rewards |

Plus three "return delta" variants (`beforeSwapReturnDelta`, `afterSwapReturnDelta`, `afterAddLiquidityReturnDelta`, `afterRemoveLiquidityReturnDelta`) that let the hook adjust the user's net token movement — needed for things like skim fees or hooks that route part of the swap elsewhere.

The set of hook points a contract implements is encoded in its **address bits**. PoolManager computes the expected bit pattern from the pool's `hooks` field and reverts if the contract doesn't have matching low-bit flags. This is why hooks are deployed via `CREATE2` with mining — you compute a salt that produces an address whose low bits match the permissions you want.

## Minimal hook skeleton

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";

contract MyHook is BaseHook {
    constructor(IPoolManager _pm) BaseHook(_pm) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function beforeSwap(
        address /*sender*/,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata /*hookData*/
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Return: selector, delta to apply (zero = no adjustment), fee override (or 0)
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
}
```

Inherit `BaseHook` from `v4-periphery` — it handles the boilerplate. Override only the hook points you need; `getHookPermissions` MUST match what you implement.

### Mining the address

```solidity
// scripts/DeployHook.s.sol
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG);
(address expected, bytes32 salt) = HookMiner.find(
    CREATE2_DEPLOYER,
    flags,
    type(MyHook).creationCode,
    abi.encode(poolManager)
);
MyHook hook = new MyHook{salt: salt}(poolManager);
require(address(hook) == expected, "address mismatch");
```

Mining takes a few seconds for one flag, longer if you need many. Cache the salt for redeploys.

## Pattern: dynamic fee

A pool can be created with `LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`) instead of a static fee. The hook returns a fee on every swap.

```solidity
function beforeSwap(
    address,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata,
    bytes calldata
) external override returns (bytes4, BeforeSwapDelta, uint24) {
    uint24 fee = _computeFee(key);          // e.g. read volatility oracle
    uint24 feeWithFlag = fee | uint24(0x400000);   // override flag
    return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, feeWithFlag);
}
```

The `0x400000` flag in the return value tells PoolManager to USE this fee for the current swap, overriding the pool default. Without it, PoolManager ignores the value.

Use cases:
- **Volatility-scaling** — read a Chainlink volatility feed; quote 5 bps in calm markets, 30 bps in fast markets.
- **Anti-toxic-flow** — quote a higher fee to known MEV searchers (sender allowlist).
- **Time-of-day** — wider spreads at low-liquidity hours.

Don't return values higher than `LPFeeLibrary.MAX_LP_FEE` (1_000_000 = 100%) — PoolManager reverts.

## Pattern: TWAP oracle (push model)

Pre-V4, oracles required a separate contract. With hooks, you can update on every swap:

```solidity
mapping(PoolId => Observation[]) public observations;

function afterSwap(
    address,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata,
    BalanceDelta,
    bytes calldata
) external override returns (bytes4, int128) {
    PoolId id = key.toId();
    (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(id);
    observations[id].push(Observation({
        ts: uint32(block.timestamp),
        sqrtPriceX96: sqrtPriceX96
    }));
    return (BaseHook.afterSwap.selector, 0);
}
```

Caveats:
- **Single-block TWAP is manipulable** — same flash-loan exposure as Uniswap V2 TWAP. Use a window of ≥30 minutes for borrowing/liquidation pricing.
- **Storage cost** — every swap pays an SSTORE. Cap the buffer length and overwrite oldest.
- **Don't skip swaps** — if your hook reverts inside `afterSwap`, the swap reverts too. Wrap external calls in try/catch.

## Pattern: limit orders

Hook stores standing orders; on each swap, fills any orders that the new price crosses.

```solidity
struct Order {
    address owner;
    int24  tickTarget;
    bool   zeroForOne;     // direction
    uint256 amount;
}
mapping(PoolId => Order[]) public book;

function afterSwap(
    address,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata,
    BalanceDelta,
    bytes calldata
) external override returns (bytes4, int128) {
    PoolId id = key.toId();
    (, int24 tick,,) = poolManager.getSlot0(id);
    _fillOrders(id, tick);
    return (BaseHook.afterSwap.selector, 0);
}
```

Real implementations (look at **Bunni**, **Arrakis**, **OOO Protocol**) handle:
- Tick crossings without re-entering the pool (would change tick again).
- Per-tick order books (gas-efficient lookup).
- Cancellation by the owner.

## Pattern: MEV-resistant pool (auction)

Auction the right to be first swapper of each block. Hook in `beforeSwap` checks the searcher paid the auction; otherwise reverts or applies a higher fee.

This is what **Sorella's Angstrom** and **CoW Hooks** are doing in production. Build only with a clear MEV theory of who's paying whom and why; otherwise you'll just rebuild Flashbots.

## Hook security

Hook bugs that have already happened to people:
- **Locked LP funds**: hook reverts on `beforeRemoveLiquidity` due to a bug → LPs can't exit. Test the failure path explicitly.
- **Sandwiched by the hook itself**: hook does an external call that the operator can frontrun. Don't make external calls inside `beforeSwap`/`afterSwap` unless you've thought about MEV.
- **Reentrancy via hooks**: hook re-enters PoolManager. PoolManager has its own reentrancy guard at the top level, but if your hook calls `unlock` or another pool's swap, you can corrupt state. Use `poolManager.unlock` only via well-known patterns.
- **Hook permissions vs address**: deploy with mismatched permissions and the pool init reverts. Always verify in CI: `vm.assertEq(uint160(address(hook)) & ALL_HOOK_FLAGS, expectedFlags)`.

Mandatory tests:
1. **Permission bit match** — hook address has exactly the bits its `getHookPermissions` returns.
2. **No-op on every hook point you don't implement** — calling `afterSwap` if you only declared `beforeSwap` should not corrupt state.
3. **Liquidity invariant** — after any sequence of swaps + hook calls, LPs can still withdraw their full position.
4. **Fee bounds** — dynamic fee always within `[MIN_FEE, MAX_FEE]`.
5. **Reentrancy** — fuzz a malicious token / external dep that re-enters during hook callback.

## Discovery

- Hook examples: `OpenZeppelin/uniswap-hooks` (audited base contracts, 2025+).
- Active hook protocols: Bunni V2, Arrakis V2, EulerSwap, Angstrom, CoW Hooks.
- Hook directory: https://hooks.uniswapfoundation.org/

## What to read next

- `references/dex-mechanics.md` — V2/V3/V4 swap math and Aero ve(3,3)
- `addresses/references/uniswap-cookbook.md` — Universal Router + Permit2 swap calls
- Uniswap V4 docs: https://docs.uniswap.org/contracts/v4/overview
