# Reentrancy and State-Machine Bugs

A cookbook for stopping the attack class that has cost DeFi the most cumulative dollars: an external call re-entering your contract, or a downstream contract reading state mid-call. Every pattern below assumes Solidity `^0.8.20` and OpenZeppelin v5.

## The CEI Pattern, In Detail

Checks - Effects - Interactions, in that order. The order is load-bearing.

```solidity
pragma solidity ^0.8.20;

function withdraw(uint256 amount) external nonReentrant {
    // 1. Checks — validate first, no state mutations yet
    require(amount > 0, "zero amount");
    uint256 bal = balances[msg.sender];
    require(bal >= amount, "insufficient");

    // 2. Effects — write ALL state before ANY external call
    balances[msg.sender] = bal - amount;
    totalDeposits -= amount;

    // 3. Interactions — external calls last
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok, "transfer failed");
}
```

### Anti-pattern: partial effects

The most common reentrancy mistake is updating *some* state before the call and finishing afterwards. The attacker re-enters in the gap.

```solidity
// VULNERABLE — totalDeposits not yet decremented
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "insufficient");
    balances[msg.sender] -= amount;
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
    totalDeposits -= amount; // attacker re-entered before this line
}
```

If `totalDeposits` is read by `getSharePrice()` and the attacker re-enters a different function that calls `getSharePrice()`, share accounting is corrupted.

Rule: write **every** state variable that depends on the operation before the external call. If you cannot, refactor.

## Cross-Function Reentrancy

The guarded function is safe, but an attacker re-enters a *different* function that reads the same shared state.

```solidity
mapping(address => uint256) balances;

function withdraw() external nonReentrant {
    uint256 bal = balances[msg.sender];
    (bool ok,) = msg.sender.call{value: bal}("");
    require(ok);
    balances[msg.sender] = 0;
}

// No guard. Attacker re-enters here mid-withdraw and transfers their (still nonzero) balance away.
function transferShare(address to) external {
    uint256 bal = balances[msg.sender];
    balances[to] += bal;
    balances[msg.sender] = 0;
}
```

Defense:

1. Use a **single shared lock** (the same `nonReentrant` modifier) on every function that touches shared state, not just the obvious withdraw paths.
2. Keep CEI inside each function so even without the guard the invariants hold.

## Cross-Contract Reentrancy

Two contracts share state through a third (a registry, a token, a vault). The attacker bounces between them. The DAO hack was the canonical example.

```solidity
// Contract A reads B's totalSupply mid-call. B is not reentrant-locked relative to A.
function rewardsFor(address user) external view returns (uint256) {
    uint256 supply = vaultB.totalSupply();
    return (balances[user] * rewardPool) / supply;
}
```

Defense: when two contracts coordinate state, treat the pair as one trust boundary. Either share a lock (e.g., a shared `ReentrancyGuard` mixin contract both inherit through delegation, or pass a sentinel), or design so neither contract reads the other's mutable state during an external call.

## Read-Only Reentrancy

A view function returns stale state mid-call. A downstream protocol reads it and prices something incorrectly. The view function itself is safe — the consumer is not.

Curve LP token pricing was the canonical case in 2022-2023. `get_virtual_price()` could return a manipulated value during a `remove_liquidity` callback that re-entered into a separate lending market reading the price.

Defense, as a producer of read functions:

```solidity
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    // Expose the lock to read-only callers via a non-reverting check
    function reentrancyCheck() external view {
        require(!_reentrancyGuardEntered(), "reentrant view"); // OZ v5 helper
    }
}
```

OpenZeppelin v5 exposes `_reentrancyGuardEntered()` precisely so consumers can guard their views:

```solidity
function priceOfLP() external view returns (uint256) {
    vault.reentrancyCheck(); // reverts if vault is mid-call
    return vault.virtualPrice();
}
```

Defense, as a consumer: if you read another protocol's mutable view function during a price-sensitive operation, check whether they expose a reentrancy probe. If not, treat that price as untrusted.

## Token Hooks That Re-enter

Several token standards include receiver hooks. These hooks are reentrancy entry points by design.

| Standard | Hook | When fired |
|---|---|---|
| ERC-777 | `tokensReceived` | On every transfer |
| ERC-721 | `onERC721Received` | On `safeTransferFrom` to a contract |
| ERC-1155 | `onERC1155Received`, `onERC1155BatchReceived` | On `safeTransferFrom` to a contract |
| Native ETH | fallback / receive | On `call{value:}`, `transfer` (2300 gas), `send` (2300 gas) |

ERC-777 is the worst offender historically — the imBTC and Lendf.Me/dForce 2020 exploits used `tokensReceived` to re-enter a Uniswap V1 pool whose CEI was incomplete.

```solidity
// VULNERABLE pattern when accepting ERC-721
function deposit(uint256 tokenId) external {
    nft.safeTransferFrom(msg.sender, address(this), tokenId); // calls onERC721Received on us, but if we forward to msg.sender, attacker re-enters
    deposits[tokenId] = msg.sender;
}
```

If your contract is the recipient and you implement `onERC721Received`, do not call back to `msg.sender` from inside it — and apply `nonReentrant` to any externally-callable function that itself calls `safeTransferFrom`.

## ETH Send Mechanics

Three ways to send ETH:

| Method | Forwarded gas | Reverts on failure | Notes |
|---|---|---|---|
| `transfer(amount)` | 2300 (stipend) | Yes | Broken for proxies/Safes after EIP-1884 raised SLOAD costs. Avoid. |
| `send(amount)` | 2300 | No (returns bool) | Same problem as transfer. Avoid. |
| `call{value: amount}("")` | All remaining (or specified) | No (returns bool) | Use this. Always check the bool. |

```solidity
// CORRECT
(bool ok,) = recipient.call{value: amount}("");
require(ok, "send failed");
```

Because `call` forwards all gas, the recipient can do anything during reception — including re-entering. CEI plus `nonReentrant` is mandatory whenever you send ETH.

## ReentrancyGuard vs ReentrancyGuardTransient

OpenZeppelin v5.1 (post-Cancun, EIP-1153) added `ReentrancyGuardTransient`, which uses transient storage instead of a regular slot. Cheaper, automatically cleared at end of transaction.

```solidity
// Storage-based (works on every chain)
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    function withdraw() external nonReentrant { /* ... */ }
}
```

```solidity
// Transient (Cancun-enabled chains only)
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

contract Vault is ReentrancyGuardTransient {
    function withdraw() external nonReentrant { /* ... */ }
}
```

Decision matrix:

| Chain status | Use |
|---|---|
| L1 mainnet, post-Dencun | Either; transient ~2.1k gas cheaper per call |
| Base, Arbitrum, Optimism, post-EIP-1153 activation | Transient |
| zkSync Era and other chains without TSTORE | Storage-based |
| Targeting maximum portability | Storage-based |

Verify EIP-1153 support per chain at the chain's documentation page before choosing transient. When in doubt, use the storage version — the cost difference is small.

## Global Lock vs Per-Function Lock

`ReentrancyGuard` gives you one mutex per contract. Every guarded function shares it. That is usually what you want.

The mistake is the opposite: putting `nonReentrant` on only one function while leaving sibling functions that touch the same state unprotected. Cross-function reentrancy bypasses the partial guard.

If a contract has truly independent state machines (rare), split into separate contracts rather than juggling multiple mutexes.

## Try/Catch Does Not Help

A common misunderstanding: wrapping the external call in `try`/`catch` does not prevent reentrancy. The callee still runs to completion (or revert) before the try-block finishes, and during that run it can re-enter.

```solidity
// STILL VULNERABLE — try/catch is orthogonal to reentrancy
function withdraw() external {
    try ext.callback{value: bal}() {} catch {}
    balances[msg.sender] = 0; // attacker already re-entered
}
```

`try`/`catch` is for handling reverts. Reentrancy is handled by CEI plus a reentrancy guard.

## Pull-Payment over Push

Where possible, do not transfer to users in the middle of business logic. Credit a balance and let users withdraw it themselves.

```solidity
mapping(address => uint256) public pendingWithdrawals;

function _credit(address user, uint256 amount) internal {
    pendingWithdrawals[user] += amount;
}

function withdraw() external nonReentrant {
    uint256 amount = pendingWithdrawals[msg.sender];
    require(amount > 0, "nothing");
    pendingWithdrawals[msg.sender] = 0;
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok, "send failed");
}
```

The hot path no longer makes external calls, so reentrancy cannot disrupt it. Users pay their own gas to claim, which also limits griefing (one revert by a malicious receiver does not block other users).

## Multicall and Reentrancy

Batching helpers (Uniswap-style `multicall`) can become reentrancy vectors if a sub-call re-enters the multicall itself or shares state. Apply `nonReentrant` to the multicall entry point only; do not apply it to inner functions or all sub-calls revert with `ReentrancyGuardReentrantCall`.

```solidity
// PATTERN
function multicall(bytes[] calldata data) external nonReentrant returns (bytes[] memory) {
    bytes[] memory results = new bytes[](data.length);
    for (uint256 i = 0; i < data.length; i++) {
        (bool ok, bytes memory ret) = address(this).delegatecall(data[i]);
        require(ok, "multicall: sub-call failed");
        results[i] = ret;
    }
    return results;
}
```

Inner functions must not re-acquire the guard. In OpenZeppelin v5, only the entry point should carry `nonReentrant`.

## Real Exploits, Bug Class Summary

| Year | Protocol | Class | Lesson |
|---|---|---|---|
| 2016 | The DAO | Cross-function reentrancy via splitDAO | CEI; do not rely on stipend semantics |
| 2020 | Lendf.Me / dForce | ERC-777 hook in Uniswap V1 quote | Whitelisting tokens is not enough; hooks bypass naive guards |
| 2020 | imBTC Uniswap pool | ERC-777 hook re-entering swap | Same class; pool was drained ~25M USD |
| 2021 | Cream Finance | Reentrancy via AMP token (ERC-777) | Auditors must check token standards on integration |
| 2022 | Fei Rari | Cross-contract read-only reentrancy on cTokens | Read-only views can be stale during a call |
| 2023 | Curve stable pools (vyper compiler bug) | Reentrancy lock corrupted by compiler | Audit covers *compiled* output, not just source |

Patterns repeat. Most reentrancy losses are not novel bug classes; they are old ones surfacing through a new token, a new compiler version, or a new integration.

## Quick Audit Checklist

- Every state variable touched by an operation is written **before** any external call.
- Every external-call-bearing function has `nonReentrant`, even if CEI looks correct.
- View functions used by other protocols expose a reentrancy probe or document non-reentrant guarantees.
- No `transfer`/`send` for ETH. Use `call` and check the boolean.
- Token integrations check for ERC-777 / ERC-721 / ERC-1155 hooks. If found, hot paths are guarded.
- Multicall has the guard at the entry point only.
- For Cancun-enabled chains, consider `ReentrancyGuardTransient` for gas; otherwise plain `ReentrancyGuard`.
- Pull-payment over push wherever business logic permits.
