# Common Bug Patterns

Most contract bugs fall into ~15 known categories. Recognizing the shape lets you skip the diagnostic phase and go straight to verification. This file is the catalog.

For repro see `references/repro-and-isolation.md`. For tracing see `references/trace-techniques.md`. For security-grade analysis see `security/SKILL.md`.

## 1. Off-by-one in iteration

```solidity
for (uint256 i = 0; i <= arr.length; i++) {  // BUG: <= should be <
    sum += arr[i];
}
```

**Symptom:** `Panic(0x32)` (array out of bounds) on the last iteration.

**Trace shape:** loop runs `length+1` times.

**Fix:** `i < arr.length`.

## 2. Decimal mismatch

USDC is 6 decimals. ETH is 18. Mixing them silently produces astronomical results.

```solidity
uint256 priceUsd = 2000;            // mistakenly raw, not scaled
uint256 ethAmount = 1 ether;
uint256 usdValue = priceUsd * ethAmount;  // 2000e18, not 2000e6 USDC
```

**Symptom:** values off by `1e12` or `1e10`.

**Fix:** explicitly scale; document the unit on every variable.

```solidity
uint256 priceE6 = 2000e6;
uint256 ethAmountE18 = 1 ether;
uint256 usdValueE6 = (priceE6 * ethAmountE18) / 1e18;
```

## 3. Order of operations causing precision loss

```solidity
shares = amount / totalAssets * totalSupply;  // BUG: integer division first
```

If `amount < totalAssets`, `amount / totalAssets = 0`. Multiplying by anything is still 0.

**Fix:** multiply first, then divide.

```solidity
shares = amount * totalSupply / totalAssets;
```

## 4. Missing approval

```solidity
function deposit(uint256 amount) external {
    IERC20(token).transferFrom(msg.sender, address(this), amount);
    // ...
}
```

User calls `deposit(100)` without first calling `token.approve(vault, 100)`.

**Symptom:** `transferFrom` reverts with `ERC20InsufficientAllowance` (0xfb8f41b2) or returns `false` (older tokens).

**Fix:** check allowance in the frontend before submitting; explain the two-step flow inline; consider permit().

## 5. Stale reads after mutation

```solidity
function withdraw(uint256 amount) external {
    require(amount <= balanceOf[msg.sender], "insufficient");
    balanceOf[msg.sender] -= amount;
    token.transfer(msg.sender, amount);
    totalAssets -= amount;
    emit Withdraw(msg.sender, amount, totalAssets);  // OK
}

function preview() external view returns (uint256) {
    return amount * totalAssets / totalSupply;  // reads stale state if called mid-tx by reentrancy
}
```

**Symptom:** view returns wrong value during a multi-step transaction.

**Fix:** if the read is meant to reflect post-state, compute it explicitly. For reentrancy concerns, add nonReentrant or use checks-effects-interactions.

## 6. Reentrancy

```solidity
function withdraw(uint256 amount) external {
    require(amount <= balanceOf[msg.sender]);
    (bool ok,) = msg.sender.call{value: amount}("");  // calls back into the contract
    require(ok);
    balanceOf[msg.sender] -= amount;  // BUG: state update after external call
}
```

**Symptom:** attacker drains contract by re-entering `withdraw` before balance is decremented.

**Fix:** checks-effects-interactions:

```solidity
function withdraw(uint256 amount) external {
    require(amount <= balanceOf[msg.sender]);
    balanceOf[msg.sender] -= amount;  // effect first
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
}
```

Or use OpenZeppelin's `ReentrancyGuard`.

See `security/SKILL.md`.

## 7. Unchecked external call return

```solidity
token.transfer(user, amount);  // returns bool, but ignored
```

Some tokens (USDT) don't revert on failure — they return `false`.

**Symptom:** transfer fails silently; balance still credited internally.

**Fix:** use OZ `SafeERC20`:

```solidity
using SafeERC20 for IERC20;
token.safeTransfer(user, amount);
```

## 8. Integer overflow in older Solidity

In Solidity ^0.8.0 arithmetic reverts on overflow by default. In `unchecked { }` blocks or `<0.8` it silently wraps.

```solidity
unchecked {
    totalSupply += amount;  // wraps if amount near max uint
}
```

**Symptom:** balance becomes a huge number after a small operation.

**Fix:** remove `unchecked` unless you've proven overflow impossible.

## 9. Wrong storage layout in proxies

```solidity
contract V1 {
    address public owner;
    uint256 public value;
}

contract V2 {
    uint256 public value;   // BUG: layout shifted
    address public owner;
}
```

**Symptom:** after upgrade, `value` returns garbage and `owner` is corrupted.

**Fix:** never reorder, never remove, only append. Use OZ's `@custom:storage-location` namespaced storage to avoid collisions entirely.

## 10. tx.origin used for auth

```solidity
require(tx.origin == owner, "not owner");  // BUG: phishable
```

**Symptom:** any contract that the owner calls can act as the owner.

**Fix:** `require(msg.sender == owner)`.

## 11. Front-runnable approval

ERC-20 `approve` race condition:

```solidity
token.approve(spender, 100);
// later
token.approve(spender, 50);  // BUG: spender can spend 100 then 50
```

**Symptom:** allowance abused.

**Fix:** `token.approve(spender, 0)` before changing the value, or use `safeIncreaseAllowance` / `safeDecreaseAllowance`.

## 12. Block.timestamp manipulation

```solidity
require(block.timestamp > deadline, "too early");
```

Validators can manipulate `block.timestamp` by ~12 seconds. Don't use for high-value time gates with second-level precision.

**Fix:** use longer windows; for exact ordering use block numbers.

## 13. Oracle price freshness

```solidity
(,int256 price,,,) = oracle.latestRoundData();
return uint256(price);
```

**Symptom:** stale or stuck oracle returns price from days ago; protocol mispriced.

**Fix:** check `updatedAt`:

```solidity
(uint80 roundId, int256 price, , uint256 updatedAt, uint80 answeredInRound) =
    oracle.latestRoundData();
require(price > 0, "bad price");
require(updatedAt > block.timestamp - HEARTBEAT, "stale");
require(answeredInRound >= roundId, "stale round");
```

## 14. Inflation attack on ERC-4626

First depositor manipulates share price by direct token transfer.

**Symptom:** small subsequent deposits round to zero shares; user loses funds.

**Fix:** OpenZeppelin's ERC-4626 includes `_decimalsOffset()` which mints virtual shares. Use OZ. If implementing manually, mint dead shares to `address(0)` on first deposit.

## 15. ERC-721 / ERC-1155 receiver hooks

Sending NFTs to contracts that don't implement `onERC721Received` reverts.

**Symptom:** NFT transfer reverts when destination is a contract.

**Fix:** check destination before transferring; or use `_safeTransfer` and ensure receiver is implemented.

## 16. Selfdestruct removal (Cancun fork)

`selfdestruct` no longer transfers balance and clears storage on Ethereum mainnet (post-Cancun). Code relying on it for refunds or upgrades breaks.

**Fix:** use explicit transfers; use upgradeable proxies for upgrades.

## 17. Storage collision in delegatecall

```solidity
contract Proxy {
    address impl;            // slot 0
}
contract Impl {
    address admin;           // slot 0  ← collides with Proxy.impl
}
```

**Symptom:** delegatecall corrupts state in unexpected ways.

**Fix:** EIP-1967 storage slots; OZ's TransparentUpgradeableProxy / UUPS handle this.

## 18. Initializer called twice

```solidity
function initialize() external {  // BUG: missing initializer modifier
    owner = msg.sender;
}
```

**Symptom:** anyone re-initializes and takes over.

**Fix:** use OZ's `Initializable.initializer` modifier.

## 19. Reading from uninitialized storage

```solidity
mapping(address => UserInfo) public users;

function getUser(address u) external view returns (UserInfo memory) {
    return users[u];  // returns default-zero struct if uninitialized
}
```

**Symptom:** caller treats default-zero as a real record. E.g., `users[u].active = false` (default) is interpreted as "user inactive" rather than "user doesn't exist."

**Fix:** add an explicit `exists` flag, or use a sentinel like `block.timestamp` of registration > 0.

## 20. Loops with unbounded length

```solidity
function distributeAll() external {
    for (uint256 i = 0; i < users.length; i++) {  // grows forever
        // ...
    }
}
```

**Symptom:** function eventually OOGs and is impossible to call.

**Fix:** paginate; require caller to pass batches.

## How to use this catalog

When debugging:

1. Look at the symptom and revert reason
2. Scan this list for matching shape
3. Form the hypothesis matching the candidate bug class
4. Verify with a targeted test

If your bug doesn't match any pattern here, it's either novel (rare) or a combination of two patterns (common).

## What to read next

- `references/repro-and-isolation.md` — get the bug reproducible first
- `references/trace-techniques.md` — read the EVM trace
- `security/SKILL.md` — security-grade review of these classes
- `audit/SKILL.md` — audit framework when patterns recur
