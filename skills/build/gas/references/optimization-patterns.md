# Solidity Gas Optimization Patterns

Concrete techniques that materially reduce gas, with measured savings. Skip optimizations that save <100 gas at the cost of readability — current mainnet base fees mean a contract-level optimization saving 1,000 gas saves a user roughly $0.0002. Optimize where it matters: hot paths, deployment cost, and L2 calldata.

Always benchmark with `forge snapshot` before and after — your assumptions about which patterns help will be wrong about a third of the time.

## Storage layout — the biggest lever

EVM storage is 32-byte slots. The compiler packs adjacent declarations into a single slot when their types fit. Misordered fields waste an entire `SSTORE` (~20k gas first write, ~3k subsequent) per extra slot.

### Bad — 3 slots

```solidity
contract Loose {
    uint128 a;     // slot 0 (16 bytes used)
    uint256 b;     // slot 1 (full slot — a doesn't fit with b)
    uint128 c;     // slot 2 (16 bytes used; rest wasted)
}
```

### Good — 2 slots

```solidity
contract Tight {
    uint128 a;     // slot 0 (lower 16 bytes)
    uint128 c;     // slot 0 (upper 16 bytes — packed with a)
    uint256 b;     // slot 1
}
```

Group fields that are read or written together — even if packed, reading slot 0 to access `a` and writing it back twice (once for `a`, once for `c`) costs more than two unpacked writes if the operations are at different times.

### Use `uint256` unless packing helps

A standalone `uint8` field doesn't save any storage gas vs `uint256`. It actively wastes runtime gas: every read/write to a sub-word requires an `AND` mask + shift. Only narrow the type when packing into a struct buys you a slot.

```solidity
// Wrong — slower, no storage saved, worse readability
uint8  public counter;

// Right — same storage cost, no masking
uint256 public counter;
```

### Storage struct as a single SLOAD

```solidity
struct Position {
    uint128 collateral;
    uint128 debt;
    uint64  lastUpdate;
    uint64  liquidationsCount;
    // 4 fields, total 32 bytes — single slot
}

mapping(address => Position) public positions;

function liquidate(address user) external {
    Position memory p = positions[user];   // ONE SLOAD
    require(p.debt > p.collateral * threshold / 1e18);
    p.collateral = 0;
    p.debt = 0;
    p.lastUpdate = uint64(block.timestamp);
    p.liquidationsCount += 1;
    positions[user] = p;                    // ONE SSTORE
}
```

Reading the struct as `memory`, mutating in memory, and writing back is one `SLOAD` + one `SSTORE`. Reading per-field would be 4 of each.

## Calldata vs memory vs storage

For external/public function parameters, `calldata` is cheaper than `memory` for arrays and bytes — it skips the copy.

```solidity
// Bad — copies the array into memory
function sum(uint256[] memory xs) external pure returns (uint256 s) {
    for (uint256 i; i < xs.length; ++i) s += xs[i];
}

// Good — reads directly from calldata
function sum(uint256[] calldata xs) external pure returns (uint256 s) {
    for (uint256 i; i < xs.length; ++i) s += xs[i];
}
```

Saves ~3 gas per byte of array data — meaningful for batches.

For internal helpers that mutate, `memory` is required. For internal helpers that only read storage repeatedly, take a `storage` reference instead of copying:

```solidity
function _check(Position storage p) internal view { ... }   // no copy
```

## Cache storage reads in loops

Each `SLOAD` is 100 gas (warm) or 2,100 gas (cold, first access). Hoist them out of loops.

```solidity
// Bad — re-reads totalSupply each iteration
for (uint256 i; i < users.length; ++i) {
    bal[i] = balanceOf[users[i]] * 1e18 / totalSupply;
}

// Good — read once
uint256 supply = totalSupply;
for (uint256 i; i < users.length; ++i) {
    bal[i] = balanceOf[users[i]] * 1e18 / supply;
}
```

EIP-2929 made repeat `SLOAD`s of the same slot cheap (warm = 100), but the local cache is still cheaper.

## Loops

### Cache `array.length`

```solidity
// Bad — reads length every iteration
for (uint256 i; i < arr.length; ++i) { ... }

// Good
uint256 n = arr.length;
for (uint256 i; i < n; ++i) { ... }
```

For `calldata` arrays the savings are small (`calldataload` on length is cheap). For `storage` arrays this matters a lot — each iteration would otherwise be a fresh `SLOAD`.

### `++i` over `i++`

`++i` doesn't allocate the temporary; saves ~5 gas per iteration. Use `++i` for loop counters by default.

### `unchecked` for loop counters

If `i` cannot overflow within the loop's bounded length, Solidity 0.8's overflow check is dead weight:

```solidity
for (uint256 i; i < n; ) {
    // ... body ...
    unchecked { ++i; }
}
```

Saves ~30 gas per iteration on tight loops. **Only use `unchecked` when the math truly cannot overflow** — counters bounded by array length are safe; user-supplied math is not.

## `immutable` and `constant`

Both fold the value into bytecode at compile/deploy time — no `SLOAD`. Use them for any value that doesn't change after deployment.

```solidity
// constant — set at compile time (literal)
uint256 public constant FEE_BPS = 30;

// immutable — set in constructor
address public immutable owner;
constructor() { owner = msg.sender; }
```

`immutable` saves ~2,000 gas per access vs storage. Many contracts have multiple addresses (router, factory, oracle) that should all be `immutable`.

Caveat: `immutable` cannot be used with reference types in current Solidity (no `string immutable`), and reads from constructors of the same contract are not allowed.

## `require` vs custom errors

```solidity
// 0.8.4+
error InsufficientBalance(uint256 have, uint256 want);

if (balance < amount) revert InsufficientBalance(balance, amount);
```

Custom errors are ~50 gas cheaper than `require(... , "string")` per revert (smaller deployment, smaller revert payload). They also encode arguments — good for debugging. Use them for all reverts in 0.8.4+.

Solidity 0.8.26+ supports custom errors directly inside `require`:

```solidity
require(balance >= amount, InsufficientBalance(balance, amount));
```

## Function visibility

`external` is cheaper than `public` when you don't need to call the function internally:

- `external`: arguments stay in calldata (no copy).
- `public`: Solidity inserts a copy from calldata to memory in case of internal calls.

For library-style contracts where most functions are called only from outside, default to `external`.

## Events vs storage

Events cost ~375 gas per topic + 8 gas per byte of data; emitted data is **cheaper than storage** (~20k for first SSTORE) but is **not readable on-chain**. Use events for history that off-chain indexers consume; reserve storage for state needed by other contracts.

```solidity
// Don't store every action; emit
event PositionUpdated(address indexed user, uint128 collateral, uint128 debt);

function update(uint128 c, uint128 d) external {
    positions[msg.sender] = Position({collateral: c, debt: d, ...});
    emit PositionUpdated(msg.sender, c, d);
}
```

Indexed event topics are cheaper to filter against off-chain. Up to 3 indexed params.

## Contract bytecode size and deploy cost

Each byte of deployed bytecode costs 200 gas in deployment. Big contracts cost a lot to deploy and risk hitting the 24,576-byte EIP-170 limit.

Levers:

- **Use libraries**: extract pure helpers into a library, link at deploy. Deployment cost drops; library code lives once.
- **Optimize via compiler runs**: `solc --optimize-runs N` — `runs=200` is a balance; `runs=1` minimizes deployment cost (use during prototyping); `runs=10000` minimizes runtime cost (use when calls vastly outnumber deploys).
- **Strip unused interfaces**: avoid importing OpenZeppelin's full `ERC20` if you only need a few functions; copy what you need.
- **Don't repeat error strings**: each unique string is dedicated bytecode. Custom errors deduplicate by signature.
- **Use `via_ir` for complex contracts**: `--via-ir` (or `viaIR = true` in `foundry.toml`) emits via Yul; often produces smaller and faster bytecode for complex code, slower compile.

Foundry: `forge build --sizes` shows each contract's runtime size.

## Cold vs warm access (EIP-2929)

First access to an address or slot in a transaction is cold (2,600 / 2,100 gas). Subsequent accesses are warm (100 gas).

Implications:

- **Order matters in batches**: process operations that touch the same address consecutively, not interleaved.
- **Access lists** (EIP-2930): pre-warm accounts/slots for a transaction. Useful for cross-contract patterns where you can predict the read set; the bundler/RPC can compute it for you (`eth_createAccessList`).

## Multicall vs separate transactions

Two separate user txs of 50k gas each cost `2 * (21,000 + 50,000) = 142,000`. One multicall tx doing the same two operations costs `21,000 + 50,000 + 50,000 + (call overhead) ≈ 124,000` — saves the 21k base fee for the second tx.

OpenZeppelin's `Multicall.sol`:

```solidity
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

contract MyContract is Multicall {
    function deposit(uint256 amount) external { ... }
    function delegate(address to)  external { ... }
}

// User calls multicall([deposit.calldata, delegate.calldata]) — one tx
```

For external multicalls (across unrelated contracts), use `Multicall3` (`0xcA11bde05977b3631167028862bE2a173976CA11`).

## Assembly — when, when not

Inline `assembly` can save 5–30% on tight hot paths. Use it when:

- Doing bit packing/unpacking that the compiler can't recognize (e.g. extracting a packed `(uint128, uint128)` from a `bytes32`).
- Calling a precompile (ecrecover, modexp, identity).
- Avoiding Solidity's safety bookkeeping in a context where you've proven safety externally.

**Don't use it for**: arithmetic, control flow, anything readable in Solidity. The audit cost outweighs the gas savings.

```solidity
// Cheap address(this).balance check via assembly — skips Solidity's wrapping
function balance() external view returns (uint256 b) {
    assembly { b := selfbalance() }
}
```

## Storage refunds (capped)

Setting a non-zero slot to zero used to refund 15k gas; post-EIP-3529 (London), refunds are capped at 1/5 of gas used. Don't design around refunds — they're not the lever they were in 2020. Modern advice: just don't set slots you'll need to clear.

## Approve dance: from `safeApprove` to `forceApprove`

Some tokens (USDT) revert when changing a non-zero allowance. The old pattern:

```solidity
IERC20(usdt).safeApprove(spender, 0);
IERC20(usdt).safeApprove(spender, amount);
```

OpenZeppelin v5 added `safeIncreaseAllowance` / `safeDecreaseAllowance` and **`forceApprove`** (does the zero-then-set under the hood for misbehaving tokens):

```solidity
SafeERC20.forceApprove(IERC20(usdt), spender, amount);
```

Saves you a transaction (and gas) when you can predict you'll be revoking later.

## Measure with `forge snapshot`

```bash
forge snapshot                              # writes .gas-snapshot
forge snapshot --diff .gas-snapshot         # show deltas vs prior
```

Add `--diff` to CI; fail the build if any test grew by more than X gas. This catches regressions automatically.

For per-line gas, `forge test --gas-report` lists per-function gas; for individual ops, use `console2.log(gasleft())`.

## Common pitfalls

- **Optimizing storage layout doesn't help if you only ever write once.** Layout matters when fields are read together; optimizing layout when fields are written in independent transactions just shifts the gas around.
- **`unchecked` blocks that contain user-supplied math**: an attacker can craft input that overflows. Only use `unchecked` for counters and cases you can prove cannot overflow.
- **`view`/`pure` doesn't save gas for the caller** — it's an interface contract, not an optimization. Wrong external `pure` declarations on functions that read storage are a bug, not an optimization.
- **Using libraries for everything**: linked libraries add a `DELEGATECALL` overhead (~700 gas) per call. Inline small helpers (one or two lines).
- **Optimization runs as a perf knob**: high `--optimize-runs` makes runtime cheaper but increases deploy cost; for one-shot deployments it's a wash, for popular contracts it pays for itself.
- **Pre-computing `keccak256` constants**: `bytes32 public constant ROLE = keccak256("ROLE")` is folded at compile time. Don't manually write the hash literal; the compiler does it for you and re-derivations stay readable.
- **Premature optimization**: if your function runs once per user per day, saving 1k gas saves $0.0002 at current prices. Optimize only paths that run often or are called by many users.

## What to read next

- `references/l2-economics.md` — the fee model on Arbitrum/Base/Optimism is dominated by L1 calldata
- `references/profiling-and-tooling.md` — `forge snapshot`, gas reports, EVM debugger
- `references/account-abstraction-gas.md` — gas with paymasters and 4337
- Solidity gas docs: https://docs.soliditylang.org/en/latest/internals/optimizer.html
