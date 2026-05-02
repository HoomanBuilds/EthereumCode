# Reproduce and Isolate

A bug you can't reproduce is a bug you can't fix. The first half of debugging is making the failure deterministic. The second half is narrowing it to the smallest input that triggers it.

For trace techniques see `references/trace-techniques.md`. For known bug shapes see `references/common-bug-patterns.md`.

## Step 1: Capture the failing scenario

Write down everything that varies:

- **Inputs** to the failing function (exact values, not "some big number")
- **Caller** address
- **Block number** (or time / chain state)
- **Token approvals** in place beforehand
- **Contract storage** at the moment of failure
- **Chain** (which network, which block height)

If any of these is "I think it was around X," you haven't captured it. Pin it exactly.

## Step 2: Pin the chain state

Most production bugs depend on chain state — a balance, an oracle price, an accumulated value. To reproduce locally:

```bash
anvil --fork-url $MAINNET_RPC --fork-block-number 18500000
```

Or in a Foundry test:

```solidity
function setUp() public {
    vm.createSelectFork("mainnet", 18_500_000);
}
```

Forking pins the state at that block. Now your test runs against the same data the failing tx saw.

## Step 3: Replay the failing transaction

If the bug is a real deployed transaction, you can replay it directly:

```bash
cast run --rpc-url $MAINNET_RPC <txHash>
```

This shows you every internal call, every revert, every storage read — exactly what happened.

If you don't have a tx hash but have inputs, write a test that invokes the contract identically:

```solidity
function test_reproDeposit() public {
    vm.createSelectFork("mainnet", 18_500_000);
    deal(USDC, alice, 1_000_000e6);
    vm.startPrank(alice);
    IERC20(USDC).approve(address(vault), 1_000_000e6);
    vault.deposit(1_000_000e6, alice);  // expect this to revert
    vm.stopPrank();
}
```

Run it. Confirm it fails with the same revert reason as production. Now you have a local repro.

## Step 4: Narrow the inputs

Once you can reproduce, find the *smallest* input that still fails.

If `deposit(1_000_000_000_000)` reverts but `deposit(100)` succeeds, binary-search:

```
1_000_000_000_000   FAIL
100                 PASS
500_000_000_000     ?
```

Halve until you find the boundary. The boundary often points at the bug:

- Reverts above `2^96` → likely a `uint96` overflow somewhere
- Reverts above the contract's USDC balance → missing balance check
- Reverts above 1e18 → likely a decimal mismatch

## Step 5: Narrow the call chain

If the failing test does 5 things:

```
1. Mint tokens
2. Approve vault
3. Deposit
4. Wait 1 day
5. Withdraw  ← FAILS
```

Comment out steps 1-2 and 4. Does it still fail (with appropriate state setup)? If so, the bug is in step 5 alone. If not, walk back.

Use `vm.skip(true)` or comment-out, not `try/catch` — you want failures to halt the test cleanly.

## Step 6: Print the relevant state

At the moment of failure, what does the contract see?

```solidity
function test_reproWithdraw() public {
    // ... setup ...

    console.log("vault balance", IERC20(USDC).balanceOf(address(vault)));
    console.log("user shares",   vault.balanceOf(alice));
    console.log("totalAssets",   vault.totalAssets());
    console.log("totalSupply",   vault.totalSupply());

    vm.prank(alice);
    vault.withdraw(amount, alice, alice);  // FAILS
}
```

Run with `-vvv` to see logs. Often the bug is obvious at this point:

```
vault balance     0
user shares       1000000000000000000
totalAssets       100
totalSupply       1000000000000000000
```

`vault balance = 0` while `totalAssets = 100` is the smoking gun — accounting state is out of sync with actual balance.

## Step 7: Form a single hypothesis

State the hypothesis as a falsifiable claim:

> "I think `_redeem` is computing `assets = shares * totalAssets / totalSupply`, but `totalAssets` is reading from a stored variable that wasn't updated after the last deposit."

Now you have something to test. Don't fix yet — verify.

## Step 8: Verify the hypothesis cheaply

The cheapest verification possible:

- A `console.log` showing the value differs from expectation
- A `cast call` against the storage slot
- A second test that asserts the precondition without executing the failing call

If the hypothesis is wrong, you've saved yourself from a wasted "fix." If it's right, you can now fix with confidence.

## Common reproduction failures

| Symptom | Cause |
|---|---|
| "It works in test but fails in prod" | Prod uses different token, different oracle, or different chain |
| "It fails sometimes" | Time-dependent (block.timestamp, oracle), MEV, or front-run |
| "It fails with a different revert each time" | State leakage between tests; use a fresh `setUp` |
| "Forge says PASS but the test should fail" | Test doesn't actually exercise the buggy path; coverage gap |
| "It passes locally, fails on CI" | Chain RPC differs; pin the fork block |

## Forge cheatsheet for state pinning

```solidity
// Pin block
vm.createSelectFork("mainnet", 18_500_000);

// Pin chain time
vm.warp(1_700_000_000);
vm.roll(18_500_000);

// Set token balance (no need to mint via the protocol)
deal(USDC, alice, 1_000_000e6);

// Set ETH balance
vm.deal(alice, 100 ether);

// Set storage directly (last resort)
vm.store(address(vault), bytes32(uint256(7)), bytes32(uint256(123)));

// Mock a return from another contract
vm.mockCall(
    ORACLE,
    abi.encodeWithSelector(IOracle.price.selector),
    abi.encode(uint256(2000e8))
);
```

## When the bug is non-deterministic

If you can't make it deterministic:

- It's MEV / front-running → look at mempool ordering, slippage
- It's oracle-related → mock the oracle to specific values
- It's time-related → use `vm.warp` to pin time
- It's gas-related → set explicit gas in `vm.txGasPrice`
- It's caller-related → use `vm.prank` with the exact address

A genuinely non-deterministic bug in a Solidity contract is rare. Usually you just haven't found the variable you're not pinning.

## A worked example

**Scenario:** ERC-4626 vault, user deposits, then withdraws same amount, gets fewer assets back than deposited.

1. **Capture:**
   - Inputs: `deposit(100e6)`, then `redeem(shares, alice, alice)`
   - Block: doesn't matter (clean fork)
   - Tokens: mock USDC, 6 decimals

2. **Pin state:** local Anvil with mock USDC.

3. **Replay:** write minimal test:
   ```solidity
   function test_depositThenRedeemReturnsLess() public {
       deal(USDC, alice, 100e6);
       vm.startPrank(alice);
       IERC20(USDC).approve(address(vault), 100e6);
       uint256 shares = vault.deposit(100e6, alice);
       uint256 assets = vault.redeem(shares, alice, alice);
       vm.stopPrank();
       assertEq(assets, 100e6);  // FAILS: assets = 99999990
   }
   ```

4. **Narrow:** even 1e6 shows the same loss. Constant ratio? Compute: `99.99999%` retained. ~1e-7 lost.

5. **Print state:**
   ```solidity
   console.log("totalAssets", vault.totalAssets());  // 100000000
   console.log("totalSupply", vault.totalSupply());  // 100000010 (off by 10!)
   ```

6. **Hypothesis:** the inflation-attack mitigation initial-mint is leaving 10 wei stuck.

7. **Verify:** check the constructor — yes, OZ ERC4626 mints `10**(decimalsOffset)` virtual shares to `address(0)`. That's 10 in this case.

8. **Fix:** this isn't a bug — it's intentional. The test expectation should be `assertApproxEqAbs(assets, 100e6, 100)`. Adjust the test, not the contract.

The diagnosis prevented "fixing" a security mitigation.

## What to read next

- `references/trace-techniques.md` — read traces fluently
- `references/common-bug-patterns.md` — recognize bug shapes
- `testing/SKILL.md` — write tests that prevent this class of bug
