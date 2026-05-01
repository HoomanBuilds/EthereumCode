# State Machines in Solidity — Cookbook

A smart contract is a state machine. Between transactions it is frozen. The art of contract design is enumerating the states, the transitions, the gates on each transition, and the invariants that must hold across them. This file is the cookbook for those four things.

Read it before designing any multi-phase contract: auctions, sales, vesting, escrows, games, governance, vaults with epochs.

## Mental Model

```
                         ┌─────────────┐
                         │   STATE A   │
                         │ (invariants)│
                         └──────┬──────┘
                                │
              caller + gate + payload
                                │
                                ▼
                         ┌─────────────┐
                         │   STATE B   │
                         │ (invariants)│
                         └─────────────┘
```

Every transition has four parts:

- **Source state** the contract is in before the call.
- **Caller** authorized to attempt the transition (anyone, owner, role, condition-based).
- **Gate** the predicate that must hold for the transition to succeed (time, balance, signature, threshold).
- **Effect** the new state and emitted events.

Invariants are properties that hold across all states. Examples: `totalSupply == sum(balanceOf)`, `collateral >= debt * minRatio`, `block.timestamp >= startedAt`.

## Encoding the Machine

### Enum-based phase

The simplest pattern. One variable, one enum.

```solidity
contract Auction {
    enum Phase { Pending, Bidding, Reveal, Settled }
    Phase public phase;

    uint256 public bidStart;
    uint256 public bidEnd;
    uint256 public revealEnd;

    error WrongPhase(Phase expected, Phase actual);

    modifier inPhase(Phase expected) {
        if (phase != expected) revert WrongPhase(expected, phase);
        _;
    }

    function start() external {
        if (phase != Phase.Pending) revert WrongPhase(Phase.Pending, phase);
        bidStart = block.timestamp;
        bidEnd = bidStart + BID_DURATION;
        revealEnd = bidEnd + REVEAL_DURATION;
        phase = Phase.Bidding;
    }

    function bid(bytes32 commitment) external inPhase(Phase.Bidding) {
        if (block.timestamp >= bidEnd) revert WrongPhase(Phase.Reveal, phase);
        commitments[msg.sender] = commitment;
    }

    function reveal(uint256 amount, bytes32 salt) external {
        // Auto-advance phase if time has passed but state hasn't been updated.
        _advance();
        if (phase != Phase.Reveal) revert WrongPhase(Phase.Reveal, phase);
        require(commitments[msg.sender] == keccak256(abi.encode(amount, salt)));
        // ...
    }

    function _advance() internal {
        if (phase == Phase.Bidding && block.timestamp >= bidEnd) phase = Phase.Reveal;
        if (phase == Phase.Reveal && block.timestamp >= revealEnd) phase = Phase.Settled;
    }
}
```

Two patterns to notice:

1. **`_advance()` is permissionless.** Anyone calling any function can trigger phase progression. Nobody is required to babysit the auction.
2. **Time-based gates check `block.timestamp` against stored deadlines.** Solidity has no `setTimeout`. Time is a comparison, not a callback.

### Time-based vs condition-based gates

| Gate type | Example | Risk |
|---|---|---|
| `block.timestamp >= deadline` | Auction ends | Validators can drift timestamp by ~12s — fine for hour/day-scale gates, dangerous for sub-minute |
| `totalSupply >= cap` | ICO sold out | None inherent — just make sure cap is reachable |
| `votesFor > votesAgainst && quorumReached` | Governance proposal passes | Vote-buying, flash-loan voting if you read instantaneous balances |
| `oracle.latestRoundData().answer < threshold` | Price-triggered action | Stale oracle, manipulated DEX read — see `oracles.md` |
| `signature.recover() == authorized` | Off-chain approval | Replay if no nonce; use EIP-712 with domain separator |
| `merkleProof.verify(root, leaf)` | Allowlist mint | Root must be set by trusted account — clarify trust |

### Implicit phases via timestamps only

For simple two-phase machines you do not need an enum at all.

```solidity
contract Vesting {
    uint256 public immutable cliffAt;
    uint256 public immutable endAt;
    uint256 public immutable totalAmount;
    uint256 public claimed;

    function vested() public view returns (uint256) {
        if (block.timestamp < cliffAt) return 0;
        if (block.timestamp >= endAt) return totalAmount;
        return totalAmount * (block.timestamp - cliffAt) / (endAt - cliffAt);
    }

    function claim() external {
        require(msg.sender == beneficiary, "not beneficiary");
        uint256 amount = vested() - claimed;
        claimed += amount;
        token.transfer(beneficiary, amount);
    }
}
```

The state is `(claimed, block.timestamp)`. The phases are derived. No `if (phase == X)` clauses anywhere.

Prefer this for monotonic state machines. Use enums when the transitions are non-trivial (cycles, branches, abort paths).

## The Reentrancy Stance

Every state transition must follow checks-effects-interactions:

1. **Checks** — predicates, access control, gate conditions.
2. **Effects** — write all state that affects this caller's accounting.
3. **Interactions** — external calls (token transfers, callbacks).

```solidity
// Wrong — interaction before effect.
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
    balances[msg.sender] -= amount;  // attacker re-enters before this line
}

// Right — effect before interaction.
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
}
```

For multi-contract flows where reentrancy guards are insufficient, use OpenZeppelin's `ReentrancyGuard` or the transient-storage variant `ReentrancyGuardTransient` (OpenZeppelin v5.1+). Verify the latest API against https://docs.openzeppelin.com/contracts.

## Invariants — What Cannot Change

State machines are easier to reason about when you write down what stays true regardless of which transition fired.

Examples by contract type:

| Contract | Invariant |
|---|---|
| ERC-20 | `sum of balances == totalSupply` |
| Vault (4626) | `convertToAssets(totalSupply) <= totalAssets` |
| Lending pool | `for every borrower, collateralValue * LTV >= debtValue` |
| AMM (constant product) | `reserve0 * reserve1 >= k` after fees |
| Escrow | `depositedAmount == claimableByA + claimableByB + refunded` |

Encode invariants as runtime asserts in tests, and as fuzz/invariant tests in Foundry:

```solidity
// Foundry invariant test.
contract VaultInvariants is Test {
    Vault vault;

    function invariant_sharesBackedByAssets() public {
        uint256 supply = vault.totalSupply();
        uint256 assets = vault.totalAssets();
        // 1 share is always worth ≤ 1 asset (no free shares minted).
        assertGe(assets, supply);
    }
}
```

Verify the latest Foundry invariant testing API at https://book.getfoundry.sh — flags and helpers evolve.

## Branching State Machines

Auctions, escrows, and games often have two terminal states (success/failure, paid/refunded, won/lost). Encode the branch explicitly.

```solidity
contract Escrow {
    enum Status { Pending, Released, Refunded, Disputed }
    Status public status;

    function release() external onlyBuyer {
        if (status != Status.Pending) revert();
        status = Status.Released;
        token.transfer(seller, amount);
    }

    function refund() external onlySeller {
        if (status != Status.Pending) revert();
        status = Status.Refunded;
        token.transfer(buyer, amount);
    }

    function dispute() external {
        if (status != Status.Pending) revert();
        if (msg.sender != buyer && msg.sender != seller) revert();
        status = Status.Disputed;
    }

    function resolve(address winner) external onlyArbiter {
        if (status != Status.Disputed) revert();
        status = winner == buyer ? Status.Refunded : Status.Released;
        token.transfer(winner, amount);
    }
}
```

Each terminal state is one-shot — you cannot transition out of it. Mark them explicitly so a future maintainer does not add a back-edge.

## Avoiding Dead State

If a transition requires an actor that may not appear, the state can hang forever.

Bad: `function settle() external onlyOwner` — owner disappears, contract stuck.

Better: `function settle() external` with a public predicate, e.g. `block.timestamp >= deadline`.

Best: `function settle() external` plus a small caller incentive when settlement is non-trivial work.

Add a fallback for stuck states. Many escrows include a `expireAfter` deadline: if neither party acts within N days, anyone can refund the buyer.

```solidity
function expire() external {
    require(block.timestamp >= createdAt + EXPIRY, "not expired");
    require(status == Status.Pending, "not pending");
    status = Status.Refunded;
    token.transfer(buyer, amount);
}
```

## Pause and Upgrade — Choose Carefully

Pause and upgrade are state-transition tools. They are also censorship vectors.

| Mechanism | When to use | When NOT to use |
|---|---|---|
| `Pausable` modifier on critical paths | Early stage, security-incident response | Mature hyperstructures — you cannot un-build it |
| Proxy upgradeability (UUPS, Transparent) | Need to ship fixes; have governance | Anything claiming to be immutable |
| Immutable contract, governance-controlled parameters | Mature stage; only knobs change | Anything still iterating on logic |
| Fully immutable | Hyperstructure goal | Pre-audit code, novel mechanisms |

If you ship a pause, write down what triggers it, who can call it, and how it gets removed. Do not leave the trigger as "the team decides."

## Storage Layout Discipline

Even single-contract state machines need to think about storage. Two rules:

1. **Slot packing.** Solidity packs adjacent storage variables into one 32-byte slot if they fit. Order `bool` and `uint8` next to each other to save SSTOREs. Verify packing with `forge inspect <Contract> storageLayout`.
2. **Append-only on upgradeable contracts.** If you use a proxy, never reorder, remove, or change the type of existing storage variables. Add new variables at the end. Use `gap` arrays in inherited contracts to leave room.

```solidity
contract Base {
    uint256 public a;
    uint256 public b;
    uint256[50] private __gap;  // reserve slots for future fields in Base.
}

contract Child is Base {
    uint256 public c;  // takes from __gap budget when Base adds fields.
}
```

## Testing State Machines

Three test classes to write:

1. **Unit tests** — each transition with valid inputs, invalid inputs, boundary times.
2. **Sequence tests** — replay realistic user flows end-to-end (mint, transfer, claim, refund).
3. **Invariant tests** — Foundry `invariant_*` functions that hold for any random sequence of calls.

A useful exercise: list every (state, function) pair. For each, write a one-line test asserting the call either succeeds or reverts with the right error. A 4-state, 6-function contract has 24 such pairs. Most can be tested in two lines each.

```solidity
function test_bid_revertsInPending() public {
    vm.expectRevert(abi.encodeWithSelector(Auction.WrongPhase.selector, Phase.Bidding, Phase.Pending));
    auction.bid(bytes32(0));
}
```

## Common Mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Forgetting to advance phase on time | State hangs in old phase, users stuck | Auto-advance in every entry function or expose a public `_advance` |
| Reading `block.timestamp` for sub-minute gates | Validators manipulate within drift window | Use block-number gates, or larger time windows |
| Sharing one variable across two distinct concerns | Confusing branches, accidental overwrites | Use separate state variables; cost a few SSTOREs for clarity |
| `pause()` without `unpause()` plan | Funds locked forever if pauser key lost | Multisig + timelock, or auto-unpause after N days |
| Computing user balances at write time, not read time | Inconsistent under reentrancy | Compute on read; store ledger entries; settle on claim |

## When You Need Off-Chain Components

If your state machine genuinely needs an external trigger (commit-reveal randomness, oracle price arrival, cross-chain message), separate the concerns:

- The contract exposes a permissionless `fulfill(...)` function that anyone can call once the off-chain data is available.
- The off-chain component (Chainlink VRF, a relayer, a keeper network) is paid by the contract or by users.
- The state machine never enters a state that can only be left by the off-chain component without an alternative path.

Always design a fallback: if the off-chain component fails or disappears, anyone can `expire()` and recover funds.

## Further Reading

- OpenZeppelin Contracts (state machine helpers): https://docs.openzeppelin.com/contracts
- Foundry invariant testing: https://book.getfoundry.sh
- Solidity storage layout: https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html
- Trail of Bits "Building Secure Contracts": https://github.com/crytic/building-secure-contracts

Treat all signatures, library APIs, and parameter ranges in this file as illustrative; verify against the canonical source.
