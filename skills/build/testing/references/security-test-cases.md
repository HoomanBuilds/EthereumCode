# Security Test Cases

A library of test patterns that catch real bugs. Drop these into your suite when the relevant attack surface applies — they're the difference between "all tests green" and "actually safe to deploy."

Pair with the security skill's threat models; this file is the *test-side* counterpart. None of these substitute for an audit; they catch the obvious cases before you spend audit hours.

## Reentrancy

If your contract makes external calls before settling state, write a malicious receiver:

```solidity
contract ReentrantReceiver {
    Vault public target;
    bool public reentered;

    constructor(Vault _t) { target = _t; }

    receive() external payable {
        if (!reentered) {
            reentered = true;
            target.withdraw(1 ether);   // re-enter mid-withdraw
        }
    }
}

function test_reentrancy_blocked() public {
    ReentrantReceiver attacker = new ReentrantReceiver(vault);
    vm.deal(address(attacker), 1 ether);
    vm.prank(address(attacker));
    vault.deposit{value: 1 ether}();

    vm.prank(address(attacker));
    vm.expectRevert();   // ReentrancyGuard or balance underflow
    vault.withdraw(1 ether);
}
```

Cover ERC-777 hooks (`tokensReceived`), ERC-721/1155 callbacks (`onERC721Received`, `onERC1155Received`), and ETH `receive` for any contract that pushes value.

## Access control

For each privileged function, assert:

```solidity
function test_revertWhen_nonOwnerCallsAdmin() public {
    vm.prank(alice);
    vm.expectRevert();
    vault.setFee(100);
}

function test_ownerCanSetFee() public {
    vm.prank(owner);
    vault.setFee(100);
    assertEq(vault.fee(), 100);
}

function test_revertWhen_renounceOwnership_thenAdmin() public {
    vm.prank(owner);
    vault.renounceOwnership();
    vm.prank(owner);
    vm.expectRevert();
    vault.setFee(100);   // owner is now address(0); even original deployer locked out
}
```

For role-based AC (`AccessControl`), test grant + revoke + admin-of-role boundaries.

## Slippage and front-running

```solidity
function test_swap_revertsWhenSlippageExceeded() public {
    deal(USDC, alice, 1000e6);
    vm.startPrank(alice);
    IERC20(USDC).approve(address(router), 1000e6);

    // Set unrealistic minOut
    vm.expectRevert();
    router.swap(USDC, WETH, 1000e6, /*minOut*/ type(uint256).max, alice);
    vm.stopPrank();
}

function test_swap_protectedAgainstSandwich() public {
    // simulate adversary moving the pool just before alice's swap
    _attackerMovesPool(largeAmount);

    vm.prank(alice);
    vm.expectRevert();   // alice's minOut should reject the manipulated price
    router.swap(USDC, WETH, 100e6, expectedMinOut, alice);
}
```

## Oracle manipulation

If your contract reads a price, test what happens when:

- The price returns 0 (or negative).
- The round is stale (`updatedAt` far in the past).
- The price changes mid-transaction (`vm.mockCall` returns one value, then changes between subcalls).

```solidity
function test_revertWhen_priceStale() public {
    vm.mockCall(
        address(feed),
        abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
        abi.encode(uint80(1), int256(2000e8), uint256(0), block.timestamp - 2 hours, uint80(1))
    );
    vm.expectRevert(StalePrice.selector);
    vault.deposit(100e6);
}

function test_revertWhen_priceZero() public {
    vm.mockCall(
        address(feed),
        abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
        abi.encode(uint80(1), int256(0), uint256(0), block.timestamp, uint80(1))
    );
    vm.expectRevert();
    vault.deposit(100e6);
}
```

For TWAP-based oracles, test that single-block manipulation doesn't move your reference enough to be exploited.

## Sequencer downtime (L2)

```solidity
function test_revertWhen_sequencerDown() public {
    vm.createSelectFork("base", 12_000_000);
    // Force the sequencer feed to report "down"
    vm.mockCall(
        SEQUENCER_FEED,
        abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
        abi.encode(uint80(1), int256(1), block.timestamp, block.timestamp, uint80(1))  // 1 = down
    );
    vm.expectRevert(SequencerDown.selector);
    vault.deposit(100e6);
}
```

## Token quirks

```solidity
function test_handlesUSDTApprove() public {
    deal(USDT, alice, 1000e6, true);
    vm.startPrank(alice);
    IERC20(USDT).approve(address(router), 100e6);
    // USDT reverts on changing non-zero allowance — your code must zero first
    IERC20(USDT).approve(address(router), 200e6); // would revert; SafeERC20.forceApprove handles it
    vm.stopPrank();
}

function test_feeOnTransferToken_accountsForActualReceived() public {
    address fotToken = _deployFOT(/*feeBps*/ 100);  // 1% on transfer
    deal(fotToken, alice, 1000e18, true);

    vm.startPrank(alice);
    IERC20(fotToken).approve(address(vault), 1000e18);
    uint256 shares = vault.deposit(1000e18, alice);
    vm.stopPrank();

    // vault should record what it ACTUALLY received (990e18), not what alice tried to send
    assertEq(vault.totalAssets(), 990e18);
}

function test_rebasingToken_doesNotBreakAccounting() public {
    // for stETH-like tokens, your accounting must NOT cache balances across blocks
    deal(STETH, address(vault), 1000e18, true);
    vm.warp(block.timestamp + 1 days);  // simulate rebase
    // assert vault still reports a sane share value
}
```

## Integer overflow / division by zero

Solidity 0.8+ checks overflow by default; the bugs are in `unchecked` blocks and intermediate calculations.

```solidity
function testFuzz_fee_noOverflow(uint256 amount, uint16 feeBps) public {
    amount = bound(amount, 0, type(uint128).max);
    feeBps = uint16(bound(feeBps, 0, 10_000));
    uint256 fee = (amount * feeBps) / 10_000;
    assertLe(fee, amount);
}

function test_revertWhen_divByZero() public {
    vm.expectRevert();
    vault.calculateShares(100, /*totalSupply*/ 0);
}
```

## Signature replay

If your contract accepts EIP-712 signatures (permit, gasless meta-tx, off-chain orders), test:

```solidity
function test_revertWhen_signatureReplayed() public {
    bytes memory sig = _sign(alicePk, digest);
    target.execute(payload, sig);
    vm.expectRevert(InvalidNonce.selector);
    target.execute(payload, sig);   // replay
}

function test_revertWhen_sigFromWrongChain() public {
    bytes memory sig = _signWithDomainChainId(alicePk, digest, /*chainId*/ 1);
    vm.chainId(8453);   // execute on Base
    vm.expectRevert();
    target.execute(payload, sig);
}

function test_revertWhen_signatureExpired() public {
    bytes memory sig = _sign(alicePk, digestWithDeadline);
    vm.warp(deadline + 1);
    vm.expectRevert(Expired.selector);
    target.execute(payload, sig);
}
```

## Initialization

For upgradeable contracts (UUPS, transparent proxy):

```solidity
function test_revertWhen_initializeCalledTwice() public {
    vm.expectRevert();
    proxy.initialize(owner, params);   // already initialized in setUp
}

function test_implementation_cannotBeInitialized() public {
    // Direct call to the implementation (not the proxy) should revert
    Vault impl = new Vault();
    vm.expectRevert();
    impl.initialize(owner, params);
}
```

## Donation and inflation attacks (ERC-4626)

```solidity
function test_revertWhen_firstDepositorInflationAttack() public {
    deal(address(asset), alice, 1, true);
    deal(address(asset), bob,   100e18, true);

    // alice front-runs as the first depositor with 1 wei
    vm.prank(alice);
    asset.approve(address(vault), 1);
    vm.prank(alice);
    vault.deposit(1, alice);

    // alice donates a huge amount to inflate share price
    vm.prank(alice);
    asset.transfer(address(vault), 1000e18);

    // bob's deposit should still mint a non-zero number of shares
    vm.prank(bob);
    asset.approve(address(vault), 100e18);
    vm.prank(bob);
    uint256 bobShares = vault.deposit(100e18, bob);
    assertGt(bobShares, 0, "inflation attack succeeded");
}
```

OpenZeppelin v5's `ERC4626` mitigates with virtual shares; verify your implementation does too.

## Flash-loan price manipulation

For price-sensitive operations (liquidations, AMM-based oracles):

```solidity
function test_liquidation_resistsFlashLoanManipulation() public {
    // Setup: alice has a healthy position
    _setupHealthyBorrow(alice, 100 ether);

    // Attacker borrows flash, dumps into the AMM, makes alice's collateral price drop temporarily
    vm.startPrank(attacker);
    flashloan.borrow(LARGE);
    pool.dumpToCollapsePrice(LARGE);

    vm.expectRevert();   // your liquidation should use a manipulation-resistant price
    market.liquidate(alice);
    vm.stopPrank();
}
```

## Invariant suite for the high-stakes pieces

Beyond unit tests, encode these as invariants:

- **Lender**: `totalSupplied >= totalBorrowed` per asset
- **Vault**: `totalAssets >= sum(convertToAssets(balanceOf(user)))`
- **AMM**: `reserve0 * reserve1 >= K` after every swap
- **Token**: `sum(balances) == totalSupply`
- **Bridge / escrow**: `lockedOnSource == claimableOnDestination` for any cross-chain operation

See `references/fuzz-and-invariants.md` for the Handler pattern.

## Common pitfalls

- **Testing only the happy path of access control**: write the negative test for every privileged function, not just the one with `onlyOwner` you remembered.
- **Mocking the oracle without stale-time variants**: most oracle bugs are about stale data, not wrong data. Always test stale + zero + negative.
- **Skipping token-quirk tests because "we don't support USDT"**: integrators will pass it anyway. Test that you reject it gracefully or handle it correctly.
- **Forgetting chain-id and verifying-contract in EIP-712 replay tests**: a sig valid on chain A is invalid on chain B only if your domain includes `chainId`. Verify your separator does.
- **Testing with the test contract as caller**: many bugs only show up when `tx.origin != msg.sender`. Use `vm.prank(actor, tx.origin)` for top-level calls when relevant.
- **No initialization tests on upgradeable contracts**: leaving the implementation un-initialized is the OpenZeppelin v3 incident pattern; the test is one line.

## What to read next

- `references/foundry-cheatcodes.md` — cheatcodes used in these tests
- `references/fuzz-and-invariants.md` — invariants for the assertions above
- `references/fork-testing.md` — fork tests for token quirks and live oracles
- Security skill — threat models for each of the above
