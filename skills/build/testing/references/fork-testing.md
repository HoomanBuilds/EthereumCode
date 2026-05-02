# Fork Testing Patterns

How to write tests that run against real deployed protocols on a mainnet (or L2) fork. This catches integration bugs mocks can't — token quirks, oracle staleness, real liquidity conditions, governance-reachable parameter changes.

## Setup

In `foundry.toml`:

```toml
[rpc_endpoints]
mainnet  = "${MAINNET_RPC_URL}"
base     = "${BASE_RPC_URL}"
arbitrum = "${ARBITRUM_RPC_URL}"
optimism = "${OPTIMISM_RPC_URL}"

[etherscan]
mainnet = { key = "${ETHERSCAN_API_KEY}", chain = "mainnet" }
base    = { key = "${ETHERSCAN_API_KEY}", chain = "base" }
```

(Etherscan v2 unified API — same key works across all supported chains; pass `chain` instead of multiple keys.)

`MAINNET_RPC_URL` should be an archive node when you fork at historical blocks (Alchemy free tier covers most blocks; use a paid tier for older history).

## Forking patterns

### Per-test fork

```solidity
contract SwapTest is Test {
    function setUp() public {
        vm.createSelectFork("mainnet", 19_000_000);  // pin block for reproducibility
    }

    function test_uniswapSwap() public {
        // ...
    }
}
```

Pin the block number — gas, prices, and protocol state at "latest" change daily and break tests over time.

### Multi-chain fork test

```solidity
contract MultiChainTest is Test {
    uint256 mainnetFork;
    uint256 baseFork;

    function setUp() public {
        mainnetFork = vm.createFork("mainnet", 19_000_000);
        baseFork    = vm.createFork("base", 12_000_000);
    }

    function test_acrossBridge() public {
        vm.selectFork(mainnetFork);
        // deposit on mainnet
        spoke.deposit{value: 1 ether}(...);

        vm.selectFork(baseFork);
        // simulate fill on base
        spokeBase.fillRelay(...);
    }
}
```

Each `createFork` is independent state. Switch with `selectFork`. Forking is cached locally — repeated runs against the same block are fast after the first.

### Make a contract persistent across forks

```solidity
MyContract impl = new MyContract();
vm.makePersistent(address(impl));

vm.selectFork(mainnetFork);
// impl exists here
vm.selectFork(baseFork);
// impl exists here too, with the same code
```

Useful when you deploy a test helper and want to reuse it. Not transitive — persist all dependencies separately.

## Funding actors with real tokens

`deal` writes the storage slot directly:

```solidity
deal(address(USDC), alice, 10_000e6, true);   // adjust=true updates totalSupply
```

For tokens with non-standard storage (proxies pointing at unusual layouts, rebasing tokens), `deal` may write the wrong slot. Workarounds:

- **Whale impersonation**: find an address with a large balance and `vm.prank(whale)` to transfer.

```solidity
address whale = 0x55FE002aefF02F77364de339a1292923A15844B8;  // Circle USDC whale
vm.prank(whale);
IERC20(USDC).transfer(alice, 10_000e6);
```

- **Mint via the protocol's mint path**: e.g., for stETH, `vm.deal(alice, 100 ether); vm.prank(alice); LIDO.submit{value: 100 ether}(address(0));`.

## Testing against real Uniswap

```solidity
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract ForkSwapTest is Test {
    ISwapRouter constant ROUTER = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    address    constant USDC   = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address    constant WETH   = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork("mainnet", 19_000_000);
    }

    function test_swapUSDCforWETH() public {
        deal(USDC, alice, 1000e6, true);

        vm.startPrank(alice);
        IERC20(USDC).approve(address(ROUTER), 1000e6);

        ISwapRouter.ExactInputSingleParams memory p = ISwapRouter.ExactInputSingleParams({
            tokenIn: USDC, tokenOut: WETH, fee: 500,
            recipient: alice, deadline: block.timestamp + 60,
            amountIn: 1000e6, amountOutMinimum: 0, sqrtPriceLimitX96: 0
        });

        uint256 wethOut = ROUTER.exactInputSingle(p);
        vm.stopPrank();

        assertGt(wethOut, 0);
        assertEq(IERC20(WETH).balanceOf(alice), wethOut);
    }
}
```

Using a pinned block: the WETH price at block 19,000,000 is fixed, so `wethOut` is deterministic — useful for assertions.

## Testing oracle interactions

```solidity
function test_depositUsesFreshPrice() public {
    vm.createSelectFork("mainnet", 19_000_000);
    // The oracle has the price as of 19,000,000

    vault.deposit(...);
    // Vault should use the live oracle answer

    // Force-stale: warp 2 hours past the heartbeat
    vm.warp(block.timestamp + 2 hours);
    vm.expectRevert(StalePrice.selector);
    vault.deposit(...);
}
```

For sequencer-uptime feeds on L2, fork the L2 and assert your contract reverts when the feed reports `down`:

```solidity
// Read the sequencer feed slot, write 1 (down), and check revert
bytes32 slot = bytes32(uint256(0));   // feed-specific
vm.store(SEQUENCER_FEED, slot, bytes32(uint256(1)));
vm.expectRevert(SequencerDown.selector);
vault.deposit(...);
```

## Testing token quirks

Real tokens have edge cases that mocks miss:

- **USDT** reverts when changing a non-zero allowance. Test that your code zeros first or uses `forceApprove`.
- **Fee-on-transfer tokens** (some forks of UNI, PAXG) deduct on transfer. Test that your accounting reads `balanceAfter - balanceBefore`, not the input amount.
- **Rebasing tokens** (stETH) change balances without `Transfer` events. Test that storing a number and reading it later doesn't break.
- **Tokens with hooks** (USDC has callbacks via Permit2 integrations) — test reentrancy paths.
- **Blocklist tokens** (USDC, USDT can blacklist). Test what your protocol does when a user is suddenly blocked.

```solidity
function test_blacklistedRecipientCannotReceiveUSDC() public {
    address blocked = 0xfBb1b73C4f0BDa4f67dcA266ce6Ef42f520fBB98;  // example, verify
    deal(USDC, alice, 1000e6, true);

    vm.prank(alice);
    vm.expectRevert(); // USDC reverts on blacklisted recipient
    IERC20(USDC).transfer(blocked, 100e6);
}
```

## Forking strategies

### Pin block: deterministic, slow first run

```solidity
vm.createSelectFork("mainnet", 19_000_000);
```

Pros: same prices, same state, every run; debuggable; cacheable.
Cons: first run downloads state (~30s); state goes stale relative to "today" (governance changes, asset listings).

### Latest block: real-time, non-deterministic

```solidity
vm.createSelectFork("mainnet");   // no block number
```

Pros: catches issues with the very latest state.
Cons: tests can break overnight if governance flips a parameter.

For production: pin the block. Bump it monthly to catch state drift, but do the bump consciously.

### Pre-event vs post-event blocks

When a known incident or governance change happened at block X:

```solidity
function test_behaviorBeforeMigration() public {
    vm.createSelectFork("mainnet", 18_999_000);   // before migration
    // ... assert old behavior ...
}

function test_behaviorAfterMigration() public {
    vm.createSelectFork("mainnet", 19_001_000);   // after migration
    // ... assert new behavior ...
}
```

Useful for upgrade tests and post-mortem analysis.

## Caching

Foundry caches fork state in `~/.foundry/cache/rpc/<chain>/<block>/`. Repeated `forge test` runs hit the cache, no RPC. To clear:

```bash
forge clean
# or selectively:
rm -rf ~/.foundry/cache/rpc/mainnet/19000000/
```

CI: cache the directory across runs to skip RPC roundtrips.

## RPC choice for forking

| Provider | Notes |
|---|---|
| Alchemy | Generous free tier; archive included up to recent history; `eth_getProof` supported (needed for some advanced replays) |
| Infura | Reliable; archive on paid tiers |
| QuickNode | Pay-per-CU; archive on most plans |
| dRPC | Aggregator with fallback; no free archive |
| Reth/Erigon (self-hosted) | Free, fast, but operational burden |

Set `--rpc-url` per test invocation or use `[rpc_endpoints]` in `foundry.toml`. Don't commit RPC URLs with API keys; use env vars and `.env`.

## Speed

Fork tests are slower than unit tests by 1–2 orders of magnitude:

- Unit test: <100ms
- Fork test (cached): 200–800ms
- Fork test (cold): 5–30s

Strategies:

- **Group fork tests in one file**: `setUp` with one fork is amortized across many tests.
- **Two test profiles**:
  ```toml
  [profile.default]
  match_path = "test/unit/**"

  [profile.fork]
  match_path = "test/fork/**"
  ```
  CI runs `forge test` (fast) by default; runs `FOUNDRY_PROFILE=fork forge test` on a separate job.
- **Pin blocks**: cold cache misses are the slow part.

## Common pitfalls

- **Unpinned forks break overnight**: use `vm.createSelectFork("mainnet", BLOCK)` not `vm.createSelectFork("mainnet")`.
- **`deal` on weird tokens**: silently writes the wrong slot. If balance assertions fail mysteriously, switch to whale impersonation.
- **Whale balance changes**: an address that had 1B USDC two months ago might have moved it. Verify the whale still has funds at your pinned block.
- **Fork-specific cheatcodes**: `vm.broadcast` doesn't work in fork tests (it's for `forge script`). Use `vm.prank`.
- **Cross-fork state leakage**: switching forks resets state per fork — but the test contract itself persists. Locals and storage on the test contract carry; on the SUT do not.
- **Approving real tokens in a long-running test**: USDT non-zero-approval reverts apply on the fork too. Use `forceApprove` or zero-then-set.
- **Block reorgs on "latest"**: forking against a chain still in flux means a reorg between `createFork` and the actual call returns inconsistent state. Always pin in CI.

## What to read next

- `references/foundry-cheatcodes.md` — `prank`, `deal`, `mockCall`
- `references/fuzz-and-invariants.md` — invariant tests over forked state
- `references/security-test-cases.md` — fork-test patterns for known attack classes
- Foundry forking: https://book.getfoundry.sh/forge/fork-testing
