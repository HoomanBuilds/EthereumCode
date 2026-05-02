# Fuzz and Invariant Testing Patterns

Fuzzing finds edge cases. Invariant testing catches state-machine bugs across thousands of random sequences. Get this right and you find bugs no human reviewer will. Get it wrong and you ship a green CI on a broken contract.

## Fuzzing — the right inputs

### Use `bound`, not `vm.assume`

Foundry's fuzzer generates 256 random uint256s by default. If you reject inputs with `vm.assume`, you waste runs:

```solidity
// Bad — discards most inputs, weak coverage
function testFuzz_X(uint256 amount) public {
    vm.assume(amount > 0 && amount < 1e30);
    // ...
}

// Good — every run tests a valid input
function testFuzz_X(uint256 amount) public {
    amount = bound(amount, 1, 1e30);
    // ...
}
```

`bound(x, lo, hi)` reshapes `x` into `[lo, hi]`. Wrong: `bound(amount, 1, type(uint96).max)` for a `uint96` param — Solidity narrowing happens elsewhere. Right: declare the parameter as `uint96 amount` and let the fuzzer generate values in range.

### Multiple correlated inputs

```solidity
function testFuzz_DepositWithdraw(uint256 deposit, uint256 withdraw) public {
    deposit  = bound(deposit, 1e6, 1e30);
    withdraw = bound(withdraw, 1, deposit);   // withdraw can't exceed deposit
    // ...
}
```

Correlate inputs explicitly; don't let the fuzzer try `withdraw > deposit` and then `vm.assume` it away.

### Invariants for math

Test the property, not the value:

```solidity
function testFuzz_FeeIsConserved(uint256 amount, uint256 feeBps) public {
    amount = bound(amount, 1e6, 1e30);
    feeBps = bound(feeBps, 1, 10_000);

    uint256 fee = (amount * feeBps) / 10_000;
    uint256 net = amount - fee;

    assertEq(fee + net, amount, "conservation");
    assertLe(fee, amount, "fee within bounds");
    assertGt(net, 0, "non-zero net for non-zero fee less than 100%");
}
```

Tests like "no input causes the math to underflow" and "every operation conserves total value" catch bugs that point-tests miss.

### Approximate equality for rounding

```solidity
assertApproxEqAbs(a, b, 1);                  // within 1 wei
assertApproxEqRel(a, b, 0.01e18);            // within 1% (WAD-scaled)
```

Vault math, AMM math, interest accruers — anything with division — will round. Asserting strict equality fails for legitimate reasons; use `Approx` variants with a justified tolerance.

## Invariant testing — beyond fuzzing

Invariant tests run thousands of random function call sequences against your contracts and check that properties hold after each step. They're how you find state-machine bugs.

### Setup

```solidity
contract VaultInvariant is Test {
    Vault    vault;
    Token    token;
    Handler  handler;

    function setUp() public {
        token   = new Token();
        vault   = new Vault(token);
        handler = new Handler(vault, token);
        targetContract(address(handler));   // fuzz THIS, not vault directly
    }

    function invariant_TotalAssetsEqualBalance() public view {
        assertEq(vault.totalAssets(), token.balanceOf(address(vault)));
    }
}
```

`targetContract` tells Foundry which contract's external functions to call randomly. **Always target a Handler, not the contract under test directly** — Handlers let you bound parameters, track ghost state, and prevent useless reverts.

### Handler pattern

A Handler wraps the SUT, exposes its functions with bounded inputs, and tracks ghost variables.

```solidity
contract Handler is Test {
    Vault   public vault;
    Token   public token;

    address[] public actors;
    mapping(address => bool) public actorExists;

    // Ghost variables — track state we want to assert against
    uint256 public ghost_totalDeposited;
    uint256 public ghost_totalWithdrawn;

    constructor(Vault _vault, Token _token) {
        vault = _vault;
        token = _token;
        for (uint256 i; i < 5; ++i) _addActor(makeAddr(string.concat("actor", vm.toString(i))));
    }

    function _addActor(address a) internal {
        if (!actorExists[a]) { actors.push(a); actorExists[a] = true; }
    }

    function _pickActor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = _pickActor(actorSeed);
        amount = bound(amount, 1, 1e24);

        deal(address(token), actor, amount, true);
        vm.startPrank(actor);
        token.approve(address(vault), amount);
        vault.deposit(amount, actor);
        vm.stopPrank();

        ghost_totalDeposited += amount;
    }

    function withdraw(uint256 actorSeed, uint256 sharesPercent) external {
        address actor = _pickActor(actorSeed);
        uint256 maxShares = vault.balanceOf(actor);
        if (maxShares == 0) return;

        uint256 shares = (maxShares * bound(sharesPercent, 1, 100)) / 100;

        vm.prank(actor);
        uint256 assets = vault.redeem(shares, actor, actor);

        ghost_totalWithdrawn += assets;
    }
}
```

Then in the invariant:

```solidity
function invariant_AccountingMatches() public view {
    assertEq(
        token.balanceOf(address(vault)) + handler.ghost_totalWithdrawn(),
        handler.ghost_totalDeposited()
    );
}
```

### Why a Handler

- **Bounds inputs**: the fuzzer would otherwise call `deposit(type(uint256).max)` and revert immediately on transfer — a wasted run.
- **Reuses actors**: random fresh addresses with zero balance always revert. Cycle through a fixed set of actors so state actually accumulates.
- **Avoids dead reverts**: skip operations that can't succeed (e.g. `withdraw` when balance is 0) — keeps the call sequence alive.
- **Ghost state**: tracks information you can't easily compute from on-chain state (cumulative deposits, last action timestamps).

### Excluding selectors

Sometimes the Handler exposes more functions than you want fuzzed in a particular invariant:

```solidity
function setUp() public {
    // ... create handler ...
    bytes4[] memory selectors = new bytes4[](2);
    selectors[0] = Handler.deposit.selector;
    selectors[1] = Handler.withdraw.selector;
    targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));
}
```

Or exclude entire contracts: `excludeContract(address)`.

### `excludeSender` / `targetSender`

Foundry by default uses random `msg.sender` for each call. To pin senders to your actor set, use a Handler-managed prank inside each function (as above). Alternatively `targetSender` restricts the global pool of senders.

### Configuration

In `foundry.toml`:

```toml
[invariant]
runs       = 256          # number of sequences to try
depth      = 50           # function calls per sequence
fail_on_revert = false    # if true, any revert fails the test (rarely useful)
call_override = false
dictionary_weight = 80    # how often to use the dictionary vs random
include_storage = true    # add observed storage values to the dictionary
include_push_bytes = true # add bytes from CREATE/CREATE2 bytecode to dict
```

Increase `runs` and `depth` in CI: `runs = 512, depth = 100` for serious protocols. The dictionary feature feeds observed values back into the fuzzer — it dramatically improves coverage on protocols with magic constants.

### What to assert

Common invariants by domain:

**ERC-20 token**
- `sum(balances) == totalSupply`
- balances are never negative
- transfer of 0 doesn't revert (per spec)

**ERC-4626 vault**
- `totalAssets >= sum(convertToAssets(balanceOf(user)))` — vault must always be able to redeem at least the recorded shares
- `convertToShares(convertToAssets(s)) ≤ s` — round-tripping shares can only round down
- `previewDeposit(x)` ≤ `deposit(x)`'s actual minted shares (preview is conservative)

**AMM**
- `x * y >= k` after every swap (constant product, ignoring fees)
- pool reserves non-negative
- price impact within bounds for given trade size

**Lending market**
- `totalBorrowed ≤ totalSupplied` (per asset)
- health factor of any non-liquidated user > 1.0
- accrued interest monotonically non-decreasing

**Staking / vesting**
- claimable amount monotonically non-decreasing per epoch
- total claimed never exceeds total scheduled

### Failures and shrinking

When an invariant fails, Foundry prints the call sequence:

```
[FAIL: assertion failed] invariant_TotalAssetsEqualBalance()
  [Sequence] (length: 7)
  sender=0xa0... addr=0xb1... calldata=deposit(123, 50000)
  sender=0xa0... addr=0xb1... calldata=deposit(456, 1000)
  sender=0xa0... addr=0xb1... calldata=withdraw(123, 75)
  ...
```

Re-run the failing sequence as a unit test:

```solidity
function test_replay_invariant() public {
    handler.deposit(123, 50000);
    handler.deposit(456, 1000);
    handler.withdraw(123, 75);
    // ...
    assertEq(vault.totalAssets(), token.balanceOf(address(vault)));
}
```

Foundry shrinks failing sequences automatically, but the shrunken trace can still be 5–10 calls. Reproduce as a deterministic test, debug with `-vvvv`.

## Stateful vs stateless invariants

- **Stateless invariant**: a property checked on a snapshot, no state carry-over (`invariant_NoNegativeBalance`).
- **Stateful invariant**: relies on state accumulated across the fuzz sequence (`invariant_TotalDepositedEqualsTotalAssets` using ghost variables).

Both are valid; stateful invariants catch a different class of bug (the kind that only emerges after a particular sequence).

## Common pitfalls

- **Targeting the SUT directly**: every random `deposit(type(uint256).max)` reverts; you do 256 runs, get 0 useful coverage. Always wrap in a Handler.
- **Asserting strict equality on rounding math**: a vault that rounds down by 1 wei in favor of the protocol fails `assertEq(totalAssets, sumOfBalances)` even though it's correct. Use `assertGe` (vault >= sum) and bound the diff.
- **`fail_on_revert = true`** with a Handler that doesn't gate operations: the Handler reverts on early-call edge cases, the test fails immediately. Either gate operations in the Handler (skip if can't succeed) or leave `fail_on_revert = false`.
- **Single-actor Handler**: reused-actor accumulation hides bugs that need cross-actor interactions. Cycle 3–5 actors at minimum.
- **Ghost state not updated on revert**: if the Handler tries `vault.deposit(...)` inside a try/catch and adds to a ghost on success only, ensure both branches are correct. Better: use bounded preconditions so calls don't revert.
- **Slow invariant tests in CI**: with default config, invariants are fast; with `runs=10000`, they take minutes. Keep CI-fast configs (`runs=256, depth=50`) and run a `--profile deep` (`runs=10000, depth=200`) nightly.
- **Replays not reproducible**: `forge test --fuzz-seed 0xDEADBEEF` pins the fuzzer's seed. Capture the seed from a failing run and add a regression test.

## What to read next

- `references/foundry-cheatcodes.md` — `bound`, `prank`, `deal`, `expectRevert`
- `references/fork-testing.md` — invariants over real protocols
- `references/security-test-cases.md` — concrete invariants for common protocol classes
- Foundry invariants: https://book.getfoundry.sh/forge/invariant-testing
